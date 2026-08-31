/**
 * ¿ESTA CITA YA LA AGENDÓ ESTE MISMO PACIENTE HACE UN MOMENTO?
 *
 * ── EL DEFECTO QUE CIERRA ────────────────────────────────────────────────────
 *
 * El bot confirma la cita y, si el mismo «SÍ» vuelve a llegar, revalida el hueco
 * antes de escribir. Esa revalidación ve la cita que ACABA DE CREAR el propio
 * paciente, la cuenta como ocupación, y le contesta:
 *
 *     «Ese horario ya no está disponible. Por favor elija otro
 *      escribiendo *agendar* de nuevo.»
 *
 * El paciente TIENE cita y el bot le dice que no. Y el paciente hace caso: se
 * agenda a otra hora, y el consultorio se queda con DOS citas suyas, una de las
 * cuales nadie va a ocupar. **El duplicado no lo fabrica el reintento: lo
 * fabrica el mensaje equivocado.**
 *
 * Un «SÍ» se repite sin que nadie haga nada raro: Meta reentrega el webhook
 * cuando la respuesta tarda y el dedup es fail-open a propósito; `clearSession`
 * se traga su error; y la confirmación se manda con un `send` que devuelve
 * `false` sin lanzar cuando el proveedor está caído, así que el paciente no ve
 * nada y vuelve a escribir.
 *
 * ── LA REGLA, QUE NO ES NUEVA ────────────────────────────────────────────────
 *
 * Es la de GP9, ya aprendida en `POST /api/appointments`: **misma solicitud
 * activa → mismo recurso**. Allí la igualdad se mide sobre la lista de campos
 * que esa vía está autorizada a escribir. Aquí se mide sobre los cinco que
 * definen la cita del bot, y ni uno más: quién, cuándo, de qué tipo, cuánto dura
 * y con qué médico.
 *
 * ── POR QUÉ TAN ESTRICTA ─────────────────────────────────────────────────────
 *
 * Reconocer un reintento de más es peor que reconocerlo de menos: significa
 * tragarse en silencio una cita que el paciente sí quería. Por eso tienen que
 * coincidir TODOS los campos, tiene que venir del bot (`origen` + `creadoPor`) y
 * tiene que ser del MISMO teléfono. Una cita liberada —cancelada, reagendada o
 * no-asistió— nunca es un reintento: el hueco volvió a estar libre y lo que toca
 * es agendar de nuevo, con otra identidad.
 *
 * Y el aislamiento no depende de esto: las citas se leen de
 * `clinics/{clinicId}/appointments`, así que la de otro consultorio no llega
 * hasta aquí. Esta función no puede cruzar consultorios porque nunca ve dos.
 *
 * Módulo PURO: sin Firestore, sin red, sin reloj.
 */
import { normalizarTelefonoWa } from '@/lib/whatsapp/telefono'

/** Estados en los que la cita ya NO ocupa el hueco: se liberó. */
const LIBERADAS = new Set(['cancelada', 'reagendada', 'no-asistio'])

/** Lo que el bot está a punto de escribir. */
export interface IntentoDeCitaDelBot {
  pacienteTelefono: string
  /** Hora de PARED, como se guarda: `2026-08-27 09:00`. */
  fechaHora: string
  tipo: string
  duracion: number
  medicoId: string
}

/** Una cita ya escrita, tal y como sale de Firestore. */
export interface CitaEscrita {
  id: string
  pacienteTelefono?: string
  fechaHora?: string
  tipo?: string
  duracion?: number
  medicoId?: string
  estado?: string
  origen?: string
  creadoPor?: string
}

/**
 * ¿Es esta cita el MISMO intento que se está a punto de escribir?
 *
 * El teléfono se compara normalizado porque WhatsApp entrega `521…` y el panel
 * guarda otros formatos: comparar en crudo haría que el reintento no se
 * reconociera justo cuando más falta hace.
 */
export function esElMismoIntento(intento: IntentoDeCitaDelBot, cita: CitaEscrita): boolean {
  if (LIBERADAS.has(String(cita.estado ?? ''))) return false
  if (cita.origen !== 'WhatsApp' || cita.creadoPor !== 'bot') return false
  if (normalizarTelefonoWa(String(cita.pacienteTelefono ?? '')) !== normalizarTelefonoWa(intento.pacienteTelefono)) return false
  if (String(cita.fechaHora ?? '') !== intento.fechaHora) return false
  if (String(cita.tipo ?? '') !== intento.tipo) return false
  if (Number(cita.duracion ?? 0) !== Number(intento.duracion)) return false
  return String(cita.medicoId ?? '') === String(intento.medicoId ?? '')
}

/**
 * El id de la cita que YA existe para este intento, o `null` si no hay ninguna.
 *
 * @param citas las citas de ESE día y ESE consultorio, ya leídas por el llamador.
 */
export function citaYaAgendada(
  intento: IntentoDeCitaDelBot,
  citas: readonly CitaEscrita[],
): string | null {
  for (const c of citas) if (esElMismoIntento(intento, c)) return c.id
  return null
}

export const POR_QUE_EL_MENSAJE_FABRICA_EL_DUPLICADO =
  'Porque al paciente que YA tiene cita se le decía que su horario ya no está ' +
  'disponible y que agendara de nuevo. Y agendaba: el consultorio se quedaba ' +
  'con dos citas suyas y él se presentaba a una.'
