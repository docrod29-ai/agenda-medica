/**
 * V15-MOBILE-001 (Fase 9, §22/§24) — el aviso de recordatorios push
 * (`NotificacionesPushOptIn`) ya no tapa la zona del pulgar en móvil.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * No lo encontró una prueba: se comió el TAP de dos arneses de captura
 * distintos. El banner era `position:fixed; bottom:16; z-index:1000` — en
 * 390px eso es el ancho completo de la pantalla, montado SOBRE el BottomNav
 * (z-45) y toda la zona del pulgar. `capturar-cierre-al-pulgar-v15.mjs` tuvo
 * que esquivarlo sembrando su flag de descarte y dejó el hallazgo anotado en
 * V15_CURRENT_ITERATION.md: «en móvil, ese banner debería ser una fila del
 * flujo o una hoja, no un fixed sobre la navegación». Un médico con el aviso
 * abierto NO PODÍA tocar la navegación durante los 3+ segundos que tardara en
 * decidir — y el banner aparece justo al entrar, cuando más navega.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La posición vive en la HOJA (`.nx-push-optin`), no inline: el media
 *    query móvil no puede ganar contra un `style={{position:'fixed'}}`
 *    (la lección de nx-stat-grid, ya cazada dos veces en esta fase).
 * 2. En ≤768px la hoja lo ancla ENCIMA del BottomNav: `bottom: calc(53px…)`
 *    con safe-area — 53px es el alto real medido del BottomNav.
 * 3. Su z-index (44) queda DEBAJO del BottomNav (45): si la geometría
 *    volviera a fallar algún día, gana la NAVEGACIÓN, nunca el aviso.
 * 4. §24: en táctil, Activar/Después suben a 44px y la X gana área de 44×44.
 * 5. El FAB de ayuda (z-60, misma esquina) cede el paso mientras la hoja
 *    pregunta — mismo patrón que ya usa al enfocar un input.
 *
 * Probado al revés (git stash de los 2 archivos): los casos de clase, hoja y
 * z-index fallan contra el árbol previo (el contenedor traía la posición
 * inline con z-1000 y la clase no existía en globals.css).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni mide píxeles: es análisis estático de fuente
 *   (patrón de todos los guardianes v15-*). La geometría real —banner y
 *   BottomNav sin intersección, tap de navegación que llega CON el aviso
 *   abierto— se mide en navegador real con
 *   `scripts/design/capturar-push-optin-v15.mjs`.
 * · No cubre la lógica de permisos de Notification API ni el programador de
 *   avisos (`useNotificacionesCitas`) — esta rebanada no los tocó y el freeze
 *   se comprueba abajo por fuente, no por comportamiento.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const BANNER = leer('src/components/NotificacionesPushOptIn.tsx')
const CSS = leer('src/app/globals.css')
const BOTTOM_NAV = leer('src/components/BottomNav.tsx')

const bloqueCss = (selector: string, desde = CSS) => {
  const idx = desde.indexOf(selector)
  expect(idx, `${selector} debe existir en globals.css`).toBeGreaterThan(0)
  return desde.slice(idx, desde.indexOf('}', idx) + 1)
}

describe('V15 — push opt-in: la posición vive en la hoja, no inline', () => {
  it('el contenedor usa la clase y NO trae position/bottom/zIndex inline', () => {
    expect(BANNER).toContain('className="nx-push-optin"')
    // El JSX del contenedor no puede pisar a la hoja (lección nx-stat-grid):
    // se mira SÓLO la etiqueta de apertura, hasta su primer `>`.
    const desde = BANNER.indexOf('<div className="nx-push-optin"')
    const raiz = BANNER.slice(desde, BANNER.indexOf('>', desde) + 1)
    expect(raiz).not.toContain('style=')
    // El patrón viejo no puede volver en ninguna parte del archivo.
    expect(BANNER).not.toMatch(/position:\s*'fixed'/)
    expect(BANNER).not.toMatch(/zIndex:\s*1000/)
  })

  it('la hoja define la tarjeta de escritorio: fixed, abajo-derecha, máx 360px', () => {
    const bloque = bloqueCss('.nx-push-optin {')
    expect(bloque).toContain('position: fixed')
    expect(bloque).toContain('max-width: 360px')
  })
})

describe('V15 — push opt-in móvil: hoja ENCIMA del BottomNav, nunca sobre él', () => {
  it('el media query ≤768px lo ancla por encima de los 53px del BottomNav, con safe-area', () => {
    const movil = CSS.slice(CSS.indexOf('.nx-push-optin {'))
    const query = movil.slice(movil.indexOf('@media (max-width: 768px)'))
    const reposicion = bloqueCss('.nx-push-optin {', query)
    expect(reposicion).toMatch(/bottom:\s*calc\(53px \+ .*env\(safe-area-inset-bottom/)
    expect(reposicion).toContain('max-width: none')
  })

  it('su z-index queda DEBAJO del BottomNav: si vuelven a solaparse, gana la navegación', () => {
    const zBanner = Number(bloqueCss('.nx-push-optin {').match(/z-index:\s*(\d+)/)?.[1])
    const zNav = Number(BOTTOM_NAV.match(/zIndex:\s*(\d+)/)?.[1])
    expect(zBanner).toBeGreaterThan(0)
    expect(zNav).toBeGreaterThan(0)
    expect(zBanner).toBeLessThan(zNav)
  })

  it('§24: Activar/Después y la X llevan clase, y la hoja les da 44px táctiles', () => {
    // Las dos acciones comparten la clase (aparecen dos veces en el JSX).
    expect(BANNER.match(/className="nx-push-optin-accion"/g)?.length).toBe(2)
    expect(BANNER).toContain('className="nx-push-optin-cerrar"')
    const accion = bloqueCss('.nx-push-optin-accion {')
    expect(Number(accion.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
    const cerrar = bloqueCss('.nx-push-optin-cerrar {')
    expect(Number(cerrar.match(/min-width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
    expect(Number(cerrar.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('el FAB de ayuda cede el paso mientras la hoja pregunta', () => {
    const fab = bloqueCss('body:has(.nx-push-optin) .boton-ayuda-fab {')
    expect(fab).toContain('pointer-events: none')
  })
})

describe('V15 — freeze funcional: la conducta del aviso quedó exactamente igual', () => {
  it('mismo flag de descarte, mismo retraso de 3s, mismo gate del programador', () => {
    expect(BANNER).toContain("const DISMISS_KEY = 'agenda-medica:push-dismissed'")
    expect(BANNER).toContain('setTimeout(() => setVisible(true), 3000)')
    // El programador de avisos sólo se monta con permiso concedido.
    expect(BANNER).toContain('concedido ? <ProgramadorNotificaciones /> : null')
    expect(BANNER).toContain('{concedido && <ProgramadorNotificaciones />}')
  })

  it('aceptar sigue pidiendo el permiso real y descartar sigue escribiendo el flag', () => {
    expect(BANNER).toContain('await solicitarPermisoPush()')
    expect(BANNER).toContain("localStorage.setItem(DISMISS_KEY, '1')")
  })

  it('la X conserva su nombre accesible (arreglo de la 2ª rebanada de Patient Workspace)', () => {
    expect(BANNER).toContain('aria-label="Cerrar aviso de notificaciones"')
  })

  it('el aviso es un landmark con nombre: su contenido no queda fuera de toda región (axe `region`)', () => {
    const desde = BANNER.indexOf('<div className="nx-push-optin"')
    const apertura = BANNER.slice(desde, BANNER.indexOf('>', desde) + 1)
    expect(apertura).toContain('role="region"')
    expect(apertura).toContain('aria-label="Aviso de recordatorios de citas"')
  })
})
