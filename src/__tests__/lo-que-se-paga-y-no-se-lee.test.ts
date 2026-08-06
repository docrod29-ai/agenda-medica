/**
 * DOS LISTAS QUE SE PAGABAN EN CADA NOTA Y NO LEÍA NADIE — REG-182.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El prompt pedía, en cada extracción:
 *
 *     "fields_auto_filled":      ["lista de campos con confidence alta…"],
 *     "fields_requiring_review": ["lista de campos con needs_review=true"],
 *
 * Estaban declaradas en el esquema y en la interfaz de `RevisionPanel`, y
 * **ningún componente las pintaba ni ninguna lógica las consultaba**. Se pagaban
 * tokens por producirlas en cada nota y se descartaban.
 *
 * ── PERO EL GASTO ERA LO DE MENOS ────────────────────────────────────────────
 *
 * `needs_review` ya viaja **por campo**, dentro de cada `CampoAuditado`. Pedir
 * además una lista de nombres es pedirle al modelo que repita en otro formato lo
 * que ya dijo, y **dos fuentes de verdad para el mismo hecho se desincronizan**:
 * el día que la lista y los campos no coincidieran, ninguna de las dos sería
 * fiable y nadie sabría cuál creer.
 *
 * Es el mismo patrón que costó REG-179 en este mismo objeto —el prompt promete
 * un campo que el esquema no declara— visto desde el otro lado: el prompt pide
 * un campo que nadie usa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SafetyBlock, camposQueRequierenRevision } from '@/lib/expediente/extraction-schema'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const prompts = leer('src', 'lib', 'expediente', 'prompts.ts')

describe('ya no se le piden al modelo', () => {
  it('el prompt no pide fields_auto_filled', () => {
    expect(prompts).not.toContain('"fields_auto_filled"')
  })
  it('ni fields_requiring_review', () => {
    expect(prompts).not.toContain('"fields_requiring_review"')
  })
  it('y en su hueco entraron los dos campos que SÍ se leen', () => {
    // REG-179: el reporte de manipulación se pedía y zod lo borraba.
    expect(prompts).toContain('"contenido_sospechoso"')
    expect(prompts).toContain('"dictamen"')
  })
})

describe('pero el esquema los sigue aceptando', () => {
  it('una nota ya guardada que los traiga no se rompe', () => {
    // Dejar de pedir un campo no puede invalidar lo que ya está en el expediente.
    const r = SafetyBlock.parse({
      fields_auto_filled: ['padecimientoActual'],
      fields_requiring_review: ['alergias'],
    })
    expect(r.fields_auto_filled).toEqual(['padecimientoActual'])
    expect(r.fields_requiring_review).toEqual(['alergias'])
  })
  it('y una nota nueva sin ellos tampoco', () => {
    const r = SafetyBlock.parse({})
    expect(r.fields_auto_filled).toEqual([])
    expect(r.fields_requiring_review).toEqual([])
  })
})

describe('lo que hacía falta se DERIVA de donde el dato vive', () => {
  it('saca los campos marcados para revisión de la propia extracción', () => {
    expect(camposQueRequierenRevision({
      secciones: {
        padecimientoActual: { needs_review: false },
        alergias: { needs_review: true },
        exploracionFisica: { needs_review: true },
      },
    })).toEqual(['alergias', 'exploracionFisica'])
  })

  it('sin campos marcados, ninguno', () => {
    expect(camposQueRequierenRevision({
      secciones: { padecimientoActual: { needs_review: false } },
    })).toEqual([])
  })

  it('no se cae con una extracción vacía', () => {
    expect(camposQueRequierenRevision({})).toEqual([])
    expect(camposQueRequierenRevision(null)).toEqual([])
    expect(camposQueRequierenRevision(undefined)).toEqual([])
  })

  it('y no puede desincronizarse: el dato es el mismo objeto', () => {
    // Ésta es la razón de fondo. La lista vieja podía decir «alergias necesita
    // revisión» mientras el campo `alergias` decía needs_review=false, y no
    // había forma de saber cuál era la verdad.
    const extraction = { secciones: { alergias: { needs_review: true } } }
    expect(camposQueRequierenRevision(extraction)).toEqual(['alergias'])
    extraction.secciones.alergias.needs_review = false
    expect(camposQueRequierenRevision(extraction)).toEqual([])
  })
})
