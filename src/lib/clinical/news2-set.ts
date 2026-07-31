/**
 * NEWS2 sobre un CONJUNTO CONTEMPORÁNEO de observaciones.
 *
 * Decisión ICU-Q4.1 del médico dueño, 29-jul-2026:
 *
 *   «NO implementar TTL fijo de 4 horas ni Last Observation Carried Forward para
 *    fabricar un NEWS2 actual. NEWS2 debe calcularse sobre un conjunto
 *    CONTEMPORÁNEO de observaciones. Si una variable requerida no está
 *    disponible en ese set: NEWS2_STATUS = INCOMPLETE. No rellenarla
 *    automáticamente con el último dato histórico.»
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE, Y QUÉ CORRIGE ───────────────────────────────
 *
 * `observacion-version.ts` responde «¿cuál es el valor vigente de ESTA variable
 * en tal instante?», con un parámetro `ventanaMs`. Para un score compuesto eso
 * es **exactamente el TTL que la decisión rechaza**: con una ventana de 4 h, un
 * NEWS2 de las 12:00 podría armarse con una FR de las 08:10, una TA de las 09:40
 * y una SpO₂ de las 11:55 — seis variables de horas distintas presentadas como
 * un score de ahora. Ese número no describe a ningún paciente en ningún momento.
 *
 * La unidad de verdad de un score compuesto es la **toma**: las variables que se
 * midieron juntas. De ahí `observationSetId`.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No toca la fórmula. Los puntos de NEWS2 los calcula `hospital/news2.ts`
 * (Royal College, Scale 1 / Scale 2). La decisión es explícita: «la política
 * hospitalaria puede definir frecuencia de adquisición, pero NO modificar la
 * fórmula NEWS2». Aquí sólo se decide QUÉ observaciones entran.
 *
 * Módulo PURO: sin reloj, sin red. El instante entra por parámetro.
 */

import {
  esClinicamenteValida,
  type EstadoObservacion,
} from './observacion-version'

/** Estado del score, en vez de un número que finge estar completo. */
export type EstadoNews2 = 'COMPLETE' | 'INCOMPLETE' | 'NO_DATA'

/**
 * Las seis variables fisiológicas del NEWS2 (Royal College) más el oxígeno
 * suplementario.
 *
 * ⚠️ La lista NO se inventa aquí: es la del estándar, y la decisión prohíbe
 * modificar la fórmula. `oxigeno` es un modificador, no un séptimo parámetro
 * puntuado por sí mismo.
 */
export const VARIABLES_NEWS2 = ['fr', 'spo2', 'ta', 'fc', 'temp', 'conciencia'] as const
export type VariableNews2 = (typeof VARIABLES_NEWS2)[number]

/**
 * Una observación perteneciente a una TOMA. La forma que pide la decisión:
 * `observationSetId · measuredAt · status · source · correctedVersion`.
 */
export interface ObservacionDeSet {
  /** Agrupa las variables que se midieron JUNTAS. Es la unidad de verdad del score. */
  observationSetId: string
  /** Cuándo se MIDIÓ (no cuándo se capturó). Una corrección hereda la del original. */
  measuredAt: string
  status: EstadoObservacion
  /** De dónde vino: dictado, teclado, monitor, importación… */
  source: string
  /** id de la versión que ESTA corrige, si es una corrección. */
  correctedVersion?: string
  variable: VariableNews2 | 'oxigeno'
  valor: string | number | boolean
}

export interface SetContemporaneo {
  observationSetId: string
  /** La `measuredAt` más reciente del set. Es la hora que se muestra. */
  measuredAt: string
  /** Variables presentes y clínicamente válidas, ya resueltas las correcciones. */
  presentes: Partial<Record<VariableNews2 | 'oxigeno', string | number | boolean>>
  /** Variables del estándar que FALTAN en este set. Si hay alguna: INCOMPLETE. */
  faltantes: VariableNews2[]
  estado: EstadoNews2
}

/**
 * Agrupa observaciones en sus tomas y resuelve las correcciones DENTRO de cada
 * una.
 *
 * Una corrección no crea una toma nueva: pertenece a la misma
 * (`observationSetId` compartido) y desplaza a la versión que corrige.
 */
export function agruparEnSets(observaciones: readonly ObservacionDeSet[]): SetContemporaneo[] {
  const porSet = new Map<string, ObservacionDeSet[]>()
  for (const o of observaciones) {
    const lista = porSet.get(o.observationSetId)
    if (lista) lista.push(o); else porSet.set(o.observationSetId, [o])
  }

  const salida: SetContemporaneo[] = []

  for (const [observationSetId, todas] of porSet) {
    const validas = todas.filter(o => esClinicamenteValida(o.status))
    const presentes: SetContemporaneo['presentes'] = {}
    let measuredAt = ''

    // Por variable, gana la versión válida más reciente por `measuredAt`; entre
    // iguales, la que corrige (tiene `correctedVersion`) sobre la corregida.
    for (const variable of [...VARIABLES_NEWS2, 'oxigeno'] as const) {
      const deLaVariable = validas
        .filter(o => o.variable === variable)
        .sort((a, b) => {
          const d = Date.parse(b.measuredAt) - Date.parse(a.measuredAt)
          if (d !== 0) return d
          return (b.correctedVersion ? 1 : 0) - (a.correctedVersion ? 1 : 0)
        })
      const ganadora = deLaVariable[0]
      if (ganadora !== undefined) {
        presentes[variable] = ganadora.valor
        if (!measuredAt || Date.parse(ganadora.measuredAt) > Date.parse(measuredAt)) {
          measuredAt = ganadora.measuredAt
        }
      }
    }

    const faltantes = VARIABLES_NEWS2.filter(v => presentes[v] === undefined)
    const estado: EstadoNews2 =
      Object.keys(presentes).length === 0 ? 'NO_DATA'
      : faltantes.length > 0 ? 'INCOMPLETE'
      : 'COMPLETE'

    salida.push({ observationSetId, measuredAt, presentes, faltantes, estado })
  }

  return salida.sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt))
}

/**
 * Lo que la pantalla debe mostrar. NO hay un campo «NEWS2 actual» cuando el set
 * vigente está incompleto: eso es justamente lo que la decisión prohíbe.
 */
export interface News2Presentacion {
  /** El set más reciente en o antes del instante. `null` si no hay ninguno. */
  setVigente: SetContemporaneo | null
  /**
   * Score del set vigente, SÓLO si está `COMPLETE`. Si no, `null`: no se
   * fabrica un número rellenando con historia.
   */
  puedeCalcularAhora: boolean
  /** El último set COMPLETO conocido, para poder decir «último válido: 3 · 08:00». */
  ultimoSetCompleto: SetContemporaneo | null
  /**
   * Texto ya decidido, para que ninguna pantalla improvise el encuadre. La
   * decisión da el ejemplo literal: NO «NEWS2 actual = 3», SÍ «Último NEWS2
   * válido: 3 · 08:00».
   */
  encuadre: 'actual' | 'ultimo_valido' | 'incompleto' | 'sin_datos'
}

export function presentarNews2(
  sets: readonly SetContemporaneo[],
  instanteIso: string,
): News2Presentacion {
  const instante = Date.parse(instanteIso)
  if (Number.isNaN(instante)) throw new Error(`presentarNews2: instante inválido «${instanteIso}»`)

  const hasta = sets
    .filter(s => {
      const t = Date.parse(s.measuredAt)
      return !Number.isNaN(t) && t <= instante
    })
    .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))

  const setVigente = hasta[0] ?? null
  const ultimoSetCompleto = hasta.find(s => s.estado === 'COMPLETE') ?? null

  const encuadre: News2Presentacion['encuadre'] =
    setVigente === null ? 'sin_datos'
    : setVigente.estado === 'COMPLETE' ? 'actual'
    : ultimoSetCompleto !== null ? 'ultimo_valido'
    : 'incompleto'

  return {
    setVigente,
    puedeCalcularAhora: setVigente?.estado === 'COMPLETE',
    ultimoSetCompleto,
    encuadre,
  }
}

/**
 * Mensaje único cuando alguien intente rellenar una variable faltante con
 * historia. Si aparece en un log, se sabe qué regla se violó.
 */
export const PROHIBIDO_ARRASTRAR_ULTIMO_VALOR =
  'ICU-Q4.1: prohibido Last Observation Carried Forward en NEWS2. Una variable ' +
  'ausente del set contemporáneo deja el score en INCOMPLETE; no se rellena con ' +
  'el último dato histórico.'
