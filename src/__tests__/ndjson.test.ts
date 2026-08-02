/**
 * GOLDEN — «Agregar análisis a la nota» cobraba y nunca funcionaba.
 *
 * La ruta responde NDJSON; la pantalla hacía `res.json()`, que revienta en la
 * segunda línea. El médico veía «No se pudo generar el análisis» mientras el
 * servidor ya había llamado al modelo y descontado los créditos — en Premium,
 * cuatro por cada clic de un botón que no funcionó nunca.
 */
import { describe, it, expect } from 'vitest'
import { leerNdjson } from '@/lib/ndjson'

/** Una respuesta NDJSON de mentira, troceada como llega por la red. */
const respuestaCon = (trozos: string[]): Response => ({
  body: {
    getReader() {
      let i = 0
      return {
        read: async () => i < trozos.length
          ? { done: false, value: new TextEncoder().encode(trozos[i++]) }
          : { done: true, value: undefined },
      }
    },
  },
} as unknown as Response)

const linea = (o: unknown) => JSON.stringify(o) + '\n'

describe('leerNdjson', () => {
  it('junta los deltas en orden y guarda el meta', async () => {
    const r = await leerNdjson(respuestaCon([
      linea({ type: 'meta', articulos: [{ pmid: '1' }] }),
      linea({ type: 'delta', text: 'Hola ' }),
      linea({ type: 'delta', text: 'mundo' }),
      linea({ type: 'done' }),
    ]))
    expect(r.texto).toBe('Hola mundo')
    expect(r.meta?.articulos).toEqual([{ pmid: '1' }])
    expect(r.error).toBeNull()
  })

  it('aguanta una línea partida entre dos trozos de red', async () => {
    // Es el caso que hace fallar a los lectores ingenuos: el JSON llega a medias.
    const l = linea({ type: 'delta', text: 'completo' })
    const r = await leerNdjson(respuestaCon([l.slice(0, 12), l.slice(12)]))
    expect(r.texto).toBe('completo')
  })

  it('lee la última línea aunque no traiga salto final', async () => {
    const r = await leerNdjson(respuestaCon([JSON.stringify({ type: 'delta', text: 'sin salto' })]))
    expect(r.texto).toBe('sin salto')
  })

  it('un error NO tira el texto que sí llegó', async () => {
    // El stream puede fallar a la mitad; lo que alcanzó a escribirse vale.
    const r = await leerNdjson(respuestaCon([
      linea({ type: 'delta', text: 'primera parte' }),
      linea({ type: 'error', error: 'se cayó el proveedor' }),
    ]))
    expect(r.texto).toBe('primera parte')
    expect(r.error).toBe('se cayó el proveedor')
  })

  it('ignora la basura entre líneas en vez de reventar', async () => {
    const r = await leerNdjson(respuestaCon(['{ esto no es json\n', linea({ type: 'delta', text: 'ok' })]))
    expect(r.texto).toBe('ok')
  })

  it('sin cuerpo, se queda con el error en JSON normal', async () => {
    const res = { body: null, json: async () => ({ error: 'sin créditos' }) } as unknown as Response
    const r = await leerNdjson(res)
    expect(r.error).toBe('sin créditos')
    expect(r.texto).toBe('')
  })
})
