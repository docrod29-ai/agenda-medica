/**
 * LOS MENSAJES QUE NO LLEGARON, ESCRITOS EN ALGÚN SITIO.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * La cola de reintentos (`outbox.ts`) existe y funciona, pero tiene UN solo
 * llamador: el aviso de lista de espera. Todo lo demás falla en silencio.
 *
 * El caso que más duele es el bot: `handleMessage` tiene un helper `send()` que
 * devuelve un booleano y **36 llamadas lo descartan**. Si falla la confirmación
 * de una cita que el paciente acaba de agendar por WhatsApp, la cita queda
 * creada, el paciente no se entera de nada, y en el consultorio nadie sabe que
 * hubo un problema. El paciente no se presenta, o se presenta a una hora que
 * cree otra.
 *
 * ── POR QUÉ ESTO Y NO LA COLA ────────────────────────────────────────────────
 *
 * Reintentar fuera de la ventana de 24 horas exige una plantilla aprobada en
 * Meta, y eso es un trámite del dueño que todavía no está hecho. Encolar
 * mensajes que no se van a poder mandar sería fabricar una cola que crece y no
 * entrega.
 *
 * Lo que SÍ se puede hacer hoy, sin depender de nadie: que quede constancia. Un
 * fallo registrado se puede ver, contar y arreglar a mano —una llamada de
 * teléfono—. Un fallo silencioso no existe hasta que el paciente no aparece.
 *
 * ── DÓNDE VA ─────────────────────────────────────────────────────────────────
 *
 * `clinics/{clinicId}/whatsapp_no_entregados`. Sólo lo escribe el servidor y no
 * se puede borrar desde el navegador: poder borrarlo convertiría «no llegó el
 * mensaje» en algo que se hace desaparecer.
 */
import { adminDb } from '@/lib/firebase-admin'

/** Últimos 4 dígitos. Ni el número entero ni el mensaje completo hacen falta. */
function telefonoCorto(tel: string): string {
  const d = String(tel ?? '').replace(/\D/g, '')
  return d ? `…${d.slice(-4)}` : ''
}

export interface NoEntregado {
  /** De dónde salía el mensaje: 'bot', 'confirmacion-portal', 'recordatorio'… */
  origen: string
  telefono: string
  /** Primeras palabras, para reconocer de qué mensaje se trata. NO el texto entero. */
  extracto: string
  motivo: string
  createdAt: string
}

/**
 * Deja constancia de un envío que no salió. A prueba de fallos: si ni esto se
 * puede escribir, no puede tumbar la operación que lo llamó — un bot que
 * revienta al no poder registrar un fallo es peor que el fallo.
 */
export async function registrarNoEntregado(
  clinicId: string,
  telefono: string,
  texto: string,
  origen: string,
  motivo = 'envio-fallido',
): Promise<void> {
  if (!clinicId) return
  try {
    await adminDb.collection('clinics').doc(clinicId).collection('whatsapp_no_entregados').add({
      origen,
      telefono: telefonoCorto(telefono),
      extracto: String(texto ?? '').slice(0, 120),
      motivo,
      createdAt: new Date().toISOString(),
    } satisfies NoEntregado)
  } catch (e) {
    console.warn('[whatsapp/no-entregados] no se pudo registrar el fallo (ignorado):', String(e))
  }
}

export const POR_QUE_NO_SE_ENCOLA =
  'Porque reintentar fuera de la ventana de 24 h exige una plantilla aprobada en ' +
  'Meta, y ese trámite todavía no está hecho: encolar mensajes que no se van a ' +
  'poder mandar sería fabricar una cola que crece y no entrega. Lo que sí se ' +
  'puede hoy es que el fallo quede escrito, porque un fallo silencioso no existe ' +
  'hasta que el paciente no aparece.'
