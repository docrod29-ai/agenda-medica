/**
 * GOLDEN — al paciente se le prometía un contacto que nadie sabía que debía hacer.
 *
 * El portal público le contesta al paciente «Te contactaremos para confirmar» y
 * la cita se queda en `solicitada`… sin avisarle a NADIE del consultorio. Si la
 * asistente no recarga la agenda —o mira sólo las confirmadas— el paciente
 * espera una llamada que no va a llegar, y el consultorio pierde la cita sin
 * enterarse de que la tuvo.
 *
 * El bot de WhatsApp sí manda su «🔔 Nueva cita». Eran dos caminos con dos
 * criterios sobre lo mismo. Igual con la cancelación desde el enlace del
 * paciente: v863 dejó el asiento en la bitácora y la oferta del hueco, pero el
 * consultorio seguía sin aviso propio.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('telefonoDelConsultorio', () => {
  it('prefiere el WhatsApp del consultorio', () => {
    expect(telefonoDelConsultorio({ whatsappConsultorio: '5215551234567', telefonoAdmin: '5215559999999' }))
      .toBe('5215551234567')
  })

  it('cae al teléfono administrativo si no hay WhatsApp', () => {
    expect(telefonoDelConsultorio({ telefonoAdmin: '5215559999999' })).toBe('5215559999999')
  })

  it('sin ninguno devuelve vacío, y quien llama no manda nada', () => {
    expect(telefonoDelConsultorio({})).toBe('')
    expect(telefonoDelConsultorio(null)).toBe('')
    expect(telefonoDelConsultorio(undefined)).toBe('')
  })

  it('los espacios sobrantes no crean un teléfono falso', () => {
    expect(telefonoDelConsultorio({ whatsappConsultorio: '   ' })).toBe('')
  })
})

describe('los tres caminos avisan al consultorio', () => {
  it('el alta por el portal público', () => {
    const s = leer('src', 'app', 'api', 'public', 'booking', 'route.ts')
    expect(s).toContain('avisarAlConsultorio')
    expect(s).toContain('Nueva cita por el portal')
  })

  it('la cancelación desde el enlace del paciente', () => {
    const s = leer('src', 'app', 'api', 'portal', 'route.ts')
    expect(s).toContain('avisarAlConsultorio')
    expect(s).toContain('Cancelación desde el portal')
  })

  it('el bot, que ya lo hacía', () => {
    const s = leer('src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts')
    expect(s).toMatch(/Nueva cita por WhatsApp/)
    expect(s).toMatch(/Cancelación por WhatsApp/)
  })

  it('ninguno espera al aviso: la cita del paciente no depende de él', () => {
    // `void` sin `await`: si el aviso tarda o falla, la respuesta al paciente ya
    // salió. Un aviso al consultorio nunca puede tumbar su operación.
    for (const ruta of [
      ['src', 'app', 'api', 'public', 'booking', 'route.ts'],
      ['src', 'app', 'api', 'portal', 'route.ts'],
    ]) {
      expect(leer(...ruta), ruta.join('/')).toContain('void avisarAlConsultorio(')
    }
  })
})
