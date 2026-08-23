#!/usr/bin/env node
/**
 * ARNÉS DE CARGA DE CONSULTORIO — ejecuta un escenario y emite EVIDENCIA.
 *
 * ── LO PRIMERO, PORQUE ES LO QUE MÁS SE MALINTERPRETA ────────────────────────
 *
 * Una ejecución de este arnés con el controlador `simulado` **no demuestra que
 * Ausculta soporte 2 000 ni 10 000 médicos**. Demuestra que, con la forma de
 * carga declarada, las invariantes de fiabilidad se sostienen en el modelo. La
 * salida lo declara en `evidenceClass` y en `capacityClaim`, que vale
 * literalmente `none` y no se puede subir desde la línea de órdenes.
 *
 * Para poder decir algo sobre capacidad hace falta el controlador `http` contra
 * un entorno dimensionado, y eso hoy no existe: está en el informe de capacidad
 * como `requires-staging-environment`.
 *
 * ── FORMATO DE SALIDA ────────────────────────────────────────────────────────
 *
 * El JSON cumple el contrato de evidencia de #310 (PR #340,
 * `scripts/product/validate-consultorio-load-result.mjs` +
 * `docs/product/CONSULTORIO_SCALE_EVIDENCE.md`). No se reimplementa aquí ese
 * validador: se EMITE lo que él pide, para que cuando se fusione valide esta
 * salida sin adaptadores.
 *
 * Una nota sobre aritmética: el contrato exige
 * `successCount + errorCount === requestCount`. En una ventana finita hay
 * trabajo que ni tuvo éxito ni falló —sigue encolado, se degradó a modo
 * limitado, o se descartó por caduco—. Meterlo en `successCount` sería mentir;
 * así que va en `errorCount` (que en el contrato significa «no completado con
 * éxito en la ventana») y el desglose honesto viaja en `outcomeBreakdown`.
 * Ningún número se esconde: se explica.
 *
 * ── USO ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/load/run-consultorio-load.mjs \
 *     --cohorte=multi-tenant-2k --fallo=ia-caida --seed=20260823 \
 *     --sha=<40-hex> --salida=resultado.json
 *
 *   node scripts/load/run-consultorio-load.mjs --matriz --sha=<40-hex>
 *
 * Sin dependencias. No toca la red. No escribe fuera de `--salida`.
 */

import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { modelarCarga } from './modelo-de-carga.mjs'
import { CLASES_DE_EVIDENCIA, COHORTES, ESCENARIOS_CI, PERFILES_DE_FALLO, resolverEscenario } from './escenarios.mjs'
import { correrEscenario } from './motor-de-simulacion.mjs'

function parsearArgs(argv) {
  const out = { cohorte: 'baseline-single-tenant', fallo: 'ninguno', seed: 20260823, sha: null, salida: '-', driver: 'simulado', matriz: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--matriz') { out.matriz = true; continue }
    if (!arg.startsWith('--')) throw new Error(`Argumento inesperado: ${arg}`)
    const [k, v] = arg.slice(2).split('=', 2)
    if (v === undefined) throw new Error(`Falta el valor de --${k}`)
    if (k === 'seed') out.seed = Number(v)
    else if (k in out) out[k] = v
    else throw new Error(`Opción desconocida: --${k}`)
  }
  if (!Number.isSafeInteger(out.seed)) throw new Error('--seed debe ser un entero')
  return out
}

/**
 * El SHA del candidato. Obligatorio y de 40 hex por exigencia del contrato:
 * una evidencia sin candidato exacto no se puede volver a producir, y una
 * evidencia que no se puede reproducir no es evidencia.
 *
 * NO se lee de git aquí a propósito: el arnés puede correr sobre un árbol sucio
 * y el SHA de `HEAD` mentiría sobre lo que se midió. Lo pasa quien orquesta.
 */
function exigirSha(sha) {
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('--sha es obligatorio y debe ser un SHA de 40 caracteres hexadecimales (el candidato exacto que se midió)')
  }
  return sha.toLowerCase()
}

function construirEvidencia({ cohorteNombre, falloNombre, seed, sha, driver }) {
  const escenario = resolverEscenario(cohorteNombre, falloNombre)
  const modelo = modelarCarga({
    registeredPhysicians: escenario.cohorte.registeredPhysicians,
    ...(escenario.cohorte.fraccionSimultanea ? { fraccionSimultanea: escenario.cohorte.fraccionSimultanea } : {}),
  })
  const corrida = correrEscenario({ modelo, escenario, seed })
  const c = corrida.contadores

  // Todo lo que no completó con éxito dentro de la ventana. El desglose de
  // abajo dice exactamente qué fue cada cosa.
  const noCompletado = Math.max(0, c.requestCount - c.successCount)

  const evidencia = {
    schema: 'ausculta.consultorio.load-result.v1',
    syntheticNonPhi: true,
    candidateSha: sha,
    environment: driver === 'simulado' ? 'harness-in-process-no-infrastructure' : 'external-target',
    /** La clase de evidencia viaja CON el número, no en una nota al pie. */
    evidenceClass: driver === 'simulado' ? CLASES_DE_EVIDENCIA.HARNESS : CLASES_DE_EVIDENCIA.LOCAL,
    capacityClaim: 'none',
    driver,
    latencySource: driver === 'simulado' ? 'modelo-sintetico' : 'medido-en-objetivo',
    scenario: escenario.nombre,
    seed: String(seed),

    registeredPhysicians: modelo.registeredPhysicians,
    concurrentConsultations: modelo.concurrentConsultations,
    windowSeconds: corrida.ventanaSegundos,
    modeledOpsPerSecond: modelo.opsPorSegundo,
    modeledTotalOpsPerSecond: modelo.totalOpsPorSegundo,
    modeledHotPathOpsPerSecond: modelo.caminoCalienteOpsPorSegundo,

    requestCount: c.requestCount,
    successCount: c.successCount,
    errorCount: noCompletado,
    outcomeBreakdown: {
      succeeded: c.successCount,
      degradedToLimitedMode: c.degradedCount,
      pendingAtWindowClose: c.pendientesAlCerrar,
      staleResultsDiscarded: c.staleResultsDiscarded,
      backpressureRejected: c.rechazadosPorContrapresion,
      hardErrors: Math.max(0, noCompletado - c.degradedCount - c.pendientesAlCerrar - c.staleResultsDiscarded - c.rechazadosPorContrapresion),
      nota: 'errorCount agrupa TODO lo no completado con éxito en la ventana, como exige el contrato. Este desglose dice qué fue cada cosa; nada se oculta.',
    },

    latencyMs: {
      p50: corrida.latenciaCalienteMs.p50,
      p95: corrida.latenciaCalienteMs.p95,
      p99: corrida.latenciaCalienteMs.p99,
    },
    latencySamples: corrida.latenciaCalienteMs.muestras,

    /**
     * Estas dos son `true` porque el modelo NO pierde borradores ni impide la
     * recuperación. Con el controlador `simulado` eso dice algo del modelo, no
     * del producto — y `evidenceClass` ya lo advierte. No se declaran `true`
     * por defecto en el controlador `http`: allí se miden.
     */
    durableSavePassed: c.lostDraftCount === 0,
    recoveryPassed: c.lostDraftCount === 0,

    lostDraftCount: c.lostDraftCount,
    blankScreenCount: c.blankScreenCount,
    crossTenantLeakageCount: c.crossTenantLeakageCount,
    unboundedReadCount: c.unboundedReadCount,
    idempotencyViolationCount: c.idempotencyViolationCount,
    silentProviderFailureCount: c.silentProviderFailureCount,

    resilienceCounters: {
      duplicateDeliveriesRejected: c.duplicateDeliveriesRejected,
      staleResultsDiscarded: c.staleResultsDiscarded,
      localFallbackUsed: c.localFallbackUsed,
      backpressureRejected: c.rechazadosPorContrapresion,
    },

    queues: corrida.colas,

    providerUsage: [
      { providerClass: 'synthetic-stub', invocationCount: c.requestCount, testCost: 0 },
    ],

    failureProfile: {
      name: escenario.perfil.nombre,
      description: escenario.perfil.descripcion,
      expectedInvariant: escenario.perfil.invarianteEsperada ?? 'línea base sin fallo inyectado',
    },

    assumptions: modelo.supuestos,
    warning: modelo.advertencia,
  }

  return evidencia
}

async function main() {
  const cfg = parsearArgs(process.argv)
  const sha = exigirSha(cfg.sha)

  if (cfg.driver !== 'simulado') {
    throw new Error(
      `Controlador «${cfg.driver}» no implementado. El controlador «http» está PREPARADO pero no ejecutado: ` +
      'requiere un entorno dimensionado que hoy no existe y que no puede ser producción. Ver docs/reliability/CAPACITY-REPORT.md.',
    )
  }

  if (cfg.matriz) {
    const corridas = []
    for (const cohorte of ESCENARIOS_CI) {
      for (const fallo of Object.keys(PERFILES_DE_FALLO)) {
        corridas.push(construirEvidencia({ cohorteNombre: cohorte, falloNombre: fallo, seed: cfg.seed, sha, driver: cfg.driver }))
      }
    }
    const salida = {
      schema: 'ausculta.consultorio.load-matrix.v1',
      syntheticNonPhi: true,
      candidateSha: sha,
      capacityClaim: 'none',
      evidenceClass: CLASES_DE_EVIDENCIA.HARNESS,
      runs: corridas,
    }
    await emitir(salida, cfg.salida)
    return
  }

  if (!COHORTES[cfg.cohorte]) {
    throw new Error(`Cohorte desconocida: ${cfg.cohorte}. Conocidas: ${Object.keys(COHORTES).join(', ')}`)
  }
  await emitir(construirEvidencia({ cohorteNombre: cfg.cohorte, falloNombre: cfg.fallo, seed: cfg.seed, sha, driver: cfg.driver }), cfg.salida)
}

async function emitir(objeto, destino) {
  const texto = `${JSON.stringify(objeto, null, 2)}\n`
  if (destino === '-') process.stdout.write(texto)
  else await writeFile(destino, texto, 'utf8')
}

export { construirEvidencia }

// Sólo corre cuando se invoca directamente: así vitest puede importar
// `construirEvidencia` sin que el proceso intente parsear argv de la suite.
if (process.argv[1] && process.argv[1].endsWith('run-consultorio-load.mjs')) {
  main().catch((e) => { console.error(`ARNÉS DE CARGA: ${e.message}`); process.exit(1) })
}
