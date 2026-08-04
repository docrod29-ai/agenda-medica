#!/usr/bin/env node
/**
 * ENSAYO DE IDA Y VUELTA DEL RESPALDO — con cronómetro.
 *
 *   npm run simulacro:respaldo            # consultorio sintético de 5 000 docs
 *   npm run simulacro:respaldo -- 50000   # a la escala que se quiera
 *   npm run simulacro:respaldo -- archivo.ndjson   # con un respaldo REAL
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `docs/SIMULACRO_RESTAURACION.md` tiene el procedimiento y su historial decía
 * «todavía ninguno». Y la frase del auditor es la correcta: **sin un tiempo
 * medido no hay respuesta para un hospital** que pregunte cuánto tarda NexusMED
 * en volver.
 *
 * Esto ensaya la mitad que es nuestra —que el archivo vuelve a leerse entero, y
 * cuánto tarda— y se puede correr cuantas veces haga falta, sin consola y sin
 * tocar nada. El `gcloud firestore databases restore` sigue siendo del ensayo
 * con consola, y este script lo dice en su propia salida para que nadie
 * presente este número como «el RTO».
 *
 * DATOS SINTÉTICOS SIEMPRE. Si se le pasa un archivo real, se lee del disco y no
 * se escribe nada en ninguna parte.
 */
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

// Se importa el módulo puro compilando al vuelo con tsx si hace falta; para no
// depender de eso, aquí se reimplementa NADA: se carga el TS con `tsx`.
const { simularRestauracion, actaDeSimulacro, ensayoLimpio } =
  await import('../src/lib/clinica/simulacro.ts')

const arg = process.argv[2] ?? '5000'
const esArchivo = /\.(ndjson|jsonl|txt)$/i.test(arg)

/**
 * Un consultorio sintético con la forma real del respaldo.
 *
 * Nombres inventados y datos de relleno: este script no toca —ni puede tocar—
 * un expediente de verdad.
 */
function consultorioSintetico(n) {
  const lineas = [
    JSON.stringify({ _tipo: 'cabecera', version: 1, clinicId: 'origen', generado: '2026-01-01T00:00:00.000Z' }),
  ]
  const reparto = [
    ['patients', 'clinics/origen/patients'],
    ['patients.notas', 'clinics/origen/patients/p0/notas'],
    ['appointments', 'clinics/origen/appointments'],
    ['cobros', 'clinics/origen/cobros'],
    ['audit_log', 'clinics/origen/audit_log'],
  ]
  for (let i = 0; i < n; i++) {
    const [coleccion, base] = reparto[i % reparto.length]
    lineas.push(JSON.stringify({
      _ruta: `${base}/doc${i}`,
      _coleccion: coleccion,
      nombre: `Sintético ${i}`,
      creado: '2026-01-01T00:00:00.000Z',
      relleno: 'x'.repeat(180),
    }))
  }
  // Una línea excluida a propósito: el respaldo no debería traerla, y si un
  // archivo editado a mano la trae, el ensayo tiene que verla rechazada.
  lineas.push(JSON.stringify({ _ruta: 'clinics/origen/secretos/ia', _coleccion: 'secretos', apiKey: 'NO-DEBE-ENTRAR' }))
  lineas.push(JSON.stringify({ _tipo: 'pie', documentos: n, completo: true }))
  return lineas.join('\n')
}

const ndjson = esArchivo ? readFileSync(arg, 'utf8') : consultorioSintetico(Number(arg) || 5000)

const t0 = performance.now()
const r = simularRestauracion(ndjson, 'destino-de-ensayo')
const ms = performance.now() - t0

console.log('')
console.log(actaDeSimulacro(r, ms, new Date().toISOString()))
console.log('')
if (r.excluidos > 0) {
  console.log(`  Nota: ${r.excluidos} documento(s) NO se restauran por política (llaves de API). Correcto.`)
}
if (!esArchivo) {
  console.log('  Fuente: consultorio SINTÉTICO. Para medir con el respaldo real:')
  console.log('    npm run simulacro:respaldo -- ruta/al/respaldo.ndjson')
}
console.log('')
process.exit(ensayoLimpio(r) ? 0 : 1)
