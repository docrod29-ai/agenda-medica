/**
 * LO QUE EL MÉDICO YA TIENE EN SU GOOGLE CALENDAR.
 *
 * ── EL AGUJERO ───────────────────────────────────────────────────────────────
 *
 * La integración con Google era de UNA sola dirección: NexusMED empujaba sus
 * citas al calendario del médico, y nada volvía. El médico se ponía una cirugía
 * el jueves de 8 a 12 en Google, y la agenda —y el portal público, y el bot—
 * seguían ofreciendo esas horas a los pacientes. Descubría el choque el jueves.
 *
 * Y no hacía falta pedir más permisos, como yo mismo había apuntado en la
 * bitácora: el alcance que ya se concede (`auth/calendar`) incluye `freebusy`.
 * Corregir esa suposición fue la mitad del trabajo.
 *
 * ── POR QUÉ SE CONVIERTE A `TimeBlock` ───────────────────────────────────────
 *
 * El motor de huecos ya sabe descartar por bloqueos —lo respetan el panel, el
 * portal, el bot y el portal del paciente—. Un origen nuevo de ocupación no
 * necesita un camino nuevo: necesita hablar el idioma del que ya existe. Así el
 * evento de Google se descuenta en los cuatro sitios sin tocar ninguno.
 *
 * ── LO QUE NO SE TRAE ────────────────────────────────────────────────────────
 *
 * `freebusy` devuelve intervalos ocupados, **sin título ni asistentes**. Es a
 * propósito: para no ofrecer un hueco basta saber que está ocupado, y traerse
 * el contenido de la agenda personal del médico —dentista, terapia, lo que sea—
 * sería recoger datos que nadie necesita para agendar.
 *
 * Módulo PURO.
 */
import type { TimeBlock } from '@/lib/time-blocks-core'

/** Un intervalo ocupado tal como lo devuelve `freebusy` de Google. */
export interface IntervaloOcupado {
  start?: string | null
  end?: string | null
}

/**
 * Convierte los intervalos de Google en bloqueos que el motor de huecos ya
 * entiende.
 *
 * @param medicoId a quién bloquean. Sin él, el bloqueo aplicaría a TODOS los
 * médicos del consultorio, que sería peor que no tenerlo: la agenda ajena de
 * uno cerraría la agenda de los demás.
 */
export function comoBloqueos(
  intervalos: readonly IntervaloOcupado[],
  medicoId?: string,
): TimeBlock[] {
  const out: TimeBlock[] = []
  for (const [i, iv] of intervalos.entries()) {
    const desde = String(iv?.start ?? '').trim()
    const hasta = String(iv?.end ?? '').trim()
    // Un intervalo incompleto o al revés se DESCARTA en vez de romper el día:
    // que Google devuelva una fila rara no puede dejar al médico sin agenda.
    if (!desde || !hasta) continue
    const a = Date.parse(desde), b = Date.parse(hasta)
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue
    out.push({
      id: `google:${i}:${desde}`,
      desde: new Date(a).toISOString(),
      hasta: new Date(b).toISOString(),
      tipo: 'evento',
      // El motivo se ve en la pantalla de bloqueos: tiene que decir de dónde
      // salió, porque el médico no lo creó aquí y si no, parece un fantasma.
      motivo: 'Ocupado en Google Calendar',
      medicoId,
      createdAt: new Date(a).toISOString(),
      creadoPor: 'google-calendar',
    })
  }
  return out
}

/** ¿Este bloqueo vino de Google? Para poder decirlo en pantalla y no editarlo. */
export function esDeGoogle(b: Pick<TimeBlock, 'creadoPor'>): boolean {
  return b.creadoPor === 'google-calendar'
}

export const POR_QUE_NO_SE_TRAE_EL_TITULO =
  'Porque para no ofrecer un hueco basta saber que está ocupado. Traerse el ' +
  'contenido de la agenda personal del médico —dentista, terapia, lo que sea— ' +
  'sería recoger datos que nadie necesita para agendar una consulta.'
