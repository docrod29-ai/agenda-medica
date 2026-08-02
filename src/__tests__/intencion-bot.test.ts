/**
 * GOLDEN — «quiero agendar una consulta» nunca agendaba.
 *
 * El bot detecta las preguntas frecuentes ANTES que nada, y el patrón de la
 * pregunta de PRECIO es `/costo|precio|cobr|cuanto|pag|consulta/`: la palabra
 * **«consulta»** dispara la respuesta de precios. La frase más natural para
 * pedir cita —«quiero agendar una consulta»— hacía que el bot contestara cuánto
 * cuesta, enseñara el menú y no agendara nada.
 *
 * Y desde fuera parecía que funcionaba: contestó rápido y con información
 * correcta. El paciente cree que preguntó mal, lo intenta otra vez, o se va.
 */
import { describe, it, expect } from 'vitest'
import { intencionDelMensaje } from '@/lib/whatsapp/intencion'

/** El detector real del bot, copiado tal cual para probar contra él. */
function detectFAQ(text: string): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/horario|hora|atiende|atencion|abren|cierran|cuando/.test(t)) return 'horario'
  if (/costo|precio|cobr|cuanto|pag|consulta/.test(t)) return 'costo'
  if (/direccion|donde|ubicacion|llegar|mapa|domicilio/.test(t)) return 'direccion'
  if (/seguro|aseguradora|deducible|poliza/.test(t)) return 'seguros'
  if (/padece|enfermed|trata|especialidad|atiende|infectolog|infeccion/.test(t)) return 'padecimientos'
  if (/estacionar|parking|carro|auto/.test(t)) return 'info_extra'
  return null
}

const intencion = (t: string) => intencionDelMensaje(t, detectFAQ)

describe('intencionDelMensaje', () => {
  it('EL CASO QUE ROMPÍA: pedir cita mencionando la consulta', () => {
    expect(detectFAQ('quiero agendar una consulta')).toBe('costo')   // lo que pasaba antes
    expect(intencion('quiero agendar una consulta')).toEqual({ tipo: 'agendar' })
  })

  it('las demás formas naturales de pedir cita también agendan', () => {
    for (const frase of [
      'Necesito una cita',
      'quiero una cita por favor',
      'me gustaría agendar consulta',
      'para agendar cita',
      'quisiera reservar un horario',
      'quiero apartar lugar',
      'como puedo hacer una cita',
    ]) {
      expect(intencion(frase), frase).toEqual({ tipo: 'agendar' })
    }
  })

  it('la pregunta de precio SIGUE siendo pregunta de precio', () => {
    // Sin verbo de acción no se toca nada de lo que ya funcionaba.
    expect(intencion('¿cuánto cuesta la consulta?')).toEqual({ tipo: 'faq', clave: 'costo' })
    expect(intencion('precio')).toEqual({ tipo: 'faq', clave: 'costo' })
    expect(intencion('¿a qué hora atienden?')).toEqual({ tipo: 'faq', clave: 'horario' })
    expect(intencion('¿dónde están ubicados?')).toEqual({ tipo: 'faq', clave: 'direccion' })
  })

  it('cancelar gana aunque la frase mencione el horario', () => {
    // «Quiero cancelar mi cita de mañana a las 10» mencionaba «hora» y caía en
    // la FAQ de horarios.
    expect(intencion('quiero cancelar mi cita de mañana a las 10')).toEqual({ tipo: 'cancelar' })
  })

  it('reagendar se distingue de agendar', () => {
    expect(intencion('necesito cambiar mi cita')).toEqual({ tipo: 'reagendar' })
    expect(intencion('quiero reagendar')).toEqual({ tipo: 'reagendar' })
  })

  it('un mensaje sin intención ni tema no inventa ninguna', () => {
    expect(intencion('buenas tardes')).toEqual({ tipo: 'ninguna' })
    expect(intencion('')).toEqual({ tipo: 'ninguna' })
  })

  it('los acentos y las mayúsculas no cambian nada', () => {
    expect(intencion('QUIERO AGENDÁR UNA CONSULTA')).toEqual({ tipo: 'agendar' })
  })
})
