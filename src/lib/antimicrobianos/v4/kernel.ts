/**
 * SAFETY KERNEL V4 — decide si una dosis pasa, avisa o se detiene.
 *
 * Capa 5 de la arquitectura. Es lo que sustituye a `if (dose > drug.maxDose)`.
 *
 * ── LA DECISIÓN DE DISEÑO QUE LO ORDENA TODO ─────────────────────────────────
 *
 * **Faltar un dato no es lo mismo que estar mal.** Son dos respuestas distintas
 * y el sistema tiene que darlas por separado:
 *
 *   · Amikacina sin peso ni función renal → no se puede calcular. No es una
 *     dosis peligrosa: es una pregunta sin responder. `BLOCK_INSUFFICIENT_DATA`.
 *   · Colistina «150 mg» sin decir si son CBA o CMS → la misma cifra significa
 *     dos dosis distintas. Tampoco es una dosis alta: es una unidad ambigua.
 *   · Ceftriaxona 2 g q12h en meningitis → está por encima de lo habitual y es
 *     correcta. `VALID_HIGH_DOSE`, no una alarma.
 *
 * Un motor que responde «error» a los tres enseña a ignorarlo. Un motor que
 * responde «no lo sé» cuando no lo sabe se puede seguir creyendo cuando dice que
 * algo está mal.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No inventa ni un umbral. Todos los números salen de `LimitesDosis`, que a su
 * vez sale del dataset verificado. Si el límite no está declarado, el veredicto
 * es `UNKNOWN_INSUFFICIENT_DATA` — nunca «probablemente está bien».
 *
 * Módulo PURO.
 */

import type {
  Alerta, EstadoSeguridad, LimitesDosis, PeticionDosis, Veredicto,
} from '@/lib/antimicrobianos/v4/tipos'

/** Lo que el médico quiere administrar. */
export interface DosisPropuesta {
  /** Cantidad por toma, en la unidad del fármaco. */
  porDosis?: number
  /** Tomas al día. */
  tomasPorDia?: number
  unidad?: string
  /** mg/kg. Necesita peso documentado. */
  porKg?: number
}

/** Lo que aporta la capa que resolvió la regla. */
export interface ContextoResolucion {
  limites?: LimitesDosis
  fuentes?: readonly string[]
  nivelVerificacion?: string
  /** ¿La pauta elegida viene de guía/PK-PD y no de la ficha? */
  origen?: 'label' | 'guideline' | 'pkpd' | 'off_label_respaldado'
  /** Datos que la regla exige y no se aportaron. */
  exige?: readonly string[]
}

/* ════════════════════════════════════════════════════════════════════════
   Puertas duras: lo que se responde ANTES de mirar ninguna cifra
   ════════════════════════════════════════════════════════════════════════ */

/** Unidades que significan cosas distintas con el mismo número. */
const UNIDADES_AMBIGUAS: Record<string, readonly string[]> = {
  // Colistina: 150 mg de base de colistina no son 150 mg de colistimetato, ni
  // 150 mg son las UI con que se etiqueta en buena parte del mundo.
  colistina: ['CBA', 'CMS', 'UI'],
  colistimetato: ['CBA', 'CMS', 'UI'],
  'colistimethate sodium (colistin)': ['CBA', 'CMS', 'UI'],
  'polymyxin b': ['UI', 'mg'],
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

/**
 * ¿La unidad de este fármaco es ambigua y no se declaró cuál es?
 *
 * Se comprueba antes que nada: una cifra cuya unidad no se sabe no se puede
 * comparar contra ningún máximo, y compararla igual daría un veredicto con
 * aspecto de exacto.
 */
export function unidadAmbigua(p: PeticionDosis, d: DosisPropuesta): string[] {
  const f = norm(p.farmaco)
  const clave = Object.keys(UNIDADES_AMBIGUAS).find(k => f.includes(k))
  if (!clave) return []
  const declarada = norm(d.unidad)
  const validas = UNIDADES_AMBIGUAS[clave]
  if (validas.some(u => declarada === norm(u))) return []
  return [`unidad (${validas.join(' / ')})`]
}

/** Qué falta para poder calcular. Se pregunta ANTES de juzgar la cifra. */
export function datosQueFaltan(
  p: PeticionDosis, d: DosisPropuesta, ctx: ContextoResolucion = {},
): string[] {
  const faltan: string[] = []

  // Dosis por kilo sin peso documentado: RULE_WEIGHT.
  if (d.porKg !== undefined && !(p.paciente?.pesoKg && p.paciente.pesoKg > 0)) {
    faltan.push('peso documentado en kg')
  }

  // Sin ninguna medida de función renal no hay ajuste posible para los que lo
  // exigen. Se pide lo que la regla declare, no lo que a mí me parezca.
  for (const e of ctx.exige ?? []) faltan.push(e)

  faltan.push(...unidadAmbigua(p, d))

  return [...new Set(faltan)]
}

/* ════════════════════════════════════════════════════════════════════════
   El veredicto
   ════════════════════════════════════════════════════════════════════════ */

const totalDiario = (d: DosisPropuesta): number | undefined =>
  d.porDosis !== undefined && d.tomasPorDia !== undefined ? d.porDosis * d.tomasPorDia : undefined

/**
 * Juzga una dosis contra los límites que la regla resolvió.
 *
 * El orden importa y no es negociable:
 *   1. ¿Falta un dato? → no se juzga la cifra.
 *   2. ¿Hay límites declarados? → si no, `UNKNOWN`, nunca «pasa».
 *   3. ¿Supera el absoluto? → BLOCK.
 *   4. ¿Supera el contextual? → BLOCK con el contexto en el mensaje.
 *   5. ¿Supera el habitual? → clasificar por ORIGEN, no por magnitud.
 */
export function evaluar(
  p: PeticionDosis, d: DosisPropuesta, ctx: ContextoResolucion = {},
): Veredicto {
  const alertas: Alerta[] = []
  const base = {
    fuentes: ctx.fuentes ?? [],
    nivelVerificacion: ctx.nivelVerificacion,
  }

  // 1. Un dato que falta no es una dosis peligrosa: es una pregunta sin responder.
  const faltan = datosQueFaltan(p, d, ctx)
  if (faltan.length > 0) {
    return {
      estado: 'UNKNOWN_INSUFFICIENT_DATA',
      datosFaltantes: faltan,
      alertas: [{
        nivel: 'BLOCK',
        codigo: 'DATOS_INSUFICIENTES',
        mensaje: `No se puede resolver la dosis sin: ${faltan.join(', ')}.`,
        regla: 'RULE_HUMAN_OVERSIGHT',
      }],
      ...base,
    }
  }

  // 2. Sin límites declarados no se afirma que una dosis sea correcta.
  const L = ctx.limites
  if (!L || L.tipoMaximo === 'NONE') {
    return {
      estado: L ? 'SPECIALIST_REVIEW' : 'UNKNOWN_INSUFFICIENT_DATA',
      datosFaltantes: L ? [] : ['regla de dosis verificada para este contexto'],
      alertas: [{
        nivel: 'BLOCK',
        codigo: L ? 'SIN_MAXIMO_DECLARADO' : 'SIN_REGLA',
        mensaje: L
          ? 'La evidencia disponible no declara un máximo para este contexto. Requiere valoración de infectología.'
          : 'No hay una regla verificada para este fármaco en este contexto.',
        regla: 'RULE_HUMAN_OVERSIGHT',
      }],
      ...base,
    }
  }

  const dia = totalDiario(d)
  const sup = (valor?: number, tope?: number) => valor !== undefined && tope !== undefined && valor > tope

  // 3. El techo duro.
  if (sup(d.porDosis, L.absolutoMaxPorDosis) || sup(dia, L.absolutoMaxPorDia)) {
    return {
      estado: 'BLOCK_CONTEXTUAL_MAX',
      datosFaltantes: [],
      alertas: [{
        nivel: 'BLOCK',
        codigo: 'SUPERA_MAXIMO_ABSOLUTO',
        mensaje: `Supera el máximo absoluto declarado (${L.absolutoMaxPorDosis ?? '—'} por dosis · ${L.absolutoMaxPorDia ?? '—'} al día${L.unidad ? ' ' + L.unidad : ''}).`,
      }],
      ...base,
    }
  }

  // 4. El máximo de ESTE contexto.
  if (sup(d.porDosis, L.contextualMaxPorDosis) || sup(dia, L.contextualMaxPorDia)) {
    return {
      estado: 'BLOCK_CONTEXTUAL_MAX',
      datosFaltantes: [],
      alertas: [{
        nivel: 'BLOCK',
        codigo: 'SUPERA_MAXIMO_CONTEXTUAL',
        mensaje: `Supera el máximo para ${p.indicacion ?? 'esta indicación'}`
          + `${p.sitioInfeccion ? ` (${p.sitioInfeccion})` : ''}: `
          + `${L.contextualMaxPorDosis ?? '—'} por dosis · ${L.contextualMaxPorDia ?? '—'} al día${L.unidad ? ' ' + L.unidad : ''}.`,
      }],
      ...base,
    }
  }

  // 5. Por encima de lo habitual. Aquí es donde un `maxDose` se equivocaba.
  const encimaDeLoUsual = sup(d.porDosis, L.usualMaxPorDosis) || sup(dia, L.usualMaxPorDia)
  if (encimaDeLoUsual) {
    /**
     * Lo que decide el veredicto es de dónde viene la pauta, NO cuánto se pasa.
     *
     * Daptomicina 10 mg/kg/día está por encima de la ficha y es una dosis alta
     * respaldada; meropenem 2 g q8h en 3 h con ARC es optimización PK/PD. Las
     * dos «superan lo usual» y ninguna es un error. Clasificarlas por magnitud
     * las mete en el mismo cajón que un error de tecleo.
     */
    const porOrigen: Record<string, EstadoSeguridad> = {
      guideline: 'VALID_HIGH_DOSE',
      pkpd: 'VALID_PKPD_OPTIMIZED',
      off_label_respaldado: 'VALID_OFF_LABEL_SUPPORTED',
    }
    const estado = porOrigen[ctx.origen ?? ''] ?? 'WARN_ABOVE_USUAL'
    alertas.push({
      nivel: estado === 'WARN_ABOVE_USUAL' ? 'WARN' : 'INFO',
      codigo: 'ENCIMA_DE_LO_USUAL',
      mensaje: estado === 'WARN_ABOVE_USUAL'
        ? `Por encima de lo habitual (${L.usualMaxPorDosis ?? '—'} por dosis · ${L.usualMaxPorDia ?? '—'} al día${L.unidad ? ' ' + L.unidad : ''}) y sin una pauta de guía o PK/PD que lo respalde en este contexto.`
        : `Por encima de lo habitual, respaldado por ${ctx.origen === 'pkpd' ? 'objetivo PK/PD' : ctx.origen === 'guideline' ? 'guía' : 'evidencia off-label'}. No es una sobredosis.`,
    })
    return { estado, datosFaltantes: [], alertas, ...base }
  }

  // Dentro de lo habitual. Si la pauta no es la de la ficha, se DICE — que la
  // app y la ficha difieran es información, no algo que esconder.
  if (ctx.origen && ctx.origen !== 'label') {
    alertas.push({
      nivel: 'INFO',
      codigo: 'DIFIERE_DE_FICHA',
      mensaje: 'Pauta de guía / PK-PD; puede diferir de la ficha regulatoria.',
      regla: 'RULE_SOURCE_SEPARATION',
    })
  }
  return { estado: 'VALID_STANDARD', datosFaltantes: [], alertas, ...base }
}

/** ¿Este veredicto deja prescribir? */
export function dejaPasar(v: Veredicto): boolean {
  return !v.alertas.some(a => a.nivel === 'BLOCK')
}

export const POR_QUE_FALTAR_UN_DATO_NO_ES_ESTAR_MAL =
  'Amikacina sin peso no es una dosis peligrosa: es una pregunta sin responder. ' +
  'Colistina «150 mg» sin decir CBA o CMS no es una dosis alta: es una unidad ' +
  'ambigua. Y ceftriaxona 2 g q12h en meningitis está por encima de lo habitual ' +
  'y es correcta. Un motor que contesta «error» a las tres enseña a ignorarlo; ' +
  'uno que dice «no lo sé» cuando no lo sabe se puede seguir creyendo cuando ' +
  'dice que algo está mal.'
