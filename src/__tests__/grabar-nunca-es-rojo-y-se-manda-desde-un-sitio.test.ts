/**
 * GOLDEN — grabar se pintaba de ROJO en la consulta, y se mandaba desde tres
 * sitios a la vez.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * **Pulsando el micrófono**, no leyendo. Chromium con micrófono falso
 * (`--use-fake-device-for-media-stream`), sesión real contra el emulador y la
 * compuerta de consentimiento aceptada, para que la máquina de estados del
 * hook recorriera sus transiciones de verdad:
 * `scripts/ausculta-transformacion/recorrer-voz.mjs`. Captura en
 * `docs/audit/ausculta-transformacion/interno/voz-2-grabando-1440.png`.
 *
 * ── DEFECTO 1 · GRABAR NUNCA ES ROJO ────────────────────────────────────────
 *
 * Tres sitios de esta pantalla se pintaban rojo mientras el micrófono estaba
 * abierto: los dos botones de grabación (`#ef4444`) y el punto de la píldora
 * flotante, los tres latiendo con un `@keyframes pulse` declarado DENTRO de la
 * página y pintado con `var(--red)`.
 *
 * Este repositorio ya selló la regla —«cobalto, nunca rojo: rojo aquí significa
 * riesgo clínico»— para `MarcoEscuchando` y para `InstrumentStrip`
 * (`v15-el-acento-entra-al-shell.test.ts`). La consulta, que es donde
 * **realmente se graba**, se quedó fuera de aquel arreglo. Enseñar al médico a
 * leer rojo como «está grabando» erosiona el color con el que se le avisa de
 * una alergia.
 *
 * Y el `@keyframes` dentro de un `<style>` de página no lo alcanza ningún
 * barrido del sistema, así que el apagador de `prefers-reduced-motion` de §24
 * tampoco: seguía latiendo para quien había pedido que no.
 *
 * ── DEFECTO 2 · TRES CONTROLES PARA UNA SOLA COSA ───────────────────────────
 *
 * Con la grabación en marcha había en pantalla, a la vez:
 *
 *   1. `MientrasHablas` — «Escuchando 0:03», con pausa y **Terminar**
 *   2. la fila de abajo — botón ■, botón ⏸, y «Grabando · 00:03» otra vez
 *   3. la píldora flotante — «Grabando · 00:03», **Detener y generar nota**
 *
 * Tres cronómetros, dos botones de pausa y **tres formas de parar** que hacen
 * exactamente lo mismo (`audio.detener()`). El médico, con el paciente
 * delante, tiene que elegir cuál.
 *
 * Es la misma colapsación que `EmpezarAGrabar` ya hizo para el estado de
 * reposo —su comentario lo dice: «el rótulo de modo decía lo mismo que el
 * título y que la descripción; ahora lo dice el botón, una vez»— y que nunca
 * se hizo para el estado de GRABACIÓN.
 *
 * `MientrasHablas` manda: tiene el estado, el cronómetro, el nivel, las
 * palabras en vivo, la pausa y el paro. La fila de abajo se queda sólo con lo
 * que ese panel NO tiene (manos libres, borrar, procesar). El segundo botón de
 * pausa se **borra**, no se esconde: sólo podía aparecer cuando el panel ya
 * estaba en pantalla, así que gatearlo lo habría dejado como código que no se
 * ejecuta nunca.
 *
 * ── DEFECTO 3 · LO QUE FLOTA TAPABA UN CONTROL ──────────────────────────────
 *
 * La píldora se pintaba SIEMPRE que se grababa, también con el panel a tres
 * centímetros. Medido en el navegador: se posaba encima del campo «Motivo de
 * consulta» — el campo que hay que escribir justo mientras se graba.
 *
 * Ahora sólo existe cuando el panel se ha ido de la pantalla, que es su motivo
 * («grabar dura veinte minutos y en ese rato uno se desplaza por la nota»), y
 * el lienzo reserva su alto para que el último control no quede debajo.
 *
 * ── VERIFICADO EN EL NAVEGADOR, Y AQUÍ ESTÁ POR QUÉ IMPORTA ─────────────────
 *
 * La primera comprobación de la píldora salió en **falso verde**: decía que no
 * volvía al desplazarse. El error era del arnés — este shell hace scroll
 * DENTRO de `<main>`, así que `window.scrollTo` no movía nada. Corregido:
 *
 *     panel a la vista        → 0 píldoras   (no tapa)
 *     desplazado              → 1 píldora    (el control sigue estando)
 *     de vuelta arriba        → 0 píldoras
 *     abajo del todo          → 0 controles tapados, a 390 y a 1440
 *
 * Sin ese paso, «esconder la píldora» habría sido **borrar el botón de
 * detener** de una nota larga, y el diff se habría visto perfecto.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No renderiza React ni graba.** Es un guardián de fuente. Lo que de verdad
 *   pasa al pulsar el micrófono lo mide `recorrer-voz.mjs` con micrófono falso
 *   contra el emulador, que es lo único que encontró los tres defectos.
 * · **No mide el color computado.** Que el botón salga cobalto lo dice la
 *   captura; esto vigila que no vuelva el literal ni el latido rojo.
 * · No cubre los estados `subiendo → listo | error` con audio real: el arnés
 *   llega hasta `grabando` y `pausado`. Queda declarado.
 * · No cubre la UCI ni la nota de hospital, que graban con el mismo hook y no
 *   se revisaron en esta unidad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const CSS = leer('src/app/globals.css')

/** Sin comentarios: aquí se documenta el literal retirado, y documentarlo vale. */
const sinComentarios = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
const CODIGO = sinComentarios(CONSULTA)

describe('grabar nunca es rojo', () => {
  it('ningún control de grabación de la consulta se pinta con el rojo suelto', () => {
    const culpables: string[] = []
    CODIGO.split('\n').forEach((linea, i) => {
      if (!/#ef4444|#dc2626/i.test(linea)) return
      culpables.push(`consulta:${i + 1} → ${linea.trim().slice(0, 90)}`)
    })
    expect(
      culpables,
      `rojo = riesgo clínico; grabar habla cobalto:\n${culpables.join('\n')}`,
    ).toEqual([])
  })

  it('el latido vive en el sistema, no dentro de la pantalla', () => {
    // Un @keyframes en un <style> de página no lo alcanza el apagador de
    // prefers-reduced-motion de §24: seguía latiendo para quien pidió que no.
    expect(CODIGO, 'volvió el @keyframes local').not.toContain('@keyframes pulse')
    expect(CSS).toContain('@keyframes nx-escuchando-latido')
    // Y late en el acento, no en el rojo.
    const bloque = CSS.slice(CSS.indexOf('@keyframes nx-escuchando-latido'))
      .slice(0, 300)
    expect(bloque).toContain('var(--nexus)')
    expect(bloque).not.toContain('var(--red)')
    // Se apaga con todo lo demás.
    expect(CSS).toContain('[style*="nx-escuchando-latido"] { animation: none !important; }')
  })
})

describe('mientras se graba, manda un solo control', () => {
  it('existe el criterio único, y no una copia de la condición', () => {
    expect(CONSULTA).toContain('const mandaElPanelDeEscucha =')
    // La condición de montaje de MientrasHablas ES ese criterio, no una copia.
    expect(CONSULTA).toMatch(/\{mandaElPanelDeEscucha && \(\s*\n\s*<div ref=\{panelEscuchaRef\}>/)
  })

  it('la fila de abajo no repite el cronómetro mientras el panel manda', () => {
    // «Grabando · mm:ss» lo dice el panel. Abajo sólo queda lo de DESPUÉS.
    expect(CONSULTA).toContain("{!mandaElPanelDeEscucha && (")
    const i = CONSULTA.indexOf("audio.estado === 'listo' ? 'Transcripción lista'")
    expect(i, 'desapareció el estado posterior a grabar').toBeGreaterThan(-1)
    const bloque = CONSULTA.slice(i - 400, i)
    expect(bloque, 'volvió el cronómetro duplicado').not.toContain("audio.estado === 'grabando' ? `Grabando ·")
  })

  it('el segundo botón de pausa se borró, no se dejó como código muerto', () => {
    // Sólo podía aparecer con el panel ya en pantalla: gatearlo lo habría
    // dejado inalcanzable, que es la deuda que persigue `modulos-sin-conectar`.
    expect(CODIGO, 'volvió el gate muerto').not.toContain('{false &&')
    const pausas = (CODIGO.match(/audio\.pausar\(\)/g) ?? []).length
    expect(pausas, 'hay más de un botón de pausa en la consulta').toBeLessThanOrEqual(1)
  })
})

describe('lo que flota no tapa un control', () => {
  it('la píldora sólo existe cuando el panel NO está a la vista', () => {
    expect(CONSULTA).toMatch(/&& !panelALaVista && \(/)
    expect(CONSULTA).toContain('new IntersectionObserver(')
  })

  it('nace visible si no hay observador — perder el botón de detener es peor', () => {
    /**
     * Es la regla de `Revelar` aplicada al revés: allí el riesgo es esconder
     * contenido que nadie revela; aquí, esconder el ÚNICO control de parar. Si
     * no hay `IntersectionObserver`, el efecto sale sin observar y
     * `panelALaVista` se queda en `false`, así que la píldora se pinta.
     */
    expect(CONSULTA).toContain("typeof IntersectionObserver === 'undefined'")
    expect(CONSULTA).toContain('const [panelALaVista, setPanelALaVista] = useState(false)')
  })

  it('y el lienzo reserva su alto, para que el último control no quede debajo', () => {
    expect(CONSULTA).toContain("raiz.classList.toggle('nx-hay-pildora-grabando', hayPildora)")
    expect(CSS).toContain('html.nx-hay-pildora-grabando main { padding-bottom: 96px; }')
    // Y se quita al salir: una clase en <html> que nadie limpia se queda.
    expect(CONSULTA).toContain("raiz.classList.remove('nx-hay-pildora-grabando')")
  })
})
