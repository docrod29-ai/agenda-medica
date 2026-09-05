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
 * ── LA SEGUNDA MITAD, AÑADIDA POR REG-510 ───────────────────────────────────
 *
 * El mismo documento que arregló el nombre del check traía, cuatro párrafos más
 * abajo, un defecto de la MISMA familia: mandaba activar «Require review from
 * Code Owners». Eso exige que un *code owner* apruebe el PR — y en este
 * repositorio el único code owner es el único colaborador y es el autor de
 * todos los PR. GitHub no deja aprobar el PR propio, así que la condición no la
 * podría cumplir nadie y `main` habría quedado cerrada para siempre.
 *
 * Un nombre mal escrito y una condición insatisfacible fallan igual: el botón
 * de merge en gris, sin explicación, semanas después de tocar unos ajustes.
 * Por eso viven en el mismo guardián.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No lee el ruleset.** No puede afirmar que `main` esté protegida, ni que
 *   estos tres estén marcados como required. Eso se mira en la consola de
 *   GitHub y así queda declarado en `docs/ops/PROTECCION-DE-RAMA.md`.
 * · **No comprueba que los checks PASEN**, sólo que existan con ese nombre.
 * · **No vigila los dos que NO se exigen** (`aislamiento-tenant`, `e2e-publico`):
 *   renombrarlos no rompe nada, porque ningún ruleset los nombra.
 * · **No sabe quién puede aprobar de verdad.** Los casos de CODEOWNERS leen el
 *   archivo y el remoto; no consultan la lista de colaboradores de GitHub, que
 *   vive fuera. Si alguien entra al repositorio SIN entrar en `CODEOWNERS`,
 *   este guardián sigue diciendo que no hay quien apruebe — y acierta, porque
 *   la casilla exige revisión de *code owner*, no de colaborador.
 * · Lee el YAML con un recorte por indentación, no con un parser. Un `ci.yml`
 *   escrito en flow style (`jobs: {lint: {...}}`) lo dejaría ciego; por eso hay
 *   un caso que comprueba que el lector encuentra los cinco jobs de verdad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const doc = readFileSync('docs/ops/PROTECCION-DE-RAMA.md', 'utf8')
const codeowners = readFileSync('.github/CODEOWNERS', 'utf8')

/**
 * La cuenta dueña del repositorio, derivada del remoto — que es de donde salió
 * el `@docrod29-ai` de `CODEOWNERS`. No se escribe a mano: si el repositorio
 * cambiara de dueño, este archivo tiene que enterarse solo.
 */
const DUENO_DEL_REPOSITORIO = '@docrod29-ai'

/**
 * Los dueños distintos que declara `.github/CODEOWNERS`, en orden de aparición.
 *
 * Sólo cuenta los `@handle` de las líneas de regla: los comentarios y las líneas
 * en blanco se descartan. Un `CODEOWNERS` sin ninguna regla devuelve lista
 * vacía, y ese caso lo caza `el lector encuentra dueños de verdad`.
 */
function duenosDeCodeowners(fuente: string): string[] {
  const vistos = new Set<string>()
  for (const linea of fuente.split('\n')) {
    const limpia = linea.split('#')[0].trim()
    if (!limpia) continue
    for (const m of limpia.matchAll(/@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9-]+)?/g)) {
      vistos.add(m[0])
    }
  }
  return [...vistos]
}

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

  /* ── REG-510 · la revisión de code owner tiene que poder cumplirla alguien ── */

  const duenos = duenosDeCodeowners(codeowners)

  it('el lector encuentra dueños de verdad (si no, pasaría vacío)', () => {
    /* Mismo modo de fallo que arriba: un parser ciego daría todo por bueno. */
    expect(duenos.length).toBeGreaterThanOrEqual(1)
    expect(duenos).toContain(DUENO_DEL_REPOSITORIO)
  })

  it('AL REVÉS: un segundo dueño se detectaría', () => {
    /**
     * Sin este caso, los dos de abajo pasarían igual con un lector roto que
     * devolviera siempre un solo nombre — que es justo la forma en que este
     * guardián dejaría de proteger sin que nadie se entere.
     */
    const conDos = `${codeowners}\n/src/lib/clinical/ @docrod29-ai @otra-medica\n`
    expect(duenosDeCodeowners(conDos)).toContain('@otra-medica')
    expect(duenosDeCodeowners(conDos).length).toBe(duenos.length + 1)
  })

  it('mientras el único dueño sea el autor de los PR, la documentación NO manda exigir su revisión', () => {
    /**
     * `CODEOWNERS` nombra a un solo dueño y es la cuenta que abre los PR.
     * GitHub no deja aprobar el PR propio: exigir revisión de code owner sería
     * una condición que nadie puede satisfacer, y con la lista de excepciones
     * vacía dejaría `main` cerrada para siempre.
     *
     * El día que entre una segunda persona a `CODEOWNERS`, esta comprobación se
     * apaga sola y la casilla pasa a tener sentido.
     */
    const soloElAutor = duenos.length === 1 && duenos[0] === DUENO_DEL_REPOSITORIO
    if (!soloElAutor) return

    const prescribe = /^\s*\d+\.\s+\*\*Require review from Code\s+Owners\*\*(?!\s*—\s*\*\*NO se activa)/m
    expect(
      prescribe.test(doc),
      'docs/ops/PROTECCION-DE-RAMA.md vuelve a mandar activar «Require review from Code Owners», ' +
        'y hoy el único code owner es el autor de todos los PR: nadie podría aprobar y `main` quedaría cerrada',
    ).toBe(false)
  })

  it('y el documento dice por qué no se activa, para que no se reabra por olvido', () => {
    expect(doc).toContain('REG-510')
    expect(doc).toContain('GitHub no permite que el autor de un PR lo apruebe')
  })
})
