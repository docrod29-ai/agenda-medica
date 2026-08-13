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

const ESPECIFICADOR = /(?:from|import)\s+['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g
const IMPORT_DE_TIPO = /^\s*(?:export|import)\s+type\s/

/**
 * LOS DOS `import()` QUE SÍ CARGAN CÓDIGO — y el que no.
 *
 * El lector original sólo veía `import … from '…'`. Se le escapaban las dos
 * formas dinámicas reales de este repositorio:
 *
 *   await import('@/lib/whatsapp-send')                    ← carga perezosa
 *   dynamic(() => import('@/components/PanelPediatria'))   ← componente de Next
 *
 * **Con los paneles clínicos cargados así**, un lector ciego a esto los declara
 * fuera del camino cuando están en el centro. La primera medición dio 87 módulos
 * inalcanzables; la cifra estaba inflada por esto y no se publicó.
 *
 * Lo que NO cuenta: `x as unknown as import('@/types').ClinicConfig`. Ahí
 * `import()` está en posición de TIPO y TypeScript lo borra. Por eso se exige
 * `await` o `=>` delante: los dos marcan una carga de verdad.
 *
 * ── LA QUINTA CEGUERA: `p ??= import('…')` ───────────────────────────────────
 *
 * El memoizado perezoso canónico —`pipelinePromise ??= import('@/lib/asr/pipeline')`—
 * carga código de verdad, pero no lleva ni `await` ni `=>` pegados al `import`.
 * Cuando el dictado se difirió así (V15-PERF, 4ª rebanada), el lector declaró
 * fuera del camino al pipeline de voz ENTERO estando en el centro del paso 1.
 * Misma familia que las cuatro anteriores: el lector veía texto donde tenía que
 * ver código.
 *
 * Se admiten sólo las asignaciones LÓGICAS (`??=`, `||=`, `&&=`): ésas no
 * existen en posición de tipo. El `=` a secas NO se admite — `type X =
 * import('@/types').Y` es un alias de tipo y TypeScript lo borra; contarlo
 * repetiría la ceguera inversa que infló la primera medición a 87.
 */
const DINAMICO_REAL = [
  /await\s+import\s*\(\s*['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g,
  /=>\s*import\s*\(\s*['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g,
  /(?:\?\?|\|\||&&)=\s*import\s*\(\s*['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g,
]

/**
 * Quita los comentarios antes de leer.
 *
 * Sin esto el lector cuenta como dependencia viva **un import escrito dentro de
 * un comentario** — un ejemplo en la documentación, o una línea comentada al
 * depurar. Lo cazó este mismo archivo: el bloque que explica
 * `dynamic(() => import('@/components/…'))` hacía que `lib/` pareciera depender
 * de un componente, o sea una dependencia invertida que no existe.
 *
 * Es la cuarta ceguera del mismo lector en una noche. Todas del mismo tipo:
 * **el lector veía texto donde tenía que ver código.**
 *
 * ── EL ORDEN NO ES INDIFERENTE, Y CASI ME CUESTA UN MÓDULO CLÍNICO ───────────
 *
 * Primero se quitan las líneas `//`, DESPUÉS los bloques. Al revés no.
 *
 * `ValoracionInmuno.tsx` lleva en su cabecera un comentario de línea que dice
 * «la lógica vive en src/lib/inmuno/**\***». Esa barra-asterisco **abre un bloque
 * falso**, y el limpiador se comía todo hasta el siguiente cierre — incluidos
 * los seis imports del motor de inmunocomprometido. El módulo aparecía fuera del
 * camino estando montado en la consulta.
 *
 * Un instrumento que declara desconectado un motor clínico que sí corre es peor
 * que no tenerlo: manda a buscar donde no hay nada, y de paso desacredita las
 * veces que acierta.
 */
function sinComentarios(src: string): string {
  return src
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Los especificadores de una línea, estáticos y dinámicos. */
function especificadoresDe(linea: string): string[] {
  const out: string[] = []
  ESPECIFICADOR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ESPECIFICADOR.exec(linea))) out.push(m[1])
  for (const re of DINAMICO_REAL) {
    re.lastIndex = 0
    let d: RegExpExecArray | null
    while ((d = re.exec(linea))) out.push(d[1])
  }
  return out
}

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

/**
 * `@/lib/x` **o** `./x` → la ruta real.
 *
 * Las relativas hacían falta y faltaban. Dentro de una carpeta los módulos se
 * importan entre sí con `./`, así que un lector que sólo sigue `@/` declara
 * inalcanzable **el interior de cada motor**: el de antibiograma entero, 19
 * archivos, aparecía fuera del camino sólo porque su `index.ts` reexporta con
 * rutas relativas.
 *
 * Es la tercera ceguera del mismo lector en una noche —`import type`,
 * `import()` dinámico, rutas relativas— y las tres daban el mismo resultado:
 * **más módulos «desconectados» de los que hay**. Un instrumento que exagera el
 * problema se desactiva igual de rápido que uno que lo esconde.
 */
function resolver(espec: string, desde?: string): string | null {
  const base = espec.startsWith('@/')
    ? `src/${espec.slice(2)}`
    : normalizar(`${(desde ?? '').split('/').slice(0, -1).join('/')}/${espec}`)
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c)) return c
  }
  return null
}

/** Resuelve `a/b/../c` sin tocar el disco. */
function normalizar(ruta: string): string {
  const out: string[] = []
  for (const parte of ruta.split('/')) {
    if (parte === '' || parte === '.') continue
    if (parte === '..') out.pop()
    else out.push(parte)
  }
  return out.join('/')
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
    for (const linea of sinComentarios(readFileSync(f, 'utf8')).split('\n')) {
      if (IMPORT_DE_TIPO.test(linea)) continue
      for (const espec of especificadoresDe(linea)) {
        const hacia = resolver(espec, f)
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
    for (const linea of sinComentarios(readFileSync(f, 'utf8')).split('\n')) {
      if (IMPORT_DE_TIPO.test(linea)) continue
      for (const espec of especificadoresDe(linea)) {
        const hacia = resolver(espec, f)
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

/**
 * ¿A qué se llega, de verdad, desde una pantalla o una ruta?
 *
 * ── POR QUÉ ESTA FUNCIÓN ES LA MÁS ÚTIL DEL ARCHIVO ──────────────────────────
 *
 * La familia de defecto más grande del ledger —9 de 55— es «escrito, probado y
 * sin conectar»: el módulo existe, sus pruebas pasan, y **no corre en el camino
 * que el médico recorre**.
 *
 * `modulos-sin-conectar.test.ts` caza el caso extremo: el módulo que NADIE
 * importa. Pero un módulo puede estar importado por otro módulo que tampoco
 * corre — una isla de dos. Esto responde la pregunta de verdad: partiendo de
 * `src/app/`, siguiendo imports, **¿se llega hasta aquí?**
 */
export function alcanzableDesdeLaApp(): Set<string> {
  const salidas = new Map<string, string[]>()
  for (const a of aristasTodasPub()) {
    const l = salidas.get(a.desde)
    if (l) l.push(a.hacia)
    else salidas.set(a.desde, [a.hacia])
  }

  const visto = new Set<string>()
  const pila = fuentes().filter(f => f.startsWith('src/app/'))
  for (const f of pila) visto.add(f)

  while (pila.length) {
    const n = pila.pop()!
    for (const m of salidas.get(n) ?? []) {
      if (visto.has(m)) continue
      visto.add(m)
      pila.push(m)
    }
  }
  return visto
}

/** `aristasTodas` es privada; esto la expone sin cambiar su contrato. */
function aristasTodasPub(): Arista[] {
  return aristasTodas()
}

export const POR_QUE_LA_ALCANZABILIDAD =
  'Un módulo puede estar importado por otro que tampoco corre — una isla de dos. ' +
  'Lo único que contesta la pregunta real es partir de src/app/ y seguir los ' +
  'imports hasta donde lleguen.'
