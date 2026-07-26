/**
 * MOTOR DETERMINISTA DE VENTILACIÓN — ICU (iteración nexusmed-icu-006).
 *
 * Funciones PURAS, versionadas y probadas. El LLM NUNCA calcula estos valores:
 * solo entrega los números crudos que el médico dictó; aquí se normaliza, se
 * verifica la validez fisiológica y se calcula — o SE BLOQUEA.
 *
 * REGLA DE ORO: si falta un dato o la condición de medición no es válida, el
 * motor NO calcula y lo declara (`bloqueado`, `faltantes`, `motivoBloqueo`).
 * Un cálculo bloqueado es un resultado CORRECTO. Nunca asume una unidad, nunca
 * rellena con "normal", nunca usa una gasometría venosa para oxigenación arterial.
 *
 * Fórmulas (fisiología estándar / ARDSNet):
 *   FiO2 normalizada  = valor/100 si vino en %
 *   PBW (ARDSNet/Devine) = [H:50 | M:45.5] + 0.91·(talla_cm − 152.4)
 *   VT/PBW            = VT_mL / PBW_kg
 *   PaO2/FiO2 (Kirby) = PaO2_mmHg / FiO2_decimal
 *   Driving pressure  = Pplateau − PEEP_total
 *   Compliance est.   = VT_mL / Driving pressure
 */

export const VENTILACION_ENGINE_VERSION = '1.0.0'

export type Muestra = 'arterial' | 'venosa' | 'capilar'
export type Sexo = 'M' | 'F'

/** Rangos de validez fisiológica (fuera de esto = error de dato, se bloquea). */
export const RANGOS = {
  fio2: [0.21, 1.0],
  pao2_mmHg: [20, 700],
  pplat_cmH2O: [5, 60],
  peep_cmH2O: [0, 30],
  vt_mL: [50, 2000],
  talla_cm: [100, 250],
  dp_cmH2O: [0.5, 60],
} as const

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const enRango = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi
const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

/** Resultado uniforme de un cálculo determinista. */
export interface CalculoNum {
  ok: boolean               // true = se calculó; false = bloqueado
  valor: number | null
  unidad: string
  formula: string
  faltantes: string[]       // datos requeridos ausentes
  motivoBloqueo: string | null
  advertencias: string[]    // alertas fisiológicas (NO bloquean)
  datosUsados: Record<string, number | string>
  interpretacion?: string
}

const bloqueado = (unidad: string, formula: string, motivo: string, faltantes: string[] = []): CalculoNum => ({
  ok: false, valor: null, unidad, formula, faltantes, motivoBloqueo: motivo, advertencias: [], datosUsados: {},
})

/**
 * Normaliza FiO2 a decimal 0.21–1.0. Acepta 40 / "40%" / 0.4 → 0.40.
 * BLOQUEA (fio2=null) si el resultado cae fuera de [0.21, 1.0].
 */
export function normalizarFiO2(valor?: number | string, unidad?: string): { fio2: number | null; motivo: string | null; advertencia?: string } {
  const tienePorcentaje = typeof valor === 'string' && valor.includes('%')
  const crudo = typeof valor === 'string' ? valor.replace('%', '').trim() : valor
  const v = num(crudo)
  if (v === null) return { fio2: null, motivo: 'FiO2 no proporcionada' }
  const esPorcentaje = tienePorcentaje || unidad?.includes('%') || v > 1
  const fio2 = esPorcentaje ? v / 100 : v
  if (!enRango(fio2, RANGOS.fio2)) {
    return { fio2: null, motivo: `FiO2 fuera de rango fisiológico (${r2(fio2)}); debe estar entre 0.21 y 1.0` }
  }
  return { fio2: r2(fio2), motivo: null, advertencia: fio2 >= 0.6 ? 'FiO2 ≥ 0.6: vigilar toxicidad por oxígeno si se prolonga' : undefined }
}

/** Peso predicho (PBW, ARDSNet/Devine) en kg. Requiere sexo y talla válida. */
export function pesoPredichoPBW(sexo?: Sexo, tallaCm?: number | string): { pbw: number | null; motivo: string | null } {
  const t = num(tallaCm)
  if (sexo !== 'M' && sexo !== 'F') return { pbw: null, motivo: 'Falta el sexo para el peso predicho' }
  if (t === null) return { pbw: null, motivo: 'Falta la talla para el peso predicho' }
  if (!enRango(t, RANGOS.talla_cm)) return { pbw: null, motivo: `Talla fuera de rango (${t} cm)` }
  const base = sexo === 'M' ? 50 : 45.5
  return { pbw: r1(base + 0.91 * (t - 152.4)), motivo: null }
}

/** VT por peso predicho (mL/kg). Alerta si > 8 (meta de protección pulmonar). */
export function vtPorPBW(vtMl?: number | string, pbwKg?: number | null): CalculoNum {
  const vt = num(vtMl), pbw = num(pbwKg)
  const formula = 'VT / PBW'
  const faltantes: string[] = []
  if (vt === null) faltantes.push('volumen corriente (VT)')
  if (pbw === null) faltantes.push('peso predicho (PBW: sexo + talla)')
  if (faltantes.length) return bloqueado('mL/kg', formula, 'Datos insuficientes', faltantes)
  if (!enRango(vt!, RANGOS.vt_mL)) return bloqueado('mL/kg', formula, `VT fuera de rango (${vt} mL)`)
  const val = vt! / pbw!
  const advertencias: string[] = []
  if (val > 8) advertencias.push(`VT ${r1(val)} mL/kg PBW: alto para protección pulmonar (meta ≤ 6–8 mL/kg)`)
  return {
    ok: true, valor: r1(val), unidad: 'mL/kg', formula, faltantes: [], motivoBloqueo: null, advertencias,
    datosUsados: { VT_mL: vt!, PBW_kg: pbw! },
    interpretacion: val <= 6 ? 'Volumen protector' : val <= 8 ? 'Aceptable' : 'Por encima de la meta protectora',
  }
}

/**
 * PaO2/FiO2 (índice de Kirby). BLOQUEA si la muestra NO es arterial o si la FiO2
 * no pudo normalizarse. Berlin es SOLO reporte de oxigenación, NO diagnóstico de
 * SDRA (eso exige además PEEP ≥ 5, infiltrados bilaterales y origen no cardiogénico).
 */
export function indiceKirby(pao2Raw?: number | string, fio2Decimal?: number | null, muestra?: Muestra): CalculoNum {
  const formula = 'PaO2 / FiO2'
  // La muestra llega como texto libre ('Arterial', 'art', 'gaso arterial'…). Se
  // normaliza: arterial = empieza por 'art'. Vacío/undefined = no especificada.
  const mCrudo = typeof muestra === 'string' ? muestra.trim() : muestra
  const mNorm = mCrudo ? String(mCrudo).toLowerCase() : undefined
  const esArterial = mNorm ? mNorm.startsWith('art') : undefined
  if (mNorm && esArterial === false) {
    return bloqueado('', formula, `Muestra ${mCrudo}: NO se usa una gasometría ${mCrudo} para oxigenación arterial`)
  }
  const pao2 = num(pao2Raw), fio2 = num(fio2Decimal)
  const faltantes: string[] = []
  if (mNorm === undefined) faltantes.push('tipo de muestra (debe ser arterial)')
  if (pao2 === null) faltantes.push('PaO2')
  if (fio2 === null) faltantes.push('FiO2 normalizada')
  if (faltantes.length) return bloqueado('', formula, 'Datos insuficientes', faltantes)
  if (!enRango(pao2!, RANGOS.pao2_mmHg)) return bloqueado('', formula, `PaO2 fuera de rango (${pao2} mmHg)`)
  if (!enRango(fio2!, RANGOS.fio2)) return bloqueado('', formula, `FiO2 no normalizada o fuera de rango (${fio2})`)
  const val = Math.round(pao2! / fio2!)
  // Cortes de Berlin (límite superior inclusivo): leve 200<P/F≤300, moderado
  // 100<P/F≤200, grave ≤100. Antes usaba '≥', que infra-clasificaba los valores
  // frontera exactos (100→moderado en vez de grave, 200→leve en vez de moderado).
  const berlin = val > 300 ? 'Sin criterio de oxigenación de SDRA (P/F > 300)'
    : val > 200 ? 'SDRA leve por oxigenación (200–300)'
    : val > 100 ? 'SDRA moderado por oxigenación (100–200)'
    : 'SDRA grave por oxigenación (≤ 100)'
  return {
    ok: true, valor: val, unidad: 'mmHg', formula, faltantes: [], motivoBloqueo: null,
    advertencias: val < 100 ? ['Hipoxemia grave (P/F < 100)'] : [],
    datosUsados: { PaO2_mmHg: pao2!, FiO2: fio2! },
    interpretacion: `${berlin}. El diagnóstico de SDRA requiere además PEEP ≥ 5, infiltrados bilaterales y no ser de origen cardiogénico — no se diagnostica automáticamente.`,
  }
}

/**
 * Driving pressure = Pplateau − PEEP total. BLOQUEA si falta Pplat/PEEP, si la
 * pausa inspiratoria no fue válida, o si hay esfuerzo espontáneo (invalida Pplat).
 * PEEP total = PEEP fijada + auto-PEEP (si no se midió auto-PEEP, se advierte que
 * el DP real podría ser MENOR — no se bloquea porque la PEEP fijada es un piso).
 */
export function drivingPressure(
  pplatRaw?: number | string, peepFijada?: number | string,
  opts?: { autoPeep?: number | string; pausaValida?: boolean; esfuerzoEspontaneo?: boolean },
): CalculoNum {
  const formula = 'Pplateau − PEEP_total'
  const pplat = num(pplatRaw), peep = num(peepFijada), autoPeep = num(opts?.autoPeep)
  const faltantes: string[] = []
  if (pplat === null) faltantes.push('presión plateau (Pplat)')
  if (peep === null) faltantes.push('PEEP')
  if (faltantes.length) return bloqueado('cmH2O', formula, 'Datos insuficientes', faltantes)
  if (opts?.esfuerzoEspontaneo === true) return bloqueado('cmH2O', formula, 'Hay esfuerzo espontáneo: la Pplateau no es interpretable para driving pressure')
  if (opts?.pausaValida === false) return bloqueado('cmH2O', formula, 'La pausa inspiratoria no fue válida: Pplateau no confiable')
  if (!enRango(pplat!, RANGOS.pplat_cmH2O)) return bloqueado('cmH2O', formula, `Pplateau fuera de rango (${pplat} cmH2O)`)
  if (!enRango(peep!, RANGOS.peep_cmH2O)) return bloqueado('cmH2O', formula, `PEEP fuera de rango (${peep} cmH2O)`)
  const peepTotal = peep! + (autoPeep ?? 0)
  const dp = pplat! - peepTotal
  if (!enRango(dp, RANGOS.dp_cmH2O)) return bloqueado('cmH2O', formula, `Driving pressure no fisiológico (${r1(dp)}): revisa que Pplat > PEEP`)
  const advertencias: string[] = []
  if (autoPeep === null) advertencias.push('Auto-PEEP no medido: si existe, el driving pressure real es menor')
  if (dp > 15) advertencias.push(`Driving pressure ${r1(dp)} cmH2O: elevado (meta ≤ 15 cmH2O)`)
  if (pplat! > 30) advertencias.push(`Pplateau ${pplat} cmH2O: elevada (meta < 30 cmH2O)`)
  return {
    ok: true, valor: r1(dp), unidad: 'cmH2O', formula, faltantes: [], motivoBloqueo: null, advertencias,
    datosUsados: { Pplateau: pplat!, PEEP_total: peepTotal },
    interpretacion: dp <= 15 ? 'Dentro de meta' : 'Por encima de la meta protectora',
  }
}

/** Compliance estática = VT / Driving pressure (mL/cmH2O). Requiere DP válido (>0). */
export function complianceEstatica(vtMl?: number | string, dpCmH2O?: number | null): CalculoNum {
  const formula = 'VT / Driving pressure'
  const vt = num(vtMl), dp = num(dpCmH2O)
  const faltantes: string[] = []
  if (vt === null) faltantes.push('volumen corriente (VT)')
  if (dp === null) faltantes.push('driving pressure válido')
  if (faltantes.length) return bloqueado('mL/cmH2O', formula, 'Datos insuficientes', faltantes)
  if (dp! <= 0) return bloqueado('mL/cmH2O', formula, 'Driving pressure ≤ 0: no se puede calcular compliance')
  if (!enRango(vt!, RANGOS.vt_mL)) return bloqueado('mL/cmH2O', formula, `VT fuera de rango (${vt} mL)`)
  const val = vt! / dp!
  return {
    ok: true, valor: Math.round(val), unidad: 'mL/cmH2O', formula, faltantes: [], motivoBloqueo: null,
    advertencias: val < 30 ? ['Compliance baja (< 30 mL/cmH2O): pulmón rígido'] : [],
    datosUsados: { VT_mL: vt!, DrivingPressure: dp! },
    interpretacion: val >= 50 ? 'Normal-alta' : val >= 30 ? 'Reducida' : 'Muy reducida',
  }
}

/* ── Orquestador: toma los datos crudos y devuelve TODO el análisis ventilatorio ── */

export interface EntradaVentilacion {
  sexo?: Sexo
  tallaCm?: number | string
  vtMl?: number | string
  fio2?: number | string
  fio2Unidad?: string
  pplat?: number | string
  peep?: number | string
  autoPeep?: number | string
  pausaValida?: boolean
  esfuerzoEspontaneo?: boolean
  // Para PaO2/FiO2 (de la gasometría relacionada):
  pao2?: number | string
  muestraGasometria?: Muestra
}

export interface AnalisisVentilacion {
  version: string
  fio2: { valor: number | null; motivo: string | null }
  pbw: { valor: number | null; motivo: string | null }
  vtPorPbw: CalculoNum
  drivingPressure: CalculoNum
  complianceEstatica: CalculoNum
  indiceKirby: CalculoNum
  advertencias: string[]   // consolidado, jerarquizable por la capa de seguridad
}

export function analizarVentilacion(e: EntradaVentilacion): AnalisisVentilacion {
  const fio2 = normalizarFiO2(e.fio2, e.fio2Unidad)
  const pbw = pesoPredichoPBW(e.sexo, e.tallaCm)
  const vtPorPbw = vtPorPBW(e.vtMl, pbw.pbw)
  const dp = drivingPressure(e.pplat, e.peep, { autoPeep: e.autoPeep, pausaValida: e.pausaValida, esfuerzoEspontaneo: e.esfuerzoEspontaneo })
  const compliance = complianceEstatica(e.vtMl, dp.ok ? dp.valor : null)
  const kirby = indiceKirby(e.pao2, fio2.fio2, e.muestraGasometria)

  const advertencias = [
    fio2.advertencia,
    ...vtPorPbw.advertencias, ...dp.advertencias, ...compliance.advertencias, ...kirby.advertencias,
  ].filter((x): x is string => !!x)

  return {
    version: VENTILACION_ENGINE_VERSION,
    fio2: { valor: fio2.fio2, motivo: fio2.motivo },
    pbw: { valor: pbw.pbw, motivo: pbw.motivo },
    vtPorPbw, drivingPressure: dp, complianceEstatica: compliance, indiceKirby: kirby,
    advertencias,
  }
}
