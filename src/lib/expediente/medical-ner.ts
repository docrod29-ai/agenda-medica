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
 *       2. Cross-check alergia ↔ medicamento (RIESGO_MAXIMO)
 *       3. Auto-CIE10 de diagnósticos para reportes COFEPRIS/CONASABI
 *       4. Trazabilidad por entidad (auditoría)
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────
// Schemas Zod — validación estricta de la respuesta del LLM
// ─────────────────────────────────────────────────────────────────

const Certeza = z.enum(['confirmado', 'sospecha', 'descartado', 'historia']).optional().default('confirmado')

/** Lo que de verdad cabe en el prompt. La ruta rechaza por encima de esto. */
export const TOPE_TEXTO_NER = 12000

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
      /**
       * ANTES SE LLAMABA `BLOQUEA_RECETA`, Y NO BLOQUEABA NADA.
       *
       * El nombre prometía una barrera: el estado con las entidades no se lee
       * en el guardado ni en la impresión, así que la bandera sólo pintaba una
       * tarjeta roja. Un campo que dice «bloquea» y no bloquea es peor que no
       * tenerlo — quien lee el código cree que hay una compuerta donde no la hay.
       *
       * Quien SÍ detiene la firma es el motor determinista
       * (`validarAlergiasVsMedicamentos` + `validarNOM004`), que cruza las
       * alergias del EXPEDIENTE y no depende de que un modelo se acuerde.
       * Esto es lo que el modelo vio en el texto, y se llama como lo que es.
       */
      RIESGO_MAXIMO: z.boolean().default(false),
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
   Si la reacción original fue ANAFILAXIA: RIESGO_MAXIMO=true.
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
- **UNA ENFERMEDAD NOMBRADA EN LA PREGUNTA NO ES UN DIAGNÓSTICO.** El interrogatorio
  se hace nombrando padecimientos ("¿enfermedades crónicas como diabetes o presión
  alta?"). Si la respuesta es "no", "ninguna", "nada" o equivalente, esa condición va
  con certeza="descartado" — NUNCA "confirmado". Cosechar el término de la pregunta e
  ignorar el "no" le inventa al paciente un antecedente crónico que cambia su riesgo
  quirúrgico y se arrastra a todas las notas siguientes.
- Si el texto viene con turnos (Médico:/Paciente:), quien AFIRMA o NIEGA un antecedente
  es el PACIENTE; lo que dice el médico en una pregunta no es un hallazgo.
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

export function buildNerUserPrompt(textoFuente: string, alergiasRegistradas?: string[]): string {
  // Auditoría 2026-07 (P1): las alergias del EXPEDIENTE (registradas por el
  // médico fuera del texto dictado) deben entrar al cross-check. Antes solo se
  // cruzaban las alergias mencionadas en la transcripción → un paciente con
  // "penicilina" en su ficha, pero sin dictarla, no disparaba el bloqueo.
  const alergias = (alergiasRegistradas ?? [])
    .map(a => String(a).trim())
    .filter(Boolean)
  const bloqueAlergias = alergias.length
    ? `\nALERGIAS YA REGISTRADAS EN EL EXPEDIENTE DEL PACIENTE (trátalas como confirmadas, inclúyelas en "allergies" y en el cross-check aunque NO aparezcan en el texto):
"""
${alergias.join(', ').slice(0, 2000)}
"""
`
    : ''
  return `TEXTO CLÍNICO A ANALIZAR (transcripción o nota redactada):
"""
${textoFuente.slice(0, TOPE_TEXTO_NER)}
"""
${bloqueAlergias}
Extrae TODAS las entidades clínicas presentes y devuélvelas en el
formato JSON especificado. Si una sección no tiene entidades, devuelve
el array vacío []. Realiza el cross-check alergia↔medicamento y
interacciones obligatoriamente${alergias.length ? ', cruzando TAMBIÉN las alergias registradas del expediente contra los medicamentos prescritos' : ''}.
`
}
