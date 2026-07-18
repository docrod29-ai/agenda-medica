/**
 * PEDIATRÍA — herramientas de consulta:
 *  1. Dosificación por peso con TOPE de adulto (el error más frecuente y peligroso).
 *  2. Esquema de vacunación de México con detección de atrasos.
 *  3. Motor de percentiles/z-score (LMS de la OMS) + clasificación nutricional.
 *
 * Todo son funciones PURAS y testeadas. Apoyo a la decisión: la dosis final la
 * decide el médico (ajusta por función renal/hepática, prematurez y comorbilidad).
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. DOSIFICACIÓN POR PESO
// ═══════════════════════════════════════════════════════════════════════════

export interface FarmacoPed {
  nombre: string
  /** mg/kg por DOSIS (si el fármaco se dosifica por toma). */
  mgKgDosis?: [number, number]
  /** mg/kg por DÍA (si se dosifica por día y se divide). */
  mgKgDia?: [number, number]
  /** Tomas al día (para repartir la dosis diaria). */
  tomas?: number
  intervalo: string
  /** Tope por DOSIS (no rebasar al adulto). */
  topeDosis?: number
  /** Tope por DÍA. */
  topeDia?: number
  unidad: string
  nota?: string
}

export const FARMACOS_PED: FarmacoPed[] = [
  { nombre: 'Paracetamol', mgKgDosis: [10, 15], intervalo: 'c/6 h', topeDosis: 1000, topeDia: 4000, unidad: 'mg', nota: 'Máx 75 mg/kg/día. Vigilar dosis acumulada si hay varias presentaciones.' },
  { nombre: 'Ibuprofeno', mgKgDosis: [5, 10], intervalo: 'c/6-8 h', topeDosis: 600, topeDia: 2400, unidad: 'mg', nota: 'Máx 40 mg/kg/día. No en < 6 meses ni en deshidratación/lesión renal.' },
  { nombre: 'Amoxicilina', mgKgDia: [45, 90], tomas: 2, intervalo: 'c/12 h', topeDia: 3000, unidad: 'mg', nota: 'Dosis ALTA (80-90) en otitis media y sospecha de neumococo con sensibilidad disminuida.' },
  { nombre: 'Amoxicilina-clavulanato', mgKgDia: [45, 90], tomas: 2, intervalo: 'c/12 h', topeDia: 3000, unidad: 'mg', nota: 'La dosis se calcula por el componente AMOXICILINA; usar formulación 14:1 para dosis alta.' },
  { nombre: 'Azitromicina', mgKgDia: [10, 10], tomas: 1, intervalo: 'c/24 h', topeDia: 500, unidad: 'mg', nota: 'Día 1: 10 mg/kg; días 2-5: 5 mg/kg (o 10 mg/kg/día × 3 días).' },
  { nombre: 'Cefalexina', mgKgDia: [25, 50], tomas: 3, intervalo: 'c/8 h', topeDia: 4000, unidad: 'mg' },
  { nombre: 'Ceftriaxona', mgKgDia: [50, 75], tomas: 1, intervalo: 'c/24 h', topeDia: 2000, unidad: 'mg', nota: 'Meningitis: 100 mg/kg/día (tope 4 g). No mezclar con calcio en neonatos.' },
  { nombre: 'Cefotaxima', mgKgDia: [100, 200], tomas: 4, intervalo: 'c/6 h', topeDia: 12000, unidad: 'mg' },
  { nombre: 'Clindamicina', mgKgDia: [20, 40], tomas: 3, intervalo: 'c/8 h', topeDia: 2700, unidad: 'mg' },
  { nombre: 'Trimetoprim-sulfametoxazol', mgKgDia: [8, 12], tomas: 2, intervalo: 'c/12 h', topeDia: 320, unidad: 'mg de TMP', nota: 'La dosis se expresa en TRIMETOPRIM. No en < 2 meses.' },
  { nombre: 'Nitrofurantoína', mgKgDia: [5, 7], tomas: 4, intervalo: 'c/6 h', topeDia: 400, unidad: 'mg', nota: 'Solo IVU baja. No en < 1 mes ni en insuficiencia renal.' },
  { nombre: 'Metronidazol', mgKgDia: [30, 30], tomas: 3, intervalo: 'c/8 h', topeDia: 2000, unidad: 'mg' },
  { nombre: 'Vancomicina', mgKgDia: [40, 60], tomas: 4, intervalo: 'c/6 h', topeDia: 4000, unidad: 'mg', nota: 'Dosificar por AUC/CMI; monitorizar niveles y función renal.' },
  { nombre: 'Gentamicina', mgKgDia: [5, 7.5], tomas: 1, intervalo: 'c/24 h', unidad: 'mg', nota: 'Dosis única diaria; monitorizar niveles y función renal.' },
  { nombre: 'Amikacina', mgKgDia: [15, 22.5], tomas: 1, intervalo: 'c/24 h', unidad: 'mg', nota: 'Dosis única diaria; monitorizar niveles.' },
  { nombre: 'Meropenem', mgKgDia: [60, 60], tomas: 3, intervalo: 'c/8 h', topeDia: 3000, unidad: 'mg', nota: 'Meningitis: 120 mg/kg/día (tope 6 g).' },
  { nombre: 'Prednisona', mgKgDia: [1, 2], tomas: 1, intervalo: 'c/24 h', topeDia: 60, unidad: 'mg' },
  { nombre: 'Dexametasona (croup)', mgKgDosis: [0.15, 0.6], intervalo: 'dosis única', topeDosis: 16, unidad: 'mg' },
  { nombre: 'Salbutamol nebulizado', mgKgDosis: [0.15, 0.15], intervalo: 'c/20 min (crisis)', topeDosis: 5, unidad: 'mg', nota: 'Mínimo 2.5 mg por nebulización aunque el peso calcule menos.' },
  { nombre: 'Ondansetrón', mgKgDosis: [0.15, 0.15], intervalo: 'c/8 h', topeDosis: 8, unidad: 'mg' },
  { nombre: 'Difenhidramina', mgKgDosis: [1, 1], intervalo: 'c/6 h', topeDosis: 50, unidad: 'mg' },
  { nombre: 'Aciclovir', mgKgDosis: [20, 20], intervalo: 'c/6 h', topeDosis: 800, unidad: 'mg' },
  { nombre: 'Omeprazol', mgKgDia: [1, 1], tomas: 1, intervalo: 'c/24 h', topeDia: 40, unidad: 'mg' },
  { nombre: 'Hierro elemental', mgKgDia: [3, 6], tomas: 1, intervalo: 'c/24 h', topeDia: 200, unidad: 'mg', nota: 'Tratamiento de anemia ferropénica; profilaxis 1-2 mg/kg/día.' },
]

export interface DosisCalculada {
  farmaco: string
  /** Rango por toma, ya con tope aplicado. */
  porToma: { min: number; max: number }
  /** Total al día. */
  porDia: { min: number; max: number }
  intervalo: string
  unidad: string
  /** true si el tope de adulto recortó la dosis calculada. */
  topeAplicado: boolean
  nota?: string
}

/** Calcula la dosis pediátrica por peso APLICANDO el tope de adulto. */
export function calcularDosisPediatrica(f: FarmacoPed, pesoKg: number): DosisCalculada | null {
  if (!(pesoKg > 0)) return null
  let minToma: number, maxToma: number, tomas: number
  if (f.mgKgDosis) {
    tomas = f.tomas ?? 1
    minToma = f.mgKgDosis[0] * pesoKg
    maxToma = f.mgKgDosis[1] * pesoKg
  } else if (f.mgKgDia) {
    tomas = f.tomas ?? 1
    minToma = (f.mgKgDia[0] * pesoKg) / tomas
    maxToma = (f.mgKgDia[1] * pesoKg) / tomas
  } else return null

  let topeAplicado = false
  if (f.topeDosis != null) {
    if (maxToma > f.topeDosis) { maxToma = f.topeDosis; topeAplicado = true }
    if (minToma > f.topeDosis) { minToma = f.topeDosis; topeAplicado = true }
  }
  let minDia = minToma * (f.mgKgDosis ? tomasPorIntervalo(f.intervalo) : tomas)
  let maxDia = maxToma * (f.mgKgDosis ? tomasPorIntervalo(f.intervalo) : tomas)
  if (f.topeDia != null) {
    if (maxDia > f.topeDia) { maxDia = f.topeDia; topeAplicado = true }
    if (minDia > f.topeDia) { minDia = f.topeDia; topeAplicado = true }
  }
  const r = (x: number) => Math.round(x * 10) / 10
  return {
    farmaco: f.nombre, intervalo: f.intervalo, unidad: f.unidad, topeAplicado, nota: f.nota,
    porToma: { min: r(minToma), max: r(maxToma) },
    porDia: { min: r(minDia), max: r(maxDia) },
  }
}

/** Tomas/día implícitas en el texto del intervalo (para los que se dosifican por toma). */
function tomasPorIntervalo(intervalo: string): number {
  const m = intervalo.match(/c\/(\d+)/)
  if (m) return Math.max(1, Math.round(24 / Number(m[1])))
  return 1
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ESQUEMA DE VACUNACIÓN (México)
// ═══════════════════════════════════════════════════════════════════════════

export interface Vacuna {
  nombre: string
  /** Edad de aplicación en MESES (0 = al nacer). */
  mes: number
  detalle: string
}

/** Cartilla Nacional de Vacunación (México). Refuerzos y campañas se anotan aparte. */
export const ESQUEMA_MX: Vacuna[] = [
  { nombre: 'BCG', mes: 0, detalle: 'Dosis única al nacer (tuberculosis meníngea).' },
  { nombre: 'Hepatitis B', mes: 0, detalle: '1ª dosis en las primeras 12 h de vida.' },
  { nombre: 'Hepatitis B', mes: 2, detalle: '2ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 2, detalle: '1ª dosis (difteria, tosferina, tétanos, polio, Hib ± hepatitis B).' },
  { nombre: 'Rotavirus', mes: 2, detalle: '1ª dosis (no iniciar después de las 15 semanas).' },
  { nombre: 'Neumocócica conjugada', mes: 2, detalle: '1ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Rotavirus', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Neumocócica conjugada', mes: 4, detalle: '2ª dosis.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 6, detalle: '3ª dosis.' },
  { nombre: 'Hepatitis B', mes: 6, detalle: '3ª dosis.' },
  { nombre: 'Influenza', mes: 6, detalle: 'Desde los 6 meses; la 1ª vez son 2 dosis con 4 semanas de diferencia, luego anual hasta los 59 meses.' },
  { nombre: 'SRP (triple viral)', mes: 12, detalle: '1ª dosis (sarampión, rubéola, parotiditis).' },
  { nombre: 'Neumocócica conjugada', mes: 12, detalle: 'Refuerzo.' },
  { nombre: 'Hexavalente / Pentavalente acelular', mes: 18, detalle: '4ª dosis (refuerzo).' },
  { nombre: 'SRP (triple viral)', mes: 18, detalle: '2ª dosis.' },
  { nombre: 'DPT (refuerzo)', mes: 48, detalle: 'Refuerzo a los 4 años.' },
  { nombre: 'VPH', mes: 132, detalle: 'A los 11 años (5º de primaria); esquema según lineamiento vigente.' },
  { nombre: 'Td (tétanos-difteria)', mes: 144, detalle: 'A los 12 años y refuerzo cada 10 años.' },
]

export interface EstadoVacuna { vacuna: Vacuna; estado: 'aplicada' | 'pendiente' | 'atrasada' }

/**
 * Compara la edad (en meses) contra el esquema y marca lo ATRASADO.
 * `aplicadas` son los nombres+mes ya registrados (clave "nombre@mes").
 */
export function vacunasSegunEdad(edadMeses: number, aplicadas: string[] = []): EstadoVacuna[] {
  const set = new Set(aplicadas)
  return ESQUEMA_MX.map(v => {
    const clave = `${v.nombre}@${v.mes}`
    if (set.has(clave)) return { vacuna: v, estado: 'aplicada' as const }
    // Se considera ATRASADA si ya pasó más de 1 mes de la edad indicada.
    if (edadMeses > v.mes + 1) return { vacuna: v, estado: 'atrasada' as const }
    return { vacuna: v, estado: 'pendiente' as const }
  })
}

/** Edad en meses a partir de la fecha de nacimiento (ISO) y una fecha de corte. */
export function edadEnMeses(fechaNacimientoISO: string, hoyISO: string): number {
  const n = new Date(fechaNacimientoISO), h = new Date(hoyISO)
  if (isNaN(n.getTime()) || isNaN(h.getTime())) return 0
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth())
  if (h.getDate() < n.getDate()) meses--
  return Math.max(0, meses)
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PERCENTILES / Z-SCORE (método LMS de la OMS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * z-score por el método LMS (OMS/CDC):  z = ((X/M)^L − 1) / (L·S)   (L ≠ 0)
 *                                       z = ln(X/M) / S             (L = 0)
 * L, M y S se toman de la tabla de referencia OFICIAL para edad y sexo.
 */
export function zScoreLMS(valor: number, L: number, M: number, S: number): number {
  if (!(valor > 0) || !(M > 0) || !(S > 0)) return NaN
  const z = L === 0 ? Math.log(valor / M) / S : (Math.pow(valor / M, L) - 1) / (L * S)
  const r = Math.round(z * 100) / 100
  return r === 0 ? 0 : r      // evita el "-0" al caer justo en la mediana
}

/** Percentil a partir del z-score (función de distribución normal acumulada). */
export function percentilDeZ(z: number): number {
  if (!isFinite(z)) return NaN
  // Aproximación de Abramowitz & Stegun (error < 7.5e-8).
  const b = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429]
  const p = 0.2316419, c = 0.39894228
  const x = Math.abs(z)
  const t = 1 / (1 + p * x)
  const poly = t * (b[0] + t * (b[1] + t * (b[2] + t * (b[3] + t * b[4]))))
  const nd = c * Math.exp(-x * x / 2) * poly
  const acum = z >= 0 ? 1 - nd : nd
  return Math.round(acum * 1000) / 10   // en %
}

/** Clasificación nutricional de la OMS por z-score de peso/talla o IMC/edad. */
export function clasificarZ(z: number): { etiqueta: string; nivel: 'bajo' | 'normal' | 'alto' } {
  if (!isFinite(z)) return { etiqueta: 'Sin datos suficientes', nivel: 'normal' }
  if (z < -3) return { etiqueta: 'Desnutrición severa (z < −3)', nivel: 'bajo' }
  if (z < -2) return { etiqueta: 'Desnutrición moderada (z −3 a −2)', nivel: 'bajo' }
  if (z < -1) return { etiqueta: 'Riesgo de desnutrición (z −2 a −1)', nivel: 'bajo' }
  if (z <= 1) return { etiqueta: 'Normal (z −1 a +1)', nivel: 'normal' }
  if (z <= 2) return { etiqueta: 'Riesgo de sobrepeso (z +1 a +2)', nivel: 'alto' }
  if (z <= 3) return { etiqueta: 'Sobrepeso (z +2 a +3)', nivel: 'alto' }
  return { etiqueta: 'Obesidad (z > +3)', nivel: 'alto' }
}

/** IMC pediátrico (se interpreta SIEMPRE por percentil/z para edad y sexo, no por cortes de adulto). */
export function imc(pesoKg: number, tallaCm: number): number {
  if (!(pesoKg > 0) || !(tallaCm > 0)) return NaN
  const m = tallaCm / 100
  return Math.round((pesoKg / (m * m)) * 10) / 10
}
