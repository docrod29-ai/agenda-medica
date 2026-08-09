/**
 * EL ARNÉS NO CAZABA LA ALUCINACIÓN QUE IMPORTA — REG-197.
 *
 * ── MEDIDO CON EL PROPIO MOTOR, ANTES DE TOCARLO ─────────────────────────────
 *
 * Entrada: «El paciente tiene diabetes.» · Oro: `dx = diabetes mellitus tipo 2`
 *
 * | Lo que inventa el modelo | ¿Se detectaba? |
 * |---|---|
 * | «diabetes **con nefropatía estadio 4 y retinopatía**» en campo nuevo | **no** |
 * | «diabetes mellitus tipo 2 **con nefropatía estadio 4**» en el campo bueno | **no** |
 * | «lupus eritematoso sistémico» (nada en común) | sí |
 *
 * Dos de tres pasaban invisibles, y **las dos que pasaban son las peligrosas**:
 * la alucinación clínica real casi nunca es un texto entero inventado — es un
 * texto correcto con dos palabras de más, y ésas son las que cambian el
 * tratamiento.
 *
 * ── LAS TRES CAUSAS ──────────────────────────────────────────────────────────
 *
 * 1. **`some()` en vez de proporción.** Bastaba UNA palabra de más de tres
 *    letras presente en la entrada para dar por sustentado todo el valor.
 * 2. **Los campos esperados no se revisaban.** `if (campo in oro.esperado)
 *    continue` los saltaba enteros: lo inventado pegado a un dato correcto era
 *    invisible por construcción.
 * 3. **`v.includes(ov)` absolvía.** Que el generado CONTENGA el valor del oro se
 *    tomaba como respaldo — y es exactamente lo contrario: contiene el oro **y
 *    algo más**.
 *
 * Un arnés que sólo caza lo fácil mide la tranquilidad, no el riesgo.
 */
import { describe, it, expect } from 'vitest'
import { evaluarCaso, sinSustento, PROPORCION_SIN_RESPALDO } from '@/lib/ia/evaluacion'

const oro = {
  id: 'p1',
  entrada: 'El paciente tiene diabetes.',
  esperado: { dx: 'diabetes mellitus tipo 2' },
} as never

const evaluar = (campos: Record<string, string>) =>
  evaluarCaso(oro, { id: 'p1', campos } as never)

describe('las tres alucinaciones se detectan, no sólo la fácil', () => {
  it('inventada en un campo NUEVO, pegada a algo cierto', () => {
    expect(evaluar({
      dx: 'diabetes mellitus tipo 2',
      extra: 'diabetes con nefropatía estadio 4 y retinopatía proliferativa',
    }).alucinaciones).toContain('extra')
  })

  it('inventada DENTRO del campo correcto — la más peligrosa', () => {
    /**
     * El modelo devuelve el diagnóstico bueno CON un añadido. `equivalente()`
     * lo daba por acierto y nadie miraba el contenido de más.
     */
    expect(evaluar({ dx: 'diabetes mellitus tipo 2 con nefropatía estadio 4' }).alucinaciones)
      .toContain('dx')
  })

  it('inventada entera — la que ya se cazaba', () => {
    expect(evaluar({ extra: 'lupus eritematoso sistémico' }).alucinaciones).toContain('extra')
  })
})

describe('y lo correcto no se marca — sin falsos positivos', () => {
  it('el valor exacto del oro', () => {
    expect(evaluar({ dx: 'diabetes mellitus tipo 2' }).alucinaciones).toEqual([])
  })
  it('reformulado con mayúsculas y punto', () => {
    expect(evaluar({ dx: 'Diabetes Mellitus tipo 2.' }).alucinaciones).toEqual([])
  })
  it('un subconjunto del oro no añade nada', () => {
    expect(evaluar({ dx: 'diabetes mellitus' }).alucinaciones).toEqual([])
  })
  it('un campo vacío no es una alucinación', () => {
    expect(evaluar({ dx: 'diabetes mellitus tipo 2', extra: '   ' }).alucinaciones).toEqual([])
  })
})

describe('se mide la proporción, no «alguna palabra»', () => {
  it('una palabra suelta de más no dispara — es variación de redacción', () => {
    expect(sinSustento('diabetes mellitus tipo controlada', 'diabetes mellitus tipo', '')).toBe(false)
  })

  it('pero contenido nuevo de verdad sí', () => {
    expect(sinSustento('nefropatia estadio retinopatia proliferativa', 'diabetes', '')).toBe(true)
  })

  it('las palabras vacías no cuentan como contenido', () => {
    // «con», «para», «que» no aportan: su ausencia en la entrada no significa
    // que se haya inventado nada.
    expect(sinSustento('diabetes con para que', 'diabetes', '')).toBe(false)
  })

  it('un valor sin palabras largas no se juzga', () => {
    expect(sinSustento('el la de', 'otra cosa', '')).toBe(false)
  })

  it('el umbral es de método, y está declarado', () => {
    // Por debajo de un tercio se acepta como variación de redacción. No es un
    // umbral clínico: es cuánto ruido de lenguaje se tolera.
    expect(PROPORCION_SIN_RESPALDO).toBeCloseTo(1 / 3, 5)
  })
})
