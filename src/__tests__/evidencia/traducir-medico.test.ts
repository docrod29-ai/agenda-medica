import { describe, it, expect } from 'vitest'
import { traducirBasico, farmacosDetectados } from '@/lib/evidencia/traducir-medico'

describe('traducirBasico (ES→EN para PubMed)', () => {
  it('traduce términos clínicos y conserva nombres latinos, quitando relleno', () => {
    const out = traducirBasico('tratamiento para enterococcus faecalis sensible a la penicilina')
    expect(out).toContain('treatment')
    expect(out).toContain('enterococcus')
    expect(out).toContain('faecalis')
    expect(out).toContain('susceptible')
    expect(out).toContain('penicillin')
    expect(out).not.toContain('para')
    expect(out).not.toContain('penicilina')
  })

  it('traduce fármacos comunes ES→EN', () => {
    expect(traducirBasico('utilidad de la finerenona')).toContain('finerenone')
    expect(traducirBasico('diosmina')).toContain('diosmin')
    expect(traducirBasico('dosis de amoxicilina en niños')).toContain('amoxicillin')
  })

  it('ignora acentos y signos de interrogación', () => {
    const out = traducirBasico('¿tratamiento de la infección aguda?')
    expect(out).toContain('treatment')
    expect(out).toContain('infection')
    expect(out).toContain('acute')
  })

  it('no rompe con texto vacío', () => {
    expect(traducirBasico('')).toBe('')
  })

  it('detecta fármacos en español para buscar su dosis', () => {
    expect(farmacosDetectados('dosis de amoxicilina en niños')).toContain('amoxicillin')
    expect(farmacosDetectados('utilidad de la finerenona')).toContain('finerenone')
    expect(farmacosDetectados('cuánto dura la consulta')).toEqual([])
  })
})
