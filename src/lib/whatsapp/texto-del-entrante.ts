/**
 * EL TEXTO DE UN MENSAJE ENTRANTE, VENGA COMO VENGA — Panel de Lujo ASM-013.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * Los dos webhooks hacían `if (msg.type !== 'text') continue`. Un audio que
 * decía «no voy a poder ir», una foto de la receta o el BOTÓN de respuesta de
 * una plantilla («Confirmar») se ignoraban sin contestar nada: la cita seguía
 * viva y el paciente creía que avisó.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *  · `button` (respuesta a plantilla) e `interactive` (botón o lista) SON texto:
 *    se usa su título y siguen el mismo camino que un mensaje tecleado.
 *  · Todo lo demás con cuerpo no legible (audio, imagen, video, documento,
 *    sticker, ubicación, contactos) devuelve `null` y el bot contesta que sólo
 *    lee texto, con el vocabulario del recordatorio y el teléfono.
 *
 * Módulo PURO, compartido por el webhook de Meta y el de 360dialog.
 */

export interface MensajeEntrante {
  type?: string
  text?: { body?: string }
  button?: { text?: string; payload?: string }
  interactive?: {
    type?: string
    button_reply?: { id?: string; title?: string }
    list_reply?: { id?: string; title?: string }
  }
}

/** Tipos que el bot no puede leer y a los que contesta «sólo texto». */
export const TIPOS_SIN_TEXTO = ['audio', 'voice', 'image', 'video', 'document', 'sticker', 'location', 'contacts'] as const

/** El texto utilizable del mensaje, o `null` si no hay forma de leerlo. */
export function textoDelEntrante(msg: MensajeEntrante | null | undefined): string | null {
  if (!msg) return null
  switch (msg.type) {
    case 'text': return limpiar(msg.text?.body)
    case 'button': return limpiar(msg.button?.text || msg.button?.payload)
    case 'interactive': return limpiar(msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title
      || msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id)
    default: return null
  }
}

function limpiar(t: string | undefined | null): string | null {
  const s = String(t ?? '').trim()
  return s ? s : null
}

/** ¿Es un tipo al que hay que contestar «por aquí sólo leo texto»? */
export function esMensajeSinTexto(msg: MensajeEntrante | null | undefined): boolean {
  return !!msg && (TIPOS_SIN_TEXTO as readonly string[]).includes(String(msg.type ?? ''))
}

export function textoSoloLeoTexto(telefonoConsultorio: string): string {
  const tel = String(telefonoConsultorio ?? '').trim()
  return [
    'Por aquí sólo puedo leer texto 🙏',
    'Si es sobre tu cita, responde *SÍ* para confirmar, *NO* para cancelar o *CAMBIAR* si necesitas otra fecha.',
    tel ? `Para cualquier otra cosa, llama al ${tel}.` : 'Para cualquier otra cosa, llama al consultorio.',
  ].join('\n')
}
