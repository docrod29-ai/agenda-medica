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

function auditarProduccion() {
  try {
    const out = execSync('npm audit --omit=dev --json', {
      cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    })
    return JSON.parse(out)
  } catch (e) {
    /* `npm audit` sale con código ≠ 0 cuando ENCUENTRA algo: es su resultado,
       no un error del arnés. El JSON viene igual por stdout. */
    const stdout = (e as { stdout?: string }).stdout
    try { return JSON.parse(stdout ?? '{}') } catch { return {} }
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
  const m = auditarProduccion()?.metadata?.vulnerabilities ?? {}

  it('el total publicado es el real', () => {
    const fila = doc.match(/\| Rama de producción[^|]*\| (\d+) \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|/)
    expect(fila, 'no se encontró la fila de producción en el documento').toBeTruthy()
    const [, total, critical, high] = fila!
    expect(
      { total: Number(total), critical: Number(critical), high: Number(high) },
      'El documento y `npm audit` se separaron. Corre: node scripts/seguridad/auditar.mjs',
    ).toEqual({ total: m.total ?? 0, critical: m.critical ?? 0, high: m.high ?? 0 })
  })

  it('CERO high y CERO critical en lo que se sirve a los pacientes', () => {
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
    expect(s).toMatch(/npm audit\$\{soloProd \? ' --omit=dev' : ''\} --json/)
  })

  it('trata el código de salida ≠ 0 como resultado, no como error', () => {
    /**
     * `npm audit` sale con 1 cuando ENCUENTRA vulnerabilidades. Un script que
     * lo tratara como fallo se quedaría mudo justo cuando hay algo que contar.
     */
    expect(s).toMatch(/cuando ENCUENTRA algo: eso no es un error/)
    expect(s).toMatch(/JSON\.parse\(e\.stdout \?\? '\{\}'\)/)
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
