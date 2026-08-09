/**
 * COMPUERTA DE CONTRASTE SOBRE EL ESTILO EN LÍNEA.
 *
 * POR QUÉ EXISTE
 * --------------
 * `globals.css` documenta, con la fórmula WCAG escrita a mano, que `--nexus`
 * se aclaró a #6E84FE para servir de TEXTO sobre fondo oscuro, y que como
 * RELLENO bajo texto blanco daba **3,28 : 1** — reprueba AA, que pide 4,5. La
 * reparación creó `--nexus-solido` (#3D5AFE, blanco encima = 5,13) y se aplicó
 * a `.btn-primary`.
 *
 * Pero la misma pareja —relleno de marca + texto blanco— vive también en
 * `style={{ }}`, donde ninguna hoja de estilo la alcanza. Ahí la corrección no
 * llegó: el arreglo se aplicó donde miró la búsqueda, y el defecto sobrevivió
 * donde no. Es la familia que este repositorio ya conoce por su nombre.
 *
 * Un cociente de contraste no es una opinión: se calcula. Así que esto no
 * revisa estilo, **mide**, con la fórmula de luminancia relativa de WCAG 2.1,
 * en los DOS temas, y falla por debajo de 4,5 : 1.
 *
 * TRINQUETE
 * ---------
 * La deuda encontrada se congela por archivo en `docs/design/contraste-techo.json`
 * y sólo puede bajar. Un archivo que no está en el techo —una pantalla nueva—
 * tiene tolerancia CERO. Esa es la compuerta que pide V9 §4: una pantalla nueva
 * no puede nacer reprobando AA.
 *
 * QUÉ **NO** CUBRE — y hay que decirlo, porque un medidor que parece completo
 * y no lo está enseña a confiar de más:
 *
 *  · Colores translúcidos (`rgba`, `color-mix`): el resultado depende de lo que
 *    haya detrás, que no se puede saber leyendo un archivo. Se saltan.
 *  · Color heredado: si el `color` no está en el mismo objeto de estilo que el
 *    `background`, no se puede emparejar sin ejecutar el navegador.
 *  · Texto grande (≥18,66 px negrita o ≥24 px), al que AA le pide 3:1. Aquí se
 *    exige 4,5 a todo: es más estricto, nunca más laxo, y el falso positivo se
 *    congela en el techo con su razón.
 *  · Clases CSS. Esto sólo mira `style={{ }}`; las hojas viven en globals.css.
 *  · Todo lo que no sea un literal: un color que viene de una variable de
 *    JavaScript no se resuelve.
 *
 * Uso:
 *   node scripts/design/contraste-en-linea.mjs              → compuerta
 *   node scripts/design/contraste-en-linea.mjs --actualizar → fija el techo
 *   node scripts/design/contraste-en-linea.mjs --json       → informe crudo
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const CSS = 'src/app/globals.css'
const TECHO = 'docs/design/contraste-techo.json'
const MINIMO_AA = 4.5

/* ─────────────────────────── color ─────────────────────────── */

/** Luminancia relativa WCAG 2.1 §relative luminance. */
function luminancia({ r, g, b }) {
  const canal = v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Cociente de contraste WCAG 2.1. Devuelve un número ≥ 1. */
export function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b)
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la]
  return (claro + 0.05) / (oscuro + 0.05)
}

const NOMBRES = { white: '#ffffff', black: '#000000' }

/** Convierte un literal CSS a {r,g,b}, o null si no es opaco ni resoluble. */
export function aRgb(valor) {
  if (!valor) return null
  let v = String(valor).trim().toLowerCase()
  if (NOMBRES[v]) v = NOMBRES[v]
  if (v.startsWith('#')) {
    const h = v.slice(1)
    if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) }
    if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
    return null // #rgba / #rrggbbaa → translúcido, fuera de alcance
  }
  const m = v.match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  return null
}

/* ───────────────────── tokens de globals.css ───────────────────── */

/**
 * Lee los tokens de un bloque `:root`. Devuelve un mapa nombre → valor crudo.
 * No resuelve alias todavía: eso se hace después, porque un alias puede
 * apuntar a un token declarado más abajo.
 */
function tokensDelBloque(css, inicio) {
  const abre = css.indexOf('{', inicio)
  if (abre < 0) return {}
  let nivel = 0, i = abre
  for (; i < css.length; i++) {
    if (css[i] === '{') nivel++
    else if (css[i] === '}') { nivel--; if (nivel === 0) break }
  }
  /*
    LOS COMENTARIOS SE QUITAN ANTES DE LEER, y no es cosmética.

    El bloque claro documenta su propia corrección con la frase «2.74:1 sobre
    --s3: NO cumplía». Sin quitar comentarios, `--s3:` casa con la expresión y
    se traga TODO el texto hasta el siguiente `;` — que es la declaración real
    de `--text3`. Resultado: `--text3` del tema claro nunca se leía, heredaba el
    valor oscuro y la compuerta acusaba de reprobar AA a decenas de pantallas
    que cumplen. Un medidor con un falso positivo masivo se apaga en una semana.
  */
  const cuerpo = css.slice(abre + 1, i).replace(/\/\*[\s\S]*?\*\//g, '')
  const mapa = {}
  for (const m of cuerpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) mapa[m[1]] = m[2].trim()
  return mapa
}

/** Resuelve `var(--x, respaldo)` encadenado hasta llegar a un color literal. */
function resolver(nombre, mapa, vistos = new Set()) {
  if (vistos.has(nombre)) return null
  vistos.add(nombre)
  const crudo = mapa[nombre]
  if (!crudo) return null
  const directo = aRgb(crudo)
  if (directo) return directo
  const alias = crudo.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,([^)]*))?\)$/i)
  if (alias) {
    const porNombre = resolver(alias[1], mapa, vistos)
    if (porNombre) return porNombre
    return alias[2] ? aRgb(alias[2].trim()) : null
  }
  return null
}

export function leerTemas(rutaCss = CSS) {
  const css = readFileSync(rutaCss, 'utf8')
  const crudoOscuro = tokensDelBloque(css, css.indexOf(':root {'))
  const iLuz = css.indexOf(':root[data-theme="light"]')
  const crudoClaro = { ...crudoOscuro, ...(iLuz >= 0 ? tokensDelBloque(css, iLuz) : {}) }
  const resolverTodo = crudo => {
    const salida = {}
    for (const nombre of Object.keys(crudo)) {
      const rgb = resolver(nombre, crudo)
      if (rgb) salida[nombre] = rgb
    }
    return salida
  }
  return { oscuro: resolverTodo(crudoOscuro), claro: resolverTodo(crudoClaro) }
}

/* ───────────────── estilo en línea de los .tsx ───────────────── */

/** Extrae los objetos `style={{ … }}` de un archivo, con su línea. */
function objetosDeEstilo(fuente) {
  const salida = []
  const marca = /style=\{\{/g
  let m
  while ((m = marca.exec(fuente))) {
    let nivel = 2, i = m.index + m[0].length
    for (; i < fuente.length && nivel > 0; i++) {
      if (fuente[i] === '{') nivel++
      else if (fuente[i] === '}') nivel--
    }
    salida.push({
      cuerpo: fuente.slice(m.index + m[0].length, i - 1),
      linea: fuente.slice(0, m.index).split('\n').length,
    })
  }
  return salida
}

/** Valor de una propiedad dentro del objeto, en el nivel superior de comas. */
function propiedad(cuerpo, nombres) {
  for (const nombre of nombres) {
    const re = new RegExp(`(?:^|[,{\\s])${nombre}\\s*:`, 'i')
    const m = cuerpo.match(re)
    if (!m) continue
    let i = m.index + m[0].length
    let nivel = 0, valor = ''
    for (; i < cuerpo.length; i++) {
      const c = cuerpo[i]
      if ('{(['.includes(c)) nivel++
      else if ('})]'.includes(c)) { if (nivel === 0) break; nivel-- }
      else if (c === ',' && nivel === 0) break
      valor += c
    }
    return valor.trim()
  }
  return null
}

/**
 * Convierte un valor de propiedad en las ramas literales que puede tomar.
 *
 * NO VALE CON RECOGER LOS LITERALES QUE HAYA. La primera versión de esto lo
 * hacía y se equivocó a la primera: en
 *
 *   background: mio ? rolColor : 'var(--s1)'
 *   color:      mio ? '#040b12' : 'var(--text)'
 *
 * el fondo aporta UN literal (la rama falsa) y el texto aporta DOS, así que
 * emparejar «el único fondo con todos los textos» casa `#040b12` con
 * `var(--s1)` — dos ramas que **nunca se pintan juntas** — y acusa de 1,08:1 a
 * una burbuja de chat que se ve perfectamente. Una compuerta que acusa en falso
 * se marca como ruido y deja de proteger; vale más callar de más.
 *
 * Por eso la forma importa tanto como el contenido:
 *   'literal'   → el valor entero es un literal
 *   'ternario'  → `cond ? 'a' : 'b'` con las DOS ramas literales
 *   'incierto'  → cualquier otra cosa. No se empareja.
 */
function ramas(valor) {
  if (!valor) return { lista: [], forma: 'incierto' }
  const v = valor.trim()
  const soloLiteral = v.match(/^'([^']*)'$|^"([^"]*)"$/)
  if (soloLiteral) return { lista: [soloLiteral[1] ?? soloLiteral[2]], forma: 'literal' }
  const ternario = v.match(/^[^?'"`]*\?\s*(?:'([^']*)'|"([^"]*)")\s*:\s*(?:'([^']*)'|"([^"]*)")$/)
  if (ternario) {
    return { lista: [ternario[1] ?? ternario[2], ternario[3] ?? ternario[4]], forma: 'ternario' }
  }
  return { lista: [], forma: 'incierto' }
}

/** Un literal CSS → rgb en el tema dado, o null si no se puede resolver. */
function resolverEnTema(literal, tokens) {
  if (!literal) return null
  const v = literal.trim()
  if (v === 'transparent' || v === 'none' || v === 'inherit' || v === 'currentColor') return null
  const directo = aRgb(v)
  if (directo) return directo
  const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]*))?\)$/i)
  if (!m) return null
  if (tokens[m[1]]) return tokens[m[1]]
  return m[2] ? aRgb(m[2].trim()) : null
}

export function analizar(archivos, temas) {
  const hallazgos = []
  for (const archivo of archivos) {
    const fuente = readFileSync(archivo, 'utf8')
    for (const { cuerpo, linea } of objetosDeEstilo(fuente)) {
      const fondos = ramas(propiedad(cuerpo, ['backgroundColor', 'background']))
      const textos = ramas(propiedad(cuerpo, ['color']))
      if (!fondos.lista.length || !textos.lista.length) continue
      /*
        Sólo dos emparejamientos son ciertos sin ejecutar el navegador:
         · las dos ramas de un MISMO ternario, por posición — se pintan juntas;
         · un fondo literal (siempre el mismo) con cada rama del texto.
        Un fondo ternario con un texto literal también es cierto, y va incluido.
        Todo lo demás se calla.
      */
      const parejas = []
      if (fondos.forma === 'ternario' && textos.forma === 'ternario') {
        fondos.lista.forEach((f, i) => parejas.push([f, textos.lista[i]]))
      } else if (fondos.forma === 'literal') {
        textos.lista.forEach(t => parejas.push([fondos.lista[0], t]))
      } else if (textos.forma === 'literal') {
        fondos.lista.forEach(f => parejas.push([f, textos.lista[0]]))
      } else continue
      for (const [fondo, texto] of parejas) {
        for (const tema of ['oscuro', 'claro']) {
          const f = resolverEnTema(fondo, temas[tema])
          const t = resolverEnTema(texto, temas[tema])
          if (!f || !t) continue
          const razon = contraste(f, t)
          if (razon >= MINIMO_AA) continue
          hallazgos.push({
            archivo, linea, tema,
            fondo, texto,
            razon: Math.round(razon * 100) / 100,
          })
        }
      }
    }
  }
  return hallazgos
}

/* ──────────────────────────── compuerta ──────────────────────────── */

function archivosDePantalla() {
  const salida = execSync(
    "git ls-files 'src/app/**/*.tsx' 'src/components/**/*.tsx'",
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  return salida.split('\n').filter(Boolean)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const temas = leerTemas()
  const hallazgos = analizar(archivosDePantalla(), temas)

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(hallazgos, null, 2))
    process.exit(0)
  }

  const porArchivo = {}
  for (const h of hallazgos) porArchivo[h.archivo] = (porArchivo[h.archivo] ?? 0) + 1

  if (process.argv.includes('--actualizar') || !existsSync(TECHO)) {
    writeFileSync(TECHO, JSON.stringify({
      _porQue: 'Deuda de contraste congelada por archivo. Sólo baja. Un archivo que no aparece aquí tiene tolerancia CERO: una pantalla nueva no nace reprobando AA.',
      minimo: MINIMO_AA,
      total: hallazgos.length,
      porArchivo,
    }, null, 2) + '\n')
    console.log(`\n  Techo de contraste fijado en ${hallazgos.length} parejas por debajo de ${MINIMO_AA}:1.\n`)
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const nuevos = []
  for (const h of hallazgos) {
    const antes = techo.porArchivo[h.archivo] ?? 0
    if (antes === 0) nuevos.push(h)
  }
  const subieron = Object.entries(porArchivo).filter(([f, n]) => n > (techo.porArchivo[f] ?? 0))

  if (subieron.length) {
    console.error(`\n  CONTRASTE: ${hallazgos.length} parejas por debajo de ${MINIMO_AA}:1 (el techo son ${techo.total}).\n`)
    for (const [f, n] of subieron) console.error(`     ${f}  ${techo.porArchivo[f] ?? 0} → ${n}`)
    for (const h of nuevos.slice(0, 20)) {
      console.error(`       ${h.archivo}:${h.linea} · tema ${h.tema} · «${h.texto}» sobre «${h.fondo}» = ${h.razon}:1`)
    }
    console.error('\n  AA pide 4,5:1 en texto normal. Para relleno de marca bajo texto blanco existe var(--nexus-solido).\n')
    process.exit(1)
  }

  if (hallazgos.length < techo.total) {
    console.error(`\n  CONTRASTE: bajaste a ${hallazgos.length} (el techo son ${techo.total}). APRIETA EL TRINQUETE:\n`)
    console.error('     node scripts/design/contraste-en-linea.mjs --actualizar\n')
    process.exit(1)
  }

  console.log(`\n  CONTRASTE: ${hallazgos.length} parejas bajo ${MINIMO_AA}:1, igual que el techo. Sin deuda nueva.\n`)
}
