#!/usr/bin/env node
/**
 * LOS TRES PROGRAMAS EN VUELO, CONTADOS EN UN SOLO SITIO — WS-01.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El tablero de Ausculta custodia 78 requisitos y está bien vigilado: hay un
 * censo, un sello y un guardián que impide que un dominio desaparezca. Pero
 * custodia **un programa de tres**.
 *
 * En `agent-state/` viven otros dos con sus propios backlogs —V9 (experiencia
 * del paciente y diseño) y V10 (excelencia visual)— y el tablero de Ausculta no
 * los menciona. Así que un «quedan 8 accionables» era cierto del censo y falso
 * del producto, y nadie podía notarlo leyendo el tablero: **ningún documento
 * derivado puede notar la ausencia de algo que no está en su fuente.**
 *
 * Es exactamente el defecto que este censo existe para impedir, un nivel más
 * arriba: no un dominio evaporado, un PROGRAMA entero fuera de la foto.
 *
 * ── POR QUÉ NO SE FUSIONAN EN UN CENSO ÚNICO ────────────────────────────────
 *
 * Porque no son el mismo trabajo y tienen dueños distintos.
 *
 * **V10 es el carril de Product Excellence**, y el propio directivo de Master
 * dice, en su §20, que no se rehaga su trabajo, y en el §18 que no se invadan
 * los cambios puramente visuales que le pertenecen. Absorber sus 23 items al
 * censo de Master sería justo la invasión que prohíbe.
 *
 * Lo que Master SÍ debe hacer es **no fingir que no existen**. Por eso esto no
 * fusiona: cuenta, y deja el conteo donde se lee el tablero.
 *
 * ── LO QUE SE MIDIÓ ─────────────────────────────────────────────────────────
 *
 * Los 10 items abiertos de V9 se comprobaron uno por uno **contra el árbol**, no
 * contra el archivo. Cinco ya estaban hechos y nadie los había marcado —el
 * trinquete de voz, el token de la videoconsulta, i18n con consumidor, las
 * utilidades `nx-` y el formulario previo—. Un backlog que exagera el trabajo
 * pendiente se abandona igual que uno que lo esconde.
 *
 * Uso:
 *   node scripts/programa/reconciliar-programas.mjs             → escribe el .md
 *   node scripts/programa/reconciliar-programas.mjs --verificar → falla si difiere
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const DESTINO = 'docs/product/PROGRAMAS-EN-VUELO.md'

/**
 * Los programas que hoy tienen trabajo vivo, con dónde vive su estado.
 *
 * `carril` dice de quién es el trabajo. Master NO ejecuta el de Product
 * Excellence: lo cuenta para que su propio tablero no se lea como si fuera el
 * producto entero.
 */
export const PROGRAMAS = [
  {
    id: 'ausculta',
    nombre: 'Ausculta — Master Completion Loop',
    carril: 'master',
    fuente: 'src/lib/programa/requisitos.ts',
    comoSeLee: 'censo tipado, con sello y guardián propio',
  },
  {
    id: 'v9',
    nombre: 'V9 — Experiencia del paciente y diseño',
    carril: 'compartido',
    fuente: 'agent-state/BACKLOG.json',
    comoSeLee: 'backlog con `estado` por item',
  },
  {
    id: 'v10',
    nombre: 'V10 — Excelencia visual',
    carril: 'product-excellence',
    fuente: 'agent-state/V10_BACKLOG.json',
    comoSeLee: 'backlog con `estado` por item',
  },
]

/** Un item está CERRADO si su estado lo dice. Todo lo demás cuenta como abierto. */
export function estaCerrado(estado) {
  return /^(CERRADO|RESUELTO|desbloqueado)/i.test(String(estado ?? ''))
}

/** Cuenta un backlog de `agent-state`. Devuelve `null` si el archivo no existe. */
export function contarBacklog(ruta) {
  const abs = resolve(RAIZ, ruta)
  if (!existsSync(abs)) return null
  const d = JSON.parse(readFileSync(abs, 'utf8'))
  const items = Array.isArray(d.items) ? d.items : []
  const abiertos = items.filter(i => !estaCerrado(i.estado))
  return {
    total: items.length,
    abiertos: abiertos.length,
    actualizado: d.actualizado ?? d._reconciliado ?? null,
    lista: abiertos.map(i => ({
      id: i.id,
      estado: String(i.estado ?? ''),
      titulo: String(i.titulo ?? ''),
      verificado: i.verificadoContraElArbol ?? null,
    })),
  }
}

/**
 * El informe. `censo` se pasa desde fuera —la prueba lo importa de TypeScript y
 * el CLI lo lee con tsx— por la misma razón que la matriz de proveedores: un
 * gate de documentación que depende de una descarga se cae un martes cualquiera.
 */
export function generarInforme(censo) {
  if (!censo || typeof censo.total !== 'number') {
    throw new Error('generarInforme: falta el conteo del censo de Ausculta')
  }
  const L = []
  L.push('# Programas en vuelo')
  L.push('')
  L.push('> **GENERADO. No editar a mano.**')
  L.push('> Regenerar: `node scripts/programa/reconciliar-programas.mjs`.')
  L.push('')
  L.push('El tablero de Ausculta custodia **un programa de tres**. Este documento existe')
  L.push('para que «quedan N accionables» no vuelva a leerse como si fuera el producto entero.')
  L.push('')
  L.push('| Programa | Carril | Requisitos | Abiertos | Fuente |')
  L.push('|---|---|---|---|---|')
  L.push(`| ${PROGRAMAS[0].nombre} | master | ${censo.total} | ${censo.abiertos} | \`${PROGRAMAS[0].fuente}\` |`)
  for (const p of PROGRAMAS.slice(1)) {
    const c = contarBacklog(p.fuente)
    L.push(`| ${p.nombre} | ${p.carril} | ${c ? c.total : '—'} | ${c ? c.abiertos : '—'} | \`${p.fuente}\` |`)
  }
  L.push('')
  L.push('## Quién ejecuta qué')
  L.push('')
  L.push('**V10 es el carril de Product Excellence.** El §20 del directivo de Master dice')
  L.push('que no se rehaga su trabajo y el §18 que no se invadan sus cambios visuales.')
  L.push('Master lo cuenta; no lo ejecuta.')
  L.push('')
  L.push('**V9 es compartido**: toca experiencia del paciente y diseño, y parte de eso')
  L.push('coincide con ejes que Master sí custodia.')
  L.push('')

  for (const p of PROGRAMAS.slice(1)) {
    const c = contarBacklog(p.fuente)
    if (!c) continue
    L.push(`## ${p.nombre} — ${c.abiertos} abiertos de ${c.total}`)
    L.push('')
    if (c.actualizado) L.push(`Última reconciliación: ${typeof c.actualizado === 'string' ? c.actualizado.slice(0, 60) : ''}`)
    L.push('')
    L.push('| Item | Estado | Qué es | Comprobado contra el árbol |')
    L.push('|---|---|---|---|')
    for (const i of c.lista) {
      L.push(`| \`${i.id}\` | ${i.estado} | ${i.titulo.slice(0, 90)} | ${i.verificado ?? '_no comprobado_'} |`)
    }
    L.push('')
  }
  return L.join('\n') + '\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync } = await import('node:child_process')
  const json = execFileSync('npx', ['tsx', '--eval', `
    import { REQUISITOS, sinProbar } from './src/lib/programa/requisitos.ts'
    process.stdout.write(JSON.stringify({ total: REQUISITOS.length, abiertos: sinProbar().length }))
  `], { encoding: 'utf8', cwd: RAIZ })
  const censo = JSON.parse(json)
  const contenido = generarInforme(censo)
  const abs = resolve(RAIZ, DESTINO)
  if (process.argv.includes('--verificar')) {
    const actual = existsSync(abs) ? readFileSync(abs, 'utf8') : ''
    if (actual !== contenido) {
      console.error(`[WS-01] ${DESTINO} está desincronizado. Regenera con el mismo script.`)
      process.exit(1)
    }
    console.log(`[WS-01] ${DESTINO} sincronizado.`)
  } else {
    writeFileSync(abs, contenido)
    console.log(`Escrito ${DESTINO}.`)
  }
}
