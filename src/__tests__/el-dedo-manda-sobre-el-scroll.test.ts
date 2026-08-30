/**
 * GOLDEN — QUEDABAN ESCRITORES DE SCROLL QUE NO PREGUNTABAN (P1-13).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-342 cerró dos mecanismos del rebote de iPhone (el riel que llamaba a
 * `scrollIntoView` y la barra sticky que salía del flujo). El tablero dejó
 * abierto lo que faltaba, y esto es eso:
 *
 * 1. **El restaurador de `/consulta` escribía `scrollTop` sin preguntar.** Y no
 *    es una restauración que ocurra sólo al montar: su clave depende de
 *    `internamientoActivo`, que llega de un `.then()` de Firestore, así que el
 *    efecto **se re-arma** y puede escribir la posición **segundos después**,
 *    con el médico ya leyendo.
 * 2. **`overscroll-behavior` no aparecía en ninguna parte del repositorio.**
 *
 * ── POR QUÉ ES DE IPHONE Y NO DE ANDROID ────────────────────────────────────
 *
 * Dos cosas de WebKit, y las dos hacen falta:
 *
 * · **`overflow-anchor`** —que Chrome y Firefox implementan— compensa solo el
 *   contenido insertado por encima del punto de lectura. WebKit **no lo
 *   implementa**, así que ahí cualquier escritura tardía de scroll se siente.
 *   No se puede arreglar desde el CSS: se compensa no escribiendo (este golden).
 * · **El encadenamiento de scroll.** Cuando un contenedor llega a su tope, el
 *   gesto se encadena al ancestro; en WebKit eso es el rebote elástico del
 *   documento, y con el shell a `100dvh; overflow:hidden` se siente como un
 *   tirón. `overscroll-behavior` corta la cadena.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La regla correcta **existía y vivía dentro de un componente**.
 * `VolverALaFuente` escuchaba `wheel`, `touchstart` y las teclas de navegación y
 * se apartaba en cuanto llegaba una. Los demás escritores no lo hacían, y nada
 * los obligaba: la disciplina no era del sistema, era de un archivo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **Después del primer gesto manual, el usuario manda** — y se pregunta JUSTO
 * ANTES de escribir, no sólo al armarse: entre una cosa y otra hay dos
 * `requestAnimationFrame` y una lectura de red.
 *
 * Un clic **no** es un gesto de desplazamiento. El médico pulsa cosas todo el
 * rato sin querer mover la pantalla; cancelar con eso rompería las
 * restauraciones legítimas para arreglar un tirón que ese clic no iba a causar.
 *
 * ── QUÉ NO CUBRE, DECLARADO — Y ES LO IMPORTANTE ────────────────────────────
 *
 * · **NO SE HA VISTO EN UN IPHONE.** En este entorno sólo hay Chromium. Esto es
 *   la corrección razonada de dos mecanismos conocidos, no una observación. La
 *   verificación —WebKit, 390 px, diez repeticiones, `scrollTop` que nunca baje
 *   solo— sigue `BLOCKED_EXTERNAL` y **no se declara PROVEN**.
 * · **No renderiza ni despacha un toque.** Prueba la máquina de la vigilancia y
 *   que los escritores la usen; no mide píxeles.
 * · **No cubre los banners asíncronos** que cambian la altura por encima de
 *   `<main>` (41 px medidos por `PorQueEstaAqui`). Ése es el tercer mecanismo y
 *   sigue abierto: arreglarlo bien es sacarlos del flujo, un cambio de layout
 *   del panel que no se hace a ciegas sin navegador.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { vigilarGestoDelUsuario, esTeclaQueDesplaza } from '@/lib/ui/el-dedo-manda'

/** Doble mínimo de un elemento con escuchas, para no montar un DOM entero. */
function elementoFalso() {
  const oyentes = new Map<string, Set<(e: unknown) => void>>()
  return {
    addEventListener(t: string, f: (e: unknown) => void) {
      if (!oyentes.has(t)) oyentes.set(t, new Set())
      oyentes.get(t)!.add(f)
    },
    removeEventListener(t: string, f: (e: unknown) => void) { oyentes.get(t)?.delete(f) },
    disparar(t: string, e: unknown = {}) { for (const f of [...(oyentes.get(t) ?? [])]) f(e) },
    cuantos(t: string) { return oyentes.get(t)?.size ?? 0 },
  }
}

const enWindow = new Map<string, Set<(e: unknown) => void>>()

beforeEach(() => {
  enWindow.clear()
  vi.stubGlobal('window', {
    addEventListener(t: string, f: (e: unknown) => void) {
      if (!enWindow.has(t)) enWindow.set(t, new Set())
      enWindow.get(t)!.add(f)
    },
    removeEventListener(t: string, f: (e: unknown) => void) { enWindow.get(t)?.delete(f) },
  })
})
afterEach(() => vi.unstubAllGlobals())

const dispararEnWindow = (t: string, e: unknown = {}) => {
  for (const f of [...(enWindow.get(t) ?? [])]) f(e)
}

describe('QUÉ CUENTA COMO «EL USUARIO TOMÓ EL CONTROL»', () => {
  it('la rueda sí', () => {
    const el = elementoFalso()
    const v = vigilarGestoDelUsuario(el as unknown as Element)
    expect(v.tomoElControl()).toBe(false)
    el.disparar('wheel')
    expect(v.tomoElControl()).toBe(true)
  })

  it('el toque sí — que es el gesto del iPhone', () => {
    const el = elementoFalso()
    const v = vigilarGestoDelUsuario(el as unknown as Element)
    el.disparar('touchstart')
    expect(v.tomoElControl()).toBe(true)
  })

  it('las teclas de navegación sí', () => {
    for (const k of ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']) {
      expect(esTeclaQueDesplaza(k), `${k} debería contar`).toBe(true)
    }
  })

  it('EL CASO QUE PROTEGE LAS RESTAURACIONES: un clic NO cuenta', () => {
    /**
     * El médico pulsa cosas todo el rato sin querer mover la pantalla. Cancelar
     * con un clic rompería «volver donde ibas» para arreglar un tirón que ese
     * clic no iba a causar.
     */
    const el = elementoFalso()
    const v = vigilarGestoDelUsuario(el as unknown as Element)
    el.disparar('click')
    el.disparar('mousedown')
    expect(v.tomoElControl()).toBe(false)
  })

  it('ni las teclas que no desplazan', () => {
    const v = vigilarGestoDelUsuario(null)
    for (const k of ['a', 'Enter', 'Tab', 'Escape', 'Shift']) {
      expect(esTeclaQueDesplaza(k), `${k} no debería contar`).toBe(false)
      dispararEnWindow('keydown', { key: k })
    }
    expect(v.tomoElControl()).toBe(false)
  })

  it('el toque llega aunque el contenedor no exista todavía', () => {
    // En WebKit el gesto puede empezar antes de que <main> esté montado.
    const v = vigilarGestoDelUsuario(null)
    dispararEnWindow('touchstart')
    expect(v.tomoElControl()).toBe(true)
  })
})

describe('LA VIGILANCIA SE COMPORTA', () => {
  it('avisa UNA sola vez, aunque el dedo siga moviéndose', () => {
    const el = elementoFalso()
    const avisos: number[] = []
    vigilarGestoDelUsuario(el as unknown as Element, () => avisos.push(1))
    el.disparar('touchstart'); el.disparar('touchstart'); el.disparar('wheel')
    expect(avisos.length).toBe(1)
  })

  it('soltar deja de escuchar en el contenedor Y en window', () => {
    const el = elementoFalso()
    const v = vigilarGestoDelUsuario(el as unknown as Element)
    expect(el.cuantos('wheel')).toBe(1)
    v.soltar()
    expect(el.cuantos('wheel')).toBe(0)
    expect(enWindow.get('keydown')?.size ?? 0).toBe(0)
    // Y ya no cambia de opinión.
    el.disparar('touchstart')
    expect(v.tomoElControl()).toBe(false)
  })
})

describe('LOS ESCRITORES DE SCROLL OBEDECEN LA MISMA REGLA', () => {
  const leer = (p: string) => readFileSync(p, 'utf8')

  it('EL DEFECTO: el restaurador de /consulta pregunta antes de escribir', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(src).toContain('vigilarGestoDelUsuario')
    /**
     * Y la pregunta va DENTRO del segundo `requestAnimationFrame`, justo antes
     * de escribir. Preguntarlo sólo al armarse no serviría: el efecto se re-arma
     * cuando `internamientoActivo` llega de Firestore.
     */
    const bloque = src.slice(src.indexOf('const vigilancia = vigilarGestoDelUsuario'), src.indexOf('const guardarScroll'))
    expect(bloque).toContain('if (vigilancia.tomoElControl()) return')
    expect(bloque.indexOf('tomoElControl()')).toBeLessThan(bloque.indexOf('m.scrollTop = y'))
  })

  it('y suelta la escucha al desmontar', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(src).toContain('vigilancia.soltar()')
  })

  it('VolverALaFuente usa el MÓDULO, no su propia copia', () => {
    const src = leer('src/components/lente/VolverALaFuente.tsx')
    expect(src).toContain("from '@/lib/ui/el-dedo-manda'")
    // La lista de teclas ya no vive aquí: dos copias divergen.
    expect(src).not.toContain("'PageDown', 'PageUp'")
  })
})

describe('EL ENCADENAMIENTO DE SCROLL SE CORTA (la mitad que es CSS)', () => {
  const css = readFileSync('src/app/globals.css', 'utf8')

  it('`overscroll-behavior` ya existe en el repositorio', () => {
    // Su ausencia total era el hallazgo: WS-05 lo midió y quedó abierto.
    expect(css).toContain('overscroll-behavior')
  })

  it('el contenedor que scrollea no encadena al documento', () => {
    expect(css).toMatch(/main\s*\{\s*overscroll-behavior-y:\s*contain/)
  })

  it('y el shell, que no scrollea, no rebota', () => {
    const bloque = css.slice(css.indexOf('.nx-app-shell {'), css.indexOf('.nx-app-shell {') + 260)
    expect(bloque).toContain('overscroll-behavior: none')
  })

  it('está escrito que NO se ha visto en un iPhone', () => {
    // La honestidad es parte del arreglo: esto es corrección razonada, no
    // observación, y declararlo PROVEN sería un verde falso.
    expect(css).toContain('NO ESTÁ VERIFICADO EN UN DISPOSITIVO')
  })
})
