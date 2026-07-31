/**
 * Log de auditoría clínica.
 *
 * Registra eventos importantes (procesamiento de IA, aprobación de campos,
 * firma de nota, borrado de borrador) en `clinics/{clinicId}/audit_log`.
 * Útil para trazabilidad NOM-024 y para medir tasa de aprobación / edición.
 *
 * Es resiliente: si falla la escritura del log NUNCA debe romper la operación
 * principal (la persistencia clínica tiene prioridad).
 *
 * SE ESCRIBE POR SERVIDOR, no directo a Firestore. Antes esto hacía `addDoc`
 * desde el navegador con `new Date()` del navegador, y la regla lo permitía con
 * `create: if isMember` sin validar un campo: cualquier miembro podía insertar
 * entradas con el correo y la hora que quisiera, o atribuirle un acceso a otro
 * médico. Una bitácora que el auditado puede escribir a discreción no acredita
 * nada, que es justo lo contrario de para lo que existe. Ahora la identidad sale
 * del ID-token y la hora es `serverTimestamp()`.
 */
import { fetchAutenticado } from '@/lib/auth-client'

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
  // === Bitácora completa (requisito de trazabilidad de NOM-024; el numeral
  //     exacto NO está verificado contra el DOF — no citarlo en documentos) ===
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
  | 'cobro_exento'               // se marcó una cita como cortesía (no cobrar), con motivo
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
  if (!p.clinicId) return
  try {
    await fetchAutenticado('/api/auditoria/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // medicoUid/medicoEmail NO se mandan: los pone el servidor desde el token.
      body: JSON.stringify({
        evento: p.evento,
        clinicId: p.clinicId,
        patientId: p.patientId,
        notaId: p.notaId,
        meta: p.meta,
        timestampCliente: new Date().toISOString(),
      }),
    })
  } catch {
    // silencioso: nunca debe romper la operación clínica
  }
}
