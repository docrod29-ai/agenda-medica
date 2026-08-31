/**
 * QUÉ COLECCIONES ESCRIBE DE VERDAD EL CÓDIGO (REG-340).
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La regla de aislamiento exige declarar toda colección nueva en TRES sitios:
 * `firestore.rules`, `matriz-acceso.ts` y `respaldo.ts`. Había un guardián por
 * cada uno — y los tres eran ciegos al mismo hueco.
 *
 * Los dos guardianes de la matriz y del respaldo **parsean `firestore.rules`** y
 * lo tratan como el censo de lo que existe. Comparan reglas contra matriz y
 * reglas contra respaldo. Ninguno mira el CÓDIGO. Así que una colección que
 * nunca entró en las reglas es invisible **para los tres sitios y para los dos
 * guardianes a la vez**, y la suite se queda en verde.
 *
 * Este script cierra el círculo por el otro lado: parte de lo que el código
 * ESCRIBE y pregunta si está declarado. Es la aplicación de «el dato tiene que
 * LLEGAR» al propio inventario.
 *
 * ── QUÉ MIRA Y QUÉ NO ────────────────────────────────────────────────────────
 *
 * Mira literales de nombre de colección en `src/`, por las dos vías:
 *   · Admin SDK   → `.collection('x')`
 *   · SDK cliente → `collection(db, 'clinics', id, 'x')` / `doc(db, …)`
 *
 * NO resuelve nombres calculados (`collection(db, ruta)` con `ruta` en una
 * variable). Es un cedazo sobre literales, y se declara: encuentra lo que está
 * escrito a la vista, que es como entraron las 22 que se le escaparon a los
 * guardianes anteriores.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const OMITIR = new Set(['node_modules', '__tests__', '.next'])

export function fuentes(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (OMITIR.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) fuentes(p, acc)
    else if (/\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * Colecciones escritas, con su ámbito.
 *
 * `ambito`:
 *   'consultorio' → cuelga de `clinics/{clinicId}/…`. Es la que obliga la regla.
 *   'raiz'        → nivel superior, sólo Admin SDK. Otra clase de riesgo.
 */
export function coleccionesEscritas() {
  const halladas = new Map()

  const anota = (nombre, ambito, donde) => {
    const previa = halladas.get(nombre)
    if (previa) {
      // 'consultorio' gana: si en algún sitio se escribe bajo una clínica, la
      // regla de aislamiento aplica aunque en otro sitio cuelgue de la raíz.
      if (ambito === 'consultorio') previa.ambito = 'consultorio'
      if (previa.donde.length < 5) previa.donde.push(donde)
      return
    }
    halladas.set(nombre, { nombre, ambito, donde: [donde] })
  }

  for (const abs of fuentes(join(RAIZ, 'src'))) {
    const archivo = relative(RAIZ, abs)
    const lineas = readFileSync(abs, 'utf8').split('\n')
    /** El archivo aplanado: una cadena encadenada puede ocupar cuatro líneas. */
    const plano = lineas.join(' ')

    /** En qué línea cae una posición del texto aplanado. */
    const lineaDe = (pos) => {
      let acc = 0
      for (let i = 0; i < lineas.length; i++) {
        acc += lineas[i].length + 1
        if (acc > pos) return i + 1
      }
      return lineas.length
    }

    /**
     * Variables que apuntan a un documento DENTRO de una clínica. Sirve para
     * `ref.collection('registros')`, donde el nombre del padre no está en la
     * misma expresión — que es exactamente como se escondió la bitácora
     * NOM-004 de los tres sitios de declaración.
     */
    const refsDeClinica = new Set()
    {
      /**
       * Una asignación con su CADENA de métodos: `const col = adminDb
       * .collection('clinics').doc(id).collection('internamientos')`. Se captura
       * la cadena y no «hasta el punto y coma» porque este repositorio no usa
       * punto y coma — la primera versión de este script se apoyó en él y por
       * eso no veía nada.
       */
      const asignaciones = [...plano.matchAll(
        /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?([A-Za-z_$][\w$]*((?:\s*\.\s*\w+\s*\([^()]*\))*))/g,
      )].map(m => ({ nombre: m[1], base: m[2].split('.')[0].trim(), cadena: m[2] }))

      // Punto fijo: `ref = col.doc(x)` sólo se sabe de clínica cuando ya se sabe
      // de `col`, y `col` puede definirse después en el texto aplanado.
      let crecio = true
      while (crecio) {
        crecio = false
        for (const a of asignaciones) {
          if (refsDeClinica.has(a.nombre)) continue
          const esDeClinica = /collection\('clinics'\)|'clinics',/.test(a.cadena)
            || refsDeClinica.has(a.base)
          if (esDeClinica) { refsDeClinica.add(a.nombre); crecio = true }
        }
      }
    }

    // ── SDK cliente: collection(db, 'clinics', x, 'NOMBRE'[, y, 'HIJA'…]) ──
    for (const m of plano.matchAll(/'clinics',\s*[^,)]+,\s*'([a-z_]+)'(?:\s*,\s*[^,)]+,\s*'([a-z_]+)')?(?:\s*,\s*[^,)]+,\s*'([a-z_]+)')?/g)) {
      for (const nombre of [m[1], m[2], m[3]]) {
        if (nombre) anota(nombre, 'consultorio', `${archivo}:${lineaDe(m.index)}`)
      }
    }

    // ── Admin SDK: cadenas .collection('a').doc(x).collection('b')… ──
    for (const m of plano.matchAll(/\.collection\('clinics'\)((?:\s*\.\w+\([^()]*\))*)/g)) {
      for (const c of m[1].matchAll(/\.collection\('([a-z_]+)'\)/g)) {
        anota(c[1], 'consultorio', `${archivo}:${lineaDe(m.index)}`)
      }
      anota('clinics', 'raiz', `${archivo}:${lineaDe(m.index)}`)
    }

    // ── Admin SDK sobre una variable: ref.collection('registros') ──
    for (const m of plano.matchAll(/([A-Za-z_$][\w$]*)\.collection\('([a-z_]+)'\)/g)) {
      const [, portador, nombre] = m
      if (nombre === 'clinics') continue
      const donde = `${archivo}:${lineaDe(m.index)}`
      if (refsDeClinica.has(portador)) anota(nombre, 'consultorio', donde)
      else if (!halladas.has(nombre)) anota(nombre, 'raiz', donde)
    }
  }
  return [...halladas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const todas = coleccionesEscritas()
  for (const c of todas) console.log(c.ambito.padEnd(12), c.nombre.padEnd(28), c.donde[0])
  console.log(`\n  ${todas.length} colecciones con nombre literal en src/`)
}
