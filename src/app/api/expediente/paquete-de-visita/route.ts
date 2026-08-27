import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'
import { alergiasParaImpreso } from '@/lib/seguridad/alergias'
import { medicamentosDeLaReceta } from '@/lib/expediente/que-va-en-la-receta'
import {
  componerPaquete, liberar, retirar, mismoContenido, siguienteVersion,
  visibleParaElPaciente,
  type NotaParaElPaquete, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { ClinicConfig, Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'

/**
 * LIBERAR EL PAQUETE DE LA VISITA — POSTVISIT-001 · REG-335.
 *
 * ── EL INVARIANTE QUE ESTA RUTA EXISTE PARA SOSTENER ────────────────────────
 *
 *     FIRMAR UNA NOTA ≠ LIBERAR INFORMACIÓN AL PACIENTE.
 *
 * Firmar es un acto medicolegal hacia el expediente. Liberar es un acto de
 * comunicación hacia el paciente. Se pueden hacer con dos clics seguidos, pero
 * se registran aparte y **ninguno implica al otro**: esta ruta se niega a
 * componer de una nota sin firmar, y firmar una nota no llama a esta ruta.
 *
 * ── POR QUÉ ES EL SERVIDOR QUIEN COMPONE, Y NO EL NAVEGADOR ─────────────────
 *
 * Porque el §1 de `.claude/rules/patient-facing-ai.md` fija de QUÉ material
 * puede salir un dato específico del paciente, y una lista de fuentes que el
 * cliente puede saltarse no es una frontera: es una recomendación. Del cuerpo de
 * la petición sólo se aceptan identificadores y una fecha de seguimiento; el
 * contenido lo lee esta ruta de la base, de la nota FIRMADA, con
 * `medicamentosDeLaReceta` y `alergiasParaImpreso` — las mismas primitivas
 * canónicas que usa el impreso del médico.
 *
 * Ningún modelo de lenguaje toca este camino. Ninguno.
 *
 * ── IDEMPOTENCIA: EL DOBLE CLIC Y EL REINTENTO ──────────────────────────────
 *
 * El identificador del documento **es** el `notaId`. No un id generado: uno
 * derivado. Así, dos peticiones simultáneas —el doble clic del médico, el
 * reintento del navegador tras un timeout que en realidad sí llegó— escriben en
 * el MISMO documento y no pueden crear dos paquetes de la misma consulta. Y
 * dentro de la transacción, si lo que ya está liberado dice exactamente lo
 * mismo, no se escribe nada y se responde `yaEstaba: true`: no se sube la
 * versión, no se reescribe `approvedAt`, no se duplica la entrada de bitácora.
 *
 * ── CONCURRENCIA: EL PAQUETE VIEJO NO PISA LA VERSIÓN NUEVA ─────────────────
 *
 * Quien libera manda la `versionEsperada` que vio en su pantalla. Si en la base
 * hay una versión mayor —otra pestaña, otro médico, un reintento tardío de un
 * navegador que llevaba media hora abierto—, se responde **409** y no se
 * escribe. Sin esto, la pestaña vieja gana por llegar la última y el paciente
 * recibe el plan de antes de la corrección.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * - **No manda nada.** No hay WhatsApp aquí. Liberar es autorizar la lectura;
 *   entregar es otro acto, y su enlace sólo se compone si esto ya dijo que sí.
 * - **No borra.** Retirar deja una versión `DRAFT` nueva y su bitácora. Un
 *   documento que desaparece sin rastro es indistinguible de uno que no existió.
 */
export const runtime = 'nodejs'

const texto = (v: unknown, max = 128): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** `2026-09-08` y nada más. Lo único del cuerpo que acaba en el papel. */
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/

interface Cuerpo {
  action?: unknown
  clinicId?: unknown
  patientId?: unknown
  notaId?: unknown
  proximaCita?: unknown
  versionEsperada?: unknown
}

/**
 * Lo que estaba recetado en la visita firmada ANTERIOR a ésta.
 *
 * Devuelve `null` cuando la lectura falla, y **eso viaja hasta el paquete**:
 * `medicationChanges` acaba en `null` y la pantalla del paciente se calla, en
 * vez de decirle que nada cambió. Un fallo de red no es un dato clínico.
 */
async function medicacionDeLaVisitaAnterior(
  clinicId: string, patientId: string, notaId: string, fechaDeHoy: string,
): Promise<readonly string[] | null> {
  try {
    const snap = await adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('notas')
      .where('estado', '==', 'firmada')
      .get()
    const previas = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
      .filter(n => n.id !== notaId && String(n.fechaConsulta ?? '') < fechaDeHoy)
      .sort((a, b) => String(b.fechaConsulta).localeCompare(String(a.fechaConsulta)))
    /* Sin visita anterior, la lista previa está VACÍA y se sabe que lo está: es
       la primera consulta, así que todo lo de hoy es nuevo de verdad. Eso NO es
       lo mismo que no haber podido leer, y por eso son dos valores distintos. */
    const anterior = previas[0]
    if (!anterior) return []
    return medicamentosDeLaReceta(anterior.medicamentos ?? []).map(m => String(m.nombre ?? '')).filter(Boolean)
  } catch (e) {
    safeLog.error(`[paquete] ${clinicId}: no se pudo leer la visita anterior`, e)
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: Cuerpo
  try { body = (await req.json()) as Cuerpo } catch { return NextResponse.json({ ok: false, error: 'Petición inválida' }, { status: 400 }) }

  const clinicId = texto(body.clinicId)
  const patientId = texto(body.patientId)
  const notaId = texto(body.notaId)
  const action = texto(body.action, 32)

  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Falta clinicId, patientId o notaId' }, { status: 400 })
  }

  /**
   * `firmar` y no `clinico.escribir`: liberar es un acto de AUTORIDAD CLÍNICA
   * sobre lo que el paciente va a leer como definitivo, del mismo peso que
   * sellar la nota. La asistente puede escribir en el expediente y no puede
   * decidir qué se le enseña al paciente como aprobado por su médico.
   *
   * Y la comprobación es de MEMBRESÍA de ESTE consultorio: el `clinicId` del
   * cuerpo se contrasta contra la membresía real de quien firma la petición, así
   * que un médico del consultorio A no puede liberar en el B ni sabiendo su id.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acceso.ok) return acceso.response

  const notaRef = adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas').doc(notaId)
  const paqueteRef = adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita').doc(notaId)

  try {
    if (action === 'retirar') return await retirarPaquete(req, clinicId, patientId, notaId, paqueteRef, acceso)
    if (action !== 'previsualizar' && action !== 'liberar') {
      return NextResponse.json({ ok: false, error: 'Acción no soportada' }, { status: 400 })
    }

    /* ── El material, leído de la base y de ningún otro sitio ────────────── */
    const notaSnap = await notaRef.get()
    if (!notaSnap.exists) return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 })
    const nota = { id: notaId, ...(notaSnap.data() as Record<string, unknown>) } as unknown as NotaParaElPaquete

    /**
     * ALERGIAS: `null` cuando NO SE PUDO LEER, no `''`.
     *
     * Es la misma asimetría que ya defiende la receta del portal (H-01). Una
     * cadena vacía se lee como «no hay alergias registradas»; un fallo de
     * Firestore no autoriza a afirmar eso sobre nadie.
     */
    let alergias: string | null = null
    try {
      const pSnap = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
      if (pSnap.exists) alergias = alergiasParaImpreso(pSnap.data() as Patient)
    } catch (e) {
      safeLog.error(`[paquete] ${clinicId}: no se pudo leer el expediente para alergias`, e)
      alergias = null
    }

    let telefono = ''
    try {
      const cSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
      const c = cSnap.data() as ClinicConfig | undefined
      telefono = String(c?.whatsappConsultorio || c?.telefonoAdmin || '')
    } catch { /* sin teléfono el bloque de contacto va vacío; no se inventa uno */ }

    const proximaCita = ES_FECHA.test(texto(body.proximaCita, 10)) ? texto(body.proximaCita, 10) : ''
    const medicacionPrevia = await medicacionDeLaVisitaAnterior(
      clinicId, patientId, notaId, String(nota.fechaConsulta ?? ''),
    )

    const compuesto = componerPaquete({ nota, medicacionPrevia, alergias, telefonoDelConsultorio: telefono, proximaCita })
    if (!compuesto.ok) {
      /**
       * SE DICE POR QUÉ, y el motivo es accionable en la pantalla del médico.
       * `nota-sin-firmar` es literalmente `POSTVISIT-GATE-001`: antes la hoja se
       * componía del borrador en curso y nada lo impedía.
       */
      return NextResponse.json({ ok: false, motivo: compuesto.motivo, error: MOTIVOS[compuesto.motivo] }, { status: 409 })
    }

    /* Previsualizar NO escribe: es el borrador que el médico lee antes de decidir. */
    if (action === 'previsualizar') {
      return NextResponse.json({ ok: true, paquete: compuesto.paquete })
    }

    const versionEsperada = Number.isFinite(Number(body.versionEsperada)) ? Number(body.versionEsperada) : 0
    const quien = acceso.uid
    const cuando = Date.now()

    const resultado = await adminDb.runTransaction(async tx => {
      const actual = await tx.get(paqueteRef)
      const previo = actual.exists ? (actual.data() as PaqueteDeVisita) : null

      if (previo) {
        /**
         * EL PAQUETE VIEJO NO PISA LA VERSIÓN NUEVA. Una pestaña abierta desde
         * hace media hora manda la versión que vio; si la base ya va por delante,
         * se rechaza en vez de sobrescribir con contenido anterior.
         */
        if (versionEsperada && previo.version > versionEsperada) {
          return { estado: 'conflicto' as const, paquete: previo }
        }
        /* Doble clic y reintento: mismo contenido ya liberado ⇒ no se escribe. */
        if (visibleParaElPaciente(previo) && mismoContenido(previo, compuesto.paquete)) {
          return { estado: 'yaEstaba' as const, paquete: previo }
        }
        const siguiente = liberar(siguienteVersion(previo, compuesto.paquete), quien, cuando)
        tx.set(paqueteRef, siguiente)
        return { estado: 'liberado' as const, paquete: siguiente }
      }

      const nuevo = liberar(compuesto.paquete, quien, cuando)
      tx.set(paqueteRef, nuevo)
      return { estado: 'liberado' as const, paquete: nuevo }
    })

    if (resultado.estado === 'conflicto') {
      return NextResponse.json(
        {
          ok: false,
          motivo: 'version-superada',
          error: 'Alguien liberó una versión más nueva de esta consulta. Recarga antes de volver a liberar.',
          version: resultado.paquete.version,
        },
        { status: 409 },
      )
    }

    if (resultado.estado === 'liberado') {
      await bitacora(req, clinicId, patientId, notaId, acceso, 'paquete_liberado', {
        version: resultado.paquete.version,
        medicamentos: resultado.paquete.medicationInstructions.length,
        estudios: resultado.paquete.orders.length,
      })
    }

    return NextResponse.json({
      ok: true,
      yaEstaba: resultado.estado === 'yaEstaba',
      paquete: resultado.paquete,
    })
  } catch (e) {
    /* Nunca el paciente, nunca la nota, nunca el contenido: esto acaba en Vercel. */
    safeLog.error(`[paquete] ${clinicId}: fallo al ${action}`, e)
    return NextResponse.json({ ok: false, error: 'Error del servidor' }, { status: 500 })
  }
}

const MOTIVOS: Record<string, string> = {
  'nota-sin-firmar': 'Esta nota todavía no está firmada. Fírmala antes de liberar nada al paciente.',
  /**
   * NOMBRE **Y** CÉDULA — REG-336. Decía sólo «cédula profesional», y el
   * Golden Path se topó con este mensaje en una nota que SÍ tenía cédula: lo
   * que le faltaba era el nombre. Mandar al médico a revisar lo único que no
   * está roto le gasta el rato que tiene al paciente delante.
   */
  'nota-sin-firma': 'Esta nota no trae el nombre y la cédula de quien la firmó: no hay a quién atribuir el papel.',
}

type Acceso = { uid: string; email?: string | null; role?: string | null }

async function retirarPaquete(
  req: NextRequest,
  clinicId: string, patientId: string, notaId: string,
  paqueteRef: FirebaseFirestore.DocumentReference,
  acceso: Acceso,
) {
  const resultado = await adminDb.runTransaction(async tx => {
    const actual = await tx.get(paqueteRef)
    if (!actual.exists) return null
    const previo = actual.data() as PaqueteDeVisita
    if (!visibleParaElPaciente(previo)) return previo   // ya estaba retirado: idempotente
    const retirado = retirar(previo)
    tx.set(paqueteRef, retirado)
    return retirado
  })
  if (!resultado) return NextResponse.json({ ok: false, error: 'No hay paquete que retirar' }, { status: 404 })
  await bitacora(req, clinicId, patientId, notaId, acceso, 'paquete_retirado', { version: resultado.version })
  return NextResponse.json({ ok: true, paquete: resultado })
}

/**
 * LA BITÁCORA — quién liberó qué y cuándo, sin una palabra de contenido clínico.
 *
 * Van CONTEOS, no nombres de fármaco: la bitácora se exporta, se consulta desde
 * la pantalla de cumplimiento y se le pone delante a un auditor. Que se liberó
 * un paquete con cuatro medicamentos es trazabilidad; cuáles eran ya está en el
 * expediente, que es donde está protegido.
 *
 * Identidad y hora del SERVIDOR, nunca del cuerpo de la petición.
 */
async function bitacora(
  req: NextRequest,
  clinicId: string, patientId: string, notaId: string,
  acceso: Acceso,
  evento: 'paquete_liberado' | 'paquete_retirado',
  meta: Record<string, unknown>,
) {
  try {
    await adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento,
      clinicId,
      patientId,
      notaId,
      medicoUid: acceso.uid,
      medicoEmail: acceso.email ?? null,
      rol: acceso.role ?? null,
      contexto: {
        userAgent: String(req.headers.get('user-agent') ?? '').slice(0, 200) || null,
        ip: String(req.headers.get('x-forwarded-for') ?? '').slice(0, 64) || null,
      },
      meta,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (e) {
    /* La bitácora no puede tumbar la liberación, pero su fallo NO se traga en
       silencio: sin esta línea, un rastro que dejó de escribirse hace semanas
       sigue pareciendo completo el día que alguien lo pide. */
    safeLog.error(`[paquete] ${clinicId}: no se pudo escribir la bitácora de ${evento}`, e)
  }
}
