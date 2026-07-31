/**
 * REG-070 — el Copilot fallaba justo cuando había MÁS datos.
 *
 * El 30-jul-2026, en producción: con el panel VACÍO el Copilot razonaba bien; con
 * el panel LLENO —21 campos, seis alertas, las escalas calculadas— contestaba
 * «no pudo generar la síntesis». Al revés de lo que uno esperaría, y por eso
 * costó verlo.
 *
 * Causa: `max_tokens: 4000`. La síntesis por sistemas de un paciente completo se
 * pasa de ahí, así que la respuesta llegaba **cortada a media llave** y
 * `JSON.parse` la rechazaba ENTERA: ocho problemas bien razonados se tiraban
 * porque el noveno venía partido. La nota de consulta ya usaba 24 000 por la
 * misma razón.
 *
 * Dos arreglos: el espacio sube a 16 000, y un JSON truncado se recorta hasta su
 * último elemento COMPLETO en vez de perderse del todo.
 */
import { describe, it, expect } from 'vitest'
import { parseSalidaCopilot } from '@/lib/uci/copilot'

const COMPLETO = JSON.stringify({
  resumen: 'Choque cardiogénico en VA-ECMO.',
  problemas: [
    { sistema: 'respiratorio', titulo: 'SDRA moderado' },
    { sistema: 'hemodinamico', titulo: 'Hipoperfusión persistente' },
  ],
  faltantesClave: ['PaO2'], seguridad: [],
})

describe('REG-070 · un JSON completo se lee entero', () => {
  it('no se toca lo que ya funcionaba', () => {
    const r = parseSalidaCopilot(COMPLETO)
    expect(r?.problemas).toHaveLength(2)
    expect(r?.resumen).toContain('VA-ECMO')
    expect(r?.faltantesClave).toEqual(['PaO2'])
  })

  it('lo encuentra aunque venga con prosa alrededor', () => {
    expect(parseSalidaCopilot(`Aquí va:\n${COMPLETO}\nEso es todo.`)?.problemas).toHaveLength(2)
  })
})

describe('REG-070 · un JSON cortado salva lo que alcanzó', () => {
  it('se queda con los problemas COMPLETOS y descarta el partido', () => {
    const cortado = COMPLETO.slice(0, COMPLETO.indexOf('"faltantesClave"'))
      + '{"sistema":"hidrometab'
    const r = parseSalidaCopilot(cortado)
    expect(r, 'una síntesis parcial vale más que ninguna').not.toBeNull()
    expect(r!.problemas.length).toBeGreaterThanOrEqual(2)
    expect(r!.resumen).toContain('VA-ECMO')
  })

  it('cortado en medio de un texto con comillas tampoco rompe', () => {
    const r = parseSalidaCopilot('{"resumen":"Paciente con \\"choque\\" refract')
    // O lo salva o devuelve null, pero NUNCA lanza.
    expect(() => parseSalidaCopilot('{"resumen":"a\\"b')).not.toThrow()
    expect(r === null || typeof r.resumen === 'string').toBe(true)
  })

  it('si no hay NADA completo que salvar, devuelve null en vez de inventar', () => {
    expect(parseSalidaCopilot('{"resu')).toBeNull()
  })

  it('texto sin ningún JSON devuelve null', () => {
    expect(parseSalidaCopilot('No puedo ayudarte con eso.')).toBeNull()
    expect(parseSalidaCopilot('')).toBeNull()
  })

  it('nunca lanza, pase lo que pase', () => {
    for (const basura of ['{', '}', '[]', '{"a":[{', '{"a":"\\\\', '{{{{', 'null', '{"a":1']) {
      expect(() => parseSalidaCopilot(basura), basura).not.toThrow()
    }
  })
})
