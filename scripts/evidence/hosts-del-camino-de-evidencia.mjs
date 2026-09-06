#!/usr/bin/env node
/**
 * INVENTARIO DE HOSTS EXTERNOS EN EL CAMINO DE EVIDENCIA — WS-06.
 *
 * Recorre los archivos por los que entra material que después se cita y saca
 * TODOS los hosts que aparecen. La clasificación de cada uno vive en
 * `src/lib/evidence-integrations/de-donde-se-baja.ts`; aquí sólo se cuentan.
 *
 * ── POR QUÉ NO INTENTA ADIVINAR SI SE BAJA O SE ENLAZA ──────────────────────
 *
 * Sería lo natural —mirar si el host está dentro de un `fetch(`— y sería
 * frágil: la URL se arma en una constante, se pasa por un ayudante con
 * regulador de velocidad, se compone con plantillas. Un analizador que acierte
 * el 90 % de las veces da una lista que parece completa y no lo es, que es peor
 * que no tenerla.
 *
 * Así que el instrumento hace lo que sí puede hacer sin equivocarse: **listar
 * todo host que aparece**. Decidir qué se hace con cada uno es de quien escribe
 * el código, y queda escrito. El guardián compara las dos listas: un host que
 * aparece y no está clasificado rompe el CI.
 *
 * Es la misma forma que `ACCIONES_CON_EVENTO_DURABLE` / `..._SIN_...`: una
 * partición que obliga a decidir, no un detector que opina.
 *
 * Uso:  node scripts/evidence/hosts-del-camino-de-evidencia.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * El camino de evidencia. NO es «todo el árbol»: WhatsApp, Stripe y el correo
 * tienen sus propios hosts y no son fuentes que se citen. Ampliar este alcance
 * es una decisión, y por eso está aquí y no repartido.
 */
export const CAMINO_DE_EVIDENCIA = [
  'src/lib/evidencia',
  'src/lib/evidence-integrations',
  'src/app/api/consultor-evidencia',
  'src/app/api/expediente/evidencia',
]

/** Hosts que aparecen en cualquier archivo del camino, con dónde aparecen. */
export function inventariar() {
  const porHost = new Map()
  for (const dir of CAMINO_DE_EVIDENCIA) {
    for (const archivo of archivosDe(join(RAIZ, dir))) {
      const src = readFileSync(archivo, 'utf8')
      const rel = archivo.slice(RAIZ.length + 1)
      for (const m of src.matchAll(/https?:\/\/([a-zA-Z0-9._-]+)/g)) {
        const host = m[1].toLowerCase()
        if (!porHost.has(host)) porHost.set(host, new Set())
        porHost.get(host).add(rel)
      }
    }
  }
  return [...porHost.entries()]
    .map(([host, donde]) => ({ host, donde: [...donde].sort() }))
    .sort((a, b) => a.host.localeCompare(b.host))
}

function archivosDe(dir) {
  let out = []
  let entradas
  try { entradas = readdirSync(dir) } catch { return out }
  for (const e of entradas) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { out = out.concat(archivosDe(p)); continue }
    if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inv = inventariar()
  console.log(`\n  HOSTS EN EL CAMINO DE EVIDENCIA — ${inv.length}\n`)
  for (const h of inv) console.log(`  ${h.host.padEnd(30)} ${h.donde.join(', ')}`)
  console.log()
}
