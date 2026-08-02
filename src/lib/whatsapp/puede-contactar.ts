/**
 * SI NO SE SABE QUIÉN PIDIÓ LA BAJA, NO SE ESCRIBE.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * La pantalla de reactivación lee la lista de bajas de WhatsApp así:
 *
 *   getDocs(collection(db, 'clinics', clinicId, 'whatsapp_optout')).catch(() => null)
 *   const bajas = new Set((optSnap?.docs ?? []).map(d => d.id))
 *
 * Un fallo de red, de permisos o de App Check produce **exactamente el mismo
 * conjunto vacío** que un consultorio donde nadie se ha dado de baja. Y con el
 * conjunto vacío la pantalla ofrece «WhatsApp» sobre TODA la base — incluida la
 * gente que pidió expresamente que no se le escriba.
 *
 * El daño no es simétrico:
 *
 *  · no escribirle hoy a quien sí se podía = un mensaje que se manda mañana;
 *  · escribirle a quien pidió la baja = incumplimiento del aviso de privacidad
 *    y de la política de WhatsApp, y un paciente que ya había dicho que no.
 *
 * Lo mismo con las citas FUTURAS (`.catch(() => [])`): sin ellas se le ofrece
 * «¿desea agendar?» a quien ya tiene lugar reservado, que es la clase de mensaje
 * que hace que un paciente deje de leer los siguientes.
 *
 * Ante la duda, no se contacta — y se DICE por qué, en vez de dejar la pantalla
 * como si todo estuviera en orden.
 *
 * Módulo PURO.
 */

/** Qué se pudo leer y qué no antes de ofrecer un contacto. */
export interface LecturasPrevias {
  /** ¿Se pudo leer la lista de bajas de WhatsApp? */
  bajasLeidas: boolean
  /** ¿Se pudieron leer las citas futuras? */
  futurasLeidas: boolean
}

export interface Veredicto {
  /** `false` = no se ofrece el contacto. */
  sePuede: boolean
  /** Qué decirle al consultorio. Vacío cuando se puede. */
  motivo: string
}

export const SIN_BAJAS =
  'No se pudo leer la lista de bajas de WhatsApp, así que no se puede saber ' +
  'quién pidió que no se le escriba. Los contactos quedan deshabilitados: ' +
  'escribirle a quien se dio de baja incumple el aviso de privacidad, y no ' +
  'escribirle hoy sólo retrasa el mensaje. Recarga la pantalla.'

export const SIN_FUTURAS =
  'No se pudieron leer las citas futuras: puede haber pacientes en esta lista ' +
  'que YA tienen lugar reservado. Revísalo antes de escribirles.'

/**
 * ¿Se puede ofrecer el botón de contacto?
 *
 * La baja es un veto duro. No poder leer las citas futuras no bloquea —no hay
 * daño de privacidad en ello— pero sí se avisa.
 */
export function puedeContactar(l: LecturasPrevias): Veredicto {
  if (!l.bajasLeidas) return { sePuede: false, motivo: SIN_BAJAS }
  if (!l.futurasLeidas) return { sePuede: true, motivo: SIN_FUTURAS }
  return { sePuede: true, motivo: '' }
}

export const POR_QUE_SE_BLOQUEA =
  'Porque un conjunto vacío de bajas es indistinguible de un fallo de lectura, ' +
  'y de los dos errores posibles sólo uno es reparable: el mensaje que no se ' +
  'mandó se manda mañana; el que se mandó a quien pidió la baja, no se puede ' +
  'devolver.'
