/**
 * GOLDEN — EL BOTÓN DE PRODUCCIÓN QUEDÓ SIN PODER DESPLEGAR, Y SÓLO SE VEÍA
 * PULSÁNDOLO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `deploy-production.yml` escribía la versión DOS veces:
 *
 *   env:
 *     SHA_AUTORIZADO:   8f74901…        ← un árbol, que trae su `version.txt`
 *     VERSION_ESPERADA: nexusmed-v1178  ← la misma cosa, otra vez, a mano
 *
 * Y la Compuerta 1 exige que coincidan. El 31-ago se fusionó el PR #420, la
 * versión del repositorio subió a v1178 y **el pin se quedó en el árbol de
 * v1177**: la pareja pasó a ser imposible de satisfacer.
 *
 * El botón quedó **incapaz de desplegar**, y no había forma de enterarse salvo
 * pulsándolo: ninguna prueba, ningún guardián y ninguna de las compuertas 0-3
 * mira esa pareja a tiempo de PR. La 1 la mira, sí — pero ya dentro del
 * despliegue, que es cuando ya has decidido publicar.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Preparando el paquete de v1178, al comprobar contra qué árbol iba a publicar
 * el botón antes de decirle al dueño «púlsalo». El pin traía `nexusmed-v1177` y
 * `VERSION_ESPERADA` decía `nexusmed-v1178`.
 *
 * Es la razón por la que se comprueba antes de dar una instrucción: la
 * instrucción «fusiona y pulsa» habría fallado en la primera compuerta.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Dos sitios para el mismo dato. El PR #413 ya había cerrado exactamente esto
 * en la OTRA mitad del par —el SHA estaba escrito dos veces y las copias
 * divergieron— y lo arregló quitando el literal en vez de corregirlo, «así no
 * puede repetirse». La versión quedó fuera de aquel arreglo, y se repitió.
 *
 * Que un arreglo cierre una mitad de un par y deje la otra es de las formas más
 * caras de esta familia: el segundo caso llega con el primero ya olvidado.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La versión se **deriva del árbol autorizado** (`public/version.txt` del pin,
 * exportada a `GITHUB_ENV`), y deja de escribirse en `env:`. Una sola fuente:
 * repuntar el despliegue vuelve a ser cambiar UN número.
 *
 * No afloja nada. Lo que de verdad protege es la Compuerta 3 —que PRODUCCIÓN
 * sirva esa versión—, y sigue comparando el repositorio contra el sitio vivo.
 * Lo que se quita es una comparación de un archivo consigo mismo.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No comprueba que el pin sea el árbol correcto.** Eso es la Compuerta 0, y
 *   sigue siendo suya: aquí sólo se vigila que la versión no vuelva a tener dos
 *   fuentes.
 * · **No mira producción.** Ninguna prueba de aquí lo hace.
 * · **No impide poner un pin de un árbol viejo a propósito.** Para eso está
 *   `ROLLBACK_AUTORIZADO`, que obliga a declararlo en el diff.
 * · **Sólo mira este workflow.** Si otro archivo empezara a fijar la versión a
 *   mano, esto no lo ve.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const RUTA = '.github/workflows/deploy-production.yml'
const workflow = readFileSync(RUTA, 'utf8')

/** El bloque `env:` de nivel superior, hasta el primer `jobs:`. */
function bloqueEnv(): string {
  const desde = workflow.indexOf('\nenv:\n')
  if (desde < 0) return ''
  const hasta = workflow.indexOf('\njobs:', desde)
  return workflow.slice(desde, hasta < 0 ? undefined : hasta)
}

describe('LA VERSIÓN DEL BOTÓN NO SE ESCRIBE DOS VECES', () => {
  it('EL CASO: `env:` no fija la versión a mano', () => {
    /**
     * Ésta es la línea que causó el defecto. Si vuelve, el pin y ella pueden
     * separarse otra vez y el botón vuelve a quedar sin poder desplegar.
     */
    const env = bloqueEnv()
    expect(env, `${RUTA} no tiene bloque env:`).not.toBe('')
    const asignada = /^\s*VERSION_ESPERADA:\s*\S/m.test(env)
    expect(
      asignada,
      'VERSION_ESPERADA volvió a escribirse a mano en `env:`. La versión se ' +
      'DERIVA del árbol autorizado; dos sitios para el mismo dato se separan, y ' +
      'la última vez dejaron el botón sin poder desplegar (REG-504).',
    ).toBe(false)
  })

  it('y sí se deriva del árbol, exportándola a GITHUB_ENV', () => {
    // Quitarla de `env:` sin derivarla dejaría la variable vacía y las
    // compuertas comparando contra la nada — peor que el defecto original.
    expect(workflow).toContain('public/version.txt')
    expect(workflow).toMatch(/VERSION_ESPERADA=\$V["'\s]*>>\s*"\$GITHUB_ENV"/)
  })

  it('el pin, que es lo único a mano, sigue estando', () => {
    // La autorización del dueño es el pin. Si desapareciera, el botón publicaría
    // cualquier cosa.
    expect(bloqueEnv()).toMatch(/^\s*SHA_AUTORIZADO:\s*[0-9a-f]{40}\s*$/m)
  })

  it('la versión derivada se valida antes de usarse — un `version.txt` roto para', () => {
    // Un archivo vacío o con basura exportaría una cadena que no coincide con
    // nada, y la Compuerta 3 daría 20 vueltas antes de decirlo.
    expect(workflow).toContain('nexusmed-v[0-9]*')
    expect(workflow).toContain('no tiene forma de versión')
  })

  it('la Compuerta 3 sigue comparando contra el sitio vivo', () => {
    /**
     * Lo que se quitó fue una comparación de un archivo consigo mismo. Si esto
     * también se perdiera, el workflow dejaría de comprobar producción y el
     * arreglo habría aflojado la compuerta en vez de afinarla.
     */
    expect(workflow).toContain('$URL_PROD/version.txt')
    expect(workflow).toContain('Producción no sirve')
  })

  it('el cedazo sabe fallar: un env con la versión a mano no cuela', () => {
    /**
     * Probado al revés sobre un workflow de mentira. Sin esto, el primer caso
     * pasaría igual el día que el regex dejara de encajar — y un guardián que no
     * puede fallar no es un guardián.
     */
    const falso = '\nenv:\n  SHA_AUTORIZADO: ' + 'a'.repeat(40) + '\n  VERSION_ESPERADA: nexusmed-v9999\n\njobs:\n'
    const desde = falso.indexOf('\nenv:\n')
    const env = falso.slice(desde, falso.indexOf('\njobs:', desde))
    expect(/^\s*VERSION_ESPERADA:\s*\S/m.test(env)).toBe(true)
  })
})
