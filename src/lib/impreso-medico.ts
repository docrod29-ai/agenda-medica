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

/**
 * EL MISMO MÉDICO, LLAMADO DE DOS FORMAS.
 *
 * ── EL FALLO QUE ESTO CIERRA (reportado por el Dr.: «no sale en mi receta») ───
 *
 * La nota guarda `metadata.medicoId` con el **uid de Firebase** de quien firma
 * (`auth.currentUser.uid`). La firma y la plantilla, en cambio, se guardan bajo
 * el **id del documento** de `doctors`, que es lo que elige el selector de
 * Configuración.
 *
 * Son dos identificadores distintos de la misma persona, así que la búsqueda
 * exacta nunca acierta. Con UN solo médico el respaldo «la única que hay» lo
 * tapaba; en cuanto el consultorio tiene dos o más, la receta sale **sin firma**
 * — y sin ninguna explicación, porque desde dentro parece que ese médico no
 * subió la suya.
 *
 * Es el mismo desajuste que ya se reparó una vez (v321) por otro camino: aquel
 * arreglo añadió el respaldo del médico único, que resolvía el caso de entonces
 * y dejaba abierto éste.
 *
 * ── CÓMO SE RESUELVE ─────────────────────────────────────────────────────────
 *
 * El puente ya existe y no hubo que inventarlo: `doctors/{id}.uid`, que se
 * escribe al conectar Google Calendar (v875) y se rellenó para los que ya
 * estaban conectados (v899). Si el id que trae la nota no es un documento de
 * `doctors`, se busca al médico cuyo `uid` coincide.
 *
 * NO adivina: si nadie coincide, devuelve `undefined` y el impreso sigue su
 * camino de siempre —que ya avisa cuando no puede resolver la firma—. Poner la
 * firma de otro médico es peor que no poner ninguna.
 */
export function resolverIdMedico(
  medicoId: string | undefined | null,
  doctores: readonly { id: string; uid?: string }[] | undefined | null,
): string | undefined {
  const id = String(medicoId ?? '').trim()
  if (!id) return undefined
  const lista = doctores ?? []
  // Ya es el id del documento: nada que traducir.
  if (lista.some(d => d.id === id)) return id
  // Es el uid de la sesión de quien firmó.
  const porUid = lista.filter(d => d.uid && d.uid === id)
  return porUid.length === 1 ? porUid[0].id : undefined
}

export const POR_QUE_HAY_QUE_TRADUCIR =
  'Porque la nota firma con el uid de la sesión y la firma se guarda por el id ' +
  'del documento de `doctors`. Son dos nombres de la misma persona, y sin ' +
  'traducirlos la receta de un consultorio con dos médicos sale sin firma.'
