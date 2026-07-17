/**
 * Extracción por VISIÓN del antibiograma: foto → perfil de susceptibilidad estructurado.
 *
 * Principio del foso: «la IA EXTRAE, el motor RAZONA». El LLM de visión SOLO transcribe
 * lo que está impreso/escrito y es LEGIBLE (organismo + antibiótico + S/I/R + CMI/halo).
 * NO interpreta mecanismos, NO infiere fenotipos, NO inventa antibióticos ausentes.
 * La interpretación (β-lactamasas/porinas/bombas/carbapenemasas) la hace después el
 * motor determinista `interpretarAntibiograma`. Así no hay alucinación clínica posible.
 */
import { z } from 'zod'
import type { EntradaAntibiograma, SIR } from './tipos'

export const CeldaExtraida = z.object({
  antibiotico: z.string().min(1),
  /** S/I/R tal como aparece impreso (o null si la placa solo trae CMI/halo sin categoría). */
  interpretacion: z.enum(['S', 'I', 'R']).nullable().optional(),
  /** CMI en mg/L (µg/mL) si el reporte la trae. */
  cmi: z.number().positive().nullable().optional(),
  /** Diámetro de halo en mm (difusión en disco) si aplica. */
  halo_mm: z.number().positive().nullable().optional(),
  /** Confianza de la transcripción de ESTA celda. */
  conf: z.enum(['alta', 'media', 'baja']).optional(),
  /** true si está borroso/ambiguo y hay que revisar a mano. */
  needs_review: z.boolean().optional(),
})

export const PerfilExtraido = z.object({
  organismo: z.string(),
  /** Método detectado en la imagen. */
  metodo: z.enum(['disco', 'mic', 'automatizado', 'desconocido']).optional(),
  resultados: z.array(CeldaExtraida),
  /** Avisos de integridad de la extracción (celdas borrosas, columnas dudosas, etc.). */
  avisos: z.array(z.string()).optional(),
})

export type PerfilExtraido = z.infer<typeof PerfilExtraido>

export const VISION_SYSTEM_PROMPT = `Eres un transcriptor experto de reportes de antibiograma (susceptibilidad antimicrobiana). Tu ÚNICA tarea es TRANSCRIBIR con exactitud lo que está impreso o escrito en la imagen. NO eres un intérprete clínico.

REGLAS DE INTEGRIDAD (obligatorias):
1. Transcribe SOLO lo que es legible con certeza. Si una celda está borrosa, cortada o ambigua, márcala con needs_review=true y conf="baja" — NO adivines el valor.
2. NUNCA inventes ni infieras antibióticos que no aparezcan en la imagen. Solo reporta filas que existen.
3. NO interpretes mecanismos de resistencia (BLEE, AmpC, carbapenemasa, MRSA, etc.). Eso lo hace otro sistema. Tú solo extraes organismo + antibiótico + categoría S/I/R + CMI/halo.
4. Respeta la categoría IMPRESA (S=sensible, I=intermedio/dosis dependiente, R=resistente). No la cambies por tu criterio. Si el reporte usa "SDD" trátalo como "I".
5. Si el reporte trae CMI (p. ej. "≤0.5", "2", ">16"), extrae el número (de "≤0.5"→0.5, de ">16"→16) en el campo cmi. Si es difusión en disco con halo en mm, usa halo_mm.
6. Normaliza el nombre del antibiótico a su nombre genérico en español (p. ej. "TZP"→"Piperacilina-tazobactam", "SXT"→"Trimetoprim-sulfametoxazol", "MEM"→"Meropenem", "CRO"→"Ceftriaxona", "CAZ"→"Ceftazidima", "FEP"→"Cefepime", "CZA"→"Ceftazidima-avibactam"). Conserva el organismo tal cual se lee.
7. Si no puedes leer el organismo, deja organismo="" y agrégalo a avisos.

Responde SOLO con un objeto JSON válido, sin texto adicional, con esta forma:
{"organismo": string, "metodo": "disco"|"mic"|"automatizado"|"desconocido", "resultados": [{"antibiotico": string, "interpretacion": "S"|"I"|"R"|null, "cmi": number|null, "halo_mm": number|null, "conf": "alta"|"media"|"baja", "needs_review": boolean}], "avisos": [string]}`

export function buildVisionUserPrompt(): string {
  return 'Transcribe el antibiograma de la imagen siguiendo las reglas de integridad. Devuelve solo el JSON.'
}

/** Convierte el perfil extraído en la entrada del motor, filtrando celdas sin categoría S/I/R usable. */
export function perfilAEntrada(perfil: PerfilExtraido, sitio?: EntradaAntibiograma['sitio']): EntradaAntibiograma {
  const resultados = perfil.resultados
    .filter(c => c.interpretacion === 'S' || c.interpretacion === 'I' || c.interpretacion === 'R')
    .map(c => ({
      antibiotico: c.antibiotico.trim(),
      interpretacion: c.interpretacion as SIR,
      ...(typeof c.cmi === 'number' ? { cmi: c.cmi } : {}),
    }))
  return { organismo: (perfil.organismo || '').trim(), resultados, sitio }
}
