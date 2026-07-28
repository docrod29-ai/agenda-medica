import { describe, it, expect } from 'vitest'
import { emisorDeNota, datosCertificado } from '@/lib/receta-certificado'
import { folioDeNota } from '@/lib/receta-folio'
import type { NotaMedica } from '@/types/expediente'

/**
 * E0-01 / REG-025 — el certificado del QR debe DERIVARSE de la nota autoritativa.
 *
 * Estas funciones son la mitad "pura" de la defensa: su contrato solo admite
 * `(notaId, nota)`, así que no existe forma de que un campo del body llegue al
 * certificado. Lo que se prueba aquí es que la derivación es correcta y que
 * NUNCA rellena un hueco inventando.
 *
 * Datos 100% ficticios.
 */

/** Nota sintética mínima. Cédulas y nombres inventados, no corresponden a nadie. */
function notaFixture(over: Partial<NotaMedica> = {}): NotaMedica {
  return {
    id: 'nota-abc',
    clinicId: 'clinicA',
    pacienteId: 'pac1',
    pacienteNombre: 'Paciente Sintético',
    tipo: 'seguimiento',
    metadata: {
      id: 'nota-abc', tipoNota: 'seguimiento', clinicId: 'clinicA', pacienteId: 'pac1',
      medicoId: 'uid-medico', cedulaProfesional: '2222222', especialidad: 'Medicina Interna',
      establecimiento: 'Consultorio de prueba', fechaCreacion: '2026-01-01T00:00:00.000Z',
      fechaModificacion: '2026-01-01T00:00:00.000Z', hashIntegridad: 'x', version: 1,
      estado: 'firmada', fuenteGeneracion: 'manual',
    },
    secciones: [],
    diagnosticos: [],
    medicamentos: [],
    alergias: [],
    estado: 'firmada',
    fechaConsulta: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    creadoPor: 'uid-medico',
    ...over,
  }
}

const firmaFixture = {
  nombreMedico: 'Dra. Ana Ficticia',
  cedulaProfesional: '1111111',
  especialidad: 'Medicina Interna',
  timestamp: '2026-01-01T00:00:00.000Z',
  hashFirma: 'abc',
}

describe('emisorDeNota — identidad del prescriptor según la NOTA', () => {
  it('prefiere nota.firma AUNQUE metadata diga otra cédula (snapshot inmutable al firmar)', () => {
    const e = emisorDeNota(notaFixture({ firma: firmaFixture }))
    expect(e).toEqual({ doctorNombre: 'Dra. Ana Ficticia', cedula: '1111111', origen: 'firma' })
    // metadata.cedulaProfesional era '2222222': no gana nunca sobre la firma.
    expect(e.cedula).not.toBe('2222222')
  })

  it('nota legada SIN bloque de firma → cae a metadata, con nombre vacío (metadata solo tiene un uid)', () => {
    const e = emisorDeNota(notaFixture())
    expect(e).toEqual({ doctorNombre: '', cedula: '2222222', origen: 'metadata' })
  })

  it('nota sin firma NI cédula en metadata → emisor vacío: NO se inventa', () => {
    const n = notaFixture()
    n.metadata.cedulaProfesional = ''
    expect(emisorDeNota(n)).toEqual({ doctorNombre: '', cedula: '', origen: 'ninguno' })
  })

  it('ignora firma con campos en blanco (no acredita un emisor vacío como "firma")', () => {
    const n = notaFixture({ firma: { ...firmaFixture, nombreMedico: '  ', cedulaProfesional: '' } })
    expect(emisorDeNota(n).origen).toBe('metadata')
  })
})

describe('folioDeNota — mismo folio en el papel y en el QR', () => {
  it('es determinista y estable ante reimpresión', () => {
    expect(folioDeNota('abc123def456')).toBe('RX-3DEF456')
    expect(folioDeNota('abc123def456')).toBe(folioDeNota('abc123def456'))
  })

  it('ignora separadores y normaliza a mayúsculas', () => {
    expect(folioDeNota('a-b_c.1234567')).toBe('RX-1234567')
    expect(folioDeNota('nota-xyz')).toBe('RX-NOTAXYZ')
  })

  it('sin notaId devuelve cadena vacía: el llamador decide su respaldo', () => {
    expect(folioDeNota('')).toBe('')
    expect(folioDeNota(undefined)).toBe('')
    expect(folioDeNota('---')).toBe('')
  })
})

describe('datosCertificado — todo lo que el certificado afirma sale de (notaId, nota)', () => {
  it('deriva folio + emisor de la nota firmada', () => {
    const d = datosCertificado('nota-abc123def456', notaFixture({ firma: firmaFixture }))
    expect(d.folio).toBe(folioDeNota('nota-abc123def456'))
    expect(d.doctorNombre).toBe('Dra. Ana Ficticia')
    expect(d.cedula).toBe('1111111')
    expect(d.origenEmisor).toBe('firma')
  })

  it('huellaNota solo existe si la nota TIENE medicamentos (no se acuña hash de la nada)', () => {
    expect(datosCertificado('n1', notaFixture()).huellaNota).toBeUndefined()

    const conMeds = notaFixture({
      medicamentos: [{ nombre: 'Fármaco ficticio', dosis: '1 unidad', via: 'oral', frecuencia: 'cada 8 h', duracion: '5 días' }],
    })
    const h = datosCertificado('n1', conMeds).huellaNota
    expect(h).toMatch(/^[0-9a-f]{8}$/)
    // Determinista: dos derivaciones de la misma nota dan la misma huella.
    expect(datosCertificado('n1', conMeds).huellaNota).toBe(h)
  })

  it('cambiar la dosis guardada en la nota cambia la huella de la nota', () => {
    const a = notaFixture({ medicamentos: [{ nombre: 'X', dosis: '1 unidad', via: 'oral', frecuencia: 'c/8h', duracion: '5 d' }] })
    const b = notaFixture({ medicamentos: [{ nombre: 'X', dosis: '2 unidades', via: 'oral', frecuencia: 'c/8h', duracion: '5 d' }] })
    expect(datosCertificado('n1', a).huellaNota).not.toBe(datosCertificado('n1', b).huellaNota)
  })

  it('tolera notas legadas sin arreglo de medicamentos sin reventar', () => {
    const rota = notaFixture()
    ;(rota as unknown as Record<string, unknown>).medicamentos = undefined
    expect(() => datosCertificado('n1', rota)).not.toThrow()
    expect(datosCertificado('n1', rota).huellaNota).toBeUndefined()
  })
})
