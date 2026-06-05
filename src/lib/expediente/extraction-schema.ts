/**
 * Esquema de extracción clínica auditable.
 *
 * Cada dato extraído por IA viene acompañado de metadatos para revisión:
 *   - value:        valor en sí (string | number | null)
 *   - confidence:   'alta' | 'media' | 'baja'
 *   - source_quote: fragmento textual de la transcripción del que sale
 *   - speaker:      'medico' | 'paciente' | 'acompanante' | 'desconocido'
 *   - needs_review: true si requiere validación humana (datos críticos, conflicto, baja confianza)
 *   - reason:       motivo del needs_review (opcional)
 *
 * Esto cumple con la trazabilidad clínica y la regla de no-alucinación:
 * todo dato puede rastrearse a su frase fuente y a la confianza del modelo.
 */
import { z } from 'zod'

export const Confianza = z.enum(['alta', 'media', 'baja'])
export type Confianza = z.infer<typeof Confianza>

export const Hablante = z.enum(['medico', 'paciente', 'acompanante', 'desconocido'])
export type Hablante = z.infer<typeof Hablante>

/** Campo escalar auditado (texto/número/null). */
export const CampoAuditado = z.object({
  value:        z.union([z.string(), z.number(), z.null()]).optional().default(null),
  confidence:   Confianza.optional().default('baja'),
  source_quote: z.string().optional().default(''),
  speaker:      Hablante.optional().default('desconocido'),
  needs_review: z.boolean().optional().default(true),
  reason:       z.string().optional().default(''),
})
export type CampoAuditado = z.infer<typeof CampoAuditado>

/** Diagnóstico auditado. */
export const DiagnosticoAuditado = z.object({
  descripcion:  z.string(),
  codigoCIE10:  z.string().optional().default(''),
  tipo:         z.enum(['presuntivo', 'definitivo', 'diferencial', 'descartado']).optional().default('presuntivo'),
  estado:       z.enum(['activo', 'resuelto', 'cronico', 'en_seguimiento']).optional().default('activo'),
  confidence:   Confianza.optional().default('baja'),
  source_quote: z.string().optional().default(''),
  speaker:      Hablante.optional().default('desconocido'),
  needs_review: z.boolean().optional().default(true),
  reason:       z.string().optional().default(''),
})
export type DiagnosticoAuditado = z.infer<typeof DiagnosticoAuditado>

/** Medicamento auditado. */
export const MedicamentoAuditado = z.object({
  nombre:               z.string(),
  dosis:                z.string().optional().default(''),
  via:                  z.string().optional().default('oral'),
  frecuencia:           z.string().optional().default(''),
  duracion:             z.string().optional().default(''),
  indicacion:           z.string().optional().default(''),
  confidence:           Confianza.optional().default('baja'),
  source_quote:         z.string().optional().default(''),
  speaker:              Hablante.optional().default('desconocido'),
  needs_review:         z.boolean().optional().default(true),
  reason:               z.string().optional().default(''),
})
export type MedicamentoAuditado = z.infer<typeof MedicamentoAuditado>

/** Alergia auditada (dato crítico — siempre needs_review por defecto). */
export const AlergiaAuditada = z.object({
  alergeno:     z.string(),
  tipo:         z.enum(['medicamento', 'alimento', 'ambiental', 'otro']).optional().default('otro'),
  reaccion:     z.string().optional().default(''),
  severidad:    z.enum(['leve', 'moderada', 'grave', 'anafilaxia']).optional().default('moderada'),
  confirmada:   z.boolean().optional().default(false),
  confidence:   Confianza.optional().default('baja'),
  source_quote: z.string().optional().default(''),
  speaker:      Hablante.optional().default('desconocido'),
  needs_review: z.boolean().optional().default(true),
  reason:       z.string().optional().default(''),
})
export type AlergiaAuditada = z.infer<typeof AlergiaAuditada>

/** Bloque de seguridad/trazabilidad global. */
export const SafetyBlock = z.object({
  fields_auto_filled:       z.array(z.string()).optional().default([]),
  fields_requiring_review:  z.array(z.string()).optional().default([]),
  conflicts_detected:       z.array(z.string()).optional().default([]),
  missing_critical_fields:  z.array(z.string()).optional().default([]),
})
export type SafetyBlock = z.infer<typeof SafetyBlock>

/** Respuesta completa de la extracción IA. */
export const RespuestaExtraccion = z.object({
  // Campos planos (compatibilidad con el flujo anterior — la UI sigue funcionando)
  resumenEjecutivo: z.string().optional().default(''),
  secciones:        z.record(z.string(), z.string()).optional().default({}),
  diagnosticos:     z.array(z.object({
    descripcion:  z.string(),
    codigoCIE10:  z.string().optional().default(''),
    tipo:         z.string().optional().default('presuntivo'),
    estado:       z.string().optional().default('activo'),
  })).optional().default([]),
  medicamentos: z.array(z.object({
    nombre:      z.string(),
    dosis:       z.string().optional().default(''),
    via:         z.string().optional().default('oral'),
    frecuencia:  z.string().optional().default(''),
    duracion:    z.string().optional().default(''),
    indicacion:  z.string().optional().default(''),
  })).optional().default([]),
  alergias: z.array(z.object({
    alergeno:   z.string(),
    tipo:       z.string().optional().default('medicamento'),
    reaccion:   z.string().optional().default(''),
    severidad:  z.string().optional().default('moderada'),
    confirmada: z.boolean().optional().default(false),
  })).optional().default([]),
  signosVitales: z.object({
    fc: z.union([z.number(), z.null()]).optional(),
    fr: z.union([z.number(), z.null()]).optional(),
    ta: z.string().optional(),
    temperatura: z.union([z.number(), z.null()]).optional(),
    spo2: z.union([z.number(), z.null()]).optional(),
    peso: z.union([z.number(), z.null()]).optional(),
    talla: z.union([z.number(), z.null()]).optional(),
  }).optional(),

  // Bloque auditable (nuevo)
  extraction: z.object({
    resumenEjecutivo: CampoAuditado.optional(),
    secciones:        z.record(z.string(), CampoAuditado).optional(),
    diagnosticos:     z.array(DiagnosticoAuditado).optional(),
    medicamentos:     z.array(MedicamentoAuditado).optional(),
    alergias:         z.array(AlergiaAuditada).optional(),
    signosVitales:    z.record(z.string(), CampoAuditado).optional(),
  }).optional(),

  /**
   * Factores de riesgo preoperatorios extraídos de la transcripción.
   * Solo presente cuando tipo === 'valoracion_preoperatoria'. Se mapea
   * directo a los inputs del componente PreopAssessment para pre-llenar
   * las escalas (RCRI, Caprini, ARISCAT, etc.) — el médico solo ajusta.
   * Esquema permisivo (record) porque los campos crecen con el tiempo.
   */
  preopInputs: z.record(z.string(), z.unknown()).optional(),

  safety: SafetyBlock.optional(),
})
export type RespuestaExtraccion = z.infer<typeof RespuestaExtraccion>
