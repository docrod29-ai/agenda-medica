/**
 * GOLDEN — el mismo fármaco salía con TRES categorías en la misma salida, y la
 * más cruda decía lo contrario que las otras dos.
 *
 * ── EL FALLO, REPRODUCIDO CORRIENDO EL MOTOR ─────────────────────────────────
 *
 * *E. coli* de urocultivo, ciprofloxacino R y levofloxacino S con CMI 0.5. La
 * regla experta EUCAST T13 (13.5) edita el levofloxacino a **R** por
 * cross-resistencia. Esto es lo que el motor entregaba:
 *
 *     Panel (canónico): Levofloxacino=R [EDITADO: el laboratorio reportó S]
 *     REGLA EXPERTA:    Levofloxacino S→R
 *     CMI→CLSI:         Levofloxacino 0.5=S          ← sin marca, `concuerda: true`
 *
 * `concuerda: true` afirmaba «todo cuadra» exactamente donde este mismo motor
 * acababa de decidir lo contrario. Y en pantalla, esa fila se pintaba **verde**
 * —el color de «úsalo»— justo debajo de un panel que decía R.
 *
 * ── POR QUÉ ──────────────────────────────────────────────────────────────────
 *
 * El bucle de `categoriasCMI` recorría `r` (el panel CRUDO), no
 * `resultadosEfectivos`. Es la misma familia del defecto E0-15a que el Dr. marcó
 * como P0 —«nunca debe existir una pantalla donde Nexus muestre R y el LLM
 * continúe razonando con S»—, en el único consumidor al que no se le cableó.
 *
 * ── LO QUE NO SE TOCA ────────────────────────────────────────────────────────
 *
 * `categoriaCLSI` sigue siendo **S**: 0.5 mg/L de levofloxacino ES S en la tabla
 * del CLSI, y eso es un hecho sobre la CMI, no una opinión. Lo que se añade es
 * de qué lado está la fila. Y `concuerda` sigue respondiendo a su pregunta de
 * siempre —¿el LABORATORIO y el punto de corte dicen lo mismo?—, porque
 * convertirla en «¿el motor concuerda consigo mismo?» perdería la discordancia
 * real que hoy detecta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'
import { resumenDeterminista } from '@/lib/expediente/antibiograma/razonar'
import type { EntradaAntibiograma } from '@/lib/expediente/antibiograma/tipos'

/** El caso exacto: cipro-R obliga a editar levo-S a R (EUCAST T13, 13.5). */
const CASO: EntradaAntibiograma = {
  organismo: 'Escherichia coli', sitio: 'orina',
  resultados: [
    { antibiotico: 'Ciprofloxacino', interpretacion: 'R' },
    { antibiotico: 'Levofloxacino', interpretacion: 'S', cmi: 0.5 },
    { antibiotico: 'Meropenem', interpretacion: 'S', cmi: 0.06 },
  ],
}

describe('EL CASO QUE SE ROMPÍA: levofloxacino editado a R con CMI 0.5', () => {
  const r = interpretarAntibiograma(CASO)
  const levo = r.categoriasCMI.find(c => c.antibiotico === 'Levofloxacino')!

  it('la edición existe (si no, el resto de la prueba no probaría nada)', () => {
    expect(r.edicionesInterpretativas.map(e => e.antibiotico)).toContain('Levofloxacino')
  })

  it('la fila de CMI ya sabe que la interpretación canónica es R', () => {
    expect(levo.interpretacionEfectiva).toBe('R')
    expect(levo.editadaPorReglaExperta).toBe(true)
  })

  it('y trae la razón y la fuente, no sólo la bandera', () => {
    // Una marca sin motivo obliga a confiar; con motivo, se puede discutir.
    expect(levo.edicionRazon).toMatch(/cross-resistencia/i)
    expect(levo.edicionReferencia).toMatch(/EUCAST/)
  })

  it('el conflicto queda declarado: el corte lo deja usable y el motor lo descarta', () => {
    expect(levo.conflictoConEdicion).toBe(true)
  })

  it('el punto de corte NO se falsea: 0.5 sigue siendo S en la tabla', () => {
    /**
     * Tentación evitada: «pongámosle R a la categoríaCLSI y se acabó». Sería
     * mentir sobre lo que dice el CLSI para tapar una contradicción de
     * presentación, y rompería la detección de discordancia lab-vs-corte.
     */
    expect(levo.categoriaCLSI).toBe('S')
    expect(levo.categoriaReportada).toBe('S')
    expect(levo.concuerda).toBe(true)
  })
})

describe('EL CONTROL: una fila sin editar no cambia en nada', () => {
  const r = interpretarAntibiograma(CASO)
  const mero = r.categoriasCMI.find(c => c.antibiotico === 'Meropenem')!

  it('no se marca como editada', () => {
    expect(mero.editadaPorReglaExperta).toBeUndefined()
    expect(mero.conflictoConEdicion).toBeUndefined()
  })

  it('y su interpretación efectiva es la que reportó el laboratorio', () => {
    expect(mero.interpretacionEfectiva).toBe('S')
    expect(mero.categoriaReportada).toBe('S')
    expect(mero.concuerda).toBe(true)
  })
})

describe('la discordancia REAL lab-vs-corte sigue detectándose', () => {
  /**
   * Sin esto, la reparación podría haber apagado `concuerda` para todo el mundo
   * y las pruebas de arriba pasarían igual.
   */
  it('un reporte que dice S donde el corte dice R sale discordante', () => {
    const r = interpretarAntibiograma({
      organismo: 'Escherichia coli', sitio: 'orina',
      resultados: [{ antibiotico: 'Meropenem', interpretacion: 'S', cmi: 16 }],
    })
    const c = r.categoriasCMI[0]
    expect(c.categoriaCLSI).toBe('R')
    expect(c.categoriaReportada).toBe('S')
    expect(c.concuerda).toBe(false)
  })
})

describe('las TRES salidas dejan de contradecirse', () => {
  const r = interpretarAntibiograma(CASO)

  it('el prompt del modelo ya no afirma «0.5=S» a secas', () => {
    const texto = resumenDeterminista(CASO, r)
    const linea = texto.split('\n').find(l => l.includes('CMI→CLSI'))!
    expect(linea).toBeDefined()
    expect(linea).toContain('Levofloxacino 0.5=S')
    // …pero en el mismo renglón, y no tres párrafos más arriba:
    expect(linea).toMatch(/CANÓNICA es R por regla experta/)
    expect(linea).toMatch(/NO lo recomiendes por esta CMI/)
  })

  it('el panel canónico y la línea de CMI dicen lo mismo sobre quién manda', () => {
    const texto = resumenDeterminista(CASO, r)
    expect(texto).toContain('Levofloxacino=R')
    expect(texto).toMatch(/usa SIEMPRE la categoría editada/)
  })

  it('la pantalla deja de pintarlo VERDE, que es lo que se lee sin leer', () => {
    const page = readFileSync(
      join(process.cwd(), 'src', 'app', '(dashboard)', 'antibiograma', 'page.tsx'), 'utf8')
    expect(page).toContain("const col = c.editadaPorReglaExperta ? 'var(--text3)'")
    expect(page).toContain('c.interpretacionEfectiva')
    expect(page).toContain('la interpretación que MANDA es')
  })

  it('y el motor lee el panel EFECTIVO, que era la raíz', () => {
    const motor = readFileSync(
      join(process.cwd(), 'src', 'lib', 'expediente', 'antibiograma', 'motor.ts'), 'utf8')
    const codigo = motor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')
    expect(codigo).toContain('for (const x of resultadosEfectivos)')
    expect(codigo).not.toContain('for (const x of r)')
  })
})
