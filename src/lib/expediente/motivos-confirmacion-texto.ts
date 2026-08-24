/**
 * LOS MOTIVOS DE CONFIRMACIÓN, EN CASTELLANO Y CON QUÉ HACER.
 *
 * El pipeline conserva toda la incertidumbre del ASR para procedencia/auditoría,
 * pero el flujo del médico NO debe convertirse en un panel de depuración. Esta
 * capa decide únicamente qué motivos tienen capacidad de cambiar una decisión
 * clínica y, por tanto, merecen llegar a la interfaz.
 *
 * Regla de producto (Consultorio Golden Path #4):
 * - ruido de confianza genérico/filler → permanece debajo, no interrumpe;
 * - medicamento, dosis/unidad, negación, lateralidad, dispositivo crítico o una
 *   intención de prescribir/solicitar todavía ambigua → se muestra en contexto;
 * - un motivo desconocido falla cerrado hacia NO MOSTRARLO: no se enseña un
 *   nombre de máquina ni se convierte ruido técnico en una tarea del médico.
 *
 * Esto NO borra incertidumbre ni cambia Clinical Truth. Sólo gobierna la
 * superficie visible para el médico. Los datos de confianza, alternativas,
 * timestamps y revisiones siguen viajando por Voice/provenance.
 */

/** Motivos que sí pueden cambiar el significado o la conducta clínica. */
export const MOTIVOS_CLINICAMENTE_MATERIALES = new Set([
  'confianza_baja_con_termino_critico',
  'dos_o_mas_farmacos_plausibles',
  'dosis_o_unidad_ambigua',
  'negacion_incierta',
  'lateralidad_incierta',
  'sigla_de_modo_o_dispositivo_incierta',
  'farmaco_solo_propuesto',
  'estudio_solo_propuesto',
] as const)

export function esMotivoClinicamenteMaterial(motivo: string): boolean {
  return MOTIVOS_CLINICAMENTE_MATERIALES.has(motivo as never)
}

/**
 * Filtra sin deduplicar semántica: conserva el orden del pipeline para que el
 * contexto que llegue primero siga apareciendo primero. La deduplicación de
 * texto ocurre después, en `textosDeMotivos`.
 */
export function motivosClinicamenteMateriales(motivos: readonly string[]): string[] {
  return motivos.filter(esMotivoClinicamenteMaterial)
}

export const TEXTO_MOTIVO: Record<string, string> = {
  confianza_baja_con_termino_critico:
    'Hay una palabra dudosa junto a una cifra o unidad. Revisa esa posología antes de firmar.',
  dos_o_mas_farmacos_plausibles:
    'El nombre del medicamento no quedó inequívoco. Confirma cuál es antes de prescribir.',
  dosis_o_unidad_ambigua:
    'La dosis o la unidad no quedó inequívoca. Confirma cantidad y unidad antes de prescribir.',
  negacion_incierta:
    'No quedó inequívoco si el paciente afirmó o negó este dato. Confírmalo antes de incorporarlo a la nota.',
  lateralidad_incierta:
    'No quedó inequívoco si era derecho o izquierdo. Confirma la lateralidad antes de incorporarla al plan.',
  sigla_de_modo_o_dispositivo_incierta:
    'Una sigla clínica crítica quedó ambigua. Confirma el modo o dispositivo antes de incorporarlo a la nota.',
  farmaco_solo_propuesto:
    'Este fármaco se mencionó como posibilidad, no como indicación inequívoca. Confirma si realmente va en la receta.',
  estudio_solo_propuesto:
    'Este estudio se mencionó como posibilidad, no como solicitud inequívoca. Confirma si realmente va en la orden.',
}

/**
 * Textos visibles para el médico: sólo material clínico, sin nombres de máquina,
 * sin porcentajes de confianza y sin motivos repetidos.
 */
export function textosDeMotivos(motivos: readonly string[]): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const m of motivosClinicamenteMateriales(motivos)) {
    const t = TEXTO_MOTIVO[m]
    if (!t || vistos.has(t)) continue
    vistos.add(t)
    out.push(t)
  }
  return out
}

/**
 * Motivos de ASR que pueden existir en telemetría/provenance pero jamás deben
 * transformarse por sí solos en una interrupción del médico.
 */
export const MOTIVOS_TECNICOS_NO_VISIBLES = new Set([
  'confianza_baja_generica',
  'palabra_relleno_baja_confianza',
  'diarizacion_no_disponible',
  'proveedor_asr_alterno',
  'normalizacion_segura',
])

export const POR_QUE_NO_BLOQUEA =
  'La incertidumbre clínicamente material se muestra para revisión contextual. ' +
  'El ruido técnico o de confianza genérica se conserva en procedencia/auditoría ' +
  'pero no interrumpe el flujo del médico.'
