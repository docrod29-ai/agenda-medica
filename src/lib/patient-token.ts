import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tokens firmados para el Portal del Paciente (magic-link sin contraseña).
 *
 * Formato: base64url(payload).base64url(hmacSHA256(payload))
 * payload = { c: clinicId, p: patientId, e: expEpochSegundos }
 *
 * El token va atado a UN paciente de UNA clínica y caduca. La API verifica
 * la firma y nunca devuelve/modifica datos de otro paciente.
 *
 * SOLO servidor (usa node:crypto). No importar desde componentes cliente.
 */

/**
 * CUÁNTO DURA UN ENLACE DEL PORTAL.
 *
 * Eran 30 días. Ese enlace llega por WhatsApp y da acceso a las citas del
 * paciente —incluido el `motivo`, que es texto clínico— y permite cancelar y
 * reagendar. Un mes es demasiado para algo que viaja en un mensaje que se
 * reenvía, que se queda en un teléfono perdido o en un número reciclado.
 *
 * Siete días cubre el caso real —confirmar o mover la cita de esta semana— y
 * reduce en cuatro quintas partes la ventana de un enlace suelto.
 */
const DIAS_DEFECTO = 7

/**
 * E0-06 — ALCANCE del token. No todos los magic-links deben poder lo mismo.
 *
 * `/api/portal/link` lo emite CUALQUIER miembro (la asistente pulsa el botón y se
 * abre WhatsApp con el enlace: es su trabajo diario). Pero el token que le devuelve
 * el servidor a SU navegador también abría la acción `documentos` de `/api/portal`,
 * que devuelve diagnósticos y medicamentos de las notas FIRMADAS — o sea, secreto
 * médico saltándose el gate `isMedico` de firestore.rules.
 *
 * Es el MISMO vector que ya se cerró en `/api/telesalud/token` subiéndolo a
 * `verificarMedico`. Aquí no se puede hacer lo mismo sin romper el flujo real de la
 * asistente, así que se separa la capacidad en vez del rol:
 *
 *  - `agenda`  → ver/confirmar/cancelar/reagendar citas. Lo que emite la asistente.
 *  - `clinico` → además, los documentos clínicos. Solo lo emite un médico.
 *
 * FALLA-CERRADO: un token viejo SIN campo de alcance se interpreta como `agenda`.
 */
/**
 * ── PP-005 · PO-009 · PC-018 — UN TERCER ALCANCE: `documento` ───────────────
 *
 * Hasta hoy compartir algo del portal era compartir el portal ENTERO. El
 * paciente que necesita justificar una incapacidad ante su jefe, o la madre que
 * tiene que enseñarle la receta a la guardería, sólo podían reenviar su enlace:
 * siete días de citas con motivo, recetas con diagnóstico, plan con alergias y
 * sus propias preguntas — y con la capacidad de cancelar, reagendar y preguntar
 * en su nombre.
 *
 * `documento` abre UNA cosa y nada más: el documento que el paciente eligió. No
 * lista citas, no abre el plan, no deja preguntar, no deja mover nada. Y el
 * paciente lo emite desde su propio portal, así que no depende de que el
 * consultorio esté abierto.
 *
 * Sigue siendo un enlace sin contraseña, con lo que eso implica (ver
 * `POR_QUE_NO_HAY_SEGUNDO_FACTOR`): lo que cambia es CUÁNTO abre, que es la
 * mitad del riesgo que nadie estaba acotando.
 */
export type AlcanceToken = 'agenda' | 'clinico' | 'documento'

const ALCANCE_DEFECTO: AlcanceToken = 'agenda'

/** Los tres alcances conocidos. Cualquier otra cosa se degrada a `agenda`. */
const ALCANCES: readonly AlcanceToken[] = ['agenda', 'clinico', 'documento']

interface PayloadPaciente {
  c: string // clinicId
  p: string // patientId
  e: number // exp epoch (segundos)
  a?: AlcanceToken // alcance (ausente = 'agenda', fail-closed)
  /**
   * QUÉ documento abre, cuando el alcance es `documento`.
   *
   * Sin esto, un alcance `documento` sería un alcance clínico con otro nombre.
   * La ruta exige que esté y que coincida con la nota que se pide.
   */
  d?: string
  /**
   * QUIÉN es el cuidador autorizado que usa este enlace, si lo hay.
   *
   * `patient-facing-ai.md` §8: «un cuidador autorizado es una autorización
   * explícita y revocable, con bitácora — no un segundo dueño del expediente».
   * Sin este campo, dos cuidadores son indistinguibles (PP-008) y la bitácora
   * no puede decir quién abrió qué (PG-011, PO-014, PI-013).
   */
  u?: string
  /**
   * VERSIÓN del enlace, para poder REVOCARLO.
   *
   * No existía ninguna forma de invalidar un enlace ya emitido: firmado y con
   * fecha, valía hasta caducar pasara lo que pasara —teléfono perdido, número
   * reciclado, mensaje reenviado a un grupo—. La única salida era esperar.
   *
   * Ahora el expediente lleva un contador; subirlo invalida de golpe todos los
   * enlaces emitidos para ese paciente. Ausente = versión 0, que es lo que
   * tienen los enlaces anteriores a esto: siguen valiendo hasta que alguien
   * revoque, y entonces caen todos juntos.
   */
  v?: number
}

function getSecret(): string {
  const s = process.env.PORTAL_PACIENTE_SECRET
  if (s && s.length >= 16) return s
  // Fallback SOLO para desarrollo local. En producción es obligatoria.
  if (process.env.NODE_ENV !== 'production') {
    return 'dev-portal-secret-no-usar-en-produccion-0123456789'
  }
  throw new Error('PORTAL_PACIENTE_SECRET no configurada')
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function firmar(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
}

/** Lo que un enlace puede llevar además del paciente y su alcance. */
export interface ExtrasDelToken {
  /** Sólo con alcance `documento`: qué nota abre. */
  documentoId?: string
  /** Quién es el cuidador autorizado que lo usa. Va a la bitácora. */
  cuidadorId?: string
}

/** Crea un token firmado para un paciente. ttlDias por defecto 7, alcance `agenda`. */
export function crearTokenPaciente(
  clinicId: string,
  patientId: string,
  ttlDias = DIAS_DEFECTO,
  alcance: AlcanceToken = ALCANCE_DEFECTO,
  version = 0,
  extras: ExtrasDelToken = {},
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDias * 86400
  const payload: PayloadPaciente = { c: clinicId, p: patientId, e: exp, a: alcance, v: version }
  if (extras.documentoId) payload.d = String(extras.documentoId)
  if (extras.cuidadorId) payload.u = String(extras.cuidadorId)
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${firmar(payloadB64)}`
}

export interface TokenVerificado {
  clinicId: string
  patientId: string
  /** Nunca es undefined: un token sin alcance declarado se degrada a `agenda`. */
  alcance: AlcanceToken
  /** Versión con la que se emitió. El llamador la compara con la del expediente. */
  version: number
  /** Con alcance `documento`, la ÚNICA nota que este enlace abre. */
  documentoId: string | null
  /** El cuidador autorizado que usa este enlace, para la bitácora. */
  cuidadorId: string | null
}

/** Verifica firma + caducidad. Devuelve null si es inválido o expiró. */
export function verificarTokenPaciente(token: string | undefined | null): TokenVerificado | null {
  if (!token || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const [payloadB64, firmaRecibida] = partes

  // Comparación en tiempo constante
  const esperada = firmar(payloadB64)
  const a = Buffer.from(firmaRecibida)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: PayloadPaciente
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload.c || !payload.p || !payload.e) return null
  if (Math.floor(Date.now() / 1000) > payload.e) return null // expirado

  // Solo se acepta un alcance CONOCIDO; cualquier otra cosa (o su ausencia) cae a
  // 'agenda'. Un payload manipulado no puede inventarse un alcance nuevo.
  const declarado = ALCANCES.includes(payload.a as AlcanceToken) ? (payload.a as AlcanceToken) : ALCANCE_DEFECTO
  const documentoId = payload.d ? String(payload.d) : null
  /**
   * FALLA-CERRADO EN LOS DOS SENTIDOS.
   *
   * Un alcance `documento` SIN documento sería un enlace que dice abrir una
   * cosa y no dice cuál: se degrada a `agenda`, que es el alcance que menos
   * abre. Y un `documentoId` colgado de un alcance que no es `documento` se
   * ignora, para que nadie pueda usarlo como si acotara algo.
   */
  const alcance: AlcanceToken = declarado === 'documento' && !documentoId ? ALCANCE_DEFECTO : declarado

  return {
    clinicId: payload.c,
    patientId: payload.p,
    alcance,
    version: Number(payload.v ?? 0),
    documentoId: alcance === 'documento' ? documentoId : null,
    cuidadorId: payload.u ? String(payload.u) : null,
  }
}

/**
 * URL absoluta del portal para enviar por WhatsApp.
 * Alcance `agenda` por defecto: este enlace lo genera cualquier miembro del equipo.
 */
export function linkPortalPaciente(
  baseUrl: string,
  clinicId: string,
  patientId: string,
  ttlDias = DIAS_DEFECTO,
  alcance: AlcanceToken = ALCANCE_DEFECTO,
  version = 0,
  extras: ExtrasDelToken = {},
): string {
  const token = crearTokenPaciente(clinicId, patientId, ttlDias, alcance, version, extras)
  return `${baseUrl.replace(/\/$/, '')}/mi/${token}`
}

/**
 * POR QUÉ ESTE ENLACE NO PIDE UN SEGUNDO DATO — decisión PL-P1 del dueño.
 *
 * Se planteó pedir la fecha de nacimiento o los últimos dígitos del teléfono al
 * abrirlo. Se descartó: el paciente de 70 años que recibe el enlace por WhatsApp
 * en la sala de espera es exactamente quien no pasa esa puerta, y un portal que
 * no se abre no protege nada — devuelve al paciente al teléfono del consultorio.
 *
 * Lo que sí se hizo, que es la otra mitad del mismo riesgo: acotar CUÁNTO abre
 * cada enlace (`documento`), dejar que el paciente lo CIERRE desde su portal, y
 * asentar cada apertura en la bitácora.
 */
export const POR_QUE_NO_HAY_SEGUNDO_FACTOR =
  'Porque el paciente que más necesita el portal es el que no pasaría un segundo ' +
  'factor, y un portal que no se abre no protege: devuelve al paciente al teléfono. ' +
  'El riesgo se acota por otro lado: enlaces que abren menos, que el paciente puede ' +
  'cerrar, y una bitácora de quién abrió qué.'

/**
 * ¿Sigue vigente este enlace, según la versión que declara el expediente?
 *
 * Se compara con `>=` y no con `===` a propósito: un enlace emitido con una
 * versión MÁS ALTA que la guardada no puede existir salvo por un error de
 * escritura, y tratarlo como inválido dejaría al paciente fuera por un fallo
 * nuestro. Lo que se busca es cortar los VIEJOS.
 */
export function tokenVigente(tokenVersion: number, versionDelPaciente: number | undefined): boolean {
  return Number(tokenVersion ?? 0) >= Number(versionDelPaciente ?? 0)
}

export const POR_QUE_SE_PUEDE_REVOCAR =
  'Porque el enlace llega por WhatsApp, da acceso a las citas del paciente ' +
  '—incluido el motivo, que es texto clínico— y permite cancelar y reagendar. ' +
  'Sin revocación, un teléfono perdido o un mensaje reenviado valía hasta ' +
  'caducar, y la única salida era esperar.'
