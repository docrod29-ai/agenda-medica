/**
 * CAPACIDAD firmada para el proxy del formato de receta (/api/receta/diseno) —
 * R-06 / issue #350 (evolución de NEXUS-QUALITY-010).
 *
 * QUÉ FALLABA (y por qué no bastaba la versión anterior): el proxy descarga con
 * Admin SDK —que ignora las reglas de Storage— y la firma anterior ligaba
 * `path|exp`. Es decir: la firma demostraba «alguien de esta instalación acuñó
 * este path», NUNCA «quién» ni «de qué consultorio». Y mientras
 * RECETA_DISENO_FIRMA no estuviera en 'obligatoria', un `?path=` PELADO pasaba
 * sin firma alguna. **Un path no es una autorización.** Una URL filtrada (PDF
 * compartido, historial del navegador, caché, WhatsApp) se convertía en lectura
 * del membrete, la firma y el sello de un médico ajeno.
 *
 * QUÉ HACE AHORA: la capacidad es VERSIONADA y va LIGADA a la identidad
 * canónica del que la acuñó:
 *
 *     HMAC-SHA256( JSON[ version, path, ownerUid, clinicId, exp ] )
 *
 * Tocar CUALQUIER campo —el path, el dueño, el consultorio, la caducidad o la
 * propia firma— rompe el HMAC y falla CERRADO. La comparación es de tiempo
 * constante (`timingSafeEqual`) sobre buffers de igual longitud.
 *
 * ORDEN DEL CANDADO (invertido respecto a la versión anterior, a propósito):
 *   · sin secreto configurado → NO se acuña y NO se verifica nada: 'sin_secreto'.
 *     Antes, «sin secreto y sin firma» era un pase libre silencioso.
 *   · sin capacidad en la URL → 'sin_capacidad', y el proxy sólo lo tolera bajo
 *     la compatibilidad EXPLÍCITA y ACOTADA (`RECETA_DISENO_COMPAT_SIN_FIRMA=1`),
 *     que además está muerta en cualquier entorno equivalente a producción.
 *   · versión desconocida → 'version_desconocida' (nunca se degrada a la vieja).
 *
 * DUEÑO DEL PATH: el espacio legado es `receta-diseno/{uid}/…`. El uid del path
 * tiene que ser EXACTAMENTE el `ownerUid` ligado en la capacidad. Para cualquier
 * otra forma de ruta NO se adivina dueño: `duenoDePath` devuelve null y tanto el
 * acuñado como la verificación fallan cerrado.
 *
 * POR QUÉ SIGUE SIENDO UNA URL Y NO UN `Authorization`: una `<img src>` no manda
 * cabeceras. La defensa no es debilitar la descarga, es que la aplicación
 * AUTENTICADA acuñe primero una URL con alcance y caducidad corta
 * (POST /api/receta/diseno-url) y la imagen presente sólo esa capacidad.
 *
 * Secreto: RECETA_DISENO_SECRET, con respaldo a PORTAL_PACIENTE_SECRET (ya
 * existe en Vercel) para no exigir configuración nueva.
 */
import { createHmac, timingSafeEqual } from 'crypto'

/** Versión del formato de capacidad. Va DENTRO del HMAC, no sólo en la URL. */
export const CAPACIDAD_DISENO_VERSION = 'v2'

/**
 * Vida de una capacidad: 15 min. Antes eran 24 h, que para una URL que acaba en
 * el historial del navegador y en el PDF compartido es una eternidad. Se puede
 * bajar tanto porque el circuito RE-ACUÑA bajo demanda: la vista previa
 * (FirmadorDisenos), la impresión y el PDF piden capacidad fresca justo antes de
 * usar la imagen.
 */
export const DISENO_TOKEN_TTL_S = 15 * 60

const secreto = (): string =>
  process.env.RECETA_DISENO_SECRET || process.env.PORTAL_PACIENTE_SECRET || ''

/** Única carpeta del bucket que este proxy puede servir. */
export const PATH_DISENO_OK = /^receta-diseno\/[^./][^:]*$/

/**
 * Dueño de un path del espacio legado `receta-diseno/{uid}/…`, o null.
 *
 * null significa «no se sabe de quién es», y quien llama DEBE fallar cerrado.
 * Adivinar dueño para una forma de ruta nueva u opaca es exactamente el error
 * que esta unidad vino a cerrar.
 */
export function duenoDePath(path: string): string | null {
  if (!path || !PATH_DISENO_OK.test(path) || path.includes('..')) return null
  const seg = path.split('/')
  if (seg.length < 3) return null              // hace falta uid Y archivo
  const dueno = seg[1]
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(dueno)) return null
  if (seg.slice(2).some(s => s.length === 0)) return null
  return dueno
}

export interface CapacidadDiseno {
  v: string
  path: string
  ownerUid: string
  clinicId: string
  exp: number
  sig: string
}

/**
 * Mensaje firmado. Va en JSON y no concatenado con `|` porque el path admite
 * caracteres arbitrarios: con separadores planos, dos tuplas distintas podrían
 * producir la misma cadena. JSON delimita cada campo sin ambigüedad.
 */
const mensaje = (v: string, path: string, ownerUid: string, clinicId: string, exp: number): string =>
  JSON.stringify([v, path, ownerUid, clinicId, exp])

const hmac = (m: string, sec: string): string => createHmac('sha256', sec).update(m).digest('hex')

/**
 * Acuña una capacidad ligada a (path, dueño, consultorio, caducidad).
 * Devuelve null si falta el secreto o alguno de los tres identificadores: sin
 * ligadura completa no hay capacidad, y quien llama debe fallar cerrado.
 *
 * NO comprueba que `ownerUid` sea el dueño del path a propósito: esa regla la
 * aplican el acuñador (contra la identidad autenticada) y el verificador (contra
 * el path que llega). Dejarla fuera de aquí permite probar que el verificador la
 * aplica de verdad, y no que se apoya en que nadie firme algo incoherente.
 */
export function acunarCapacidadDiseno(args: {
  path: string
  ownerUid: string
  clinicId: string
  ahoraMs: number
  ttlS?: number
}): CapacidadDiseno | null {
  const sec = secreto()
  const { path, ownerUid, clinicId, ahoraMs } = args
  if (!sec || !path || !ownerUid || !clinicId) return null
  const v = CAPACIDAD_DISENO_VERSION
  const exp = Math.floor(ahoraMs / 1000) + (args.ttlS ?? DISENO_TOKEN_TTL_S)
  return { v, path, ownerUid, clinicId, exp, sig: hmac(mensaje(v, path, ownerUid, clinicId, exp), sec) }
}

/**
 * URL same-origin del proxy con la capacidad. `path` va primero para que el
 * detector del cliente (`/api/receta/diseno?path=`) siga reconociéndola.
 */
export function urlDeCapacidad(cap: CapacidadDiseno): string {
  const q = new URLSearchParams({
    path: cap.path, v: cap.v, own: cap.ownerUid, cid: cap.clinicId, exp: String(cap.exp), sig: cap.sig,
  })
  return `/api/receta/diseno?${q.toString()}`
}

export type VerificacionDiseno =
  | 'valida'
  | 'invalida'
  | 'vencida'
  | 'sin_capacidad'
  | 'sin_secreto'
  | 'version_desconocida'
  | 'dueno_no_coincide'

export interface ParametrosCapacidad {
  v: string | null
  own: string | null
  cid: string | null
  exp: string | null
  sig: string | null
}

/**
 * Verifica la capacidad contra el path pedido. NUNCA lanza.
 *
 * Sólo 'valida' autoriza. Todo lo demás es un 403 en el proxy salvo
 * 'sin_capacidad', que el proxy decide con la compatibilidad acotada.
 */
export function verificarCapacidadDiseno(
  path: string,
  p: ParametrosCapacidad,
  ahoraMs: number,
): VerificacionDiseno {
  if (!p.v && !p.own && !p.cid && !p.exp && !p.sig) return 'sin_capacidad'
  const sec = secreto()
  // Sin secreto nadie pudo acuñar nada legítimo: la presencia de una capacidad
  // es de por sí sospechosa y el gate no puede quedar abierto por una variable
  // de entorno que falta en producción.
  if (!sec) return 'sin_secreto'
  if (p.v !== CAPACIDAD_DISENO_VERSION) return 'version_desconocida'
  if (!p.own || !p.cid || !p.sig || !p.exp) return 'invalida'
  const exp = Number(p.exp)
  if (!Number.isSafeInteger(exp) || exp <= 0) return 'invalida'
  if (exp * 1000 < ahoraMs) return 'vencida'

  let iguales = false
  try {
    const a = Buffer.from(hmac(mensaje(p.v, path, p.own, p.cid, exp), sec), 'hex')
    const b = Buffer.from(p.sig, 'hex')
    if (a.length !== b.length || a.length === 0) return 'invalida'
    iguales = timingSafeEqual(a, b)
  } catch {
    return 'invalida'
  }
  if (!iguales) return 'invalida'

  /**
   * Defensa en profundidad. La firma ya liga el path al dueño, así que llegar
   * aquí con un dueño distinto exigiría un fallo del acuñador. Se comprueba
   * igual: si mañana una ruta nueva acuña mal, el proxy —que es quien toca el
   * Admin SDK— sigue negándose.
   */
  if (duenoDePath(path) !== p.own) return 'dueno_no_coincide'
  return 'valida'
}

/**
 * ¿Estamos en un entorno equivalente a producción? Ahí la compatibilidad sin
 * capacidad NO existe, se configure lo que se configure.
 */
export const esProduccionEquivalente = (): boolean =>
  process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV

/**
 * Compatibilidad EXPLÍCITA y ACOTADA con las URLs sin capacidad que quedaron
 * guardadas en la configuración de los médicos.
 *
 * · hay que pedirla a mano (`RECETA_DISENO_COMPAT_SIN_FIRMA=1`);
 * · muere en cualquier entorno equivalente a producción;
 * · no se hereda del silencio: por defecto está APAGADA.
 */
export const compatibilidadSinCapacidad = (): boolean =>
  process.env.RECETA_DISENO_COMPAT_SIN_FIRMA === '1' && !esProduccionEquivalente()
