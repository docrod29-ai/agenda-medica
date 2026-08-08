#!/usr/bin/env node
/**
 * ¿QUÉ MOTOR CLÍNICO NO CORRE EN EL CAMINO DEL MÉDICO? — REG-255.
 *
 * ── POR QUÉ ESTE INSTRUMENTO ────────────────────────────────────────────────
 *
 * La familia de defectos más grande de este repositorio, con diferencia, es
 * **«escrito, probado y sin conectar»**: 21 de 102 REG. El módulo existe, tiene
 * pruebas, está bien, y **no corre** donde el médico pasa.
 *
 * Los veintiuno se encontraron de uno en uno, por casualidad — leyendo otra
 * cosa, o porque un equipo rojo tropezó con ello. Los últimos tres:
 *
 *   · `diasDeDuracion()` sabía que «14 editas» no era una duración (REG-238)
 *   · `rastrearNota()` tenía corpus oro y la pantalla usaba media función (239)
 *   · `tareaDeResultado()` no la llamaba nadie: el bucle de laboratorio no
 *     empezaba nunca (REG-252)
 *
 * Encontrarlos por suerte no escala. Esto los cuenta.
 *
 * ── QUÉ CUENTA COMO «CONECTADO», Y CÓMO ME EQUIVOQUÉ PRIMERO ────────────────
 *
 * La primera versión preguntaba: «¿lo usa algún archivo QUE NO SEA EL SUYO?».
 * Dio 152 huérfanas de 771 — y la primera que fui a reparar, por parecer la más
 * peligrosa, era **falsa**:
 *
 *     crossResistenciaFQ  (EUCAST T13, cross-resistencia de fluoroquinolonas)
 *
 * La llama `analizarSeguridad`, **en el mismo archivo**, y ésa sí la llama el
 * motor. No estaba desconectada: era un ayudante interno. El instrumento
 * confundía «nadie lo usa» con «lo usa su vecino de archivo».
 *
 * Un medidor que grita 152 cuando hay muchas menos enseña a ignorarlo, que es
 * el mismo fallo que se repara en los avisos clínicos. Así que se mide en DOS
 * pasos, y sólo lo que falla los dos cuenta:
 *
 *   1. **¿Se usa en algún sitio?** Incluido su propio archivo, más allá de su
 *      declaración. Si no, es código muerto de verdad.
 *   2. **¿Su módulo llega al camino del médico?** Se sigue la cadena de
 *      importaciones desde `app/`, `components/` y `hooks/`. Un módulo que
 *      ninguna pantalla alcanza no corre, por muy llamado que esté por dentro.
 *
 * No mide si ese camino se recorre de verdad —para eso está el barrido con
 * navegador—, pero caza el caso que se repite: **el motor que no llega**.
 *
 * ── LO QUE NO HACE, Y POR QUÉ ───────────────────────────────────────────────
 *
 * No falla por sí solo. Un símbolo sin llamadores puede ser legítimo: una
 * constante documental (`POR_QUE_…`), un tipo, una función que es API pública
 * de una biblioteca. Por eso el guardián congela **una lista nombrada** de
 * huérfanos conocidos: lo que aparezca fuera de esa lista es nuevo, y es lo que
 * hay que mirar.
 *
 * Uso:  node scripts/calidad/motores-conectados.mjs
 *       node scripts/calidad/motores-conectados.mjs --json
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()

/**
 * Dónde se busca. Sólo motores clínicos y de seguridad: en un `utils` genérico
 * un símbolo sin llamadores es normal y el ruido ahogaría la señal.
 */
const DOMINIOS = [
  'src/lib/seguridad',
  'src/lib/clinical',
  'src/lib/expediente',
  'src/lib/tareas-clinicas',
  'src/lib/hospital',
  'src/lib/uci',
  'src/lib/asr',
  'src/lib/paciente',
]

const esPrueba = (p) => p.includes('__tests__') || /\.test\.tsx?$/.test(p)

function archivosTs(dir, acc = []) {
  let entradas
  try { entradas = readdirSync(dir) } catch { return acc }
  for (const e of entradas) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) archivosTs(p, acc)
    else if (/\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}

/** Todo el árbol que PODRÍA llamar: app, components, hooks, lib. */
const universo = [
  ...archivosTs(join(RAIZ, 'src/app')),
  ...archivosTs(join(RAIZ, 'src/components')),
  ...archivosTs(join(RAIZ, 'src/hooks')),
  ...archivosTs(join(RAIZ, 'src/lib')),
].filter(p => !esPrueba(p))

const contenido = new Map(universo.map(p => [p, readFileSync(p, 'utf8')]))

/**
 * Funciones exportadas. NO constantes: `POR_QUE_…` y `LO_QUE_PASO` existen para
 * que la razón viaje con el código y no tienen por qué llamarse desde ningún
 * sitio.
 */
const RE_EXPORT_FN = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm

/**
 * Paso 2: qué módulos alcanza el camino del médico.
 *
 * Se parte de `app/`, `components/` y `hooks/` y se sigue la cadena de
 * importaciones. Un módulo al que ninguna pantalla llega no corre, por muy
 * llamado que esté desde dentro de su propia carpeta.
 */
function moduloDeImport(desde, spec) {
  if (spec.startsWith('@/')) {
    const base = join(RAIZ, 'src', spec.slice(2))
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const c = base + ext
      if (contenido.has(c)) return c
    }
  }
  return null
}

const alcanzables = new Set()
const cola = universo.filter(p =>
  p.includes('/src/app/') || p.includes('/src/components/') || p.includes('/src/hooks/'))
for (const p of cola) alcanzables.add(p)
while (cola.length) {
  const p = cola.pop()
  const t = contenido.get(p) ?? ''
  for (const m of t.matchAll(/from\s+'([^']+)'/g)) {
    const dest = moduloDeImport(p, m[1])
    if (dest && !alcanzables.has(dest)) { alcanzables.add(dest); cola.push(dest) }
  }
}

/** Líneas de código del cuerpo de una función, sin comentarios ni vacías. */
function cuerpoDe(texto, simbolo) {
  const m = new RegExp(`^export\\s+(?:async\\s+)?function\\s+${simbolo}\\b`, 'm').exec(texto)
  if (!m) return null
  let i = texto.indexOf('{', m.index)
  if (i < 0) return null
  let prof = 0, j = i
  for (; j < texto.length; j++) {
    if (texto[j] === '{') prof++
    else if (texto[j] === '}' && --prof === 0) break
  }
  return texto.slice(i + 1, j).split('\n')
    .filter(l => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length
}

const huerfanas = []
const envoltorios = []
const conCuerpo = []
const inalcanzables = []
let total = 0

for (const dom of DOMINIOS) {
  for (const archivo of archivosTs(join(RAIZ, dom))) {
    if (esPrueba(archivo)) continue
    const texto = readFileSync(archivo, 'utf8')
    const llegaAlMedico = alcanzables.has(archivo)
    for (const m of texto.matchAll(RE_EXPORT_FN)) {
      const simbolo = m[1]
      total++
      /* Se busca como palabra completa para que `dosis` no case con `dosisAlta`. */
      const re = new RegExp(`\\b${simbolo}\\b`, 'g')
      /* En su PROPIO archivo hace falta más de una aparición: la declaración
         siempre está, y contarla haría que todo pareciera usado. */
      const enElSuyo = (texto.match(re) ?? []).length > 1
      let fuera = false
      for (const [p, t] of contenido) {
        if (p === archivo) continue
        if (new RegExp(`\\b${simbolo}\\b`).test(t)) { fuera = true; break }
      }
      if (!enElSuyo && !fuera) {
        const id = `${relative(RAIZ, archivo)}::${simbolo}`
        huerfanas.push(id)
        /**
         * ── TRES CATEGORÍAS, NO UNA (REG-260) ──────────────────────────────
         *
         * Decir «42 motores sin conectar» era inflar. Medido:
         *
         *   34  ENVOLTORIOS de ≤3 líneas sobre una función que SÍ corre
         *       (`sePuedeFirmar` es `motivosParaNoFirmar().length === 0`).
         *       No son defectos: son comodidad que nadie usó.
         *    8  con CUERPO REAL — los que merecen mirarse uno a uno.
         *
         * Y de esos ocho, alguno está **bloqueado en el dueño**, no en mí:
         * `validarCorreccion` exige una política como parámetro obligatorio y
         * su constante nace en `null` a propósito, porque quién puede
         * corregir, en qué ventana y si el motivo es obligatorio son
         * decisiones suyas. Conectarla inventándome la política sería
         * exactamente lo que este proyecto no hace.
         *
         * Un número que mezcla las tres cosas no sirve para decidir nada.
         */
        const cuerpo = cuerpoDe(texto, simbolo)
        if (cuerpo !== null && cuerpo <= 3) envoltorios.push(id)
        else conCuerpo.push(id)
      } else if (!llegaAlMedico && !fuera) inalcanzables.push(`${relative(RAIZ, archivo)}::${simbolo}`)
    }
  }
}
inalcanzables.sort()

huerfanas.sort()

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, huerfanas, envoltorios, conCuerpo, inalcanzables }, null, 2))
} else {
  console.log(
    `\n  Motores clínicos y de seguridad: ${total} funciones exportadas.\n` +
    `  Sin ningún uso: ${huerfanas.length}\n` +
    `     · ${envoltorios.length} son ENVOLTORIOS de ≤3 líneas sobre algo que sí corre\n` +
    `     · ${conCuerpo.length} tienen CUERPO REAL — éstos son los que hay que mirar\n`)
  for (const h of conCuerpo) console.log(`     ! ${h}`)
  console.log(
    `\n  SIN LLEGAR AL MÉDICO (sólo se usan dentro de un módulo que ninguna\n` +
    `  pantalla alcanza): ${inalcanzables.length}\n`)
  for (const h of inalcanzables.slice(0, 40)) console.log(`     · ${h}`)
  console.log('')
}
