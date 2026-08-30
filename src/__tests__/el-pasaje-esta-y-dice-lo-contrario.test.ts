/**
 * GOLDEN — LA CITA ESTABA ANCLADA, ERA LITERAL, Y DECÍA LO CONTRARIO.
 *
 * ── QUÉ FALLABA (WS-12) ─────────────────────────────────────────────────────
 *
 * `verificar-la-cita.ts` comprueba que una afirmación esté ANCLADA: que el
 * pasaje que la respalda exista de verdad. REG-400 añadió de qué parte del
 * artículo sale, para que una cita de los antecedentes no pase por conclusión.
 *
 * Faltaban dos casos que **no necesitan modelo ninguno** y son los que más caro
 * salen:
 *
 *   · POLARIDAD — el pasaje dice «no redujo la mortalidad» y la frase dice
 *     «redujo la mortalidad».
 *   · MATIZ — el pasaje dice «podría reducir» y la frase dice «reduce».
 *
 * Los dos pasaban la comprobación **sin una sola marca**, porque el anclaje
 * pregunta si el texto existe, no si dice lo mismo. Una cita perfectamente
 * anclada que afirma lo contrario del artículo es peor que una sin anclar: la
 * sin anclar ya se marca.
 *
 * ── LO QUE SE MIDIÓ ANTES DE ESCRIBIR ESTA PRUEBA ───────────────────────────
 *
 * Se corrió el módulo contra frases reales, y aparecieron dos defectos que
 * leyendo el código parecían imposibles:
 *
 *  1. **«redujo» no contiene «reduc».** El pretérito español de *reducir* es
 *     irregular —redujo, c→j— y también *prevenir* →*previno*. Sin las dos
 *     raíces, «no redujo la mortalidad» —**la frase exacta que esto existe para
 *     cazar**— no se leía. La versión inglesa sí funcionaba, así que el defecto
 *     era invisible en las pruebas obvias.
 *  2. **`super` casaba con «supervivencia»**, que es un sustantivo y sale en
 *     casi todo resumen de mortalidad. Con esa raíz, «no aumentó la
 *     supervivencia» contra «mejoró la supervivencia» daba una inversión sobre
 *     un verbo que no era un verbo. Se quitó: una raíz que casa con una palabra
 *     común no añade cobertura, añade ruido.
 *
 * ── LA REGLA: SEÑALAR DE MENOS, NUNCA DE MÁS ────────────────────────────────
 *
 * Un detector que dispare con cualquier «no» marcaría media literatura, y una
 * marca falsa sobre una cita correcta enseña al médico a ignorar las marcas —
 * que es peor que no tenerlas. Se exigen **tres cosas a la vez**: patrón negado
 * en el pasaje, el MISMO verbo en afirmativo en la frase, y que la frase no
 * traiga negación propia. Además, la ventana se corta en el punto: lo de la
 * oración anterior no cuenta.
 *
 * ── POR QUÉ ES UN TERCER AVISO Y NO SE MEZCLA ───────────────────────────────
 *
 * «Sin respaldo» es que no se encontró el texto. «Fuera de los hallazgos» es que
 * el texto sale de una parte que no demuestra nada. Esto es que el texto está,
 * es literal, y dice otra cosa. Se comprueban distinto —los dos primeros piden
 * buscar el respaldo; éste pide releer el que ya está— y por eso se cuentan
 * aparte.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **NO es un evaluador de entailment y no se declara como tal.** No juzga si
 *   la afirmación se sigue del pasaje: detecta dos desajustes nombrados. El resto
 *   sigue necesitando un modelo, su conjunto de referencia y un umbral del
 *   médico — que es lo que `WS-12.entailment` deja abierto.
 * · NO cubre los verbos que no estén en `VERBOS_DE_RESULTADO`. Lo que no está,
 *   no se vigila, y no por eso está bien.
 * · NO mira la MAGNITUD: «redujo un 2 %» citado como «redujo» no es inversión ni
 *   atenuación, y puede ser igual de engañoso.
 * · NO alcanza una negación repartida entre dos oraciones del pasaje.
 * · NO filtra ni reordena: anota. Quitar una afirmación porque un patrón casó
 *   sería peor que no tener el patrón.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  desajustesEntre, leerResultados, VERBOS_DE_RESULTADO, LO_QUE_NO_SE_VIGILA,
  comoSeDiceElDesajuste,
} from '@/lib/evidencia/lo-que-el-pasaje-no-dijo'
import { citasDesajustadas, verificarAfirmaciones } from '@/lib/evidencia/verificar-la-cita'

const RUTA = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')

describe('el pasaje dice lo contrario', () => {
  it('en español, con el pretérito irregular', () => {
    /* «redujo» no contiene «reduc». Es el caso que el módulo existe para cazar
       y el que estuvo roto hasta medirlo. */
    const d = desajustesEntre('El tratamiento redujo la mortalidad', 'El tratamiento no redujo la mortalidad a 30 días')
    expect(d).toHaveLength(1)
    expect(d[0].clase).toBe('polaridad_invertida')
  })

  it('y «previno», que es el otro irregular', () => {
    expect(desajustesEntre('La vacuna previno la infección', 'La vacuna no previno la infección')[0].clase)
      .toBe('polaridad_invertida')
  })

  it('en inglés', () => {
    expect(desajustesEntre('Treatment reduces mortality', 'Treatment did not reduce mortality at 30 days')[0].clase)
      .toBe('polaridad_invertida')
  })

  it('las dos raíces irregulares están declaradas', () => {
    expect(VERBOS_DE_RESULTADO).toContain('reduj')
    expect(VERBOS_DE_RESULTADO).toContain('previn')
  })
})

describe('el pasaje lo dice con reservas y la frase las quitó', () => {
  it('«podría reducir» citado como «reduce»', () => {
    const d = desajustesEntre('El fármaco reduce la mortalidad', 'El fármaco podría reducir la mortalidad')
    expect(d[0].clase).toBe('matiz_endurecido')
  })

  it('«may reduce» citado como «reduces»', () => {
    expect(desajustesEntre('The drug reduces mortality', 'The drug may reduce mortality')[0].clase)
      .toBe('matiz_endurecido')
  })

  it('y la frase que se le enseña al médico cita el pasaje, no lo reescribe', () => {
    const d = desajustesEntre('El fármaco reduce la mortalidad', 'El fármaco podría reducir la mortalidad')
    expect(comoSeDiceElDesajuste(d[0])).toContain('con reservas')
    expect(comoSeDiceElDesajuste(d[0])).toContain('podría reducir')
  })
})

describe('lo que NO se marca, que es la mitad del trabajo', () => {
  it('una negación que no es del hallazgo', () => {
    /**
     * «reduced mortality in patients who did not receive statins» NO niega el
     * hallazgo. Si esto se marcara, media literatura saldría con bandera y el
     * médico dejaría de mirarlas.
     */
    expect(desajustesEntre(
      'Treatment reduces mortality',
      'Treatment reduced mortality in patients who did not receive statins',
    )).toHaveLength(0)
  })

  it('una negación de la oración ANTERIOR', () => {
    expect(desajustesEntre(
      'The drug improves survival',
      'No benefit was seen. The drug improved survival in the subgroup.',
    )).toHaveLength(0)
  })

  it('una negación sobre OTRO verbo', () => {
    /* Sin exigir el mismo verbo, cualquier negación cerca de cualquier
       afirmación daría una inversión inventada. */
    expect(desajustesEntre('The drug reduces mortality', 'The drug did not increase bleeding')).toHaveLength(0)
  })

  it('cuando la frase también niega', () => {
    expect(desajustesEntre('El fármaco no redujo la mortalidad', 'El fármaco no redujo la mortalidad')).toHaveLength(0)
  })

  it('«supervivencia» no es el verbo «superar»', () => {
    /* La raíz `super` se quitó tras medirlo: casaba con un sustantivo que sale
       en casi todo resumen de mortalidad. */
    expect(VERBOS_DE_RESULTADO).not.toContain('super')
    expect(desajustesEntre('El fármaco mejoró la supervivencia', 'El fármaco no aumentó la supervivencia'))
      .toHaveLength(0)
  })

  it('una marca por verbo, no una por raíz que case', () => {
    const d = desajustesEntre('El tratamiento mejoró la supervivencia', 'El tratamiento no mejoró la supervivencia')
    expect(d).toHaveLength(1)
  })

  it('sin verbo de resultado no hay nada que comparar', () => {
    expect(desajustesEntre('El estudio incluyó 400 pacientes', 'Se reclutaron 400 pacientes')).toHaveLength(0)
    expect(leerResultados('Se reclutaron 400 pacientes en 12 centros')).toHaveLength(0)
  })
})

describe('llega a la verificación y al médico', () => {
  it('`citasDesajustadas` marca el pasaje que contradice, con su pmid', () => {
    const r = citasDesajustadas([{
      texto: 'El tratamiento redujo la mortalidad',
      pasajes: [{ pmid: '123', texto: 'El tratamiento no redujo la mortalidad' }],
    }])
    expect(r).toHaveLength(1)
    expect(r[0].pmid).toBe('123')
    expect(r[0].desajuste.clase).toBe('polaridad_invertida')
  })

  it('si una afirmación cita dos artículos, se marca el pasaje que falla, no la afirmación', () => {
    const r = citasDesajustadas([{
      texto: 'El tratamiento redujo la mortalidad',
      pasajes: [
        { pmid: 'bueno', texto: 'El tratamiento redujo la mortalidad significativamente' },
        { pmid: 'malo', texto: 'El tratamiento no redujo la mortalidad' },
      ],
    }])
    expect(r.map(x => x.pmid)).toEqual(['malo'])
  })

  it('sin fuentes anclables el campo existe y va vacío, no ausente', () => {
    /* Un campo que a veces no está obliga a cada lector a defenderse de
       `undefined`, y el primero que se olvide lo lee como «no hay desajustes». */
    expect(verificarAfirmaciones([], [], '2026-08-30T00:00:00.000Z').desajustes).toEqual([])
  })

  it('la ruta lo avisa aparte de los otros dos problemas', () => {
    expect(RUTA).toContain('verificacion.desajustes.length > 0')
    expect(RUTA).toContain('dice LO CONTRARIO')
  })
})

describe('no se declara más de lo que hace', () => {
  it('lo que no vigila está enumerado, empezando por el entailment', () => {
    expect(LO_QUE_NO_SE_VIGILA.length).toBeGreaterThanOrEqual(4)
    expect(LO_QUE_NO_SE_VIGILA[0]).toContain('entailment')
    expect(LO_QUE_NO_SE_VIGILA.join(' ')).toContain('magnitud')
  })
})
