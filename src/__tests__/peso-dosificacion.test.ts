/**
 * GOLDEN — el peso con el que se dosifica (charter §16).
 *
 * `ICUStay.pesoDosificacion` estaba modelado con valor, tipo, autor y hora… y
 * **no lo escribía nadie**. Cada calculadora del panel pedía el peso por su
 * cuenta —infusiones lee `infPeso`, CKRT lee `ckrtPeso`, e infusiones cae a la
 * de CKRT si la suya está vacía— así que dos pantallas del mismo paciente
 * podían estar dosificando con pesos distintos sin que nadie se enterara.
 *
 * En una infusión de µg/kg/min, un 14 % de diferencia en el peso es un 14 % de
 * diferencia en la dosis.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  validarPeso, fijarPeso, pesoParaCalcular, avisoSinPeso, TIPOS_PESO, MIN_KG, MAX_KG,
} from '@/lib/uci/peso-dosificacion'

const AUTOR = 'dra@clinica.mx'

describe('validarPeso', () => {
  it('un peso normal con su tipo se acepta', () => {
    expect(validarPeso('72.5', 'actual', AUTOR).ok).toBe(true)
  })

  it('SIN AUTOR no se fija: el charter §16 exige que quede con su nombre', () => {
    const v = validarPeso('72', 'actual', '   ')
    expect(v.ok).toBe(false)
    expect(v.motivo).toBe('sin-autor')
  })

  it('un dedazo no se convierte en una dosis', () => {
    // Tope de cordura, no rango clínico: sólo descarta lo que no puede ser un
    // peso humano tecleado a propósito.
    expect(validarPeso('0', 'actual', AUTOR).motivo).toBe('fuera-de-rango')
    expect(validarPeso('-5', 'actual', AUTOR).motivo).toBe('fuera-de-rango')
    expect(validarPeso('700', 'actual', AUTOR).motivo).toBe('fuera-de-rango')
    expect(validarPeso('setenta', 'actual', AUTOR).motivo).toBe('no-numerico')
    expect(validarPeso('', 'actual', AUTOR).motivo).toBe('vacio')
  })

  it('los extremos del rango SÍ entran: el criterio es del médico', () => {
    // Un prematuro y un paciente con obesidad extrema son pacientes reales.
    expect(validarPeso(String(MIN_KG), 'actual', AUTOR).ok).toBe(true)
    expect(validarPeso(String(MAX_KG), 'actual', AUTOR).ok).toBe(true)
  })

  it('hay que decir QUÉ peso es', () => {
    expect(validarPeso('72', 'loQueSea', AUTOR).motivo).toBe('tipo-desconocido')
    expect(validarPeso('72', undefined, AUTOR).motivo).toBe('tipo-desconocido')
  })

  it('el vocabulario es el que ya declaraba el tipo, no uno inventado', () => {
    expect([...TIPOS_PESO]).toEqual(['actual', 'ingreso', 'seco', 'configurado'])
    for (const t of TIPOS_PESO) expect(validarPeso('70', t, AUTOR).ok).toBe(true)
  })
})

describe('fijarPeso', () => {
  it('guarda quién y cuándo', () => {
    expect(fijarPeso(72.5, 'seco', ' dra@clinica.mx ', '2026-08-02T10:00:00.000Z')).toEqual({
      valorKg: 72.5, tipo: 'seco',
      fijadoPor: 'dra@clinica.mx', fijadoEn: '2026-08-02T10:00:00.000Z',
    })
  })
})

describe('pesoParaCalcular', () => {
  it('devuelve el peso fijado', () => {
    expect(pesoParaCalcular({ valorKg: 80, tipo: 'actual', fijadoPor: AUTOR, fijadoEn: 'x' })).toBe(80)
  })

  it('sin peso fijado devuelve null y NO inventa uno de la nota', () => {
    // Arrastrar el peso de la nota movería todas las dosis sin que nadie lo
    // decidiera: exactamente lo que §16 prohíbe.
    expect(pesoParaCalcular(null)).toBeNull()
    expect(pesoParaCalcular(undefined)).toBeNull()
    expect(pesoParaCalcular({ valorKg: 0, tipo: 'actual', fijadoPor: AUTOR, fijadoEn: 'x' })).toBeNull()
  })

  it('y entonces se DICE, en vez de dejar que cada pantalla suponga', () => {
    expect(avisoSinPeso(null)).toMatch(/dos pantallas pueden estar dosificando con pesos distintos/)
    expect(avisoSinPeso({ valorKg: 70, tipo: 'actual', fijadoPor: AUTOR, fijadoEn: 'x' })).toBe('')
  })
})

describe('el autor lo sella el servidor', () => {
  it('la ruta no acepta el autor del llamador', () => {
    // Si el cliente pudiera mandarlo, el peso con el que se dosifica quedaría a
    // nombre de quien dijera el navegador — el mismo criterio de los cobros.
    const s = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'uci', 'estancia', 'route.ts'), 'utf8')
    expect(s).toContain('const autor = acc.email || acc.uid')
    expect(s).toContain('validarPeso(')
    expect(s).toContain('fijarPeso(')
  })
})

/**
 * LA TALLA (charter §31) — el otro dato que se re-tecleaba en cada pantalla.
 *
 * `ICUStay.tallaCm` está declarado «para poder calcular PBW y VT/PBW» y tampoco
 * lo escribía nadie. La talla de un adulto NO cambia durante la estancia, y de
 * ella sale el peso predicho y con él el VT/PBW — la meta de ventilación
 * protectora. Un dedazo de 10 cm mueve el peso predicho unos 9 kg.
 */
describe('validarTalla', () => {
  it('una talla normal se acepta', async () => {
    const { validarTalla } = await import('@/lib/uci/peso-dosificacion')
    expect(validarTalla('168').ok).toBe(true)
  })

  it('un dedazo no se convierte en un volumen protector', async () => {
    const { validarTalla } = await import('@/lib/uci/peso-dosificacion')
    expect(validarTalla('0').motivo).toBe('fuera-de-rango')
    expect(validarTalla('1680').motivo).toBe('fuera-de-rango')
    expect(validarTalla('alto').motivo).toBe('no-numerico')
    expect(validarTalla('').motivo).toBe('vacio')
  })

  it('sin talla fijada NO se inventa una', async () => {
    const { tallaParaCalcular } = await import('@/lib/uci/peso-dosificacion')
    expect(tallaParaCalcular(null)).toBeNull()
    expect(tallaParaCalcular(undefined)).toBeNull()
    expect(tallaParaCalcular(0)).toBeNull()
    expect(tallaParaCalcular(170)).toBe(170)
  })

  it('el panel usa la fijada por DEBAJO de lo que se teclee en él', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'uci', 'page.tsx'), 'utf8')
    expect(s).toContain("tallaCm: n('talla') ?? tallaParaCalcular(tallaFijada)")
    expect(s).toContain("n('infPeso') ?? pesoParaCalcular(pesoFijado)")
  })
})
