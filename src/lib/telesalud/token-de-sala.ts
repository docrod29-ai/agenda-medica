/**
 * ACUÑAR EL TOKEN DE LA SALA — para los mensajes que salen del SERVIDOR.
 *
 * ── QUÉ HUECO CIERRA ─────────────────────────────────────────────────────────
 *
 * REG-268 arregló el camino del portal: el paciente que abre `/mi/<token>` ya
 * puede entrar a su videoconsulta, porque ahí el token estaba en la barra de
 * direcciones y sólo había que pasarlo.
 *
 * Los mensajes de WhatsApp no tienen esa suerte. El cron de recordatorios y el
 * bot llamaban a `dondeEsLaCita` **sin token**, así que desde REG-268 mandaban
 * «recibirás el enlace de la videollamada por este medio antes de tu cita».
 * Honesto —mejor que un enlace que contesta 404— pero el paciente seguía sin
 * enlace justo por el canal por el que se le anuncia la videoconsulta.
 *
 * Aquí sí se puede acuñar: los dos son servidor, y el secreto de firma vive en
 * el servidor. Lo que NO se puede es hacerlo en `lib/whatsapp.ts` ni en
 * `donde-es.ts`: esos módulos se importan también desde el navegador, y firmar
 * ahí filtraría `PORTAL_PACIENTE_SECRET` al paquete del cliente.
 *
 * ── QUÉ PODER LLEVA ESTE TOKEN, Y POR QUÉ NO ES PODER NUEVO ──────────────────
 *
 * Alcance `agenda`: ver, confirmar, cancelar y reagendar citas. Es el mínimo con
 * el que `/api/telesalud/sala` deja entrar, porque esa ruta compara `clinicId` y
 * `patientId` y nada más.
 *
 * Y no añade superficie: al mismo teléfono ya le llega el enlace del portal, que
 * es un token de alcance `agenda` de **siete días**. Éste vive lo que dure la
 * ventana de la sala y casi siempre menos (ver `diasDeVidaDelEnlace`).
 *
 * ── FALLA CERRADO ────────────────────────────────────────────────────────────
 *
 * Sin `pacienteId` no hay token. Una cita sin expediente vinculado no puede
 * demostrar titularidad del otro lado, así que emitirle un enlace sería emitirle
 * un 404. Devuelve `''` y `dondeEsLaCita` manda el texto de «te llega aparte».
 *
 * SÓLO SERVIDOR: `crearTokenPaciente` usa `node:crypto`.
 */
import { crearTokenPaciente } from '@/lib/patient-token'
import { diasDeVidaDelEnlace } from '@/lib/telesalud/ventana-sala'
import { ES_TELECONSULTA } from '@/lib/telesalud/donde-es'
import { TZ_DEFAULT } from '@/lib/timezone'

export interface DatosDelTokenDeSala {
  /** `tipo` de la cita, tal como se guarda. Sólo la teleconsulta lleva enlace. */
  tipo?: string
  clinicId?: string
  /** Expediente al que pertenece la cita. Sin él no se emite token. */
  pacienteId?: string
  /** Hora de PARED de la cita («2026-08-10 10:00»). */
  fechaHora?: string
  /** Instante de referencia (entra como parámetro para poder probarlo). */
  ahoraMs: number
  /** Zona del consultorio: es donde ocurre la consulta. */
  tz?: string
  /**
   * Contador de revocación del expediente (`patients/{id}.portalTokenVersion`).
   *
   * Va DENTRO del token para que revocar los enlaces de un paciente —teléfono
   * perdido, número reciclado, mensaje reenviado a un grupo— también tumbe el de
   * su videoconsulta. Quien lo lee es `/api/telesalud/sala`.
   */
  portalTokenVersion?: number
}

/** Token del paciente para entrar a SU sala, o `''` si no procede emitirlo. */
export function tokenParaLaSala(d: DatosDelTokenDeSala): string {
  const esVideo = String(d.tipo ?? '').trim().toLowerCase() === ES_TELECONSULTA
  if (!esVideo) return ''
  if (!d.clinicId || !d.pacienteId) return ''

  const dias = diasDeVidaDelEnlace(d.fechaHora, d.ahoraMs, d.tz ?? TZ_DEFAULT)
  if (dias === null) return ''

  return crearTokenPaciente(d.clinicId, d.pacienteId, dias, 'agenda', Number(d.portalTokenVersion ?? 0))
}

/**
 * La versión de revocación del expediente, para meterla en el token.
 *
 * Si la lectura falla se emite la 0, igual que `/api/portal/link`: dejar al
 * paciente sin enlace por un mal minuto de Firestore es peor que el riesgo que
 * esto acota, y la firma y la caducidad siguen protegiendo. Una revocación
 * posterior corta igual, porque sube el contador del expediente.
 */
export async function versionDeRevocacion(
  leerPaciente: () => Promise<{ portalTokenVersion?: number } | undefined>,
): Promise<number> {
  try {
    const p = await leerPaciente()
    return Number(p?.portalTokenVersion ?? 0)
  } catch {
    return 0
  }
}

export const POR_QUE_NO_SE_FIRMA_EN_EL_CLIENTE =
  'Porque `lib/whatsapp.ts` y `donde-es.ts` se importan también desde el ' +
  'navegador: firmar ahí metería PORTAL_PACIENTE_SECRET en el paquete que se ' +
  'descarga el paciente. El token se acuña en el servidor y entra como dato.'
