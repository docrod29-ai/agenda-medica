/**
 * INVENTARIO DE LECTURAS SIN COTA — `getDocs` que puede descargar una colección
 * entera.
 *
 * ── POR QUÉ ESTE INVENTARIO Y NO UNA REGLA DE LINT ──────────────────────────
 *
 * Porque **no toda lectura necesita `limit`**. Hay colecciones acotadas por su
 * naturaleza —los consultorios de una cuenta, las unidades de un hospital, las
 * versiones de UNA nota— y exigirles un tope sólo enseñaría a poner `limit(1000)`
 * por costumbre, que es peor que no tenerlo: parece protegido y no lo está.
 *
 * Lo que hace falta es lo contrario: una lista de las que crecen con la práctica
 * y **un techo que sólo baje**. Una lectura nueva sin cota sube el número y pone
 * el CI en rojo; declararla acotada obliga a escribir por qué.
 *
 * ── CÓMO CUENTA, Y POR QUÉ ASÍ ──────────────────────────────────────────────
 *
 * El primer intento contaba 55 de 58 «sin cota», y era falso: `limitarA(1)` no
 * casa con `/limit\(/`, y media docena de llamadas son `getDocs(q)` con la `q`
 * construida tres líneas más arriba. Un inventario que exagera manda a arreglar
 * lo que ya estaba bien y le quita crédito a los huecos reales.
 *
 * Así que resuelve la variable: ante `getDocs(q)` busca su `const q = …` en el
 * mismo archivo y mira la expresión de verdad. Y reconoce las formas de cota que
 * este repositorio usa: `limit(`, `limitarA(`, `firestoreLimit(`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()

/**
 * Formas de poner un techo que se usan en este árbol.
 *
 * Son cuatro alias del mismo `limit` de Firestore, y el inventario se equivocó
 * con tres de ellas antes de reconocerlas. Cualquier nombre nuevo que empiece por
 * `limit`/`fbLimit` entra solo; uno que no, hay que añadirlo aquí — y el techo
 * subiendo sin motivo es la señal de que falta.
 */
const CON_COTA = /\b(limit|limitarA|firestoreLimit|fbLimit)\s*\(/

function archivosDeCodigo(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e !== 'node_modules' && e !== '__tests__') archivosDeCodigo(p, out)
    } else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/** El argumento de una llamada, con paréntesis balanceados. */
function argumento(src, iParen) {
  let n = 0
  for (let j = iParen; j < src.length; j++) {
    if (src[j] === '(') n++
    else if (src[j] === ')') { n--; if (n === 0) return src.slice(iParen + 1, j) }
  }
  return ''
}

/**
 * EL BLOQUE DE PRIMER NIVEL QUE CONTIENE UNA POSICIÓN — la función que envuelve.
 *
 * Resolver los nombres en TODO el archivo fue el primer error de este
 * inventario, y uno instructivo: `listarPacientesPagina` sí acota —empuja
 * `limitarA(limite + 1)` a su lista de restricciones— pero otra función del
 * mismo archivo tiene una variable con el mismo nombre y sin cota, y la búsqueda
 * a nivel de archivo se quedaba con la primera. Marcaba como deuda algo que
 * estaba bien.
 *
 * Un inventario que exagera manda a rehacer lo hecho y le quita crédito a los
 * huecos reales, así que los nombres se resuelven **dentro de la función donde
 * se usan**.
 */
function bloqueQueContiene(src, pos) {
  const inicios = [...src.matchAll(/\n(?:export\s+)?(?:async\s+)?(?:function\s|const\s|let\s|var\s)/g)]
    .map(m => m.index)
  let ini = 0
  for (const i of inicios) { if (i < pos) ini = i; else break }
  const sig = inicios.find(i => i > pos)
  return src.slice(ini, sig ?? src.length)
}

/**
 * Sigue los nombres hasta ver la expresión de verdad.
 *
 * Tres formas escondían la cota y hacían contar de más: `getDocs(q)` con la `q`
 * armada antes, `getDocs(consultaOrdenada(…))` con el `limit` dentro del
 * ayudante, y los `...partes` que llegan por spread.
 *
 * Se busca primero en la función que envuelve la llamada; sólo si ahí no aparece
 * el nombre se mira el ámbito del módulo, que es donde viven los ayudantes.
 */
function resolver(src, pos, expr) {
  const bloque = bloqueQueContiene(src, pos)
  const partes = [expr, bloque]
  for (const nombre of new Set(expr.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
    if (/^(query|collection|collectionGroup|where|orderBy|db|doc|startAfter|documentId|snap|clinicId|patientId)$/.test(nombre)) continue
    if (new RegExp(`(?:const|let|var|function)\\s+${nombre}\\b`).test(bloque)) continue  // ya está en el bloque
    const m = new RegExp(`\\n(?:export\\s+)?(?:async\\s+)?(?:function\\s+${nombre}\\b|(?:const|let|var)\\s+${nombre}\\s*=)`).exec(src)
    if (m) partes.push(bloqueQueContiene(src, m.index + 1))
  }
  return partes.join('\n')
}

export function inventariar() {
  const filas = []
  for (const p of archivosDeCodigo(join(RAIZ, 'src'))) {
    const src = readFileSync(p, 'utf8')
    for (let i = src.indexOf('getDocs('); i !== -1; i = src.indexOf('getDocs(', i + 1)) {
      const bruto = argumento(src, i + 'getDocs'.length)
      const resuelto = resolver(src, i, bruto)
      filas.push({
        archivo: relative(RAIZ, p).replace(/\\/g, '/'),
        linea: src.slice(0, i).split('\n').length,
        cota: CON_COTA.test(bruto) || CON_COTA.test(resuelto),
        expr: (resuelto || bruto).replace(/\s+/g, ' ').slice(0, 120),
      })
    }
  }
  return filas.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.linea - b.linea)
}

export function sinCota() {
  return inventariar().filter(f => !f.cota)
}

/** Hospital y UCI viven detrás de bandera y en ALPHA: van aparte, no fuera. */
export const esDeHospital = (archivo) => /(^|\/)(hospital|uci)\//.test(archivo)

/**
 * El recuento por carril.
 *
 * Separados porque el trabajo de Consultorio no puede quedar bloqueado por
 * Hospital, y **contados los dos** porque desaparecer del recuento es como se
 * pierde un hueco: si Hospital saliera del inventario, sus lecturas sin cota
 * dejarían de existir para el CI el día que se venda.
 */
export function recuento() {
  const sin = sinCota()
  return {
    consultorio: sin.filter(f => !esDeHospital(f.archivo)).length,
    hospital: sin.filter(f => esDeHospital(f.archivo)).length,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const todas = inventariar()
  const sin = sinCota()
  console.log(`\n  getDocs: ${todas.length}  ·  con cota: ${todas.length - sin.length}  ·  SIN cota: ${sin.length}\n`)
  for (const f of sin) console.log(`  ${f.archivo}:${f.linea}\n      ${f.expr}`)
  console.log()
}
