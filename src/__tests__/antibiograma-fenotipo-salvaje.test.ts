/**
 * GOLDEN — un aislamiento SALVAJE dejó de salir como multirresistente con alerta
 * crítica.
 *
 * ── EL FALLO, REPRODUCIDO CORRIENDO EL MOTOR ─────────────────────────────────
 *
 * Un *Enterococcus faecalis* **pan-sensible** —sensible a ampicilina y a
 * vancomicina— trae en su reporte las tres resistencias **naturales** de la
 * especie: cefalosporinas de 3ª, cotrimoxazol y colistina. Con eso, el motor
 * devolvía, textualmente:
 *
 *     Fenotipo: Resistencia a colistina/polimixina [confirmado];
 *               Multidrogorresistente (no-S en 3 clases) [sospecha]
 *     Mecanismo: Modificación del lípido A (mcr / pmrAB-mgrB)
 *     ALERTAS: [crítica] Colistina-R: opciones muy limitadas.
 *
 * Un aislamiento **tratable con ampicilina** salía de la máquina como
 * multirresistente, con «última línea comprometida» y un mecanismo **plasmídico
 * y transferible** (`mcr`) afirmado con confianza `probable`.
 *
 * La colistina no es una línea que este organismo haya perdido: **nunca la
 * tuvo**. Es un Gram positivo.
 *
 * Lo mismo con un *Proteus mirabilis* completamente sensible y con un
 * *S. maltophilia* salvaje.
 *
 * ── Y LA CORRECCIÓN YA ESTABA ESCRITA ────────────────────────────────────────
 *
 * `esIntrinsecamenteResistente` existía, y `mdr.ts` **ya lo aplicaba** — con un
 * comentario que describe justo este fallo para Proteus. Pero `analizarMDR`
 * vuelve temprano para todo lo que no sea Enterobacterales o Pseudomonas, así
 * que los Gram positivos y los no-fermentadores caían al contador de respaldo de
 * `motor.ts`, **que no filtraba nada**.
 *
 * La firma de siempre: escrito, probado, y sin aplicar en ese camino.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interpretarAntibiograma } from '@/lib/expediente/antibiograma/motor'

type Res = { antibiotico: string; interpretacion: string }
const correr = (organismo: string, resultados: Res[]) =>
  interpretarAntibiograma({ organismo, sitio: 'sangre', resultados } as never) as unknown as {
    fenotipos: { clave: string; nombre: string; base: string }[]
    alertas: { nivel: string; mensaje: string }[]
    mecanismos: { nombre: string }[]
  }

/** Las tres R naturales del enterococo, tal como vienen en un reporte real. */
const FAECALIS_SALVAJE: Res[] = [
  { antibiotico: 'Ampicilina', interpretacion: 'S' },
  { antibiotico: 'Vancomicina', interpretacion: 'S' },
  { antibiotico: 'Ceftriaxona', interpretacion: 'R' },
  { antibiotico: 'Trimetoprim-sulfametoxazol', interpretacion: 'R' },
  { antibiotico: 'Colistina', interpretacion: 'R' },
]

describe('EL CASO QUE SE ROMPÍA: E. faecalis pan-sensible', () => {
  const r = correr('Enterococcus faecalis', FAECALIS_SALVAJE)

  it('ya NO sale como colistina-R', () => {
    expect(r.fenotipos.map(f => f.clave)).not.toContain('colistin-R')
  })

  it('ya NO sale como multirresistente', () => {
    expect(r.fenotipos.map(f => f.clave)).not.toContain('MDR')
  })

  it('y NO dispara una alerta crítica', () => {
    // Un aislamiento sensible a ampicilina con «última línea comprometida»
    // gasta la atención que hace falta para el aislamiento que sí lo está.
    expect(r.alertas.filter(a => a.nivel === 'critica')).toEqual([])
  })

  it('ni afirma un mecanismo plasmídico transferible', () => {
    // `mcr` es transferible: afirmarlo cambia el aislamiento y la notificación.
    expect(r.mecanismos.map(m => m.nombre).join(' ')).not.toMatch(/mcr/)
  })
})

describe('lo mismo con los otros dos que reprodujo la auditoría', () => {
  it('Proteus mirabilis completamente sensible', () => {
    const r = correr('Proteus mirabilis', [
      { antibiotico: 'Ampicilina', interpretacion: 'S' },
      { antibiotico: 'Ceftriaxona', interpretacion: 'S' },
      { antibiotico: 'Meropenem', interpretacion: 'S' },
      { antibiotico: 'Ciprofloxacino', interpretacion: 'S' },
      { antibiotico: 'Gentamicina', interpretacion: 'S' },
      // Sus R naturales:
      { antibiotico: 'Colistina', interpretacion: 'R' },
      { antibiotico: 'Tigeciclina', interpretacion: 'R' },
      { antibiotico: 'Nitrofurantoína', interpretacion: 'R' },
    ])
    expect(r.fenotipos.map(f => f.clave)).not.toContain('colistin-R')
    expect(r.alertas.filter(a => a.nivel === 'critica')).toEqual([])
  })
})

describe('EL CONTROL NEGATIVO: la resistencia ADQUIRIDA sigue disparando', () => {
  /**
   * Sin esto, la reparación podría haber apagado la alerta para todo el mundo y
   * la prueba de arriba pasaría igual. Una colistina-R en *E. coli* NO es
   * natural: es exactamente lo que hay que gritar.
   */
  const r = correr('Escherichia coli', [
    { antibiotico: 'Meropenem', interpretacion: 'R' },
    { antibiotico: 'Colistina', interpretacion: 'R' },
    { antibiotico: 'Ciprofloxacino', interpretacion: 'R' },
    { antibiotico: 'Gentamicina', interpretacion: 'R' },
  ])

  it('sale el fenotipo de colistina-R', () => {
    expect(r.fenotipos.map(f => f.clave)).toContain('colistin-R')
  })

  it('y la alerta crítica', () => {
    expect(r.alertas.some(a => a.nivel === 'critica')).toBe(true)
  })
})

describe('cuando se excluye algo, se DICE', () => {
  it('la base del fenotipo MDR nombra las R naturales que no contó', () => {
    /**
     * Un criterio que se aplica en silencio no se puede revisar. Si el Dr. lee
     * «no-S en 3 clases» sin saber que se dejaron fuera dos, no puede juzgar la
     * cifra.
     */
    /**
     * Se usa un Gram positivo a propósito: los Enterobacterales pasan por
     * `analizarMDR`, que ya excluía lo intrínseco por su cuenta. El contador de
     * respaldo de `motor.ts` —el que estaba roto— es el que corre aquí.
     */
    const r = correr('Enterococcus faecalis', [
      { antibiotico: 'Vancomicina', interpretacion: 'R' },   // adquirida (VRE)
      { antibiotico: 'Ciprofloxacino', interpretacion: 'R' }, // adquirida
      { antibiotico: 'Gentamicina', interpretacion: 'R' },    // adquirida
      { antibiotico: 'Ceftriaxona', interpretacion: 'R' },                 // natural
      { antibiotico: 'Trimetoprim-sulfametoxazol', interpretacion: 'R' },  // natural
      { antibiotico: 'Colistina', interpretacion: 'R' },                   // natural
    ])
    const mdr = r.fenotipos.find(f => f.clave === 'MDR')
    expect(mdr, 'con tres R adquiridas SÍ debe salir MDR').toBeDefined()
    expect(mdr!.base).toMatch(/resistencias NATURALES de la especie/)
  })
})

describe('la corrección se aplica donde faltaba, y queda declarado lo que no decido', () => {
  const s = readFileSync(
    join(process.cwd(), 'src', 'lib', 'expediente', 'antibiograma', 'motor.ts'), 'utf8')

  it('el motor usa el predicado que ya existía', () => {
    expect(s).toContain("import { evaluarIntrinseca, esIntrinsecamenteResistente } from './intrinseca'")
    expect(s).toContain('esIntrinsecamenteResistente(organismo, a)')
    expect(s).toContain('esIntrinsecamenteResistente(organismo, x.antibiotico)')
  })

  it('el conteo de clases recibe el ORGANISMO, que es lo que le faltaba', () => {
    expect(s).toContain('contarClasesResistentes(organismo, r)')
  })

  it('la pregunta clínica queda marcada, no contestada por mí', () => {
    /**
     * Si el conteo MDR de respaldo debe existir siquiera para Gram positivos
     * —Magiorakos no define las categorías igual para enterococo/estafilococo—
     * es una decisión del Dr. Filtrar lo intrínseco es correcto en cualquiera de
     * los dos casos; elegir por él, no.
     */
    expect(s).toContain('NEEDS_CLINICAL_REVIEW')
    expect(s).toContain('esa pregunta es del Dr')
  })
})
