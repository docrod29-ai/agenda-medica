import { describe, it, expect } from 'vitest'
import { generarAvisoPrivacidad } from '@/lib/aviso-privacidad'
import { generarContratoEncargo } from '@/lib/contrato-encargo'
import type { ClinicConfig } from '@/types'

const cfg = (o: Partial<ClinicConfig>): ClinicConfig => ({
  nombreMedico: 'Dr. Prueba', nombreClinica: 'Clínica Prueba', direccion: 'Calle 1',
  googleMapsUrl: '', telefonoAdmin: '', whatsappConsultorio: '', zonaHoraria: 'America/Mexico_City',
  // el resto de campos requeridos no importan para estas pruebas de texto
  ...o,
} as ClinicConfig)

describe('generarAvisoPrivacidad', () => {
  it('usa razón social, ARCO y responsable, pero NUNCA el RFC (protección)', () => {
    const t = generarAvisoPrivacidad(cfg({ razonSocial: 'Servicios Médicos SA de CV', rfc: 'SME010101AAA', correoArco: 'arco@sme.mx', responsablePrivacidad: 'Lic. Ana' }))
    expect(t).toContain('Servicios Médicos SA de CV')
    expect(t).not.toContain('SME010101AAA')   // el RFC no debe aparecer en el aviso público
    expect(t).not.toContain('RFC')
    expect(t).toContain('arco@sme.mx')
    expect(t).toContain('Lic. Ana')
    expect(t).toContain('CONSERVACIÓN, BLOQUEO Y ELIMINACIÓN')
  })
  it('usa el domicilio del CONSULTORIO, nunca el domicilio fiscal', () => {
    const t = generarAvisoPrivacidad(cfg({ direccion: 'Consultorio 123', domicilioFiscal: 'Casa Fiscal 999' }))
    expect(t).toContain('Consultorio 123')
    expect(t).not.toContain('Casa Fiscal 999')
  })
  it('cae a nombreClinica sin datos fiscales', () => {
    const t = generarAvisoPrivacidad(cfg({}))
    expect(t).toContain('Clínica Prueba')
    expect(t).not.toContain('RFC')
  })
})

describe('generarContratoEncargo', () => {
  it('inserta responsable, RFC y advertencia de revisión legal', () => {
    const t = generarContratoEncargo(cfg({ razonSocial: 'Med SA', rfc: 'MED990909XXX' }))
    expect(t).toContain('Med SA')
    expect(t).toContain('MED990909XXX')
    expect(t).toContain('ENCARGADO')
    expect(t).toContain('revisado por un asesor legal')
  })
  it('usa placeholders cuando faltan datos', () => {
    expect(generarContratoEncargo(cfg({}))).toContain('[RFC del Responsable]')
  })
})
