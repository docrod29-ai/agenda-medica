/**
 * GOLDEN — EL ARNÉS DE CARGA: DETERMINISTA, HONESTO Y SIN SEGUNDO SISTEMA.
 *
 * ── QUÉ SE VIGILA ────────────────────────────────────────────────────────────
 *
 * #310 pide escenarios de carga a 2 000, 10 000 y crecimiento, «con picos de
 * consulta concurrentes reales en vez de sólo cuentas registradas», y prohíbe
 * expresamente confundir el tamaño de un fixture con capacidad demostrada.
 *
 * Esta prueba vigila tres cosas del arnés:
 *
 *  1. **Determinismo.** Misma semilla, mismo resultado. Un arnés de fallos que
 *     no se puede repetir no sirve para una regresión: el día que encuentre
 *     algo, no se podrá volver a encontrar.
 *  2. **Honestidad.** La salida no puede declarar capacidad. `capacityClaim`
 *     vale `none` y `evidenceClass` dice `harness-only` con el controlador
 *     simulado, se mire por donde se mire y se pase lo que se pase.
 *  3. **Invariantes bajo fallo.** Con cada perfil de fallo inyectado, los seis
 *     bloqueadores incondicionales de #310 siguen en cero.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA ────────────────────────────────────────
 *
 * El generador de fixtures de #319 crea inquilinos, médicos, pacientes y
 * encuentros — y no dice nada sobre concurrencia. Diez mil médicos registrados
 * que no están conectados no producen ni una petición. Faltaba la traducción de
 * «cuántos hay» a «cuántas operaciones por segundo».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Toda cifra viaja con su clase de evidencia en el MISMO objeto, no en una nota
 * al pie que alguien recortará al copiarla al informe.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 * No mide Ausculta. Con el controlador `simulado` no hay red, no hay Firestore
 * y no hay Next.js: se ejercita el MODELO. Ninguna afirmación sobre 2 000 ni
 * 10 000 médicos se sigue de que esta prueba pase. Lo que sí se sigue es que el
 * arnés es reproducible y que sus invariantes están escritas — que es el paso
 * anterior, y hoy el único disponible sin un entorno dimensionado.
 */
import { describe, it, expect } from 'vitest'
import { modelarCarga, PERFIL_CONSULTA, PROCEDENCIA } from '../../scripts/load/modelo-de-carga.mjs'
import { COHORTES, ESCENARIOS_CI, PERFILES_DE_FALLO, resolverEscenario } from '../../scripts/load/escenarios.mjs'
import { correrEscenario } from '../../scripts/load/motor-de-simulacion.mjs'
import { construirEvidencia } from '../../scripts/load/run-consultorio-load.mjs'

const SHA = '0123456789abcdef0123456789abcdef01234567'

const BLOQUEADORES = [
  'lostDraftCount', 'blankScreenCount', 'crossTenantLeakageCount',
  'unboundedReadCount', 'idempotencyViolationCount', 'silentProviderFailureCount',
] as const

describe('modelo de carga: de médicos registrados a operaciones por segundo', () => {
  it('separa médicos REGISTRADOS de consultas CONCURRENTES', () => {
    const m = modelarCarga({ registeredPhysicians: 10_000 })
    expect(m.registeredPhysicians).toBe(10_000)
    expect(m.concurrentConsultations).toBeLessThan(10_000)
    expect(m.concurrentConsultations).toBeGreaterThan(0)
  })

  it('la carga escala con la cohorte, no con el tamaño del fixture', () => {
    const dosMil = modelarCarga({ registeredPhysicians: 2_000 })
    const diezMil = modelarCarga({ registeredPhysicians: 10_000 })
    expect(diezMil.totalOpsPorSegundo).toBeGreaterThan(dosMil.totalOpsPorSegundo * 4)
  })

  it('cada parámetro declara si fue MEDIDO en el repositorio o SUPUESTO', () => {
    // Sin esta distinción, un modelo se cita como si fuera una medición.
    for (const [nombre, p] of Object.entries(PERFIL_CONSULTA) as Array<[string, { procedencia: string; fuente: string }]>) {
      expect([PROCEDENCIA.MEDIDO, PROCEDENCIA.SUPUESTO], `${nombre}`).toContain(p.procedencia)
      expect(p.fuente.length, `${nombre} sin fuente`).toBeGreaterThan(5)
    }
  })

  it('el autoguardado de 2/min sale del código, no de una estimación', () => {
    expect(PERFIL_CONSULTA.autoguardadosPorMinuto.procedencia).toBe(PROCEDENCIA.MEDIDO)
    expect(PERFIL_CONSULTA.autoguardadosPorMinuto.fuente).toMatch(/setInterval\(30000\)/)
  })

  it('el resultado lleva su advertencia pegada', () => {
    expect(modelarCarga({ registeredPhysicians: 2_000 }).advertencia).toMatch(/no constituyen evidencia de capacidad/i)
  })

  it('rechaza parámetros imposibles en vez de inventar un número', () => {
    expect(() => modelarCarga({ registeredPhysicians: 0 })).toThrow()
    expect(() => modelarCarga({ registeredPhysicians: 10, fraccionSimultanea: 1.5 })).toThrow()
  })
})

describe('determinismo del arnés', () => {
  it('misma semilla, mismo resultado, hasta el último contador', () => {
    const esc = resolverEscenario('multi-tenant-2k', 'saturacion-proveedor')
    const modelo = modelarCarga({ registeredPhysicians: esc.cohorte.registeredPhysicians })
    const a = correrEscenario({ modelo, escenario: esc, seed: 7 })
    const b = correrEscenario({ modelo, escenario: esc, seed: 7 })
    expect(a).toEqual(b)
  })

  it('semilla distinta, resultado distinto: el azar es real, sólo que reproducible', () => {
    const esc = resolverEscenario('multi-tenant-2k', 'saturacion-proveedor')
    const modelo = modelarCarga({ registeredPhysicians: esc.cohorte.registeredPhysicians })
    const a = correrEscenario({ modelo, escenario: esc, seed: 7 })
    const b = correrEscenario({ modelo, escenario: esc, seed: 8 })
    expect(a).not.toEqual(b)
  })
})

describe('invariantes bajo inyección de fallos', () => {
  for (const nombrePerfil of Object.keys(PERFILES_DE_FALLO)) {
    it(`«${nombrePerfil}»: ningún bloqueador incondicional se dispara`, () => {
      const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: nombrePerfil, seed: 20260823, sha: SHA, driver: 'simulado' })
      for (const b of BLOQUEADORES) expect(ev[b], `${nombrePerfil} → ${b}`).toBe(0)
    })
  }

  it('con la IA caída, el trabajo acaba en carta muerta VISIBLE, no desaparece', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'ia-caida', seed: 20260823, sha: SHA, driver: 'simulado' })
    expect(ev.queues.reasoning.deadLetterCount).toBeGreaterThan(0)
    expect(ev.outcomeBreakdown.degradedToLimitedMode).toBeGreaterThan(0)
    expect(ev.silentProviderFailureCount).toBe(0)
  })

  it('con la IA caída, la latencia del camino caliente NO se contagia', () => {
    const base = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'ninguno', seed: 20260823, sha: SHA, driver: 'simulado' })
    const caida = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'ia-caida', seed: 20260823, sha: SHA, driver: 'simulado' })
    // Ésta es la invariante entera de #310 en una línea: el trabajo secundario
    // pesado no congela la escritura de la nota.
    expect(caida.latencyMs.p95).toBeLessThan(base.latencyMs.p95 * 1.5)
  })

  it('con la respuesta perdida tras el commit, el reintento NO duplica', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'red-intermitente', seed: 20260823, sha: SHA, driver: 'simulado' })
    expect(ev.idempotencyViolationCount).toBe(0)
    expect(ev.requestCount).toBeGreaterThan(0)
  })

  it('con entrega duplicada, la segunda se rechaza y queda contada', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'entrega-duplicada', seed: 20260823, sha: SHA, driver: 'simulado' })
    expect(ev.resilienceCounters.duplicateDeliveriesRejected).toBeGreaterThan(0)
    expect(ev.idempotencyViolationCount).toBe(0)
  })

  it('un resultado caduco se descarta y NO se cuenta como éxito', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'resultado-caduco', seed: 20260823, sha: SHA, driver: 'simulado' })
    expect(ev.resilienceCounters.staleResultsDiscarded).toBeGreaterThan(0)
    expect(ev.outcomeBreakdown.succeeded + ev.errorCount).toBe(ev.requestCount)
  })
})

describe('honestidad de la evidencia', () => {
  it('el controlador simulado NUNCA declara capacidad', () => {
    for (const cohorte of Object.keys(COHORTES)) {
      const ev = construirEvidencia({ cohorteNombre: cohorte, falloNombre: 'ninguno', seed: 1, sha: SHA, driver: 'simulado' })
      expect(ev.capacityClaim).toBe('none')
      expect(ev.evidenceClass).toBe('harness-only')
      expect(ev.latencySource).toBe('modelo-sintetico')
    }
  })

  it('la aritmética del contrato de #310 cuadra sin esconder nada', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-10k', falloNombre: 'ia-caida', seed: 3, sha: SHA, driver: 'simulado' })
    expect(ev.successCount + ev.errorCount).toBe(ev.requestCount)
    const b = ev.outcomeBreakdown
    expect(b.degradedToLimitedMode + b.pendingAtWindowClose + b.staleResultsDiscarded + b.backpressureRejected + b.hardErrors)
      .toBe(ev.errorCount)
  })

  it('cumple el contrato de evidencia de #310 / PR #340 campo por campo', () => {
    const ev = construirEvidencia({ cohorteNombre: 'multi-tenant-2k', falloNombre: 'ninguno', seed: 1, sha: SHA, driver: 'simulado' })
    expect(ev.syntheticNonPhi).toBe(true)
    expect(ev.candidateSha).toMatch(/^[0-9a-f]{40}$/)
    expect(typeof ev.environment).toBe('string')
    expect(typeof ev.scenario).toBe('string')
    expect(typeof ev.seed).toBe('string')
    expect(Number.isInteger(ev.registeredPhysicians) && ev.registeredPhysicians > 0).toBe(true)
    expect(Number.isInteger(ev.concurrentConsultations) && ev.concurrentConsultations > 0).toBe(true)
    expect(ev.concurrentConsultations).toBeLessThanOrEqual(ev.registeredPhysicians)
    expect(ev.latencyMs.p50).toBeLessThanOrEqual(ev.latencyMs.p95)
    expect(ev.latencyMs.p95).toBeLessThanOrEqual(ev.latencyMs.p99)
    expect(typeof ev.durableSavePassed).toBe('boolean')
    expect(typeof ev.recoveryPassed).toBe('boolean')
    for (const q of ['transcription', 'reasoning', 'evidence', 'document']) {
      expect(Number.isInteger(ev.queues[q].maxDepth)).toBe(true)
      expect(Number.isInteger(ev.queues[q].retryCount)).toBe(true)
      expect(Number.isInteger(ev.queues[q].duplicateCount)).toBe(true)
    }
  })

  it('la salida no lleva ningún nombre de campo con forma de PHI', () => {
    // El mismo patrón que aplica el validador de PR #340, comprobado aquí para
    // que un campo nuevo no rompa la validación río abajo.
    const prohibido = /(patient.?name|patient.?email|patient.?phone|date.?of.?birth|dob|medical.?record|mrn|address)/i
    const recorrer = (v: unknown, ruta = '$'): void => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v)) return void v.forEach((x, i) => recorrer(x, `${ruta}[${i}]`))
      for (const [k, hijo] of Object.entries(v)) {
        expect(prohibido.test(k), `${ruta}.${k}`).toBe(false)
        recorrer(hijo, `${ruta}.${k}`)
      }
    }
    recorrer(construirEvidencia({ cohorteNombre: 'large-practice-30k-patients', falloNombre: 'ninguno', seed: 1, sha: SHA, driver: 'simulado' }))
  })

  it('exige SHA exacto: una evidencia sin candidato no se puede reproducir', () => {
    const esc = resolverEscenario('multi-tenant-2k', 'ninguno')
    expect(esc.nombre).toBe('multi-tenant-2k::ninguno')
    // El SHA se valida en la CLI (`exigirSha`); aquí se fija que el escenario
    // resuelto no invente cohortes ni perfiles.
    expect(() => resolverEscenario('cohorte-que-no-existe', 'ninguno')).toThrow(/Cohorte desconocida/)
    expect(() => resolverEscenario('multi-tenant-2k', 'fallo-que-no-existe')).toThrow(/Perfil de fallo desconocido/)
  })

  it('la matriz de CI no incluye las cohortes grandes: correrlas simuladas no demuestra capacidad', () => {
    expect(ESCENARIOS_CI).not.toContain('multi-tenant-10k')
    expect(ESCENARIOS_CI).not.toContain('growth-tier')
  })
})
