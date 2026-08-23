/**
 * ECONOMÍA UNITARIA DE LA IA — sobre el libro de costos que ya existe.
 *
 * #313 §G. Ni un asiento nuevo, ni una segunda tabla de precios: se agrega lo
 * que `cost-ledger.ts` ya escribe, con las funciones que ya tiene
 * (`resumir`, `porClave`, `soloCogs`, `costoPorConsulta`).
 *
 * ── LAS TRES COLUMNAS QUE NO SE PUEDEN MEZCLAR ───────────────────────────────
 *
 *   OBSERVADO  — lo que pasó. Sale de asientos reales.
 *   ESCENARIO  — lo que pasaría SI. Sale de supuestos declarados.
 *   OBJETIVO   — lo que se quiere. Lo pone el dueño.
 *
 * Se separan en el TIPO, no en un comentario, porque la mezcla es el error que
 * este módulo existe para no cometer: un margen de escenario citado como
 * observado es una cifra inventada con otro nombre, y las decisiones de precio
 * se toman con esa cifra.
 *
 * ── LO QUE NO SE PUEDE CALCULAR HOY, Y SE DICE ───────────────────────────────
 *
 * El margen bruto REAL necesita ingreso cobrado y tipo de cambio, que viven en
 * Stripe y en `cartera-server`. Aquí sólo se produce el INSUMO del escenario:
 * el costo. Poner un margen aquí sería fijar política comercial desde un módulo
 * de ruteo.
 *
 * Módulo PURO.
 */
import {
  CADENA_CONSULTA, costoPorConsulta, porClave, resumir, soloCogs, suficiente,
  type EventoCosto, type ResumenCosto,
} from '@/lib/finanzas/cost-ledger'
import { claseDeFeature, type ClaseTarea } from '@/lib/ia/router/tareas'

/* ════════════════════════════════════════════════════════════════════════
   OBSERVADO
   ════════════════════════════════════════════════════════════════════════ */

export interface CostoPorClase {
  claseTarea: ClaseTarea | 'sin_mapear'
  resumen: ResumenCosto
}

/**
 * Costo por CLASE DE TAREA, puenteando desde el `feature` del libro.
 *
 * Los `feature` que no están en el puente van a `sin_mapear` en vez de repartirse
 * por defecto: un cubo equivocado produce una cifra que parece completa y no lo
 * está, que es peor que un hueco declarado.
 */
export function costoPorClaseTarea(eventos: readonly EventoCosto[]): CostoPorClase[] {
  const grupos = porClave(eventos, e => claseDeFeature(e.feature) ?? 'sin_mapear')
  return grupos.map(g => ({ claseTarea: g.clave as ClaseTarea | 'sin_mapear', resumen: g.resumen }))
}

export interface EconomiaObservada {
  /** Periodo declarado por quien llama. No se deduce de los asientos. */
  periodo: string
  /** Sólo COGS de cliente: fuera I+D del fundador y llaves propias. */
  cogs: ResumenCosto
  /** Costo de IA por consulta dictada. `null` si no hubo consultas. */
  porConsulta: ReturnType<typeof costoPorConsulta>
  /**
   * Costo de IA por médico activo/mes. `null` cuando no se sabe cuántos
   * estuvieron activos: dividir entre cero no es cero, y dividir entre un
   * número supuesto es peor.
   */
  porMedicoMes: number | null
  /** Cuántos médicos activos declaró el llamador. */
  medicosActivos: number | null
  porClase: CostoPorClase[]
  porProveedor: { clave: string; resumen: ResumenCosto }[]
  porModelo: { clave: string; resumen: ResumenCosto }[]
  /** Latencia de toda la tanda. */
  latenciaP50: number | null
  latenciaP95: number | null
  /** Lo que costaron las llamadas que fallaron. Se paga igual. */
  costoDeFallosUsd: number
  /** Proporción de llamadas que fallaron (0..1). */
  tasaFallo: number
  /**
   * Proporción de operaciones que acabaron en segunda opinión.
   *
   * `null` cuando no hay eventos de ruteo: el libro de costos NO sabe si una
   * llamada fue una segunda opinión —anota `feature`, no la razón— y deducirlo
   * de que haya dos llamadas seguidas sería adivinar.
   */
  tasaSegundaOpinion: number | null
  /** ¿Se puede afirmar el total, o falta demasiada tarifa? */
  seSostiene: boolean
  /** Lo que hay que saber para leer estas cifras sin equivocarse. */
  supuestos: string[]
}

export interface EntradaObservada {
  eventos: readonly EventoCosto[]
  periodo: string
  /** Médicos activos en el periodo. `null` si no se sabe. NO se estima. */
  medicosActivos?: number | null
  /**
   * Operaciones de ruteo del periodo, para la tasa de segunda opinión.
   * `null` si no hay telemetría de ruteo todavía (que es el caso hoy).
   */
  ruteo?: { total: number; conSegundaRevision: number } | null
}

export function economiaObservada(e: EntradaObservada): EconomiaObservada {
  const cogsEventos = soloCogs(e.eventos)
  const cogs = resumir(cogsEventos)
  const fallos = cogsEventos.filter(x => x.fallo)
  const porMedico = e.medicosActivos != null && e.medicosActivos > 0
    ? Number((cogs.totalUsd / e.medicosActivos).toFixed(6))
    : null

  return {
    periodo: e.periodo,
    cogs,
    porConsulta: costoPorConsulta(cogsEventos),
    porMedicoMes: porMedico,
    medicosActivos: e.medicosActivos ?? null,
    porClase: costoPorClaseTarea(cogsEventos),
    porProveedor: porClave(cogsEventos, x => x.proveedor),
    porModelo: porClave(cogsEventos, x => x.modelo),
    latenciaP50: cogs.latenciaP50,
    latenciaP95: cogs.latenciaP95,
    costoDeFallosUsd: Number(fallos.reduce((s, x) => s + (x.costoUsd ?? 0), 0).toFixed(6)),
    tasaFallo: cogsEventos.length > 0 ? Number((fallos.length / cogsEventos.length).toFixed(4)) : 0,
    tasaSegundaOpinion: e.ruteo && e.ruteo.total > 0
      ? Number((e.ruteo.conSegundaRevision / e.ruteo.total).toFixed(4))
      : null,
    seSostiene: suficiente(cogs),
    supuestos: [
      `Cadena de una consulta = ${CADENA_CONSULTA.join(', ')}.`,
      'Sólo COGS de cliente: se excluye I+D del fundador y las llaves propias del consultorio.',
      'Los totales suman SÓLO lo que tiene tarifa cargada; `sinTarifa` dice cuánto quedó fuera.',
      e.medicosActivos == null
        ? 'Médicos activos NO declarados: el costo por médico/mes no se calcula.'
        : `Médicos activos declarados por el llamador: ${e.medicosActivos}.`,
      e.ruteo == null
        ? 'Sin telemetría de ruteo: la tasa de segunda opinión no se puede calcular desde el libro de costos.'
        : 'Tasa de segunda opinión tomada de la telemetría de ruteo, no deducida del libro.',
    ],
  }
}

/* ════════════════════════════════════════════════════════════════════════
   ESCENARIO
   ════════════════════════════════════════════════════════════════════════ */

/** Un «¿y si?». Todos sus números son SUPUESTOS y viajan con su etiqueta. */
export interface SupuestosEscenario {
  nombre: string
  consultasPorMedicoMes: number
  costoUsdPorConsulta: number
  medicos: number
  /** De dónde salió cada número. Sin esto el escenario no se presenta. */
  procedencia: string
}

export interface Escenario {
  clase: 'ESCENARIO'
  nombre: string
  costoIaMensualUsd: number
  costoIaPorMedicoMesUsd: number
  supuestos: SupuestosEscenario
  /** Se repite en la salida para que no se cite sin ella. */
  advertencia: string
}

/**
 * Proyecta un escenario. Aritmética, nada más.
 *
 * No hay ingreso, ni precio, ni margen: eso es política comercial del dueño y
 * fijarlo desde el riel de ruteo sería exactamente lo que #313 prohíbe.
 */
export function escenario(s: SupuestosEscenario): Escenario {
  const porMedico = s.consultasPorMedicoMes * s.costoUsdPorConsulta
  return {
    clase: 'ESCENARIO', nombre: s.nombre,
    costoIaMensualUsd: Number((porMedico * s.medicos).toFixed(4)),
    costoIaPorMedicoMesUsd: Number(porMedico.toFixed(4)),
    supuestos: s,
    advertencia:
      'ESCENARIO, no medición. Cada número viene de un supuesto declarado en ' +
      '`procedencia`. No se cita como costo observado ni sostiene una decisión de precio.',
  }
}

/* ════════════════════════════════════════════════════════════════════════
   OBJETIVO
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Lo que el dueño quiere que pase. Nace VACÍO a propósito.
 *
 * Un objetivo de costo por consulta es una decisión comercial. Escribir aquí
 * «$0.20» lo convertiría en la cifra que todos citan sin que nadie la haya
 * decidido — el mismo fallo que `precios-modelo.ts` evita naciendo vacío.
 */
export interface Objetivo {
  clase: 'OBJETIVO'
  metrica: 'costo_por_consulta_usd' | 'costo_por_medico_mes_usd' | 'tasa_segunda_opinion' | 'p95_latencia_ms'
  valor: number
  /** Quién lo fijó y cuándo. Sin esto no se acepta. */
  fijadoPor: string
  fijadoEn: string
}

export const OBJETIVOS: readonly Objetivo[] = []

export const POR_QUE_NO_HAY_OBJETIVOS_CARGADOS =
  'Porque un objetivo de costo por consulta es una decisión comercial del ' +
  'dueño, no un valor por defecto de un módulo de ruteo. Escribir uno aquí lo ' +
  'convertiría en la cifra que todos citan sin que nadie la haya decidido.'

export const POR_QUE_OBSERVADO_Y_ESCENARIO_NO_COMPARTEN_TIPO =
  'Porque la mezcla es el error que este módulo existe para no cometer. Un ' +
  'margen de escenario citado como observado es una cifra inventada con otro ' +
  'nombre, y las decisiones de precio se toman con esa cifra.'
