/**
 * QUÉ PALABRA SUSTITUYÓ A CUÁL, AUNQUE EL TEXTO CAMBIE DE LARGO.
 *
 * ── EL CUELLO DE BOTELLA, MEDIDO (5-ago-2026) ────────────────────────────────
 *
 * `paresDeUnaNota` sólo aprendía cuando lo oído y lo corregido tenían **el mismo
 * número de palabras**. Sobre el corpus del Dr.:
 *
 *     mismo largo ....... 363 correcciones  (19,4 %)
 *     largo distinto .. 1 512 correcciones  (80,6 %)  ← se tiraban enteras
 *
 * Cuatro de cada cinco correcciones no enseñaban nada. Y el sesgo de vocabulario
 * —lo único que cambia lo que el motor OYE— se alimenta justo de ahí.
 *
 * ── POR QUÉ ESTABA ASÍ, Y POR QUÉ NO BASTA CON QUITAR EL CANDADO ─────────────
 *
 * El motivo original es correcto y sigue siéndolo: comparando por POSICIÓN, si
 * el médico añade o quita una palabra todas las siguientes se desplazan, y cada
 * «par» sería una coincidencia. Aprender ruido es peor que no aprender.
 *
 * La salida no es aflojar el criterio: es **alinear de verdad**. Con la
 * subsecuencia común más larga se sabe qué palabras se conservaron, y por tanto
 * qué se sustituyó por qué — aunque alrededor se haya insertado o borrado texto.
 *
 * ── SÓLO SUSTITUCIONES 1:1 ───────────────────────────────────────────────────
 *
 * Una palabra que desaparece sin reemplazo es un borrado; una que aparece de la
 * nada es una adición. Ninguna de las dos enseña cómo se oyó mal algo, así que
 * se ignoran. Se emite únicamente el caso inequívoco: **una palabra ocupó el
 * lugar de otra**.
 *
 * Y los tramos donde cambian varias palabras seguidas tampoco se emiten: ahí no
 * se puede saber cuál corresponde a cuál sin adivinar, que es exactamente lo que
 * el candado original quería evitar.
 *
 * Módulo PURO.
 */

export interface Sustitucion {
  /** La palabra que el motor puso. */
  oido: string
  /** La que el médico dejó en su lugar. */
  corregido: string
}

/**
 * La subsecuencia común más larga, por palabras.
 *
 * Devuelve las parejas de índices `(i, j)` que se conservaron. Es el esqueleto
 * sobre el que se leen los cambios.
 *
 * Coste O(n·m). Los textos que llegan aquí son notas de consulta, no libros, y
 * hay un tope por si acaso: sin él, una transcripción larguísima podría bloquear
 * la petición — y guardar la nota importa más que aprender de ella.
 */
const TOPE_PALABRAS = 4000

export function comunes(a: readonly string[], b: readonly string[]): [number, number][] {
  const n = a.length, m = b.length
  if (n === 0 || m === 0 || n > TOPE_PALABRAS || m > TOPE_PALABRAS) return []

  // Matriz de longitudes. Fila a fila para no guardar n·m números a la vez.
  const previa: number[][] = []
  let fila = new Array<number>(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    const nueva = new Array<number>(m + 1).fill(0)
    for (let j = 1; j <= m; j++) {
      nueva[j] = a[i - 1] === b[j - 1]
        ? fila[j - 1] + 1
        : Math.max(fila[j], nueva[j - 1])
    }
    previa.push(fila)
    fila = nueva
  }
  previa.push(fila)

  // Se reconstruye desde el final.
  const pares: [number, number][] = []
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pares.push([i - 1, j - 1]); i--; j-- }
    else if (previa[i - 1][j] >= previa[i][j - 1]) i--
    else j--
  }
  return pares.reverse()
}

/**
 * Las palabras que fueron sustituidas por otras.
 *
 * Se comparan los tramos que quedan ENTRE dos anclas comunes. Un tramo con
 * exactamente una palabra a cada lado es una sustitución limpia; cualquier otra
 * cosa —vacío en un lado, o varias palabras seguidas— se descarta.
 */
export function sustituciones(oido: string, corregido: string): Sustitucion[] {
  const a = String(oido ?? '').trim().split(/\s+/).filter(Boolean)
  const b = String(corregido ?? '').trim().split(/\s+/).filter(Boolean)
  if (!a.length || !b.length) return []

  const anclas = comunes(a, b)
  const out: Sustitucion[] = []

  let ia = 0, ib = 0
  const tramo = (hastaA: number, hastaB: number) => {
    const da = hastaA - ia, db = hastaB - ib
    /**
     * UNA Y UNA. Ni cero (borrado o adición), ni varias por los dos lados (no se
     * sabe cuál corresponde a cuál sin adivinar).
     */
    if (da === 1 && db === 1) { out.push({ oido: a[ia], corregido: b[ib] }); return }

    /**
     * ── UNA PALABRA CORREGIDA, Y ALGO AÑADIDO AL LADO ────────────────────────
     *
     * Es el caso más común en consulta y el que motivó todo esto: se arregla el
     * fármaco y se añade la vía —«meropenen» → «meropenem intravenoso»—. Con la
     * regla estricta no enseñaba nada, porque el tramo es de una contra dos.
     *
     * Aquí NO se adivina: se busca en el tramo una candidata **ortográficamente
     * parecida** a la palabra oída. «meropenen» y «meropenem» difieren en una
     * letra; «meropenen» e «intravenoso» no se parecen en nada. Eso es evidencia
     * comprobable, no una suposición sobre el orden.
     *
     * Y se exige que sea **una sola**: si dos palabras del tramo se parecen, no
     * se puede decidir y se descarta. Es la misma regla de siempre — aprender
     * ruido es peor que no aprender.
     */
    if (da === 1 && db > 1) {
      const oido = a[ia]
      const parecidas = b.slice(ib, hastaB).filter(x => seParecen(oido, x))
      if (parecidas.length === 1) out.push({ oido, corregido: parecidas[0] })
    }
  }

  for (const [pa, pb] of anclas) {
    tramo(pa, pb)
    ia = pa + 1
    ib = pb + 1
  }
  tramo(a.length, b.length)   // el tramo final, después de la última ancla

  return out
}

/**
 * ¿Son dos formas de la misma palabra?
 *
 * Distancia de edición acotada: se acepta una diferencia por cada seis
 * caracteres, con un máximo de dos. «meropenen»/«meropenem» pasa; «amikacina»/
 * «intravenoso» no. Y se exige un largo mínimo, porque entre palabras cortas
 * casi todo se parece.
 */
export function seParecen(a: string, b: string): boolean {
  const x = a.toLowerCase(), y = b.toLowerCase()
  if (x === y) return false                       // no es corrección
  if (x.length < 5 || y.length < 5) return false
  if (Math.abs(x.length - y.length) > 2) return false
  const permitidas = Math.min(2, Math.floor(Math.max(x.length, y.length) / 6))
  if (permitidas < 1) return false
  return distancia(x, y, permitidas) <= permitidas
}

/**
 * Levenshtein con corte temprano: si se pasa del tope, no interesa el valor.
 *
 * Se exporta desde el 27-ago-2026 (H-19): el filtro de identidad del
 * aprendizaje necesita saber si una palabra se PARECE a una parte del nombre
 * del paciente —un apellido mal oído no coincide letra a letra con el
 * expediente—. Es la misma medida que ya usaba `seParecen` aquí; añadir un
 * segundo Levenshtein al módulo de aprendizaje habría sido duplicar la
 * primitiva.
 */
export function distancia(a: string, b: string, tope: number): number {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i]
    let mejor = i
    for (let j = 1; j <= b.length; j++) {
      const v = a[i - 1] === b[j - 1]
        ? fila[j - 1]
        : 1 + Math.min(fila[j - 1], fila[j], nueva[j - 1])
      nueva.push(v)
      if (v < mejor) mejor = v
    }
    if (mejor > tope) return tope + 1
    fila = nueva
  }
  return fila[b.length]
}

export const POR_QUE_NO_SE_ALINEA_POR_POSICION =
  'Comparando por posición, una palabra añadida desplaza todas las siguientes y ' +
  'cada «par» pasa a ser una coincidencia. Por eso antes se descartaba la nota ' +
  'entera cuando cambiaba el largo — y con ella el 80,6 % de las correcciones. ' +
  'La subsecuencia común da las palabras que se conservaron, y entre ellas se lee ' +
  'qué sustituyó a qué sin adivinar nada.'

export const POR_QUE_SOLO_UNA_POR_UNA =
  'Una palabra que desaparece sin reemplazo es un borrado y una que aparece de la ' +
  'nada es una adición: ninguna enseña cómo se oyó mal algo. Y en un tramo donde ' +
  'cambian varias seguidas no se puede saber cuál corresponde a cuál. Se emite ' +
  'sólo el caso inequívoco, porque aprender ruido es peor que no aprender.'
