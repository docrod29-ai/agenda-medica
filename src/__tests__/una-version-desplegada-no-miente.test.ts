/**
 * UNA VERSIÓN DESPLEGADA NO PUEDE MENTIR SOBRE LO QUE LLEVA — REG-267.
 *
 * ── LO QUE PASÓ, Y ES DE LO PEOR DE ESTA SESIÓN ─────────────────────────────
 *
 * **v1146 se publicó anunciando REG-264 y no llevaba REG-264.**
 *
 * El commit del arreglo —el pase de UCI dictado repartido por aparatos, el
 * hueco 2— quedó en una rama lateral, `backup/uci-before-v9-routine`, que la
 * otra rutina había creado sobre el mismo directorio de trabajo. El commit de
 * despliegue se hizo sobre la línea de V7, que no lo contenía.
 *
 * Resultado: el `sw-changelog` decía que estaba en producción, el mensaje del
 * commit decía que estaba en producción, y el arreglo **no estaba en ninguna
 * parte del árbol desplegado**. Se descubrió dos versiones después, por
 * casualidad, buscando otra cosa.
 *
 * ── POR QUÉ NINGUNA COMPUERTA LO VIO ────────────────────────────────────────
 *
 * Todas las que existían miran el árbol **contra sí mismo**:
 *
 *   · el sello clínico exige que cada fichero sellado esté reclamado por el
 *     ledger — pero el fichero de pruebas de REG-264 se fue con el código a la
 *     rama lateral, así que no había nada sellado que reclamar;
 *   · la compuerta de familias exige que cada REG del ledger tenga familia —
 *     pero REG-264 tampoco estaba en el ledger, por lo mismo.
 *
 * Un conjunto coherente al que le falta una pieza ENTERA sigue siendo
 * coherente. Nadie comparaba **lo que el changelog anuncia** con **lo que el
 * repositorio contiene**.
 *
 * ── LO QUE ESTO COMPRUEBA ───────────────────────────────────────────────────
 *
 * Que todo REG citado en el `sw-changelog` —el documento que declara qué salió
 * en cada versión— exista de verdad en el ledger. Es barato, es exacto, y
 * habría fallado en v1146.
 *
 * **No comprueba que el código haga lo que dice**: eso son las pruebas. Sólo
 * que la pieza no falte del todo. La clase de defecto que caza es «se anunció
 * algo que no está», que es la que ocurrió.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

/** Todos los REG que el ledger declara, leyendo la línea ENTERA del encabezado. */
function regsDelLedger(): Set<number> {
  const t = leer('docs/audit/regression-ledger.md')
  return new Set(
    (t.match(/^## REG-.*$/gm) || [])
      .flatMap(l => [...l.matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))),
  )
}

/**
 * Los REG que cada versión del changelog dice llevar.
 *
 * Se lee sólo el ENCABEZADO de cada versión y su párrafo inmediato, no el
 * documento entero: una entrada puede mencionar de pasada un REG anterior
 * («la misma causa que REG-155») y eso no es una declaración de contenido.
 */
function regsAnunciados(): Map<string, number[]> {
  const t = leer('docs/maintenance/sw-changelog.md')
  const m = new Map<string, number[]>()
  const bloques = [...t.matchAll(/^## (v\d+)([^\n]*)$/gm)]
  for (const b of bloques) {
    const nums = [...b[2].matchAll(/REG-(\d+)/g)].map(x => Number(x[1]))
    if (nums.length) m.set(b[1], nums)
  }
  return m
}

describe('lo que una versión anuncia existe en el repositorio', () => {
  it('todo REG citado en el changelog está en el ledger', () => {
    /**
     * Ésta es la que habría fallado en v1146: el changelog decía REG-264 y el
     * ledger no lo tenía, porque el commit se había quedado en otra rama.
     */
    const ledger = regsDelLedger()
    const huecos: string[] = []
    for (const [version, regs] of regsAnunciados()) {
      for (const n of regs) {
        if (!ledger.has(n)) huecos.push(`${version} anuncia REG-${n} y el ledger no lo tiene`)
      }
    }
    expect(
      huecos,
      'Una versión declara algo que no está en el repositorio. La causa típica ' +
      'es un commit que se quedó en otra rama:\n  ' + huecos.join('\n  '),
    ).toEqual([])
  })

  it('la versión del service worker y la de version.txt son la misma', () => {
    /**
     * Se desplegó una vez con las dos desfasadas. `version.txt` es lo que
     * responde producción y lo que se verifica con `curl` tras publicar: si
     * miente, la verificación posterior al despliegue confirma la versión
     * equivocada.
     */
    const sw = /const CACHE = '([^']+)'/.exec(leer('public/sw.js'))?.[1]
    expect(sw, 'no se pudo leer la versión del service worker').toBeTruthy()
    expect(leer('public/version.txt').trim()).toBe(sw)
  })

  it('la versión en curso tiene entrada en el changelog', () => {
    /**
     * Subir el número sin escribir qué lleva es cómo empieza el problema
     * anterior: una versión sin declaración no se puede contrastar con nada.
     */
    const v = leer('public/version.txt').trim().replace('nexusmed-', '')
    expect(leer('docs/maintenance/sw-changelog.md')).toContain(`## ${v}`)
  })
})

describe('y el ledger no declara reparaciones fantasma', () => {
  it('todo fichero sellado existe en el disco', () => {
    /**
     * El reverso del mismo fallo: un sello que nombra un fichero que se fue con
     * su rama. El sello leería un `minCasos` de algo inexistente y la compuerta
     * clínica protegería el vacío.
     */
    const sello = JSON.parse(leer('src/lib/clinical/invariantes-clinicos.json')) as
      { archivos: { archivo: string }[] }
    const fantasmas = sello.archivos
      .filter(a => { try { readFileSync(join(RAIZ, a.archivo)); return false } catch { return true } })
      .map(a => a.archivo)
    expect(fantasmas, 'ficheros sellados que no existen:\n  ' + fantasmas.join('\n  ')).toEqual([])
  })
})

export const POR_QUE_LAS_OTRAS_COMPUERTAS_NO_LO_VIERON =
  'Todas miran el árbol contra sí mismo. Un conjunto coherente al que le falta ' +
  'una pieza ENTERA sigue siendo coherente: faltaba el código, faltaba su ' +
  'prueba, faltaba su entrada y faltaba su familia — las cuatro a la vez.'
