/**
 * LA REGLA «EL LLM NO CALCULA» VALE EN TODA LA APLICACIÓN — REG-194.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Es una regla permanente de este repositorio: las escalas clínicas las hace un
 * motor determinista y probado, nunca el modelo. Estaba escrita **sólo dentro de
 * la nota de UCI** (`evolucion_uci`), y fuera de ahí el prompt le pedía al modelo
 * exactamente lo contrario:
 *
 *     «Pediatría: dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos.»
 *     «percentiles si hay datos… Cálculo de líquidos Holliday-Segar cuando aplique»
 *
 * Aritmética pediátrica —dosis por kilo, percentiles, volumen de líquidos— hecha
 * por un modelo generativo, en una nota que se firma con cédula profesional.
 *
 * ── POR QUÉ UN MOTOR Y NO UN MODELO ──────────────────────────────────────────
 *
 * Una cifra que calcula un modelo puede estar mal **sin que nadie lo note**: no
 * hay excepción, no hay traza, se lee como cualquier otro número. Un motor
 * equivocado se arregla una vez y queda probado; un modelo equivocado falla
 * distinto cada vez.
 *
 * Y los motores YA EXISTEN: `oms-crecimiento` (tablas LMS de la OMS),
 * `calcularDosisPediatrica`, `funcion-renal`, `prevent`, `calculadoras`.
 *
 * ── LO QUE QUEDA PARA EL DR. ─────────────────────────────────────────────────
 *
 * Holliday-Segar **no tiene motor** en el repositorio. No se escribe uno esta
 * noche: implementar una fórmula de líquidos pediátricos sin que él la valide
 * sería decidir por él. Queda anotado como NEEDS_CLINICAL_REVIEW y, mientras
 * tanto, el modelo transcribe lo que se dictó en vez de calcularlo — que es lo
 * seguro de las dos opciones.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const prompts = readFileSync(join(process.cwd(), 'src/lib/expediente/prompts.ts'), 'utf8')

describe('la regla es global, no de un tipo de nota', () => {
  it('existe como regla numerada del prompt', () => {
    expect(prompts).toContain('16-bis. TÚ NO CALCULAS')
  })

  it('dice explícitamente que vale para toda la aplicación', () => {
    expect(prompts).toContain('Es regla de toda la aplicación, no sólo de la nota de UCI')
  })

  it('nombra los motores que sí lo hacen', () => {
    // Un «no lo hagas» sin decir quién lo hace deja el trabajo sin dueño.
    for (const motor of ['oms-crecimiento', 'calcularDosisPediatrica', 'funcion-renal']) {
      expect(prompts, `no nombra ${motor}`).toContain(motor)
    }
  })

  it('explica por qué, que es lo que hace que se respete', () => {
    // El salto de línea del prompt parte la frase: se busca por regex.
    expect(prompts).toMatch(/puede estar mal \*\*sin que\s+nadie lo note\*\*/)
  })

  it('y la de UCI sigue en su sitio', () => {
    expect(prompts).toContain('NUNCA calcules escalas ni índices')
  })
})

/**
 * Desde I-5 las guías por especialidad viven en su propio archivo — se mudaron
 * porque la app la van a usar médicos de cualquier rama y un criterio clínico
 * que sólo se cambia recompilando no sirve para eso.
 *
 * Estas aserciones siguen mirando EL MISMO CONTENIDO; lo único que cambia es
 * dónde está. Se lee el archivo nuevo Y el prompt, porque lo que no puede pasar
 * es que la orden de calcular reaparezca en cualquiera de los dos.
 */
const guias = readFileSync(join(process.cwd(), 'src/lib/expediente/guias-de-especialidad.ts'), 'utf8')
const promptYGuias = prompts + '\n' + guias

describe('las guías de especialidad dejaron de pedir aritmética', () => {
  it('pediatría ya no ordena calcular mg/kg', () => {
    expect(promptYGuias).not.toContain('Pediatría: dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar')
  })

  it('ni percentiles', () => {
    expect(promptYGuias).not.toContain('percentiles si hay datos; dosis en mg/kg/día')
  })

  it('ahora manda transcribir lo dictado, con su unidad', () => {
    expect(promptYGuias).toContain('TAL COMO SE DICTARON')
  })

  it('y los líquidos son decisión del médico', () => {
    expect(promptYGuias).toContain('Si se dictó un cálculo de líquidos, transcríbelo; no lo hagas tú')
  })
})

describe('lo que el modelo SÍ debe hacer', () => {
  it('señalar el hueco cuando falta un dato para que el motor calcule', () => {
    // Señalar el hueco es suyo; llenarlo con aritmética no.
    expect(prompts).toContain('Señalar el hueco es tuyo; llenarlo con aritmética no')
  })
})
