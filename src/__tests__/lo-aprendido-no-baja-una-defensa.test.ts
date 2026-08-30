/**
 * GUARDIÁN — lo que el médico enseña sesga el oído; no toca las defensas.
 *
 * ── LA FRONTERA QUE VIGILA ──────────────────────────────────────────────────
 *
 * El producto aprende del médico: pares de una palabra por una palabra, vistos
 * dos veces, que no tocan cifra, unidad ni par prohibido, y nunca partes del
 * nombre del paciente. `aprendizaje-del-medico.test.ts` cubre **qué se puede
 * aprender**; `sesgo-llega-al-motor-bueno` cubre **que llegue al motor**.
 *
 * Lo que no cubría nadie es la frontera del otro lado: **que una preferencia no
 * pueda bajar una defensa**. La regla del programa lo separa en dos columnas —
 * preferencia de estilo, de flujo y de formato a un lado; verdad clínica, política
 * de seguridad, jerarquía de evidencia, confirmación de diagnóstico y autoridad
 * de prescripción al otro— y hasta ahora la separación vivía sólo en la
 * arquitectura, sin nada que la sostuviera.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────────
 *
 * La regla de voz de esta casa lo dice en una línea: **«sólo sesga: saber qué
 * palabra dice el médico no es permiso para cambiarla»**. El día que un módulo de
 * dosis, de alergias o de interacciones leyera el vocabulario aprendido, la
 * costumbre de un médico se habría convertido en criterio clínico — y sin que
 * nadie lo decidiera, porque un `import` no se lee como una decisión de política.
 *
 * ── CÓMO SE COMPRUEBA ───────────────────────────────────────────────────────
 *
 * Con el grafo de importaciones **transitivo**, no con un `grep` directo. Un
 * `grep` sólo vería el import de primer nivel; la forma real en que esto pasaría
 * es a través de dos o tres saltos, que es justo lo que nadie ve al revisar un
 * diff.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que el sesgo funcione.** Eso es `sesgo-llega-al-motor-bueno`.
 * · **No cubre lo que el médico escribe a mano en la nota.** Editar el texto es
 *   su acto y su autoridad; esto vigila el vocabulario que el sistema deriva solo.
 * · **Es estático.** Una lectura armada en tiempo de ejecución —leer la colección
 *   de vocabulario directamente desde un motor— se le escapa al grafo, y por eso
 *   hay además un caso que vigila la RUTA de esa colección.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'

/** Lo que aprende del médico. Ningún motor puede llegar aquí. */
const APRENDIZAJE = [
  'src/lib/asr/aprendizaje.ts',
  'src/lib/asr/aprendizaje-firestore.ts',
]

/**
 * Los módulos que DECIDEN algo clínico. La lista se deriva del árbol para que un
 * motor nuevo quede vigilado sin que nadie se acuerde de añadirlo.
 */
function motoresClinicos(): string[] {
  return execSync(
    "find src/lib/seguridad src/lib/clinical -name '*.ts' 2>/dev/null || true",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(f => f && !f.endsWith('.d.ts'))
}

/** Resuelve un especificador a un archivo del árbol, o null si es externo. */
function resolverImport(spec: string, desde: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = resolve('src', spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(desde), spec)
  else return null
  for (const suf of ['.ts', '.tsx', '/index.ts', '.json']) {
    const p = `${base}${suf}`
    if (existsSync(p)) return p.replace(`${process.cwd()}/`, '')
  }
  return null
}

function importsDe(archivo: string): string[] {
  const src = readFileSync(archivo, 'utf8')
  const specs = [...src.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
  return specs.map(s => resolverImport(s, archivo)).filter((x): x is string => x !== null)
}

/** ¿Se llega de `origen` a alguno de `destinos` siguiendo imports? */
function alcanza(origen: string, destinos: readonly string[]): string[] | null {
  const vistos = new Set<string>()
  const cola: string[][] = [[origen]]
  while (cola.length) {
    const camino = cola.shift()!
    const actual = camino[camino.length - 1]
    if (vistos.has(actual)) continue
    vistos.add(actual)
    if (camino.length > 1 && destinos.includes(actual)) return camino
    if (!existsSync(actual)) continue
    for (const sig of importsDe(actual)) cola.push([...camino, sig])
  }
  return null
}

describe('ningún motor clínico llega a lo aprendido, ni dando rodeos', () => {
  const motores = motoresClinicos()

  it('el lector encuentra motores de verdad (si no, pasaría vacío)', () => {
    expect(motores.length).toBeGreaterThan(5)
    expect(motores.some(m => m.includes('seguridad/dosis'))).toBe(true)
    expect(motores.some(m => m.includes('seguridad/alergias'))).toBe(true)
  })

  it('los archivos del aprendizaje existen donde este guardián cree', () => {
    /* Si se renombran, el guardián buscaría un destino inexistente y pasaría
       siempre — el modo de fallo silencioso de todo guardián de grafos. */
    for (const a of APRENDIZAJE) expect(existsSync(a), `${a} ya no existe`).toBe(true)
  })

  it('y ninguno alcanza el vocabulario aprendido', () => {
    const rutas = motores
      .map(m => ({ m, camino: alcanza(m, APRENDIZAJE) }))
      .filter(x => x.camino)
      .map(x => `${x.m} → ${x.camino!.slice(1).join(' → ')}`)
    expect(
      rutas,
      'un motor clínico llega a lo aprendido: la costumbre de un médico se vuelve criterio',
    ).toEqual([])
  })

  it('el buscador de caminos SÍ encuentra uno cuando existe (probado al revés)', () => {
    /**
     * Sin esto, `alcanza` podría estar devolviendo `null` siempre —por una ruta
     * mal resuelta, por ejemplo— y los casos de arriba pasarían por la razón
     * equivocada. Se le pide un camino que sabemos que existe: la consulta llega
     * al aprendizaje, y debe encontrarlo.
     */
    const camino = alcanza('src/app/(dashboard)/consulta/[patientId]/page.tsx', APRENDIZAJE)
    expect(camino, 'el buscador no encuentra un camino que sí existe').not.toBeNull()
  })
})

describe('lo aprendido entra como SESGO, y no como corrección', () => {
  const corrector = readFileSync('src/lib/asr/corrector-vigilado.ts', 'utf8')
  const guardian = readFileSync('src/lib/asr/guardian-sustituciones.ts', 'utf8')

  it('ni el corrector ni el guardián leen el vocabulario aprendido', () => {
    /**
     * Ésta es la línea exacta de la regla de voz: «sólo sesga: saber qué palabra
     * dice el médico no es permiso para cambiarla». El corrector cambia texto; el
     * aprendizaje no puede alimentarlo, o una costumbre se volvería una edición
     * sobre el dictado de otro paciente.
     */
    for (const [nombre, src] of [['corrector', corrector], ['guardián', guardian]] as const) {
      expect(src, `el ${nombre} lee lo aprendido`).not.toMatch(/aprendizaje|aprendidas/)
    }
  })

  it('y el camino de la grabación lo manda entre los términos del sesgo', () => {
    /* La otra mitad: si no llegara a ninguna parte, «no corrige» sería cierto y
       vacío. Se comprueba que sigue viajando como vocabulario. */
    const consulta = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(consulta).toMatch(/aprendidas:\s*aprendido\.map/)
  })
})

describe('la colección del vocabulario no la lee un motor por su cuenta', () => {
  it('sólo el módulo del aprendizaje conoce su ruta', () => {
    /**
     * El grafo de imports no vería a un motor que fuera directo a Firestore con
     * la ruta escrita a mano. La ruta tiene UNA definición —el propio módulo lo
     * dice: «dos rutas distintas serían dos vocabularios»— y aquí se comprueba
     * que nadie más la nombre.
     */
    const ruta = readFileSync('src/lib/asr/aprendizaje-firestore.ts', 'utf8')
    const coleccion = ruta.match(/'([a-z_]*vocabulario[a-z_]*|[a-z_]*aprendi[a-z_]*)'/)?.[1]
    expect(coleccion, 'no se pudo derivar el nombre de la colección del vocabulario').toBeTruthy()

    const otros = execSync(
      `grep -rl "'${coleccion}'" src --include=*.ts --include=*.tsx | grep -v __tests__ || true`,
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)

    const motores = otros.filter(f => /src\/lib\/(seguridad|clinical)\//.test(f))
    expect(motores, 'un motor clínico nombra la colección del vocabulario directamente').toEqual([])
  })
})
