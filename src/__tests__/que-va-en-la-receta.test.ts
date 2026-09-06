/**
 * QUÉ VA EN LA RECETA — REG-221 / Golden Path 5.
 *
 * ── LA QUEJA, CON SUS PALABRAS ──────────────────────────────────────────────
 *
 *   «no me gusta que hagas la receta con lo que te digo de antecedentes,
 *    la receta es cuando ya te estén diciendo el plan»
 *
 * ── CONTRATO DE SEGURIDAD ───────────────────────────────────────────────────
 *
 * La lista clínica sigue llenándose durante la conversación porque de ella
 * dependen alergias, interacciones y dosis. Pero «apareció en la extracción» no
 * equivale a «el médico decidió prescribirlo».
 *
 * La frontera conoce quién creó cada lote: `nuevos` viene de IA. Si ese lote no
 * declara `procedenciaClinica`, el renglón queda `borrador`: visible/revisable y
 * útil para seguridad, pero no imprimible. Los renglones manuales legados sin
 * etiqueta siguen siendo compatibles porque sí nacieron de una acción directa
 * del médico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'
import {
  deDondeSale, loQueSeReceta, loQueYaTomaba, fusionarMedicamentos, medicamentosDeLaReceta,
} from '@/lib/expediente/que-va-en-la-receta'
import type { Medicamento } from '@/types/expediente'

const med = (nombre: string, extra: Partial<Medicamento> = {}): Medicamento =>
  ({ nombre, dosis: '', via: 'oral', frecuencia: '', duracion: '', ...extra } as Medicamento)

describe('el campo sobrevive al esquema (era donde se borraba)', () => {
  it('la lista PLANA conserva «ya lo toma»', () => {
    const r = RespuestaExtraccion.parse({
      medicamentos: [{ nombre: 'losartán', dosis: '50 mg', procedenciaClinica: 'ya_lo_toma' }],
    })
    expect(r.medicamentos[0].procedenciaClinica).toBe('ya_lo_toma')
  })

  it('y «se prescribe hoy»', () => {
    const r = RespuestaExtraccion.parse({
      medicamentos: [{ nombre: 'amoxicilina', procedenciaClinica: 'se_prescribe_hoy' }],
    })
    expect(r.medicamentos[0].procedenciaClinica).toBe('se_prescribe_hoy')
  })

  it('sin el campo sigue siendo válido, y NO se inventa un valor en el parser', () => {
    const r = RespuestaExtraccion.parse({ medicamentos: [{ nombre: 'metformina' }] })
    expect(r.medicamentos[0].procedenciaClinica).toBeUndefined()
  })
})

describe('qué baja al papel', () => {
  const lista = [
    med('losartán', { procedenciaClinica: 'ya_lo_toma' }),
    med('metformina', { procedenciaClinica: 'ya_lo_toma' }),
    med('amoxicilina', { procedenciaClinica: 'se_prescribe_hoy' }),
    med('paracetamol'), // renglón manual legado: acción directa del médico
    med('ceftriaxona', { estado: 'borrador' }), // intención automática todavía no resuelta
  ]

  it('lo que ya tomaba y lo todavía borrador NO se receta', () => {
    expect(loQueSeReceta(lista).map(m => m.nombre)).toEqual(['amoxicilina', 'paracetamol'])
  })

  it('lo que ya tomaba sí se puede listar aparte, para la nota', () => {
    expect(loQueYaTomaba(lista).map(m => m.nombre)).toEqual(['losartán', 'metformina'])
  })

  it('un renglón manual legado sin etiqueta conserva compatibilidad', () => {
    expect(deDondeSale(med('paracetamol'))).toBe('no_se_sabe')
    expect(loQueSeReceta([med('paracetamol')])).toHaveLength(1)
  })

  it('un valor que no es ninguno de los dos se trata como «no se sabe»', () => {
    expect(deDondeSale({ procedenciaClinica: 'quizá' } as never)).toBe('no_se_sabe')
  })

  it('una orden suspendida, terminada o cancelada no revive en la receta', () => {
    const terminales = [
      med('A', { estado: 'suspendida', procedenciaClinica: 'se_prescribe_hoy' }),
      med('B', { estado: 'terminada', procedenciaClinica: 'se_prescribe_hoy' }),
      med('C', { estado: 'cancelada', procedenciaClinica: 'se_prescribe_hoy' }),
    ]
    expect(loQueSeReceta(terminales)).toEqual([])
  })
})

describe('firewall IA → plan/receta', () => {
  it('una mención automática sin intención explícita queda visible como BORRADOR y no se imprime', () => {
    const out = fusionarMedicamentos({
      previos: [],
      nuevos: [med('metformina', { dosis: '850 mg' })],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ nombre: 'metformina', estado: 'borrador' })
    expect(out[0].procedenciaClinica).toBeUndefined()
    expect(loQueSeReceta(out)).toEqual([])
  })

  it('si la IA declara «ya lo toma», permanece en la nota pero nunca cruza a receta', () => {
    const out = fusionarMedicamentos({
      previos: [],
      nuevos: [med('losartán', { dosis: '50 mg', procedenciaClinica: 'ya_lo_toma' })],
    })
    expect(out[0].estado).toBeUndefined()
    expect(loQueYaTomaba(out).map(m => m.nombre)).toEqual(['losartán'])
    expect(loQueSeReceta(out)).toEqual([])
  })

  it('si la IA declara «se prescribe hoy», la orden sí puede cruzar al papel', () => {
    const out = fusionarMedicamentos({
      previos: [],
      nuevos: [med('amoxicilina', {
        dosis: '500 mg', frecuencia: 'cada 8 horas', duracion: '7 días',
        procedenciaClinica: 'se_prescribe_hoy',
      })],
    })
    expect(out[0].estado).toBeUndefined()
    expect(loQueSeReceta(out).map(m => m.nombre)).toEqual(['amoxicilina'])
  })

  it('un renglón manual previo sin etiqueta NO hereda el borrador automático al completarse', () => {
    const manual = med('amoxicilina', { dosis: '875 mg' })
    const out = fusionarMedicamentos({
      previos: [manual],
      nuevos: [med('amoxicilina', { frecuencia: 'cada 12 horas' })],
    })
    expect(out).toHaveLength(1)
    expect(out[0].dosis).toBe('875 mg')
    expect(out[0].frecuencia).toBe('cada 12 horas')
    expect(out[0].estado).toBeUndefined()
    expect(loQueSeReceta(out)).toHaveLength(1)
  })
})

describe('la lista deja de acumularse', () => {
  it('el pase nuevo SUSTITUYE lo que la IA puso en el anterior', () => {
    // Minuto 2: se recaban antecedentes.
    const pase1 = [med('losartán'), med('metformina')]
    // Minuto 20: el pase final ya oyó el plan y decide otra cosa.
    const pase2 = [med('amoxicilina', { dosis: '500 mg' })]
    const out = fusionarMedicamentos({ previos: pase1, nuevos: pase2, deLaIaAnterior: pase1 })
    expect(out.map(m => m.nombre)).toEqual(['amoxicilina'])
    expect(out[0].estado).toBe('borrador')
  })

  it('lo que escribió el MÉDICO no se toca jamás', () => {
    const aMano = med('ivermectina')
    const previos = [aMano, med('losartán')]
    const out = fusionarMedicamentos({
      previos, nuevos: [med('amoxicilina')], deLaIaAnterior: [med('losartán')],
    })
    expect(out.map(m => m.nombre)).toEqual(['ivermectina', 'amoxicilina'])
    expect(out[0].estado).toBeUndefined()
    expect(out[1].estado).toBe('borrador')
  })

  it('sin saber qué puso la IA antes, NO se quita nada de la nota', () => {
    const out = fusionarMedicamentos({
      previos: [med('losartán')], nuevos: [med('amoxicilina')],
    })
    expect(out.map(m => m.nombre)).toEqual(['losartán', 'amoxicilina'])
    expect(out[0].estado).toBeUndefined()
    expect(out[1].estado).toBe('borrador')
  })

  it('el mismo fármaco por los dos lados no se duplica', () => {
    const out = fusionarMedicamentos({
      previos: [med('Losartán')], nuevos: [med('losartan')],
    })
    expect(out).toHaveLength(1)
  })

  it('la dosis escrita a mano NO la pisa la IA', () => {
    /** Es la única de las dos que alguien decidió. */
    const out = fusionarMedicamentos({
      previos: [med('amoxicilina', { dosis: '875 mg' })],
      nuevos: [med('amoxicilina', { dosis: '500 mg' })],
    })
    expect(out[0].dosis).toBe('875 mg')
  })

  it('pero sí RELLENA lo que el médico dejó vacío', () => {
    const out = fusionarMedicamentos({
      previos: [med('amoxicilina', { dosis: '' })],
      nuevos: [med('amoxicilina', { dosis: '500 mg', frecuencia: 'cada 8 h' })],
    })
    expect(out[0].dosis).toBe('500 mg')
    expect(out[0].frecuencia).toBe('cada 8 h')
  })
})

describe('está conectado de verdad', () => {
  it('la pantalla de consulta usa la fusión, no la concatenación', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(),
      'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
    expect(src).toContain('fusionarMedicamentos({')
    expect(src).toContain('medDeLaIaRef.current = nuevosMed')
    // Todo lote automático atraviesa fusionarMedicamentos antes de tocar estado.
    expect(src).toContain('setMedicamentos(prev => fusionarMedicamentos({')
    // Y no queda ningún resto del `[...prev, ...nuevos]` que acumulaba.
    expect(src).not.toMatch(/\[\.\.\.prev, \.\.\.nuevosMed\.filter/)
  })

  it('la pantalla de receta filtra por procedencia/estado antes de imprimir', async () => {
    /**
     * ESTA AFIRMACIÓN SE ACTUALIZÓ EN H-01, Y HAY QUE DECIR POR QUÉ.
     *
     * Comprobaba `loQueSeReceta(...)` seguido de `.filter(m => estaVigente(m))`:
     * la composición correcta, escrita a mano DENTRO de esta pantalla. Eso es
     * justamente lo que dejó al portal del paciente sin la regla — una frontera
     * clínica que vive dentro de un componente sólo protege a ese componente.
     *
     * La composición se mudó a `medicamentosDeLaReceta`, que es ahora la única
     * puerta y la que aplica también el servidor. Lo que se congela aquí es que
     * la pantalla la CRUCE, no dónde está escrita.
     */
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(),
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8')
    expect(src).toContain('medicamentosDeLaReceta(n.medicamentos ?? [])')
    // Y no queda una segunda composición a mano que pueda divergir de la puerta.
    expect(src).not.toContain('loQueSeReceta(')
  })
})

/**
 * ── REG-515 · LA ATRIBUCIÓN MANDA SOBRE LA OPINIÓN DEL MODELO ───────────────
 *
 * QUÉ PASABA. El dueño volvió a reportar, con la app en la mano: «sigues
 * poniéndome en la receta medicamentos de sus antecedentes». Y esta vez el
 * módulo YA existía y YA estaba conectado a la página de receta — o sea que no
 * era «escrito y sin conectar»: la regla corría y aun así se colaban.
 *
 * CÓMO SE DESCUBRIÓ. Leyendo `loQueSeReceta` con la queja delante. Sólo
 * apartaba lo etiquetado `ya_lo_toma`. Un antecedente que el modelo etiquetara
 * `se_prescribe_hoy` pasaba entero, y no había NADA detrás que lo parara.
 *
 * CAUSA RAÍZ, en dos mitades:
 *   1. El único dato que separa un antecedente de un plan —QUIÉN LO DIJO— se
 *      borraba en la frontera: la lista plana de `extraction-schema.ts` no
 *      declaraba `speaker`, y `z.object` borra las claves que no declara. Es
 *      exactamente el mismo defecto que ya se arregló para `procedenciaClinica`
 *      en ese mismo objeto, un campo más allá.
 *   2. Con el dato borrado, la única palabra sobre si algo se receta era la
 *      etiqueta que el propio modelo se pone.
 *
 * LA REGLA QUE LO HACE SEGURO. Un antecedente lo dice el paciente; un plan lo
 * dice el médico. Lo que trae atribución y NO es del médico no baja al papel.
 *
 * LO QUE NO CUBRE, dicho:
 *   · Un renglón SIN `speaker` sigue imprimiéndose. No viene del dictado: lo
 *     escribió el médico a mano, o es de una nota anterior a este campo.
 *     Castigarlo sería quitarle del papel algo que él escribió.
 *   · Si la diarización atribuye mal la frase, esto hereda ese error. No es una
 *     defensa contra un audio mal separado.
 *   · No mira la SECCIÓN de la nota. Sigue sin existir un campo que diga «esto
 *     salió del plan»; lo que hay es quién habló, y con eso se decide.
 */
describe('REG-515 · lo que dijo el paciente no baja al papel', () => {
  const base = { nombre: 'metformina', dosis: '850 mg', via: 'oral' as const, frecuencia: 'cada 12 h', duracion: '30 días' }

  it('EL CASO: un antecedente MAL etiquetado por el modelo ya no se imprime', () => {
    // El paciente dijo «tomo metformina» y el modelo se equivocó al clasificarlo.
    // Antes de REG-515 esto bajaba a la receta con cédula profesional.
    const meds = [{ ...base, procedenciaClinica: 'se_prescribe_hoy' as const, speaker: 'paciente' as const }]
    expect(medicamentosDeLaReceta(meds)).toEqual([])
  })

  it('y lo que dijo el médico sí se imprime', () => {
    const meds = [{ ...base, nombre: 'amoxicilina', procedenciaClinica: 'se_prescribe_hoy' as const, speaker: 'medico' as const }]
    expect(medicamentosDeLaReceta(meds)).toHaveLength(1)
  })

  it('un renglón sin atribución sigue imprimiéndose: lo escribió el médico a mano', () => {
    // La ausencia NO se castiga. Quitarle del papel lo que él escribió es el
    // error caro en la otra dirección.
    const meds = [{ ...base, nombre: 'losartán', procedenciaClinica: 'se_prescribe_hoy' as const }]
    expect(medicamentosDeLaReceta(meds)).toHaveLength(1)
  })

  it('«acompanante» y «desconocido» tampoco pasan: la duda no es permiso', () => {
    for (const quien of ['acompanante', 'desconocido'] as const) {
      const meds = [{ ...base, procedenciaClinica: 'se_prescribe_hoy' as const, speaker: quien }]
      expect(medicamentosDeLaReceta(meds), `${quien} no debería imprimirse`).toEqual([])
    }
  })

  it('EL DATO LLEGA: el esquema plano declara `speaker`, o se borraría en la frontera', () => {
    /**
     * Prueba de FRONTERA, no de lógica. La regla de arriba es inútil si el campo
     * se pierde antes de llegar: `z.object` borra las claves que no declara, y
     * así se coló el defecto de `procedenciaClinica` la vez anterior.
     */
    const esquema = readFileSync(join(process.cwd(), 'src/lib/expediente/extraction-schema.ts'), 'utf8')
    const plana = esquema.slice(esquema.indexOf('  medicamentos: z.array('))
    const cierre = plana.indexOf('  alergias:')
    expect(plana.slice(0, cierre), 'la lista PLANA volvió a no declarar speaker')
      .toMatch(/speaker: Hablante\.optional\(\)/)
  })
})
