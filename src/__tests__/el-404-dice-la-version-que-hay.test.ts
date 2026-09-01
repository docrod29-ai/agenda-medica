/**
 * GOLDEN — el 404 dice la versión que hay, y se ve en los dos temas.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * 1 · **El sello mentía.** El recuadro de diagnóstico escribía
 *     `Build: 2026-06-03-ausculta`, un literal a mano. El sello real vive en
 *     `public/version.txt` y hoy dice `nexusmed-v1174`: llevaba casi tres
 *     meses desfasado y ni siquiera tenía la forma del sello real. Ese
 *     recuadro es exactamente lo que el médico copia y manda cuando reporta
 *     «no me abre», así que soporte recibía un identificador falso para
 *     localizar el despliegue.
 *
 * 2 · **La página se pintaba oscura dentro de una app clara.** Lienzo
 *     `#0B0C0E` y texto `#F2EFE9` fijos. Un comentario del propio archivo
 *     justificaba la paleta fija diciendo que esta página «vive FUERA del
 *     shell y no hereda sus tokens». Era falso, y el propio archivo lo
 *     desmentía dos líneas más arriba usando `var(--nexus)`: `not-found` se
 *     pinta dentro del layout raíz, que carga `globals.css`.
 *
 * 3 · **Contraste bajo AA.** `#6C7075` sobre `#0B0C0E` da **3,93 : 1**. Lo
 *     llevaban el texto de ayuda («si el problema persiste…») y la etiqueta
 *     «URL fallida:» — justo lo que hay que poder leer cuando la app falla.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «depende de que alguien se acuerde» para (1): el dato ya vivía en
 * el repositorio y un segundo sitio lo repetía a mano. Y para (2) y (3), un
 * comentario que declaraba una limitación que no existía: nadie vuelve a
 * comprobar lo que ya está explicado.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - Es un barrido de fuente: comprueba que no queden literales de tema y que
 *   la versión se pida a `/version.txt`. No abre un navegador.
 * - No comprueba la auto-reparación del service worker que hace esta página
 *   (desregistrar + purgar cachés): eso necesita navegador.
 * - No dice nada de `global-error.tsx`, que SÍ tiene paleta fija con razón —
 *   se activa cuando ni el layout carga, así que no puede contar con la hoja.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const SRC = leer('src', 'app', 'not-found.tsx')

/**
 * El archivo SIN comentarios.
 *
 * Los comentarios de este repositorio citan el defecto que arreglaron —es su
 * trabajo— así que un guardián que busque el literal viejo en el texto
 * completo se dispara con la explicación de por qué ya no está. Se mira lo
 * que se EJECUTA; lo que se explica se deja explicar.
 */
const CODIGO = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

describe('el 404 no inventa una versión', () => {
  it('la pide a /version.txt, que es de donde sale el sello real', () => {
    expect(SRC).toContain("fetch('/version.txt'")
    // Sin caché: pedir el sello desde la caché es preguntarle al que miente.
    expect(SRC).toMatch(/version\.txt['"],\s*\{\s*cache:\s*'no-store'/)
  })

  it('no queda ningún sello escrito a mano', () => {
    expect(CODIGO, 'volvió un literal de build en el 404').not.toMatch(/Build:\s*\d{4}-\d{2}-\d{2}/)
    expect(CODIGO).not.toContain('2026-06-03-ausculta')
  })

  it('si no hay sello, no enseña ninguno', () => {
    /**
     * «Ausencia de dato no es dato de ausencia» también aquí: un `Versión: —`
     * o un `Versión: desconocida` invita a reportarlo como si fuera un dato.
     * El renglón entero no existe si no se pudo leer.
     */
    expect(SRC).toMatch(/\{version && <div/)
  })

  it('el sello que se pide tiene la forma del que hay escrito hoy', () => {
    // Probado contra el archivo real, no contra lo que suponemos que dice.
    expect(leer('public', 'version.txt').trim()).toMatch(/^nexusmed-v\d+$/)
  })
})

describe('el 404 obedece al tema', () => {
  it('no queda ningún literal de color salvo el blanco de --nexus-solido', () => {
    const literales = CODIGO.split('\n')
      // --nexus-solido está medido con blanco encima en los dos temas.
      .filter(l => !l.includes('nexus-solido'))
      .flatMap(l => [...l.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]))
    expect(
      literales,
      'un literal aquí pinta el 404 con el tema contrario al de la app',
    ).toEqual([])
  })

  it('el lienzo y la tinta salen de los tokens', () => {
    expect(SRC).toContain("background: 'var(--bg)'")
    expect(SRC).toContain("color: 'var(--text)'")
  })

  it('ya no dice que esta página no hereda los tokens del shell', () => {
    /**
     * Era la justificación de la paleta fija, y era falsa. El comentario que
     * la sustituye deja escrito POR QUÉ era falsa, para que nadie vuelva a
     * dar por buena la limitación y con ella el 404 oscuro dentro de la app
     * clara.
     */
    expect(SRC).toMatch(/No era cierto/)
  })
})
