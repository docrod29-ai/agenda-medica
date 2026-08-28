import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { destinoDelRiel } from '@/components/expediente/ClinicalSpine'

/**
 * REG-342 — EL REBOTE DE SCROLL EN IPHONE.
 *
 * ── EL DEFECTO, TAL COMO LO REPORTÓ EL DUEÑO ─────────────────────────────────
 *
 * En el teléfono se baja con el dedo, la pantalla baja… y rebota hacia arriba.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `ClinicalSpine` tiene un `IntersectionObserver` que marca qué tramo del
 * expediente se está leyendo. Ese observador se dispara **porque el médico está
 * bajando**. El efecto que colgaba de él llamaba a:
 *
 *     el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
 *
 * `scrollIntoView` no mueve un contenedor: mueve **todos los ancestros
 * scrollables** hasta que el elemento se vea. El riel se pinta arriba del
 * expediente y no tiene ninguna regla que lo fije, así que en cuanto el médico
 * baja lo suficiente el riel queda fuera de pantalla **por arriba** — y para
 * enseñarlo hay que subir `<main>`, que es quien scrollea en el shell.
 *
 * El dedo baja → el observador marca un tramo nuevo → el riel pide que se le vea
 * → la página sube. Y con `behavior: 'smooth'` encima cancelaba el impulso del
 * gesto, que es lo que lo hace sentir como un tirón y no como un salto.
 *
 * El autor **vio el riesgo**: el comentario decía «`nearest`, para no arrastrar
 * la página». Pero `nearest` MINIMIZA la corrección, no impide que la haya.
 *
 * ── POR QUÉ ES SÓLO DE IPHONE ────────────────────────────────────────────────
 *
 * Dos cosas de WebKit. `overflow-anchor` —que Chrome y Firefox implementan y que
 * compensa solo los cambios de altura— **no existe en WebKit**, y tampoco
 * aparece en este repositorio. Y en iOS un `scrollIntoView` suave **cancela** la
 * inercia del dedo en vez de sumarse a ella. El mismo código no salta en Android
 * y salta en iPhone.
 *
 * ── POR QUÉ NINGUNA PRUEBA LO VIO ────────────────────────────────────────────
 *
 * Había DIEZ pruebas de scroll. Las diez son `readFileSync` + `toContain`: una
 * de ellas llega a comparar **posiciones de caracteres dentro de un archivo**, y
 * otra da por aprobado el mecanismo con sólo comprobar que la cadena
 * `'IntersectionObserver'` aparece. Ninguna renderiza, ninguna despacha un
 * toque, ninguna lee una posición de scroll. Y el `e2e/` sólo tiene el humo
 * público SIN login: el proyecto `iphone-safari` existe en la configuración y
 * nunca carga el dashboard.
 *
 * El propio repositorio ya se había tropezado con esto: `v15-rtc12` documenta un
 * arnés que hacía `window.scrollTo(0, 1500)` —que no movía nada, porque quien
 * scrollea es `<main>`— y **aun así reportaba éxito**. Sus palabras: «Una
 * condición que pasa porque el gesto no ocurrió es peor que una que falla».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un movimiento que NO pidió el usuario sólo puede tocar el contenedor que lo
 * necesita, en el eje que lo necesita. La decisión vive en `destinoDelRiel`, una
 * función pura que sólo sabe devolver un `scrollLeft`: no existe valor de
 * entrada que produzca un movimiento vertical, porque no hay ninguno que
 * devolver.
 *
 * ── QUÉ NO CUBRE, Y ESTO ES IMPORTANTE ───────────────────────────────────────
 *
 * · **NO se ha reproducido en un iPhone.** El §38 del programa exige WebKit a
 *   390px con diez repeticiones comprobando que `scrollTop` no baje solo. En
 *   este entorno sólo hay Chromium instalado y no se permite descargar
 *   navegadores, así que esa comprobación queda BLOCKED_EXTERNAL, declarada, no
 *   dada por hecha. Esto prueba la ARITMÉTICA y el cableado; no prueba el
 *   dispositivo.
 * · No cubre los otros escritores de scroll del árbol: el restaurador de
 *   `/consulta` (que se re-arma cuando resuelve una lectura de Firestore y no
 *   tiene cancelación por gesto), los banners asíncronos que cambian la altura
 *   por encima de `<main>`, ni la ausencia de `overscroll-behavior` en los
 *   contenedores anidados. Siguen abiertos en el tablero.
 */

describe('REG-342 · de esta cuenta sólo puede salir un eje horizontal', () => {
  it('si el ítem ya se ve entero, NO se mueve nada', () => {
    expect(destinoDelRiel({ itemIzq: 40, itemAncho: 60, scrollLeft: 0, anchoVisible: 300 })).toBe(null)
  })

  it('el ítem que asoma por la derecha se trae con su respiro', () => {
    // Ítem en [280, 380); se ve [0, 300). Destino = 380 - 300 + 2 = 82.
    expect(destinoDelRiel({ itemIzq: 280, itemAncho: 100, scrollLeft: 0, anchoVisible: 300 })).toBe(82)
  })

  it('el ítem que quedó por la izquierda se trae con su respiro', () => {
    expect(destinoDelRiel({ itemIzq: 100, itemAncho: 60, scrollLeft: 200, anchoVisible: 300 })).toBe(98)
  })

  it('nunca devuelve un scrollLeft negativo', () => {
    expect(destinoDelRiel({ itemIzq: 1, itemAncho: 10, scrollLeft: 50, anchoVisible: 300 })).toBe(0)
  })

  it('un riel sin ancho todavía medido no provoca ningún movimiento', () => {
    // Durante la hidratación `clientWidth` es 0. Mover con esa cuenta sería
    // saltar a un sitio arbitrario justo mientras la página se asienta.
    expect(destinoDelRiel({ itemIzq: 100, itemAncho: 60, scrollLeft: 0, anchoVisible: 0 })).toBe(null)
    expect(destinoDelRiel({ itemIzq: NaN, itemAncho: 60, scrollLeft: 0, anchoVisible: 300 })).toBe(null)
  })

  it('EL INVARIANTE — ninguna entrada produce nada que no sea un scrollLeft', () => {
    // Barrido determinista: sea cual sea la geometría, la respuesta es `null` o
    // un número >= 0 destinado al eje horizontal del riel. No hay forma de que
    // esta función pida mover la página, que es la propiedad que se rompió.
    for (let izq = -200; izq <= 800; izq += 37) {
      for (let ancho = 0; ancho <= 300; ancho += 61) {
        for (let sl = 0; sl <= 600; sl += 97) {
          for (const av of [0, 120, 390, 1024]) {
            const r = destinoDelRiel({ itemIzq: izq, itemAncho: ancho, scrollLeft: sl, anchoVisible: av })
            if (r === null) continue
            expect(typeof r).toBe('number')
            expect(Number.isFinite(r)).toBe(true)
            expect(r).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })

  it('el resultado deja el ítem DENTRO de la ventana visible', () => {
    // La propiedad que el usuario nota: después de mover, el activo se ve.
    for (const c of [
      { itemIzq: 500, itemAncho: 80, scrollLeft: 0, anchoVisible: 300 },
      { itemIzq: 10, itemAncho: 80, scrollLeft: 400, anchoVisible: 300 },
      { itemIzq: 295, itemAncho: 20, scrollLeft: 0, anchoVisible: 300 },
    ]) {
      const destino = destinoDelRiel(c)
      expect(destino).not.toBe(null)
      const sl = destino as number
      expect(c.itemIzq).toBeGreaterThanOrEqual(sl - 2)
      expect(c.itemIzq + c.itemAncho).toBeLessThanOrEqual(sl + c.anchoVisible + 2)
    }
  })
})

describe('REG-342 · el cableado, y el defecto que ya no está', () => {
  const spine = readFileSync('src/components/expediente/ClinicalSpine.tsx', 'utf8')

  it('el efecto del observador ya NO llama a scrollIntoView', () => {
    // El único `scrollIntoView` que queda es el de `irA`, que responde a un CLIC:
    // ahí el desplazamiento es exactamente lo que el médico pidió.
    const sinComentarios = spine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const llamadas = [...sinComentarios.matchAll(/scrollIntoView\(/g)]
    expect(llamadas).toHaveLength(1)
    expect(sinComentarios).toMatch(/const irA = \(id: string\) => \{[\s\S]{0,220}scrollIntoView/)
  })

  it('el efecto del observador usa la función pura y mueve SÓLO el riel', () => {
    expect(spine).toMatch(/destinoDelRiel\(\{/)
    expect(spine).toMatch(/riel\.scrollTo\(\{ left: destino/)
  })

  it('la barra del pulgar ya no se desmonta a media lectura', () => {
    // Era el segundo mecanismo: al entrar la zona de cierre, la barra `sticky`
    // salía del flujo, `main.scrollHeight` encogía ~68px justo con `scrollTop`
    // en su máximo, y WebKit recortaba. Ahora se oculta CONSERVANDO su caja.
    const cierre = readFileSync('src/components/CierreAlPulgar.tsx', 'utf8')
    expect(cierre).not.toMatch(/if \(!visible \|\| cierreEnPantalla\) return null/)
    expect(cierre).toMatch(/nx-cierre-al-pulgar--oculto/)
    expect(cierre).toMatch(/aria-hidden=\{oculta/)
    // Y la visibilidad vive en la HOJA, no en un `style` en línea: hay un
    // guardián de V15 que lo exige (lección `nx-stat-grid`), y la caja tiene
    // que seguir ocupando su sitio para que la altura no cambie.
    const hoja = readFileSync('src/app/globals.css', 'utf8')
    expect(hoja).toMatch(/\.nx-cierre-al-pulgar--oculto \{ visibility: hidden; \}/)
  })
})
