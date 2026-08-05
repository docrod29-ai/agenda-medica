/**
 * GUARDIÁN — el aporte del sesgo, medido, no puede desviarse de lo publicado.
 *
 * ── LO QUE ESTA MEDICIÓN ESTABLECIÓ (5-ago-2026) ─────────────────────────────
 *
 * Es la primera vez que se sabe cuánto rinde sesgar el motor de voz con el
 * expediente del paciente — la pieza que este producto declara como su foso.
 *
 *   sin sesgo ............ 78,89 % de acierto en término clínico
 *   catálogo genérico .... 80,90 %   (+2,01 pp — esto lo hace cualquiera)
 *   + el expediente ...... 82,91 %   (+2,01 pp — esto exige la historia clínica)
 *
 * La segunda mitad es la que no se compra: hace falta tener el expediente y el
 * motor en la misma mano.
 *
 * ── Y ENCONTRÓ UN DEFECTO GRAVE ──────────────────────────────────────────────
 *
 * La primera corrida dio 0,00 pp. Al perseguirlo apareció REG-167: `word_boost`
 * junto a una lista de modelos hacía que el proveedor descartara
 * `universal-3-5-pro` y corriera con `universal-2`. El parámetro puesto para
 * mejorar la precisión degradaba el motor, y la medición comparaba modelos en
 * vez de sesgos.
 *
 * ── QUÉ VIGILA ESTE GUARDIÁN ─────────────────────────────────────────────────
 *
 * No vuelve a medir —eso exige el corpus y la llave del proveedor— sino que el
 * documento público y los datos crudos digan lo mismo, y que los límites no se
 * caigan del texto. Un número de laboratorio sin sus límites se convierte en una
 * promesa comercial en cuanto alguien lo copia a una diapositiva.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RUTA_JSON = 'docs/voice/SESGO-MEDIDO.json'
const RUTA_MD = 'docs/voice/SESGO-MEDIDO.md'
const json = JSON.parse(readFileSync(join(process.cwd(), RUTA_JSON), 'utf8'))
const md = readFileSync(join(process.cwd(), RUTA_MD), 'utf8')

describe('LA MEDICIÓN EXISTE Y SE PUEDE REPETIR', () => {
  it('el script que la produce está en el repositorio', () => {
    expect(existsSync(join(process.cwd(), 'scripts/medir-sesgo-vocabulario.ts'))).toBe(true)
    expect(md).toContain('npx tsx scripts/medir-sesgo-vocabulario.ts')
  })

  it('y la muestra es reproducible, no un sorteo distinto cada vez', () => {
    /**
     * Semilla fija. Un experimento que no se puede repetir no es una medición.
     */
    const script = readFileSync(join(process.cwd(), 'scripts/medir-sesgo-vocabulario.ts'), 'utf8')
    expect(script).toContain('barajaEstable')
    expect(script).toMatch(/semilla = \d+/)
  })
})

describe('EL SESGO APORTA, Y SE SABE CUÁNTO', () => {
  it('el expediente del paciente suma sobre el catálogo genérico', () => {
    expect(json.aporte.expedienteDelPaciente).toBeGreaterThan(0)
    expect(json.recall.paciente).toBeGreaterThan(json.recall.catalogo)
  })

  it('y el catálogo genérico suma sobre no tener nada', () => {
    expect(json.recall.catalogo).toBeGreaterThan(json.recall.sin)
  })

  it('las cifras del documento coinciden con los datos crudos', () => {
    const pct = (x: number) => (x * 100).toFixed(2).replace('.', ',')
    expect(md).toContain(pct(json.recall.sin))
    expect(md).toContain(pct(json.recall.catalogo))
    expect(md).toContain(pct(json.recall.paciente))
  })

  it('se nombran términos concretos que sólo rescata el expediente', () => {
    /**
     * Un porcentaje sin ejemplos no se puede discutir. Con ellos, cualquiera
     * puede comprobar si el rescate es real o un artefacto.
     */
    expect(json.rescatadosPorElExpediente.length).toBeGreaterThan(0)
    expect(md).toMatch(/erisipela|pielonefritis enfisematosa/)
  })
})

describe('LO QUE NO SE VENDE COMO LO QUE NO ES', () => {
  it('las cuatro condiciones corrieron sobre el MISMO motor', () => {
    /**
     * Es lo único que hace comparable el experimento — y lo que faltaba en la
     * primera corrida, que por eso dio 0,00 pp.
     */
    const script = readFileSync(join(process.cwd(), 'scripts/medir-sesgo-vocabulario.ts'), 'utf8')
    expect(script).toContain("return ['universal-3-5-pro']")
    expect(script).toMatch(/EL MISMO MODELO EN LAS CUATRO CONDICIONES/)
  })

  it('el documento cuenta que la primera corrida destapó REG-167', () => {
    // El defecto encontrado vale más que el número, y no puede desaparecer del relato.
    expect(md).toContain('0,00 pp')
    expect(md).toMatch(/REG-167/)
  })

  it('y declara que es un PISO de laboratorio', () => {
    expect(json.limites.length).toBeGreaterThanOrEqual(3)
    expect(md).toMatch(/piso de laboratorio/i)
    expect(md).toMatch(/una sola voz sintética/i)
  })

  it('con la salvedad de que el término YA está en el expediente', () => {
    /**
     * En una consulta real, un fármaco que se prescribe por primera vez puede no
     * estar. Es el techo, no el caso medio, y callarlo inflaría la promesa.
     */
    expect(md).toMatch(/es el techo, no el caso medio/i)
  })
})
