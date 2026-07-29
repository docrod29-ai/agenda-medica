import { Appointment, ClinicConfig } from '@/types'
import type { TimeBlock } from '@/lib/time-blocks-core'
// Del NÚCLEO PURO, no de time-blocks: esta cadena la importa /api/portal (servidor)
// y time-blocks arrastra el SDK del navegador, que se inicializa al importarse.
import { estaBloqueado } from '@/lib/time-blocks-core'
import { hoyISO, ahoraMinutosDelDia } from '@/lib/timezone'
import { format } from 'date-fns'

const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

/** Tope absoluto de slots por día (cota de seguridad).
 *  24h × 60min / 15min step = 96 — pero esto es disparate clínico.
 *  Cap conservador en 24: equivale a 12 horas con citas de 30 min.
 *  Si alguien legítimamente necesita más, debe configurarlo conscientemente. */
const MAX_SLOTS_POR_DIA = 24

/** Duración mínima razonable de una cita (anti config=0 que rompía el loop). */
const DURACION_MIN_SEGURA = 5

/** Hora máxima razonable para "fin" (00:00-23:59). 24:00 está mal formado. */
const HORA_MAX_MIN = 23 * 60 + 59  // 1439

/** Resultado de validar un horario diario — semánticamente claro para callers. */
export interface ValidacionHorario {
  valido: boolean
  motivo?: string
  startMin: number
  endMin: number
}

/**
 * Valida un horario { inicio: "HH:MM", fin: "HH:MM" }.
 * Reglas:
 *   - inicio y fin deben tener formato HH:MM válido
 *   - fin > inicio estrictamente (no se permite jornada 0)
 *   - duración total ≤ 14 horas (anti config 8:00-24:00 por accidente)
 *   - endMin se clampea a 23:59 si excede (24:00 → 23:59)
 *
 * Diseño: tolerante en lectura (clamp), estricto en validación (rechaza
 * el día con motivo claro). Esto cubre AMBOS escenarios:
 *  a) Datos ya corruptos en BD: el slot calc usa los valores clampados
 *     y nunca genera > MAX_SLOTS_POR_DIA → no aparecen 32 lugares.
 *  b) Datos nuevos al guardar: el caller debe rechazar el save.
 */
export function validarHorarioDia(inicio: string, fin: string): ValidacionHorario {
  const reHora = /^\d{1,2}:\d{2}$/
  if (!reHora.test(inicio) || !reHora.test(fin)) {
    return { valido: false, motivo: 'Formato de hora inválido', startMin: 0, endMin: 0 }
  }
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fin.split(':').map(Number)
  if ([hI, mI, hF, mF].some(n => Number.isNaN(n))) {
    return { valido: false, motivo: 'Hora no numérica', startMin: 0, endMin: 0 }
  }
  let startMin = hI * 60 + mI
  let endMin = hF * 60 + mF
  // Clamp: 24:00 → 23:59 (24:00 NO es válido en HH:MM)
  if (endMin > HORA_MAX_MIN) endMin = HORA_MAX_MIN
  if (startMin < 0) startMin = 0
  if (endMin <= startMin) {
    return { valido: false, motivo: 'La hora de fin debe ser mayor que la de inicio', startMin, endMin }
  }
  const horasTotal = (endMin - startMin) / 60
  if (horasTotal > 14) {
    return { valido: false, motivo: `Jornada de ${horasTotal.toFixed(1)}h parece un error (máximo razonable 14h)`, startMin, endMin }
  }
  return { valido: true, startMin, endMin }
}

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

  // ── HARD GUARDRAIL 1: duración debe ser razonable ───────────────
  // Si la duración es 0/NaN/negativa el for() loop nunca avanza o
  // genera infinitos. Default seguro: 30 min (mediana clínica).
  const duracionSegura = (Number.isFinite(duracionMin) && duracionMin >= DURACION_MIN_SEGURA)
    ? duracionMin
    : 30

  // El step debe ser AL MENOS la duración de la cita, nunca menor.
  // (fix histórico: intervalo=10 con citas 30min → slots fantasma cada 10min)
  const intervalConf = Number(config.intervaloMinutos ?? 10)
  const interval = Math.max(intervalConf, duracionSegura)

  // ── HARD GUARDRAIL 2: validar el horario ────────────────────────
  // Si el horario está corrupto (fin ≤ inicio, jornada > 14h), NO
  // generamos slots. Mejor que mostrar 32 lugares fantasma.
  const validacion = validarHorarioDia(schedule.inicio, schedule.fin)
  if (!validacion.valido) {
    // Diagnóstico en consola sin exponer detalle de paciente
    if (typeof console !== 'undefined') {
      console.warn(`[availability] Horario inválido para ${fecha}: ${validacion.motivo}`)
    }
    return []
  }
  const { startMin, endMin } = validacion

  // Si la fecha es HOY, no ofrecer horas que ya pasaron (en la zona de la clínica).
  const tz = config.zonaHoraria || 'America/Mexico_City'
  const minMinutoHoy = fecha === hoyISO(tz) ? ahoraMinutosDelDia(tz) : -1

  const dayAppts = appointments.filter(a =>
    a.fechaHora.slice(0, 10) === fecha &&
    a.id !== excludeId &&
    !['cancelada', 'reagendada', 'no-asistio'].includes(a.estado) &&
    // MULTI-MÉDICO: si se pide la agenda de un médico, solo cuentan SUS citas.
    // Sin esto, el slot de la Dra. A se marcaba ocupado por una cita del Dr. B
    // (agendas cruzadas). Si la cita no tiene medicoId (legacy), cuenta siempre.
    (!medicoId || !a.medicoId || a.medicoId === medicoId)
  )

  const slots: string[] = []
  for (let m = startMin; m + duracionSegura <= endMin; m += interval) {
    // ── HARD GUARDRAIL 3: tope absoluto de slots por día ──────────
    // Si llegamos a 24 slots y aún queda horario, ALGO está mal.
    // Cortamos y registramos. Nunca devolvemos 32 lugares.
    if (slots.length >= MAX_SLOTS_POR_DIA) {
      console.warn(`[availability] Tope de ${MAX_SLOTS_POR_DIA} slots alcanzado para ${fecha} — configuración sospechosa`)
      break
    }
    // 0. ¿Ya pasó esta hora hoy? No ofrecer horas del pasado.
    if (m < minMinutoHoy) continue

    const slotEnd = m + duracionSegura
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    const slot = `${hh}:${mm}`

    // 1. ¿Cae en un bloque de tiempo (vacaciones, ausencia, etc.)?
    if (bloques.length > 0) {
      const bloqueado = estaBloqueado(`${fecha} ${slot}`, bloques, medicoId, tz)
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
  excludeId?: string,
  bloques: TimeBlock[] = [],
  medicoId?: string,
  /** Config del consultorio. Sin ella NO se puede validar día ni horario. */
  config?: ClinicConfig,
): boolean {
  const [h, m] = hora.split(':').map(Number)
  const startMin = h * 60 + m
  const endMin = startMin + duracionMin

  /**
   * DÍA Y HORARIO, no solo solapes.
   *
   * Esto solo miraba si la cita chocaba con otra. Nadie validaba que el día
   * estuviera activo, que no fuera festivo, ni que la cita cupiera dentro del
   * horario — ni aquí, ni en POST /api/appointments. El único que sí lo hacía era
   * el booking público.
   *
   * Por ahí se colaban dos cosas del uso diario: agendar en domingo o en festivo
   * (cuando no hay huecos, el desplegable de horas se sustituye por un campo
   * libre, sin ninguna advertencia), y subir la duración después de elegir la
   * hora, que dejaba la cita terminando después del cierre.
   */
  if (config) {
    const schedule = getDaySchedule(fecha, config)
    if (!schedule) return true                      // día inactivo o festivo
    const vh = validarHorarioDia(schedule.inicio, schedule.fin)
    if (!vh.valido || startMin < vh.startMin || endMin > vh.endMin) return true
  }

  // Bloqueo (vacaciones/ausencia) del médico o de toda la clínica — en la zona de la clínica.
  if (bloques.length > 0 && estaBloqueado(`${fecha} ${hora}`, bloques, medicoId, config?.zonaHoraria || 'America/Mexico_City')) return true

  return appointments.some(a => {
    if (a.id === excludeId) return false
    if (a.fechaHora.slice(0, 10) !== fecha) return false
    if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return false
    // MULTI-MÉDICO: solo choca con citas del MISMO médico (o legacy sin medicoId).
    // Antes chocaba con las de TODOS → bloqueaba huecos válidos de otro doctor.
    if (medicoId && a.medicoId && a.medicoId !== medicoId) return false
    const [ah, am] = a.fechaHora.slice(11, 16).split(':').map(Number)
    const aStart = ah * 60 + am
    const aEnd = aStart + a.duracion
    return startMin < aEnd && endMin > aStart
  })
}

/**
 * Los 7 días de la semana de `date`, ANCLADOS A MEDIODÍA.
 *
 * Se construían a medianoche local del navegador y luego se formateaban con la
 * zona del consultorio (America/Mexico_City). En un navegador al ESTE de CDMX esa
 * medianoche cae en el día anterior visto desde México: en Cancún (UTC-5, todo el
 * año, y mercado real de turismo médico) `new Date(2026,6,15)` formateado en CDMX
 * da 2026-07-14. Toda la cuadrícula del calendario se corría un día, y el médico
 * veía la agenda de la fecha equivocada.
 *
 * A mediodía sobran 12 horas de margen: ninguna diferencia horaria realista
 * cambia el día.
 */
export function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 12)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12),
  )
}

export function formatDateMX(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T12:00:00' : '')) : date
  return d.toLocaleDateString('es-MX', opts ?? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
