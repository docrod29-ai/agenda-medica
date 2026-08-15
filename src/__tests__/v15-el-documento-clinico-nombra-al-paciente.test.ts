/**
 * V15-FINAL-COHERENCE-001 — la familia documental decía tres gramáticas
 * distintas, y ninguna nombraba al paciente.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * No leyendo el fuente: midiendo el DOM vivo. La matriz de coherencia
 * (`scripts/design/medir-coherencia-de-producto-v15.mjs`) lee el `<h1>` y la
 * voz tipográfica CALCULADA del nombre del paciente en once superficies, a
 * 1440×900 y a 390×844. Acta cruda en
 * `docs/design/capturas/v15-coherencia/acta-coherencia.json`.
 *
 * Lo que salió (escritorio; el móvil es idéntico salvo 1px de escala):
 *
 * | superficie  | h1 nombra            | voz más fuerte del paciente |
 * |---|---|---|
 * | expediente  | **al paciente**      | 20/600 (ancla)              |
 * | consulta    | **al paciente**      | 20/700 (h1)                 |
 * | nota        | **no hay h1**        | 14/600 (franja)             |
 * | receta      | «Generador de Receta»| 14/600 (franja)             |
 * | orden       | «Orden Médica»       | 14/600 (franja)             |
 *
 * ── LA CAUSA RAÍZ ─────────────────────────────────────────────────────────
 *
 * No fue un descuido repetido tres veces: fue que nadie era DUEÑO de la
 * pregunta «¿qué nombra el encabezado de un documento clínico?». Cada
 * pantalla la contestó sola, en su propia barra, con su propio literal —
 * mientras los comentarios de las tres afirmaban pertenecer a una familia que
 * «habla el mismo idioma y el mismo orden». Tres respuestas distintas a una
 * pregunta que nadie había hecho en voz alta.
 *
 * El agravante es DÓNDE degrada: en el expediente y la consulta —donde el
 * médico LEE— el paciente es la voz dominante; en receta, orden y nota
 * —donde EMITE un documento que cambia el tratamiento— cae a cromo
 * periférico de 14px y el sitio dominante lo ocupa el nombre de la
 * herramienta. Es al revés de lo que pediría la seguridad.
 *
 * ── POR QUÉ NO ES UNA P1 ──────────────────────────────────────────────────
 *
 * Porque la identidad NO desaparece: la franja del shell la sostiene, visible
 * en el primer viewport en los dos anchos, y eso ya lo midió y lo dejó dicho
 * la Iteración 17 al registrar esto como P3. No hay ambigüedad de paciente
 * equivocado. Lo que hay es incoherencia de jerarquía, y se registra como lo
 * que es. No se infla la severidad porque la iteración se llame «Coherencia
 * Final».
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 *  · NO prueba el documento impreso. El PDF, la impresión y el Word salen
 *    exactamente igual que antes: la reparación vive en la barra `no-print`
 *    de la pantalla de trabajo. Que el impreso no cambie lo sostienen los
 *    guardianes de impreso que ya existen, no éste.
 *  · NO cubre `/referencia`. Su `<h1>` («CARTA DE REFERENCIA») está DENTRO
 *    del papel, como título del oficio: cambiarlo cambiaría un documento
 *    medicolegal emitido. Es una diferencia de contexto legítima y queda
 *    declarada como deuda NO pagada, no como olvido.
 *  · NO prueba que el nombre se vea a X píxeles: eso lo mide el navegador en
 *    la matriz de coherencia, y aquí sería una tautología sobre un literal.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const {
  tituloDominante, seMuestraElRotulo, ROTULO_DE_DOCUMENTO,
} = await import('@/components/TituloDeDocumentoClinico')

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

const RECETA = 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'
const ORDEN = 'src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx'
const NOTA = 'src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx'

describe('tituloDominante — el sujeto es el paciente', () => {
  it('con nombre, el encabezado ES el nombre — en las tres clases', () => {
    expect(tituloDominante('Luz María Cervantes Ochoa', 'receta')).toBe('Luz María Cervantes Ochoa')
    expect(tituloDominante('Aurelio Domínguez Peña', 'orden')).toBe('Aurelio Domínguez Peña')
    expect(tituloDominante('Aurelio Domínguez Peña', 'nota')).toBe('Aurelio Domínguez Peña')
  })

  /**
   * LA CLÁUSULA DE SEGURIDAD, y la razón de que esto tenga dueño: mientras el
   * paciente no ha cargado NO se inventa una identidad ni se hereda la
   * anterior. Se dice qué documento es, que es cierto, en vez de a quién
   * pertenece, que todavía no se sabe. Misma regla que ya cumplen
   * `InstrumentStrip` y el ancla del expediente.
   */
  it('sin nombre —null, undefined, vacío o sólo espacios— cae al rótulo del documento, nunca a un nombre inventado', () => {
    for (const vacio of [null, undefined, '', '   ', '\n\t ']) {
      expect(tituloDominante(vacio, 'receta')).toBe('Receta')
      expect(tituloDominante(vacio, 'orden')).toBe('Orden médica')
      expect(tituloDominante(vacio, 'nota')).toBe('Nota médica')
    }
  })

  it('el rótulo subordinado NO se repite cuando el h1 ya lo está diciendo', () => {
    // Con paciente: h1 = nombre, y el rótulo aporta («Luz María…» / «Receta»).
    expect(seMuestraElRotulo('Luz María Cervantes Ochoa', 'receta')).toBe(true)
    // Sin paciente: h1 = «Receta»; repetirlo debajo sería «Receta / Receta».
    expect(seMuestraElRotulo(null, 'receta')).toBe(false)
    expect(seMuestraElRotulo('  ', 'orden')).toBe(false)
  })

  it('un nombre que COINCIDE con el rótulo sigue tratándose como nombre', () => {
    // Caso raro y deliberado: la función no puede decidir por igualdad de
    // texto que «no hay paciente». Lo que gobierna es si hay nombre o no.
    expect(tituloDominante('Receta', 'receta')).toBe('Receta')
  })
})

describe('las tres superficies de la familia documental usan el mismo dueño', () => {
  /**
   * Probado al revés: si alguna vuelve a poner su propio `<h1>` con un
   * literal de herramienta, estos casos muerden. El literal exacto que había
   * antes se nombra a propósito — es la regresión concreta que se vigila.
   */
  it('/receta ya no titula «Generador de Receta»; monta el título compartido con clase receta', () => {
    const src = leer(RECETA)
    expect(src).not.toMatch(/<h1[^>]*>Generador de Receta<\/h1>/)
    expect(src).toMatch(/<TituloDeDocumentoClinico\s+nombreDelPaciente=\{patient\?\.nombre\}\s+clase="receta"\s*\/>/)
  })

  it('/orden ya no titula «Orden Médica»; monta el título compartido con clase orden', () => {
    const src = leer(ORDEN)
    expect(src).not.toMatch(/<h1[^>]*>Orden Médica<\/h1>/)
    expect(src).toMatch(/<TituloDeDocumentoClinico\s+nombreDelPaciente=\{patient\?\.nombre\}\s+clase="orden"\s*\/>/)
  })

  /**
   * La nota no tenía NINGÚN `<h1>`: era la única superficie clínica medida
   * sin encabezado de nivel uno, y ninguna corrida de axe lo había visto
   * porque la familia documental nunca entró en su lista de pantallas
   * (`scripts/design/axe-encuentro-v15.mjs`, PANTALLAS).
   */
  it('/nota monta el título compartido — antes no tenía encabezado de nivel uno', () => {
    const src = leer(NOTA)
    expect(src).toMatch(/<TituloDeDocumentoClinico\s+nombreDelPaciente=\{patient\?\.nombre\}\s+clase="nota"\s*\/>/)
  })

  /**
   * SIN LOS COMENTARIOS, y la razón importa.
   *
   * La primera versión de este caso leía el archivo entero y falló — contra
   * el texto de los comentarios que explican la reparación, que citan `<h1>`
   * en prosa. Es el reverso exacto de REG-316 («cuatro líneas de prosa fuera
   * de un comentario mataron una regla de CSS»): allí la prosa se escapó del
   * comentario, aquí la prosa DENTRO del comentario se coló en una medición.
   * Un guardián que cuenta prosa no cuenta código, y se habría «arreglado»
   * borrando la explicación — que es justo lo que no debe pasar.
   */
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('ninguna de las tres declara ya un <h1> propio en su barra de acciones', () => {
    for (const ruta of [RECETA, ORDEN, NOTA]) {
      // El único `<h1>` de estas pantallas debe venir del componente
      // compartido. Un `<h1>` suelto aquí es exactamente la deriva que esta
      // reparación cierra.
      expect(sinComentarios(leer(ruta)), `${ruta} volvió a declarar un <h1> propio`)
        .not.toMatch(/<h1[\s>]/)
    }
  })

  /**
   * Probado al revés: el propio filtro se comprueba, porque un filtro que
   * borrase de más dejaría el caso anterior pasando siempre — verde por no
   * mirar nada.
   */
  it('el filtro de comentarios quita la prosa y CONSERVA el JSX', () => {
    expect(sinComentarios('/* dice <h1> en prosa */\nconst a = 1')).not.toMatch(/<h1[\s>]/)
    expect(sinComentarios('// menciona <h1>\nconst a = 1')).not.toMatch(/<h1[\s>]/)
    expect(sinComentarios('<h1 style={{}}>Hola</h1>')).toMatch(/<h1[\s>]/)
    expect(sinComentarios('/* prosa */\n<h1>Hola</h1>')).toMatch(/<h1[\s>]/)
  })
})

describe('el rótulo de cada documento se dice una sola vez, y en un solo sitio', () => {
  it('los tres rótulos existen y son distintos entre sí', () => {
    const valores = Object.values(ROTULO_DE_DOCUMENTO)
    expect(valores).toHaveLength(3)
    expect(new Set(valores).size).toBe(3)
  })
})
