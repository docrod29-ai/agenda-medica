/**
 * QUÉ VA EN LA RECETA — REG-221.
 *
 * ── LA QUEJA, CON SUS PALABRAS ──────────────────────────────────────────────
 *
 *   «no me gusta que hagas la receta con lo que te digo de antecedentes,
 *    la receta es cuando ya te estén diciendo el plan»
 *
 * ── LAS DOS CAUSAS ──────────────────────────────────────────────────────────
 *
 * **1.** El eje `procedenciaClinica` existía en el tipo, en el esquema auditado,
 * en la regla 6-ter del prompt y en una prueba sellada. Pero la lista PLANA que
 * lee la pantalla no lo declaraba, y `z.object` borra las claves que no declara.
 * El campo nunca llegó a la receta.
 *
 * **2.** La lista de medicamentos se acumulaba: lo que entró en el minuto dos no
 * salía nunca, aunque el pase final decidiera otra cosa.
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

  it('sin el campo sigue siendo válido, y NO se inventa un valor', () => {
    const r = RespuestaExtraccion.parse({ medicamentos: [{ nombre: 'metformina' }] })
    expect(r.medicamentos[0].procedenciaClinica).toBeUndefined()
  })
})

describe('qué baja al papel', () => {
  const lista = [
    med('losartán', { procedenciaClinica: 'ya_lo_toma' }),
    med('metformina', { procedenciaClinica: 'ya_lo_toma' }),
    med('amoxicilina', { procedenciaClinica: 'se_prescribe_hoy' }),
    med('paracetamol'),   // sin etiquetar
  ]

  it('lo que ya tomaba NO se receta', () => {
    expect(loQueSeReceta(lista).map(m => m.nombre)).toEqual(['amoxicilina', 'paracetamol'])
  })

  it('lo que ya tomaba sí se puede listar aparte, para la nota', () => {
    expect(loQueYaTomaba(lista).map(m => m.nombre)).toEqual(['losartán', 'metformina'])
  })

  it('ANTE LA DUDA SE IMPRIME: sin etiqueta, se queda en la receta', () => {
    /**
     * Dejar de más un renglón que el médico borra de un toque es una molestia;
     * quitar de la receta un antibiótico que sí se prescribió es un paciente que
     * no se lo toma. Las dos equivocaciones no cuestan lo mismo.
     */
    expect(deDondeSale(med('paracetamol'))).toBe('no_se_sabe')
    expect(loQueSeReceta([med('paracetamol')])).toHaveLength(1)
  })

  it('un valor que no es ninguno de los dos se trata como «no se sabe»', () => {
    expect(deDondeSale({ procedenciaClinica: 'quizá' } as never)).toBe('no_se_sabe')
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
  })

  it('lo que escribió el MÉDICO no se toca jamás', () => {
    const aMano = med('ivermectina')
    const previos = [aMano, med('losartán')]
    const out = fusionarMedicamentos({
      previos, nuevos: [med('amoxicilina')], deLaIaAnterior: [med('losartán')],
    })
    expect(out.map(m => m.nombre)).toEqual(['ivermectina', 'amoxicilina'])
  })

  it('sin saber qué puso la IA antes, NO se quita nada', () => {
    // El error caro es borrarle un fármaco al médico, no dejarle uno de más.
    const out = fusionarMedicamentos({
      previos: [med('losartán')], nuevos: [med('amoxicilina')],
    })
    expect(out.map(m => m.nombre)).toEqual(['losartán', 'amoxicilina'])
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
    // Y no queda ningún resto del `[...prev, ...nuevos]` que acumulaba.
    expect(src).not.toMatch(/\[\.\.\.prev, \.\.\.nuevosMed\.filter/)
  })

  it('la pantalla de receta filtra por procedencia', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(),
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8')
    expect(src).toContain('loQueSeReceta(n.medicamentos ?? [])')
  })
})
