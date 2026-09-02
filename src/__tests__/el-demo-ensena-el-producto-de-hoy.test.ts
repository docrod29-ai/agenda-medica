/**
 * GOLDEN — el demo enseñaba el producto de hace dos versiones.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Mirando `/demo` servido a 1440 y 390 después de reescribir la portada
 * (`docs/audit/ausculta-transformacion/antes/demo-escritorio.png`). Nueve
 * funciones numeradas en zigzag —agenda · nota · receta · antibiograma ·
 * consultor · herramientas · WhatsApp · asistente · portal— y ni una palabra
 * de lo que la portada acababa de prometer:
 *
 *   · la NEGACIÓN («fiebre no he tenido» → *niega* fiebre, no *fiebre*)
 *   · la PROCEDENCIA (tocar una frase y oír el segundo del dictado)
 *   · los AVISOS antes de firmar, y cuáles no se pliegan
 *   · la APLICABILIDAD de la evidencia a ESTE paciente
 *   · el CICLO CERRADO de la orden hasta que se decide
 *
 * Un catálogo, además: cada bloque decía qué hace una parte del producto y
 * ninguno decía qué pasa después. Y la incoherencia que lo delata: el capítulo
 * de la nota enseñaba «Masculino de 54 años con dolor torácico» mientras la
 * agenda de arriba decía «María López» — porque no era una visita, eran nueve
 * maquetas sueltas.
 *
 * ── LA REGLA QUE ESTE GUARDIÁN SELLA ────────────────────────────────────────
 *
 * **Lo que la portada promete, el demo lo enseña.** Es la misma familia que
 * «el dato tiene que LLEGAR», aplicada entre dos superficies públicas: la
 * portada puede prometer lo que quiera y sus pruebas seguir en verde mientras
 * el demo —la página a la que se manda a quien duda— siga contando otra cosa.
 * Nadie mira las dos a la vez, y por eso se separaron.
 *
 * Y **es una visita, no un catálogo**: una paciente, en orden.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol anterior, `enseña lo que la portada promete` falla en los
 * cinco momentos y `es una visita de una sola paciente` falla por los dos
 * nombres.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que lo que enseña sea verdad.** Que Ausculta distinga de
 *   verdad una negación lo prueban las pruebas de `src/lib/expediente/`; esto
 *   sólo comprueba que el demo no se quede atrás de la portada. Un demo que
 *   prometiera de más pasaría este caso — lo que no puede es prometer de menos.
 * · **No mira `/demo/interactivo` ni `/demo/razonamiento`.** Son las dos rutas
 *   donde el producto corre de verdad, y tienen sus propias pruebas.
 * · No juzga si el texto está bien escrito. Eso se mira, no se afirma.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const DEMO = leer('src/app/demo/page.tsx')
const PORTADA = leer('src/app/page.tsx')
const HEROE = leer('src/components/landing/HeroConsulta.tsx')

/**
 * Los cinco momentos que separan a este producto de un dictado, con la marca
 * por la que se reconoce cada uno en el demo. No se busca la palabra suelta:
 * se busca la maqueta que lo ENSEÑA, porque una función se puede nombrar en
 * una lista sin enseñarla nunca — que es exactamente lo que pasaba.
 */
const LO_QUE_LA_PORTADA_PROMETE = [
  { momento: 'la negación se distingue de la afirmación', marca: /tipo === 'entendido'/ },
  { momento: 'la procedencia de una frase', marca: /nx-hero-procedencia/ },
  { momento: 'los avisos antes de firmar, y cuáles no se pliegan', marca: /tipo === 'avisos'/ },
  { momento: 'la evidencia aplicada a este paciente', marca: /tipo === 'evidencia'/ },
  { momento: 'el ciclo cerrado de la orden', marca: /tipo === 'ciclo'/ },
]

describe('el demo enseña el producto de hoy', () => {
  it('enseña los cinco momentos que la portada promete', () => {
    const ausentes = LO_QUE_LA_PORTADA_PROMETE
      .filter(({ marca }) => !marca.test(DEMO))
      .map(({ momento }) => momento)
    expect(
      ausentes,
      `la portada lo promete y el demo no lo enseña:\n${ausentes.join('\n')}`,
    ).toEqual([])
  })

  it('y la portada sigue prometiéndolos — si no, el guardián vigila un hueco', () => {
    /**
     * Un caso que sólo mirara el demo pasaría el día que alguien quitara la
     * promesa de la portada: la asimetría se resolvería por el lado malo y
     * nadie se enteraría. Aquí se comprueba el otro extremo del cable.
     */
    expect(HEROE, 'el héroe dejó de enseñar la negación').toContain("clase: 'niega'")
    expect(HEROE, 'el héroe dejó de enseñar la procedencia').toContain('nx-hero-procedencia')
    expect(PORTADA, 'el recorrido dejó de prometer los avisos').toContain('nunca se pliegan')
    expect(PORTADA, 'el recorrido dejó de prometer el ciclo cerrado').toContain('no desaparece al pedirla')
  })

  it('es una visita de una sola paciente, no nueve maquetas sueltas', () => {
    // Un demo que cuenta una historia usa UN nombre. El anterior tenía la
    // agenda de «María López» y la nota de un «masculino de 54 años».
    expect(DEMO).toContain('María Robles')
    expect(DEMO, 'volvió el paciente que no era el de la agenda').not.toContain('Masculino de 54 años')
    expect(DEMO, 'dos nombres para la misma paciente').not.toContain('María López')
  })

  it('dice en pantalla que el paciente es ficticio', () => {
    // La regla de datos del repositorio prohíbe pacientes reales; en una
    // superficie pública además hay que DECIRLO, no sólo cumplirlo.
    expect(DEMO).toMatch(/ficticia|ficticios/)
  })

  it('los dos recorridos vivos son alcanzables desde aquí', () => {
    // Eran el activo más fuerte para convencer a un médico y estaban
    // escondidos: uno en un botón secundario, el otro en un enlace del pie.
    expect(DEMO).toContain('/demo/interactivo')
    expect(DEMO).toContain('/demo/razonamiento')
  })

  it('comparte la navegación de la portada: es el mismo sitio', () => {
    // Antes toda la navegación del demo era un «← Volver».
    expect(DEMO).toContain('<NavPublica />')
  })
})
