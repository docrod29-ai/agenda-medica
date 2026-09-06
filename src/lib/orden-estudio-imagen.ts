/**
 * LA ORDEN DE IMAGEN DICE QUÉ, DÓNDE Y DE QUÉ LADO — MO-003 · PO-015 · MO-012.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La orden de imagen era texto libre elegido de un catálogo con entradas como
 * «Radiografía de extremidades» o «Radiografía de columna (cervical / dorsal /
 * lumbar)». Se podía imprimir y firmar, con folio y cédula, una orden que no
 * dice qué extremidad, qué lado ni qué segmento. La única compuerta era «hay al
 * menos un estudio».
 *
 * Del otro lado: el técnico le pregunta al paciente de qué lado le duele —y en
 * un niño, un anciano o un dolor bilateral se equivoca—; y el portal del
 * paciente responde la línea literal de la orden con sello de procedencia, o
 * sea que le presta autoridad a una orden incompleta (PO-015). Un error de
 * lateralidad es un evento centinela.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * 1. Sabe qué regiones son PARES y por tanto exigen lado (`admiteLateralidad`).
 *    Es anatomía, no una cifra clínica: no hay umbral, dosis ni punto de corte.
 * 2. Sabe leer si el texto ya trae el lado (`lateralidadDe`), incluido
 *    «bilateral», que es un valor válido y no un descuido.
 * 3. Compone el texto que se imprime a partir de la elección estructurada
 *    (`componerEstudioImagen`): UNA entidad —región · lado · proyecciones— que
 *    se PINTA como la cadena que ya guarda `estudiosOrden`.
 * 4. Lista lo que le falta lado (`estudiosSinLateralidad`), que es lo que la
 *    pantalla usa para no dejar emitir la orden.
 *
 * ── LO QUE NO HACE, Y POR QUÉ ────────────────────────────────────────────────
 *
 * · No decide QUÉ PROYECCIONES corresponden a cada región: eso lo fija un
 *   radiólogo o un ortopedista, no el código. `NEEDS_CLINICAL_REVIEW`. Por eso
 *   las proyecciones son un campo libre que el médico escribe o elige de lo que
 *   ya diga el nombre del estudio, y su ausencia NO bloquea nada.
 * · No guarda un tipo nuevo: `NotaMedica.estudiosOrden` es `string[]` y esa es
 *   la forma compartida con el paquete del paciente y con la exportación. El
 *   modelo estructurado vive en la pantalla y en este módulo, y se pinta a
 *   texto — una entidad, muchas vistas. Tipar `estudiosOrden` es trabajo del
 *   modelo compartido y queda en el handoff.
 * · La lista de regiones pares es VOCABULARIO, no criterio (regla 5 de
 *   seguridad clínica): que falte una región significa que ese caso NO se
 *   vigila, no que esté bien. Ampliarla es seguro; recortarla, no.
 *
 * Módulo PURO.
 */

export type LadoEstudio = 'derecho' | 'izquierdo' | 'bilateral'

/** Cómo se ofrece el lado en la pantalla y cómo se escribe en el papel. */
export const LADOS: readonly LadoEstudio[] = ['derecho', 'izquierdo', 'bilateral'] as const

/**
 * Regiones PARES: existen dos y la orden no significa nada sin decir cuál.
 *
 * Vocabulario, no criterio. Se compara sobre el texto normalizado del estudio.
 */
const REGIONES_PARES = [
  'extremidad', 'extremidades', 'miembro', 'miembros',
  'hombro', 'codo', 'muneca', 'mano', 'dedo',
  'cadera', 'rodilla', 'tobillo', 'pie', 'talon',
  'clavicula', 'escapula', 'femur', 'tibia', 'perone', 'humero', 'radio', 'cubito',
  'mama', 'mastografia', 'oido', 'ojo', 'orbita',
  'carotideo', 'carotidea',
] as const

/** Cómo aparece el lado escrito en una orden mexicana. */
const RE_LATERALIDAD = /\b(derech[oa]s?|izquierd[oa]s?|bilateral(?:es)?|ambos|ambas)\b/i

/**
 * Modalidades: lo que va DELANTE de «de pie» cuando «pie» es el pie del
 * paciente («radiografía de pie») y no una posición («abdomen de pie»).
 */
const MODALIDADES = /(radiograf|rx|placa|tc|tomograf|rm|resonancia|ultrasonido|usg|doppler|gammagra|densitometr|mastograf|serie)/

/**
 * «RADIOGRAFÍA DE ABDOMEN (SIMPLE Y DE PIE)» NO ES UN ESTUDIO DE PIE.
 *
 * `pie` es región par y también es la posición en la que se toma una placa de
 * abdomen o de tórax. Sin esto, el catálogo entero se marcaba como «falta el
 * lado» y la orden quedaba bloqueada por un dato que no existe.
 *
 * Dos limpiezas antes de buscar la región:
 *  · lo que va entre paréntesis es la proyección o el protocolo, no la región;
 *  · «<región> de pie» / «<región> en pie» es posición — salvo cuando lo que va
 *    delante es la modalidad, que es como se nombra el pie de verdad
 *    («radiografía de pie»).
 */
const norm = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/([a-z]+)\s+(?:de|en)\s+pies?\b/g, (m, prev: string) => (MODALIDADES.test(prev) ? m : prev))

/** ¿Esta región tiene dos, y por tanto la orden necesita decir cuál? */
export function admiteLateralidad(estudio: string): boolean {
  const t = norm(estudio)
  if (!t.trim()) return false
  return REGIONES_PARES.some(r => new RegExp(`\\b${r}\\b`).test(t))
}

/** El lado que el texto ya declara, o `null` si no dice ninguno. */
export function lateralidadDe(estudio: string): LadoEstudio | null {
  const m = RE_LATERALIDAD.exec(norm(estudio))
  if (!m) return null
  const t = m[1]
  if (t.startsWith('bilateral') || t.startsWith('ambos') || t.startsWith('ambas')) return 'bilateral'
  return t.startsWith('derech') ? 'derecho' : 'izquierdo'
}

/** ¿A este estudio le falta el lado que su región exige? */
export function faltaLateralidad(estudio: string): boolean {
  return admiteLateralidad(estudio) && lateralidadDe(estudio) === null
}

/** Los estudios de la orden a los que les falta el lado. En su orden original. */
export function estudiosSinLateralidad(estudios: readonly string[]): string[] {
  return estudios.filter(e => e.trim() && faltaLateralidad(e))
}

/**
 * El texto que se imprime, compuesto de la elección estructurada.
 *
 * `bilateral` se escribe tal cual («… bilateral»); los otros dos concuerdan con
 * la región en masculino por omisión, que es como se escribe en el papel
 * («Radiografía de tobillo izquierdo»). No se intenta concordar el género del
 * sustantivo: escribir «rodilla izquierdo» sería peor que dejarlo al médico, así
 * que las regiones femeninas de uso común llevan su forma.
 */
const FEMENINAS = ['rodilla', 'cadera', 'muneca', 'mano', 'clavicula', 'escapula', 'tibia', 'mama', 'orbita']

export function textoDelLado(estudio: string, lado: LadoEstudio): string {
  if (lado === 'bilateral') return 'bilateral'
  const t = norm(estudio)
  const femenino = FEMENINAS.some(f => new RegExp(`\\b${f}\\b`).test(t))
  if (lado === 'derecho') return femenino ? 'derecha' : 'derecho'
  return femenino ? 'izquierda' : 'izquierdo'
}

export interface EstudioImagen {
  /** Nombre del estudio tal como sale del catálogo o lo escribe el médico. */
  base: string
  lado?: LadoEstudio
  /** Proyecciones o protocolo: texto libre del médico. NEEDS_CLINICAL_REVIEW. */
  proyecciones?: string
}

/** Pinta la entidad estructurada como la cadena que se guarda y se imprime. */
export function componerEstudioImagen(e: EstudioImagen): string {
  const base = e.base.trim()
  if (!base) return ''
  const partes = [base]
  if (e.lado && lateralidadDe(base) === null) partes.push(textoDelLado(base, e.lado))
  const proy = (e.proyecciones ?? '').trim()
  return proy ? `${partes.join(' ')} — ${proy}` : partes.join(' ')
}

/**
 * Añade o cambia el lado de un estudio ya escrito, sin duplicarlo.
 *
 * Si el texto ya declaraba un lado, se sustituye: el médico está corrigiendo, y
 * dejar los dos («tobillo derecho izquierdo») sería peor que no decir nada.
 */
export function conLateralidad(estudio: string, lado: LadoEstudio): string {
  const limpio = estudio.replace(RE_LATERALIDAD, '').replace(/\s{2,}/g, ' ').replace(/\s+—/, ' —').trim()
  const [base, ...resto] = limpio.split(' — ')
  const compuesto = `${base.trim()} ${textoDelLado(base, lado)}`.replace(/\s{2,}/g, ' ').trim()
  return resto.length ? `${compuesto} — ${resto.join(' — ')}` : compuesto
}

export const POR_QUE_SE_BLOQUEA_SIN_LADO =
  'Porque una orden de una región par sin lado no es una orden incompleta: es ' +
  'una orden que se va a cumplir mal. El técnico se lo pregunta al paciente, y ' +
  'el paciente no siempre puede contestarlo. Un lado equivocado es radiación, ' +
  'costo y un estudio que hay que repetir — y en cirugía, un evento centinela.'

export const POR_QUE_LAS_PROYECCIONES_NO_BLOQUEAN =
  'Porque qué proyecciones lleva cada región la fija un radiólogo, no el ' +
  'código. Exigir un dato que el sistema no sabe validar sólo enseña a ' +
  'rellenar cualquier cosa para poder imprimir.'
