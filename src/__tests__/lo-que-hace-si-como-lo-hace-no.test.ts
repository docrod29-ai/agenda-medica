/**
 * SE DICE LO QUE HACE, NUNCA CÓMO LO HACE — REG-292.
 *
 * ── LA REGLA, EN PALABRAS DEL DUEÑO ─────────────────────────────────────────
 *
 *   *«la manera en que funciona la app no debe de enseñarse, sólo se menciona
 *    lo que puede ser para promocionar, sólo lo que hace, no cómo lo hace»*
 *
 * Y antes, sobre la pantalla que yo había puesto en su menú:
 *
 *   *«al cliente le importan lo funcional y lo que va a hacer… hay muchas cosas
 *    que no sabe ni qué es, así que eso escóndelo»*
 *
 * ── LO QUE ESTABA EXPUESTO ──────────────────────────────────────────────────
 *
 * · **`/motores`** — una pantalla mía, puesta en el menú del médico entre
 *   Antibiograma y Lista de espera. Habla de reparaciones, de números internos y
 *   de «lo que hacía antes». Error de producto mío.
 *
 * · **`/arquitectura`** — enlazada **dos veces desde la portada**: un botón que
 *   decía «Ver los 10 motores» y un enlace en el pie. Nombra los motores por
 *   dentro y explica cuáles corren con código y cuáles con IA.
 *
 * · **«Ver cómo razona la IA en vivo»** — el verbo era «cómo». Ahora dice qué se
 *   ve, no cómo se hace.
 *
 * ── POR QUÉ IMPORTA, Y NO ES SÓLO ESTÉTICA ──────────────────────────────────
 *
 * Dos motivos, y los dos son del dueño:
 *
 * 1. **Es suyo.** El diseño interno de los motores es lo que distingue este
 *    producto; publicarlo en la portada es regalarle el mapa a quien quiera
 *    copiarlo.
 * 2. **Al cliente no le sirve.** Un médico decide por lo que la aplicación HACE.
 *    Una entrada de menú que no entiende gasta atención que necesita para su
 *    consulta.
 *
 * ── LO QUE ESTA PRUEBA IMPIDE ───────────────────────────────────────────────
 *
 * Que vuelva a colarse. Ni por mí ni por otra rutina: comprueba que **ninguna
 * superficie que ve un cliente** —portada, menú del médico, pie— enlace a las
 * páginas que explican el funcionamiento interno.
 *
 * Las páginas **siguen existiendo** y se llegan por su dirección: al dueño le
 * sirven para una revisión técnica o para enseñárselas a quien compre. Lo que se
 * quita es que se ofrezcan solas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Las que explican el funcionamiento por dentro. */
const COMO_FUNCIONA = ['/motores', '/arquitectura']

/** Lo que ve un cliente: la portada y el menú de la aplicación. */
const SUPERFICIES_DEL_CLIENTE = [
  'src/app/page.tsx',
  'src/components/Sidebar.tsx',
  'src/components/BottomNav.tsx',
  'src/app/(dashboard)/configuracion/secciones-seguridad.tsx',
]

describe('ninguna superficie del cliente ofrece las páginas de funcionamiento', () => {
  for (const archivo of SUPERFICIES_DEL_CLIENTE) {
    it(`${archivo} no enlaza a ninguna`, () => {
      const t = leer(archivo)
      const encontradas = COMO_FUNCIONA.filter(r =>
        new RegExp(`href=["'\`]${r}["'\`]|href: ['"\`]${r}['"\`]`).test(t))
      expect(
        encontradas,
        `${archivo} vuelve a ofrecer: ${encontradas.join(', ')}\n\n` +
        '  Regla del dueño: se dice lo que HACE, nunca CÓMO lo hace.\n' +
        '  Las páginas siguen existiendo — lo que no pueden es ofrecerse solas.',
      ).toEqual([])
    })
  }
})

describe('y la portada habla de lo que hace, no de cómo', () => {
  const portada = leer('src/app/page.tsx')

  it('no ofrece «ver los motores»', () => {
    /** El botón decía «Ver los 10 motores»: eso es el inventario de dentro. */
    expect(portada).not.toMatch(/Ver los \d+ motores/i)
  })

  it('ni promete enseñar «cómo» funciona algo', () => {
    /**
     * «Ver cómo razona la IA» era la promesa equivocada: al médico le importa
     * lo que la nota le ahorra, no el razonamiento del modelo.
     */
    expect(portada).not.toMatch(/Ver c[oó]mo (razona|funciona|trabaja)/i)
  })

  it('pero sigue diciendo lo que la aplicación HACE', () => {
    /**
     * La regla no es callar: es hablar de capacidades. Si la portada se
     * quedara muda, esta prueba estaría premiando el silencio.
     */
    expect(portada).toContain('/paquetes')   // qué cubre por especialidad
    expect(portada).toContain('/operacion')  // qué resuelve del consultorio
    expect(portada).toContain('/registro')   // y cómo empezar a usarlo
  })
})

describe('las páginas no se borran: se dejan de ofrecer', () => {
  it('`/motores` y `/arquitectura` siguen existiendo', () => {
    /**
     * Al dueño le sirven para una revisión técnica o para enseñárselas a quien
     * compre — con él delante, decidiendo qué se cuenta. Borrarlas sería perder
     * la prueba de que las defensas existen.
     */
    expect(() => leer('src/app/(dashboard)/motores/page.tsx')).not.toThrow()
    expect(() => leer('src/app/arquitectura/page.tsx')).not.toThrow()
  })
})
