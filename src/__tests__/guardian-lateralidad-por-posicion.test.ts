/**
 * EL GUARDIÁN VE LOS LADOS INTERCAMBIADOS, NO SÓLO LOS PERDIDOS.
 *
 * Panel de Lujo (sep-2026), ortopedista: MO-015 (P3, mejora, confirmado).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * El bloque 4 del guardián comparaba lateralidad por PRESENCIA (¿hay derecho?
 * ¿hay izquierdo? ¿hay bilateral?). Con los dos lados presentes antes y después
 * y el mismo género, «hombro derecho y pie izquierdo» → «hombro izquierdo y pie
 * derecho» pasaba con `revertido: false`. Lo salvaba a medias el conteo del
 * bloque 2 (pares prohibidos), que sólo ve el cambio cuando cruza géneros
 * (derecha↔izquierdo).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * El equipo rojo lo reprodujo con el módulo real: caso A (tobillo derecho y
 * tobillo izquierdo → izquierdo y izquierdo) revertía; caso B (hombro derecho y
 * pie izquierdo → hombro izquierdo y pie derecho) NO.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Presencia y cuenta son invariantes ante un intercambio; sólo la SECUENCIA lo
 * delata.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * El guardián compara además la secuencia de lados en orden de aparición. Es el
 * mismo principio que el conteo del bloque 2: contar (aquí, ordenar) ve lo que
 * la presencia no.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Hoy el corrector no toca esas palabras (lista protegida), así que esto vigila
 * una regla futura o una etapa de normalización que las cambie. No cubre la
 * lateralidad dentro del propio dictado (eso es `lateralidad.ts`).
 */
import { describe, it, expect } from 'vitest'
import { verificar } from '@/lib/asr/guardian-sustituciones'

describe('MO-015 · lateralidad por posición', () => {
  it('caso B del rojo: lados intercambiados con el mismo género se revierten', () => {
    const v = verificar('hombro derecho y pie izquierdo', 'hombro izquierdo y pie derecho')
    expect(v.revertido).toBe(true)
    expect(v.violaciones.map(x => x.clase)).toContain('cambio_lateralidad')
    expect(v.texto).toBe('hombro derecho y pie izquierdo')
  })

  it('y con género femenino igual', () => {
    expect(verificar('rodilla derecha y mano izquierda', 'rodilla izquierda y mano derecha').revertido).toBe(true)
  })

  it('caso A del rojo sigue revirtiendo: ambos lados presentes, uno cambiado', () => {
    const v = verificar('tobillo derecho y tobillo izquierdo', 'tobillo izquierdo y tobillo izquierdo')
    expect(v.revertido).toBe(true)
  })

  it('se reporta UNA sola vez aunque lo vean dos reglas', () => {
    const v = verificar('hombro derecho y pie izquierdo', 'hombro izquierdo y pie derecho')
    expect(v.violaciones.filter(x => x.clase === 'cambio_lateralidad')).toHaveLength(1)
  })

  it('probado al revés: la misma secuencia no revierte', () => {
    expect(verificar('hombro derecho y pie izquierdo', 'hombro derecho y pie izquierdo').revertido).toBe(false)
    // Una corrección léxica que no toca lados tampoco.
    expect(verificar('sefriaxona en brazo derecho', 'ceftriaxona en brazo derecho').revertido).toBe(false)
  })
})
