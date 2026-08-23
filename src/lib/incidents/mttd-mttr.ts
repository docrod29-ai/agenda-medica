/**
 * CUÁNTO TARDAMOS EN VERLO Y CUÁNTO EN ARREGLARLO — y de dónde sale cada cifra.
 *
 * ── LA TRAMPA QUE ESTE MÓDULO EVITA ──────────────────────────────────────────
 *
 * «Nuestro MTTR es de 40 segundos» dicho a partir de un simulacro es falso, y es
 * la clase de falso que se cuela en una presentación comercial. Un simulacro
 * mide el MOTOR: cuánto tarda el kernel en clasificar, agrupar y decidir con un
 * reloj que se le inyecta. No mide la red, ni el proveedor, ni el rato que el
 * dueño tardó en ver el aviso.
 *
 * Por eso cada cifra viaja con su ORIGEN y no hay forma de mezclarlas: el tipo
 * lo impide.
 *
 *   observado  — de incidentes reales, con relojes reales.
 *   simulacro  — del arnés, con reloj inyectado. Mide el motor, no el mundo.
 *   objetivo   — lo que el dueño decidió que hay que conseguir. Todavía no existe.
 *
 * Es la misma separación TARGET/OBSERVED del contrato de SLO de #310/#342, con
 * un tercer origen que aquel no necesita porque no tiene arnés de incidentes.
 *
 * Módulo PURO.
 */

export type OrigenDeLaCifra = 'observado' | 'simulacro' | 'objetivo'

export interface Medicion {
  readonly origen: OrigenDeLaCifra
  /** `null` = no se puede calcular. Distinto de cero, y tiene que poder distinguirse. */
  readonly valorMs: number | null
  /** Cuántos incidentes hay detrás. Con `n = 1` no se dice «media». */
  readonly n: number
  /** Qué falta para poder calcularlo, cuando `valorMs` es `null`. */
  readonly porQueNo?: string
}

/** Los tres instantes que hacen falta. Todos ISO, todos del mismo reloj. */
export interface LineaDeTiempo {
  /** Cuándo ocurrió el PRIMER fallo, no cuándo se anotó. */
  readonly primerFalloEn: string
  /** Cuándo el sistema lo supo: el evento cruzó la raya y hubo incidente. */
  readonly detectadoEn?: string
  /** Cuándo volvió a funcionar. */
  readonly recuperadoEn?: string
  /** Cuándo se cerró: recuperado Y con causa entendida. */
  readonly resueltoEn?: string
}

function delta(a?: string, b?: string): number | null {
  if (!a || !b) return null
  const ms = Date.parse(b) - Date.parse(a)
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

/** MTTD de un incidente: de que empezó a fallar a que se supo. */
export function tiempoHastaDetectar(t: LineaDeTiempo): number | null {
  return delta(t.primerFalloEn, t.detectadoEn)
}

/**
 * MTTR de un incidente: de que se supo a que se recuperó.
 *
 * Se mide desde la DETECCIÓN, no desde el primer fallo. Medirlo desde el primer
 * fallo mezcla dos problemas distintos —tardar en enterarse y tardar en
 * arreglar— y esconde el que suele ser peor: en la caída del 31-jul el arreglo
 * fue de minutos y el enterarse, de horas.
 *
 * Si no hubo recuperación pero sí resolución (alguien lo arregló a mano), se usa
 * la resolución y se dice.
 */
export function tiempoHastaRecuperar(t: LineaDeTiempo): number | null {
  return delta(t.detectadoEn, t.recuperadoEn) ?? delta(t.detectadoEn, t.resueltoEn)
}

/**
 * Agrega una tanda. La MEDIANA, no la media.
 *
 * Un incidente que tardó ocho horas en detectarse porque ocurrió de madrugada
 * arrastra la media de una semana entera y hace pensar que el sistema está peor
 * de lo que está — o, al revés, un puñado de detecciones instantáneas tapa el
 * que tardó toda la noche. La mediana dice cuál es el caso NORMAL, que es lo que
 * se está preguntando. La cola se mira aparte, en `peor`.
 */
export interface ResumenTiempos {
  readonly mttd: Medicion
  readonly mttr: Medicion
  /** El peor caso de cada uno. La cola es la que duele. */
  readonly peorMttdMs: number | null
  readonly peorMttrMs: number | null
}

function mediana(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
}

export function resumirTiempos(
  lineas: readonly LineaDeTiempo[],
  origen: OrigenDeLaCifra,
): ResumenTiempos {
  const dets = lineas.map(tiempoHastaDetectar).filter((x): x is number => x !== null)
  const recs = lineas.map(tiempoHastaRecuperar).filter((x): x is number => x !== null)
  return {
    mttd: {
      origen,
      valorMs: mediana(dets),
      n: dets.length,
      ...(dets.length ? {} : { porQueNo: 'ningún incidente de la tanda tiene instante de detección' }),
    },
    mttr: {
      origen,
      valorMs: mediana(recs),
      n: recs.length,
      ...(recs.length ? {} : { porQueNo: 'ningún incidente de la tanda llegó a recuperarse ni a resolverse' }),
    },
    peorMttdMs: dets.length ? Math.max(...dets) : null,
    peorMttrMs: recs.length ? Math.max(...recs) : null,
  }
}

/**
 * Los OBJETIVOS. Vacíos a propósito.
 *
 * Un objetivo de MTTD/MTTR es un compromiso con el consultorio y lo fija el
 * dueño, no este archivo. Rellenarlos con «lo habitual del sector» sería una
 * cifra plausible inventada — el fallo que la regla 1 de seguridad clínica
 * prohíbe, cometido en el dominio operativo.
 */
export const OBJETIVOS: { readonly mttdMs: number | null; readonly mttrMs: number | null } = {
  mttdMs: null,
  mttrMs: null,
}

/** Cómo se escribe una cifra sin que se pueda leer como otra cosa. */
export function comoSeDice(m: Medicion): string {
  if (m.valorMs === null) return `sin medición (${m.porQueNo ?? 'faltan datos'})`
  const s = (m.valorMs / 1000).toFixed(1)
  const etiqueta = m.origen === 'observado' ? 'observado'
    : m.origen === 'simulacro' ? 'MEDIDO EN SIMULACRO — mide el motor, no el mundo real'
    : 'objetivo'
  return `${s} s (${etiqueta}, n=${m.n})`
}

export const POR_QUE_EL_MTTR_SE_MIDE_DESDE_LA_DETECCION =
  'Porque medirlo desde el primer fallo suma dos problemas distintos y esconde ' +
  'el peor. El 31-jul el arreglo fue de minutos; enterarse costó horas. Un solo ' +
  'número habría dicho «tardamos horas en arreglarlo», que es falso, y habría ' +
  'mandado a optimizar el arreglo en vez de la detección.'
