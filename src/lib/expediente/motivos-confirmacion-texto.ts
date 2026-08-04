/**
 * LOS MOTIVOS DE CONFIRMACIÓN, EN CASTELLANO Y CON QUÉ HACER.
 *
 * `politica-critica.ts` declara seis motivos con nombre de máquina. El pipeline
 * los calcula en cada dictado desde hace versiones y **ninguna pantalla los
 * leía**: el gate que decide cuándo hay que PREGUNTAR en vez de adivinar vivía
 * apagado.
 *
 * ── POR QUÉ SE ENSEÑAN Y NO BLOQUEAN ─────────────────────────────────────────
 *
 * Convertirlos en una pregunta obligatoria antes de firmar es una decisión sobre
 * el flujo de trabajo del médico, no sobre el código — y la regla antifatiga que
 * la gobernaría ya está escrita en `uci/confirmacion.ts`, con su propia doctrina
 * («nunca preguntar por cinco valores seguidos»).
 *
 * Así que aquí se **muestran**, junto a las alertas del dictado, en las tres
 * pantallas. Eso ya cambia el resultado —el médico ve dónde mirar— sin meterle
 * una pregunta obligatoria que él no ha pedido. **Bloquear queda declarado como
 * decisión del Dr., no tomada por mí.**
 *
 * ── CADA TEXTO DICE DÓNDE MIRAR ──────────────────────────────────────────────
 *
 * «Hay una ambigüedad» no le sirve a nadie. Lo accionable es el campo concreto:
 * la dosis, la lateralidad, la negación.
 */
export const TEXTO_MOTIVO: Record<string, string> = {
  confianza_baja_con_termino_critico:
    'El audio dudó de una palabra que está pegada a una cifra o a una unidad. Revisa la posología antes de firmar.',
  dos_o_mas_farmacos_plausibles:
    'Dos fármacos encajaban con lo que se oyó. No se eligió ninguno: confirma cuál es.',
  dosis_o_unidad_ambigua:
    'Una dosis o una unidad quedó ambigua. Compruébala contra lo que dictaste.',
  negacion_incierta:
    'No quedó claro si una frase afirmaba o negaba. Revísala: cambia el sentido entero.',
  lateralidad_incierta:
    'Quedó dudoso si era derecho o izquierdo. Compruébalo en la exploración y en el plan.',
  sigla_de_modo_o_dispositivo_incierta:
    'Una sigla de modo o dispositivo quedó dudosa (PEEP/PIP, VV/VA, CVVH/CVVHD…).',
}

/** El texto de cada motivo, sin repetir y sin inventar los que no conoce. */
export function textosDeMotivos(motivos: readonly string[]): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const m of motivos) {
    const t = TEXTO_MOTIVO[m]
    // Un motivo sin texto se ignora en vez de enseñar su nombre de máquina: al
    // médico no le sirve leer `sigla_de_modo_o_dispositivo_incierta`.
    if (!t || vistos.has(t)) continue
    vistos.add(t)
    out.push(t)
  }
  return out
}

export const POR_QUE_NO_BLOQUEA =
  'Convertirlos en una pregunta obligatoria antes de firmar es una decisión ' +
  'sobre el flujo de trabajo del médico, no sobre el código, y la regla ' +
  'antifatiga que la gobernaría ya está escrita en uci/confirmacion.ts. ' +
  'Mostrarlos ya cambia el resultado sin imponerle una pregunta que no pidió.'
