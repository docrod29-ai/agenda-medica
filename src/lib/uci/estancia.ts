/**
 * ESTANCIA EN UCI — el «Día UCI», decidido por el Dr. (2026-07-30).
 *
 * ── LA DECISIÓN: NO ELEGIR UNA DE LAS DOS ────────────────────────────────────
 *
 * Ni sólo bloques de 24 h ni sólo día de calendario. **Se guardan los tres
 * datos**, porque cada uno responde una pregunta distinta y elegir uno destruye
 * la información del otro:
 *
 *  · `elapsedMinutes`        — duración exacta. Para todo lo clínico.
 *  · `calendarDayNumber`     — día de atención crítica en la zona de la unidad.
 *                              Es lo que dice el intensivista y lo que usan los
 *                              reportes administrativos.
 *  · `completed24hPeriods`   — periodos de 24 h cumplidos. Para analítica.
 *
 * El ejemplo que fijó la decisión: ingreso **lunes 23:50**, se mira el **martes
 * a las 08:00**.
 *
 *     calendarDayNumber   = 2      ← ya es el día siguiente en la unidad
 *     elapsedMinutes      = 490    ← 8 h 10 min
 *     completed24hPeriods = 0      ← no ha cumplido ni un periodo
 *
 * Decir «Día 1» ahí sería falso para el turno; decir «Día 2» sin la duración
 * sugeriría un día entero de estancia. Por eso el encabezado dice las dos cosas:
 * **«Día UCI 2 · 8 h de estancia»**.
 *
 * ── LA ZONA HORARIA NUNCA ES LA DEL NAVEGADOR ────────────────────────────────
 *
 * `calendarDayNumber` se calcula con la zona **configurada de la unidad**
 * (`config.zonaHoraria`), no con la del equipo desde el que se abre la pantalla.
 * El mismo paciente tiene que estar en el mismo día de UCI para el intensivista
 * que pasa visita y para el residente que lo consulta desde otro huso. Por eso
 * `unitTimezone` es **obligatorio**: no hay default silencioso.
 *
 * ── PARA CÁLCULOS CLÍNICOS, TIMESTAMPS ───────────────────────────────────────
 *
 * `calendarDayNumber` es para mostrar y reportar. Un balance de «últimas 24 h»,
 * una tendencia o una exposición se calculan con instantes reales y ventanas
 * exactas — ver `PARA_CALCULOS_USAR_TIMESTAMPS`.
 *
 * Módulo PURO: el instante entra como parámetro.
 */

export interface EstanciaUci {
  /** Ingreso a UCI, ISO con desfase o Z. */
  admittedAt: string
  /** Zona horaria de la unidad (`config.zonaHoraria`). Obligatoria. */
  unitTimezone: string
}

export interface MedidaEstancia {
  admittedAt: string
  unitTimezone: string
  /** Duración exacta. Es lo que se usa para cualquier cálculo. */
  elapsedMinutes: number
  /** Día de atención crítica en la zona de la unidad. Ingreso = día 1. */
  calendarDayNumber: number
  /** Periodos de 24 h CUMPLIDOS. Ingreso hace 8 h ⇒ 0. */
  completed24hPeriods: number
  /** «Día UCI 2 · 8 h de estancia». */
  etiqueta: string
}

export const PARA_CALCULOS_USAR_TIMESTAMPS =
  'calendarDayNumber es para mostrar y para reportes administrativos. Un balance ' +
  'de últimas 24 h, una tendencia o una exposición se calculan con instantes ' +
  'reales y ventanas exactas, NUNCA con el número de día.'

/** Fecha civil (YYYY-MM-DD) de un instante en una zona horaria dada. */
export function fechaCivil(iso: string, tz: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`fechaCivil: fecha inválida «${iso}»`)
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ms))
  } catch {
    throw new Error(
      `fechaCivil: zona horaria inválida «${tz}». La zona de la unidad es obligatoria ` +
      'y no se sustituye por la del navegador.')
  }
}

/**
 * Días de calendario entre dos instantes, en la zona de la unidad.
 *
 * Se compara **fecha civil contra fecha civil**, no milisegundos: es lo que hace
 * que el ingreso del lunes 23:50 y el martes 08:00 disten un día aunque medien
 * 8 h. Las dos fechas civiles se restan como fechas puras (mediodía UTC evita
 * cualquier efecto de horario de verano en la resta).
 */
export function diasDeCalendario(desdeIso: string, hastaIso: string, tz: string): number {
  const a = fechaCivil(desdeIso, tz)
  const b = fechaCivil(hastaIso, tz)
  const ms = (f: string) => Date.parse(`${f}T12:00:00Z`)
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

/** Duración legible a partir de los minutos exactos. */
export function duracionLegible(minutos: number): string {
  if (minutos < 60) return `${Math.floor(minutos)} min`
  const horas = minutos / 60
  if (horas < 48) return `${Math.floor(horas)} h`
  return `${Math.floor(horas / 24)} d`
}

/**
 * Mide la estancia. Devuelve los tres datos, sin elegir por el llamador.
 *
 * @param ahoraIso instante de referencia. Entra como parámetro para que el
 *   módulo sea puro y la pantalla reproducible en un test.
 */
export function medirEstancia(e: EstanciaUci, ahoraIso: string): MedidaEstancia {
  const ingreso = Date.parse(e.admittedAt)
  const ahora = Date.parse(ahoraIso)
  if (Number.isNaN(ingreso)) throw new Error(`medirEstancia: ingreso inválido «${e.admittedAt}»`)
  if (Number.isNaN(ahora)) throw new Error(`medirEstancia: instante inválido «${ahoraIso}»`)
  if (e.unitTimezone.trim() === '') {
    throw new Error(
      'medirEstancia: la zona horaria de la unidad es obligatoria. NUNCA se usa la ' +
      'del navegador: el mismo paciente debe estar en el mismo día de UCI para ' +
      'quien pasa visita y para quien lo consulta desde otro huso.')
  }

  // Un ingreso posterior al momento actual no produce día 0 ni duración
  // negativa: se acota y el llamador lo ve en la etiqueta.
  const ms = Math.max(0, ahora - ingreso)
  const elapsedMinutes = ms / 60_000
  const completed24hPeriods = Math.floor(ms / 86_400_000)
  const calendarDayNumber = ahora >= ingreso
    ? diasDeCalendario(e.admittedAt, ahoraIso, e.unitTimezone) + 1
    : 1

  return {
    admittedAt: e.admittedAt,
    unitTimezone: e.unitTimezone,
    elapsedMinutes,
    calendarDayNumber,
    completed24hPeriods,
    etiqueta: `Día UCI ${calendarDayNumber} · ${duracionLegible(elapsedMinutes)} de estancia`,
  }
}
