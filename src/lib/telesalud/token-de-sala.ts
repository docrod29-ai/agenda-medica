/**
 * ACUÑAR EL TOKEN DEL ENLACE DE LA SALA — sólo servidor.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * REG-265 cerró el camino del portal: el botón «Entrar a la videoconsulta» que
 * el paciente pulsa dentro de su propio portal ya lleva su token. Lo que quedó
 * abierto es el camino por el que la videoconsulta se **anuncia**: WhatsApp.
 *
 * `dondeEsLaCita` exige `tokenPaciente` para emitir enlace —sin él prefiere
 * decir «recibirás el enlace por este medio antes de tu cita», que es honesto
 * pero deja al paciente sin enlace—, y los tres llamadores de servidor no lo
 * acuñaban: el cron de recordatorios y los dos mensajes de cita agendada del
 * bot. Este módulo es lo que faltaba entre ellos.
 *
 * ── POR QUÉ AQUÍ Y NO EN `lib/whatsapp.ts` ───────────────────────────────────
 *
 * Firmar exige `PORTAL_PACIENTE_SECRET`, y `lib/whatsapp.ts` se importa también
 * desde el navegador: acuñar allí filtraría el secreto al paquete del cliente.
 * Este módulo depende de `node:crypto` (vía `patient-token`) y de `adminDb`, así
 * que sólo puede vivir del lado del servidor — y eso es una propiedad, no un
 * inconveniente.
 *
 * ── EL ALCANCE ES `agenda`, Y ESO TIENE UN RESIDUO ───────────────────────────
 *
 * El token que abre la sala es el mismo que abre el portal con alcance
 * `agenda`: ver, confirmar, cancelar y reagendar citas. No es una capacidad
 * nueva —ese mismo enlace ya viaja por WhatsApp desde `/api/portal/link`— pero
 * sí es una credencial más en circulación. Un alcance `sala`, que sólo abriera
 * la sala, sería mejor y exige tocar el modelo del token y dos rutas más; queda
 * anotado como `TELE-ALCANCE-001` en el backlog, no escondido aquí.
 *
 * La vida del token la decide `diasDeVidaDelEnlace`, que la deriva de la cita:
 * ver su cabecera, porque el número redondo era un defecto.
 */
import { adminDb } from '@/lib/firebase-admin'
import { crearTokenPaciente } from '@/lib/patient-token'
import { esTeleconsulta } from '@/lib/telesalud/donde-es'
import { diasDeVidaDelEnlace } from '@/lib/telesalud/ventana-sala'
import { TZ_DEFAULT } from '@/lib/timezone'

export interface CitaParaEnlace {
  tipo?: string | null
  clinicId?: string | null
  pacienteId?: string | null
  /** Hora de PARED de la cita, como se guarda: «2026-08-10 10:00». */
  fechaHora?: string | null
  ahoraMs: number
  /** Zona del consultorio: es donde ocurre la consulta. */
  tz?: string
}

/**
 * Token para el enlace de la sala, o `undefined` si no toca emitir enlace.
 *
 * FALLA CERRADO en todos los casos: sin tipo teleconsulta, sin identificadores,
 * fuera de plazo o con el expediente ilegible devuelve `undefined`, y entonces
 * `dondeEsLaCita` manda el texto honesto en vez de un enlace roto.
 */
export async function tokenDeSalaParaElPaciente(c: CitaParaEnlace): Promise<string | undefined> {
  if (!esTeleconsulta(c.tipo)) return undefined
  const clinicId = String(c.clinicId ?? '').trim()
  const pacienteId = String(c.pacienteId ?? '').trim()
  if (!clinicId || !pacienteId) return undefined

  const dias = diasDeVidaDelEnlace(c.fechaHora, c.ahoraMs, c.tz ?? TZ_DEFAULT)
  if (dias === null) return undefined

  /**
   * El enlace nace con la VERSIÓN vigente del paciente, igual que el del
   * portal: cuando alguien revoca, ese contador sube y todos los enlaces
   * emitidos antes dejan de servir. Sin versión conocida se emite la 0 — el
   * enlace sirve, y una revocación posterior lo corta igual.
   */
  let version = 0
  try {
    const snap = await adminDb
      .collection('clinics').doc(clinicId)
      .collection('patients').doc(pacienteId)
      .get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch { /* el recordatorio no se cae por no poder leer un contador */ }

  return crearTokenPaciente(clinicId, pacienteId, dias, 'agenda', version)
}
