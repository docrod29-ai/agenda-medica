/**
 * UN ADR NO PUEDE CITAR ALGO QUE NO EXISTE — §5.1 del charter V7.
 *
 * ── POR QUÉ ESTE GUARDIÁN ────────────────────────────────────────────────────
 *
 * Un registro de decisión sirve para **impedir que una decisión tomada con un
 * dato delante se deshaga meses después por alguien que no vio ese dato**. Para
 * eso tiene que ser cierto hoy, no el día que se escribió.
 *
 * El modo de fallo es siempre el mismo en este repositorio: el documento cita un
 * archivo, una prueba o una regla que se renombró — y entonces **declara un
 * control que no está**. Es «escrito y sin conectar» aplicado a la arquitectura.
 *
 * Esta prueba no juzga si las decisiones son buenas. Comprueba que lo que citan
 * exista, y que cada ADR traiga las tres partes que lo hacen útil: alternativas
 * descartadas, consecuencias aceptadas, y cómo se hace cumplir.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'docs/decisions'
const archivos = readdirSync(join(process.cwd(), DIR))
  .filter(f => f.startsWith('ADR-') && f.endsWith('.md'))
  .sort()

const leer = (f: string) => readFileSync(join(process.cwd(), DIR, f), 'utf8')

describe('el directorio de decisiones tiene contenido', () => {
  it('hay ADR escritos', () => {
    expect(archivos.length).toBeGreaterThanOrEqual(4)
  })

  it('están numerados sin saltos', () => {
    const nums = archivos.map(f => Number(f.match(/ADR-(\d{3})/)![1]))
    expect(nums).toEqual(nums.map((_, i) => i + 1))
  })

  it('el índice los lista a todos', () => {
    const readme = readFileSync(join(process.cwd(), DIR, 'README.md'), 'utf8')
    for (const f of archivos) {
      expect(readme, `${f} no está en el índice`).toContain(f)
    }
  })
})

describe('cada ADR trae lo que lo hace útil', () => {
  for (const f of archivos) {
    const doc = leer(f)
    const id = f.slice(0, 7)

    it(`${id} declara su estado y su fecha`, () => {
      expect(doc).toMatch(/\*\*Estado\*\*: (Vigente|SUSTITUIDO POR ADR-\d{3})/)
      expect(doc).toMatch(/\*\*Fecha\*\*: /)
    })

    it(`${id} escribe las alternativas descartadas`, () => {
      /**
       * Un ADR sin alternativas no documenta una decisión: documenta un hecho
       * consumado. Lo valioso de un ADR es saber qué se consideró y por qué se
       * dejó — es lo que impide volver a proponerlo dentro de seis meses.
       */
      expect(doc).toContain('## Alternativas descartadas')
      const bloque = doc.slice(doc.indexOf('## Alternativas descartadas'), doc.indexOf('## Consecuencias'))
      expect(bloque.match(/\*\*\d\./g)?.length ?? 0,
        `${id} debería listar al menos dos alternativas`).toBeGreaterThanOrEqual(2)
    })

    it(`${id} escribe las consecuencias ACEPTADAS, incluidas las malas`, () => {
      // Toda decisión de arquitectura cuesta algo. Callarlo hace que el coste se
      // descubra tarde y parezca un defecto en vez de una decisión.
      expect(doc).toContain('## Consecuencias')
      expect(doc).toMatch(/\*\*Aceptadas/)
    })

    it(`${id} dice cómo se hace cumplir`, () => {
      // Una decisión sin mecanismo que la sostenga se erosiona sola.
      expect(doc).toContain('## Cómo se hace cumplir')
    })
  }
})

describe('lo que citan existe de verdad', () => {
  const todos = archivos.map(leer).join('\n')

  const rutas = [...todos.matchAll(/`(src\/[\w/\-.[\]]+\.tsx?)`/g)].map(m => m[1])
  const pruebas = [...todos.matchAll(/`(src\/__tests__\/[\w-]+\.test\.ts)`/g)].map(m => m[1])

  it('citan archivos y pruebas concretas', () => {
    expect(rutas.length + pruebas.length).toBeGreaterThanOrEqual(6)
  })

  for (const ruta of [...new Set([...rutas, ...pruebas])]) {
    it(`«${ruta}» existe`, () => {
      expect(
        existsSync(join(process.cwd(), ruta)),
        `un ADR cita ${ruta} y no está en el repositorio`,
      ).toBe(true)
    })
  }
})

describe('las decisiones clínicas NO se disfrazan de ADR', () => {
  it('el índice lo dice explícitamente', () => {
    /**
     * Un ADR es de software. Meter aquí una decisión clínica del médico haría
     * parecer que el sistema decidió algo que no le corresponde — y esas viven
     * en el regression-ledger y en OWNER_DECISIONS_REQUIRED.
     */
    const readme = readFileSync(join(process.cwd(), DIR, 'README.md'), 'utf8')
    expect(readme).toContain('Las decisiones clínicas del médico dueño no son ADR')
  })

  it('ninguno fija un umbral clínico', () => {
    const todos = archivos.map(leer).join('\n')
    // Un ADR que fije mg, mg/kg o un punto de corte estaría tomando una decisión
    // clínica bajo forma de decisión de arquitectura.
    expect(todos).not.toMatch(/se establece (el|un) (umbral|punto de corte|máximo) de \d/i)
  })
})

describe('ninguno se borra: se sustituye', () => {
  it('la regla está escrita', () => {
    const readme = readFileSync(join(process.cwd(), DIR, 'README.md'), 'utf8')
    expect(readme).toContain('Nunca se borra un ADR')
  })
})
