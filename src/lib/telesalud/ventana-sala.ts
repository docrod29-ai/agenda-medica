/**
 * CUÁNDO SE PUEDE ENTRAR A LA SALA DE UNA TELECONSULTA.
 *
 * ── EL AGUJERO: EL PACIENTE NO TENÍA POR DÓNDE ENTRAR ────────────────────────
 *
 * La teleconsulta es un tipo de cita, se agenda, tiene su concepto de cobro y
 * su precio, y el consultorio tiene el botón «Unirse» en la lista de citas. El
 * PACIENTE no tenía nada: en su portal, `teleconsulta` era sólo una etiqueta en
 * el mapa de tipos de cita, y ni la confirmación ni los recordatorios llevan el
 * enlace de la sala.
 *
 * O sea: se puede vender, agendar y cobrar una videoconsulta a la que el
 * paciente no puede llegar. Es el mismo patrón que ya apareció esta noche varias
 * veces —el sistema promete algo que no hace— pero aquí el que se queda mirando
 * la pantalla es el paciente, a la hora de su consulta.
 *
 * ── LA VENTANA NO SE INVENTA AQUÍ ────────────────────────────────────────────
 *
 * Los 30 minutos antes y las 2 horas después son los que YA aplica el servidor
 * al crear la sala (`api/telesalud/sala`, propiedades `nbf` y `exp` de Daily).
 * Este módulo los repite para que el botón del paciente diga lo mismo que hará
 * el servidor: un botón que abre una sala caducada es peor que no tener botón,
 * porque el paciente cree que el problema es suyo.
 *
 * Si algún día cambia la ventana, cambia en los dos sitios — y esa es
 * exactamente la razón de que las constantes estén exportadas y probadas.
 *
 * Módulo PURO.
 */
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

/** Minutos ANTES de la hora de la cita en que la sala ya acepta a alguien. */
export const MINUTOS_ANTES = 30
/** Horas DESPUÉS de la hora de la cita en que la sala deja de aceptar. */
export const HORAS_DESPUES = 2

export type EstadoSala = 'abierta' | 'todavia-no' | 'caducada' | 'sin-fecha'

export interface Ventana {
  estado: EstadoSala
  /** Qué decirle al paciente. Vacío cuando está abierta. */
  mensaje: string
}

/**
 * ¿Puede entrar ya?
 *
 * @param fechaHora hora de PARED de la cita («2026-08-10 10:00»), como se guarda.
 * @param ahoraMs instante de referencia (entra como parámetro para poder probarlo).
 * @param tz zona del consultorio, que es donde ocurre la consulta.
 */
export function ventanaDeSala(
  fechaHora: string | undefined | null,
  ahoraMs: number,
  tz: string = TZ_DEFAULT,
): Ventana {
  const [f, h] = String(fechaHora ?? '').split(/[ T]/)
  if (!f) return { estado: 'sin-fecha', mensaje: 'Esta cita no tiene hora registrada.' }

  const inicio = instanteMX(f, (h ?? '00:00').slice(0, 5), tz).getTime()
  if (!Number.isFinite(inicio)) {
    return { estado: 'sin-fecha', mensaje: 'Esta cita no tiene hora registrada.' }
  }

  const abre = inicio - MINUTOS_ANTES * 60_000
  const cierra = inicio + HORAS_DESPUES * 3_600_000

  if (ahoraMs < abre) {
    return {
      estado: 'todavia-no',
      mensaje: `La sala se abre ${MINUTOS_ANTES} minutos antes de tu cita.`,
    }
  }
  if (ahoraMs > cierra) {
    // Se dice que caducó, no se esconde el botón sin explicación: el paciente
    // que llega tarde tiene que entender por qué no entra, y a quién llamar.
    return {
      estado: 'caducada',
      mensaje: 'La sala de esta consulta ya se cerró. Llama al consultorio para reagendar.',
    }
  }
  return { estado: 'abierta', mensaje: '' }
}

/** El enlace del PACIENTE. Sin `dr=1`: eso abre el panel clínico del médico. */
export function enlaceSalaPaciente(citaId: string, clinicId: string): string {
  return `/teleconsulta/${encodeURIComponent(citaId)}?c=${encodeURIComponent(clinicId)}`
}

export const POR_QUE_NO_LLEVA_DR =
  'Porque `dr=1` abre el panel lateral con la nota y la receta: es la vista del ' +
  'médico. El enlace del paciente entra a la misma sala sin ese panel.'
