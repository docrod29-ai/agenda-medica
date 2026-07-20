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
 * Estrategia:
 *   1. Coincidencia EXACTA por `medicoId` → se usa.
 *   2. Si no hay exacta pero existe UNA sola entrada válida **Y el consultorio
 *      tiene un solo médico** → se usa esa.
 *   3. En cualquier otro caso → `undefined` (el llamador decide).
 *
 * POR QUÉ LA REGLA 2 EXIGE AHORA `unicoMedico` (hallazgo de auditoría):
 *
 * Decía ser "segura para clínicas de varios médicos" y no lo era. Como este mismo
 * archivo documenta arriba, el match exacto CASI SIEMPRE FALLA por el desajuste
 * uid ↔ id de `doctors`: la regla 2 no era la excepción, era el camino normal.
 *
 * Consultorio con los doctores A y B; solo A subió su firma → una sola entrada
 * válida → B genera una receta y sale estampada con LA FIRMA ESCANEADA DE A. Eso
 * no es un defecto de formato: es suplantación en un documento que el paciente
 * lleva a la farmacia.
 *
 * Con varios médicos se prefiere NO estampar firma: una firma ausente se nota y
 * se corrige; una firma ajena no se nota nunca.
 */
export function entradaPorMedico<T>(
  mapa: Record<string, T> | undefined | null,
  medicoId: string | undefined | null,
  esValida: (v: T) => boolean,
  /**
   * ¿El consultorio tiene un solo médico? Solo entonces se acepta la única
   * entrada válida sin coincidencia exacta. Por defecto `false`: ante la duda no
   * se adivina, porque el error posible es poner la firma de otro.
   */
  unicoMedico = false,
): T | undefined {
  const map = mapa ?? {}
  const exacta = medicoId ? map[medicoId] : undefined
  if (exacta !== undefined && esValida(exacta)) return exacta
  if (!unicoMedico) return undefined
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
