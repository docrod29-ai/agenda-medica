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
  // === Eventos clínicos (ya existentes) ===
  | 'ia_procesamiento'           // se llamó al endpoint de IA
  | 'ia_campo_aprobado'          // médico aprobó un campo individual
  | 'ia_campo_rechazado'         // médico rechazó un campo
  | 'nota_borrador_guardado'     // guardó borrador
  | 'nota_firmada'               // firmó (queda inmutable)
  | 'nota_adenda'                // agregó una adenda a una nota firmada (NOM-004)
  | 'nota_borrada'               // borró un borrador
  | 'consentimiento_grabacion'   // confirmó el consentimiento del paciente
  // === NUEVOS para cumplimiento NOM-024 Art. 6.5 (bitácora completa) ===
  | 'expediente_lectura'         // alguien abrió un expediente
  | 'nota_lectura'               // alguien abrió una nota específica
  | 'nota_impresion'             // alguien imprimió/descargó PDF de nota
  | 'receta_generada'            // se generó una receta
  | 'receta_descargada'          // se descargó PDF de receta
  | 'orden_generada'             // se generó una orden médica
  | 'paciente_creado'            // se creó un nuevo paciente
  | 'paciente_modificado'        // se modificaron datos del paciente
  | 'paciente_borrado'           // se borró un paciente
  | 'aviso_privacidad_aceptado'  // paciente aceptó aviso LFPDPPP
  | 'arco_solicitud_recibida'    // paciente solicitó ARCO
  | 'arco_solicitud_resuelta'    // médico resolvió solicitud ARCO
  | 'login_exitoso'              // usuario inició sesión
  | 'login_fallido'              // intento de login fallido
  | 'export_datos'               // se exportaron datos del paciente
  // === Hospitalización (trazabilidad NOM-004) ===
  | 'hosp_ingreso'               // ingreso hospitalario
  | 'hosp_egreso'                // egreso hospitalario
  | 'hosp_administracion'        // administración de medicamento (MAR)
  | 'hosp_traslado'              // traslado de cama/servicio o cambio de tratante
  | 'hosp_lab_resultado'         // se cargó resultado de laboratorio

export interface AuditPayload {
  evento: AuditEvento
  clinicId: string
  patientId?: string
  notaId?: string
  medicoUid?: string
  medicoEmail?: string
  /** IP/dispositivo si se puede capturar (best effort) */
  contexto?: { userAgent?: string; locale?: string }
  meta?: Record<string, unknown>  // datos no sensibles (counts, ids, etc.)
}

export async function logAudit(p: AuditPayload): Promise<void> {
  try {
    // Capturar contexto del cliente si está disponible (best effort, no rompe si falla)
    const contexto = typeof window !== 'undefined'
      ? { userAgent: navigator.userAgent.slice(0, 200), locale: navigator.language }
      : undefined
    await addDoc(collection(db, 'clinics', p.clinicId, 'audit_log'), {
      ...p,
      contexto: p.contexto ?? contexto,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // silencioso: nunca debe romper la operación clínica
  }
}
