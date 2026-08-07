/**
 * EL GRAFO DE DEPENDENCIAS, MEDIDO — no dibujado.
 *
 * ── POR QUÉ MEDIRLO Y NO DIBUJARLO ───────────────────────────────────────────
 *
 * Un diagrama de arquitectura describe **lo que alguien quiso**. El grafo de
 * imports describe **lo que hay**. Cuando los dos se separan, el que manda es el
 * segundo, y el diagrama se vuelve un documento que tranquiliza sin proteger.
 *
 * Este módulo lee los `import` reales y responde tres preguntas que sí se pueden
 * contestar con un número:
 *
 *   1. ¿Alguna capa depende de una que está por encima de ella?
 *   2. ¿Hay ciclos?
 *   3. ¿`types/` sigue siendo una hoja?
 *
 * ── LA REGLA DE DIRECCIÓN ────────────────────────────────────────────────────
 *
 *   app / components  ──▶  hooks  ──▶  lib  ──▶  types
 *
 * Las flechas van en un solo sentido. Un `lib/` que importa un componente ata la
 * lógica clínica a una pantalla: deja de poder probarse sin montar la interfaz y,
 * lo que importa más, deja de poder reusarse desde una ruta de API — que es por
 * donde entran los motores cuando se automatiza algo.
 *
 * ── LOS `import type` NO CUENTAN ─────────────────────────────────────────────
 *
 * TypeScript los borra al compilar: no hay dependencia en tiempo de ejecución.
 * Contarlos daría violaciones que no existen — y es el mismo detalle que ya hizo
 * pasar en verde a cuatro módulos huérfanos durante meses (v1019). Aquí se
 * excluyen a propósito.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Las capas, de arriba abajo. Una capa sólo puede importar de las de abajo. */
export const CAPAS = ['app', 'components', 'contexts', 'hooks', 'lib', 'types'] as const
export type Capa = (typeof CAPAS)[number]

/** Qué puede importar cada capa. `app` y `components` son el borde: nadie les entra. */
export const PERMITIDO: Record<Capa, readonly Capa[]> = {
  app: ['components', 'contexts', 'hooks', 'lib', 'types'],
  components: ['contexts', 'hooks', 'lib', 'types'],
  contexts: ['hooks', 'lib', 'types'],
  hooks: ['lib', 'types'],
  lib: ['types'],
  types: [],
}

const ESPECIFICADOR = /(?:from|import)\s+['"](@\/[^'"]+)['"]/g
const IMPORT_DE_TIPO = /^\s*(?:export|import)\s+type\s/

export interface Arista {
  desde: string
  hacia: string
  capaDesde: Capa
  capaHacia: Capa
}

function capaDe(ruta: string): Capa | null {
  for (const c of CAPAS) if (ruta.startsWith(`src/${c}/`)) return c
  return null
}

function resolver(espec: string): string | null {
  const base = `src/${espec.slice(2)}`
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c)) return c
  }
  return null
}

function fuentes(raiz = 'src'): string[] {
  const out: string[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir)) {
      // Los tests no son arquitectura: importan de todas partes por diseño.
      if (e === '__tests__' || e === 'node_modules') continue
      const p = join(dir, e)
      if (statSync(p).isDirectory()) anda(p)
      else if (/\.tsx?$/.test(e)) out.push(p)
    }
  }
  anda(raiz)
  return out
}

/** Todas las aristas entre capas distintas, sin los `import type`. */
export function aristas(): Arista[] {
  const out: Arista[] = []
  for (const f of fuentes()) {
    const capaDesde = capaDe(f)
    if (!capaDesde) continue
    for (const linea of readFileSync(f, 'utf8').split('\n')) {
      if (IMPORT_DE_TIPO.test(linea)) continue
      ESPECIFICADOR.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ESPECIFICADOR.exec(linea))) {
        const hacia = resolver(m[1])
        if (!hacia || hacia === f) continue
        const capaHacia = capaDe(hacia)
        if (!capaHacia || capaHacia === capaDesde) continue
        out.push({ desde: f, hacia, capaDesde, capaHacia })
      }
    }
  }
  return out
}

/**
 * Aristas que van hacia arriba: la lógica atada a la pantalla.
 *
 * Se descuenta la grieta declarada de `types/` (abajo). No es un indulto: la
 * lista está escrita archivo por archivo y su prueba exige que **encoja, nunca
 * crezca**. Una excepción con nombre y motivo es una deuda visible; una regla
 * relajada es una deuda que desaparece de la vista.
 */
export function violacionesDeDireccion(): Arista[] {
  return aristas().filter(
    a => !PERMITIDO[a.capaDesde].includes(a.capaHacia) && !(a.desde in TYPES_QUE_NO_SON_HOJA),
  )
}

/**
 * Ciclos de importación en tiempo de ejecución.
 *
 * Un ciclo no siempre rompe —el empaquetador suele salvarlo— pero cuando rompe,
 * lo hace con un `undefined` en un módulo que se lee perfecto. En un motor
 * clínico eso es una cifra que no sale, no un error que salte.
 */
export function ciclos(): string[][] {
  const grafo = new Map<string, Set<string>>()
  for (const f of fuentes()) grafo.set(f, new Set())
  for (const a of aristasTodas()) grafo.get(a.desde)?.add(a.hacia)

  const color = new Map<string, 0 | 1 | 2>()
  const encontrados: string[][] = []
  const pila: string[] = []

  const anda = (n: string) => {
    color.set(n, 1)
    pila.push(n)
    for (const m of grafo.get(n) ?? []) {
      if (color.get(m) === 1) encontrados.push([...pila.slice(pila.indexOf(m)), m])
      else if ((color.get(m) ?? 0) === 0) anda(m)
    }
    pila.pop()
    color.set(n, 2)
  }
  for (const n of grafo.keys()) if ((color.get(n) ?? 0) === 0) anda(n)
  return encontrados
}

/** Como `aristas()` pero incluye las de dentro de una misma capa: un ciclo no respeta capas. */
function aristasTodas(): Arista[] {
  const out: Arista[] = []
  for (const f of fuentes()) {
    const capaDesde = capaDe(f)
    for (const linea of readFileSync(f, 'utf8').split('\n')) {
      if (IMPORT_DE_TIPO.test(linea)) continue
      ESPECIFICADOR.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ESPECIFICADOR.exec(linea))) {
        const hacia = resolver(m[1])
        if (!hacia || hacia === f) continue
        out.push({
          desde: f,
          hacia,
          capaDesde: (capaDesde ?? 'lib') as Capa,
          capaHacia: (capaDe(hacia) ?? 'lib') as Capa,
        })
      }
    }
  }
  return out
}

/**
 * LA GRIETA CONOCIDA: `types/` no es una hoja del todo.
 *
 * Eran dos los archivos de `src/types/` con código en tiempo de ejecución. Uno se
 * cerró en v1087 —`hospital.ts` re-exportaba un valor y su único consumidor ahora
 * lo importa de la fuente— y queda ÉSTE, que no se cierra con un import: hay que
 * mover el archivo de capa.
 *
 * Hoy no hay ciclo —está comprobado— pero es exactamente por donde aparecería el
 * primero: `lib/X → types/Y → lib/Z`. Se declara uno a uno para que la lista
 * pueda encoger y no crecer.
 */
export const TYPES_QUE_NO_SON_HOJA: Readonly<Record<string, string>> = {
  'src/types/clinical-quantity.ts':
    'Usa `num` de lib/uci para normalizar la coma decimal mexicana — y hace bien ' +
    'en usarla: es la fuente única del repo. Lo que está mal es DÓNDE VIVE. Es un ' +
    'módulo de dominio completo (dimensiones, factores, constructores) alojado en ' +
    '`types/` por herencia. Moverlo a `lib/` toca a todos sus consumidores y es un ' +
    'cambio que se decide, no que se cuela en una madrugada.',
}

export const POR_QUE_LA_DIRECCION_IMPORTA =
  'Un lib/ que importa un componente ata la lógica clínica a una pantalla: deja ' +
  'de poder probarse sin montar la interfaz y deja de poder reusarse desde una ' +
  'ruta de API, que es por donde entran los motores cuando se automatiza algo.'
