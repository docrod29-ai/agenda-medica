/**
 * GOLDEN — la cita de guía que se caía al suelo.
 *
 * `Rec.fuente` existe y su propio comentario dice «para citarla en la nota».
 * `lib/inmuno/farmacos.ts` la exige en sus 34 recomendaciones… y NINGÚN
 * consumidor la enseñaba: ni el panel —que encima promete «con su cita de
 * guía»—, ni el texto que se le dicta a la IA para redactar la nota, ni el HTML
 * que se pega al expediente. La nota del médico salía con recomendaciones de
 * profilaxis y cero atribución.
 *
 * Este archivo vigila dos cosas distintas:
 *  1. que la cita se siga ENSEÑANDO en los tres consumidores;
 *  2. cuántas recomendaciones siguen SIN fuente declarada — que es trabajo
 *     clínico del Dr., no mío: aquí no se inventa ninguna cita.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('la cita de guía llega a donde se lee', () => {
  const panel = leer('src', 'components', 'pacientes', 'ValoracionInmuno.tsx')

  it('el panel la enseña', () => {
    expect(panel).toContain('r.fuente')
    expect(panel).toContain('Fuente:')
  })

  it('y cuando NO hay, lo dice en vez de omitirla en silencio', () => {
    // Una recomendación sin cita se lee igual que una citada, y no lo es.
    expect(panel).toContain('Sin fuente declarada')
  })

  it('viaja también al texto que redacta la nota y al HTML del expediente', () => {
    expect(panel).toContain('[Fuente: ')
    expect(panel).toContain('(Fuente: ')
  })
})

describe('inventario de recomendaciones sin fuente', () => {
  it('las del módulo de fármacos SIEMPRE traen cita', () => {
    // Su firma la hace obligatoria; esto vigila que no se relaje.
    const farmacos = leer('src', 'lib', 'inmuno', 'farmacos.ts')
    expect(farmacos).toMatch(/fuente: string\)/)
  })

  it('las del módulo de recomendaciones siguen SIN cita — declarado, no oculto', () => {
    /**
     * NEEDS_CLINICAL_REVIEW: las 42 recomendaciones de `recomendaciones.ts` no
     * declaran fuente. Ponerlas es trabajo del Dr.: una cita inventada es peor
     * que ninguna, porque se lee como respaldo.
     *
     * El número BAJA conforme él las llene; que suba significaría una
     * recomendación nueva sin respaldo.
     */
    const recs = leer('src', 'lib', 'inmuno', 'recomendaciones.ts')
    const llamadas = recs.match(/\brec\(/g) ?? []
    const conFuente = recs.match(/,\s*'(alta|media|baja)',\s*'/g) ?? []
    expect(llamadas.length - conFuente.length).toBeLessThanOrEqual(42)
  })
})
