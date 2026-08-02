/**
 * GOLDEN — el cobro suelto que no era de nadie.
 *
 * Abierto desde Finanzas, el modal de cobro no pregunta por el médico y no hay
 * cita de la que sacarlo: el cobro se guardaba y caía en la fila «sin atribuir»
 * del reparto. Dinero real que al repartir no es de nadie.
 */
import { describe, it, expect } from 'vitest'
import { decidirMedicoDelCobroSuelto } from '@/lib/finanzas/cobro-suelto'

describe('decidirMedicoDelCobroSuelto', () => {
  it('con un solo médico no se pregunta: es suyo', () => {
    const d = decidirMedicoDelCobroSuelto([{ id: 'a', nombre: 'Dra. A', activo: true }])
    expect(d.hayQuePreguntar).toBe(false)
    expect(d.medicoId).toBe('a')
  })

  it('con varios SE PREGUNTA, y no se preselecciona a ninguno', () => {
    // Preseleccionar «el primero» es exactamente atribuir mal.
    const d = decidirMedicoDelCobroSuelto([
      { id: 'a', activo: true }, { id: 'b', activo: true },
    ])
    expect(d.hayQuePreguntar).toBe(true)
    expect(d.medicoId).toBeUndefined()
    expect(d.opciones.map(o => o.id)).toEqual(['a', 'b'])
  })

  it('si el cobro ya trae médico —viene de una cita— no se pregunta nada', () => {
    const d = decidirMedicoDelCobroSuelto([{ id: 'a' }, { id: 'b' }], 'b')
    expect(d.hayQuePreguntar).toBe(false)
    expect(d.medicoId).toBe('b')
  })

  it('los dados de baja no reciben cobros nuevos', () => {
    const d = decidirMedicoDelCobroSuelto([
      { id: 'a', activo: true }, { id: 'viejo', activo: false },
    ])
    expect(d.opciones.map(o => o.id)).toEqual(['a'])
    expect(d.medicoId).toBe('a')
  })

  it('si NADIE declara `activo`, entran todos', () => {
    // Filtrarlos dejaría la lista vacía y volveríamos al problema de origen.
    const d = decidirMedicoDelCobroSuelto([{ id: 'a' }, { id: 'b' }])
    expect(d.opciones).toHaveLength(2)
    expect(d.hayQuePreguntar).toBe(true)
  })

  it('sin médicos el cobro NO se bloquea: se guarda sin atribuir', () => {
    // Perder el cobro sería peor que no poder atribuirlo.
    const d = decidirMedicoDelCobroSuelto([])
    expect(d.hayQuePreguntar).toBe(false)
    expect(d.medicoId).toBeUndefined()
  })
})
