/**
 * UNA REESCRITURA NO PIERDE NI CAMBIA UNA CIFRA — REG-240.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * El editor por chat existe desde hace tiempo: el médico escribe «la dosis es
 * 500 mg» o «haz esto más conciso» y el modelo devuelve la nota reescrita. Lo
 * que **no** existía es nada que comprobara qué se llevó por delante.
 *
 * Un modelo al que se le pide «más conciso» acorta. Y acortar, sobre un plan de
 * tratamiento, puede significar que desaparezca «cada 8 horas» o que «400 mg»
 * se quede en «400». El texto sigue leyéndose bien — ésa es justo la trampa.
 *
 * ── POR QUÉ ESTO NO ES PARANOIA ─────────────────────────────────────────────
 *
 * Está medido y publicado. Sobre 62 811 pares borrador→nota final en la
 * Universidad de California (AMIA 2026), los médicos **eliminaron 216 199
 * oraciones** y reemplazaron 52 542. Un modelo reescribiendo texto clínico
 * cambia mucho más de lo que se le pidió.
 *
 * Y en el único estudio que midió español–inglés, el modo de falla que se nombra
 * son **eliminaciones masivas de texto** y fármacos destrozados («losartan» →
 * «los zartan»). La cifra es lo primero que se cae.
 *
 * ── LA REGLA, Y ES PRECISA ──────────────────────────────────────────────────
 *
 * Toda cifra con unidad que estaba en el texto original **tiene que seguir
 * estando**, salvo que la cifra aparezca en la INSTRUCCIÓN del médico.
 *
 * Es decir: «la dosis es 500 mg» autoriza a que 400 mg desaparezca y 500 mg
 * aparezca —lo pidió—. «Hazlo más conciso» no autoriza nada de eso.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No repara el texto. No vuelve a meter la cifra que se cayó — eso sería
 * reescribir una nota clínica por cuenta propia. Dice **qué se perdió** y deja
 * que el médico decida: aceptar, deshacer o reformular.
 *
 * Módulo PURO.
 */

/** Unidades que convierten un número en una cifra clínica y no en una fecha. */
const UNIDADES = [
  'mg', 'g', 'mcg', 'ug', 'µg', 'kg', 'ml', 'l', 'ui', 'u', 'meq', 'mmol', 'mol',
  'mg/kg', 'mcg/kg', 'mg/dl', 'mg/dia', 'g/dl', 'mmhg', 'mm', 'cm', 'lpm', 'rpm',
  'horas', 'hora', 'h', 'hrs', 'hr', 'min', 'dias', 'dia', 'semanas', 'semana',
  'meses', 'mes', 'anios', 'anos', 'gotas', 'tabletas', 'tableta', 'capsulas',
  'capsula', 'ampolletas', 'ampolleta', 'veces', 'grados', '%',
] as const

const norm = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * `cada 8 h`, `400 mg`, `14 días`, `120/80 mmHg`, `37.5 grados`, `30 %`.
 *
 * Se normaliza a «número+unidad» sin espacios para que «400 mg» y «400mg» sean
 * la MISMA cifra: el objetivo es cazar pérdidas, no diferencias de formato.
 */
const RE_CIFRA = new RegExp(
  String.raw`(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)\s*(` +
  UNIDADES.map(u => u.replace(/[/%]/g, m => '\\' + m)).join('|') +
  String.raw`)\b`,
  'g',
)

interface Cifra { n: number; unidad: string }

/** Interno: la cifra CON su unidad, que es lo que permite razonar por unidad. */
function cifrasConUnidad(texto: unknown): Map<string, Cifra> {
  const out = new Map<string, Cifra>()
  for (const m of norm(texto).matchAll(RE_CIFRA)) {
    const numero = m[1].replace(/\s+/g, '').replace(',', '.')
    const unidad = m[2]
    const clave = `${numero}${unidad}`
    const previo = out.get(clave)
    out.set(clave, { n: (previo?.n ?? 0) + 1, unidad })
  }
  return out
}

/** Todas las cifras clínicas de un texto, normalizadas y contadas. */
export function cifrasClinicas(texto: unknown): Map<string, number> {
  return new Map([...cifrasConUnidad(texto)].map(([c, v]) => [c, v.n]))
}

export interface QueCambio {
  /** Cifras que estaban y ya no están, y que la instrucción NO menciona. */
  perdidas: readonly string[]
  /** Cifras que aparecieron y no estaban, y que la instrucción NO menciona. */
  aparecidas: readonly string[]
  /** ¿Hay algo que el médico no pidió? */
  hayCambioNoPedido: boolean
}

/**
 * Compara el antes y el después de una reescritura.
 *
 * `instruccion` es la llave: una cifra que el médico nombró en su instrucción
 * está autorizada a entrar o salir. Todo lo demás, no.
 */
export function queCambioEnLasCifras(
  antes: unknown,
  despues: unknown,
  instruccion: unknown = '',
): QueCambio {
  const a = cifrasConUnidad(antes)
  const d = cifrasConUnidad(despues)
  const pedidas = cifrasConUnidad(instruccion)

  /**
   * ── POR QUÉ SE AUTORIZA POR UNIDAD Y NO SÓLO POR CIFRA EXACTA ────────────
   *
   * La primera versión sólo dejaba pasar la cifra literal de la instrucción.
   * Con «la dosis es 500 mg» autorizaba que **entrara** 500mg, pero seguía
   * denunciando que **saliera** 400mg — y salir es justo lo que el médico
   * acaba de pedir. Corregir una dosis es SUSTITUIRLA.
   *
   * La regla afinada: nombrar una cifra en `mg` autoriza los cambios en `mg`.
   * No autoriza los de `horas` ni los de `días` — que es lo que se quiere
   * proteger cuando alguien pide «más conciso».
   *
   * Y «hazlo más conciso» no nombra ninguna unidad, así que no autoriza nada.
   */
  const unidadesPedidas = new Set([...pedidas.values()].map(v => v.unidad))
  const autorizada = (clave: string, unidad: string) =>
    pedidas.has(clave) || unidadesPedidas.has(unidad)

  const perdidas: string[] = []
  for (const [c, { n, unidad }] of a) {
    const quedan = d.get(c)?.n ?? 0
    if (quedan < n && !autorizada(c, unidad)) perdidas.push(c)
  }

  const aparecidas: string[] = []
  for (const [c, { n, unidad }] of d) {
    const habia = a.get(c)?.n ?? 0
    if (n > habia && !autorizada(c, unidad)) aparecidas.push(c)
  }

  return {
    perdidas,
    aparecidas,
    hayCambioNoPedido: perdidas.length > 0 || aparecidas.length > 0,
  }
}

/**
 * Lo que se le dice al médico. Una frase, sin adornos.
 *
 * Nombra las cifras LITERALES. «Se perdieron datos» no sirve para decidir; «ya
 * no aparece 400mg» sí.
 */
export function loQueSeLlevoPorDelante(c: QueCambio): string | null {
  if (!c.hayCambioNoPedido) return null
  const partes: string[] = []
  if (c.perdidas.length)
    partes.push(`ya no aparece${c.perdidas.length > 1 ? 'n' : ''}: ${c.perdidas.join(', ')}`)
  if (c.aparecidas.length)
    partes.push(`apareció sin que lo pidieras: ${c.aparecidas.join(', ')}`)
  return `La reescritura cambió cifras que no mencionaste — ${partes.join(' · ')}. ` +
    'Revísalo o deshaz el cambio.'
}

export const POR_QUE_LA_INSTRUCCION_ES_LA_LLAVE =
  '«La dosis es 500 mg» autoriza a que 400mg salga y 500mg entre: corregir una ' +
  'dosis es sustituirla, y por eso se autoriza por UNIDAD (mg), no sólo por la ' +
  'cifra literal. No autoriza tocar las horas ni los días. «Hazlo más conciso» ' +
  'no nombra ninguna unidad, así que no autoriza nada.'

export const POR_QUE_NO_REPARA =
  'Volver a meter la cifra que se cayó sería reescribir una nota clínica por ' +
  'cuenta propia. Se dice qué se perdió; decide el médico.'

export const LO_QUE_DICE_LA_EVIDENCIA =
  'Sobre 62 811 pares borrador→nota final (AMIA 2026), los médicos eliminaron ' +
  '216 199 oraciones y reemplazaron 52 542. Un modelo que reescribe texto ' +
  'clínico cambia mucho más de lo que se le pidió.'
