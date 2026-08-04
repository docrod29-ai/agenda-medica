/**
 * LA CONSULTA LARGA SE QUEDABA SIN SEGUNDA OPINIÓN.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `verificar-nota` corta en 12 000 caracteres. Pasado ese punto **no revisa
 * nada**: devuelve `incompleto: true` y le dice al médico que la revise él.
 *
 * Eso es honesto —lo puso una auditoría anterior, y era una mejora clara sobre
 * responder `{"hallazgos":[]}`, que se lee como «revisado y limpio»— pero deja
 * un hueco molesto: **la consulta larga es la complicada**, y es justo la que se
 * queda sin red de seguridad. Un dictado de 20 minutos ronda los 20 000
 * caracteres; o sea que el tope no es un caso raro.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * Parte la **transcripción** en tramos que sí caben. La nota va entera en cada
 * llamada: lo que se trocea es lo que se lee contra ella, no la nota.
 *
 * Y los tramos **se solapan**. Es el mismo problema del audio: una indicación a
 * caballo de la frontera —«…meropenem dos gramos / cada ocho horas…»— partida en
 * seco deja media dosis en cada lado, y el revisor no puede ver que falta lo que
 * no está.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No corta por la mitad de una palabra: busca hacia atrás un final de frase, y
 * si no lo encuentra, un espacio. Y **no promete más de lo que revisa**: el tope
 * de tramos está acotado, y quien llama sabe cuántos hacían falta y cuántos se
 * hicieron.
 *
 * Módulo PURO.
 */

/**
 * Cuántos tramos como máximo.
 *
 * Cada tramo es una llamada de pago al modelo. Tres cubren ~34 000 caracteres
 * útiles —del orden de 35 minutos de dictado— sin que una consulta sola se coma
 * el saldo del consultorio. Más allá, se dice que no se revisó entero en vez de
 * seguir gastando en silencio.
 */
export const MAX_TRAMOS = 3

/**
 * Cuánto se repite entre un tramo y el siguiente.
 *
 * Suficiente para que una indicación completa —fármaco, dosis, vía, intervalo—
 * quepa entera a un lado de la costura.
 */
export const SOLAPE = 600

export interface Segmentacion {
  tramos: string[]
  /** Cuántos tramos harían falta para cubrirlo TODO. */
  tramosNecesarios: number
  /** ¿Se quedó texto sin revisar? */
  truncado: boolean
  /** Caracteres cubiertos por los tramos devueltos, sin contar el solape. */
  cubiertos: number
  total: number
}

/** Busca hacia atrás un corte limpio: final de frase, y si no, un espacio. */
function cortePrevio(texto: string, hasta: number, minimo: number): number {
  for (const re of [/[.!?…]\s/g, /\s/g]) {
    let mejor = -1
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(texto)) !== null) {
      if (m.index >= hasta) break
      if (m.index > minimo) mejor = m.index + m[0].length
    }
    if (mejor > 0) return mejor
  }
  return hasta
}

/**
 * Parte `texto` en tramos de como mucho `tope` caracteres, solapados.
 *
 * Con texto que ya cabe devuelve un solo tramo y `truncado: false` — o sea que
 * el camino corto no cambia en nada.
 */
export function segmentarParaRevision(texto: string, tope: number, maxTramos = MAX_TRAMOS): Segmentacion {
  const t = texto ?? ''
  if (t.length <= tope) {
    return { tramos: t ? [t] : [], tramosNecesarios: t ? 1 : 0, truncado: false, cubiertos: t.length, total: t.length }
  }

  // Cada tramo nuevo aporta `tope - SOLAPE` caracteres de texto no visto.
  const avance = Math.max(1, tope - SOLAPE)
  const tramosNecesarios = Math.ceil((t.length - tope) / avance) + 1

  const tramos: string[] = []
  let inicio = 0
  while (inicio < t.length && tramos.length < maxTramos) {
    const finBruto = Math.min(inicio + tope, t.length)
    const fin = finBruto === t.length ? finBruto : cortePrevio(t, finBruto, inicio + Math.floor(tope / 2))
    tramos.push(t.slice(inicio, fin))
    if (fin >= t.length) break
    inicio = Math.max(inicio + 1, fin - SOLAPE)
  }

  const cubiertos = tramos.length ? Math.min(t.length, inicio + tramos[tramos.length - 1].length) : 0
  return {
    tramos,
    tramosNecesarios,
    truncado: tramosNecesarios > maxTramos,
    cubiertos,
    total: t.length,
  }
}

export interface HallazgoBase {
  severidad?: string
  tema?: string
  problema?: string
  sugerencia?: string
}

/**
 * Junta los hallazgos de todos los tramos sin repetir.
 *
 * El solape hace que un problema en la costura salga **dos veces**, con las
 * mismas palabras o casi. Enseñarlo repetido haría dudar de la lista entera.
 */
export function unirHallazgos<T extends HallazgoBase>(porTramo: readonly T[][]): T[] {
  const out: T[] = []
  const vistos = new Set<string>()
  for (const lista of porTramo) {
    for (const h of lista ?? []) {
      const llave = [h.severidad, h.tema, h.problema]
        .map(x => String(x ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim())
        .join('|')
      if (vistos.has(llave)) continue
      vistos.add(llave)
      out.push(h)
    }
  }
  return out
}

export const POR_QUE_SE_SOLAPA =
  'Una indicación a caballo de la frontera —«meropenem dos gramos / cada ocho ' +
  'horas»— partida en seco deja media dosis en cada lado, y el revisor no puede ' +
  'ver que falta lo que no está.'

export const POR_QUE_HAY_TOPE_DE_TRAMOS =
  'Cada tramo es una llamada de pago. Con un tope acotado, una consulta sola no ' +
  'se come el saldo del consultorio; y si no cabe, se dice que no se revisó ' +
  'entero en vez de seguir gastando en silencio.'
