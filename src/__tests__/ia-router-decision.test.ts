/**
 * GOLDEN — el router de costo/calidad decide, y en qué NO puede ceder (#313).
 *
 * ── QUÉ SE PROTEGE AQUÍ ──────────────────────────────────────────────────────
 *
 * No que el router «funcione»: que no se le pueda comprar una decisión barata.
 * La matriz de catorce casos del contrato del dueño está entera, y las que
 * importan son las que exigen un NO:
 *
 *   · un modelo barato que no demuestra calidad JAMÁS sale elegido;
 *   · un presupuesto apretado NO baja el piso de una tarea de alta consecuencia;
 *   · sin evidencia, o con evidencia caducada, no hay promoción automática;
 *   · una llave revocada no dispara una cascada inútil por los cinco modelos
 *     del mismo proveedor;
 *   · un proveedor futuro del catálogo nunca se ejecuta como si estuviera
 *     conectado;
 *   · la telemetría no lleva PHI.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA ────────────────────────────────────────
 *
 * El repositorio ya tenía dos degradaciones silenciosas del mismo tipo, y las
 * dos costaron semanas: REG-167 (el proveedor rechazaba el sesgo de vocabulario
 * y DEGRADABA al modelo viejo sin error ni aviso) y `TOPE_ECONOMICO`, que baja
 * a Haiku por dinero — legítimo, porque es comercial y visible, y exactamente
 * el mecanismo que no puede acabar atravesando un piso clínico.
 *
 * ── CAUSA RAÍZ QUE VIGILA ────────────────────────────────────────────────────
 *
 * Un router que ordena candidatos por precio y comprueba la calidad después
 * elige al barato siempre que la comprobación sea floja. Hoy es floja: no hay
 * evidencia cargada. Con el orden correcto eso produce un fallo explícito; con
 * el inverso produciría al modelo más barato del catálogo.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * 100 % sintéticos. Catálogos, evidencias y tareas de este archivo son
 * inventados PARA la prueba: ni un id de paciente, ni una frase de consulta, ni
 * una métrica que pretenda ser una medición real.
 *
 * ── QUÉ **NO** CUBRE, DECLARADO ──────────────────────────────────────────────
 *
 * · No prueba que los modelos sean buenos. Prueba la COMPUERTA, no lo que pasa
 *   por ella; la calidad real exige un corpus que hoy no existe.
 * · No prueba el gateway ni la ejecución: el router no llama a nadie.
 * · No prueba que las rutas de producción lo usen — hoy NINGUNA lo usa. Está
 *   preparado, no conectado, y hay una prueba aparte que fija ese hecho.
 * · No fija los umbrales numéricos de calidad: están en NEEDS_CLINICAL_REVIEW.
 */
import { describe, it, expect } from 'vitest'
import { decidirRuta, type EntradaRuteo } from '@/lib/ia/router/decidir'
import { CATALOGO, esEjecutable, type CapacidadModelo } from '@/lib/ia/router/catalogo'
import { VERSION_BENCHMARK } from '@/lib/ia/router/calidad'
import { registrarFallo, type MapaSalud } from '@/lib/ia/router/disponibilidad'
import { elPresupuestoPuedeBajarElPiso, type EstadoPresupuesto } from '@/lib/ia/router/presupuesto'
import { eventoDeDecision, infraccionesDePhi } from '@/lib/ia/router/telemetria'
import { pisoEfectivo, type EvidenciaCalidad, type SolicitudTarea } from '@/lib/ia/router/tareas'

const HOY = '2026-08-23T12:00:00.000Z'

const HOLGADO: EstadoPresupuesto = {
  gastoUsd: 0, topeUsd: null, reintentos: 0, topeReintentos: null,
  tasaSegundaOpinion: 0, topeTasaSegundaOpinion: null,
}
const AGOTADO: EstadoPresupuesto = { ...HOLGADO, gastoUsd: 100, topeUsd: 50 }

/**
 * Catálogo sintético con tres modelos que SÍ tienen tarifa cargada, para que el
 * orden por costo sea real y no un empate en `null`.
 *
 * Los ids son los de producción a propósito: es lo que hace que `costoUsd` los
 * encuentre en `TARIFAS`, con su fuente y su fecha. Lo sintético es la
 * candidatura y la evidencia, no el precio.
 */
const modelo = (p: Partial<CapacidadModelo> & Pick<CapacidadModelo, 'proveedor' | 'modeloId'>): CapacidadModelo => ({
  estado: 'configurado', clasesSoportadas: ['extraction_structuring'],
  salidaEstructurada: 'nativa', limiteContexto: 100_000, limiteSalida: 8000,
  latencia: 'normal', restricciones: [], notas: 'sintético para la prueba',
  ...p,
})

// Haiku < Sonnet < Opus por precio real de TARIFAS. El orden es el que importa.
const BARATO = modelo({ proveedor: 'anthropic', modeloId: 'claude-haiku-4-5', latencia: 'interactiva' })
const MEDIO = modelo({ proveedor: 'anthropic', modeloId: 'claude-sonnet-5' })
const CARO = modelo({ proveedor: 'anthropic', modeloId: 'claude-opus-4-8', latencia: 'diferida' })
const OTRO_PROVEEDOR = modelo({ proveedor: 'openai', modeloId: 'gpt-5' })

const resumen = (casos: number, exactitud: number, error: number, alucinaciones = 0) => ({
  casos, camposEsperados: casos * 5,
  correctos: Math.round(casos * 5 * exactitud), incorrectos: Math.round(casos * 5 * error),
  faltantes: 0, alucinaciones: Math.round(alucinaciones * casos),
  exactitudCampo: exactitud, tasaError: error, alucinacionesPorCaso: alucinaciones,
})

const evidencia = (
  c: CapacidadModelo, exactitud: number, error: number,
  extra: Partial<EvidenciaCalidad> = {},
): EvidenciaCalidad => ({
  proveedor: c.proveedor, modeloId: c.modeloId, claseTarea: 'extraction_structuring',
  versionBenchmark: VERSION_BENCHMARK, evaluadoEn: '2026-08-20T00:00:00.000Z',
  resumen: resumen(50, exactitud, error), origen: 'sintetico', ...extra,
})

/** Piso exigente pero MEDIBLE, declarado por la prueba como lo haría la capa clínica. */
const PISO = { exactitudMin: 0.9, tasaErrorMax: 0.1, muestraMin: 30 }

/**
 * La tarea base pide latencia `diferida` —la más tolerante— para que el filtro
 * de latencia no se coma candidatos en las pruebas que miden OTRA cosa.
 *
 * Se descubrió al revés: con `normal`, el modelo premium (`diferida`) salía
 * descartado por latencia y cuatro casos fallaban por un motivo que no era el
 * que estaban probando. La latencia tiene su propio caso, abajo.
 */
const tarea = (s: Partial<SolicitudTarea> = {}): SolicitudTarea => ({
  claseTarea: 'extraction_structuring', riesgo: 'bajo', latencia: 'diferida',
  pisoCalidad: PISO, tamanoEntradaEstimado: 5000, presupuestoSalida: 1500,
  correlacionId: 'req-sintetico-1', ...s,
})

const entrada = (o: Partial<EntradaRuteo> = {}): EntradaRuteo => ({
  solicitud: tarea(), catalogo: [BARATO, MEDIO, CARO],
  evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(MEDIO, 0.96, 0.04), evidencia(CARO, 0.98, 0.02)],
  versionBenchmark: VERSION_BENCHMARK, salud: [], presupuesto: HOLGADO, hoyISO: HOY, ...o,
})

/* ══════════════════════════════════════════════════════════════════════════ */

describe('1 · tarea de bajo riesgo con tres modelos que cumplen', () => {
  it('elige el MÍNIMO suficiente, no el mejor', () => {
    const r = decidirRuta(entrada())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-haiku-4-5')
    expect(r.codigosRazon).toContain('minimo_suficiente_por_costo')
    // Los otros dos siguen ahí como respaldo, en orden de costo.
    expect(r.respaldos.map(x => x.modeloId)).toEqual(['claude-sonnet-5', 'claude-opus-4-8'])
  })

  it('una tarea INTERACTIVA descarta al modelo lento aunque tenga mejor calidad', () => {
    // El único caso en que la latencia manda sobre el costo y sobre la calidad
    // de más: con el paciente enfrente, un modelo que tarda no sirve mejor.
    const r = decidirRuta(entrada({ solicitud: tarea({ latencia: 'interactiva' }) }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-haiku-4-5')
    expect(r.respaldos).toEqual([])
    expect(r.codigosRazon).toContain('latencia_manda')
    expect(r.evaluados.find(x => x.modeloId === 'claude-opus-4-8')?.descarte).toBe('latencia_insuficiente')
  })

  it('AL REVÉS: si el barato deja de cumplir, sube al siguiente — no se queda con él', () => {
    const r = decidirRuta(entrada({
      evidencias: [evidencia(BARATO, 0.60, 0.40), evidencia(MEDIO, 0.96, 0.04), evidencia(CARO, 0.98, 0.02)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-sonnet-5')
  })
})

describe('2 · el modelo barato que no pasa el piso', () => {
  it('JAMÁS se selecciona, ni siquiera cuando es el único barato', () => {
    const r = decidirRuta(entrada({
      evidencias: [evidencia(BARATO, 0.5, 0.5), evidencia(MEDIO, 0.96, 0.04)],
      catalogo: [BARATO, MEDIO],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).not.toBe('claude-haiku-4-5')
    const descartado = r.evaluados.find(x => x.modeloId === 'claude-haiku-4-5')
    expect(descartado?.descarte).toBe('calidad_no_demostrada')
  })

  it('alucinar lo descarta aunque la exactitud sea perfecta', () => {
    // Cero alucinaciones es la parte estructural del piso: `casos-oro.ts` lo
    // decidió («sobre un corpus que controlamos entero, una enfermedad
    // inventada no es un porcentaje aceptable») y no se relaja por exactitud.
    const alucinador: EvidenciaCalidad = {
      ...evidencia(BARATO, 1, 0), resumen: resumen(50, 1, 0, 0.2),
    }
    const r = decidirRuta(entrada({
      catalogo: [BARATO, MEDIO], evidencias: [alucinador, evidencia(MEDIO, 0.96, 0.04)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-sonnet-5')
  })
})

describe('3 · tarea de alta consecuencia con el presupuesto agotado', () => {
  it('NO baja el piso: sigue exigiendo lo mismo y elige al que cumple, aunque sea caro', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ riesgo: 'alta_consecuencia', pisoCalidad: { ...PISO, exactitudMin: 0.97 } }),
      presupuesto: AGOTADO,
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Sólo Opus (0.98) pasa un piso de 0.97. El presupuesto agotado no lo cambia.
    expect(r.modeloSeleccionado).toBe('claude-opus-4-8')
    expect(r.codigosRazon).toContain('presupuesto_no_bajo_el_piso')
    expect(r.politicaPresupuesto).toBe('solo_lo_esencial')
  })

  it('AL REVÉS: la misma tarea con presupuesto holgado elige EL MISMO modelo', () => {
    // Es la comprobación que hace que la anterior signifique algo: si el
    // presupuesto no cambia la selección, es porque no puede cambiarla.
    const holgado = decidirRuta(entrada({
      solicitud: tarea({ riesgo: 'alta_consecuencia', pisoCalidad: { ...PISO, exactitudMin: 0.97 } }),
    }))
    expect(holgado.ok && holgado.modeloSeleccionado).toBe('claude-opus-4-8')
  })

  it('el piso efectivo no se puede relajar desde fuera', () => {
    // `pisoEfectivo` sólo sube. Se le mete un piso más laxo que el estructural.
    const p = pisoEfectivo({ alucinacionesPorCasoMax: 5, exactitudMin: 0.9 })
    expect(p.alucinacionesPorCasoMax).toBe(0)
    expect(elPresupuestoPuedeBajarElPiso('solo_lo_esencial', 'alta_consecuencia')).toBe(false)
  })
})

describe('4 · caída de un proveedor', () => {
  it('usa un candidato elegible del OTRO proveedor', () => {
    const salud: MapaSalud = [{ proveedor: 'anthropic', estado: 'caido', desde: HOY }]
    const r = decidirRuta(entrada({
      catalogo: [BARATO, MEDIO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(MEDIO, 0.96, 0.04), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
      salud,
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.proveedorSeleccionado).toBe('openai')
  })
})

describe('5 · llave revocada', () => {
  it('descarta los CINCO modelos del proveedor de una vez, no uno por uno', () => {
    // Una llave muerta tiene una causa y muchos modelos. El alcance sale de la
    // clase de fallo que `fallo-proveedor.ts` ya sabe clasificar.
    const salud = registrarFallo([], 'anthropic', 'claude-haiku-4-5', 'llave_invalida', HOY)
    const r = decidirRuta(entrada({ catalogo: [BARATO, MEDIO, CARO], salud }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('PROVIDER_UNAVAILABLE')
    // Los tres descartados por el proveedor, ninguno por su cuenta.
    expect(r.evaluados.every(x => x.descarte === 'proveedor_no_disponible')).toBe(true)
  })

  it('un fallo de MODELO sí descarta sólo a ese modelo', () => {
    // El contraste: el mismo mecanismo tiene que distinguir los dos casos.
    const salud = registrarFallo([], 'anthropic', 'claude-haiku-4-5', 'otro', HOY)
    const r = decidirRuta(entrada({ salud }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-sonnet-5')
  })
})

describe('6 · evidencia ausente o caducada', () => {
  it('sin evidencia NO se promueve: falla cerrado', () => {
    const r = decidirRuta(entrada({ evidencias: [] }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('QUALITY_NOT_PROVEN')
    expect(r.estadosCalidad.every(e => e === 'sin_evidencia')).toBe(true)
  })

  it('evidencia de OTRA versión del benchmark no cuenta', () => {
    const r = decidirRuta(entrada({
      evidencias: [evidencia(BARATO, 0.99, 0.01, { versionBenchmark: 'casos-oro-v0' })],
      catalogo: [BARATO],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.estadosCalidad).toContain('version_distinta')
  })

  it('evidencia vieja caduca cuando el piso declara una frescura', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ pisoCalidad: { ...PISO, frescuraMaxDias: 1 } }),
      catalogo: [BARATO],
      evidencias: [evidencia(BARATO, 0.99, 0.01, { evaluadoEn: '2026-01-01T00:00:00.000Z' })],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.estadosCalidad).toContain('caducada')
  })

  it('muestra por debajo de la exigida no cuenta como medición', () => {
    const chico: EvidenciaCalidad = { ...evidencia(BARATO, 1, 0), resumen: resumen(3, 1, 0) }
    const r = decidirRuta(entrada({ catalogo: [BARATO], evidencias: [chico] }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.estadosCalidad).toContain('muestra_insuficiente')
  })

  it('un piso SIN vara numérica no promueve a una tarea de riesgo material', () => {
    // Es el estado de hoy en todo el producto: NEEDS_CLINICAL_REVIEW. Si esto
    // pasara, cualquier modelo pasaría cualquier tarea por no alucinar en
    // cuatro casos sintéticos, y el riel entero sería decorativo.
    const r = decidirRuta(entrada({
      solicitud: tarea({ riesgo: 'material', pisoCalidad: null }), catalogo: [BARATO],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.estadosCalidad).toContain('piso_no_medible')
  })
})

describe('7 · segunda opinión pedida por el médico', () => {
  it('activa un segundo candidato de OTRO proveedor', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true, senales: { peticionDelMedico: true } }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.segundaRevision?.proveedor).toBe('openai')
    expect(r.segundaRevision?.independencia).toBe('proveedor_distinto')
    expect(r.segundaRevision?.modeloId).not.toBe(r.modeloSeleccionado)
  })

  it('NUNCA repite el mismo modelo como segunda opinión', () => {
    // Dos pasadas del mismo motor comparten sus puntos ciegos: confirman el
    // error con más confianza en vez de cazarlo.
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true, senales: { peticionDelMedico: true } }),
      catalogo: [BARATO], evidencias: [evidencia(BARATO, 0.95, 0.05)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.segundaRevision).toBeNull()
    expect(r.codigosRazon).toContain('segunda_opinion_no_independiente')
  })

  it('ni siquiera el presupuesto agotado la ahorra', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true, senales: { peticionDelMedico: true } }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
      presupuesto: AGOTADO,
    }))
    expect(r.ok && r.segundaRevision).not.toBeNull()
  })
})

describe('8 · incertidumbre y conflicto', () => {
  it('el conflicto activa segunda revisión', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true, senales: { conflicto: true } }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.codigosRazon).toContain('segunda_revision_por_conflicto')
  })

  it('la incertidumbre en alta consecuencia no se ahorra ni con el presupuesto agotado', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({
        riesgo: 'alta_consecuencia', permiteSegundaOpinion: true, senales: { incertidumbre: true },
      }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
      presupuesto: AGOTADO,
    }))
    expect(r.ok && r.segundaRevision).not.toBeNull()
  })

  it('el muestreo SÍ se ahorra con el presupuesto apretado', () => {
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true, senales: { muestreoBenchmark: true } }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
      presupuesto: AGOTADO,
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.segundaRevision).toBeNull()
    expect(r.codigosRazon).toContain('segunda_revision_omitida_por_presupuesto')
  })
})

describe('9 · tarea normal de bajo riesgo', () => {
  it('NO usa un segundo modelo por defecto', () => {
    // La segunda opinión universal duplicaría el renglón más caro de la
    // plataforma para confirmar que la mayoría de las notas estaban bien.
    const r = decidirRuta(entrada({
      solicitud: tarea({ permiteSegundaOpinion: true }),
      catalogo: [BARATO, OTRO_PROVEEDOR],
      evidencias: [evidencia(BARATO, 0.95, 0.05), evidencia(OTRO_PROVEEDOR, 0.94, 0.06)],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.segundaRevision).toBeNull()
    expect(r.codigosRazon).toContain('sin_segunda_revision_por_defecto')
  })
})

describe('10 · nadie satisface calidad ni seguridad', () => {
  it('falla CERRADO, con el código que dice a quién le toca arreglarlo', () => {
    const r = decidirRuta(entrada({
      evidencias: [evidencia(BARATO, 0.1, 0.9), evidencia(MEDIO, 0.2, 0.8), evidencia(CARO, 0.3, 0.7)],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('QUALITY_NOT_PROVEN')
    expect(r.motivo).toContain('No se selecciona uno insuficiente por ser barato')
  })

  it('presupuesto agotado + nadie que cumpla = conflicto declarado, no degradación', () => {
    const r = decidirRuta(entrada({
      evidencias: [evidencia(BARATO, 0.1, 0.9), evidencia(MEDIO, 0.2, 0.8), evidencia(CARO, 0.3, 0.7)],
      presupuesto: AGOTADO,
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('BUDGET_CONFLICT_WITH_QUALITY')
  })

  it('la capacidad que falta se distingue de la calidad que falta', () => {
    // Cuatro fallos con cuatro arreglos distintos: medir, pagar, cargar un
    // límite o revisar una restricción. Devolver siempre el mismo sería el
    // encogimiento de hombros que `protocolo.ts` ya corrigió para los HTTP.
    const sinEstructura = modelo({ proveedor: 'anthropic', modeloId: 'claude-haiku-4-5', salidaEstructurada: 'por_prompt' })
    const r = decidirRuta(entrada({
      solicitud: tarea({ requiereSalidaEstructurada: true }), catalogo: [sinEstructura],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('CAPABILITY_NOT_MET')
  })

  it('contexto largo con límites sin cargar NO se supone: falla', () => {
    const sinLimites = modelo({ proveedor: 'anthropic', modeloId: 'claude-sonnet-5', limiteContexto: null, limiteSalida: null })
    const r = decidirRuta(entrada({
      solicitud: tarea({ requiereContextoLargo: true }), catalogo: [sinLimites],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.codigo).toBe('CAPABILITY_NOT_MET')
  })
})

describe('11 · pico de costo', () => {
  it('cambia de candidato SÓLO si el alternativo mantiene el piso', () => {
    // Con el presupuesto apretado se prefiere barato, pero el barato de aquí no
    // cumple: gana el que cumple, y el conflicto se declara.
    const r = decidirRuta(entrada({
      solicitud: tarea({ riesgo: 'alta_consecuencia', pisoCalidad: { ...PISO, exactitudMin: 0.97 } }),
      presupuesto: { ...AGOTADO, gastoUsd: 45, topeUsd: 50 },  // «cerca», no superado
    }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.modeloSeleccionado).toBe('claude-opus-4-8')
    expect(r.politicaPresupuesto).toBe('preferir_barato')
    expect(r.codigosRazon).toContain('presupuesto_no_bajo_el_piso')
  })

  it('cuando el alternativo SÍ cumple, la bajada es segura y se toma', () => {
    const r = decidirRuta(entrada({ presupuesto: { ...AGOTADO, gastoUsd: 45, topeUsd: 50 } }))
    expect(r.ok && r.modeloSeleccionado).toBe('claude-haiku-4-5')
  })
})

describe('12 · telemetría', () => {
  it('no contiene PHI y sólo lleva campos de la lista blanca', () => {
    const s = tarea({ correlacionId: 'req-abc-123' })
    const ev = eventoDeDecision(s, decidirRuta(entrada({ solicitud: s })), HOY)
    expect(infraccionesDePhi(ev as unknown as Record<string, unknown>)).toEqual([])
    const texto = JSON.stringify(ev)
    for (const prohibido of ['prompt', 'transcripcion', 'paciente', 'diagnostico', 'nota']) {
      expect(texto.toLowerCase()).not.toContain(prohibido)
    }
  })

  it('AL REVÉS: un campo de más lo caza la lista blanca', () => {
    // Sin esto, la prueba anterior sólo diría que el objeto de hoy está limpio.
    const sucio = { ...eventoDeDecision(tarea(), decidirRuta(entrada()), HOY), resumenCorto: 'dolor abdominal' }
    const malas = infraccionesDePhi(sucio as unknown as Record<string, unknown>)
    expect(malas).toEqual([{ campo: 'resumenCorto', motivo: 'campo_no_permitido' }])
  })

  it('AL REVÉS: un id de correlación con forma de identificador lo caza el detector', () => {
    const s = tarea({ correlacionId: 'paciente/ABC' })
    const ev = eventoDeDecision(s, decidirRuta(entrada({ solicitud: s })), HOY)
    expect(infraccionesDePhi(ev as unknown as Record<string, unknown>))
      .toContainEqual({ campo: 'correlacionId', motivo: 'correlacion_sospechosa' })
  })
})

describe('13 · determinismo', () => {
  it('mismas entradas → misma decisión, campo por campo', () => {
    const e = entrada()
    expect(JSON.stringify(decidirRuta(e))).toEqual(JSON.stringify(decidirRuta(e)))
  })

  it('reordenar el catálogo NO cambia la decisión', () => {
    // El desempate final por cadena existe para esto: sin él, el orden del
    // array decidiría entre dos modelos que cuestan y tardan lo mismo.
    const a = decidirRuta(entrada({ catalogo: [BARATO, MEDIO, CARO] }))
    const b = decidirRuta(entrada({ catalogo: [CARO, MEDIO, BARATO] }))
    expect(a.ok && a.modeloSeleccionado).toEqual(b.ok && b.modeloSeleccionado)
    expect(a.ok && a.respaldos).toEqual(b.ok && b.respaldos)
  })
})

describe('14 · proveedor futuro del catálogo', () => {
  it('aparece en el catálogo real y NUNCA se ejecuta como si estuviera conectado', () => {
    const futuro = CATALOGO.find(c => c.estado === 'declarado')
    expect(futuro).toBeDefined()
    expect(esEjecutable(futuro!)).toBe(false)
  })

  it('aunque tuviera evidencia perfecta, no sale elegido', () => {
    // Es la prueba que importa: la calidad no puede comprar la conexión.
    const futuro = CATALOGO.find(c => c.estado === 'declarado')!
    const conEvidencia: EvidenciaCalidad = {
      proveedor: futuro.proveedor, modeloId: futuro.modeloId, claseTarea: 'extraction_structuring',
      versionBenchmark: VERSION_BENCHMARK, evaluadoEn: '2026-08-22T00:00:00.000Z',
      resumen: resumen(500, 1, 0), origen: 'sintetico',
    }
    const r = decidirRuta(entrada({
      catalogo: [{ ...futuro, clasesSoportadas: ['extraction_structuring'] }],
      evidencias: [conEvidencia],
    }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.evaluados[0].descarte).toBe('no_configurado')
    // Y ni siquiera se llegó a mirar su calidad: se corta antes.
    expect(r.evaluados[0].calidad).toBeNull()
  })

  it('el catálogo de producción no declara ejecutable a ningún proveedor que el gateway no sepa llamar', () => {
    for (const c of CATALOGO) {
      if (c.estado === 'configurado') expect(['anthropic', 'openai']).toContain(c.proveedor)
    }
  })
})
