/**
 * INVARIANTES PROPERTY-BASED de dosis pediátrica y aminoglucósidos.
 * Nexus OS · unidad E0-02 · extiende REG-013 y REG-018 a TODO el catálogo.
 *
 * CRITERIO DE ACEPTACIÓN (backlog):
 *   «Ningún fármaco del catálogo puede producir dosis/toma por encima de su tope.»
 *
 * Qué es esto y qué NO es:
 *  - NO es una reparación. Un barrido exhaustivo previo (25 fármacos × pesos 0.5–120 kg)
 *    mostró CERO violaciones: el motor ya cumple. El valor de este archivo es convertir
 *    ese hecho en un invariante permanente que no se pueda romper EN SILENCIO al agregar
 *    el fármaco número 26.
 *  - NO decide ningún umbral clínico. Todas las cifras que se comprueban aquí salen del
 *    propio catálogo (`FARMACOS_PED`, `CATALOGO`) o del código del motor. Donde falta un
 *    criterio médico, este archivo lo deja marcado NEEDS_CLINICAL_REVIEW y NO inventa
 *    un valor por defecto (ver §NEEDS_CLINICAL_REVIEW abajo).
 *  - Las propiedades son FAIL-CLOSED sobre la FORMA del catálogo: una unidad nueva, un
 *    fármaco sin tope o una contradicción nueva entre catálogos TUMBAN el CI a propósito,
 *    para forzar una revisión clínica explícita en vez de un silencio.
 *
 * Estilo de la casa: mallas deterministas, sin `Math.random` y sin dependencias nuevas
 * (no se agrega `fast-check`). Ver `src/__tests__/_harness/property.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  FARMACOS_PED, calcularDosisPediatrica, tomasDiaDe, tomasPorIntervalo,
  type FarmacoPed, type DosisCalculada,
} from '@/lib/expediente/pediatria'
import { CATALOGO, buscarFarmaco, revisarDosis, extraerMg } from '@/lib/seguridad/dosis'
import { mallaPesosKg, MALLA_EDADES_MESES, paraTodo, prng } from './_harness/property'

// ═══════════════════════════════════════════════════════════════════════════
// Constantes DERIVADAS del código (ninguna es una elección clínica)
// ═══════════════════════════════════════════════════════════════════════════

/** El motor redondea con `Math.round(x * 10) / 10` (`pediatria.ts`). */
const PASO_REDONDEO = 0.1
/**
 * Presupuesto de redondeo por cifra: medio paso. NO es un umbral elegido, es la
 * consecuencia aritmética de redondear AL MÁS CERCANO. Con él, el total diario puede
 * quedar hasta `TOL × tomas` por ENCIMA del tope (máximo medido: Metronidazol @66.7 kg
 * → 666.7 × 3 = 2000.1 contra topeDia 2000).
 *
 * NEEDS_CLINICAL_REVIEW (pregunta 2 de E0-02): que esta tolerancia se ACEPTE, o que el
 * motor deba redondear siempre HACIA ABAJO al tocar un tope, es decisión del médico
 * dueño. Si decide redondeo hacia abajo, esta constante pasa a 0 y el test se aprieta
 * solo — el cambio del motor quedaría fuera del alcance de E0-02.
 */
const TOL_REDONDEO = PASO_REDONDEO / 2

/** Ruido de coma flotante (1e-9 relativo). Muy por debajo de cualquier diferencia clínica. */
const EPS_REL = 1e-9

/**
 * Unidades presentes hoy en `FARMACOS_PED`. FAIL-CLOSED a propósito: si mañana entra un
 * fármaco con una unidad nueva (UI, mcg, mL) este test ROMPE el CI, porque comparar
 * topes entre unidades distintas sin conversión explícita es exactamente el error que
 * REG-013 cerró en el peso.
 */
const UNIDADES_PERMITIDAS: readonly string[] = ['mg', 'mg de TMP']

// ═══════════════════════════════════════════════════════════════════════════
// NEEDS_CLINICAL_REVIEW — huecos ABIERTOS, sin valor inventado
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Contradicciones CONOCIDAS entre el catálogo pediátrico (`FARMACOS_PED`) y el catálogo
 * adulto (`CATALOGO` de `seguridad/dosis.ts`): el motor pediátrico emite una dosis que el
 * verificador adulto marca como crítica.
 *
 * NEEDS_CLINICAL_REVIEW (pregunta 1 de E0-02) — Amoxicilina (y Amoxicilina-clavulanato,
 * que se dosifica por el componente amoxicilina):
 *   · `FARMACOS_PED`: 45–90 mg/kg/día en 2 tomas, topeDia 3000 ⇒ porToma.max = 45 × peso,
 *     que cruza 1000 mg desde ≈22.3 kg y se estabiliza en 1500 mg/toma desde 33.4 kg.
 *   · `CATALOGO` adulto: `maxTomaMg: 1000` ⇒ `revisarDosis` marca `sobre_maximo_dosis`
 *     (severidad crítica) sobre la receta que el propio motor pediátrico acaba de emitir.
 * NO se elige un techo aquí. La lista mantiene el hallazgo VERSIONADO y VISIBLE: el CI no
 * se cae hoy por algo ya conocido, pero una contradicción NUEVA sí lo tumba (P6), y si la
 * contradicción desaparece (porque el médico resolvió la pregunta) el test exige quitar la
 * entrada de esta lista (P6-bis) para que no se pudra.
 */
const INCOHERENCIAS_CONOCIDAS: readonly string[] = ['Amoxicilina', 'Amoxicilina-clavulanato']

// ═══════════════════════════════════════════════════════════════════════════
// Utilidades locales
// ═══════════════════════════════════════════════════════════════════════════

/** `valor ≤ tope` admitiendo un presupuesto absoluto declarado + ruido de coma flotante. */
function noExcede(valor: number, tope: number, tolAbs = 0): boolean {
  return valor <= tope + tolAbs + Math.abs(tope) * EPS_REL
}

const PESOS = mallaPesosKg({ extra: 200 })
const PESOS_RAPIDOS = mallaPesosKg()

type Calculadora = (f: FarmacoPed, pesoKg: number, edadMeses?: number) => DosisCalculada | null

/** Todos los topes DIARIOS que un fármaco declara, ya resueltos a mg para ese peso. */
function topesDiariosMg(f: FarmacoPed, pesoKg: number): { valor: number; cual: string }[] {
  const out: { valor: number; cual: string }[] = []
  if (f.topeDia != null) out.push({ valor: f.topeDia, cual: 'topeDia' })
  if (f.topeMgKgDia != null) out.push({ valor: f.topeMgKgDia * pesoKg, cual: 'topeMgKgDia' })
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// P0 — el arnés mismo es determinista (si no, nada de lo demás es reproducible)
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · P0 — el arnés es determinista y reproducible', () => {
  it('prng: misma semilla ⇒ misma secuencia; semillas distintas ⇒ secuencias distintas', () => {
    const a = prng(42), b = prng(42), c = prng(43)
    const sa = [a(), a(), a(), a(), a()]
    const sb = [b(), b(), b(), b(), b()]
    expect(sa).toEqual(sb)
    expect(sa).not.toEqual([c(), c(), c(), c(), c()])
    for (const x of sa) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })

  it('mallaPesosKg: reproducible, ordenada, sin duplicados y dentro de [0.5, 120]', () => {
    expect(mallaPesosKg({ extra: 200 })).toEqual(mallaPesosKg({ extra: 200 }))
    expect(mallaPesosKg({ semilla: 1, extra: 50 })).not.toEqual(mallaPesosKg({ semilla: 2, extra: 50 }))
    expect(new Set(PESOS).size).toBe(PESOS.length)
    for (let i = 1; i < PESOS.length; i++) expect(PESOS[i]).toBeGreaterThan(PESOS[i - 1])
    expect(PESOS[0]).toBeGreaterThanOrEqual(0.5)
    expect(PESOS[PESOS.length - 1]).toBeLessThanOrEqual(120)
    expect(PESOS.length).toBeGreaterThan(200)
  })

  it('paraTodo: al fallar reporta el CASO EXACTO (sustituto honesto del shrinking)', () => {
    expect(() => paraTodo([1, 2, 3], n => `n=${n}`, n => { expect(n).toBeLessThan(3) }))
      .toThrow(/CONTRAEJEMPLO → n=3/)
  })

  it('MALLA_EDADES_MESES incluye `undefined` (hay llamadores que dosifican sin edad)', () => {
    expect(MALLA_EDADES_MESES).toContain(undefined)
    expect(MALLA_EDADES_MESES.filter(e => typeof e === 'number').length).toBeGreaterThan(5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P1 — FORMA del catálogo pediátrico (fail-closed; protege al fármaco nº 26)
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · P1 — forma del catálogo pediátrico (fail-closed)', () => {
  it('nombres no vacíos y ÚNICOS', () => {
    const nombres = FARMACOS_PED.map(f => f.nombre)
    paraTodo(nombres, n => `nombre "${n}"`, n => { expect(n.trim().length).toBeGreaterThan(0) })
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('unidad declarada y dentro de las unidades permitidas', () => {
    paraTodo(FARMACOS_PED, f => `${f.nombre} unidad="${f.unidad}"`, f => {
      expect(f.unidad.trim().length).toBeGreaterThan(0)
      expect(UNIDADES_PERMITIDAS).toContain(f.unidad)
    })
  })

  it('TODO fármaco declara al menos un tope (si no, el criterio de aceptación sería vacuamente cierto)', () => {
    paraTodo(FARMACOS_PED, f => f.nombre, f => {
      const topes = [f.topeDosis, f.topeDia, f.topeMgKgDia].filter(t => t != null)
      expect(topes.length).toBeGreaterThanOrEqual(1)
      for (const t of topes) { expect(Number.isFinite(t)).toBe(true); expect(t!).toBeGreaterThan(0) }
    })
  })

  it('exactamente UNA base de dosificación (mgKgDosis XOR mgKgDia), con rango ordenado, finito y > 0', () => {
    paraTodo(FARMACOS_PED, f => f.nombre, f => {
      const bases = [f.mgKgDosis, f.mgKgDia].filter(Boolean)
      expect(bases.length).toBe(1)
      const [lo, hi] = (f.mgKgDosis ?? f.mgKgDia)!
      expect(Number.isFinite(lo)).toBe(true)
      expect(Number.isFinite(hi)).toBe(true)
      expect(lo).toBeGreaterThan(0)
      expect(hi).toBeGreaterThanOrEqual(lo)
    })
  })

  it('si dosifica por DÍA, declara tomas ≥ 1 (sin eso la dosis por toma no se puede repartir)', () => {
    paraTodo(FARMACOS_PED.filter(f => f.mgKgDia), f => f.nombre, f => {
      expect(f.tomas).toBeDefined()
      expect(f.tomas!).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(f.tomas!)).toBe(true)
    })
  })

  it('tomasDiaDe es entero ≥ 1 para todo el catálogo', () => {
    paraTodo(FARMACOS_PED, f => `${f.nombre} intervalo="${f.intervalo}"`, f => {
      const t = tomasDiaDe(f)
      expect(Number.isInteger(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(1)
    })
  })

  it('el piso por toma nunca supera al techo por toma (dosisMinima ≤ topeDosis)', () => {
    paraTodo(FARMACOS_PED.filter(f => f.dosisMinima != null), f => f.nombre, f => {
      if (f.topeDosis != null) expect(f.dosisMinima!).toBeLessThanOrEqual(f.topeDosis)
    })
  })

  it('edadMinimaMeses ≥ 0; si BLOQUEA de verdad (> 0) tiene texto de restricción visible', () => {
    paraTodo(FARMACOS_PED.filter(f => f.edadMinimaMeses != null), f => f.nombre, f => {
      expect(f.edadMinimaMeses!).toBeGreaterThanOrEqual(0)
      // `edadMinimaMeses: 0` es inerte (nunca hay edad < 0): es una marca informativa,
      // como en «Gentamicina neonatal (≤7 días)», y no exige texto de restricción.
      if (f.edadMinimaMeses! > 0) expect((f.restriccionEdad ?? '').trim().length).toBeGreaterThan(0)
    })
  })

  it('los topes del propio fármaco no se contradicen entre sí (topeDosis × tomas ≤ topeDia)', () => {
    paraTodo(
      FARMACOS_PED.filter(f => f.topeDosis != null && f.topeDia != null),
      f => `${f.nombre} topeDosis=${f.topeDosis} × ${tomasDiaDe(f)} vs topeDia=${f.topeDia}`,
      f => { expect(f.topeDosis!).toBeLessThanOrEqual(f.topeDia!) },
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P2 — ACEPTACIÓN: ningún fármaco produce dosis por encima de su tope
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El cuerpo de la propiedad de aceptación, con la calculadora INYECTADA. Se parametriza
 * para poder demostrar (P2-mutante) que el invariante DETECTA la regresión histórica
 * REG-018: un invariante verde contra un motor sano no prueba que el test sirva.
 */
function propiedadAceptacion(calc: Calculadora, pesos: number[] = PESOS): void {
  for (const f of FARMACOS_PED) {
    const tomas = tomasDiaDe(f)
    for (const peso of pesos) {
      for (const edad of MALLA_EDADES_MESES) {
        const d = calc(f, peso, edad)
        if (!d || d.contraindicadoPorEdad) continue
        const eti = `${f.nombre} @${peso} kg, edad ${edad ?? 'sin capturar'} m ` +
          `→ porToma ${d.porToma.min}–${d.porToma.max}, porDía ${d.porDia.min}–${d.porDia.max}, ${tomas} tomas/día`

        // (e) nada de NaN/∞/negativos: una cifra rota en una receta es un error grave.
        for (const [k, v] of Object.entries({
          'porToma.min': d.porToma.min, 'porToma.max': d.porToma.max,
          'porDia.min': d.porDia.min, 'porDia.max': d.porDia.max,
        })) {
          if (!Number.isFinite(v) || v < 0) throw new Error(`${eti} · ${k} = ${v} no es un número usable`)
        }

        // (d) REG-018: rangos ordenados y por-toma nunca por encima del total del día.
        if (d.porToma.min > d.porToma.max) throw new Error(`${eti} · porToma.min > porToma.max`)
        if (d.porDia.min > d.porDia.max) throw new Error(`${eti} · porDia.min > porDia.max`)
        if (!noExcede(d.porToma.max, d.porDia.max, TOL_REDONDEO)) {
          throw new Error(`${eti} · porToma.max > porDia.max`)
        }
        if (!noExcede(d.porToma.min, d.porDia.min, TOL_REDONDEO)) {
          throw new Error(`${eti} · porToma.min > porDia.min`)
        }

        // (a) ACEPTACIÓN literal: la dosis POR TOMA nunca supera su tope por toma.
        if (f.topeDosis != null && !noExcede(d.porToma.max, f.topeDosis)) {
          throw new Error(`${eti} · porToma.max supera topeDosis ${f.topeDosis}`)
        }

        for (const { valor, cual } of topesDiariosMg(f, peso)) {
          // (b) el total del día no supera el tope diario (± presupuesto de redondeo).
          if (!noExcede(d.porDia.max, valor, TOL_REDONDEO)) {
            throw new Error(`${eti} · porDia.max supera ${cual} = ${valor}`)
          }
          // (c) lo que se ESCRIBE en la receta es la dosis por toma: multiplicada por las
          //     tomas del día tampoco puede rebasar el techo diario. Sin esta comprobación
          //     el tope diario puede quedar "cumplido" solo en la cifra resumen.
          if (!noExcede(d.porToma.max * tomas, valor, TOL_REDONDEO * tomas)) {
            throw new Error(`${eti} · porToma.max × ${tomas} = ${d.porToma.max * tomas} supera ${cual} = ${valor}`)
          }
        }
      }
    }
  }
}

describe('E0-02 · P2 — ACEPTACIÓN: ningún fármaco supera su tope, a ningún peso ni edad', () => {
  it('todo el catálogo × malla de pesos × malla de edades cumple los invariantes de tope', () => {
    propiedadAceptacion(calcularDosisPediatrica)
  })

  it('la propiedad DETECTA la regresión REG-018 (motor mutante sin propagar topeMgKgDia a porToma)', () => {
    /**
     * Mutante que reproduce EXACTAMENTE el bug histórico REG-018: el tope mg/kg/día
     * recortaba el total del día pero NO la dosis por toma, así que la RECETA de
     * amikacina salía ~50 % arriba del tope de seguridad en pauta de 1 toma/día.
     * No se toca el motor de producción: se envuelve su salida.
     */
    const motorConBugREG018: Calculadora = (f, peso, edad) => {
      const d = calcularDosisPediatrica(f, peso, edad)
      if (!d || d.contraindicadoPorEdad || f.topeMgKgDia == null || !f.mgKgDia) return d
      const crudo = Math.round(((f.mgKgDia[1] * peso) / tomasDiaDe(f)) * 10) / 10
      return { ...d, porToma: { ...d.porToma, max: Math.max(d.porToma.max, crudo) } }
    }
    expect(() => propiedadAceptacion(motorConBugREG018, PESOS_RAPIDOS))
      .toThrow(/Amikacina|Gentamicina/)
  })

  it('la propiedad DETECTA un tope declarado que el motor no aplicaría (fármaco nº 26 mal formado)', () => {
    // Mutante del CATÁLOGO, no del motor: un fármaco cuyo tope por toma se "olvida".
    const motorQueIgnoraTopeDosis: Calculadora = (f, peso, edad) => {
      const d = calcularDosisPediatrica(f, peso, edad)
      if (!d || d.contraindicadoPorEdad || f.topeDosis == null || !f.mgKgDosis) return d
      const crudo = Math.round(f.mgKgDosis[1] * peso * 10) / 10
      return { ...d, porToma: { ...d.porToma, max: Math.max(d.porToma.max, crudo) } }
    }
    expect(() => propiedadAceptacion(motorQueIgnoraTopeDosis, PESOS_RAPIDOS))
      .toThrow(/supera topeDosis/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P3 — Monotonía en peso
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · P3 — la dosis nunca BAJA al subir el peso (a edad fija)', () => {
  it('porToma.max y porDia.max son no decrecientes en el peso, para todo fármaco y edad', () => {
    for (const f of FARMACOS_PED) {
      for (const edad of MALLA_EDADES_MESES) {
        let prevToma = -Infinity, prevDia = -Infinity, prevPeso = 0
        for (const peso of PESOS) {
          const d = calcularDosisPediatrica(f, peso, edad)
          if (!d || d.contraindicadoPorEdad) continue
          const eti = `${f.nombre} edad ${edad ?? 'sin capturar'} m: ${prevPeso} kg → ${peso} kg`
          if (d.porToma.max < prevToma - EPS_REL * Math.abs(prevToma)) {
            throw new Error(`CONTRAEJEMPLO → ${eti} · porToma.max BAJÓ ${prevToma} → ${d.porToma.max} (¿tope mal propagado?)`)
          }
          if (d.porDia.max < prevDia - EPS_REL * Math.abs(prevDia)) {
            throw new Error(`CONTRAEJEMPLO → ${eti} · porDia.max BAJÓ ${prevDia} → ${d.porDia.max}`)
          }
          prevToma = d.porToma.max; prevDia = d.porDia.max; prevPeso = peso
        }
      }
    }
  })

  it('peso no positivo ⇒ el motor NO devuelve dosis (null), nunca un 0 usable', () => {
    paraTodo([0, -0.1, -5, NaN], p => `peso ${p}`, p => {
      for (const f of FARMACOS_PED) expect(calcularDosisPediatrica(f, p, 24)).toBeNull()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P4 — La contraindicación por edad DOMINA sobre cualquier cálculo por peso
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · P4 — por debajo de la edad mínima NUNCA sale una dosis usable', () => {
  const conEdadMinima = FARMACOS_PED.filter(f => (f.edadMinimaMeses ?? 0) > 0)

  it('hay fármacos con edad mínima que vigilar (si no, esta propiedad sería vacua)', () => {
    expect(conEdadMinima.length).toBeGreaterThanOrEqual(3)
  })

  it('edad < edadMinimaMeses ⇒ contraindicado, dosis 0/0 y motivo visible, a cualquier peso', () => {
    for (const f of conEdadMinima) {
      const edadesBajas = MALLA_EDADES_MESES.filter(
        (e): e is number => typeof e === 'number' && e < f.edadMinimaMeses!,
      )
      for (const edad of edadesBajas) {
        paraTodo(PESOS, peso => `${f.nombre} @${peso} kg, edad ${edad} m (mínima ${f.edadMinimaMeses})`, peso => {
          const d = calcularDosisPediatrica(f, peso, edad)!
          expect(d.contraindicadoPorEdad).toBe(true)
          expect(d.porToma).toEqual({ min: 0, max: 0 })
          expect(d.porDia).toEqual({ min: 0, max: 0 })
          expect((d.motivoEdad ?? '').trim().length).toBeGreaterThan(0)
          expect(d.topeAplicado).toBe(false)
        })
      }
    }
  })

  it('edad ≥ edadMinimaMeses ⇒ NO se marca contraindicado (la guarda no se pasa de frenada)', () => {
    for (const f of conEdadMinima) {
      const edadesOk = MALLA_EDADES_MESES.filter(
        (e): e is number => typeof e === 'number' && e >= f.edadMinimaMeses!,
      )
      for (const edad of edadesOk) {
        const d = calcularDosisPediatrica(f, 12, edad)!
        expect(d.contraindicadoPorEdad, `${f.nombre} edad ${edad}`).toBeFalsy()
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P5 — Unidad obligatoria y fail-closed en el verificador ADULTO
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · P5 — verificador adulto: unidad obligatoria y ausencia ≠ seguro', () => {
  it('extraerMg: texto SOLO de volumen (mL/cc) ⇒ null, nunca se lee como mg', () => {
    const cantidades = [0.5, 1, 2.5, 5, 7.5, 10, 15, 20, 100]
    const formas = ['%N ml', '%N mL', '%N mililitros', '%N cc', '%N c.c.', 'dar %N ml cada 8 horas']
    const casos = cantidades.flatMap(n => formas.map(fmt => fmt.replace('%N', String(n))))
    paraTodo(casos, t => `extraerMg("${t}")`, t => { expect(extraerMg(t)).toBeNull() })
  })

  it('extraerMg: con unidad de MASA explícita convierte bien (g ×1000, mcg ÷1000)', () => {
    paraTodo(
      [
        ['500 mg', 500], ['1 g', 1000], ['0.5 g', 500], ['250 mcg', 0.25], ['1,5 g', 1500],
      ] as [string, number][],
      ([t]) => `extraerMg("${t}")`,
      ([t, esperado]) => { expect(extraerMg(t)).toBeCloseTo(esperado, 6) },
    )
  })

  it('fármaco FUERA del catálogo ⇒ SIEMPRE alerta `sin_referencia` (ausencia de alerta ≠ seguro)', () => {
    const desconocidos = ['Fármaco Inexistente 26', 'zzzqx', 'Molécula experimental', 'Rifampicina']
    const dosis = [1, 10, 100, 500, 1000, 5000]
    for (const nombre of desconocidos) {
      // Guarda: si algún día entra al catálogo, este caso deja de aplicar y hay que revisarlo.
      if (buscarFarmaco(nombre)) throw new Error(`"${nombre}" ya está en el CATALOGO: actualiza el caso`)
      paraTodo(dosis, d => `${nombre} ${d} mg`, d => {
        const alertas = revisarDosis({ farmaco: nombre, dosisMg: d, tomasDia: 3 })
        expect(alertas.some(a => a.codigo === 'sin_referencia')).toBe(true)
      })
    }
  })

  it('dosis por toma > maxTomaMg ⇒ SIEMPRE alerta crítica, en toda la malla', () => {
    const factores = [1.01, 1.2, 1.5, 2, 3, 5, 9.5, 10, 11, 20]
    for (const ref of CATALOGO.filter(f => f.maxTomaMg != null)) {
      paraTodo(factores, k => `${ref.nombre} × ${k} del máximo por toma`, k => {
        const alertas = revisarDosis({ farmaco: ref.nombre, dosisMg: ref.maxTomaMg! * k, tomasDia: 1 })
        expect(alertas.some(a => a.severidad === 'critica')).toBe(true)
      })
    }
  })

  it('dosis × tomas > maxDiaMg ⇒ SIEMPRE alerta `sobre_maximo_diario`', () => {
    for (const ref of CATALOGO.filter(f => f.maxDiaMg != null)) {
      paraTodo([2, 3, 4, 6, 8], tomas => `${ref.nombre} × ${tomas} tomas/día`, tomas => {
        // Dosis por toma que rebasa el techo DIARIO por poco (y no por el de una sola toma).
        const porToma = (ref.maxDiaMg! / tomas) * 1.05
        const alertas = revisarDosis({ farmaco: ref.nombre, dosisMg: porToma, tomasDia: tomas })
        expect(alertas.some(a => a.codigo === 'sobre_maximo_diario')).toBe(true)
      })
    }
  })

  it('dosis en el techo exacto NO alerta por techo (ni falsos positivos ni falsos negativos)', () => {
    for (const ref of CATALOGO.filter(f => f.maxTomaMg != null && f.maxDiaMg != null)) {
      const tomas = Math.max(1, Math.floor(ref.maxDiaMg! / ref.maxTomaMg!))
      const alertas = revisarDosis({ farmaco: ref.nombre, dosisMg: ref.maxTomaMg!, tomasDia: tomas })
      expect(
        alertas.filter(a => a.codigo === 'sobre_maximo_dosis' || a.codigo === 'sobre_maximo_diario'),
        `${ref.nombre} en su techo exacto`,
      ).toEqual([])
    }
  })

  it('CATALOGO adulto: internamente coherente y sin fármacos SIN techo', () => {
    paraTodo(CATALOGO, f => f.nombre, f => {
      expect(f.maxTomaMg != null || f.maxDiaMg != null).toBe(true)
      if (f.maxTomaMg != null && f.maxDiaMg != null) expect(f.maxTomaMg).toBeLessThanOrEqual(f.maxDiaMg)
      if (f.maxDiaOralMg != null && f.maxDiaMg != null) expect(f.maxDiaOralMg).toBeLessThanOrEqual(f.maxDiaMg)
      if (f.pedMaxMgKgToma != null && f.pedMaxMgKgDia != null) {
        expect(f.pedMaxMgKgToma).toBeLessThanOrEqual(f.pedMaxMgKgDia)
      }
      for (const v of [f.maxTomaMg, f.maxDiaMg, f.maxDiaOralMg, f.pedMaxMgKgToma, f.pedMaxMgKgDia]) {
        if (v != null) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThan(0) }
      }
    })
    const nombres = CATALOGO.map(f => f.nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// P6 — Coherencia ENTRE los dos motores deterministas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fármacos pediátricos que el verificador adulto SÍ reconoce. El resto devuelve
 * `sin_referencia` — ese hueco es la pregunta 3 de E0-02 (NEEDS_CLINICAL_REVIEW),
 * no se rellena aquí: los `maxTomaMg`/`maxDiaMg` de un adulto no se derivan de las
 * cifras pediátricas y no se inventan.
 */
const PED_CON_REFERENCIA_ADULTA = FARMACOS_PED.filter(f => buscarFarmaco(f.nombre) != null)

/** Contradicciones REALES entre catálogos, descontando el presupuesto de redondeo. */
function contradiccionesEntreMotores(): Map<string, string> {
  const out = new Map<string, string>()
  for (const f of PED_CON_REFERENCIA_ADULTA) {
    const tomas = tomasDiaDe(f)
    for (const peso of PESOS) {
      const d = calcularDosisPediatrica(f, peso, 60)
      if (!d || d.contraindicadoPorEdad || d.porToma.max <= 0) continue
      /**
       * Se descuenta el presupuesto de redondeo ANTES de verificar: el motor pediátrico
       * pudo redondear HACIA ARRIBA hasta `TOL_REDONDEO`, y esa aritmética no es una
       * contradicción de catálogo. Sin este descuento, Paracetamol @1.85 kg (15.0 mg/kg)
       * e Ibuprofeno @2.61 kg (10.0 mg/kg) aparecerían como contradicciones cuando están
       * exactamente EN el techo.
       */
      const dosisSinRedondeo = (d.porToma.max - TOL_REDONDEO) * (1 - EPS_REL)
      if (dosisSinRedondeo <= 0) continue
      const graves = revisarDosis({
        farmaco: f.nombre, dosisMg: dosisSinRedondeo, tomasDia: tomas, pesoKg: peso,
      }).filter(a => a.severidad === 'critica' || a.severidad === 'alta')
      if (graves.length && !out.has(f.nombre)) {
        out.set(f.nombre, `@${peso} kg → ${d.porToma.max} mg × ${tomas}/día · ${graves[0].mensaje}`)
      }
    }
  }
  return out
}

describe('E0-02 · P6 — los dos motores deterministas no se contradicen', () => {
  it('el mapeo ped→adulto no está vacío (si no, la propiedad sería vacua)', () => {
    expect(PED_CON_REFERENCIA_ADULTA.length).toBeGreaterThanOrEqual(4)
  })

  it('ninguna contradicción NUEVA: solo las ya conocidas y pendientes del médico', () => {
    const halladas = contradiccionesEntreMotores()
    const nuevas = [...halladas.entries()].filter(([n]) => !INCOHERENCIAS_CONOCIDAS.includes(n))
    expect(
      nuevas.map(([n, ej]) => `${n} — ${ej}`),
      'Contradicción NUEVA entre FARMACOS_PED y CATALOGO: el motor pediátrico emite una ' +
      'dosis que el verificador adulto marca como grave. NO la agregues a ' +
      'INCOHERENCIAS_CONOCIDAS sin decisión del médico responsable: hay que elegir qué ' +
      'techo manda, y eso es criterio clínico (NEEDS_CLINICAL_REVIEW).',
    ).toEqual([])
  })

  it('P6-bis: la lista de excepciones no se pudre — cada entrada sigue siendo una contradicción real', () => {
    const halladas = contradiccionesEntreMotores()
    paraTodo(
      INCOHERENCIAS_CONOCIDAS,
      n => `INCOHERENCIAS_CONOCIDAS incluye "${n}"`,
      n => {
        expect(FARMACOS_PED.some(f => f.nombre === n), `"${n}" ya no existe en FARMACOS_PED`).toBe(true)
        expect(
          halladas.has(n),
          `"${n}" ya NO se contradice: la pregunta clínica quedó resuelta ⇒ quita la ` +
          'entrada de INCOHERENCIAS_CONOCIDAS para que el invariante vuelva a ser estricto.',
        ).toBe(true)
      },
    )
  })

  it('documenta el hueco: Amoxicilina cruza el techo adulto por toma (1000 mg) desde ≈22.3 kg', () => {
    // No es una aserción de criterio clínico: es el HECHO medido que sostiene la pregunta 1.
    const amox = FARMACOS_PED.find(f => f.nombre === 'Amoxicilina')!
    const ref = buscarFarmaco('Amoxicilina')!
    expect(ref.maxTomaMg).toBe(1000)
    expect(calcularDosisPediatrica(amox, 22, 60)!.porToma.max).toBeLessThanOrEqual(ref.maxTomaMg!)
    expect(calcularDosisPediatrica(amox, 23, 60)!.porToma.max).toBeGreaterThan(ref.maxTomaMg!)
    // Desde 33.4 kg el topeDia (3000 en 2 tomas) la fija en 1500 mg/toma.
    expect(calcularDosisPediatrica(amox, 40, 60)!.porToma.max).toBe(1500)
  })

  it('documenta el hueco: la mayoría del catálogo pediátrico NO tiene techo adulto (pregunta 3)', () => {
    const sinReferencia = FARMACOS_PED.filter(f => buscarFarmaco(f.nombre) == null).map(f => f.nombre)
    // Fail-closed suave: si alguien AMPLÍA el catálogo adulto, este número cambia y obliga a
    // releer la pregunta 3 en lugar de dejarla marcada como pendiente para siempre.
    expect(sinReferencia.length).toBe(20)
    for (const nombre of sinReferencia) {
      const alertas = revisarDosis({ farmaco: nombre, dosisMg: 100000, tomasDia: 4 })
      expect(alertas.some(a => a.codigo === 'sin_referencia'), nombre).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Refactor puro de E0-02: `tomasDiaDe` / `tomasPorIntervalo` exportadas
// ═══════════════════════════════════════════════════════════════════════════

describe('E0-02 · refactor puro: tomasDiaDe coincide con lo que el motor aplica', () => {
  it('mgKgDosis ⇒ tomas del intervalo; mgKgDia ⇒ f.tomas', () => {
    paraTodo(FARMACOS_PED, f => f.nombre, f => {
      const esperado = f.mgKgDosis ? tomasPorIntervalo(f.intervalo) : (f.tomas ?? 1)
      expect(tomasDiaDe(f)).toBe(esperado)
    })
  })

  it('el reparto del motor usa esas mismas tomas (porDia ≈ porToma × tomasDiaDe) mientras ningún tope recorte', () => {
    paraTodo(
      FARMACOS_PED.filter(f => !f.esRescate),
      f => f.nombre,
      f => {
        // Peso 1 kg: el más bajo posible, donde ningún tope absoluto puede morder.
        const d = calcularDosisPediatrica(f, 1, 240)
        if (!d || d.contraindicadoPorEdad || d.topeAplicado) return
        const tomas = tomasDiaDe(f)
        /**
         * Holgura = presupuesto de redondeo de porDia (1 cifra) + el de porToma
         * multiplicado por las tomas. Cefalexina @1 kg: 50/3 = 16.7 × 3 = 50.1 vs 50.
         */
        const holgura = TOL_REDONDEO * (tomas + 1) + EPS_REL
        expect(Math.abs(d.porDia.max - d.porToma.max * tomas)).toBeLessThanOrEqual(holgura)
      },
    )
  })

  it('tomasPorIntervalo distingue minutos de horas (c/20 min ≠ c/20 h)', () => {
    expect(tomasPorIntervalo('c/20 min (crisis)')).toBe(72)
    expect(tomasPorIntervalo('c/6 h')).toBe(4)
    expect(tomasPorIntervalo('c/24 h')).toBe(1)
    expect(tomasPorIntervalo('dosis única')).toBe(1)
  })
})
