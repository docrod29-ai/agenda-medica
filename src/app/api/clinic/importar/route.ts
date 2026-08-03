/**
 * POST /api/clinic/importar?clinicId=…[&simular=1][&sobrescribir=1]
 *
 * EL CAMINO DE VUELTA. Cuerpo: el NDJSON tal cual salió de `clinic/exportar`.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * v947 dejó el respaldo bien: servidor, NDJSON, paginado, con cabecera y pie.
 * Pero **no había importador**, y un respaldo que no se puede volver a meter no
 * es un respaldo: es un archivo del que nadie sabe si sirve.
 *
 * «Tenemos respaldos» sin una restauración probada es una hipótesis. El propio
 * `scripts/respaldos-verificar.mjs` termina diciéndolo: «falta una cosa que esto
 * no puede comprobar: haber RESTAURADO alguna vez».
 *
 * ── LOS CANDADOS ─────────────────────────────────────────────────────────────
 *
 *  · **Sólo a consultorio vacío**, salvo que se pida `sobrescribir` a propósito.
 *    Restaurar encima de datos mezcla dos historias clínicas sin que nadie pueda
 *    distinguirlas después.
 *  · **Modo ensayo** (`simular=1`): dice qué escribiría, sin escribir nada.
 *  · **Las llaves de API no entran nunca**, aunque el archivo las traiga.
 *  · **Una línea rota no aborta la restauración**: se rechaza con su razón y
 *    aparece en el informe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCIONES } from '@/lib/clinica/respaldo'
import { leerLinea, reenraizar, admitir, type InformeRestauracion } from '@/lib/clinica/restaurar'

export const maxDuration = 300

/** Documentos por lote. Firestore admite 500; se deja margen. */
const LOTE = 400
/** Tope de líneas rechazadas que se detallan. El resto sólo se cuenta. */
const TOPE_RECHAZADAS = 50

export async function POST(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })
  const simular = req.nextUrl.searchParams.get('simular') === '1'
  const sobrescribir = req.nextUrl.searchParams.get('sobrescribir') === '1'

  /**
   * `administrar`: esto reescribe el consultorio entero. Es la operación más
   * destructiva de la aplicación después de la supresión ARCO.
   */
  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  const clinicRef = adminDb.collection('clinics').doc(clinicId)

  try {
    /**
     * ¿ESTÁ VACÍO?
     *
     * Basta con encontrar UN paciente o UNA cita: no hace falta contar. Se mira
     * antes de leer el archivo, para no hacer esperar a nadie por un rechazo.
     */
    if (!sobrescribir && !simular) {
      const [pac, cit] = await Promise.all([
        clinicRef.collection('patients').limit(1).get(),
        clinicRef.collection('appointments').limit(1).get(),
      ])
      if (!pac.empty || !cit.empty) {
        return NextResponse.json({
          ok: false,
          error: 'Este consultorio ya tiene datos. Restaurar encima mezclaría dos historias clínicas sin poder distinguirlas después. Usa un consultorio vacío, o pídelo con `sobrescribir=1` a sabiendas.',
        }, { status: 409 })
      }
    }

    const texto = await req.text()
    if (!texto.trim()) {
      return NextResponse.json({ ok: false, error: 'El archivo llegó vacío' }, { status: 400 })
    }

    const informe: InformeRestauracion = {
      escritos: 0, porColeccion: {}, rechazadas: [],
      archivoCompleto: false, origen: null, reenraizado: false,
    }
    let rechazadasTotal = 0
    // Las colecciones que el manifiesto conoce; una desconocida no se escribe.
    const conocidas = new Set<string>()
    for (const c of COLECCIONES) {
      conocidas.add(c.ruta)
      for (const h of c.hijas ?? []) conocidas.add(`${c.ruta}.${h}`)
    }

    let lote = adminDb.batch()
    let enLote = 0
    const vaciar = async () => {
      if (enLote === 0) return
      if (!simular) await lote.commit()
      lote = adminDb.batch()
      enLote = 0
    }

    const rechazar = (porQue: string, crudo: string) => {
      rechazadasTotal++
      if (informe.rechazadas.length < TOPE_RECHAZADAS) informe.rechazadas.push({ porQue, crudo })
    }

    for (const crudo of texto.split('\n')) {
      const l = leerLinea(crudo)
      if (!l) continue
      if (l.clase === 'rechazada') { rechazar(l.porQue, l.crudo); continue }
      if (l.clase === 'cabecera') {
        informe.origen = typeof l.datos.clinicId === 'string' ? l.datos.clinicId : null
        informe.reenraizado = !!informe.origen && informe.origen !== clinicId
        continue
      }
      if (l.clase === 'pie') { informe.archivoCompleto = true; continue }

      if (!conocidas.has(l.coleccion)) {
        rechazar(`colección desconocida: ${l.coleccion}`, l.ruta)
        continue
      }
      const v = admitir(l.coleccion)
      if (!v.escribir) { rechazar(v.porQue, l.ruta); continue }

      // Se reescribe la raíz SIEMPRE: aunque el origen coincida, así el destino
      // es el del parámetro y no el que venga escrito en el archivo.
      const destino = reenraizar(l.ruta, clinicId)
      if (!simular) lote.set(adminDb.doc(destino), l.datos, { merge: true })
      informe.escritos++
      informe.porColeccion[l.coleccion] = (informe.porColeccion[l.coleccion] ?? 0) + 1
      enLote++
      if (enLote >= LOTE) await vaciar()
    }
    await vaciar()

    /**
     * SIN PIE, EL ARCHIVO PUEDE ESTAR CORTADO.
     *
     * No se rechaza —lo escrito ya sirve— pero se DICE, porque restaurar medio
     * respaldo creyendo que era entero es la peor forma de perder datos: se cree
     * que están.
     */
    if (!simular) {
      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: {
          accion: 'restauracion', origen: informe.origen ?? '',
          escritos: informe.escritos, rechazadas: rechazadasTotal,
          archivoCompleto: informe.archivoCompleto,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede tumbar una restauración ya aplicada */ })
    }

    return NextResponse.json({
      ok: true, simulado: simular, ...informe, rechazadasTotal,
      aviso: informe.archivoCompleto ? null
        : 'El archivo no traía la línea de cierre: puede estar cortado. Lo escrito sirve, pero NO lo des por completo.',
    })
  } catch (e) {
    safeLog.error('[clinic/importar]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo restaurar el respaldo' }, { status: 500 })
  }
}
