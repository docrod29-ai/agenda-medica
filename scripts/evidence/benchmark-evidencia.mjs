/**
 * Corre el benchmark de evidencia (#314 punto 11) e imprime el informe.
 *
 *   node scripts/evidence/benchmark-evidencia.mjs
 *   node scripts/evidence/benchmark-evidencia.mjs --caida    ← simula proveedor caído
 *
 * ── POR QUÉ ESTE SCRIPT NO ES «EL BENCHMARK», SINO SU VISOR ─────────────────
 *
 * Los casos y las aserciones viven en
 * src/__tests__/evidence-integrations-benchmark.test.ts, que es lo que corre en
 * CI y lo que se pone rojo si la tubería se rompe. Este script existe para
 * MIRAR los números durante el desarrollo, no para sustituir esa puerta: un
 * benchmark cuyo único guardián es un humano leyendo una salida no protege nada.
 *
 * ── LO QUE MIDE Y LO QUE NO ─────────────────────────────────────────────────
 *
 * Mide la TUBERÍA (¿ancla lo que debe, rechaza lo que debe?) contra un corpus
 * sintético determinista. NO mide calidad clínica, ni latencia real de ningún
 * proveedor, ni costo real — está declarado en el informe y en el encabezado de
 * src/lib/evidence-integrations/benchmark.ts.
 *
 * Necesita `tsx` para leer los módulos TypeScript. Por eso NO corre en CI.
 */
import { execFileSync } from 'node:child_process'

const CAIDA = process.argv.includes('--caida')

const guion = `
  import { correrBenchmarkDeEvidencia, informeLegible } from './src/lib/evidence-integrations/benchmark.ts'
  import { adaptadorSintetico } from './src/lib/evidence-integrations/adaptadores/sintetico.ts'
  import { uptodate, cochrane, openevidence, perplexity } from './src/lib/evidence-integrations/adaptadores/no-configurado.ts'

  const PASAJE_REAL = 'la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'
  const PREGUNTA = { pregunta: '¿duración del tratamiento antimicrobiano?', maximo: 5 }

  const CASOS = [
    {
      id: 'feliz-anclado', consulta: PREGUNTA,
      sintesisCruda: [{ texto: 'La diferencia cruzó el nulo.', citas: [1], pasajes: [PASAJE_REAL] }],
      esperadasRespaldadas: 1, esperadasSinRespaldo: 0,
      porQue: 'camino feliz',
    },
    {
      id: 'adversarial-inventado', consulta: PREGUNTA,
      sintesisCruda: [{ texto: 'La mortalidad se redujo a la mitad.', citas: [1], pasajes: ['la mortalidad se redujo un cincuenta por ciento en el grupo de intervención'] }],
      esperadasRespaldadas: 0, esperadasSinRespaldo: 1,
      porQue: 'afirmación plausible sin pasaje real',
    },
    {
      id: 'cita-fuera-de-rango', consulta: PREGUNTA,
      sintesisCruda: [{ texto: 'Cita inexistente.', citas: [99], pasajes: [PASAJE_REAL] }],
      esperadasRespaldadas: 0, esperadasSinRespaldo: 1,
      porQue: 'el bug de consulta/page.tsx:2698',
    },
  ]

  const principal = ${CAIDA}
    ? adaptadorSintetico({ fallo: { estado: 'unavailable', motivo: 'caída simulada', clase: 'timeout', latenciaMs: 30000 } })
    : adaptadorSintetico()

  // Envuelto en una función async: tsx --eval compila a CJS, y ahí el await
  // de nivel superior no existe.
  void (async () => {
    const informe = await correrBenchmarkDeEvidencia(
      CASOS,
      [principal, uptodate(), cochrane(), openevidence(), perplexity()],
      { ahora: '2026-08-22T10:00:00.000Z', correlacion: 'corr-bench-cli' },
    )
    process.stdout.write(informeLegible(informe) + '\\n')
  })()
`

try {
  const salida = execFileSync('npx', ['tsx', '--eval', guion], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  process.stdout.write(salida)
} catch (e) {
  console.error('No se pudo correr el benchmark. ¿Está `tsx` disponible? (npx tsx)')
  console.error(e.stderr ?? e.message)
  process.exit(1)
}
