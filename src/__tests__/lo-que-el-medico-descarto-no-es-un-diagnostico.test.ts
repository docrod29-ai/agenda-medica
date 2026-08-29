/**
 * GOLDEN — LO QUE EL MÉDICO DESCARTÓ LLEGABA A LOS MOTORES Y AL MODELO COMO
 * DIAGNÓSTICO DEL PACIENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `problemasDelCuadro` (`cuadro-completo.ts`) une los diagnósticos de HOY con
 * los del expediente y produce «el cuadro completo» que ven el copiloto clínico
 * y la ruta de evidencia. La lista del expediente venía ya filtrada por
 * `problemasActivos`; **la de hoy entraba sin filtrar y sin `tipo`**.
 *
 * El esquema de extracción produce los cuatro tipos
 * (`extraction-schema.ts:40`: presuntivo | definitivo | diferencial |
 * descartado), así que un «embarazo descartado» —que es como se documenta una
 * prueba negativa— o un «lupus, descartado» entraban al cuadro como
 * diagnósticos del paciente, **aplanados a su descripción**.
 *
 * ── LO QUE SE MIDIÓ, CON LOS MOTORES REALES ─────────────────────────────────
 *
 *     dx: [{ descripcion: 'Embarazo', tipo: 'descartado' }]
 *     receta: Ibuprofeno
 *     → copiloto: «La paciente cursa embarazo.»
 *     → textoNota: «Ibuprofeno debe evitarse en el embarazo; se comentó y se
 *                   valoró una alternativa.»
 *
 * Ese `textoNota` es el texto que el médico puede insertar **en la nota
 * firmada**: un descarte convertido en afirmación dentro de un documento
 * medicolegal.
 *
 * Y por el otro camino, la ruta de evidencia construye sus consultas de PubMed
 * y su línea «DIAGNÓSTICOS: …» a partir de la misma lista: la búsqueda y el
 * razonamiento salían sobre una enfermedad que el médico había descartado.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10 después de REG-363. El tablero decía que a `Diagnostico` le
 * falta `certeza`; buscando dónde dolía eso apareció algo peor: el campo
 * **`tipo` ya existe**, tres lectores lo respetan (`problemasActivos`,
 * `ResumenPaciente`, la exportación FHIR, que mapea `provisional`) y el cuarto
 * —el que alimenta a los motores y al modelo— lo tiraba.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Dos criterios para la misma pregunta. `estaVigente` estaba escrito, exportado
 * y probado, y esta puerta no lo llamaba. Familia «el sistema se contradice a sí
 * mismo».
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * `SUGERIDO ≠ CONFIRMADO`, y un descarte es todavía menos que una sugerencia.
 * Un `descartado` o un `diferencial` no son problemas del paciente y no entran.
 * Un `presuntivo` **sí** entra —lo es— pero entra **diciendo que lo es**, con
 * `nombreConCerteza`, que es UNA definición para los cuatro lectores.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO añade `certeza` a `Diagnostico`. El eje «con cuánta seguridad lo dijo el
 *   PACIENTE» (`certeza.ts`) sigue calculándose en la consulta y descartándose
 *   al firmar; eso es otra unidad de WS-10. Esto usa `tipo`, que es lo que el
 *   MÉDICO decidió y que sí se guarda.
 * · NO cambia ninguna compuerta ni ningún umbral. Cambia qué entra y cómo se
 *   nombra.
 * · NO toca la reactividad cruzada ni los motores de dosis.
 * · El aviso gestacional NO se pierde para un embarazo presuntivo: se sigue
 *   dando, y se redacta en condicional. Callarlo sería el error contrario.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { problemasDelCuadro, comoSeNombra } from '@/lib/expediente/cuadro-completo'
import { nombreConCerteza, problemasActivos, resumenProblemas, estaVigente } from '@/lib/expediente/problemas-activos'
import { copiloto } from '@/lib/expediente/copiloto'
import type { Diagnostico } from '@/types/expediente'

const dx = (descripcion: string, tipo: Diagnostico['tipo'], estado: Diagnostico['estado'] = 'activo'): Diagnostico =>
  ({ descripcion, tipo, estado })

describe('un descarte no es un diagnóstico del paciente', () => {
  it('lo descartado y lo diferencial no entran al cuadro que ven los motores', () => {
    const cuadro = problemasDelCuadro([
      dx('Faringitis', 'definitivo'),
      dx('Lupus eritematoso sistémico', 'descartado'),
      dx('Tromboembolia pulmonar', 'diferencial'),
    ], [])
    expect(cuadro.map(d => d.descripcion)).toEqual(['Faringitis'])
  })

  it('AL REVÉS — sin el filtro, los tres entran y el motor razona sobre lo descartado', () => {
    /* La regla equivocada, reproducida: quedarse con lo que tiene descripción.
       Comprueba que el filtro es lo que separa un caso del otro, y no otra cosa. */
    const sinFiltro = [
      dx('Faringitis', 'definitivo'),
      dx('Lupus eritematoso sistémico', 'descartado'),
      dx('Tromboembolia pulmonar', 'diferencial'),
    ].filter(d => d.descripcion.trim())
    expect(sinFiltro).toHaveLength(3)          // ← el desenlace que NO queremos
    expect(problemasDelCuadro(sinFiltro, [])).toHaveLength(1)
  })

  it('el criterio es el MISMO que el de la lista longitudinal, no uno nuevo', () => {
    const casos: Diagnostico[] = [
      dx('Faringitis', 'definitivo'),
      dx('Anemia', 'presuntivo'),
      dx('Lupus', 'descartado'),
      dx('TEP', 'diferencial'),
      dx('Gastritis', 'definitivo', 'resuelto'),
    ]
    const delCuadro = new Set(problemasDelCuadro(casos, []).map(d => d.descripcion))
    for (const c of casos) {
      expect(delCuadro.has(c.descripcion), `${c.descripcion}: el cuadro y estaVigente discrepan`)
        .toBe(estaVigente(c))
    }
  })

  it('un problema resuelto del expediente tampoco entra por la puerta de hoy', () => {
    expect(problemasDelCuadro([dx('Gastritis', 'definitivo', 'resuelto')], [])).toEqual([])
  })
})

describe('el copiloto no afirma un embarazo que se descartó', () => {
  const conDx = (d: Diagnostico) => copiloto({
    edad: 28, sexo: 'Femenino',
    diagnosticos: problemasDelCuadro([d], []),
    medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg' }],
  })

  it('«Embarazo, descartado» ya no produce «La paciente cursa embarazo»', () => {
    const texto = JSON.stringify(conDx(dx('Embarazo', 'descartado')))
    expect(texto).not.toMatch(/cursa embarazo/i)
    /* Y no se cuela por la nota, que es donde acaba siendo medicolegal. */
    expect(texto).not.toMatch(/debe evitarse en el embarazo/i)
  })

  it('con un embarazo CONFIRMADO el aviso sigue saliendo, y afirma', () => {
    const texto = JSON.stringify(conDx(dx('Embarazo', 'definitivo')))
    expect(texto).toMatch(/cursa embarazo/i)
  })

  it('con un embarazo PRESUNTIVO el aviso NO se pierde: cita la nota en vez de afirmar', () => {
    /* Callarlo sería el error contrario, y el caro: el riesgo de un embarazo no
       detectado pesa más que una frase de más. Pero `presuntivo` es el valor de
       fábrica (REG-365): ni afirma el embarazo ni lo niega, así que el aviso
       dice lo que el expediente dice y nada más. */
    const texto = JSON.stringify(conDx(dx('Probable embarazo', 'presuntivo')))
    expect(texto).toMatch(/Ibuprofeno/)
    expect(texto).toMatch(/embarazo registrado en la nota/i)
    expect(texto).not.toMatch(/cursa embarazo/i)
    /* Y tampoco afirma lo contrario: nadie lo descartó. */
    expect(texto).not.toMatch(/no confirmado|descartad/i)
  })

  it('el motor no depende de que su llamador filtre: quien afirma es él', () => {
    /* `problemasDelCuadro` ya no deja pasar un descartado, pero el copiloto
       tiene otros llamadores y la afirmación la firma él. */
    const texto = JSON.stringify(copiloto({
      edad: 28, sexo: 'Femenino',
      diagnosticos: [{ descripcion: 'Embarazo', tipo: 'descartado' }],
      medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg' }],
    }))
    expect(texto).not.toMatch(/cursa embarazo/i)
  })

  it('un llamador antiguo que no manda `tipo` se comporta como antes', () => {
    /* Sin el campo no se sabe, y «no se sabe» no puede apagar un aviso de
       teratogenicidad: ausencia de dato no es dato de ausencia. */
    const texto = JSON.stringify(copiloto({
      edad: 28, sexo: 'Femenino',
      diagnosticos: [{ descripcion: 'Embarazo' }],
      medicamentos: [{ nombre: 'Ibuprofeno', dosis: '400 mg' }],
    }))
    expect(texto).toMatch(/cursa embarazo/i)
  })
})

describe('un valor de fábrica no es un juicio del médico — REG-365', () => {
  /*
   * Esta parte de REG-364 estaba MAL y la corrige REG-365, el mismo día.
   *
   * `presuntivo` es el default de `extraction-schema.ts:40`, lo que el prompt
   * manda poner «por defecto», y lo que el botón de añadir diagnóstico escribe;
   * y NINGUNA pantalla deja al médico elegir el tipo. Así que etiquetarlo
   * afirmaba una duda que nadie expresó, en casi todos los renglones — y de
   * paso convertía la etiqueta en ruido para el día que sí signifique algo.
   */
  it('un `presuntivo` va LIMPIO: es el valor de fábrica, no un juicio', () => {
    expect(nombreConCerteza(dx('Anemia', 'presuntivo'))).toBe('Anemia')
    expect(nombreConCerteza(dx('Faringitis', 'definitivo'))).toBe('Faringitis')
    expect(nombreConCerteza({ descripcion: 'Faringitis' })).toBe('Faringitis')
    expect(nombreConCerteza({ descripcion: '   ' })).toBe('')
  })

  it('el default del esquema SIGUE siendo `presuntivo` — si cambia, esto se revisa', () => {
    /* La regla de arriba sólo es correcta mientras `presuntivo` sea el valor de
       fábrica. El día que alguien lo cambie, este caso lo cuenta. */
    const esquema = readFileSync('src/lib/expediente/extraction-schema.ts', 'utf8')
    expect(esquema).toMatch(/tipo:\s+z\.enum\(\[[^\]]*\]\)\.optional\(\)\.default\('presuntivo'\)/)
    const prompts = readFileSync('src/lib/expediente/prompts.ts', 'utf8')
    expect(prompts).toContain('Por defecto tipo="presuntivo"')
  })

  it('lo que NO se llega por omisión sí se etiqueta', () => {
    /* A `descartado` y `diferencial` los escribe el extractor porque el médico
       los dictó. Ahí la etiqueta informa. */
    expect(nombreConCerteza(dx('Lupus', 'descartado'))).toBe('Lupus (descartado)')
    expect(nombreConCerteza(dx('TEP', 'diferencial'))).toBe('TEP (diferencial)')
  })

  it('el cuadro conserva `tipo` para quien tenga que decidir con él', () => {
    /* El copiloto lo necesita: es lo que separa «cursa embarazo» de un descarte. */
    const cuadro = problemasDelCuadro([dx('Anemia', 'presuntivo')], [])
    expect(cuadro[0].tipo).toBe('presuntivo')
    expect(comoSeNombra(cuadro[0])).toBe('Anemia')
  })

  it('el resumen del expediente no tacha de dudosa una crónica confirmada', () => {
    const problemas = problemasActivos([
      { fecha: '2026-01-01', estado: 'firmada', diagnosticos: [dx('Diabetes mellitus tipo 2', 'presuntivo', 'cronico')] },
    ])
    expect(resumenProblemas(problemas)).toBe('Diabetes mellitus tipo 2')
  })

  it('UNA definición para los cuatro lectores, no cuatro', () => {
    expect(comoSeNombra).toBe(nombreConCerteza)
  })
})

/**
 * ── EL DATO TIENE QUE LLEGAR ────────────────────────────────────────────────
 *
 * Los dos destinos que aplanaban el diagnóstico son una PANTALLA y un PROMPT.
 * Ninguno de los dos se puede comprobar con un módulo puro, así que se
 * comprueban sobre el árbol: si alguien vuelve a escribir `.descripcion` a
 * secas en cualquiera de los dos, esto cae.
 */
describe('los cuatro lectores usan el criterio, no la descripción a secas', () => {
  it('la lista de problemas de /consulta', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toMatch(/problemas\.map\(p => nombreConCerteza\(p\.diagnostico\)/)
  })

  it('el prompt de la ruta de evidencia', () => {
    const src = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
    expect(src).toContain('nombreConCerteza')
    /* La línea que el modelo lee como «los diagnósticos de este paciente». */
    expect(src).toMatch(/DIAGNÓSTICOS: \$\{dxParaElModelo\.join/)
  })

  it('las CONSULTAS de PubMed siguen usando el término a secas', () => {
    /* «(presuntivo)» dentro de una búsqueda MeSH no la afina: la rompe. La
       etiqueta es para el razonamiento, no para el buscador. */
    const src = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
    expect(src).toMatch(/consultasDet\.push\(\[dx\[0\]/)
  })
})
