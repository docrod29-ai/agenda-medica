/**
 * LÍMITES POR FÁRMACO E INDICACIÓN — los carga el médico, no el software.
 *
 * Es lo único que le falta al motor V4 para poder juzgar una cifra. El kernel
 * ya sabe decidir; lo que no tiene son los topes, y **esos no se inventan**:
 * escribir aquí un número de memoria daría un motor que bloquea y autoriza
 * dosis con toda la seguridad del mundo y sin que nadie lo haya comprobado.
 *
 * ── LA REGLA QUE ORDENA ESTE ARCHIVO ─────────────────────────────────────────
 *
 * **Ningún límite sin fuente.** No es burocracia: un tope sin procedencia no se
 * puede rebatir. Cuando la app bloquee una dosis a las tres de la mañana, el
 * intensivista tiene que poder ver de dónde sale el número y decidir si aplica a
 * su paciente — y si no puede verlo, va a aprender a saltárselo.
 *
 * ── POR QUÉ ES POR INDICACIÓN Y NO POR FÁRMACO ───────────────────────────────
 *
 * Porque ahí está el error conceptual entero. Ceftriaxona tiene un tope en una
 * neumonía y otro en una meningitis, y son el mismo fármaco. Un límite por
 * fármaco obliga a elegir uno de los dos, y cualquiera de los dos está mal la
 * mitad de las veces.
 *
 * `'*'` significa «cualquier indicación» y sirve de red: se usa sólo cuando no
 * hay uno específico, nunca por encima de él.
 *
 * Módulo PURO.
 */

import type { LimitesDosis, TipoMaximo } from '@/lib/antimicrobianos/v4/tipos'

/** Indicación comodín: aplica cuando no hay una entrada específica. */
export const CUALQUIER_INDICACION = '*'

export interface LimiteCargado {
  /** Nombre exacto del fármaco en el catálogo verificado. */
  farmaco: string
  /** Indicación, o `'*'`. Se compara sin distinguir mayúsculas ni acentos. */
  indicacion: string
  limites: LimitesDosis
  /**
   * De dónde sale. **Obligatoria.**
   *
   * Un tope sin procedencia no se puede rebatir, y una alerta que no se puede
   * rebatir se acaba ignorando.
   */
  fuente: string
  /** Quién lo cargó. Tiene valor de auditoría. */
  cargadoPor: string
  /** ISO-8601. */
  cargadoEn: string
  /**
   * Huella del dataset con la que se cargó.
   *
   * Si el dataset cambia, el límite queda marcado como CADUCADO en vez de seguir
   * pasando por vigente: un tope validado contra otra versión de los datos ya no
   * dice lo que dice.
   */
  huellaDataset: string
}

const norm = (s: string): string =>
  (s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/* ════════════════════════════════════════════════════════════════════════
   Revisión de una entrada antes de guardarla
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Qué está mal en esta entrada. Vacío = se puede guardar.
 *
 * Las comprobaciones son de COHERENCIA INTERNA, no clínicas: que los topes vayan
 * en orden, que las cifras sean positivas y que haya fuente. Nada de esto opina
 * sobre si el número es el correcto — eso lo firma quien lo carga.
 */
export function revisar(e: Partial<LimiteCargado>): string[] {
  const problemas: string[] = []
  if (!e.farmaco?.trim()) problemas.push('Falta el fármaco.')
  if (!e.indicacion?.trim()) problemas.push('Falta la indicación (usa * para «cualquiera»).')
  if (!e.fuente?.trim()) problemas.push('Falta la fuente. Un tope sin procedencia no se puede rebatir.')

  const L = e.limites
  if (!L) { problemas.push('Faltan los límites.'); return problemas }

  const cifras: [string, number | undefined][] = [
    ['máximo habitual por dosis', L.usualMaxPorDosis],
    ['máximo habitual al día', L.usualMaxPorDia],
    ['máximo del contexto por dosis', L.contextualMaxPorDosis],
    ['máximo del contexto al día', L.contextualMaxPorDia],
    ['máximo absoluto por dosis', L.absolutoMaxPorDosis],
    ['máximo absoluto al día', L.absolutoMaxPorDia],
  ]
  for (const [nombre, v] of cifras) {
    if (v !== undefined && !(Number.isFinite(v) && v > 0)) problemas.push(`El ${nombre} tiene que ser un número mayor que cero.`)
  }
  if (cifras.every(([, v]) => v === undefined) && L.tipoMaximo !== 'NONE') {
    problemas.push('No hay ninguna cifra. Si de verdad no hay tope declarado, marca el tipo como NONE.')
  }

  /**
   * El orden. Un habitual por encima del contextual, o un contextual por encima
   * del absoluto, es una entrada incoherente — casi siempre un dedazo, y un
   * dedazo aquí invierte el significado de la alerta: lo que tenía que avisar
   * bloquea y lo que tenía que bloquear pasa.
   */
  const ordenar = (a?: number, b?: number, na = '', nb = '') => {
    if (a !== undefined && b !== undefined && a > b) problemas.push(`El ${na} (${a}) no puede ser mayor que el ${nb} (${b}).`)
  }
  ordenar(L.usualMaxPorDosis, L.contextualMaxPorDosis, 'máximo habitual por dosis', 'máximo del contexto por dosis')
  ordenar(L.contextualMaxPorDosis, L.absolutoMaxPorDosis, 'máximo del contexto por dosis', 'máximo absoluto por dosis')
  ordenar(L.usualMaxPorDia, L.contextualMaxPorDia, 'máximo habitual al día', 'máximo del contexto al día')
  ordenar(L.contextualMaxPorDia, L.absolutoMaxPorDia, 'máximo del contexto al día', 'máximo absoluto al día')
  ordenar(L.usualMaxPorDosis, L.usualMaxPorDia, 'máximo habitual por dosis', 'máximo habitual al día')

  if (!L.unidad?.trim() && L.tipoMaximo !== 'NONE') {
    problemas.push('Falta la unidad. Una cifra sin unidad no se puede comparar con nada.')
  }
  return problemas
}

/* ════════════════════════════════════════════════════════════════════════
   Búsqueda
   ════════════════════════════════════════════════════════════════════════ */

export interface Encontrado {
  limite: LimiteCargado
  /** `true` si se aplicó el comodín porque no había entrada específica. */
  porComodin: boolean
  /** `true` si el dataset cambió desde que se cargó: el tope ya no dice lo que decía. */
  caducado: boolean
}

/**
 * Busca el límite para este fármaco y esta indicación.
 *
 * Lo específico gana siempre sobre el comodín. Si sólo existe el comodín se usa
 * y **se dice**, porque «el tope general de ceftriaxona» y «el tope de
 * ceftriaxona en meningitis» no son la misma afirmación y el médico tiene que
 * saber cuál está viendo.
 */
export function limitesDe(
  cargados: readonly LimiteCargado[], farmaco: string, indicacion: string | undefined,
  huellaActual?: string,
): Encontrado | null {
  const f = norm(farmaco)
  const i = norm(indicacion ?? '')
  const mios = cargados.filter(c => norm(c.farmaco) === f)
  if (mios.length === 0) return null

  const especifico = i ? mios.find(c => norm(c.indicacion) === i) : undefined
  const comodin = mios.find(c => c.indicacion.trim() === CUALQUIER_INDICACION)
  const elegido = especifico ?? comodin
  if (!elegido) return null

  return {
    limite: elegido,
    porComodin: !especifico,
    caducado: huellaActual !== undefined && elegido.huellaDataset !== huellaActual,
  }
}

/**
 * ¿Se puede usar este límite para decidir?
 *
 * Un límite caducado NO se usa: mejor que el kernel responda «no lo sé» a que
 * juzgue una dosis con un tope validado contra otra versión de los datos.
 */
export function utilizable(e: Encontrado | null): LimitesDosis | undefined {
  if (!e || e.caducado) return undefined
  return e.limite.limites
}

/** Cuántos fármacos del catálogo tienen ya algún límite cargado. */
export function avance(cargados: readonly LimiteCargado[], totalFarmacos: number): {
  conLimite: number; total: number; porcentaje: number
} {
  const conLimite = new Set(cargados.map(c => norm(c.farmaco))).size
  return {
    conLimite,
    total: totalFarmacos,
    porcentaje: totalFarmacos > 0 ? Math.round((conLimite / totalFarmacos) * 100) : 0,
  }
}

export const TIPOS_MAXIMO: readonly { valor: TipoMaximo; etiqueta: string; ayuda: string }[] = [
  { valor: 'EXPLICIT', etiqueta: 'Explícito', ayuda: 'La ficha o la guía dice un número.' },
  { valor: 'CONTEXTUAL', etiqueta: 'Contextual', ayuda: 'Depende de la indicación, el sitio o el organismo.' },
  { valor: 'PKPD_DEPENDENT', etiqueta: 'Depende del PK/PD', ayuda: 'Lo fija el objetivo, no una tabla.' },
  { valor: 'TDM_DEPENDENT', etiqueta: 'Depende del TDM', ayuda: 'Lo fija la concentración medida.' },
  { valor: 'NONE', etiqueta: 'Sin tope declarado', ayuda: 'La evidencia no declara máximo para este contexto.' },
]

export const POR_QUE_NINGUN_LIMITE_SIN_FUENTE =
  'Un tope sin procedencia no se puede rebatir. Cuando la aplicación bloquee una ' +
  'dosis a las tres de la mañana, el intensivista tiene que poder ver de dónde ' +
  'sale el número y decidir si aplica a su paciente. Si no puede verlo, va a ' +
  'aprender a saltárselo — y entonces la alerta ya no protege a nadie.'
