/**
 * GOLDEN — REG-558. Los factores de conversión se calculan. No se teclean.
 *
 * ── EL PROBLEMA, Y POR QUÉ LLEVABA CUATRO UNIDADES SIN RESOLVERSE ───────────
 *
 * La regla 1 de seguridad clínica nombra las **equivalencias** entre las cifras
 * que no se inventan: «o salen de una fuente citada, o no existen». REG-554 puso
 * sólo las dos conversiones que el documento del médico dueño sostenía, y dejó
 * fuera la de la glucosa —el caso que había abierto todo— aunque 18,0182 se sepa
 * de memoria.
 *
 * Saberse un número no es tener una fuente. Y pedirle el número al médico
 * tampoco es la mejor respuesta: un factor mmol/L → mg/dL **no es una decisión
 * clínica**, es aritmética.
 *
 * ── LA SALIDA: NO USAR NINGÚN NÚMERO TECLEADO ───────────────────────────────
 *
 * Aquí no hay factores. Hay fórmulas moleculares y pesos atómicos de la IUPAC, y
 * el factor se calcula:
 *
 *     C₆H₁₂O₆ → 180,156 g/mol → 1 mmol/L = 18,0156 mg/dL
 *
 * Tres mecanismos, los tres aritmética comprobable:
 *
 *  · **Escala** — `mg/dL` ↔ `mg/L` es un prefijo del SI. Sin química.
 *  · **Masa molar** — de la fórmula y los pesos atómicos.
 *  · **Equivalentes** — `mEq/L = mmol/L × |z|`, la definición de equivalente.
 *
 * ── LOS DOS TESTIGOS, QUE SON LA PARTE QUE IMPORTA ──────────────────────────
 *
 * El documento del dueño trae dos cifras trabajadas. La derivación las
 * **reproduce sin usarlas**:
 *
 *     §27.1  creatinina 140 µmol/L → 1,58 mg/dL   ·  derivado: 1,5837 ✔
 *     §6     vitamina D ng/mL × 2,496 ≈ nmol/L    ·  derivado: 2,4960 ✔
 *
 * No son la fuente del factor: son la prueba de que el método es correcto. Es la
 * diferencia entre afirmar que funciona y poder demostrarlo — y son dos cifras
 * independientes, de dos moléculas distintas, dadas por él antes de que este
 * módulo existiera.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **Los triglicéridos NO se convierten**, y no es un olvido: no son una
 *    molécula sola. El laboratorio usa una masa molar CONVENCIONAL (la de la
 *    trioleína) elegida por acuerdo, no medida. Convertir con ella sin decirlo
 *    sería inventar una equivalencia con aspecto de cálculo.
 *  · **Las unidades de actividad tampoco** (IU/mL, U/mL): no son masa, así que
 *    no hay masa molar que las convierta, y el factor depende del ensayo.
 *  · **No valida los pesos atómicos.** Son constantes tabuladas de la IUPAC y se
 *    citan como tales; cualquiera los comprueba en una tabla periódica.
 *  · **No arregla el rango.** Una PCR de 84 mg/dL se convierte bien a 840 mg/L y
 *    aun así queda fuera del rango estrecho de este producto. Las dos cosas son
 *    ciertas a la vez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analitoPorClave } from '@/lib/expediente/laboratorio/analitos'
import { conversionPara, dictaminar, TESTIGOS_DEL_DOCUMENTO } from '@/lib/expediente/laboratorio/unidades'
import {
  masaMolar, PESO_ATOMICO, MOLECULA, VALENCIA, LO_QUE_NO_SE_DERIVA, FUENTE_DE_LOS_PESOS,
} from '@/lib/expediente/laboratorio/masa-molar'

const RAIZ = process.cwd()

describe('LOS DOS TESTIGOS — el método se demuestra, no se afirma', () => {
  it('reproduce el ejemplo de creatinina del §27.1 SIN usarlo', () => {
    /**
     * Su documento dice: 140 µmol/L → 1,58 mg/dL. Aquí se llega a 1,5837
     * partiendo de C₄H₇N₃O y de los pesos atómicos. Si la derivación se rompiera,
     * este número dejaría de coincidir.
     */
    const d = dictaminar(analitoPorClave('creatinina')!, 140, 'µmol/L')
    expect(d.valor).toBeCloseTo(1.58, 2)
    expect(d.conversion!.fuente).toMatch(/C4H7N3O/)
    expect(d.conversion!.fuente).not.toMatch(/1\.58|1,58/)   // no lo cita: lo calcula
  })

  it('y el de la vitamina D del §6, que es otra molécula distinta', () => {
    /**
     * «ng/mL × 2,496 ≈ nmol/L». Se llega a 2,4960 desde C₂₇H₄₄O₂. Dos testigos
     * independientes, de dos moléculas distintas, dados por él antes de que este
     * módulo existiera.
     */
    const c = conversionPara(analitoPorClave('vitaminaD')!, 'nmol/L')!
    expect(1 / c.factor).toBeCloseTo(2.496, 3)
    expect(c.fuente).toMatch(/C27H44O2/)
  })

  it('los dos están declarados como testigos, no como fuente', () => {
    expect(TESTIGOS_DEL_DOCUMENTO).toHaveLength(2)
    for (const t of TESTIGOS_DEL_DOCUMENTO) expect(t.donde).toMatch(/D-032 §/)
    const doc = readFileSync(join(RAIZ, 'docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md'), 'utf8')
    expect(doc).toMatch(/ng\/mL × 2\.496 ≈ nmol\/L/)
    expect(doc).toMatch(/canonical_value: 1\.58/)
  })
})

describe('EL CASO QUE ABRIÓ TODO, CERRADO', () => {
  it('glucosa 7,2 mmol/L entra a la gráfica como ~130 mg/dL', () => {
    const d = dictaminar(analitoPorClave('glucosa')!, 7.2, 'mmol/L')
    expect(d.estado).toBe('ACCEPTED')
    expect(d.valor).toBeCloseTo(129.71, 2)
    expect(d.graficable).toBe(true)
    // Y el original no se pierde (§27.1).
    expect(d.valorOriginal).toBe(7.2)
    expect(d.unidadOriginal).toBe('mmol/L')
  })

  it('y NO se llegó ahí escribiendo 18,0182 en ningún sitio', () => {
    /**
     * El invariante que hace falsable la frase «no hay factores tecleados». Si
     * alguien mete un número de conversión a mano en el módulo, esto lo delata.
     */
    /**
     * SÓLO EL CÓDIGO, no los comentarios. La cabecera del módulo EXPLICA que
     * C₆H₁₂O₆ da 18,0156 y que el testigo del dueño es 2,496 — y esa explicación
     * es justo lo que hay que conservar. Mi primera versión leía el archivo
     * entero y se puso roja contra su propia prosa: es la tercera vez esta
     * semana que un guardián mío casa con lo que él mismo explica.
     */
    /**
     * Se busca lo que de verdad sería peligroso: un NÚMERO DE CONVERSIÓN puesto a
     * mano. No cualquier aparición de esas cifras.
     *
     * Mi primera versión leía el archivo entero y se puso roja dos veces contra
     * su propio contenido legítimo: la cabecera EXPLICA que C₆H₁₂O₆ da 18,0156, y
     * `TESTIGOS_DEL_DOCUMENTO` CITA el 2,496 del dueño como testigo — que es
     * justo lo que hay que conservar. Un testigo no es un factor: no multiplica
     * nada.
     *
     * Es la tercera vez esta semana que un guardián mío casa con lo que él mismo
     * explica. Así que se mira sólo donde vive un factor: una línea que asigne
     * `factor:`.
     */
    const lineasDeFactor = readFileSync(join(RAIZ, 'src/lib/expediente/laboratorio/unidades.ts'), 'utf8')
      .split('\n')
      .filter(l => /\bfactor\s*:/.test(l) && !/^\s*(\*|\/\*|\/\/)/.test(l))
    expect(lineasDeFactor.length, 'hay líneas que asignan un factor').toBeGreaterThan(0)
    for (const l of lineasDeFactor) {
      expect(l, 'un factor de conversión tecleado a mano').not.toMatch(/\d+[.,]\d{2,}/)
    }
  })
})

describe('LOS TRES MECANISMOS, cada uno con lo suyo', () => {
  it('escala del SI: la PCR en mg/dL son diez veces los mg/L', () => {
    const c = conversionPara(analitoPorClave('pcr')!, 'mg/dL')!
    expect(c.factor).toBe(10)
    expect(c.fuente).toMatch(/Escala del SI/)
    expect(c.fuente).not.toMatch(/masa molar/)
  })

  it('equivalentes: mEq/L y mmol/L son el MISMO número en un ion monovalente', () => {
    /**
     * Esto no es un adorno. Casi todos los laboratorios reportan electrolitos en
     * mmol/L y la unidad canónica aquí es mEq/L, así que sin esto la química
     * sanguínea más común del mundo salía marcada «verificar» entera — y una
     * compuerta que avisa de todo se cierra sin leer.
     */
    const normales: [string, number][] = [['sodio', 139], ['potasio', 4.1], ['cloro', 102]]
    for (const [clave, valor] of normales) {
      const d = dictaminar(analitoPorClave(clave)!, valor, 'mmol/L')
      expect(d.estado, clave).toBe('ACCEPTED')
      expect(d.valor, `${clave}: el número NO cambia`).toBe(valor)
      expect(d.conversion!.fuente, clave).toMatch(/valor absoluto de la carga/)
    }
    expect(Object.keys(VALENCIA).sort()).toEqual(['cloro', 'potasio', 'sodio'])
  })

  it('masa molar: la masa sale de la fórmula, no de una tabla de masas', () => {
    expect(masaMolar('C6H12O6')).toBeCloseTo(180.156, 3)
    expect(masaMolar('C4H7N3O')).toBeCloseTo(113.12, 2)
    expect(masaMolar('CH4N2O')).toBeCloseTo(60.056, 3)
    // Y no adivina: lo que no entiende, lo dice.
    expect(masaMolar('Xx9')).toBeNull()
    expect(masaMolar('C6(H2O)3')).toBeNull()
    expect(masaMolar('')).toBeNull()
  })

  it('los pesos atómicos se citan como lo que son', () => {
    expect(FUENTE_DE_LOS_PESOS).toMatch(/IUPAC/)
    expect(FUENTE_DE_LOS_PESOS).toMatch(/no cifras clínicas/)
    expect(PESO_ATOMICO.C).toBeCloseTo(12.011, 3)
    expect(PESO_ATOMICO.O).toBeCloseTo(15.999, 3)
  })
})

describe('EL FALLO QUE LA MEDICIÓN CAZÓ ANTES DE CONECTARLO', () => {
  it('µg/L y ng/mL son la MISMA unidad: factor 1', () => {
    /**
     * ── LA TABLA CASERA QUE DIVIDÍA UNA FERRITINA ENTRE DIEZ MIL ────────────
     *
     * La primera versión de la escala era una tabla escrita a mano con un factor
     * por unidad. Medida antes de conectarla, daba `ferritina µg/L → ng/mL =
     * 0,0001`. Son la misma unidad. Una ferritina de 200 000 en un HLH habría
     * entrado al expediente como 20, en silencio.
     *
     * La causa fue hacerme una tabla propia en vez de usar la aritmética que ya
     * estaba —masa partida por volumen—. Es el mismo error del medidor casero de
     * REG-553, en otra capa.
     */
    const c = conversionPara(analitoPorClave('ferritina')!, 'µg/L')!
    expect(c.factor).toBe(1)
    const d = dictaminar(analitoPorClave('ferritina')!, 200000, 'µg/L')
    expect(d.valor, 'la ferritina del HLH entera').toBe(200000)
    expect(d.estado).toBe('ACCEPTED')
  })

  it('y la escala se calcula con las MISMAS tablas que la molar', () => {
    // No hay dos maneras de contar lo mismo: una sola aritmética dimensional.
    const modulo = readFileSync(join(RAIZ, 'src/lib/expediente/laboratorio/unidades.ts'), 'utf8')
    expect(modulo).toMatch(/masaDesde \/ volDesde/)
    expect(modulo).toMatch(/no hay dos maneras de contar lo mismo/i)
  })
})

describe('LO QUE NO SE DERIVA, y por qué no es un olvido', () => {
  it('los triglicéridos NO se convierten: su masa molar es una CONVENCIÓN', () => {
    expect(conversionPara(analitoPorClave('trigliceridos')!, 'mmol/L')).toBeNull()
    const dicho = LO_QUE_NO_SE_DERIVA.find(x => x.analito.includes('trigliceridos'))
    expect(dicho?.porQue).toMatch(/CONVENCIONAL/)
    expect(dicho?.porQue).toMatch(/NEEDS_CLINICAL_REVIEW/)
    expect(MOLECULA.trigliceridos).toBeUndefined()
  })

  it('y una unidad que nadie entiende no se convierte a ojo', () => {
    expect(conversionPara(analitoPorClave('glucosa')!, 'pinta/legua')).toBeNull()
    expect(conversionPara(analitoPorClave('glucosa')!, '')).toBeNull()
    // La misma unidad no es una conversión: no hay nada que hacer.
    expect(conversionPara(analitoPorClave('glucosa')!, 'mg/dL')).toBeNull()
  })

  it('lo que queda fuera está declarado con su razón', () => {
    expect(LO_QUE_NO_SE_DERIVA.length).toBeGreaterThanOrEqual(3)
    for (const x of LO_QUE_NO_SE_DERIVA) expect(x.porQue.length).toBeGreaterThan(80)
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('la unidad canónica no dispara ninguna conversión ni ningún aviso', () => {
    const d = dictaminar(analitoPorClave('glucosa')!, 92, 'mg/dL')
    expect(d.estado).toBe('ACCEPTED')
    expect(d.conversion).toBeUndefined()
  })

  it('y el valor convertido no arrastra basura de coma flotante', () => {
    /**
     * 7,2 × 18,0156 da 129,71232000000003 en binario. Se recorta a doce cifras
     * significativas, muy por encima de lo que reporta cualquier laboratorio: no
     * redondea el resultado, borra el ruido. Truncar de verdad está prohibido.
     */
    const d = dictaminar(analitoPorClave('glucosa')!, 7.2, 'mmol/L')
    expect(String(d.valor)).not.toMatch(/0{6,}\d/)
    expect(d.valor).toBeCloseTo(129.71232, 5)
  })
})
