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
 *  · **Restaurar no le quita nada a otro consultorio** (REG-348): las
 *    colecciones de nivel raíz comparten espacio de identificadores, así que se
 *    mira quién es el dueño ANTES de escribir.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCIONES, rutasDelArbol } from '@/lib/clinica/respaldo'
import {
  leerLinea, reenraizar, reenraizarPorCampo, admitir, admitirRaizExistente,
  type InformeRestauracion,
} from '@/lib/clinica/restaurar'

export const maxDuration = 300

/** Documentos por lote. Firestore admite 500; se deja margen. */
const LOTE = 400
/**
 * Documentos de nivel raíz que se comprueban de una vez contra el destino.
 * Se leen en bloque (`getAll`) en vez de uno a uno: una lectura por documento
 * en un consultorio con miles de solicitudes de reseña gasta el presupuesto de
 * la función entera antes de escribir nada.
 */
const LOTE_RAIZ = 200
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
      raizReapuntada: 0, raizDeOtroConsultorio: 0,
    }
    let rechazadasTotal = 0
    /**
     * Las colecciones que el manifiesto conoce; una desconocida no se escribe.
     *
     * ── REGRESIÓN PROPIA, v1037 → v1043 ───────────────────────────────────
     *
     * Esto recorría `c.hijas` interpolando cada elemento en una plantilla. Al
     * convertir `hijas` en un ÁRBOL —para que el respaldo se llevara también las
     * adendas y las versiones de cada nota— los elementos dejaron de ser cadenas
     * y pasaron a ser objetos, así que la plantilla producía
     * `patients.[object Object]`.
     *
     * Consecuencia: `patients.notas` ya no figuraba entre las conocidas y **toda
     * nota se rechazaba al restaurar** con «colección desconocida». El respaldo
     * se exportaba completo y no se podía volver a meter — que es justo el
     * momento en que un respaldo importa.
     *
     * `rutasDelArbol` aplana el árbol entero, así que las dos mitades quedan
     * atadas a la misma fuente y no pueden volver a separarse.
     */
    const conocidas = new Set<string>()
    for (const c of COLECCIONES) for (const r of rutasDelArbol(c)) conocidas.add(r)

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

    const anotar = (coleccion: string) => {
      informe.escritos++
      informe.porColeccion[coleccion] = (informe.porColeccion[coleccion] ?? 0) + 1
    }

    /**
     * ── LAS DE NIVEL RAÍZ (REG-348) ────────────────────────────────────────
     *
     * `clinic_members/{uid}` es la MISMA ruta en todos los consultorios: no hay
     * re-enraizado de ruta que los separe. Escribir a ciegas con `merge`
     * arrastraría al consultorio que se restaura a alguien que hoy trabaja en
     * otro, y esa persona perdería el acceso al suyo sin que nadie hiciera nada
     * mal. Por eso se lee el destino ANTES de escribir.
     *
     * Se acumulan y se comprueban en bloque para no gastar una ida y vuelta por
     * documento. La comprobación se hace TAMBIÉN en modo ensayo: un ensayo que
     * no ve la colisión no ensaya el paso que puede fallar.
     */
    const pendientesRaiz: {
      ruta: string; coleccion: string; campoClinica: string; datos: Record<string, unknown>
    }[] = []

    const vaciarRaiz = async () => {
      if (pendientesRaiz.length === 0) return
      const grupo = pendientesRaiz.splice(0, pendientesRaiz.length)
      const actuales = await adminDb.getAll(...grupo.map(g => adminDb.doc(g.ruta)))
      for (let i = 0; i < grupo.length; i++) {
        const g = grupo[i]
        const snap = actuales[i]
        const v = admitirRaizExistente(
          snap?.exists ? (snap.data() as Record<string, unknown>) : undefined,
          g.campoClinica, clinicId,
        )
        if (!v.escribir) {
          informe.raizDeOtroConsultorio++
          rechazar(v.porQue, g.ruta)
          continue
        }
        if (g.datos[g.campoClinica] !== clinicId) informe.raizReapuntada++
        if (!simular) {
          lote.set(adminDb.doc(g.ruta), reenraizarPorCampo(g.datos, g.campoClinica, clinicId), { merge: true })
        }
        anotar(g.coleccion)
        enLote++
        if (enLote >= LOTE) await vaciar()
      }
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

      if (l.nivel === 'raiz') {
        pendientesRaiz.push({
          ruta: l.ruta, coleccion: l.coleccion, campoClinica: l.campoClinica, datos: l.datos,
        })
        if (pendientesRaiz.length >= LOTE_RAIZ) await vaciarRaiz()
        continue
      }

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
      anotar(l.coleccion)
      enLote++
      if (enLote >= LOTE) await vaciar()
    }
    // Las de nivel raíz que quedaran en el buffer, ANTES del último commit.
    await vaciarRaiz()
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
          raizReapuntada: informe.raizReapuntada,
          raizDeOtroConsultorio: informe.raizDeOtroConsultorio,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede tumbar una restauración ya aplicada */ })
    }

    /**
     * LO QUE FALTA SE DICE, Y SE DICE ENTERO.
     *
     * Un aviso sustituyendo a otro deja al médico creyendo que ya vio todo lo
     * que hay que ver. Se acumulan.
     */
    const avisos: string[] = []
    if (!informe.archivoCompleto) {
      avisos.push('El archivo no traía la línea de cierre: puede estar cortado. Lo escrito sirve, pero NO lo des por completo.')
    }
    if (informe.raizDeOtroConsultorio > 0) {
      avisos.push(
        `${informe.raizDeOtroConsultorio} documento(s) de nivel raíz NO se restauraron porque su identificador ya pertenece a otro consultorio: restaurarlos se lo habrían quitado. Si alguno era una membresía, esa persona NO podrá entrar hasta que se le dé de alta a mano.`,
      )
    }

    return NextResponse.json({
      ok: true, simulado: simular, ...informe, rechazadasTotal,
      aviso: avisos.length > 0 ? avisos.join(' · ') : null,
    })
  } catch (e) {
    safeLog.error('[clinic/importar]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo restaurar el respaldo' }, { status: 500 })
  }
}
