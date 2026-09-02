/**
 * GUARDIÁN — un check exigido que nadie reporta bloquea TODOS los PRs, para
 * siempre y en silencio.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Preparando la protección de rama de `main` —pendiente del dueño, unidad
 * E0-11— se fue a `docs/pendientes-externos.md` §3, que daba la instrucción:
 * marcar «exactamente `clinical-safety` *y* `verificar`».
 *
 * Al cotejarlo con `ci.yml` salieron dos cosas. Los jobs que corren en cada PR
 * son **cinco**, no dos. Y uno de ellos **no se llama como su id**:
 *
 *     lint:
 *       name: lint (trinquete)      ← esto es lo que llega a GitHub
 *
 * Quien siguiera la instrucción y escribiera `lint` en el ruleset habría exigido
 * un check que **nadie reporta jamás**. GitHub no avisa de eso: deja el PR en
 * «Expected — Waiting for status to be reported» y el botón de merge gris. Para
 * siempre. Y el síntoma —«no puedo fusionar nada»— no se parece en nada a la
 * causa —«escribí mal un nombre en una pantalla de ajustes hace tres semanas».
 *
 * ── POR QUÉ ESTE ARCHIVO, Y NO SÓLO LA DOCUMENTACIÓN ────────────────────────
 *
 * La configuración vive en GitHub y no se puede leer desde aquí. Lo que sí puede
 * vivir aquí es **la mitad que este repositorio controla**: que los nombres que
 * la documentación manda exigir sigan existiendo. El día que alguien renombre el
 * job `verificar`, o le ponga un `name:` a `clinical-safety`, el ruleset queda
 * apuntando al vacío y `main` se cierra sola. Este guardián falla ANTES, en el
 * PR que hace el renombre.
 *
 * Es la lección de REG-506 aplicada al otro lado: allí un comando decía que
 * había enviado algo y no lo había enviado; aquí una pantalla diría que exige
 * algo que no existe.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No lee el ruleset.** No puede afirmar que `main` esté protegida, ni que
 *   estos tres estén marcados como required. Eso se mira en la consola de
 *   GitHub y así queda declarado en `docs/ops/PROTECCION-DE-RAMA.md`.
 * · **No comprueba que los checks PASEN**, sólo que existan con ese nombre.
 * · **No vigila los dos que NO se exigen** (`aislamiento-tenant`, `e2e-publico`):
 *   renombrarlos no rompe nada, porque ningún ruleset los nombra.
 * · Lee el YAML con un recorte por indentación, no con un parser. Un `ci.yml`
 *   escrito en flow style (`jobs: {lint: {...}}`) lo dejaría ciego; por eso hay
 *   un caso que comprueba que el lector encuentra los cinco jobs de verdad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const doc = readFileSync('docs/ops/PROTECCION-DE-RAMA.md', 'utf8')

/**
 * Los tres que el ruleset de `main` exige. Si esta lista cambia, cambia también
 * `docs/ops/PROTECCION-DE-RAMA.md` — y, sobre todo, el ruleset en GitHub, que es
 * el único sitio donde surte efecto.
 */
const EXIGIDOS = ['clinical-safety', 'verificar', 'lint (trinquete)'] as const

/**
 * El nombre con el que un job se reporta a GitHub: su `name:` si lo tiene, y su
 * id si no. Es exactamente la regla que decide qué hay que escribir en el
 * ruleset, y la que hace que `lint` se exija como `lint (trinquete)`.
 */
function nombresQueReportaElCI(fuente: string): string[] {
  const lineas = fuente.split('\n')
  const inicio = lineas.findIndex(l => /^jobs:\s*$/.test(l))
  if (inicio === -1) return []

  const nombres: string[] = []
  for (let i = inicio + 1; i < lineas.length; i += 1) {
    const esJob = lineas[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/)
    if (!esJob) continue

    let nombre = esJob[1]
    /* Su bloque llega hasta el siguiente job (o el fin del archivo). */
    for (let j = i + 1; j < lineas.length && !/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lineas[j]); j += 1) {
      const propio = lineas[j].match(/^ {4}name:\s*(.+?)\s*$/)
      if (propio) { nombre = propio[1].replace(/^['"]|['"]$/g, ''); break }
    }
    nombres.push(nombre)
  }
  return nombres
}

describe('la protección de `main` exige checks que de verdad existen', () => {
  const reportados = nombresQueReportaElCI(ci)

  it('el lector encuentra los jobs de verdad (si no, pasaría vacío)', () => {
    /* El modo de fallo de este archivo es no encontrar nada y dar todo por
       bueno — el mismo que ya se comió a `el-indice-que-nadie-declaro`. */
    expect(reportados.length).toBeGreaterThanOrEqual(5)
    expect(reportados).toContain('aislamiento-tenant')
  })

  it('el CI reporta un check con cada nombre exigido', () => {
    const fantasmas = EXIGIDOS.filter(n => !reportados.includes(n))
    expect(
      fantasmas,
      'nombres exigidos en el ruleset de `main` que ningún job reporta — GitHub dejaría todos los PRs esperando un check que no llega',
    ).toEqual([])
  })

  it('AL REVÉS: un nombre que nadie reporta se detecta', () => {
    /**
     * La prueba del guardián. `lint` es justo el error que la documentación
     * vieja inducía: es el id del job, y no es lo que el job reporta. Si esto
     * pasara, los dos casos de arriba estarían pasando por la razón equivocada.
     */
    expect(reportados).not.toContain('lint')
    expect(reportados).toContain('lint (trinquete)')
  })

  it('ninguno de los exigidos se rinde en amarillo', () => {
    /**
     * Un job con `continue-on-error: true` reporta éxito aunque falle: exigirlo
     * en el ruleset daría una compuerta que nunca cierra. Es lo que le pasó al
     * gate de ADRs hasta que se le puso trinquete, y está escrito en `ci.yml`.
     */
    const blandos = ci
      .split('\n')
      .filter(l => /^\s*continue-on-error:\s*true/.test(l))
    expect(blandos, 'un check exigido que se rinde en amarillo no protege nada').toEqual([])
  })

  it('y la documentación nombra los tres, para que no se copien de memoria', () => {
    for (const nombre of EXIGIDOS) {
      expect(doc, `docs/ops/PROTECCION-DE-RAMA.md no menciona \`${nombre}\``).toContain(nombre)
    }
  })
})
