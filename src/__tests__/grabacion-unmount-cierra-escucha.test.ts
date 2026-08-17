/**
 * REG-309 — DESMONTAR GRABANDO DEJABA LA UI DICIENDO «ESCUCHANDO».
 *
 * Qué fallaba: la transición a grabando emitía `activo: true`, pero el cleanup
 * sólo retiraba el latido y `beforeunload`. Al navegar, el hook se desmontaba
 * sin otro render que emitiera `activo: false` y el marco global quedaba activo.
 *
 * Cómo se descubrió: auditoría de sólo lectura del modo escuchando.
 * Causa raíz: se confió el cierre a una transición de estado que no existe en
 * un unmount. Regla segura: quien monta una señal global debe cerrarla en su
 * propio cleanup.
 *
 * NO cubre la transcripción, IndexedDB ni los buffers de MediaRecorder; esos
 * caminos conservan sus guardianes propios. Aquí se prueba el contrato externo
 * observable de mount activo -> recording -> unmount.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cerrarEscuchaAlDesmontar } from '@/hooks/useGrabacionAudio'
import { avisarEscucha, EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

const HOOK = readFileSync(join(process.cwd(), 'src', 'hooks', 'useGrabacionAudio.ts'), 'utf8')

class VentanaDePrueba extends EventTarget {
  setInterval = vi.fn(() => 17)
  clearInterval = vi.fn()
}

const windowOriginal = globalThis.window

afterEach(() => {
  vi.restoreAllMocks()
  if (windowOriginal === undefined) {
    Reflect.deleteProperty(globalThis, 'window')
  } else {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowOriginal })
  }
})

describe('lifecycle de una grabación activa', () => {
  it('el cierre probado está conectado al cleanup del efecto activo', () => {
    /**
     * Probar el helper aislado no basta: la prueba anterior seguía verde si
     * alguien quitaba su llamada del cleanup y dejaba la función huérfana. El
     * defecto REG-309 vivía precisamente en esa conexión, no en la capacidad
     * del helper de emitir `false` cuando se lo invoca a mano.
     */
    expect(HOOK, 'el cierre existe, pero el unmount ya no lo ejecuta')
      .toMatch(/return \(\) => \{[\s\S]{0,300}?cerrarEscuchaAlDesmontar\(\)[\s\S]{0,40}?\}/)
  })

  it('mount -> recording -> unmount emite el cierre y apaga la UI global', () => {
    const ventana = new VentanaDePrueba()
    Object.defineProperty(globalThis, 'window', { configurable: true, value: ventana })
    const estados: boolean[] = []
    ventana.addEventListener(EVENTO_GRABANDO, event => {
      const detalle = (event as CustomEvent<DetalleDeEscucha>).detail
      if (typeof detalle?.activo === 'boolean') estados.push(detalle.activo)
    })

    // mount -> recording: es la misma emisión que hace el efecto al abrirse.
    avisarEscucha(true)
    expect(estados).toEqual([true])

    // unmount: ejecuta el cierre conectado al cleanup del hook.
    cerrarEscuchaAlDesmontar()

    expect(estados).toEqual([true, false])
  })
})
