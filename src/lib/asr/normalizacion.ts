/**
 * NORMALIZACIÓN DE CIFRAS Y UNIDADES — etapa 4 del pipeline clínico de dictado.
 *
 * «norepinefrina cero punto quince microgramos por kilo por minuto»
 *      → «norepinefrina 0.15 mcg/kg/min»
 *
 * ── POR QUÉ NO SE REUSA EL NORMALIZADOR DEL BENCHMARK ────────────────────────
 *
 * `benchmark-metricas.ts` ya convierte números y unidades, y está calibrado al
 * 100 % contra el corpus. Pero es un normalizador **de comparación**: baja a
 * minúsculas, quita acentos y borra la puntuación para poder cotejar dos textos.
 * Eso sirve para medir y arruinaría una nota clínica.
 *
 * Éste es un normalizador **de producción**: reescribe únicamente los tramos que
 * son una cifra o una unidad y deja el resto del texto byte a byte como estaba —
 * acentos, mayúsculas, comas y puntos incluidos. Son dos trabajos distintos con
 * el mismo nombre; mantenerlos separados evita romper un instrumento calibrado
 * para arreglar una nota.
 *
 * ── LAS TRES REGLAS QUE LE IMPIDEN INVENTAR ──────────────────────────────────
 *
 * 1. **«un» y «una» no se convierten a solas.** Son artículos mucho más a menudo
 *    que números: «un paciente» no es «1 paciente». Sólo cuentan cuando les
 *    sigue una unidad («un gramo» → «1 g»).
 *
 * 2. **Dos números del mismo rango no se suman.** Cuando alguien dicta
 *    «uno dos cero sobre ocho cero» está deletreando 120/80, y sumar daría 3.
 *    Al ver dos unidades seguidas se cierra el número y se empieza otro: sale
 *    «1 2 0 sobre 8 0», que es exactamente lo que se dijo.
 *
 * 3. **Una unidad hablada sólo se abrevia detrás de una cifra.** «pesa muchos
 *    kilos» se queda como está; «ochenta kilos» se vuelve «80 kg».
 *
 * Lo que no encaja en ninguna regla **se deja tal cual**. Este módulo nunca
 * completa un número ausente ni elige entre dos lecturas posibles.
 *
 * Módulo PURO.
 */

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29,
  // «veintiún gramos», «veintiuna horas»: apócope y femenino de 21. No son
  // ambiguas como «un» — nadie las usa de artículo.
  veintiun: 21, veintiuna: 21,
}
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90,
}
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900,
  // Formas femeninas: «tres mil doscientas revoluciones».
  doscientas: 200, trescientas: 300, cuatrocientas: 400, quinientas: 500,
  seiscientas: 600, setecientas: 700, ochocientas: 800, novecientas: 900,
}
/** Sólo estas tres palabras convierten cuando van solas: ver regla 1. */
const AMBIGUAS = new Set(['un', 'una', 'uno'])

const sinAcento = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Categoría de una palabra dentro de un número hablado. */
type Rango = 'unidad' | 'decena' | 'centena' | 'mil' | null
function rango(p: string): Rango {
  const w = sinAcento(p)
  if (w === 'mil') return 'mil'
  if (CENTENAS[w] !== undefined) return 'centena'
  if (DECENAS[w] !== undefined) return 'decena'
  if (UNIDADES[w] !== undefined) return 'unidad'
  return null
}
function valor(p: string): number {
  const w = sinAcento(p)
  return CENTENAS[w] ?? DECENAS[w] ?? UNIDADES[w] ?? 0
}

import { UNIDADES_CANONICAS } from './politica-critica'

export interface CambioNormalizacion {
  antes: string
  despues: string
  tipo: 'cifra' | 'unidad'
}

export interface ResultadoNormalizacion {
  texto: string
  cambios: CambioNormalizacion[]
}

/* ════════════════════════════════════════════════════════════════════════
   Cifras
   ════════════════════════════════════════════════════════════════════════ */

/** Palabras y espacios, conservando las posiciones. */
function trocear(texto: string): string[] {
  return texto.split(/(\s+)/)
}

/**
 * Convierte los números escritos con letra a dígitos, sin tocar nada más.
 *
 * @param texto el transcript.
 * @returns el texto con las cifras en dígitos y la lista de tramos convertidos.
 */
export function normalizarCifras(texto: string): ResultadoNormalizacion {
  const partes = trocear(texto)
  const cambios: CambioNormalizacion[] = []
  const salida: string[] = []

  let i = 0
  while (i < partes.length) {
    const p = partes[i]
    if (/^\s*$/.test(p) || rango(limpiar(p)) === null) { salida.push(p); i++; continue }

    /**
     * «por ciento» es una unidad, no un número.
     *
     * Sin esta guarda, «veinte por ciento» salía «20 por 100»: el lector de
     * números se comía el «ciento» como CENTENAS antes de que la etapa de
     * unidades pudiera verlo. Lo encontró la regresión sobre el corpus, no un
     * test escrito a mano.
     */
    if (['cien', 'ciento'].includes(sinAcento(limpiar(p)))) {
      const previa = salida.map(limpiar).filter(Boolean).pop()
      if (previa && sinAcento(previa) === 'por') { salida.push(p); i++; continue }
    }

    // Arranca un número: consumir el tramo más largo que sea UN solo número.
    const { fin, num, decimal } = leerNumero(partes, i)
    const tramo = partes.slice(i, fin).join('')
    // El signo de puntuación final del tramo («ocho horas,») no forma parte del
    // número y tiene que sobrevivir intacto.
    const cola = tramo.match(/[^\p{L}\p{N}]*$/u)?.[0] ?? ''
    const cuerpo = tramo.slice(0, tramo.length - cola.length)

    if (num === null) { salida.push(...partes.slice(i, fin)); i = fin; continue }

    const digitos = decimal !== null ? `${num}.${decimal}` : String(num)
    salida.push(digitos + cola)
    cambios.push({ antes: cuerpo, despues: digitos, tipo: 'cifra' })
    i = fin
  }

  return { texto: salida.join(''), cambios }
}

const limpiar = (p: string) => p.replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Lee UN número hablado a partir de `desde`.
 *
 * Para en cuanto la siguiente palabra no puede seguir al número que lleva: dos
 * unidades seguidas no se suman (regla 2), y una decena no sigue a otra decena.
 */
function leerNumero(partes: string[], desde: number): { fin: number; num: number | null; decimal: string | null } {
  let acc: number | null = null
  let ultimo: Rango = null
  let i = desde
  let decimal: string | null = null
  /**
   * ¿La unidad que viene se enganchó a la decena con una «y»?
   *
   * En español una unidad detrás de una decena EXIGE la «y»: «cincuenta y dos»
   * es 52, «cincuenta dos» no es nada — son dos números distintos.
   *
   * Sin esta distinción, «metformina ochocientos cincuenta, dos veces al día»
   * salía «metformina 852 veces al día»: la dosis desaparecía y la frecuencia se
   * volvía absurda, en silencio y dentro de una nota clínica. Lo encontró una
   * prueba con frases de consulta real; el corpus de UCI no lo veía porque ahí
   * las pautas se dictan con la unidad pegada.
   */
  let unidoPorY = false

  const siguientePalabra = (j: number): { idx: number; w: string } | null => {
    for (let k = j; k < partes.length; k++) {
      if (/^\s*$/.test(partes[k])) continue
      return { idx: k, w: limpiar(partes[k]) }
    }
    return null
  }

  while (i < partes.length) {
    if (/^\s*$/.test(partes[i])) { i++; continue }
    const w = limpiar(partes[i])
    const r = rango(w)

    // «y» sólo une decena con unidad: «cuarenta y ocho».
    if (sinAcento(w) === 'y' && ultimo === 'decena') {
      const sig = siguientePalabra(i + 1)
      if (sig && rango(sig.w) === 'unidad') { unidoPorY = true; i = sig.idx; continue }
      break
    }

    /**
     * «punto» — y «coma», que en México es EL separador decimal al dictar.
     *
     * ── LO QUE MEDÍ (6-ago-2026, sonda de pares críticos del §B5) ──────────
     *
     *     «dos coma cinco miligramos»  →  «2 coma 5 mg»
     *
     * El 2 se queda solo delante de la unidad, y el 5 cae fuera como texto. El
     * motor de dosis que lee eso ve **2 mg donde el médico dijo 2,5 mg**. No
     * salta ninguna alarma: 2 mg es una dosis plausible, igual que lo era el
     * 7.30 del pH.
     *
     * Se trata igual que «punto» porque es la misma función gramatical. La
     * guarda `acc !== null` + «detrás viene un número» es lo que impide que
     * «el paciente está en coma» se convierta en nada: sin número delante y
     * sin número detrás, no entra aquí.
     */
    if ((sinAcento(w) === 'punto' || sinAcento(w) === 'coma') && acc !== null) {
      const sig = siguientePalabra(i + 1)
      if (!sig || rango(sig.w) === null || rango(sig.w) === 'mil') break
      /**
       * ── LA «Y» DEL DECIMAL, QUE FALTABA (4-ago-2026) ──────────────────────
       *
       * La parte ENTERA sí une decena y unidad con «y» (arriba, `unidoPorY`).
       * La decimal no lo hacía, y ésa es la forma **natural** de dictar en
       * español:
       *
       *     «pH siete punto treinta y cinco»      →  pH 7.30 y 5     (era 7.35)
       *     «potasio tres punto cuarenta y dos»   →  3.40 y 2        (era 3.42)
       *     «norepinefrina cero punto treinta y cinco» → 0.30 y 5    (era 0.35)
       *
       * El «y» rompía el bucle, se quedaba el 30 y el 5 se caía fuera como
       * texto suelto. **Y el valor que queda es plausible**: 7.30 es un pH
       * posible y 0.30 una dosis posible de vasopresor, así que nadie lo nota.
       * El guardián tampoco: sólo vigila cifras que DESAPARECEN, y aquí la que
       * sobra aparece.
       *
       * Es gramática del español, no criterio clínico: treinta y cinco es 35.
       */
      const dec: string[] = []
      let j = sig.idx
      let esperaUnidadTrasY = false
      while (j < partes.length) {
        if (/^\s*$/.test(partes[j])) { j++; continue }
        const pal = limpiar(partes[j])
        // «y» entre una decena ya leída y su unidad: se compone, no se corta.
        if (sinAcento(pal) === 'y' && dec.length > 0 && !esperaUnidadTrasY) {
          const sigY = siguientePalabra(j + 1)
          if (sigY && rango(sigY.w) === 'unidad' && Number(dec[dec.length - 1]) % 10 === 0) {
            esperaUnidadTrasY = true
            j = sigY.idx
            dec[dec.length - 1] = String(Number(dec[dec.length - 1]) + Number(valor(limpiar(partes[j]))))
            j++
            continue
          }
          break
        }
        const rr = rango(pal)
        if (rr !== 'unidad' && rr !== 'decena') break
        dec.push(String(valor(pal))); j++
      }
      decimal = dec.join('')
      i = j
      break
    }

    if (r === null) break

    if (acc === null) {
      // Regla 1: «un/una/uno» a solas no es número; se acepta sólo si detrás
      // viene una unidad de medida.
      if (AMBIGUAS.has(sinAcento(w))) {
        const sig = siguientePalabra(i + 1)
        // Cuenta como número si le sigue una unidad («un gramo»), si le sigue
        // otra cifra («uno dos cero», alguien deletreando 120), o si abre un
        // decimal («uno punto ocho»). En cualquier otro caso es un artículo y se
        // deja en paz.
        //
        // El caso del decimal lo encontró la regresión sobre el corpus: «calcio
        // ionizado de uno punto cero dos» salía «uno punto 0 2».
        const abreDecimal = !!sig && sinAcento(sig.w) === 'punto'
          && rango(siguientePalabra(sig.idx + 1)?.w ?? '') !== null
        /**
         * Detrás de otra cifra sólo cuenta cuando se están DELETREANDO dígitos
         * («uno dos cero» = 120) y la palabra es «uno», no «un».
         *
         * «El dolor es como un diez de diez» salía «como 1 10 de 10»: «un» ahí
         * es un artículo, y en español «un» apocopado casi nunca introduce una
         * cifra suelta. Aceptar cualquier número detrás convertía en dígito todo
         * artículo que precediera a una cantidad — y en una consulta eso pasa en
         * cada frase.
         */
        const deletreando = !!sig && sinAcento(w) === 'uno' && rango(sig.w) === 'unidad'
        const esNumero = !!sig && (esUnidadHablada(sig.w) || deletreando || abreDecimal)
        if (!esNumero) return { fin: i + 1, num: null, decimal: null }
      }
      acc = r === 'mil' ? 1000 : valor(w)
      ultimo = r
      i++
      continue
    }

    // Regla 2: no se suman dos piezas del mismo rango ni una mayor tras una menor.
    if (r === 'mil') { acc = acc * 1000; ultimo = 'mil'; i++; continue }
    const orden: Record<Exclude<Rango, null>, number> = { mil: 3, centena: 2, decena: 1, unidad: 0 }
    if (ultimo !== null && ultimo !== 'mil' && orden[r] >= orden[ultimo]) break
    // Unidad detrás de decena SIN «y»: no compone. Son dos números.
    if (r === 'unidad' && ultimo === 'decena' && !unidoPorY) break
    acc += valor(w)
    unidoPorY = false
    ultimo = r
    i++
  }

  // Recupera el espacio final para no comerse la separación.
  while (i > desde && /^\s*$/.test(partes[i - 1])) i--
  return { fin: i, num: acc, decimal }
}

/* ════════════════════════════════════════════════════════════════════════
   Unidades
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Formas habladas → símbolo canónico.
 *
 * Los símbolos son los de `UNIDADES_CANONICAS` de la política del Dr.
 * Deliberadamente NO incluye `mg`↔`mcg` ni nada que pueda confundir dos
 * unidades: aquí sólo se abrevia lo que se dijo con todas sus letras.
 */
export const UNIDADES_HABLADAS: Readonly<Record<string, readonly string[]>> = {
  'mcg/kg/min': ['microgramos por kilogramo por minuto', 'microgramos por kilo por minuto',
    'microgramo por kilo por minuto', 'microgramos kilo minuto'],
  'mcg/kg/h': ['microgramos por kilogramo por hora', 'microgramos por kilo por hora'],
  'mg/kg/h': ['miligramos por kilogramo por hora', 'miligramos por kilo por hora'],
  'mL/kg/h': ['mililitros por kilogramo por hora', 'mililitros por kilo por hora'],
  'L/min/m2': ['litros por minuto por metro cuadrado'],
  'mL/cmH2O': ['mililitros por centimetro de agua', 'mililitros por centímetro de agua'],
  'mg/kg': ['miligramos por kilogramo', 'miligramos por kilo'],
  'mL/kg': ['mililitros por kilogramo', 'mililitros por kilo'],
  'mL/min': ['mililitros por minuto', 'mililitro por minuto'],
  'mL/h': ['mililitros por hora', 'mililitro por hora'],
  'L/min': ['litros por minuto', 'litro por minuto'],
  'mg/dL': ['miligramos por decilitro'],
  'g/dL': ['gramos por decilitro'],
  'mmol/L': ['milimoles por litro', 'milimol por litro', 'milímoles por litro'],
  'mEq/L': ['miliequivalentes por litro'],
  'ng/mL': ['nanogramos por mililitro'],
  'pg/mL': ['picogramos por mililitro'],
  'mcg/h': ['microgramos por hora'],
  'U/min': ['unidades por minuto'],
  '/uL': ['por microlitro'],
  mmHg: ['milimetros de mercurio', 'milímetros de mercurio'],
  cmH2O: ['centimetros de agua', 'centímetros de agua'],
  lpm: ['latidos por minuto'],
  rpm: ['respiraciones por minuto', 'revoluciones por minuto'],
  '°C': ['grados centigrados', 'grados centígrados', 'grados celsius'],
  '%': ['por ciento'],
  kg: ['kilogramos', 'kilogramo', 'kilos', 'kilo'],
  mL: ['mililitros', 'mililitro'],
  mm: ['milimetros', 'milímetros', 'milimetro', 'milímetro'],
  mcg: ['microgramos', 'microgramo'],
  mg: ['miligramos', 'miligramo'],
  g: ['gramos', 'gramo'],
  L: ['litros', 'litro'],
  UI: ['unidades internacionales'],
  U: ['unidades', 'unidad'],
}

/** Pares (forma hablada normalizada, símbolo), de la más larga a la más corta. */
const PARES_UNIDAD: readonly [string, string][] = Object.entries(UNIDADES_HABLADAS)
  .flatMap(([simbolo, formas]) => formas.map(f => [sinAcento(f), simbolo] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length)

/** ¿Esta palabra puede abrir una forma hablada de unidad? */
function esUnidadHablada(palabra: string): boolean {
  const w = sinAcento(palabra)
  return PARES_UNIDAD.some(([forma]) => forma === w || forma.startsWith(w + ' '))
}

/**
 * Abrevia las unidades habladas que van **detrás de una cifra**.
 *
 * @param texto el transcript, idealmente ya con `normalizarCifras` aplicado.
 */
export function normalizarUnidades(texto: string): ResultadoNormalizacion {
  const cambios: CambioNormalizacion[] = []
  let out = ''
  let i = 0

  while (i < texto.length) {
    // ¿Venimos de una cifra? (dígito, quizá con espacios en medio)
    const previo = out.replace(/\s+$/, '')
    const trasCifra = /\d$/.test(previo) && /^\s/.test(texto.slice(i - 1, i) || ' ')

    let casado: [string, string] | null = null
    if (trasCifra) {
      const resto = sinAcento(texto.slice(i))
      for (const [forma, simbolo] of PARES_UNIDAD) {
        if (!resto.startsWith(forma)) continue
        const sig = texto[i + forma.length] ?? ' '
        if (/[\p{L}\p{N}]/u.test(sig)) continue      // «gramos» no casa dentro de «gramosos»
        casado = [forma, simbolo]
        break
      }
    }

    if (casado) {
      const [forma, simbolo] = casado
      cambios.push({ antes: texto.slice(i, i + forma.length), despues: simbolo, tipo: 'unidad' })
      out += simbolo
      i += forma.length
    } else {
      out += texto[i]
      i++
    }
  }

  // Una unidad que empieza por barra se pega a su cifra («48000 /uL»), y el
  // porcentaje también: «20 %» no se escribe así.
  return { texto: out.replace(/(\d)\s+\//g, '$1/').replace(/(\d)\s+%/g, '$1%'), cambios }
}

/* ════════════════════════════════════════════════════════════════════════
   Las dos juntas
   ════════════════════════════════════════════════════════════════════════ */

/**
 * LAS MITADES HABLADAS — «medio gramo», «un gramo y medio».
 *
 * ── LO QUE MEDÍ (6-ago-2026, sonda de pares críticos del §B5) ────────────────
 *
 *     «medio gramo»        →  «medio gramo»   (ni una cifra: el dato se pierde)
 *     «un gramo y medio»   →  «1 g y medio»   (el motor lee 1 g: UN TERCIO MENOS)
 *
 * El segundo es el peligroso. No pierde el dato: lo **reduce a un valor
 * plausible**. Un gramo es una dosis creíble, así que ni el médico al releer ni
 * ningún guardián de cifras desaparecidas lo nota. Es el mismo modo de fallo que
 * el pH «7.30 y 5».
 *
 * ── POR QUÉ SÓLO CON UNIDADES DE DOSIS DETRÁS ────────────────────────────────
 *
 * «medio» y «media» significan otras cosas: «a medio camino», «la media de la
 * serie», «media hora». La conversión sólo se hace cuando detrás viene una
 * unidad de FÁRMACO — donde «medio» no puede significar otra cosa. «Media hora»
 * se queda como está a propósito: convertirla a «0.5 horas» no gana nada y
 * ensucia la nota.
 */
const UNIDAD_DE_DOSIS =
  '(gramos?|miligramos?|microgramos?|litros?|mililitros?|tabletas?|comprimidos?|c[aá]psulas?|ampolletas?|ampollas?|cucharad(?:as?|itas?))'

const MEDIO_DELANTE = new RegExp(`\\b(medi[oa])\\s+${UNIDAD_DE_DOSIS}\\b`, 'giu')
const Y_MEDIO_DETRAS = new RegExp(`(\\d+)\\s+(\\S+)\\s+y\\s+medi[oa]\\b`, 'giu')

/** «medio gramo» → «cero punto cinco gramo», para que el lector de cifras lo vea. */
function mitadesHabladas(texto: string): { texto: string; cambios: CambioNormalizacion[] } {
  const cambios: CambioNormalizacion[] = []
  const out = texto.replace(MEDIO_DELANTE, (todo, _m, unidad) => {
    cambios.push({ antes: todo, despues: `cero punto cinco ${unidad}`, tipo: 'cifra' })
    return `cero punto cinco ${unidad}`
  })
  return { texto: out, cambios }
}

/**
 * «1 g y medio» → «1.5 g». Va DESPUÉS de las unidades porque hasta entonces no
 * hay un dígito y una abreviatura que reconocer.
 */
function yMedioDetras(texto: string): { texto: string; cambios: CambioNormalizacion[] } {
  const cambios: CambioNormalizacion[] = []
  const out = texto.replace(Y_MEDIO_DETRAS, (todo, n: string, unidad: string) => {
    // Sólo si lo de en medio es una unidad canónica: «2 veces y media» no es 2.5.
    if (!UNIDADES_CANONICAS.includes(unidad)) return todo
    const nuevo = `${n}.5 ${unidad}`
    cambios.push({ antes: todo, despues: nuevo, tipo: 'cifra' })
    return nuevo
  })
  return { texto: out, cambios }
}

/**
 * Cifras y luego unidades. El orden importa: la unidad sólo se abrevia detrás de
 * un dígito, y el dígito lo produce la etapa anterior.
 */
export function normalizar(texto: string): ResultadoNormalizacion {
  const m = mitadesHabladas(texto)
  const a = normalizarCifras(m.texto)
  const b = normalizarUnidades(a.texto)
  const y = yMedioDetras(b.texto)
  return { texto: y.texto, cambios: [...m.cambios, ...a.cambios, ...b.cambios, ...y.cambios] }
}

export const POR_QUE_NO_INVENTA =
  'La normalización reescribe lo que se dijo, no lo interpreta: «un» y «una» sólo ' +
  'cuentan como número si les sigue una unidad, dos cifras del mismo rango no se ' +
  'suman (quien dicta «uno dos cero» está deletreando 120), y una unidad hablada ' +
  'sólo se abrevia detrás de una cifra. Lo que no encaja se deja tal cual.'
