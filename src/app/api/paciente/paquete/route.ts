import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'
import {
  componerPaquete, liberar, mismoContenido, visibleParaElPaciente,
  ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import type { NotaMedica } from '@/types/expediente'
import type { ClinicConfig } from '@/types'

/**
 * ENTREGARLE LA VISITA AL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── QUÉ RESUELVE ────────────────────────────────────────────────────────────
 *
 * Dos hallazgos de la auditoría del producto real (`PATIENT-UX-TRUTH-001`):
 *
 *  · **`POSTVISIT-GATE-001`** — la hoja del paciente se componía del borrador
 *    EN CURSO. El médico podía copiarla a mitad del dictado.
 *  · **`POSTVISIT-ENTREGA-001`** — y aun así no llegaba nunca: copiar e
 *    imprimir eran las dos únicas salidas. La pieza mejor pensada del lado del
 *    paciente no salía de la pantalla del médico.
 *
 * ── POR QUÉ LA COMPOSICIÓN OCURRE AQUÍ Y NO EN EL NAVEGADOR ─────────────────
 *
 * El cliente manda **tres identificadores y nada más**: clínica, paciente y
 * nota. El contenido se compone en el servidor leyendo la nota firmada de
 * Firestore.
 *
 * Si el navegador mandara el paquete ya armado, la compuerta sería decorativa:
 * bastaría un POST a mano con el contenido que a uno le apetezca —una dosis
 * distinta, un diagnóstico que nadie firmó— y el servidor lo guardaría como
 * «aprobado por el médico», con su nombre y su hora. Lo que se aprueba tiene
 * que ser lo que está firmado, y de eso sólo puede estar seguro quien lee la
 * nota.
 *
 * ── LA APROBACIÓN ES DEL MÉDICO, Y SE REGISTRA ──────────────────────────────
 *
 * `firmar` como capacidad —{medico, admin}, la misma que sella una nota o una
 * receta— porque liberar es un acto de aprobación clínica: le pone el nombre de
 * alguien a lo que el paciente va a leer y a obedecer. `approvedBy` sale de la
 * sesión verificada, nunca del cuerpo de la petición.
 *
 * ── VERSIONES, NO REESCRITURAS ──────────────────────────────────────────────
 *
 * Un paquete liberado es inmutable: si el contenido cambia (una adenda que
 * corrige la dosis), se libera una versión nueva y la anterior se conserva. Si
 * el contenido es idéntico, no se escribe nada — pulsar «Entregar» dos veces no
 * puede llenarle el expediente de copias.
 */

/** Doc id de una versión. Determinista: la misma versión no se duplica. */
const idDeVersion = (notaId: string, version: number) => `${notaId}__v${version}`

async function leerPaquetes(clinicId: string, patientId: string, notaId: string) {
  const snap = await adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('paquetes_visita')
    .where('notaId', '==', notaId)
    .get()
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as unknown as PaqueteDeVisita & { id: string })
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
}

/**
 * Lo que el paciente ya tomaba, según sus notas firmadas **anteriores**.
 *
 * `null` cuando no hay ninguna: un paciente de primera vez no tiene lista
 * previa, y decirle que todos sus medicamentos son «nuevos» sería afirmar algo
 * que nadie comprobó. Sin lista, `cambiosDeMedicacion` devuelve `null` y la
 * pantalla dice que no se pudo determinar — no «sin cambios».
 */
async function medicacionPrevia(
  clinicId: string, patientId: string, notaId: string, fechaDeEsta: string,
): Promise<string[] | null> {
  const snap = await adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas')
    .where('estado', '==', ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR)
    .get()
  const anteriores = snap.docs
    .filter(d => d.id !== notaId)
    .map(d => d.data() as NotaMedica)
    .filter(n => String(n.fechaConsulta ?? '') <= String(fechaDeEsta ?? ''))
    .map(n => ({ fecha: String(n.fechaConsulta ?? ''), medicamentos: n.medicamentos ?? [] }))
  if (!anteriores.length) return null
  return medicamentosVigentes(anteriores).map(o => o.medicamento.nombre)
}

/** Cómo contactar al consultorio, tal como está configurado. Sin adornos. */
function contacto(cfg: ClinicConfig | null): string {
  const tel = cfg?.whatsappConsultorio || cfg?.telefonoAdmin || ''
  return tel ? `Si tienes dudas, llama a tu consultorio: ${tel}` : ''
}

/**
 * La nota, buscada DENTRO del paciente de la petición.
 *
 * El `patientId` va en el camino, no en una comparación posterior: una
 * comprobación que se hace después se puede olvidar; un camino que lleva el
 * paciente dentro no encuentra la nota de otro.
 *
 * La capacidad se comprueba en cada handler y NO aquí a propósito: el guardián
 * de rutas exige ver `verificarCapacidad(req, clinicId, '<literal>')` dentro del
 * handler exportado. Un guardián escondido en un ayudante es un guardián que
 * nadie puede auditar leyendo la ruta.
 */
async function leerNota(
  patientId: string, clinicId: string, notaId: string,
): Promise<{ error: NextResponse } | { nota: NotaMedica }> {
  if (!patientId || !notaId) {
    return { error: NextResponse.json({ error: 'Falta el paciente o la nota' }, { status: 400 }) }
  }
  const snap = await adminDb
    .collection('clinics').doc(clinicId)
    .collection('patients').doc(patientId)
    .collection('notas').doc(notaId).get()
  if (!snap.exists) return { error: NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 }) }
  return { nota: { id: snap.id, ...(snap.data() as Omit<NotaMedica, 'id'>) } as NotaMedica }
}

/**
 * ¿Qué se le entregó ya a este paciente de esta consulta?
 *
 * La pantalla del médico lo pregunta al abrir una nota firmada: sin esto, al
 * volver a la consulta el botón diría «Entregar» de algo que ya se entregó, y
 * el médico no tendría forma de saberlo salvo preguntándole al paciente.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const clinicId = q.get('clinicId') ?? ''
  const patientId = q.get('patientId') ?? ''
  const notaId = q.get('notaId') ?? ''
  try {
    const acceso = await verificarCapacidad(req, clinicId, 'clinico.leer')
    if (!acceso.ok) return acceso.response
    const r = await leerNota(patientId, clinicId, notaId)
    if ('error' in r) return r.error
    const paquetes = await leerPaquetes(clinicId, patientId, notaId)
    const entregado = paquetes.filter(visibleParaElPaciente).at(-1) ?? null
    return NextResponse.json({
      ok: true,
      entregado: entregado
        ? { version: entregado.version, approvedAt: entregado.approvedAt, approvedBy: entregado.approvedBy }
        : null,
    })
  } catch (e) {
    safeLog.error('[paquete] error al leer', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; notaId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }
  const clinicId = String(body.clinicId ?? '')
  const patientId = String(body.patientId ?? '')
  const notaId = String(body.notaId ?? '')

  try {
    const acceso = await verificarCapacidad(req, clinicId, 'firmar')
    if (!acceso.ok) return acceso.response
    const r = await leerNota(patientId, clinicId, notaId)
    if ('error' in r) return r.error
    const { nota } = r

    /**
     * LA COMPUERTA, EN EL SERVIDOR.
     *
     * `componerPaquete` vuelve a comprobarlo y lanza — esto es el segundo
     * cerrojo, el que devuelve un mensaje que el médico entiende en vez de un
     * 500. Los dos se quedan: el del motor protege a cualquier llamador futuro;
     * éste protege la conversación con esta pantalla.
     */
    if (nota.estado !== ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR) {
      return NextResponse.json(
        { error: 'Esta nota todavía no está firmada. Lo que se le entrega al paciente sale de la nota firmada.' },
        { status: 409 },
      )
    }

    const cfgSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const cfg = cfgSnap.exists ? (cfgSnap.data() as ClinicConfig) : null

    const previa = await medicacionPrevia(clinicId, patientId, notaId, String(nota.fechaConsulta ?? ''))

    const compuesto = componerPaquete({
      notaId,
      estadoNota: nota.estado,
      resumenEjecutivo: nota.resumenEjecutivo,
      medicamentos: nota.medicamentos,
      estudios: nota.estudiosOrden,
      /**
       * `proximoSeguimiento` NO vive en la nota: es del CRM del paciente y se
       * decide fuera del documento firmado. Se deja vacío antes que inventar
       * una fecha — un «vuelve en 15 días» que nadie acordó es una indicación
       * médica que nadie dio.
       */
      proximaCita: undefined,
      medicacionPrevia: previa,
      contactoDelConsultorio: contacto(cfg),
      idioma: 'es-MX',
    })

    const yaHay = await leerPaquetes(clinicId, patientId, notaId)
    const ultimoLiberado = yaHay.filter(visibleParaElPaciente).at(-1)
    if (ultimoLiberado && mismoContenido(ultimoLiberado, compuesto)) {
      // Nada cambió: no se escribe una copia. Se responde lo que ya hay.
      return NextResponse.json({
        ok: true, yaEstaba: true,
        version: ultimoLiberado.version,
        approvedAt: ultimoLiberado.approvedAt,
      })
    }

    const version = (yaHay.at(-1)?.version ?? 0) + 1
    const aprobadoPor = acceso.email || acceso.uid || ''
    const ahora = Date.now()
    const paquete = liberar({ ...compuesto, version }, aprobadoPor, ahora)

    await adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('paquetes_visita').doc(idDeVersion(notaId, version))
      .set(paquete, { merge: false })

    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      clinicId, patientId, notaId,
      timestamp: new Date(ahora).toISOString(),
      medicoEmail: acceso.email ?? '',
      medicoUid: acceso.uid ?? '',
      /**
       * Sin PHI: cuántos medicamentos y cuántos estudios, no cuáles. La bitácora
       * registra que hubo aprobación y de quién; el contenido vive en el
       * paquete, que sí está protegido.
       */
      meta: {
        version,
        medicamentos: paquete.medicationInstructions.length,
        estudios: paquete.orders.length,
        cambiosDeterminados: paquete.medicationChanges !== null,
      },
    }).catch(() => { /* la bitácora no puede tumbar la entrega */ })

    return NextResponse.json({ ok: true, version, approvedAt: ahora })
  } catch (e) {
    safeLog.error('[paquete] error al liberar', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
