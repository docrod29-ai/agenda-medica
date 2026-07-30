/**
 * ANÁLISIS ESTÁTICO DE LAS RUTAS DE API — extrae del TEXTO de un `route.ts` qué
 * guardián se llama, con qué literales y dentro de qué handler HTTP
 * (unidad Nexus OS E0-07, lote de cierre tras la verificación adversarial).
 *
 * POR QUÉ EXISTE. El guardián de E0-07 comprobaba que la ruta LLAMARA a
 * `verificarCapacidad(`, nunca CON QUÉ capacidad. La verificación adversarial lo
 * rompió con sabotajes que dejaban la suite en verde: cambiar `'administrar'` por
 * `'auditoria.registrar'` en `stripe/portal` abría el portal de Stripe a los 8
 * roles, y `authz-rutas-declaradas.test.ts` seguía pasando. Es decir: el registro de
 * rutas era correcto como dato y FALSO como garantía. Para atarlo hace falta leer el
 * ARGUMENTO real de la llamada, y hacerlo POR MÉTODO (un `POST` ya migrado podía
 * volver a `verificarMiembro` sin que nada se moviera, porque el pendiente vivía a
 * nivel de ruta).
 *
 * POR QUÉ EN UN MÓDULO PROPIO Y NO DENTRO DEL TEST. Un analizador escondido en el
 * test no se puede probar con fixtures, y un analizador roto que no encuentra nada
 * deja pasar TODO en verde — exactamente el modo de falla que hundió la primera
 * versión de esta unidad. Aquí se prueba con fuentes sintéticas
 * (`src/__tests__/authz-analisis-estatico.test.ts`).
 *
 * MÓDULO PURO: recibe TEXTO y devuelve datos. Sin `fs`, sin `next/server`, sin
 * Firebase. No lanza: lo que no se puede determinar se reporta como
 * `argumentoNoLiteral` para que el test decida.
 */
import type { Metodo } from './registro-rutas'

/** Los verbos HTTP que Next.js exporta desde un `route.ts`. */
const METODOS_HTTP = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

/** Guardianes de autorización del repo. Cualquier llamada a uno de estos se ve. */
export const GUARDIAS = [
  'verificarUsuario',
  'verificarMiembro',
  'verificarMedico',
  'verificarCapacidad',
  'verificarModuloIA',
  'verificarModuloYCapacidad',
  'verificarSuperadmin',
  'verificarTokenPaciente',
  'exigeCapacidad',
] as const
export type Guardia = (typeof GUARDIAS)[number]

/**
 * Posiciones de argumento (0-indexadas) donde cada guardián recibe VOCABULARIO de
 * autorización: el nombre del módulo contratado o el de la capacidad exigida.
 *
 * Esta tabla es la que hace decidible `argumentoNoLiteral` sin que el analizador
 * tenga que conocer el catálogo de capacidades (seguiría siendo puro, pero además
 * circular): el guardián que NO recibe vocabulario —`verificarMiembro(req, cid)`—
 * no puede mentir sobre qué capacidad exige, porque no exige ninguna. El que SÍ lo
 * recibe tiene que traerlo como literal de cadena o la comprobación del test sería
 * inauditable.
 */
const POSICIONES_VOCABULARIO: Readonly<Record<Guardia, readonly number[]>> = {
  verificarUsuario: [],
  verificarMiembro: [],
  verificarMedico: [],
  /** `verificarCapacidad(req, clinicId, capacidad)` */
  verificarCapacidad: [2],
  /** `verificarModuloIA(req, modulo)` */
  verificarModuloIA: [1],
  /** `verificarModuloYCapacidad(req, modulo, capacidad)` */
  verificarModuloYCapacidad: [1, 2],
  verificarSuperadmin: [],
  verificarTokenPaciente: [],
  /** `exigeCapacidad(acceso, capacidad)` */
  exigeCapacidad: [1],
}

export interface LlamadaGuardia {
  guardia: Guardia
  /** Offset en el texto YA limpio de comentarios (con esto se atribuye al handler). */
  posicion: number
  /** Literales de cadena que recibe la llamada, EN ORDEN (incluidos los vacíos). */
  literales: readonly string[]
  /**
   * `true` si alguna posición de vocabulario de ESE guardián no llega como literal
   * de cadena — es decir, si el guardián estático NO puede saber qué capacidad o
   * módulo se exige. No es un detalle de estilo: sin literal, la comprobación
   * «lo declarado == lo ejecutado» sería inauditable, así que el test la trata como
   * fallo y obliga a escribir la capacidad a mano. La única excepción legítima del
   * repo es `exigeCapacidad(acc, capacidad)` en el gateway `porAccion`, donde la
   * capacidad DEBE ser dinámica y la garantía es otra (el mapa vive en el registro).
   */
  argumentoNoLiteral: boolean
}

export interface AnalisisRuta {
  /** Todas las llamadas del archivo, en orden de aparición. */
  llamadas: readonly LlamadaGuardia[]
  /** Métodos HTTP que el archivo exporta, en orden de aparición. */
  metodosExportados: readonly Metodo[]
  /** Llamadas atribuidas al cuerpo de cada handler exportado. */
  porMetodo: Readonly<Partial<Record<Metodo, readonly LlamadaGuardia[]>>>
  /**
   * Llamadas que caen FUERA de todo handler exportado (helper compartido del
   * archivo). Hoy está vacío en las 74 rutas y el test lo congela: si alguien mueve
   * el guardián a un helper, la atribución por método deja de ser fiable y hay que
   * decidirlo a mano, no descubrirlo con un falso verde.
   */
  compartidas: readonly LlamadaGuardia[]
}

/**
 * Quita comentarios de bloque y de línea RESPETANDO cadenas.
 *
 * Es obligatorio: los comentarios de este repo CITAN a propósito el nombre del
 * guardián que se cambió («va con verificarMEDICO, no verificarMiembro»), y sin
 * limpiarlos todo son falsos positivos. Y se hace con un recorrido de caracteres en
 * vez de con un `replace` de regex porque una URL dentro de una cadena
 * (`'https://…'`) contiene `//` y el regex ingenuo se comería el resto de la línea.
 */
export function limpiarComentarios(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const sig = src[i + 1]
    // Comentario de bloque: se sustituye por un espacio para no pegar dos tokens.
    if (c === '/' && sig === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      out += ' '
      continue
    }
    // Comentario de línea: se descarta hasta el salto (el salto se conserva).
    if (c === '/' && sig === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    // Cadena: se copia verbatim, incluidas las secuencias de escape.
    if (c === "'" || c === '"' || c === '`') {
      out += c
      i++
      while (i < src.length) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '')
          i += 2
          continue
        }
        out += src[i]
        const cierra = src[i] === c
        i++
        if (cierra) break
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/** ¿El carácter puede formar parte de un identificador de JS? */
function esIdent(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_$]/.test(ch)
}

/**
 * Desde el `(` de una llamada, devuelve el texto interior y el offset del `)` que la
 * cierra, contando paréntesis/corchetes y SALTANDO el interior de las cadenas (hay
 * llamadas reales con `''` en medio y con `)` dentro de una cadena).
 */
function argumentosCrudos(src: string, iAbre: number): { interior: string; fin: number } {
  let profundidad = 0
  let i = iAbre
  const inicio = iAbre + 1
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i++
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === c) break
        i++
      }
      i++
      continue
    }
    if (c === '(' || c === '[' || c === '{') profundidad++
    else if (c === ')' || c === ']' || c === '}') {
      profundidad--
      if (profundidad === 0) return { interior: src.slice(inicio, i), fin: i }
    }
    i++
  }
  // Paréntesis sin cerrar (archivo truncado o roto): se devuelve lo que hay.
  return { interior: src.slice(inicio), fin: src.length }
}

/** Parte el interior de una llamada por las comas de NIVEL SUPERIOR. */
function partirArgumentos(interior: string): string[] {
  const args: string[] = []
  let profundidad = 0
  let actual = ''
  let i = 0
  while (i < interior.length) {
    const c = interior[i]
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      actual += c
      i++
      while (i < interior.length) {
        if (interior[i] === '\\') { actual += interior[i] + (interior[i + 1] ?? ''); i += 2; continue }
        actual += interior[i]
        const cierra = interior[i] === q
        i++
        if (cierra) break
      }
      continue
    }
    if (c === '(' || c === '[' || c === '{') profundidad++
    if (c === ')' || c === ']' || c === '}') profundidad--
    if (c === ',' && profundidad === 0) {
      args.push(actual.trim())
      actual = ''
      i++
      continue
    }
    actual += c
    i++
  }
  if (actual.trim().length > 0) args.push(actual.trim())
  return args
}

/** Si el argumento es EXACTAMENTE un literal de cadena simple, su valor; si no, null. */
function literalDe(arg: string): string | null {
  const m = /^'([^'\\]*)'$|^"([^"\\]*)"$/.exec(arg)
  if (!m) return null
  return m[1] ?? m[2] ?? ''
}

/** Todos los literales de cadena que aparecen en el interior de la llamada, en orden. */
function literalesEnOrden(args: readonly string[]): string[] {
  const out: string[] = []
  for (const a of args) {
    const directo = literalDe(a)
    if (directo !== null) { out.push(directo); continue }
    // Literales embebidos en una expresión (`body.clinicId || ''`): también cuentan,
    // porque el test necesita ver TODO lo que la llamada recibe para no elegir a ciegas.
    for (const m of a.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) out.push(m[1] ?? m[2] ?? '')
  }
  return out
}

/**
 * Analiza el texto de un `route.ts`. Idempotente y sin efectos: se le puede pasar la
 * fuente cruda (limpia los comentarios ella misma).
 */
export function analizarRuta(src: string): AnalisisRuta {
  const limpio = limpiarComentarios(src)

  // ── llamadas a guardián ────────────────────────────────────────────────────
  const llamadas: LlamadaGuardia[] = []
  const reGuardia = new RegExp(`(${GUARDIAS.join('|')})\\s*\\(`, 'g')
  for (const m of limpio.matchAll(reGuardia)) {
    const inicio = m.index ?? 0
    // Identificador COMPLETO: ni subcadena de otro nombre ni acceso a propiedad.
    const previo = limpio[inicio - 1]
    if (esIdent(previo) || previo === '.') continue
    const guardia = m[1] as Guardia
    const iAbre = inicio + m[0].length - 1
    const { interior } = argumentosCrudos(limpio, iAbre)
    const args = partirArgumentos(interior)
    const vocab = POSICIONES_VOCABULARIO[guardia]
    const argumentoNoLiteral = vocab.some(p => literalDe(args[p] ?? '') === null)
    llamadas.push({
      guardia,
      posicion: inicio,
      literales: literalesEnOrden(args),
      argumentoNoLiteral,
    })
  }

  // ── handlers exportados ────────────────────────────────────────────────────
  const cortes: { metodo: Metodo; posicion: number }[] = []
  const reExport = new RegExp(
    `export\\s+async\\s+function\\s+(${METODOS_HTTP.join('|')})\\s*\\(`, 'g',
  )
  for (const m of limpio.matchAll(reExport)) {
    cortes.push({ metodo: m[1] as Metodo, posicion: m.index ?? 0 })
  }

  // Una llamada pertenece al ÚLTIMO handler exportado que la precede; las que van
  // antes del primero viven en un helper compartido del archivo.
  const porMetodo: Partial<Record<Metodo, LlamadaGuardia[]>> = {}
  const compartidas: LlamadaGuardia[] = []
  for (const ll of llamadas) {
    let dueno: Metodo | null = null
    for (const c of cortes) {
      if (c.posicion < ll.posicion) dueno = c.metodo
      else break
    }
    if (dueno === null) { compartidas.push(ll); continue }
    ;(porMetodo[dueno] ??= []).push(ll)
  }

  return {
    llamadas,
    metodosExportados: cortes.map(c => c.metodo),
    porMetodo,
    compartidas,
  }
}
