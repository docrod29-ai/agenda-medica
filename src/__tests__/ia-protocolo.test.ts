/**
 * GOLDEN — protocolo de los proveedores de IA (P1-1 · Master Loop V3 §P–T).
 *
 * Estos casos existen porque las tres reglas que fijan ya fallaron en
 * producción: un error que no distinguía cuatro problemas distintos, una
 * respuesta truncada que se reportaba como ilegible, y una cascada de modelos
 * que recorría la lista entera con una llave revocada.
 */
import { describe, it, expect } from 'vitest'
import {
  claseDe, motivoDe, falloHttp, siguienteModelo,
  leerAnthropic, leerOpenAI, cuerpoAnthropic, cuerpoOpenAI,
} from '@/lib/ia/protocolo'

describe('Un error dice QUÉ hacer, no sólo que algo falló', () => {
  it('cada código apunta a su arreglo', () => {
    // «Ambos modelos fallaron o no hay llaves válidas» mezclaba los cuatro.
    expect(claseDe(401)).toBe('llave')
    expect(claseDe(403)).toBe('llave')
    expect(claseDe(429)).toBe('limite')
    expect(claseDe(402)).toBe('saldo')
    expect(claseDe(500)).toBe('proveedor')
    expect(claseDe(503)).toBe('proveedor')
    expect(claseDe(404)).toBe('modelo')
    expect(claseDe(400)).toBe('modelo')
  })

  it('el mensaje nombra al proveedor y trae el código', () => {
    expect(motivoDe('anthropic', 401)).toMatch(/Anthropic/)
    expect(motivoDe('anthropic', 401)).toMatch(/revocada/)
    expect(motivoDe('openai', 429)).toMatch(/OpenAI/)
    expect(motivoDe('openai', 429)).toMatch(/429/)
    expect(motivoDe('openai', 500)).toMatch(/caído/)
  })

  it('el fallo carga su clase y su código para quien lo tenga que atender', () => {
    const f = falloHttp('anthropic', 402)
    expect(f).toMatchObject({ ok: false, clase: 'saldo', status: 402 })
  })
})

describe('Sólo se cambia de modelo cuando el problema ES el modelo', () => {
  it('404 y 400 sí: ese modelo no existe para esta llave', () => {
    expect(siguienteModelo(404)).toBe(true)
    expect(siguienteModelo(400)).toBe(true)
  })

  it('401 no: recorrer la lista entera sólo retrasa el mismo 401', () => {
    expect(siguienteModelo(401)).toBe(false)
    expect(siguienteModelo(403)).toBe(false)
  })

  it('429 no: reintentar empeora el límite que acaba de saltar', () => {
    expect(siguienteModelo(429)).toBe(false)
  })

  it('500 no: el proveedor está caído para todos sus modelos', () => {
    expect(siguienteModelo(500)).toBe(false)
    expect(siguienteModelo(502)).toBe(false)
  })
})

describe('Leer la respuesta sin perder lo que el proveedor ya dijo', () => {
  it('Anthropic: junta los bloques de texto y descarta los demás', () => {
    const r = leerAnthropic({
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: 'uno ' }, { type: 'thinking', text: 'X' }, { type: 'text', text: 'dos' }],
      stop_reason: 'end_turn',
    }, 'pedido')
    expect(r).toMatchObject({ ok: true, texto: 'uno dos', modelo: 'claude-sonnet-5', truncado: false })
  })

  it('Anthropic truncado: se DICE que se cortó, con el texto que alcanzó', () => {
    /**
     * Es el fallo del 30-jul: la síntesis se pasaba de max_tokens, llegaba
     * cortada a media llave y el médico leía «no se pudo generar la síntesis»
     * justo cuando había más datos que sintetizar. Decir «no se pudo leer»
     * manda a buscar el problema al sitio equivocado.
     */
    const r = leerAnthropic({ content: [{ type: 'text', text: '{"a":1,' }], stop_reason: 'max_tokens' }, 'm')
    expect(r).toMatchObject({ ok: true, truncado: true })
    expect(r.ok && r.texto).toBe('{"a":1,')
  })

  it('OpenAI: finish_reason "length" es lo mismo', () => {
    const r = leerOpenAI({ model: 'gpt-5', choices: [{ message: { content: '{"a"' }, finish_reason: 'length' }] }, 'm')
    expect(r).toMatchObject({ ok: true, truncado: true, modelo: 'gpt-5' })
  })

  it('contestar sin texto es un fallo de RESPUESTA, no un éxito vacío', () => {
    // Un éxito con texto vacío se propaga como «la nota salió en blanco» y nadie
    // sabe dónde buscar.
    expect(leerAnthropic({ content: [] }, 'm')).toMatchObject({ ok: false, clase: 'respuesta' })
    expect(leerOpenAI({ choices: [] }, 'm')).toMatchObject({ ok: false, clase: 'respuesta' })
    expect(leerAnthropic(null, 'm').ok).toBe(false)
    expect(leerOpenAI(undefined, 'm').ok).toBe(false)
  })

  it('si el proveedor no devuelve el modelo, se reporta el que se pidió', () => {
    const r = leerAnthropic({ content: [{ type: 'text', text: 'x' }] }, 'claude-opus-4-8')
    expect(r.ok && r.modelo).toBe('claude-opus-4-8')
  })
})

describe('Los cuerpos de petición', () => {
  const base = { system: 'S', user: 'U', maxTokens: 16000 }

  it('Anthropic sin caché manda el sistema como texto', () => {
    expect(cuerpoAnthropic({ ...base, modelo: 'm' })).toMatchObject({
      model: 'm', max_tokens: 16000, system: 'S',
      messages: [{ role: 'user', content: 'U' }],
    })
  })

  it('Anthropic con caché lo manda como bloque efímero', () => {
    // No es rendimiento: el sistema del Copilot son ~3 200 tokens iguales en
    // cada pase, y a precio completo son la mayor parte del costo.
    const c = cuerpoAnthropic({ ...base, modelo: 'm', cacheSystem: true }) as { system: unknown[] }
    expect(c.system).toEqual([{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }])
  })

  it('OpenAI pone el sistema como primer mensaje y sólo exige JSON si se pidió', () => {
    expect(cuerpoOpenAI({ ...base, modelo: 'g' })).not.toHaveProperty('response_format')
    expect(cuerpoOpenAI({ ...base, modelo: 'g', json: true })).toMatchObject({
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }],
    })
  })

  it('el tope de salida es el que se pide, sin valores escondidos', () => {
    // El Copilot se quedó en 4 000 mientras la nota usaba 24 000 porque cada
    // ruta llevaba el suyo enterrado.
    expect(cuerpoAnthropic({ ...base, modelo: 'm', maxTokens: 24000 })).toMatchObject({ max_tokens: 24000 })
    expect(cuerpoOpenAI({ ...base, modelo: 'g', maxTokens: 24000 })).toMatchObject({ max_completion_tokens: 24000 })
  })
})
