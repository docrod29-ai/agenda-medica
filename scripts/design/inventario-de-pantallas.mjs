#!/usr/bin/env node
/**
 * EL INVENTARIO DE PANTALLAS SE DERIVA — V9 · PATIENT-UX-TRUTH-001.
 *
 * ── POR QUÉ ESTO NO ES UNA TABLA EN UN MARKDOWN ─────────────────────────────
 *
 * La primera unidad de V9 pide «auditar TODA pantalla y flujo». Una auditoría
 * escrita a mano vale el día que se escribe y miente a la semana siguiente:
 * alguien añade `src/app/(dashboard)/algo/page.tsx` y el documento sigue
 * diciendo 78 pantallas con toda la seguridad del mundo.
 *
 * Ya pasó con el tablero del loop, TRES veces, y la lección quedó sellada en
 * REG-241: **lo derivable se deriva; lo que es criterio se escribe a mano.**
 * El número de pantallas es derivable. Qué está mal en ellas, no.
 *
 * Así que este script escribe la parte contable de
 * `docs/design/SCREEN_INVENTORY.md` leyendo el árbol de rutas, y
 * `el-inventario-de-pantallas-no-miente.test.ts` falla si el documento se
 * queda atrás. El juicio —qué es P0, qué se rediseña primero— vive en
 * `docs/design/CURRENT_PRODUCT_DESIGN_AUDIT.md`, escrito por una persona.
 *
 * ── QUÉ DERIVA, Y QUÉ SIGNIFICA CADA COLUMNA ────────────────────────────────
 *
 *   ruta        La URL real, con los grupos `(dashboard)` quitados y los
 *               `[param]` conservados — que es como la ve el usuario.
 *   superficie  A QUIÉN le habla la pantalla. Es la columna que importa para
 *               V9: el programa gobierna `paciente` y `medico`, y deja fuera
 *               `interna` (superadmin) y en su sitio `publica` (marketing).
 *   cli         Si el archivo es `'use client'`. Un componente de servidor no
 *               puede perder estado de formulario porque no lo tiene.
 *   líneas      Tamaño del `page.tsx`. Una pantalla de 900 líneas no tiene
 *               sistema de diseño: tiene copiar y pegar.
 *   nav         Cuántas salidas de navegación declara (`router.push`, `<Link`).
 *               Cero salidas en una pantalla profunda es un callejón.
 *   resp        Si el archivo menciona algún punto de corte (`sm:`…`xl:`).
 *   tok         Si usa los tokens de `globals.css` (`var(--…)`).
 *   est         Si toca almacenamiento del navegador (localStorage, session,
 *               IndexedDB). Es la pista más barata de «aquí hay estado que
 *               podría perderse».
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * Mide el `page.tsx`, NO el árbol de componentes que cuelga de él. Una pantalla
 * de tres líneas que renderiza un componente de mil sale con `resp: no` y no
 * significa que no sea adaptable: significa que la respuesta no está en ese
 * archivo. Sirve para ORDENAR el barrido, no para aprobar ni reprobar una
 * pantalla. Aprobar una pantalla exige abrirla en un navegador — §4 de la
 * directiva V9, y no se negocia.
 *
 * Uso:  node scripts/design/inventario-de-pantallas.mjs
 *       node scripts/design/inventario-de-pantallas.mjs --verificar
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = process.cwd()
const APP = join(RAIZ, 'src', 'app')
const SALIDA = join(RAIZ, 'docs', 'design', 'SCREEN_INVENTORY.md')

/**
 * Las rutas a las que llega alguien que NO es el médico ni su personal.
 *
 * Se enumeran a mano y a propósito: clasificar por heurística («si tiene
 * [token] es del paciente») fallaría el día que una ruta interna use un token,
 * y esta columna es la que decide qué gobierna V9. Una lista explícita se
 * queda corta de forma VISIBLE — aparece una ruta nueva sin clasificar y el
 * script la marca `?`, que es justo lo que hay que revisar.
 */
const PACIENTE = [
  '/mi/[token]',            // la hoja de la visita
  '/resena/[token]',        // reseña tras la consulta
  '/reservar/[clinicId]',   // autoagenda
  '/verificar/[token]',     // verificación de documento
  '/teleconsulta/[citaId]', // videoconsulta
  '/privacidad/[clinicId]', // aviso de privacidad del consultorio
  '/dr/[clinicId]',         // perfil público del médico
  '/pago/exito',
  '/pago/cancelado',
]

/** Rutas de marketing y de alta: públicas, pero no son «el producto». */
const PUBLICA = [
  '/', '/precios', '/paquetes', '/contacto', '/evidencia', '/seguridad',
  '/terminos', '/privacidad', '/arquitectura', '/operacion', '/legal',
  '/demo', '/demo/interactivo', '/demo/razonamiento',
  '/login', '/registro', '/setup', '/unirse/[code]',
]

function superficieDe(ruta) {
  if (ruta.startsWith('/superadmin')) return 'interna'
  if (PACIENTE.includes(ruta)) return 'paciente'
  if (PUBLICA.includes(ruta)) return 'publica'
  if (ruta.startsWith('/uci') || ruta.startsWith('/hospitalizacion')) return 'alpha'
  return 'medico'
}

/** Convierte `src/app/(dashboard)/consulta/[patientId]/page.tsx` → `/consulta/[patientId]`. */
function rutaDe(archivo) {
  const partes = relative(APP, archivo).split(sep)
  partes.pop() // page.tsx
  const limpias = partes.filter((p) => !(p.startsWith('(') && p.endsWith(')')))
  return '/' + limpias.join('/')
}

function pantallas(dir = APP, acc = []) {
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'api' || entrada === 'node_modules') continue
      pantallas(ruta, acc)
    } else if (entrada === 'page.tsx') {
      acc.push(ruta)
    }
  }
  return acc
}

function medir(archivo) {
  const src = readFileSync(archivo, 'utf8')
  const ruta = rutaDe(archivo)
  return {
    ruta,
    superficie: superficieDe(ruta),
    cliente: /^\s*['"]use client['"]/m.test(src),
    lineas: src.split('\n').length,
    // `<Link` y `router.push(` son las dos salidas reales; `href=` a secas
    // contaría anclas externas del pie de página y ensuciaría la cifra.
    navegacion: (src.match(/<Link\b/g) || []).length + (src.match(/router\.(push|replace)\(/g) || []).length,
    responsive: /\b(sm|md|lg|xl|2xl):/.test(src),
    tokens: /var\(--/.test(src),
    estado: /localStorage|sessionStorage|indexedDB|openDB\(/.test(src),
  }
}

function tabla(filas) {
  const cab = '| Ruta | Superficie | Cli | Líneas | Nav | Resp | Tok | Est |\n|---|---|---|---|---|---|---|---|'
  const si = (b) => (b ? '✅' : '—')
  const cuerpo = filas
    .map((f) => `| \`${f.ruta}\` | ${f.superficie} | ${si(f.cliente)} | ${f.lineas} | ${f.navegacion} | ${si(f.responsive)} | ${si(f.tokens)} | ${si(f.estado)} |`)
    .join('\n')
  return `${cab}\n${cuerpo}`
}

function generar() {
  const filas = pantallas().map(medir)
  const porSuperficie = {}
  for (const f of filas) porSuperficie[f.superficie] = (porSuperficie[f.superficie] || 0) + 1

  const orden = ['paciente', 'medico', 'alpha', 'publica', 'interna']
  const ordenadas = [...filas].sort((a, b) => {
    const d = orden.indexOf(a.superficie) - orden.indexOf(b.superficie)
    return d !== 0 ? d : a.ruta.localeCompare(b.ruta)
  })

  const resumen = orden
    .filter((s) => porSuperficie[s])
    .map((s) => `| ${s} | ${porSuperficie[s]} |`)
    .join('\n')

  const sinClasificar = filas.filter((f) => f.superficie === '?')

  return `# Inventario de pantallas — NexusMED

> **GENERADO. No se edita a mano.**
> \`node scripts/design/inventario-de-pantallas.mjs\`
> El guardián \`el-inventario-de-pantallas-no-miente\` falla si este archivo se
> queda atrás respecto del árbol de rutas.
>
> **Qué NO dice**: mide el \`page.tsx\`, no el árbol de componentes que cuelga
> de él. Una pantalla delgada que delega en un componente grande sale con
> \`Resp: —\` y eso **no** significa que no sea adaptable. Sirve para ordenar el
> barrido; aprobar una pantalla exige abrirla en un navegador.

**Total: ${filas.length} pantallas.**

| Superficie | Pantallas |
|---|---|
${resumen}

- **paciente** — a quien le habla es el paciente. Es lo que gobierna V9.
- **medico** — la consulta y su alrededor. Producto Practice.
- **alpha** — Hospital y UCI. Detrás de bandera, **no a la venta**.
- **publica** — marketing y alta.
- **interna** — superadmin. Fuera del alcance de V9.
${sinClasificar.length ? `\n> ⚠️ **${sinClasificar.length} rutas sin clasificar.** Añádelas a \`PACIENTE\` o \`PUBLICA\` en el script.\n` : ''}
## Columnas

\`Cli\` \`'use client'\` · \`Nav\` salidas declaradas (\`<Link\`, \`router.push\`) ·
\`Resp\` menciona un punto de corte · \`Tok\` usa \`var(--…)\` de \`globals.css\` ·
\`Est\` toca almacenamiento del navegador.

${tabla(ordenadas)}
`
}

/**
 * EL CUERPO DE LÍNEA DE ÓRDENES SÓLO CORRE SI SE INVOCA DIRECTAMENTE.
 *
 * Sin esta guarda, `import` desde una prueba ejecuta el script entero. Costó
 * dos defectos reales, y el segundo es el que da miedo:
 *
 *  1. `trinquete-de-diseno.mjs` llamaba a `process.exit(1)` al importarlo, así
 *     que una regresión de diseño **tumbaba la recolección** de la prueba en vez
 *     de fallar un caso. El fallo se veía, pero decía otra cosa.
 *
 *  2. `inventario-de-pantallas.mjs` REESCRIBÍA el markdown al importarlo. La
 *     prueba comparaba el archivo contra `generar()`… después de que el propio
 *     import lo hubiera puesto al día. **El guardián no podía fallar nunca.**
 *     Una prueba que no puede fallar no es una prueba — y ésta llevaba dos
 *     commits fingiendo que lo era.
 */
const INVOCADO_DIRECTAMENTE = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (INVOCADO_DIRECTAMENTE) {
  const contenido = generar()

  if (process.argv.includes('--verificar')) {
    let actual = ''
    try { actual = readFileSync(SALIDA, 'utf8') } catch { /* no existe */ }
    if (actual !== contenido) {
      console.error('✗ docs/design/SCREEN_INVENTORY.md está desfasado. Corre: node scripts/design/inventario-de-pantallas.mjs')
      process.exit(1)
    }
    console.log('✓ El inventario de pantallas coincide con el árbol de rutas.')
  } else {
    mkdirSync(join(RAIZ, 'docs', 'design'), { recursive: true })
    writeFileSync(SALIDA, contenido)
    console.log(`✓ docs/design/SCREEN_INVENTORY.md — ${contenido.split('\n').filter((l) => l.startsWith('| `/')).length} pantallas`)
  }
}

export { generar }
