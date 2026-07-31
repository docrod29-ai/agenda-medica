import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, normalize, resolve } from 'node:path'

/**
 * REG-059 · Ninguna ruta de API debe arrastrar el SDK de Firebase del NAVEGADOR.
 *
 * EL DEFECTO QUE CONGELA. `src/lib/firebase.ts` llama a `initializeApp` y
 * `getAuth` **al importarse** (no dentro de una función). Así que basta con que
 * un módulo de servidor lo alcance por una cadena de imports —aunque nunca use
 * lo que importó— para que Firebase se inicialice durante `next build`:
 *
 *     /api/portal → availability → time-blocks → firebase   ← el SDK del cliente
 *
 * Consecuencia real: `next build` moría con `auth/invalid-api-key` en cualquier
 * entorno sin las variables `NEXT_PUBLIC_FIREBASE_*`. En Vercel no se notaba
 * porque ahí sí existen — el build de producción funcionaba **por accidente**.
 * Lo descubrió el CI, no nosotros.
 *
 * Además del build, el acoplamiento es incorrecto en sí: una ruta de servidor
 * debe hablar con Firestore por el Admin SDK (`firebase-admin`), que respeta las
 * reglas de otra manera y no depende de una sesión de navegador.
 *
 * NO se prohíbe `firebase-admin` — ese es justamente el correcto en el servidor.
 */

const RAIZ = resolve(__dirname, '../..')
const SRC = join(RAIZ, 'src')
const CLIENTE = join(SRC, 'lib/firebase.ts')

/** Resuelve un especificador de import a un archivo real, o null si es externo. */
function resolverImport(especificador: string, desde: string): string | null {
  let base: string
  if (especificador.startsWith('@/')) base = join(SRC, especificador.slice(2))
  else if (especificador.startsWith('.')) base = normalize(join(dirname(desde), especificador))
  else return null   // paquete de node_modules

  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext
  }
  return null
}

const RE_IMPORT = /^[ \t]*import\s+(?:type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm
/** `import type { X } from 'y'` no existe en runtime: no arrastra nada. */
const RE_SOLO_TIPO = /^[ \t]*import\s+type\s/

/** Devuelve la cadena de archivos hasta el SDK del cliente, o null. */
function cadenaHastaCliente(archivo: string, visto = new Set<string>(), ruta: string[] = []): string[] | null {
  if (visto.has(archivo)) return null
  visto.add(archivo)
  if (archivo === CLIENTE) return [...ruta, archivo]

  let texto: string
  try { texto = readFileSync(archivo, 'utf8') } catch { return null }

  for (const linea of texto.split('\n')) {
    if (RE_SOLO_TIPO.test(linea)) continue
    RE_IMPORT.lastIndex = 0
    const m = RE_IMPORT.exec(linea)
    if (!m) continue
    const destino = resolverImport(m[1], archivo)
    if (!destino) continue
    const r = cadenaHastaCliente(destino, visto, [...ruta, archivo])
    if (r) return r
  }
  return null
}

function rutasDeApi(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) rutasDeApi(p, acc)
    else if (e === 'route.ts' || e === 'route.tsx') acc.push(p)
  }
  return acc
}

const rel = (p: string) => p.replace(RAIZ + '/', '')

describe('REG-059 · el servidor no arrastra el SDK de Firebase del navegador', () => {
  const rutas = rutasDeApi(join(SRC, 'app/api'))

  it('hay rutas de API que auditar (el escáner no está mirando al vacío)', () => {
    // Sin esto, un cambio de estructura convertiría el guardián en un no-op verde.
    expect(rutas.length).toBeGreaterThan(50)
  })

  it('el escáner SÍ detecta la cadena cuando existe (control positivo)', () => {
    // Control positivo sobre un archivo REAL de cliente: si el detector estuviera
    // roto, todo saldría "limpio" y el guardián no protegería nada.
    const cadena = cadenaHastaCliente(join(SRC, 'lib/time-blocks.ts'))
    expect(cadena, 'time-blocks.ts SÍ importa el SDK del cliente a propósito').not.toBeNull()
    expect(cadena!.map(rel)).toContain('src/lib/firebase.ts')
  })

  it('ninguna ruta de API alcanza src/lib/firebase.ts', () => {
    const infractoras = rutas
      .map(r => ({ ruta: r, cadena: cadenaHastaCliente(r) }))
      .filter(x => x.cadena !== null)
      .map(x => x.cadena!.map(rel).join('\n      → '))

    expect(
      infractoras,
      'Una ruta de servidor importa el SDK del NAVEGADOR. Se inicializa al importarse ' +
      'y rompe `next build` sin variables NEXT_PUBLIC_FIREBASE_*. Usa `firebase-admin` ' +
      'para datos, o extrae la lógica pura a un módulo -core (ver time-blocks-core.ts).\n\n' +
      infractoras.join('\n\n'),
    ).toEqual([])
  })
})
