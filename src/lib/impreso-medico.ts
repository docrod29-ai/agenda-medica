/**
 * Resuelve el valor "por médico" de un impreso (hoja membretada de notas, formato
 * de receta, firma) tolerando un desajuste histórico de identificadores:
 *
 *   - Las notas/recetas se sellan con `medicoId = auth.currentUser.uid` (UID de
 *     Firebase del usuario logueado).
 *   - Pero Configuración guarda los overrides por médico bajo el id del documento
 *     de la subcolección `doctors` (autogenerado con addDoc), que NO es el UID.
 *
 * Por eso el match exacto por médico casi siempre fallaba y el impreso caía al
 * diseño genérico aunque el médico SÍ hubiera subido su hoja/formato.
 *
 * Estrategia (segura para clínicas de 1 y de varios médicos):
 *   1. Coincidencia EXACTA por `medicoId` → se usa.
 *   2. Si no hay exacta pero existe UNA sola entrada válida (clínica de un solo
 *      médico, el caso típico) → se usa esa.
 *   3. Si hay 2+ entradas válidas y ninguna coincide → `undefined` (no adivina
 *      para no poner la hoja de un médico en la nota de otro; el llamador cae a
 *      su valor general).
 */
export function entradaPorMedico<T>(
  mapa: Record<string, T> | undefined | null,
  medicoId: string | undefined | null,
  esValida: (v: T) => boolean,
): T | undefined {
  const map = mapa ?? {}
  const exacta = medicoId ? map[medicoId] : undefined
  if (exacta !== undefined && esValida(exacta)) return exacta
  const validas = Object.values(map).filter((v): v is T => v !== undefined && v !== null && esValida(v))
  return validas.length === 1 ? validas[0] : undefined
}

/** Validez de una hoja membretada de notas: tiene URL no vacía. */
export const membreteValido = (e: { url?: string } | undefined): boolean => !!e?.url?.trim()

/** Validez de un override de receta/orden por médico: es un objeto con contenido. */
export const overrideRecetaValido = (e: object | undefined): boolean =>
  !!e && typeof e === 'object' && Object.keys(e).length > 0

/** Validez de una firma por médico: cadena no vacía. */
export const firmaValida = (s: string | undefined): boolean => !!s?.trim()
