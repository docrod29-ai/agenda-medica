import { describe, it, expect } from 'vitest'
import {
  AJUSTE_RENAL, ajustePorTFG, revisarListaRenal, estadioERC,
  RIESGO_HEPATICO, EMBARAZO_LACTANCIA, revisarFarmaco,
} from '@/lib/expediente/prescripcion-segura'

const f = (n: string) => AJUSTE_RENAL.find(x => x.nombre === n)!

describe('Ajuste por función renal', () => {
  it('metformina: habitual ≥45, reducida 30-45, contraindicada <30', () => {
    expect(ajustePorTFG(f('Metformina'), 60)!.contraindicado).toBe(false)
    expect(ajustePorTFG(f('Metformina'), 38)!.conducta).toMatch(/1000 mg/)
    const bajo = ajustePorTFG(f('Metformina'), 20)!
    expect(bajo.contraindicado).toBe(true)
    expect(bajo.conducta).toMatch(/acidosis láctica/i)
  })

  it('los límites de rango son exactos (45 ya es dosis habitual, 44 no)', () => {
    expect(ajustePorTFG(f('Metformina'), 45)!.conducta).toMatch(/habitual/i)
    expect(ajustePorTFG(f('Metformina'), 44)!.conducta).toMatch(/No iniciar/)
    expect(ajustePorTFG(f('Metformina'), 30)!.contraindicado).toBe(false)
    expect(ajustePorTFG(f('Metformina'), 29)!.contraindicado).toBe(true)
  })

  it('enoxaparina pasa de cada 12 h a cada 24 h por debajo de 30', () => {
    expect(ajustePorTFG(f('Enoxaparina'), 50)!.conducta).toMatch(/cada 12 h/)
    expect(ajustePorTFG(f('Enoxaparina'), 20)!.conducta).toMatch(/cada 24 h/)
  })

  it('AINE quedan contraindicados por debajo de 30', () => {
    expect(ajustePorTFG(f('Antiinflamatorios no esteroideos'), 20)!.contraindicado).toBe(true)
    expect(f('Antiinflamatorios no esteroideos').nota).toMatch(/triple whammy/i)
  })

  it('nitrofurantoína se evita <30 porque deja de ser eficaz', () => {
    const r = ajustePorTFG(f('Nitrofurantoína'), 25)!
    expect(r.contraindicado).toBe(true)
    expect(r.conducta).toMatch(/concentración urinaria/i)
  })

  it('vancomicina: lo que se ajusta es el intervalo, no la carga', () => {
    expect(ajustePorTFG(f('Vancomicina'), 20)!.conducta).toMatch(/carga NO se ajusta/i)
  })

  it('todo fármaco cubre el rango completo de TFG sin huecos', () => {
    for (const x of AJUSTE_RENAL) {
      for (const tfg of [0, 5, 14, 15, 25, 29, 30, 44, 45, 59, 60, 89, 90, 120]) {
        expect(ajustePorTFG(x, tfg), `${x.nombre} @ TFG ${tfg}`).not.toBeNull()
      }
    }
  })

  it('rechaza TFG inválida', () => {
    expect(ajustePorTFG(f('Metformina'), -1)).toBeNull()
    expect(ajustePorTFG(f('Metformina'), NaN)).toBeNull()
  })
})

describe('Revisión de la lista de medicamentos del paciente', () => {
  it('detecta los que requieren acción e ignora los que no están en el catálogo', () => {
    const r = revisarListaRenal(['Metformina 850 mg', 'Losartán', 'Gabapentina'], 25)
    expect(r.map(x => x.farmaco)).toContain('Metformina')
    expect(r.map(x => x.farmaco)).toContain('Gabapentina')
    expect(r.map(x => x.farmaco)).not.toContain('Losartán')
  })

  it('pone los CONTRAINDICADOS primero: son los que no pueden pasar desapercibidos', () => {
    const r = revisarListaRenal(['Gabapentina', 'Metformina'], 20)
    expect(r[0].farmaco).toBe('Metformina')
    expect(r[0].contraindicado).toBe(true)
  })

  it('encuentra el fármaco aunque venga con acentos o mayúsculas distintas', () => {
    expect(revisarListaRenal(['NITROFURANTOINA'], 20)).toHaveLength(1)
    expect(revisarListaRenal(['apixaban 5 mg'], 10)).toHaveLength(1)
  })

  it('lista vacía devuelve vacío', () => {
    expect(revisarListaRenal([], 30)).toHaveLength(0)
  })
})

describe('Estadio de enfermedad renal crónica (KDIGO)', () => {
  it('clasifica cada estadio', () => {
    expect(estadioERC(95)!.estadio).toBe('G1')
    expect(estadioERC(70)!.estadio).toBe('G2')
    expect(estadioERC(50)!.estadio).toBe('G3a')
    expect(estadioERC(35)!.estadio).toBe('G3b')
    expect(estadioERC(20)!.estadio).toBe('G4')
    expect(estadioERC(10)!.estadio).toBe('G5')
  })
  it('G1 y G2 aclaran que necesitan daño renal documentado', () => {
    expect(estadioERC(95)!.descripcion).toMatch(/daño renal documentado/i)
    expect(estadioERC(70)!.descripcion).toMatch(/daño renal documentado/i)
  })
})

describe('Enfermedad hepática', () => {
  it('las estatinas NO están contraindicadas en hepatopatía estable', () => {
    const e = RIESGO_HEPATICO.find(x => /Estatinas/.test(x.farmaco))!
    expect(e.riesgo).toBe('vigilar')
    expect(e.motivo).toMatch(/NO están contraindicadas/i)
  })
  it('paracetamol sigue siendo de elección pero limitado a 2 g en cirrosis', () => {
    const p = RIESGO_HEPATICO.find(x => /Paracetamol/.test(x.farmaco))!
    expect(p.motivo).toMatch(/2 g/)
    expect(p.riesgo).toBe('ajustar')
  })
  it('las benzodiacepinas se evitan por encefalopatía, con alternativa nombrada', () => {
    const b = RIESGO_HEPATICO.find(x => /Benzodiacepinas/.test(x.farmaco))!
    expect(b.riesgo).toBe('evitar')
    expect(b.motivo).toMatch(/lorazepam|oxazepam/i)
  })
})

describe('Embarazo y lactancia', () => {
  it('los IECA y ARA II están contraindicados y traen alternativa', () => {
    const i = EMBARAZO_LACTANCIA.find(x => /enzima convertidora/.test(x.farmaco))!
    expect(i.embarazo).toBe('contraindicado')
    expect(i.alternativa).toMatch(/labetalol|nifedipino|metildopa/i)
  })

  it('warfarina: contraindicada en embarazo pero COMPATIBLE con la lactancia', () => {
    const w = EMBARAZO_LACTANCIA.find(x => /Warfarina/.test(x.farmaco))!
    expect(w.embarazo).toBe('contraindicado')
    expect(w.lactancia).toBe('compatible')
  })

  it('levotiroxina se continúa y el requerimiento SUBE en el embarazo', () => {
    const l = EMBARAZO_LACTANCIA.find(x => /Levotiroxina/.test(x.farmaco))!
    expect(l.embarazo).toBe('seguro-conocido')
    expect(l.motivo).toMatch(/AUMENTAR/)
  })

  it('los AINE se evitan por semana 20 y 30, con alternativa', () => {
    const a = EMBARAZO_LACTANCIA.find(x => /Antiinflamatorios/.test(x.farmaco))!
    expect(a.motivo).toMatch(/20/)
    expect(a.motivo).toMatch(/conducto arterioso/i)
  })

  it('todo lo contraindicado o a evitar trae motivo explícito', () => {
    for (const x of EMBARAZO_LACTANCIA) {
      expect(x.motivo.length, x.farmaco).toBeGreaterThan(20)
    }
  })
})

describe('Revisión integral de un fármaco', () => {
  it('metformina aparece en renal y en hepático', () => {
    const r = revisarFarmaco('metformina')
    expect(r.renal).toBeDefined()
    expect(r.hepatico).toBeDefined()
  })
  it('los AINE aparecen en las tres listas', () => {
    const r = revisarFarmaco('Antiinflamatorios no esteroideos')
    expect(r.renal).toBeDefined()
    expect(r.hepatico).toBeDefined()
    expect(r.gestacional).toBeDefined()
  })
  it('un fármaco fuera del catálogo no devuelve nada inventado', () => {
    const r = revisarFarmaco('xyzabc')
    expect(r.renal).toBeUndefined()
    expect(r.hepatico).toBeUndefined()
    expect(r.gestacional).toBeUndefined()
  })
  it('detecta IECA/ARA-II en embarazo por PRINCIPIO ACTIVO (no solo por clase)', () => {
    // El nombre de clase no casa con estos; la alerta crítica dependía de ello.
    for (const f of ['enalapril', 'Losartán', 'telmisartan', 'captopril', 'valsartan']) {
      const r = revisarFarmaco(f)
      expect(r.gestacional, `${f} debería marcar riesgo gestacional`).toBeDefined()
      expect(r.gestacional?.embarazo).toBe('contraindicado')
    }
  })
  it('detecta anticoagulantes orales directos y GLP-1 inyectables en embarazo', () => {
    for (const f of ['rivaroxaban', 'apixabán', 'dabigatran', 'liraglutida', 'dulaglutida']) {
      const r = revisarFarmaco(f)
      expect(r.gestacional, `${f} debería marcar riesgo gestacional`).toBeDefined()
      expect(r.gestacional?.embarazo).toBe('contraindicado')
    }
  })
})

describe('Regresión: no inventar coincidencias con cadenas vacías', () => {
  it('una línea en blanco NO inventa una contraindicación de metformina', () => {
    expect(revisarListaRenal([''], 20)).toHaveLength(0)
    expect(revisarListaRenal(['', '  ', 'a'], 20)).toHaveLength(0)
  })
  it('revisarFarmaco con texto vacío no devuelve nada', () => {
    const r = revisarFarmaco('')
    expect(r.renal).toBeUndefined()
    expect(r.hepatico).toBeUndefined()
    expect(r.gestacional).toBeUndefined()
  })
  it('un nombre real sigue funcionando', () => {
    expect(revisarListaRenal(['metformina'], 20)).toHaveLength(1)
  })
})

/**
 * REGRESIÓN auditoría 2026-07 (P0 — lo hallaron CINCO especialistas por separado).
 * El catálogo renal guardaba dos entradas con nombre de CLASE y sin sinónimos, así
 * que ninguna receta real ("Ketorolaco 30 mg") casaba: la contraindicación de AINE
 * con TFG<30 y la nota de la "triple whammy" eran CÓDIGO MUERTO.
 */
describe('AINE y aminoglucósidos SÍ casan por principio activo', () => {
  const aine = ['Ibuprofeno 400 mg', 'Ketorolaco 30 mg', 'Naproxeno', 'Diclofenaco', 'Meloxicam', 'Celecoxib']
  const amino = ['Gentamicina 240 mg', 'Amikacina', 'Tobramicina']

  for (const n of aine) {
    it(`${n} con TFG 24 → CONTRAINDICADO (antes: sin ninguna alerta)`, () => {
      const r = revisarListaRenal([n], 24)
      expect(r.length).toBeGreaterThan(0)
      expect(r[0].contraindicado).toBe(true)
    })
  }

  it('el AINE con TFG 45 avisa pero NO contraindica (la regla intermedia vive)', () => {
    const r = revisarListaRenal(['Ibuprofeno 400 mg'], 45)
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].contraindicado).toBeFalsy()
  })

  it('la nota de la "triple whammy" ya llega al médico', () => {
    const r = revisarListaRenal(['Ketorolaco 30 mg'], 24)
    expect(JSON.stringify(r)).toMatch(/triple whammy/i)
  })

  for (const n of amino) {
    it(`${n} con TFG 40 sí encuentra su ajuste`, () => {
      expect(revisarListaRenal([n], 40).length).toBeGreaterThan(0)
    })
  }

  it('lo que ya funcionaba sigue igual (metformina)', () => {
    const r = revisarListaRenal(['Metformina 850 mg'], 24)
    expect(r[0].contraindicado).toBe(true)
  })

  it('un fármaco ajeno al catálogo no inventa nada', () => {
    expect(revisarListaRenal(['Loratadina 10 mg'], 24)).toEqual([])
  })

  it('una fila vacía o a medio teclear NO inventa contraindicación', () => {
    expect(revisarListaRenal([''], 24)).toEqual([])
    expect(revisarListaRenal(['me'], 24)).toEqual([])
  })
})
