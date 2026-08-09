/**
 * POST /api/expediente/paquete-visita — REVISAR Y **LIBERAR** LO QUE VE EL PACIENTE.
 *
 * V9 · `POSTVISIT-001`. Cierra `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001`.
 *
 * ── LAS DOS COSAS QUE ESTA RUTA EXISTE PARA IMPEDIR ─────────────────────────
 *
 * 1. **Que se componga de un borrador.** Hasta hoy la hoja del paciente se
 *    armaba del estado vivo de la pantalla de consulta —a medio dictar— y no
 *    había nada que lo impidiera. Aquí la nota se lee **del servidor** y tiene
 *    que estar `firmada`; si no, 409 y no hay paquete.
 *
 * 2. **Que alguien se libere a sí mismo un paquete.** `approvedBy` sale de la
 *    SESIÓN verificada, nunca del cuerpo de la petición. Un `approvedBy` que
 *    viaja en el body es un campo que el navegador escribe, y entonces el
 *    registro de quién aprobó vale exactamente cero.
 *
 * ── POR QUÉ EL PAQUETE NO SE ESCRIBE ENCIMA ─────────────────────────────────
 *
 * Un paquete liberado es inmutable: corregirlo es liberar una versión nueva,
 * igual que una adenda no reescribe la nota. Por eso el id del documento lleva
 * la versión (`{notaId}__v{n}`) y nunca se sobrescribe. La pregunta «¿qué se le
 * dijo exactamente a este paciente el 9 de agosto?» tiene que poder contestarse
 * dentro de un año, cuando el código que lo compuso ya sea otro.
 *
 * `/api/portal` se queda con la versión más alta de cada nota, así que el
 * paciente ve una entrada por consulta y el expediente las conserva todas.
 *
 * ── LO QUE ESTA RUTA NO HACE ────────────────────────────────────────────────
 *
 * - **No firma nada.** Firmar la nota es otro acto, en otro sitio, y ya existe.
 * - **No manda mensajes.** Liberar deja el paquete visible en el portal del
 *   paciente; avisarle por WhatsApp es `CLOSED-LOOP-PATIENT-001`.
 * - **No llama a ningún modelo de lenguaje.** La composición es determinista.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { limitarOResponder } from '@/lib/rate-limit'
import { comoTomarlo } from '@/lib/paciente/como-se-lo-explico'
import {
  componerPaquete, liberar, ESTADO_NOTA_FIRMADA, NO_SE_COMPONE_DE_UN_BORRADOR,
  type MedicacionDelPaquete, type NotaParaPaquete, type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import type { NotaMedica } from '@/types/expediente'
import type { ClinicConfig } from '@/types'

export const runtime = 'nodejs'

/** El identificador de un paquete lleva su versión: nunca se sobrescribe. */
export function idDePaquete(notaId: string, version: number): string {
  return `${notaId}__v${version}`
}

const notas = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).collection('notas')

const paquetes = (clinicId: string, patientId: string) =>
  adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).collection('paquetes_visita')

interface Historia {
  /**
   * Lo que el paciente tomaba ANTES de esta consulta, ya compuesto con el mismo
   * motor: comparar líneas compuestas contra líneas compuestas es lo único que
   * permite distinguir «sigue igual» de «cambió la dosis».
   *
   * `undefined` —y no `[]`— cuando no hay nota anterior o cuando la lectura
   * falla. Regla 4 de seguridad clínica: **no saber qué tomaba no es saber que
   * no tomaba nada**, y aguas abajo esa diferencia decide entre una lista de
   * cambios y un `null` honesto.
   */
  medicacionPrevia?: readonly MedicacionDelPaquete[]
  /** ¿Es ésta la última nota firmada del paciente? Decide el seguimiento (ver abajo). */
  esLaUltima: boolean
}

/**
 * LAS NOTAS FIRMADAS DEL PACIENTE, ORDENADAS AQUÍ Y NO EN FIRESTORE.
 *
 * Una sola igualdad y el orden en memoria, igual que hace `/api/portal`. Con
 * `where(estado)` + `where(fecha, '<')` + `orderBy` haría falta un índice
 * compuesto, y un índice que falta **no falla en la prueba: falla en producción,
 * el día que un médico pulsa «entregar»**.
 */
async function historia(
  clinicId: string, patientId: string, notaActual: NotaMedica,
): Promise<Historia> {
  const fecha = String(notaActual.fechaConsulta ?? '')
  try {
    const snap = await notas(clinicId, patientId).where('estado', '==', ESTADO_NOTA_FIRMADA).get()
    const firmadas = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<NotaMedica, 'id'>) }))
      .sort((a, b) => String(b.fechaConsulta ?? '').localeCompare(String(a.fechaConsulta ?? '')))
    const esLaUltima = firmadas[0]?.id === notaActual.id
    const previa = fecha
      ? firmadas.find(n => n.id !== notaActual.id && String(n.fechaConsulta ?? '') < fecha)
      : undefined
    if (!previa) return { esLaUltima }
    return {
      esLaUltima,
      medicacionPrevia: (previa.medicamentos ?? [])
        .map(m => ({ nombre: String(m?.nombre ?? '').trim(), instruccion: comoTomarlo(m) }))
        .filter(m => m.nombre && m.instruccion),
    }
  } catch (e) {
    /* Un mal minuto de Firestore no puede convertirse en «no tomaba nada»: se
       pierde la casilla de cambios, no se inventa. */
    safeLog.warn('[paquete-visita] no se pudo leer la historia; los cambios saldrán como no determinados', e)
    return { esLaUltima: false }
  }
}

/**
 * EL PRÓXIMO SEGUIMIENTO, Y POR QUÉ SÓLO PARA LA ÚLTIMA NOTA.
 *
 * El seguimiento que el médico escribe al firmar se guarda en el PACIENTE
 * (`patients/{id}.proximoSeguimiento`), no en la nota: es un dato del paciente y
 * se sobrescribe en cada consulta. Por eso pegarlo a un paquete de una nota
 * vieja le pondría a esa consulta el seguimiento de otra.
 *
 * Cuando la nota no es la última, va **vacío**. Un hueco es información; un
 * seguimiento de la consulta equivocada se lee como un acierto.
 */
async function proximoSeguimiento(clinicId: string, patientId: string, esLaUltima: boolean): Promise<string> {
  if (!esLaUltima) return ''
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId).get()
    return String((snap.data() as { proximoSeguimiento?: unknown } | undefined)?.proximoSeguimiento ?? '').trim()
  } catch {
    return ''
  }
}

/** Cómo contactar al consultorio. Dato administrativo del propio consultorio. */
async function contactoDelConsultorio(clinicId: string): Promise<string> {
  try {
    const snap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
    const cfg = snap.data() as ClinicConfig | undefined
    const tel = String(cfg?.whatsappConsultorio || cfg?.telefonoAdmin || '').trim()
    return tel ? `Si tienes dudas, llama a tu consultorio: ${tel}` : ''
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; clinicId?: string; patientId?: string; notaId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Petición inválida' }, { status: 400 })
  }

  const clinicId = String(body.clinicId ?? '')
  const patientId = String(body.patientId ?? '')
  const notaId = String(body.notaId ?? '')
  const accion = body.action === 'liberar' ? 'liberar' : 'previsualizar'

  /**
   * `firmar` y no `clinico.escribir`: liberar es un acto de aprobación clínica
   * hacia el paciente, del mismo peso que firmar la nota. La previsualización
   * pide lo mismo a propósito — quien no puede liberar tampoco necesita ver el
   * borrador de lo que se le entregaría al paciente.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'firmar')
  if (!acceso.ok) return acceso.response

  const _rl = await limitarOResponder(`paquete-visita:${acceso.uid}`, 30, 60)
  if (_rl) return _rl

  if (!patientId || !notaId) {
    return NextResponse.json({ ok: false, error: 'Falta el paciente o la nota' }, { status: 400 })
  }

  try {
    const snapNota = await notas(clinicId, patientId).doc(notaId).get()
    if (!snapNota.exists) return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 })
    const nota = { id: snapNota.id, ...(snapNota.data() as Omit<NotaMedica, 'id'>) }

    /**
     * LA COMPUERTA DE FIRMA, COMPROBADA AQUÍ Y OTRA VEZ EN EL COMPOSITOR.
     *
     * Dos veces a propósito: aquí para devolver un 409 que la pantalla pueda
     * explicar, y dentro de `componerPaquete` para que ningún llamador futuro
     * —otra ruta, un script, una migración— pueda saltársela.
     */
    if (String(nota.estado ?? '') !== ESTADO_NOTA_FIRMADA) {
      return NextResponse.json({ ok: false, error: NO_SE_COMPONE_DE_UN_BORRADOR }, { status: 409 })
    }

    const [hist, contacto] = await Promise.all([
      historia(clinicId, patientId, nota),
      contactoDelConsultorio(clinicId),
    ])
    const seguimiento = await proximoSeguimiento(clinicId, patientId, hist.esLaUltima)

    const paquete = componerPaquete(nota as NotaParaPaquete, {
      medicacionPrevia: hist.medicacionPrevia,
      proximoSeguimiento: seguimiento,
      contactoDelConsultorio: contacto,
    })

    if (accion === 'previsualizar') {
      return NextResponse.json({ ok: true, paquete })
    }

    /**
     * QUIÉN APROBÓ SALE DE LA SESIÓN, NUNCA DEL CUERPO.
     *
     * Es la diferencia entre un registro de aprobación y un campo de texto que
     * el navegador rellena. El correo antes que el uid porque es lo que un
     * humano puede leer en una auditoría; el uid es el respaldo.
     */
    const quien = (acceso.email || acceso.uid || '').trim()
    if (!quien) return NextResponse.json({ ok: false, error: 'No se pudo identificar a quien aprueba' }, { status: 403 })

    /* La versión siguiente sale de lo que YA hay para esta nota, no de un
       contador en memoria: dos pestañas del mismo médico no pueden pisarse. */
    const previos = await paquetes(clinicId, patientId).where('notaId', '==', notaId).get()
    const version = previos.docs.reduce((max, d) => Math.max(max, Number((d.data() as { version?: number }).version ?? 0)), 0) + 1

    const liberado: PaqueteDeVisita = liberar({ ...paquete, version }, quien, Date.now())
    const id = idDePaquete(notaId, version)
    await paquetes(clinicId, patientId).doc(id).create(liberado)

    void adminDb.collection('clinics').doc(clinicId).collection('audit_log').add({
      evento: 'paquete_visita_liberado',
      clinicId, patientId, notaId,
      timestamp: new Date().toISOString(),
      /* Sin PHI: qué se liberó y quién, no qué decía. El contenido vive en el
         expediente, donde está protegido. */
      meta: { paqueteId: id, version, aprobadoPor: quien, medicamentos: liberado.medicationInstructions.length },
    }).catch(() => { /* la bitácora no puede tumbar una liberación ya hecha */ })

    return NextResponse.json({ ok: true, paquete: liberado, paqueteId: id })
  } catch (e) {
    safeLog.error('[paquete-visita] error', e)
    return NextResponse.json({ ok: false, error: 'No se pudo preparar el paquete' }, { status: 500 })
  }
}
