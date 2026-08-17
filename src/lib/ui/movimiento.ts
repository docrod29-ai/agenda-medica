'use client'
/**
 * EL SCROLL TAMBIÉN ES MOVIMIENTO — Y LA HOJA NO PUEDE APAGARLO.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `globals.css` tiene el apagador global de `prefers-reduced-motion` (§24):
 * anula animaciones, transiciones y `scroll-behavior` con `!important`. Parece
 * que con eso el producto entero respeta la preferencia. No es cierto:
 *
 *   `scrollIntoView({ behavior: 'smooth' })` NO lee `scroll-behavior` de CSS.
 *
 * Cuando el comportamiento viene como OPCIÓN de JavaScript, la especificación
 * lo aplica tal cual — el `scroll-behavior: auto !important` de la hoja no lo
 * toca. Cinco sitios del producto (el riel del expediente, el chat, dos saltos
 * de la consulta y el consultor) animaban el desplazamiento aunque el usuario
 * hubiera pedido movimiento reducido. Se descubrió en la novena rebanada de
 * V15-VISUAL-SYSTEM-001, al medir §18 pasos 8-9 contra el código real: el
 * único sitio que lo hacía bien era `CierreAlPulgar`, con su copia local.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Todo desplazamiento programático pregunta AQUÍ qué comportamiento usar.
 * Una sola implementación por la misma razón que `activable.ts`: «acuérdate
 * de consultar matchMedia» es la regla que se cumple en el primer sitio y se
 * olvida en el sexto. Hay un guardián que caza `behavior: 'smooth'` escrito a
 * mano en el código de producto.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No cubre animaciones de Web Animations API ni `requestAnimationFrame` a
 * mano (hoy no hay ninguna en el producto); si algún día aparecen, necesitan
 * su propia consulta a la preferencia. Tampoco decide CUÁNDO desplazar —
 * sólo CÓMO.
 */

/**
 * `'smooth'` si el usuario no ha pedido menos movimiento; `'auto'` (salto
 * directo) si lo pidió — o si no hay ventana (SSR), donde nada se anima.
 */
export function comportamientoScroll(): ScrollBehavior {
  if (typeof window === 'undefined' || !window.matchMedia) return 'auto'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}
