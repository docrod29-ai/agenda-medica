import { describe, it, expect } from 'vitest'
import {
  MARCA_SUGERENCIA, tieneSugerencias, contarSugerencias,
  aceptarSugerencias, quitarSugerencias, resolverSugerencias, sugerenciasPendientes,
} from '@/lib/expediente/sugerencias-ia'

/**
 * Estas funciones deciden QUÉ entra a una nota clínica firmada con cédula
 * profesional. Se prueban con el caso real que las motivó: el médico dicta
 * "faringitis, le doy amoxicilina" y el modelo completa el resto.
 */
const PLAN = [
  'Amoxicilina 500 mg VO — indicada por el médico.',
  `${MARCA_SUGERENCIA} Intervalo cada 8 h por 7 días.`,
  `${MARCA_SUGERENCIA} Signos de alarma: disnea, incapacidad para deglutir.`,
].join('\n')

describe('detección', () => {
  it('encuentra las líneas que el médico no dictó', () => {
    expect(tieneSugerencias(PLAN)).toBe(true)
    expect(contarSugerencias(PLAN)).toBe(2)
  })

  it('una nota enteramente dictada no tiene nada pendiente', () => {
    expect(tieneSugerencias('Amoxicilina 500 mg VO cada 8 h por 7 días.')).toBe(false)
    expect(contarSugerencias('Amoxicilina 500 mg VO.')).toBe(0)
  })

  it('no revienta con nulo, indefinido ni vacío', () => {
    expect(tieneSugerencias(null)).toBe(false)
    expect(tieneSugerencias(undefined)).toBe(false)
    expect(contarSugerencias('')).toBe(0)
  })
})

describe('aceptar — el médico las hace suyas', () => {
  it('conserva el contenido y borra solo la marca', () => {
    const r = aceptarSugerencias(PLAN)
    expect(r).toContain('Intervalo cada 8 h por 7 días.')
    expect(r).toContain('Signos de alarma')
    expect(r).not.toContain(MARCA_SUGERENCIA)
  })

  it('lo dictado por el médico queda intacto', () => {
    expect(aceptarSugerencias(PLAN)).toContain('Amoxicilina 500 mg VO — indicada por el médico.')
  })

  it('aceptar dos veces no cambia nada (idempotente)', () => {
    const una = aceptarSugerencias(PLAN)
    expect(aceptarSugerencias(una)).toBe(una)
  })
})

describe('quitar — el médico NO las avala', () => {
  it('elimina la LÍNEA COMPLETA, no solo la marca', () => {
    // Dejar el texto sin marca sería reintroducir el problema original: conducta
    // clínica no indicada, ya indistinguible de lo dictado.
    const r = quitarSugerencias(PLAN)
    expect(r).not.toContain('Intervalo cada 8 h')
    expect(r).not.toContain('Signos de alarma')
    expect(r).not.toContain(MARCA_SUGERENCIA)
  })

  it('lo que el médico sí dictó sobrevive', () => {
    expect(quitarSugerencias(PLAN)).toBe('Amoxicilina 500 mg VO — indicada por el médico.')
  })

  it('si TODO era sugerencia, la sección queda vacía y no con basura', () => {
    expect(quitarSugerencias(`${MARCA_SUGERENCIA} a\n${MARCA_SUGERENCIA} b`)).toBe('')
  })
})

describe('resolver sobre la nota completa', () => {
  const secciones = [
    { key: 'padecimiento', value: 'Odinofagia de 3 días.' },
    { key: 'planTratamiento', value: PLAN },
    { key: 'planAbordajeDx', value: `${MARCA_SUGERENCIA} Exudado faríngeo.` },
    { key: 'vacia', value: '' },
  ]

  it('cuenta todas las pendientes de la nota', () => {
    expect(sugerenciasPendientes(secciones)).toBe(3)
  })

  it('quitar deja la nota sin ninguna pendiente', () => {
    expect(sugerenciasPendientes(resolverSugerencias(secciones, 'quitar'))).toBe(0)
  })

  it('aceptar TAMBIÉN deja la nota sin pendientes — se puede firmar', () => {
    const r = resolverSugerencias(secciones, 'aceptar')
    expect(sugerenciasPendientes(r)).toBe(0)
    expect(r[2].value).toBe('Exudado faríngeo.')   // el contenido sigue ahí
  })

  it('no toca las secciones que no tenían nada marcado', () => {
    const r = resolverSugerencias(secciones, 'quitar')
    expect(r[0]).toBe(secciones[0])   // misma referencia: intacta
    expect(r[3]).toBe(secciones[3])
  })
})
