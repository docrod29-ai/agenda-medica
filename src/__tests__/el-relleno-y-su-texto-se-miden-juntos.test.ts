/**
 * EL RELLENO Y SU TEXTO SE MIDEN JUNTOS — V9 · DESIGN-SYSTEM-001 · REG-289.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Catorce rellenos azules con su texto encima **reprobaban WCAG AA**, y once de
 * ellos son botones primarios:
 *
 *   · `.prox-hero-cta` en `globals.css` — «Iniciar consulta», la acción
 *     principal del tablero, la que abre el trabajo del día.
 *   · «Crear mi consultorio» (`/setup`) — el botón que cierra el alta.
 *   · «Agendar» (`/asistente`), las pestañas de UCI, de dosificación, de
 *     antimicrobianos, de legal y de reactivación.
 *   · Y los tres CTA de precios (portada, `layout` del tablero y
 *     configuración), por el defecto espejo: texto NEGRO sobre el mismo azul.
 *
 * Medido con la fórmula de luminancia relativa de WCAG 2.1, sobre los valores
 * que este mismo repositorio declara en `globals.css`:
 *
 *     blanco sobre --nexus  oscuro (#6E84FE) = 3,28 : 1   ← reprueba (mín. 4,5)
 *     negro  sobre --nexus  claro  (#2845EA) = 3,13 : 1   ← reprueba
 *     blanco sobre --nexus-solido           = 5,13 (oscuro) · 6,71 (claro)
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Al empezar `DESIGN-SYSTEM-001` (V9) contando dónde se usa el azul de marca.
 * Los catorce sitios **ya estaban cubiertos por un guardián** —el de REG-233,
 * `lo-que-el-navegador-vio.test.ts`— que llevaba dos versiones y seguía en
 * verde.
 *
 * ── LA CAUSA RAÍZ, QUE NO ES EL COLOR ───────────────────────────────────────
 *
 * El guardián de REG-233 comprueba **una línea a la vez**. Y un objeto de
 * estilo real reparte sus propiedades en varias líneas:
 *
 *     style={{
 *       background: canContinue ? 'var(--teal)' : 'var(--s3)',   ← línea A
 *       color: '#fff',                                            ← línea B
 *     }}
 *
 * Ninguna línea, por sí sola, contiene el defecto. El defecto es la **relación
 * entre dos líneas**, y un guardián que lee renglones no puede verla. Además
 * sólo leía `.tsx`, así que `globals.css` —el archivo donde vive el sistema de
 * diseño— nunca se miró.
 *
 * ── LA FAMILIA, POR TERCERA VEZ ─────────────────────────────────────────────
 *
 * Es la misma lección que ya está escrita en la cabecera de REG-233: «el
 * guardián era tan estrecho como el barrido que lo escribió». Va tres veces:
 *
 *   1. v1104 — buscaba la cadena literal `background: 'var(--nexus)'`.
 *   2. REG-233 — pasó a patrón, pero **una línea** y **sólo `.tsx`**.
 *   3. REG-289 — el ámbito correcto no es la línea ni el archivo: es el
 *      **objeto de estilo** (o la regla CSS), que es la unidad que el navegador
 *      compone.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * No se compara contra una lista de cadenas prohibidas: **se calcula el
 * cociente de contraste**, en los dos temas, leyendo los valores de los tokens
 * del propio `globals.css`. Si mañana alguien aclara `--nexus-solido`, esta
 * prueba se entera sola — no hay ninguna cifra copiada a mano que se pueda
 * desfasar (REG-241).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **Sólo la familia azul de marca** (`--nexus`, `--teal`, `--nexus-solido` y
 *   sus literales). El resto de la paleta —ámbar, rojo, verde, morado— no se
 *   vigila aquí: declarado a propósito, porque un guardián que intenta resolver
 *   toda la cascada acaba dando falsos positivos y se silencia (REG-245).
 * - **Sólo pares que están en el MISMO ámbito.** Un texto que hereda su color
 *   de un ancestro y un fondo puesto en el hijo siguen invisibles para esto.
 *   Eso sólo lo ve un navegador, y por eso `A11Y-GATE-001` sigue abierto.
 * - **No mide tamaño de fuente.** WCAG permite 3:1 en texto grande (≥18,66 px
 *   en negrita o ≥24 px). Aquí se exige 4,5 a todo: ninguno de los catorce era
 *   texto grande, y aflojar el umbral por tamaño exigiría resolver el
 *   `fontSize` efectivo, que es justo lo que no se puede hacer leyendo código.
 *   El coste declarado es que un titular legítimamente grande daría falso
 *   positivo; no hay ninguno hoy.
 * - **No aprueba ninguna pantalla.** Sigue vigente la regla de V9 §4: la
 *   interfaz no se aprueba leyendo el código.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const RAIZ = process.cwd()
const GLOBALS = join(RAIZ, 'src', 'app', 'globals.css')
const css = readFileSync(GLOBALS, 'utf8')

/** Mínimo de WCAG 2.1/2.2 nivel AA para texto normal. */
const AA = 4.5

// ── Contraste ───────────────────────────────────────────────────────────────

function luminancia(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const canal = [0, 2, 4].map((i) => {
    const v = parseInt(full.substr(i, 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * canal[0] + 0.7152 * canal[1] + 0.0722 * canal[2]
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// ── Los tokens salen de globals.css, no de aquí ─────────────────────────────

/**
 * Lee `--nombre: #rrggbb` dentro del bloque de un selector.
 *
 * Se lee del archivo a propósito: una cifra copiada en la prueba es una cifra
 * que se desfasa. Si el bloque o el token desaparecen, `tokenDe` devuelve
 * `null` y la prueba de coherencia de abajo falla — no se queda callada.
 */
function tokenDe(selector: string, nombre: string): string | null {
  const i = css.indexOf(selector)
  if (i < 0) return null
  const bloque = css.slice(i, css.indexOf('\n}', i))
  const m = bloque.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{3,8})`))
  return m ? m[1] : null
}

type Tema = 'oscuro' | 'claro'
const TEMAS: Tema[] = ['oscuro', 'claro']
const SEL: Record<Tema, string> = { oscuro: ':root {', claro: ':root[data-theme="light"] {' }

/** Valor concreto de un token de la familia azul, por tema. */
function azul(tema: Tema, nombre: 'nexus' | 'nexus-solido' | 'nexus-hover'): string {
  const v = tokenDe(SEL[tema], nombre)
  if (!v) throw new Error(`--${nombre} no está declarado en el tema ${tema} de globals.css`)
  return v
}

/** Valor concreto de un color de texto, por tema. `null` = no se sabe resolver. */
function textoResoluble(valor: string, tema: Tema): string | null {
  const v = valor.trim().toLowerCase()
  if (v === '#fff' || v === '#ffffff' || v === 'white') return '#ffffff'
  if (v === '#000' || v === '#000000' || v === 'black') return '#000000'
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/.test(v)) return v
  const tok = v.match(/^var\(\s*--(text|text2|text3)\s*[,)]/)
  if (tok) return tokenDe(SEL[tema], tok[1])
  return null
}

/**
 * Relleno azul de marca, resuelto por tema. `null` si el fondo no es de esta
 * familia (o no se sabe).
 *
 * `--nexus-soft` y `--teal-glow` quedan fuera **a propósito**: son tintes con
 * alfa sobre el lienzo, no rellenos opacos, y el texto que llevan encima es de
 * color de texto normal. Medirlos como si fueran opacos daría una cifra falsa.
 */
function rellenoAzul(valor: string, tema: Tema): string | null {
  const v = valor.trim().toLowerCase()
  if (/var\(\s*--nexus-so(?:lido|ft)/.test(v)) {
    return v.includes('--nexus-solido') ? azul(tema, 'nexus-solido') : null
  }
  if (/var\(\s*--(?:teal-glow|teal-dim|nexus-hover)/.test(v)) {
    return v.includes('nexus-hover') ? azul(tema, 'nexus-hover') : null
  }
  if (/var\(\s*--(?:nexus|teal)\s*[,)]/.test(v)) return azul(tema, 'nexus')
  if (v === '#6e84fe' || v === '#3d5afe' || v === '#2845ea') return v
  return null
}

// ── Los ámbitos: objetos de estilo TSX y reglas CSS ─────────────────────────

interface Ambito { archivo: string; linea: number; texto: string }

function archivos(dir: string, ext: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) {
      if (n !== '__tests__' && n !== 'node_modules') archivos(p, ext, acc)
    } else if (n.endsWith(ext)) acc.push(p)
  }
  return acc
}

/**
 * Objetos `style={{ … }}`, con las llaves balanceadas.
 *
 * Balancear importa: un ternario con objeto dentro (`? {a:1} : {b:2}`) o una
 * plantilla con `${}` cierran antes de tiempo si se busca el primer `}}`. La
 * primera versión de este barrido no balanceaba y devolvía 189 «hallazgos»,
 * casi todos falsos: el ámbito se comía media pantalla.
 */
function ambitosTsx(): Ambito[] {
  const out: Ambito[] = []
  for (const f of archivos(join(RAIZ, 'src'), '.tsx')) {
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(/style=\{\{/g)) {
      let i = m.index! + m[0].length
      let prof = 2
      const ini = i
      while (i < t.length && prof > 0) {
        if (t[i] === '{') prof++
        else if (t[i] === '}') prof--
        i++
      }
      out.push({
        archivo: relative(RAIZ, f),
        linea: t.slice(0, m.index!).split('\n').length,
        texto: t.slice(ini, i - 2),
      })
    }
  }
  return out
}

/** Cuerpos de regla CSS `selector { … }` de todo `src`. */
function ambitosCss(): Ambito[] {
  const out: Ambito[] = []
  for (const f of archivos(join(RAIZ, 'src'), '.css')) {
    const t = readFileSync(f, 'utf8')
    for (const m of t.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push({
        archivo: relative(RAIZ, f),
        linea: t.slice(0, m.index!).split('\n').length,
        texto: m[2],
      })
    }
  }
  return out
}

/**
 * Un valor declarado: su condición (si es un ternario) y sus ramas.
 *
 * ── POR QUÉ HACE FALTA LA CONDICIÓN ─────────────────────────────────────────
 *
 * La primera versión de este barrido cruzaba TODAS las ramas del fondo con
 * TODAS las del texto, y daba 33 hallazgos de los que la mayoría eran falsos:
 *
 *     background: activo ? 'var(--nexus-solido)' : 'transparent',
 *     color:      activo ? '#fff'                : 'var(--text2)',
 *
 * Cruzarlas emparejaba `--text2` con el azul sólido — una combinación que **no
 * existe**, porque las dos ramas cuelgan de la MISMA condición. Cuando las dos
 * condiciones son la misma cadena, las ramas van emparejadas por posición.
 *
 * Es la lección de REG-245 otra vez: un guardián que grita de más se acaba
 * silenciando, y un guardián de accesibilidad silenciado es peor que ninguno.
 */
interface Valor { cond: string | null; ramas: string[] }

/** Índice del primer carácter `c` a profundidad cero, fuera de comillas. */
function aNivelCero(s: string, cs: string[], desde = 0): number {
  let prof = 0
  let comilla: string | null = null
  for (let i = desde; i < s.length; i++) {
    const ch = s[i]
    if (comilla) {
      if (ch === comilla && s[i - 1] !== '\\') comilla = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { comilla = ch; continue }
    if ('([{'.includes(ch)) prof++
    else if (')]}'.includes(ch)) prof--
    else if (prof === 0 && cs.includes(ch)) return i
  }
  return -1
}

const limpia = (s: string) => s.trim().replace(/^['"`]/, '').replace(/['"`]$/, '').trim()

/** Parte `cond ? a : b` (con anidamiento en la rama `b`) en condición y ramas. */
function partir(crudo: string): Valor {
  const q = aNivelCero(crudo, ['?'])
  if (q < 0) return { cond: null, ramas: [limpia(crudo)] }
  const dosPuntos = aNivelCero(crudo, [':'], q + 1)
  if (dosPuntos < 0) return { cond: null, ramas: [limpia(crudo)] }
  const cond = crudo.slice(0, q).trim()
  const siNo = partir(crudo.slice(dosPuntos + 1))
  return { cond, ramas: [limpia(crudo.slice(q + 1, dosPuntos)), ...siNo.ramas] }
}

const RE_FONDO = /(?:^|[;,{\s])(?:background|backgroundColor)\s*:/g
const RE_COLOR = /(?:^|[;,{\s])color\s*:/g

/**
 * Valor de una declaración: desde los dos puntos hasta el separador **de nivel
 * cero**.
 *
 * No vale cortar por coma a secas —un ternario no la lleva, pero `rgba(1,2,3)`
 * sí— ni cortar sólo por `;` y salto de línea, que fue el segundo intento: eso
 * se tragaba la propiedad siguiente. `background: 'none', color: 'var(--text2)'`
 * se leía como un fondo llamado «none, color: var(--text2)», y siete pestañas
 * que sólo tenían el azul en el BORDE salieron como si lo tuvieran de relleno.
 *
 * El separador correcto es la coma de nivel cero, contando paréntesis,
 * corchetes, llaves y comillas — que es justo lo que ya sabe hacer `aNivelCero`.
 */
function declaraciones(ambito: string, prop: RegExp): Valor[] {
  const out: Valor[] = []
  for (const m of ambito.matchAll(prop)) {
    const desde = m.index! + m[0].length
    const resto = ambito.slice(desde)
    const fin = aNivelCero(resto, [',', ';'])
    out.push(partir(fin < 0 ? resto : resto.slice(0, fin)))
  }
  return out
}

/**
 * Empareja las combinaciones (fondo, texto) que **de verdad pueden coincidir**.
 *
 * Misma condición → por posición. Distinta condición (o ninguna) → producto,
 * porque ahí sí son independientes y cualquier combinación puede pintarse.
 */
function combinaciones(fondo: Valor, texto: Valor): [string, string][] {
  if (fondo.cond && texto.cond && fondo.cond === texto.cond) {
    const n = Math.min(fondo.ramas.length, texto.ramas.length)
    return Array.from({ length: n }, (_, i) => [fondo.ramas[i], texto.ramas[i]] as [string, string])
  }
  return fondo.ramas.flatMap((f) => texto.ramas.map((t) => [f, t] as [string, string]))
}

/** Pares (relleno azul, texto) que reprueban AA en algún tema. */
function reprueban(ambitos: Ambito[]): string[] {
  const malos: string[] = []
  for (const a of ambitos) {
    const fondos = declaraciones(a.texto, RE_FONDO)
    const textos = declaraciones(a.texto, RE_COLOR)
    if (!fondos.length || !textos.length) continue
    for (const tema of TEMAS) {
      for (const fondo of fondos) {
        for (const texto of textos) {
          for (const [f, t] of combinaciones(fondo, texto)) {
            const bg = rellenoAzul(f, tema)
            if (!bg) continue
            const fg = textoResoluble(t, tema)
            if (!fg) continue
            const r = contraste(fg, bg)
            if (r < AA) {
              malos.push(`${a.archivo}:${a.linea} · ${tema} · ${fg} sobre ${bg} = ${r.toFixed(2)}`)
            }
          }
        }
      }
    }
  }
  return [...new Set(malos)]
}

// ── Las pruebas ─────────────────────────────────────────────────────────────

describe('el azul de marca y el texto que lleva encima se miden juntos', () => {
  it('los tokens de la familia azul existen en los dos temas', () => {
    /**
     * Si esto falla, todo lo demás dejaría de medir sin dejar de pasar: el
     * barrido no encontraría fondos que resolver y devolvería lista vacía.
     * Es la misma regla del trinquete de lint — un gate que no mide no protege.
     */
    for (const tema of TEMAS) {
      expect(azul(tema, 'nexus'), `--nexus en ${tema}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(azul(tema, 'nexus-solido'), `--nexus-solido en ${tema}`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('el azul SÓLIDO con blanco encima pasa AA en los dos temas', () => {
    /**
     * Es la razón de que `--nexus-solido` exista. Si alguien lo aclarara para
     * que «combine mejor», esta prueba lo caza antes de que se propague a los
     * 68 usos de `.btn-primary`.
     */
    for (const tema of TEMAS) {
      expect(contraste('#ffffff', azul(tema, 'nexus-solido')), tema).toBeGreaterThanOrEqual(AA)
    }
  })

  it('y el azul de TEXTO no vale de relleno — la razón de que sean dos tokens', () => {
    /**
     * Probada al revés: es la afirmación que hace falso el arreglo. Si algún
     * día `--nexus` pasara AA como relleno, los dos tokens sobrarían y esta
     * prueba avisaría de que la separación ya no se sostiene.
     */
    expect(contraste('#ffffff', azul('oscuro', 'nexus'))).toBeLessThan(AA)
    expect(contraste('#000000', azul('claro', 'nexus'))).toBeLessThan(AA)
  })

  it('ningún objeto de estilo de TSX reprueba AA sobre el azul', () => {
    expect(reprueban(ambitosTsx()), 'usar var(--nexus-solido) con #fff').toEqual([])
  })

  it('ninguna regla de CSS reprueba AA sobre el azul — globals.css incluido', () => {
    /**
     * `globals.css` no se miraba. Y ahí vivía `.prox-hero-cta`, «Iniciar
     * consulta»: la acción principal del tablero, a 3,28.
     */
    expect(reprueban(ambitosCss()), 'usar var(--nexus-solido) con #fff').toEqual([])
  })

  it('el barrido mira DENTRO del objeto, no renglón a renglón', () => {
    /**
     * ── PROBADA AL REVÉS ─────────────────────────────────────────────────
     *
     * El defecto real repartía `background` y `color` en líneas distintas del
     * mismo objeto, y por eso el guardián de REG-233 no lo veía. Aquí se le
     * mete ese defecto exacto al detector y se comprueba que **falla**.
     *
     * Sin esta comprobación, un refactor que volviera a leer línea a línea
     * dejaría las cinco pruebas de arriba en verde para siempre: el barrido
     * devolvería lista vacía porque no encuentra nada, no porque no haya nada.
     */
    const defecto: Ambito[] = [{
      archivo: 'sintético', linea: 1,
      texto: `
        padding: '14px 24px', borderRadius: 12,
        background: canContinue ? 'var(--teal)' : 'var(--s3)',
        color: '#fff', fontSize: 15,
      `,
    }]
    const hallado = reprueban(defecto)
    expect(hallado.length, 'el detector tiene que ver el defecto multilínea').toBeGreaterThan(0)
    expect(hallado[0]).toContain('oscuro')

    // Y con el token correcto, el MISMO objeto pasa.
    const arreglado: Ambito[] = [{
      archivo: 'sintético', linea: 1,
      texto: defecto[0].texto.replace('var(--teal)', 'var(--nexus-solido)'),
    }]
    expect(reprueban(arreglado)).toEqual([])
  })

  it('y mira los ámbitos de CSS, no sólo los de TSX', () => {
    /**
     * El espejo de la anterior para el otro tipo de ámbito: era el que faltaba
     * entero. Sin esto, borrar `ambitosCss()` no rompería nada visible.
     */
    const defecto: Ambito[] = [{
      archivo: 'sintético.css', linea: 1,
      texto: 'min-height: 44px; background: var(--nexus); color: #fff; border: none;',
    }]
    expect(reprueban(defecto).length).toBeGreaterThan(0)
  })

  it('el barrido encuentra ámbitos de verdad en el repositorio', () => {
    /**
     * Un barrido que no encuentra nada que mirar pasa igual que uno limpio.
     * Se fija una cota inferior floja: sólo tiene que delatar el día que el
     * recorrido de archivos se rompa (una ruta mal puesta, un `ext` cambiado).
     */
    expect(ambitosTsx().length).toBeGreaterThan(500)
    expect(ambitosCss().length).toBeGreaterThan(100)
  })
})
