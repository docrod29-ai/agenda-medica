/**
 * MASAS MOLARES DERIVADAS DE LA FÓRMULA — para no teclear ni un factor.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE ──────────────────────────────────────────────
 *
 * La regla 1 de seguridad clínica nombra las **equivalencias** entre las cifras
 * que no se inventan: «o salen de una fuente citada, o no existen». Por eso
 * REG-599 sólo puso las dos conversiones que el documento del dueño sostenía, y
 * dejó fuera la de la glucosa aunque 18,0182 se sepa de memoria.
 *
 * Saberse un número de memoria no es tener una fuente. Pero hay un camino mejor
 * que pedirle el número a alguien: **no usar ningún número tecleado**.
 *
 * Un factor mmol/L → mg/dL no es una opinión clínica ni un umbral: es aritmética
 * sobre la masa molar, y la masa molar es aritmética sobre la fórmula y los pesos
 * atómicos. Así que aquí no hay factores: hay fórmulas moleculares y pesos
 * atómicos estándar, y el factor **se calcula**.
 *
 *     glucosa C₆H₁₂O₆ → 180,156 g/mol → 1 mmol/L = 18,0156 mg/dL
 *
 * Lo único que se toma de fuera son los pesos atómicos estándar de la IUPAC, que
 * son constantes físicas tabuladas —no cifras clínicas— y que cualquiera
 * comprueba en una tabla periódica.
 *
 * ── Y HAY UNA PRUEBA DE QUE EL MÉTODO ES CORRECTO ───────────────────────────
 *
 * El documento del médico dueño trae un ejemplo trabajado en su §27.1:
 * 140 µmol/L de creatinina son 1,58 mg/dL. Ese ejemplo NO se usa como fuente del
 * factor: se usa como **testigo**. La creatinina se deriva de su fórmula
 * (C₄H₇N₃O) igual que todas, y el resultado tiene que reproducir su 1,58.
 *
 * Si un día la derivación se rompe, ese testigo cae. Es la diferencia entre
 * afirmar que el método funciona y poder demostrarlo.
 *
 * ── LO QUE NO ENTRA AQUÍ ────────────────────────────────────────────────────
 *
 * Los analitos que **no son una molécula sola**. Los triglicéridos son una
 * mezcla y el laboratorio usa una masa molar CONVENCIONAL —la de la trioleína—
 * elegida por acuerdo, no medida. Eso es una convención, no una constante, y
 * convertir con ella sin decirlo sería exactamente lo que este módulo evita.
 * Se quedan fuera y se declaran.
 */

/**
 * Pesos atómicos estándar, IUPAC (Commission on Isotopic Abundances and Atomic
 * Weights, tabla de 2021). Constantes físicas tabuladas, no cifras clínicas: se
 * comprueban en cualquier tabla periódica.
 *
 * Sólo los elementos que aparecen en las fórmulas de abajo. Añadir uno es
 * añadirlo aquí, con su símbolo, y que la fórmula lo use.
 */
export const PESO_ATOMICO: Readonly<Record<string, number>> = Object.freeze({
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  Na: 22.990,
  Mg: 24.305,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  K: 39.098,
  Ca: 40.078,
  Fe: 55.845,
})

export const FUENTE_DE_LOS_PESOS =
  'IUPAC · Commission on Isotopic Abundances and Atomic Weights, pesos atómicos '
  + 'estándar (tabla de 2021). Son constantes físicas tabuladas, no cifras '
  + 'clínicas: cualquiera las comprueba en una tabla periódica.'

/**
 * Masa molar de una fórmula molecular sencilla: `C6H12O6`, `C4H7N3O`, `CH4N2O`.
 *
 * Acepta símbolo con mayúscula y opcional minúscula, seguido de un subíndice
 * opcional. No acepta paréntesis ni hidratos: si hiciera falta, se amplía a
 * conciencia. Devuelve `null` ante cualquier cosa que no entienda — no adivina.
 */
export function masaMolar(formula: string): number | null {
  if (!/^([A-Z][a-z]?\d*)+$/.test(formula)) return null
  let total = 0
  for (const [, simbolo, cuenta] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    const peso = PESO_ATOMICO[simbolo]
    if (peso === undefined) return null
    total += peso * (cuenta === '' ? 1 : Number(cuenta))
  }
  return total > 0 ? total : null
}

export interface Molecula {
  readonly formula: string
  /** De dónde sale la fórmula. Una fórmula sin fuente es un factor sin fuente. */
  readonly fuente: string
}

/**
 * La fórmula molecular de cada analito que se convierte entre mmol/L o µmol/L y
 * una unidad de masa. Ni un factor: sólo fórmulas.
 */
export const MOLECULA: Readonly<Record<string, Molecula>> = Object.freeze({
  glucosa: { formula: 'C6H12O6', fuente: 'D-glucosa, fórmula molecular. Constante química.' },
  creatinina: { formula: 'C4H7N3O', fuente: 'Creatinina, fórmula molecular. Constante química.' },
  urea: { formula: 'CH4N2O', fuente: 'Urea, fórmula molecular. Constante química.' },
  acidoUrico: { formula: 'C5H4N4O3', fuente: 'Ácido úrico, fórmula molecular. Constante química.' },
  bilirrubinaTotal: { formula: 'C33H36N4O6', fuente: 'Bilirrubina, fórmula molecular. Constante química.' },
  colesterolTotal: { formula: 'C27H46O', fuente: 'Colesterol, fórmula molecular. Constante química.' },
  vitaminaD: { formula: 'C27H44O2', fuente: '25-hidroxivitamina D₃ (calcifediol), fórmula molecular. Constante química.' },
  hdl: { formula: 'C27H46O', fuente: 'El HDL se reporta como colesterol: misma molécula.' },
  ldl: { formula: 'C27H46O', fuente: 'El LDL se reporta como colesterol: misma molécula.' },
})

/**
 * ANALITOS QUE **NO** SE CONVIERTEN, Y POR QUÉ.
 *
 * No es una lista de pendientes: es una lista de cosas que este método no puede
 * hacer honestamente. Cada una necesita una decisión o una fuente que no es una
 * constante física.
 */
export const LO_QUE_NO_SE_DERIVA: readonly { readonly analito: string; readonly porQue: string }[] = Object.freeze([
  {
    analito: 'trigliceridos',
    porQue:
      'NO es una molécula sola: es una mezcla, y el laboratorio usa una masa molar '
      + 'CONVENCIONAL (la de la trioleína, 885,4 g/mol) elegida por acuerdo, no medida. '
      + 'Eso es una convención, no una constante física, y convertir con ella sin decirlo '
      + 'sería inventar una equivalencia con aspecto de cálculo. NEEDS_CLINICAL_REVIEW.',
  },
  {
    analito: 'proteinasTotales · albumina · hemoglobina (de g/L a g/dL)',
    porQue:
      'Éstas SÍ se convierten, pero no por masa molar: g/L → g/dL es aritmética de '
      + 'prefijos del SI y vive en `CONVERSIONES_DE_ESCALA`. Se nombran aquí para que '
      + 'nadie las busque en las fórmulas y crea que faltan.',
  },
  {
    analito: 'hormonas y marcadores (testosterona, estradiol, PTH, troponina…)',
    porQue:
      'Muchas se reportan en unidades de actividad o de inmunoensayo (IU/mL, U/mL) que '
      + 'NO son masa: no hay masa molar que convierta una unidad internacional. Y las que '
      + 'sí son masa dependen del ensayo. NEEDS_CLINICAL_REVIEW por analito.',
  },
])

/**
 * VALENCIA DE LOS IONES QUE SE REPORTAN EN EQUIVALENTES — REG-603.
 *
 * Un equivalente es, por definición, un mol multiplicado por el valor absoluto
 * de la carga: `mEq/L = mmol/L × |z|`. No es una cifra clínica ni una convención
 * de laboratorio: es la definición de equivalente y la carga del ion.
 *
 * Para Na⁺, K⁺ y Cl⁻ la carga es 1, así que **mEq/L y mmol/L son el mismo
 * número**. Eso importa mucho más de lo que parece: casi todos los laboratorios
 * reportan los electrolitos en mmol/L y la unidad canónica de este producto es
 * mEq/L, así que sin esto la química sanguínea más común del mundo salía marcada
 * «verificar» entera — y una compuerta que avisa de todo se cierra sin leer.
 */
export const VALENCIA: Readonly<Record<string, { readonly z: number; readonly fuente: string }>> = Object.freeze({
  sodio: { z: 1, fuente: 'Na⁺, carga 1. Un equivalente es un mol por el valor absoluto de la carga.' },
  potasio: { z: 1, fuente: 'K⁺, carga 1.' },
  cloro: { z: 1, fuente: 'Cl⁻, carga 1.' },
})

