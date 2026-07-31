import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tokens firmados para VERIFICAR una receta dentro de NexusMED (QR).
 *
 * Formato: base64url(payload).base64url(hmacSHA256("receta:"+payload))
 * payload = { v, c, n, f, dn, dc, h, hn, i, e }
 *   v  = versión de firma. 1 = emisor tomado del body del cliente (legado).
 *        2 = emisor y folio DERIVADOS de la nota firmada en el servidor
 *        (E0-01 / REG-025). Solo afecta a la EMISIÓN: la verificación no filtra
 *        por versión, porque hay tokens v=1 vivos en la calle (TTL 2 años) y
 *        invalidarlos rompería QRs ya impresos.
 *   c  = clinicId · n = notaId · f = folio
 *   dn = nombre del médico · dc = cédula (INFO PÚBLICA del prescriptor, ya
 *        impresa en la receta — NO son datos del paciente)
 *   h  = huella (FNV-1a) del CONTENIDO prescrito (fármacos+dosis+dx). Liga la
 *        firma al contenido: un tercero no puede alterar la dosis y conservar un
 *        QR válido, porque no tiene el secreto para re-firmar la huella nueva.
 *        NO es el contenido en claro (es un hash), así que no filtra datos.
 *   hn = huella (FNV-1a) de los medicamentos de la NOTA FIRMADA, calculada en el
 *        servidor. Liga el certificado al expediente, no solo al papel. Opcional
 *        (notas sin medicamentos / tokens legados no la llevan).
 *   i  = emitido (epoch s) · e = expira (epoch s)
 *
 * NO contiene datos del PACIENTE (ni nombre, dx, medicamentos, CURP, teléfono).
 * Dominio separado del token del paciente por el prefijo "receta:".
 * SOLO servidor (node:crypto). No importar desde componentes cliente.
 */

/** 2 = emisor/folio derivados de la nota en el servidor (E0-01). Ver cabecera. */
const FIRMA_VERSION = 2
const DIAS_DEFECTO = 730 // 2 años: la autenticidad del documento debe poder verificarse tiempo después

interface PayloadReceta {
  v: number; c: string; n: string; f: string; dn: string; dc: string; h?: string; hn?: string; i: number; e: number
}

function getSecret(): string {
  const s = process.env.PORTAL_PACIENTE_SECRET
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV !== 'production') return 'dev-portal-secret-no-usar-en-produccion-0123456789'
  throw new Error('PORTAL_PACIENTE_SECRET no configurada')
}
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')
const firmar = (payloadB64: string) => createHmac('sha256', getSecret()).update('receta:' + payloadB64).digest('base64url')

export function crearTokenReceta(
  args: { clinicId: string; notaId: string; folio: string; doctorNombre: string; cedula: string; contenidoHash?: string; huellaNota?: string; ttlDias?: number },
): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: PayloadReceta = {
    v: FIRMA_VERSION, c: args.clinicId, n: args.notaId, f: args.folio,
    dn: args.doctorNombre, dc: args.cedula, i: now, e: now + (args.ttlDias ?? DIAS_DEFECTO) * 86400,
  }
  // Solo se incluyen si vienen (recetas viejas / sin medicamentos no los llevan).
  if (args.contenidoHash) payload.h = args.contenidoHash
  if (args.huellaNota) payload.hn = args.huellaNota
  const payloadB64 = b64url(JSON.stringify(payload))
  return `${payloadB64}.${firmar(payloadB64)}`
}

export interface RecetaVerificada {
  clinicId: string; notaId: string; folio: string
  doctorNombre: string; cedula: string
  /** Huella (FNV-1a) del contenido prescrito, si la receta la incluyó. */
  contenidoHash?: string
  /** Huella (FNV-1a) de los medicamentos de la nota firmada, si el token la lleva. */
  huellaNota?: string
  emitido: Date; expira: Date; firmaVersion: number
}

/** Verifica firma + caducidad. Devuelve null si es inválido/alterado/expirado. */
export function verificarTokenReceta(token: string | undefined | null): RecetaVerificada | null {
  if (!token || typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 2) return null
  const [payloadB64, firmaRecibida] = partes
  const esperada = firmar(payloadB64)
  const a = Buffer.from(firmaRecibida), b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let p: PayloadReceta
  try { p = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) } catch { return null }
  if (!p.c || !p.n || !p.f || typeof p.e !== 'number') return null
  if (Math.floor(Date.now() / 1000) > p.e) return null
  return {
    clinicId: p.c, notaId: p.n, folio: p.f, doctorNombre: p.dn || '', cedula: p.dc || '',
    contenidoHash: p.h || undefined,
    huellaNota: p.hn || undefined,
    emitido: new Date((p.i || 0) * 1000), expira: new Date(p.e * 1000), firmaVersion: p.v || 1,
  }
}

export function linkVerificacionReceta(baseUrl: string, args: { clinicId: string; notaId: string; folio: string; doctorNombre: string; cedula: string; contenidoHash?: string; huellaNota?: string }): string {
  return `${baseUrl.replace(/\/$/, '')}/verificar/${crearTokenReceta(args)}`
}
