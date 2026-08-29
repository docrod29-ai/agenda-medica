/**
 * GOLDEN — la defensa miraba SÓLO el resumen, y el comentario prometía la nota
 * entera.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * En producción, en la propia alerta del Dr., que citaba la nota así:
 *
 *     «…Diabetes mellitus tipo 2. [object Object] [object Object] [o…»
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 *     [resumen, diagnosticos.join('. '), ...Object.values(secciones ?? {})]
 *
 * `diagnosticos` es `Diagnostico[]` y `secciones` es `NotaSeccion[]`: **objetos**.
 * `join` los convierte en `[object Object]`, y `Object.values` sobre un arreglo
 * devuelve los propios objetos. Así que el texto contra el que se comparaba era:
 *
 *     resumen + "[object Object]. [object Object]" + [objetos]
 *
 * ── POR QUÉ NO ES COSMÉTICO ──────────────────────────────────────────────────
 *
 * Un antecedente que el paciente NEGÓ y que la nota guarda **sólo como
 * diagnóstico estructurado** —sin repetirlo en la prosa— no disparaba nada. Y el
 * diagnóstico estructurado es justo el que se arrastra a la receta, al resumen de
 * la próxima consulta y al expediente.
 *
 * La defensa existía, estaba probada, y miraba a un sitio equivocado. Lo mismo le
 * pasaba al motor de temporalidad, que copió la misma línea.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { mencionesEnPasado, desajustesTemporales } from '@/lib/expediente/temporalidad'

const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

/**
 * LA FUNCIÓN DE VERDAD, IMPORTADA — y antes era una RÉPLICA.
 *
 * Hasta el 15-ago esta prueba declaraba su propia copia de `textoDeLaNota`
 * («la misma función que arma el texto en la pantalla, replicada para
 * probarla»), porque la original vivía privada dentro del monolito de
 * `/consulta` y no había de dónde importarla.
 *
 * Una copia en una prueba es la peor de todas: **pasa en verde para siempre**
 * aunque el original cambie, y entonces la prueba certifica una función que ya
 * nadie ejecuta. Con la función mudada a `lib/expediente/texto-de-la-nota.ts`
 * (§21 en el expediente necesitaba el mismo texto), se importa.
 */
import { textoDeLaNota } from '@/lib/expediente/texto-de-la-nota'

describe('EL CASO QUE SE VIO EN PRODUCCIÓN', () => {
  it('ya no aparece «[object Object]» en el texto contrastado', () => {
    const t = textoDeLaNota('Paciente con Hipertensión arterial.',
      [{ descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11' }],
      [{ value: 'Antecedentes: niega tabaquismo.' }])
    expect(t).not.toContain('[object Object]')
    expect(t).toContain('Diabetes mellitus tipo 2')
    expect(t).toContain('E11')
  })
})

describe('LO QUE LA DEFENSA NO VEÍA', () => {
  const dictado = '¿Enfermedades crónicas como diabetes o presión alta? No.'

  it('una condición negada que vive SÓLO en el diagnóstico estructurado ahora se caza', () => {
    /**
     * Antes: el resumen no la nombraba, el diagnóstico llegaba como
     * «[object Object]», y la contradicción no existía para el sistema.
     */
    const texto = textoDeLaNota('Consulta de primera vez.',
      [{ descripcion: 'Diabetes mellitus tipo 2' }], [])
    const c = contradicciones(condicionesNegadas(dictado), texto)
    expect(c.map(x => x.condicion)).toContain('diabetes')
  })

  it('y una que vive SÓLO en una sección de la nota, también', () => {
    const texto = textoDeLaNota('Consulta de primera vez.', [],
      [{ value: 'Antecedentes: paciente con hipertensión arterial de larga evolución.' }])
    const c = contradicciones(condicionesNegadas(dictado), texto)
    expect(c.map(x => x.condicion)).toContain('hipertensión arterial')
  })

  it('lo mismo para el motor de temporalidad, que copió la misma línea', () => {
    const texto = textoDeLaNota('Consulta.', [{ descripcion: 'Neumonía' }], [])
    const d = desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), texto)
    expect(d.map(x => x.condicion)).toContain('neumonía')
  })
})

describe('ESTÁ CABLEADO EN LA PANTALLA', () => {
  it('todas las defensas usan el mismo constructor de texto', () => {
    /**
     * Dos formas de armar «lo que la nota dice» acabarían divergiendo, y una de
     * ellas se quedaría ciega otra vez.
     *
     * Eran dos defensas —contradicción y temporalidad— y desde SUP-001 son
     * TRES: la trazabilidad contrasta la nota entera contra el dictado para
     * saber qué afirmación no salió de ahí. Que compartan constructor es
     * justamente lo que impide que una vea una nota distinta de las otras.
     *
     * Desde REG-239 son CUATRO: el panel «¿de dónde salió esto?» enseña esa
     * misma traza al médico. Trazar un texto distinto del que se firma sería
     * comprobar algo que nadie va a leer.
     *
     * Y desde REG-370 son CINCO: los procedimientos que el extractor oyó se
     * comparan contra lo que la nota dice para saber cuál no quedó escrito. Si
     * esa comparación leyera una nota distinta de la que se firma, avisaría de
     * un procedimiento que sí está documentado —o callaría uno que no—, que es
     * el modo de fallo que este guardián existe para impedir.
     */
    const DEFENSAS_QUE_LEEN_LA_NOTA = 5
    expect(page.split('textoDeLaNota(resumen, diagnosticos, secciones)').length - 1)
      .toBe(DEFENSAS_QUE_LEEN_LA_NOTA)
  })

  it('y ya no queda ningún join sobre objetos en esa ruta', () => {
    expect(page).not.toContain("diagnosticos.join('. ')")
    expect(page).not.toContain('...Object.values(secciones ?? {})')
  })
})
