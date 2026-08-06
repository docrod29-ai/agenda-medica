/**
 * EL EJE QUE FALTABA: ¿YA LO TOMA, O SE LO RECETO HOY? — REG-183.
 *
 * ── POR QUÉ IMPORTA ──────────────────────────────────────────────────────────
 *
 * La compuerta de dosis (REG-174/175) trataba igual dos cosas que no se parecen:
 *
 *   · «Toma algo para la presión, no sé cuál» — es un HALLAZGO clínico. Que el
 *     paciente no sepa la dosis ES el dato, no un descuido del médico.
 *   · «Le doy levotiroxina» sin cantidad — es un ERROR que sale impreso en la
 *     receta, y quien la surta no puede saber cuánto dispensar.
 *
 * Al medirlo sobre sus notas reales, **4 de 8 no se habrían podido firmar**, y lo
 * que las bloqueaba era medicación previa (REG-176). Sin este campo ni el modelo
 * ni la compuerta pueden distinguirlas: sólo ven un renglón sin dosis.
 *
 * ── LO QUE ESTO NO HACE, Y ES DELIBERADO ─────────────────────────────────────
 *
 * **No cambia qué bloquea la firma.** Eso lo decidió el médico dueño el 5-ago
 * con el dato delante, y volver a decidirlo por mi cuenta sería pasar por encima
 * de su decisión. De momento el eje sirve para que el aviso DIGA de cuál de los
 * dos se trata — información que hoy no existe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MedicamentoAuditado } from '@/lib/expediente/extraction-schema'
import { construirAvisos } from '@/lib/expediente/avisos-consulta'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const prompts = leer('src', 'lib', 'expediente', 'prompts.ts')
const tipos = leer('src', 'types', 'expediente.ts')

describe('el campo existe y llega desde la extracción', () => {
  it('el tipo lo declara', () => {
    expect(tipos).toContain("procedenciaClinica?: 'ya_lo_toma' | 'se_prescribe_hoy'")
  })

  it('el esquema acepta «ya lo toma»', () => {
    const m = MedicamentoAuditado.parse({ nombre: 'losartán', procedenciaClinica: 'ya_lo_toma' })
    expect(m.procedenciaClinica).toBe('ya_lo_toma')
  })

  it('y «se prescribe hoy»', () => {
    const m = MedicamentoAuditado.parse({ nombre: 'amoxicilina', procedenciaClinica: 'se_prescribe_hoy' })
    expect(m.procedenciaClinica).toBe('se_prescribe_hoy')
  })

  it('un valor que no es ninguno de los dos se rechaza', () => {
    expect(() => MedicamentoAuditado.parse({ nombre: 'x', procedenciaClinica: 'quizá' })).toThrow()
  })
})

describe('la ausencia NO significa nada — y eso es a propósito', () => {
  it('sin el campo, el medicamento sigue siendo válido', () => {
    expect(MedicamentoAuditado.parse({ nombre: 'metformina' }).procedenciaClinica).toBeUndefined()
  })

  it('NO tiene valor por omisión', () => {
    /**
     * Darle uno sería exactamente el error de «No especificada»: rellenar un
     * hueco con algo que parece un dato. Las notas anteriores no lo traen y no
     * se puede adivinar cuál era cuál.
     */
    const esquema = leer('src', 'lib', 'expediente', 'extraction-schema.ts')
    const i = esquema.indexOf('procedenciaClinica:')
    const linea = esquema.slice(i, esquema.indexOf('\n', i))
    expect(linea).not.toContain('.default(')
    expect(linea).toContain('.optional()')
  })
})

describe('el prompt enseña a distinguirlos, y a callarse si no lo sabe', () => {
  it('existe la regla', () => {
    expect(prompts).toContain('6-ter. DISTINGUE LO QUE EL PACIENTE YA TOMA DE LO QUE EL MÉDICO RECETA HOY')
  })

  it('explica que no saber la dosis de lo que ya toma es un hallazgo', () => {
    expect(prompts).toContain('es un HALLAZGO, no un descuido')
  })

  it('y que lo prescrito hoy sale impreso en la receta', () => {
    expect(prompts).toContain('Sale impreso en')
  })

  it('manda OMITIR el campo si no se sabe, en vez de adivinar', () => {
    expect(prompts).toContain('OMITE el campo: no lo adivines')
  })

  it('la plantilla lo incluye en los dos bloques de medicamentos', () => {
    expect(prompts.split('"procedenciaClinica"').length - 1).toBeGreaterThanOrEqual(2)
  })
})

describe('el aviso dice de cuál de los dos se trata', () => {
  const uno = (extra: Record<string, unknown>) => construirAvisos({
    dosisIncompletas: [{ med: 'levotiroxina', mensaje: 'la receta no lleva cantidad', ...extra }],
  })[0]

  it('lo que ya toma se dice', () => {
    expect(uno({ procedencia: 'ya_lo_toma' }).detalle)
      .toBe('la receta no lleva cantidad (medicación que el paciente ya toma)')
  })

  it('lo que se prescribe hoy también', () => {
    expect(uno({ procedencia: 'se_prescribe_hoy' }).detalle)
      .toBe('la receta no lleva cantidad (se prescribe en esta consulta)')
  })

  it('y si no se sabe, no se inventa la coletilla', () => {
    // Sería el mismo error que rellenar un hueco con «No especificada».
    expect(uno({}).detalle).toBe('la receta no lleva cantidad')
  })
})

describe('lo que NO cambió, y es deliberado', () => {
  it('la compuerta sigue bloqueando igual, venga de donde venga', () => {
    /**
     * Qué bloquea lo decidió el médico dueño el 5-ago con el dato delante.
     * Ampliarlo o restringirlo por mi cuenta sería decidir por él una segunda
     * vez. Lo que se añade es información, no una compuerta distinta.
     */
    const a = construirAvisos({ dosisIncompletas: [{ med: 'a', mensaje: 'm', procedencia: 'ya_lo_toma' }] })
    const b = construirAvisos({ dosisIncompletas: [{ med: 'b', mensaje: 'm', procedencia: 'se_prescribe_hoy' }] })
    expect(a[0].nivel).toBe('bloquea')
    expect(b[0].nivel).toBe('bloquea')
    expect(a[0].descartable).toBe(false)
    expect(b[0].descartable).toBe(false)
  })
})
