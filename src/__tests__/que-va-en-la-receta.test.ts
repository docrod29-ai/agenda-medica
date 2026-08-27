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
import { RespuestaExtraccion } from '@/lib/expediente/extraction-schema'
import {
  deDondeSale, loQueSeReceta, loQueYaTomaba, fusionarMedicamentos,
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
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(),
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8')
    expect(src).toContain('loQueSeReceta(n.medicamentos ?? [])')
  })
})
