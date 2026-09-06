/**
 * LOS FORMATOS EN QUE EL MISMO TELÉFONO PUEDE ESTAR GUARDADO.
 *
 * ── POR QUÉ HACE FALTA ESTO ──────────────────────────────────────────────────
 *
 * WhatsApp identifica a quien escribe con un `wa_id` —`5215512345678`— y en la
 * base de datos el mismo número puede estar guardado de cuatro formas distintas,
 * según por dónde entró:
 *
 *  · el panel del consultorio guarda **10 dígitos** (`5512345678`);
 *  · la reserva pública guarda los **dígitos crudos** que tecleó el paciente;
 *  · el bot guarda la **forma canónica** (`52` + 10);
 *  · y México mete un `1` extra en los móviles (`521` + 10).
 *
 * Firestore no sabe buscar «termina en», así que hay que preguntar por todos.
 *
 * ── EL FALLO QUE ESTO CIERRA ─────────────────────────────────────────────────
 *
 * `resolverPacienteBot` ya construía esta lista, con el comentario que explica
 * por qué. Pero **buscar las citas para cancelar** y **dar de baja de la lista de
 * espera** comparaban con `==` contra el `wa_id` pelado.
 *
 * O sea que un paciente cuya cita se dio de alta en el mostrador escribía
 * «cancelar» y el bot le contestaba **«no encontré ninguna cita»** — que se lee
 * como «no tienes ninguna», no como «no supe reconocer tu número». Y a quien
 * pedía la baja de la lista de espera se le prometía una baja que no ocurría.
 *
 * El criterio existía y estaba bien; sólo lo usaba uno de los tres sitios. Ahora
 * vive aquí, y una prueba exige que los tres lo usen.
 *
 * Módulo PURO.
 */
import { claveTelefonoWa } from '@/lib/whatsapp/telefono'

/**
 * Máximo que admite un `where(..., 'in', [...])` de Firestore.
 *
 * Se recorta a este tope a propósito: pasarse hace que la consulta falle entera,
 * y una consulta que falla se lee como «no hay nada».
 */
export const TOPE_IN_FIRESTORE = 10

/**
 * Todas las formas en que puede estar guardado el teléfono de quien escribe.
 *
 * Siempre devuelve al menos un candidato mientras la entrada tenga dígitos: una
 * lista vacía haría reventar el `in` de Firestore.
 */
export function candidatosDeTelefono(telefonoRaw: string): string[] {
  const crudo = String(telefonoRaw ?? '').replace(/\D/g, '')
  if (!crudo) return []
  const canonico = claveTelefonoWa(telefonoRaw)
  const diez = canonico.length >= 10 ? canonico.slice(-10) : canonico
  return Array.from(new Set(
    [diez, canonico, `521${diez}`, crudo].filter(Boolean),
  )).slice(0, TOPE_IN_FIRESTORE)
}

export const POR_QUE_NO_BASTA_UN_IGUAL =
  'Porque el mismo número se guarda con 10 dígitos desde el panel, crudo desde ' +
  'la reserva pública y canónico desde el bot. Comparar con «==» contra el wa_id ' +
  'hace que el paciente del mostrador escriba «cancelar» y reciba «no encontré ' +
  'ninguna cita» — un fallo que se lee como una respuesta.'
