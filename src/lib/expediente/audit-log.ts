/**
 * Log de auditoría clínica.
 *
 * Registra eventos importantes (procesamiento de IA, aprobación de campos,
 * firma de nota, borrado de borrador) en `clinics/{clinicId}/audit_log`.
 * Útil para trazabilidad NOM-024 y para medir tasa de aprobación / edición.
 *
 * Es resiliente: si falla la escritura del log NUNCA debe romper la operación
 * principal (la persistencia clínica tiene prioridad).
 */
import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type AuditEvento =
  | 'ia_procesamiento'        // se llamó al endpoint de IA
  | 'ia_campo_aprobado'       // médico aprobó un campo individual
  | 'ia_campo_rechazado'      // médico rechazó un campo
  | 'nota_borrador_guardado'  // guardó borrador
  | 'nota_firmada'            // firmó (queda inmutable)
  | 'nota_borrada'            // borró un borrador
  | 'consentimiento_grabacion'// confirmó el consentimiento del paciente

export interface AuditPayload {
  evento: AuditEvento
  clinicId: string
  patientId?: string
  notaId?: string
  medicoUid?: string
  medicoEmail?: string
  meta?: Record<string, unknown>  // datos no sensibles (counts, ids, etc.)
}

export async function logAudit(p: AuditPayload): Promise<void> {
  try {
    await addDoc(collection(db, 'clinics', p.clinicId, 'audit_log'), {
      ...p,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // silencioso: nunca debe romper la operación clínica
  }
}
