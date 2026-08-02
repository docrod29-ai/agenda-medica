/**
 * EL HORARIO QUE EL BOT LE DICE AL PACIENTE.
 *
 * ── LO QUE CONTESTABA MAL ────────────────────────────────────────────────────
 *
 * La respuesta de «¿cuál es el horario?» se armaba así:
 *
 *   `• ${dia}: ${v.inicio}–${v.fin}`
 *
 * …ignorando los **descansos** del horario partido. Un consultorio que atiende
 * de 9 a 14 y de 16 a 20 —lo normal en México— le decía al paciente
 * «Lunes: 09:00–20:00». El paciente entiende que a las 15:00 hay atención, y o
 * bien se presenta a una puerta cerrada, o intenta agendar a esa hora y la
 * agenda no se lo ofrece, porque el motor de huecos SÍ respeta el descanso desde
 * que se reparó (v829/v830).
 *
 * Es decir: el sistema sabía la verdad y su propio bot decía otra cosa.
 *
 * ── Y SIN `botConfig` NO CONTESTABA NI LO QUE SABE ───────────────────────────
 *
 * `buildFAQReply` empieza con `if (!bot) return «comuníquese al teléfono»`. Pero
 * el horario y la dirección NO salen de `botConfig`: salen de la configuración
 * del consultorio, que siempre está llena porque sin ella no hay agenda. Un
 * consultorio que no completó el onboarding del bot tenía la sección
 * «2️⃣ Información (horarios, costos, ubicación)» en el menú y el bot
 * contestando el teléfono a todo — pareciendo tonto por nada.
 *
 * Módulo PURO.
 */

/** Un día del horario, tal como se guarda. */
export interface DiaHorario {
  activo: boolean
  inicio: string
  fin: string
  /** Huecos que NO se atienden dentro del día (comida, quirófano…). */
  descansos?: readonly { inicio: string; fin: string }[]
}

const NOMBRE: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}

/** Orden natural de la semana, no el del objeto. */
const ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

/**
 * Los tramos REALES de un día: el horario menos sus descansos.
 *
 * Un descanso mal escrito se ignora en vez de romper el día — el mismo criterio
 * que el motor de huecos: es preferible enseñar el día completo que no enseñar
 * nada.
 */
export function tramosDelDia(dia: DiaHorario): string[] {
  if (!dia?.activo) return []
  const validos = (dia.descansos ?? [])
    .filter(d => /^\d{2}:\d{2}$/.test(d?.inicio ?? '') && /^\d{2}:\d{2}$/.test(d?.fin ?? '') && d.fin > d.inicio)
    .filter(d => d.inicio >= dia.inicio && d.fin <= dia.fin)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  if (validos.length === 0) return [`${dia.inicio}–${dia.fin}`]

  const tramos: string[] = []
  let cursor = dia.inicio
  for (const d of validos) {
    if (d.inicio > cursor) tramos.push(`${cursor}–${d.inicio}`)
    if (d.fin > cursor) cursor = d.fin
  }
  if (dia.fin > cursor) tramos.push(`${cursor}–${dia.fin}`)
  return tramos
}

/**
 * El horario completo, listo para mandar por WhatsApp.
 *
 * Devuelve `''` si no hay ningún día activo: quien llama decide qué decir, y no
 * se manda un mensaje con un encabezado y nada debajo.
 */
export function horarioLegible(horario: Record<string, DiaHorario> | undefined | null): string {
  if (!horario) return ''
  const lineas: string[] = []
  for (const clave of ORDEN) {
    const dia = horario[clave]
    const tramos = dia ? tramosDelDia(dia) : []
    if (tramos.length) lineas.push(`• ${NOMBRE[clave] ?? clave}: ${tramos.join(' y ')}`)
  }
  return lineas.join('\n')
}

export const POR_QUE_IMPORTA_EL_DESCANSO =
  'Porque «Lunes: 09:00–20:00» en un consultorio que cierra de 14:00 a 16:00 es ' +
  'una respuesta falsa: el paciente se presenta a una puerta cerrada, o intenta ' +
  'agendar a esa hora y la agenda no se lo ofrece. El motor de huecos ya ' +
  'respetaba el descanso; el bot decía otra cosa.'
