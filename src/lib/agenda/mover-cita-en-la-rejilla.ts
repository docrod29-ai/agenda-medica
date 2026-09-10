/**
 * MOVER UNA CITA DESDE LA REJILLA — la decisión, sin la pantalla.
 *
 * ── QUÉ RESUELVE ─────────────────────────────────────────────────────────────
 *
 * Arrastrar y las flechas del teclado tienen que acabar en el MISMO sitio: una
 * cita movida a un minuto concreto, validada igual y escrita por la misma vía.
 * Si cada gesto trajera su propia aritmética, el ratón y el teclado producirían
 * agendas distintas — y el que usa teclado no tiene forma de notarlo.
 *
 * Aquí vive lo que ambos comparten. La pantalla se queda con los eventos y el
 * fantasma; esto decide **a qué hora va** y **si se puede decir que sí**.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * Escribir. La escritura es `POST /api/appointments` con `reagendarId`, que
 * re-chequea en transacción y deja bitácora; este módulo prepara la petición y
 * la respuesta se interpreta arriba. Un módulo que decidiera Y escribiera sería
 * un segundo camino de alta, que es lo que este repositorio no vuelve a hacer.
 *
 * Módulo PURO.
 */
import type { Appointment, ClinicConfig } from '@/types'
import type { TimeBlock } from '@/lib/time-blocks-core'
import { hasConflict, descansosEnMinutos, getDaySchedule, type Pared } from '@/lib/availability'
import { minutoAlSoltar, comoHora } from '@/lib/agenda/soltar-cita'

/**
 * Cuánto mueve una pulsación de flecha.
 *
 * Cinco minutos, el mismo paso menudo que el arrastre. Con las flechas no hay
 * imán —el teclado ya es preciso— así que ésta ES la granularidad del gesto, y
 * por eso tiene que coincidir con la del ratón: si el ratón imanta a las 15:45 y
 * la flecha sólo alcanzara múltiplos de 15, el mismo hueco sería inalcanzable
 * para quien no usa ratón.
 */
export const PASO_DE_FLECHA = 5

/** Lo que la pantalla necesita saber para pintar y para pedir confirmación. */
export interface MovimientoPropuesto {
  /** `'YYYY-MM-DD HH:mm'` — listo para viajar en la petición. */
  fechaHora: string
  /** Para el fantasma y para el aviso: «16:15 – 17:00». */
  etiqueta: string
  /** ¿Choca con algo? La pantalla decide si avisa o si ofrece sobreagendar. */
  choca: boolean
  /** `true` si el movimiento no cambia nada: no hay que escribir ni avisar. */
  sinCambio: boolean
}

/**
 * Las paredes del día para esta cita: las demás citas vivas y los descansos.
 *
 * La cita que se mueve se EXCLUYE — si contara como pared, imantaría contra sí
 * misma y chocaría consigo misma. Es el mismo `excludeId` que usa el motor de
 * huecos al editar.
 */
export function paredesDelDia(
  fecha: string,
  cita: Appointment,
  appointments: readonly Appointment[],
  config: ClinicConfig | null | undefined,
): Pared[] {
  const paredes: Pared[] = []
  for (const a of appointments) {
    if (a.fechaHora?.slice(0, 10) !== fecha) continue
    if (a.id === cita.id) continue
    if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) continue
    // MULTI-MÉDICO: sólo estorban las citas del MISMO médico, igual que en el
    // motor de huecos. Una cita sin `medicoId` (legacy) cuenta siempre.
    if (cita.medicoId && a.medicoId && a.medicoId !== cita.medicoId) continue
    const [h, m] = (a.fechaHora.slice(11, 16) || '00:00').split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue
    const desde = h * 60 + m
    paredes.push({ desde, hasta: desde + (Number(a.duracion) || 30) })
  }
  const schedule = config ? getDaySchedule(fecha, config) : null
  return schedule ? [...paredes, ...descansosEnMinutos(schedule.descansos)] : paredes
}

/**
 * A dónde va la cita, y si cabe.
 *
 * @param minutoCrudo  el minuto del día que propone el gesto, sin redondear
 * @param imanta       `false` para las flechas: el teclado ya es preciso, y un
 *                     imán ahí saltaría posiciones que el usuario está
 *                     recorriendo a propósito, una pulsación a la vez.
 */
export function proponerMovimiento(
  cita: Appointment,
  fechaDestino: string,
  minutoCrudo: number,
  appointments: readonly Appointment[],
  config: ClinicConfig | null | undefined,
  bloques: readonly TimeBlock[] = [],
  opciones?: { imanta?: boolean },
): MovimientoPropuesto {
  const duracion = Number(cita.duracion) || 30
  const paredes = paredesDelDia(fechaDestino, cita, appointments, config)
  const imanta = opciones?.imanta !== false

  const minuto = imanta
    ? minutoAlSoltar(minutoCrudo, duracion, paredes)
    : Math.max(0, Math.round(minutoCrudo / PASO_DE_FLECHA) * PASO_DE_FLECHA)

  const hora = comoHora(minuto)
  const fechaHora = `${fechaDestino} ${hora}`

  return {
    fechaHora,
    etiqueta: `${hora} – ${comoHora(minuto + duracion)}`,
    /*
     * El MISMO guardián que usa el modal: horario del día, festivos, descansos,
     * bloqueos y empalmes, con esta cita excluida. No se reimplementa aquí ni
     * se relaja «porque es un arrastre»: el servidor lo va a volver a mirar y
     * un sí en la pantalla que acabe en 409 es peor que un no a tiempo.
     */
    choca: config
      ? hasConflict(
          fechaDestino, hora, duracion, appointments as Appointment[],
          cita.id, bloques as TimeBlock[], cita.medicoId, config,
        )
      : false,
    sinCambio: fechaHora === cita.fechaHora,
  }
}

/**
 * Los campos que viajan al mover — los mismos que manda el modal.
 *
 * Se construye aquí y no en la pantalla para que mover por arrastre y mover por
 * el modal escriban lo mismo. `POST /api/appointments` tiene lista blanca, así
 * que un campo de más se cae en el servidor; el riesgo real es el de MENOS —
 * omitir uno equivale a borrarlo del documento.
 */
export function cuerpoDelMovimiento(cita: Appointment, fechaHora: string) {
  return {
    pacienteId: cita.pacienteId ?? '',
    pacienteNombre: cita.pacienteNombre,
    pacienteTelefono: cita.pacienteTelefono,
    fechaHora,
    duracion: cita.duracion,
    tipo: cita.tipo,
    motivo: cita.motivo ?? '',
    estado: cita.estado,
    origen: cita.origen,
    medicoNombre: cita.medicoNombre ?? '',
    ...(cita.medicoId ? { medicoId: cita.medicoId } : {}),
    lugar: cita.lugar ?? '',
    notasInternas: cita.notasInternas ?? '',
    consentimientoMensajes: cita.consentimientoMensajes,
  }
}
