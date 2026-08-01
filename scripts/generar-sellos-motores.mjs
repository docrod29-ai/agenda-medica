/**
 * Genera `src/lib/clinical/sellos.json` — el mapa DELGADO del registro clínico.
 *
 * ── POR QUÉ NO SE IMPORTA EL REGISTRO Y YA ───────────────────────────────────
 *
 * `src/lib/clinical/registry.ts` son 2 100 líneas: rangos, ADRs, golden tests,
 * puntos de entrada, sub-motores. Todo eso es para el CI y para quien mantiene
 * el código; meterlo en el paquete que descarga el navegador para pintar una
 * etiqueta de cuatro palabras sería pagar cien veces lo que vale.
 *
 * Aquí se extrae sólo lo que la pantalla necesita: id, nombre, especialidad,
 * estado y referencia.
 *
 * ── POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO ─────────────────────────────────
 *
 * Una copia escrita a mano se desincroniza el día que un motor pase a validado,
 * y el fallo sería el peor posible: la pantalla diciendo «sin validar» sobre algo
 * que el médico ya revisó, o —mucho peor— callando sobre algo que no. Por eso lo
 * escribe este script y `clinical-sellos.test.ts` comprueba en cada CI que el
 * archivo publicado coincide EXACTAMENTE con el registro.
 *
 * Uso:  node scripts/generar-sellos-motores.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = process.cwd()
const ORIGEN = resolve(RAIZ, 'src/lib/clinical/registry.ts')
const DESTINO = resolve(RAIZ, 'src/lib/clinical/sellos.json')

/**
 * Se lee el TEXTO del registro, no se importa.
 *
 * Importar un `.ts` desde un script de Node exige un transpilador y ataría la
 * generación a la cadena de build; el registro es una lista literal y sus campos
 * caben en una expresión regular. Si el formato cambiara tanto que esto dejara
 * de encontrar entradas, el script falla ruidosamente (abajo) en vez de escribir
 * un archivo vacío que la pantalla leería como «no hay nada que avisar».
 */
const texto = readFileSync(ORIGEN, 'utf8')

/** Extrae el valor de un campo de cadena dentro de un bloque de entrada. */
function campo(bloque, nombre) {
  const m = bloque.match(new RegExp(`\\b${nombre}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  return m ? m[1].replace(/\\'/g, "'") : ''
}

// Cada entrada empieza por `id: '...'`. Se trocea por ahí y se lee cada bloque.
const trozos = texto.split(/\n\s{2}\{\s*\n(?=\s*id:\s*')/).slice(1)
const motores = []
for (const t of trozos) {
  const id = campo(t, 'id')
  const estado = campo(t, 'estado')
  if (!id || !estado) continue
  motores.push({
    id,
    nombre: campo(t, 'nombre'),
    especialidad: campo(t, 'especialidad'),
    estado,
    referencia: campo(t, 'referencia'),
  })
}

if (motores.length < 50) {
  // Falla RUIDOSA. Un archivo vacío o a medias lo leería la pantalla como
  // «ningún motor pendiente», que es exactamente la mentira que hay que evitar.
  console.error(`[sellos] sólo se extrajeron ${motores.length} motores de ${ORIGEN}.`)
  console.error('[sellos] el formato del registro cambió: revisa este script antes de seguir.')
  process.exit(1)
}

motores.sort((a, b) => a.id.localeCompare(b.id))
writeFileSync(DESTINO, JSON.stringify(motores, null, 2) + '\n')

const porEstado = motores.reduce((acc, m) => ({ ...acc, [m.estado]: (acc[m.estado] ?? 0) + 1 }), {})
console.log(`[sellos] ${motores.length} motores →`, porEstado)
