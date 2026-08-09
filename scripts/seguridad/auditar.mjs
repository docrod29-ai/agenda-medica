#!/usr/bin/env node
/**
 * LA CIFRA DE SEGURIDAD SE DERIVA, NO SE TRANSCRIBE — REG-253.
 *
 * ── LO QUE PASÓ ─────────────────────────────────────────────────────────────
 *
 * `docs/seguridad/npm-audit-2026-07-30.md` decía, en la columna «después»:
 *
 *     Rama de producción: 8 · 0 high · 8 moderate
 *
 * Nueve días más tarde, el mismo comando devolvía **12 · 3 high**. Entre ellas,
 * `pdfjs-dist` con **ejecución arbitraria de JavaScript al abrir un PDF
 * malicioso** — y este producto abre PDF de laboratorio todos los días.
 *
 * El documento no mintió cuando se escribió: **se pudrió**. Es exactamente la
 * familia `depende_de_recordar` que se abrió con el tablero del loop (REG-241):
 * un dato que existe en el sistema y un segundo sitio que lo repite a mano.
 *
 * ── POR QUÉ ÉSTE ES PEOR QUE EL DEL TABLERO ─────────────────────────────────
 *
 * El tablero del loop lo leo yo. **Este documento se le enseña a un comprador.**
 * Una cifra de seguridad obsoleta en una sala de datos no es un despiste: es una
 * afirmación falsa sobre el riesgo de un producto sanitario.
 *
 * ── LO QUE HACE ─────────────────────────────────────────────────────────────
 *
 * Corre `npm audit --omit=dev` y `npm audit`, y **reescribe el bloque de cifras**
 * del documento con lo que devuelva el comando y la fecha de hoy.
 *
 * Lo que NO toca: el análisis, las razones de cada diferimiento, las decisiones.
 * Eso es criterio, y el criterio no sale de un `npm audit`.
 *
 * Uso:  node scripts/seguridad/auditar.mjs
 *       node scripts/seguridad/auditar.mjs --verificar   (falla si está desfasado)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const RAIZ = process.cwd()
const DOC = join(RAIZ, 'docs', 'seguridad', 'ESTADO-DEPENDENCIAS.md')

const MARCA_INICIO = '<!-- CIFRAS-DERIVADAS:INICIO -->'
const MARCA_FIN = '<!-- CIFRAS-DERIVADAS:FIN -->'

function auditar(soloProd) {
  try {
    const out = execSync(`npm audit${soloProd ? ' --omit=dev' : ''} --json`, {
      cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024,
    })
    return JSON.parse(out)
  } catch (e) {
    /* `npm audit` sale con código ≠ 0 cuando ENCUENTRA algo: eso no es un error
       del script, es su resultado. El JSON viene igual en stdout. */
    try { return JSON.parse(e.stdout ?? '{}') } catch { return {} }
  }
}

function resumen(d) {
  const m = d?.metadata?.vulnerabilities ?? {}
  const altas = Object.entries(d?.vulnerabilities ?? {})
    .filter(([, v]) => v?.severity === 'high' || v?.severity === 'critical')
    .map(([k, v]) => `${k} (${v.severity})`)
    .sort()
  return {
    total: m.total ?? 0, critical: m.critical ?? 0, high: m.high ?? 0,
    moderate: m.moderate ?? 0, low: m.low ?? 0, altas,
  }
}

const prod = resumen(auditar(true))
const todo = resumen(auditar(false))
const fecha = execSync('git log -1 --format=%cs', { cwd: RAIZ, encoding: 'utf8' }).trim()

const bloque = [
  MARCA_INICIO,
  '',
  `**Medido el ${fecha}** por \`node scripts/seguridad/auditar.mjs\`. Estas cifras`,
  'NO se escriben a mano: se derivan del comando. Si alguien las edita, la prueba',
  '`la-cifra-de-seguridad-no-se-pudre` falla.',
  '',
  '| Alcance | Total | Critical | High | Moderate | Low |',
  '|---|---|---|---|---|---|',
  `| Rama de producción (\`--omit=dev\`) | ${prod.total} | **${prod.critical}** | **${prod.high}** | ${prod.moderate} | ${prod.low} |`,
  `| Árbol completo (incluye herramientas) | ${todo.total} | ${todo.critical} | ${todo.high} | ${todo.moderate} | ${todo.low} |`,
  '',
  prod.high + prod.critical === 0
    ? '**Cero `high` y cero `critical` en la rama que se sirve a los pacientes.**'
    : `**Pendientes en producción:** ${prod.altas.join(', ')}`,
  '',
  todo.high + todo.critical > 0
    ? `Las \`high\` del árbol completo viven en herramientas de desarrollo y no se ` +
      `sirven: ${todo.altas.filter(a => !prod.altas.includes(a)).slice(0, 12).join(', ') || '—'}.`
    : '',
  '',
  MARCA_FIN,
].join('\n')

const soloVerificar = process.argv.includes('--verificar')
let doc = ''
try { doc = readFileSync(DOC, 'utf8') } catch { doc = '' }

if (!doc.includes(MARCA_INICIO)) {
  if (soloVerificar) { console.error('  Falta el bloque derivado en', DOC); process.exit(1) }
  doc = `# Estado de las dependencias\n\n${bloque}\n`
} else {
  const i = doc.indexOf(MARCA_INICIO)
  const j = doc.indexOf(MARCA_FIN) + MARCA_FIN.length
  const anterior = doc.slice(i, j)
  if (soloVerificar) {
    /* Se compara sin la línea de fecha: lo que importa es que las CIFRAS
       coincidan, no que el documento se haya reescrito hoy. */
    const sinFecha = (t) => t.replace(/\*\*Medido el [^*]+\*\*/, '')
    if (sinFecha(anterior).trim() !== sinFecha(bloque).trim()) {
      console.error(
        `  Las cifras de seguridad publicadas están DESFASADAS.\n\n` +
        `  Hoy: producción ${prod.total} · ${prod.high} high · ${prod.critical} critical\n\n` +
        `  Arréglalo con: node scripts/seguridad/auditar.mjs\n`)
      process.exit(1)
    }
    console.log(`  Cifras al día: producción ${prod.total} · ${prod.high} high`)
    process.exit(0)
  }
  doc = doc.slice(0, i) + bloque + doc.slice(j)
}

writeFileSync(DOC, doc)
console.log(
  `  Cifras derivadas del comando:\n` +
  `     producción      ${prod.total} · ${prod.high} high · ${prod.critical} critical\n` +
  `     árbol completo  ${todo.total} · ${todo.high} high · ${todo.critical} critical\n`)
