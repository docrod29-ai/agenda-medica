/**
 * CONTRATOS DE DATOS — ICU Hands-Free Note Engine (iteración nexusmed-icu-002).
 *
 * Este archivo SOLO define tipos y el mapeo de estados. NO calcula nada, NO
 * llama a la IA, NO toca la base de datos. Los motores deterministas
 * (ventilación, gasometría, hemodinamia, POCUS, escalas) llegan en iteraciones
 * posteriores (006+). Es cliente-seguro (sin imports pesados).
 *
 * PRINCIPIO: la voz aporta datos · el código calcula · el motor verifica ·
 * la IA organiza · el médico decide y firma. Cada observación conserva SIEMPRE
 * el texto crudo, el valor normalizado, la unidad, la fuente, la hora, la
 * confianza y si el médico la confirmó — nunca se pierde el original.
 */

/**
 * Estado de verdad clínica de una observación. Se distingue explícitamente lo
 * confirmado de lo negado y de lo desconocido: un campo vacío NO es "normal".
 */
export type ClinicalTruthStatus =
  | 'confirmed'    // afirmado por el médico / la fuente
  | 'negated'      // explícitamente ausente ("sin focalización")
  | 'unknown'      // no se interrogó / no se dispone
  | 'historical'   // antecedente, no del día
  | 'suspected'    // sospecha, no confirmado
  | 'inferred'     // derivado por el sistema (marcado como tal)
  | 'conflicting'  // dos fuentes se contradicen → requiere resolución humana

/** Los ocho aparatos y sistemas de la nota de UCI (más ultrasonido). */
export const ICU_SYSTEMS = [
  'neurologic',
  'respiratory',
  'hemodynamic',
  'renal_metabolic',
  'gastrointestinal',
  'hematologic_infectious',
  'skin_devices',
  'ultrasound',
] as const
export type ICUSystem = (typeof ICU_SYSTEMS)[number]

/** De dónde viene el dato. La voz y lo manual los aporta el médico; el resto es objetivo. */
export type ICUSource =
  | 'voice'
  | 'manual'
  | 'monitor'
  | 'ventilator'
  | 'laboratory'
  | 'ultrasound'
  | 'import'

/** Rango en el audio original al que corresponde la observación (para trazabilidad). */
export interface TranscriptRange {
  startMs: number
  endMs: number
}

/**
 * Observación clínica estructurada de UCI. Conserva el crudo Y el normalizado.
 * `value` es lo que se capturó; `normalizedValue`/`normalizedUnit` es lo que el
 * motor usará para calcular (nunca se calcula sobre un valor sin normalizar).
 */
export interface ICUObservation {
  id: string
  patientId: string
  encounterId: string          // internamientoId (episodio de UCI)
  system: ICUSystem

  conceptCode?: string         // código estándar opcional (LOINC/SNOMED)
  display: string              // etiqueta legible ("PEEP", "Lactato")
  value?: number | string | boolean
  unit?: string
  normalizedValue?: number | string | boolean
  normalizedUnit?: string

  status: ClinicalTruthStatus
  effectiveAt: string          // ISO — hora clínica del dato (no la de captura)
  source: ICUSource
  sourceTranscriptRange?: TranscriptRange

  confidence: number           // 0..1
  confirmedByPhysician: boolean
}

/**
 * Estados de certeza que ya usa el extractor/NER actual (medical-ner.ts:
 * `Certeza = ['confirmado','sospecha','descartado','historia']`). Se declara
 * aquí como unión de literales para NO acoplar este archivo al esquema Zod.
 */
export type CertezaNER = 'confirmado' | 'sospecha' | 'descartado' | 'historia'

/**
 * Mapea la certeza del extractor actual → el estado de verdad clínica de UCI.
 * `unknown` no tiene origen en el extractor (surge de un campo no interrogado),
 * por eso no aparece aquí. `inferred`/`conflicting` los produce el motor, no la IA.
 */
export function certezaAStatus(certeza: CertezaNER | undefined | null): ClinicalTruthStatus {
  switch (certeza) {
    case 'confirmado': return 'confirmed'
    case 'descartado': return 'negated'
    case 'sospecha':   return 'suspected'
    case 'historia':   return 'historical'
    default:           return 'unknown'
  }
}

/** ¿La observación es apta para alimentar un cálculo determinista? */
export function esUsableParaCalculo(o: Pick<ICUObservation, 'status' | 'normalizedValue'>): boolean {
  // Solo lo confirmado (o inferido con marca) y con valor normalizado alimenta un motor.
  if (o.normalizedValue === undefined || o.normalizedValue === null) return false
  return o.status === 'confirmed' || o.status === 'inferred'
}
