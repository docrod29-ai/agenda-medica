/**
 * GOLDEN — el bot recogía datos de salud sin aviso de privacidad.
 *
 * El portal público EXIGE el consentimiento para crear una cita: sin
 * `consentimientos.avisoPrivacidad` la ruta responde 400, y lo aceptado queda
 * guardado con su marca de tiempo. El bot de WhatsApp creaba el expediente del
 * paciente y su cita **sin aviso ninguno**: el paciente nunca lo veía y no
 * quedaba constancia de nada.
 *
 * La misma aplicación que bloquea el alta web por falta de consentimiento la
 * dejaba pasar por el canal por el que entra buena parte de los pacientes.
 */
import { describe, it, expect } from 'vitest'
import {
  mensajeAviso, aceptoElAviso, rechazoElAviso, consentimientoDelBot, selloExpediente, VERSION_AVISO,
} from '@/lib/whatsapp/aviso-bot'

describe('mensajeAviso', () => {
  const msg = mensajeAviso('Consultorio Luna', 'clin-1', 'https://app.example')

  it('nombra al responsable y la ley', () => {
    expect(msg).toContain('Consultorio Luna')
    expect(msg).toContain('LFPDPPP')
  })

  it('menciona los datos de salud y los derechos ARCO', () => {
    expect(msg).toMatch(/datos personales y de salud/i)
    expect(msg).toMatch(/rectificaci[oó]n|cancelaci[oó]n|oposici[oó]n/i)
  })

  it('lleva el enlace al aviso completo', () => {
    expect(msg).toContain('https://app.example/privacidad/clin-1')
  })

  it('sin URL base no inventa un enlace roto', () => {
    const sin = mensajeAviso('Consultorio Luna', 'clin-1', '')
    expect(sin).not.toContain('/privacidad/')
    expect(sin).toContain('LFPDPPP')   // el aviso sigue dándose
  })

  it('pide una respuesta EXPRESA', () => {
    expect(msg).toMatch(/\*S[IÍ]\*/i)
  })
})

describe('aceptoElAviso / rechazoElAviso', () => {
  it('acepta las formas normales de decir que sí', () => {
    for (const t of ['sí', 'si', 'SI', 'acepto', 'De acuerdo', 'ok', 'adelante', '1']) {
      expect(aceptoElAviso(t), t).toBe(true)
    }
  })

  it('el silencio o una frase cualquiera NO es aceptación', () => {
    // Nunca se marca aceptado por no contestar.
    for (const t of ['', '   ', 'hola', 'mañana te digo', '¿qué es eso?']) {
      expect(aceptoElAviso(t), t).toBe(false)
    }
  })

  it('un «no» se distingue de un «no entendí»: a quien ya dijo que no, no se le insiste', () => {
    expect(rechazoElAviso('no')).toBe(true)
    expect(rechazoElAviso('salir')).toBe(true)
    expect(rechazoElAviso('no entiendo')).toBe(true)   // empieza con «no»: se respeta
    expect(rechazoElAviso('hola')).toBe(false)
  })
})

describe('consentimientoDelBot', () => {
  it('guarda lo que pasó: canal, versión y hora', () => {
    const c = consentimientoDelBot('2026-08-02T10:00:00.000Z')
    expect(c).toEqual({
      avisoPrivacidad: true, informado: true,
      version: VERSION_AVISO, via: 'whatsapp',
      timestamp: '2026-08-02T10:00:00.000Z',
    })
  })

  it('usa la MISMA versión de aviso que el resto del sistema', () => {
    // Dos versiones distintas harían imposible saber qué aceptó cada paciente.
    expect(VERSION_AVISO).toMatch(/^\d{4}-\d{2}$/)
  })
})

/**
 * El sello del EXPEDIENTE, que es donde lo mira el panel de Pacientes.
 *
 * v884 dejó el consentimiento del bot sólo en la cita: el paciente que llega por
 * WhatsApp seguía apareciendo SIN aviso en su expediente, igual que antes.
 */
describe('selloExpediente', () => {
  const cfg = { nombreClinica: 'Consultorio Luna', direccion: 'Av. 1' } as never

  it('lleva versión, medio y huella del texto', () => {
    const s = selloExpediente(cfg, '2026-08-02T10:00:00.000Z')
    expect(s.aceptado).toBe(true)
    expect(s.versionAviso).toBe(VERSION_AVISO)
    expect(s.medioAceptacion).toBe('whatsapp')
    expect(s.hashTexto).toMatch(/^[a-f0-9]{64}$/)
    expect(s.fechaAceptacion).toBe('2026-08-02T10:00:00.000Z')
  })

  it('si cambia la configuración del consultorio, cambia la huella', () => {
    // `versionAviso` es una constante del código, pero el TEXTO se genera con la
    // razón social y el domicilio: sin la huella no habría forma de demostrar
    // cuál aviso aceptó cada paciente.
    const a = selloExpediente(cfg, '2026-08-02T10:00:00.000Z')
    const b = selloExpediente({ ...cfg, nombreClinica: 'Otro nombre' } as never, '2026-08-02T10:00:00.000Z')
    expect(a.hashTexto).not.toBe(b.hashTexto)
  })

  it('el mismo consultorio y el mismo texto dan la misma huella', () => {
    expect(selloExpediente(cfg, '2026-08-02T10:00:00.000Z').hashTexto)
      .toBe(selloExpediente(cfg, '2026-09-09T00:00:00.000Z').hashTexto)
  })
})
