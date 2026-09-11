/**
 * Reproducción: el evaluador real daba 100 % a dosis, negaciones y lateralidad
 * alteradas porque aceptaba subcadenas. Son textos sintéticos para comprobar el
 * instrumento, no recomendaciones terapéuticas ni una validación de un modelo.
 */
import { describe, expect, it } from 'vitest'
import { equivalente, evaluarConjunto } from '@/lib/ia/evaluacion'

const alteraciones = [
  ['niega fiebre', 'fiebre'],
  ['5 mg', '15 mg'],
  ['0.5 mg', '5 mg'],
  ['ceftriaxona', 'no ceftriaxona'],
  ['rodilla izquierda', 'rodilla'],
  ['5 mg por vía oral', '5 mg'],
  ['cada 8 horas', 'cada 18 horas'],
  ['durante 5 días', 'durante 15 días'],
  ['sin alergias', 'alergias'],
] as const

describe('la medición objetiva no compensa una alteración clínica', () => {
  it.each(alteraciones)('no declara equivalentes «%s» y «%s»', (oro, generado) => {
    expect(equivalente(oro, generado)).toBe(false)
    expect(equivalente(generado, oro)).toBe(false)
  })

  it('el informe cuenta todos los campos alterados como errores', () => {
    const oro = alteraciones.map(([valor], i) => ({ id: `sintetico-${i}`, entrada: valor, esperado: { dato: valor } }))
    const salidas = alteraciones.map(([, valor], i) => ({ id: `sintetico-${i}`, campos: { dato: valor } }))
    expect(evaluarConjunto(oro, salidas).resumen).toMatchObject({
      casos: alteraciones.length, correctos: 0, incorrectos: alteraciones.length,
      exactitudCampo: 0, tasaError: 1,
    })
  })

  it('conserva diferencias de acentos, mayúsculas y espacios', () => {
    expect(equivalente('  VÍA ORAL  ', 'vía oral')).toBe(true)
    expect(equivalente('Bronquitis aguda', 'bronquitis aguda.')).toBe(true)
  })
})
