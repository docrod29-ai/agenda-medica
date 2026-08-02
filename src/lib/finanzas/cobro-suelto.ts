/**
 * UN COBRO SUELTO TAMBIÉN ES DE ALGUIEN.
 *
 * ── LO QUE SE PIERDE ─────────────────────────────────────────────────────────
 *
 * El modal de cobro sólo sabe de qué médico es cuando se abre DESDE una cita
 * (`prefill.medicoId`). Abierto desde Finanzas —una consulta que no estaba
 * agendada, un procedimiento, la venta de un insumo— no hay médico y el modal
 * tampoco pregunta: el cobro se guarda con lo que resuelva la sesión, y si
 * quien cobra es la asistente, no coincide con ningún médico y el cobro cae en
 * la fila «sin atribuir» del reparto de comisiones.
 *
 * Ese dinero existe, se cobró y se depositó, pero al repartir no es de nadie.
 * Nadie lo reclama porque nadie lo ve: no aparece en la fila de ningún médico.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Con UN solo médico activo no hay nada que preguntar: es suyo. Con varios hay
 * que preguntar, y la respuesta es obligatoria —igual que el importe— porque un
 * cobro sin médico se pierde en silencio y uno atribuido a quien no era se paga
 * en silencio. Ninguno de los dos se arregla solo después.
 *
 * NO se adivina «el primero de la lista» ni «el dueño»: eso es exactamente
 * atribuir mal. Ver también `medico-del-cobro.ts`, que resuelve el otro extremo
 * del problema (el mismo médico con dos identificadores).
 *
 * Módulo PURO.
 */

/** Lo mínimo que hace falta saber de un médico para poder elegirlo. */
export interface MedicoElegible {
  id: string
  nombre?: string
  activo?: boolean
}

export interface DecisionMedicoSuelto {
  /** Los que se le ofrecen a quien cobra, ya filtrados y ordenados. */
  opciones: MedicoElegible[]
  /** Preseleccionado sólo cuando no hay ambigüedad posible. */
  medicoId?: string
  /** `true` cuando hay que preguntar antes de dejar guardar. */
  hayQuePreguntar: boolean
}

/**
 * A quién se le atribuye un cobro que no viene de una cita.
 *
 * @param doctores los del consultorio, como vengan.
 * @param yaVieneCon el médico que ya trae el cobro (desde una cita): entonces
 *        no hay nada que preguntar.
 */
export function decidirMedicoDelCobroSuelto(
  doctores: readonly MedicoElegible[],
  yaVieneCon?: string,
): DecisionMedicoSuelto {
  // Un médico dado de baja no debe seguir recibiendo cobros nuevos, pero si el
  // consultorio no marca `activo` en nadie, filtrarlos dejaría la lista VACÍA y
  // volveríamos al problema de origen: se aceptan los que no lo declaran.
  const opciones = doctores.filter(d => d.id && d.activo !== false)

  const traido = String(yaVieneCon ?? '').trim()
  if (traido) return { opciones, medicoId: traido, hayQuePreguntar: false }

  // Un solo médico: es suyo, no hay pregunta que hacer.
  if (opciones.length === 1) return { opciones, medicoId: opciones[0].id, hayQuePreguntar: false }

  // Ninguno: no hay a quién atribuirlo y tampoco a quién preguntar. El cobro se
  // guarda igual —no se pierde dinero por esto— y queda «sin atribuir», que es
  // la verdad.
  if (opciones.length === 0) return { opciones, hayQuePreguntar: false }

  return { opciones, hayQuePreguntar: true }
}

export const POR_QUE_SE_PREGUNTA =
  'Porque un cobro suelto sin médico no se pierde a la vista: se cobra, se ' +
  'deposita y desaparece del reparto en la fila «sin atribuir», donde nadie lo ' +
  'reclama. Preguntarlo cuesta un clic; reconstruirlo a fin de mes cuesta la ' +
  'confianza de quien atendió.'
