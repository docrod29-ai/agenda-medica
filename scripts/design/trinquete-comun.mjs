/**
 * LA MECÁNICA COMPARTIDA DE LOS TRINQUETES DE V9.
 *
 * Hay dos trinquetes en `DESIGN-SYSTEM-001` —el de deriva de diseño y el de
 * accesibilidad— y van a ser más. Escribir la misma mecánica dos veces produce
 * dos trinquetes que se comportan **casi** igual, y esa palabra es el problema:
 * quien aprende uno da por supuesto el otro y se equivoca justo el día que algo
 * está en rojo.
 *
 * Así que la mecánica vive aquí una sola vez:
 *
 *   · más deuda que el techo → falla, y dice en qué archivo se añadió
 *   · menos                  → falla también, pidiendo apretar el techo
 *   · archivo NUEVO con deuda → falla siempre, aunque el total no se mueva
 *
 * La tercera es la que de verdad importa: el techo congela lo que ya existía, y
 * un archivo que no estaba en la foto no tiene nada que congelar. Sin ella, la
 * deuda se limpia por un lado y entra por el otro sin que nada se ponga rojo.
 *
 * Lo que NO vive aquí: qué se mide. Eso es propio de cada trinquete.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Todos los `.tsx` de las raíces indicadas, en orden estable. */
export function archivosTsx(raices, raiz = process.cwd()) {
  const acc = []
  const recorrer = dir => {
    for (const entrada of readdirSync(dir).sort()) {
      const ruta = join(dir, entrada)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (entrada.endsWith('.tsx')) acc.push(relative(raiz, ruta).split(sep).join('/'))
    }
  }
  for (const r of raices) if (existsSync(r)) recorrer(r)
  return acc.sort()
}

/**
 * EL CÓDIGO SIN SUS COMENTARIOS.
 *
 * Este proyecto comenta mucho y a propósito: los comentarios explican por qué
 * existe cada defensa. El precio es que un guardián ingenuo cuenta lo que se
 * está EXPLICANDO como si fuera lo que se está HACIENDO.
 *
 * Pasó en la primera medición, y en las dos direcciones:
 *
 *   · `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` describe el defecto de
 *     `<img>` sin `alt`; dos de los dos únicos casos que encontró el trinquete
 *     de accesibilidad eran la palabra `<img>` dentro de un comentario que
 *     explicaba otra cosa. Cien por cien de falsos positivos.
 *   · Y al revés: los comentarios que documentan un hexadecimal o un tamaño de
 *     letra —los hay a docenas en `globals.css` y en los componentes— habrían
 *     engordado el techo de deriva con deuda que no existe.
 *
 * Un medidor que grita de más enseña a ignorarlo, igual que un aviso clínico
 * (REG-245). Así que se mide el código, no la prosa.
 *
 * Lo que esto NO hace bien: una cadena de texto que contenga `/*` o `//` se
 * recorta de más. Se acepta — la alternativa es analizar TypeScript dentro de
 * la suite, y un guardián caro es un guardián que se deja de correr. El `//`
 * sólo se reconoce cuando no va precedido de `:`, que es lo que salva a las
 * URLs (`https://…`), que sí abundan.
 */
export function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\w"'`\\])\/\/[^\n]*/g, '$1')
}

/**
 * Recorre los archivos con la función de medida que le pasen y agrega.
 * @param {string[]} archivos rutas relativas
 * @param {string[]} dimensiones
 * @param {(texto: string, ruta: string) => {conteo: Record<string, number>, detalle: Record<string, unknown[]>}} medirUno
 */
export function agregar(archivos, dimensiones, medirUno, raiz = process.cwd()) {
  const porArchivo = {}
  const detallePorArchivo = {}
  const totales = Object.fromEntries([...dimensiones, 'total'].map(d => [d, 0]))
  for (const rel of archivos) {
    const { conteo, detalle } = medirUno(sinComentarios(readFileSync(join(raiz, rel), 'utf8')), rel)
    for (const d of [...dimensiones, 'total']) totales[d] += conteo[d]
    if (conteo.total > 0) {
      porArchivo[rel] = conteo.total
      detallePorArchivo[rel] = detalle
    }
  }
  return { totales, porArchivo, archivos, detallePorArchivo }
}

/** Compara una medición con su techo. No decide nada: sólo informa. */
export function compararConTecho(medicion, techo, dimensiones) {
  const subidas = []
  const bajadas = []
  for (const d of [...dimensiones, 'total']) {
    const hoy = medicion.totales[d]
    const antes = techo.totales?.[d] ?? 0
    if (hoy > antes) subidas.push({ dimension: d, antes, hoy })
    else if (hoy < antes) bajadas.push({ dimension: d, antes, hoy })
  }

  const conocidos = new Set(techo.archivos ?? [])
  const nuevasSucias = medicion.archivos
    .filter(a => !conocidos.has(a) && (medicion.porArchivo[a] ?? 0) > 0)
    .map(a => ({ archivo: a, deuda: medicion.porArchivo[a], detalle: medicion.detallePorArchivo?.[a] }))

  const empeorados = Object.entries(medicion.porArchivo)
    .filter(([a, n]) => conocidos.has(a) && n > (techo.porArchivo?.[a] ?? 0))
    .map(([a, n]) => ({ archivo: a, antes: techo.porArchivo?.[a] ?? 0, hoy: n }))

  return { subidas, bajadas, nuevasSucias, empeorados }
}

export function escribirTecho(ruta, medicion, nota) {
  writeFileSync(ruta, JSON.stringify({
    nota,
    totales: medicion.totales,
    archivos: medicion.archivos,
    porArchivo: medicion.porArchivo,
  }, null, 2) + '\n')
}

export function leerTechoDe(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8'))
}

/**
 * El comportamiento de línea de órdenes, idéntico para todos los trinquetes.
 * Devuelve el código de salida en vez de llamarlo, para poder probarlo.
 */
export function informar({ medicion, techo, dimensiones, nombre, comoArreglar, ordenActualizar }) {
  const { subidas, bajadas, nuevasSucias, empeorados } = compararConTecho(medicion, techo, dimensiones)
  let mal = false

  if (nuevasSucias.length) {
    mal = true
    console.error(`\n  ARCHIVO NUEVO CON DEUDA DE ${nombre.toUpperCase()}.\n`)
    console.error('  El techo congela la deuda de lo que YA existía. Un archivo nuevo no tiene')
    console.error(`  deuda que congelar: nace limpio. ${comoArreglar}\n`)
    for (const n of nuevasSucias) {
      console.error(`     ${n.archivo}  (${n.deuda})`)
      for (const d of dimensiones) {
        const v = n.detalle?.[d] ?? []
        if (v.length) console.error(`        ${d}: ${[...new Set(v.map(String))].slice(0, 6).join(', ')}`)
      }
    }
  }

  if (subidas.length) {
    mal = true
    console.error(`\n  ${nombre.toUpperCase()} POR ENCIMA DEL TECHO.\n`)
    for (const s of subidas) console.error(`     ${s.dimension}: ${s.antes} → ${s.hoy}`)
    for (const e of empeorados) console.error(`        ${e.archivo}  ${e.antes} → ${e.hoy}`)
  }

  if (!mal && bajadas.length) {
    console.error(`\n  BAJÓ LA DEUDA DE ${nombre.toUpperCase()} — hay que apretar el trinquete.\n`)
    for (const b of bajadas) console.error(`     ${b.dimension}: ${b.antes} → ${b.hoy}`)
    console.error(`\n  Corre \`${ordenActualizar}\` y commitea el techo.`)
    console.error('  Un trinquete que no se aprieta es un tope.\n')
    return 1
  }

  if (mal) {
    console.error(`\n  Arréglalo, o justifica el cambio con \`${ordenActualizar}\`.\n`)
    return 1
  }

  console.log(`\n  ${nombre}: ${medicion.totales.total}, igual que el techo. Sin deuda nueva.\n`)
  return 0
}
