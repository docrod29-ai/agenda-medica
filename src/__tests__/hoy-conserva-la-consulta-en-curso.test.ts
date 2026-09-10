/**
 * REG-669. Revisando el rediseño de Hoy se encontró que el filtro por hora
 * saltaba una consulta en curso y que el héroe ofrecía consulta a recepción
 * o una URL sin paciente. Se ejecutó primero la selección original: fallaron
 * los casos de consulta iniciada, sala, estados cerrados y destino por rol.
 * La prioridad usa estados guardados, no deduce atención por la hora.
 * Sólo mide selección y destino: no certifica permisos, Firestore ni iOS.
 */
import { describe, expect, it } from 'vitest'
import type { AppointmentStatus } from '@/types'
import { accionDeCitaEnFoco, citaEnFoco } from '@/lib/hoy/cita-en-foco'

const dia = '2026-09-10'
const cita = (id: string, hora: string, estado: AppointmentStatus = 'confirmada', pacienteId = `p-${id}`) =>
  ({ id, fechaHora: `${dia} ${hora}`, estado, pacienteId })

describe('Hoy conserva la cita que sigue necesitando atención', () => {
  it('mantiene la consulta iniciada aunque haya pasado su hora y exista otra futura', () => {
    const iniciada = cita('en-curso', '09:00', 'en-consulta')
    expect(citaEnFoco([iniciada, cita('despues', '11:00')], dia, 10 * 60)).toBe(iniciada)
  })
  it('muestra a quien está en sala antes que a quien todavía no llega', () => {
    const sala = cita('sala', '09:30', 'en-sala')
    expect(citaEnFoco([cita('despues', '11:00'), sala], dia, 10 * 60)).toBe(sala)
  })
  it('una consulta en curso pesa más que la sala sin cambiar el orden de la agenda', () => {
    const iniciada = cita('en-curso', '10:00', 'en-consulta')
    const citas = [cita('sala', '09:30', 'en-sala'), iniciada]
    expect(citaEnFoco(citas, dia, 10 * 60)).toBe(iniciada)
    expect(citas.map(c => c.id)).toEqual(['sala', 'en-curso'])
  })
  it('no propone otra consulta para citas cerradas aunque su hora aún sea futura', () => {
    const cerrados: AppointmentStatus[] = ['atendida', 'finalizada', 'pagada', 'pendiente-pago', 'cancelada', 'reagendada', 'no-asistio']
    expect(citaEnFoco(cerrados.map((estado, i) => cita(String(i), '11:00', estado)), dia, 10 * 60)).toBeNull()
  })
  it('elige la próxima por hora aunque los datos lleguen fuera de orden', () => {
    const siguiente = cita('siguiente', '10:30')
    expect(citaEnFoco([cita('tarde', '12:00'), siguiente], dia, 10 * 60)).toBe(siguiente)
  })
  it('espera el reloj del consultorio y no arrastra citas de otro día', () => {
    expect(citaEnFoco([cita('uno', '11:00')], dia, null)).toBeNull()
    expect(citaEnFoco([{ ...cita('ayer', '11:00', 'en-consulta'), fechaHora: '2026-09-09 11:00' }], dia, 10 * 60)).toBeNull()
  })
  it('recepción abre la cita y nunca un editor clínico', () => {
    expect(accionDeCitaEnFoco(cita('uno', '11:00'), false)).toEqual({ href: '/citas?id=uno', texto: 'Ver cita', consulta: false })
  })
  it('sin identidad enlazada el médico abre la cita para completarla', () => {
    expect(accionDeCitaEnFoco(cita('sin-paciente', '11:00', 'confirmada', ''), true)).toEqual({ href: '/citas?id=sin-paciente', texto: 'Ver cita', consulta: false })
  })
  it('una consulta iniciada se retoma y una nueva se inicia', () => {
    expect(accionDeCitaEnFoco(cita('uno', '09:00', 'en-consulta'), true)).toEqual({ href: '/consulta/p-uno', texto: 'Retomar consulta', consulta: true })
    expect(accionDeCitaEnFoco(cita('dos', '11:00'), true)).toEqual({ href: '/consulta/p-dos', texto: 'Iniciar consulta', consulta: true })
  })
})
