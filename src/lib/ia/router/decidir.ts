/**
 * LA DECISIÓN DE RUTEO — pura, determinista y sin red.
 *
 * #313 §E. Recibe la tarea, el catálogo, la evidencia de calidad, la salud de
 * los proveedores y el estado del presupuesto. Devuelve QUÉ modelo usar, o por
 * qué ninguno. No llama a nadie: quien ejecuta es `gateway.llamarIA()`.
 *
 * ── EL CRITERIO, EN ORDEN, Y POR QUÉ ESE ORDEN ───────────────────────────────
 *
 *   1. fuera los que no están configurados o no se pueden llamar
 *   2. fuera los incapaces para la tarea
 *   3. fuera los que el proveedor no puede servir ahora
 *   4. fuera los que NO demuestran el piso de calidad
 *   5. entre los que quedan, el mínimo suficiente por costo y latencia
 *   6. escalar a segunda revisión sólo si una señal técnica lo pide
 *
 * El paso 4 va ANTES del 5 a propósito, y es toda la tesis del riel: primero se
 * decide quién PUEDE, y sólo después cuál sale más barato. Un router que
 * ordenara por precio y luego mirara la calidad acabaría eligiendo al barato
 * siempre que la comprobación fuera floja — y la comprobación es floja hoy,
 * porque no hay evidencia cargada. Con este orden, la ausencia de evidencia
 * produce un fallo explícito; con el orden inverso, produciría al más barato.
 *
 * ── LO QUE ESTA FUNCIÓN NO HACE ──────────────────────────────────────────────
 *
 * No escribe verdad clínica · no diagnostica · no decide tratamiento · no toca
 * un prompt clínico · no firma · no prescribe · no se salta seguridad · no
 * cambia política de razonamiento. Elige un recurso de cómputo bajo un contrato
 * que definió otro.
 *
 * Y cuando escala a una segunda opinión, elige el CANDIDATO. No compara las dos
 * respuestas ni decide cuál tiene razón: eso es del flujo clínico (#303).
 *
 * Módulo PURO. Mismas entradas → misma salida. Hay una prueba para eso.
 */
import {
  CATALOGO, cabe, candidatosDe, costoEsperado, esEjecutable, garantizaEstructura,
  type BandaCosto, type CapacidadModelo, type CostoEsperado, type ProveedorCandidato,
} from '@/lib/ia/router/catalogo'
import { compuertaCalidad, buscarEvidencia, type EstadoCalidad, type VeredictoCalidad } from '@/lib/ia/router/calidad'
import { alcanzable, modeloCaido, type MapaSalud } from '@/lib/ia/router/disponibilidad'
import {
  evaluarPresupuesto, puedeAhorrarSegundaOpinionOpcional,
  type EstadoPresupuesto, type PoliticaPresupuesto, type SenalPresupuesto,
} from '@/lib/ia/router/presupuesto'
import {
  latenciaAlcanza, pisoEfectivo,
  type ClaseLatencia, type EvidenciaCalidad, type PisoCalidad, type SolicitudTarea,
} from '@/lib/ia/router/tareas'

/* ════════════════════════════════════════════════════════════════════════
   Códigos — por qué se eligió, y por qué se descartó
   ════════════════════════════════════════════════════════════════════════ */

/** Por qué se descartó un candidato. Uno por candidato, el PRIMERO que aplicó. */
export type MotivoDescarte =
  | 'no_configurado'
  | 'proveedor_no_ejecutable'
  | 'restriccion_de_proveedor'
  | 'no_garantiza_estructura'
  | 'no_cabe'
  | 'latencia_insuficiente'
  | 'proveedor_no_disponible'
  | 'modelo_caido'
  | 'calidad_no_demostrada'
  | 'mismo_modelo_que_el_primario'

/** Por qué se eligió lo que se eligió. Se emite en telemetría. */
export type CodigoRazon =
  | 'minimo_suficiente_por_costo'
  | 'unico_candidato_elegible'
  | 'latencia_manda'
  | 'estructura_garantizada_exigida'
  | 'presupuesto_prefiere_barato'
  | 'presupuesto_no_bajo_el_piso'
  | 'conflicto_presupuesto_calidad'
  | 'segunda_revision_por_peticion_del_medico'
  | 'segunda_revision_por_conflicto'
  | 'segunda_revision_por_validacion_fallida'
  | 'segunda_revision_por_incertidumbre'
  | 'segunda_revision_por_muestreo'
  | 'segunda_revision_omitida_por_presupuesto'
  | 'sin_segunda_revision_por_defecto'
  | 'segunda_opinion_no_independiente'

/** Por qué NO hay decisión. */
export type CodigoFallo =
  | 'NO_ELIGIBLE_MODEL'
  | 'QUALITY_NOT_PROVEN'
  | 'PROVIDER_UNAVAILABLE'
  | 'CAPABILITY_NOT_MET'
  | 'BUDGET_CONFLICT_WITH_QUALITY'
  | 'NO_CANDIDATES_FOR_TASK'

/* ════════════════════════════════════════════════════════════════════════
   Formas
   ════════════════════════════════════════════════════════════════════════ */

export interface CandidatoEvaluado {
  proveedor: ProveedorCandidato
  modeloId: string
  /** `null` mientras no se llegó a evaluar la calidad de este candidato. */
  calidad: VeredictoCalidad | null
  costo: CostoEsperado
  latencia: ClaseLatencia
  elegible: boolean
  descarte: MotivoDescarte | null
  /** Detalle legible del descarte. Para el informe, no para el médico. */
  detalle: string | null
}

/** Cómo de independiente es la segunda opinión que se pudo conseguir. */
export type Independencia =
  /** Otro proveedor. Es la que vale. */
  | 'proveedor_distinto'
  /** Mismo proveedor, otro modelo. Vale menos y se dice. */
  | 'mismo_proveedor'

export interface SegundaRevision {
  proveedor: ProveedorCandidato
  modeloId: string
  independencia: Independencia
  /** Qué señal la disparó. */
  motivo: CodigoRazon
}

export interface DecisionRuta {
  ok: true
  proveedorSeleccionado: ProveedorCandidato
  modeloSeleccionado: string
  codigosRazon: CodigoRazon[]
  /** Referencia citable de la evidencia que lo hizo elegible. */
  refEvidenciaCalidad: string | null
  bandaCostoEsperada: BandaCosto
  costoEsperadoUsd: number | null
  latenciaEsperada: ClaseLatencia
  /** Candidatos de respaldo, en el mismo orden en que se intentarían. */
  respaldos: { proveedor: ProveedorCandidato; modeloId: string }[]
  /** `null` = no se escala. Es lo normal y es lo barato. */
  segundaRevision: SegundaRevision | null
  politicaPresupuesto: PoliticaPresupuesto
  senalesPresupuesto: SenalPresupuesto[]
  /** Todo lo que se evaluó, con su motivo. Para el informe de sombra. */
  evaluados: CandidatoEvaluado[]
}

export interface FalloRuta {
  ok: false
  codigo: CodigoFallo
  /** Qué pasó, para el tablero del dueño. NUNCA es lo que ve el médico. */
  motivo: string
  /** Estados de calidad vistos, para saber si hay que medir o hay que pagar. */
  estadosCalidad: EstadoCalidad[]
  politicaPresupuesto: PoliticaPresupuesto
  senalesPresupuesto: SenalPresupuesto[]
  evaluados: CandidatoEvaluado[]
}

export type ResultadoRuteo = DecisionRuta | FalloRuta

export interface EntradaRuteo {
  solicitud: SolicitudTarea
  catalogo?: readonly CapacidadModelo[]
  /** Evidencia de calidad disponible. Hoy, en producción, está vacía. */
  evidencias: readonly EvidenciaCalidad[]
  versionBenchmark: string
  salud: MapaSalud
  presupuesto: EstadoPresupuesto
  /** ISO. Se pasa siempre: un router con reloj propio no es determinista. */
  hoyISO: string
}

/* ════════════════════════════════════════════════════════════════════════
   Orden — determinista hasta el último desempate
   ════════════════════════════════════════════════════════════════════════ */

const TOLERANCIA: Record<ClaseLatencia, number> = { interactiva: 0, normal: 1, diferida: 2 }

/**
 * Costo para ORDENAR. Un costo desconocido va al final, no al principio.
 *
 * Es el mismo criterio del libro de costos con `sin_tarifa`: un modelo sin
 * tarifa que se ordenara como barato ganaría todas las comparaciones justo por
 * no haberse medido.
 */
const ordenCosto = (c: CostoEsperado): number => (c.usd == null ? Number.POSITIVE_INFINITY : c.usd)

/**
 * Menor costo, luego menor latencia, luego el id — que rompe cualquier empate.
 *
 * El último desempate por cadena existe para que dos ejecuciones con las mismas
 * entradas den EXACTAMENTE la misma respuesta, incluso cuando dos modelos
 * cuestan lo mismo y tardan lo mismo. Sin él, el orden dependería del orden del
 * catálogo, y una reordenación inocente del array cambiaría la decisión.
 */
function comparar(a: CandidatoEvaluado, b: CandidatoEvaluado): number {
  const dc = ordenCosto(a.costo) - ordenCosto(b.costo)
  if (dc !== 0) return dc
  const dl = TOLERANCIA[a.latencia] - TOLERANCIA[b.latencia]
  if (dl !== 0) return dl
  const dp = a.proveedor.localeCompare(b.proveedor)
  if (dp !== 0) return dp
  return a.modeloId.localeCompare(b.modeloId)
}

/* ════════════════════════════════════════════════════════════════════════
   El filtro
   ════════════════════════════════════════════════════════════════════════ */

function evaluarCandidato(
  c: CapacidadModelo, e: EntradaRuteo, piso: PisoCalidad,
): CandidatoEvaluado {
  const s = e.solicitud
  const entrada = Math.max(0, s.tamanoEntradaEstimado ?? 0)
  const salida = Math.max(0, s.presupuestoSalida ?? 0)
  const base = {
    proveedor: c.proveedor, modeloId: c.modeloId, latencia: c.latencia,
    costo: costoEsperado(c, entrada, salida, e.hoyISO),
    calidad: null as VeredictoCalidad | null,
  }
  const fuera = (descarte: MotivoDescarte, detalle: string): CandidatoEvaluado =>
    ({ ...base, elegible: false, descarte, detalle })

  // ── 1. ¿Se puede llamar de verdad? ───────────────────────────────────────
  if (c.estado !== 'configurado') {
    return fuera('no_configurado', `Estado «${c.estado}»: ${c.restricciones.join(' ') || 'no está conectado.'}`)
  }
  if (!esEjecutable(c)) {
    return fuera('proveedor_no_ejecutable', `El gateway no sabe llamar a «${c.proveedor}».`)
  }

  // ── 2. Restricciones declaradas por el llamador ──────────────────────────
  const r = s.restriccionesProveedor
  if (r?.soloEstos && r.soloEstos.length > 0 && !r.soloEstos.includes(c.proveedor)) {
    return fuera('restriccion_de_proveedor', `La tarea se restringe a ${r.soloEstos.join(', ')}.`)
  }
  if (r?.excluir?.includes(c.proveedor)) {
    return fuera('restriccion_de_proveedor', `La tarea excluye a ${c.proveedor}.`)
  }

  // ── 3. Capacidades ───────────────────────────────────────────────────────
  if (s.requiereSalidaEstructurada && !garantizaEstructura(c)) {
    return fuera('no_garantiza_estructura',
      `Salida estructurada «${c.salidaEstructurada}»: pedir JSON en el prompt no es una garantía.`)
  }
  if (!cabe(c, entrada, salida, !!s.requiereContextoLargo)) {
    return fuera('no_cabe', c.limiteContexto == null
      ? 'Los límites de contexto/salida no están cargados y la tarea pide contexto largo.'
      : `No cabe: ${entrada}+${salida} contra ${c.limiteContexto}/${c.limiteSalida}.`)
  }
  if (!latenciaAlcanza(c.latencia, s.latencia)) {
    return fuera('latencia_insuficiente', `Latencia «${c.latencia}» para una tarea «${s.latencia}».`)
  }

  // ── 4. ¿Está en pie el proveedor? ────────────────────────────────────────
  if (!alcanzable(e.salud, c.proveedor)) {
    return fuera('proveedor_no_disponible', `El proveedor ${c.proveedor} no está sirviendo ahora.`)
  }
  if (modeloCaido(e.salud, c.proveedor, c.modeloId)) {
    return fuera('modelo_caido', `El modelo ${c.modeloId} está descartado por un fallo previo.`)
  }

  // ── 5. LA COMPUERTA DE CALIDAD ───────────────────────────────────────────
  const calidad = compuertaCalidad({
    evidencia: buscarEvidencia(e.evidencias, c.proveedor, c.modeloId, s.claseTarea),
    piso, versionVigente: e.versionBenchmark, hoyISO: e.hoyISO, riesgo: s.riesgo,
  })
  if (!calidad.elegible) {
    return { ...base, calidad, elegible: false, descarte: 'calidad_no_demostrada', detalle: calidad.motivos.join(' ') }
  }

  return { ...base, calidad, elegible: true, descarte: null, detalle: null }
}

/* ════════════════════════════════════════════════════════════════════════
   Segunda revisión — condicional, nunca por defecto
   ════════════════════════════════════════════════════════════════════════ */

/**
 * ¿Hay que escalar, y por qué?
 *
 * `null` es la respuesta normal y es la que sale barata. #313 lo dice literal:
 * la segunda opinión es condicional, no universal — dos modelos en todas las
 * consultas duplican el costo del renglón más caro de la plataforma para
 * confirmar que la mayoría de las notas estaban bien.
 *
 * El ORDEN importa: se mira primero lo que no se puede ahorrar.
 */
export function motivoDeSegundaRevision(
  s: SolicitudTarea, politica: PoliticaPresupuesto,
): { motivo: CodigoRazon; ahorrable: boolean } | null {
  const g = s.senales ?? {}
  // Lo que el médico pide expresamente no se discute ni se ahorra.
  if (g.peticionDelMedico) return { motivo: 'segunda_revision_por_peticion_del_medico', ahorrable: false }
  // Un conflicto y una validación fallida existen porque algo YA salió mal.
  if (g.conflicto) return { motivo: 'segunda_revision_por_conflicto', ahorrable: false }
  if (g.validacionFallida) return { motivo: 'segunda_revision_por_validacion_fallida', ahorrable: false }
  // La incertidumbre en alta consecuencia tampoco se ahorra.
  if (g.incertidumbre) {
    return { motivo: 'segunda_revision_por_incertidumbre', ahorrable: s.riesgo !== 'alta_consecuencia' }
  }
  // El muestreo es control de calidad: útil, y lo primero que se recorta.
  if (g.muestreoBenchmark) return { motivo: 'segunda_revision_por_muestreo', ahorrable: true }
  return null
}

/**
 * Elige el segundo candidato.
 *
 * **Nunca el mismo modelo.** Repetir el mismo modelo con otro prompt y llamarlo
 * segunda opinión es la trampa que este riel tiene que impedir: dos pasadas del
 * mismo motor comparten sus mismos puntos ciegos, así que confirman el error
 * con más confianza en vez de cazarlo.
 *
 * Se prefiere OTRO PROVEEDOR. Si no lo hay, se acepta otro modelo del mismo y
 * se marca `mismo_proveedor`, para que quien lea la decisión sepa cuánta
 * independencia tiene de verdad.
 */
export function elegirSegundo(
  elegibles: readonly CandidatoEvaluado[], primario: CandidatoEvaluado,
): { candidato: CandidatoEvaluado; independencia: Independencia } | null {
  const otros = elegibles.filter(c => !(c.proveedor === primario.proveedor && c.modeloId === primario.modeloId))
  const otroProveedor = otros.filter(c => c.proveedor !== primario.proveedor)
  if (otroProveedor.length > 0) return { candidato: otroProveedor[0], independencia: 'proveedor_distinto' }
  if (otros.length > 0) return { candidato: otros[0], independencia: 'mismo_proveedor' }
  return null
}

/* ════════════════════════════════════════════════════════════════════════
   La decisión
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Elige el modelo mínimo suficiente, o dice por qué no hay ninguno.
 *
 * Función PURA: no lee el reloj, no lee la red, no lee la base. Todo lo que
 * necesita llega por parámetro, y por eso se puede fijar con casos.
 */
export function decidirRuta(e: EntradaRuteo): ResultadoRuteo {
  const s = e.solicitud
  const piso = pisoEfectivo(s.pisoCalidad)
  const pre = evaluarPresupuesto(e.presupuesto)
  const catalogo = e.catalogo ?? CATALOGO

  const candidatos = candidatosDe(s.claseTarea, catalogo)
  if (candidatos.length === 0) {
    return {
      ok: false, codigo: 'NO_CANDIDATES_FOR_TASK',
      motivo: `Ningún modelo del catálogo declara soportar «${s.claseTarea}».`,
      estadosCalidad: [], politicaPresupuesto: pre.politica, senalesPresupuesto: pre.senales, evaluados: [],
    }
  }

  const evaluados = candidatos.map(c => evaluarCandidato(c, e, piso)).sort(comparar)
  const elegibles = evaluados.filter(c => c.elegible)

  if (elegibles.length === 0) return sinCandidato(evaluados, pre, s.claseTarea)

  /**
   * ── EL MÍNIMO SUFICIENTE ─────────────────────────────────────────────────
   *
   * Ya están ordenados por costo, así que el primero es el más barato de LOS
   * QUE CUMPLEN. No hace falta una política distinta para «preferir barato»:
   * el criterio normal ya es ése. Lo que cambia con el presupuesto apretado es
   * lo que se AHORRA (la segunda revisión opcional), no lo que se exige.
   */
  const primario = elegibles[0]
  const codigos: CodigoRazon[] = []
  codigos.push(elegibles.length === 1 ? 'unico_candidato_elegible' : 'minimo_suficiente_por_costo')
  if (s.latencia === 'interactiva') codigos.push('latencia_manda')
  if (s.requiereSalidaEstructurada) codigos.push('estructura_garantizada_exigida')
  if (pre.politica !== 'normal') {
    codigos.push('presupuesto_prefiere_barato', 'presupuesto_no_bajo_el_piso')
    /**
     * Si con el presupuesto apretado lo único que cumple sale caro, se elige
     * igual Y SE DICE. Es el conflicto que el dueño tiene que ver: no se
     * resuelve bajando la vara, se resuelve subiendo el tope o midiendo un
     * modelo más barato para que entre por la puerta.
     */
    if (primario.costo.banda === 'alta') codigos.push('conflicto_presupuesto_calidad')
  }

  // ── Segunda revisión ─────────────────────────────────────────────────────
  let segunda: SegundaRevision | null = null
  const escalacion = s.permiteSegundaOpinion === false ? null : motivoDeSegundaRevision(s, pre.politica)
  if (!escalacion) {
    codigos.push('sin_segunda_revision_por_defecto')
  } else if (escalacion.ahorrable && puedeAhorrarSegundaOpinionOpcional(pre.politica)) {
    codigos.push('segunda_revision_omitida_por_presupuesto')
  } else {
    const seg = elegirSegundo(elegibles, primario)
    if (seg) {
      segunda = {
        proveedor: seg.candidato.proveedor, modeloId: seg.candidato.modeloId,
        independencia: seg.independencia, motivo: escalacion.motivo,
      }
      codigos.push(escalacion.motivo)
      if (seg.independencia === 'mismo_proveedor') codigos.push('segunda_opinion_no_independiente')
    } else {
      /**
       * Se pidió segunda opinión y no hay con quién. NO se repite el primario:
       * dos pasadas del mismo modelo comparten sus puntos ciegos y confirman el
       * error con más confianza. Se declara que no la hubo.
       */
      codigos.push('segunda_opinion_no_independiente')
    }
  }

  return {
    ok: true,
    proveedorSeleccionado: primario.proveedor,
    modeloSeleccionado: primario.modeloId,
    codigosRazon: codigos,
    refEvidenciaCalidad: primario.calidad?.referencia ?? null,
    bandaCostoEsperada: primario.costo.banda,
    costoEsperadoUsd: primario.costo.usd,
    latenciaEsperada: primario.latencia,
    respaldos: elegibles.slice(1).map(c => ({ proveedor: c.proveedor, modeloId: c.modeloId })),
    segundaRevision: segunda,
    politicaPresupuesto: pre.politica,
    senalesPresupuesto: pre.senales,
    evaluados,
  }
}

/**
 * Nadie pasó. Cuál de los fallos se reporta, y por qué importa cuál.
 *
 * Los cuatro fallos tienen arreglos DISTINTOS y a manos distintas: medir un
 * modelo, pagar una factura, cargar un límite de contexto, o revisar la
 * restricción que puso el llamador. Devolver siempre `NO_ELIGIBLE_MODEL` sería
 * el mismo encogimiento de hombros que `protocolo.ts` ya corrigió para los
 * errores HTTP.
 *
 * La precedencia va de lo más accionable a lo más genérico.
 */
function sinCandidato(
  evaluados: readonly CandidatoEvaluado[],
  pre: ReturnType<typeof evaluarPresupuesto>,
  clase: string,
): FalloRuta {
  const estadosCalidad = evaluados.map(c => c.calidad?.estado).filter((x): x is EstadoCalidad => !!x)
  const cuenta = (m: MotivoDescarte) => evaluados.filter(c => c.descarte === m).length
  const base = {
    ok: false as const, estadosCalidad,
    politicaPresupuesto: pre.politica, senalesPresupuesto: pre.senales,
    evaluados: [...evaluados],
  }
  const detalle = evaluados.map(c => `${c.proveedor}/${c.modeloId}: ${c.detalle ?? '—'}`).join(' · ')

  if (cuenta('calidad_no_demostrada') > 0) {
    /**
     * El presupuesto agotado Y ningún candidato que demuestre calidad es un
     * conflicto, no dos problemas sueltos: dice que no hay forma barata de
     * hacer esta tarea bien HOY. El arreglo no es bajar la vara.
     */
    const codigo: CodigoFallo = pre.politica === 'solo_lo_esencial'
      ? 'BUDGET_CONFLICT_WITH_QUALITY' : 'QUALITY_NOT_PROVEN'
    return { ...base, codigo, motivo:
      `Ningún modelo demuestra el piso de calidad para «${clase}». ${detalle}. ` +
      'No se selecciona uno insuficiente por ser barato: se escala.' }
  }
  if (cuenta('proveedor_no_disponible') + cuenta('modelo_caido') > 0) {
    return { ...base, codigo: 'PROVIDER_UNAVAILABLE',
      motivo: `Los proveedores capaces de «${clase}» no están sirviendo. ${detalle}.` }
  }
  if (cuenta('no_cabe') + cuenta('latencia_insuficiente') + cuenta('no_garantiza_estructura') > 0) {
    return { ...base, codigo: 'CAPABILITY_NOT_MET',
      motivo: `Ningún modelo reúne las capacidades que pide «${clase}». ${detalle}.` }
  }
  return { ...base, codigo: 'NO_ELIGIBLE_MODEL',
    motivo: `Ningún modelo configurado queda disponible para «${clase}». ${detalle}.` }
}

export const POR_QUE_LA_CALIDAD_SE_FILTRA_ANTES_QUE_EL_PRECIO =
  'Porque un router que ordena por precio y después mira la calidad elige al ' +
  'barato siempre que la comprobación sea floja — y hoy es floja, porque no hay ' +
  'evidencia cargada. Con la calidad primero, la ausencia de evidencia produce ' +
  'un fallo explícito; con el precio primero, produciría al más barato.'

export const POR_QUE_LA_SEGUNDA_OPINION_NUNCA_ES_EL_MISMO_MODELO =
  'Porque dos pasadas del mismo motor comparten sus mismos puntos ciegos: no ' +
  'cazan el error, lo confirman con más confianza. Una segunda opinión que no ' +
  'es independiente es peor que no tenerla, porque además tranquiliza.'
