/**
 * ══════════════════════════════════════════════════════════════════════════
 * ARNÉS DE BENCHMARK (#314 punto 11)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mide las métricas que #314 declara obligatorias: latencia p50/p95,
 * corrección de cita, soporte real afirmación↔fuente, tasa de afirmación sin
 * respaldo, frescura, comportamiento ante caída y costo cuando se conoce.
 *
 * ── LA DECISIÓN DE DISEÑO QUE LO HACE ÚTIL ──────────────────────────────────
 *
 * Corre contra el adaptador SINTÉTICO, no contra PubMed. Un benchmark contra la
 * red mide la red: cambia entre ejecuciones, tarda por el throttle de 3 req/s y
 * necesita una clave. Ese benchmark se marca `skip` el primer viernes que falla
 * y a partir de ahí no mide nada.
 *
 * Lo que se mide aquí es LA TUBERÍA: dado un retrieval conocido y una síntesis
 * conocida, ¿el sistema ancla lo que debe anclar y rechaza lo que debe
 * rechazar? Eso es determinista y es lo que puede romperse en una regresión.
 *
 * ── LO QUE ESTE ARNÉS NO MIDE, Y HAY QUE DECIRLO ────────────────────────────
 *
 *  · NO mide la CALIDAD CLÍNICA de la síntesis. Que una afirmación esté anclada
 *    a un pasaje literal no la hace clínicamente correcta ni relevante. Eso lo
 *    juzga un médico, y su sitio es `evals/`, no un arnés determinista.
 *  · NO mide la latencia REAL de ningún proveedor. La latencia sintética es la
 *    del arnés. Para latencia real hace falta medir en producción con sobres
 *    reales — que es justo para lo que el sobre lleva `telemetria`.
 *  · NO mide costo real: `costoUsd` sólo se agrega si el adaptador lo declara.
 *    Un costo ausente NO se cuenta como cero (ver `costoTotal`).
 *
 * Declarar esto no es modestia: un benchmark que parece medir calidad clínica y
 * no la mide es peor que no tenerlo, porque se cita como si la midiera.
 */

import type { AdaptadorDeEvidencia, ContextoDeRecuperacion, ConsultaDeEvidencia, SobreDeRecuperacion } from './contrato'
import { tieneMaterial } from './contrato'
import { corpusParaSintesis, mapaDeSoporte, tasaSinRespaldo, esRespuestaRespaldada } from './soporte'
import { frescuraDeSobre, tasaDeFrescura } from './frescura'

/**
 * Un caso del arnés. `sintesisCruda` es lo que un modelo DEVOLVERÍA — se fija
 * a mano para que el caso sea determinista y para poder inyectar a propósito la
 * afirmación inventada, que es lo que el arnés existe para cazar.
 */
export interface CasoDeBenchmark {
  readonly id: string
  readonly consulta: ConsultaDeEvidencia
  /** Forma `{texto, citas, pasajes, cifra?}`, la misma que ya usa la ruta real. */
  readonly sintesisCruda: readonly unknown[]
  /** Cuántas afirmaciones DEBEN quedar ancladas. El caso lo declara. */
  readonly esperadasRespaldadas: number
  /** Cuántas DEBEN quedar sin anclar. Un caso adversarial declara ≥1. */
  readonly esperadasSinRespaldo: number
  /** Qué comprueba este caso. Obligatorio: un caso sin propósito se borra. */
  readonly porQue: string
}

export interface MedidasDeCaso {
  readonly id: string
  readonly latenciaTotalMs: number
  readonly latenciasPorProveedor: readonly { proveedor: string; ms: number }[]
  readonly fuentesRecuperadas: number
  readonly proveedoresConsultados: number
  readonly proveedoresNoConsultados: number
  readonly respaldadas: number
  readonly sinRespaldo: number
  readonly tasaSinRespaldo: number
  readonly tasaDeFrescura: number
  readonly respuestaRespaldada: boolean
  /** `null` = ningún adaptador declaró costo. NO es cero. */
  readonly costoUsd: number | null
  /** ¿Coincide con lo que el caso declaraba esperar? */
  readonly cumple: boolean
  readonly desviacion?: string
}

export interface InformeDeBenchmark {
  readonly casos: readonly MedidasDeCaso[]
  readonly latenciaP50Ms: number
  readonly latenciaP95Ms: number
  readonly tasaSinRespaldoGlobal: number
  readonly casosQueCumplen: number
  readonly costoTotalUsd: number | null
  /** Sobres de fallo vistos, por clase. Mide el comportamiento ante caída. */
  readonly fallosPorClase: Readonly<Record<string, number>>
}

/**
 * Percentil por interpolación lineal, con el borde bien puesto: con un solo
 * dato devuelve ese dato en vez de `NaN` o `undefined`. Un p95 que revienta con
 * pocos casos es un p95 que nadie mira.
 */
export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) return 0
  const orden = [...valores].sort((a, b) => a - b)
  if (orden.length === 1) return orden[0]
  const pos = (orden.length - 1) * p
  const bajo = Math.floor(pos), alto = Math.ceil(pos)
  if (bajo === alto) return orden[bajo]
  return orden[bajo] + (orden[alto] - orden[bajo]) * (pos - bajo)
}

/**
 * Corre un caso contra un conjunto de adaptadores.
 *
 * `ahora` se PASA: sin reloj inyectado, la frescura cambiaría con el día y el
 * arnés dejaría de ser reproducible — el mismo criterio que `Source.recuperadoEn`.
 */
export async function correrCaso(
  caso: CasoDeBenchmark,
  adaptadores: readonly AdaptadorDeEvidencia[],
  ctx: ContextoDeRecuperacion,
): Promise<MedidasDeCaso> {
  const sobres: SobreDeRecuperacion[] = []
  for (const a of adaptadores) {
    sobres.push(await a.recuperar(caso.consulta, ctx))
  }

  const corpus = corpusParaSintesis(sobres)
  const mapa = mapaDeSoporte(caso.sintesisCruda, corpus)

  const veredictos = sobres.flatMap(s => frescuraDeSobre(s, ctx.ahora))
  const latencias = sobres.map(s => ({ proveedor: String(s.proveedor), ms: s.telemetria.latenciaMs }))
  const costos = sobres.map(s => s.telemetria.costoUsd).filter((c): c is number => typeof c === 'number')

  const cumple = mapa.respaldadas.length === caso.esperadasRespaldadas
    && mapa.sinRespaldo.length === caso.esperadasSinRespaldo

  return {
    id: caso.id,
    latenciaTotalMs: latencias.reduce((n, l) => n + l.ms, 0),
    latenciasPorProveedor: latencias,
    fuentesRecuperadas: corpus.fuentes.length,
    proveedoresConsultados: sobres.filter(tieneMaterial).length,
    proveedoresNoConsultados: sobres.filter(s => !tieneMaterial(s)).length,
    respaldadas: mapa.respaldadas.length,
    sinRespaldo: mapa.sinRespaldo.length,
    tasaSinRespaldo: tasaSinRespaldo(mapa),
    tasaDeFrescura: tasaDeFrescura(veredictos),
    respuestaRespaldada: esRespuestaRespaldada(mapa),
    // AUSENTE ≠ CERO. Si ningún adaptador declara costo, el informe dice `null`
    // y no «gratis». Un cero inventado aquí acabaría en una diapositiva.
    costoUsd: costos.length > 0 ? costos.reduce((a, b) => a + b, 0) : null,
    cumple,
    ...(cumple ? {} : {
      desviacion: `esperaba ${caso.esperadasRespaldadas} respaldada(s) y ${caso.esperadasSinRespaldo} sin respaldo; obtuvo ${mapa.respaldadas.length} y ${mapa.sinRespaldo.length}. Sin respaldo: ${mapa.sinRespaldo.map(s => s.motivo).join(', ') || '(ninguna)'}`,
    }),
  }
}

/** Corre el lote entero y agrega. */
export async function correrBenchmark(
  casos: readonly CasoDeBenchmark[],
  adaptadores: readonly AdaptadorDeEvidencia[],
  ctx: ContextoDeRecuperacion,
): Promise<InformeDeBenchmark> {
  const medidas: MedidasDeCaso[] = []
  const fallosPorClase: Record<string, number> = {}

  for (const caso of casos) {
    // Se recorren los sobres una segunda vez sólo para contar clases de fallo.
    // Es barato (los adaptadores del arnés son deterministas) y mantiene
    // `correrCaso` con una sola responsabilidad.
    for (const a of adaptadores) {
      const s = await a.recuperar(caso.consulta, ctx)
      if (!tieneMaterial(s)) fallosPorClase[s.clase] = (fallosPorClase[s.clase] ?? 0) + 1
    }
    medidas.push(await correrCaso(caso, adaptadores, ctx))
  }

  const latencias = medidas.map(m => m.latenciaTotalMs)
  const totalAfirmaciones = medidas.reduce((n, m) => n + m.respaldadas + m.sinRespaldo, 0)
  const totalSinRespaldo = medidas.reduce((n, m) => n + m.sinRespaldo, 0)
  const costos = medidas.map(m => m.costoUsd).filter((c): c is number => c !== null)

  return {
    casos: medidas,
    latenciaP50Ms: percentil(latencias, 0.5),
    latenciaP95Ms: percentil(latencias, 0.95),
    tasaSinRespaldoGlobal: totalAfirmaciones === 0 ? 0 : totalSinRespaldo / totalAfirmaciones,
    casosQueCumplen: medidas.filter(m => m.cumple).length,
    costoTotalUsd: costos.length > 0 ? costos.reduce((a, b) => a + b, 0) : null,
    fallosPorClase,
  }
}

/** Informe legible. Lo imprime `scripts/evidence/benchmark-evidencia.mjs`. */
export function informeLegible(i: InformeDeBenchmark): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const lineas = [
    '── BENCHMARK DE EVIDENCIA (#314) ───────────────────────────────────────',
    `casos                        ${i.casos.length}`,
    `casos que cumplen            ${i.casosQueCumplen}/${i.casos.length}`,
    `latencia p50 / p95           ${i.latenciaP50Ms.toFixed(1)} ms / ${i.latenciaP95Ms.toFixed(1)} ms`,
    `afirmaciones sin respaldo    ${pct(i.tasaSinRespaldoGlobal)}`,
    `costo                        ${i.costoTotalUsd === null ? 'NO DECLARADO por ningún adaptador (no es cero)' : `$${i.costoTotalUsd.toFixed(4)}`}`,
    `fallos por clase             ${Object.entries(i.fallosPorClase).sort().map(([c, n]) => `${c}×${n}`).join(', ') || '(ninguno)'}`,
    '',
    'NO MIDE: calidad clínica de la síntesis, latencia real de ningún proveedor,',
    'ni costo real. Ver el encabezado de src/lib/evidence-integrations/benchmark.ts.',
    '',
  ]
  for (const c of i.casos) {
    lineas.push(`${c.cumple ? '  ok  ' : '  MAL '} ${c.id}  fuentes=${c.fuentesRecuperadas} respaldadas=${c.respaldadas} sinRespaldo=${c.sinRespaldo} frescura=${pct(c.tasaDeFrescura)} ${c.latenciaTotalMs}ms`)
    if (c.desviacion) lineas.push(`        ${c.desviacion}`)
  }
  return lineas.join('\n')
}
