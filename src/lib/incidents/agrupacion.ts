/**
 * AGRUPAR — de diez mil eventos a un incidente que se puede leer.
 *
 * ── LA REGLA QUE ORDENA ESTE ARCHIVO ─────────────────────────────────────────
 *
 * Los conjuntos que crecen (rutas, funciones, operaciones afectadas, inquilinos)
 * tienen TOPE, y cuando se toca **se declara**. Es la regla de `ops/alcance.ts`
 * aplicada aquí: un recorte que nadie ve se lee como el total, y en una consola
 * de incidentes eso significa decir «afecta a 200 operaciones» cuando afecta a
 * ochenta mil. Por eso `operacionesAfectadas` viaja con `operacionesRecortadas`.
 *
 * ── POR QUÉ SE CUENTAN OPERACIONES Y NO PERSONAS ─────────────────────────────
 *
 * Contar médicos exigiría un identificador de médico en la telemetría; contar
 * pacientes exigiría uno de paciente, que además sería PHI. La unidad de
 * observación es la OPERACIÓN —un guardado, una reserva, una transcripción—,
 * que es opaca y además es la que responde a la pregunta que importa: cuánto
 * trabajo se está perdiendo. De inquilinos se guarda sólo el RECUENTO de
 * seudónimos distintos, que basta para separar «un consultorio con la llave mal»
 * de «la plataforma caída» sin nombrar a nadie.
 *
 * Módulo PURO.
 */
import {
  dimensionesDe, peorImpacto, peorSeveridad,
  type CategoriaIncidente, type DimensionesIncidente, type EstadoIncidente,
  type EventoIncidente, type Severidad,
} from './taxonomia'
import { familiaDe, firmaDe, plantillaDeRuta } from './firma'

/**
 * Tope de elementos distintos por conjunto.
 *
 * 200 caben en una pantalla de soporte y en un documento de Firestore sin
 * acercarse al límite de 1 MiB. No es un límite de producto: es el freno para
 * que un incidente no se coma el documento que lo describe.
 */
export const TOPE_CONJUNTO = 200

export interface GrupoIncidente {
  readonly firma: string
  readonly familia: string
  readonly categoria: CategoriaIncidente
  readonly subtipo: string
  readonly proveedor?: string
  readonly appVersion: string
  /** ISO del primer y del último evento VISTOS, no del primero anotado. */
  readonly firstSeen: string
  readonly lastSeen: string
  /** Cuántos eventos cayeron en esta firma. Nunca se recorta: es un contador. */
  readonly count: number
  readonly features: readonly string[]
  readonly rutas: readonly string[]
  /** Operaciones distintas afectadas. Opacas. */
  readonly operacionesAfectadas: number
  /** `true` cuando se tocó el tope: el número de arriba es un SUELO, no el total. */
  readonly operacionesRecortadas: boolean
  /** Cuántos consultorios distintos, sin decir cuáles. */
  readonly inquilinosAfectados: number
  readonly inquilinosRecortados: boolean
  /** Hilos de correlación de muestra, para poder tirar del hilo en soporte. */
  readonly correlaciones: readonly string[]
  readonly dimensiones: DimensionesIncidente
  readonly estado: EstadoIncidente
}

/** Añade con tope y dice si se recortó. */
function anadir(set: Set<string>, v: string | undefined): boolean {
  if (!v) return false
  if (set.has(v)) return false
  if (set.size >= TOPE_CONJUNTO) return true   // recortado
  set.add(v)
  return false
}

/**
 * Agrupa una tanda de eventos por firma.
 *
 * Determinista: mismo orden de entrada, mismo resultado; y el resultado sale
 * ordenado por firma, no por orden de llegada, para que dos ejecuciones de la
 * misma tanda desordenada den lo mismo.
 *
 * Los eventos que no se pueden firmar —porque llevan texto donde debía ir una
 * etiqueta— NO se cuelan sin firma: se devuelven aparte en `rechazados`. Un
 * evento que se descarta en silencio es un fallo que deja de existir.
 */
export function agrupar(eventos: readonly EventoIncidente[]): {
  grupos: GrupoIncidente[]
  rechazados: Array<{ evento: EventoIncidente; porQue: string }>
} {
  const acc = new Map<string, {
    base: EventoIncidente
    familia: string
    count: number
    first: string
    last: string
    features: Set<string>
    rutas: Set<string>
    ops: Set<string>
    opsRecortadas: boolean
    inquilinos: Set<string>
    inquilinosRecortados: boolean
    correlaciones: Set<string>
    severidad: Severidad
    dimensiones: DimensionesIncidente
  }>()
  const rechazados: Array<{ evento: EventoIncidente; porQue: string }> = []

  for (const e of eventos) {
    let firma: string, familia: string
    try {
      firma = firmaDe(e)
      familia = familiaDe(e)
    } catch (err) {
      rechazados.push({ evento: e, porQue: (err as Error).message })
      continue
    }
    const dim = dimensionesDe(e)
    const previo = acc.get(firma)
    if (!previo) {
      const g = {
        base: e, familia, count: 1,
        first: e.ocurridoEn, last: e.ocurridoEn,
        features: new Set<string>(), rutas: new Set<string>(),
        ops: new Set<string>(), opsRecortadas: false,
        inquilinos: new Set<string>(), inquilinosRecortados: false,
        correlaciones: new Set<string>(),
        severidad: dim.severidad, dimensiones: dim,
      }
      g.features.add(e.feature)
      anadir(g.rutas, plantillaDeRuta(e.ruta) || undefined)
      g.opsRecortadas = anadir(g.ops, e.operationId) || g.opsRecortadas
      g.inquilinosRecortados = anadir(g.inquilinos, e.tenantRef) || g.inquilinosRecortados
      anadir(g.correlaciones, e.correlationId)
      acc.set(firma, g)
      continue
    }
    previo.count += 1
    if (e.ocurridoEn < previo.first) previo.first = e.ocurridoEn
    if (e.ocurridoEn > previo.last) previo.last = e.ocurridoEn
    anadir(previo.features, e.feature)
    anadir(previo.rutas, plantillaDeRuta(e.ruta) || undefined)
    previo.opsRecortadas = anadir(previo.ops, e.operationId) || previo.opsRecortadas
    previo.inquilinosRecortados = anadir(previo.inquilinos, e.tenantRef) || previo.inquilinosRecortados
    // Sólo se guardan las primeras correlaciones: son muestras, no un censo.
    if (previo.correlaciones.size < 10) anadir(previo.correlaciones, e.correlationId)
    previo.severidad = peorSeveridad(previo.severidad, dim.severidad)
    previo.dimensiones = {
      ...previo.dimensiones,
      severidad: previo.severidad,
      impacto: peorImpacto(previo.dimensiones.impacto, dim.impacto),
    }
  }

  const grupos: GrupoIncidente[] = [...acc.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([firma, g]) => ({
      firma,
      familia: g.familia,
      categoria: g.base.categoria,
      subtipo: g.base.subtipo,
      ...(g.base.proveedor ? { proveedor: g.base.proveedor } : {}),
      appVersion: g.base.appVersion,
      firstSeen: g.first,
      lastSeen: g.last,
      count: g.count,
      features: [...g.features].sort(),
      rutas: [...g.rutas].sort(),
      operacionesAfectadas: g.ops.size,
      operacionesRecortadas: g.opsRecortadas,
      inquilinosAfectados: g.inquilinos.size,
      inquilinosRecortados: g.inquilinosRecortados,
      correlaciones: [...g.correlaciones].sort(),
      dimensiones: g.dimensiones,
      estado: 'abierto' as EstadoIncidente,
    }))

  return { grupos, rechazados }
}

/**
 * Une un grupo recién calculado con el que ya estaba guardado.
 *
 * Es lo que permite que la consola no dependa de tener todos los eventos de la
 * historia en memoria: el estado vive en el grupo guardado y cada tanda lo
 * empuja. Los `count` se SUMAN, los conjuntos se unen con el mismo tope, y el
 * `estado` del guardado gana — un incidente que soporte marcó `resuelto` no
 * vuelve a `abierto` porque llegue un evento rezagado de hace media hora;
 * para eso está `lastSeen`, que sí avanza.
 */
export function fusionar(guardado: GrupoIncidente, nuevo: GrupoIncidente): GrupoIncidente {
  if (guardado.firma !== nuevo.firma) {
    throw new Error('[incidents/agrupacion] no se fusionan dos firmas distintas')
  }
  const unir = (a: readonly string[], b: readonly string[]) => {
    const s = new Set(a)
    let recortado = false
    for (const v of b) recortado = anadir(s, v) || recortado
    return { lista: [...s].sort(), recortado }
  }
  const features = unir(guardado.features, nuevo.features)
  const rutas = unir(guardado.rutas, nuevo.rutas)
  const correlaciones = unir(guardado.correlaciones.slice(0, 10), nuevo.correlaciones.slice(0, 10))
  return {
    ...guardado,
    firstSeen: guardado.firstSeen < nuevo.firstSeen ? guardado.firstSeen : nuevo.firstSeen,
    lastSeen: guardado.lastSeen > nuevo.lastSeen ? guardado.lastSeen : nuevo.lastSeen,
    count: guardado.count + nuevo.count,
    features: features.lista,
    rutas: rutas.lista,
    /**
     * Los recuentos de operaciones e inquilinos se SUMAN y por eso quedan
     * declarados como cota superior en la consola: sin los identificadores
     * originales no se puede saber si la operación de esta tanda ya estaba
     * contada en la anterior. Guardarlos para poder deduplicar sería guardar
     * un censo de operaciones por incidente, que es justo lo que no se hace.
     */
    operacionesAfectadas: guardado.operacionesAfectadas + nuevo.operacionesAfectadas,
    operacionesRecortadas: guardado.operacionesRecortadas || nuevo.operacionesRecortadas,
    inquilinosAfectados: Math.max(guardado.inquilinosAfectados, nuevo.inquilinosAfectados),
    inquilinosRecortados: guardado.inquilinosRecortados || nuevo.inquilinosRecortados,
    correlaciones: correlaciones.lista,
    dimensiones: {
      ...guardado.dimensiones,
      severidad: peorSeveridad(guardado.dimensiones.severidad, nuevo.dimensiones.severidad),
      impacto: peorImpacto(guardado.dimensiones.impacto, nuevo.dimensiones.impacto),
    },
  }
}

export const POR_QUE_SE_CUENTAN_OPERACIONES_Y_NO_PERSONAS =
  'Porque contar médicos exige un identificador de médico en la telemetría y ' +
  'contar pacientes exige uno de paciente, que además es PHI. La operación es ' +
  'opaca y contesta mejor la pregunta que importa: cuánto trabajo se está ' +
  'perdiendo ahora mismo.'
