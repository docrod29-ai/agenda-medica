/**
 * GOLDEN — LAS 28 RESERVAS DE ÁREA SEGURA COLGABAN DE UNA SOLA LÍNEA, Y NADIE
 * LA VIGILABA.
 *
 * ── QUÉ SE ENCONTRÓ ──────────────────────────────────────────────────────────
 *
 * El repositorio usa `env(safe-area-inset-*)` en **28 sitios** repartidos por
 * ocho archivos: la barra inferior, la topbar móvil, el botón de ayuda, los
 * botones flotantes, el pie del modal, el portal del paciente, la pantalla de
 * reserva y la de unirse. Todos existen por la misma razón: que un control no
 * quede debajo del «home indicator» de un iPhone ni cortado por el notch.
 *
 * **`env(safe-area-inset-*)` vale CERO salvo que el documento declare
 * `viewport-fit=cover`.** No falla, no avisa, no rompe el CSS: devuelve `0px` y
 * todas las reservas se convierten en nada. En este repositorio esa declaración
 * es **una línea, en un archivo** (`src/app/layout.tsx`), y no había ninguna
 * prueba que la mirara.
 *
 * Borrarla —o mover el `viewport` a otro sitio en una refactorización de rutas—
 * dejaría los 28 usos escritos, bien escritos, y **sin efecto**: la barra
 * inferior se metería bajo el indicador del iPhone, con toda la suite en verde.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Buscando defectos de móvil internamente comprobables mientras WebKit sigue sin
 * poder instalarse en este entorno. Se contaron los usos de área segura y se
 * buscó quién garantiza su condición previa: `grep -rn "viewportFit"` devuelve
 * **una sola línea en todo el árbol**, y `grep -rln` sobre `src/__tests__`
 * devolvía **cero** guardianes.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * `escrito_y_sin_conectar` en su forma de condición previa: no es que el módulo
 * no corra, es que **corre y no hace nada** porque falta un interruptor que vive
 * en otro archivo. Y es hermana de «el dato tiene que LLEGAR»: el valor se
 * calcula, se escribe en la propiedad correcta y **llega como cero**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Si algo usa `env(safe-area-inset-*)`, el layout raíz tiene que declarar
 * `viewportFit: 'cover'`. Las dos mitades se comprueban juntas, en la misma
 * dirección: no basta con que la línea esté — tiene que estar **mientras alguien
 * dependa de ella**, y si un día nadie depende, este caso lo dice.
 *
 * ── QUÉ *NO* CUBRE ───────────────────────────────────────────────────────────
 *
 * · **No prueba que el área segura tenga el valor correcto en un iPhone.** Eso
 *   es WebKit sobre hardware con notch, y en este entorno el binario de WebKit
 *   no se puede ni descargar (403 de la política de red, comprobado hoy). Sigue
 *   `BLOCKED_EXTERNAL`.
 * · **No prueba que Next emita la etiqueta.** Prueba lo que el árbol DECLARA.
 * · **No mide si la reserva ALCANZA.** Que se reserve el área segura no dice que
 *   los 72px de colchón sean suficientes; eso se mide en navegador.
 * · **Sólo mira el layout raíz.** Un `viewport` exportado por otro layout que
 *   sobreescribiera éste no lo vería.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const RAIZ = 'src/app/layout.tsx'
const layout = readFileSync(RAIZ, 'utf8')

/** El bloque `export const viewport = { … }` del layout raíz. */
function bloqueViewport(fuente: string): string {
  const desde = fuente.indexOf('export const viewport')
  if (desde < 0) return ''
  const abre = fuente.indexOf('{', desde)
  let prof = 0
  for (let i = abre; i < fuente.length; i += 1) {
    if (fuente[i] === '{') prof += 1
    else if (fuente[i] === '}') { prof -= 1; if (prof === 0) return fuente.slice(abre, i + 1) }
  }
  return ''
}

/** Quién depende hoy del área segura. Se DERIVA del árbol, no se lista. */
function dependientesDelAreaSegura(): string[] {
  return execSync(
    "grep -rl 'safe-area-inset' src --include=*.ts --include=*.tsx --include=*.css | grep -v __tests__ || true",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)
}

describe('el área segura del teléfono llega, o vale cero en silencio', () => {
  const dependientes = dependientesDelAreaSegura()

  it('hay quien depende del área segura (si no, este guardián sobraría)', () => {
    /* El modo de fallo de este archivo es medir un árbol donde ya nadie usa
       `env(safe-area-inset-*)` y pasar por vacío. */
    expect(dependientes.length, 'nadie usa safe-area-inset: revisar si este guardián sigue teniendo sentido')
      .toBeGreaterThanOrEqual(5)
    expect(dependientes).toContain('src/app/globals.css')
  })

  it('EL CASO: el layout raíz declara `viewport-fit: cover`', () => {
    const bloque = bloqueViewport(layout)
    expect(bloque, `${RAIZ} no exporta un bloque \`viewport\``).not.toBe('')
    expect(
      /viewportFit\s*:\s*['"]cover['"]/.test(bloque),
      `${dependientes.length} archivos usan \`env(safe-area-inset-*)\` y ${RAIZ} no declara ` +
      '`viewportFit: "cover"`. Sin esa declaración el navegador devuelve `0px` en TODAS ' +
      'esas reservas: no falla, no avisa, y la barra inferior se mete debajo del ' +
      'indicador del iPhone con toda la suite en verde.',
    ).toBe(true)
  })

  it('y el zoom no está desactivado — WCAG 1.4.4', () => {
    /**
     * Va en el mismo caso porque es el mismo bloque y el mismo modo de fallo: se
     * toca `viewport` por una razón de maquetación y de paso se desactiva el
     * zoom. Un médico con la vista cansada a las nueve de la noche y un paciente
     * de 70 años en el portal son el mismo problema, y lo dice la regla de
     * diseño de este repositorio.
     */
    const bloque = bloqueViewport(layout)
    expect(/userScalable\s*:\s*false/.test(bloque), 'se desactivó el zoom (userScalable: false)').toBe(false)

    const max = bloque.match(/maximumScale\s*:\s*([\d.]+)/)
    if (max) {
      expect(Number(max[1]), 'maximumScale por debajo de 2 impide ampliar al 200% que exige WCAG 1.4.4')
        .toBeGreaterThanOrEqual(2)
    }
  })

  it('al revés: el cedazo sabe fallar', () => {
    /**
     * Sobre un layout de mentira, porque sobre el bueno sólo demuestra hoy. Se le
     * quita la línea y se comprueba que el detector dice que no; y se le pone un
     * `viewport-fit` de otra cosa, que es la forma sutil de romperlo —`contain`
     * es un valor válido que NO activa el área segura.
     */
    const sinLinea = layout.replace(/\s*viewportFit\s*:\s*['"]cover['"],?/, '')
    expect(/viewportFit\s*:\s*['"]cover['"]/.test(bloqueViewport(sinLinea))).toBe(false)

    const conOtroValor = layout.replace(/viewportFit\s*:\s*['"]cover['"]/, "viewportFit: 'contain'")
    expect(/viewportFit\s*:\s*['"]cover['"]/.test(bloqueViewport(conOtroValor))).toBe(false)

    const zoomApagado = layout.replace(/export const viewport[^{]*\{/, m => `${m}\n  userScalable: false,`)
    expect(/userScalable\s*:\s*false/.test(bloqueViewport(zoomApagado))).toBe(true)
  })

  it('y el lector del bloque lee el bloque, no el archivo entero', () => {
    /**
     * Si `bloqueViewport` devolviera el archivo completo, los casos de arriba
     * pasarían por encontrar la palabra en cualquier sitio —un comentario, otra
     * constante— y el guardián dejaría de guardar.
     */
    const bloque = bloqueViewport(layout)
    expect(bloque.startsWith('{')).toBe(true)
    expect(bloque.endsWith('}')).toBe(true)
    expect(bloque.length).toBeLessThan(layout.length / 4)
    expect(bloqueViewport('const otraCosa = { a: 1 }'), 'sin `export const viewport` devuelve vacío').toBe('')
  })
})
