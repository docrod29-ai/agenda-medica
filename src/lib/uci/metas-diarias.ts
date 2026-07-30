/**
 * METAS DIARIAS — charter §35.
 *
 *   «Registrar: MAP target · RASS target · fluid balance target · ventilator
 *    goals · nutrition goal · mobility · antibiotics · devices.
 *
 *    El copiloto compara datos contra objetivos definidos.
 *    **No inventar objetivos.**»
 *
 * ── LA REGLA QUE ORGANIZA TODO EL MÓDULO ─────────────────────────────────────
 *
 * **Un objetivo sin médico que lo fije NO EXISTE.** No hay valores por defecto,
 * ni «rangos habituales», ni sugerencias. Una MAP objetivo de 65 es razonable en
 * muchos pacientes y equivocada en un hipertenso crónico o en un paciente
 * neurocrítico con presión de perfusión comprometida — y el módulo no sabe cuál
 * tiene enfrente.
 *
 * Por eso `fijadaPor` y `fijadaEn` son obligatorios en el tipo: una meta sin
 * autor no se puede construir.
 *
 * ── QUÉ DESBLOQUEA ───────────────────────────────────────────────────────────
 *
 * La sección «PENDIENTE» del Morning Brief (§30) estaba vacía y declarada como
 * vacía justamente porque los pendientes necesitan metas u órdenes abiertas.
 * Este módulo las aporta: un objetivo NO cumplido es un pendiente con dato real
 * detrás, que es lo que el charter exige.
 *
 * Módulo PURO.
 */

/** Los ocho dominios del §35, en su orden. */
export const DOMINIOS_META = [
  'map',
  'rass',
  'balance_hidrico',
  'ventilacion',
  'nutricion',
  'movilidad',
  'antibioticos',
  'dispositivos',
] as const
export type DominioMeta = (typeof DOMINIOS_META)[number]

export const DOMINIO_META_LABEL: Record<DominioMeta, string> = {
  map: 'PAM objetivo',
  rass: 'RASS objetivo',
  balance_hidrico: 'Balance hídrico objetivo',
  ventilacion: 'Objetivos de ventilación',
  nutricion: 'Objetivo nutricional',
  movilidad: 'Movilización',
  antibioticos: 'Antimicrobianos',
  dispositivos: 'Dispositivos invasivos',
}

/**
 * Cómo se expresa el objetivo.
 *
 * `rango` y `umbral` se pueden comparar contra un número; `tarea` es cualitativa
 * («sentar al borde de la cama», «retirar CVC») y sólo se marca hecha o no.
 */
export type FormaObjetivo =
  | { tipo: 'rango'; min: number; max: number; unidad?: string }
  | { tipo: 'umbral'; direccion: 'al_menos' | 'como_mucho'; valor: number; unidad?: string }
  | { tipo: 'tarea'; descripcion: string }

/**
 * Una meta del día. `fijadaPor` y `fijadaEn` son OBLIGATORIOS: sin autor, no es
 * una meta — es una suposición.
 */
export interface MetaDiaria {
  id: string
  dominio: DominioMeta
  objetivo: FormaObjetivo
  fijadaPor: string
  fijadaEn: string
  /** Para tareas: si ya se hizo, con quién y cuándo. */
  completadaPor?: string
  completadaEn?: string
  nota?: string
}

export type EstadoMeta = 'cumplida' | 'no_cumplida' | 'sin_dato' | 'pendiente'

export interface EvaluacionMeta {
  meta: MetaDiaria
  estado: EstadoMeta
  /** Valor medido con el que se comparó. */
  medido?: number
  /** Frase lista para la pantalla. */
  mensaje: string
}

/**
 * Compara UNA meta contra el valor medido.
 *
 * @param medido `undefined` ⇒ `sin_dato`. **No se asume cumplimiento**: una meta
 *   sin medición no está cumplida ni incumplida, y decir cualquiera de las dos
 *   sería inventar. Es la misma distinción que en el motor de dato faltante.
 */
export function evaluarMeta(meta: MetaDiaria, medido?: number): EvaluacionMeta {
  const etiqueta = DOMINIO_META_LABEL[meta.dominio]

  if (meta.objetivo.tipo === 'tarea') {
    const hecha = meta.completadaEn !== undefined && meta.completadaEn !== ''
    return {
      meta,
      estado: hecha ? 'cumplida' : 'pendiente',
      mensaje: hecha
        ? `${etiqueta}: ${meta.objetivo.descripcion} — hecho.`
        : `${etiqueta}: ${meta.objetivo.descripcion} — pendiente.`,
    }
  }

  if (medido === undefined || !Number.isFinite(medido)) {
    return {
      meta, estado: 'sin_dato',
      mensaje: `${etiqueta}: sin medición para comparar contra el objetivo.`,
    }
  }

  const u = meta.objetivo.unidad !== undefined ? ` ${meta.objetivo.unidad}` : ''

  if (meta.objetivo.tipo === 'rango') {
    const dentro = medido >= meta.objetivo.min && medido <= meta.objetivo.max
    return {
      meta, estado: dentro ? 'cumplida' : 'no_cumplida', medido,
      mensaje: `${etiqueta} ${meta.objetivo.min}–${meta.objetivo.max}${u}: medido ${medido}${u}${dentro ? '' : ' — fuera de objetivo'}.`,
    }
  }

  const cumple = meta.objetivo.direccion === 'al_menos'
    ? medido >= meta.objetivo.valor
    : medido <= meta.objetivo.valor
  const signo = meta.objetivo.direccion === 'al_menos' ? '≥' : '≤'
  return {
    meta, estado: cumple ? 'cumplida' : 'no_cumplida', medido,
    mensaje: `${etiqueta} ${signo} ${meta.objetivo.valor}${u}: medido ${medido}${u}${cumple ? '' : ' — fuera de objetivo'}.`,
  }
}

/** Evalúa todas las metas contra las mediciones disponibles. */
export function evaluarMetas(
  metas: readonly MetaDiaria[],
  medidos: Readonly<Record<string, number | undefined>>,
): EvaluacionMeta[] {
  return metas.map(m => evaluarMeta(m, medidos[m.dominio]))
}

/**
 * Los PENDIENTES del Morning Brief (§30), con dato real detrás.
 *
 * Incluye lo NO cumplido y las tareas sin hacer. **NO incluye `sin_dato`**: una
 * meta sin medición no es un incumplimiento — es un hueco de documentación, y
 * mezclarlos haría que un objetivo cumplido pero no registrado apareciera como
 * fallo del tratamiento.
 */
export function pendientesDelBrief(evs: readonly EvaluacionMeta[]): string[] {
  return evs
    .filter(e => e.estado === 'no_cumplida' || e.estado === 'pendiente')
    .map(e => e.mensaje)
}

/** Metas sin medición: es la lista de qué falta capturar, no de qué falla. */
export function sinMedicion(evs: readonly EvaluacionMeta[]): EvaluacionMeta[] {
  return evs.filter(e => e.estado === 'sin_dato')
}

/** Dominios del §35 para los que HOY no hay ninguna meta fijada. */
export function dominiosSinMeta(metas: readonly MetaDiaria[]): DominioMeta[] {
  const conMeta = new Set(metas.map(m => m.dominio))
  return DOMINIOS_META.filter(d => !conMeta.has(d))
}

/**
 * Mensaje único cuando no hay metas. La pantalla debe decir que **nadie las
 * fijó**, no quedarse en blanco: un blanco se lee como «todo en orden».
 */
export const SIN_METAS_FIJADAS =
  'No hay metas fijadas para hoy. El sistema NO propone objetivos: una PAM o un ' +
  'RASS objetivo dependen del paciente, y los fija el médico tratante (charter §35).'
