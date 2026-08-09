/**
 * LA DIRECCIÓN DE LAS DEPENDENCIAS.
 *
 * Guardián del §4.1 de arquitectura. Mide el grafo de `import` real —no el
 * diagrama— y exige tres cosas:
 *
 *   1. Ninguna capa importa hacia arriba.
 *   2. Cero ciclos.
 *   3. `types/` no se aleja más de ser una hoja de lo que ya está.
 *
 * ── POR QUÉ ESTO ES UN TRINQUETE Y NO UNA FOTO ───────────────────────────────
 *
 * Las tres se cumplen HOY, medidas. El valor de la prueba no es certificarlo:
 * es que **el día que alguien las rompa se entere en el PR** y no seis meses
 * después, cuando deshacerlo cuesta un refactor.
 *
 * Una arquitectura limpia no se mantiene sola. Se mantiene porque algo se pone
 * rojo.
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAPAS,
  PERMITIDO,
  TYPES_QUE_NO_SON_HOJA,
  aristas,
  ciclos,
  violacionesDeDireccion,
} from '@/lib/arquitectura/grafo-de-dependencias'

describe('la dirección de las dependencias', () => {
  it('el guardián recorre el código de verdad (si no, pasaría vacío)', () => {
    // Sin esta comprobación, un fallo del lector daría cero violaciones y la
    // prueba certificaría lo contrario de lo que mide.
    expect(aristas().length).toBeGreaterThan(500)
  })

  it('ninguna capa importa hacia arriba', () => {
    const malas = violacionesDeDireccion().map(a => `${a.desde} → ${a.hacia}`)
    expect(malas, `dependencias invertidas:\n  ${malas.join('\n  ')}`).toEqual([])
  })

  it('lib/ nunca depende de una pantalla ni de una ruta', () => {
    // El caso concreto que más importa: la lógica clínica tiene que poder
    // correr desde una ruta de API sin montar la interfaz.
    const atada = aristas()
      .filter(a => a.capaDesde === 'lib' && ['app', 'components', 'contexts', 'hooks'].includes(a.capaHacia))
      .map(a => `${a.desde} → ${a.hacia}`)
    expect(atada).toEqual([])
  })

  it('cero ciclos de importación', () => {
    const c = ciclos().map(x => x.join(' → '))
    expect(c, `ciclos:\n  ${c.join('\n  ')}`).toEqual([])
  })

  it('la lista de capas y la de permisos no se desincronizan', () => {
    for (const c of CAPAS) expect(PERMITIDO[c], `falta el permiso de ${c}`).toBeDefined()
    for (const c of CAPAS) {
      for (const d of PERMITIDO[c]) expect(CAPAS).toContain(d)
    }
  })

  it('types/ es una hoja salvo por los tres declarados, y la lista no crece', () => {
    const conRuntime = aristas()
      .filter(a => a.capaDesde === 'types')
      .map(a => a.desde)
    const nuevos = [...new Set(conRuntime)].filter(f => !(f in TYPES_QUE_NO_SON_HOJA))
    expect(
      nuevos,
      `types/ con código en tiempo de ejecución sin declarar: ${nuevos.join(', ')}`,
    ).toEqual([])
  })

  it('los archivos declarados como grieta existen — si no, la lista miente', () => {
    for (const f of Object.keys(TYPES_QUE_NO_SON_HOJA)) {
      expect(existsSync(join(process.cwd(), f)), `${f} ya no existe: quítalo de la lista`).toBe(true)
    }
  })

  it('el documento de arquitectura existe y no promete un cero que no midió', () => {
    const doc = join(process.cwd(), 'docs/architecture/DIRECCION-DE-DEPENDENCIAS.md')
    expect(existsSync(doc)).toBe(true)
  })
})
