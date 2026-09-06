/**
 * GOLDEN — «automático» es una decisión, no un hueco.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El control del tema tiene tres modos y uno de ellos es **automático**
 * («sigue al sistema operativo», con su icono de pantalla y su texto en el
 * `title`). Se guardaba **borrando la llave** de `localStorage`.
 *
 * Así que «elegí automático» y «nunca elegí nada» quedaban escritos igual:
 * sin dato. Y los dos lectores del tema leían esa ausencia como **oscuro**:
 *
 *   · el guion en línea del `<head>` — `t === 'light' ? 'light' : 'dark'`
 *   · `useTema` — `localStorage.getItem(KEY) ?? 'dark'`
 *
 * Resultado: el médico elegía automático, el tema seguía al sistema… hasta la
 * siguiente carga. Al recargar —o al abrir la aplicación instalada, que es
 * como se abre cada mañana— volvía a oscuro, y el control decía «oscuro» como
 * si lo hubiera elegido él. El modo automático era inalcanzable en la práctica,
 * y con él todo el bloque `@media (prefers-color-scheme: light)` de
 * `globals.css`, que sólo se activa cuando NO hay atributo `data-theme`.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Barriendo llaves de `localStorage` que se escriben y nadie lee (y al revés).
 * `nexusmed.theme` salió como «se lee y nadie lo escribe», que era un falso
 * positivo del barrido —se escribe desde una variable— pero al ir a comprobarlo
 * apareció esto.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Regla 4 de seguridad clínica dicha en lenguaje de interfaz: **ausencia de
 * dato no es dato de ausencia**. Un hueco no puede representar una elección,
 * porque entonces no hay forma de distinguirlo del silencio.
 *
 * Y el agravante: DOS lectores con su propia copia de la tabla. Familia
 * «depende de que alguien se acuerde».
 *
 * ── LO QUE **NO** CAMBIA ────────────────────────────────────────────────────
 *
 * El valor de fábrica sigue siendo oscuro — es la identidad de la marca y es
 * una decisión de producto. Lo único que cambia es que «automático» se escribe.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No abre un navegador: ejecuta el guion real del `<head>` contra un
 *   `localStorage` y un `documentElement` de mentira. Comprueba la DECISIÓN,
 *   no el píxel.
 * - No comprueba que `globals.css` pinte bien el claro del sistema operativo:
 *   eso es `el-tema-claro-es-uno-solo.test.ts`.
 * - No migra al médico que ya tenía «automático» guardado como hueco: para el
 *   código eso era «nunca eligió», y seguirá en oscuro hasta que lo vuelva a
 *   elegir. Se declara aquí a propósito — inventarle una preferencia sería el
 *   mismo error al revés.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GUION_TEMA, LLAVE_TEMA, atributoDeTema, modoGuardado } from '@/lib/tema'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/**
 * Corre el guion REAL del `<head>` con un almacenamiento y un `<html>` de
 * mentira, y devuelve el `data-theme` que dejó (`null` = lo quitó).
 */
function correrGuion(guardado: string | null): string | null {
  let atributo: string | null = null
  const documento = {
    documentElement: {
      setAttribute: (k: string, v: string) => { if (k === 'data-theme') atributo = v },
      removeAttribute: (k: string) => { if (k === 'data-theme') atributo = null },
    },
  }
  const almacen = { getItem: (k: string) => (k === LLAVE_TEMA ? guardado : null) }
  new Function('document', 'localStorage', GUION_TEMA)(documento, almacen)
  return atributo
}

describe('el guion del <head> y el hook deciden lo mismo', () => {
  const CASOS: Array<[string | null, 'dark' | 'light' | null]> = [
    ['light', 'light'],
    ['dark', 'dark'],
    ['auto', null],          // sin atributo → manda prefers-color-scheme
    [null, 'dark'],          // nunca eligió → la marca es oscura
    ['basura', 'dark'],      // valor corrupto → la marca es oscura
  ]

  for (const [guardado, esperado] of CASOS) {
    it(`guardado=${JSON.stringify(guardado)} → data-theme=${JSON.stringify(esperado)}`, () => {
      expect(correrGuion(guardado)).toBe(esperado)
      expect(atributoDeTema(guardado)).toBe(esperado)
    })
  }

  it('si localStorage lanza, pinta oscuro y no rompe la página', () => {
    // Modo privado, cookies bloqueadas: no hay preferencia que respetar.
    let atributo: string | null = null
    const documento = {
      documentElement: {
        setAttribute: (k: string, v: string) => { if (k === 'data-theme') atributo = v },
        removeAttribute: () => { atributo = null },
      },
    }
    const almacen = { getItem: () => { throw new Error('bloqueado') } }
    expect(() => new Function('document', 'localStorage', GUION_TEMA)(documento, almacen)).not.toThrow()
    expect(atributo).toBe('dark')
  })
})

describe('«automático» se escribe, no se borra', () => {
  it('el hook persiste los tres modos', () => {
    const hook = leer('src', 'hooks', 'useTema.ts')
    expect(
      hook,
      'volvió el borrado: «automático» se vuelve indistinguible de «nunca eligió»',
    ).not.toMatch(/removeItem\(\s*LLAVE_TEMA/)
    expect(hook).toMatch(/setItem\(LLAVE_TEMA,\s*siguiente\)/)
  })

  it('lo guardado como «auto» se relee como «auto»', () => {
    // El caso exacto que se perdía en la recarga.
    expect(modoGuardado('auto')).toBe('auto')
    expect(modoGuardado(null)).toBe('dark')
  })

  it('el ciclo sigue pasando por los tres modos', () => {
    const hook = leer('src', 'hooks', 'useTema.ts')
    expect(hook).toContain("modo === 'auto' ? 'dark' : modo === 'dark' ? 'light' : 'auto'")
  })
})

describe('un solo sitio decide, y los dos lectores lo usan', () => {
  it('el layout no lleva su propia copia de la tabla', () => {
    const layout = leer('src', 'app', 'layout.tsx')
    expect(layout).toContain('GUION_TEMA')
    expect(
      layout,
      'volvió una segunda tabla del tema en el layout',
    ).not.toMatch(/getItem\(['"]nexusmed\.theme['"]\)/)
  })

  it('la llave conserva su nombre — renombrarla borra la preferencia del médico', () => {
    expect(LLAVE_TEMA).toBe('nexusmed.theme')
    expect(GUION_TEMA).toContain('nexusmed.theme')
  })
})
