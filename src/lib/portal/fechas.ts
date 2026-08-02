/**
 * LAS FECHAS QUE EL PACIENTE VE, QUE VIENEN EN DOS FORMATOS.
 *
 * ── LO QUE ROMPÍA ────────────────────────────────────────────────────────────
 *
 * El portal parseaba todo como si fuera hora de pared del consultorio:
 * `new Date(s.replace(' ', 'T') + ':00-06:00')`. Con una CITA
 * (`2026-07-24 10:00`) funciona. Con la fecha de una RECETA —que viene de
 * `nota.fechaConsulta`, un ISO completo con `Z`— produce literalmente
 * **`Invalid Date`**:
 *
 *   · la tarjeta de «Mis recetas» imprimía «Invalid Date», y
 *   · al pulsar Descargar, `toISOString()` lanzaba `RangeError` y no bajaba
 *     nada — sin un solo mensaje para el paciente, que se queda pensando que su
 *     receta no existe.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un instante ABSOLUTO (trae `Z` u offset) se respeta tal cual. Una hora de
 * PARED (`YYYY-MM-DD HH:MM`) se ancla a la zona del consultorio, que es donde
 * ocurre la consulta. Y lo que no se entiende devuelve `null` —no una fecha
 * inventada— para que la pantalla pueda decir «sin fecha» en vez de enseñar
 * basura o reventar.
 *
 * Módulo PURO.
 */
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

/**
 * @param valor `2026-07-24 10:00`, `2026-07-24`, o un ISO completo.
 * @param tz zona del consultorio, para las horas de pared.
 */
export function fechaFlexible(valor: string | undefined | null, tz: string = TZ_DEFAULT): Date | null {
  const s = String(valor ?? '').trim()
  if (!s) return null

  // 1. Instante absoluto: trae zona dentro. Se respeta.
  if (/\d{4}-\d{2}-\d{2}T/.test(s) && /(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  // 2. Hora de pared del consultorio.
  const pared = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  if (pared) {
    const d = instanteMX(pared[1], `${pared[2]}:${pared[3]}`, tz)
    return isNaN(d.getTime()) ? null : d
  }

  // 3. Sólo el día: se ancla al MEDIODÍA, no a medianoche. A medianoche, un
  //    desfase de horas cambia el día que se le enseña al paciente.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = instanteMX(s, '12:00', tz)
    return isNaN(d.getTime()) ? null : d
  }

  // 4. Último intento, y si no se entiende NO se inventa nada.
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export const POR_QUE_NULL_Y_NO_HOY =
  'Porque una fecha inventada en una receta es peor que no tenerla: el paciente ' +
  'la lee como la fecha real en la que se la recetaron. `null` deja que la ' +
  'pantalla diga «sin fecha», que es la verdad.'
