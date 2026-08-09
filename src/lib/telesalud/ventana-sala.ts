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

/**
 * CUÁNTO TIENE QUE VIVIR EL ENLACE QUE SE MANDA POR WHATSAPP.
 *
 * El token del paciente caduca por tiempo, y aquí se decide cuánto. Fijar un
 * número redondo —«un día»— rompe el caso más importante: el recordatorio de
 * 24 h sale entre 23 y 26 horas antes de la cita, así que un token de 24 h
 * caduca **justo antes** de la consulta que anuncia. El enlace llegaría, y
 * fallaría solo, exactamente el día de la cita.
 *
 * Por eso la vida del enlace se deriva de la cita, no de una constante: muere
 * cuando muere la sala, más un día de gracia.
 *
 * ── POR QUÉ HAY UN DÍA DE GRACIA ─────────────────────────────────────────────
 *
 * `/api/telesalud/sala` responde **404 «Cita no encontrada»** a quien no trae
 * titularidad, a propósito. Si el token caducara en el mismo instante que la
 * sala, el paciente que entra tarde leería que su cita no existe en vez de «la
 * sala de esta consulta ya se cerró, llama al consultorio». La gracia sólo
 * cambia el mensaje: la sala sigue cerrada, la comprueba el servidor.
 *
 * ── POR QUÉ HAY UN TOPE, Y QUÉ PASA CUANDO SE CRUZA ──────────────────────────
 *
 * El bot confirma citas que pueden estar a semanas. Un token vivo semanas en un
 * mensaje de WhatsApp —que se reenvía, que se queda en un teléfono perdido— es
 * justo lo que se recortó al bajar el portal de 30 días a 7. Cuando la cita cae
 * más allá del tope **no se emite enlace**: el mensaje dice que lo recibirá por
 * este medio antes de su cita, y el recordatorio de 24 h lo cumple.
 */
export const MAX_DIAS_ENLACE_SALA = 7
/** Horas que el enlace sobrevive al cierre de la sala, sólo para dar el mensaje bueno. */
export const GRACIA_HORAS = 24

/**
 * Días de vida que debe tener el token del enlace, o `null` si no se emite.
 *
 * `null` significa **no mandes enlace**, y tiene dos causas legítimas: la cita
 * ya pasó (no hay sala que abrir) o está más allá del tope (lo llevará el
 * recordatorio).
 */
export function diasDeVidaDelEnlace(
  fechaHora: string | undefined | null,
  ahoraMs: number,
  tz: string = TZ_DEFAULT,
): number | null {
  const [f, h] = String(fechaHora ?? '').split(/[ T]/)
  if (!f) return null

  const inicio = instanteMX(f, (h ?? '00:00').slice(0, 5), tz).getTime()
  if (!Number.isFinite(inicio)) return null

  const muere = inicio + HORAS_DESPUES * 3_600_000 + GRACIA_HORAS * 3_600_000
  const dias = (muere - ahoraMs) / 86_400_000
  if (!(dias > 0)) return null
  if (dias > MAX_DIAS_ENLACE_SALA) return null
  return dias
}

/**
 * El enlace del PACIENTE. Sin `dr=1`: eso abre el panel clínico del médico.
 *
 * ── EL ENLACE DEL PACIENTE NO LLEVABA CON QUÉ ENTRAR ─────────────────────────
 *
 * Esta función devolvía `?c=<clinicId>` y nada más. Pero `/api/telesalud/sala`
 * exige **una de dos** pruebas de titularidad: el token HMAC del paciente, o una
 * sesión de miembro del consultorio con `clinico.leer`. El paciente no tiene
 * sesión, y aquí no se le daba token — así que caía en la rama de rechazo, que
 * responde **404 «Cita no encontrada»** a propósito, para no confirmarle a un
 * desconocido que ese `citaId` existe.
 *
 * Resultado: el paciente pulsaba «Entrar a la videoconsulta» **dentro de su
 * propio portal** —donde estaba autenticado por token, en la barra de
 * direcciones, a un `search.get('t')` de distancia— y la aplicación le decía que
 * su cita no existe. En la hora de su consulta.
 *
 * El médico no lo veía nunca: su botón de `(dashboard)/citas` sí añade `&t=`,
 * con un token emitido aparte por `/api/telesalud/token`. Sólo fallaba el
 * camino del paciente, que es el único que nadie de dentro recorre.
 *
 * ── POR QUÉ EL TOKEN ES OBLIGATORIO EN LA FIRMA ──────────────────────────────
 *
 * Podría ser opcional, y entonces este defecto volvería en el siguiente sitio
 * que llame a esta función sin él, en silencio. Siendo obligatorio, el
 * compilador obliga a **cada** llamador a decidir qué token pone; y quien no
 * tenga ninguno tiene que decirlo con `''`, que es una decisión escrita, no un
 * olvido. `donde-es.ts` hace justo eso: sin token no emite enlace, porque un
 * enlace que contesta «tu cita no existe» es peor que ninguno.
 *
 * Familia: «el dato tiene que LLEGAR» — el enlace se construía, se enviaba y se
 * abría; lo que no llegaba era la credencial que lo hace funcionar del otro lado.
 */
export function enlaceSalaPaciente(citaId: string, clinicId: string, tokenPaciente: string): string {
  const base = `/teleconsulta/${encodeURIComponent(citaId)}?c=${encodeURIComponent(clinicId)}`
  return tokenPaciente ? `${base}&t=${encodeURIComponent(tokenPaciente)}` : base
}

export const POR_QUE_NO_LLEVA_DR =
  'Porque `dr=1` abre el panel lateral con la nota y la receta: es la vista del ' +
  'médico. El enlace del paciente entra a la misma sala sin ese panel.'
