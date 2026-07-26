/**
 * nexusmed-icu-005b · discusión clínica multi-voz (pase de visita UCI)
 */
import { describe, it, expect } from 'vitest'
import { atribuirRolUCI, atribuirRolesDiscusion, formatearDiscusion, esContenidoClinico } from '@/lib/uci/discusion'

describe('atribuirRolUCI (heurística)', () => {
  it('reconoce al residente que presenta', () => {
    expect(atribuirRolUCI('Les presento al paciente masculino de 54 años, día 3 de estancia').rol).toBe('residente')
  })
  it('reconoce al adscrito que decide/pregunta', () => {
    expect(atribuirRolUCI('El plan es suspender el vasopresor. ¿Por qué crees que hay acidosis?').rol).toBe('adscrito')
  })
  it('reconoce a enfermería', () => {
    expect(atribuirRolUCI('Diuresis de 30 mL la última hora, administré la sedación').rol).toBe('enfermeria')
  })
  it('desconocido si no hay señales', () => {
    expect(atribuirRolUCI('mmm ajá').rol).toBe('desconocido')
  })
})

describe('esContenidoClinico', () => {
  it('filtra saludos y ruido', () => {
    expect(esContenidoClinico('Buenos días')).toBe(false)
    expect(esContenidoClinico('ok')).toBe(false)
    expect(esContenidoClinico('El paciente cursa con acidosis metabólica')).toBe(true)
  })
})

describe('discusión multi-voz', () => {
  const turnos = [
    { hablante: 'A', texto: 'Buenos días a todos' },
    { hablante: 'B', texto: 'Les presento al paciente de 54 años, día 3 de ventilación, ingresó por choque séptico' },
    { hablante: 'A', texto: 'Muy bien. El plan es bajar la norepinefrina si mejora el lactato. ¿Qué opinas del PEEP?' },
    { hablante: 'C', texto: 'La diuresis de la última hora fue 25 mL, administré el bloqueador' },
  ]
  it('mantiene coherencia de rol por hablante', () => {
    const r = atribuirRolesDiscusion(turnos)
    expect(r.find(t => t.hablante === 'B')?.rol).toBe('residente')
    expect(r.find(t => t.hablante === 'A')?.rol).toBe('adscrito')
    expect(r.find(t => t.hablante === 'C')?.rol).toBe('enfermeria')
  })
  it('arma la transcripción etiquetada y filtra el saludo', () => {
    const txt = formatearDiscusion(turnos)
    expect(txt).not.toMatch(/Buenos días/)
    expect(txt).toMatch(/\[Médico residente\] Les presento/)
    expect(txt).toMatch(/\[Médico adscrito\] Muy bien/)
    expect(txt).toMatch(/\[Enfermería\]/)
  })
})
