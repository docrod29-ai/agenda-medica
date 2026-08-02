/**
 * GOLDEN — «cambié mi horario y la agenda siguió igual».
 *
 * Al dar de alta a un médico se guardaba una COPIA del horario del consultorio.
 * El editor por médico nunca se construyó, así que esa copia no se volvía a
 * escribir nunca — y aun así los cuatro caminos que agendan la preferían. Cada
 * cambio de horario desde el alta decía «guardado» y no llegaba a la agenda.
 *
 * Lo que se protege aquí: manda el horario que alguien PUEDE mantener.
 */
import { describe, it, expect } from 'vitest'
import { configParaMedico } from '@/lib/horario-medico'
import type { ClinicConfig } from '@/types'

const dia = (inicio: string, fin: string) => ({ activo: true, inicio, fin })
const horarioDe = (inicio: string, fin: string): ClinicConfig['horario'] => ({
  lunes: dia(inicio, fin), martes: dia(inicio, fin), miercoles: dia(inicio, fin),
  jueves: dia(inicio, fin), viernes: dia(inicio, fin), sabado: dia(inicio, fin),
  domingo: dia(inicio, fin),
})

const clinica = { horario: horarioDe('09:00', '20:00'), intervaloMinutos: 30, zonaHoraria: 'America/Mexico_City' } as ClinicConfig

describe('configParaMedico', () => {
  it('sin médico manda el consultorio', () => {
    expect(configParaMedico(clinica)).toBe(clinica)
    expect(configParaMedico(clinica, null)).toBe(clinica)
  })

  it('IGNORA la copia congelada del médico', () => {
    // El caso real: el médico se dio de alta cuando la clínica cerraba a las 14,
    // hoy cierra a las 20, y su documento sigue diciendo 14.
    const fosil = { horario: horarioDe('09:00', '14:00'), intervaloMinutos: 10 }
    expect(configParaMedico(clinica, fosil).horario.lunes.fin).toBe('20:00')
    expect(configParaMedico(clinica, fosil).intervaloMinutos).toBe(30)
  })

  it('un descanso nuevo del consultorio SÍ llega al médico', () => {
    // Esto es lo que el fósil se llevaba por delante: cualquier regla nueva.
    const conComida = { ...clinica, horario: { ...clinica.horario, lunes: { ...clinica.horario.lunes, descansos: [{ inicio: '14:00', fin: '16:00' }] } } }
    const r = configParaMedico(conComida, { horario: horarioDe('09:00', '14:00') })
    expect(r.horario.lunes.descansos).toEqual([{ inicio: '14:00', fin: '16:00' }])
  })

  it('con horario propio declarado, el médico manda', () => {
    // El interruptor existe para el día que haya editor por médico: encenderlo
    // basta, sin volver a tocar los cuatro llamadores.
    const propio = { horarioPropio: true, horario: horarioDe('08:00', '12:00'), intervaloMinutos: 15 }
    const r = configParaMedico(clinica, propio)
    expect(r.horario.lunes.fin).toBe('12:00')
    expect(r.intervaloMinutos).toBe(15)
    expect(r.zonaHoraria).toBe('America/Mexico_City')   // lo que no trae, lo hereda
  })
})
