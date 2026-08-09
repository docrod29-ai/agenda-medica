#!/usr/bin/env node
/**
 * EL TRINQUETE DE ACCESIBILIDAD — V9 · A11Y-GATE-001.
 *
 * ── POR QUÉ NO ES UNA EXPRESIÓN REGULAR ─────────────────────────────────────
 *
 * El primer intento midió con `grep` y dio **65 botones sin nombre accesible**.
 * Al mirarlos, la mayoría eran así:
 *
 *     <button onClick={guardar}>{saving ? <><Loader2/>Guardando…</> : 'Guardar'}</button>
 *
 * Un botón perfectamente etiquetado, cuyo texto vive dentro de una expresión y
 * dentro de un fragmento anidado. Ninguna expresión regular razonable ve eso.
 *
 * Y un guardián que señala 65 casos de los que 40 son falsos **enseña a
 * ignorarlo** — que es la lección de REG-245 y de REG-291, escrita dos veces en
 * este repositorio. Así que aquí se parsea de verdad, con el compilador de
 * TypeScript que ya es dependencia del proyecto. Sin paquetes nuevos.
 *
 * ── LOS DOS DEFECTOS QUE MIDE ───────────────────────────────────────────────
 *
 *   sinNombre    Un control (`<button>`, o algo con `role="button"`) cuyo
 *                contenido es SÓLO un icono y que no trae `aria-label`,
 *                `aria-labelledby` ni `title`. Para quien usa lector de
 *                pantalla, ese botón se anuncia como «botón» y nada más: no hay
 *                forma de saber qué hace sin pulsarlo.
 *
 *   noEsControl  `onClick` sobre un `<div>`, `<span>`, `<li>`… sin `role` ni
 *                `tabIndex` ni manejador de teclado. Con el ratón funciona; con
 *                el teclado no existe. Es el mínimo que `.claude/rules/
 *                design-system.md` declara como fallo de compuerta: «control
 *                interactivo que no es `<button>`».
 *
 * ── SEÑALAR DE MENOS, NUNCA DE MÁS ──────────────────────────────────────────
 *
 * Cuando el contenido de un control es una expresión que este script no puede
 * resolver —`{etiqueta}`, `{children}`, una llamada— **se da por bueno**. Podría
 * ser texto y podría no serlo, y equivocarse hacia el falso positivo es lo que
 * mata a un guardián.
 *
 * Es la regla 5 de `clinical-safety.md` aplicada a la interfaz: que un caso no
 * se vigile significa que NO SE VIGILA, no que esté bien. Queda declarado aquí y
 * en el «qué no cubre» de la prueba.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No es `axe`.** No ve el árbol de accesibilidad renderizado, ni el orden de
 *   foco real, ni un `aria-hidden` que tape media pantalla, ni una etiqueta que
 *   apunte a un `id` que no existe. `axe` sobre el producto corriendo sigue
 *   pendiente: sin credenciales de Firebase no se puede levantar aquí.
 * - **No mide contraste**: eso lo hace `el-contraste-esta-medido.test.ts` con un
 *   motor determinista sobre los tokens.
 * - **No mide el tamaño del objetivo táctil** (44×44). Está en `globals.css`
 *   para los dispositivos de dedo, pero comprobarlo de verdad exige medir cajas
 *   en un navegador.
 * - **No mira `src/lib/`** ni las rutas de API: ahí no se pinta.
 * - Un control cuyo nombre venga de una variable no se juzga. Ver arriba.
 *
 * Uso:
 *   node scripts/a11y/trinquete-de-accesibilidad.mjs               comprueba
 *   node scripts/a11y/trinquete-de-accesibilidad.mjs --actualizar  fija el techo
 *   node scripts/a11y/trinquete-de-accesibilidad.mjs --detalle     enseña dónde
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

const RAIZ = process.cwd()
const TECHO = 'docs/design/a11y-techo.json'

export const CARPETAS = [join('src', 'app'), join('src', 'components')]

/** Etiquetas que el navegador YA hace interactivas y enfocables. */
const CONTROLES_NATIVOS = new Set(['button', 'a', 'input', 'select', 'textarea', 'label', 'summary', 'option'])

/** Roles que declaran «esto es un control» y que, con `tabIndex`, bastan. */
const ROLES_DE_CONTROL = new Set([
  'button', 'link', 'tab', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'checkbox', 'switch', 'radio', 'combobox', 'slider', 'spinbutton', 'treeitem',
])

const ATRIBUTOS_DE_NOMBRE = new Set(['aria-label', 'aria-labelledby', 'title'])
const MANEJADORES_DE_TECLA = new Set(['onKeyDown', 'onKeyUp', 'onKeyPress'])

function nombreDeAtributo(attr) {
  if (!ts.isJsxAttribute(attr)) return null
  return attr.name.getText()
}

function atributos(apertura) {
  const m = new Map()
  for (const a of apertura.attributes.properties) {
    const n = nombreDeAtributo(a)
    if (n) m.set(n, a)
  }
  return m
}

/**
 * ¿El elemento recibe atributos por propagación (`{...algo}`)?
 *
 * Este repositorio ya tiene el ayudante correcto —`activable()` en
 * `src/lib/ui/activable.ts`— que devuelve `role`, `tabIndex`, `aria-label` y
 * `onKeyDown` de una vez. Un elemento que lo usa está BIEN, y la primera versión
 * de este guardián lo señalaba porque sólo miraba atributos escritos a mano:
 * castigaba la solución que el propio repositorio inventó.
 *
 * Ante un `{...spread}` no se juzga. Señalar de menos, nunca de más.
 */
function tienePropagacion(apertura) {
  return apertura.attributes.properties.some(a => ts.isJsxSpreadAttribute(a))
}

/** El valor literal de un atributo, si es una cadena simple. */
function valorLiteral(attr) {
  if (!attr || !attr.initializer) return null
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression &&
      ts.isStringLiteral(attr.initializer.expression)) {
    return attr.initializer.expression.text
  }
  return null
}

const LETRA = /[\p{L}\p{N}]/u

/**
 * DOS COSAS QUE PARECEN CONTROLES Y NO LO SON.
 *
 * La primera versión de este guardián señaló 20 sitios y **los 20 eran falsos**:
 * ni uno era un `<div>` haciéndose pasar por botón. Eran estas dos:
 *
 *   · **El fondo de un diálogo.** `<div style={{position:'fixed', inset:0}}
 *     onClick={cerrar}>` es una comodidad de ratón, no la única forma de cerrar
 *     —para eso están Escape y el botón de cerrar—. Exigirle `tabIndex` sería
 *     meter una parada de tabulación que no lleva a ninguna parte.
 *   · **`onClick={e => e.stopPropagation()}`**, que no es un control: es
 *     fontanería para que el click no llegue al fondo de arriba.
 *
 * Excluirlas no es ablandar el guardián: es la diferencia entre uno que se lee y
 * uno que se silencia. Lo que queda vigilado es el caso de verdad — un elemento
 * no interactivo con una ACCIÓN detrás, inalcanzable con el teclado.
 */
function esFontaneriaDeEvento(attr) {
  const init = attr?.initializer
  if (!init || !ts.isJsxExpression(init) || !init.expression) return false
  const fn = init.expression
  if (!ts.isArrowFunction(fn)) return false
  const cuerpo = fn.body
  const esFrenoDeEvento = llamada =>
    ts.isCallExpression(llamada) && /\.(stopPropagation|preventDefault)$/.test(llamada.expression.getText())

  if (ts.isCallExpression(cuerpo)) return esFrenoDeEvento(cuerpo)
  if (!ts.isBlock(cuerpo) || cuerpo.statements.length === 0) return false
  // `e => { e.preventDefault(); e.stopPropagation() }` también es fontanería.
  return cuerpo.statements.every(
    st => ts.isExpressionStatement(st) && esFrenoDeEvento(st.expression),
  )
}

/** El fondo a pantalla completa de un diálogo. */
function esFondoDeDialogo(attrs) {
  if (attrs.has('aria-hidden')) return true
  const estilo = attrs.get('style')
  const texto = estilo?.initializer?.getText?.() ?? ''
  return /position:\s*['"]fixed['"]/.test(texto) && /inset:\s*0\b/.test(texto)
}

/**
 * ¿El contenido de este elemento puede dar nombre accesible?
 *
 * Devuelve `true` también cuando **no se puede saber** (una expresión que no es
 * un icono): señalar de menos, nunca de más.
 */
function puedeTenerNombre(nodo) {
  for (const hijo of nodo.children ?? []) {
    if (ts.isJsxText(hijo)) {
      if (LETRA.test(hijo.text)) return true
      continue
    }
    if (ts.isJsxExpression(hijo)) {
      const e = hijo.expression
      if (!e) continue
      // Una expresión que no sabemos resolver se da por buena.
      if (!ts.isJsxElement(e) && !ts.isJsxSelfClosingElement(e) && !ts.isJsxFragment(e)) return true
      if (puedeTenerNombre(e)) return true
      continue
    }
    if (ts.isJsxFragment(hijo)) {
      if (puedeTenerNombre(hijo)) return true
      continue
    }
    if (ts.isJsxElement(hijo)) {
      // Un elemento anidado puede traer su propio texto o su propia etiqueta.
      const attrs = atributos(hijo.openingElement)
      for (const n of ATRIBUTOS_DE_NOMBRE) if (attrs.has(n)) return true
      if (puedeTenerNombre(hijo)) return true
      continue
    }
    if (ts.isJsxSelfClosingElement(hijo)) {
      const attrs = atributos(hijo)
      for (const n of ATRIBUTOS_DE_NOMBRE) if (attrs.has(n)) return true
      // Un icono suelto: no da nombre. Sigue buscando en los demás hijos.
      continue
    }
  }
  return false
}

/** Mide un texto de TSX ya parseado. Separado para poder probarlo al revés. */
export function medirTexto(texto, nombreArchivo = 'x.tsx') {
  const fuente = ts.createSourceFile(nombreArchivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let sinNombre = 0
  let noEsControl = 0
  const detalle = []

  const linea = nodo => fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1

  function visitar(nodo) {
    const apertura = ts.isJsxElement(nodo)
      ? nodo.openingElement
      : ts.isJsxSelfClosingElement(nodo)
        ? nodo
        : null

    if (apertura) {
      const etiqueta = apertura.tagName.getText()
      const attrs = atributos(apertura)
      const rol = valorLiteral(attrs.get('role'))
      const esIntrinseca = /^[a-z]/.test(etiqueta)

      const esControl = CONTROLES_NATIVOS.has(etiqueta) || (rol !== null && ROLES_DE_CONTROL.has(rol))
      const tieneNombreDeclarado = [...ATRIBUTOS_DE_NOMBRE].some(n => attrs.has(n))

      // 1) Control sin nombre accesible — sólo se juzgan `button` y `role=button`,
      //    que es donde el icono suelto es la norma. Un `<a>` con href puede
      //    tomar el nombre de su destino y un `<input>` de su `<label>`.
      if ((etiqueta === 'button' || rol === 'button') && !tieneNombreDeclarado && !tienePropagacion(apertura)) {
        const cuerpo = ts.isJsxElement(nodo) ? nodo : null
        if (!cuerpo || !puedeTenerNombre(cuerpo)) {
          sinNombre++
          detalle.push({ tipo: 'sinNombre', linea: linea(apertura) })
        }
      }

      // 2) Interactivo que no es un control: sólo con ratón.
      if (esIntrinseca && !esControl && attrs.has('onClick') && !tienePropagacion(apertura) &&
          !esFontaneriaDeEvento(attrs.get('onClick')) && !esFondoDeDialogo(attrs)) {
        const enfocable = attrs.has('tabIndex')
        const conTeclado = [...MANEJADORES_DE_TECLA].some(n => attrs.has(n))
        if (!(rol && enfocable && conTeclado)) {
          noEsControl++
          detalle.push({ tipo: 'noEsControl', linea: linea(apertura), etiqueta })
        }
      }
    }

    ts.forEachChild(nodo, visitar)
  }

  visitar(fuente)
  return { sinNombre, noEsControl, total: sinNombre + noEsControl, detalle }
}

function archivos(dir, salida = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'api' || entrada === '__tests__' || entrada === 'node_modules') continue
      archivos(ruta, salida)
    } else if (entrada.endsWith('.tsx') && !entrada.endsWith('.test.tsx')) {
      salida.push(ruta)
    }
  }
  return salida
}

export function medir() {
  const porArchivo = {}
  let total = 0
  for (const carpeta of CARPETAS) {
    const abs = join(RAIZ, carpeta)
    if (!existsSync(abs)) continue
    for (const ruta of archivos(abs)) {
      const rel = relative(RAIZ, ruta).split(sep).join('/')
      const m = medirTexto(readFileSync(ruta, 'utf8'), rel)
      if (m.total > 0) { porArchivo[rel] = m.total; total += m.total }
    }
  }
  return { total, porArchivo }
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const esCLI = process.argv[1] && process.argv[1].endsWith('trinquete-de-accesibilidad.mjs')
if (esCLI) {
  const actualizar = process.argv.includes('--actualizar')
  const detalle = process.argv.includes('--detalle')
  const { total, porArchivo } = medir()

  if (detalle) {
    for (const [f, n] of Object.entries(porArchivo).sort((a, b) => b[1] - a[1])) {
      const m = medirTexto(readFileSync(join(RAIZ, f), 'utf8'), f)
      const sitios = m.detalle.map(d => `${d.tipo}:${d.linea}`).join(' ')
      console.log(`  ${String(n).padStart(3)}  ${f}\n        ${sitios}`)
    }
    console.log(`\n  ${Object.keys(porArchivo).length} archivos · ${total} defectos de acceso por teclado o por lector\n`)
  }

  if (actualizar || !existsSync(TECHO)) {
    writeFileSync(TECHO, JSON.stringify({
      queEs: 'Techo del trinquete de accesibilidad (V9 · A11Y-GATE-001). Sólo puede BAJAR. Lo escribe scripts/a11y/trinquete-de-accesibilidad.mjs --actualizar.',
      queMide: {
        sinNombre: 'Botón cuyo contenido es sólo un icono, sin aria-label / aria-labelledby / title.',
        noEsControl: 'onClick sobre un elemento no interactivo sin role + tabIndex + manejador de teclado.',
      },
      total,
      porArchivo,
    }, null, 2) + '\n')
    console.log(`\n  Techo de accesibilidad fijado en ${total}.\n`)
    process.exit(0)
  }

  const techo = JSON.parse(readFileSync(TECHO, 'utf8'))
  const nuevos = Object.entries(porArchivo).filter(([f]) => !(f in techo.porArchivo))
  if (nuevos.length) {
    console.error('\n  ACCESIBILIDAD: un archivo NUEVO nace inaccesible con el teclado o con lector.\n')
    for (const [f, n] of nuevos) console.error(`     ${f}  →  ${n}`)
    console.error('\n  Un botón de sólo icono lleva aria-label. Un div con onClick es un <button>.\n')
    process.exit(1)
  }
  if (total > techo.total) {
    console.error(`\n  ACCESIBILIDAD: ${total} defectos, el techo son ${techo.total}.\n`)
    for (const [f, n] of Object.entries(porArchivo)) {
      const antes = techo.porArchivo[f] ?? 0
      if (n > antes) console.error(`     ${f}  ${antes} → ${n}`)
    }
    console.error('')
    process.exit(1)
  }
  if (total < techo.total) {
    console.error(`\n  ACCESIBILIDAD: ${total} < techo ${techo.total}. Baja el techo:`)
    console.error('     node scripts/a11y/trinquete-de-accesibilidad.mjs --actualizar\n')
    process.exit(1)
  }
  console.log(`\n  Accesibilidad: ${total} defectos, igual que el techo. Sin deuda nueva.\n`)
}
