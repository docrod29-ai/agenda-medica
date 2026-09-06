/**
 * LA CIFRA DE SEGURIDAD NO SE PUDRE — REG-253.
 *
 * ── LO QUE PASÓ ─────────────────────────────────────────────────────────────
 *
 * `docs/seguridad/npm-audit-2026-07-30.md` decía, en su columna «después»:
 *
 *     Rama de producción: 8 · 0 high · 8 moderate
 *
 * **Nueve días después**, el mismo comando devolvía **12 · 3 high**. Entre las
 * tres: `pdfjs-dist` con **ejecución arbitraria de JavaScript al abrir un PDF
 * malicioso** — y este producto abre PDF de laboratorio todos los días, así que
 * el camino de ataque era «el laboratorio le manda un PDF al médico».
 *
 * El documento no mintió cuando se escribió: **se pudrió**. Familia
 * `depende_de_recordar`, la misma que el tablero del loop (REG-241): un dato que
 * el sistema ya sabe, y un segundo sitio que lo repite a mano.
 *
 * ── POR QUÉ ÉSTE ES PEOR QUE EL DEL TABLERO ─────────────────────────────────
 *
 * El tablero del loop lo leo yo. **Este documento se le enseña a un comprador.**
 * Una cifra de seguridad obsoleta en una sala de datos no es un despiste: es una
 * afirmación falsa sobre el riesgo de un producto sanitario.
 *
 * ── LAS DOS REPARACIONES ────────────────────────────────────────────────────
 *
 * 1. Se cerraron las tres `high` — `pdfjs-dist` a 6.2.108, y `nanoid` y
 *    `brace-expansion` por `overrides`. Producción quedó en **0 high, 0
 *    critical**.
 * 2. Y lo que impide que vuelva a pasar: la cifra **se deriva** del comando, y
 *    esta prueba falla si el documento y `npm audit` dejan de coincidir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/**
 * EL ARNÉS TENÍA EL MISMO DEFECTO QUE VIGILABA — REG-511.
 *
 * Este lector acababa en `return {}`, y `{}` se lee como cero. Cuando `npm
 * audit` no podía correr —dos `npm` a la vez, por ejemplo— el caso de abajo
 * comparaba el documento contra ceros inventados y fallaba diciendo «el
 * documento y `npm audit` se separaron. Corre el script».
 *
 * Es decir: mandaba a arreglar un documento CORRECTO, y el arreglo habría sido
 * escribir esos mismos ceros. El guardián no sólo no cazaba el defecto: era el
 * camino más corto para provocarlo.
 *
 * Ahora devuelve `null` cuando no pudo medir, y el caso lo dice con esas
 * palabras en vez de acusar al documento. No se salta la comprobación: se
 * declara que no se pudo hacer, que es lo que de verdad pasó.
 */
function auditarProduccion(): { total: number; critical: number; high: number } | null {
  let crudo: string
  try {
    crudo = execSync('npm audit --omit=dev --json', {
      cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (e) {
    /* `npm audit` sale con código ≠ 0 cuando ENCUENTRA algo: es su resultado,
       no un error del arnés. El JSON viene igual por stdout. */
    crudo = (e as { stdout?: string }).stdout ?? ''
  }
  try {
    const v = JSON.parse(crudo)?.metadata?.vulnerabilities
    if (typeof v?.total !== 'number') return null
    return { total: v.total, critical: v.critical ?? 0, high: v.high ?? 0 }
  } catch {
    return null
  }
}

const doc = existsSync(join(process.cwd(), 'docs/seguridad/ESTADO-DEPENDENCIAS.md'))
  ? leer('docs', 'seguridad', 'ESTADO-DEPENDENCIAS.md')
  : ''

describe('el documento existe y está derivado', () => {
  it('tiene el bloque generado, con sus marcas', () => {
    expect(doc).toContain('<!-- CIFRAS-DERIVADAS:INICIO -->')
    expect(doc).toContain('<!-- CIFRAS-DERIVADAS:FIN -->')
  })

  it('dice de dónde salen las cifras', () => {
    /** Sin esa línea, el siguiente que las lea creerá que las escribió alguien. */
    expect(doc).toContain('node scripts/seguridad/auditar.mjs')
    expect(doc).toMatch(/NO se escriben a mano/)
  })
})

describe('las cifras COINCIDEN con el comando, hoy', () => {
  const m = auditarProduccion()

  it('el comando pudo medir — si no, se dice, no se inventa un cero', () => {
    /* REG-511: sin esto, un audit que no corre se leía como «cero avisos». */
    expect(
      m,
      '`npm audit --omit=dev` no devolvió cifras. NO es que el documento esté mal: ' +
        'es que aquí no se pudo medir (suele ser otro `npm` corriendo a la vez). ' +
        'Repita cuando la máquina esté libre; no escriba ceros.',
    ).not.toBeNull()
  })

  it('el total publicado es el real', () => {
    if (!m) return
    const fila = doc.match(/\| Rama de producción[^|]*\| (\d+) \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|/)
    expect(fila, 'no se encontró la fila de producción en el documento').toBeTruthy()
    const [, total, critical, high] = fila!
    expect(
      { total: Number(total), critical: Number(critical), high: Number(high) },
      'El documento y `npm audit` se separaron. Corre: node scripts/seguridad/auditar.mjs',
    ).toEqual({ total: m.total, critical: m.critical, high: m.high })
  })

  it('CERO high y CERO critical en lo que se sirve a los pacientes', () => {
    if (!m) return
    /**
     * Ésta es la compuerta de verdad. No mide el documento: mide el producto.
     * Si mañana entra una `high` en la rama de producción, esto se pone rojo
     * antes de que nadie tenga que acordarse de mirar.
     */
    expect(m.high ?? 0, 'hay vulnerabilidades HIGH en la rama de producción').toBe(0)
    expect(m.critical ?? 0, 'hay vulnerabilidades CRITICAL en la rama de producción').toBe(0)
  })
}, 120_000)

describe('las tres que había quedaron cerradas', () => {
  const pkg = JSON.parse(leer('package.json'))

  it('pdfjs-dist fuera del rango con ejecución arbitraria de JS', () => {
    /**
     * `>=5.6.83 <6.2.108` — GHSA-hq66-cqwq-w95j. El camino de ataque era «el
     * laboratorio le manda un PDF al médico».
     */
    expect(pkg.dependencies['pdfjs-dist']).toBe('^6.2.108')
  })

  it('nanoid, por override: viene de next→postcss', () => {
    expect(pkg.overrides.nanoid).toBe('^3.3.17')
  })

  it('brace-expansion, por override ACOTADO a @capacitor/cli', () => {
    /**
     * ── POR QUÉ ACOTADO, Y NO GLOBAL ──────────────────────────────────────
     *
     * El primer intento puso `brace-expansion: ^5.0.9` global, y **rompió
     * ESLint**: un `minimatch` antiguo del árbol de herramientas espera la API
     * v1/v2 (`expand` como función) y la v5 la cambió. El trinquete de lint
     * hizo lo correcto — falló en vez de pasar en silencio: «un gate que no
     * mide no protege».
     *
     * La vulnerable (>=4.0.0 <5.0.9) sólo vive bajo
     * `@capacitor/cli → rimraf → glob → minimatch`. Las otras copias del árbol
     * son 1.1.x y 2.x, **fuera del rango del aviso**. Acotar el override
     * arregla lo que hay que arreglar sin tocar lo que ya estaba sano.
     */
    expect(pkg.overrides['@capacitor/cli']['brace-expansion']).toBe('^5.0.9')
    expect(pkg.overrides['brace-expansion'], 'global rompe ESLint').toBeUndefined()
  })
})

describe('el script hace lo que dice', () => {
  const s = leer('scripts', 'seguridad', 'auditar.mjs')

  it('lee del comando, no de una constante', () => {
    expect(s).toMatch(/soloProd \? 'npm audit --omit=dev' : 'npm audit'/)
    expect(s).toMatch(/execSync\(`\$\{que\} --json`/)
  })

  it('trata el código de salida ≠ 0 como resultado, no como error', () => {
    /**
     * `npm audit` sale con 1 cuando ENCUENTRA vulnerabilidades. Un script que
     * lo tratara como fallo se quedaría mudo justo cuando hay algo que contar.
     */
    expect(s).toMatch(/cuando ENCUENTRA algo: eso no es un error/)
    expect(s).toMatch(/crudo = e\.stdout \?\? ''/)
  })

  it('pero NO confunde un fallo con un árbol limpio — REG-511', () => {
    /**
     * Hasta el 3-sep-2026 el `catch` acababa en `return {}`, y `{}` se lee como
     * cero. Este caso fijaba esa línea, así que la fijaba rota: un fallo de
     * verdad y un árbol sin vulnerabilidades devolvían lo mismo.
     */
    /* Se mira el CÓDIGO, no la prosa: el comentario del script cuenta la
       historia y nombra `return {}` a propósito. */
    const codigo = s.split('\n').filter(l => !/^\s*[*/]/.test(l)).join('\n')
    expect(codigo, 'volvió el `return {}` que hacía indistinguible el fallo del cero')
      .not.toMatch(/catch\s*\{[^}]*return \{\}/)
    expect(codigo).toMatch(/typeof d\.metadata\.vulnerabilities\.total !== 'number'/)
    expect(codigo).toMatch(/throw new Error/)
  })

  it('AL REVÉS: si `npm audit` no contesta, el documento NO se toca', () => {
    /**
     * La prueba con dientes, y sin fixture: se corre el script DE VERDAD con un
     * `PATH` donde `npm` no existe. Antes de REG-511 eso escribía ceros; ahora
     * tiene que salir con error y dejar el documento exactamente como estaba.
     *
     * Es el caso que reproduce el defecto tal como ocurrió: dos `npm` a la vez
     * dejaron el audit vacío y el script publicó «0 vulnerabilidades» sobre un
     * árbol que tenía 21, tres de ellas `high`.
     */
    const RUTA = join(process.cwd(), 'docs/seguridad/ESTADO-DEPENDENCIAS.md')
    const antes = readFileSync(RUTA, 'utf8')

    let salioMal = false
    let mensaje = ''
    try {
      execSync(`${process.execPath} scripts/seguridad/auditar.mjs`, {
        cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: join(process.cwd(), 'no-existe-a-proposito') },
      })
    } catch (e) {
      salioMal = true
      mensaje = String((e as { stderr?: string; stdout?: string }).stderr ?? '')
    }

    expect(salioMal, 'el script terminó BIEN sin poder medir nada').toBe(true)
    expect(mensaje, 'falló, pero sin decir que la causa es que no pudo medir').toMatch(/REG-511/)
    expect(readFileSync(RUTA, 'utf8'), 'tocó el documento sin haber medido').toBe(antes)
  })

  it('y no puede publicar un árbol completo con MENOS avisos que producción', () => {
    /**
     * Aritmética, no política: `npm audit` sin `--omit=dev` mira un
     * superconjunto. Es la red que habría cazado el defecto aunque el JSON
     * hubiera parseado, porque 0 nunca puede ser menor que 11.
     */
    expect(s).toMatch(/todo\.total < prod\.total/)
    expect(s).toMatch(/NO se escribe nada/)
  })

  it('NO toca el análisis ni las decisiones', () => {
    /** El criterio no sale de un `npm audit`. */
    expect(s).toMatch(/el criterio no sale de un `npm audit`/)
  })

  it('tiene modo --verificar para una compuerta', () => {
    expect(s).toContain('--verificar')
    expect(s).toMatch(/process\.exit\(1\)/)
  })

  it('compara SIN la fecha: importa la cifra, no el día', () => {
    /**
     * Si comparara la fecha, el documento se pondría rojo cada día sin que
     * hubiera cambiado nada — y un rojo diario se aprende a ignorar.
     */
    expect(s).toMatch(/Se compara sin la línea de fecha/)
  })
})
