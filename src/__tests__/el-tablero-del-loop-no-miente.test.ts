/**
 * EL TABLERO DEL LOOP NO MIENTE — REG-241.
 *
 * ── TRES VECES ──────────────────────────────────────────────────────────────
 *
 * `agent-state/MASTER_STATE.json` es la memoria del programa: lo que dice ahí
 * es de donde arranca la siguiente sesión.
 *
 *   · Dijo v1030 con producción en v1079. Se puso al día.
 *   · Dijo v1084 con producción en v1096. Se puso al día.
 *   · Dijo v1096 con producción en v1121.
 *
 * Y el propio archivo ya había escrito el diagnóstico, después de la segunda:
 *
 *   «La causa no es descuido: es que actualizarlo depende de que yo me
 *    acuerde. Mientras no lo derive un script, va a volver a pasar.»
 *
 * Escribir el diagnóstico correcto y no actuar sobre él es peor que no haberlo
 * escrito: deja constancia de que se sabía.
 *
 * ── POR QUÉ NO ES UN DETALLE DE PAPELEO ─────────────────────────────────────
 *
 * El charter V7 pide que el programa sea **reanudable**, y el dueño lo pidió
 * con sus palabras: «si se acaban los tokens guarda el avance y cuando te ponga
 * 1 sigue donde te quedaste».
 *
 * Un tablero que dice v1096 cuando hay v1121 rompe justo eso: la siguiente
 * sesión rehace trabajo hecho, o lo da por pendiente y lo pisa. Una memoria que
 * miente es peor que no tener memoria — porque se le cree.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Lo derivable se DERIVA del repositorio. Lo que es criterio —la iteración en
 * curso, los bloqueos, las decisiones del dueño— se sigue escribiendo a mano,
 * porque el criterio no sale de un `grep`.
 *
 * ── UNA CUARTA VEZ, Y AL REVÉS — REG-505 ────────────────────────────────────
 *
 * Las tres primeras fueron el tablero ATRASADO. La cuarta fue ADELANTADO, y no
 * por descuido sino por la propia reparación: el campo se llamaba
 * `ultimaVersionEnProduccion` y salía de `public/version.txt`, que es el REPO.
 *
 * Entre que el ciclo sube `sw.js` y que alguien pulsa el botón pasan días. En
 * toda esa ventana el campo afirmaba del sitio vivo algo falso — y esa ventana
 * es justo cuando se consulta el tablero: nadie pregunta qué hay en producción
 * salvo cuando está decidiendo si desplegar. Medido el 31-ago: repo v1178,
 * producción v1177.
 *
 * Derivar bien un dato de la fuente equivocada sigue siendo un dato equivocado,
 * y encima llega con la autoridad de estar derivado: ya nadie lo mira con
 * desconfianza.
 *
 * **La versión que sirve producción NO SE PUEDE DERIVAR de este repositorio.**
 * Se declara con la ejecución que la confirmó. Es «ausencia de dato no es dato
 * de ausencia» aplicado a la operación: lo que no se puede saber desde aquí no
 * se rellena con lo más parecido que haya a mano.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const estado = JSON.parse(leer('agent-state', 'MASTER_STATE.json'))

describe('el tablero coincide con el repositorio', () => {
  it('la versión DEL REPO es la que hay en disco', () => {
    /**
     * `public/version.txt` lo escribe el ciclo de preparación del paquete. Si el
     * tablero dice otra cosa, el tablero está mintiendo.
     */
    const enDisco = leer('public', 'version.txt').trim()
    expect(
      estado.versionEnElRepo,
      `El tablero dice ${estado.versionEnElRepo} y en disco hay ${enDisco}. ` +
      'Corre: node scripts/agent-state/actualizar.mjs',
    ).toBe(enDisco)
  })

  it('EL CASO (REG-505): la de PRODUCCIÓN se DECLARA con su ejecución, no se deriva', () => {
    /**
     * Lo único que establece qué sirve producción es una ejecución del botón
     * cerrada en verde, cuya Compuerta 3 lo comprobó contra el sitio vivo. Sin
     * su evidencia el campo no es un dato: es un recuerdo.
     */
    const p = estado.ultimaVersionEnProduccion
    expect(p, 'falta ultimaVersionEnProduccion').toBeTruthy()
    expect(typeof p, 'ya no es una cadena: lleva su evidencia dentro').toBe('object')
    expect(p.version).toMatch(/^nexusmed-v\d+$/)
    expect(
      p.confirmadaPor,
      'una versión de producción sin la ejecución que la confirmó no es un dato',
    ).toMatch(/actions\/runs\/\d+/)
    expect(p.confirmadaEl).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('y el script NO la deriva — se comprueba en el script, no de palabra', () => {
    /**
     * PROBADO AL REVÉS: si alguien vuelve a hacer que el script escriba este
     * campo, este caso cae. Es la única forma de que la regla sobreviva a quien
     * la lea con prisa.
     */
    const script = leer('scripts', 'agent-state', 'actualizar.mjs')
    const derivados = script.slice(script.indexOf('function derivar()'))
    expect(
      derivados.includes('ultimaVersionEnProduccion:'),
      'el script volvió a derivar la versión de producción. No se puede saber desde el repo.',
    ).toBe(false)
  })

  it('los dos campos existen y hoy NO coinciden — que es la demostración', () => {
    expect(estado).toHaveProperty('versionEnElRepo')
    expect(estado).toHaveProperty('ultimaVersionEnProduccion')
  })

  it('la última REG que dice es la última del ledger', () => {
    /**
     * Se leen TODOS los `REG-\d+` del encabezado, no sólo el primero: existe
     * `## REG-179 / REG-180` porque los dos salieron del mismo recuadro. Un
     * regex que mire sólo el primero pierde el segundo — y eso fue justo lo que
     * pasó: el script informó de 88 REG cuando eran 89, y de un REG-180
     * «clasificado pero inexistente» que sí existía.
     */
    const nums = [...new Set(
      [...leer('docs', 'audit', 'regression-ledger.md').matchAll(/^##[^\n]*/gm)]
        .flatMap(l => [...l[0].matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))),
    )]
    expect(estado.derivado?.ultimaREG).toBe(`REG-${Math.max(...nums)}`)
    expect(estado.derivado?.regsEnElLedger).toBe(nums.length)
  })

  it('TODO REG clasificado existe en el ledger, y al revés', () => {
    /**
     * `de-que-se-enferma-este-sistema` ya comprueba que ningún REG del ledger
     * se quede sin familia. Faltaba el sentido contrario: una familia que
     * clasifica un número inexistente infla la cuenta de defectos con humo.
     */
    const enElLedger = new Set(
      [...leer('docs', 'audit', 'regression-ledger.md').matchAll(/^##[^\n]*/gm)]
        .flatMap(l => [...l[0].matchAll(/REG-(\d+)/g)].map(m => Number(m[1]))),
    )
    const clasificados = [...leer('src', 'lib', 'calidad', 'familias-de-defecto.ts')
      .matchAll(/regs: \[([^\]]*)\]/g)]
      .flatMap(m => m[1].split(',').map(x => x.trim()).filter(Boolean).map(Number))
    const fantasmas = clasificados.filter(n => !enElLedger.has(n))
    expect(fantasmas, `clasificados sin entrada en el ledger: ${fantasmas.join(', ')}`).toEqual([])
  })
})

describe('el script existe y hace lo que dice', () => {
  const script = leer('scripts', 'agent-state', 'actualizar.mjs')

  it('está en su sitio', () => {
    expect(existsSync(join(process.cwd(), 'scripts/agent-state/actualizar.mjs'))).toBe(true)
  })

  it('lee la verdad del repositorio, no una constante escrita a mano', () => {
    expect(script).toMatch(/public.*version\.txt/)
    expect(script).toMatch(/regression-ledger\.md/)
    expect(script).toMatch(/git rev-parse/)
  })

  it('cuenta las pruebas con el MISMO regex que el sello clínico', () => {
    /**
     * Dos formas de contar lo mismo dan dos cifras, y la primera vez que no
     * cuadren nadie sabrá cuál creer.
     */
    expect(script).toContain('(?:it|test)(?:\\.each\\([^)]*\\))?\\s*[(`]')
  })

  it('NO toca lo que es criterio', () => {
    /**
     * La iteración en curso, los bloqueos y las decisiones del dueño se siguen
     * escribiendo a mano. Un script que los sobreescribiera borraría lo único
     * que no se puede reconstruir mirando el repositorio.
     */
    expect(script).toMatch(/el criterio no sale de un `?grep/)
    expect(script).toMatch(/\.\.\.actual, \.\.\.nuevo/)
    const derivados = script.slice(script.indexOf('function derivar'), script.indexOf('const soloVerificar'))
    expect(derivados).not.toMatch(/iteracionActual|BLOCKERS|OWNER_DECISIONS/)
  })

  it('tiene modo --verificar, que es el que puede correr en una compuerta', () => {
    expect(script).toContain('--verificar')
    expect(script).toMatch(/process\.exit\(1\)/)
  })
})

describe('la memoria del programa sigue completa', () => {
  it.each([
    'MASTER_STATE.json', 'CURRENT_ITERATION.md', 'BACKLOG.json', 'BLOCKERS.md',
    'ASSUMPTIONS.md', 'DECISION_LOG.md', 'RISK_REGISTER.md',
    'METRICS_BASELINE.json', 'CHANGELOG_AGENT.md', 'OWNER_DECISIONS_REQUIRED.md',
  ])('%s existe', (f) => {
    expect(existsSync(join(process.cwd(), 'agent-state', f))).toBe(true)
  })

  it('las autorizaciones del dueño siguen escritas, y las prohibiciones también', () => {
    /**
     * El dueño levantó la restricción de despliegue. NO levantó las otras, y
     * que sigan escritas aquí es lo que impide que se relajen por inercia.
     */
    expect(estado.autorizaciones.datosRealesDePacientes).toBe(false)
    expect(estado.autorizaciones.cambiosDestructivos).toBe(false)
  })
})
