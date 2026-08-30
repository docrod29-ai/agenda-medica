/**
 * CUANDO EL PASAJE EXISTE, ES LITERAL, Y DICE OTRA COSA.
 *
 * ── EL HUECO QUE CIERRA (WS-12) ─────────────────────────────────────────────
 *
 * `verificar-la-cita.ts` comprueba que una afirmación esté **anclada**: que el
 * pasaje que la respalda exista de verdad en el artículo. REG-400 añadió de qué
 * parte del artículo sale, para que una cita de los antecedentes no se lea como
 * una conclusión.
 *
 * Falta lo que sólo un modelo puede juzgar del todo —si el pasaje *significa* lo
 * que la afirmación dice— y eso necesita un conjunto de referencia y un umbral
 * que fija el médico. Pero **dos casos no necesitan modelo ninguno**, y son los
 * dos que más caro salen:
 *
 *   · POLARIDAD — el pasaje dice «no redujo la mortalidad» y la afirmación dice
 *     «redujo la mortalidad». El pasaje está, es literal, y dice lo contrario.
 *   · MATIZ — el pasaje dice «podría reducir» y la afirmación dice «reduce». La
 *     evidencia venía con reservas y la frase se las quitó.
 *
 * Los dos pasan hoy la comprobación de anclaje sin una marca, porque el anclaje
 * pregunta si el texto existe, no si dice lo mismo.
 *
 * ── LA REGLA: SEÑALAR DE MENOS, NUNCA DE MÁS ────────────────────────────────
 *
 * Un detector de negación que dispare con cualquier «no» marcaría media
 * literatura: «reduced mortality in patients who did not receive X» no es una
 * negación del hallazgo. Y una marca falsa sobre una cita correcta enseña al
 * médico a ignorar las marcas — que es peor que no tenerlas.
 *
 * Por eso esto exige **tres cosas a la vez** antes de marcar:
 *
 *   1. el pasaje casa con un patrón de resultado NEGADO de una lista cerrada;
 *   2. la afirmación casa con el MISMO verbo en afirmativo;
 *   3. la afirmación no trae negación propia.
 *
 * Y compara **la raíz del verbo**, no la frase: «did not reduce» contra
 * «reduces» comparten `reduc`. Sin eso, cualquier negación de cualquier cosa
 * cerca de cualquier afirmación daría una inversión.
 *
 * Lo que no cumpla las tres sale `no_evaluable` y **se cuenta**, igual que en el
 * motor de aplicabilidad. Un hueco contado es un hueco; un hueco silencioso es
 * una promesa.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * **No es un evaluador de entailment y no se declara como tal.** No juzga si la
 * afirmación se sigue del pasaje: detecta dos desajustes concretos y nombrados.
 * Todo lo demás sigue necesitando un modelo, su conjunto y su umbral.
 *
 * Tampoco decide qué hacer con la marca. Igual que las citas fuera de los
 * hallazgos, esto **anota**: quitar una afirmación de la vista porque un patrón
 * casó sería peor que no tener el patrón.
 *
 * Módulo PURO.
 */

/** Qué se encontró al comparar la afirmación con su pasaje. */
export type Desajuste =
  /** El pasaje niega lo que la afirmación afirma. */
  | 'polaridad_invertida'
  /** El pasaje lo dice con reservas y la afirmación las quitó. */
  | 'matiz_endurecido'

export interface DesajusteHallado {
  readonly clase: Desajuste
  /** La raíz del verbo compartido. Es lo que hace comparable a los dos textos. */
  readonly verbo: string
  /** Lo que se leyó en el pasaje, tal cual. No se reescribe. */
  readonly enElPasaje: string
  /** Lo que se leyó en la afirmación, tal cual. */
  readonly enLaAfirmacion: string
  readonly porQue: string
}

/** Sin acentos y en minúsculas: los resúmenes llegan escritos de mil maneras. */
function plano(s: string): string {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Los verbos de resultado que este módulo sabe leer, por su RAÍZ.
 *
 * Es vocabulario, no criterio: lo que no esté aquí **no se vigila**, y eso se
 * declara en `LO_QUE_NO_SE_VIGILA`. Añadir uno es añadir cobertura, nunca
 * cambiar un juicio.
 */
export const VERBOS_DE_RESULTADO: readonly string[] = [
  /**
   * Ojo con el español: `reducir` hace `redujo` en pretérito y `prevenir` hace
   * `previno`. La raíz cambia, y sin las dos formas «no redujo la mortalidad»
   * —la frase más común del caso que esto existe para cazar— no se leía.
   *
   * Se vio midiendo el módulo contra frases reales antes de escribir la prueba;
   * leyendo el código parecía correcto.
   */
  'reduc', 'reduj', 'disminu', 'aument', 'increas', 'mejor', 'improv',
  'prolong', 'prevent', 'previen', 'previn', 'asoci', 'associat',
  /**
   * `super` NO está, y se quitó después de medir: colisiona con
   * «supervivencia», que es un sustantivo y aparece en casi todo resumen de
   * mortalidad. Con él, «no aumentó la supervivencia» contra «mejoró la
   * supervivencia» daba una inversión sobre un verbo que no era un verbo.
   *
   * Una raíz que casa con una palabra común no añade cobertura: añade ruido, y
   * el ruido en una marca de seguridad se paga con que dejen de leerse.
   */
]

/** Lo que niega un resultado, pegado al verbo. Lista cerrada a propósito. */
const NEGADORES = [
  'no', 'not', 'ni', 'sin', 'never', 'nunca', 'failed to', 'fallo en', 'no logro',
]

/** Lo que atenúa un resultado. Lista cerrada. */
const ATENUADORES = [
  'podria', 'podrian', 'puede', 'pueden', 'sugiere', 'sugieren', 'parece', 'parecen',
  'may', 'might', 'could', 'suggest', 'suggests', 'appears to', 'appear to',
  'posiblemente', 'probablemente', 'possibly', 'likely', 'tiende a', 'tends to',
]

/** Una lectura del texto alrededor de un verbo de resultado. */
interface Lectura {
  readonly verbo: string
  readonly negado: boolean
  readonly atenuado: boolean
  /** El fragmento leído, para poder enseñarlo sin reescribirlo. */
  readonly fragmento: string
}

/**
 * Lee el texto alrededor de cada verbo de resultado que aparezca.
 *
 * La ventana previa es de 40 caracteres: lo justo para que quepa «did not» o
 * «podría» y no tanto como para que un «no» de otra oración se cuele. No es una
 * cifra clínica — es cuánto mide una locución.
 */
export function leerResultados(texto: string): Lectura[] {
  const t = plano(texto)
  const out: Lectura[] = []
  for (const verbo of VERBOS_DE_RESULTADO) {
    let desde = 0
    for (;;) {
      const i = t.indexOf(verbo, desde)
      if (i === -1) break
      desde = i + verbo.length
      const previo = t.slice(Math.max(0, i - 40), i)
      /* Si hay un punto entre medias, lo de antes es OTRA oración y no cuenta. */
      const mismaOracion = previo.slice(previo.lastIndexOf('.') + 1)
      out.push({
        verbo,
        negado: NEGADORES.some(n => new RegExp(`(^|\\s)${n}(\\s|$)`).test(mismaOracion)),
        atenuado: ATENUADORES.some(a => new RegExp(`(^|\\s)${a}(\\s|$)`).test(mismaOracion)),
        fragmento: texto.slice(Math.max(0, i - 40), Math.min(texto.length, i + verbo.length + 20)).trim(),
      })
    }
  }
  return out
}

/**
 * Compara una afirmación con el pasaje que la respalda.
 *
 * Devuelve los desajustes hallados, que pueden ser ninguno. **Un array vacío no
 * significa que la cita sea correcta**: significa que estos dos patrones no
 * saltaron. Es la diferencia entre «no encontré motivos» y «está bien».
 */
export function desajustesEntre(afirmacion: string, pasaje: string): DesajusteHallado[] {
  const enAfirmacion = leerResultados(afirmacion)
  const enPasaje = leerResultados(pasaje)
  if (!enAfirmacion.length || !enPasaje.length) return []

  const out: DesajusteHallado[] = []
  /* Una marca por verbo. Dos raíces que casan con la misma palabra —o la misma
     raíz dos veces en la frase— no son dos hallazgos distintos. */
  const yaMarcado = new Set<string>()
  for (const a of enAfirmacion) {
    if (yaMarcado.has(a.verbo)) continue
    /* El MISMO verbo en los dos lados. Sin esto, una negación de cualquier cosa
       cerca de una afirmación de otra daría una inversión inventada. */
    const p = enPasaje.find(x => x.verbo === a.verbo)
    if (!p) continue

    if (p.negado && !a.negado) {
      out.push({
        clase: 'polaridad_invertida',
        verbo: a.verbo,
        enElPasaje: p.fragmento,
        enLaAfirmacion: a.fragmento,
        porQue: 'El pasaje NIEGA el resultado y la afirmación lo da por ocurrido.',
      })
      yaMarcado.add(a.verbo)
      continue
    }
    if (p.atenuado && !a.atenuado && !p.negado) {
      out.push({
        clase: 'matiz_endurecido',
        verbo: a.verbo,
        enElPasaje: p.fragmento,
        enLaAfirmacion: a.fragmento,
        porQue: 'El pasaje lo dice con reservas y la afirmación las quitó.',
      })
      yaMarcado.add(a.verbo)
    }
  }
  return out
}

/** Cómo se le dice al médico, sin adjetivos. */
export function comoSeDiceElDesajuste(d: DesajusteHallado): string {
  return d.clase === 'polaridad_invertida'
    ? `El artículo dice lo contrario: «${d.enElPasaje}».`
    : `El artículo lo dice con reservas: «${d.enElPasaje}».`
}

/**
 * LO QUE ESTE PAR DE COMPROBACIONES NO MIRA. Se exporta para pintarse.
 *
 * Que no salte una marca no quiere decir que la cita sostenga la afirmación.
 */
export const LO_QUE_NO_SE_VIGILA: readonly string[] = [
  'Si el pasaje SIGNIFICA lo que la afirmación dice. Eso es entailment y necesita un modelo, su conjunto de referencia y un umbral que fija el médico.',
  'Los verbos de resultado que no estén en `VERBOS_DE_RESULTADO`: lo que no esté ahí no se vigila, y no por eso está bien.',
  'La población, la dosis y el desenlace: una cita puede ser fiel en polaridad y matiz y hablar de otros pacientes. Eso es aplicabilidad, y vive en otro motor.',
  'La magnitud: «redujo un 2 %» citado como «redujo» no es una inversión ni una atenuación, y puede ser igual de engañoso.',
  'La negación repartida entre dos oraciones del pasaje, que esta ventana no alcanza.',
]

export const POR_QUE_NO_ES_ENTAILMENT =
  'Porque no juzga si la afirmación se sigue del pasaje: detecta DOS desajustes '
  + 'concretos y nombrados —el pasaje niega lo que la frase afirma, o lo dice con '
  + 'reservas que la frase quitó—. Llamar a esto un evaluador de entailment sería '
  + 'declarar una cobertura que no tiene.'

export const POR_QUE_SE_EXIGEN_TRES_COSAS =
  'Porque un detector que dispare con cualquier «no» marcaría media literatura: '
  + '«reduced mortality in patients who did not receive X» no niega el hallazgo. '
  + 'Y una marca falsa sobre una cita correcta enseña al médico a ignorar las '
  + 'marcas, que es peor que no tenerlas. Se exige el patrón negado en el pasaje, '
  + 'el MISMO verbo en afirmativo en la frase, y que la frase no traiga negación '
  + 'propia.'
