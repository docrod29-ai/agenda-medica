/**
 * INFORME DE SOMBRA DEL ROUTER — `npx tsx scripts/ai/router-sombra.ts`
 *
 * #313 §M. Compara dos configuraciones del router sobre tareas SINTÉTICAS y
 * escribe dos archivos: uno para máquinas y otro para leer.
 *
 * **No llama a ningún proveedor.** No hay red, no hay llaves, no hay gasto. Es
 * la condición de que este script pueda correr en CI y en la máquina de
 * cualquiera sin autorización de nadie.
 *
 * ── QUÉ COMPARA HOY ──────────────────────────────────────────────────────────
 *
 * `actual`   — el estado REAL de hoy: catálogo de producción, cero evidencia de
 *              calidad cargada. Se espera que salga sin candidato en casi todo,
 *              y ése es el resultado honesto: nadie ha medido nada.
 * `propuesta`— el mismo catálogo con evidencia SINTÉTICA de ejemplo, para
 *              enseñar qué haría el router el día que exista una medición.
 *
 * Las evidencias sintéticas de este archivo **no son una medición** y no pueden
 * migrar a `src/`: viven aquí, en el script, justo para que nadie las confunda
 * con `EVIDENCIA_CARGADA`, que está vacía a propósito.
 *
 * ── DATOS ────────────────────────────────────────────────────────────────────
 *
 * 100 % sintéticos. Ninguna tarea viene de una consulta real: son tamaños y
 * clases de tarea, sin una sola palabra de contenido clínico.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { CATALOGO } from '../../src/lib/ia/router/catalogo'
import { EVIDENCIA_CARGADA, VERSION_BENCHMARK } from '../../src/lib/ia/router/calidad'
import { comparar, correrSombra, informeMarkdown, type CasoSombra, type Configuracion } from '../../src/lib/ia/router/sombra'
import type { EstadoPresupuesto } from '../../src/lib/ia/router/presupuesto'
import type { EvidenciaCalidad, SolicitudTarea } from '../../src/lib/ia/router/tareas'

/** La fecha se pasa por argumento o se toma de hoy. El módulo no tiene reloj. */
const HOY = process.argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)
const HOY_ISO = `${HOY}T12:00:00.000Z`

const PRESUPUESTO_HOLGADO: EstadoPresupuesto = {
  gastoUsd: 0, topeUsd: null, reintentos: 0, topeReintentos: null,
  tasaSegundaOpinion: 0, topeTasaSegundaOpinion: null,
}

/**
 * Un día de consultorio, en clases de tarea.
 *
 * Las proporciones salen de `CADENA_CONSULTA` del libro de costos —lo que de
 * verdad corre en una consulta dictada—, no de una suposición sobre uso.
 */
function casosDeUnDia(consultas: number): CasoSombra[] {
  const casos: CasoSombra[] = []
  const push = (id: string, s: Omit<SolicitudTarea, 'correlacionId'>) =>
    casos.push({ id, solicitud: { ...s, correlacionId: id } })

  for (let i = 1; i <= consultas; i++) {
    const n = String(i).padStart(3, '0')
    push(`c${n}-limpieza`, {
      claseTarea: 'transcription_cleanup', riesgo: 'bajo', latencia: 'interactiva',
      tamanoEntradaEstimado: 4000, presupuestoSalida: 1200,
    })
    push(`c${n}-extraccion`, {
      claseTarea: 'extraction_structuring', riesgo: 'material', latencia: 'normal',
      requiereSalidaEstructurada: true,
      pisoCalidad: { exactitudMin: 0.85, tasaErrorMax: 0.15, muestraMin: 20 },
      tamanoEntradaEstimado: 6000, presupuestoSalida: 1500,
    })
    push(`c${n}-nota`, {
      claseTarea: 'note_rendering', riesgo: 'alta_consecuencia', latencia: 'normal',
      pisoCalidad: { exactitudMin: 0.92, tasaErrorMax: 0.08, muestraMin: 50 },
      tamanoEntradaEstimado: 12000, presupuestoSalida: 6000,
    })
    push(`c${n}-revision`, {
      claseTarea: 'safety_review', riesgo: 'alta_consecuencia', latencia: 'diferida',
      requiereSalidaEstructurada: true,
      pisoCalidad: { exactitudMin: 0.9, tasaErrorMax: 0.1, muestraMin: 50 },
      tamanoEntradaEstimado: 14000, presupuestoSalida: 2000,
      // Una de cada cinco cae en el muestreo de control de calidad.
      senales: i % 5 === 0 ? { muestreoBenchmark: true } : undefined,
      permiteSegundaOpinion: true,
    })
  }
  return casos
}

/** Métricas de ejemplo. NO son una medición: son la forma que tendría una. */
const resumen = (casos: number, exactitud: number, error: number) => ({
  casos, camposEsperados: casos * 5,
  correctos: Math.round(casos * 5 * exactitud),
  incorrectos: Math.round(casos * 5 * error), faltantes: 0, alucinaciones: 0,
  exactitudCampo: exactitud, tasaError: error, alucinacionesPorCaso: 0,
})

const EVIDENCIA_SINTETICA: EvidenciaCalidad[] = [
  { proveedor: 'anthropic', modeloId: 'claude-haiku-4-5', claseTarea: 'transcription_cleanup',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(60, 0.93, 0.07), origen: 'sintetico' },
  { proveedor: 'anthropic', modeloId: 'claude-sonnet-5', claseTarea: 'transcription_cleanup',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(60, 0.96, 0.04), origen: 'sintetico' },
  { proveedor: 'openai', modeloId: 'gpt-5', claseTarea: 'extraction_structuring',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(40, 0.9, 0.1), origen: 'sintetico' },
  { proveedor: 'anthropic', modeloId: 'claude-sonnet-5', claseTarea: 'note_rendering',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(60, 0.94, 0.06), origen: 'sintetico' },
  { proveedor: 'openai', modeloId: 'gpt-5', claseTarea: 'safety_review',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(55, 0.93, 0.07), origen: 'sintetico' },
  { proveedor: 'anthropic', modeloId: 'claude-opus-4-8', claseTarea: 'note_rendering',
    versionBenchmark: VERSION_BENCHMARK, evaluadoEn: `${HOY}T00:00:00.000Z`,
    resumen: resumen(60, 0.97, 0.03), origen: 'sintetico' },
]

const ACTUAL: Configuracion = {
  nombre: 'actual (producción: catálogo real, CERO evidencia cargada)',
  catalogo: CATALOGO, evidencias: EVIDENCIA_CARGADA,
  versionBenchmark: VERSION_BENCHMARK, salud: [], presupuesto: PRESUPUESTO_HOLGADO,
}
const PROPUESTA: Configuracion = {
  nombre: 'propuesta (mismo catálogo + evidencia SINTÉTICA de ejemplo)',
  catalogo: CATALOGO, evidencias: EVIDENCIA_SINTETICA,
  versionBenchmark: VERSION_BENCHMARK, salud: [], presupuesto: PRESUPUESTO_HOLGADO,
}

const CONSULTAS = Number(process.env.CONSULTAS ?? '25')
const casos = casosDeUnDia(CONSULTAS)
const a = correrSombra(casos, ACTUAL, HOY_ISO)
const p = correrSombra(casos, PROPUESTA, HOY_ISO)
const c = comparar(a, p)

const dir = resolve(process.cwd(), 'docs/ai/router')
mkdirSync(dir, { recursive: true })
const json = {
  generado: HOY_ISO,
  advertencia:
    'Casos y evidencia 100 % SINTÉTICOS. Las cifras de costo son estimaciones del ' +
    'catálogo sobre tarifas con fuente y fecha; no son facturación. La evidencia de ' +
    'calidad de la configuración «propuesta» NO es una medición.',
  consultasSimuladas: CONSULTAS,
  comparacion: c,
}
writeFileSync(resolve(dir, 'informe-sombra.json'), JSON.stringify(json, null, 2) + '\n')
writeFileSync(resolve(dir, 'informe-sombra.md'), informeMarkdown(c, HOY_ISO))

console.log(`\n  ${CONSULTAS} consultas sintéticas · ${casos.length} tareas.`)
console.log(`  actual    → sin candidato ${a.medidas.tasaSinCandidato} · violaciones del piso ${a.medidas.violacionesDelPiso}`)
console.log(`  propuesta → sin candidato ${p.medidas.tasaSinCandidato} · violaciones del piso ${p.medidas.violacionesDelPiso}`)
console.log(`  aceptable: ${c.aceptable ? 'sí' : 'NO — ' + c.motivos.join(' ')}`)
console.log(`\n  Escrito en docs/ai/router/informe-sombra.{json,md}\n`)

// Cero violaciones del piso es la condición, no una métrica más: si alguna
// configuración las tiene, este script FALLA en vez de dejar un informe verde.
if (a.medidas.violacionesDelPiso > 0 || p.medidas.violacionesDelPiso > 0) process.exit(1)
