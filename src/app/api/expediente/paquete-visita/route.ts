/**
 * EL PAQUETE DE LA VISITA — componerlo y LIBERARLO. V9 · `POSTVISIT-001`.
 *
 *   GET  ?clinicId=&patientId=&notaId=  → los paquetes ya liberados de esa nota
 *   POST { clinicId, patientId, notaId } → compone desde la nota FIRMADA y libera
 *
 * ── POR QUÉ ESTA RUTA EXISTE ────────────────────────────────────────────────
 *
 * Es el llamador que faltaba. `componerPaquete` se escribió en
 * `PATIENT-COMPANION-001` y se retiró el mismo día por no tener quien la
 * llamara; el paciente tenía los cinco destinos y **ningún paquete que ver**,
 * porque nada en producción creaba uno.
 *
 * ── LO QUE EL NAVEGADOR NO PUEDE MANDAR ─────────────────────────────────────
 *
 * El cuerpo lleva **tres identificadores y nada más**. Ni el resumen, ni los
 * medicamentos, ni las instrucciones: el contenido se lee **aquí**, de la nota
 * firmada que está en Firestore. Si el contenido viajara en el cuerpo, cualquiera
 * con una sesión del consultorio podría publicarle al paciente el texto que
 * quisiera bajo el membrete de su médico — y eso es exactamente lo que la regla
 * de IA de cara al paciente pide que el código **no pueda hacer**, no que el
 * prompt evite.
 *
 * ── LAS TRES COMPUERTAS, EN ORDEN ───────────────────────────────────────────
 *
 * 1. **Quién.** `firmar`: liberar es un acto de aprobación clínica. La asistente
 *    del mostrador emite enlaces del portal (`agenda.gestionar`) y no puede
 *    llegar aquí.
 * 2. **Qué.** La nota tiene que estar `firmada`. `componerPaquete` lanza
 *    `NotaSinFirmar` y aquí se traduce a 409. Es `POSTVISIT-GATE-001`: hasta hoy
 *    la hoja del paciente se componía del borrador en curso.
 * 3. **Cuándo y por quién.** `liberar()` exige `approvedBy` y `approvedAt`, y el
 *    aprobador sale del **token verificado**, nunca del cuerpo.
 *
 * ── UN PAQUETE LIBERADO ES INMUTABLE ────────────────────────────────────────
 *
 * No se sobrescribe: cada liberación escribe `{notaId}-v{n}` con `version`
 * creciente. Si dentro de un año hay que responder «¿qué se le dijo exactamente
 * a este paciente el 9 de agosto?», la respuesta no puede depender de lo que
 * compondría hoy el código: una adenda posterior cambia la nota, y lo que se
 * entregó se entregó.
 */
import { NextRequest, NextResponse } from 'next/server'
import admin, { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { limitarOResponder } from '@/lib/rate-limit'
import { safeLog } from '@/lib/security/sanitize'
import {
  componerPaquete, liberar, visibleParaElPaciente, NotaSinFirmar,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import type { NotaMedica } from '@/types/expediente'

export const runtime = 'nodejs'

const COLECCION = 'paquetes_visita'

const notasDe = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).collection('notas')

const paquetesDe = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).collection(COLECCION)

/** Los tres identificadores, saneados. Nada más entra desde el navegador. */
function ids(v: Record<string, unknown>): { clinicId: string; patientId: string; notaId: string } {
  const t = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 128) : '')
  return { clinicId: t(v.clinicId), patientId: t(v.patientId), notaId: t(v.notaId) }
}

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  const patientId = req.nextUrl.searchParams.get('patientId') ?? ''
  const notaId = req.nextUrl.searchParams.get('notaId') ?? ''
  if (!clinicId || !patientId) {
    return NextResponse.json({ ok: false, error: 'clinicId y patientId requeridos' }, { status: 400 })
  }

  /* Leer qué se le entregó al paciente es secreto médico: `clinico.leer`. */
  const acc = await verificarCapacidad(req, clinicId, 'clinico.leer')
  if (!acc.ok) return acc.response

  try {
    const snap = await paquetesDe(clinicId, patientId).get()
    const paquetes = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as unknown as PaqueteDeVisita & { id: string })
      .filter(p => !notaId || p.notaId === notaId)
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
    return NextResponse.json({ ok: true, paquetes })
  } catch (e) {
    safeLog.error('[paquete-visita] GET', e)
    return NextResponse.json({ ok: false, error: 'No se pudo leer' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const { clinicId, patientId, notaId } = ids(body)
  if (!clinicId || !patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'clinicId, patientId y notaId requeridos' }, { status: 400 })
  }

  /**
   * `firmar` y no `clinico.escribir`: liberar es un acto de aprobación hacia el
   * paciente, del mismo peso que firmar la nota. Enfermería puede escribir en el
   * expediente y no puede aprobar lo que el paciente lee como palabra del médico.
   */
  const acc = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acc.ok) return acc.response

  const _rl = await limitarOResponder(`paquete-visita:${acc.uid}`, 30, 60)
  if (_rl) return _rl

  try {
    const doc = await notasDe(clinicId, patientId).doc(notaId).get()
    if (!doc.exists) return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 })
    const nota = { id: doc.id, ...(doc.data() as Omit<NotaMedica, 'id'>) }

    /**
     * LA MEDICACIÓN PREVIA SALE DE LAS OTRAS NOTAS FIRMADAS, NO DE ÉSTA.
     *
     * Y se distingue «no había nada» (`[]`) de «no se pudo saber» (`null`): si la
     * lectura de las notas falla, `cambiosDeMedicacion` devuelve `null` y el
     * paciente no ve la sección, en vez de leer «sin cambios» sobre algo que
     * nadie llegó a comparar.
     */
    let medicacionPrevia: string[] | null = null
    try {
      const previas = await notasDe(clinicId, patientId).where('estado', '==', 'firmada').get()
      medicacionPrevia = medicamentosVigentes(
        previas.docs
          .filter(d => d.id !== notaId)
          .map(d => {
            const n = d.data() as Omit<NotaMedica, 'id'>
            return { fecha: String(n.fechaConsulta ?? ''), medicamentos: n.medicamentos ?? [] }
          }),
      ).map(o => o.medicamento.nombre)
    } catch (e) {
      safeLog.warn('[paquete-visita] no se pudo leer la medicación previa', e)
    }

    const version = (await paquetesDe(clinicId, patientId).where('notaId', '==', notaId).get()).size + 1

    const borrador = componerPaquete({
      nota: {
        id: nota.id,
        /* El `estado` de primer nivel: es el que consultan todos los demás
           lectores del expediente (`where('estado','==','firmada')`). */
        estado: nota.estado,
        resumenEjecutivo: nota.resumenEjecutivo,
        medicamentos: nota.medicamentos ?? [],
        estudiosOrden: nota.estudiosOrden ?? [],
      },
      medicacionPrevia,
      proximaCita: typeof body.proximaCita === 'string' ? body.proximaCita.slice(0, 200) : '',
      contactoDelConsultorio: typeof body.contacto === 'string' ? body.contacto.slice(0, 200) : '',
    }, version)

    /**
     * El aprobador sale del token, no del cuerpo. Un `approvedBy` que manda el
     * navegador es un campo que el navegador elige, y entonces la firma de
     * aprobación no acredita nada — el mismo defecto que ya se cerró en la
     * bitácora de auditoría.
     */
    const aprobador = acc.email ?? acc.uid
    const paquete = liberar(borrador, aprobador, Date.now())

    /* Cinturón: la compuerta que usa `/api/portal` se comprueba también aquí,
       antes de escribir. Un paquete que no la pasa no debería existir en la base. */
    if (!visibleParaElPaciente(paquete)) {
      return NextResponse.json({ ok: false, error: 'El paquete no quedó en un estado liberable' }, { status: 500 })
    }

    const id = `${notaId}-v${version}`
    /* `create` y no `set`: una versión ya entregada no se sobrescribe nunca. */
    await paquetesDe(clinicId, patientId).doc(id).create(paquete)

    await adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_liberado',
      clinicId,
      patientId,
      notaId,
      medicoUid: acc.uid,
      medicoEmail: acc.email ?? null,
      rol: acc.role ?? null,
      contexto: { userAgent: null, ip: req.headers.get('x-forwarded-for')?.slice(0, 64) ?? null },
      meta: { paqueteId: id, version },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampCliente: null,
    }).catch(() => { /* el paquete ya se liberó; la bitácora no puede deshacerlo */ })

    return NextResponse.json({ ok: true, paquete: { id, ...paquete } })
  } catch (e) {
    if (e instanceof NotaSinFirmar) {
      /**
       * 409 y no 400: la petición está bien formada, es el ESTADO el que no
       * permite la acción. Y el texto se le enseña al médico tal cual, porque
       * decir «error» a secas le deja sin saber que le falta firmar.
       */
      return NextResponse.json(
        { ok: false, error: 'Primero firma la nota. Lo que se le entrega al paciente sale de una nota firmada, no de un borrador.' },
        { status: 409 },
      )
    }
    safeLog.error('[paquete-visita] POST', e)
    return NextResponse.json({ ok: false, error: 'No se pudo liberar el paquete' }, { status: 502 })
  }
}
