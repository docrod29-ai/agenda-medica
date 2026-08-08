/**
 * TODA ANIMACIÓN TIENE SU FOTOGRAMA — V9 · REG-266.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `animation: 'spin 1s linear infinite'` se referencia **90 veces** en el
 * código. Entre ellas, las dos piezas COMPARTIDAS del sistema de diseño:
 * `components/ui/Spinner.tsx` (27 usos) y el estado `loading` de
 * `components/ui/Button.tsx` (58 usos).
 *
 * `@keyframes spin` no estaba definido en `globals.css`. Ni en ningún otro sitio
 * global. Tailwind v4 tampoco lo emitía: sólo genera su fotograma `spin` si
 * aparece la utilidad `animate-spin`, y aquí se usa **cero** veces.
 *
 * Lo definían —cada uno por su cuenta, en una etiqueta `<style>` local— **31
 * archivos de pantalla**. Y una etiqueta `<style>` renderizada es global al
 * documento: mientras alguno de esos 31 estuviera montado, el giro funcionaba
 * en toda la aplicación. En cuanto el médico caía en una de las otras
 * pantallas, el mismo componente compartido dibujaba un `Loader2` congelado.
 *
 * ── POR QUÉ NO ES COSMÉTICO ─────────────────────────────────────────────────
 *
 * Un indicador de carga parado no comunica «esperando»: comunica «se colgó».
 * El médico pulsa «Procesar con IA», ve un icono quieto, y vuelve a pulsar —
 * sobre una petición que sí estaba corriendo. La señal de progreso es la única
 * defensa contra el doble disparo.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditoría del sistema de diseño de `PATIENT-UX-TRUTH-001` (V9), contando
 * fotogramas definidos contra fotogramas referenciados. Ninguna prueba podía
 * verlo: no hay nada que ejecutar. Es un símbolo que no resuelve, y CSS no
 * avisa de eso — una animación inexistente no es un error, es una animación que
 * no ocurre.
 *
 * ── LA FAMILIA ──────────────────────────────────────────────────────────────
 *
 * «El sistema se contradice a sí mismo»: el componente compartido está bien, y
 * las 31 pantallas están bien. Lo que está mal es la relación entre ellos, y
 * por eso ninguna revisión de una sola pieza lo encuentra. Misma familia que el
 * azul que servía de texto y de relleno con requisitos opuestos.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Un archivo que referencia una animación tiene que poder responder de ella:
 * o la define él mismo, o la define `globals.css`. Referenciar una animación
 * que define **otro** archivo es depender de que ese otro esté montado, que es
 * exactamente el defecto.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Sólo mira `animation:` en objetos de estilo de TSX.** No cubre
 *   `animationName`, ni animaciones declaradas dentro de `<style>` en línea,
 *   ni las que vienen de una clase de `globals.css` (ésas ya viven donde toca).
 * - **No comprueba que la animación se VEA.** Un fotograma definido pero con
 *   `prefers-reduced-motion` o un `display:none` encima no lo detecta nada de
 *   esto. Aprobar una animación exige mirarla.
 * - **No obliga a quitar los 31 `<style>` duplicados.** Son inofensivos —
 *   redefinen lo mismo— y su barrido pertenece a DESIGN-SYSTEM-001. Esta prueba
 *   los acepta como definición válida a propósito: exigir la limpieza aquí
 *   convertiría un guardián en una tarea de estilo, y los guardianes que piden
 *   trabajo ajeno se acaban silenciando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const RAIZ = process.cwd()
const GLOBALS = join(RAIZ, 'src', 'app', 'globals.css')

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue
      fuentes(p, acc)
    } else if (e.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

/** Nombres de `@keyframes X` definidos en un texto. */
function fotogramasDefinidos(texto: string): Set<string> {
  return new Set([...texto.matchAll(/@keyframes\s+([A-Za-z][\w-]*)/g)].map((m) => m[1]))
}

/**
 * Nombres referenciados por `animation: …` en un objeto de estilo de TSX.
 *
 * Se lee el valor hasta la coma, la llave o el fin de línea, y de ahí se saca
 * el nombre de las cadenas que **tienen forma de animación**: un nombre seguido
 * de una duración (`pulse 1.5s infinite`, `spin 1s linear infinite`).
 *
 * Las dos vueltas que costó llegar aquí valen la pena escribirlas, porque son
 * la misma lección dos veces —**un guardián que grita de más se acaba
 * silenciando**, REG-245— y las dos las produjo el mismo renglón real:
 *
 *   1. Leer el primer identificador tras los dos puntos daba `voz` en
 *      `animation: voz.grabando ? 'pulse 1.5s infinite' : 'none'`: capturaba la
 *      CONDICIÓN del ternario.
 *   2. Leer toda cadena entrecomillada daba `grabando` en
 *      `animation: audio.estado === 'grabando' ? 'pulse 1.5s infinite' : 'none'`:
 *      capturaba un valor comparado, no un fotograma.
 *
 * Exigir la duración distingue las tres cosas sin ambigüedad.
 *
 * **Lo que esto deja fuera a sabiendas**: `animation: 'spin'` a secas, sin
 * duración. No se vigila porque sin duración la animación no corre de todos
 * modos — el defecto sería otro y más visible.
 */
function fotogramasReferenciados(texto: string): Set<string> {
  const nombres = new Set<string>()
  for (const decl of texto.matchAll(/animation:\s*([^,\n}]*)/g)) {
    for (const cita of decl[1].matchAll(/['"`]\s*([A-Za-z][\w-]*)\s+[\d.]+m?s\b/g)) {
      nombres.add(cita[1])
    }
  }
  return nombres
}

const globales = fotogramasDefinidos(readFileSync(GLOBALS, 'utf8'))

describe('ninguna animación depende de que otra pantalla esté montada', () => {
  it('`spin` está definido en globals.css', () => {
    /**
     * Es la que muerde y la que costó: 90 referencias, cero definiciones
     * globales. Probada al revés: quitando el bloque `@keyframes spin` de
     * `globals.css`, esta prueba y la siguiente fallan.
     */
    expect(globales.has('spin')).toBe(true)
  })

  it('cada archivo responde de las animaciones que usa', () => {
    const huerfanas: string[] = []
    for (const archivo of fuentes(join(RAIZ, 'src'))) {
      const src = readFileSync(archivo, 'utf8')
      const propias = fotogramasDefinidos(src) // las que define en su `<style>`
      for (const nombre of fotogramasReferenciados(src)) {
        if (!globales.has(nombre) && !propias.has(nombre)) {
          huerfanas.push(`${relative(RAIZ, archivo)} → ${nombre}`)
        }
      }
    }
    expect(huerfanas).toEqual([])
  })

  it('el sistema de diseño compartido no depende de nadie', () => {
    /**
     * Un primitivo compartido se monta en cualquier pantalla, incluidas las que
     * no definen nada. No le vale definir la animación «en algún sitio»: tiene
     * que estar en `globals.css`. Es la regla más estricta y aplica sólo aquí.
     */
    const fallos: string[] = []
    for (const archivo of fuentes(join(RAIZ, 'src', 'components', 'ui'))) {
      for (const nombre of fotogramasReferenciados(readFileSync(archivo, 'utf8'))) {
        if (!globales.has(nombre)) fallos.push(`${relative(RAIZ, archivo)} → ${nombre}`)
      }
    }
    expect(fallos).toEqual([])
  })
})
