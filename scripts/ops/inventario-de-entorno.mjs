#!/usr/bin/env node
/**
 * Inventario de las variables de entorno — DERIVADO del árbol, no escrito a mano.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * El código lee más de cien variables distintas y lo que cada una espera vivía
 * en comentarios repartidos por el árbol. Es el patrón que ya costó caro con los
 * índices de Firestore: un comentario no es un entregable, y así nadie puede
 * saber CUÁNTAS faltan ni pedirlas de una vez. Un consultorio nuevo, un proyecto
 * restaurado o una máquina de trabajo recién montada las descubre de una en una,
 * en producción.
 *
 * ── MODOS ───────────────────────────────────────────────────────────────────
 *
 *   node scripts/ops/inventario-de-entorno.mjs             regenera los archivos
 *   node scripts/ops/inventario-de-entorno.mjs --verificar  falla si están viejos
 *
 * Genera `docs/ops/inventario-de-entorno.json` (la lista derivada, que es lo que
 * compara el guardián) y `.env.example` (lo que alguien copia para arrancar).
 *
 * ── LO QUE ESTE LECTOR NO VE, DECLARADO ─────────────────────────────────────
 *
 * · **Sólo detecta valores por omisión LITERALES** (`?? 'x'`, `|| 3`). Uno que
 *   caiga a una constante —`?? DEFAULT_OWNER`, que es real en
 *   `superadmin-client.ts`— se cuenta como «sin omisión». Se prefiere ese error
 *   a la inversa: decir «tiene respaldo» de algo que no lo tiene sería peor.
 * · **No sabe si la variable ESTÁ puesta en Vercel.** Eso se mira del otro lado
 *   (regla «el dato tiene que LLEGAR») y no puede vivir aquí.
 * · **No juzga si un valor es correcto.** Sólo dice quién lee qué.
 * · No lee variables construidas dinámicamente (`process.env[nombre]` con una
 *   variable). Si alguna vez aparece una, este inventario no la verá.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const JSON_SALIDA = 'docs/ops/inventario-de-entorno.json'
const ENV_EJEMPLO = '.env.example'

/** Nombres que no son configuración del producto: los pone la plataforma. */
const DE_LA_PLATAFORMA = new Set(['NODE_ENV', 'CI', 'VERCEL_URL', 'VERCEL_ENV', 'RUNNER_TEMP'])

/**
 * Quita la PROSA antes de leer, o el inventario se llena de fantasmas.
 *
 * Este archivo mismo lo destapó: el guardián que lo acompaña explica en su
 * cabecera qué pasa si alguien añade `process` `.env.LO_QUE_SEA`, y el lector
 * contó esa mención como una variable número 129. Una nota que EXPLICA una
 * variable no es una variable.
 *
 * Se descartan LÍNEAS ENTERAS que empiezan por `//`, por `*` o por `/*` — o sea,
 * prosa. Nunca se recorta dentro de una línea, y por eso este filtro **no puede**
 * borrar código:
 *
 * · Un `//` a mitad de línea se respeta: ahí vive `'https://…'`, el valor por
 *   omisión real de `NEXT_PUBLIC_APP_URL`. Recortarlo habría cambiado el
 *   respaldo declarado de una variable por culpa del lector.
 * · **No se emparejan las aperturas con los cierres de bloque**, y es a
 *   propósito. La primera versión lo hacía con una expresión regular no
 *   codiciosa, y `src/lib/firebase.ts` la desarmó: tiene doce aperturas de
 *   bloque y nueve cierres —las sobrantes viven dentro de comentarios de
 *   línea—, así que una apertura sin pareja se tragaba hasta el siguiente
 *   cierre, y con ella la lectura real de
 *   `NEXT_PUBLIC_FIREBASE_EMULATORS`. El inventario pasó a decir que esa
 *   variable no se leía: el error en la dirección peligrosa, que es no
 *   declarar algo que sí existe.
 */
const sinComentarios = (fuente) => fuente
  .split('\n')
  .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')

/**
 * Recorre el árbol y devuelve, por variable, quién la lee y con qué respaldo.
 * Exportada para que el guardián derive lo mismo sin volver a escribir el lector.
 */
export function inventarioDelArbol(listaDeArchivos) {
  /**
   * EL ORDEN DE `grep` NO ES UN ORDEN — REG-509.
   *
   * `grep -rl` devuelve los archivos en el orden del SISTEMA DE ARCHIVOS, no
   * alfabético. Nueve variables se leen en más de un archivo de `src/`, y el
   * respaldo elegido era «el primero que apareciera»: en otra máquina aparecía
   * otro, y el archivo generado salía distinto sin que cambiara una línea del
   * código. Se ordena antes de leer, y más abajo se elige el respaldo por
   * nombre de archivo en vez de por orden de llegada.
   *
   * `listaDeArchivos` existe para que el guardián pueda pasarla al revés y
   * comprobar que el resultado no cambia.
   */
  const archivos = (listaDeArchivos ?? execSync(
    "grep -rl 'process\\.env' src scripts --include=*.ts --include=*.tsx --include=*.mjs --include=*.js 2>/dev/null || true",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)).slice().sort()

  const vistas = new Map()
  for (const archivo of archivos) {
    const fuente = sinComentarios(readFileSync(archivo, 'utf8'))
    const re = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])/g
    let m
    while ((m = re.exec(fuente))) {
      const nombre = m[1] ?? m[2]
      if (!vistas.has(nombre)) vistas.set(nombre, { archivos: new Set(), defectos: [] })
      const v = vistas.get(nombre)
      v.archivos.add(archivo)
      const cola = fuente.slice(m.index + m[0].length, m.index + m[0].length + 90)
      const d = cola.match(/^\s*(?:\?\?|\|\|)\s*('([^']*)'|"([^"]*)"|`([^`]*)`|(\d+(?:\.\d+)?)|true|false)/)
      if (d) v.defectos.push({ archivo, valor: d[2] ?? d[3] ?? d[4] ?? d[5] ?? d[1] })
    }
  }

  return [...vistas.entries()]
    .map(([nombre, v]) => {
      const archivos = [...v.archivos].sort()
      const soloPruebas = archivos.every(a => a.includes('__tests__'))
      const soloScripts = archivos.every(a => a.startsWith('scripts/'))
      /**
       * EL RESPALDO SE LEE DE LO QUE CORRE, NO DE LAS PRUEBAS.
       *
       * La primera versión tomaba el primer valor por omisión que encontrara en
       * CUALQUIER archivo, y las pruebas de `PORTAL_PACIENTE_SECRET` hacen
       * `process.env.X || 'dev-portal-secret-…'`. El inventario acabó diciendo
       * que ese secreto tiene un respaldo benigno cuando en producción el código
       * LANZA si falta. Mentir en la dirección de «tiene respaldo» es
       * exactamente el error que no se puede permitir aquí.
       */
      const deProduccion = v.defectos
        .filter(d => !d.archivo.includes('__tests__'))
        .sort((a, b) => (a.archivo < b.archivo ? -1 : a.archivo > b.archivo ? 1 : 0))
      const preferido = deProduccion.find(d => d.archivo.startsWith('src/')) ?? deProduccion[0]
      return {
        nombre,
        publica: nombre.startsWith('NEXT_PUBLIC_'),
        deLaPlataforma: DE_LA_PLATAFORMA.has(nombre),
        ambito: soloPruebas ? 'pruebas' : soloScripts ? 'scripts' : 'runtime',
        defectoLiteral: preferido ? preferido.valor : null,
        defectoDe: preferido ? preferido.archivo : null,
        archivos,
      }
    })
    /**
     * Por PUNTO DE CÓDIGO, no `localeCompare`: éste ignora el guion bajo en su
     * fuerza primaria —`NEXTAUTH_URL` cae antes o después de
     * `NEXT_PUBLIC_APP_URL` según la ICU del entorno— y habría sido la segunda
     * fuente de archivos distintos en máquinas distintas.
     */
    .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))
}

function comoJson(inv) {
  return JSON.stringify({
    porQue: 'Inventario DERIVADO del árbol por scripts/ops/inventario-de-entorno.mjs. NO se edita a mano: se regenera. El conocimiento humano (formato, qué pasa sin ella) vive en docs/ops/INVENTARIO-DE-ENTORNO.md.',
    generado: new Date().toISOString().slice(0, 10),
    total: inv.length,
    variables: inv,
  }, null, 2) + '\n'
}

function comoEnvExample(inv) {
  const lineas = [
    '# .env.example — GENERADO por scripts/ops/inventario-de-entorno.mjs. No editar a mano.',
    '#',
    '# Copiar a .env.local y rellenar. Aquí NUNCA va un valor real: este archivo',
    '# se versiona. Lo que cada variable espera y qué pasa sin ella está en',
    '# docs/ops/INVENTARIO-DE-ENTORNO.md.',
    '',
  ]
  const grupos = [
    ['runtime', 'LO QUE LEE LA APLICACIÓN'],
    ['scripts', 'SÓLO PARA HERRAMIENTAS Y GUIONES (no hacen falta para levantar la app)'],
    ['pruebas', 'SÓLO PARA PRUEBAS'],
  ]
  for (const [ambito, titulo] of grupos) {
    const delGrupo = inv.filter(v => v.ambito === ambito && !v.deLaPlataforma)
    if (!delGrupo.length) continue
    lineas.push(`# ─── ${titulo} ${'─'.repeat(Math.max(0, 60 - titulo.length))}`, '')
    for (const v of delGrupo) {
      const notas = []
      if (v.publica) notas.push('LLEGA AL NAVEGADOR: nunca un secreto')
      if (v.defectoLiteral !== null) notas.push(`sin ella se usa: ${JSON.stringify(v.defectoLiteral)}`)
      else notas.push('sin respaldo literal')
      lineas.push(`# ${notas.join(' · ')}`)
      lineas.push(`${v.nombre}=`, '')
    }
  }
  lineas.push('# Las pone la plataforma (Vercel, CI, Node): no se escriben aquí.')
  lineas.push(`# ${inv.filter(v => v.deLaPlataforma).map(v => v.nombre).join(' · ')}`, '')
  return lineas.join('\n')
}

/**
 * SÓLO CUANDO SE EJECUTA, NUNCA AL IMPORTARSE.
 *
 * Sin esta guarda, el guardián que importa `inventarioDelArbol` ejecutaba de
 * paso el cuerpo del script y REGENERABA los archivos antes de compararlos: la
 * prueba se arreglaba a sí misma y pasaba siempre. Se descubrió probándola al
 * revés —metiendo una variable nueva sin regenerar— y viendo que seguía verde.
 * Una prueba que no puede fallar no es una prueba.
 */
const ejecutadoDirectamente =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (!ejecutadoDirectamente) {
  // Importado: sólo se ofrece la función. Cero efectos.
} else {

const inv = inventarioDelArbol()
const json = comoJson(inv)
const ejemplo = comoEnvExample(inv)

if (process.argv.includes('--verificar')) {
  const leer = (p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }
  // La fecha cambia cada día y no es un desfase: se compara todo menos ella.
  const sinFecha = (s) => s.replace(/"generado":\s*"[^"]*"/, '"generado":"—"')
  const problemas = []
  if (sinFecha(leer(JSON_SALIDA)) !== sinFecha(json)) problemas.push(JSON_SALIDA)
  if (leer(ENV_EJEMPLO) !== ejemplo) problemas.push(ENV_EJEMPLO)
  if (problemas.length) {
    console.error(`\n  Inventario de entorno desfasado: ${problemas.join(', ')}`)
    /**
     * QUÉ difiere, no sólo QUE difiere. La primera versión sólo anunciaba el
     * desfase, y cuando salió en CI —y no en la máquina donde se generó— no
     * había forma de saber por qué sin adivinar. Un mensaje que no permite
     * diagnosticar obliga a reproducir a ciegas.
     */
    const primeraDiferencia = (viejo, nuevo) => {
      const a = viejo.split('\n'), b = nuevo.split('\n')
      for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) return `    línea ${i + 1}\n      en disco: ${a[i] ?? '(no existe)'}\n      derivado: ${b[i] ?? '(no existe)'}`
      }
      return '    (sin diferencia de líneas)'
    }
    if (problemas.includes(JSON_SALIDA)) console.error(primeraDiferencia(sinFecha(leer(JSON_SALIDA)), sinFecha(json)))
    if (problemas.includes(ENV_EJEMPLO)) console.error(primeraDiferencia(leer(ENV_EJEMPLO), ejemplo))
    console.error('\n  → node scripts/ops/inventario-de-entorno.mjs\n')
    process.exit(1)
  }
  console.log(`  Inventario de entorno al día: ${inv.length} variables.`)
} else {
  writeFileSync(JSON_SALIDA, json)
  writeFileSync(ENV_EJEMPLO, ejemplo)
  const cuenta = (a) => inv.filter(v => v.ambito === a).length
  console.log(`\n  ${inv.length} variables · runtime ${cuenta('runtime')} · scripts ${cuenta('scripts')} · pruebas ${cuenta('pruebas')}`)
  console.log(`  públicas ${inv.filter(v => v.publica).length} · sin respaldo literal ${inv.filter(v => v.defectoLiteral === null).length}`)
  console.log(`\n  ${JSON_SALIDA} y ${ENV_EJEMPLO} actualizados.\n`)
}

}
