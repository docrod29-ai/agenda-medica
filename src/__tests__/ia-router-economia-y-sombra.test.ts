/**
 * GOLDEN — economía unitaria del router y modo sombra (#313 §G, §M, §K).
 *
 * ── QUÉ SE PROTEGE ───────────────────────────────────────────────────────────
 *
 * Que las cifras de dinero que salgan de este riel se puedan defender:
 *
 *  · **Lo observado y lo proyectado no se mezclan.** Un margen de escenario
 *    citado como observado es una cifra inventada con otro nombre, y las
 *    decisiones de precio se toman con esa cifra.
 *  · **Lo que no se puede calcular, se declara.** Costo por médico/mes sin
 *    saber cuántos médicos hubo es `null`, nunca una división contra un número
 *    supuesto.
 *  · **El informe de sombra falla si la propuesta viola el piso**, aunque
 *    ahorre. Cero violaciones no es una métrica más: es la condición de que el
 *    resto del informe se pueda mirar.
 *  · **Al médico no se le enseñan modelos.** Los estados que salen de aquí son
 *    funcionales; el nombre del proveedor no cabe en el tipo.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA ────────────────────────────────────────
 *
 * El repositorio ya tuvo dos cifras del mismo dinero (P0-2: un catálogo de
 * planes quemado en `superadmin` que discrepaba de `PLANES` en sus cuatro
 * renglones), y ya tuvo un total que parecía completo sin serlo — el que
 * `cost-ledger.ts` corrigió con `sin_tarifa` en vez de `$0`.
 *
 * ── CAUSA RAÍZ QUE VIGILA ────────────────────────────────────────────────────
 *
 * Sumar lo desconocido como cero, y presentar un supuesto como una medición.
 * Los dos producen un número plausible y ninguno rompe nada.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * 100 % sintéticos. Asientos y tareas escritos para esta prueba.
 *
 * ── QUÉ **NO** CUBRE, DECLARADO ──────────────────────────────────────────────
 *
 * · No calcula margen bruto: hace falta ingreso cobrado y tipo de cambio, que
 *   viven en Stripe y en `cartera-server`. Aquí sólo está el insumo de costo.
 * · No mide latencia real: el router no ejecuta. La latencia observada la
 *   escribe el gateway en el libro de costos.
 * · No valida que las tarifas del proveedor sigan vigentes — eso lo dice
 *   `consultado` de `precios-modelo.ts`, y comprobarlo exige red.
 */
import { describe, it, expect } from 'vitest'
import { asiento, type EntradaLedger, type EventoCosto } from '@/lib/finanzas/cost-ledger'
import { economiaObservada, escenario, OBJETIVOS, costoPorClaseTarea } from '@/lib/ia/router/economia'
import { correrSombra, comparar, informeMarkdown, type CasoSombra, type Configuracion } from '@/lib/ia/router/sombra'
import { CATALOGO } from '@/lib/ia/router/catalogo'
import { EVIDENCIA_CARGADA, VERSION_BENCHMARK } from '@/lib/ia/router/calidad'
import { estadoParaElMedico, type EstadoPresupuesto } from '@/lib/ia/router/presupuesto'
import { claseDeFeature, type EvidenciaCalidad } from '@/lib/ia/router/tareas'

const HOY = '2026-08-23T12:00:00.000Z'

const HOLGADO: EstadoPresupuesto = {
  gastoUsd: 0, topeUsd: null, reintentos: 0, topeReintentos: null,
  tasaSegundaOpinion: 0, topeTasaSegundaOpinion: null,
}

const llamada = (e: Partial<EntradaLedger>): EventoCosto => asiento({
  requestId: 'req-x', clinicId: 'c1', uid: 'u1', feature: 'nota-consulta',
  proveedor: 'anthropic', modelo: 'claude-sonnet-5',
  uso: { entrada: 10_000, salida: 3000 }, latenciaMs: 4200, creditos: 3,
  fuente: 'prueba', ts: HOY, ...e,
})

/* ══════════════════════════════════════════════════════════════════════════ */

describe('economía observada', () => {
  const eventos = [
    llamada({ feature: 'transcribir', modelo: 'whisper-1', uso: { entrada: 0, salida: 0, minutosAudio: 12 } }),
    llamada({ feature: 'corregir-transcripcion', modelo: 'claude-haiku-4-5', uso: { entrada: 4000, salida: 900 } }),
    llamada({ feature: 'nota-consulta' }),
    llamada({ feature: 'verificar-nota', proveedor: 'openai', modelo: 'gpt-5', uso: { entrada: 12_000, salida: 1500 } }),
  ]

  it('agrupa por CLASE DE TAREA usando el `feature` que el libro ya anota', () => {
    // Es el puente que evita un segundo libro de costos: el histórico se puede
    // leer por clase sin reetiquetar un solo asiento.
    const porClase = costoPorClaseTarea(eventos)
    const clases = porClase.map(c => c.claseTarea)
    expect(clases).toContain('note_rendering')
    expect(clases).toContain('safety_review')
    expect(clases).toContain('transcription_cleanup')
  })

  it('un `feature` sin mapear cae en `sin_mapear`, NO en un cubo por defecto', () => {
    // Un cubo equivocado produce una cifra que parece completa y está mal.
    const r = costoPorClaseTarea([...eventos, llamada({ feature: 'feature-que-nadie-mapeo' })])
    expect(r.find(c => c.claseTarea === 'sin_mapear')?.resumen.llamadas).toBe(2)
    expect(claseDeFeature('feature-que-nadie-mapeo')).toBeNull()
  })

  it('sin médicos activos declarados, el costo por médico/mes es null — no una división inventada', () => {
    const r = economiaObservada({ eventos, periodo: '2026-08' })
    expect(r.porMedicoMes).toBeNull()
    expect(r.supuestos.some(s => s.includes('NO declarados'))).toBe(true)
  })

  it('con médicos declarados sí se calcula, y el supuesto viaja con la cifra', () => {
    const r = economiaObservada({ eventos, periodo: '2026-08', medicosActivos: 4 })
    expect(r.porMedicoMes).toBeGreaterThan(0)
    expect(r.supuestos.some(s => s.includes('declarados por el llamador: 4'))).toBe(true)
  })

  it('la tasa de segunda opinión NO se deduce del libro de costos', () => {
    // El libro anota `feature`, no la razón. Deducirla de que haya dos llamadas
    // seguidas sería adivinar y presentarlo como medición.
    const sinRuteo = economiaObservada({ eventos, periodo: '2026-08' })
    expect(sinRuteo.tasaSegundaOpinion).toBeNull()
    const conRuteo = economiaObservada({
      eventos, periodo: '2026-08', ruteo: { total: 40, conSegundaRevision: 6 },
    })
    expect(conRuteo.tasaSegundaOpinion).toBe(0.15)
  })

  it('un modelo sin tarifa no se suma como cero: se cuenta aparte', () => {
    const conDesconocido = [...eventos, llamada({ modelo: 'modelo-inexistente-xyz' })]
    const r = economiaObservada({ eventos: conDesconocido, periodo: '2026-08' })
    expect(r.cogs.sinTarifa).toBe(1)
    expect(r.cogs.modelosSinTarifa).toContain('modelo-inexistente-xyz')
    /**
     * Y el total DEJA DE SOSTENERSE cuando falta cobertura.
     *
     * Con los cuatro asientos base todos tienen tarifa —incluido el audio, que
     * se cobra por minuto— y el total se puede afirmar. Al añadir uno sin
     * tarifa la cobertura baja a 4/5 y `suficiente()` lo rechaza: un total
     * calculado sobre la mitad de las llamadas no es un total.
     */
    expect(economiaObservada({ eventos, periodo: '2026-08' }).seSostiene).toBe(true)
    expect(r.seSostiene).toBe(false)
  })

  it('el gasto de I+D del fundador NO entra en el costo de servir', () => {
    // §CD: atribuirlo a COGS infla el costo y las decisiones de precio salen mal.
    const conFundador = [...eventos, llamada({ fuente: 'fundador', esFundador: true, feature: 'nota-consulta' })]
    const a = economiaObservada({ eventos, periodo: '2026-08' })
    const b = economiaObservada({ eventos: conFundador, periodo: '2026-08' })
    expect(b.cogs.totalUsd).toBe(a.cogs.totalUsd)
  })

  it('lo que costaron los fallos se cuenta: un 500 con 4 000 tokens generados se paga igual', () => {
    const conFallo = [...eventos, llamada({ fallo: true, uso: { entrada: 9000, salida: 4000 } })]
    const r = economiaObservada({ eventos: conFallo, periodo: '2026-08' })
    expect(r.costoDeFallosUsd).toBeGreaterThan(0)
    expect(r.tasaFallo).toBeGreaterThan(0)
  })
})

describe('escenario y objetivo — separados en el tipo, no en un comentario', () => {
  it('un escenario se marca a sí mismo y arrastra su procedencia', () => {
    const e = escenario({
      nombre: '20 consultas/médico/mes', consultasPorMedicoMes: 20,
      costoUsdPorConsulta: 0.15, medicos: 10,
      procedencia: 'Costo por consulta tomado del informe de sombra sintético del 23-ago-2026.',
    })
    expect(e.clase).toBe('ESCENARIO')
    expect(e.costoIaPorMedicoMesUsd).toBe(3)
    expect(e.costoIaMensualUsd).toBe(30)
    expect(e.advertencia).toContain('no medición')
    expect(e.supuestos.procedencia).toBeTruthy()
  })

  it('no hay objetivos cargados: fijarlos es decisión del dueño', () => {
    expect(OBJETIVOS).toEqual([])
  })
})

describe('modo sombra', () => {
  const casos: CasoSombra[] = [
    { id: 's1', solicitud: {
      claseTarea: 'extraction_structuring', riesgo: 'bajo', latencia: 'normal',
      pisoCalidad: { exactitudMin: 0.9, tasaErrorMax: 0.1, muestraMin: 10 },
      tamanoEntradaEstimado: 5000, presupuestoSalida: 1500, correlacionId: 's1' } },
    { id: 's2', solicitud: {
      claseTarea: 'note_rendering', riesgo: 'alta_consecuencia', latencia: 'normal',
      pisoCalidad: { exactitudMin: 0.95, tasaErrorMax: 0.05, muestraMin: 10 },
      tamanoEntradaEstimado: 12_000, presupuestoSalida: 5000, correlacionId: 's2' } },
  ]

  const resumen = (casosN: number, exactitud: number, error: number, aluc = 0) => ({
    casos: casosN, camposEsperados: casosN * 5,
    correctos: Math.round(casosN * 5 * exactitud), incorrectos: Math.round(casosN * 5 * error),
    faltantes: 0, alucinaciones: Math.round(aluc * casosN),
    exactitudCampo: exactitud, tasaError: error, alucinacionesPorCaso: aluc,
  })

  const cfg = (nombre: string, evidencias: EvidenciaCalidad[]): Configuracion => ({
    nombre, catalogo: CATALOGO, evidencias, versionBenchmark: VERSION_BENCHMARK,
    salud: [], presupuesto: HOLGADO,
  })

  const BUENA: EvidenciaCalidad[] = [
    { proveedor: 'openai', modeloId: 'gpt-5', claseTarea: 'extraction_structuring',
      versionBenchmark: VERSION_BENCHMARK, evaluadoEn: '2026-08-22T00:00:00.000Z',
      resumen: resumen(50, 0.96, 0.04), origen: 'sintetico' },
    { proveedor: 'anthropic', modeloId: 'claude-sonnet-5', claseTarea: 'note_rendering',
      versionBenchmark: VERSION_BENCHMARK, evaluadoEn: '2026-08-22T00:00:00.000Z',
      resumen: resumen(50, 0.97, 0.03), origen: 'sintetico' },
  ]

  it('el estado REAL de hoy: sin evidencia cargada, el router no promueve nada', () => {
    // Es el resultado honesto y por eso está fijado. Si algún día esto pasara a
    // verde sin haber medido, alguien habrá cargado evidencia inventada.
    expect(EVIDENCIA_CARGADA).toEqual([])
    const r = correrSombra(casos, cfg('hoy', [...EVIDENCIA_CARGADA]), HOY)
    expect(r.medidas.tasaSinCandidato).toBe(1)
    expect(r.medidas.fallos[0].codigo).toBe('QUALITY_NOT_PROVEN')
    expect(r.medidas.violacionesDelPiso).toBe(0)
  })

  it('con evidencia que pasa, se decide y se puede estimar el costo por caso', () => {
    const r = correrSombra(casos, cfg('propuesta', BUENA), HOY)
    expect(r.medidas.tasaSinCandidato).toBe(0)
    expect(r.medidas.costoPorCasoUsd).toBeGreaterThan(0)
    expect(r.medidas.violacionesDelPiso).toBe(0)
  })

  it('la comparación agrupa las divergencias en patrones, no en una fila por caso', () => {
    const c = comparar(correrSombra(casos, cfg('hoy', []), HOY), correrSombra(casos, cfg('prop', BUENA), HOY))
    expect(c.casosDivergentes).toBe(2)
    expect(c.divergencias.length).toBeLessThanOrEqual(2)
    expect(c.aceptable).toBe(true)
  })

  it('AL REVÉS: una propuesta que pierde candidatos NO es aceptable, aunque cueste menos', () => {
    // Ahorrar dejando tareas sin hacer no es ahorrar: mueve el problema a la
    // consulta, donde ya está el paciente.
    const c = comparar(correrSombra(casos, cfg('hoy', BUENA), HOY), correrSombra(casos, cfg('prop', []), HOY))
    expect(c.aceptable).toBe(false)
    expect(c.motivos.join(' ')).toContain('sin candidato')
    expect(informeMarkdown(c, HOY)).toContain('NO ACEPTABLE')
  })

  it('el informe declara siempre que las cifras son estimaciones, no facturación', () => {
    const c = comparar(correrSombra(casos, cfg('a', BUENA), HOY), correrSombra(casos, cfg('b', BUENA), HOY))
    const md = informeMarkdown(c, HOY)
    expect(md).toContain('Sin llamadas a proveedores')
    expect(md).toContain('No son facturación')
    expect(md).toContain('Violaciones del piso')
  })
})

describe('§K · al médico no se le enseñan modelos', () => {
  it('el estado que sale hacia la interfaz es FUNCIONAL, nunca un nombre de modelo', () => {
    expect(estadoParaElMedico('normal')).toBe('disponible')
    expect(estadoParaElMedico('preferir_barato')).toBe('disponible')
    expect(estadoParaElMedico('solo_lo_esencial')).toBe('capacidad_limitada')
  })

  it('ninguna cadena del router destinada al médico nombra un proveedor o un modelo', () => {
    // Los motivos de fallo del router van al tablero del dueño, no a la
    // pantalla del médico: ahí sí nombran modelos, y por eso NO pueden salir
    // por la misma puerta. Lo que sale hacia la interfaz es esta función y sólo
    // esta función.
    const salidas = (['normal', 'preferir_barato', 'solo_lo_esencial'] as const).map(estadoParaElMedico)
    for (const s of salidas) {
      for (const marca of ['claude', 'gpt', 'gemini', 'anthropic', 'openai', 'haiku', 'sonnet', 'opus']) {
        expect(s.toLowerCase()).not.toContain(marca)
      }
    }
  })
})
