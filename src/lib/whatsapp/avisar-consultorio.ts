/**
 * AVISARLE AL CONSULTORIO DE LO QUE PASA SIN QUE ESTÉ MIRANDO.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * El bot de WhatsApp le manda al consultorio un «🔔 Nueva cita por WhatsApp» en
 * cuanto alguien agenda. El **portal público no avisa a nadie**: le contesta al
 * paciente «Te contactaremos para confirmar» y la cita se queda en `solicitada`
 * esperando a que alguien la vea en la agenda.
 *
 * O sea, el mensaje que recibe el paciente promete un contacto que nadie sabe
 * que tiene que hacer. Si la asistente no recarga la pantalla —o mira sólo las
 * confirmadas— el paciente espera una llamada que no va a llegar, y el
 * consultorio pierde la cita sin enterarse de que la tuvo.
 *
 * Lo mismo con la cancelación desde el enlace del paciente (v863): quedó el
 * asiento en la bitácora y la oferta a la lista de espera, pero el consultorio
 * seguía sin recibir un aviso propio.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un aviso al consultorio NUNCA puede tumbar la operación del paciente: la cita
 * ya se creó, o la cancelación ya se hizo. Si el aviso no sale, se registra como
 * no entregado —el mismo canal que ya usan las alertas— para que se pueda ver,
 * en vez de desaparecer.
 */
import { safeLog } from '@/lib/security/sanitize'

/** De dónde sale el teléfono del consultorio, en orden de preferencia. */
export function telefonoDelConsultorio(cfg: {
  whatsappConsultorio?: string
  telefonoAdmin?: string
} | null | undefined): string {
  return String(cfg?.whatsappConsultorio || cfg?.telefonoAdmin || '').trim()
}

/**
 * Manda el aviso y, si no sale, lo deja registrado.
 *
 * @param origen etiqueta para el registro de no entregados.
 */
export async function avisarAlConsultorio(
  clinicId: string,
  telefono: string,
  texto: string,
  origen: string,
): Promise<boolean> {
  if (!clinicId || !telefono.trim()) return false
  try {
    const { sendWhatsApp } = await import('@/lib/whatsapp-send')
    const r = await sendWhatsApp(clinicId, telefono, texto).catch(() => ({ ok: false }))
    if (r?.ok) return true
    const { registrarNoEntregado } = await import('@/lib/whatsapp/no-entregados')
    await registrarNoEntregado(clinicId, telefono, texto, origen)
    return false
  } catch (e) {
    // Ni la cita ni la cancelación se caen porque el aviso no salga.
    safeLog.warn('[avisar-consultorio] no se pudo avisar', e)
    return false
  }
}

export const POR_QUE_HACE_FALTA =
  'Porque al paciente se le promete que el consultorio lo va a contactar, y ' +
  'nadie en el consultorio sabe que tiene que hacerlo. La cita se queda en ' +
  '«solicitada» hasta que alguien la vea por casualidad.'
