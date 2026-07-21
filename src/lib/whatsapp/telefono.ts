/**
 * Normalización PURA de teléfono para WhatsApp — sin dependencias de servidor,
 * así que se puede importar tanto desde el cliente como desde el servidor.
 *
 * Vive aparte de `consent.ts` (que importa firebase-admin y NO es client-safe)
 * para que componentes del cliente puedan usar la misma clave canónica. `consent.ts`
 * la re-exporta para no romper los imports existentes.
 */

/**
 * Forma CANÓNICA de un teléfono mexicano para WhatsApp: `52` + 10 dígitos.
 *
 * WhatsApp entrega el remitente de un móvil como `52 1 XXXXXXXXXX` (13 dígitos, con
 * el "1" de móvil); recepción suele capturar 10 dígitos. Sin normalizar eran DOS
 * claves para el mismo número (la baja se guardaba bajo `521…` y el recordatorio la
 * buscaba bajo `52…` → se enviaba igual). Esto unifica la clave.
 */
export function normalizarTelefonoWa(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (!d.startsWith('52')) d = `52${d}`
  // 52 + 1 + 10 dígitos (móvil como lo manda WhatsApp) → 52 + 10 dígitos.
  if (d.length === 13 && d[2] === '1') d = `52${d.slice(3)}`
  return d
}
