#!/usr/bin/env node
/**
 * ARNÉS DE ESCALA DE LA MIGRACIÓN.
 *
 *   npx tsx scripts/migration/arnes.mjs [--filas 10000,50000] [--padron 5000]
 *
 * ── QUÉ MIDE Y QUÉ NO ────────────────────────────────────────────────────────
 *
 * Mide el pipeline PURO: leer, mapear, normalizar, emparejar, contar. Todo en un
 * proceso de Node, sin red y sin base de datos.
 *
 * **NO mide producción.** Ni Firestore, ni la latencia de la red, ni el arranque
 * en frío de una función sin servidor, ni el ritmo de escritura que aguanta un
 * consultorio. Un número de aquí es `local observado` y nunca otra cosa. Decir
 * «Ausculta importa 50 000 pacientes» a partir de esta salida sería exactamente
 * la clase de afirmación no ejecutada que el carril prohíbe.
 *
 * Lo que sí contesta, que es lo que hace falta antes de escribir la ruta:
 *
 *  · ¿el trabajo crece de forma lineal o se disparó a cuadrático?
 *  · ¿la memoria se mantiene acotada al subir de tamaño?
 *  · ¿siguen cuadrando las cuentas cuando el archivo es grande y sucio?
 *
 * Sale por consola y deja un JSON en `agent-state/` para poder comparar entre
 * corridas: una regresión de rendimiento sólo se ve contra la corrida anterior.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { generarCsv, padronSintetico } from '../../src/lib/migration/sintetico'
import { ensayar } from '../../src/lib/migration/ensayo'
import { ADAPTADOR_CSV } from '../../src/lib/migration/adaptadores'
import { DESTINOS } from '../../src/lib/migration/contrato'
import { cuentaDeLotes, FILAS_POR_LOTE } from '../../src/lib/migration/lotes'

const args = process.argv.slice(2)
const opcion = (n, porOmision) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : porOmision
}

const TAMANOS = String(opcion('filas', '100,1000,10000,50000')).split(',').map(Number)
const PADRON = Number(opcion('padron', '0'))
const HOY = '2026-08-23'

const mb = b => Math.round((b / 1024 / 1024) * 10) / 10

/** Memoria de trabajo tras forzar recolección, si el proceso la permite. */
function memoria() {
  if (typeof global.gc === 'function') global.gc()
  return process.memoryUsage().heapUsed
}

console.log('ARNÉS DE ESCALA — MIGRACIÓN (#311)')
console.log('Mide el pipeline puro en memoria. NO mide producción ni Firestore.\n')

const padron = PADRON > 0 ? padronSintetico(PADRON) : []
if (PADRON > 0) console.log(`Padrón existente sintético: ${PADRON} pacientes\n`)

const corridas = []

for (const filas of TAMANOS) {
  const tGen = Date.now()
  const { csv, filasDeclaradas } = generarCsv({ filas, proporcionDefectuosa: 0.1 })
  const msGen = Date.now() - tGen

  const antes = memoria()
  const t0 = Date.now()
  const r = await ensayar(ADAPTADOR_CSV, csv, padron, { clinicId: 'arnes', hoy: HOY })
  const ms = Date.now() - t0
  const despues = memoria()

  const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
  const cuadra = suma === r.reconciliacion.cuentas.sourceRecords

  const c = {
    filas: filasDeclaradas,
    bytesArchivo: Buffer.byteLength(csv, 'utf8'),
    msGenerar: msGen,
    msEnsayo: ms,
    /**
     * Microsegundos por fila. Es EL número que hay que mirar: si se mantiene
     * plano al multiplicar el tamaño por diez, el trabajo es lineal; si sube,
     * algo volvió a ser cuadrático y las importaciones grandes se van a colgar.
     */
    usPorFila: Math.round((ms / Math.max(filasDeclaradas, 1)) * 1000),
    heapAntesMb: mb(antes),
    heapDespuesMb: mb(despues),
    deltaHeapMb: mb(despues - antes),
    lotes: cuentaDeLotes(r.reconciliacion.cuentas.porDestino.accepted, FILAS_POR_LOTE),
    estado: r.reconciliacion.estado,
    cuentasCuadran: cuadra,
    porDestino: r.reconciliacion.cuentas.porDestino,
  }
  corridas.push(c)

  console.log(`── ${filasDeclaradas} filas ${'─'.repeat(Math.max(0, 40 - String(filasDeclaradas).length))}`)
  console.log(`   archivo        ${mb(c.bytesArchivo)} MB`)
  console.log(`   ensayo         ${ms} ms  (${c.usPorFila} µs/fila)`)
  console.log(`   heap           ${c.heapAntesMb} → ${c.heapDespuesMb} MB  (Δ ${c.deltaHeapMb} MB)`)
  console.log(`   lotes a escribir ${c.lotes} de ${FILAS_POR_LOTE}`)
  console.log(`   destinos       ${DESTINOS.map(d => `${d}=${c.porDestino[d]}`).join('  ')}`)
  console.log(`   cuentas        ${cuadra ? 'CUADRAN' : '*** NO CUADRAN ***'}  (${c.estado})\n`)

  if (!cuadra) {
    console.error('Las cuentas no cuadran: hay filas sin clasificar. Esto es un defecto, no un aviso.')
    process.exitCode = 1
  }
}

/**
 * ¿SE MANTUVO LINEAL?
 *
 * Se compara el coste por fila del tamaño más grande contra el más pequeño. Un
 * factor por encima de 4 delata que algo volvió a comparar todo contra todo, que
 * es el defecto exacto que este carril arregló.
 */
if (corridas.length > 1) {
  /**
   * Se comparan los DOS TAMAÑOS MÁS GRANDES, no el primero contra el último.
   *
   * La corrida más pequeña lleva dentro el arranque del proceso —compilación
   * JIT, primeras asignaciones— y su coste por fila sale inflado. Compararla
   * contra la grande hacía que un crecimiento cuadrático real saliera como un
   * factor tranquilizador: la primera versión de este arnés dijo «×2.11, se
   * mantiene lineal» mientras el coste por fila subía de 577 µs a 2 510 µs
   * entre 10 000 y 50 000. Se comparan los dos mayores, que es donde la curva
   * de verdad se ve.
   */
  const primera = corridas[corridas.length - 2], ultima = corridas[corridas.length - 1]
  const factor = Math.round((ultima.usPorFila / Math.max(primera.usPorFila, 1)) * 100) / 100
  console.log(`Coste por fila: ${primera.usPorFila} µs (${primera.filas}) → ${ultima.usPorFila} µs (${ultima.filas}) = ×${factor}`)
  console.log(factor <= 2
    ? 'Se mantiene aproximadamente lineal.'
    : '*** El coste por fila se disparó: sospecha de comparación cuadrática. ***')
  if (factor > 2) process.exitCode = 1
}

mkdirSync('agent-state', { recursive: true })
const salida = {
  generadoEn: new Date().toISOString(),
  aviso: 'local observado en el pipeline puro. NO es una medición de producción ni de Firestore.',
  node: process.version,
  padron: PADRON,
  corridas,
}
writeFileSync('agent-state/MIGRACION_ESCALA.json', JSON.stringify(salida, null, 2))
console.log('\nEscrito agent-state/MIGRACION_ESCALA.json')
