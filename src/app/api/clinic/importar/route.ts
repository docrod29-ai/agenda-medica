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
 *    mira quién es el dueño ANTES de escribir — y desde REG-349 mirar y escribir
 *    son **un solo acto**, dentro de una transacción.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCIONES, rutasDelArbol } from '@/lib/clinica/respaldo'
import {
  leerLinea, reenraizar, reenraizarPorCampo, admitir, admitirRaizExistente,
  type InformeRestauracion, type Veredicto,
} from '@/lib/clinica/restaurar'

export const maxDuration = 300

/** Documentos por lote. Firestore admite 500; se deja margen. */
const LOTE = 400
/**
 * Documentos de nivel raíz que se comprueban y se escriben **en una sola
 * transacción**.
 *
 * Se leen en bloque en vez de uno a uno porque una ida y vuelta por documento,
 * en un consultorio con miles de solicitudes de reseña, gasta el presupuesto de
 * la función entera antes de escribir nada.
 *
 * El tope es 200 y no 500 —el máximo de escrituras de una transacción de
 * Firestore— por dos razones: deja margen para que el grupo entero quepa con
 * holgura, y acota lo que se pierde cuando una reejecución por contención
 * obliga a repetir el grupo.
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
     * ── LAS DE NIVEL RAÍZ (REG-348 · REG-349) ──────────────────────────────
     *
     * `clinic_members/{uid}` es la MISMA ruta en todos los consultorios: no hay
     * re-enraizado de ruta que los separe. Escribir a ciegas con `merge`
     * arrastraría al consultorio que se restaura a alguien que hoy trabaja en
     * otro, y esa persona perdería el acceso al suyo sin que nadie hiciera nada
     * mal. Por eso se mira de quién es el documento antes de escribirlo.
     *
     * **REG-349 — mirar y escribir tienen que ser UN acto.** REG-348 lo miraba
     * con un `getAll` suelto y escribía después, en un lote que se commiteaba
     * más tarde. Entre las dos cosas no había nada, así que un alta normal en
     * el consultorio vecino, ocurrida en ese hueco, se perdía: la restauración
     * escribía sobre una foto vieja y le quitaba la cuenta a esa persona **sin
     * que nadie hubiera hecho nada mal**, y el informe lo contaba como escrito.
     *
     * Ahora el grupo entero va dentro de una **transacción**: la lectura fija la
     * versión de cada documento y, si alguna cambió antes del commit, Firestore
     * reejecuta y la segunda vuelta sí ve al vecino y se aparta.
     *
     * El árbol del consultorio (`clinics/{id}/…`) NO necesita esto y sigue por
     * lote: ahí la ruta ya separa los consultorios y no hay identificador que
     * disputar. Pagar una transacción por cada nota sería caro sin comprar nada.
     */
    const pendientesRaiz: {
      ruta: string; coleccion: string; campoClinica: string; datos: Record<string, unknown>
    }[] = []

    type DecisionRaiz = { indice: number; veredicto: Veredicto; reapuntado: boolean }

    /**
     * Qué hacer con cada documento del grupo, visto lo que hay hoy en el
     * destino. **Puro**: no toca el informe.
     *
     * Que sea puro no es estilo. El cuerpo de una transacción se REEJECUTA ante
     * contención, así que cualquier contador que se tocara aquí dentro contaría
     * dos veces la misma línea — y el informe de una restauración es lo único
     * que le queda a quien la corrió para saber qué pasó.
     */
    const decidirRaiz = (
      grupo: typeof pendientesRaiz,
      actuales: Array<{ exists: boolean; data: () => Record<string, unknown> | undefined }>,
    ): DecisionRaiz[] => grupo.map((g, indice) => {
      const snap = actuales[indice]
      return {
        indice,
        veredicto: admitirRaizExistente(
          snap?.exists ? snap.data() : undefined, g.campoClinica, clinicId,
        ),
        reapuntado: g.datos[g.campoClinica] !== clinicId,
      }
    })

    const vaciarRaiz = async () => {
      if (pendientesRaiz.length === 0) return
      const grupo = pendientesRaiz.splice(0, pendientesRaiz.length)
      const refs = grupo.map(g => adminDb.doc(g.ruta))

      /**
       * EL ENSAYO LEE, PERO NO NECESITA TRANSACCIÓN: no escribe nada, así que no
       * hay nada que proteger de una carrera. Lo que sí hace —y hace falta que
       * haga— es la MISMA comprobación: un ensayo que no ve la colisión no
       * ensaya el paso que puede fallar.
       */
      const decisiones = simular
        ? decidirRaiz(grupo, await adminDb.getAll(...refs))
        : await adminDb.runTransaction(async tx => {
            const actuales = await tx.getAll(...refs)
            const d = decidirRaiz(grupo, actuales)
            for (const { indice, veredicto } of d) {
              if (!veredicto.escribir) continue
              const g = grupo[indice]
              tx.set(refs[indice], reenraizarPorCampo(g.datos, g.campoClinica, clinicId), { merge: true })
            }
            return d
          })

      // Ya commiteado (o ya sabido, en el ensayo): AHORA se cuenta.
      for (const { indice, veredicto, reapuntado } of decisiones) {
        const g = grupo[indice]
        if (!veredicto.escribir) {
          informe.raizDeOtroConsultorio++
          rechazar(veredicto.porQue, g.ruta)
          continue
        }
        if (reapuntado) informe.raizReapuntada++
        anotar(g.coleccion)
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
    // Las de nivel raíz que quedaran en el buffer. Van por su cuenta: desde
    // REG-349 no comparten lote con el árbol.
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
