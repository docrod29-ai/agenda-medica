/**
 * QUÉ MÉDICO ES EL DUEÑO DE ESTE CALENDARIO DE GOOGLE.
 *
 * ── EL ESLABÓN QUE FALTABA ───────────────────────────────────────────────────
 *
 * El token de Google se guarda en `googleTokens/{uid}`. La agenda, en cambio,
 * razona con `medicoId`, que es el id del documento en `clinics/{c}/doctors`.
 * **No existe ninguna relación entre los dos**, y por eso:
 *
 *  · el portal público, el bot de WhatsApp y el reagendado del paciente NO
 *    consultan el freebusy de Google — un paciente puede reservar encima de una
 *    cirugía que el médico tiene apuntada en su calendario personal;
 *  · y la sincronización desde el portal quedó deliberadamente sin hacer, porque
 *    escribir en el calendario del médico equivocado es peor que no escribir.
 *
 * El único momento en que se sabe con certeza que un `uid` es de una persona
 * concreta es cuando ESA persona conecta su calendario. Ahí se escribe el
 * vínculo, y a partir de entonces los caminos sin sesión pueden resolverlo.
 *
 * ── LA REGLA: SÓLO SI ES INEQUÍVOCO ──────────────────────────────────────────
 *
 * Se liga por correo EXACTO y sólo cuando hay UN candidato. Dos médicos con el
 * mismo correo, o ninguno que coincida, dejan el vínculo SIN HACER y declarado —
 * nunca «el primero de la lista». Ligarlo mal significaría enseñarle a un médico
 * las horas ocupadas de otro, que es fuga de información, y bloquearle huecos
 * que tiene libres.
 *
 * Es la misma regla que `finanzas/medico-del-cobro.ts` aplica al dinero.
 *
 * Módulo PURO.
 */

/** Lo que hace falta de un médico para poder ligarlo. */
export interface MedicoVinculable {
  id: string
  email?: string
  /** Si ya tiene uid, se respeta: no se roba un vínculo hecho. */
  uid?: string
}

export type ComoSeVinculo = 'ya-estaba' | 'por-correo' | 'sin-vinculo'

export interface Vinculo {
  /** El documento de `doctors` que corresponde a este uid, si se pudo saber. */
  medicoId?: string
  como: ComoSeVinculo
  /** Por qué no se pudo, para poder enseñarlo. Vacío cuando sí se pudo. */
  motivo: string
}

const norm = (s?: string) => String(s ?? '').trim().toLowerCase()

export const SIN_CORREO =
  'La sesión no trae correo, así que no hay forma de saber a qué médico del ' +
  'consultorio corresponde este calendario.'

export const NINGUNO =
  'Ningún médico del consultorio tiene ese correo. El calendario queda ' +
  'conectado, pero la agenda pública no podrá tener en cuenta tus eventos de ' +
  'Google hasta que el correo de tu ficha coincida.'

export const VARIOS =
  'Hay más de un médico con ese mismo correo, así que no se puede saber cuál ' +
  'eres. NO se liga a ninguno: enseñarle a un médico las horas ocupadas de otro ' +
  'sería una fuga, y bloquearle huecos que tiene libres, un error de agenda.'

/**
 * A qué documento de `doctors` pertenece el uid que acaba de conectar Google.
 *
 * @param uid quién conectó, según la sesión (no según el navegador).
 * @param email su correo verificado.
 */
export function vincularMedico(
  uid: string,
  email: string | undefined,
  doctores: readonly MedicoVinculable[],
): Vinculo {
  const yaEstaba = doctores.find(d => d.uid && d.uid === uid)
  if (yaEstaba) return { medicoId: yaEstaba.id, como: 'ya-estaba', motivo: '' }

  const correo = norm(email)
  if (!correo) return { como: 'sin-vinculo', motivo: SIN_CORREO }

  // Un médico que YA tiene otro uid no se le quita a su dueño.
  const candidatos = doctores.filter(d => norm(d.email) === correo && (!d.uid || d.uid === uid))
  if (candidatos.length === 1) return { medicoId: candidatos[0].id, como: 'por-correo', motivo: '' }

  return { como: 'sin-vinculo', motivo: candidatos.length === 0 ? NINGUNO : VARIOS }
}

export const POR_QUE_IMPORTA =
  'Porque sin este vínculo el portal público y el bot no pueden consultar el ' +
  'calendario del médico: el token vive por uid y la agenda razona por ' +
  'medicoId. Mientras no exista, un paciente puede reservar encima de algo que ' +
  'el médico ya tiene apuntado.'
