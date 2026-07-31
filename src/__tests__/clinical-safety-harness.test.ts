/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLINICAL SAFETY HARNESS — golden datasets de las fórmulas deterministas.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Origen: un revisor externo detectó que FIB-4 salía 3053.54 en vez de 3.05
 * (error de escala 1000× por unidad de plaquetas). Ese bug prueba que un motor
 * "determinista" puede tener un 1000× sin que nadie lo note. Este arnés fija el
 * VALOR EXACTO de cada fórmula contra constantes calculadas de forma
 * independiente (no re-implementa la fórmula en el test: pin de números).
 *
 * REGLA: si una fórmula clínica falla aquí, el build se cae (este archivo corre en
 * el CI de vitest). Añadir más golden y más fórmulas es trabajo continuo; esta es
 * la base. Fórmulas objetivo pendientes de golden dedicado se marcan TODO.
 *
 * Las constantes esperadas se derivaron con una implementación de referencia
 * separada (documentadas en el commit); aquí solo se comparan contra el motor real.
 */
import { describe, it, expect } from 'vitest'
import { ckdEpi2021, cockcroftGault } from '@/lib/expediente/funcion-renal'
// E0-05: los motores renales ya no reciben `number` suelto. Migración MECÁNICA:
// ni un solo valor golden de este arnés cambió.
import { mgPorDl, kg, valorEn } from '@/types/clinical-quantity'
const tfgDe = (cr: number, edad: number, sexo: Parameters<typeof ckdEpi2021>[2]) =>
  valorEn(ckdEpi2021(mgPorDl(cr), edad, sexo), 'mL/min/1.73m²')
const crclDe = (cr: number, edad: number, sexo: Parameters<typeof cockcroftGault>[2], peso: number) =>
  valorEn(cockcroftGault(mgPorDl(cr), edad, sexo, kg(peso)), 'mL/min')
import { meld } from '@/lib/expediente/calculadoras'
import { fib4 } from '@/lib/expediente/cardiometabolico/masld'
import { apfel } from '@/lib/expediente/cirugia'
import { calcularSOFA, calcularAPACHE2 } from '@/lib/uci/scores'
import { calcularRCRI, calcularCaprini, type RCRIInput } from '@/lib/expediente/preop'
import { equivalenteNorepinefrina } from '@/lib/uci/hemodinamia'
import { vexus } from '@/lib/uci/pocus'
import { calcularDosisPediatrica, FARMACOS_PED } from '@/lib/expediente/pediatria'

describe('CLINICAL SAFETY HARNESS · CKD-EPI 2021', () => {
  // El motor devuelve PRECISIÓN COMPLETA (decisión del Dr, L6); el redondeo es de
  // presentación. Golden: valor de referencia (race-free 2021), redondeado al mostrar.
  it.each([
    ['H, Cr 1.0, 40a', 1.0, 40, 'Masculino' as const, 98],
    ['M, Cr 0.7, 40a', 0.7, 40, 'Femenino' as const, 112],
    ['H, Cr 4.0, 70a (falla renal)', 4.0, 70, 'Masculino' as const, 15],
  ])('%s → %d mL/min/1.73m² (al redondear)', (_l, cr, edad, sexo, esperado) => {
    expect(Math.round(tfgDe(cr, edad, sexo))).toBe(esperado)
  })
  it('devuelve PRECISIÓN COMPLETA (no redondea el motor)', () => {
    const v = tfgDe(1.0, 40, 'Masculino')
    expect(v).toBeCloseTo(97.575, 2)
    expect(Number.isInteger(v)).toBe(false)   // el motor NO redondea
  })
  it('firma flexible: Sexo o booleano (esMujer) dan el mismo resultado', () => {
    expect(tfgDe(0.7, 40, 'Femenino')).toBe(tfgDe(0.7, 40, true))
    expect(tfgDe(1.0, 40, 'Masculino')).toBe(tfgDe(1.0, 40, false))
  })
})

describe('CLINICAL SAFETY HARNESS · Cockcroft-Gault', () => {
  it.each([
    ['H, Cr 1.0, 40a, 70kg', 1.0, 40, 'Masculino' as const, 70, 97],
    ['M, Cr 1.2, 60a, 65kg', 1.2, 60, 'Femenino' as const, 65, 51],
  ])('%s → %d mL/min', (_l, cr, edad, sexo, peso, esperado) => {
    expect(crclDe(cr, edad, sexo, peso)).toBe(esperado)
  })
})

describe('CLINICAL SAFETY HARNESS · MELD (UNOS)', () => {
  it('bili 2, INR 1.5, Cr 1.5 → 17', () => {
    expect(meld(2, 1.5, 1.5)).toBe(17)
  })
  it('clamp inferior: valores normales → 6 (mínimo)', () => {
    expect(meld(1, 1, 1)).toBe(6)
  })
  it('clamp superior: valores extremos → 40 (máximo)', () => {
    expect(meld(50, 10, 10)).toBe(40)
  })
})

describe('CLINICAL SAFETY HARNESS · FIB-4 (flagship — el bug que originó el arnés)', () => {
  it('caso del reporte externo (68a, AST 42, plaq 135, ALT 48) → 3.05, NO 3053.54', () => {
    expect(fib4(68, 42, 135, 48)).toBe(3.05)
  })
  it('robustez de unidad: ×10⁹/L y conteo absoluto dan el MISMO resultado', () => {
    expect(fib4(68, 42, 135, 48)).toBe(fib4(68, 42, 135_000, 48))
    expect(fib4(50, 40, 150_000, 25)).toBe(2.67)
  })
  it('entradas inválidas → null (no un número falso)', () => {
    expect(fib4(0, 42, 135, 48)).toBeNull()
    expect(fib4(68, 0, 135, 48)).toBeNull()
    expect(fib4(68, 42, 0, 48)).toBeNull()
    expect(fib4(68, 42, 135, 0)).toBeNull()
  })
})

describe('CLINICAL SAFETY HARNESS · Apfel (NVPO)', () => {
  // Riesgos publicados por nº de factores (0–4): 10/21/39/61/79 %.
  it.each([[0, 10], [1, 21], [2, 39], [3, 61], [4, 79]])(
    '%d factores → %d%% de riesgo', (factores, pct) => {
      expect(apfel(factores).riesgo).toBe(pct)
    })
  it('acota fuera de 0–4 (5 → 4 factores)', () => {
    expect(apfel(5).riesgo).toBe(79)
    expect(apfel(-1).riesgo).toBe(10)
  })
})

describe('CLINICAL SAFETY HARNESS · SOFA (Vincent 1996)', () => {
  // Caso con los 6 aparatos: PaFi 250+soporte=2, plaq 80=2, bili 3.0=2,
  // NE 0.2 (>0.1)=4, GCS 13=1, Cr 2.5=2 → total 13, completo.
  it('caso completo → 13 (no parcial)', () => {
    const r = calcularSOFA({ pafi: 250, soporteRespiratorio: true, plaquetas: 80, bilirrubina: 3.0, norepinefrina: 0.2, glasgow: 13, creatinina: 2.5 })
    expect(r.total).toBe(13)
    expect(r.parcial).toBe(false)
  })
  it('caso leve → 2', () => {
    const r = calcularSOFA({ pafi: 350, soporteRespiratorio: false, plaquetas: 120, bilirrubina: 1.0, pam: 80, glasgow: 15, creatinina: 1.0 })
    expect(r.total).toBe(2)
  })
  it('faltar un aparato → parcial (no cuenta 0 falso)', () => {
    const r = calcularSOFA({ plaquetas: 30 })   // solo coagulación
    expect(r.total).toBe(3)
    expect(r.parcial).toBe(true)
    expect(r.faltantes).toContain('Respiratorio')
  })
})

describe('CLINICAL SAFETY HARNESS · APACHE II (Knaus 1985)', () => {
  // Séptico: temp39=3, PAM60=2, FC120=2, FR30=1, PaO2 65 (FiO2<0.5)=1, pH7.30=2,
  // Na148=0, K5.0=0, Cr2.5=3, Hto40=0, Leu18=1, GCS13=(15−13)=2 → fisiología 17;
  // edad 70=5; crónica no-operatorio/urgencia=5 → total 27.
  it('caso séptico completo → total 27 (fisiología 17 + edad 5 + crónica 5)', () => {
    const r = calcularAPACHE2({
      temperatura: 39.0, pam: 60, fc: 120, fr: 30, fio2: 0.4, pao2: 65, ph: 7.30,
      sodio: 148, potasio: 5.0, creatinina: 2.5, hematocrito: 40, leucocitos: 18,
      glasgow: 13, edad: 70, saludCronica: 'no_operatorio_o_urgencia',
    })
    expect(r.fisiologia).toBe(17)
    expect(r.edadPuntos).toBe(5)
    expect(r.cronicaPuntos).toBe(5)
    expect(r.total).toBe(27)
    expect(r.parcial).toBe(false)
  })
  it('sano y joven → 0', () => {
    const r = calcularAPACHE2({ temperatura: 37, pam: 90, fc: 80, fr: 16, fio2: 0.3, pao2: 90, ph: 7.4, sodio: 140, potasio: 4, creatinina: 1.0, hematocrito: 45, leucocitos: 8, glasgow: 15, edad: 30, saludCronica: 'ninguna' })
    expect(r.total).toBe(0)
  })
  it('falla renal aguda DUPLICA los puntos de creatinina', () => {
    const base = { temperatura: 37, pam: 90, fc: 80, fr: 16, fio2: 0.3, pao2: 90, ph: 7.4, sodio: 140, potasio: 4, hematocrito: 45, leucocitos: 8, glasgow: 15, edad: 30, saludCronica: 'ninguna' as const }
    const sin = calcularAPACHE2({ ...base, creatinina: 2.5 })            // Cr 2.5 = 3 pts
    const con = calcularAPACHE2({ ...base, creatinina: 2.5, fallaRenalAguda: true })  // ×2 = 6 pts
    expect(con.total! - sin.total!).toBe(3)
  })
})

describe('CLINICAL SAFETY HARNESS · RCRI (Lee revisado)', () => {
  it.each([
    [0, 'I', false],
    [1, 'II', false],
    [2, 'III', true],
    [3, 'IV', true],
  ] as const)('%d factores → clase %s, elevado=%s', (n, clase, elevado) => {
    // RCRIInput exige las 6 llaves booleanas: se parte de todas en false y se
    // encienden n (calcularRCRI solo cuenta las verdaderas).
    const input: RCRIInput = {
      cirugiaAltoRiesgo: false, cardiopatiaIsquemica: false, insuficienciaCardiaca: false,
      enfermedadCerebrovascular: false, diabetesInsulina: false, creatininaMayor2: false,
    }
    const keys = Object.keys(input) as (keyof RCRIInput)[]
    for (let i = 0; i < n; i++) input[keys[i]] = true
    const r = calcularRCRI(input)
    expect(r.puntos).toBe(n)
    expect(r.clase).toBe(clase)
    expect(r.elevado).toBe(elevado)
  })
})

describe('CLINICAL SAFETY HARNESS · Caprini (VTE)', () => {
  it('sin factores → 0, Muy bajo', () => {
    expect(calcularCaprini({}).puntos).toBe(0)
    expect(calcularCaprini({}).nivel).toBe('Muy bajo')
  })
  it('edad 41-60 (1) + IMC>25 (1) → 2, Bajo', () => {
    const r = calcularCaprini({ edad41_60: true, imcMayor25: true })
    expect(r.puntos).toBe(2); expect(r.nivel).toBe('Bajo')
  })
  it('edad 61-74 (2) + malignidad (2) → 4, Moderado', () => {
    const r = calcularCaprini({ edad61_74: true, malignidad: true })
    expect(r.puntos).toBe(4); expect(r.nivel).toBe('Moderado')
  })
  it('antecedente TVP (3) + edad ≥75 (3) → 6, Alto', () => {
    const r = calcularCaprini({ antecedenteTVP: true, edad75: true })
    expect(r.puntos).toBe(6); expect(r.nivel).toBe('Alto')
  })
})

describe('CLINICAL SAFETY HARNESS · Equivalente de norepinefrina (NEE)', () => {
  it('NE 0.1 mcg/kg/min → 0.1', () => {
    expect(equivalenteNorepinefrina([{ farmaco: 'norepinefrina', dosis: 0.1, unidad: 'mcg_kg_min' }]).valorTotal).toBe(0.1)
  })
  it('mezcla NE 0.2 + EPI 0.05 + dopamina 10 + fenilefrina 1 → 0.45', () => {
    // 0.2 + 0.05 + 10/100 + 1/10 = 0.45
    const r = equivalenteNorepinefrina([
      { farmaco: 'norepinefrina', dosis: 0.2, unidad: 'mcg_kg_min' },
      { farmaco: 'epinefrina', dosis: 0.05, unidad: 'mcg_kg_min' },
      { farmaco: 'dopamina', dosis: 10, unidad: 'mcg_kg_min' },
      { farmaco: 'fenilefrina', dosis: 1, unidad: 'mcg_kg_min' },
    ])
    expect(r.valorTotal).toBe(0.45)
    expect(r.ok).toBe(true)
  })
  it('vasopresina 0.04 U/min → 0.1 (×2.5, sin peso)', () => {
    expect(equivalenteNorepinefrina([{ farmaco: 'vasopresina', dosis: 0.04, unidad: 'units_min' }]).valorTotal).toBe(0.1)
  })
  it('dobutamina NO aporta (inotrópico), pero no bloquea', () => {
    const r = equivalenteNorepinefrina([{ farmaco: 'norepinefrina', dosis: 0.1, unidad: 'mcg_kg_min' }, { farmaco: 'dobutamina', dosis: 5, unidad: 'mcg_kg_min' }])
    expect(r.valorTotal).toBe(0.1)
    expect(r.ok).toBe(true)
  })
  it('dosis en mcg/min SIN peso → bloquea (ok=false), no inventa conversión', () => {
    expect(equivalenteNorepinefrina([{ farmaco: 'norepinefrina', dosis: 10, unidad: 'mcg_min' }]).ok).toBe(false)
  })
})

describe('CLINICAL SAFETY HARNESS · VExUS (2020)', () => {
  it('VCI < 2.0 → grado 0', () => {
    expect(vexus({ vciCm: 1.8 }).valor).toBe(0)
  })
  it('VCI ≥ 2.0 + 2 patrones graves → grado 3', () => {
    expect(vexus({ vciCm: 2.2, hepatica: 'grave', porta: 'grave' }).valor).toBe(3)
  })
  it('VCI ≥ 2.0 + 1 patrón grave → grado 2', () => {
    expect(vexus({ vciCm: 2.2, hepatica: 'grave', porta: 'normal' }).valor).toBe(2)
  })
  it('VCI ≥ 2.0 + 0 patrones graves → grado 1', () => {
    expect(vexus({ vciCm: 2.2, hepatica: 'normal', porta: 'leve' }).valor).toBe(1)
  })
  it('VCI no medida → bloqueado (no adivina el grado)', () => {
    expect(vexus({}).bloqueado).toBe(true)
  })
})

describe('CLINICAL SAFETY HARNESS · Dosis pediátrica por peso', () => {
  const far = (n: string) => FARMACOS_PED.find(f => f.nombre === n)!
  it('Paracetamol 10–15 mg/kg, 20 kg → 200–300 mg/toma, 800–1200 mg/día', () => {
    const d = calcularDosisPediatrica(far('Paracetamol'), 20)!
    expect(d.porToma).toEqual({ min: 200, max: 300 })
    expect(d.porDia).toEqual({ min: 800, max: 1200 })
    expect(d.topeAplicado).toBe(false)
  })
  it('Amoxicilina 45–90 mg/kg/día ÷2 tomas, 20 kg → 450–900 mg/toma', () => {
    const d = calcularDosisPediatrica(far('Amoxicilina'), 20)!
    expect(d.porToma).toEqual({ min: 450, max: 900 })
  })
  it('Ceftriaxona 50 kg → el tope diario (2000 mg) RECORTA la dosis por toma (no 3750 mg)', () => {
    const d = calcularDosisPediatrica(far('Ceftriaxona'), 50)!
    expect(d.porToma.max).toBe(2000)   // NO 3750
    expect(d.porDia.max).toBe(2000)
    expect(d.topeAplicado).toBe(true)
  })
})

describe('CLINICAL SAFETY HARNESS · Aminoglucósidos: dosis/toma ≤ tope diario (REG-018)', () => {
  const far = (n: string) => FARMACOS_PED.find(f => f.nombre === n)!
  // Amikacina: mgKgDia [15,22.5] con topeMgKgDia 15. En 1 toma/día el máximo del
  // rango (22.5) NO debe llegar a la receta por encima del tope de seguridad (15).
  it('Amikacina 20 kg: porToma.max ≤ 300 mg (15 mg/kg), NUNCA 450 (22.5 mg/kg)', () => {
    const d = calcularDosisPediatrica(far('Amikacina'), 20)!
    expect(d.porToma.max).toBeLessThanOrEqual(300)
    expect(d.topeAplicado).toBe(true)
  })
  it('Gentamicina 20 kg: coherente (tope 7.5 mg/kg = 150 mg)', () => {
    const d = calcularDosisPediatrica(far('Gentamicina'), 20)!
    expect(d.porToma.max).toBeLessThanOrEqual(150)
  })
  // INVARIANTE UNIVERSAL: la dosis por toma nunca puede exceder la dosis diaria
  // (perDose × freq = perDay ≥ perDose). Property test sobre TODO el catálogo a
  // varios pesos — caza cualquier contradicción de topes en cualquier fármaco.
  it('invariante: porToma ≤ porDía para TODOS los fármacos, a todo peso', () => {
    for (const f of FARMACOS_PED) {
      for (const peso of [5, 12, 20, 35, 60]) {
        const d = calcularDosisPediatrica(f, peso, 60)
        if (!d || d.contraindicadoPorEdad) continue
        expect(d.porToma.max, `${f.nombre} @${peso}kg`).toBeLessThanOrEqual(d.porDia.max + 0.011)
        expect(d.porToma.min, `${f.nombre} @${peso}kg`).toBeLessThanOrEqual(d.porDia.min + 0.011)
      }
    }
  })
})

describe('PROPERTY-BASED · invariantes sobre poblaciones sintéticas (charter #24)', () => {
  // Mallas deterministas (reproducibles, sin Math.random) dentro y fuera de rangos.
  const creatGrid = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 5.0, 8.0]
  const edadGrid = [18, 30, 45, 60, 75, 90]
  const sexos = ['Masculino', 'Femenino'] as const

  it('CKD-EPI: finito, positivo y MONÓTONA decreciente al subir la creatinina', () => {
    for (const edad of edadGrid) for (const sexo of sexos) {
      let prev = Infinity
      for (const cr of creatGrid) {
        const g = tfgDe(cr, edad, sexo)
        expect(Number.isFinite(g)).toBe(true)
        expect(g).toBeGreaterThan(0)
        expect(g, `TFG debe bajar al subir creat (edad ${edad}, ${sexo}, cr ${cr})`).toBeLessThanOrEqual(prev + 1e-6)
        prev = g
      }
    }
  })

  it('Cockcroft-Gault: no-negativo, finito y decreciente en creatinina', () => {
    for (const edad of edadGrid) for (const sexo of sexos) {
      let prev = Infinity
      for (const cr of creatGrid) {
        const v = crclDe(cr, edad, sexo, 70)
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(prev + 1e-6)
        prev = v
      }
    }
  })

  it('FIB-4: invariancia de UNIDAD (×10⁹/L ≡ conteo absoluto) en toda la malla', () => {
    for (const edad of [30, 50, 70]) for (const ast of [20, 42, 120]) for (const alt of [20, 48, 150]) for (const plq of [80, 135, 250]) {
      const a = fib4(edad, ast, plq, alt)
      const b = fib4(edad, ast, plq * 1000, alt)
      expect(a, `unidad plq @${plq}`).toBe(b)
      if (a != null) { expect(Number.isFinite(a)).toBe(true); expect(a).toBeGreaterThan(0) }
    }
  })

  it('MELD: SIEMPRE acotado 6–40 y no-decreciente al subir bilirrubina', () => {
    for (const inr of [1, 1.5, 2.5]) for (const cr of [1, 2, 4]) {
      let prev = -Infinity
      for (const bili of [1, 2, 5, 10, 30]) {
        const m = meld(bili, inr, cr)
        expect(m).toBeGreaterThanOrEqual(6)
        expect(m).toBeLessThanOrEqual(40)
        expect(m, `MELD no baja al subir bili (inr ${inr}, cr ${cr}, bili ${bili})`).toBeGreaterThanOrEqual(prev)
        prev = m
      }
    }
  })
})

/**
 * NEEDS_CLINICAL_REVIEW — escalas SIN motor determinista en el código (no se pueden
 * anclar sin inventar sus reglas; requieren que el Dr. las especifique antes de
 * implementarlas): qSOFA, Child-Pugh, PEWS, Wells (TVP/TEP), CURB-65.
 * APACHE II, SOFA, RCRI, Caprini, NEE, VExUS y dosis pediátrica ya quedan cubiertos arriba.
 */

