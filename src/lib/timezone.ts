/**
 * Utilidades de fecha/hora ancladas a zona horaria — fix del bug "hoy salta
 * a mañana".
 *
 * PROBLEMA: `new Date().toISOString().slice(0,10)` devuelve la fecha en UTC.
 * En México (UTC-6), después de las ~18:00 hora local el UTC ya es el día
 * siguiente → la agenda mostraba "mañana" como "hoy", los recordatorios se
 * desfasaban 6h y la validación de "no agendar en el pasado" fallaba.
 *
 * SOLUCIÓN: Intl.DateTimeFormat con timeZone explícito da la fecha/hora
 * correcta en la zona del consultorio sin importar dónde corra el servidor
 * (Vercel corre en UTC).
 *
 * Default: America/Mexico_City (México abolió el horario de verano en 2022,
 * así que es UTC-6 estable en casi todo el país). Acepta override por si una
 * clínica está en otra zona (config.zonaHoraria).
 */

export const TZ_DEFAULT = 'America/Mexico_City'

/** Fecha de HOY en la zona dada, formato YYYY-MM-DD. */
export function hoyISO(tz: string = TZ_DEFAULT): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/**
 * Fecha de un Date ARBITRARIO en la zona dada, formato YYYY-MM-DD.
 * Usar en lugar de `date.toISOString().slice(0,10)`, que da el día en UTC y
 * corre las fechas un día por las tardes en México (UTC-6).
 */
export function fechaISOLocal(date: Date, tz: string = TZ_DEFAULT): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

/** Hora actual en la zona dada como minutos desde medianoche (0-1439). */
export function ahoraMinutosDelDia(tz: string = TZ_DEFAULT): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const h = Number(partes.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(partes.find(p => p.type === 'minute')?.value ?? 0)
  // Intl puede devolver "24" a medianoche en algunos motores; normalizar.
  return ((h % 24) * 60) + m
}

/**
 * Suma (o resta) días a una fecha YYYY-MM-DD de forma segura.
 * Ancla a mediodía para que ningún cambio de zona/DST cruce el día.
 */
export function sumarDiasISO(fechaISO: string, n: number): string {
  const d = new Date(fechaISO + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/**
 * Offset (en minutos, + = adelante de UTC) de una IANA time zone en un instante.
 * Reconstruye la hora de pared que la zona muestra para ese `date` y la compara
 * contra el mismo `date` en UTC. Maneja DST (la franja fronteriza MX sí lo tiene:
 * Tijuana sigue el horario del Pacífico de EE.UU.).
 */
function offsetZonaMin(tz: string, date: Date): number {
  const p: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date)) p[part.type] = part.value
  const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second)
  return Math.round((comoUTC - date.getTime()) / 60000)
}

/**
 * Convierte una hora de PARED (YYYY-MM-DD + HH:MM) en la zona de la clínica al
 * instante UTC real. L5 auditoría maestra 2026-07: antes el offset -06:00 estaba
 * QUEMADO, así que Tijuana (UTC-8, con DST) y Hermosillo (UTC-7) quedaban corridas
 * 1–2 h en recordatorios, corte de caja y bloqueos de agenda. Ahora se calcula el
 * offset real de `tz` en esa fecha vía Intl (maneja DST). Default: Mexico City
 * (UTC-6 estable). El parámetro `tz` sale de config.zonaHoraria.
 *
 * Antes el cron hacía new Date(`${fecha}T${hora}:00`) que se interpretaba en la
 * zona del SERVIDOR (UTC en Vercel) → las ventanas de recordatorio disparaban 6h corridas.
 */
export function instanteMX(fechaISO: string, horaHHMM: string, tz: string = TZ_DEFAULT): Date {
  const [Y, M, D] = fechaISO.split('-').map(Number)
  const [h, m] = horaHHMM.split(':').map(Number)
  const comoSiUTC = Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0)
  // El offset se calcula sobre el instante aproximado (exacto salvo en la hora del
  // salto de DST, caso rarísimo para una cita) y se resta para obtener el UTC real.
  const off = offsetZonaMin(tz, new Date(comoSiUTC))
  return new Date(comoSiUTC - off * 60000)
}

/**
 * Compara dos instantes contra "ahora" en la zona dada para saber si una
 * fecha+hora local ya pasó. fechaISO = YYYY-MM-DD, horaHHMM = "HH:MM".
 */
export function yaPaso(fechaISO: string, horaHHMM: string, tz: string = TZ_DEFAULT): boolean {
  const hoy = hoyISO(tz)
  if (fechaISO < hoy) return true
  if (fechaISO > hoy) return false
  // mismo día: comparar minutos
  const [h, m] = horaHHMM.split(':').map(Number)
  const minSlot = (h || 0) * 60 + (m || 0)
  return minSlot < ahoraMinutosDelDia(tz)
}
