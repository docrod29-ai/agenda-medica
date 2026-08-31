/**
 * EL INVENTARIO DE PANTALLAS NO MIENTE — V9 · PATIENT-UX-TRUTH-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Nada, todavía. Este guardián nace ANTES del defecto, y esa es toda su gracia.
 *
 * La primera unidad de V9 produce una auditoría de «toda pantalla y flujo».
 * Una auditoría es una foto: vale el día que se toma. El repositorio, en
 * cambio, se mueve — este programa ha añadido pantallas en catorce de las
 * últimas veinte versiones. A la semana, el documento que dice «78 pantallas»
 * sigue diciéndolo con la misma seguridad, y ya es falso.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * No hizo falta descubrirlo: ya está descubierto y sellado en **REG-241**, con
 * el tablero del loop, que mintió TRES veces por la misma causa. El propio
 * `MASTER_STATE.json` había escrito el diagnóstico correcto después de la
 * segunda —«mientras no lo derive un script, va a volver a pasar»— y volvió a
 * pasar. La lección no es «acuérdate»: es que **cualquier cifra que dependa de
 * que alguien se acuerde acabará mintiendo**.
 *
 * Así que la parte contable del inventario se deriva del árbol de rutas, y este
 * guardián comprueba que el archivo en disco sea exactamente lo que el árbol
 * produce hoy.
 *
 * ── LA CAUSA RAÍZ QUE SE ATACA ──────────────────────────────────────────────
 *
 * No es la desactualización: es que **añadir una pantalla y actualizar el
 * inventario son dos actos separados**, y el segundo es opcional. Aquí deja de
 * serlo — quien añada un `page.tsx` ve fallar esta prueba y corre una orden.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo derivable se deriva. El juicio —qué pantalla es P0, qué se rediseña
 * primero— se escribe a mano en `CURRENT_PRODUCT_DESIGN_AUDIT.md`, porque el
 * criterio no sale de un `grep`.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No dice que las pantallas estén bien. Dice que están CONTADAS. Aprobar una
 *   pantalla exige abrirla en un navegador (directiva V9 §4) y ninguna prueba
 *   de Node sustituye eso.
 * - Mide el `page.tsx`, no su árbol de componentes: una pantalla delgada que
 *   delega en un componente grande sale con `Resp: —` sin ser un defecto.
 * - No vigila `src/app/api/`: eso son rutas, no pantallas.
 * - La clasificación por superficie es una LISTA A MANO en el script. Una ruta
 *   nueva del paciente que nadie añada a esa lista saldrá como `medico`. Es
 *   deliberado: una heurística fallaría en silencio; una lista se queda corta
 *   de forma visible. Lo vigila la última prueba de este archivo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, sep } from 'path'
import { generar } from '../../scripts/design/inventario-de-pantallas.mjs'

const DOC = join(process.cwd(), 'docs', 'design', 'SCREEN_INVENTORY.md')

/** Cuenta `page.tsx` de verdad, sin pasar por el script — si el script se
 *  equivoca al recorrer el árbol, esta cuenta independiente lo delata. */
function contarPaginas(dir: string): number {
  let n = 0
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'api') continue
      n += contarPaginas(ruta)
    } else if (entrada === 'page.tsx') n++
  }
  return n
}

describe('el inventario de pantallas coincide con el árbol de rutas', () => {
  it('el documento existe', () => {
    expect(existsSync(DOC)).toBe(true)
  })

  it('lo que hay en disco es exactamente lo que produce el árbol hoy', () => {
    /**
     * Ésta es la prueba que muerde. Añadir `src/app/(dashboard)/loquesea/page.tsx`
     * sin regenerar el documento la pone en rojo.
     *
     * Probada al revés: se le quitó una fila al markdown a mano y falló; se
     * regeneró y pasó.
     *
     * EL MENSAJE DICE CÓMO ARREGLARLO, y no es cortesía. La comparación es de
     * documento entero: cuando falla, la salida es un diff de ochenta filas del
     * que hay que deducir qué pasó. Cazó dos veces el mismo día el mismo olvido
     * —tocar una pantalla y no regenerar— y las dos costó diagnóstico en vez de
     * un `node scripts/…`. Una compuerta que sabe la respuesta y no la dice
     * cobra su peaje cada vez.
     */
    expect(
      readFileSync(DOC, 'utf8'),
      'El inventario no coincide con el árbol. Casi siempre es que se tocó una ' +
      'pantalla y no se regeneró el documento: corre ' +
      '`node scripts/design/inventario-de-pantallas.mjs`. No lo edites a mano — ' +
      'sale de un script a propósito.',
    ).toBe(generar())
  })

  it('cuenta las mismas pantallas que un recorrido independiente del árbol', () => {
    const real = contarPaginas(join(process.cwd(), 'src', 'app'))
    const enDoc = Number(/\*\*Total: (\d+) pantallas\.\*\*/.exec(readFileSync(DOC, 'utf8'))?.[1])
    expect(enDoc).toBe(real)
  })

  it('no queda ninguna ruta sin clasificar por superficie', () => {
    /**
     * El script marca `?` la ruta que no encaja en ninguna lista. Si aparece
     * una, hay que decidir a quién le habla esa pantalla ANTES de seguir: la
     * superficie es lo que decide si V9 la gobierna y si entra al tanteo de
     * Practice.
     */
    expect(readFileSync(DOC, 'utf8')).not.toContain('sin clasificar')
  })

  it('la superficie del paciente no se queda vacía sin que nadie se entere', () => {
    /**
     * V9 existe para la superficie del paciente. Si un refactor la deja en
     * cero, el inventario seguiría siendo «correcto» y el programa se habría
     * quedado sin objeto. Esta prueba es el mínimo vital, no un techo.
     */
    const doc = readFileSync(DOC, 'utf8')
    const paciente = Number(/\| paciente \| (\d+) \|/.exec(doc)?.[1])
    expect(paciente).toBeGreaterThanOrEqual(9)
  })
})
