/**
 * MODO SOMBRA — comparar dos políticas de ruteo sin gastar una llamada.
 *
 * #313 §M. Se le dan N tareas sintéticas y dos configuraciones (la de hoy y la
 * propuesta), y devuelve qué habría elegido cada una, cuánto habría costado y
 * cuántas veces se habría quedado sin candidato.
 *
 * ── LA CIFRA QUE MANDA ───────────────────────────────────────────────────────
 *
 * `violacionesDelPiso` tiene que ser **0**. No es una métrica más entre las
 * otras: es la condición de que el informe se pueda mirar siquiera. Un ahorro
 * del 40 % con una violación del piso no es un ahorro — es haber cambiado
 * seguridad clínica por dinero y haberlo presentado como una mejora.
 *
 * Por eso `comparar()` devuelve `aceptable: false` en cuanto hay una, y el
 * informe lo pone en la primera línea.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No llama a ningún proveedor. No toca producción. No decide nada: produce un
 * informe para que decida una persona.
 *
 * Módulo PURO.
 */
import { decidirRuta, type EntradaRuteo, type ResultadoRuteo } from '@/lib/ia/router/decidir'
import type { CapacidadModelo } from '@/lib/ia/router/catalogo'
import type { MapaSalud } from '@/lib/ia/router/disponibilidad'
import type { EstadoPresupuesto } from '@/lib/ia/router/presupuesto'
import type { ClaseLatencia, EvidenciaCalidad, SolicitudTarea } from '@/lib/ia/router/tareas'

/** Una configuración completa del router. Lo que se compara son dos de éstas. */
export interface Configuracion {
  nombre: string
  catalogo: readonly CapacidadModelo[]
  evidencias: readonly EvidenciaCalidad[]
  versionBenchmark: string
  salud: MapaSalud
  presupuesto: EstadoPresupuesto
}

export interface CasoSombra {
  id: string
  solicitud: SolicitudTarea
}

export interface MedidasSombra {
  configuracion: string
  casos: number
  /** Cuántas veces salió elegido cada `proveedor/modelo`. */
  distribucionModelos: { modelo: string; veces: number }[]
  /**
   * Casos en que se eligió un modelo que NO pasaba el piso.
   *
   * Por construcción del router debería ser imposible. Se mide igual: un
   * invariante que sólo se sostiene «por construcción» es un invariante que
   * nadie está comprobando.
   */
  violacionesDelPiso: number
  /** USD estimados sumados. Sólo de los casos con tarifa conocida. */
  costoEstimadoUsd: number
  /** Casos cuyo costo no se pudo estimar. */
  sinTarifa: number
  /** USD estimados por caso decidido. `null` si no se decidió ninguno. */
  costoPorCasoUsd: number | null
  distribucionLatencia: Record<ClaseLatencia, number>
  /** Casos que usaron un respaldo (el primario no era el único). */
  conRespaldo: number
  tasaSegundaRevision: number
  /**
   * Casos donde SÍ hacía falta una segunda revisión y no había con quién.
   *
   * Se mide aparte de `tasaSegundaRevision` porque son cosas opuestas que un
   * solo contador confundiría: «no escaló» y «quiso escalar y no pudo» se leen
   * igual en un cero, y la segunda es la que hay que arreglar comprando o
   * midiendo un segundo candidato.
   */
  segundaRevisionPedidaSinCandidato: number
  tasaSinCandidato: number
  /** Por qué no hubo candidato, agrupado. */
  fallos: { codigo: string; veces: number }[]
}

export interface ResultadoSombra {
  medidas: MedidasSombra
  /** Decisión por caso, para poder mirar uno concreto. */
  porCaso: { id: string; decision: ResultadoRuteo }[]
}

const LATENCIAS: ClaseLatencia[] = ['interactiva', 'normal', 'diferida']

/** Corre una configuración contra los casos. Sin red, sin reloj propio. */
export function correrSombra(
  casos: readonly CasoSombra[], cfg: Configuracion, hoyISO: string,
): ResultadoSombra {
  const porCaso = casos.map(c => {
    const entrada: EntradaRuteo = {
      solicitud: c.solicitud, catalogo: cfg.catalogo, evidencias: cfg.evidencias,
      versionBenchmark: cfg.versionBenchmark, salud: cfg.salud,
      presupuesto: cfg.presupuesto, hoyISO,
    }
    return { id: c.id, decision: decidirRuta(entrada) }
  })

  const modelos = new Map<string, number>()
  const fallos = new Map<string, number>()
  const latencias: Record<ClaseLatencia, number> = { interactiva: 0, normal: 0, diferida: 0 }
  let violaciones = 0, costo = 0, sinTarifa = 0, decididos = 0
  let conRespaldo = 0, conSegunda = 0, sinCandidato = 0, segundaSinCandidato = 0

  for (const { decision } of porCaso) {
    if (!decision.ok) {
      sinCandidato++
      fallos.set(decision.codigo, (fallos.get(decision.codigo) ?? 0) + 1)
      continue
    }
    decididos++
    const k = `${decision.proveedorSeleccionado}/${decision.modeloSeleccionado}`
    modelos.set(k, (modelos.get(k) ?? 0) + 1)
    latencias[decision.latenciaEsperada]++
    if (decision.respaldos.length > 0) conRespaldo++
    if (decision.segundaRevision) conSegunda++
    else if (decision.codigosRazon.includes('segunda_opinion_no_independiente')) segundaSinCandidato++
    if (decision.costoEsperadoUsd == null) sinTarifa++
    else costo += decision.costoEsperadoUsd
    /**
     * La comprobación independiente: se vuelve a mirar el candidato elegido en
     * la lista de evaluados y se exige que su veredicto de calidad diga `pasa`.
     * No se confía en que el filtro lo hiciera bien — se comprueba.
     */
    const elegido = decision.evaluados.find(
      x => x.proveedor === decision.proveedorSeleccionado && x.modeloId === decision.modeloSeleccionado,
    )
    if (!elegido || elegido.calidad?.estado !== 'pasa') violaciones++
  }

  const orden = <T extends { veces: number }>(xs: T[]) => xs.sort((a, b) => b.veces - a.veces)
  const n = casos.length || 1

  return {
    porCaso,
    medidas: {
      configuracion: cfg.nombre,
      casos: casos.length,
      distribucionModelos: orden([...modelos].map(([modelo, veces]) => ({ modelo, veces }))),
      violacionesDelPiso: violaciones,
      costoEstimadoUsd: Number(costo.toFixed(6)),
      sinTarifa,
      costoPorCasoUsd: decididos > 0 ? Number((costo / decididos).toFixed(6)) : null,
      distribucionLatencia: latencias,
      conRespaldo,
      tasaSegundaRevision: Number((conSegunda / n).toFixed(4)),
      segundaRevisionPedidaSinCandidato: segundaSinCandidato,
      tasaSinCandidato: Number((sinCandidato / n).toFixed(4)),
      fallos: orden([...fallos].map(([codigo, veces]) => ({ codigo, veces }))),
    },
  }
}

/**
 * Una divergencia AGRUPADA: «100 casos pasaron de X a Y», no cien renglones.
 *
 * Se agrupa porque un informe con una fila por caso deja de leerse en cuanto la
 * simulación crece, y lo que hay que ver es el PATRÓN del cambio. Se guardan
 * unos pocos ids de ejemplo para poder ir a mirar uno concreto.
 */
export interface Divergencia {
  actual: string
  propuesta: string
  casos: number
  ejemplos: string[]
}

export interface Comparacion {
  actual: MedidasSombra
  propuesta: MedidasSombra
  /** Cambios de decisión, agrupados por par (antes → después). */
  divergencias: Divergencia[]
  /** Total de casos que cambiaron de decisión. */
  casosDivergentes: number
  /** USD. Negativo = la propuesta cuesta menos. `null` si alguna no se pudo estimar. */
  deltaCostoUsd: number | null
  /**
   * `false` en cuanto la propuesta viola el piso o pierde candidatos.
   *
   * Perder candidatos también cuenta: una propuesta que ahorra dejando tareas
   * sin hacer no ahorró, movió el problema a la consulta.
   */
  aceptable: boolean
  motivos: string[]
}

/** Cuántos ids de ejemplo se guardan por par de divergencia. */
export const EJEMPLOS_POR_DIVERGENCIA = 3

export function comparar(actual: ResultadoSombra, propuesta: ResultadoSombra): Comparacion {
  const pares = new Map<string, Divergencia>()
  const mapa = new Map(propuesta.porCaso.map(c => [c.id, c.decision]))
  const nombre = (d: ResultadoSombra['porCaso'][number]['decision']) =>
    d.ok ? `${d.proveedorSeleccionado}/${d.modeloSeleccionado}` : `SIN_CANDIDATO:${d.codigo}`

  for (const c of actual.porCaso) {
    const otra = mapa.get(c.id)
    if (!otra) continue
    const a = nombre(c.decision), b = nombre(otra)
    if (a === b) continue
    const k = `${a}→${b}`
    const previo = pares.get(k) ?? { actual: a, propuesta: b, casos: 0, ejemplos: [] }
    previo.casos++
    if (previo.ejemplos.length < EJEMPLOS_POR_DIVERGENCIA) previo.ejemplos.push(c.id)
    pares.set(k, previo)
  }
  const divergencias = [...pares.values()].sort((x, y) => y.casos - x.casos)
  const casosDivergentes = divergencias.reduce((s2, d) => s2 + d.casos, 0)

  const motivos: string[] = []
  if (propuesta.medidas.violacionesDelPiso > 0) {
    motivos.push(
      `La propuesta selecciona ${propuesta.medidas.violacionesDelPiso} modelo(s) sin evidencia de que ` +
      'pasen el piso. Esto invalida el informe entero: no es un ahorro, es seguridad clínica cambiada por dinero.')
  }
  if (propuesta.medidas.tasaSinCandidato > actual.medidas.tasaSinCandidato) {
    motivos.push(
      `La propuesta se queda sin candidato más a menudo (${propuesta.medidas.tasaSinCandidato} vs ` +
      `${actual.medidas.tasaSinCandidato}). Ahorrar dejando tareas sin hacer no es ahorrar.`)
  }

  const puedeRestar = actual.medidas.sinTarifa === 0 && propuesta.medidas.sinTarifa === 0
  return {
    actual: actual.medidas, propuesta: propuesta.medidas, divergencias, casosDivergentes,
    deltaCostoUsd: puedeRestar
      ? Number((propuesta.medidas.costoEstimadoUsd - actual.medidas.costoEstimadoUsd).toFixed(6))
      : null,
    aceptable: motivos.length === 0,
    motivos,
  }
}

/** Informe legible. El mismo dato que el JSON, para que nadie lea sólo uno. */
export function informeMarkdown(c: Comparacion, hoyISO: string): string {
  const l: string[] = []
  l.push('# Informe de sombra — router de costo/calidad (#313)', '')
  l.push(`Generado: ${hoyISO}. **Sin llamadas a proveedores.** Todos los casos son sintéticos.`, '')
  l.push(c.aceptable
    ? '## VEREDICTO: la propuesta no viola el piso de calidad ni pierde candidatos.'
    : '## VEREDICTO: NO ACEPTABLE.')
  for (const m of c.motivos) l.push('', `- ${m}`)
  l.push('', '## Medidas', '')
  l.push('| Métrica | Actual | Propuesta |', '|---|---|---|')
  const fila = (k: string, a: unknown, b: unknown) => l.push(`| ${k} | ${a} | ${b} |`)
  fila('Casos', c.actual.casos, c.propuesta.casos)
  fila('**Violaciones del piso**', c.actual.violacionesDelPiso, c.propuesta.violacionesDelPiso)
  fila('Costo estimado (USD)', c.actual.costoEstimadoUsd, c.propuesta.costoEstimadoUsd)
  fila('Costo por caso (USD)', c.actual.costoPorCasoUsd ?? '—', c.propuesta.costoPorCasoUsd ?? '—')
  fila('Casos sin tarifa', c.actual.sinTarifa, c.propuesta.sinTarifa)
  fila('Tasa sin candidato', c.actual.tasaSinCandidato, c.propuesta.tasaSinCandidato)
  fila('Tasa de segunda revisión', c.actual.tasaSegundaRevision, c.propuesta.tasaSegundaRevision)
  fila('2ª revisión pedida SIN candidato independiente',
    c.actual.segundaRevisionPedidaSinCandidato, c.propuesta.segundaRevisionPedidaSinCandidato)
  fila('Con respaldo disponible', c.actual.conRespaldo, c.propuesta.conRespaldo)
  fila('Latencia interactiva', c.actual.distribucionLatencia.interactiva, c.propuesta.distribucionLatencia.interactiva)
  fila('Latencia normal', c.actual.distribucionLatencia.normal, c.propuesta.distribucionLatencia.normal)
  fila('Latencia diferida', c.actual.distribucionLatencia.diferida, c.propuesta.distribucionLatencia.diferida)
  fila('Δ costo (USD)', '—', c.deltaCostoUsd ?? 'no estimable (hay casos sin tarifa)')

  l.push('', '## Modelos elegidos', '')
  l.push('| Configuración | Modelo | Veces |', '|---|---|---|')
  for (const d of c.actual.distribucionModelos) l.push(`| actual | ${d.modelo} | ${d.veces} |`)
  for (const d of c.propuesta.distribucionModelos) l.push(`| propuesta | ${d.modelo} | ${d.veces} |`)

  if (c.actual.fallos.length + c.propuesta.fallos.length > 0) {
    l.push('', '## Por qué no hubo candidato', '')
    l.push('| Configuración | Código | Veces |', '|---|---|---|')
    for (const f of c.actual.fallos) l.push(`| actual | ${f.codigo} | ${f.veces} |`)
    for (const f of c.propuesta.fallos) l.push(`| propuesta | ${f.codigo} | ${f.veces} |`)
  }

  if (c.divergencias.length > 0) {
    l.push('', `## Divergencias — ${c.casosDivergentes} casos, ${c.divergencias.length} patrones`, '')
    l.push('| Actual | Propuesta | Casos | Ejemplos |', '|---|---|---|---|')
    for (const d of c.divergencias) {
      l.push(`| ${d.actual} | ${d.propuesta} | ${d.casos} | ${d.ejemplos.join(', ')} |`)
    }
  }

  l.push('', '---', '',
    'Las cifras de costo son ESTIMACIONES del catálogo sobre tarifas con fuente y fecha ' +
    '(`precios-modelo.ts`). No son facturación: el costo real lo escribe el libro de costos ' +
    'al volver de cada llamada.')
  return l.join('\n') + '\n'
}

export const POR_QUE_CERO_VIOLACIONES_NO_ES_UNA_METRICA_MAS =
  'Porque un ahorro del 40 % con una violación del piso no es un ahorro: es ' +
  'seguridad clínica cambiada por dinero y presentada como una mejora. Es la ' +
  'única cifra del informe que decide si el resto se puede mirar siquiera.'
