import type { TipoNota, PacienteContexto } from '@/types/expediente'
import { SECCIONES_POR_TIPO } from './templates'

/**
 * Prompts internos para estructurar transcripciones con Claude.
 * Devuelve siempre JSON con la forma { resumenEjecutivo, secciones, diagnosticos, medicamentos, alergias, signosVitales }.
 */

const REGLAS_BASE = `
Eres un asistente médico experto en documentación clínica conforme a la NOM-004-SSA3-2012 de México.
Tu tarea es estructurar la transcripción de una consulta médica en el formato correcto.

REGLAS ESTRICTAS:
1. NUNCA inventes datos no mencionados. Si un dato no se mencionó, deja el campo vacío "".
2. Usa terminología médica correcta en español (sin anglicismos innecesarios).
3. Distingue síntomas subjetivos de signos objetivos.
4. Para medicamentos extrae: nombre genérico, dosis, vía, frecuencia, duración.
5. Para diagnósticos sugiere el código CIE-10 cuando sea posible.
6. Identifica alergias mencionadas y márcalas con su severidad y reacción.
7. Convierte fechas relativas ("hace 3 días") a contexto temporal claro.
8. Elimina muletillas, repeticiones y conversación irrelevante.
9. Redacta en tercera persona médica, tiempo pasado:
   ❌ "El paciente me dice que le duele"
   ✅ "Paciente refiere dolor abdominal de 3 días de evolución…"
10. Extrae signos vitales numéricos si se mencionan (FC, FR, TA, temperatura, SpO2, peso, talla).

FORMATO DE RESPUESTA: ÚNICAMENTE JSON válido. Sin markdown, sin backticks, sin texto antes o después.
`

const ESPECIFICO: Partial<Record<TipoNota, string>> = {
  seguimiento: `Estructura en formato SOAP (Subjetivo, Objetivo, Evaluación, Plan). En "subjetivo" incluye evolución referida y cumplimiento del tratamiento. En "evaluacion" indica si cada diagnóstico está mejor/igual/peor/resuelto.`,
  evolucion: `Nota de evolución hospitalaria en formato SOAP diario. Para Infectología: menciona el día X de antibiótico, candidato a desescalada o switch IV→VO, y resultados de cultivos si se mencionan.`,
  ingreso: `Nota de ingreso hospitalario. En "impresionInicial" resume el caso en una línea (ej: "Hombre 58a con DM2/HAS, bacteriemia por K. pneumoniae BLEE+"). Destaca cultivos en estudios.`,
  egreso: `Nota de egreso. En "resumenCaso" da una línea ejecutiva. Incluye procedimientos, evolución y signos de alarma claros.`,
  historia_clinica: `Historia clínica completa de primera vez. Sigue OLDCARTS implícito en el padecimiento actual. Estructura antecedentes heredo-familiares, no patológicos y patológicos por separado.`,
}

export function buildSystemPrompt(tipo: TipoNota): string {
  const secciones = SECCIONES_POR_TIPO[tipo]
  const listaSecciones = secciones.map(s => `   - "${s.key}": ${s.label}${s.obligatorio ? ' (obligatorio)' : ''}`).join('\n')

  return `${REGLAS_BASE}
${ESPECIFICO[tipo] ? `\nINSTRUCCIONES ESPECÍFICAS:\n${ESPECIFICO[tipo]}\n` : ''}
ESTRUCTURA JSON ESPERADA:
{
  "resumenEjecutivo": "1 línea que resume el caso",
  "secciones": {
${listaSecciones.split('\n').map(l => l.replace(/^   - "(\w+)".*/, '     "$1": "contenido o cadena vacía"')).join(',\n')}
  },
  "diagnosticos": [{ "descripcion": "", "codigoCIE10": "", "tipo": "presuntivo|definitivo|diferencial", "estado": "activo" }],
  "medicamentos": [{ "nombre": "", "dosis": "", "via": "oral", "frecuencia": "", "duracion": "", "indicacion": "" }],
  "alergias": [{ "alergeno": "", "tipo": "medicamento", "reaccion": "", "severidad": "leve", "confirmada": false }],
  "signosVitales": { "fc": null, "fr": null, "ta": "", "temperatura": null, "spo2": null, "peso": null, "talla": null }
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
