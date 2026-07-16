/**
 * Ofuscación SÍNCRONA de datos clínicos en localStorage (P0 de seguridad: PHI en
 * texto plano en el cliente).
 *
 * Por qué ofuscación y no cifrado fuerte: el respaldo del borrador de consulta se
 * escribe/lee en el flush ANTI-PÉRDIDA que DEBE ser síncrono (al desmontar /
 * beforeunload). El cifrado Web Crypto es asíncrono → reintroduciría el bug de
 * "la nota se perdía al salir rápido". Esta capa es SÍNCRONA: elimina el PHI en
 * texto plano de una inspección casual de localStorage (el hallazgo del auditor),
 * con clave derivada del uid. NO sustituye el cifrado de disco del dispositivo ni
 * la política de no-almacenar; complementa la purga al cerrar sesión que ya existe.
 *
 * Puro y determinista → testeable.
 */

const MARCA = 'NXO1:'

/** FNV-1a 32-bit — semilla determinista a partir del secreto. */
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/** Keystream xorshift determinista de n bytes. */
function keystream(seed: number, n: number): Uint8Array {
  let x = seed || 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0
    out[i] = x & 0xff
  }
  return out
}

/** Ofusca un texto con el secreto (uid). Devuelve una cadena marcada + base64. */
export function ofuscar(texto: string, secreto: string): string {
  const bytes = new TextEncoder().encode(texto)
  const ks = keystream(hash32(secreto || 'nx'), bytes.length)
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i]
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return MARCA + btoa(bin)
}

/**
 * Revierte la ofuscación. Devuelve null si el dato NO está ofuscado (p. ej. un
 * borrador viejo en texto plano) → el llamador cae a leerlo tal cual (retrocompat).
 */
export function desofuscar(dato: string, secreto: string): string | null {
  if (typeof dato !== 'string' || !dato.startsWith(MARCA)) return null
  try {
    const bin = atob(dato.slice(MARCA.length))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const ks = keystream(hash32(secreto || 'nx'), bytes.length)
    for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i]
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** ¿La cadena está ofuscada por esta capa? */
export function estaOfuscado(dato: string): boolean {
  return typeof dato === 'string' && dato.startsWith(MARCA)
}
