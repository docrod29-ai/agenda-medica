/**
 * Vocabulario POR CONTEXTO — charter §8.
 *
 *   «El vocabulario debe cambiar según contexto. Si el médico dice
 *    "Respiratorio", activar el diccionario de PEEP/PIP/Pplat/VT/FiO2…»
 *
 * ── POR QUÉ ESTO IMPORTA PARA LA SEGURIDAD ───────────────────────────────────
 *
 * Un diccionario único tiene que competir consigo mismo: «sweep» compite con
 * «suip», «VT» con «VTI», «PEEP» con «PIP» — todos a la vez, siempre. Acotar el
 * vocabulario al contexto activo reduce el número de candidatos que pueden
 * confundirse, que es exactamente lo que alimenta `confirmacion.ts`.
 *
 * Y en la otra dirección: si el contexto activo es «renal» y aparece un término
 * de ECMO, eso NO es una coincidencia inocente — es la señal
 * `contextoConcuerda: false` que hace preguntar.
 *
 * ── LO QUE ESTE ARCHIVO NO HACE ──────────────────────────────────────────────
 *
 * **No inventa términos.** Las cuatro listas están transcritas literalmente del
 * charter §8. El charter §10 lo prohíbe expresamente: «NO crear aliases
 * clínicamente incorrectos». Añadir uno exige que aparezca en una fuente del
 * repo o que lo autorice el médico dueño.
 *
 * Tampoco decide nada clínico: sólo dice qué palabras están activas.
 *
 * Módulo PURO: listas y búsquedas, sin estado ni red.
 */

/** Contextos que el médico puede nombrar en voz alta. */
export const CONTEXTOS_UCI = [
  'respiratorio',
  'hemodinamico',
  'prisma',
  'ecmo',
] as const
export type ContextoUci = (typeof CONTEXTOS_UCI)[number]

/**
 * Cómo el médico NOMBRA cada contexto al dictar. Son las palabras que él usa
 * («Prisma» por CKRT), no nombres técnicos que nadie dice en voz alta.
 */
export const DISPARADORES_CONTEXTO: Record<ContextoUci, readonly string[]> = {
  respiratorio: ['respiratorio', 'ventilacion', 'ventilatorio', 'ventilador'],
  hemodinamico: ['hemodinamico', 'hemodinamia', 'hemodinámico'],
  prisma: ['prisma', 'ckrt', 'crrt', 'terapia continua', 'hemofiltracion'],
  ecmo: ['ecmo', 'oxigenacion extracorporea'],
}

/**
 * Vocabulario activo por contexto — LITERAL del charter §8.
 *
 * ⚠️ Cada lista es la del médico dueño, palabra por palabra. No se añadió, quitó
 * ni "mejoró" ningún término.
 */
export const VOCABULARIO_POR_CONTEXTO: Record<ContextoUci, readonly string[]> = {
  // §8 · «Si dice Respiratorio, activar diccionario:»
  respiratorio: [
    'PEEP', 'PIP', 'Pplat', 'VT', 'FiO2',
    'driving pressure', 'compliance', 'auto-PEEP', 'flow', 'trigger', 'I:E', 'PS',
  ],
  // §8 · «Si dice Hemodinámico, activar:»
  hemodinamico: [
    'MAP', 'PAM', 'norepi', 'noradrenalina', 'vasopresina', 'dobutamina',
    'milrinona', 'VTI', 'SV', 'CI', 'CRT', 'ScvO2',
  ],
  // §8 · «Si dice Prisma, activar:»
  prisma: [
    'CVVH', 'CVVHD', 'CVVHDF', 'Qb', 'dialysate', 'replacement',
    'prefilter', 'postfilter', 'effluent', 'UF', 'citrate', 'calcium', 'filter', 'TMP',
  ],
  // §8 · «Si dice ECMO, activar:»
  ecmo: [
    'VV', 'VA', 'flow', 'RPM', 'sweep', 'FdO2',
    'pre-oxygenator', 'post-oxygenator', 'delta P', 'recirculation', 'differential hypoxemia',
  ],
}

/** Normaliza para comparar: minúsculas, sin acentos, sin puntuación de separación. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_/:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta el contexto que el médico acaba de nombrar.
 *
 * Devuelve `null` si no nombró ninguno: **el contexto no se adivina** del
 * contenido. Inferirlo de las palabras que aparecen sería circular — el contexto
 * existe justamente para desempatar palabras ambiguas, así que deducirlo de
 * ellas le quitaría todo su valor.
 */
export function contextoDicho(frase: string): ContextoUci | null {
  const n = normalizar(frase)
  for (const contexto of CONTEXTOS_UCI) {
    for (const disparador of DISPARADORES_CONTEXTO[contexto]) {
      const d = normalizar(disparador)
      // Límite de palabra: «prisma» no debe activarse dentro de otra palabra.
      if (new RegExp(`(^|\\s)${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(n)) {
        return contexto
      }
    }
  }
  return null
}

/** ¿Este término pertenece al vocabulario del contexto? */
export function perteneceAlContexto(termino: string, contexto: ContextoUci): boolean {
  const t = normalizar(termino)
  return VOCABULARIO_POR_CONTEXTO[contexto].some(v => normalizar(v) === t)
}

/** Contextos en los que aparece un término. Vacío si no está en ninguno. */
export function contextosDe(termino: string): ContextoUci[] {
  return CONTEXTOS_UCI.filter(c => perteneceAlContexto(termino, c))
}

/**
 * Señal `contextoConcuerda` para `confirmacion.ts`.
 *
 * Fail-open a propósito cuando NO hay contexto activo: sin contexto declarado no
 * se puede afirmar que algo lo contradice, y devolver `false` haría preguntar por
 * todo desde el primer término. La ambigüedad se seguirá cazando por las otras
 * señales (confianza, candidato cercano, plausibilidad).
 *
 * Un término que no está en NINGÚN vocabulario tampoco contradice nada: puede
 * ser narrativa perfectamente legítima.
 */
export function contextoConcuerda(termino: string, contextoActivo: ContextoUci | null): boolean {
  if (contextoActivo === null) return true
  const suyos = contextosDe(termino)
  if (suyos.length === 0) return true
  return suyos.includes(contextoActivo)
}

/**
 * Términos que aparecen en MÁS de un contexto y por eso siguen siendo ambiguos
 * aunque haya contexto activo.
 *
 * Se calcula del propio vocabulario, no se escribe a mano: si mañana un término
 * entra en dos listas, aparece aquí solo.
 */
export function terminosMultiContexto(): { termino: string; contextos: ContextoUci[] }[] {
  const vistos = new Map<string, ContextoUci[]>()
  for (const c of CONTEXTOS_UCI) {
    for (const t of VOCABULARIO_POR_CONTEXTO[c]) {
      const clave = normalizar(t)
      const l = vistos.get(clave)
      if (l) l.push(c); else vistos.set(clave, [c])
    }
  }
  return [...vistos.entries()]
    .filter(([, cs]) => cs.length > 1)
    .map(([termino, contextos]) => ({ termino, contextos }))
}
