/**
 * Medical NER — extracción de entidades clínicas estructuradas.
 *
 * Equivalente local a AWS Comprehend Medical / Google Healthcare NLP.
 * Toma la transcripción (o la nota estructurada) y devuelve entidades
 * en JSON con códigos estándar (CIE-10, RxNorm/SNOMED cuando aplique,
 * SI / unidades clínicas estándar):
 *
 *   conditions:     [{ texto, cie10, estado, severidad, certeza }]
 *   medications:    [{ texto, generico, marca, dosis, via, intervalo, duracion }]
 *   procedures:     [{ texto, fecha, lateralidad }]
 *   anatomy:        [{ texto, region }]
 *   tests:          [{ texto, valor, unidad, fecha, anormal }]
 *   allergies:      [{ alergeno, reaccion, severidad }]
 *
 * Diseño:
 *   - Una segunda pasada Claude con prompt NER puro (sin redacción)
 *   - Output JSON estricto, validable con Zod
 *   - Útil para:
 *       1. Llenar campos estructurados del expediente
 *       2. Cross-check alergia ↔ medicamento (BLOQUEA_RECETA)
 *       3. Auto-CIE10 de diagnósticos para reportes COFEPRIS/CONASABI
 *       4. Trazabilidad por entidad (auditoría)
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────
// Schemas Zod — validación estricta de la respuesta del LLM
// ─────────────────────────────────────────────────────────────────

const Certeza = z.enum(['confirmado', 'sospecha', 'descartado', 'historia']).optional().default('confirmado')

export const EntidadCondicion = z.object({
  texto: z.string(),
  cie10: z.string().optional().default(''),
  estado: z.enum(['activo', 'resuelto', 'cronico', 'agudo', 'en_estudio']).optional().default('activo'),
  severidad: z.enum(['leve', 'moderado', 'severo']).optional(),
  certeza: Certeza,
  source_quote: z.string().optional().default(''),
})
export type EntidadCondicion = z.infer<typeof EntidadCondicion>

export const EntidadMedicamento = z.object({
  texto: z.string(),
  generico: z.string().optional().default(''),
  marca: z.string().optional().default(''),
  dosis: z.string().optional().default(''),
  unidad_dosis: z.string().optional().default(''),
  via: z.enum(['oral', 'iv', 'im', 'sc', 'tópica', 'inhalada', 'rectal', 'sublingual', 'oftálmica', 'ótica', 'nasal', 'desconocida']).optional().default('desconocida'),
  intervalo: z.string().optional().default(''),
  duracion: z.string().optional().default(''),
  indicacion: z.string().optional().default(''),
  necesita_ajuste: z.enum(['renal', 'hepatico', 'peso', 'no']).optional().default('no'),
  source_quote: z.string().optional().default(''),
})
export type EntidadMedicamento = z.infer<typeof EntidadMedicamento>

export const EntidadProcedimiento = z.object({
  texto: z.string(),
  fecha: z.string().optional().default(''),
  lateralidad: z.enum(['izquierda', 'derecha', 'bilateral', 'no_aplica']).optional().default('no_aplica'),
  source_quote: z.string().optional().default(''),
})

export const EntidadAnatomia = z.object({
  texto: z.string(),
  region: z.string().optional().default(''),
  source_quote: z.string().optional().default(''),
})

export const EntidadEstudio = z.object({
  texto: z.string(),
  valor: z.string().optional().default(''),
  unidad: z.string().optional().default(''),
  fecha: z.string().optional().default(''),
  anormal: z.boolean().optional().default(false),
  source_quote: z.string().optional().default(''),
})

export const EntidadAlergia = z.object({
  alergeno: z.string(),
  reaccion: z.string().optional().default(''),
  severidad: z.enum(['leve', 'moderada', 'grave', 'anafilaxia', 'desconocida']).optional().default('desconocida'),
  source_quote: z.string().optional().default(''),
})

export const EntidadesExtraidas = z.object({
  conditions: z.array(EntidadCondicion).optional().default([]),
  medications: z.array(EntidadMedicamento).optional().default([]),
  procedures: z.array(EntidadProcedimiento).optional().default([]),
  anatomy: z.array(EntidadAnatomia).optional().default([]),
  tests: z.array(EntidadEstudio).optional().default([]),
  allergies: z.array(EntidadAlergia).optional().default([]),
  cross_check: z.object({
    alergia_vs_medicamento: z.array(z.object({
      alergeno: z.string(),
      farmaco_riesgoso: z.string(),
      riesgo: z.enum(['bajo', 'medio', 'alto', 'anafilaxia']),
      alternativa_sugerida: z.string().optional().default(''),
      BLOQUEA_RECETA: z.boolean().default(false),
    })).optional().default([]),
    interacciones_farmacologicas: z.array(z.object({
      farmaco_a: z.string(),
      farmaco_b: z.string(),
      severidad: z.enum(['menor', 'moderada', 'mayor', 'contraindicada']),
      mecanismo: z.string().optional().default(''),
    })).optional().default([]),
  }).optional().default({ alergia_vs_medicamento: [], interacciones_farmacologicas: [] }),
})
export type EntidadesExtraidas = z.infer<typeof EntidadesExtraidas>

// ─────────────────────────────────────────────────────────────────
// Prompts para el LLM
// ─────────────────────────────────────────────────────────────────

export const NER_SYSTEM_PROMPT = `
RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO Y NADA MÁS.
Primer carácter "{", último carácter "}". Sin markdown, sin comentarios.

ROL: extractor de entidades clínicas. NO redactas. NO opinas. Solo
EXTRAES entidades estructuradas del texto recibido y las devuelves
con códigos estándar internacionales.

═══════════════════════════════════════════════════════════════════

ENTIDADES A EXTRAER:

1. conditions (enfermedades/dx/síntomas con relevancia clínica):
   - texto: como aparece textualmente
   - cie10: código CIE-10 si tienes ALTA confianza (sino "")
   - estado: activo | resuelto | cronico | agudo | en_estudio
   - severidad: leve | moderado | severo (si se menciona)
   - certeza: confirmado | sospecha | descartado | historia
   - source_quote: frase fuente (≤120 chars)

2. medications (fármacos prescritos o que toma):
   - texto: como aparece (puede ser marca o genérico)
   - generico: denominación genérica (resuelve marcas comerciales MX:
     Tafil→alprazolam, Rivotril→clonazepam, Eliquis→apixabán, etc.)
   - marca: marca comercial si la mencionaron
   - dosis: número (ej. "500", "1", "5.5")
   - unidad_dosis: "mg" | "g" | "mcg" | "UI" | "mL" | "tabletas" | "gotas"
   - via: oral | iv | im | sc | tópica | inhalada | rectal | sublingual | oftálmica | ótica | nasal | desconocida
   - intervalo: "c/8h" | "c/12h" | "BID" | "QD" | "PRN" | etc.
   - duracion: ej. "7 días", "1 mes", "indefinido"
   - indicacion: para qué (si se mencionó)
   - necesita_ajuste: renal | hepatico | peso | no
     (renal: vancomicina, meropenem, gabapentina, fluconazol, levofloxacino…)
   - source_quote

3. procedures (procedimientos / cirugías / intervenciones):
   - texto, fecha, lateralidad, source_quote

4. anatomy (regiones anatómicas relevantes mencionadas):
   - texto, region, source_quote

5. tests (estudios paraclínicos con o sin resultado):
   - texto, valor, unidad, fecha, anormal (true si fuera de rango), source_quote

6. allergies (alergias confirmadas o referidas):
   - alergeno, reaccion, severidad (leve|moderada|grave|anafilaxia|desconocida), source_quote

═══════════════════════════════════════════════════════════════════

CROSS-CHECK OBLIGATORIO:

7. cross_check.alergia_vs_medicamento:
   Para CADA pareja (alergia, medicamento_prescrito) detecta riesgo cruzado:
   - Penicilina ↔ amoxicilina, ampicilina, dicloxacilina (alto)
   - Penicilina ↔ cefalosporinas 1ª-2ª gen (cefalexina, cefuroxima): medio (~10%)
   - Penicilina ↔ carbapenémicos: bajo (~1%)
   - Sulfas ↔ tiazidas, sulfonilureas: medio
   - AAS ↔ otros AINE: alto en asma+pólipos
   - Yodo ↔ contraste yodado: alto
   Si la reacción original fue ANAFILAXIA: BLOQUEA_RECETA=true.
   Sugiere alternativa segura específica.

8. cross_check.interacciones_farmacologicas:
   Detecta interacciones clínicamente relevantes entre los medications
   extraídos. severidad: menor | moderada | mayor | contraindicada.
   Ejemplos críticos:
   - Warfarina + AINE (mayor — sangrado)
   - SSRI + tramadol (mayor — síndrome serotoninérgico)
   - IECAs + espironolactona (moderada — hiperkalemia)
   - Macrólidos + estatinas (mayor — rabdomiólisis)
   - Linezolid + ISRS (contraindicada — síndrome serotoninérgico)

═══════════════════════════════════════════════════════════════════

REGLAS:
- NO inventes. Si no hay datos, devuelve arrays vacíos [].
- NO redactes prosa. Solo entidades.
- NO incluyas información que NO esté en el texto (excepto el código
  estándar correspondiente: CIE-10, genérico de marca comercial).
- NUNCA fabriques códigos CIE-10. Si no estás seguro al 100%, deja "".
- Para marcas MX comunes mapea SIEMPRE al genérico:
  Tafil→alprazolam, Rivotril→clonazepam, Lexotan→bromazepam,
  Eliquis→apixabán, Xarelto→rivaroxabán, Pradaxa→dabigatrán,
  Ozempic→semaglutida, Forxiga→dapagliflozina, Lipitor→atorvastatina,
  Lasix→furosemida, Eutirox→levotiroxina, Plavix→clopidogrel,
  Lyrica→pregabalina, Cymbalta→duloxetina.

SCHEMA estricto — devuelve TODOS los campos del schema (vacíos si no hay datos).
`

export function buildNerUserPrompt(textoFuente: string): string {
  return `TEXTO CLÍNICO A ANALIZAR (transcripción o nota redactada):
"""
${textoFuente.slice(0, 12000)}
"""

Extrae TODAS las entidades clínicas presentes y devuélvelas en el
formato JSON especificado. Si una sección no tiene entidades, devuelve
el array vacío []. Realiza el cross-check alergia↔medicamento y
interacciones obligatoriamente.
`
}
