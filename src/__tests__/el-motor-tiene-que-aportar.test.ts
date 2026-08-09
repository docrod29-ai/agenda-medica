/**
 * UNA MÉTRICA TIENE QUE DISTINGUIR EL PRODUCTO DE SU AUSENCIA — REG-254.
 *
 * ── LA PRUEBA DE PLACEBO, QUE NO EXISTÍA ────────────────────────────────────
 *
 * El equipo rojo refutó la métrica de exactitud de unidades con una frase que no
 * admite discusión: **da lo mismo con el motor conectado que con el motor
 * borrado**. Reproducido aquí sobre las 6 000 frases del corpus:
 *
 *     unidades    n=216    con motor 99,54 %   sin motor 99,54 %   aporte 0,00 pp
 *     números     n=498    con motor 50,60 %   sin motor 47,59 %   aporte 3,01 pp
 *     acrónimos   n=1738   con motor 44,42 %   sin motor 40,39 %   aporte 4,03 pp
 *
 * El 99,54 % de unidades **no mide el producto: mide el comparador**.
 * `canonizar()` traduce «microgramos por kilo por minuto» a `mcg/kg/min` por su
 * cuenta, así que el término «sobrevive» tanto si el pipeline lo tocó como si
 * no. Publicar ese número como desempeño sería publicar un adorno.
 *
 * ── POR QUÉ ESTO ES UNA PRUEBA Y NO UNA NOTA AL PIE ─────────────────────────
 *
 * Porque el charter pide cifras **defendibles**, y una cifra que no distingue
 * «producto» de «sin producto» no defiende nada: la produce igual un competidor
 * que no haya escrito una línea de código.
 *
 * La ablación —medir con y sin— es barata, es determinista, y es justo lo que
 * **ninguno** de los productos del mercado publica. Ahí está el foso: no en
 * tener el número más alto, sino en ser el único que enseña cuánto de ese
 * número es suyo.
 *
 * ── LO QUE ESTA PRUEBA CONGELA, Y LO QUE NO ─────────────────────────────────
 *
 * Congela el **aporte** medido hoy, no la exactitud absoluta. Un cambio que suba
 * la exactitud absoluta sin subir el aporte no ha mejorado el motor: ha mejorado
 * el comparador, y eso es exactamente lo que hay que poder distinguir.
 *
 * El aporte de las unidades se congela en **0,00 pp** a propósito. No es una
 * meta: es el registro honesto de que hoy ese motor no aporta nada medible ahí,
 * y de que la cifra del 99,54 % **no se publica como desempeño**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { procesarTranscript } from '@/lib/asr/pipeline'
import {
  terminoPresente, evaluable, tieneUnidad, tieneNumero, esAcronimo,
} from '@/lib/uci/benchmark-metricas'

/** Lector de CSV mínimo: el corpus lleva comas dentro de comillas. */
function csv(t: string): Record<string, string>[] {
  const filas: string[][] = []
  let celda = '', fila: string[] = [], comillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++ }
      else if (c === '"') comillas = false
      else celda += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(celda); celda = '' }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = '' }
    else if (c !== '\r') celda += c
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila) }
  const cab = filas.shift()!
  return filas.filter(r => r.length === cab.length)
    .map(r => Object.fromEntries(cab.map((k, i) => [k, r[i]])))
}

type Cat = 'unidad' | 'numero' | 'acronimo'

function ablacion() {
  const filas = csv(readFileSync(join(process.cwd(), 'fixtures/voz/corpus-v3-6000.csv'), 'utf8'))
  const m: Record<Cat, { con: number; sin: number; n: number }> = {
    unidad: { con: 0, sin: 0, n: 0 },
    numero: { con: 0, sin: 0, n: 0 },
    acronimo: { con: 0, sin: 0, n: 0 },
  }
  for (const r of filas) {
    const hablado = r.tts_text || '', canonico = r.canonical_text || ''
    if (!hablado || !canonico) continue
    /* CON motor: el texto hablado pasa por el pipeline real del producto. */
    const conMotor = procesarTranscript(hablado).texto
    for (const t of String(r.key_terms || '').split('|').map(s => s.trim()).filter(Boolean)) {
      if (!evaluable(t, canonico)) continue
      const cat: Cat | null = tieneUnidad(t) ? 'unidad'
        : tieneNumero(t) ? 'numero'
          : esAcronimo(t) ? 'acronimo' : null
      if (!cat) continue
      m[cat].n++
      if (terminoPresente(t, conMotor).ok) m[cat].con++
      /* SIN motor: el mismo texto hablado, crudo. Es el placebo. */
      if (terminoPresente(t, hablado).ok) m[cat].sin++
    }
  }
  return m
}

/** Lo medido el 8-ago-2026. El APORTE sólo puede subir; la n, no bajar. */
const CONGELADO: Record<Cat, { nMin: number; aporteMinPp: number }> = {
  unidad: { nMin: 216, aporteMinPp: 0 },
  numero: { nMin: 498, aporteMinPp: 3.0 },
  acronimo: { nMin: 1738, aporteMinPp: 4.0 },
}

describe('ablación: cuánto de la cifra es del motor', () => {
  const m = ablacion()
  const pp = (c: Cat) => ((m[c].con - m[c].sin) / (m[c].n || 1)) * 100

  it.each(['unidad', 'numero', 'acronimo'] as Cat[])(
    'el corpus de %s no encoge', (c) => {
      /**
       * Si la n baja, el porcentaje se vuelve más fácil sin que nada mejore —
       * y ésa es la forma más limpia de inflar una métrica sin tocar el
       * producto.
       */
      expect(m[c].n, `${c}: el corpus encogió`).toBeGreaterThanOrEqual(CONGELADO[c].nMin)
    })

  it('el aporte del motor en NÚMEROS no baja', () => {
    expect(pp('numero')).toBeGreaterThanOrEqual(CONGELADO.numero.aporteMinPp)
  })

  it('el aporte del motor en ACRÓNIMOS no baja', () => {
    expect(pp('acronimo')).toBeGreaterThanOrEqual(CONGELADO.acronimo.aporteMinPp)
  })

  it('en UNIDADES el aporte es CERO, y queda registrado como tal', () => {
    /**
     * No es una meta ni un fallo que arreglar hoy: es el hecho. `canonizar()`
     * traduce «microgramos por kilo por minuto» a `mcg/kg/min` por su cuenta,
     * así que el término sobrevive tanto si el pipeline lo tocó como si no.
     *
     * Lo que esta prueba impide es que alguien publique el 99,54 % como
     * desempeño del producto. Si algún día el motor SÍ aporta ahí, este caso se
     * pondrá rojo — y será una buena noticia que habrá que venir a escribir.
     */
    expect(Math.round(pp('unidad') * 100) / 100).toBe(0)
  })

  it('la exactitud absoluta de números y acrónimos NO está cerca del 99 %', () => {
    /**
     * El dueño escribió como meta «99,4 % medicamentos, 99,7 % número/unidad».
     * Lo medido hoy, sobre este corpus, es la mitad. Dejarlo escrito en una
     * prueba impide que la cifra deseada se cuele como si fuera la cifra real.
     */
    expect(m.numero.con / m.numero.n).toBeLessThan(0.9)
    expect(m.acronimo.con / m.acronimo.n).toBeLessThan(0.9)
  })
}, 900_000)

describe('la regla queda escrita para el próximo medidor', () => {
  it('toda métrica publicable declara su ablación', () => {
    /**
     * Una cifra que no distingue «producto» de «sin producto» la produce igual
     * un competidor que no haya escrito una línea de código.
     */
    const doc = readFileSync(join(process.cwd(), 'docs/evals/COMO-SE-MIDE.md'), 'utf8')
    expect(doc).toMatch(/ablaci[óo]n/i)
    expect(doc).toMatch(/0,00 pp/)
    expect(doc).toMatch(/no se publica como desempeño/i)
  })
})
