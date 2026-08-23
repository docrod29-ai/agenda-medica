/**
 * SIMULACROS DE INCIDENTE — sin producción, sin llamar a nadie y sin gastar un peso.
 *
 * ── QUÉ MIDE ESTE ARNÉS, Y QUÉ NO ────────────────────────────────────────────
 *
 * Mide **el motor**: cuántos eventos hacen falta para que cruce la raya, si la
 * firma agrupa, si la política deja reparar, cuántos intentos consume y qué se le
 * dice al médico. Todo con un reloj inyectado, así que dos ejecuciones dan lo
 * mismo hasta el milisegundo.
 *
 * **No mide el mundo.** No hay red, ni proveedor, ni Firestore. El tiempo que
 * tarda una acción de reparación es un PARÁMETRO del escenario —declarado, no
 * medido— y por eso todo lo que sale de aquí viaja marcado `simulacro`, que en
 * `mttd-mttr.ts` se imprime como «mide el motor, no el mundo real».
 *
 * Decir «nuestro MTTR es de 12 segundos» a partir de esto sería falso. Decir «el
 * motor decide y arranca la reparación en 12 s simulados» es cierto y es lo que
 * este arnés puede sostener.
 *
 * ── POR QUÉ EL RELOJ SE INYECTA ──────────────────────────────────────────────
 *
 * Un simulacro con `Date.now()` da un informe distinto cada vez que se corre, así
 * que no se puede comparar con el anterior — y un informe que no se puede
 * comparar no detecta que el motor empeoró.
 *
 * Módulo PURO.
 */
import { agrupar } from './agrupacion'
import { estadoParaElMedico, type EstadoParaElMedico } from './contrato-medico'
import { resumirTiempos, tiempoHastaDetectar, tiempoHastaRecuperar, type LineaDeTiempo, type ResumenTiempos } from './mttd-mttr'
import {
  PRESUPUESTO_POR_OMISION, avanzar, cerrarIntento, iniciarIntento, nuevoEstado,
  esperaAntesDe, type EstadoRemediacion, type ResultadoIntento,
} from './maquina'
import { puedeAutoRepararse, type IncidenteParaDecidir } from './remediacion'
import { runbookPara } from './runbooks'
import { evaluarUmbral, POLITICA_POR_OMISION, type SenalesDeImpacto, type Veredicto } from './umbrales'
import { dimensionesDe, type CategoriaIncidente, type DimensionesIncidente, type Severidad } from './taxonomia'

/** Un fallo del escenario: cuándo ocurre, respecto al inicio. */
export interface FalloSimulado {
  /** Milisegundos desde el inicio del escenario. */
  readonly enMs: number
  readonly operationId?: string
  readonly tenantRef?: string
}

export interface Escenario {
  readonly id: string
  readonly titulo: string
  readonly categoria: CategoriaIncidente
  readonly subtipo: string
  readonly feature: string
  readonly ruta?: string
  readonly proveedor?: string
  readonly codigoNormalizado?: string
  readonly severidad?: Severidad
  /**
   * Endurece o precisa las dimensiones del caso concreto.
   *
   * Existe porque la categoría sola no basta: una escritura a la base con clave
   * de idempotencia es `reversible` y una sin ella es `desconocida`, y son el
   * mismo `persistence`. El escenario declara cuál de las dos está simulando —
   * y esa declaración es la que decide si la política deja reparar.
   */
  readonly dimensionesOverride?: Partial<DimensionesIncidente>
  readonly fallos: readonly FalloSimulado[]
  readonly senales?: SenalesDeImpacto
  /** Qué acción del catálogo se propone. `null` = ninguna, se espera humano. */
  readonly accionPropuesta: string | null
  readonly idempotenciaGarantizada?: boolean
  /**
   * Lo que devuelve el mundo simulado en cada intento, en orden. Si se acaba la
   * lista, los siguientes fallan. DECLARADO: el arnés no adivina si el
   * proveedor se recupera.
   */
  readonly resultadosDeIntento: readonly ResultadoIntento[]
  /** Cuánto tarda una acción de reparación. PARÁMETRO, no medición. */
  readonly duracionDeAccionMs: number
  /** Qué se espera. El simulacro compara y falla si no coincide. */
  readonly esperado: {
    readonly esIncidente: boolean
    readonly remediacionPermitida: boolean
    readonly gruposEsperados: number
    readonly avisoRequerido: boolean
  }
}

export interface ResultadoDeSimulacro {
  readonly id: string
  readonly titulo: string
  readonly eventosGenerados: number
  /** Eventos que NO se pudieron firmar. Un evento descartado en silencio no existe. */
  readonly eventosRechazados: number
  readonly grupos: number
  readonly firma: string | null
  readonly veredicto: Veredicto
  readonly esIncidente: boolean
  readonly remediacionPermitida: boolean
  readonly porQueLaRemediacion: string
  readonly intentos: number
  readonly faseFinal: string
  readonly desenlace: 'recuperado' | 'degradado' | 'requiere_humano' | 'sin_incidente'
  readonly avisoRequerido: boolean
  readonly runbookId: string
  readonly mensajeAlMedico: EstadoParaElMedico
  readonly mttdMs: number | null
  readonly mttrMs: number | null
  readonly linea: LineaDeTiempo
  /** `true` cuando el resultado coincide con lo esperado. */
  readonly conforme: boolean
  readonly discrepancias: readonly string[]
}

const iso = (t0: number, offsetMs: number) => new Date(t0 + offsetMs).toISOString()

/**
 * Corre un escenario.
 *
 * El instante de DETECCIÓN no se declara: se mide. Se van metiendo los fallos de
 * uno en uno y se reevalúa la raya después de cada uno; el primero que la cruza
 * es la detección. Eso es lo que hace que el MTTD del informe signifique algo —
 * si el umbral sube, el número sube solo.
 */
export function correrEscenario(e: Escenario, t0: number, appVersion: string): ResultadoDeSimulacro {
  const eventos = e.fallos.map(f => ({
    categoria: e.categoria,
    subtipo: e.subtipo,
    feature: e.feature,
    ...(e.ruta ? { ruta: e.ruta } : {}),
    ...(e.proveedor ? { proveedor: e.proveedor } : {}),
    ...(e.codigoNormalizado ? { codigoNormalizado: e.codigoNormalizado } : {}),
    appVersion,
    ocurridoEn: iso(t0, f.enMs),
    ...(f.operationId ? { operationId: f.operationId } : {}),
    ...(f.tenantRef ? { tenantRef: f.tenantRef } : {}),
    ...(e.severidad ? { severidad: e.severidad } : {}),
  }))

  const completo = agrupar(eventos)
  /**
   * Si un evento no se puede firmar, el simulacro NO sigue como si nada: lo
   * cuenta y lo declara. Un arnés que se traga eventos rechazados da un informe
   * bonito de un motor que no está viendo la mitad de lo que pasa.
   */
  const eventosRechazados = completo.rechazados.length

  // ── Detección: se mide metiendo los eventos de uno en uno ─────────────────
  let detectadoEnMs: number | null = null
  let veredicto: Veredicto = completo.grupos[0]
    ? evaluarUmbral(completo.grupos[0], e.senales, POLITICA_POR_OMISION)
    : { esIncidente: false, razones: [], porQue: 'ningún evento se pudo firmar', noEvaluado: [] }
  for (let i = 1; i <= eventos.length; i += 1) {
    const parcial = agrupar(eventos.slice(0, i))
    const g = parcial.grupos[0]
    if (!g) continue
    const v = evaluarUmbral(g, e.senales, POLITICA_POR_OMISION)
    if (v.esIncidente) { detectadoEnMs = e.fallos[i - 1].enMs; veredicto = v; break }
    veredicto = v
  }

  const grupos = completo.grupos
  const grupo = grupos[0] ?? null
  const esIncidente = detectadoEnMs !== null

  const dimensiones: DimensionesIncidente = {
    ...dimensionesDe({ categoria: e.categoria, ...(e.severidad ? { severidad: e.severidad } : {}) }),
    ...(e.dimensionesOverride ?? {}),
  }
  const paraDecidir: IncidenteParaDecidir = {
    categoria: e.categoria,
    dimensiones,
    ...(e.idempotenciaGarantizada !== undefined ? { idempotenciaGarantizada: e.idempotenciaGarantizada } : {}),
  }
  const decision = e.accionPropuesta
    ? puedeAutoRepararse(paraDecidir, e.accionPropuesta)
    : { permitida: false, reglas: [] as never[], porQue: 'el escenario no propone ninguna acción automática' }

  const rb = runbookPara(e.categoria, e.subtipo)
  const primerFalloEn = iso(t0, e.fallos.length ? e.fallos[0].enMs : 0)

  // ── Remediación: sólo si hubo incidente y la política dejó ────────────────
  let estado: EstadoRemediacion = nuevoEstado(grupo?.firma ?? e.id, primerFalloEn, PRESUPUESTO_POR_OMISION)
  let recuperadoEnMs: number | null = null
  let desenlace: ResultadoDeSimulacro['desenlace'] = 'sin_incidente'

  if (esIncidente && detectadoEnMs !== null) {
    estado = avanzar(estado, 'clasificado', iso(t0, detectadoEnMs))
    estado = avanzar(estado, 'agrupado', iso(t0, detectadoEnMs))
    estado = avanzar(estado, 'evaluando', iso(t0, detectadoEnMs))
    if (decision.permitida && e.accionPropuesta) {
      estado = avanzar(estado, 'remediacion_elegible', iso(t0, detectadoEnMs))
      let reloj = detectadoEnMs
      let i = 0
      for (;;) {
        reloj += esperaAntesDe(estado.intentos.length + 1)
        const abierto = iniciarIntento(estado, e.accionPropuesta, iso(t0, reloj))
        if (!abierto) break               // presupuesto agotado: el freno, no un `break` de cortesía
        estado = abierto.estado
        reloj += e.duracionDeAccionMs
        const r = e.resultadosDeIntento[i] ?? 'fallido'
        i += 1
        estado = cerrarIntento(estado, r, `simulacro:${r}`, iso(t0, reloj))
        if (r === 'recuperado') { recuperadoEnMs = reloj; desenlace = 'recuperado'; break }
        if (r === 'degradado') { desenlace = 'degradado'; break }
        if (estado.fase === 'requiere_humano') { desenlace = 'requiere_humano'; break }
      }
      if (desenlace === 'sin_incidente') desenlace = estado.fase === 'requiere_humano' ? 'requiere_humano' : 'degradado'
    } else {
      estado = avanzar(estado, 'requiere_humano', iso(t0, detectadoEnMs))
      desenlace = 'requiere_humano'
    }
  }

  const linea: LineaDeTiempo = {
    primerFalloEn,
    ...(detectadoEnMs !== null ? { detectadoEn: iso(t0, detectadoEnMs) } : {}),
    ...(recuperadoEnMs !== null ? { recuperadoEn: iso(t0, recuperadoEnMs) } : {}),
  }

  /**
   * ¿Hay que avisar a alguien? Sólo si es incidente Y no se arregló solo.
   *
   * Un incidente que se recuperó en dos intentos no despierta a nadie: queda
   * anotado y se mira por la mañana. Ésa es la diferencia entre un sistema que
   * avisa y uno que grita.
   */
  const avisoRequerido = esIncidente && desenlace !== 'recuperado'

  const discrepancias: string[] = []
  if (esIncidente !== e.esperado.esIncidente) {
    discrepancias.push(`esIncidente=${esIncidente}, se esperaba ${e.esperado.esIncidente}`)
  }
  if (decision.permitida !== e.esperado.remediacionPermitida) {
    discrepancias.push(`remediacionPermitida=${decision.permitida}, se esperaba ${e.esperado.remediacionPermitida}`)
  }
  if (grupos.length !== e.esperado.gruposEsperados) {
    discrepancias.push(`grupos=${grupos.length}, se esperaban ${e.esperado.gruposEsperados}`)
  }
  if (avisoRequerido !== e.esperado.avisoRequerido) {
    discrepancias.push(`avisoRequerido=${avisoRequerido}, se esperaba ${e.esperado.avisoRequerido}`)
  }
  if (eventosRechazados > 0) {
    discrepancias.push(`${eventosRechazados} evento(s) no se pudieron firmar: ${completo.rechazados[0]?.porQue ?? ''}`)
  }

  return {
    id: e.id,
    titulo: e.titulo,
    eventosGenerados: eventos.length,
    eventosRechazados,
    grupos: grupos.length,
    firma: grupo?.firma ?? null,
    veredicto,
    esIncidente,
    remediacionPermitida: decision.permitida,
    porQueLaRemediacion: decision.porQue,
    intentos: estado.intentos.length,
    faseFinal: estado.fase,
    desenlace,
    avisoRequerido,
    runbookId: rb.id,
    mensajeAlMedico: estadoParaElMedico({
      categoria: e.categoria,
      dimensiones,
      hayRespaldo: rb.accionesAutomaticas.includes('respaldo_de_proveedor_autorizado'),
      soporteAvisado: avisoRequerido,
    }),
    mttdMs: tiempoHastaDetectar(linea),
    mttrMs: tiempoHastaRecuperar(linea),
    linea,
    conforme: discrepancias.length === 0,
    discrepancias,
  }
}

export interface InformeDeSimulacro {
  readonly generadoCon: 'reloj inyectado, sin red, sin proveedores, sin producción'
  readonly appVersion: string
  readonly t0: string
  readonly escenarios: readonly ResultadoDeSimulacro[]
  readonly conformes: number
  readonly total: number
  readonly tiempos: ResumenTiempos
  /** Lo que este informe NO demuestra. Va dentro del informe, no en una nota al pie. */
  readonly loQueNoDemuestra: readonly string[]
}

export function correrTodos(escenarios: readonly Escenario[], t0: number, appVersion: string): InformeDeSimulacro {
  const resultados = escenarios.map(e => correrEscenario(e, t0, appVersion))
  return {
    generadoCon: 'reloj inyectado, sin red, sin proveedores, sin producción',
    appVersion,
    t0: new Date(t0).toISOString(),
    escenarios: resultados,
    conformes: resultados.filter(r => r.conforme).length,
    total: resultados.length,
    tiempos: resumirTiempos(resultados.map(r => r.linea), 'simulacro'),
    loQueNoDemuestra: [
      'No demuestra ningún MTTD/MTTR de producción: no hay red, ni proveedor, ni base de datos.',
      'La duración de cada acción de reparación es un parámetro del escenario, no una medición.',
      'No prueba que las rutas reales del producto emitan estos eventos: eso es cableado, y va en los handoffs.',
      'No cubre Hospital ni UCI.',
    ],
  }
}
