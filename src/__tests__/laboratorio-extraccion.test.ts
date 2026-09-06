import { describe, it, expect } from 'vitest'
import { aNumero, fechaValida, validarPanel, seriesDesdeHistorial } from '@/lib/expediente/laboratorio/extraccion'
import { analitoDe, valorPlausible } from '@/lib/expediente/laboratorio/analitos'

describe('lectura de números de laboratorio', () => {
  it('acepta coma decimal y desigualdades', () => {
    expect(aNumero('1,2')).toBe(1.2)
    expect(aNumero('<5')).toBe(5)
    expect(aNumero(92)).toBe(92)
  })
  it('rechaza lo ambiguo', () => {
    expect(aNumero('120/80')).toBeNull()
    expect(aNumero('positivo')).toBeNull()
    expect(aNumero('')).toBeNull()
  })
})

describe('fecha del estudio', () => {
  it('acepta YYYY-MM-DD razonable', () => {
    expect(fechaValida('2026-07-20')).toBe('2026-07-20')
  })
  it('rechaza formatos raros o años absurdos', () => {
    expect(fechaValida('20/07/2026')).toBe('')
    expect(fechaValida('1850-01-01')).toBe('')
    expect(fechaValida(undefined)).toBe('')
  })
})

describe('reconocimiento de analitos', () => {
  it('agrupa sinónimos en la misma clave', () => {
    expect(analitoDe('Glucosa')?.clave).toBe('glucosa')
    expect(analitoDe('Glu')?.clave).toBe('glucosa')
    expect(analitoDe('glicemia')?.clave).toBe('glucosa')
  })
  it('NO confunde hemoglobina glucosilada con hemoglobina', () => {
    expect(analitoDe('Hemoglobina glucosilada')?.clave).toBe('hba1c')
    expect(analitoDe('Hemoglobina')?.clave).toBe('hemoglobina')
  })
  it('NO confunde creatinina en orina con la sérica', () => {
    /**
     * REG-556: antes «Creatinina en orina» devolvía `null` —correcto, pero por
     * defecto: no había analito de orina y la exclusión del patrón la tiraba—.
     * Ahora el catálogo del dueño la trae (§20) y resuelve a su propio concepto.
     * Sigue sin caer en la sérica, que es lo que este caso vigila.
     */
    expect(analitoDe('Creatinina en orina')?.clave).toBe('creatinina_orina')
    expect(analitoDe('Creatinina')?.clave).toBe('creatinina')
  })
  it('descarta valores fuera de rango (otra unidad)', () => {
    expect(valorPlausible('creatinina', 1.1)).toBe(true)
    expect(valorPlausible('creatinina', 80)).toBe(false) // µmol/L, no mg/dL
  })
})

describe('validación del panel completo', () => {
  it('estructura, marca crítico y separa lo no reconocido', () => {
    const r = validarPanel({
      fecha: '2026-07-20',
      filas: [
        { estudio: 'Glucosa', valor: '92', unidad: 'mg/dL' },
        { estudio: 'Potasio', valor: '7.2', unidad: 'mEq/L' }, // crítico
        // REG-554: ya no «cae fuera de rango». Se CONVIERTE, con el factor citado
        // del §27.1 del catálogo del dueño: 80 / 88.4 = 0,905 mg/dL.
        { estudio: 'Creatinina', valor: '80', unidad: 'umol/L' },
        { estudio: 'Anticuerpo raro', valor: 'positivo' }, // no reconocido
      ],
    })
    expect(r.fecha).toBe('2026-07-20')
    const glu = r.resultados.find(x => x.clave === 'glucosa')
    expect(glu?.valor).toBe(92)
    expect(glu?.critico).toBe(false)
    expect(r.resultados.find(x => x.clave === 'potasio')?.critico).toBe(true)
    /**
     * REG-554. Antes la creatinina en µmol/L caía en `noReconocidas` junto al
     * anticuerpo, y eran dos cosas distintas: una es un analito que no
     * conocemos y la otra es un analito que SÍ conocemos, reportado en otra
     * unidad. Ahora se convierte con el factor citado y entra a la serie.
     */
    const cr = r.resultados.find(x => x.clave === 'creatinina')!
    expect(cr.valor).toBeCloseTo(0.905, 3)
    expect(cr.unidad).toBe('mg/dL')
    expect(cr.valorOriginal).toBe(80)
    expect(cr.unidadOriginal).toBe('umol/L')
    expect(cr.graficable).toBe(true)
    expect(r.noReconocidas.some(x => x.estudio === 'Creatinina')).toBe(false)
    // El anticuerpo sigue donde le toca: ése sí es un analito desconocido.
    expect(r.noReconocidas.some(x => x.estudio === 'Anticuerpo raro')).toBe(true)
  })

  it('NO conserva identificadores del paciente aunque vinieran', () => {
    // La función solo procesa `filas`; cualquier nombre/CURP que la IA metiera
    // en otro campo simplemente no se lee.
    const r = validarPanel({ fecha: '2026-07-20', filas: [{ estudio: 'Glucosa', valor: '92' }] })
    expect(JSON.stringify(r)).not.toMatch(/curp|nombre|paciente/i)
  })
})

describe('series temporales para las gráficas', () => {
  it('agrupa por analito y ordena por fecha', () => {
    const series = seriesDesdeHistorial([
      { fecha: '2026-07-20', resultados: [{ clave: 'glucosa', etiqueta: 'Glucosa', valor: 92, unidad: 'mg/dL', critico: false, graficable: true }] },
      { fecha: '2026-01-10', resultados: [{ clave: 'glucosa', etiqueta: 'Glucosa', valor: 180, unidad: 'mg/dL', critico: false, graficable: true }] },
    ])
    const glu = series.find(s => s.clave === 'glucosa')
    expect(glu?.puntos.map(p => p.fecha)).toEqual(['2026-01-10', '2026-07-20'])
    expect(glu?.puntos.map(p => p.valor)).toEqual([180, 92])
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P1): un valor de pánico reportado en una unidad NO
 * reconocida se archivaba como normal. Ahora se marca noEvaluable (verificar).
 */
describe('Unidad no reconocida → noEvaluable, no "normal"', () => {
  it('potasio 7.0 en una unidad rara NO se da por normal (se marca verificar)', () => {
    const p = validarPanel({ fecha: '2026-01-01', filas: [
      { estudio: 'Potasio', valor: '7.0', unidad: 'mmol-raro' },
    ]})
    const r = p.resultados.find(x => x.clave === 'potasio')
    expect(r).toBeTruthy()
    expect(r!.noEvaluable).toBe(true)
    expect(r!.critico).toBe(false)   // no se afirma crítico, pero tampoco se calla
  })
  it('potasio 7.0 SIN unidad usa la convencional y SÍ marca crítico', () => {
    const p = validarPanel({ fecha: '2026-01-01', filas: [
      { estudio: 'Potasio', valor: '7.0' },
    ]})
    const r = p.resultados.find(x => x.clave === 'potasio')!
    expect(r.noEvaluable).toBeFalsy()
    expect(r.critico).toBe(true)
  })
})
