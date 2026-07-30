/**
 * Motor de DATO FALTANTE — charter §31.
 *
 *   «Si el paciente está en ventilación mecánica y se documenta VT, RR, FiO2 y
 *    PEEP pero falta PBW, mostrar:
 *
 *        No se puede calcular VT/PBW: falta talla/PBW.
 *
 *    **No inventar.**»
 *
 * ── EL DEFECTO QUE EVITA ─────────────────────────────────────────────────────
 *
 * Un cálculo que no se puede hacer desaparece de la pantalla en silencio. El
 * médico ve una nota sin VT/PBW y no sabe si (a) el paciente no está ventilado,
 * (b) el dato es normal y no se destacó, o (c) falta la talla. Las tres son
 * situaciones clínicas distintas y la pantalla las muestra igual: vacías.
 *
 * Este módulo convierte ese vacío en una frase que dice **qué falta y para qué**.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No calcula nada** y **no estima** el dato ausente. Las fórmulas viven en sus
 * motores (`ventilacion.ts`, `hemodinamia.ts`) y aquí sólo se declara qué
 * entradas necesita cada una. Estimar una talla «típica» para poder mostrar un
 * VT/PBW sería exactamente lo que el charter prohíbe, y el error sería invisible:
 * un número plausible calculado sobre un dato inventado.
 *
 * Módulo PURO.
 */

/**
 * Un valor DERIVADO y las entradas que necesita.
 *
 * Cada entrada cita el motor REAL que lo calcula. Declarar aquí una derivación
 * cuyo motor no existe convertiría este archivo en una promesa: diría que falta
 * un dato para un cálculo que nadie sabe hacer.
 */
export interface Derivacion {
  /** Cómo lo llama el médico. Es lo que se le muestra. */
  campo: string
  /** Claves de los datos que hacen falta, tal como se capturan. */
  requiere: readonly string[]
  /** Cómo se nombra cada entrada al pedirla (el médico no dice `tallaCm`). */
  comoSePide: Readonly<Record<string, string>>
  formula: string
  motor: string
  /** Condición clínica bajo la cual el cálculo NO aplica aunque haya datos. */
  noAplicaSi?: string
}

/**
 * Catálogo. Corto a propósito: sólo derivaciones cuyo motor YA existe en el
 * repo, verificadas al escribirlo.
 */
export const DERIVACIONES: readonly Derivacion[] = [
  {
    campo: 'VT/PBW',
    requiere: ['vt', 'tallaCm', 'sexo'],
    comoSePide: {
      vt: 'volumen corriente',
      tallaCm: 'talla',
      sexo: 'sexo (la fórmula de peso predicho lo necesita)',
    },
    formula: 'VT_mL / PBW_kg · PBW = [H:50 | M:45.5] + 0.91·(talla_cm − 152.4)',
    motor: 'src/lib/uci/ventilacion.ts · vtPorPBW() / pesoPredichoPBW()',
  },
  {
    campo: 'driving pressure',
    requiere: ['pplat', 'peep'],
    comoSePide: { pplat: 'presión plateau', peep: 'PEEP' },
    formula: 'Pplat − PEEP',
    motor: 'src/lib/uci/ventilacion.ts · drivingPressure()',
    noAplicaSi: 'hay esfuerzo espontáneo: la Pplateau no es interpretable',
  },
  {
    campo: 'compliance estática',
    requiere: ['vt', 'pplat', 'peep'],
    comoSePide: { vt: 'volumen corriente', pplat: 'presión plateau', peep: 'PEEP' },
    formula: 'VT / driving pressure',
    motor: 'src/lib/uci/ventilacion.ts · complianceEstatica()',
    noAplicaSi: 'hay esfuerzo espontáneo: depende de la Pplateau',
  },
  {
    campo: 'índice de Kirby (P/F)',
    requiere: ['pao2', 'fio2'],
    comoSePide: { pao2: 'PaO₂ (gasometría arterial)', fio2: 'FiO₂' },
    formula: 'PaO₂ / FiO₂',
    motor: 'src/lib/uci/ventilacion.ts · indiceKirby()',
    noAplicaSi: 'la muestra no es arterial: una venosa no sirve para P/F',
  },
  {
    campo: 'presión arterial media',
    requiere: ['ta'],
    comoSePide: { ta: 'tensión arterial (sistólica/diastólica)' },
    formula: '(sistólica + 2 × diastólica) / 3',
    motor: 'src/lib/uci/hemodinamia.ts · presionArterialMedia()',
  },
]

export type EstadoDerivacion = 'calculable' | 'faltan_datos' | 'no_aplica'

export interface Hueco {
  campo: string
  estado: EstadoDerivacion
  /** Claves que faltan (vacío si no faltan). */
  faltan: string[]
  /** Frase para el médico. `null` si el cálculo es posible. */
  mensaje: string | null
  formula: string
  motor: string
}

/** ¿Está presente este dato? Un `0` SÍ lo está: un PEEP de 0 existe. */
function presente(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string') return v.trim() !== ''
  return true
}

/**
 * Qué le falta a UNA derivación.
 *
 * @param noAplica Cuando quien llama SABE que la condición clínica que invalida
 *   el cálculo se cumple (p. ej. hay esfuerzo espontáneo). Este módulo no la
 *   deduce: esa evaluación es del motor clínico, no de un buscador de huecos.
 */
export function huecoDe(
  d: Derivacion,
  capturados: Readonly<Record<string, unknown>>,
  noAplica = false,
): Hueco {
  const base = { campo: d.campo, formula: d.formula, motor: d.motor }

  if (noAplica) {
    return {
      ...base, estado: 'no_aplica', faltan: [],
      mensaje: d.noAplicaSi
        ? `${d.campo} no se calcula: ${d.noAplicaSi}.`
        : `${d.campo} no aplica en esta situación.`,
    }
  }

  const faltan = d.requiere.filter(k => !presente(capturados[k]))
  if (faltan.length === 0) return { ...base, estado: 'calculable', faltan: [], mensaje: null }

  const nombres = faltan.map(k => d.comoSePide[k] ?? k)
  const lista = nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return {
    ...base, estado: 'faltan_datos', faltan,
    // El encuadre del charter, literal: qué NO se puede calcular y qué falta.
    mensaje: `No se puede calcular ${d.campo}: falta ${lista}.`,
  }
}

/**
 * Todos los huecos de una captura.
 *
 * @param aplicables Sólo las derivaciones que tienen sentido para este paciente.
 *   Si no se pasa, se evalúan todas — pero un paciente sin ventilador no debería
 *   recibir avisos de VT/PBW: eso sería ruido, no información.
 */
export function huecos(
  capturados: Readonly<Record<string, unknown>>,
  opciones?: {
    aplicables?: readonly string[]
    noAplican?: Readonly<Record<string, boolean>>
  },
): Hueco[] {
  const lista = opciones?.aplicables
    ? DERIVACIONES.filter(d => opciones.aplicables!.includes(d.campo))
    : DERIVACIONES
  return lista.map(d => huecoDe(d, capturados, opciones?.noAplican?.[d.campo] === true))
}

/** Sólo lo que falta por capturar. Lo accionable. */
export function soloFaltantes(hs: readonly Hueco[]): Hueco[] {
  return hs.filter(h => h.estado === 'faltan_datos')
}

/**
 * Los datos ÚNICOS que hay que pedir, sin repetir.
 *
 * Un solo dato suele desbloquear varios cálculos: capturar la talla habilita
 * VT/PBW, y capturar la Pplat habilita driving pressure Y compliance. Pedirlos
 * por separado haría que el médico teclee lo mismo tres veces.
 */
export function datosQueDesbloquean(hs: readonly Hueco[]): { dato: string; desbloquea: string[] }[] {
  const mapa = new Map<string, string[]>()
  for (const h of soloFaltantes(hs)) {
    for (const k of h.faltan) {
      const l = mapa.get(k)
      if (l) l.push(h.campo); else mapa.set(k, [h.campo])
    }
  }
  return [...mapa.entries()]
    .map(([dato, desbloquea]) => ({ dato, desbloquea }))
    .sort((a, b) => b.desbloquea.length - a.desbloquea.length)
}
