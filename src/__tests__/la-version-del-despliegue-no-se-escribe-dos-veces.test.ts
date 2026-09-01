/**
 * LA VERSIÓN DEL DESPLIEGUE NO SE ESCRIBE EN DOS SITIOS.
 *
 * QUÉ FALLABA
 * ────────────
 * `deploy-production.yml` decía la versión **dos veces**: una en el árbol
 * (`public/version.txt`, al que apunta `SHA_AUTORIZADO`) y otra a mano, en
 * `env.VERSION_ESPERADA`. El 31-ago el commit que subió el service worker a
 * `nexusmed-v1178` movió la copia a mano y **no** movió el pin, que se quedó en
 * el árbol de `v1177`.
 *
 * Resultado: el botón de producción quedó inservible desde ese commit. Medido
 * con la propia compuerta, no deducido — `decidirArbolAutorizado` con los valores
 * reales de main devuelve:
 *
 *   ok:false · «41 commits por detrás Y difiere en lo que este workflow publica:
 *   public/version.txt, public/sw.js»
 *
 * La Compuerta 0 sí dice qué hacer («pon el SHA de la cabeza en
 * SHA_AUTORIZADO»). Lo que ninguna compuerta puede hacer es avisar ANTES de que
 * alguien pulse: viven en el runner. Nadie pulsó entre el 31-ago y el 1-sep, y
 * durante esas horas el repositorio no tenía forma de decir que su único botón
 * de producción estaba roto.
 *
 * CÓMO SE DESCUBRIÓ
 * ──────────────────
 * El 1-sep, contestando «¿ya se puede desplegar?» cuando el dueño no veía ningún
 * cambio en la aplicación. El botón llevaba desde el 31-ago sin poder correr, y
 * nada en el repositorio lo decía: las 12 ejecuciones anteriores están en verde y
 * ninguna prueba compara el pin con la versión.
 *
 * CAUSA RAÍZ
 * ───────────
 * `dos_fuentes_de_verdad` para el mismo hecho. Es exactamente lo que el commit
 * que lo introdujo dijo que quería evitar («dos sitios que dicen la versión son
 * dos sitios que se desincronizan») — dicho de la copia entre el workflow y el
 * service worker, y aplicado creando una tercera copia.
 *
 * LA REGLA QUE LO HACE SEGURO
 * ────────────────────────────
 * La versión se **deriva** del árbol autorizado después del checkout, y se
 * exporta por `$GITHUB_ENV`. Queda **un** mando: el pin. La autorización del
 * dueño sigue siendo el pin —que la Compuerta 0 obliga a ser la cabeza de
 * `main`, o idéntico en lo publicable—, no una cadena escrita al lado.
 *
 * Y la derivación **para** si `version.txt` no tiene forma de versión: con la
 * cadena vacía, las compuertas 1 y 3 compararían `"" = ""` y pasarían las dos.
 *
 * QUÉ *NO* CUBRE
 * ───────────────
 * - No comprueba qué versión sirve producción. Eso lo mide la Compuerta 3 contra
 *   el sitio vivo, desde el runner, y sigue sin poder hacerse desde aquí.
 * - No comprueba que el pin sea la cabeza de `main`: eso es la Compuerta 0, y su
 *   golden es `el-boton-de-produccion-no-publica-un-arbol-viejo.test.ts`. Esta
 *   prueba no puede saber cuál es la cabeza de `main` sin red ni historia
 *   completa (el checkout de CI es de profundidad 1).
 * - No prueba que GitHub Actions interprete el YAML. Prueba la DECISIÓN escrita
 *   en él.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const YAML = readFileSync('.github/workflows/deploy-production.yml', 'utf8')

/**
 * El revisor, aparte de los `expect`, para poder MUTILAR el workflow y comprobar
 * que cada regla cae por su cuenta. Una comprobación que sólo se corre sobre el
 * archivo bueno no demuestra que sepa decir que no.
 */
export function revisarVersionDelDespliegue(yaml: string): string[] {
  const fallos: string[] = []

  // 1 · Nadie escribe la versión a mano en `env:`.
  const env = yaml.slice(yaml.indexOf('\nenv:'), yaml.indexOf('\njobs:'))
  if (/^\s*VERSION_ESPERADA:\s*\S/m.test(env)) {
    fallos.push('VERSION_ESPERADA escrita a mano en env: es la segunda fuente de verdad')
  }

  // 2 · Se deriva del árbol, y del archivo que se publica.
  if (!/VERSION_ESPERADA=\$VERSION/.test(yaml) || !yaml.includes('GITHUB_ENV')) {
    fallos.push('la versión no se deriva ni se exporta por GITHUB_ENV')
  }
  if (!/<\s*public\/version\.txt/.test(yaml)) {
    fallos.push('la versión no se lee de public/version.txt')
  }

  // 3 · Se deriva ANTES de usarse. «Escrito y sin conectar», aplicado al orden.
  const derivacion = yaml.indexOf('VERSION_ESPERADA=$VERSION')
  const primerUso = yaml.indexOf('$VERSION_ESPERADA')
  if (derivacion === -1 || primerUso === -1 || derivacion > primerUso) {
    fallos.push('la versión se usa antes de derivarse')
  }

  // 4 · Una versión ilegible PARA. Sin esto, `"" = ""` deja pasar las compuertas
  //     1 y 3 a la vez, que es peor que no tenerlas.
  if (!/nexusmed-v\[0-9\]\*\)/.test(yaml) || !/no tiene forma de versión/.test(yaml)) {
    fallos.push('un version.txt vacío o con otra forma no detiene el despliegue')
  }

  return fallos
}

describe('el botón de producción dice la versión UNA vez', () => {
  it('el workflow de hoy pasa las cuatro reglas', () => {
    expect(revisarVersionDelDespliegue(YAML)).toEqual([])
  })

  it('CAE si alguien vuelve a escribir la versión a mano en env:', () => {
    const mutilado = YAML.replace("  ROLLBACK_AUTORIZADO: ''", "  ROLLBACK_AUTORIZADO: ''\n  VERSION_ESPERADA: nexusmed-v1178")
    expect(revisarVersionDelDespliegue(mutilado)).toContain(
      'VERSION_ESPERADA escrita a mano en env: es la segunda fuente de verdad',
    )
  })

  it('CAE si se quita la derivación', () => {
    const mutilado = YAML.replace('VERSION_ESPERADA=$VERSION', 'VERSION_QUE_NADIE_LEE=$VERSION')
    expect(revisarVersionDelDespliegue(mutilado)).toContain(
      'la versión no se deriva ni se exporta por GITHUB_ENV',
    )
  })

  it('CAE si la versión se deriva DESPUÉS de usarse', () => {
    // El paso existe, pero al final: las compuertas 1 y 3 ya han corrido con la
    // variable sin definir.
    const paso = YAML.slice(YAML.indexOf("      - name: 'La versión sale del árbol"), YAML.indexOf('      # ────'))
    const mutilado = YAML.replace(paso, '') + '\n' + paso
    expect(revisarVersionDelDespliegue(mutilado)).toContain('la versión se usa antes de derivarse')
  })

  it('CAE si una versión ilegible deja de parar el despliegue', () => {
    const mutilado = YAML.replace('no tiene forma de versión', 'da igual')
    expect(revisarVersionDelDespliegue(mutilado)).toContain(
      'un version.txt vacío o con otra forma no detiene el despliegue',
    )
  })
})

describe('los dos sitios del repositorio que declaran la versión coinciden', () => {
  // La Compuerta 1 ya lo comprueba en el runner. Aquí falla ANTES: en el PR que
  // sube el service worker y se olvida de la mitad, no en el botón.
  const version = readFileSync('public/version.txt', 'utf8').trim()

  it('public/version.txt tiene forma de versión', () => {
    expect(version).toMatch(/^nexusmed-v\d+$/)
  })

  it('public/sw.js declara exactamente esa versión', () => {
    expect(readFileSync('public/sw.js', 'utf8')).toContain(`const CACHE = '${version}'`)
  })
})
