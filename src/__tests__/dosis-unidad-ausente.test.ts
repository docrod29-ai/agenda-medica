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

  /**
   * ── EL VOLUMEN YA TIENE SU PROPIO AVISO — MP-005 ──────────────────────────
   *
   * Esta prueba decía «los volúmenes son OTRO problema, no éste» y exigía
   * `null`. El criterio era bueno —no mezclar el aviso de mg/mcg con el de la
   * concentración— pero el OTRO problema no lo atendía nadie: la auditoría
   * «Panel de Lujo» encontró como P0 (MP-005) que «Amoxicilina 5 mL cada 8
   * horas» se firmaba, se imprimía y llegaba al cuidador sin decir de qué
   * presentación, y que el verificador de dosis se saltaba el renglón.
   *
   * Así que el volumen deja de devolver `null` y devuelve SU aviso, distinto
   * del de la unidad ausente. El criterio original se conserva y se comprueba
   * abajo: los dos códigos no se mezclan.
   *
   * QUÉ NO CUBRE: que la concentración escrita sea la correcta. Eso exige un
   * catálogo de presentaciones que este repositorio no tiene.
   */
  it('el volumen sin concentración avisa, y con su propio código', () => {
    for (const d of ['5 mL', '5ml', '10 cc', '15 mililitros']) {
      const a = revisarUnidadDosis('Amoxicilina', d)
      expect(a, d).not.toBeNull()
      expect(a!.codigo, d).toBe('volumen_sin_concentracion')
      expect(a!.severidad, d).toBe('alta')
    }
  })

  it('con la concentración escrita, el volumen ya no avisa', () => {
    for (const d of ['5 mL (250 mg/5 mL)', '250 mg/5 mL', '10 mL de 100 mg/mL', 'crema al 1%']) {
      expect(revisarUnidadDosis('X', d), d).toBeNull()
    }
  })

  it('una VELOCIDAD de infusión no es una dosis incompleta', () => {
    // En una infusión la concentración vive en la orden de preparación. Pedirla
    // en cada renglón llenaría la terapia intensiva de avisos falsos.
    for (const d of ['5 mL/h', '20 ml/hr', '2 cc/min', '10 mL/kg/h', '30 gotas/min']) {
      expect(revisarUnidadDosis('X', d), d).toBeNull()
    }
  })

  it('las gotas siguen siendo una presentación, no un volumen', () => {
    expect(revisarUnidadDosis('X', '2 gotas')).toBeNull()
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
