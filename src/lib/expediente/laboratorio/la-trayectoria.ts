/**
 * HACIA DÓNDE VA EL NÚMERO, NO SÓLO CUÁNTO VALE HOY.
 *
 * ── LO QUE REG-368 DEJÓ A MEDIAS ─────────────────────────────────────────────
 *
 * REG-368 hizo que los laboratorios del expediente lleguen a los motores. Lo que
 * llega es **el último valor de cada analito**, y con eso el motor calcula. Pero
 * el último valor no dice lo único que a veces importa:
 *
 *     creatinina  0.9 (mar-2025) → 1.3 (ene-2026) → 1.7 (jul-2026)
 *
 * Ninguno de los tres dispara nada por sí solo —los tres caen cerca del rango— y
 * los tres juntos son un deterioro renal. La trayectoria vive en
 * `seriesDesdeHistorial` desde hace tiempo y **sólo la dibuja la pestaña de
 * Laboratorios**: para verla hay que salir de donde se está prescribiendo.
 *
 * ── LO QUE ESTE MÓDULO SÍ HACE, Y LO QUE NO PUEDE HACER ──────────────────────
 *
 * Hace **aritmética y procedencia**: cuál es el valor de ahora, cuál el anterior,
 * de qué fechas son, y si subió, bajó o quedó igual. Eso son hechos.
 *
 * **No dice si el cambio es significativo.** «Un ascenso del 30 % de creatinina
 * es una lesión renal aguda» es un umbral clínico, y aquí no se inventa
 * (regla 1). No hay porcentajes, no hay «deterioro», no hay banderas: hay dos
 * números con sus fechas y la palabra que describe la aritmética entre ellos.
 * Quien interpreta es el médico.
 *
 * La diferencia importa. Un módulo que dijera «función renal deteriorándose»
 * estaría emitiendo un juicio clínico que nadie respaldó; uno que dice
 * «creatinina 1.7 el 14-jul, antes 1.3 el 10-ene» está citando el expediente.
 *
 * ── POR QUÉ VA DONDE SE DECIDE ───────────────────────────────────────────────
 *
 * El aviso que cambia la conducta ya nombra el valor. Que ahí mismo diga de
 * dónde viene cuesta media línea y ahorra abrir otra pestaña con el paciente
 * enfrente. Es la misma razón por la que REG-368 le puso la fecha.
 *
 * Módulo PURO.
 */

/** Un panel, reducido a lo que hace falta aquí. Igual que en `lo-que-ya-esta-medido`. */
export interface PanelParaTrayectoria {
  /** YYYY-MM-DD. */
  fecha: string
  resultados?: readonly {
    clave?: string
    valor?: number
    /** Si viene, el laboratorio dio un límite y no un número. */
    censurada?: unknown
  }[]
}

export interface PuntoDeLaTrayectoria {
  valor: number
  /** YYYY-MM-DD de la nota o panel donde se midió. */
  fecha: string
}

/**
 * Qué pasó entre la medición anterior y la de ahora.
 *
 * `sube` / `baja` / `igual` describen la **aritmética**, no la clínica: una
 * creatinina que baja puede ser una mejoría o una pérdida de masa muscular, y
 * eso no lo decide este módulo.
 */
export type Direccion = 'sube' | 'baja' | 'igual' | 'sin_previos'

export interface Trayectoria {
  clave: string
  actual: PuntoDeLaTrayectoria
  /** El inmediatamente anterior, si lo hay. */
  previo?: PuntoDeLaTrayectoria
  /** Todos los anteriores, del más nuevo al más viejo. */
  previos: PuntoDeLaTrayectoria[]
  direccion: Direccion
}

/**
 * Cuántos puntos anteriores se conservan.
 *
 * Un paciente con quince años de laboratorios tiene decenas de mediciones del
 * mismo analito, y esto se pinta en una línea con el paciente enfrente. El tope
 * no es una preferencia visual: sin él, esta función devuelve una lista que
 * crece con el expediente — el supuesto de tamaño que costó REG-341 y REG-350.
 */
export const TOPE_PREVIOS = 5

/** Los puntos de un analito, del más nuevo al más viejo, sin censurados. */
function puntosDe(paneles: readonly PanelParaTrayectoria[], clave: string): PuntoDeLaTrayectoria[] {
  const puntos: PuntoDeLaTrayectoria[] = []
  for (const panel of paneles ?? []) {
    const fecha = String(panel?.fecha ?? '').trim()
    if (!fecha) continue
    for (const r of panel.resultados ?? []) {
      if (String(r?.clave ?? '').trim() !== clave) continue
      /* Un límite («>400») no es un número: meterlo en una trayectoria haría
         subir o bajar una línea por un valor que nadie midió. Mismo criterio
         que REG-368 y REG-204. */
      if (r?.censurada) continue
      if (typeof r?.valor !== 'number' || !Number.isFinite(r.valor)) continue
      puntos.push({ valor: r.valor, fecha })
    }
  }
  return puntos.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * La trayectoria de UN analito.
 *
 * @param paneles Los paneles del paciente, en cualquier orden.
 * @param clave   El analito (`creatinina`, `ldl`…), tal como lo nombra `ANALITOS`.
 * @param deHoy   Lo dictado en esta consulta, si lo hay. Manda sobre el panel más
 *                reciente — misma regla que `labsDelCuadro`— y entonces el panel
 *                más nuevo pasa a ser «el previo».
 */
export function trayectoriaDe(
  paneles: readonly PanelParaTrayectoria[] | undefined,
  clave: string,
  deHoy?: number,
): Trayectoria | null {
  const historicos = puntosDe(paneles ?? [], clave)

  /* Lo de hoy va sin fecha: es de esta consulta y todavía no es un panel. La
     ausencia de fecha es lo que distingue «lo que acaba de dictar» de «lo que ya
     estaba medido», igual que en `labsDelCuadro`. */
  const actual: PuntoDeLaTrayectoria | undefined =
    typeof deHoy === 'number' && Number.isFinite(deHoy)
      ? { valor: deHoy, fecha: '' }
      : historicos[0]

  if (!actual) return null

  const previos = (actual.fecha === '' ? historicos : historicos.slice(1)).slice(0, TOPE_PREVIOS)
  const previo = previos[0]

  const direccion: Direccion = !previo
    ? 'sin_previos'
    : actual.valor > previo.valor ? 'sube'
    : actual.valor < previo.valor ? 'baja'
    : 'igual'

  return { clave, actual, previo, previos, direccion }
}

/**
 * Cómo se dice la trayectoria en una línea, para pegarla al valor que el motor
 * ya nombra.
 *
 * Devuelve cadena vacía cuando no hay nada que añadir: sin medición anterior no
 * hay trayectoria, y un «sin datos previos» colgando de cada aviso es ruido.
 *
 * No adjetiva. «Subió» es aritmética; «empeoró» sería un diagnóstico.
 */
export function comoSeDiceLaTrayectoria(t: Trayectoria | null): string {
  if (!t?.previo || t.direccion === 'sin_previos') return ''
  const verbo = t.direccion === 'sube' ? 'subió' : t.direccion === 'baja' ? 'bajó' : 'igual'
  if (t.direccion === 'igual') return `igual que el ${t.previo.fecha}`
  return `${verbo} desde ${t.previo.valor} el ${t.previo.fecha}`
}

export const POR_QUE_NO_DICE_SI_ES_SIGNIFICATIVO =
  'NEEDS_CLINICAL_REVIEW — cuánto tiene que subir una creatinina para que el ' +
  'cambio importe es un umbral clínico y aquí no se inventa. Este módulo hace ' +
  'aritmética y procedencia: dos números, dos fechas y la palabra que describe ' +
  'la diferencia. «Subió» es aritmética; «empeoró» sería un diagnóstico.'
