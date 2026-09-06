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
 *
 * ── UNA QUINTA VEZ, EN OTRO PAPEL — REG-435 ─────────────────────────────────
 *
 * Las cuatro anteriores fueron el TABLERO. La quinta fue el ACTA, que es el
 * documento que alguien abre justo antes de decidir si despliega.
 *
 * `PAQUETE-PRODUCCION-2026-08-27.md` llevaba cinco días encabezado por «Estado:
 * PREPARADO, NO PUBLICADO. Nadie ha desplegado nada» — de un paquete, v1172, que
 * el dueño había publicado el 28-ago con la ejecución #4 del botón. Las actas de
 * v1175, v1176 y v1177 sí se habían cerrado con su aviso de SUPERADO; ésa se
 * quedó atrás, y v1179 iba camino de quedarse igual.
 *
 * Se descubrió comprobando la #15 paso por paso y bajando después a mirar las
 * actas hermanas: la de v1179 se estaba cerrando a mano, como las otras, y «a
 * mano» es precisamente el diagnóstico que este archivo ya tenía escrito.
 *
 * ── POR QUÉ ESTE PAPEL EN CONCRETO ──────────────────────────────────────────
 *
 * Un acta de paquete no es documentación: es la entrada del procedimiento de
 * despliegue. Que la de v1172 dijera «nadie ha desplegado nada» invita a
 * desplegarla otra vez, y un despliegue arrastra TODO lo no desplegado
 * (`.claude/rules/deployment-and-flags.md`). El daño no es un párrafo viejo: es
 * un botón pulsado por una razón falsa.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Un acta de una versión que ya está en producción **no puede seguir diciendo
 * que no se ha publicado**. Se le añade su aviso de SUPERADO con la ejecución
 * que lo confirma — y NO se le borra el estado original: un acta reescrita deja
 * de servir para reconstruir qué se sabía y cuándo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No comprueba que la ejecución citada exista ni que cerrara en verde. Eso
 *   está en GitHub, no en el repositorio, y esta suite no sale a la red.
 * · No comprueba el sentido contrario —un acta que se declare publicada sin
 *   haberlo sido— más allá de exigirle una URL de ejecución.
 * · No dice nada de las versiones POSTERIORES a la de producción: un acta
 *   preparada y aún sin publicar es el caso normal, y debe poder existir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { execFileSync } from 'node:child_process'
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

  it('EL CASO (REG-435): un acta de una versión YA PUBLICADA no dice que no se publicó', () => {
    /**
     * PROBADO AL REVÉS: quitando el aviso de SUPERADO de
     * `PAQUETE-PRODUCCION-2026-08-27.md` este caso cae nombrando ese archivo.
     *
     * Se comparan números de versión, no fechas ni nombres de archivo: hay actas
     * con la versión en el nombre y actas sin ella, y el número es lo único que
     * las dos puntas —acta y tablero— dicen igual.
     */
    const enProduccion = Number(estado.ultimaVersionEnProduccion.version.replace(/\D/g, ''))
    expect(enProduccion, 'la versión de producción no trae número').toBeGreaterThan(0)

    const dir = join(process.cwd(), 'docs', 'maintenance')
    const actas = readdirSync(dir).filter(f => /^PAQUETE-PRODUCCION-.*\.md$/.test(f))
    expect(actas.length, 'no se encontró ni un acta de paquete').toBeGreaterThan(3)

    const sinCerrar: string[] = []
    for (const f of actas) {
      const txt = readFileSync(join(dir, f), 'utf8')
      const m = txt.match(/^# Paquete de producción — `nexusmed-v(\d+)`/m)
      if (!m) continue
      if (Number(m[1]) > enProduccion) continue   // aún sin publicar: es lo normal

      // El aviso de cierre, con la ejecución que lo confirma. Sin la URL sería
      // una afirmación sin evidencia, que es el defecto que cerró REG-505.
      const cerrada = /SUPERADO/.test(txt) && /actions\/runs\/\d+/.test(txt)
      if (!cerrada) sinCerrar.push(`${f} (v${m[1]})`)
    }

    expect(
      sinCerrar,
      `producción sirve v${enProduccion}, y estas actas de versiones ya publicadas ` +
      'siguen sin su aviso de SUPERADO con la ejecución que lo confirma: ' +
      `${sinCerrar.join(', ')}. Un acta que dice «nadie ha desplegado nada» de algo ` +
      'ya desplegado invita a desplegarlo otra vez.',
    ).toEqual([])
  })

  it('y al cerrarla NO se le borra el estado original', () => {
    /**
     * La otra mitad de la regla, y la que se rompe sin querer: al cerrar la de
     * v1179 se sustituyó su «PREPARADO, NO PUBLICADO» por «PUBLICADO», que es
     * más limpio de leer y destruye el dato de qué se sabía al escribirla.
     *
     * Las actas ya cerradas lo dicen con sus palabras: «un acta que se reescribe
     * deja de servir para reconstruir qué se sabía y cuándo».
     */
    const dir = join(process.cwd(), 'docs', 'maintenance')
    const sinOriginal = readdirSync(dir)
      .filter(f => /^PAQUETE-PRODUCCION-.*\.md$/.test(f))
      .filter(f => {
        const txt = readFileSync(join(dir, f), 'utf8')
        return /SUPERADO/.test(txt) && !/Estado: PREPARADO, NO PUBLICADO/.test(txt)
      })
    expect(
      sinOriginal,
      `a estas actas se les borró el estado con el que nacieron: ${sinOriginal.join(', ')}. ` +
      'El aviso de SUPERADO se AÑADE; el original se queda.',
    ).toEqual([])
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

/**
 * ── EL TABLERO QUE LEE UNA PERSONA, TAMBIÉN — REG-564 ───────────────────────
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

