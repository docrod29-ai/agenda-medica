import { describe, it, expect } from 'vitest'
import { validarNOM004 } from '@/lib/expediente/nom004'
/**
 * Los fixtures son PARCIALES A PROPÓSITO: el test comprueba qué campos FALTAN,
 * así que el objeto incompleto ES el caso de prueba. Se afirma el tipo real en
 * vez de `any` para que un cambio del modelo rompa aquí y no en producción.
 */
import type { NotaMedica, MetadataNOM024, Medicamento } from '@/types/expediente'

/** Fabrica una nota mínima válida; cada prueba sobreescribe lo que necesita.
 *  Se castea porque el validador solo lee un subconjunto de NotaMedica. */
function nota(over: Partial<NotaMedica> = {}): NotaMedica {
  const base = {
    tipo: 'seguimiento',
    fechaConsulta: '2026-07-16T10:00:00Z',
    metadata: { medicoId: 'med-1', cedulaProfesional: '1234567' },
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: 'Refiere mejoría.', obligatorio: true },
    ],
    signosVitales: { fc: 80, ta: '120/80' },
    diagnosticos: [{ descripcion: 'Control', tipo: 'definitivo', estado: 'activo' }],
    medicamentos: [],
    alergias: [{ alergeno: 'Niega', tipo: 'otro', reaccion: '', severidad: 'leve', confirmada: true }],
  }
  return { ...base, ...over } as unknown as NotaMedica
}

describe('validarNOM004 — campos obligatorios', () => {
  it('nota completa es válida y sin errores', () => {
    const r = validarNOM004(nota())
    expect(r.valida).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('exige identificación del médico', () => {
    const r = validarNOM004(nota({ metadata: { cedulaProfesional: '123' } as MetadataNOM024 }))
    expect(r.valida).toBe(false)
    expect(r.errores).toContain('Falta identificación del médico')
  })

  it('exige cédula profesional', () => {
    const r = validarNOM004(nota({ metadata: { medicoId: 'm' } as MetadataNOM024 }))
    expect(r.errores).toContain('Falta cédula profesional del médico')
  })

  it('exige fecha de la nota', () => {
    const r = validarNOM004(nota({ fechaConsulta: '' }))
    expect(r.errores).toContain('Falta fecha y hora de la nota')
  })

  it('marca sección obligatoria vacía con su label', () => {
    const r = validarNOM004(nota({
      secciones: [{ key: 'subjetivo', label: 'Subjetivo', value: '   ', obligatorio: true } as never],
    }))
    expect(r.errores).toContain('Falta: Subjetivo')
  })

  it('primera_vez sin diagnóstico es error', () => {
    const r = validarNOM004(nota({ tipo: 'primera_vez', diagnosticos: [] }))
    expect(r.errores).toContain('Falta al menos un diagnóstico')
  })
})

describe('validarNOM004 — cruce alergia↔medicamento (regresión del bug de alérgeno vacío)', () => {
  it('BUG FIX: una alergia con alérgeno vacío NO marca falsa alergia en cada medicamento', () => {
    const r = validarNOM004(nota({
      medicamentos: [
        { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '5 días' } as Medicamento,
        { nombre: 'Omeprazol', dosis: '20 mg', via: 'oral', frecuencia: 'c/24h', duracion: '14 días' } as Medicamento,
      ],
      alergias: [{ alergeno: '', tipo: 'medicamento', reaccion: '', severidad: 'leve', confirmada: false }],
    }))
    // Antes del fix: dos falsos "Posible alergia" bloqueaban la firma.
    const falsos = r.errores.filter(e => e.includes('Posible alergia'))
    expect(falsos).toEqual([])
    expect(r.valida).toBe(true)
  })

  it('una alergia real SÍ marca el medicamento correspondiente', () => {
    const r = validarNOM004(nota({
      medicamentos: [{ nombre: 'Penicilina G', dosis: '1 MU', via: 'iv', frecuencia: 'c/6h', duracion: '7 días' } as Medicamento],
      alergias: [{ alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'rash', severidad: 'moderada', confirmada: true }],
    }))
    expect(r.errores.some(e => e.includes('Posible alergia'))).toBe(true)
    expect(r.valida).toBe(false)
  })

  it('SEGURIDAD CRUZADA: alergia a penicilina + cefalosporina bloquea la firma (antes se escapaba)', () => {
    const r = validarNOM004(nota({
      medicamentos: [{ nombre: 'Cefalexina', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '7 días' } as Medicamento],
      alergias: [{ alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'urticaria', severidad: 'moderada', confirmada: true }],
    }))
    // El match por subcadena NO ve "penicilina" en "cefalexina"; el matcher por familias sí.
    expect(r.valida).toBe(false)
    expect(r.errores.some(e => /cruzada|beta-?lact/i.test(e))).toBe(true)
  })

  it('un alérgeno de una o dos letras no dispara falsos positivos', () => {
    const r = validarNOM004(nota({
      medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '7 días' } as Medicamento],
      alergias: [{ alergeno: 'a', tipo: 'medicamento', reaccion: '', severidad: 'leve', confirmada: false }],
    }))
    expect(r.errores.some(e => e.includes('Posible alergia'))).toBe(false)
  })
})

describe('validarNOM004 — advertencias y completitud', () => {
  it('advierte cuando no hay alergias documentadas', () => {
    const r = validarNOM004(nota({ alergias: [] }))
    expect(r.advertencias.some(a => a.includes('alergias no están documentadas'))).toBe(true)
  })

  it('advierte diagnóstico infeccioso sin antimicrobiano en primera vez', () => {
    const r = validarNOM004(nota({
      tipo: 'primera_vez',
      diagnosticos: [{ descripcion: 'Neumonía adquirida en comunidad', tipo: 'definitivo', estado: 'activo' } as never],
      medicamentos: [],
    }))
    expect(r.advertencias.some(a => a.includes('sin tratamiento antimicrobiano'))).toBe(true)
  })

  it('puntajeCompletitud está entre 0 y 100', () => {
    const r = validarNOM004(nota())
    expect(r.puntajeCompletitud).toBeGreaterThanOrEqual(0)
    expect(r.puntajeCompletitud).toBeLessThanOrEqual(100)
  })
})
