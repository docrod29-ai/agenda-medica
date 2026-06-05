import type { TipoNota, PacienteContexto } from '@/types/expediente'
import { SECCIONES_POR_TIPO } from './templates'

/**
 * Prompts internos para estructurar transcripciones con Claude.
 * Devuelve siempre JSON con la forma { resumenEjecutivo, secciones, diagnosticos, medicamentos, alergias, signosVitales }.
 */

const REGLAS_BASE = `
Eres un asistente médico experto en documentación clínica conforme a la NOM-004-SSA3-2012 de México.
Tu tarea es estructurar la transcripción de una consulta médica en datos clínicos auditables.

REGLAS ESTRICTAS DE EXTRACCIÓN:
1. NUNCA inventes datos no mencionados. Si un dato no se mencionó, deja el campo vacío "".
2. Distingue NEGACIÓN EXPLÍCITA ("niega alergias") de AUSENCIA DE MENCIÓN (no se preguntó / no se dijo).
3. Distingue SOSPECHA ("podría ser…", "probable…") de DIAGNÓSTICO CONFIRMADO. Por defecto tipo="presuntivo".
4. Si el médico CORRIGE al paciente, prioriza la corrección del médico pero deja la cita textual como source_quote.
5. Si el dato proviene de un ACOMPAÑANTE, marca speaker="acompanante".
6. Para medicamentos extrae: nombre genérico, dosis, vía, frecuencia, duración. Si la dosis es ambigua, needs_review=true.
7. Para diagnósticos sugiere CIE-10 SOLO si tienes alta confianza; si no, déjalo vacío.
8. Las ALERGIAS son SIEMPRE dato crítico: needs_review=true salvo que el médico las confirme explícitamente.
9. Convierte fechas relativas a contexto temporal claro ("hace 3 días").
10. Elimina muletillas, repeticiones y conversación irrelevante.
11. Redacta en tercera persona médica, tiempo pasado (NO "El paciente me dice", SÍ "Paciente refiere…").
12. Extrae signos vitales numéricos solo si se mencionan textualmente.

REGLAS DE METADATOS AUDITABLES (bloque "extraction"):
- value:        el dato.
- confidence:   "alta" | "media" | "baja". Alta = mencionado claramente, sin ambigüedad. Media = inferido del contexto cercano. Baja = mencionado de pasada o poco claro.
- source_quote: la frase exacta de la transcripción de la que sale (máx ~120 chars).
- speaker:      "medico" | "paciente" | "acompanante" | "desconocido".
- needs_review: true si confidence != "alta", o si es dato crítico (alergia, dosis, diagnóstico grave, embarazo, anticoagulante, insulina, antibiótico, opioide, benzodiacepina), o si hay conflicto.
- reason:       motivo breve cuando needs_review=true.

BLOQUE safety:
- conflicts_detected: contradicciones (ej. paciente dice "sí" y médico dice "no").
- missing_critical_fields: alergias/medicamentos no preguntados que deberían estarlo.

FORMATO DE RESPUESTA: ÚNICAMENTE JSON válido. Sin markdown, sin backticks, sin texto antes o después.
`

const ESPECIFICO: Partial<Record<TipoNota, string>> = {
  seguimiento: `Estructura en formato SOAP (Subjetivo, Objetivo, Evaluación, Plan). En "subjetivo" incluye evolución referida y cumplimiento del tratamiento. En "evaluacion" indica si cada diagnóstico está mejor/igual/peor/resuelto.`,
  evolucion: `Nota de evolución hospitalaria en formato SOAP diario. Para Infectología: menciona el día X de antibiótico, candidato a desescalada o switch IV→VO, y resultados de cultivos si se mencionan.`,
  ingreso: `Nota de ingreso hospitalario. En "impresionInicial" resume el caso en una línea (ej: "Hombre 58a con DM2/HAS, bacteriemia por K. pneumoniae BLEE+"). Destaca cultivos en estudios.`,
  egreso: `Nota de egreso. En "resumenCaso" da una línea ejecutiva. Incluye procedimientos, evolución y signos de alarma claros.`,
  historia_clinica: `Historia clínica completa de primera vez. Sigue OLDCARTS implícito en el padecimiento actual. Estructura antecedentes heredo-familiares, no patológicos y patológicos por separado.`,
  valoracion_preoperatoria: `Nota de VALORACIÓN PREOPERATORIA.

REGLA MAESTRA: si la transcripción TIENE CUALQUIER contenido clínico,
"resumenClinico" NUNCA debe quedar vacío. Captura TODO — incluso las
NEGACIONES explícitas (son datos clínicos válidos en preop).

Estructura por sección:

▸ "cirugiaPropuesta":
  - Si el médico mencionó la cirugía: descripción + fecha + urgencia.
  - Si NO la mencionó: escribe exactamente "Pendiente de especificar
    — no fue dictada en este audio" (NO la dejes vacía, así el médico
    sabe que debe complementar).

▸ "resumenClinico" (CAMPO CRÍTICO — debe ir POBLADO siempre):
  Estructura en bullets o prosa breve. INCLUYE:
  * Comorbilidades AFIRMADAS (HAS, DM, EPOC, IC, ictus, ERC, AAA,
    AOP, SAOS, tabaquismo, obesidad, etc.)
  * Comorbilidades NEGADAS explícitamente ("Niega: TVP previa,
    fractura de cadera, cirugía de rodilla, …")
  * Medicamentos AFIRMADOS y NEGADOS ("No toma aspirina")
  * Antecedentes quirúrgicos previos ("Cirugía previa en piernas, no
    especificada")
  * Síntomas referidos (dolor, disnea, dolor de piernas, ronquido,
    cefalea, etc.)
  * Capacidad funcional si se menciona en METs o equivalentes
  * Signos vitales relevantes mencionados (SpO2 basal, FC, TA, peso,
    talla)
  EJEMPLO de salida si SOLO hay negaciones + dato suelto:
  "Paciente femenina. Niega antecedente de TVP, fractura de cadera o
   cirugía de rodilla. Antecedente de cirugía previa en piernas (no
   especificada). Refiere dolor de piernas crónico. SpO2 basal 90%
   aire ambiente. Ronquido nocturno referido (no severo). Niega uso
   de aspirina. Cefalea ocasional manejada con paracetamol."

▸ "laboratorios":
  Solo si se mencionaron valores numéricos (BH, QS, coagulación,
  HbA1c, electrolitos, eGFR). Si NO se mencionaron: déjalo vacío "".

▸ "conclusionRiesgo": SE LLENA AUTOMÁTICAMENTE con calculadoras
  (ASA, RCRI, ARISCAT, Caprini, etc.). NO INVENTES escalas.
  Solo si el médico DICTÓ una conclusión textual, transcríbela.

▸ "recomendaciones": SE LLENA AUTOMÁTICAMENTE con motor de
  recomendaciones perioperatorias. NO INVENTES guidelines.
  Solo si el médico DICTÓ recomendaciones, transcríbelas.

Adicional: extrae signosVitales (especialmente spo2, peso, talla)
para que el motor de cálculo los use.`,
}

export function buildSystemPrompt(tipo: TipoNota): string {
  const secciones = SECCIONES_POR_TIPO[tipo]
  const listaSecciones = secciones.map(s => `   - "${s.key}": ${s.label}${s.obligatorio ? ' (obligatorio)' : ''}`).join('\n')

  return `${REGLAS_BASE}
${ESPECIFICO[tipo] ? `\nINSTRUCCIONES ESPECÍFICAS:\n${ESPECIFICO[tipo]}\n` : ''}
ESTRUCTURA JSON ESPERADA (incluye los campos planos + el bloque auditable "extraction" + "safety"):
{
  "resumenEjecutivo": "1 línea que resume el caso",
  "secciones": {
${listaSecciones.split('\n').map(l => l.replace(/^   - "(\w+)".*/, '     "$1": "contenido o cadena vacía"')).join(',\n')}
  },
  "diagnosticos": [{ "descripcion": "", "codigoCIE10": "", "tipo": "presuntivo|definitivo|diferencial", "estado": "activo" }],
  "medicamentos": [{ "nombre": "", "dosis": "", "via": "oral", "frecuencia": "", "duracion": "", "indicacion": "" }],
  "alergias": [{ "alergeno": "", "tipo": "medicamento", "reaccion": "", "severidad": "leve", "confirmada": false }],
  "signosVitales": { "fc": null, "fr": null, "ta": "", "temperatura": null, "spo2": null, "peso": null, "talla": null },
${tipo === 'valoracion_preoperatoria' ? `
  "preopInputs": {
    // ─── Top-level: RCRI + contexto general ─────────────────
    "edad": null,
    "cirugiaAltoRiesgo": false, "cirugiaElectiva": true,
    "cardiopatiaIsquemica": false, "insuficienciaCardiaca": false, "insuficienciaCardiacaFErEF": false,
    "enfermedadCerebrovascular": false, "hipertension": false, "diabetes": false, "diabetesInsulina": false,
    "creatininaMayor2": false, "anemia": false, "infeccionRespiratoria": false,
    "tomaBetabloqueador": false, "tomaIECAoARA": false, "tomaEstatina": false,
    "tomaSGLT2": false, "tomaGLP1": false, "glp1Semanal": false,
    "tomaAspirina": false, "pciPrevia": false,
    "tomaAnticoagulante": false, "tipoAnticoagulante": null,
    "valvulaMecanicaMitral": false,
    "stentDES": false, "stentDESMotivo": null, "mesesDesdeStent": null,
    "iamReciente": false, "mesesDesdeIAM": null,
    "tabaquismoActivo": false, "saos": false, "epoc": false, "obesidad": false,

    // ─── STOP-BANG (riesgo de apnea del sueño) ──────────────
    // Keys exactas — usa solo estas llaves
    "stopbang": {
      "snoring": false,      // ronquido fuerte / ronca tras puertas cerradas
      "tiredness": false,    // cansancio diurno / somnolencia frecuente
      "observed": false,     // alguien observó apnea durante el sueño
      "pressure": false,     // hipertensión arterial conocida o en tratamiento
      "bmi35": false,        // IMC > 35
      "age50": false,        // edad > 50 años
      "neck40": false,       // circunferencia cuello > 40 cm
      "genderMale": false    // sexo masculino
    },

    // ─── CAPRINI (riesgo de TVP/TEP) ────────────────────────
    "caprini": {
      "edad41_60": false, "cirugiaMenor": false, "imcMayor25": false,
      "piernasHinchadas": false, "varices": false, "embarazoPosparto": false,
      "anticonceptivosTRH": false, "sepsis": false, "enfPulmonarGrave": false,
      "epoc": false, "iamReciente": false, "iccReciente": false,
      "reposoCama": false, "eii": false,
      "edad61_74": false, "cirugiaMayor": false, "artroscopia": false,
      "malignidad": false, "confinadoCama72": false, "yesoInmovilizador": false,
      "accesoVenosoCentral": false,
      "edad75": false, "antecedenteTVP": false, "historiaFamiliarTVP": false,
      "trombofilia": false,
      "evcReciente": false, "artroplastiaElectiva": false, "fracturaCadera": false,
      "lesionMedular": false, "politraumatismo": false
    },

    // ─── CHADS-VASc (FA - riesgo de ictus) ──────────────────
    "chadsvasc": {
      "icc": false, "hta": false, "edad75": false, "diabetes": false,
      "ictusEVC": false, "vasculopatia": false, "edad65_74": false, "mujer": false
    },

    // ─── HAS-BLED (riesgo de sangrado en FA) ────────────────
    "hasbled": {
      "hta": false, "renalAnormal": false, "hepaticaAnormal": false,
      "ictus": false, "sangradoHistoria": false, "irrLabil": false,
      "ancianos": false, "drogasAlcohol": false
    },

    // ─── ARISCAT (riesgo pulmonar postoperatorio) ──────────
    "ariscat": {
      "edad": null,                // años
      "spo2": null,                // SpO2 aire ambiente (ej. 90)
      "infeccionRespiratoria": false,  // última semana
      "anemia": false,             // Hb < 10
      "incision": "",              // "periferica" | "torax" | "abdomenAlto" | "abdomenBajo"
      "duracion": "",              // "menor2h" | "2a3h" | "mayor3h"
      "emergencia": false
    }
  },
  // INSTRUCCIONES preopInputs (CRÍTICAS):
  // - SOLO pon true cuando el médico lo MENCIONÓ explícitamente o se deriva sin ambigüedad.
  // - Si no se menciona, deja false (NO INVENTES factores de riesgo).
  // - Para CHADS-VASc "mujer" = true solo si sexo femenino confirmado.
  // - Para tipoAnticoagulante usa "DOAC" o "warfarina" o null.
  // - Para stentDESMotivo usa "SCA" o "cronico" o null.
  // - Para ariscat.incision usa exactamente: "periferica" | "torax" | "abdomenAlto" | "abdomenBajo".
  // - Para ariscat.duracion usa exactamente: "menor2h" | "2a3h" | "mayor3h".
  // - spo2: pon el número exacto si se mencionó (ej. 90, 95) — NO 0.
  // - Si el paciente dice "ronca pero no fuerte" → stopbang.snoring=false (debe ser FUERTE).
  // - Si dice "le hicieron cirugía en las piernas" sin más → caprini.cirugiaMenor=true (asumir menor sin más detalle).
  // - Negación explícita ("nunca trombosis") deja en false (que era el default — confirma).
` : ''}

  "extraction": {
    "resumenEjecutivo": { "value": "", "confidence": "alta|media|baja", "source_quote": "", "speaker": "medico|paciente|acompanante|desconocido", "needs_review": false, "reason": "" },
    "secciones": {
${listaSecciones.split('\n').map(l => l.replace(/^   - "(\w+)".*/, '       "$1": { "value": "", "confidence": "baja", "source_quote": "", "speaker": "desconocido", "needs_review": true, "reason": "" }')).join(',\n')}
    },
    "diagnosticos": [{ "descripcion": "", "codigoCIE10": "", "tipo": "presuntivo", "estado": "activo", "confidence": "media", "source_quote": "", "speaker": "medico", "needs_review": true, "reason": "" }],
    "medicamentos": [{ "nombre": "", "dosis": "", "via": "oral", "frecuencia": "", "duracion": "", "indicacion": "", "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" }],
    "alergias": [{ "alergeno": "", "tipo": "medicamento", "reaccion": "", "severidad": "moderada", "confirmada": false, "confidence": "alta", "source_quote": "", "speaker": "paciente", "needs_review": true, "reason": "Dato crítico — confirmar con paciente" }],
    "signosVitales": {
      "ta":          { "value": "", "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "fc":          { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "fr":          { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "temperatura": { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "spo2":        { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "peso":        { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" },
      "talla":       { "value": null, "confidence": "alta", "source_quote": "", "speaker": "medico", "needs_review": false, "reason": "" }
    }
  },

  "safety": {
    "fields_auto_filled": ["lista de campos con confidence alta y needs_review=false"],
    "fields_requiring_review": ["lista de campos con needs_review=true"],
    "conflicts_detected": ["descripción breve de cualquier contradicción"],
    "missing_critical_fields": ["alergias/medicamentos/etc no preguntados pero importantes"]
  }
}

Las secciones a llenar para esta nota (${tipo}) son exactamente:
${listaSecciones}`
}

export function buildUserPrompt(transcripcion: string, ctx: PacienteContexto): string {
  return `CONTEXTO DEL PACIENTE:
- Nombre: ${ctx.nombre}
- Edad: ${ctx.edad ?? 'No referida'}
- Sexo: ${ctx.sexo ?? 'No referido'}
- Alergias conocidas: ${ctx.alergias || 'No referidas'}
- Medicamentos actuales: ${ctx.medicamentosActuales || 'No referidos'}
${ctx.notasPrevias ? `- Resumen de notas previas: ${ctx.notasPrevias}` : ''}

TRANSCRIPCIÓN DE LA CONSULTA:
"""
${transcripcion}
"""

Estructura esta transcripción en el JSON indicado. Recuerda: solo JSON válido, sin texto adicional.`
}
