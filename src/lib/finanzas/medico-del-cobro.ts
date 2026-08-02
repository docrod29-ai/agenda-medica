/**
 * A QUÉ MÉDICO PERTENECE UN COBRO — un solo identificador, no dos.
 *
 * ── EL AGUJERO, QUE CUESTA DINERO ────────────────────────────────────────────
 *
 * El mismo médico generaba cobros con DOS identificadores distintos:
 *
 *   · cobrando desde **Citas**, va el `medicoId` de la cita, que es el id del
 *     documento en la subcolección `doctors` (autogenerado con `addDoc`);
 *   · cobrando al cerrar la **Consulta**, va `auth.currentUser.uid`.
 *
 * Y el reparto de comisiones agrupa por `medicoId`. Resultado: la Dra. aparece
 * DOS VECES en el panel, el dueño pone el porcentaje en la fila que reconoce, y
 * la otra mitad de su trabajo se comisiona al 0 % — o se paga dos veces si
 * alguien consolida a mano.
 *
 * Es la misma raíz que ya mordió en la hoja membretada: las notas usan el uid y
 * la configuración guarda por id de `doctors`.
 *
 * ── LA REGLA: NUNCA ADIVINAR ─────────────────────────────────────────────────
 *
 * Se resuelve por coincidencia EXACTA, y si hay ambigüedad **no se elige**: se
 * marca `sin-resolver` y se conserva lo que venía. Un cobro atribuido al médico
 * equivocado es peor que un cobro sin atribuir, porque el segundo se ve en la
 * fila «sin atribuir» y el primero se paga en silencio a quien no era.
 *
 * Módulo PURO.
 */

/** Lo que hace falta saber de un médico del consultorio. */
export interface MedicoConocido {
  id: string
  nombre?: string
  email?: string
  /** Si algún día el documento guarda el uid, se prefiere sobre el correo. */
  uid?: string
  activo?: boolean
}

export type ComoSeResolvio = 'directo' | 'por-uid' | 'por-correo' | 'sin-resolver'

export interface MedicoDelCobro {
  /** El identificador CANÓNICO: el id del documento en `doctors` cuando se pudo. */
  medicoId?: string
  medicoNombre?: string
  como: ComoSeResolvio
}

const norm = (s?: string) => String(s ?? '').trim().toLowerCase()

/**
 * Elige el identificador canónico del médico de un cobro.
 *
 * @param medicoIdEntrante lo que mandó la pantalla (id de `doctors` o un uid).
 * @param uid quién está cobrando, según la sesión.
 * @param email su correo, para el último recurso.
 */
export function elegirMedicoCanonico(args: {
  medicoIdEntrante?: string
  uid?: string
  email?: string
  doctores: readonly MedicoConocido[]
}): MedicoDelCobro {
  const { doctores } = args
  const entrante = String(args.medicoIdEntrante ?? '').trim()

  // 1. ¿Ya es el id de un médico del consultorio? Nada que resolver.
  const directo = doctores.find(d => d.id === entrante)
  if (directo) return { medicoId: directo.id, medicoNombre: directo.nombre, como: 'directo' }

  // 2. ¿Algún documento declara ese uid? (camino preferente si algún día existe)
  const candidatoUid = entrante || String(args.uid ?? '').trim()
  const porUid = candidatoUid ? doctores.filter(d => d.uid && d.uid === candidatoUid) : []
  if (porUid.length === 1) return { medicoId: porUid[0].id, medicoNombre: porUid[0].nombre, como: 'por-uid' }

  // 3. Por correo, y SÓLO si es inequívoco. Dos médicos con el mismo correo no
  //    se desempatan solos: se prefiere no atribuir a atribuir mal.
  const correo = norm(args.email)
  const porCorreo = correo ? doctores.filter(d => norm(d.email) === correo) : []
  if (porCorreo.length === 1) return { medicoId: porCorreo[0].id, medicoNombre: porCorreo[0].nombre, como: 'por-correo' }

  // 4. No se pudo. Se conserva lo que venía —o el uid— y queda DECLARADO.
  const conserva = entrante || String(args.uid ?? '').trim() || undefined
  return { medicoId: conserva, como: 'sin-resolver' }
}

export const POR_QUE_NO_SE_ADIVINA =
  'Porque un cobro atribuido al médico equivocado es peor que uno sin atribuir: ' +
  'el segundo se ve en la fila «sin atribuir» y el primero se paga en silencio a ' +
  'quien no era.'
