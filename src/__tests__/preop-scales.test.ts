import { describe, it, expect } from 'vitest'
import {
  calcularRCRI, calcularDASI, calcularCaprini,
  calcularStopBang, calcularAriscat,
  calcularChadsVasc, calcularHasBled,
} from '@/lib/expediente/preop'

describe('RCRI', () => {
  it('0 puntos → Clase I, no elevado', () => {
    const r = calcularRCRI({
      cirugiaAltoRiesgo: false, cardiopatiaIsquemica: false, insuficienciaCardiaca: false,
      enfermedadCerebrovascular: false, diabetesInsulina: false, creatininaMayor2: false,
    })
    expect(r.puntos).toBe(0)
    expect(r.clase).toBe('I')
    expect(r.elevado).toBe(false)
  })

  it('3 puntos → Clase IV, elevado', () => {
    const r = calcularRCRI({
      cirugiaAltoRiesgo: true, cardiopatiaIsquemica: true, insuficienciaCardiaca: true,
      enfermedadCerebrovascular: false, diabetesInsulina: false, creatininaMayor2: false,
    })
    expect(r.puntos).toBe(3)
    expect(r.clase).toBe('IV')
    expect(r.elevado).toBe(true)
  })
})

describe('DASI ↔ METs (coherencia)', () => {
  it('DASI alto (cuidado + caminar + escaleras + correr) → METs >> 4, conducta adecuada', () => {
    const r = calcularDASI({ cuidadoPersonal: true, caminarCuadras: true, subirEscaleras: true, correr: true })
    expect(r.score).toBeCloseTo(2.75 + 2.75 + 5.5 + 8, 1)
    expect(r.mets).toBeGreaterThanOrEqual(4)
    expect(r.metsAdecuados).toBe(true)
    expect(r.capacidadBaja).toBe(false)
    expect(r.interpretacion).toMatch(/adecuada/i)
  })

  it('DASI muy bajo (solo cuidado personal) → METs < 4, capacidad reducida', () => {
    const r = calcularDASI({ cuidadoPersonal: true })
    expect(r.score).toBeCloseTo(2.75, 1)
    expect(r.mets).toBeLessThan(4)
    expect(r.metsAdecuados).toBe(false)
    expect(r.capacidadBaja).toBe(true)
    expect(r.interpretacion).toMatch(/reducida/i)
  })

  it('caso intermedio: METs ≥4 pero DASI ≤34 → mensaje específico BASEL-PMI', () => {
    // Items que dan DASI ~16 (METs ~4.7) — METs adecuados pero DASI bajo umbral
    const r = calcularDASI({ cuidadoPersonal: true, caminarCuadras: true, subirEscaleras: true, trabajoLigero: true, trabajoModerado: true })
    expect(r.score).toBeLessThan(34)
    expect(r.mets).toBeGreaterThanOrEqual(4)
    expect(r.metsAdecuados).toBe(true)
    expect(r.dasiSobreUmbral).toBe(false)
    expect(r.interpretacion).toMatch(/BASEL-PMI/)
  })
})

describe('Caprini', () => {
  it('0 puntos → muy bajo riesgo, sin profilaxis farmacológica', () => {
    const r = calcularCaprini({})
    expect(r.puntos).toBe(0)
    expect(r.nivel).toBe('Muy bajo')
    expect(r.profilaxisSugerida).toMatch(/Deambulación/i)
  })

  it('Edad ≥75 + TVP previa + cirugía mayor (3+3+2 = 8) → alto', () => {
    const r = calcularCaprini({ edad75: true, antecedenteTVP: true, cirugiaMayor: true })
    expect(r.puntos).toBe(8)
    expect(r.nivel).toBe('Alto')
    expect(r.profilaxisSugerida).toMatch(/HBPM/)
  })
})

describe('STOP-BANG', () => {
  it('5/8 → alto riesgo', () => {
    const r = calcularStopBang({ snoring: true, tiredness: true, observed: true, pressure: true, bmi35: true })
    expect(r.puntos).toBe(5)
    expect(r.nivel).toBe('Alto')
  })

  it('1/8 → bajo riesgo', () => {
    const r = calcularStopBang({ snoring: true })
    expect(r.puntos).toBe(1)
    expect(r.nivel).toBe('Bajo')
  })
})

describe('ARISCAT', () => {
  it('Joven sano sin riesgos → bajo', () => {
    const r = calcularAriscat({ edad: 35, spo2: 98, infeccionRespiratoria: false, anemia: false, incision: 'periferica', duracion: 'menos2h', emergencia: false })
    expect(r.puntos).toBe(0)
    expect(r.nivel).toBe('Bajo')
  })

  it('Anciano con SpO2 baja + infección + intratorácica + emergencia → alto', () => {
    const r = calcularAriscat({ edad: 82, spo2: 88, infeccionRespiratoria: true, anemia: true, incision: 'intratoracica', duracion: 'mas3h', emergencia: true })
    // 16 + 24 + 17 + 11 + 24 + 23 + 8 = 123
    expect(r.puntos).toBeGreaterThanOrEqual(45)
    expect(r.nivel).toBe('Alto')
  })
})

describe('CHA₂DS₂-VASc (regla edad ≥75 sobre 65-74)', () => {
  it('Edad ≥75 anula el +1 de 65-74 (no se suma dos veces)', () => {
    const r = calcularChadsVasc({ edad75: true, edad65_74: true })
    expect(r.puntos).toBe(2) // solo edad75 cuenta
  })

  it('CHF + HTA + DM + edad 65-74 + sexo F = 5', () => {
    const r = calcularChadsVasc({ icc: true, hta: true, diabetes: true, edad65_74: true, sexoFemenino: true })
    expect(r.puntos).toBe(5) // 1+1+1+1+1
  })
})

describe('HAS-BLED', () => {
  it('3 ítems → riesgo alto', () => {
    const r = calcularHasBled({ htaNoControlada: true, renalAnormal: true, edad65: true })
    expect(r.puntos).toBe(3)
    expect(r.nivel).toBe('Alto')
  })
})
