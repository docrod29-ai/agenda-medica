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

/** Cuántos se leen de una pasada. No es una cifra clínica: es cuánto cabe en una pantalla. */
export const TOPE_A_LISTAR = 50

export interface NoEntregadoLeido extends NoEntregado {
  readonly id: string
}

/**
 * LOS FALLOS DEL BOT, PARA PODER MIRARLOS — REG-541.
 *
 * La cabecera de este módulo prometía que «un fallo registrado se puede VER,
 * contar y arreglar a mano». No se podía: la colección tenía **un escritor y
 * cero lectores**. Estaba declarada en los tres sitios que exige la regla de
 * inquilinos —reglas, matriz y respaldo—, respaldada, cerrada al cliente… e
 * invisible.
 *
 * Cuanto mejor explicada está una garantía, menos probable es que alguien vaya a
 * comprobar si el código la cumple. Es el mismo patrón de REG-527 y REG-531.
 *
 * **Lanza** si no puede leer, en vez de devolver `[]`: «no se pudo leer» y «no
 * hay ninguno» llevan al médico a cosas opuestas, y ésa es la razón por la que
 * existe el sobre de recuperación de evidencia.
 */
export async function listarNoEntregados(
  clinicId: string, tope = TOPE_A_LISTAR,
): Promise<NoEntregadoLeido[]> {
  const snap = await adminDb.collection('clinics').doc(clinicId)
    .collection('whatsapp_no_entregados')
    .orderBy('createdAt', 'desc')
    .limit(tope)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as NoEntregado) }))
}

export const POR_QUE_NO_LLEVAN_BOTON =
  'Porque no se pueden reintentar. Reintentar fuera de la ventana de 24 h exige '
  + 'una plantilla aprobada en Meta y ese trámite es del dueño. Poner un botón '
  + 'que no puede cumplir sería peor que no ponerlo: el médico creería que el '
  + 'mensaje va a salir y dejaría de llamar por teléfono, que es lo único que '
  + 'hoy sí funciona.'

export const POR_QUE_SON_DOS_LISTAS_Y_NO_UNA =
  'Porque son dos hechos distintos y se actúa distinto sobre cada uno. Los de la '
  + 'COLA agotaron sus reintentos y se pueden devolver a ella —con el riesgo de '
  + 'duplicar—. Los del BOT nunca estuvieron en una cola: fallaron dentro de la '
  + 'conversación y la única salida es llamar al paciente. Fundirlos en una lista '
  + 'con un botón haría creer que los segundos también se reintentan.'

export const POR_QUE_NO_SE_ENCOLA =
  'Porque reintentar fuera de la ventana de 24 h exige una plantilla aprobada en ' +
  'Meta, y ese trámite todavía no está hecho: encolar mensajes que no se van a ' +
  'poder mandar sería fabricar una cola que crece y no entrega. Lo que sí se ' +
  'puede hoy es que el fallo quede escrito, porque un fallo silencioso no existe ' +
  'hasta que el paciente no aparece.'
