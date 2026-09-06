/**
 * EL ÍNDICE DE CANALES NO SE NOMBRA CON LA LLAVE (Panel de Lujo S-004).
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `whatsapp_channels/{apiKey}` usaba la api_key VIVA de 360dialog como NOMBRE
 * del documento. El gestor de secretos (`secreto-canal.ts`) existe porque «el
 * token nunca debe viajar en claro fuera del gestor de secretos» — y el nombre
 * de un recurso viaja a todas partes: a los registros de acceso a datos de la
 * plataforma, a cualquier exportación, a la consola. La llave estaba guardada
 * en `secretos` y, a la vez, impresa en la ruta de otro documento.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * El índice se sigue consultando en O(1), pero por la HUELLA SHA-256 de la
 * llave. Dentro del documento sólo van el `clinicId` y los últimos cuatro
 * caracteres, para poder diagnosticar «¿cuál llave es?» sin tenerla. La
 * migración es perezosa, como la del gestor de secretos: si no está el
 * documento por huella, se busca por el id heredado, se reescribe y se borra
 * el viejo. Ver `findClinicByDialog360ApiKey` en `whatsapp-send.ts`.
 *
 * Módulo PURO: sin Firestore. Sólo derivaciones.
 */
import { createHash } from 'node:crypto'

/** Prefijo que distingue un id-huella de un id heredado o de un `phoneNumberId` de Meta. */
export const PREFIJO_HUELLA = 'k_'

/** Id del documento del índice para una api_key: `k_` + SHA-256 hex. Determinista. */
export function idDeIndiceDeCanal(apiKey: string): string {
  const limpia = String(apiKey ?? '').trim()
  if (!limpia) throw new Error('api_key vacía: no hay nada que indexar')
  return PREFIJO_HUELLA + createHash('sha256').update(limpia, 'utf8').digest('hex')
}

/** Los últimos cuatro caracteres, para diagnosticar sin exponer la llave. */
export function pistaDeLlave(apiKey: string): string {
  const limpia = String(apiKey ?? '').trim()
  return limpia.length <= 4 ? '****' : `…${limpia.slice(-4)}`
}

/** ¿Este id de documento es una huella (y no una llave en claro)? */
export function esIdDeHuella(id: string): boolean {
  return /^k_[0-9a-f]{64}$/.test(String(id ?? ''))
}

/** ¿Este id de documento CONTIENE la llave? (lo que S-004 prohíbe). */
export function elIdContieneLaLlave(id: string, apiKey: string): boolean {
  const limpia = String(apiKey ?? '').trim()
  return !!limpia && String(id ?? '').includes(limpia)
}
