/**
 * LÉXICO DINÁMICO — etapas 2 y 3 del pipeline clínico de dictado.
 *
 * Detección de contexto y construcción del vocabulario que se le manda al
 * reconocedor ANTES de transcribir. Es la única etapa que mejora lo que el
 * reconocedor oye; todas las demás trabajan sobre lo que ya oyó.
 *
 * ── EL PROBLEMA ES UN PRESUPUESTO, NO UN DICCIONARIO ─────────────────────────
 *
 * El mapa de especialidades del Dr. tiene **1 400 términos en 79
 * especialidades**. El prompt de Whisper admite **224 tokens** — el modelo lee
 * los últimos 224 y **el resto lo tira sin avisar**. Eso ya nos pasó: el prompt
 * de UCI se pasaba de largo y la parte que se perdía era, precisamente, la de
 * cuidados críticos.
 *
 * Así que esto no es «meter el diccionario»: es **elegir en qué se gastan 224
 * tokens** para ESTE paciente. Su propia estrategia lo dice —
 * `max_active_contexts: 4` y «no inyectar el diccionario completo en cada
 * llamada».
 *
 * ── EN QUÉ ORDEN SE GASTA ────────────────────────────────────────────────────
 *
 * 1. Lo que este paciente tiene delante: sus fármacos activos y sus problemas.
 *    Ningún término genérico vale más que el nombre del antibiótico que se está
 *    dictando ahora mismo.
 * 2. Los términos críticos globales (`merge_global_critical_lexicon`).
 * 3. Los críticos de las especialidades activas, luego los de alta prioridad,
 *    luego los normales.
 *
 * Lo que no cabe, no entra. Y se puede saber cuánto se quedó fuera: `construir()`
 * lo devuelve, porque un recorte silencioso se lee como cobertura completa.
 *
 * Módulo PURO.
 */

import mapa from '@/lib/asr/data/especialidades.json'
import { LIMITE_TOKENS_PROMPT, tokensAprox } from '@/lib/expediente/medical-vocabulary'

interface Especialidad {
  critical_terms: string[]
  high_priority_terms: string[]
  normal_terms: string[]
}
const ESPECIALIDADES = mapa.specialties as unknown as Record<string, Especialidad>
const ESTRATEGIA = mapa.strategy as unknown as {
  default_contexts: string[]
  max_active_contexts: number
  merge_global_critical_lexicon: boolean
}

export const NOMBRES_ESPECIALIDAD: readonly string[] = Object.keys(ESPECIALIDADES)

/** Dónde está dictando el médico. */
export type ModuloDictado = 'consulta' | 'hospitalizacion' | 'uci' | 'urgencias' | 'quirofano'

/**
 * Contextos que aporta cada módulo de la app.
 *
 * Esta tabla **la escribo yo**: el paquete del Dr. define las especialidades y su
 * vocabulario, pero no dice qué pantalla de NexusMED corresponde a cuál. Son
 * nombres exactos de su mapa — un test comprueba que ninguno se haya escrito mal.
 */
export const CONTEXTOS_POR_MODULO: Readonly<Record<ModuloDictado, readonly string[]>> = {
  consulta: ['Consulta general y documentación', 'Medicina interna ambulatoria'],
  hospitalizacion: ['Medicina hospitalaria', 'Antimicrobianos'],
  uci: ['Ventilación mecánica', 'Aminas e inotrópicos', 'Sepsis y choque', 'CKRT / PRISMA'],
  urgencias: ['Emergencias y códigos', 'Escalas y scores'],
  quirofano: ['Anestesiología y preoperatorio', 'UCI quirúrgica'],
}

export interface ContextoDictado {
  modulo: ModuloDictado
  /** Especialidades que el médico eligió, si eligió alguna. */
  especialidades?: readonly string[]
  /** Fármacos activos del paciente. Lo más específico que existe. */
  medicamentos?: readonly string[]
  /** Lista de problemas y diagnósticos. */
  problemas?: readonly string[]
}

/**
 * Las especialidades activas, como máximo las que permite la estrategia del Dr.
 *
 * Las que el médico eligió van primero: si él dijo «esto es nefrología», el
 * módulo no tiene por qué llevarle la contraria.
 */
export function contextosActivos(ctx: ContextoDictado): string[] {
  const pedidas = (ctx.especialidades ?? []).filter(e => e in ESPECIALIDADES)
  const delModulo = CONTEXTOS_POR_MODULO[ctx.modulo] ?? []
  const orden = [...pedidas, ...delModulo, ...ESTRATEGIA.default_contexts]
  const vistos = new Set<string>()
  const out: string[] = []
  for (const e of orden) {
    if (vistos.has(e) || !(e in ESPECIALIDADES)) continue
    vistos.add(e); out.push(e)
    if (out.length >= ESTRATEGIA.max_active_contexts) break
  }
  return out
}

/** Términos críticos de TODAS las especialidades: `merge_global_critical_lexicon`. */
export function criticosGlobales(): string[] {
  return Object.values(ESPECIALIDADES).flatMap(e => e.critical_terms)
}

export interface Lexicon {
  /** Los términos que caben, en el orden en que se gastó el presupuesto. */
  terminos: string[]
  /** El prompt listo para el reconocedor. */
  prompt: string
  tokens: number
  /** Cuántos términos candidatos se quedaron fuera. Nunca se recorta en silencio. */
  descartados: number
  especialidades: string[]
}

/**
 * Preámbulo fijo. Corto a propósito: cada token que ocupa es un término del
 * paciente que se queda fuera.
 */
const PREAMBULO = 'Transcripción médica en español de México. Términos:'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Construye el vocabulario de esta grabación.
 *
 * @param ctx qué módulo, qué especialidad y qué tiene el paciente.
 * @param limite presupuesto en tokens. Por defecto el del reconocedor.
 */
export function construir(ctx: ContextoDictado, limite = LIMITE_TOKENS_PROMPT): Lexicon {
  const especialidades = contextosActivos(ctx)

  // El orden ES la política: primero lo de este paciente.
  const candidatos: string[] = [
    ...(ctx.medicamentos ?? []),
    ...(ctx.problemas ?? []),
    ...(ESTRATEGIA.merge_global_critical_lexicon ? criticosGlobales() : []),
    ...especialidades.flatMap(e => ESPECIALIDADES[e].critical_terms),
    ...especialidades.flatMap(e => ESPECIALIDADES[e].high_priority_terms),
    ...especialidades.flatMap(e => ESPECIALIDADES[e].normal_terms),
    /**
     * RELLENO: el presupuesto que sobra se llena con lo más crítico del resto.
     *
     * Medido sobre el vocabulario real del Dr.: en UCI se agotaban los
     * candidatos con 212 de 224 tokens y CERO descartados. «Cero descartados»
     * ahí no significaba que todo cupiera: significaba que **se acabaron los
     * términos**, porque las especialidades del núcleo de cuidados críticos son
     * las más flacas de su CSV (ventilación mecánica 3, gasometría 2, sedación
     * 1) mientras imagenología tiene 59.
     *
     * Dejar tokens sin usar es tirar sesgo: cada hueco es una palabra suya que
     * el reconocedor no va a esperar. Va al FINAL, así que no le quita el sitio
     * a nada de este paciente ni de su especialidad — sólo ocupa lo que iba a
     * quedarse vacío.
     *
     * Sólo términos críticos y de prioridad alta: si va a sobrar poco espacio,
     * que se lo lleve lo que él marcó como importante.
     */
    ...Object.entries(ESPECIALIDADES)
      .filter(([e]) => !especialidades.includes(e))
      .flatMap(([, v]) => v.critical_terms),
    ...Object.entries(ESPECIALIDADES)
      .filter(([e]) => !especialidades.includes(e))
      .flatMap(([, v]) => v.high_priority_terms),
  ]

  const vistos = new Set<string>()
  const unicos = candidatos
    .map(t => t.trim())
    .filter(t => t.length > 0 && !vistos.has(norm(t)) && vistos.add(norm(t)) !== undefined)

  const terminos: string[] = []
  for (const t of unicos) {
    const prueba = `${PREAMBULO} ${[...terminos, t].join(', ')}.`
    if (tokensAprox(prueba) > limite) break
    terminos.push(t)
  }

  const prompt = `${PREAMBULO} ${terminos.join(', ')}.`
  return {
    terminos,
    prompt,
    tokens: tokensAprox(prompt),
    descartados: unicos.length - terminos.length,
    especialidades,
  }
}

export const POR_QUE_SE_ELIGE =
  'El mapa del Dr. tiene 1 400 términos y el prompt admite 224 tokens: el modelo ' +
  'lee los últimos y tira el resto sin avisar. Elegir no es una optimización, es ' +
  'la única forma de que el vocabulario llegue entero. Se gasta primero en los ' +
  'fármacos y problemas de ESTE paciente, después en los términos críticos, y lo ' +
  'que no cabe se cuenta y se reporta.'
