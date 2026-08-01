/**
 * EL COSTO DEL DICTADO EXISTE — de punta a punta.
 *
 * ── LOS DOS DEFECTOS QUE FIJAN ESTAS PRUEBAS ─────────────────────────────────
 *
 * 1. `TARIFAS` estaba VACÍO. El tablero contaba tokens y no sabía cuánto valían:
 *    todo salía `sin_tarifa`, y sin costo no hay margen ni decisión de precio.
 *
 * 2. La transcripción **no se cobra por token, se cobra por minuto**, y el motor
 *    sólo sabía de tokens. El resultado era peor que un hueco: cada consulta
 *    dictada —el uso más frecuente del producto— pasaba por el libro como
 *    «llamada sin uso», con costo cero. Un cero no se ve como un dato que falta;
 *    se ve como algo que no costó nada.
 *
 * La cadena completa es: respuesta de OpenAI → `usoDe` → `costoUsd` → pesos. Se
 * prueba entera porque el eslabón que se rompió antes fue el del medio: `usoDe`
 * ignoraba los minutos, así que la ruta los mandaba y nadie los leía. TypeScript
 * no lo cazó —el parámetro es `unknown`— y sólo apareció al mirarlo.
 */
import { describe, it, expect } from 'vitest'
import { TARIFAS, tarifaDe, costoUsd } from '@/lib/finanzas/precios-modelo'
import { usoDe, trajoUso } from '@/lib/finanzas/medir-ia'

describe('las tarifas cargadas', () => {
  it('ninguna se acepta sin fuente y sin fecha', () => {
    // Es la regla que impide que vuelva a haber una cifra «de memoria».
    for (const t of TARIFAS) {
      expect(t.fuente, `${t.modelo} sin fuente`).toMatch(/^https?:\/\//)
      expect(t.consultado, `${t.modelo} sin fecha`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('cubre los modelos que la app usa de verdad', () => {
    const ids = TARIFAS.map(t => t.modelo)
    for (const m of ['claude-opus-4-8', 'claude-sonnet-5', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'gpt-5', 'gpt-4o']) {
      expect(ids, `falta la tarifa de ${m}`).toContain(m)
    }
  })

  it('Sonnet 5 va al precio de LISTA, no al de lanzamiento', () => {
    /**
     * $2/$10 es promoción hasta el 31-ago-2026; la lista es $3/$15. Este motor
     * no sabe de vigencias, así que la promoción dejaría el tablero mintiendo
     * en silencio desde septiembre — justo al empezar a vender. El de lista
     * yerra hacia el margen pesimista, que no produce una mala decisión.
     */
    const t = tarifaDe('claude-sonnet-5')!
    expect(t.entradaUsdPorMillon).toBe(3)
    expect(t.salidaUsdPorMillon).toBe(15)
  })

  it('resuelve el id con sufijo de fecha que devuelve el proveedor', () => {
    // La API responde `claude-haiku-4-5-20251001`; la tarifa se publica por familia.
    expect(tarifaDe('claude-haiku-4-5-20251001')?.modelo).toBe('claude-haiku-4-5')
  })

  it('un modelo sin tarifa NO cuesta cero: cuesta desconocido', () => {
    const r = costoUsd('modelo-que-no-existe', { entrada: 1000, salida: 1000 })
    expect(r.usd).toBeNull()
    expect(r.motivo).toBe('sin_tarifa')
  })
})

describe('el audio se cobra por MINUTO', () => {
  it('las tres transcripciones tienen precio por minuto', () => {
    for (const [m, esperado] of [['whisper-1', 0.006], ['gpt-4o-transcribe', 0.006], ['gpt-4o-mini-transcribe', 0.003]] as const) {
      expect(tarifaDe(m)?.usdPorMinuto, m).toBe(esperado)
    }
  })

  it('una consulta de 20 minutos dictada tiene un costo real', () => {
    // 20 × $0.006 = $0.12 USD. Antes esto era exactamente $0.
    const r = costoUsd('gpt-4o-transcribe', { entrada: 0, salida: 0, minutosAudio: 20 })
    expect(r.usd).toBeCloseTo(0.12, 6)
  })

  it('sin minutos NI tokens sí es «sin uso» — el hueco real se conserva', () => {
    const r = costoUsd('gpt-4o-transcribe', { entrada: 0, salida: 0 })
    expect(r.usd).toBeNull()
    expect(r.motivo).toBe('sin_uso')
  })

  it('un modelo de texto no gana costo de audio por accidente', () => {
    // `usdPorMinuto` ausente ⇒ el término de audio aporta 0, no NaN.
    const r = costoUsd('gpt-4o', { entrada: 1_000_000, salida: 0, minutosAudio: 99 })
    expect(r.usd).toBeCloseTo(2.5, 6)
  })
})

describe('la cadena completa: respuesta → uso → costo', () => {
  it('EL ESLABÓN QUE SE ROMPIÓ: usoDe tiene que leer los minutos', () => {
    /**
     * La ruta de transcripción adjunta `minutosAudio` al objeto que pasa al
     * libro. Antes `usoDe` sólo miraba `usage` y los tiraba, así que la ruta
     * mandaba el dato y nadie lo leía — escrito y sin conectar. El compilador no
     * lo vio porque el parámetro es `unknown`.
     */
    const u = usoDe({ usage: { input_tokens: 0, output_tokens: 0 }, minutosAudio: 12.5 })
    expect(u.minutosAudio).toBe(12.5)
  })

  it('una transcripción cuenta como uso aunque no tenga ni un token', () => {
    // Sin esto, cada dictado entraba al libro como «llamada sin uso».
    expect(trajoUso(usoDe({ usage: { input_tokens: 0, output_tokens: 0 }, minutosAudio: 3 }))).toBe(true)
  })

  it('de la respuesta cruda de OpenAI al costo, sin tocar nada a mano', () => {
    const respuesta = { usage: { input_tokens: 0, output_tokens: 0 }, minutosAudio: 20 }
    expect(costoUsd('gpt-4o-transcribe', usoDe(respuesta)).usd).toBeCloseTo(0.12, 6)
  })

  it('el texto sigue funcionando igual que antes', () => {
    const respuesta = { usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } }
    // Opus 4.8: $5 entrada + $25 salida.
    expect(costoUsd('claude-opus-4-8', usoDe(respuesta)).usd).toBeCloseTo(30, 6)
  })
})
