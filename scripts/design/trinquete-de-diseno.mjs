/**
 * TRINQUETE DEL SISTEMA DE DISEÑO — `DESIGN-SYSTEM-001` de V9.
 *
 * POR QUÉ EXISTE
 *
 * La auditoría `PATIENT-UX-TRUTH-001` encontró que el defecto de esta interfaz
 * no es el que la directiva esperaba. No hay «cara de producto generado por
 * IA»: hay una identidad declarada, con los cocientes de contraste WCAG medidos
 * a mano dentro del propio CSS. El defecto es el contrario —
 *
 *   **el sistema de diseño existe y la aplicación no le obedece.**
 *
 * 6 065 estilos en línea en 177 de 200 archivos · 150 hexadecimales escritos a
 * mano · 39 tamaños de letra donde la escala declara 9 · 22 radios donde declara
 * 6 · 33 valores de espacio donde declara 9.
 *
 * Declarar la escalera no arregla eso por sí solo: hay que impedir que crezca
 * mientras se baja. Es la misma lección que `scripts/lint-trinquete.mjs` (135
 * errores de lint que nadie iba a poner en cero de golpe) aplicada al diseño.
 *
 * CÓMO
 *
 *   · más de lo congelado → falla, y dice en qué archivos creció
 *   · menos               → falla también, pidiendo apretar el trinquete
 *
 * Lo segundo no es capricho. Si el techo no baja al arreglar algo, el margen
 * ganado se lo come el siguiente descuido sin que nadie se entere: un trinquete
 * que no se aprieta es un tope.
 *
 * LO QUE ESTE TRINQUETE NO HACE
 *
 * No juzga si una pantalla se ve bien. Cuenta literales. Una pantalla puede
 * tener cero estilos en línea y ser ilegible, y este script la aprobará. La
 * directiva V9 §4 es explícita: **no se aprueba interfaz leyendo el código.**
 * Esto sólo evita que la deuda medible crezca mientras nadie mira.
 *
 * Tampoco mira `src/app/globals.css`: ahí es donde los literales DEBEN vivir.
 *
 * Uso:
 *   node scripts/design/trinquete-de-diseno.mjs              → comprueba
 *   node scripts/design/trinquete-de-diseno.mjs --actualizar → congela
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

export const TECHO = 'docs/design/design-techo.json'

/** El CSS global es la fuente del sistema: los literales viven ahí a propósito. */
const EXENTOS = new Set(['src/app/globals.css'])

const PATRONES = {
  /** Un color escrito a mano no sigue al tema. En claro se queda oscuro. */
  hexadecimales: /#[0-9a-fA-F]{3,8}\b/g,
  /** `fontSize: 12.5` — el medio píxel que rompe la jerarquía. */
  tamanosDeLetra: /fontSize:\s*['"]?([0-9.]+)(?:px|rem)?['"]?/g,
  /** `borderRadius: 9` — el séptimo peldaño que nadie declaró. */
  radios: /borderRadius:\s*['"]?([0-9.]+)(?:px|%)?['"]?/g,
  /** `padding: 9` — el continuo del 1 al 16. */
  espacios: /(?:padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|gap):\s*['"]?([0-9.]+)px?['"]?/g,
}

/**
 * @typedef {{ total: number, distintos: number, porArchivo: Record<string, number> }} Metrica
 * @typedef {Record<string, Metrica>} Medicion
 */

/**
 * Mide el repositorio. Devuelve, por métrica, el total de apariciones, cuántos
 * valores distintos hay y el reparto por archivo — el reparto es lo que permite
 * decir DÓNDE creció, no sólo que creció.
 *
 * @param {string} raiz directorio del repositorio
 * @returns {Medicion}
 */
export function medir(raiz = process.cwd()) {
  const archivos = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.css'", {
    encoding: 'utf8',
    cwd: raiz,
    maxBuffer: 32 * 1024 * 1024,
  })
    .trim()
    .split('\n')
    .filter(f => f && !EXENTOS.has(f))

  /** @type {Medicion} */
  const metricas = {}
  for (const nombre of Object.keys(PATRONES)) {
    metricas[nombre] = { total: 0, distintos: 0, porArchivo: {} }
  }
  const valores = Object.fromEntries(Object.keys(PATRONES).map(n => [n, new Set()]))

  let archivosConEstiloEnLinea = 0
  let estilosEnLinea = 0

  for (const archivo of archivos) {
    let texto
    try {
      texto = readFileSync(join(raiz, archivo), 'utf8')
    } catch {
      continue // el índice de git puede citar un archivo ya borrado en el árbol
    }

    const enLinea = texto.match(/style=\{\{/g)?.length ?? 0
    if (enLinea > 0) {
      archivosConEstiloEnLinea++
      estilosEnLinea += enLinea
    }

    for (const [nombre, patron] of Object.entries(PATRONES)) {
      const encontrados = [...texto.matchAll(new RegExp(patron.source, patron.flags))]
      if (encontrados.length === 0) continue
      metricas[nombre].total += encontrados.length
      metricas[nombre].porArchivo[archivo] = encontrados.length
      for (const m of encontrados) valores[nombre].add((m[1] ?? m[0]).toLowerCase())
    }
  }

  for (const nombre of Object.keys(PATRONES)) {
    metricas[nombre].distintos = valores[nombre].size
  }

  return {
    ...metricas,
    estiloEnLinea: {
      total: estilosEnLinea,
      distintos: archivosConEstiloEnLinea,
      porArchivo: {},
    },
  }
}

/**
 * Compara lo medido contra lo congelado.
 * @param {Medicion} medido
 * @param {Medicion} techo
 * @returns {{ok: boolean, subieron: string[], bajaron: string[]}}
 */
export function comparar(medido, techo) {
  const subieron = []
  const bajaron = []
  for (const [nombre, actual] of Object.entries(medido)) {
    const congelado = techo[nombre]
    if (!congelado) {
      subieron.push(`${nombre}: métrica nueva (${actual.total}) — congélala`)
      continue
    }
    for (const campo of ['total', 'distintos']) {
      if (actual[campo] > congelado[campo]) {
        subieron.push(`${nombre}.${campo}: ${congelado[campo]} → ${actual[campo]}`)
      } else if (actual[campo] < congelado[campo]) {
        bajaron.push(`${nombre}.${campo}: ${congelado[campo]} → ${actual[campo]}`)
      }
    }
  }
  return { ok: subieron.length === 0 && bajaron.length === 0, subieron, bajaron }
}

/** Sólo se ejecuta cuando se llama como script, no al importarlo desde una prueba. */
const esCLI = process.argv[1] && process.argv[1].endsWith('trinquete-de-diseno.mjs')
if (esCLI) {
  const actualizar = process.argv.includes('--actualizar')
  const medido = medir()

  if (actualizar || !existsSync(TECHO)) {
    writeFileSync(TECHO, JSON.stringify(medido, null, 2) + '\n')
    console.log('\n  Techo de diseño congelado:')
    for (const [n, v] of Object.entries(medido)) {
      console.log(`     ${n.padEnd(16)} ${String(v.total).padStart(6)} usos · ${v.distintos} distintos`)
    }
    console.log()
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const { ok, subieron, bajaron } = comparar(medido, techo)

  if (subieron.length > 0) {
    console.error('\n  DISEÑO: la deuda subió.\n')
    for (const linea of subieron) console.error(`     ${linea}`)
    // Dónde: el reparto por archivo hace accionable el número.
    for (const [nombre, actual] of Object.entries(medido)) {
      const antes = techo[nombre]?.porArchivo ?? {}
      for (const [archivo, n] of Object.entries(actual.porArchivo)) {
        if (n > (antes[archivo] ?? 0)) console.error(`       ${archivo}  ${antes[archivo] ?? 0} → ${n}  (${nombre})`)
      }
    }
    console.error('\n  Usa los tokens de globals.css (--fs-*, --sp-*, --r-*, --elev-*)')
    console.error('  o las utilidades `nx-` que ahora sí existen en @theme inline.\n')
    process.exit(1)
  }

  if (bajaron.length > 0) {
    console.error('\n  DISEÑO: bajaste la deuda. APRIETA EL TRINQUETE:\n')
    for (const linea of bajaron) console.error(`     ${linea}`)
    console.error('\n     node scripts/design/trinquete-de-diseno.mjs --actualizar\n')
    console.error('  Si el techo no baja, el margen ganado se lo come el siguiente descuido.\n')
    process.exit(1)
  }

  if (ok) console.log('\n  DISEÑO: igual que el techo. Sin deuda nueva.\n')
}
