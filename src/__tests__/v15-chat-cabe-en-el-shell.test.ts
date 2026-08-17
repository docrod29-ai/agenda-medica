/**
 * V15-MOBILE-001 (Fase 9, §22 «patient communication draft/review», §23/§24) —
 * el chat cabe DENTRO del shell: el composer nunca queda enterrado bajo el
 * BottomNav.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * La radiografía móvil de la sexta rebanada de esta fase
 * (`scripts/design/medir-trabajos-moviles-2-v15.mjs`, resultado en
 * `docs/design/capturas/v15-trabajos-moviles-2/`) midió en /chat a 390×844:
 * `composerBottom: 889` en un viewport de 844, con el BottomNav en top 791 —
 * `composerTapadoPorNav: true`. Escribir un mensaje —el corazón del único
 * trabajo de comunicación que el producto tiene hoy— ocurría en una franja
 * parcialmente ENTERRADA bajo la navegación.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La página fijaba su alto con `calc(100vh - 52px)`: la suposición de que
 * entre ella y el viewport sólo existe la topbar de 52px. Esa suposición es
 * anterior al `nx-app-shell` (cuarta rebanada de esta fase): hoy el alto real
 * disponible lo dicta `<main>` (flex:1 dentro del shell con tope), que ya
 * descuenta topbar, banners y BottomNav. Es la MISMA familia de defecto que el
 * shell sin fondo (v15-el-scroll-vive-en-main): una página que se mide contra
 * el viewport en vez de contra su contenedor real.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * 1. El chat es una pantalla-LIENZO: declara `nx-lienzo-completo` y la HOJA
 *    (globals.css) transmite el alto real por la cadena
 *    main → .page-transition → lienzo (con `:has`, sólo cuando la pantalla lo
 *    pide). NO un `calc(100vh …)` que re-adivine el shell por su cuenta —
 *    el primer intento usó `height: '100%'` inline y colapsó al alto del
 *    contenido, porque `.page-transition` (template.tsx) tiene alto auto:
 *    medido en navegador real, composer a 514px de un main de 844.
 * 2. El contrato del shell del que depende el lienzo: `<main>` sigue siendo
 *    flex con `overflowY: auto` dentro de `nx-app-shell` (si eso cambia, el
 *    lienzo deja de significar «el espacio visible»).
 * 3. §24 en el composer: textarea y botón Enviar al mínimo táctil de 44px.
 * 4. FREEZE FUNCIONAL: `enviarMensaje` se sigue llamando igual (clinicId,
 *    texto, sender con uid/email/nombre/rol) y Enter-sin-Shift sigue
 *    enviando — la rebanada fue de layout, no de lógica.
 *
 * Probado al revés (git stash del cambio): los casos 1a/1b y 3a/3b fallan
 * contra el árbol previo (resta de 100vh inline, hoja sin cadena de lienzo,
 * minHeight 42, botón sin mínimos); los casos 2 y 4 pasan antes y después —
 * protegen el contrato del shell y el freeze funcional, no el cambio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni mide píxeles: análisis estático de fuente (patrón
 *   de todos los guardianes v15-*). La geometría real (composer ENCIMA del
 *   BottomNav, tap en Enviar que llega) se verifica en navegador real con
 *   `scripts/design/capturar-chat-al-pulgar-v15.mjs`.
 * · No cubre que el chat sea comunicación AL PACIENTE: hoy /chat es
 *   médico↔asistente. El trabajo §22 «patient communication draft» hacia el
 *   paciente no tiene superficie propia todavía (el paquete de visita es
 *   POSTVISIT/Fase 8 y vive en otro programa) — esa ausencia queda declarada
 *   en el estado de V15, no resuelta aquí.
 * · No cubre teclado-en-pantalla (visualViewport): abrir el teclado del
 *   teléfono sobre el composer es comportamiento del navegador que ningún
 *   análisis estático ve; candidato a una corrida futura si la captura real
 *   lo enseña roto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const chat = readFileSync(
  join(RAIZ, 'src', 'app', '(dashboard)', 'chat', 'page.tsx'),
  'utf8',
)
const layout = readFileSync(
  join(RAIZ, 'src', 'app', '(dashboard)', 'layout.tsx'),
  'utf8',
)
const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')

describe('V15 — el chat cabe en el shell (§22/§23)', () => {
  it('1a. el chat es un lienzo de la hoja, no una resta de 100vh que re-adivina el shell', () => {
    // La raíz de la página declara la clase-lienzo…
    expect(chat).toMatch(/className="nx-lienzo-completo"/)
    // …sin ningún alto de viewport inline que la pise (la lección de
    // nx-stat-grid: un estilo inline vencería a la hoja en silencio)…
    expect(chat).not.toMatch(/calc\(100vh/)
    expect(chat).not.toMatch(/height:\s*'100(vh|dvh|%)'/)
  })

  it('1b. la cadena del alto vive en la hoja: main → .page-transition → lienzo', () => {
    // main se vuelve columna flex SÓLO cuando hay un lienzo dentro (:has)…
    expect(css).toMatch(/main:has\(\.nx-lienzo-completo\)\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*\}/)
    // …el escalón intermedio (template.tsx) transmite el alto…
    expect(css).toMatch(/main:has\(\.nx-lienzo-completo\)\s*>\s*\.page-transition\s*\{[^}]*flex:\s*1/)
    // …con min-height: 0 (sin él, un flex item no puede encogerse y el
    // contenido largo desbordaría el shell en vez de desplazarse dentro)…
    expect(css).toMatch(/main:has\(\.nx-lienzo-completo\)\s*>\s*\.page-transition\s*\{[^}]*min-height:\s*0/)
    // …y el lienzo llena su escalón.
    expect(css).toMatch(/\.nx-lienzo-completo\s*\{\s*flex:\s*1;\s*min-height:\s*0;\s*\}/)
  })

  it('1b-bis. en móvil el lienzo no hereda el claro del BottomNav (104px de aire muerto)', () => {
    // El padding-bottom de 72px de main era clearance para una barra que
    // flotaba sobre el documento; dentro del shell la barra vive DEBAJO de
    // main, así que bajo un lienzo ese claro se neutraliza (y los 16+16 del
    // colchón de páginas-documento también). Sin esto el composer quedaba a
    // ~100px de la barra: aire que el pulgar cruza en vano.
    expect(css).toMatch(/main:has\(\.nx-lienzo-completo\)\s*\{\s*padding-bottom:\s*0\s*!important;\s*\}/)
    expect(css).toMatch(/main:has\(\.nx-lienzo-completo\)\s*>\s*\.page-transition\s*\{\s*padding-top:\s*0;\s*padding-bottom:\s*0;\s*\}/)
  })

  it('1c. tampoco vuelve un maxHeight de viewport que recorte al contenedor', () => {
    expect(chat).not.toMatch(/maxHeight:\s*'100vh'/)
  })

  it('2. el contrato del shell sigue: main flex con overflowY auto (de él depende el 100%)', () => {
    expect(layout).toMatch(/<main style=\{\{ flex: 1, overflowY: 'auto' \}\}/)
    expect(layout).toMatch(/className="nx-app-shell"/)
  })

  it('3a. §24 — el textarea del composer está al mínimo táctil (44px)', () => {
    expect(chat).toMatch(/minHeight:\s*44,\s*maxHeight:\s*120/)
  })

  it('3b. §24 — el botón Enviar declara mínimos táctiles de 44×44', () => {
    expect(chat).toMatch(/minWidth:\s*44,\s*minHeight:\s*44/)
  })

  it('4a. freeze funcional — enviarMensaje conserva su contrato exacto', () => {
    expect(chat).toMatch(/await enviarMensaje\(clinicId, texto, \{\s*uid: user\.uid,\s*email: user\.email \?\? '',\s*nombre,\s*rol: role \?\? 'medico',\s*\}\)/)
  })

  it('4b. freeze funcional — Enter sin Shift sigue enviando', () => {
    expect(chat).toMatch(/e\.key === 'Enter' && !e\.shiftKey/)
    expect(chat).toMatch(/e\.preventDefault\(\)\s*\n\s*enviar\(\)/)
  })
})
