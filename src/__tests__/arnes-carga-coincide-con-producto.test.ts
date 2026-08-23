/**
 * GOLDEN — EL ARNÉS Y EL PRODUCTO DECIDEN LO MISMO.
 *
 * ── EL RIESGO QUE ESTA PRUEBA EXISTE PARA MATAR ──────────────────────────────
 *
 * `scripts/load/motor-de-simulacion.mjs` está en JavaScript para que lo pueda
 * ejecutar `node` a secas; las primitivas de producto están en TypeScript, en
 * `src/lib/reliability/`. Son dos archivos con la misma lógica de retroceso y
 * de veredicto de fallo.
 *
 * Eso es un segundo sistema esperando a divergir. El día que alguien afine el
 * backoff del producto y no el del arnés, el arnés seguirá dando verde sobre un
 * comportamiento que ya no es el que corre. Y un arnés que mide otra cosa es
 * peor que no tener arnés: da confianza falsa.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Al escribir el arnés: hizo falta copiar `esperaMs` y `veredictoDeHttp`
 * porque `.mjs` no puede importar `.ts`. La copia se hizo consciente, y esta
 * prueba es el precio que paga por existir.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Las dos implementaciones se comparan sobre una rejilla completa de entradas
 * —intentos × jitter × veredicto— y sobre todos los códigos HTTP relevantes. No
 * se comparan «unos cuantos casos»: la divergencia aparece justo en el caso que
 * nadie eligió.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No compara las colas ni el cortacircuitos: el arnés modela una cola con
 * capacidad por segundo y el producto expone `ColaEnMemoria`, que son cosas
 * distintas a propósito (una modela saturación, la otra es el contrato). Si
 * algún día el arnés adopta `ColaEnMemoria`, esta prueba debe crecer con él.
 */
import { describe, it, expect } from 'vitest'
import { esperaMs as esperaProducto, veredictoDeHttp, POLITICA_POR_DEFECTO } from '@/lib/reliability/reintentos'
import { esperaMs as esperaArnes, POLITICA, veredictoDeModo } from '../../scripts/load/motor-de-simulacion.mjs'

describe('el arnés no puede divergir del producto', () => {
  it('la política de reintentos es la misma, campo por campo', () => {
    expect(POLITICA).toEqual({
      reintentosMaximos: POLITICA_POR_DEFECTO.reintentosMaximos,
      baseMs: POLITICA_POR_DEFECTO.baseMs,
      topeMs: POLITICA_POR_DEFECTO.topeMs,
      presupuestoTotalMs: POLITICA_POR_DEFECTO.presupuestoTotalMs,
      factorSaturacion: POLITICA_POR_DEFECTO.factorSaturacion,
    })
  })

  it('el retroceso con jitter da el MISMO número en toda la rejilla', () => {
    const veredictos = ['transitorio', 'saturacion'] as const
    for (const v of veredictos) {
      for (let intento = 1; intento <= 12; intento += 1) {
        for (const j of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 0.999999]) {
          const azar = () => j
          expect(
            esperaArnes(intento, POLITICA, v, azar),
            `veredicto=${v} intento=${intento} jitter=${j}`,
          ).toBe(esperaProducto(intento, POLITICA_POR_DEFECTO, v, azar))
        }
      }
    }
  })

  it('los modos de fallo del arnés se traducen al mismo veredicto que el HTTP del producto', () => {
    const equivalencias: Array<[string, number]> = [
      ['http-429', 429],
      ['http-500', 500],
      ['http-503', 503],
      ['http-401', 401],
      ['http-403', 403],
    ]
    for (const [modo, codigo] of equivalencias) {
      expect(veredictoDeModo(modo), modo).toBe(veredictoDeHttp(codigo))
    }
    // Un timeout es transitorio por los dos caminos.
    expect(veredictoDeModo('timeout')).toBe(veredictoDeHttp(200, true))
  })
})
