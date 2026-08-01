/**
 * «LEVOTIROXINA 100» — mil veces la dosis, y se imprime tal cual.
 *
 * `extraerMg` asume MILIGRAMOS cuando no encuentra unidad: «500» → 500 mg. Para
 * casi todo es razonable; para lo que se dosifica en microgramos no lo es en
 * absoluto. Levotiroxina 100 son 100 mcg en la vida real y 100 mg en el papel.
 * Lo mismo con fentanilo, digoxina, clonidina o levonorgestrel.
 *
 * Y lo que sale por la impresora, firmado, es el texto que escribió el médico:
 * quien lo lee en la farmacia tiene que adivinar.
 *
 * El módulo de antimicrobianos ya exigía la unidad —«una cifra sin unidad no se
 * puede comparar con nada»— y la receta de todos los días, que se usa cien veces
 * más, no. Esto iguala las dos.
 *
 * La otra mitad de estas pruebas defiende que NO se avise de más: una compuerta
 * que salta en «1 tableta» se aprende a saltar, y entonces tampoco frena lo que
 * sí importa.
 */
import { describe, it, expect } from 'vitest'
import { claseDeUnidad, revisarUnidadDosis } from '@/lib/seguridad/dosis'

describe('lo que SÍ está incompleto', () => {
  it('EL CASO DE LOS MICROGRAMOS', () => {
    const a = revisarUnidadDosis('Levotiroxina', '100')
    expect(a?.codigo).toBe('dosis_sin_unidad')
    expect(a?.mensaje).toMatch(/mil veces/)
  })

  it('un número suelto con decimales tampoco tiene unidad', () => {
    expect(claseDeUnidad('0.5')).toBe('sin_unidad')
    expect(claseDeUnidad('1,5')).toBe('sin_unidad')
  })

  it('sin cifra ninguna: no se puede dispensar', () => {
    const a = revisarUnidadDosis('Paracetamol', '')
    expect(a?.codigo).toBe('dosis_sin_cifra')
    expect(a?.mensaje).toMatch(/cuánto dispensar/)
  })

  it('un texto sin números tampoco es una dosis', () => {
    expect(revisarUnidadDosis('Paracetamol', 'la de siempre')?.codigo).toBe('dosis_sin_cifra')
    expect(revisarUnidadDosis('Paracetamol', null)?.codigo).toBe('dosis_sin_cifra')
  })

  it('el mensaje NOMBRA el medicamento: en una receta de seis renglones hace falta', () => {
    expect(revisarUnidadDosis('Digoxina', '250')?.mensaje).toMatch(/^Digoxina/)
  })
})

describe('lo que NO se debe avisar — para que el aviso siga significando algo', () => {
  it('las unidades de masa, todas sus formas', () => {
    for (const d of ['500 mg', '500mg', '100 mcg', '100 µg', '1 g', '0.5 gr', '2 gramos', '25 ug']) {
      expect(claseDeUnidad(d), d).toBe('masa')
      expect(revisarUnidadDosis('X', d), d).toBeNull()
    }
  })

  it('las presentaciones: «1 tableta» no es ambiguo', () => {
    // La presentación lleva la dosis y quien dispensa sabe cuál es. Avisar aquí
    // sería el ruido que hace que se ignore el aviso de verdad.
    for (const d of ['1 tableta', '2 tabs', '1 cápsula', '1 capsula', '2 comprimidos',
                     '1 ámpula', '1 sobre', '1 supositorio', '1 óvulo', '1 parche',
                     '2 puffs', '3 inhalaciones', '1 aplicación', '20 UI', '10 unidades']) {
      expect(claseDeUnidad(d), d).toBe('forma')
      expect(revisarUnidadDosis('X', d), d).toBeNull()
    }
  })

  it('los volúmenes son OTRO problema, no éste', () => {
    // Un jarabe en mL necesita la concentración para validarse, pero no es
    // ambiguo en el sentido mg/mcg: no se mezclan los dos avisos.
    for (const d of ['5 mL', '5ml', '10 cc', '2 gotas', '15 mililitros']) {
      expect(revisarUnidadDosis('X', d), d).toBeNull()
    }
  })

  it('las combinadas se quedan con la masa', () => {
    expect(claseDeUnidad('500 mg / 5 mL')).toBe('masa')
    expect(claseDeUnidad('1 tableta de 500 mg')).toBe('masa')
  })

  it('mg/kg tampoco se avisa: lleva su unidad', () => {
    expect(revisarUnidadDosis('Amoxicilina', '45 mg/kg/día')).toBeNull()
  })

  it('los porcentajes y las concentraciones tópicas', () => {
    expect(revisarUnidadDosis('Hidrocortisona', '1%')).toBeNull()
  })
})

describe('la severidad es deliberada', () => {
  it('ALTA y no CRÍTICA: se puede firmar igual', () => {
    /**
     * Hay recetas legítimas donde la posología va en las indicaciones y el
     * sistema no puede saberlo. Bloquear la firma por esto convertiría la
     * compuerta en un obstáculo que se aprende a saltar — y entonces tampoco
     * frenaría lo que sí importa.
     */
    expect(revisarUnidadDosis('Levotiroxina', '100')?.severidad).toBe('alta')
    expect(revisarUnidadDosis('Paracetamol', '')?.severidad).toBe('alta')
  })
})
