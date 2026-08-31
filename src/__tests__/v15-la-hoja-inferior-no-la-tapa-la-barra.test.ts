/**
 * V15-WORKFLOW-BENCHMARK-001 (WF-04, teléfono) — la barra del pulgar tapaba el
 * pie de la hoja inferior, y con él la compuerta de consentimiento.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * Intentando grabar una consulta en el teléfono, no leyendo CSS. WF-04 del
 * banco de flujos abre `/consulta/<paciente>` a 390×844, pulsa «Grabar la
 * consulta» y espera la compuerta. La compuerta APARECÍA —el modal se pintaba
 * entero— y el clic sobre «Confirmo el consentimiento e iniciar» agotaba 30
 * segundos sin llegar nunca.
 *
 * Medido en el navegador, con el modal abierto (390×844):
 *
 *   botón «Confirmo el consentimiento e iniciar»   779 → 823
 *   barra del pulgar (.bottom-nav) empieza en      791
 *   document.elementFromPoint(centro del botón)    <a> de la barra
 *   tapado                                          true
 *
 * O sea: el control primario de la compuerta legal del instrumento principal
 * del producto no recibía el toque. En el teléfono **no se podía empezar a
 * grabar a un paciente que no hubiera consentido antes**, y no había ninguna
 * otra salida — «Cancelar» estaba igual de tapado.
 *
 * Se le escapó a todo lo anterior por una razón que conviene dejar escrita: el
 * primer intento del banco midió los dos anchos sobre el MISMO paciente, y
 * como `yaConsintio` lee `patient.consentimientoGrabacion.fecha` —que vive en
 * el expediente—, la corrida de escritorio dejaba el consentimiento asentado y
 * la del teléfono entraba a grabar sin ver la compuerta. El defecto sólo
 * aparece con un paciente que no ha consentido nunca.
 *
 * ── LA CAUSA RAÍZ ─────────────────────────────────────────────────────────
 *
 * Por debajo de 768px el modal es una HOJA INFERIOR: `.modal-overlay` pasa a
 * `align-items: flex-end; padding: 0`, así que la hoja se pega al borde de
 * abajo — que es justo donde vive la barra del pulgar.
 *
 * `<main>` ya reservaba esa banda desde V15-MOBILE-001, con su comentario
 * explicando que «si solo dejáramos 70px, esos botones quedaban debajo y no se
 * podían tocar». La hoja inferior nunca recibió la misma reserva. Un
 * contenedor aprendió la lección y el otro no.
 *
 * ── LA REGLA QUE LO HACE SEGURO ───────────────────────────────────────────
 *
 * El pie de la hoja reserva LA MISMA banda que `<main>`, con la misma
 * constante (72px + `env(safe-area-inset-bottom)`). La misma a propósito: dos
 * reservas distintas de la misma barra divergen la primera vez que la barra
 * cambia de alto, que es REG-318 aplicado a una medida.
 *
 * Comprobado después en el navegador, mismo ancho y mismo modal:
 *
 *   botón                                          707 → 751
 *   document.elementFromPoint(centro del botón)    button.btn.btn-primary
 *   tapado                                          false
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 *  · NO prueba el apilado (`z-index`). El overlay declara 100 y la barra 45, y
 *    aun así la barra ganaba el `elementFromPoint`: por qué exactamente sigue
 *    SIN explicar, y se deja dicho en vez de inventarse una razón. Lo que esta
 *    regla garantiza es que el pie no aterrice en esa banda, que es cierto
 *    gane quien gane el apilado. Si alguien arregla el apilado, esta reserva
 *    sigue siendo correcta y deja de ser lo único que sostiene el caso.
 *  · NO cubre los avisos flotantes que también viven en esa banda
 *    (`NotificacionesPushOptIn`), que son deuda aparte y siguen anotados.
 *  · NO mide el modal a otros anchos: por encima de 768px no es hoja inferior
 *    y la barra del pulgar ni siquiera se pinta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** El bloque `@media (max-width: 768px)` que convierte el modal en hoja inferior. */
function bloqueDeLaHojaInferior(): string {
  const i = css.indexOf('.modal-overlay { align-items: flex-end; padding: 0; }')
  expect(i, 'la hoja inferior de ≤768px dejó de existir: esta prueba mide otra cosa').toBeGreaterThan(-1)
  // Desde el inicio del bloque de media hasta su cierre.
  const desde = css.lastIndexOf('@media (max-width: 768px)', i)
  const hasta = css.indexOf('\n}', i)
  return css.slice(desde, hasta)
}

describe('la hoja inferior no se esconde detrás de la barra del pulgar', () => {
  it('el pie de la hoja reserva la banda de la barra', () => {
    const bloque = bloqueDeLaHojaInferior()
    expect(bloque).toMatch(/\.modal-footer\s*\{[^}]*padding-bottom:\s*calc\([^)]*72px/)
  })

  it('y reserva también el área segura del teléfono con notch', () => {
    const bloque = bloqueDeLaHojaInferior()
    expect(bloque).toMatch(/\.modal-footer\s*\{[^}]*env\(safe-area-inset-bottom/)
  })

  it('usa LA MISMA constante que `main`, no una copia con otro número', () => {
    /* `main` reserva `calc(72px + env(safe-area-inset-bottom, 0px))`. Si un día
       la barra cambia de alto, las dos reservas tienen que moverse juntas: dos
       números distintos para la misma barra es cómo se rompe esto en silencio. */
    /* El ancla `(?:^|\n)\s*main\s*\{` busca la regla de `main` A SECAS. Sin ella
       el patrón casaba con cualquier selector TERMINADO en `main {` —incluido
       `html:has(.nx-push-optin) main {`, que aparta el final de la lista
       mientras el aviso de notificaciones pregunta— y este caso empezó a
       comparar el pie de la hoja contra una reserva CONDICIONAL que no es la
       de la barra. Falló con «expected '72' to be '236'». */
    const dePrincipal = css.match(/(?:^|\n)\s*main\s*\{[^}]*padding-bottom:\s*calc\((\d+)px/)
    expect(dePrincipal, 'la reserva de <main> desapareció: las dos van juntas').not.toBeNull()
    const deLaHoja = bloqueDeLaHojaInferior().match(/\.modal-footer\s*\{[^}]*?(\d+)px\s*\+\s*env\(safe-area/)
      ?? bloqueDeLaHojaInferior().match(/\.modal-footer\s*\{[^}]*?\+\s*(\d+)px/)
    expect(deLaHoja).not.toBeNull()
    expect(deLaHoja![1]).toBe(dePrincipal![1])
  })

  it('la hoja sigue pegada al borde: la reserva va en el PIE, no en el overlay', () => {
    /* Subir el overlay entero dejaría un hueco con la barra asomando por
       debajo — se cambiaría un defecto por otro, que es lo que pasó cuando la
       lente contextual se resolvió con un `bottom` a mano. */
    const bloque = bloqueDeLaHojaInferior()
    expect(bloque).toMatch(/\.modal-overlay \{ align-items: flex-end; padding: 0; \}/)
  })
})
