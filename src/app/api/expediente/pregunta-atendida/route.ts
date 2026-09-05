import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'

/**
 * MARCAR ATENDIDA UNA PREGUNTA DEL PACIENTE — REG-516 (cierra el bucle de REG-514).
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * Desde REG-514 toda pregunta escalada abre una tarea en `/pendientes`. El
 * médico la atiende, la cierra con su decisión… y el portal del paciente
 * seguía diciendo «Tu consultorio la tiene pendiente de revisar» para siempre:
 * `atendidaEn` nacía en `null` y **nadie lo escribía**. La rama del portal que
 * dice «ya la revisó» era código muerto.
 *
 * ── POR QUÉ UNA RUTA DE SERVIDOR ─────────────────────────────────────────────
 *
 * `preguntas_paciente` está cerrada al navegador (`write: if false` en las
 * reglas), y a propósito: lo que entra a esa colección lo escribe el servidor
 * con lista blanca. Abrir un `update` desde el navegador para un solo campo
 * habría exigido desplegar reglas —acción del dueño— y habría abierto una
 * segunda puerta de escritura a una colección que sólo tenía una. Aquí el
 * campo que se toca es UNO, y quién puede tocarlo lo decide `verificarCapacidad`.
 *
 * ── LO QUE HACE Y LO QUE NO ──────────────────────────────────────────────────
 *
 * - Exige `clinico.escribir`: quien puede cerrar una tarea clínica puede dar
 *   por atendida la pregunta que la abrió. El mostrador no.
 * - Del cuerpo sólo se aceptan TRES identificadores. El instante lo pone el
 *   servidor; el uid sale de la sesión. Nada del cuerpo se copia al documento.
 * - Idempotente: si ya estaba atendida, no se pisa el instante original y se
 *   responde `yaEstaba: true`. Un doble clic o un reintento no reescriben la
 *   historia.
 * - No manda nada al paciente. Marcar atendida es dejar constancia; contestarle
 *   sigue siendo una llamada o una consulta, no un texto del sistema.
 * - Un documento que no existe → 404 sin más detalle: no confirma ids ajenos.
 */
const ID = /^[A-Za-z0-9_-]{1,128}$/

export async function POST(req: NextRequest) {
  let body: { clinicId?: unknown; patientId?: unknown; preguntaId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Petición inválida' }, { status: 400 })
  }
  const clinicId = String(body.clinicId ?? '')
  const patientId = String(body.patientId ?? '')
  const preguntaId = String(body.preguntaId ?? '')
  if (!ID.test(clinicId) || !ID.test(patientId) || !ID.test(preguntaId)) {
    return NextResponse.json({ ok: false, error: 'Faltan identificadores' }, { status: 400 })
  }

  const acceso = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acceso.ok) return acceso.response

  try {
    const ref = adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(patientId)
      .collection('preguntas_paciente').doc(preguntaId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 })
    }
    const previa = (snap.data() as { atendidaEn?: number | null } | undefined)?.atendidaEn ?? null
    if (previa) {
      return NextResponse.json({ ok: true, yaEstaba: true, atendidaEn: previa })
    }
    const atendidaEn = Date.now()
    // Lista blanca de DOS campos. Nunca `...body`.
    await ref.update({ atendidaEn, atendidaPor: acceso.uid })
    return NextResponse.json({ ok: true, yaEstaba: false, atendidaEn })
  } catch (e) {
    // El clinicId sí (es el inquilino); ni el paciente ni la pregunta.
    safeLog.error(`[pregunta-atendida] ${clinicId}: no se pudo marcar`, e)
    return NextResponse.json({ ok: false, error: 'No se pudo marcar la pregunta como atendida.' }, { status: 500 })
  }
}
