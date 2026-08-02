/**
 * GOLDEN — el bot decía que el consultorio abre a la hora de la comida.
 *
 * La respuesta de «¿cuál es el horario?» imprimía `inicio–fin` a secas,
 * ignorando los descansos del horario partido. Un consultorio que atiende de 9 a
 * 14 y de 16 a 20 —lo normal en México— le decía al paciente
 * «Lunes: 09:00–20:00»: o se presenta a una puerta cerrada, o intenta agendar a
 * las 15:00 y la agenda no se lo ofrece, porque el motor de huecos SÍ respeta el
 * descanso desde v829/v830.
 *
 * El sistema sabía la verdad y su propio bot decía otra cosa.
 */
import { describe, it, expect } from 'vitest'
import { horarioLegible, tramosDelDia } from '@/lib/whatsapp/horario-legible'

const partido = { activo: true, inicio: '09:00', fin: '20:00', descansos: [{ inicio: '14:00', fin: '16:00' }] }
const corrido = { activo: true, inicio: '09:00', fin: '14:00' }

describe('tramosDelDia', () => {
  it('EL CASO QUE ROMPÍA: el horario partido se parte', () => {
    expect(tramosDelDia(partido)).toEqual(['09:00–14:00', '16:00–20:00'])
  })

  it('un día corrido sigue siendo un solo tramo', () => {
    expect(tramosDelDia(corrido)).toEqual(['09:00–14:00'])
  })

  it('un día inactivo no aparece', () => {
    expect(tramosDelDia({ ...corrido, activo: false })).toEqual([])
  })

  it('dos descansos en el mismo día', () => {
    expect(tramosDelDia({
      activo: true, inicio: '08:00', fin: '20:00',
      descansos: [{ inicio: '11:00', fin: '11:30' }, { inicio: '14:00', fin: '16:00' }],
    })).toEqual(['08:00–11:00', '11:30–14:00', '16:00–20:00'])
  })

  it('un descanso mal escrito se IGNORA en vez de romper el día', () => {
    // Preferible enseñar el día completo que no enseñar nada: mismo criterio
    // que el motor de huecos.
    for (const malo of [{ inicio: '', fin: '16:00' }, { inicio: '16:00', fin: '14:00' }, { inicio: '25:00', fin: '26:00' }]) {
      expect(tramosDelDia({ activo: true, inicio: '09:00', fin: '20:00', descansos: [malo] }))
        .toEqual(['09:00–20:00'])
    }
  })

  it('un descanso que cubre el día entero no deja tramos', () => {
    expect(tramosDelDia({ activo: true, inicio: '09:00', fin: '20:00', descansos: [{ inicio: '09:00', fin: '20:00' }] }))
      .toEqual([])
  })
})

describe('horarioLegible', () => {
  it('sale en orden de semana, no en el del objeto', () => {
    const texto = horarioLegible({
      viernes: corrido, lunes: partido, domingo: { ...corrido, activo: false },
    })
    expect(texto).toBe('• Lunes: 09:00–14:00 y 16:00–20:00\n• Viernes: 09:00–14:00')
  })

  it('sin ningún día activo devuelve vacío: no se manda un encabezado sin nada', () => {
    expect(horarioLegible({ lunes: { ...corrido, activo: false } })).toBe('')
    expect(horarioLegible(undefined)).toBe('')
  })
})
