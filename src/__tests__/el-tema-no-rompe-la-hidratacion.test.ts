/**
 * EL TEMA NO ROMPE LA HIDRATACIÓN — V10 · TRUTH-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En TODAS las pantallas, React 19 escupía en consola:
 *
 *   «A tree hydrated but some attributes of the server rendered HTML didn't
 *    match the client properties … - data-theme="dark"»
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Primera inspección de V10 en navegador real (9-ago-2026): el indicador de
 * «1 Issue» de Next salía encendido en la portada, /precios, /registro, /login
 * y la demo. No lo había cazado ninguna prueba porque vive en el navegador,
 * no en el árbol de React que ve vitest — la familia de «el dato tiene que
 * LLEGAR», en su variante visual: nadie había mirado del otro lado.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El script anti-parpadeo de `layout.tsx` pone `data-theme` en <html> ANTES de
 * la primera pintada (correcto: sin él, el tema claro parpadea a oscuro). Pero
 * el servidor renderiza <html> SIN ese atributo, así que al hidratar React ve
 * un atributo que él no puso y lo reporta como discrepancia. React NO lo
 * corrige («This won't be patched up»), sólo lo grita — en desarrollo como
 * error visible y en producción como trabajo extra de reconciliación.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Si un script pre-hidratación muta atributos de <html>, el elemento <html>
 * debe llevar `suppressHydrationWarning` (el patrón documentado por React y
 * usado por next-themes). Suprime SOLO la comparación de atributos de ese
 * elemento — los hijos siguen vigilados.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No comprueba que el tema efectivamente se aplique (eso se ve en navegador).
 * · No vigila otros scripts pre-hidratación que mutaran OTROS elementos.
 * · No detecta discrepancias de hidratación nuevas de otras causas: es un
 *   candado de esta causa raíz concreta, no un detector general.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

describe('el tema no rompe la hidratación (layout.tsx)', () => {
  it('el script anti-parpadeo sigue existiendo (si se quita, el claro parpadea)', () => {
    expect(layout).toMatch(/setAttribute\('data-theme'/)
  })

  it('si un script pre-hidratación muta <html>, <html> lleva suppressHydrationWarning', () => {
    const mutaHtml = /documentElement\.setAttribute\('data-theme'/.test(layout)
    if (!mutaHtml) return // sin mutación pre-hidratación no hace falta el candado
    const etiquetaHtml = layout.match(/<html[^>]*>/s)?.[0] ?? ''
    expect(etiquetaHtml).toContain('suppressHydrationWarning')
  })

  it('el default sigue siendo oscuro (identidad de marca): sin elección guardada → dark', () => {
    expect(layout).toMatch(/t === 'light' \? 'light' : 'dark'/)
  })
})
