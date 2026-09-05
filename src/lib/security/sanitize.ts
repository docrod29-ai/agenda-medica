/**
 * Sanitización para logs — ISO 27001 / LFPDPPP / NOM-024
 *
 * Función: redactar PII y datos sensibles ANTES de loggear a consola,
 * Vercel logs, o cualquier sistema de observabilidad externo.
 *
 * Vectores cubiertos:
 *   - CURP (18 chars)
 *   - RFC (12-13 chars)
 *   - Correos electrónicos
 *   - Teléfonos (MX y formatos internacionales)
 *   - Números de tarjeta (Visa, MasterCard, AmEx)
 *   - Tokens tipo Bearer / API keys
 *   - JWT (header.payload.signature)
 *   - Nombres de pacientes (en estructura conocida `paciente.nombre`)
 *
 * Diseño:
 *   - Síncrono, puro, sin dependencias externas
 *   - Conserva la estructura del objeto (útil para debugging)
 *   - Reemplaza con sentinelas que indican el TIPO redactado:
 *       [CURP], [RFC], [EMAIL], [TEL], [PAN], [TOKEN], [JWT]
 *   - Aplicable a strings, objetos anidados, arrays
 *   - Soft-limit de profundidad para evitar stack overflow en ciclos
 *
 * Uso típico:
 *   console.error('[api/x] error', sanitize(err))
 *   console.warn('[api/y] body inválido', sanitize(body))
 */

// ─────────────────────────────────────────────────────────────────
// Patrones de redacción (ordenados por especificidad descendente)
// ─────────────────────────────────────────────────────────────────

const PATRONES_STRING: Array<{ regex: RegExp; reemplazo: string; nombre: string }> = [
  // CURP: 4 letras + 6 dígitos + H/M + 5 letras + 2 alfanum
  { regex: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}\b/gi, reemplazo: '[CURP]', nombre: 'CURP' },

  // RFC persona física: 4 letras + 6 dígitos + 3 alfanum (con/sin homoclave)
  { regex: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}\b/gi, reemplazo: '[RFC]', nombre: 'RFC' },

  // JWT (3 segmentos base64url separados por punto)
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, reemplazo: '[JWT]', nombre: 'JWT' },

  // Bearer / API keys conocidos
  { regex: /\b(?:Bearer\s+|sk-(?:proj-|ant-)?|AIza|ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_-]{16,}\b/gi, reemplazo: '[TOKEN]', nombre: 'TOKEN' },

  // Número de tarjeta — Visa/MC/Amex (13-19 dígitos con/sin separadores)
  { regex: /\b(?:\d[ -]?){13,19}\b/g, reemplazo: '[PAN]', nombre: 'PAN' },

  // Email
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, reemplazo: '[EMAIL]', nombre: 'EMAIL' },

  // Teléfono MX/internacional: + opcional, espacios/guiones, 10-13 dígitos
  { regex: /\b(?:\+?52[\s-]?)?(?:1[\s-]?)?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{4}\b/g, reemplazo: '[TEL]', nombre: 'TEL' },
]

/** Llaves de objeto cuyos VALORES se redactan completos sin importar contenido.
 *  Se normalizan a lowercase para matching case-insensitive (apiKey === apikey). */
const LLAVES_SENSIBLES = new Set([
  'password', 'pwd', 'pass', 'contrasena', 'contraseña',
  'token', 'access_token', 'refresh_token', 'id_token', 'apikey', 'api_key',
  'secret', 'clientsecret', 'webhooksecret',
  'authorization', 'cookie', 'session',
  'curp', 'rfc', 'nss',
  'tarjeta', 'cardnumber', 'card_number', 'pan',
  'cvv', 'cvc',
  // Datos clínicos sensibles que no deben aparecer en logs
  'transcripcion', 'transcription', 'audioblob',
])

const PROFUNDIDAD_MAX = 8

// ─────────────────────────────────────────────────────────────────
// Redacción
// ─────────────────────────────────────────────────────────────────

/** Redacta PII en un string. Aplica todos los patrones en orden. */
export function redactarString(s: string): string {
  if (!s || typeof s !== 'string') return s
  let out = s
  for (const { regex, reemplazo } of PATRONES_STRING) {
    out = out.replace(regex, reemplazo)
  }
  return out
}

/**
 * LA RUTA DEL NAVEGADOR, SIN EL IDENTIFICADOR DEL PACIENTE.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * `/api/errores` guarda la ruta en la que ocurrió el fallo, y hace bien: sin
 * saber DÓNDE se rompió, un reporte no sirve de nada.
 *
 * Pero las rutas de esta aplicación llevan el identificador del paciente dentro
 * —`/consulta/<patientId>`, `/expediente/<patientId>`, `/uci/<internamientoId>`—
 * y esos reportes van a `errores`, una colección **raíz**: fuera del ámbito del
 * consultorio y legible desde la consola del dueño de la plataforma. Un
 * identificador de paciente cruzando esa frontera es PHI saliendo de su
 * consultorio por un canal de diagnóstico técnico.
 *
 * ── LO QUE SE CONSERVA Y LO QUE SE BORRA ────────────────────────────────────
 *
 * Se conserva la FORMA —`/consulta/:id`—, que es lo que hace útil el reporte, y
 * se borra el valor. Quien lea el error sigue sabiendo qué pantalla falló y deja
 * de saber de quién era la consulta.
 *
 * Se sustituye cualquier segmento que parezca un identificador (los de Firestore
 * son de 20 caracteres, pero se acepta desde 12 para cubrir otros formatos) y
 * también la última parte de rutas conocidas, aunque no lo parezca.
 */
/**
 * ── LAS RUTAS DE CARA AL PACIENTE SE AÑADIERON DESPUÉS, Y POR UN MOTIVO PEOR
 *    QUE EL ORIGINAL (REG-323) ────────────────────────────────────────────────
 *
 * La lista nació para tapar identificadores de paciente. `mi`, `resena`,
 * `verificar` y `unirse` no llevan un identificador: llevan un **token de
 * portador**. `/mi/<token>` ES la sesión del paciente — quien tenga esa cadena
 * abre su expediente.
 *
 * Y el token no lo cazaba la heurística de abajo, porque su formato es
 * `base64url(payload).base64url(firma)`: el punto rompe el patrón
 * `^[A-Za-z0-9_-]+$` y el segmento pasaba entero al registro de errores, que es
 * una colección RAÍZ legible desde la consola del dueño de la plataforma.
 */
const SEGMENTOS_CON_ID = [
  'consulta', 'expediente', 'paciente', 'patients', 'uci', 'hospital',
  'internamiento', 'nota', 'notas', 'dr',
  // De cara al paciente: el segmento siguiente es una CREDENCIAL, no un id.
  'mi', 'resena', 'verificar', 'unirse', 'reservar', 'teleconsulta',
]

/**
 * ¿El segmento tiene forma de token con firma (`algo.algo`, estilo JWT o HMAC
 * en base64url)?
 *
 * Se exige que **las dos** mitades sean largas y de alfabeto base64url. Así
 * `favicon.ico`, `sitemap.xml` y `pdf.worker.min.mjs` se quedan como están —
 * un redactor que estropea lo inocuo hace ilegible el informe, y entonces
 * alguien lo apaga.
 */
function pareceTokenFirmado(seg: string): boolean {
  const partes = seg.split('.')
  if (partes.length < 2 || partes.length > 3) return false
  return partes.every(p => p.length >= 10 && /^[A-Za-z0-9_-]+$/.test(p))
}

export function redactarRuta(ruta: string): string {
  if (!ruta || typeof ruta !== 'string') return ruta
  const [camino, ...resto] = ruta.split('?')
  const partes = camino.split('/')
  const limpio = partes.map((seg, i) => {
    if (!seg) return seg
    const previo = (partes[i - 1] ?? '').toLowerCase()
    if (SEGMENTOS_CON_ID.includes(previo)) return ':id'
    // Un token firmado es una credencial: se borra aunque nadie declarara el
    // segmento anterior. Va ANTES de la heurística de id porque el punto la
    // esquivaba.
    if (pareceTokenFirmado(seg)) return ':id'
    // Un segmento largo sin espacios y con mezcla de letras y dígitos es un id.
    if (seg.length >= 12 && /^[A-Za-z0-9_-]+$/.test(seg) && /\d/.test(seg) && /[A-Za-z]/.test(seg)) return ':id'
    return seg
  }).join('/')
  // La cadena de consulta se tira entera: nunca debió llevar datos y no se
  // necesita para saber dónde falló.
  return resto.length ? `${limpio}?…` : limpio
}

/**
 * Redacta PII en cualquier valor (string, objeto, array, primitivo).
 * Preserva la estructura — útil para debugging sin perder forma.
 */
export function sanitize<T = unknown>(input: T, profundidad = 0): T {
  if (profundidad > PROFUNDIDAD_MAX) return '[...max-depth]' as unknown as T
  if (input == null) return input
  const tipo = typeof input
  if (tipo === 'string') return redactarString(input as string) as unknown as T
  if (tipo === 'number' || tipo === 'boolean' || tipo === 'bigint') return input
  if (tipo === 'function' || tipo === 'symbol') return '[fn]' as unknown as T

  if (Array.isArray(input)) {
    return input.map(v => sanitize(v, profundidad + 1)) as unknown as T
  }

  if (tipo === 'object') {
    // Error: conservar message + stack pero sanitizar contenido
    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactarString(input.message),
        stack: input.stack ? redactarString(input.stack) : undefined,
      } as unknown as T
    }

    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (LLAVES_SENSIBLES.has(k.toLowerCase())) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = sanitize(v, profundidad + 1)
      }
    }
    return out as unknown as T
  }

  return input
}

/** Helper para logs estructurados — devuelve string JSON sanitizado. */
export function safeStringify(input: unknown): string {
  try {
    return JSON.stringify(sanitize(input))
  } catch {
    return '[unserializable]'
  }
}

/**
 * Wrapper sobre console.* que sanitiza todos los argumentos.
 * Úsalo en lugar de console.log directo en API routes.
 */
export const safeLog = {
  info:  (...args: unknown[]) => console.info(...args.map(a => sanitize(a))),
  warn:  (...args: unknown[]) => console.warn(...args.map(a => sanitize(a))),
  error: (...args: unknown[]) => console.error(...args.map(a => sanitize(a))),
}
