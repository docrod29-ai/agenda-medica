import { APPOINTMENT_TYPE_CONFIG } from '@/types'
import type { AppointmentType } from '@/types'

/**
 * Icono lineal (lucide) del tipo de cita. Reemplaza los emojis que antes
 * vivían en APPOINTMENT_TYPE_CONFIG. Devuelve null si el tipo no existe.
 */
export function TipoCitaIcon({ tipo, size = 14 }: { tipo?: AppointmentType; size?: number }) {
  if (!tipo) return null
  const Icon = APPOINTMENT_TYPE_CONFIG[tipo]?.Icon
  return Icon ? <Icon size={size} className="ds-icon" style={{ verticalAlign: '-0.125em' }} /> : null
}
