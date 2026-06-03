import { Appointment, ClinicConfig } from '@/types'
import type { TimeBlock } from '@/lib/time-blocks'
import { estaBloqueado } from '@/lib/time-blocks'
import { format } from 'date-fns'

const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

export function getDaySchedule(fecha: string, config: ClinicConfig) {
  const d = new Date(fecha + 'T12:00:00')
  const dayKey = DAY_KEYS[d.getDay()]
  const schedule = config.horario[dayKey as keyof typeof config.horario]
  if (!schedule?.activo) return null
  if (config.diasFestivos?.includes(fecha)) return null
  return schedule
}

export function getAvailableSlots(
  fecha: string,
  duracionMin: number,
  appointments: Appointment[],
  config: ClinicConfig,
  excludeId?: string,
  bloques: TimeBlock[] = [],
  medicoId?: string,
): string[] {
  const schedule = getDaySchedule(fecha, config)
  if (!schedule) return []

  // BUG FIX: el step debe ser AL MENOS la duración de la cita, nunca menor.
  // Si el médico configuró intervalo de 10 min y la cita dura 30 min, antes
  // generábamos slots cada 10 min (15:00, 15:10, 15:20, 15:30…) lo que daba
  // 28-30 slots de los cuales solo 10 caben sin solapar. Ahora step = duración
  // por default, así "cada 30 min" da 10 slots reales no 28 fantasmas.
  // El intervaloMinutos solo se usa como mínimo cuando es MAYOR (espaciar más).
  const intervalConf = Number(config.intervaloMinutos ?? 10)
  const interval = Math.max(intervalConf, duracionMin)
  const [hIni, mIni] = schedule.inicio.split(':').map(Number)
  const [hFin, mFin] = schedule.fin.split(':').map(Number)
  const startMin = hIni * 60 + mIni
  const endMin = hFin * 60 + mFin

  const dayAppts = appointments.filter(a =>
    a.fechaHora.slice(0, 10) === fecha &&
    a.id !== excludeId &&
    !['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)
  )

  const slots: string[] = []
  for (let m = startMin; m + duracionMin <= endMin; m += interval) {
    const slotEnd = m + duracionMin
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    const slot = `${hh}:${mm}`

    // 1. ¿Cae en un bloque de tiempo (vacaciones, ausencia, etc.)?
    if (bloques.length > 0) {
      const bloqueado = estaBloqueado(`${fecha} ${slot}`, bloques, medicoId)
      if (bloqueado) continue
    }

    // 2. ¿Se solapa con una cita existente?
    const hasConflict = dayAppts.some(a => {
      const [ch, cm] = a.fechaHora.slice(11, 16).split(':').map(Number)
      const aStart = ch * 60 + cm
      const aEnd = aStart + a.duracion
      return m < aEnd && slotEnd > aStart
    })
    if (!hasConflict) slots.push(slot)
  }
  return slots
}

export function hasConflict(
  fecha: string,
  hora: string,
  duracionMin: number,
  appointments: Appointment[],
  excludeId?: string
): boolean {
  const [h, m] = hora.split(':').map(Number)
  const startMin = h * 60 + m
  const endMin = startMin + duracionMin

  return appointments.some(a => {
    if (a.id === excludeId) return false
    if (a.fechaHora.slice(0, 10) !== fecha) return false
    if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return false
    const [ah, am] = a.fechaHora.slice(11, 16).split(':').map(Number)
    const aStart = ah * 60 + am
    const aEnd = aStart + a.duracion
    return startMin < aEnd && endMin > aStart
  })
}

export function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function formatDateMX(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T12:00:00' : '')) : date
  return d.toLocaleDateString('es-MX', opts ?? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
