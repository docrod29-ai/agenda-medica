/**
 * Chequeo de superadmin SEGURO PARA EL CLIENTE (no importa firebase-admin).
 * Solo decide si MOSTRAR el enlace a /superadmin — la seguridad REAL la hace el
 * servidor en /api/superadmin/* (verificarSuperadmin). Aquí es puramente cosmético.
 *
 * La lista sale de NEXT_PUBLIC_SUPERADMIN_EMAILS (coma) o cae al dueño conocido.
 */
const DEFAULT_OWNER = 'docrod29@gmail.com'

export function esSuperadminCliente(email?: string | null): boolean {
  if (!email) return false
  const raw = process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS ?? DEFAULT_OWNER
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase())
}
