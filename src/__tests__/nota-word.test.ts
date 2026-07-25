import { describe, it, expect } from 'vitest'
import { construirNotaHTML } from '@/lib/nota-word'
import type { NotaMedica } from '@/types/expediente'

function notaBase(over: Partial<NotaMedica> = {}): NotaMedica {
  return {
    id: 'n1', clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Juan Pérez',
    tipo: 'consulta_externa',
    metadata: {
      id: 'n1', tipoNota: 'consulta_externa', clinicId: 'c1', pacienteId: 'p1',
      medicoId: 'm1', cedulaProfesional: '12345', especialidad: 'Medicina Interna',
      establecimiento: 'Consultorio Central', fechaCreacion: '2026-07-24T10:00:00Z',
      fechaModificacion: '2026-07-24T10:00:00Z', hashIntegridad: '', version: 1,
      estado: 'firmada', fuenteGeneracion: 'manual',
    },
    fechaConsulta: '2026-07-24T10:00:00Z',
    resumenEjecutivo: 'Paciente con tos',
    secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Tos de 3 días' }],
    signosVitales: { ta: '120/80', fc: '72' },
    diagnosticos: [{ descripcion: 'Faringitis', codigoCIE10: 'J02.9' }],
    medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'c/8h', duracion: '7 días' }],
    ...over,
  } as NotaMedica
}

describe('construirNotaHTML', () => {
  it('incluye el encabezado, paciente, secciones, dx y medicamentos', () => {
    const html = construirNotaHTML(notaBase(), null, { edad: 30, sexo: 'M', alergias: 'Penicilina' })
    expect(html).toContain('Juan Pérez')
    expect(html).toContain('Cédula Prof. 12345')
    expect(html).toContain('Consultorio Central')
    expect(html).toContain('Tos de 3 días')
    expect(html).toContain('Faringitis')
    expect(html).toContain('Amoxicilina')
    expect(html).toContain('Penicilina')
    expect(html).toContain('WordSection1') // usa @page carta
  })

  it('marca [FALTA CÉDULA PROFESIONAL] cuando no hay cédula', () => {
    const n = notaBase()
    n.metadata.cedulaProfesional = ''
    const html = construirNotaHTML(n, null)
    expect(html).toContain('[FALTA CÉDULA PROFESIONAL]')
  })

  it('escapa HTML para no romper el documento ni inyectar', () => {
    const html = construirNotaHTML(notaBase({ pacienteNombre: '<script>x</script>' }), null)
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('usa tamaño carta (216x279) en el @page', () => {
    const html = construirNotaHTML(notaBase(), null)
    expect(html).toContain('216mm 279mm')
  })
})
