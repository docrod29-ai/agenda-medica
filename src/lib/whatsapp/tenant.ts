/**
 * Resolución de TENANT desde el activo oficial (Iteración 4 · TENANT_CONNECTIONS).
 *
 * Regla dura del programa: el tenant se resuelve SIEMPRE del activo (phoneNumberId
 * / apiKey), NUNCA de parámetros del cliente. Un identificador desconocido en un
 * sistema multi-tenant devuelve null (no cae a ninguna clínica → cero acceso
 * cruzado). El único caso de "catch-all" permitido es una instalación de UNA sola
 * clínica (todo el tráfico es de ella), y solo si el número del entorno no
 * contradice al entrante.
 *
 * Función PURA (sin red/DB): la decisión del fallback, testeable en aislamiento.
 * `findClinicByPhoneNumberId` la usa tras fallar el índice y el escaneo por activo.
 */

export interface FallbackInput {
  /** Nº de clínicas activas/trial en el sistema. */
  numClinicas: number
  /** phoneNumberId entrante en el webhook. */
  phoneNumberId: string
  /** WHATSAPP_PHONE_NUMBER_ID del entorno (instalación single-tenant), si existe. */
  envPhoneId?: string
}

/**
 * ¿Se permite resolver a la ÚNICA clínica como catch-all? Solo si:
 *  - hay exactamente 1 clínica (todo el tráfico es de ella), y
 *  - el número del entorno NO contradice al entrante (o no está configurado).
 * En multi-tenant (numClinicas !== 1) SIEMPRE es false → identificador desconocido
 * = sin tenant = sin acceso cruzado.
 */
export function permiteFallbackUnicoTenant(input: FallbackInput): boolean {
  if (input.numClinicas !== 1) return false
  if (input.envPhoneId && input.envPhoneId !== input.phoneNumberId) return false
  return true
}
