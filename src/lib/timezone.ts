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
 * Convierte una hora de pared MX (YYYY-MM-DD + HH:MM) al instante UTC real.
 * México es UTC-6 estable (sin horario de verano desde 2022), así que
 * anclamos el offset -06:00. Devuelve un Date con el instante correcto,
 * para comparar contra Date.now() sin desfase.
 *
 * Antes el cron hacía new Date(`${fecha}T${hora}:00`) que se interpreta en
 * la zona del SERVIDOR (UTC en Vercel) → las ventanas de recordatorio
 * (23-26h y 1-4h antes) disparaban 6h corridas.
 */
export function instanteMX(fechaISO: string, horaHHMM: string): Date {
  return new Date(`${fechaISO}T${horaHHMM}:00-06:00`)
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
