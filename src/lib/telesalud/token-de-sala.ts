/**
 * EL TOKEN DE LA SALA — lo único que le faltaba al enlace que viaja por WhatsApp.
 *
 * V9 · `PATIENT-TELE-002` · REG-309. **Módulo de SERVIDOR**: lee Firestore y
 * acuña con el secreto de firma. No lo importe nada que llegue al navegador.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO Y NO UNA LÍNEA EN CADA LLAMADOR ─────────────
 *
 * REG-265 cerró el camino del portal: el botón «Entrar a la videoconsulta» de
 * `/mi/[token]` propaga el token que el paciente ya trae en la URL. Los mensajes
 * de WhatsApp no tienen de dónde propagarlo — los compone el servidor, sin
 * paciente delante—, así que `dondeEsLaCita` recibía `tokenPaciente:
 * undefined` y, desde REG-265, decía honestamente «recibirás el enlace».
 *
 * Honesto y sin enlace. La videoconsulta se anuncia por WhatsApp; el paciente
 * acaba entrando al portal —que también le llega por WhatsApp— para encontrar el
 * botón. Un paso de más justo cuando va con prisa.
 *
 * `lib/whatsapp.ts` no puede acuñarlo: **ese módulo se importa desde el
 * navegador**, y firmar ahí filtraría `PORTAL_PACIENTE_SECRET`. De ahí que la
 * emisión viva aquí, en un módulo que sólo tocan las rutas de servidor, y que
 * `DatosDeLugar.tokenPaciente` sea un dato de entrada y no un cálculo.
 *
 * ── ALCANCE `agenda`, NUNCA `clinico` ───────────────────────────────────────
 *
 * Este enlace viaja por WhatsApp: se reenvía, se queda en la copia de seguridad
 * del teléfono, sobrevive a un cambio de número. Con alcance clínico sería una
 * credencial al expediente circulando por una app de mensajería.
 *
 * Con `agenda` abre exactamente lo que tiene que abrir —la sala de SU cita, que
 * además comprueba titularidad del otro lado— y deja fuera recetas, paquetes y
 * documentos. Es la misma decisión que ya tomó `/api/portal/link` (E0-06).
 *
 * ── DOS DÍAS, Y NO TREINTA ──────────────────────────────────────────────────
 *
 * El recordatorio de víspera sale ~24 h antes y la sala se cierra 2 h después de
 * la hora. Dos días cubre el caso completo con margen, y **caduca solo**: el
 * enlace reenviado a un grupo dentro de una semana ya no vale.
 *
 * Con un día, un recordatorio emitido a las 20:00 de la víspera para una cita de
 * las 21:00 caducaba una hora antes de que el paciente entrase. Con treinta, un
 * mensaje de WhatsApp sería una llave de un mes.
 *
 * ── FALLA ABIERTA HACIA «SIN ENLACE», NUNCA HACIA UN ENLACE ROTO ────────────
 *
 * Si la lectura de la versión falla, se acuña igual con la versión 0: el enlace
 * sirve y una revocación posterior lo corta como a cualquier otro. Si falla el
 * acuñado —falta el secreto en producción—, se devuelve cadena vacía y
 * `dondeEsLaCita` dice «recibirás el enlace». Es la vuelta a lo que había, que
 * es exactamente lo que debe pasar cuando algo no está en su sitio.
 *
 * Lo que NUNCA se hace es mandar un enlace sin token: `/api/telesalud/sala`
 * contesta **404 «Cita no encontrada»** a quien no trae prueba de titularidad, y
 * un paciente que lee eso media hora antes de su consulta cree que se quedó sin
 * cita. Peor que no mandar nada.
 */
import { adminDb } from '@/lib/firebase-admin'
import { crearTokenPaciente } from '@/lib/patient-token'
import { safeLog } from '@/lib/security/sanitize'

/** Ver la cabecera: cubre el recordatorio de víspera y el cierre de la sala. */
export const DIAS_DEL_TOKEN_DE_SALA = 2

/**
 * Acuña el token con el que el paciente entra a la sala de SU cita.
 *
 * Devuelve `''` cuando no se puede —sin identificadores, sin secreto— para que
 * el llamador se lo pase tal cual a `dondeEsLaCita` y el mensaje caiga solo en
 * «recibirás el enlace». Nunca lanza: un fallo aquí no puede tumbar el envío del
 * recordatorio, que es lo único que evita la falta a la consulta.
 */
export async function tokenParaLaSala(clinicId: unknown, pacienteId: unknown): Promise<string> {
  const c = String(clinicId ?? '').trim()
  const p = String(pacienteId ?? '').trim()
  if (!c || !p) return ''

  /**
   * La versión vigente del paciente, para que una revocación posterior también
   * tumbe este enlace. Sin ella se emite la 0, que es lo que tienen todos los
   * enlaces anteriores a la revocación: siguen valiendo hasta que alguien
   * revoque, y entonces caen todos juntos.
   */
  let version = 0
  try {
    const snap = await adminDb.collection('clinics').doc(c).collection('patients').doc(p).get()
    version = Number((snap.data() as { portalTokenVersion?: number } | undefined)?.portalTokenVersion ?? 0)
  } catch (e) {
    /* Sin PHI: ni el id del paciente ni su nombre. Sólo que no se pudo leer. */
    safeLog.warn('[telesalud] no se pudo leer la versión del enlace; se emite la 0:', String(e))
  }

  try {
    return crearTokenPaciente(c, p, DIAS_DEL_TOKEN_DE_SALA, 'agenda', version)
  } catch (e) {
    safeLog.warn('[telesalud] no se pudo acuñar el token de la sala:', String(e))
    return ''
  }
}

export const POR_QUE_NO_SE_ACUNA_EN_WHATSAPP =
  'Porque `lib/whatsapp.ts` se importa también desde el navegador, y firmar ' +
  'ahí filtraría PORTAL_PACIENTE_SECRET al cliente.'
