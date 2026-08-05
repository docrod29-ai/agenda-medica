/**
 * TRINQUETE DE VOZ — el corpus del Dr., corriendo en CI.
 *
 * ── LO QUE FALTABA, Y POR QUÉ ────────────────────────────────────────────────
 *
 * La auditoría del charter lo declaraba: **ningún trinquete de voz corría en
 * CI**. Los scripts existían y no estaban en el flujo, y la razón no era pereza:
 * el corpus vive en el disco del Dr., y un guardián que en CI no encuentra sus
 * datos **pasa en verde sin medir nada**, que es peor que no tenerlo.
 *
 * La salida estaba delante todo el tiempo: **la regresión de texto no necesita
 * el audio**. Necesita las frases. Y las 6 000 frases pesan 1.2 MB — los 429 MB
 * son los mp3, que se quedan fuera.
 *
 * ── LAS DOS PREGUNTAS QUE CONTESTA ───────────────────────────────────────────
 *
 * 1. **¿El pipeline DAÑA un texto que ya está bien?** Se le pasa la forma
 *    escrita y tiene que salir igual. Es la prueba anti-sobreajuste: este corpus
 *    no se usó para calibrar nada.
 *
 * 2. **¿Sobrevive el término clínico al pasar de hablado a escrito?** Se le pasa
 *    la forma HABLADA («cero punto cero tres microgramos por kilo por minuto») y
 *    se comprueba que el término clave siga ahí. Es la métrica que manda: un WER
 *    del 8 % con la dosis intacta es un buen resultado, y uno del 2 % con «mcg»
 *    convertido en «mg» es un desastre que el WER no ve.
 *
 * ── POR QUÉ SON TOPES CONGELADOS Y NO UMBRALES BONITOS ───────────────────────
 *
 * Los números que se fijan aquí son **los medidos el 4-ago-2026**, no una meta.
 * Sólo pueden mejorar: si un cambio los baja, CI lo dice antes de que llegue a
 * una consulta. Es el mismo trato que el trinquete de lint.
 *
 * Este guardián habría cazado solo el fallo del balance hídrico negativo, que se
 * encontró a mano ese mismo día (REG-141).
 *
 * ── LO QUE NO MIDE, Y HAY QUE DECIRLO ────────────────────────────────────────
 *
 * **No mide lo que el motor OYE.** Eso exige audio y se paga; vive en
 * `scripts/asr-benchmark-audio.ts` y se corre a mano. Aquí sólo se mide lo que
 * el pipeline hace con un texto ya reconocido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { procesarTranscript } from '@/lib/asr/pipeline'
import { terminoPresente, evaluable } from '@/lib/uci/benchmark-metricas'

/**
 * Lo medido el 4-ago-2026 sobre las 6 000 frases. **Sólo puede mejorar.**
 */
const CONGELADO = {
  frases: 6000,
  /** Frases correctas que el pipeline deja intactas. */
  intactasMin: 5761,
  /** Términos clave que el pipeline pierde partiendo del texto escrito. CERO. */
  perdidosMax: 0,
  /** Frases correctas que piden confirmación sin motivo. CERO desde REG-141. */
  preguntanMax: 0,
  /** Términos clave que sobreviven partiendo de la forma HABLADA. */
  sobrevivenMin: 4016,
} as const

interface Fila {
  phrase_id: string
  canonical_text: string
  tts_text: string
  key_terms: string
  category: string
}

/** Lee el CSV respetando las comillas. Sin dependencia nueva por un fixture. */
function leerCsv(texto: string): Fila[] {
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const cab = filas.shift()!
  return filas.filter(f => f.length === cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i]])) as unknown as Fila)
}

const FILAS = leerCsv(readFileSync(join(process.cwd(), 'fixtures/voz/corpus-v3-6000.csv'), 'utf8'))

/** Se calcula una vez: 6 000 frases por dos caminos no se repiten por prueba. */
const medida = (() => {
  let intactas = 0, perdidos = 0, preguntan = 0, evaluados = 0, sobreviven = 0
  const dañadas: string[] = []
  const perdidosDetalle: string[] = []
  for (const f of FILAS) {
    const r = procesarTranscript(f.canonical_text)
    if (r.texto === f.canonical_text) intactas++
    else if (dañadas.length < 5) dañadas.push(`${f.phrase_id}: «${f.canonical_text}» → «${r.texto}»`)
    if (r.requiereConfirmacion) preguntan++

    for (const t of (f.key_terms || '').split('|').filter(Boolean)) {
      if (!evaluable(t, f.canonical_text)) continue
      if (!terminoPresente(t, r.texto).ok) {
        perdidos++
        if (perdidosDetalle.length < 5) perdidosDetalle.push(`${f.phrase_id}: perdió «${t}»`)
      }
    }

    if (f.tts_text && f.tts_text !== f.canonical_text) {
      const hablado = procesarTranscript(f.tts_text).texto
      for (const t of (f.key_terms || '').split('|').filter(Boolean)) {
        if (!evaluable(t, f.canonical_text)) continue
        evaluados++
        if (terminoPresente(t, hablado).ok) sobreviven++
      }
    }
  }
  return { intactas, perdidos, preguntan, evaluados, sobreviven, dañadas, perdidosDetalle }
})()

describe('EL CORPUS ESTÁ COMPLETO — un guardián que no encuentra sus datos pasa vacío', () => {
  it(`hay ${CONGELADO.frases} frases`, () => {
    expect(FILAS.length).toBe(CONGELADO.frases)
  })

  it('y traen las dos formas: la escrita y la hablada', () => {
    // Sin `tts_text` la mitad de este trinquete no mediría nada y pasaría igual.
    expect(FILAS.filter(f => f.tts_text?.trim()).length).toBeGreaterThan(5000)
    expect(medida.evaluados).toBeGreaterThan(5000)
  })
})

describe('1 · EL PIPELINE NO DAÑA UN TEXTO QUE YA ESTÁ BIEN', () => {
  it(`deja intactas al menos ${CONGELADO.intactasMin} de ${CONGELADO.frases}`, () => {
    expect(medida.intactas, `frases dañadas de ejemplo:\n${medida.dañadas.join('\n')}`)
      .toBeGreaterThanOrEqual(CONGELADO.intactasMin)
  })

  it('y no pierde NINGÚN término clave — el criterio es cero, no un porcentaje', () => {
    /**
     * Sobre un corpus que se controla entero, perder un fármaco o una dosis no
     * es una tasa aceptable: es un fallo.
     */
    expect(medida.perdidos, medida.perdidosDetalle.join('\n')).toBeLessThanOrEqual(CONGELADO.perdidosMax)
  })

  it('ni pide confirmación sobre una frase correcta', () => {
    /**
     * Aquí vivían las 25 frases de balance hídrico negativo (REG-141): el
     * detector no reconocía el signo y creía que faltaba la dosis. Un aviso que
     * salta donde no debe se acaba ignorando, y con él los que sí importan.
     */
    expect(medida.preguntan).toBeLessThanOrEqual(CONGELADO.preguntanMax)
  })
})

describe('2 · EL TÉRMINO CLÍNICO SOBREVIVE AL PASAR DE HABLADO A ESCRITO', () => {
  it(`sobreviven al menos ${CONGELADO.sobrevivenMin} términos`, () => {
    /**
     * Es la métrica que manda. El WER no la ve: en una frase de doce palabras,
     * «mcg» convertido en «mg» pesa lo mismo que un artículo — y es un factor de
     * mil en la dosis.
     */
    expect(medida.sobreviven).toBeGreaterThanOrEqual(CONGELADO.sobrevivenMin)
  })
})

describe('LO QUE ESTE TRINQUETE NO MIDE', () => {
  it('no mide lo que el motor OYE, y está dicho', () => {
    /**
     * Medir el reconocedor exige gastar audio. Vive en
     * `scripts/asr-benchmark-audio.ts`, se corre a mano y guarda las
     * transcripciones para pagarse una sola vez.
     */
    const yo = readFileSync(join(process.cwd(), 'src/__tests__/trinquete-de-voz.test.ts'), 'utf8')
    expect(yo).toMatch(/No mide lo que el motor OYE/)
  })
})
