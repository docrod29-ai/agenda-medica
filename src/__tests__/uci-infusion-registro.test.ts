import { describe, it, expect } from 'vitest'
import {
  revisarInfusion,
  tieneErrores,
  lineaTitulacion,
  dosisVigenteEn,
  tendenciaTitulacion,
  type RegistroInfusion,
  type CambioTitulacion,
} from '@/lib/uci/infusion-registro'

/**
 * Charter §13, §19 y §20 — la infusión como REGISTRO.
 *
 *   §13: «No almacenar únicamente "Norepinefrina 0.1".»
 *
 * Ese texto no dice a qué concentración corre, con qué peso se dosificó ni quién
 * lo verificó. Dos hospitales con preparaciones distintas escriben LO MISMO para
 * infusiones que entregan cantidades diferentes de fármaco.
 *
 * Datos 100 % sintéticos. Ninguna concentración de estos fixtures pretende ser
 * clínicamente correcta: son números de prueba.
 */

const T = (hhmm: string) => `2026-07-30T${hhmm}:00Z`

const reg = (extra: Partial<RegistroInfusion> = {}): RegistroInfusion => ({
  id: 'i1',
  medicamento: 'norepinefrina',
  cantidadFarmaco: 4,
  unidadFarmaco: 'mg',
  volumenFinal: 250,
  unidadVolumen: 'mL',
  concentracion: 4 / 250,
  unidadConcentracion: 'mg/mL',
  capaPreparacion: 'HOSPITAL_STANDARD',
  velocidad: 12,
  unidadVelocidad: 'mL/h',
  pesoKg: 70,
  tipoPeso: 'configurado',
  iniciadaEn: T('08:00'),
  canalBomba: 'B1',
  fuente: 'teclado',
  verificada: true,
  ...extra,
})

describe('§20 · ERROR — el registro se contradice a sí mismo', () => {
  it('dosis calculada SIN concentración: no se puede reconstruir de dónde salió', () => {
    const hs = revisarInfusion(reg({ concentracion: undefined, dosisCalculada: 0.1, unidadDosis: 'µg/kg/min' }))
    expect(hs.some(h => h.codigo === 'DOSIS_SIN_CONCENTRACION' && h.severidad === 'ERROR')).toBe(true)
    expect(tieneErrores(hs)).toBe(true)
  })

  it('dosis POR KILO sin peso registrado', () => {
    const hs = revisarInfusion(reg({ dosisCalculada: 0.1, unidadDosis: 'µg/kg/min', pesoKg: undefined }))
    expect(hs.some(h => h.codigo === 'DOSIS_POR_PESO_SIN_PESO' && h.severidad === 'ERROR')).toBe(true)
  })

  it('la concentración que NO cuadra con sus partes se denuncia', () => {
    // La concentración se DERIVA. Si no coincide, alguien la tecleó.
    const hs = revisarInfusion(reg({ concentracion: 999 }))
    expect(hs.some(h => h.codigo === 'CONCENTRACION_NO_CUADRA' && h.severidad === 'ERROR')).toBe(true)
  })

  it('la concentración correcta NO se denuncia', () => {
    expect(revisarInfusion(reg()).some(h => h.codigo === 'CONCENTRACION_NO_CUADRA')).toBe(false)
  })

  it('bomba sin medicamento', () => {
    const hs = revisarInfusion(reg({ medicamento: '  ' }))
    expect(hs.some(h => h.codigo === 'BOMBA_SIN_MEDICAMENTO' && h.severidad === 'ERROR')).toBe(true)
  })

  it.each([NaN, Infinity, -1])('velocidad inválida (%s)', (v) => {
    const hs = revisarInfusion(reg({ velocidad: v as number }))
    expect(hs.some(h => h.codigo === 'VELOCIDAD_INVALIDA')).toBe(true)
  })
})

describe('§20 · WARNING — falta algo para auditar o dosificar', () => {
  it('sin concentración: no se puede calcular la dosis (ICU-Q4.3)', () => {
    const hs = revisarInfusion(reg({ concentracion: undefined, dosisCalculada: undefined }))
    expect(hs.some(h => h.codigo === 'SIN_CONCENTRACION' && h.severidad === 'WARNING')).toBe(true)
    // Pero la infusión NO es un error: existe y se registra sin dosis.
    expect(tieneErrores(hs)).toBe(false)
  })

  it('peso registrado sin decir CUÁL es (§16)', () => {
    const hs = revisarInfusion(reg({ tipoPeso: undefined }))
    expect(hs.some(h => h.codigo === 'PESO_SIN_TIPO')).toBe(true)
  })

  it('dictada y sin verificar ← nivel 1 de la decisión Q4.4', () => {
    const hs = revisarInfusion(reg({ fuente: 'dictado', verificada: false }))
    expect(hs.some(h => h.codigo === 'DICTADA_SIN_VERIFICAR')).toBe(true)
  })

  it('dictada Y verificada ya no avisa', () => {
    const hs = revisarInfusion(reg({ fuente: 'dictado', verificada: true }))
    expect(hs.some(h => h.codigo === 'DICTADA_SIN_VERIFICAR')).toBe(false)
  })

  it('preparación sin origen: la dosis no es auditable', () => {
    const hs = revisarInfusion(reg({ capaPreparacion: undefined }))
    expect(hs.some(h => h.codigo === 'PREPARACION_SIN_ORIGEN')).toBe(true)
  })
})

describe('§20 · INFORMATION — se avisa sin alarmar', () => {
  it('preparación de REFERENCIA, no del estándar local', () => {
    const hs = revisarInfusion(reg({ capaPreparacion: 'REFERENCE_LIBRARY' }))
    const h = hs.find(x => x.codigo === 'PREPARACION_DE_REFERENCIA')
    expect(h?.severidad).toBe('INFORMATION')
    expect(tieneErrores(hs)).toBe(false)
  })

  it('sin canal de bomba', () => {
    const hs = revisarInfusion(reg({ canalBomba: undefined }))
    expect(hs.find(x => x.codigo === 'SIN_CANAL')?.severidad).toBe('INFORMATION')
  })

  it('un registro completo NO produce errores ni advertencias', () => {
    const hs = revisarInfusion(reg())
    expect(hs.filter(h => h.severidad !== 'INFORMATION')).toEqual([])
  })
})

describe('§20 · lo que NO se revisa aquí, y por qué', () => {
  it('no hay chequeo de «velocidad absurda»: exigiría un umbral clínico', () => {
    // El §20 lo pide, pero inventar un «rate máximo razonable» es justo lo que
    // la carta operativa prohíbe. Una velocidad alta pero válida NO se marca.
    const hs = revisarInfusion(reg({ velocidad: 999 }))
    expect(hs.filter(h => h.severidad === 'ERROR')).toEqual([])
  })

  it('no hay chequeo de «concentración distinta a la habitual»: falta la biblioteca del hospital', () => {
    const hs = revisarInfusion(reg({ cantidadFarmaco: 16, concentracion: 16 / 250 }))
    expect(hs.some(h => h.codigo?.includes('HABITUAL'))).toBe(false)
  })
})

describe('§19 · línea de titulación', () => {
  const cambios: CambioTitulacion[] = [
    { en: T('10:30'), velocidad: 8, dosisCalculada: 0.10, unidadDosis: 'µg/kg/min', por: 'enf' },
    { en: T('08:00'), velocidad: 14, dosisCalculada: 0.18, unidadDosis: 'µg/kg/min', por: 'enf' },
    { en: T('09:15'), velocidad: 11, dosisCalculada: 0.14, unidadDosis: 'µg/kg/min', por: 'enf' },
    { en: T('12:00'), velocidad: 5, dosisCalculada: 0.06, unidadDosis: 'µg/kg/min', por: 'enf' },
  ]

  it('sale en orden cronológico aunque entre desordenada', () => {
    expect(lineaTitulacion(cambios).map(c => c.dosisCalculada)).toEqual([0.18, 0.14, 0.10, 0.06])
  })

  it('la dosis vigente es la DISPONIBLE en ese momento, no la última fila', () => {
    expect(dosisVigenteEn(cambios, T('09:00'))?.dosisCalculada).toBe(0.18)
    expect(dosisVigenteEn(cambios, T('11:00'))?.dosisCalculada).toBe(0.10)
    expect(dosisVigenteEn(cambios, T('23:00'))?.dosisCalculada).toBe(0.06)
  })

  it('antes del primer cambio no hay dosis vigente', () => {
    expect(dosisVigenteEn(cambios, T('07:00'))).toBeNull()
  })

  it('NO interpola entre cambios', () => {
    // Rellenar inventaría dosis que nadie indicó.
    expect(lineaTitulacion(cambios)).toHaveLength(4)
  })

  it('descarta fechas inválidas sin colgarse', () => {
    const malo = [...cambios, { en: 'ayer', velocidad: 1, por: 'x' }]
    expect(lineaTitulacion(malo)).toHaveLength(4)
  })

  it('instante inválido lanza con mensaje claro', () => {
    expect(() => dosisVigenteEn(cambios, 'mañana')).toThrowError(/instante inválido/)
  })

  it('la tendencia dice si sube o baja, sin interpretar', () => {
    expect(tendenciaTitulacion(cambios)).toBe('bajando')
    expect(tendenciaTitulacion([cambios[1]])).toBe('sin_datos')
    expect(tendenciaTitulacion([
      { en: T('08:00'), velocidad: 5, por: 'x' }, { en: T('09:00'), velocidad: 9, por: 'x' },
    ])).toBe('subiendo')
  })

  it('lineaTitulacion NO muta la entrada', () => {
    const antes = JSON.stringify(cambios)
    lineaTitulacion(cambios)
    expect(JSON.stringify(cambios)).toBe(antes)
  })
})
