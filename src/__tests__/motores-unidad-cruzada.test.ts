/**
 * E0-05 — «tests de unidad cruzada» (entregable del backlog).
 *
 * Reparto de responsabilidades, igual que en E0-04:
 *  - La ACEPTACIÓN («creatinina en µmol/L ya no puede llegar cruda a CKD-EPI»)
 *    NO se prueba aquí: se prueba en src/__tests__/tipos/motores-unidad.tipos.ts,
 *    que es un gate de `tsc`, no de vitest.
 *  - Este archivo cubre (a) el GUARDIÁN de ese gate —que nadie lo desactive
 *    borrándolo o comentando los casos—, (b) la RED DE REGRESIÓN numérica de la
 *    migración, (c) que la guarda de rango sigue viva porque el tipo NO la
 *    sustituye, y (d) el único cambio de comportamiento de la unidad.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ckdEpi2021, cockcroftGault, evaluarFuncionRenal, ajusteRenalFarmacos,
} from '@/lib/expediente/funcion-renal'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { dosisARate } from '@/lib/uci/infusiones'
import { revisarDosis } from '@/lib/seguridad/dosis'
import { copiloto } from '@/lib/expediente/copiloto'
import {
  cantidad, mgPorDl, micromolPorL, kg, valorEn, aConcentracionMasa, UMOL_CREATININA,
} from '@/types/clinical-quantity'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(resolve(raiz, p), 'utf8')
const tfgDe = (cr: number, edad: number, sexo: 'Masculino' | 'Femenino') =>
  valorEn(ckdEpi2021(mgPorDl(cr), edad, sexo), 'mL/min/1.73m²')
const crclDe = (cr: number, edad: number, sexo: 'Masculino' | 'Femenino', peso: number) =>
  valorEn(cockcroftGault(mgPorDl(cr), edad, sexo, kg(peso)), 'mL/min')

// ---------------------------------------------------------------------------
// GUARDIÁN DEL GATE DEL COMPILADOR (patrón de clinical-quantity.test.ts)
// ---------------------------------------------------------------------------

describe('E0-05 · guardián del gate del compilador', () => {
  const rutaTipos = 'src/__tests__/tipos/motores-unidad.tipos.ts'

  it('el archivo de casos negativos existe', () => {
    expect(
      existsSync(resolve(raiz, rutaTipos)),
      `${rutaTipos} es la aceptación de E0-05: sin él, nada prueba que el compilador rechace una creatinina en µmol/L`,
    ).toBe(true)
  })

  it('conserva al menos 12 @ts-expect-error ACTIVOS (no comentados)', () => {
    const activos = leer(rutaTipos).split('\n').filter(l => /^\s*\/\/\s*@ts-expect-error\b/.test(l))
    expect(
      activos.length,
      'comentar o borrar los casos negativos "arregla" el CI y deja el agujero abierto',
    ).toBeGreaterThanOrEqual(12)
  })

  it('cubre la aceptación literal del backlog: µmol/L a ckdEpi2021', () => {
    const src = leer(rutaTipos)
    expect(src).toMatch(/ckdEpi2021\(creatUmolL,/)
    expect(src).toMatch(/const creatUmolL = micromolPorL\(106\)/)
  })

  it('el motor renal sigue exigiendo la dimensión de MASA (no se relajó la firma)', () => {
    const src = leer('src/lib/expediente/funcion-renal.ts')
    expect(src).toContain("export type CreatininaSerica = ClinicalQuantity<'concentracion_masa'>")
    expect(src, 'la firma es la aceptación: si vuelve a aceptar `number`, el bug regresa')
      .toMatch(/export function ckdEpi2021\(\s*creatinina: CreatininaSerica/)
  })

  it('NINGÚN sitio del repo llama a ckdEpi2021 con un número literal', () => {
    // Definición de terminado §5. Un literal como primer argumento sería un
    // `number` crudo colándose (hoy no compilaría, pero el grep lo deja explícito).
    for (const f of [
      'src/lib/expediente/copiloto.ts',
      'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx',
    ]) {
      expect(leer(f), f).not.toMatch(/ckdEpi2021\(\s*[\d.]/)
    }
  })
})

// ---------------------------------------------------------------------------
// EQUIVALENCIA NUMÉRICA CONGELADA — la red de regresión de toda la unidad
// ---------------------------------------------------------------------------

/**
 * Valores calculados con el motor de ANTES de la migración (git HEAD) y
 * congelados como literales. Si un solo número se mueve, esto se pone rojo.
 * Fixtures SINTÉTICOS: ningún dato real de paciente.
 */
describe('E0-05 · equivalencia numérica congelada (motor pre-migración)', () => {
  const RENAL: Array<[number, number, 'Masculino' | 'Femenino', number, number, string]> = [
    // creatinina, edad, sexo, TFG CKD-EPI, CrCl Cockcroft @70 kg, estadio
    [0.6, 30, 'Masculino', 133.17959102481765, 178, 'G1'],
    [0.6, 30, 'Femenino', 123.75786412164246, 152, 'G1'],
    [0.6, 65, 'Masculino', 107.12785550071611, 122, 'G1'],
    [0.6, 65, 'Femenino', 99.5491462519208, 103, 'G1'],
    [0.6, 85, 'Masculino', 94.59806639662831, 89, 'G1'],
    [0.6, 85, 'Femenino', 87.90577112601602, 76, 'G2'],
    [1.2, 30, 'Masculino', 83.43180372000218, 89, 'G2'],
    [1.2, 30, 'Femenino', 62.4509115642116, 76, 'G2'],
    [1.2, 65, 'Masculino', 67.11141057202191, 61, 'G2'],
    [1.2, 65, 'Femenino', 50.23466567555501, 52, 'G3a'],
    [1.2, 85, 'Masculino', 59.26198787038236, 45, 'G3a'],
    [1.2, 85, 'Femenino', 44.35916519356454, 38, 'G3b'],
    [3.4, 30, 'Masculino', 23.909716548094394, 31, 'G4'],
    [3.4, 30, 'Femenino', 17.89705516473725, 27, 'G4'],
    [3.4, 65, 'Masculino', 19.232651487494266, 21, 'G4'],
    [3.4, 65, 'Femenino', 14.396148274843693, 18, 'G5'],
    [3.4, 85, 'Masculino', 16.983179901188567, 16, 'G4'],
    [3.4, 85, 'Femenino', 12.712359301827584, 13, 'G5'],
  ]

  /**
   * REG-192: la columna de CrCl son ENTEROS porque el motor pre-migración
   * redondeaba dentro. Ese redondeo se movió a la capa de presentación —comparar
   * contra los umbrales con el valor ya redondeado borraba las alertas del borde—
   * así que aquí se redondea AL LEER. Ni uno de los 18 valores congelados cambió.
   */
  it.each(RENAL)('renal Scr %s, %s a, %s → TFG y CrCl idénticos', (cr, edad, sexo, tfg, crcl, estadio) => {
    expect(tfgDe(cr, edad, sexo)).toBe(tfg)
    expect(Math.round(crclDe(cr, edad, sexo, 70))).toBe(crcl)
    const r = evaluarFuncionRenal(mgPorDl(cr), edad, sexo, kg(70))
    expect(r.estadio).toBe(estadio)
    // Con peso, la depuración para dosificar es la de Cockcroft y lo DECLARA.
    // OJO: leer `.q` OBLIGA a estrechar por el discriminante — el compilador no
    // deja sacar mL/min de algo que podría ser mL/min/1.73 m². Ese es el punto.
    const dep = r.depuracionParaDosis!
    expect(dep.base).toBe('cockcroft-gault')
    if (dep.base === 'cockcroft-gault') expect(Math.round(valorEn(dep.q, 'mL/min'))).toBe(crcl)
  })

  it('sin peso, la depuración para dosificar es la TFG indexada y lo declara', () => {
    const r = evaluarFuncionRenal(mgPorDl(1.2), 65, 'Masculino')
    const dep = r.depuracionParaDosis!
    expect(dep.base).toBe('ckd-epi')
    if (dep.base === 'ckd-epi') expect(valorEn(dep.q, 'mL/min/1.73m²')).toBe(67.11141057202191)
  })

  it('gasometría: acidosis metabólica con AG elevado, números congelados', () => {
    const r = analizarGasometria({
      ph: 7.20,
      paco2: cantidad(25, 'mmHg', 'presion'),
      hco3: cantidad(10, 'mEq/L', 'concentracion_equivalente'),
      na: cantidad(140, 'mEq/L', 'concentracion_equivalente'),
      cl: cantidad(100, 'mEq/L', 'concentracion_equivalente'),
      albumina: cantidad(4, 'g/dL', 'concentracion_masa'),
    })
    expect(r.trastornoPrimario).toBe('acidosis_metabolica')
    expect(r.compensacion.esperadoPaCO2).toBe(23)
    expect(r.anionGap.valor).toBe(30)
    expect(r.anionGap.corregidoAlbumina).toBe(30)
    expect(r.deltaDelta.valor).toBe(1.3)
    expect(r.mixto).toBe(false)
  })

  it('gasometría: alcalosis respiratoria aguda compensada, congelada', () => {
    const r = analizarGasometria({
      ph: 7.50,
      paco2: cantidad(28, 'mmHg', 'presion'),
      hco3: cantidad(22, 'mEq/L', 'concentracion_equivalente'),
      cronicidadRespiratoria: 'aguda',
    })
    expect(r.trastornoPrimario).toBe('alcalosis_respiratoria')
    expect(r.compensacion.adecuada).toBe(true)
    expect(r.mixto).toBe(false)
  })

  it('infusiones: norepinefrina 0.1 µg/kg/min a 70 kg y vasopresina 0.03 U/min', () => {
    const nore = dosisARate({
      farmacoKey: 'norepinefrina', pesoKg: kg(70),
      dosis: cantidad(0.1, 'µg/kg/min', 'tasa_dosis_peso'),
    })
    expect(valorEn(nore.rateMlH!, 'mL/h')).toBe(26.3)
    const vaso = dosisARate({
      farmacoKey: 'vasopresina',
      dosis: cantidad(0.03, 'U/min', 'tasa_actividad'),
    })
    expect(valorEn(vaso.rateMlH!, 'mL/h')).toBe(9)
    // La actividad biológica NUNCA se convierte a masa: son dimensiones aparte.
    expect(vaso.dosis!.dimension).toBe('tasa_actividad')
    expect(vaso.concentracion!.dimension).toBe('concentracion_actividad')
  })

  it('ajuste renal: las alertas no dependen de la BASE, sólo del número', () => {
    const meds = [{ nombre: 'Vancomicina 1 g' }, { nombre: 'Metformina 850 mg' }]
    const porCockcroft = ajusteRenalFarmacos(meds, { base: 'cockcroft-gault', q: cantidad(25, 'mL/min', 'depuracion') })
    const porCkdEpi = ajusteRenalFarmacos(meds, { base: 'ckd-epi', q: cantidad(25, 'mL/min/1.73m²', 'depuracion_indexada') })
    expect(porCockcroft).toEqual(porCkdEpi)
    expect(porCockcroft.map(a => a.severidad)).toEqual(['ajuste', 'evitar'])
  })
})

// ---------------------------------------------------------------------------
// IDA Y VUELTA DE UNIDAD — la salida legítima para un laboratorio en µmol/L
// ---------------------------------------------------------------------------

describe('E0-05 · µmol/L → mg/dL → CKD-EPI', () => {
  it('106 µmol/L da la MISMA TFG que su equivalente en mg/dL (÷ 88.4)', () => {
    const enMasa = aConcentracionMasa(micromolPorL(106), 'creatinina')
    expect(enMasa).not.toBeNull()
    expect(enMasa!.valor).toBeCloseTo(106 / UMOL_CREATININA, 12)
    const porConversion = valorEn(ckdEpi2021(enMasa!, 60, 'Masculino'), 'mL/min/1.73m²')
    const directa = tfgDe(106 / UMOL_CREATININA, 60, 'Masculino')
    expect(porConversion).toBe(directa)
  })

  it('un analito sin masa molar en el catálogo NO se convierte (devuelve null)', () => {
    expect(aConcentracionMasa(micromolPorL(106), 'analito-inexistente')).toBeNull()
    // Consecuencia buscada: sin conversión no hay forma de meterlo a CKD-EPI.
    expect(aConcentracionMasa(micromolPorL(90), 'glucosa')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// EL TIPO NO SUSTITUYE A LA GUARDA DE RANGO (§7 del diseño)
// ---------------------------------------------------------------------------

describe('E0-05 · defensa en profundidad: la guarda de rango sigue viva', () => {
  it('una cantidad BIEN tipada pero MAL etiquetada (88 µmol/L rotulada mg/dL) se bloquea', () => {
    // Esto compila —el laboratorio dijo "mg/dL"— y ningún sistema de tipos ve el
    // papel del laboratorio. Sólo lo atrapa `creatininaPlausibleMgDl`.
    const r = evaluarFuncionRenal(mgPorDl(88), 60, 'Masculino')
    expect(r.datoImplausible).toBe(true)
    expect(r.egfrCkdEpi).toBeNull()
    expect(r.depuracionParaDosis).toBeNull()
  })

  it('HONESTIDAD: un valor SANO en µmol/L mal etiquetado (20) sigue pasando', () => {
    // Cae dentro de [0.1, 25] mg/dL. Cerrarlo exige que el laboratorio traiga su
    // unidad desde el origen (E1, ClinicalFact), no es alcance de E0-05.
    expect(evaluarFuncionRenal(mgPorDl(20), 60, 'Masculino').datoImplausible).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// EL HUECO CERRADO — único cambio de comportamiento de la unidad
// ---------------------------------------------------------------------------

describe('E0-05 · copiloto ya no calcula riesgo PREVENT sobre una creatinina implausible', () => {
  const base = {
    edad: 60,
    sexo: 'Masculino',
    diagnosticos: [{ descripcion: 'Hipertensión arterial sistémica' }],
    signos: { ta: '140/85' },
    medicamentos: [],
  }

  it('con creatinina 88 (µmol/L capturada como mg/dL) NO emite un riesgo calculado', () => {
    const s = copiloto({ ...base, labs: { creatinina: 88, colesterolTotal: 200, hdl: 45 } } as never)
    // ANTES: 88 entraba cruda a CKD-EPI → TFG ~5 → PREVENT devolvía un porcentaje.
    expect(s.some(x => x.id === 'prevent:riesgo')).toBe(false)
    // Y el motivo se DECLARA en vez de callarse.
    const falta = s.find(x => x.id === 'prevent:falta')
    expect(falta, 'el dato faltante debe declararse, no ocultarse').toBeTruthy()
    expect(falta!.pide).toMatch(/TFG/)
  })

  it('con la misma creatinina en mg/dL plausible (1.0) SÍ emite el riesgo', () => {
    const s = copiloto({ ...base, labs: { creatinina: 1.0, colesterolTotal: 200, hdl: 45 } } as never)
    expect(s.some(x => x.id === 'prevent:riesgo')).toBe(true)
  })

  it('con la TFG capturada directamente el comportamiento no cambia', () => {
    const s = copiloto({ ...base, labs: { tfg: 90, creatinina: 88, colesterolTotal: 200, hdl: 45 } } as never)
    expect(s.some(x => x.id === 'prevent:riesgo')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SEGURIDAD DE DOSIS — el P0 de pediatría deja de ser representable
// ---------------------------------------------------------------------------

describe('E0-05 · la dosis por kilo ya no puede leerse como dosis absoluta', () => {
  it('50 mg/kg/dosis de paracetamol alerta por mg/kg (el flag ya no se puede olvidar)', () => {
    const a = revisarDosis({
      farmaco: 'Paracetamol',
      dosis: cantidad(50, 'mg/kg/dosis', 'dosis_por_peso'),
      peso: kg(20),
    })
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(true)
  })

  it('50 mg absolutos en 20 kg (2.5 mg/kg) NO alerta — mismo número, otra unidad', () => {
    const a = revisarDosis({
      farmaco: 'Paracetamol',
      dosis: cantidad(50, 'mg', 'masa'),
      peso: kg(20),
    })
    expect(a.some(x => x.codigo === 'pediatrico_sobre_mgkg')).toBe(false)
  })

  it('el peso en gramos NO se lee como kilos: 20000 g son 20 kg', () => {
    const enGramos = revisarDosis({
      farmaco: 'Paracetamol', dosis: cantidad(500, 'mg', 'masa'), peso: cantidad(20000, 'g', 'masa'),
    })
    const enKilos = revisarDosis({
      farmaco: 'Paracetamol', dosis: cantidad(500, 'mg', 'masa'), peso: kg(20),
    })
    expect(enGramos).toEqual(enKilos)
  })
})
