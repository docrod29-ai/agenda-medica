#!/usr/bin/env node
/**
 * `npm run mantenimiento` — CHEQUEO DE OCHO PUNTOS, SÓLO LECTURA.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `CLAUDE.md` lo cita desde hace tiempo entre los cinco comandos del proyecto:
 *
 *     npm run mantenimiento   # chequeo de 8 puntos, sólo lectura
 *
 * …y no existía. Ni el script en `package.json` ni el archivo. Lo encontró la
 * auditoría del Panel de Lujo (6-sep-2026): un comando citado en la carta
 * operativa que falla con «Missing script» es peor que no citarlo — quien llega
 * nuevo al repositorio lo teclea el primer día y aprende que la documentación
 * miente.
 *
 * Se escribe el script en vez de borrar la línea porque los ocho puntos son
 * comprobaciones que el repositorio YA sabe hacer, cada una en su sitio; lo que
 * faltaba era el sitio donde se corren todas juntas.
 *
 * ── LA REGLA DE ESTE ARCHIVO ─────────────────────────────────────────────────
 *
 * **Sólo lectura.** No escribe, no arregla, no toca `git`, no llama a ningún
 * servicio y no lee ni un dato de paciente. Se puede correr en cualquier momento
 * y sobre cualquier rama sin consecuencias. Si algún día una comprobación
 * necesita escribir, va a otro comando: éste tiene que poder correrse sin pensar.
 *
 * ── QUÉ **NO** HACE ──────────────────────────────────────────────────────────
 *
 * No sustituye a las compuertas. `npx vitest run`, `node scripts/lint-trinquete.mjs`
 * y `npm run build` siguen siendo la condición de terminado: esto es el vistazo
 * rápido de mantenimiento, no la puerta. Tampoco mira producción — para eso está
 * `npm run e2e:seguridad:prod`, y va después de publicar.
 *
 * Sale con código 1 si algún punto está en rojo, para que se pueda encadenar.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const leer = (...p) => readFileSync(join(RAIZ, ...p), 'utf8')
const hay = (...p) => existsSync(join(RAIZ, ...p))

/** Recorre un directorio y devuelve los archivos que cumplan el filtro. */
function archivos(dir, filtro, acc = []) {
  const abs = join(RAIZ, dir)
  if (!existsSync(abs)) return acc
  for (const n of readdirSync(abs)) {
    const rel = join(dir, n)
    if (statSync(join(RAIZ, rel)).isDirectory()) archivos(rel, filtro, acc)
    else if (filtro(n)) acc.push(rel)
  }
  return acc
}

const puntos = []
/** @param {string} nombre @param {() => {ok: boolean, dice: string}} fn */
function punto(nombre, fn) {
  try {
    const r = fn()
    puntos.push({ nombre, ...r })
  } catch (e) {
    puntos.push({ nombre, ok: false, dice: `no se pudo comprobar: ${e instanceof Error ? e.message : String(e)}` })
  }
}

/* ── 1. El techo del trinquete de lint ─────────────────────────────────────── */
punto('Techo del trinquete de lint', () => {
  const techo = JSON.parse(leer('docs/audit/lint-techo.json'))
  const declarado = Object.values(techo.porArchivo ?? {}).reduce((s, n) => s + n, 0)
  return {
    ok: declarado === techo.errores,
    dice: declarado === techo.errores
      ? `techo ${techo.errores}, repartido en ${Object.keys(techo.porArchivo ?? {}).length} archivos`
      : `el total (${techo.errores}) no cuadra con la suma por archivo (${declarado})`,
  }
})

/* ── 2. Los invariantes clínicos sellados siguen existiendo ────────────────── */
punto('Pruebas selladas presentes', () => {
  const sello = JSON.parse(leer('src/lib/clinical/invariantes-clinicos.json'))
  const lista = Array.isArray(sello) ? sello : (sello.invariantes ?? sello.archivos ?? [])
  const rutas = lista
    .map(x => (typeof x === 'string' ? x : x.archivo ?? x.ruta ?? x.test))
    .filter(Boolean)
  const faltan = rutas.filter(r => !hay(r))
  return {
    ok: faltan.length === 0,
    dice: faltan.length === 0
      ? `${rutas.length} pruebas selladas, todas presentes`
      : `faltan ${faltan.length}: ${faltan.slice(0, 3).join(', ')}`,
  }
})

/* ── 3. Las colecciones del respaldo siguen teniendo su regla ──────────────── */
punto('Colecciones del respaldo con regla propia', () => {
  /*
   * Se mira en esta dirección y no en la contraria a propósito. «Toda colección
   * de las reglas está en el respaldo» exige distinguir subcolecciones,
   * comodines y bloques anidados, y una versión aproximada de eso da rojos
   * falsos —que es la forma más rápida de que un chequeo deje de mirarse—. Los
   * tres guardianes finos ya existen y viven en la suite; aquí se comprueba lo
   * que se puede comprobar sin ambigüedad: que ninguna colección DECLARADA como
   * respaldable haya perdido su regla, que es el orden en que se rompe (alguien
   * borra un bloque de `firestore.rules` y el manifiesto se queda apuntando).
   */
  const reglas = leer('firestore.rules')
  const respaldo = leer('src/lib/clinica/respaldo.ts')
  /* Las de primer nivel: `{ ruta: 'x', descripcion: … }`. Las hijas viven bajo
     su madre y sus reglas también, así que no se buscan a nivel raíz. */
  const declaradas = [...respaldo.matchAll(/ruta:\s*'([a-z_][\w-]*)',\n\s*descripcion:/g)].map(m => m[1])
  const raiz = [...respaldo.matchAll(/\{\s*ruta:\s*'([a-z_][\w-]*)'\s*,?\s*\}/g)].map(m => m[1])
  const unicas = [...new Set([...declaradas, ...raiz])]
  if (unicas.length === 0) {
    /* Un guardián que no encuentra nada que guardar está roto, no en verde. */
    return { ok: false, dice: 'no se reconoció ninguna colección en respaldo.ts — ¿cambió su forma?' }
  }
  const sinRegla = unicas.filter(c => !new RegExp(`match\\s+/${c}/`).test(reglas))
  return {
    ok: sinRegla.length === 0,
    dice: sinRegla.length === 0
      ? `${unicas.length} colecciones respaldables, todas con regla`
      : `${sinRegla.length} sin bloque en firestore.rules: ${sinRegla.slice(0, 4).join(', ')}`,
  }
})

/* ── 4. La versión del service worker y version.txt van a la par ───────────── */
punto('Versión del service worker', () => {
  const sw = leer('public/sw.js')
  const enSw = /nexusmed-v(\d+)/.exec(sw)?.[1]
  const enTxt = hay('public/version.txt') ? leer('public/version.txt').trim() : null
  if (!enSw) return { ok: false, dice: 'no se encontró `nexusmed-vNNN` en public/sw.js' }
  if (!enTxt) return { ok: false, dice: 'falta public/version.txt' }
  const iguales = enTxt.includes(enSw)
  return {
    ok: iguales,
    dice: iguales ? `v${enSw} en los dos` : `sw.js dice v${enSw} y version.txt dice «${enTxt}»`,
  }
})

/* ── 5. Ningún comando citado en CLAUDE.md falta de package.json ───────────── */
punto('Los comandos que cita CLAUDE.md existen', () => {
  const carta = leer('CLAUDE.md')
  const pkg = JSON.parse(leer('package.json'))
  const citados = [...carta.matchAll(/npm run ([a-z0-9:-]+)/g)].map(m => m[1])
  const faltan = [...new Set(citados)].filter(c => !(c in (pkg.scripts ?? {})))
  return {
    ok: faltan.length === 0,
    dice: faltan.length === 0
      ? `${new Set(citados).size} comandos citados, todos existen`
      : `faltan en package.json: ${faltan.join(', ')}`,
  }
})

/* ── 6. Ningún golden nuevo entra sin cabecera ─────────────────────────────── */
punto('Los goldens explican por qué existen', () => {
  const tests = archivos('src/__tests__', n => n.endsWith('.test.ts'))
  const sinCabecera = tests.filter(t => !leer(t).trimStart().startsWith('/**'))
  /* No se exige cero: hay deuda declarada (A-009). Se informa para que baje. */
  return {
    ok: true,
    dice: `${tests.length} goldens · ${sinCabecera.length} sin cabecera (deuda conocida, sólo puede bajar)`,
  }
})

/* ── 7. Ninguna pantalla habla como máquina ────────────────────────────────── */
punto('Avisos que empiezan por «Error»', () => {
  const fuentes = archivos('src', n => /\.tsx?$/.test(n)).filter(f => !f.includes('__tests__'))
  let n = 0
  for (const f of fuentes) n += (leer(f).match(/toast\((?:'|`)Error/g) ?? []).length
  return { ok: true, dice: `${n} · sólo puede bajar (guardián en la-pantalla-habla-como-persona.test.ts)` }
})

/* ── 8. Ningún campo de formulario sin nombre en las pantallas de trabajo ──── */
punto('Campos de formulario sin nombre', () => {
  const pantallas = archivos('src/app/(dashboard)', n => n.endsWith('.tsx'))
    .concat(archivos('src/components', n => n.endsWith('.tsx')))
  let n = 0
  for (const f of pantallas) {
    const src = leer(f)
    for (const m of src.matchAll(/<(input|select|textarea)\b([\s\S]*?)(\/>|>)/g)) {
      if (/aria-label|aria-labelledby|\bid=\{|\bid="/.test(m[2])) continue
      if (/type=["']hidden["']/.test(m[2])) continue
      n++
    }
  }
  return { ok: true, dice: `${n} · sólo puede bajar (guardián en cada-campo-dice-como-se-llama.test.ts)` }
})

/* ── Informe ──────────────────────────────────────────────────────────────── */
const rojo = puntos.filter(p => !p.ok)
console.log('\nCHEQUEO DE MANTENIMIENTO — sólo lectura, no cambia nada\n')
for (const [i, p] of puntos.entries()) {
  console.log(`  ${p.ok ? '·' : '✗'} ${String(i + 1).padStart(2)}. ${p.nombre}`)
  console.log(`        ${p.dice}`)
}
console.log(
  rojo.length
    ? `\n${rojo.length} de ${puntos.length} en rojo.\n`
    : `\nLos ${puntos.length} puntos, en verde.\n`,
)
process.exit(rojo.length ? 1 : 0)
