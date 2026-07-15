/**
 * Modelo de CONEXIÓN de WhatsApp por tenant (Iteración 2 · META_ONBOARDING).
 *
 * Contrato tipado que pide el programa: cada consultorio conecta SUS activos
 * (WABA, número) y NexusMED opera la integración con permiso revocable. Este
 * módulo es PURO (sin red/DB): tipos + máquina de estados + reglas. La UI de
 * Embedded Signup y las llamadas a Meta/360dialog viven en las rutas API.
 */

export type ProveedorWA = 'meta_cloud_api' | 'official_solution_partner'

export type EstadoConexion =
  | 'pending'                // iniciada, aún sin verificar
  | 'connected'              // operativa
  | 'verification_required'  // Meta pide verificar el negocio/número
  | 'restricted'             // limitada por calidad/política
  | 'disconnected'           // desconectada por el tenant o el sistema

export interface WhatsAppTenantConnection {
  id: string
  tenantId: string
  provider: ProveedorWA
  businessPortfolioId?: string
  whatsappBusinessAccountId?: string
  phoneNumberId?: string
  displayPhoneNumber?: string
  businessName?: string
  status: EstadoConexion
  /** Referencia al secreto (NUNCA el token en claro). */
  tokenReference?: string
  /** Calidad del número reportada por Meta (verde/amarillo/rojo). */
  calidad?: 'green' | 'yellow' | 'red' | 'unknown'
  connectedAt?: string
  disconnectedAt?: string
}

export const ESTADO_LABEL: Record<EstadoConexion, string> = {
  pending: 'Conectando…',
  connected: 'Conectado',
  verification_required: 'Requiere verificación',
  restricted: 'Restringido',
  disconnected: 'Desconectado',
}

/** SOLO una conexión 'connected' puede enviar/recibir. Regla dura del programa. */
export function puedeOperar(c: Pick<WhatsAppTenantConnection, 'status'> | null | undefined): boolean {
  return c?.status === 'connected'
}

/** Transiciones de estado permitidas (evita saltos inválidos). */
const TRANSICIONES: Record<EstadoConexion, EstadoConexion[]> = {
  pending: ['connected', 'verification_required', 'disconnected'],
  connected: ['restricted', 'verification_required', 'disconnected'],
  verification_required: ['connected', 'disconnected'],
  restricted: ['connected', 'disconnected'],
  disconnected: ['pending', 'connected'], // reconectar
}

export function transicionValida(de: EstadoConexion, a: EstadoConexion): boolean {
  if (de === a) return true
  return TRANSICIONES[de]?.includes(a) ?? false
}

/** El token nunca debe viajar en claro fuera del gestor de secretos. */
export function conexionSinSecreto(c: WhatsAppTenantConnection): Omit<WhatsAppTenantConnection, 'tokenReference'> {
  const { tokenReference: _omit, ...resto } = c
  void _omit
  return resto
}
