/**
 * Reconciliación DICTADO ↔ CALCULADO — charter §24.
 *
 *   «Si el médico dicta "Driving pressure 20" pero Pplat 22 y PEEP 8, el motor
 *    determinista obtiene 14. **No sobrescribir.** Mostrar:
 *
 *        Inconsistencia detectada.
 *        Dictado:   20 cmH₂O
 *        Calculado: 14 cmH₂O
 *
 *    Solicitar revisión. Esto es una función de enorme valor.»
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y ES LO IMPORTANTE ───────────────────────────
 *
 * **No decide quién tiene razón.** Ni el dictado ni el cálculo ganan
 * automáticamente, y por eso `reconciliar` no devuelve «el valor bueno»: devuelve
 * los DOS con su origen. Elegir por el médico sería exactamente el error que la
 * decisión transversal §4 prohíbe (el LLM no decide hechos clínicos), y aquí ni
 * siquiera hay un LLM: hay dos números que no cuadran y una persona que sabe por
 * qué.
 *
 * Las dos direcciones de error son reales:
 *  · el dictado puede venir mal transcrito («veinte» por «catorce»);
 *  · el cálculo puede estar hecho con una Pplat vieja, o con esfuerzo
 *    espontáneo, donde la Pplateau NO es interpretable.
 *
 * Un módulo que eligiera solo escondería la mitad de los casos.
 *
 * ── SOBRE LA TOLERANCIA ──────────────────────────────────────────────────────
 *
 * La tolerancia por defecto es **0.5**, y NO es un umbral clínico: es la mitad
 * de una unidad, es decir el error máximo de redondear a entero. Un médico que
 * dicta «catorce» puede estar leyendo 13.7 en el ventilador. Cualquier
 * tolerancia MAYOR sí sería una decisión clínica, y por eso hay que pasarla
 * explícitamente.
 *
 * Módulo PURO. Sin reloj, sin red, sin LLM.
 */

/** De dónde salió cada número. Se conserva: es la mitad de la información. */
export type OrigenValor = 'dictado' | 'calculado'

export type VeredictoReconciliacion =
  /** Coinciden dentro de la tolerancia de redondeo. */
  | 'concuerdan'
  /** No coinciden. NO se elige ganador: se pide revisión. */
  | 'discrepan'
  /** Falta uno de los dos: no hay nada que reconciliar. */
  | 'incomparable'

export interface Reconciliacion {
  campo: string
  veredicto: VeredictoReconciliacion
  dictado: number | null
  calculado: number | null
  unidad: string
  /** |dictado − calculado|, o `null` si falta alguno. */
  diferencia: number | null
  tolerancia: number
  /** Qué le falta para poder compararse (sólo en `incomparable`). */
  motivoIncomparable?: 'falta_dictado' | 'falta_calculado' | 'valor_no_finito' | 'faltan_ambos'
  /**
   * Mensaje ya redactado, para que ninguna pantalla improvise el encuadre.
   * Nunca dice cuál es correcto — dice que no cuadran.
   */
  mensaje: string
}

/**
 * Compara un valor dictado con el que deriva el motor determinista.
 *
 * @param tolerancia Sólo la mitad de una unidad por defecto (error de redondeo).
 *   Un valor mayor es una decisión clínica: pásalo explícito y documenta por qué.
 */
export function reconciliar(
  campo: string,
  dictado: number | null | undefined,
  calculado: number | null | undefined,
  unidad: string,
  tolerancia = 0.5,
): Reconciliacion {
  const base = { campo, unidad, tolerancia }

  const d = typeof dictado === 'number' && Number.isFinite(dictado) ? dictado : null
  const c = typeof calculado === 'number' && Number.isFinite(calculado) ? calculado : null

  if (d === null || c === null) {
    const motivo: Reconciliacion['motivoIncomparable'] =
      (dictado != null && d === null) || (calculado != null && c === null) ? 'valor_no_finito'
      // Ambos ausentes es su propio caso. Antes caía en `falta_dictado` y la
      // pantalla decía «sólo hay el valor calculado» cuando NO HABÍA NINGUNO:
      // el motor afirmaba que existía un dato que no existe. Se vio en la
      // primera pantalla real, con el paciente sin capturar nada.
      : d === null && c === null ? 'faltan_ambos'
      : d === null ? 'falta_dictado'
      : 'falta_calculado'
    return {
      ...base, veredicto: 'incomparable', dictado: d, calculado: c,
      diferencia: null, motivoIncomparable: motivo,
      mensaje: motivo === 'valor_no_finito'
        ? `${campo}: un valor no es un número válido; no se compara.`
        : motivo === 'faltan_ambos'
          ? `${campo}: no se dictó ni se puede calcular todavía; no hay nada que comparar.`
          : motivo === 'falta_dictado'
            ? `${campo}: no se dictó; sólo hay el valor calculado.`
            : `${campo}: no se puede calcular con los datos actuales; sólo hay el dictado.`,
    }
  }

  const diferencia = Math.abs(d - c)
  if (diferencia <= tolerancia) {
    return {
      ...base, veredicto: 'concuerdan', dictado: d, calculado: c, diferencia,
      mensaje: `${campo}: dictado y calculado coinciden (${c} ${unidad}).`,
    }
  }

  return {
    ...base, veredicto: 'discrepan', dictado: d, calculado: c, diferencia,
    // El encuadre del charter, literal: los dos valores y una petición de
    // revisión. Ninguna palabra sugiere cuál es el bueno.
    mensaje:
      `Inconsistencia detectada en ${campo}. ` +
      `Dictado: ${d} ${unidad} · Calculado: ${c} ${unidad}. ` +
      `Revisa cuál corresponde: no se sobrescribe ninguno.`,
  }
}

/**
 * Los pares que HOY se pueden reconciliar: valores que el médico dicta y que el
 * motor también sabe derivar de otros que ya capturó.
 *
 * La lista es corta a propósito. Añadir un par exige que el motor determinista
 * ya calcule ese valor — reconciliar contra una fórmula improvisada aquí sería
 * inventar el cálculo, no verificarlo.
 */
export const PARES_RECONCILIABLES = [
  {
    campo: 'driving pressure',
    unidad: 'cmH2O',
    derivadoDe: ['pplat', 'peep'],
    formula: 'Pplat − PEEP',
    motor: 'src/lib/uci/ventilacion.ts · drivingPressure()',
  },
  {
    campo: 'presión arterial media',
    unidad: 'mmHg',
    derivadoDe: ['ta'],
    formula: '(sistólica + 2 × diastólica) / 3',
    motor: 'src/lib/uci/hemodinamia.ts · presionArterialMedia()',
  },
  {
    campo: 'índice de Kirby (P/F)',
    unidad: '',
    derivadoDe: ['pao2', 'fio2'],
    formula: 'PaO₂ / FiO₂',
    motor: 'src/lib/uci/ventilacion.ts · indiceKirby()',
  },
] as const

export type CampoReconciliable = (typeof PARES_RECONCILIABLES)[number]['campo']

/** Sólo las discrepancias, para la lista de «requiere revisión» del charter §Q4. */
export function soloDiscrepancias(rs: readonly Reconciliacion[]): Reconciliacion[] {
  return rs.filter(r => r.veredicto === 'discrepan')
}

/**
 * Resumen para el pie de sección, siguiendo la regla ANTIFATIGA de la decisión
 * ICU-Q4.4: no se interrumpe por cada valor, se dice al final cuántos requieren
 * revisión.
 */
export function resumenRevision(rs: readonly Reconciliacion[]): string | null {
  const n = soloDiscrepancias(rs).length
  if (n === 0) return null
  return n === 1 ? '1 elemento requiere revisión.' : `${n} elementos requieren revisión.`
}
