/**
 * LA PUERTA DE LIBERACIÓN SIGUE CERRADA.
 *
 * ── QUÉ VIGILA ───────────────────────────────────────────────────────────────
 *
 * El §H6 del charter fija nueve cosas que deben dar **cero** para poder liberar.
 * `docs/evals/PUERTA-DE-LIBERACION.md` dice cuáles son y qué prueba protege cada
 * una.
 *
 * Esta prueba no mide el cero. Comprueba algo más humilde y más fácil de perder:
 * **que el mecanismo que lo vigila siga en pie**.
 *
 * ── POR QUÉ HACE FALTA ───────────────────────────────────────────────────────
 *
 * Un documento que dice «esto está protegido por tal prueba» envejece solo. Se
 * renombra un archivo, se fusiona una suite, se borra algo que parecía duplicado
 * — y el documento sigue afirmándolo con la misma seguridad del primer día.
 *
 * Es el mismo fallo que el guardián de la sala de datos ya cazó una vez: yo
 * escribí «49 REG» cuando eran 48, en el documento cuya primera línea prohíbe la
 * tracción falsa. Una casilla marcada que nadie comprueba es peor que una vacía:
 * la vacía se ve.
 *
 * ── LO QUE NO PRUEBA, DICHO AQUÍ PARA QUE NADIE LO SUPONGA ───────────────────
 *
 * Que un archivo exista no significa que su contenido siga cubriendo el peligro.
 * Esta prueba detecta la desaparición, no el vaciamiento. El vaciamiento lo
 * detecta el sello de invariantes (`invariantes-clinicos.json`), que cuenta los
 * casos de cada archivo y no deja que encojan.
 *
 * Las dos juntas cubren las dos formas de perder una protección sin enterarse:
 * que se borre y que se ahueque.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const DOC = join(RAIZ, 'docs/evals/PUERTA-DE-LIBERACION.md')

/**
 * Los nueve del §H6, con las pruebas que hoy los protegen.
 *
 * `debil: true` marca los que el propio documento declara insuficientes. Están
 * escritos como débiles A PROPÓSITO: preferimos una fila que dice «esto está
 * flojo» a una fila verde que nadie volvió a mirar.
 */
const LOS_NUEVE: ReadonlyArray<{
  n: number
  cero: string
  pruebas: readonly string[]
  debil?: true
}> = [
  {
    n: 1,
    cero: 'paciente equivocado',
    pruebas: ['paciente-equivocado-guardia.test.ts', 'pacientes-duplicados.test.ts'],
    debil: true,
  },
  {
    n: 2,
    cero: 'error de medicación silencioso',
    pruebas: [
      'seguridad-dosis.test.ts',
      'dosis-avisa-antes-de-firmar.test.ts',
      'la-sobredosis-se-ve-antes-de-firmar.test.ts',
    ],
  },
  {
    n: 3,
    cero: 'error de unidad silencioso',
    pruebas: [
      'guardas-unidad-clinica.test.ts',
      'dosis-unidad-ausente.test.ts',
      'motores-unidad-cruzada.test.ts',
    ],
  },
  {
    n: 4,
    cero: 'negación invertida silenciosa',
    pruebas: [
      'como-se-dice-que-no-en-una-consulta.test.ts',
      'negacion-parser.test.ts',
      'negacion-diagnostico-inventado.test.ts',
      'alergias-negacion.test.ts',
    ],
  },
  {
    n: 5,
    cero: 'cita fabricada',
    pruebas: ['evidence-model.test.ts', 'uci-evidencia-seguridad.test.ts'],
  },
  {
    n: 6,
    cero: 'orden activa no confirmada',
    pruebas: ['intencion-de-orden.test.ts', 'ordenes-medicamento.test.ts'],
  },
  {
    n: 7,
    cero: 'acceso entre consultorios',
    pruebas: ['whatsapp-tenant.test.ts'],
    debil: true,
  },
  {
    n: 8,
    cero: 'pérdida de datos',
    pruebas: ['la-proxima-consulta-no-se-pierde.test.ts', 'el-plan-no-se-borra-de-un-clic.test.ts'],
  },
  {
    n: 9,
    cero: 'pago duplicado',
    pruebas: ['webhook-stripe-salud.test.ts', 'stripe-prueba-una-vez.test.ts'],
  },
]

describe('la puerta de liberación sigue cerrada', () => {
  it('el documento del §H6 existe', () => {
    expect(existsSync(DOC)).toBe(true)
  })

  it('son exactamente nueve, ni ocho ni diez', () => {
    expect(LOS_NUEVE).toHaveLength(9)
    expect(new Set(LOS_NUEVE.map(x => x.n)).size).toBe(9)
  })

  it.each(LOS_NUEVE)('«$cero» tiene al menos una prueba viva', ({ pruebas }) => {
    const vivas = pruebas.filter(p => existsSync(join(RAIZ, 'src/__tests__', p)))
    expect(vivas.length).toBeGreaterThan(0)
  })

  it('ninguna prueba citada aquí ha desaparecido', () => {
    const muertas: string[] = []
    for (const z of LOS_NUEVE) {
      for (const p of z.pruebas) {
        if (!existsSync(join(RAIZ, 'src/__tests__', p))) muertas.push(`${z.cero} → ${p}`)
      }
    }
    expect(muertas).toEqual([])
  })

  it('el documento nombra los nueve ceros', () => {
    const texto = readFileSync(DOC, 'utf8').toLowerCase()
    const faltan = LOS_NUEVE.filter(z => !texto.includes(z.cero.toLowerCase()))
    expect(faltan.map(z => z.cero)).toEqual([])
  })

  it('el documento declara los débiles como débiles, no como verdes', () => {
    const texto = readFileSync(DOC, 'utf8')
    const debiles = LOS_NUEVE.filter(z => z.debil)

    // Que existan débiles no es un fallo: es el estado real. El fallo sería
    // que el documento los pintara de verde.
    expect(debiles.length).toBeGreaterThan(0)
    expect(texto).toContain('DÉBIL')

    for (const z of debiles) {
      const fila = texto
        .split('\n')
        .find(l => l.startsWith(`| ${z.n} |`))
      expect(fila, `falta la fila del cero ${z.n}`).toBeDefined()
      expect(fila, `el cero ${z.n} está marcado verde y es débil`).toContain('DÉBIL')
    }
  })

  it('el documento no afirma que el cero garantice ausencia de error', () => {
    const texto = readFileSync(DOC, 'utf8')
    // La frase que impide leer esta puerta como una garantía. Si alguien la
    // quita para que el documento «venda mejor», esto se cae.
    expect(texto).toContain('no significa que el error no pueda ocurrir')
  })
})
