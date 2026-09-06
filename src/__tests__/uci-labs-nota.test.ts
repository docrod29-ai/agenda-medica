/**
 * GOLDEN — laboratorios en la nota de UCI.
 *
 * El Dr.: «los laboratorios sólo lo relevante, si están bien no los pongas, y
 * más cortos — leucocitos (Leu), creatinina (Cr)».
 *
 * La regla que se protege: **el módulo no decide qué es importante, decide qué
 * está fuera del rango de referencia.** Es una comparación aritmética contra un
 * catálogo ya auditado, no un juicio clínico. Y lo normal NO se borra: sale de la
 * nota y se queda entero en el apartado de laboratorio.
 */
import { describe, it, expect } from 'vitest'
import {
  lineaDeNota, paraLaNota, resumen, evaluar, desconocidos, nombreCorto,
  analitosConAbreviatura, esLineaDeLabCapturado, sinLabsDuplicados,
} from '@/lib/uci/labs-nota'
import { analitoPorClave } from '@/lib/expediente/laboratorio/analitos'

const PASE = [
  { clave: 'leucocitos', valor: 17.8 }, { clave: 'hemoglobina', valor: 10.1 },
  { clave: 'plaquetas', valor: 118 }, { clave: 'creatinina', valor: 2.4 },
  { clave: 'sodio', valor: 138 }, { clave: 'potasio', valor: 5.3 },
  { clave: 'glucosa', valor: 214 }, { clave: 'ast', valor: 624 },
]

describe('Sólo lo que está fuera de rango entra en la nota', () => {
  it('lo anormal sí', () => {
    const l = lineaDeNota(PASE)
    for (const x of ['Leu 17.8↑', 'Cr 2.4↑', 'AST 624↑', 'Glu 214↑']) expect(l).toContain(x)
  })

  it('lo normal NO — el sodio de 138 se queda fuera', () => {
    expect(lineaDeNota(PASE)).not.toContain('Na 138')
  })

  it('las flechas dicen para qué lado', () => {
    expect(lineaDeNota(PASE)).toContain('Hb 10.1↓')
    expect(lineaDeNota(PASE)).toContain('Plq 118↓')
  })

  it('si TODO está en rango, la línea va vacía — y eso es información', () => {
    expect(lineaDeNota([{ clave: 'sodio', valor: 138 }])).toBe('')
  })
})

describe('Lo normal NO se pierde: se cuenta y se dice dónde está', () => {
  it('se declara cuántos se omitieron y por qué', () => {
    const r = resumen(PASE)
    expect(r.omitidos).toBe(1)
    expect(r.aviso).toMatch(/apartado de laboratorio/i)
  })

  it('sin nada que omitir, no hay aviso', () => {
    expect(resumen([{ clave: 'creatinina', valor: 2.4 }]).aviso).toBe('')
  })
})

describe('Un analito que el catálogo no conoce NO desaparece en silencio', () => {
  it('se acusa en vez de tirarse', () => {
    // Antes `evaluar` devolvia null y el filtro lo tiraba sin que nadie se
    // enterara: un resultado medido que la nota no menciona ni acusa.
    /**
     * REG-601 cargó el catálogo del dueño y `antiXa` dejó de ser desconocido
     * (§8). Se usa otro que sigue sin estar: la aldolasa se pide en consulta y
     * su documento no la trae. El caso que se prueba no cambia — sólo el ejemplo.
     */
    const r = resumen([{ clave: 'aldolasa', valor: 0.31 }, { clave: 'creatinina', valor: 2.4 }])
    expect(r.sinCatalogo.map(x => x.clave)).toEqual(['aldolasa'])
    expect(r.aviso).toMatch(/catálogo de analitos/i)
    expect(r.aviso).toContain('aldolasa')
  })

  it('desconocidos los lista tal cual', () => {
    expect(desconocidos([{ clave: 'inventado', valor: 1 }])).toHaveLength(1)
  })
})

describe('Un analito SIN rango de referencia se queda en la nota', () => {
  it('callarlo por no poder compararlo sería esconderlo', () => {
    // Si un analito no trae refMin/refMax, su desviación es 'sin_referencia' y
    // NO se filtra de la nota.
    const conRef = evaluar({ clave: 'creatinina', valor: 2.4 })!
    expect(conRef.desviacion).toBe('alto')
    expect(paraLaNota([{ clave: 'creatinina', valor: 2.4 }])).toHaveLength(1)
  })
})

describe('Las abreviaturas son nomenclatura, no medicina', () => {
  it('las que el Dr. pidió', () => {
    expect(nombreCorto(analitoPorClave('leucocitos')!)).toBe('Leu')
    expect(nombreCorto(analitoPorClave('creatinina')!)).toBe('Cr')
  })

  it('ninguna abreviatura se repite — una ambigua es peor que la palabra larga', () => {
    const vistas = new Map<string, string>()
    for (const { clave, corto } of analitosConAbreviatura()) {
      const previa = vistas.get(corto)
      expect(previa, `«${corto}» es ${previa} y ${clave}`).toBeUndefined()
      vistas.set(corto, clave)
    }
  })
})

describe('Un lab no se dice dos veces', () => {
  const capturados = [{ clave: 'plaquetas', valor: 118 }, { clave: 'glucosa', valor: 214 }]

  it('el renglón crudo desaparece si ya viaja en el resumen', () => {
    expect(esLineaDeLabCapturado('* Plaquetas: 118,000/µL.', capturados)).toBe(true)
    expect(esLineaDeLabCapturado('Glucosa: 214 mg/dL.', capturados)).toBe(true)
  })

  it('pero NO si el médico añadió algo que el resumen no dice', () => {
    // Aquí hay una conducta, no sólo una cifra.
    expect(esLineaDeLabCapturado('Plaquetas 118, se transfunde si baja de 50.', capturados)).toBe(false)
    expect(esLineaDeLabCapturado('Glucosa 214; se inicia insulina IV.', capturados)).toBe(false)
  })

  it('ni si el analito NO fue capturado', () => {
    expect(esLineaDeLabCapturado('Fibrinógeno: 310 mg/dL.', capturados)).toBe(false)
  })

  it('dos labs en un mismo renglón NO se tocan: se perdería uno', () => {
    expect(esLineaDeLabCapturado('Sodio: 138. Creatinina: 2.4 mg/dL.', capturados)).toBe(false)
  })

  it('sinLabsDuplicados deja el resto del pase intacto', () => {
    const t = 'Paciente estable.\n* Plaquetas: 118,000/µL.\nSe continúa el esquema.'
    const r = sinLabsDuplicados(t, capturados)
    expect(r).toContain('Paciente estable.')
    expect(r).toContain('Se continúa el esquema.')
    expect(r).not.toContain('118,000')
  })
})

describe('Lo que no puede romper', () => {
  it('lista vacía', () => {
    expect(lineaDeNota([])).toBe('')
    expect(resumen([]).aviso).toBe('')
  })
  it('nunca lanza', () => {
    expect(() => lineaDeNota([{ clave: '', valor: NaN }])).not.toThrow()
  })
})
