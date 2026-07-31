import { describe, it, expect } from 'vitest'
import { cdsMedicamento } from '@/lib/hospital/cds'
import { analizarSeguridadUCI } from '@/lib/uci/seguridad'

// ══════════════════════════════════════════════════════════════════════════
// GRUPO E — correctitud de software segura (auditoría, fundamento CLSI/skill PROA)
// E1: CDS hospitalario respeta la NEGACIÓN de alergias (no bloquea firma NOM-004)
// E2: alertas UCI con valor CENSURADO (">500"/"<50"/"≥6.5") NO se pierden
// ══════════════════════════════════════════════════════════════════════════

describe('E1 — CDS de alergias respeta la negación', () => {
  it('NO dispara alerta crítica ante una alergia NEGADA', () => {
    const a = cdsMedicamento({ nombre: 'Penicilina G', alergias: 'niega alergia a penicilina' })
    expect(a.some(x => x.nivel === 'critica')).toBe(false)
  })

  it('"sin alergias conocidas" no genera alerta', () => {
    const a = cdsMedicamento({ nombre: 'Amoxicilina', alergias: 'sin alergias conocidas' })
    expect(a.some(x => x.nivel === 'critica')).toBe(false)
  })

  it('SÍ dispara alerta ante una alergia REAL (no se sobre-suprime)', () => {
    const a = cdsMedicamento({ nombre: 'Penicilina G', alergias: 'alérgico a penicilina' })
    expect(a.some(x => x.nivel === 'critica')).toBe(true)
  })

  it('conserva la alergia real aunque venga tras una negada', () => {
    const a = cdsMedicamento({ nombre: 'Ampicilina', alergias: 'niega penicilina. alérgico a ampicilina' })
    expect(a.some(x => x.nivel === 'critica')).toBe(true)
  })
})

describe('E2 — alertas UCI no se pierden por valor censurado', () => {
  it('glucosa ">500" dispara hiperglucemia grave (antes: cero alerta)', () => {
    const alertas = analizarSeguridadUCI({ glucosa: '>500' })
    expect(alertas.some(a => a.parametro === 'glucosa')).toBe(true)
  })

  it('glucosa "<50" dispara hipoglucemia crítica', () => {
    const alertas = analizarSeguridadUCI({ glucosa: '<50' })
    expect(alertas.some(a => a.parametro === 'glucosa' && a.nivel === 'critica')).toBe(true)
  })

  it('potasio "≥6.5" dispara alerta crítica', () => {
    const alertas = analizarSeguridadUCI({ potasio: '≥6.5' })
    expect(alertas.some(a => a.parametro === 'potasio' && a.nivel === 'critica')).toBe(true)
  })

  it('un valor numérico normal sigue sin alertar de más', () => {
    const alertas = analizarSeguridadUCI({ glucosa: 150 })
    expect(alertas.some(a => a.parametro === 'glucosa')).toBe(false)
  })
})
