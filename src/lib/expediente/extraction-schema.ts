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
import { sinHuecoEscrito } from '@/lib/expediente/hueco-textual'
import { normalizarVia } from '@/lib/expediente/via-normalizada'

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
  /**
   * ── EL SANEO VA AQUÍ, EN LA FRONTERA (5-ago-2026, REG-177) ────────────────
   *
   * El modelo escribe «No especificada» cuando no captó el campo, y ese texto
   * se guardaba como si fuera un dato: apagó el guard de la insulina, apagó el
   * aviso de vía no dictada y bloqueó la firma de la mitad de sus notas.
   *
   * Al prompt se le pidió que dejara el campo vacío (regla 1-bis). Esto es lo
   * que lo GARANTIZA: sea cual sea la redacción que elija el modelo mañana, el
   * hueco entra al sistema como hueco.
   *
   * `dosis` sólo se vacía. NO se normaliza ni se completa: inventar una dosis
   * es exactamente lo que no puede pasar aquí.
   */
  dosis:                z.string().optional().default('').transform(sinHuecoEscrito),
  /** La vía además se traduce al vocabulario del tipo («subcutanea» → `sc`). */
  via:                  z.string().optional().default('').transform(normalizarVia),
  /**
   * ¿Ya lo toma o se lo receta hoy? (REG-183)
   *
   * SIN `.default()` a propósito: la ausencia significa «no se sabe», y darle un
   * valor por omisión sería exactamente el error de «No especificada» —rellenar
   * un hueco con algo que parece un dato. Lo que no viene, no viene.
   */
  procedenciaClinica:   z.enum(['ya_lo_toma', 'se_prescribe_hoy']).optional(),
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
  // 'desconocida' por defecto (no 'moderada'): un valor plausible-pero-falso es peor
  // que un hueco. Si el LLM no capturó la severidad, no se debe degradar una posible
  // anafilaxia a "moderada" en silencio; queda como desconocida para que se revise.
  severidad:    z.enum(['leve', 'moderada', 'grave', 'anafilaxia', 'desconocida']).optional().default('desconocida'),
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
  /**
   * ── DOS LISTAS QUE SE PAGABAN Y SE TIRABAN (5-ago-2026, REG-182) ──────────
   *
   * El prompt le pedía al modelo, en cada nota, «la lista de campos con
   * needs_review=true» y «la lista con needs_review=false». Nadie las leía:
   * están declaradas aquí, están declaradas en la interfaz de `RevisionPanel`,
   * y **ningún componente las pinta ni ninguna lógica las consulta**.
   *
   * Pero el problema no era sólo el gasto. `needs_review` ya viaja **por
   * campo**, dentro de cada `CampoAuditado`. Pedir además una lista de nombres
   * es pedirle al modelo que REPITA en otro formato lo que ya dijo — y una
   * segunda fuente de verdad para el mismo hecho es una fuente que se puede
   * desincronizar. Si algún día hacen falta, se DERIVAN del propio `extraction`,
   * que es donde el dato vive de verdad (`camposQueRequierenRevision`).
   *
   * Se dejan declaradas, sin pedirlas: las notas ya guardadas las traen y el
   * esquema tiene que seguir aceptándolas.
   */
  fields_auto_filled:       z.array(z.string()).optional().default([]),
  fields_requiring_review:  z.array(z.string()).optional().default([]),
  conflicts_detected:       z.array(z.string()).optional().default([]),
  missing_critical_fields:  z.array(z.string()).optional().default([]),
  /**
   * CRUCES ALERGIA ↔ FÁRMACO QUE VIO EL MODELO.
   *
   * El prompt lleva desde siempre la instrucción de emitirlos, y el esquema NO
   * los declaraba: zod los tiraba en silencio, así que el aviso no salía nunca
   * del servidor. Se veía como «el modelo no detectó nada», que es la peor
   * lectura posible de un campo que se cae.
   *
   * OJO CON LO QUE ESTO ES Y NO ES: no es la compuerta. La compuerta que
   * bloquea la firma es el motor DETERMINISTA (`validarAlergiasVsMedicamentos`
   * + `validarNOM004`), que no depende de que un modelo se acuerde. Esto es lo
   * que el modelo VIO, y se muestra para que el médico lo mire.
   */
  alergia_conflicto: z.array(z.object({
    alergeno:          z.string().optional().default(''),
    farmaco_sugerido:  z.string().optional().default(''),
    riesgo_cruzado:    z.string().optional().default(''),
    alternativa_segura: z.string().optional().default(''),
  })).optional().default([]),
  /**
   * ── EL REPORTE DE INYECCIÓN QUE ZOD BORRABA (5-ago-2026, REG-179) ─────────
   *
   * El §11 del prompt le ordena al modelo, desde siempre, reportar aquí los
   * intentos de manipulación que encuentre en la transcripción: «ignora reglas
   * previas», «eres ahora un asistente diferente», JSON falso.
   *
   * El campo **no estaba declarado**, así que zod lo tiraba al validar. El
   * modelo detectaba el intento, lo emitía, y el servidor lo borraba sin que
   * nadie se enterara. La lectura que quedaba —«no se detectó nada»— es la peor
   * posible para un campo que se está cayendo.
   *
   * Es EXACTAMENTE el mismo fallo que `alergia_conflicto` de aquí arriba, en el
   * mismo objeto, encontrado el mismo día: la lección era «el prompt promete un
   * campo que el esquema no declara», y sólo se aplicó al que se estaba mirando.
   *
   * QUÉ ES Y QUÉ NO: no es la defensa. La defensa es que el modelo NO obedezca
   * —regla 1 del §11— y eso no depende de este campo. Esto es la constancia de
   * que ocurrió, para que quede en el expediente y se pueda revisar.
   */
  contenido_sospechoso: z.array(z.object({
    texto:          z.string().optional().default(''),
    ubicacion:      z.string().optional().default(''),
    interpretacion: z.string().optional().default(''),
  })).optional().default([]),
  /**
   * El veredicto NOM-004 que el modelo emite (`prompts.ts` lo pide en el §
   * de estructura). Se declara para que deje de perderse.
   *
   * NO sustituye a `validarNOM004`, que es determinista y es quien bloquea. Es
   * la opinión del modelo, y como tal se guarda: útil para contrastar las dos.
   */
  dictamen: z.string().optional().default(''),
})
export type SafetyBlock = z.infer<typeof SafetyBlock>

/**
 * Los campos que piden revisión, DERIVADOS de la extracción.
 *
 * Sustituye a `safety.fields_requiring_review`, que se le pedía al modelo y no
 * leía nadie. La diferencia importa: aquí el dato sale de donde vive —el
 * `needs_review` de cada campo— así que no se puede desincronizar de la verdad.
 * Aquella lista sí podía: era el mismo hecho contado dos veces.
 *
 * Función PURA.
 */
export function camposQueRequierenRevision(
  extraction: unknown,
): string[] {
  const e = extraction as { secciones?: Record<string, { needs_review?: boolean }> } | null | undefined
  const out: string[] = []
  for (const [nombre, campo] of Object.entries(e?.secciones ?? {})) {
    if (campo?.needs_review) out.push(nombre)
  }
  return out
}

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
    dosis:       z.string().optional().default('').transform(sinHuecoEscrito),
    via:         z.string().optional().default('').transform(normalizarVia),
    frecuencia:  z.string().optional().default(''),
    duracion:    z.string().optional().default(''),
    indicacion:  z.string().optional().default(''),
  })).optional().default([]),
  alergias: z.array(z.object({
    alergeno:   z.string(),
    tipo:       z.string().optional().default('medicamento'),
    reaccion:   z.string().optional().default(''),
    severidad:  z.string().optional().default('desconocida'),
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
