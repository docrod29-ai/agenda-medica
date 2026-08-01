/**
 * «NO HAY SESIÓN ACTIVA» A UN MÉDICO QUE LLEVA TODA LA MAÑANA DENTRO.
 *
 * `fetchAutenticado` leía `auth.currentUser` y, si venía vacío, lanzaba de
 * inmediato. El problema es CUÁNDO viene vacío: Firebase restaura la sesión de
 * forma asíncrona, así que durante los primeros instantes tras cargar una
 * pantalla `currentUser` es `null` aunque el usuario esté perfectamente dentro.
 *
 * Cualquier pantalla que pidiera datos al montarse —el patrón más natural que
 * existe— enseñaba un error rojo. Recargar a veces lo arreglaba y a veces no,
 * que es la peor clase de fallo porque parece de red.
 *
 * Se descubrió mirando dos pantallas nuevas en un navegador de verdad. Ninguna
 * prueba lo habría visto: la ruta respondía bien y el componente pintaba bien.
 * Lo único roto era el INSTANTE — y eso es justo lo que se prueba aquí.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Un `onAuthStateChanged` de mentira que se puede disparar cuando queramos.
 *
 * Va en `vi.hoisted` porque `vi.mock` se eleva por encima de las declaraciones
 * del archivo: sin esto, la fábrica del mock corre antes de que exista la
 * variable y revienta con «cannot access before initialization».
 */
const h = vi.hoisted(() => ({
  emitir: null as ((u: unknown) => void) | null,
  estadoAuth: { currentUser: null as unknown },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    h.emitir = cb
    return () => { h.emitir = null }
  },
}))
vi.mock('@/lib/firebase', () => ({ auth: h.estadoAuth }))

import { usuarioCuandoSePueda } from '@/lib/auth-client'

beforeEach(() => { h.estadoAuth.currentUser = null; h.emitir = null })

describe('esperar la sesión en vez de darla por perdida', () => {
  it('con la sesión YA restaurada responde de inmediato', async () => {
    h.estadoAuth.currentUser = { uid: 'u1' }
    await expect(usuarioCuandoSePueda()).resolves.toEqual({ uid: 'u1' })
  })

  it('EL CASO DEL FALLO: aún no está, pero llega', async () => {
    // Es el instante exacto que rompía las pantallas al montarse.
    const p = usuarioCuandoSePueda(1000)
    expect(h.emitir).not.toBeNull()
    h.emitir!({ uid: 'u2' })
    await expect(p).resolves.toEqual({ uid: 'u2' })
  })

  it('si Firebase dice que NO hay nadie, se respeta', async () => {
    // Sesión cerrada de verdad: sigue fallando, como antes.
    const p = usuarioCuandoSePueda(1000)
    h.emitir!(null)
    await expect(p).resolves.toBeNull()
  })

  it('NO SE QUEDA ESPERANDO PARA SIEMPRE', async () => {
    /**
     * Si Firebase nunca contesta, una pantalla girando indefinidamente es peor
     * que un error claro: el médico no sabe si esperar o recargar.
     */
    vi.useFakeTimers()
    const p = usuarioCuandoSePueda(50)
    await vi.advanceTimersByTimeAsync(60)
    await expect(p).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('la primera respuesta manda: no la pisa el temporizador', async () => {
    vi.useFakeTimers()
    const p = usuarioCuandoSePueda(50)
    h.emitir!({ uid: 'u3' })
    await vi.advanceTimersByTimeAsync(100)
    await expect(p).resolves.toEqual({ uid: 'u3' })
    vi.useRealTimers()
  })
})
