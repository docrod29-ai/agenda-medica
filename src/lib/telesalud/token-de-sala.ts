/**
 * EL TOKEN CON EL QUE EL PACIENTE ENTRA A SU VIDEOCONSULTA — V9 · PATIENT-TELE-002.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * REG-268 cerró el camino del portal: allí el token ya estaba en la barra de
 * direcciones y sólo había que pasarlo. Pero la videoconsulta **se anuncia por
 * WhatsApp**, y por ahí no había token que pasar: ni el cron de recordatorios ni
 * el bot lo acuñaban, así que `dondeEsLaCita` caía en su rama honesta y mandaba
 * «recibirás el enlace de la videollamada por este medio antes de tu cita».
 *
 * Honesto, sí. Pero el enlace nunca llegaba por ese medio: el paciente tenía que
 * acordarse de abrir su portal, justo cuando va con prisa y a la hora de su
 * consulta. Un mensaje que promete un enlace que nadie manda es la misma familia
 * de defecto de siempre — **el dato tiene que LLEGAR**.
 *
 * ── POR QUÉ SE ACUÑA AQUÍ Y NO EN `lib/whatsapp.ts` ─────────────────────────
 *
 * Firmar exige `PORTAL_PACIENTE_SECRET`, que sólo vive en el servidor.
 * `lib/whatsapp.ts` se importa **también desde el navegador**: acuñar ahí
 * arrastraría el secreto al paquete del cliente. Este módulo es SOLO servidor
 * (usa `adminDb` y, por debajo, `node:crypto`).
 *
 * ── ALCANCE MÍNIMO ──────────────────────────────────────────────────────────
 *
 * `agenda`, nunca `clinico`. `/api/telesalud/sala` sólo comprueba que el token
 * sea del paciente DE ESA cita; no necesita capacidad clínica, y dársela
 * convertiría un mensaje de WhatsApp en una credencial capaz de leer documentos
 * clínicos. Es el mismo criterio de `/api/portal/link`.
 *
 * ── Y NACE CON LA VERSIÓN VIGENTE ───────────────────────────────────────────
 *
 * Igual que el magic-link del portal: si alguien revoca los enlaces de ese
 * paciente, el contador sube y este token cae con los demás. Sin versión, un
 * enlace mandado por WhatsApp sobreviviría a la revocación que se hizo
 * precisamente porque ese WhatsApp acabó donde no debía.
 */
import { adminDb } from '@/lib/firebase-admin'
import { crearTokenPaciente } from '@/lib/patient-token'
import { safeLog } from '@/lib/security/sanitize'

/**
 * CUÁNTA ANTELACIÓN ADMITE UN ENLACE MANDADO POR MENSAJE.
 *
 * El token del portal dura 7 días **por una razón escrita** (`patient-token.ts`):
 * viaja en un WhatsApp que se reenvía, que se queda en un teléfono perdido o en
 * un número reciclado. Un enlace de sala emitido al agendar una cita de dentro
 * de tres meses sería exactamente eso, pero peor: tres meses.
 *
 * Así que a una cita lejana **no se le manda enlace**. El paciente recibe el
 * texto de siempre —«recibirás el enlace antes de tu cita»— y eso ahora es
 * verdad, porque el recordatorio de 24 h sí se lo manda.
 */
export const MAX_DIAS_DE_ANTELACION = 7

/**
 * Días de vigencia del token para una cita, o `null` si no toca mandar enlace.
 *
 * Se trabaja con fechas de PARED (`YYYY-MM-DD`) porque es como se guarda la
 * cita y porque así la zona horaria no entra en el cálculo: lo único que se
 * decide aquí es cuántos días vive el token, no cuándo abre la sala (eso es
 * `ventanaDeSala`).
 *
 * El `+2` no es un número redondo por gusto. El token se acuña *ahora* y caduca
 * a las 24 h × N; la cita puede caer a las 23:59 de su día y la sala sigue
 * aceptando **2 h después** (`HORAS_DESPUES`). Con `+1` un caso extremo dejaba
 * al paciente sin entrar dos horas antes de que la sala cerrara. Con `+2` el
 * token sobra siempre y la vida máxima queda en 9 días, del mismo orden que los
 * 7 del portal.
 *
 * Módulo PURO en esta función: se prueba sin Firestore.
 */
export function diasDeVigenciaDelEnlace(
  fechaCitaISO: string | undefined | null,
  hoyISO: string,
): number | null {
  const dias = diferenciaEnDias(hoyISO, fechaCitaISO)
  if (dias === null) return null
  // Una cita pasada no necesita enlace, y una muy lejana no debe llevarlo.
  if (dias < 0 || dias > MAX_DIAS_DE_ANTELACION) return null
  return dias + 2
}

/** Días completos entre dos fechas de pared. `null` si alguna no es una fecha. */
function diferenciaEnDias(desdeISO: string, hastaISO: string | undefined | null): number | null {
  const a = aUTC(desdeISO)
  const b = aUTC(hastaISO)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000)
}

function aUTC(iso: string | undefined | null): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim())
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(t) ? null : t
}

export interface PeticionDeToken {
  clinicId: string
  /** Paciente DUEÑO de la cita. Sin él no se acuña nada: el token va atado a uno. */
  patientId: string | undefined | null
  /** `fechaHora` de la cita tal como se guarda («2026-08-10 10:00»). */
  fechaHora: string | undefined | null
  /** Hoy, en la zona del consultorio (`hoyISO(tz)`). */
  hoyISO: string
}

/**
 * Acuña el token de sala para el paciente de una cita, o `undefined`.
 *
 * Devuelve `undefined` —y NUNCA lanza— cuando no hay paciente, cuando la cita
 * queda fuera de la ventana de antelación, o cuando falla la lectura del
 * expediente. Quien recibe `undefined` no emite enlace: `dondeEsLaCita` ya
 * prefiere decir «te llegará» a mandar un enlace que contesta 404.
 *
 * Un recordatorio NO se cae porque no se pudiera acuñar un token.
 */
export async function tokenDeSalaParaPaciente(p: PeticionDeToken): Promise<string | undefined> {
  if (!p.clinicId || !p.patientId) return undefined
  const dias = diasDeVigenciaDelEnlace(p.fechaHora, p.hoyISO)
  if (dias === null) return undefined

  let version = 0
  try {
    const snap = await adminDb
      .collection('clinics').doc(p.clinicId)
      .collection('patients').doc(p.patientId).get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch (e) {
    // Sin versión conocida se emite la 0: el enlace sirve, y una revocación
    // posterior lo corta igual (`tokenVigente` compara con `>=`).
    safeLog.warn('[telesalud] no se pudo leer la versión del enlace del paciente:', String(e))
  }

  try {
    return crearTokenPaciente(p.clinicId, p.patientId, dias, 'agenda', version)
  } catch (e) {
    // `PORTAL_PACIENTE_SECRET` sin configurar en producción. Se avisa y el
    // mensaje sale sin enlace, que es el comportamiento honesto de siempre.
    safeLog.warn('[telesalud] no se pudo acuñar el token de sala:', String(e))
    return undefined
  }
}

export const POR_QUE_NO_SE_ACUNA_EN_EL_CLIENTE =
  'Porque firmar exige PORTAL_PACIENTE_SECRET y lib/whatsapp.ts se importa ' +
  'también desde el navegador: acuñar ahí metería el secreto en el paquete del ' +
  'cliente. El token se acuña en el servidor y viaja como dato de entrada.'
