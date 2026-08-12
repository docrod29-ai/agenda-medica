/**
 * V15-MOBILE-001 (Fase 9, §22 «sign/close desde el teléfono») — la barra
 * `CierreAlPulgar` acerca el cierre de /consulta al pulgar SIN convertirse en
 * una segunda vía de firma.
 *
 * ── CÓMO SE DESCUBRIÓ EL DEFECTO ────────────────────────────────────────────
 *
 * La radiografía móvil de la tercera rebanada de esta fase
 * (`scripts/design/medir-trabajos-moviles-v15.mjs`, resultado en
 * `docs/design/capturas/v15-trabajos-moviles-baseline/`) midió «Firmar y
 * cerrar nota» a ~2,900px de scroll a 390×844: el trabajo móvil «sign/close»
 * de §22 existía como funcionalidad, pero el pulgar no llegaba a él. Además,
 * en /consulta la acción central del BottomNav apunta a la MISMA página
 * (`accionContextual` → `/consulta/[pid]`), así que la zona del pulgar no
 * ofrecía ningún camino al cierre.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * 1. LA BARRA NO FIRMA. Firmar es un acto consecuente (§19 del master loop:
 *    «explicit review for consequential actions»; regla 6 de seguridad
 *    clínica: se pregunta, no se adivina). `CierreAlPulgar.tsx` no importa ni
 *    invoca `firmar` — su único efecto es scroll+foco hacia el ancla. Si
 *    alguien le cablea una firma directa, este guardián lo caza.
 * 2. UNA SOLA FUENTE DE VERDAD: la barra recibe `bloqueosDeFirma.length`,
 *    `motivoNoFirma` y `validacion.puntajeCompletitud` — los MISMOS valores
 *    que gobiernan el botón real de Firmar — no un recálculo propio ni una
 *    consulta nueva.
 * 3. EL ANCLA EXISTE Y RECIBE EL FOCO: `id="cierre-de-la-consulta"` con
 *    `tabIndex={-1}` vive en la página (teclado/lector de pantalla aterrizan
 *    donde aterriza la vista, §24).
 * 4. ESTADOS DEL ENCUENTRO (§8.5/§8.6): `cierreAlPulgarVisible` es falsa con
 *    la nota firmada, mientras se graba/pausa/sube, y sin contenido de nota —
 *    probada como FUNCIÓN, no leyendo JSX.
 * 5. SÓLO MÓVIL Y SIN DUPLICAR ACCESOS: la clase vive oculta por defecto y
 *    sólo se enciende bajo el media query ≤768px (la lección de
 *    `nx-stat-grid`/pistas de teclado: un estilo inline vencería a la hoja —
 *    por eso el display vive en la hoja, y el guardián comprueba que el
 *    componente no traiga un `display` inline que lo pise). La barra se
 *    esconde cuando el cierre ya está en pantalla (IntersectionObserver).
 *
 * Probado al revés (git stash de los 4 archivos): los casos 1-2 del bloque de
 * cableado fallan contra el árbol previo (el componente no existía y la página
 * no lo montaba); el caso del ancla falla porque `id="cierre-de-la-consulta"`
 * no existía; los del CSS fallan porque la clase no estaba en la hoja.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni mide píxeles: los casos de cableado son análisis
 *   estático de fuente (patrón de todos los guardianes v15-*; el repo no usa
 *   @testing-library/react). El comportamiento real (barra visible, tap que
 *   aterriza, ocultarse al llegar, sólo-móvil) se verifica en navegador real
 *   con `scripts/design/capturar-cierre-al-pulgar-v15.mjs`.
 * · No cubre el estado `grabando` en navegador real (exigiría micrófono
 *   real): esa compuerta se prueba aquí como función pura (caso 4).
 * · No cubre que el motivo de bloqueo sea CORRECTO — eso es de
 *   `motivosParaNoFirmar` y ya tiene sus propias pruebas (REG-189).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { cierreAlPulgarVisible } from '@/components/CierreAlPulgar'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGE = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const BARRA = leer('src/components/CierreAlPulgar.tsx')
const CSS = leer('src/app/globals.css')

describe('V15 — CierreAlPulgar: cableado en la página de consulta', () => {
  it('la página importa y monta la barra', () => {
    expect(PAGE).toContain("from '@/components/CierreAlPulgar'")
    expect(PAGE).toContain('<CierreAlPulgar')
  })

  it('la barra lee las MISMAS fuentes que el botón real de Firmar, no un recálculo', () => {
    expect(PAGE).toContain('bloqueos={bloqueosDeFirma.length}')
    expect(PAGE).toContain('motivo={motivoNoFirma}')
    expect(PAGE).toContain('completitud={validacion.puntajeCompletitud}')
  })

  it('la visibilidad pasa por cierreAlPulgarVisible con el estado real del audio', () => {
    expect(PAGE).toContain('cierreAlPulgarVisible({')
    // Grabando incluye pausa y subida: a media escucha no se ofrece el cierre.
    const llamada = PAGE.slice(PAGE.indexOf('cierreAlPulgarVisible({'))
    expect(llamada).toContain("audio.estado === 'grabando'")
    expect(llamada).toContain("audio.estado === 'pausado'")
    expect(llamada).toContain("audio.estado === 'subiendo'")
  })

  it('el ancla del viaje existe y puede recibir el foco (id + tabIndex=-1)', () => {
    expect(PAGE).toContain('id="cierre-de-la-consulta"')
    const ancla = PAGE.slice(PAGE.indexOf('id="cierre-de-la-consulta"') - 600, PAGE.indexOf('id="cierre-de-la-consulta"') + 600)
    expect(ancla).toContain('tabIndex={-1}')
    expect(PAGE).toContain('idDestino="cierre-de-la-consulta"')
  })
})

describe('V15 — CierreAlPulgar: la barra NO es una segunda vía de firma', () => {
  it('el componente no importa ni invoca firmar()', () => {
    // Se miran sólo las líneas de CÓDIGO: los comentarios del componente
    // tienen derecho a nombrar `firmar()` para explicar por qué NO está.
    const codigo = BARRA
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/\bfirmar\s*\(/)
    expect(codigo).not.toContain('onClick={firmar}')
    // Tampoco recibe la función por props: sus props son datos, no acciones.
    expect(codigo).not.toMatch(/firmar\s*:\s*\(/)
  })

  it('su único efecto de click es viajar: scrollIntoView + foco en el ancla', () => {
    expect(BARRA).toContain('scrollIntoView')
    expect(BARRA).toContain('focus({ preventScroll: true })')
    // Nada de router.push ni escrituras: es navegación dentro de la página.
    expect(BARRA).not.toContain('router.')
    expect(BARRA).not.toMatch(/fetch\(|setDoc|updateDoc|addDoc/)
  })

  it('respeta prefers-reduced-motion (§24) — vía la voz única del producto', () => {
    // La novena rebanada de Fase 10 retiró la copia local de matchMedia:
    // ahora TODO scroll programático pregunta a `comportamientoScroll()`
    // (src/lib/ui/movimiento.ts), que es quien consulta la preferencia.
    // El guardián sigue al mecanismo, no a la forma vieja.
    expect(BARRA).toContain("from '@/lib/ui/movimiento'")
    expect(BARRA).toContain('behavior: comportamientoScroll()')
    const MOVIMIENTO = readFileSync(join(process.cwd(), 'src/lib/ui/movimiento.ts'), 'utf8')
    expect(MOVIMIENTO).toContain('prefers-reduced-motion')
  })

  it('se esconde cuando el cierre ya está en pantalla (IntersectionObserver)', () => {
    expect(BARRA).toContain('IntersectionObserver')
    expect(BARRA).toContain('cierreEnPantalla')
  })
})

describe('V15 — CierreAlPulgar: sólo móvil, y el display vive en la HOJA', () => {
  it('la clase existe oculta por defecto y un media query ≤768px la enciende', () => {
    const idx = CSS.indexOf('.nx-cierre-al-pulgar {')
    expect(idx).toBeGreaterThan(0)
    const bloque = CSS.slice(idx, idx + 400)
    expect(bloque).toContain('display: none')
    // El media query que la enciende — el default apagado es la dirección
    // correcta: si la hoja no carga, la barra NO aparece en escritorio.
    expect(CSS).toMatch(/@media \(max-width: 768px\) \{\s*\.nx-cierre-al-pulgar \{ display: block; \}/)
  })

  it('el botón es un <button> real con altura táctil ≥44px (§24)', () => {
    expect(BARRA).toContain('<button')
    expect(BARRA).toContain('type="button"')
    const css = CSS.slice(CSS.indexOf('.nx-cierre-al-pulgar-btn'))
    const alto = css.match(/min-height:\s*(\d+)px/)
    expect(alto).not.toBeNull()
    expect(Number(alto![1])).toBeGreaterThanOrEqual(44)
  })

  it('el componente no trae un display inline que pise a la hoja (lección nx-stat-grid)', () => {
    // El contenedor raíz usa la clase; su visibilidad la decide globals.css.
    const raiz = BARRA.slice(BARRA.indexOf('className="nx-cierre-al-pulgar"') - 200, BARRA.indexOf('className="nx-cierre-al-pulgar"') + 100)
    expect(raiz).not.toContain('style=')
  })
})

describe('V15 — cierreAlPulgarVisible: los estados del encuentro (función pura, probada al revés)', () => {
  it('visible sólo con nota abierta, sin grabación en curso y con contenido', () => {
    expect(cierreAlPulgarVisible({ firmada: false, grabando: false, hayContenido: true })).toBe(true)
  })

  it('firmada: ya no hay nada que cerrar', () => {
    expect(cierreAlPulgarVisible({ firmada: true, grabando: false, hayContenido: true })).toBe(false)
  })

  it('grabando (o pausado/subiendo): la única acción dominante es la grabación (§8.6)', () => {
    expect(cierreAlPulgarVisible({ firmada: false, grabando: true, hayContenido: true })).toBe(false)
  })

  it('sin contenido: al principio manda EmpezarAGrabar, no un cierre vacío', () => {
    expect(cierreAlPulgarVisible({ firmada: false, grabando: false, hayContenido: false })).toBe(false)
  })

  it('firmada Y grabando a la vez (estado imposible): también se calla — falso seguro', () => {
    expect(cierreAlPulgarVisible({ firmada: true, grabando: true, hayContenido: true })).toBe(false)
  })
})

describe('V15 — freeze funcional: el cierre real quedó exactamente igual', () => {
  it('el onClick y el disabled de Firmar no cambiaron', () => {
    expect(PAGE).toContain('onClick={firmar}')
    expect(PAGE).toContain('disabled={bloqueosDeFirma.length > 0 || guardando}')
  })

  it('el contenido de la nota decide la barra con señales que ya existían, no estado nuevo', () => {
    const def = PAGE.slice(PAGE.indexOf('const hayContenidoDeNota'), PAGE.indexOf('const hayContenidoDeNota') + 400)
    expect(def).toContain('esElPrincipio')
    expect(def).toContain('secciones.some')
    expect(def).toContain('diagnosticos.length')
    expect(def).toContain('medicamentos.length')
  })
})
