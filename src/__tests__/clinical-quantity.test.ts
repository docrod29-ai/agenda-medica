import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cantidad, cantidadDesde, convertir, sumar, restar, comparar, esMayor, escalar,
  valorEn, formatear, etiqueta, aConcentracionSustancia,
  FACTORES, FACTORES_MOLARES, UNIDAD_CANONICA, MMOL_COLESTEROL, UMOL_CREATININA,
  mg, mL, kg, mgPorDl, micromolPorL, mmHg,
  type Dimension, type CualquierCantidad,
} from '@/types/clinical-quantity'

/**
 * E0-04 — ClinicalQuantity.
 *
 * OJO con el reparto de responsabilidades: la ACEPTACIÓN de la unidad («el
 * compilador rechaza operar cantidades incompatibles») NO se prueba aquí — se
 * prueba en src/__tests__/tipos/clinical-quantity.tipos.ts, que es un gate de
 * `tsc`, no de vitest. Este archivo cubre (a) el comportamiento en runtime y
 * (b) el GUARDIÁN de ese gate: que nadie lo desactive borrando el archivo o
 * comentando los casos.
 */

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')

// ---------------------------------------------------------------------------
// GUARDIÁN DEL GATE DEL COMPILADOR (patrón log-secrets-guard / firestore-rules-guard)
// ---------------------------------------------------------------------------

describe('E0-04 · guardián del gate del compilador', () => {
  const rutaTipos = 'src/__tests__/tipos/clinical-quantity.tipos.ts'

  it('el archivo de casos negativos existe', () => {
    expect(existsSync(resolve(raiz, rutaTipos)), `${rutaTipos} es la aceptación de E0-04: sin él, nada prueba que el compilador rechace mg + mL`).toBe(true)
  })

  it('conserva al menos 6 @ts-expect-error ACTIVOS (no comentados)', () => {
    const activos = leer(rutaTipos)
      .split('\n')
      .filter(l => /^\s*\/\/\s*@ts-expect-error\b/.test(l))
    expect(activos.length, 'comentar o borrar los casos negativos "arregla" el CI y deja el agujero abierto').toBeGreaterThanOrEqual(6)
  })

  it('cubre los dos ejemplos textuales del backlog: sumar mg con mL y comparar mg/dL con µmol/L', () => {
    const src = leer(rutaTipos)
    expect(src).toMatch(/sumar\(masa,\s*volumen\)/)
    expect(src).toMatch(/comparar\(creatMgDl,\s*creatUmolL\)/)
  })

  it('la MARCA INVARIANTE sigue en el tipo (control negativo de DISENO §3.3)', () => {
    // Sin `(d: D) => D` el genérico se vuelve covariante, TS ensancha D a la
    // unión y sumar(mg, mL) COMPILA: el CI queda verde y la protección no existe.
    // Verificado en el repo real: al sustituirla por `readonly [MARCA]: true`,
    // tsc devolvió exit 2 con 5 TS2578 (casos 1, 2, 6, 8 y 9).
    expect(leer('src/types/clinical-quantity.ts')).toContain('readonly [MARCA]: (d: D) => D')
  })

  it('MARCA no se exporta (la única puerta de entrada es la fábrica)', () => {
    expect(leer('src/types/clinical-quantity.ts')).not.toMatch(/^export\s+declare\s+const\s+MARCA/m)
  })
})

// ---------------------------------------------------------------------------
// CONVERSIÓN Y ESCALA
// ---------------------------------------------------------------------------

describe('E0-04 · conversión', () => {
  it('ida y vuelta es idempotente (1 kg → g → kg)', () => {
    const uno = kg(1)
    const vuelta = convertir(convertir(uno, 'g'), 'kg')
    expect(vuelta.valor).toBeCloseTo(1, 12)
    expect(vuelta.unidad).toBe('kg')
    expect(convertir(uno, 'g').valor).toBeCloseTo(1000, 9)
  })

  it('convertir conserva la dimensión y cambia la unidad', () => {
    const q = convertir(mgPorDl(1.2), 'mg/L')
    expect(q.dimension).toBe('concentracion_masa')
    expect(q.unidad).toBe('mg/L')
    expect(q.valor).toBeCloseTo(12, 9)
  })

  it('µg/mL y mg/L son el mismo número (definición)', () => {
    expect(valorEn(cantidad(4, 'µg/mL', 'concentracion_masa'), 'mg/L')).toBeCloseTo(4, 9)
  })

  it('mmHg ↔ kPa usa la definición física (1 mmHg = 133.322387415 Pa)', () => {
    expect(valorEn(mmHg(760), 'kPa')).toBeCloseTo(101.325, 3)
  })

  it('mg/kg/día → mg/kg/min divide entre 1440 (aritmética exacta del tiempo)', () => {
    expect(valorEn(cantidad(1440, 'mg/kg/día', 'tasa_dosis_peso'), 'mg/kg/min')).toBeCloseTo(1, 9)
  })
})

// ---------------------------------------------------------------------------
// OPERACIONES — el bug de escala
// ---------------------------------------------------------------------------

describe('E0-04 · operaciones', () => {
  it('sumar 1 g + 1 mg da 1001 mg y NO 2 (bug de escala)', () => {
    const total = sumar(cantidad(1, 'g', 'masa'), mg(1))
    expect(valorEn(total, 'mg')).toBeCloseTo(1001, 9)
    expect(total.valor).not.toBe(2)
  })

  it('el resultado se devuelve en la unidad del PRIMER operando (regla determinista)', () => {
    expect(sumar(cantidad(1, 'g', 'masa'), mg(1)).unidad).toBe('g')
    expect(sumar(mg(1), cantidad(1, 'g', 'masa')).unidad).toBe('mg')
    // …y ambas rutas describen la misma cantidad física.
    const a = valorEn(sumar(cantidad(1, 'g', 'masa'), mg(1)), 'mg')
    const b = valorEn(sumar(mg(1), cantidad(1, 'g', 'masa')), 'mg')
    expect(a).toBeCloseTo(b, 9)
  })

  it('restar normaliza igual que sumar', () => {
    expect(valorEn(restar(cantidad(1, 'g', 'masa'), mg(1)), 'mg')).toBeCloseTo(999, 9)
  })

  it('comparar(1 g, 1000 mg) === 0 — igualdad a través de unidades distintas', () => {
    expect(comparar(cantidad(1, 'g', 'masa'), mg(1000))).toBe(0)
    expect(comparar(mg(1), cantidad(1, 'g', 'masa'))).toBe(-1)
    expect(comparar(cantidad(1, 'g', 'masa'), mg(1))).toBe(1)
  })

  it('esMayor compara en unidad canónica, no el número desnudo', () => {
    // 1 mL contra 1 L: el número crudo diría "iguales"; la cantidad dice que no.
    expect(esMayor(cantidad(1, 'L', 'volumen'), mL(1))).toBe(true)
    expect(esMayor(mL(1), cantidad(1, 'L', 'volumen'))).toBe(false)
  })

  it('escalar conserva unidad y dimensión', () => {
    const doble = escalar(mg(250), 2)
    expect(doble.valor).toBe(500)
    expect(doble.unidad).toBe('mg')
    expect(doble.dimension).toBe('masa')
  })

  it('las cantidades son inmutables: operar devuelve objetos nuevos', () => {
    const original = mg(500)
    sumar(original, mg(1))
    escalar(original, 10)
    expect(original.valor).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// ENTRADA DESDE EL MUNDO REAL
// ---------------------------------------------------------------------------

describe('E0-04 · cantidadDesde (contrato heredado de num())', () => {
  it('vacío o basura ⇒ null, NUNCA un 0 inventado', () => {
    expect(cantidadDesde(' ', 'mg', 'masa')).toBeNull()
    expect(cantidadDesde('', 'mg', 'masa')).toBeNull()
    expect(cantidadDesde('abc', 'mg', 'masa')).toBeNull()
    expect(cantidadDesde(null, 'mg', 'masa')).toBeNull()
    expect(cantidadDesde(undefined, 'mg', 'masa')).toBeNull()
    expect(cantidadDesde(NaN, 'mg', 'masa')).toBeNull()
  })

  it('coma decimal mexicana: "12,5" ⇒ 12.5', () => {
    expect(cantidadDesde('12,5', 'mg/dL', 'concentracion_masa')?.valor).toBe(12.5)
  })

  it('"1,200" son mil doscientos (miles), no 1.2', () => {
    expect(cantidadDesde('1,200', 'mg', 'masa')?.valor).toBe(1200)
  })

  it('el 0 explícito SÍ es un dato válido', () => {
    expect(cantidadDesde('0', 'mg', 'masa')?.valor).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// EXHAUSTIVIDAD DEL CATÁLOGO
// ---------------------------------------------------------------------------

describe('E0-04 · catálogo de factores', () => {
  const dimensiones = Object.keys(FACTORES) as Dimension[]

  it('toda unidad de toda dimensión tiene un factor finito y > 0', () => {
    const malas: string[] = []
    for (const d of dimensiones) {
      const tabla = FACTORES[d] as Record<string, number>
      const unidades = Object.keys(tabla)
      expect(unidades.length, `la dimensión ${d} no declara ninguna unidad`).toBeGreaterThan(0)
      for (const u of unidades) {
        const f = tabla[u]
        if (!Number.isFinite(f) || f <= 0) malas.push(`${d}.${u}=${f}`)
      }
    }
    expect(malas, 'un factor ausente, 0 o infinito es un bug de escala esperando').toEqual([])
  })

  it('la unidad canónica de cada dimensión existe y su factor es exactamente 1', () => {
    for (const d of dimensiones) {
      const tabla = FACTORES[d] as Record<string, number>
      const canon = (UNIDAD_CANONICA as Record<string, string>)[d]
      expect(tabla[canon], `la canónica de ${d} (${canon}) debe tener factor 1`).toBe(1)
    }
  })

  it('convertir a la propia unidad no altera el valor en ninguna dimensión', () => {
    for (const d of dimensiones) {
      for (const u of Object.keys(FACTORES[d] as Record<string, number>)) {
        const q = cantidad(7, u as never, d) as CualquierCantidad
        expect(convertir(q as never, u as never).valor, `${d}.${u}`).toBeCloseTo(7, 9)
      }
    }
  })

  it('las dimensiones que exigen un dato del paciente están AISLADAS (una sola unidad)', () => {
    // Si alguien mete mL/min y mL/min/1.73m² en la misma dimensión, convertir
    // devolvería el mismo número con otra etiqueta sin conocer la superficie
    // corporal. Igual con U/min (actividad) y mg/kg/dosis (nº de tomas).
    for (const d of ['depuracion', 'depuracion_indexada', 'tasa_actividad', 'dosis_por_peso'] as const) {
      expect(Object.keys(FACTORES[d]), `${d} no debe admitir conversiones automáticas`).toHaveLength(1)
    }
  })

  it('no hay dimensión de temperatura: °C↔°F es afín, no un factor', () => {
    expect(Object.keys(FACTORES)).not.toContain('temperatura')
  })
})

// ---------------------------------------------------------------------------
// FACTORES MOLARES — anti-deriva contra el repo
// ---------------------------------------------------------------------------

describe('E0-04 · conversión masa ↔ sustancia', () => {
  it('un analito fuera del catálogo ⇒ null (NUNCA adivina una masa molar)', () => {
    expect(aConcentracionSustancia(mgPorDl(1.2), 'analito-inexistente')).toBeNull()
    expect(aConcentracionSustancia(mgPorDl(90), 'glucosa')).toBeNull()
  })

  it('creatinina 1.2 mg/dL ⇒ ~106 µmol/L (× 88.4)', () => {
    const q = aConcentracionSustancia(mgPorDl(1.2), 'creatinina')
    expect(q).not.toBeNull()
    expect(q!.unidad).toBe('µmol/L')
    expect(q!.dimension).toBe('concentracion_sustancia')
    expect(q!.valor).toBeCloseTo(1.2 * 88.4, 9)
  })

  it('colesterol 200 mg/dL ⇒ ~5.17 mmol/L (÷ 38.67)', () => {
    const q = aConcentracionSustancia(mgPorDl(200), 'colesterol')
    expect(valorEn(q!, 'mmol/L')).toBeCloseTo(200 / 38.67, 9)
  })

  it('ANTI-DERIVA: el 38.67 del catálogo es el mismo que usa prevent.ts', () => {
    // prevent.ts lo declara como `const MMOL = 38.67` PRIVADO del módulo, así que
    // la única forma de detectar que alguien cambia uno y no el otro es leerlo.
    const src = leer('src/lib/expediente/prevent.ts')
    const m = src.match(/const\s+MMOL\s*=\s*([\d.]+)/)
    expect(m, 'prevent.ts ya no declara MMOL: revisa si el factor de colesterol sigue vigente').not.toBeNull()
    expect(Number(m![1])).toBe(MMOL_COLESTEROL)
  })

  it('ANTI-DERIVA: el 88.4 del catálogo es el citado en funcion-renal.ts y copiloto.ts', () => {
    expect(leer('src/lib/expediente/funcion-renal.ts')).toContain(String(UMOL_CREATININA))
    expect(leer('src/lib/expediente/copiloto.ts')).toContain(String(UMOL_CREATININA))
  })

  it('todo factor molar declara su fuente verificable', () => {
    for (const [k, f] of Object.entries(FACTORES_MOLARES)) {
      expect(f.analito, k).toBe(k)
      expect(Number.isFinite(f.factorMgDlAMicromolL) && f.factorMgDlAMicromolL > 0, k).toBe(true)
      expect(f.fuente.length, `${k} sin fuente citada: un factor molar sin origen es un número inventado`).toBeGreaterThan(20)
    }
  })

  it('el catálogo arranca SOLO con los dos factores que ya existían en el repo', () => {
    // Si crece, que sea con una decisión explícita (y su fuente), no "de paso".
    expect(Object.keys(FACTORES_MOLARES).sort()).toEqual(['colesterol', 'creatinina'])
  })
})

// ---------------------------------------------------------------------------
// SALIDA
// ---------------------------------------------------------------------------

describe('E0-04 · salida hacia el mundo', () => {
  it('formatear no altera el valor almacenado (el redondeo es de presentación)', () => {
    const q = mgPorDl(1.2345)
    expect(formatear(q, 2)).toBe('1.23 mg/dL')
    expect(q.valor).toBe(1.2345)
    expect(formatear(mgPorDl(1.2))).toBe('1.2 mg/dL')
  })

  it('valorEn exige nombrar la unidad y devuelve ese número', () => {
    expect(valorEn(kg(2), 'g')).toBeCloseTo(2000, 9)
    expect(valorEn(micromolPorL(106), 'mmol/L')).toBeCloseTo(0.106, 9)
  })

  it('CualquierCantidad permite listar dimensiones distintas (guardar/mostrar)', () => {
    const lista: CualquierCantidad[] = [mg(500), mL(250), mgPorDl(1.2)]
    expect(lista.map(etiqueta)).toEqual(['500 mg', '250 mL', '1.2 mg/dL'])
  })

  it('una cantidad serializa a JSON sin la marca fantasma (no existe en runtime)', () => {
    expect(JSON.parse(JSON.stringify(mg(500)))).toEqual({ valor: 500, unidad: 'mg', dimension: 'masa' })
  })
})
