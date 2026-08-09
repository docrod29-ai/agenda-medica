#!/usr/bin/env node
/**
 * LO QUE ESPERA AL DUEÑO — LAS DECISIONES QUE NINGÚN AGENTE PUEDE TOMAR.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * Este repositorio tiene una regla que ha funcionado: **cuando falta un criterio
 * clínico u operativo, no se inventa un valor por defecto — se declara.** De ahí
 * salen `FALTA_GRACIA`, `FALTA_POLITICA_Q2_Q4`, `FALTA_VENTANA_REINGRESO`…
 *
 * Cada una está escrita con cuidado, dice exactamente qué se necesita y por qué
 * no puede decidirlo el software. Y **nadie las lee**, porque viven repartidas
 * en cinco módulos distintos.
 *
 * Es «escrito y sin conectar» —la familia más grande de este repositorio—
 * aplicado a las decisiones en vez de al código. La declaración existe; el
 * camino hasta quien decide, no.
 *
 * ── LO QUE HACE ─────────────────────────────────────────────────────────────
 *
 * Recoge todas las declaraciones y las enseña juntas. **Se derivan del código**,
 * no de una lista: una decisión nueva aparece aquí el día que alguien la
 * declare, y desaparece el día que se resuelva. Una lista escrita a mano se
 * desfasa — ya pasó con el tablero del loop (REG-241) y con la sala de datos.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No propone respuestas. Poner un valor «razonable» al lado de la pregunta es
 * cómo un criterio del dueño se convierte en un default de un agente sin que
 * nadie firme nada.
 *
 * Uso:  node scripts/calidad/lo-que-espera-al-dueno.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const DONDE = ['src/lib', 'src/app']

/**
 * La convención: una constante exportada cuyo nombre empieza por `FALTA_` o
 * `LO_QUE_HACE_FALTA_`, y el comentario de bloque que la precede.
 *
 * Se busca por FORMA y no por lista de ficheros: una declaración nueva en un
 * módulo que todavía no existe también sale aquí.
 */
const DECLARACION = /export const (FALTA_[A-Z0-9_]+|LO_QUE_HACE_FALTA_[A-Z0-9_]+)\s*=\s*((?:\s*'(?:[^'\\]|\\.)*'\s*\+?)+)/g

function archivos(dir, acc = []) {
  let e
  try { e = readdirSync(dir) } catch { return acc }
  for (const n of e) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__') archivos(p, acc) }
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) acc.push(p)
  }
  return acc
}

/** El texto de la constante, sin las comillas ni las concatenaciones. */
function comoSeLee(cuerpo) {
  /**
   * Se juntan los trozos entrecomillados y se descarta lo demás. La primera
   * versión leía hasta el siguiente `export` y arrastraba código detrás del
   * texto: un instrumento que enseña ruido se deja de leer, igual que un aviso.
   */
  const trozos = [...cuerpo.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1])
  return trozos.join('').replace(/\\'/g, "'").replace(/\s+/g, ' ').trim()
}

const abiertas = []

for (const dir of DONDE) {
  for (const p of archivos(join(RAIZ, dir))) {
    const t = readFileSync(p, 'utf8')
    for (const m of t.matchAll(DECLARACION)) {
      abiertas.push({
        constante: m[1],
        archivo: relative(RAIZ, p),
        linea: t.slice(0, m.index).split('\n').length,
        dice: comoSeLee(m[2] ?? ''),
      })
    }
  }
}

abiertas.sort((a, b) => a.constante.localeCompare(b.constante))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: abiertas.length, abiertas }, null, 2))
} else {
  console.log(`\n  Decisiones que esperan al dueño: ${abiertas.length}\n`)
  for (const d of abiertas) {
    console.log(`  ── ${d.constante}`)
    console.log(`     ${d.archivo}:${d.linea}`)
    console.log(`     ${d.dice.slice(0, 300)}${d.dice.length > 300 ? '…' : ''}\n`)
  }
  console.log('  Ninguna tiene valor por defecto: sin respuesta, el motor se planta\n' +
              '  o no corre. Eso es a propósito — un default inventado firma en su\n' +
              '  nombre.\n')
}
