/**
 * GOLDEN — el análisis de evidencia se rendía en 40 s y culpaba a la llave.
 *
 * ── LO QUE SE VEÍA ───────────────────────────────────────────────────────────
 *
 * «No se obtuvo el razonamiento — Claude: The operation was aborted due to
 * timeout. **Revisa tu llave/créditos en Configuración → Llaves de IA.**»
 *
 * Con las 12 fuentes de PubMed listadas debajo, correctas y reales.
 *
 * ── LOS DOS DEFECTOS ─────────────────────────────────────────────────────────
 *
 * 1. **El presupuesto no daba.** 40 s fijos para el modelo dentro de una función
 *    de 60 s, y sin descontar lo que PubMed ya había gastado. Con 12 artículos
 *    en el contexto y el nivel Máxima (Opus), se acababa el reloj.
 *
 * 2. **El aviso culpaba a la causa equivocada.** Mandaba a revisar la llave y
 *    los créditos ante un timeout del proveedor. Se comprobó en la cuenta del
 *    Dr.: la llave y los créditos estaban bien. Es el mismo vicio que el
 *    «el servidor rechazó el permiso» de la nota — un diagnóstico falso que
 *    hace perder el tiempo en el único momento en que no lo hay.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ruta = readFileSync(join(process.cwd(), 'src/app/api/expediente/evidencia/route.ts'), 'utf8')

describe('EL PRESUPUESTO ALCANZA, Y ES UNO SOLO', () => {
  it('la función dispone de 300 s', () => {
    expect(ruta).toMatch(/export const maxDuration = 300\b/)
  })

  it('y el presupuesto interno dice EXACTAMENTE lo mismo', () => {
    /**
     * `maxDuration` tiene que ser un literal (Next rechaza una referencia), así
     * que los dos números se escriben aparte y pueden separarse en silencio: el
     * modelo creería tener un tiempo que la función ya no le da. Este test es lo
     * único que los mantiene atados.
     */
    const dur = ruta.match(/export const maxDuration = (\d+)/)?.[1]
    const pres = ruta.match(/PRESUPUESTO_MS = ([\d_]+)/)?.[1]?.replace(/_/g, '')
    expect(Number(pres)).toBe(Number(dur) * 1000)
  })

  it('se le da al modelo lo que QUEDA, no una cifra fija', () => {
    // PubMed gasta antes. Ignorarlo es llegar al corte a medio escribir.
    expect(ruta).toContain('signal: AbortSignal.timeout(msParaElModelo())')
    expect(ruta).toContain('Date.now() - t0Peticion')
  })

  it('con un suelo, para no fingir un intento imposible', () => {
    expect(ruta).toContain('Math.max(20_000')
  })
})

describe('EL RELOJ ES DE CADA PETICIÓN, NO DEL MÓDULO', () => {
  it('se declara dentro de POST', () => {
    /**
     * Como variable de módulo, dos consultas simultáneas en el mismo runtime se
     * pisarían el reloj: la segunda lo reiniciaría y la primera creería que le
     * queda más tiempo del que tiene.
     */
    const iPost = ruta.indexOf('export async function POST')
    const iReloj = ruta.indexOf('const t0Peticion = Date.now()')
    expect(iReloj).toBeGreaterThan(iPost)
    expect(ruta).not.toMatch(/^let t0Peticion/m)
  })
})

describe('EL AVISO DICE LA CAUSA REAL', () => {
  it('distingue el timeout del problema de cuenta', () => {
    expect(ruta).toContain('const esReloj =')
    expect(ruta).toMatch(/timeout\|aborted\|deadline/)
  })

  it('y ante un timeout NO manda a revisar la llave', () => {
    /**
     * La llave estaba bien. Decirle que la revise es mandarlo a buscar un
     * problema que no existe mientras el paciente espera.
     */
    expect(ruta).toContain('Fue el proveedor, no tu cuenta')
    const i = ruta.indexOf('const esReloj =')
    const bloque = ruta.slice(i, i + 700)
    expect(bloque).toContain('Revisa tu llave/créditos')   // sigue existiendo…
    expect(bloque).toContain('esReloj')                     // …pero sólo en la otra rama
  })

  it('y sigue devolviendo las fuentes, que son reales', () => {
    // Perder la bibliografía porque falló el razonamiento sería tirar lo que sí sirvió.
    expect(ruta).toContain('ok: true, articulos')
  })
})
