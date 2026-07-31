/**
 * Observaciones clínicas VERSIONADAS — núcleo puro compartido.
 *
 * Implementa la decisión ICU-Q3 del médico dueño (29-jul-2026), que además cerró
 * E0-09/Q1: `docs/clinical-decisions/DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md`
 *
 *   «Una observación corregida SÍ entra al cálculo si es la versión clínica
 *    vigente. Pero NO se modifica ni se borra la original.»
 *
 *   «El motor usa la LATEST CLINICALLY VALID OBSERVATION dentro de la ventana
 *    temporal aplicable. Nunca "latest database row" sin validar estado.»
 *
 * ── LAS DOS PIEZAS QUE ESTO AÑADE ─────────────────────────────────────────────
 *
 * 1. MÁQUINA DE ESTADOS. La política anterior era un booleano disfrazado
 *    (`'incluye_corregidos' | 'excluye_corregidos'`), y un booleano no puede
 *    expresar «la versión clínicamente vigente». Se sustituye por 6 estados.
 *
 * 2. HORA EFECTIVA ≠ HORA DE REGISTRO. Es el requisito que hace computable el
 *    Ejemplo A de la decisión, y sin él NO se puede implementar con fidelidad:
 *
 *      «08:00 SpO₂ 82 % · 08:03 "me equivoqué, era 92"
 *        → el NEWS2 retrospectivo de las 08:00 debe usar 92»
 *
 *    Antes la corrección se guardaba con la hora en que se capturó (08:03), así
 *    que un NEWS2 recalculado para las 08:00 no la encontraba, y descartar el 82
 *    dejaba un HUECO en vez de una corrección. Ahora la corrección HEREDA la
 *    `fechaEfectiva` del original.
 *
 *    Es la distinción `effectiveDateTime` / `issued` de FHIR, así que alinea con
 *    el export que ya existe.
 *
 * ── LO QUE DISTINGUE UNA CORRECCIÓN DE UNA OBSERVACIÓN NUEVA ─────────────────
 *
 *   Ejemplo A · CORRECCIÓN        Un solo hecho, mal capturado.
 *     08:00 SpO₂ 82 %             La corrección vive EN LAS 08:00.
 *     08:03 «era 92»              `vigenteEn(08:00)` → 92
 *
 *   Ejemplo B · OBSERVACIÓN NUEVA Dos hechos válidos.
 *     08:00 SpO₂ 82 %             `vigenteEn(08:00)` → 82
 *     08:10 SpO₂ 92 % (tras Rx)   `vigenteEn(08:10)` → 92
 *                                 `vigenteEn(08:05)` → 82  ← el valor disponible
 *                                                            EN ESE MOMENTO
 *
 * Este módulo es PURO: sin Firestore, sin React, sin reloj. El instante siempre
 * se recibe como parámetro para que los cálculos sean reproducibles.
 */

/** Estados del ciclo de vida de una observación (decisión ICU-Q3). */
export const ESTADOS_OBSERVACION = [
  /** Capturada, aún sin confirmar (p. ej. extraída por voz con confianza suficiente). */
  'PRELIMINARY',
  /** Confirmada como válida. */
  'CONFIRMED',
  /** Fue corregida por otra versión posterior. Sigue visible; ya no calcula. */
  'CORRECTED',
  /** Enmendada tras estar en una nota firmada. Sigue visible; ya no calcula. */
  'AMENDED',
  /** Reemplazada por una versión más reciente del mismo hecho. */
  'SUPERSEDED',
  /** Error de captura: el hecho nunca ocurrió así. Se conserva, nunca calcula. */
  'ENTERED_IN_ERROR',
] as const

export type EstadoObservacion = (typeof ESTADOS_OBSERVACION)[number]

/**
 * Estados que **NO** alimentan un cálculo clínico.
 *
 * Fail-closed a propósito: `esClinicamenteValida` pregunta por esta lista en vez
 * de enumerar los válidos, así que un estado NUEVO que alguien añada arriba
 * empieza contando como válido sólo si se declara aquí explícitamente… y para
 * evitar justamente ese descuido, `observacion-version.test.ts` exige que cada
 * estado de `ESTADOS_OBSERVACION` esté clasificado en uno de los dos lados.
 */
export const ESTADOS_NO_CALCULABLES: readonly EstadoObservacion[] = [
  'CORRECTED',
  'AMENDED',
  'SUPERSEDED',
  'ENTERED_IN_ERROR',
]

/** Estados que SÍ alimentan un cálculo clínico. */
export const ESTADOS_CALCULABLES: readonly EstadoObservacion[] = [
  'PRELIMINARY',
  'CONFIRMED',
]

/** ¿Esta versión puede entrar a un cálculo clínico? */
export function esClinicamenteValida(estado: EstadoObservacion): boolean {
  return !ESTADOS_NO_CALCULABLES.includes(estado)
}

/**
 * Una observación versionada. Genérica sobre su contenido para servir a los DOS
 * dominios sin duplicar la lógica: signos vitales de piso (`RegistroSignos`) y
 * observaciones de UCI (`ICUObservation`).
 */
export interface ObservacionVersionada<T> {
  id: string
  /**
   * Cuándo OCURRIÓ el hecho clínico (ISO). Una **corrección hereda la del
   * original**: es lo que permite recalcular un score retrospectivo.
   */
  fechaEfectiva: string
  /**
   * Cuándo se CAPTURÓ esta versión (ISO). Siempre la propia, nunca heredada.
   * Es la que ordena las versiones de un mismo hecho.
   */
  fechaRegistro: string
  estado: EstadoObservacion
  /** id de la versión que ESTA corrige. Ausente ⇒ observación nueva, no corrección. */
  corrigeA?: string
  /** Por qué se corrigió. Exigido por la decisión para el audit trail. */
  motivoCorreccion?: string
  /** Quién la capturó. */
  por: string
  valor: T
}

/** Motivo por el que una versión quedó fuera del cálculo. Para poder explicarlo. */
export interface Descartada<T> {
  observacion: ObservacionVersionada<T>
  motivo: 'estado_no_calculable' | 'posterior_al_instante' | 'fuera_de_ventana'
}

export interface Vigencia<T> {
  /** La versión clínicamente vigente, o `null` si no hay ninguna aplicable. */
  vigente: ObservacionVersionada<T> | null
  /** Todo lo que se consideró y NO entró, con su motivo. Nunca se descarta en silencio. */
  descartadas: Descartada<T>[]
}

/**
 * Mensaje único de la ventana temporal sin definir. Si aparece en un log, se sabe
 * exactamente qué decisión falta.
 */
export const FALTA_VENTANA_TEMPORAL =
  'NEEDS_CLINICAL_REVIEW: la ventana temporal de vigencia de esta observación no ' +
  'está definida. La decisión ICU-Q3 prohíbe mezclar variables tomadas en horas ' +
  'distintas «sin política explícita»: pásala como parámetro, no se asume un default.'

/**
 * La **versión clínicamente vigente** de un hecho en un instante dado.
 *
 * Implementa literalmente la regla de la decisión: *latest clinically valid
 * observation dentro de la ventana temporal aplicable*, nunca *latest database
 * row*.
 *
 * @param observaciones  todas las versiones conocidas (cualquier orden)
 * @param instanteIso    el momento para el que se calcula
 * @param ventanaMs      antigüedad máxima admisible. `null` = SIN límite, y hay
 *                       que pasarlo explícitamente: la decisión prohíbe asumir
 *                       uno. `undefined` LANZA con `FALTA_VENTANA_TEMPORAL`.
 *
 * Orden de desempate, cuando dos versiones válidas comparten `fechaEfectiva`:
 * gana la de `fechaRegistro` más reciente — es decir, la corrección posterior
 * gana sobre el valor que corrigió, que es justo el Ejemplo A.
 */
export function vigenteEn<T>(
  observaciones: readonly ObservacionVersionada<T>[],
  instanteIso: string,
  ventanaMs: number | null | undefined,
): Vigencia<T> {
  if (ventanaMs === undefined) throw new Error(FALTA_VENTANA_TEMPORAL)

  const instante = Date.parse(instanteIso)
  if (Number.isNaN(instante)) {
    throw new Error(`vigenteEn: instante inválido «${instanteIso}»`)
  }

  const descartadas: Descartada<T>[] = []
  const candidatas: ObservacionVersionada<T>[] = []

  for (const o of observaciones) {
    if (!esClinicamenteValida(o.estado)) {
      descartadas.push({ observacion: o, motivo: 'estado_no_calculable' })
      continue
    }
    const efectiva = Date.parse(o.fechaEfectiva)
    // Una observación del FUTURO no puede alimentar el cálculo de AHORA: sería
    // usar información que en ese momento no existía.
    if (Number.isNaN(efectiva) || efectiva > instante) {
      descartadas.push({ observacion: o, motivo: 'posterior_al_instante' })
      continue
    }
    if (ventanaMs !== null && instante - efectiva > ventanaMs) {
      descartadas.push({ observacion: o, motivo: 'fuera_de_ventana' })
      continue
    }
    candidatas.push(o)
  }

  if (candidatas.length === 0) return { vigente: null, descartadas }

  const ordenadas = [...candidatas].sort((a, b) => {
    const ea = Date.parse(a.fechaEfectiva), eb = Date.parse(b.fechaEfectiva)
    if (ea !== eb) return eb - ea                            // más reciente primero
    return Date.parse(b.fechaRegistro) - Date.parse(a.fechaRegistro)
  })

  const [vigente, ...resto] = ordenadas
  for (const o of resto) descartadas.push({ observacion: o, motivo: 'posterior_al_instante' })
  return { vigente, descartadas }
}

/**
 * Construye la CORRECCIÓN de una observación, heredando su hora efectiva.
 *
 * No muta el original ni lo marca: cambiar el estado del original es una
 * escritura, y este módulo es puro. `marcarCorregido` da el parche a aplicar.
 */
export function construirCorreccion<T>(
  original: ObservacionVersionada<T>,
  cambio: { id: string; valor: T; por: string; motivo: string; fechaRegistro: string },
): ObservacionVersionada<T> {
  if (!cambio.motivo.trim()) {
    throw new Error('construirCorreccion: la decisión ICU-Q3 exige motivo para el audit trail')
  }
  return {
    id: cambio.id,
    // ── LA LÍNEA CLAVE DE TODO EL MÓDULO ──
    // Hereda la hora del HECHO, no la de la captura. Sin esto, «el NEWS2
    // retrospectivo de las 08:00 usa 92» no es computable.
    fechaEfectiva: original.fechaEfectiva,
    fechaRegistro: cambio.fechaRegistro,
    estado: 'CONFIRMED',
    corrigeA: original.id,
    motivoCorreccion: cambio.motivo,
    por: cambio.por,
    valor: cambio.valor,
  }
}

/**
 * Estado al que pasa el original cuando se le anexa una corrección.
 *
 * `ENTERED_IN_ERROR` cuando el hecho **nunca ocurrió así** (error de captura, el
 * caso del ejemplo de la decisión); `CORRECTED` cuando se rectifica un dato que
 * sí se tomó. La distinción es clínica y la elige quien corrige — este módulo
 * NO la adivina.
 */
export function marcarCorregido(
  esErrorDeCaptura: boolean,
): Extract<EstadoObservacion, 'ENTERED_IN_ERROR' | 'CORRECTED'> {
  return esErrorDeCaptura ? 'ENTERED_IN_ERROR' : 'CORRECTED'
}

/**
 * Serie lista para graficar o para un cálculo por tramos: la versión vigente de
 * CADA hecho, ordenada por hora efectiva.
 *
 * Agrupa por hecho siguiendo la cadena `corrigeA`, así que una corrección NO
 * aparece como un punto extra en la gráfica — aparece en el lugar del original,
 * con el valor corregido. Que es lo que el médico espera ver.
 */
export function serieVigente<T>(
  observaciones: readonly ObservacionVersionada<T>[],
): ObservacionVersionada<T>[] {
  const porId = new Map(observaciones.map(o => [o.id, o]))

  /** Raíz de la cadena de correcciones, con tope anti-ciclo. */
  const raizDe = (o: ObservacionVersionada<T>): string => {
    let actual = o
    const visto = new Set<string>([o.id])
    while (actual.corrigeA) {
      const padre = porId.get(actual.corrigeA)
      if (!padre || visto.has(padre.id)) break   // huérfana o ciclo: para aquí
      visto.add(padre.id)
      actual = padre
    }
    return actual.id
  }

  const porHecho = new Map<string, ObservacionVersionada<T>[]>()
  for (const o of observaciones) {
    const raiz = raizDe(o)
    const lista = porHecho.get(raiz)
    if (lista) lista.push(o); else porHecho.set(raiz, [o])
  }

  const salida: ObservacionVersionada<T>[] = []
  for (const versiones of porHecho.values()) {
    const validas = versiones
      .filter(v => esClinicamenteValida(v.estado))
      .sort((a, b) => Date.parse(b.fechaRegistro) - Date.parse(a.fechaRegistro))
    if (validas.length > 0) salida.push(validas[0])
  }

  return salida.sort((a, b) => Date.parse(a.fechaEfectiva) - Date.parse(b.fechaEfectiva))
}
