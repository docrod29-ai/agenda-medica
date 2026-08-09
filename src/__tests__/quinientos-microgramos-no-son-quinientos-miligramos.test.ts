/**
 * «500 MICROGRAMOS» SE LEÍA COMO 500 mg — REG-289.
 *
 * ── LO MEDIDO ───────────────────────────────────────────────────────────────
 *
 * Con `extraerMg` de verdad, sobre el árbol que corre en producción:
 *
 *     extraerMg('500 mcg')          →  0.5    ✓
 *     extraerMg('500 microgramos')  →  500    ← MIL VECES la dosis
 *     extraerMg('1000 UI')          →  1000   ← no son miligramos de nada
 *
 * La abreviatura estaba en la lista. **La palabra escrita no.** Y se dicta con
 * la palabra entera todos los días.
 *
 * ── LA CAUSA NO ES LA LISTA CORTA: ES EL PASO 3 ─────────────────────────────
 *
 * `extraerMg` termina con *«número sin unidad: se asume mg»*. Ese paso es
 * correcto para un «500» pelado — y se tragaba **cualquier unidad que la lista
 * no conociera**, convirtiéndola en miligramos en silencio.
 *
 * Es el mismo daño que ya costó el volumen: entonces se arregló devolviendo
 * `null` para mililitros, con este comentario en el código —
 *
 *   *«Antes "5 mL" se leía como 5 mg y silenciaba la red de seguridad»*
 *
 * — y la lección no se generalizó. Sólo se tapó el caso encontrado.
 *
 * ── Y LAS ABREVIATURAS LATINAS APAGABAN EL TECHO DIARIO ─────────────────────
 *
 * `QID`, `TID`, `BID` devolvían `null`. Y `null` no es inocuo: el llamador hace
 * `Math.max(1, Math.floor(tomasDia ?? 1))`, así que **asume una toma al día**.
 *
 * Paracetamol 1000 mg `QID` son **4 000 mg** —el techo entero— y se comprobaban
 * 1 000. El techo diario no fallaba: **no se ejecutaba**.
 *
 * El propio módulo ya había documentado este modo de fallo para los números
 * escritos con letra. La lista era corta; el modo de fallo, el mismo.
 */
import { describe, it, expect } from 'vitest'
import { extraerMg, extraerTomasDia, revisarDosis } from '@/lib/seguridad/dosis'

describe('la palabra escrita vale lo mismo que la abreviatura', () => {
  it('«500 microgramos» son 0,5 mg, no 500', () => {
    expect(extraerMg('500 microgramos')).toBe(0.5)
    expect(extraerMg('500 microgramos')).toBe(extraerMg('500 mcg'))
  })

  it('«250 miligramos» son 250 mg', () => {
    expect(extraerMg('250 miligramos')).toBe(250)
    expect(extraerMg('250 miligramos')).toBe(extraerMg('250 mg'))
  })

  it('y el gramo escrito sigue valiendo mil', () => {
    expect(extraerMg('1.5 gramos')).toBe(1500)
    expect(extraerMg('1,5 g')).toBe(1500)
  })
})

describe('lo que NO es masa devuelve null, no miligramos', () => {
  /**
   * `null` significa «no se puede validar en mg», que es la respuesta honesta.
   * El llamador ya sabe tratarlo: es lo que hace con los mililitros desde que
   * se arregló ese mismo agujero.
   */
  for (const [texto, porque] of [
    ['1000 UI', 'vitamina D, no son miligramos'],
    ['2 U', 'insulina'],
    ['10 mEq', 'potasio'],
    ['20 gotas', 'una forma, no una masa'],
    ['5 mL', 'volumen — ya estaba, y es el precedente'],
  ] as const) {
    it(`«${texto}» → null (${porque})`, () => {
      expect(extraerMg(texto)).toBeNull()
    })
  }

  it('pero un número PELADO sigue asumiendo mg', () => {
    /**
     * El paso 3 no se quita: «500» a secas es lo que la gente escribe y
     * devolver `null` ahí apagaría la red de seguridad en el caso más común.
     * Lo que se quita es que se trague las unidades desconocidas.
     */
    expect(extraerMg('500')).toBe(500)
  })
})

describe('las abreviaturas latinas ya no apagan el techo diario', () => {
  for (const [frec, tomas] of [
    ['QID', 4], ['qid', 4], ['TID', 3], ['BID', 2], ['QD', 1],
    ['q8h', 3], ['q 6 h', 4],
  ] as const) {
    it(`«${frec}» son ${tomas} tomas al día`, () => {
      expect(extraerTomasDia(frec)).toBe(tomas)
    })
  }

  it('y lo que ya se entendía se sigue entendiendo', () => {
    expect(extraerTomasDia('cada 8 horas')).toBe(3)
    expect(extraerTomasDia('tres veces al día')).toBe(3)
    /* El intervalo MÁS CORTO = más tomas = lectura segura para un techo. */
    expect(extraerTomasDia('cada 4 a 6 horas')).toBe(6)
  })

  it('lo que no se entiende sigue devolviendo null, no un número inventado', () => {
    /** Inventar una frecuencia es peor que no tenerla. */
    expect(extraerTomasDia('a demanda')).toBeNull()
    expect(extraerTomasDia('')).toBeNull()
  })
})

describe('lo que este arreglo NO cubre, dicho en vez de dejarlo creer', () => {
  it('`revisarDosis` recibe una CANTIDAD tipada, no el texto', () => {
    /**
     * `EntradaDosis.dosis` es un `ClinicalQuantity`, así que el techo diario se
     * comprueba sobre una cifra que ya trae su unidad. Lo que este REG repara
     * está **antes**: `extraerMg` y `extraerTomasDia`, que son quienes traducen
     * el texto libre a esa cifra.
     *
     * Se dice aquí porque probar el techo con una cantidad tipada NO habría
     * encontrado ninguno de los dos defectos — y una prueba que no puede fallar
     * por lo que dice cubrir es peor que no tenerla.
     */
    expect(typeof revisarDosis).toBe('function')
  })

  it('y la traducción es donde estaba el fallo: 500 microgramos y QID', () => {
    expect(extraerMg('500 microgramos')).toBe(0.5)
    expect(extraerTomasDia('QID')).toBe(4)
  })
})
