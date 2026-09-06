/**
 * GOLDEN — el aviso de teratógenos «evitar» con el embarazo como diferencial.
 *
 * ── LA DECISIÓN, Y DE QUIÉN ES ──────────────────────────────────────────────
 *
 * **31-ago-2026, el médico dueño**: un embarazo listado como DIFERENCIAL sí
 * cuenta para avisar. Antes no contaba, y no por decisión sino por
 * conservación: al mudar la lectura del embarazo a su propio módulo (REG-575)
 * apareció que **el comentario del copiloto y su código llevaban años
 * contradiciéndose** —el comentario decía que un presuntivo o un diferencial
 * «sí cuentan para AVISAR», y el código excluía el diferencial— y se conservó
 * la conducta del código porque cambiarla mueve un aviso de seguridad.
 *
 * Ahora el comentario es cierto.
 *
 * ── EL ALCANCE, QUE LA PREGUNTA SOBREESTIMABA ───────────────────────────────
 *
 * `LA_DISCREPANCIA_DEL_DIFERENCIAL` decía que esto movía «el aviso de fármaco
 * CONTRAINDICADO en embarazo». **Era falso**, y se vio midiendo el copiloto
 * antes de preguntarle al dueño. Su condición es:
 *
 *     x.embarazo === 'contraindicado' || (x.embarazo === 'evitar' && embarazoConfirmado)
 *
 * · Los SIETE `contraindicado` —IECA/ARA II, warfarina, ACOD, isotretinoína,
 *   valproato, metotrexato, agonistas GLP-1— avisan **siempre**, en cualquier
 *   mujer en edad fértil. Esta decisión no los toca.
 * · Los CUATRO `evitar` —estatinas, tetraciclinas y doxiciclina, quinolonas,
 *   AINE— avisan sólo si se trata como embarazada. **Ésos son los que cambian.**
 *
 * Preguntar con el alcance equivocado habría sido pedirle una decisión sobre
 * algo que no estaba decidiendo.
 *
 * ── EL COSTE, QUE EL CÓDIGO YA TENÍA ESCRITO ────────────────────────────────
 *
 * `riesgoGestacional` lo dice con estas palabras: los `evitar` piden embarazo
 * confirmado *«sin esto se metería ruido en toda mujer en edad fértil»*. O sea:
 * había un argumento declarado en contra, y la decisión se tomó conociéndolo.
 *
 * Lo que lo hace aceptable, y es lo que se le planteó: son **cuatro** fármacos,
 * así que la fatiga de alerta que se compra es acotada; y el aviso ya no salta
 * en toda mujer en edad fértil sino sólo cuando **alguien escribió un embarazo
 * en el cuadro** —aunque sea como hipótesis—, que es un acto del médico y no
 * una suposición del sistema.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **La lactancia**, que es otra lista y otro mecanismo (transferencia a leche,
 *   no teratogenicidad).
 * · **El puerperio**: sigue sin contar como embarazo, y debe — la paciente ya no
 *   lo está (icu-013).
 * · **Los vocabularios**: un embarazo escrito con una palabra que
 *   `diagnosticosGestacionales` no reconoce no se ve. Vocabulario, no criterio.
 * · **Si el aviso se LEE**: eso es pantalla, y no se comprueba aquí.
 */
import { describe, it, expect } from 'vitest'
import { copiloto } from '@/lib/expediente/copiloto'
import {
  tratarComoEmbarazada, loQueElExpedienteDiceDelEmbarazo,
  LA_DECISION_DEL_DIFERENCIAL,
} from '@/lib/expediente/lo-que-el-expediente-dice-del-embarazo'

/** Mujer en edad fértil: fuera de esa guarda el motor no opina, y así sigue. */
const avisos = (diagnosticos: unknown[], nombre: string) =>
  copiloto({ sexo: 'F', edad: 29, diagnosticos, medicamentos: [{ nombre }] } as never)
    .filter(s => s.id.startsWith('gesta'))

describe('lo que cambia: la rama «evitar»', () => {
  it('doxiciclina con el embarazo como DIFERENCIAL ahora avisa', () => {
    /* AL REVÉS: antes de la decisión esto devolvía []. */
    const s = avisos([{ descripcion: 'Embarazo', tipo: 'diferencial' }], 'Doxiciclina 100 mg')
    expect(s).toHaveLength(1)
    expect(s[0].nivel).toBe('accion')
    expect(s[0].titulo).toMatch(/evítalo en el embarazo/i)
  })

  it('y también con presuntivo, que ya avisaba', () => {
    expect(avisos([{ descripcion: 'Embarazo', tipo: 'presuntivo' }], 'Quinolona: ciprofloxacino')).toHaveLength(1)
  })

  it('un embarazo DESCARTADO sigue sin avisar', () => {
    /* Ampliar a quién se avisa no puede convertir una prueba negativa en una
       sospecha: «embarazo descartado» es como se documenta un test negativo. */
    expect(avisos([{ descripcion: 'Embarazo', tipo: 'descartado' }], 'Doxiciclina 100 mg')).toEqual([])
  })

  it('y SIN diagnóstico gestacional tampoco: ausencia de dato no es dato de ausencia… ni de presencia', () => {
    /**
     * El caso que impide que la decisión se pase de frenada. Si esto avisara, el
     * aviso saltaría en TODA mujer en edad fértil con doxiciclina — que es
     * exactamente el ruido que `riesgoGestacional` declara querer evitar.
     */
    expect(avisos([{ descripcion: 'Faringitis', tipo: 'definitivo' }], 'Doxiciclina 100 mg')).toEqual([])
  })
})

describe('lo que NO cambia: la rama «contraindicado»', () => {
  it('warfarina avisa sin ningún diagnóstico gestacional, como antes', () => {
    const s = avisos([{ descripcion: 'Faringitis', tipo: 'definitivo' }], 'Warfarina 5 mg')
    expect(s).toHaveLength(1)
    expect(s[0].nivel).toBe('critico')
    expect(s[0].titulo).toMatch(/contraindicado en el embarazo/i)
  })

  it('y también con el embarazo descartado: el crítico no depende de la lectura', () => {
    expect(avisos([{ descripcion: 'Embarazo', tipo: 'descartado' }], 'Isotretinoína')).toHaveLength(1)
  })
})

describe('las guardas de siempre siguen en pie', () => {
  it('un varón no recibe ninguno de los dos', () => {
    const s = copiloto({ sexo: 'M', edad: 29, diagnosticos: [{ descripcion: 'Embarazo', tipo: 'diferencial' }], medicamentos: [{ nombre: 'Doxiciclina' }] } as never)
    expect(s.filter(x => x.id.startsWith('gesta'))).toEqual([])
  })

  it('ni una paciente fuera de la edad de la guarda', () => {
    for (const edad of [8, 62]) {
      const s = copiloto({ sexo: 'F', edad, diagnosticos: [{ descripcion: 'Embarazo', tipo: 'diferencial' }], medicamentos: [{ nombre: 'Doxiciclina' }] } as never)
      expect(s.filter(x => x.id.startsWith('gesta')), String(edad)).toEqual([])
    }
  })
})

describe('la lectura, y la decisión registrada', () => {
  it('sólo se excluye lo que alguien DESCARTÓ', () => {
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([{ descripcion: 'Embarazo', tipo: 'diferencial' }]))).toBe(true)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([{ descripcion: 'Embarazo', tipo: 'descartado' }]))).toBe(false)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([]))).toBe(false)
  })

  it('un descartado viejo no tapa un diferencial vivo', () => {
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([
      { descripcion: 'Embarazo descartado', tipo: 'descartado' },
      { descripcion: 'Embarazo', tipo: 'diferencial' },
    ]))).toBe(true)
  })

  it('la decisión queda con su fecha, su razón y su alcance real', () => {
    expect(LA_DECISION_DEL_DIFERENCIAL).toContain('31-ago-2026')
    expect(LA_DECISION_DEL_DIFERENCIAL).toMatch(/evitar/)
    /* Que los `contraindicado` no dependían de esto tiene que quedar escrito:
       era el error de la pregunta original. */
    expect(LA_DECISION_DEL_DIFERENCIAL).toMatch(/no dependían de esto/)
    expect(LA_DECISION_DEL_DIFERENCIAL).toMatch(/POR CONSERVACIÓN, no por/)
  })
})
