/**
 * LO APRENDIDO DEL DICTADO NO TOCA EL LADO NI LA NEGACIÓN — EN NINGUNA FORMA.
 *
 * Panel de Lujo (sep-2026), auditor B-ingeniero-ia y ortopedista:
 * B-012 (P2, confirmado) y MO-007 (P2, confirmado).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * · B-012: la cabecera de `aprendizaje.ts` prometía «nada que toque una cifra,
 *   una unidad o una negación» y la negación no se comprobaba en ninguna
 *   línea: `CLASES_QUE_NUNCA_SE_APRENDEN` se exportaba y nadie la consultaba.
 *   Reproducido por el rojo: `afebril → febril` true, `niega → refiere` true.
 * · MO-007: los pares prohibidos se comparaban por FORMA EXACTA
 *   («derecha↔izquierda», «derecho↔izquierdo»), así que «derecha → izquierdo»,
 *   «derechas → izquierdas» y «bilateral → izquierdo» pasaban.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * El equipo rojo ejecutó `esAprendible` contra el módulo real con identidad
 * conocida y volcó `PARES_PROHIBIDOS`: trece pares, ninguno de negación.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La política crítica declaraba las CLASES pero no el VOCABULARIO de dos de
 * ellas (`volteo_negacion`, `cambio_lateralidad` por lema), y el filtro sólo
 * sabía comparar contra pares literales.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * clinical-safety §6: los motivos viven en `politica-critica.ts` y se
 * reutilizan. Ahora ahí viven `PALABRAS_DE_POLARIDAD`, los prefijos de negación
 * y el lema de lateralidad; `esAprendible` los consulta. Lo aprendido SÓLO
 * sesga, pero sesgar hacia el lado o la negación contraria enseña a
 * equivocarse con más confianza.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Es vocabulario: una palabra de polaridad que no esté en la lista no se
 * vigila. No cubre negaciones de varias palabras («no tiene»): el aprendizaje
 * sólo mira pares de UNA palabra, así que ésas no entran por construcción.
 */
import { describe, it, expect } from 'vitest'
import { esAprendible, identidadDe } from '@/lib/asr/aprendizaje'
import {
  PALABRAS_DE_POLARIDAD, esPalabraDeLateralidad, esPalabraDePolaridad, sonContrariasPorPrefijo,
} from '@/lib/asr/politica-critica'

const YO = identidadDe('Ernestina Quintanilla Robledo')

describe('MO-007 · lateralidad por lema, no por forma', () => {
  it.each([
    ['derecha', 'izquierdo'], ['derechas', 'izquierdas'], ['derecho', 'izquierda'],
    ['bilateral', 'izquierdo'], ['izquierdos', 'derechos'], ['derecha', 'izquierda'],
  ])('%s → %s no se aprende', (oido, corregido) => {
    expect(esAprendible({ oido, corregido }, YO)).toBe(false)
    expect(esAprendible({ oido: corregido, corregido: oido }, YO)).toBe(false)
  })

  it('ni siquiera hacia el mismo lado: el lado no es vocabulario que aprender', () => {
    expect(esAprendible({ oido: 'derecha', corregido: 'derecho' }, YO)).toBe(false)
    expect(esPalabraDeLateralidad('Izquierdas')).toBe(true)
    expect(esPalabraDeLateralidad('derechura')).toBe(false)
  })
})

describe('B-012 · la negación por fin se vigila', () => {
  it('EL CASO del rojo: afebril → febril y niega → refiere no se aprenden', () => {
    expect(esAprendible({ oido: 'afebril', corregido: 'febril' }, YO)).toBe(false)
    expect(esAprendible({ oido: 'febril', corregido: 'afebril' }, YO)).toBe(false)
    expect(esAprendible({ oido: 'niega', corregido: 'refiere' }, YO)).toBe(false)
  })

  it('tampoco una palabra de polaridad hacia cualquier otra cosa', () => {
    expect(esAprendible({ oido: 'niega', corregido: 'nieve' }, YO)).toBe(false)
    expect(esAprendible({ oido: 'presenta', corregido: 'presente' }, YO)).toBe(false)
    expect(esAprendible({ oido: 'ausencia', corregido: 'esencia' }, YO)).toBe(false)
  })

  it('el vocabulario tiene las dos caras: las que niegan y las que afirman', () => {
    expect(PALABRAS_DE_POLARIDAD).toContain('niega')
    expect(PALABRAS_DE_POLARIDAD).toContain('refiere')
    expect(esPalabraDePolaridad('NEGATIVO')).toBe(true)
  })

  it('contrarias por prefijo: a-, in-, im-, des-', () => {
    expect(sonContrariasPorPrefijo('afebril', 'febril')).toBe(true)
    expect(sonContrariasPorPrefijo('indoloro', 'doloro')).toBe(true)
    expect(sonContrariasPorPrefijo('deshidratado', 'hidratado')).toBe(true)
    expect(sonContrariasPorPrefijo('febril', 'febril')).toBe(false)
    expect(sonContrariasPorPrefijo('ceftriaxona', 'sefriaxona')).toBe(false)
  })

  it('probado al revés: el caso del Dr. sigue aprendiéndose', () => {
    expect(esAprendible({ oido: 'sefriaxona', corregido: 'ceftriaxona' }, YO)).toBe(true)
  })
})
