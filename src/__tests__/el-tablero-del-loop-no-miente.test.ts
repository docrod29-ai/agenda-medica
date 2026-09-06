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
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { execFileSync } from 'node:child_process'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const estado = JSON.parse(leer('agent-state', 'MASTER_STATE.json'))

describe('el tablero coincide con el repositorio', () => {
  it('la versión que dice es la que hay en disco', () => {
    /**
     * `public/version.txt` lo escribe el propio ciclo de despliegue. Si el
     * tablero dice otra cosa, el tablero está mintiendo.
     */
    const enDisco = leer('public', 'version.txt').trim()
    expect(
      estado.ultimaVersionEnProduccion,
      `El tablero dice ${estado.ultimaVersionEnProduccion} y en disco hay ${enDisco}. ` +
      'Corre: node scripts/agent-state/actualizar.mjs',
    ).toBe(enDisco)
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

/**
 * ── EL TABLERO QUE LEE UNA PERSONA, TAMBIÉN — REG-519 ───────────────────────
 *
 * Todo lo de arriba vigila `agent-state/MASTER_STATE.json`, que es la memoria de
 * la máquina. `docs/product/AUSCULTA-MASTER-BOARD.md` es el tablero que lee una
 * persona, y su estado estaba **escrito a mano** — con la cabecera diciendo que
 * «el estado sale del código leído hoy».
 *
 * Al mirarlo, la ficha decía SHA `ba9d7a2f` y fecha 29-ago con el árbol quince
 * REG por delante, mientras el censo del programa decía otra cosa. Dos respuestas
 * a «¿en qué estado está WS-04?».
 *
 * Es el mismo diagnóstico que este archivo ya llevaba escrito para la memoria de
 * la máquina —«mientras no lo derive un script, va a volver a pasar»— aplicado
 * al documento de al lado, once meses después.
 */
describe('el tablero de la persona tampoco se escribe a mano', () => {
  it('el bloque derivado existe, con sus marcas', () => {
    const tablero = leer('docs', 'product', 'AUSCULTA-MASTER-BOARD.md')
    expect(tablero).toContain('<!-- CENSO-DERIVADO:INICIO -->')
    expect(tablero).toContain('<!-- CENSO-DERIVADO:FIN -->')
  })

  it('y coincide con el censo: si no, está viejo', () => {
    /**
     * AL REVÉS del estado anterior: cerrar un requisito y no tocar el tablero
     * dejaba el tablero mintiendo, y nada se ponía rojo. Ahora esto cae.
     */
    const salida = execFileSync('node', ['scripts/programa/tablero-derivado.mjs', '--verificar'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(salida).toContain('coincide con el censo')
  })

  it('lo DERIVADO no incluye el criterio, que se sigue escribiendo a mano', () => {
    /**
     * La línea que trazó REG-241 y que sigue siendo la correcta: se deriva el
     * estado, no la decisión. Un generador que además escribiera «qué hacer a
     * continuación» estaría inventando criterio con aspecto de dato.
     */
    const tablero = leer('docs', 'product', 'AUSCULTA-MASTER-BOARD.md')
    const i = tablero.indexOf('<!-- CENSO-DERIVADO:INICIO -->')
    const j = tablero.indexOf('<!-- CENSO-DERIVADO:FIN -->')
    const bloque = tablero.slice(i, j)
    expect(bloque).toContain('no sale de un `grep`')
    /* El bloque cuenta y nombra; no recomienda. */
    expect(bloque).not.toMatch(/lo siguiente es|hay que empezar por|prioridad: /i)
  })

  it('los bloqueados fuera dicen QUÉ los desbloquea, y no es código', () => {
    /* Un «BLOCKED_EXTERNAL» sin la frase que lo desbloquea es un aparcamiento. */
    const tablero = leer('docs', 'product', 'AUSCULTA-MASTER-BOARD.md')
    const bloque = tablero.slice(
      tablero.indexOf('### Bloqueados fuera'),
      tablero.indexOf('<!-- CENSO-DERIVADO:FIN -->'),
    )
    const filas = bloque.split('\n').filter(l => l.startsWith('| `'))
    expect(filas.length).toBeGreaterThan(5)
    for (const f of filas) {
      expect(f, `sin desbloqueo: ${f.slice(0, 60)}`).not.toMatch(/\|\s*—\s*\|/)
    }
  })
})

