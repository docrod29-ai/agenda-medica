import type { ClinicalQuantity } from '@/types/clinical-quantity'
import { cantidad, valorEn } from '@/types/clinical-quantity'
/**
 * MOTOR DE INFUSIONES CONTINUAS (vasopresores / inotrópicos / vasodilatadores) — ICU OS.
 *
 * Convierte DETERMINÍSTICAMENTE entre DOSIS (µg/kg/min, µg/min o U/min según el
 * fármaco) y VELOCIDAD DE INFUSIÓN (mL/h), en ambos sentidos, sabiendo la
 * CONCENTRACIÓN de la dilución. Trae un catálogo con las diluciones estándar de
 * cada fármaco, así el médico solo elige el fármaco (y el peso) y el sistema ya
 * sabe la concentración. Si falta peso (en fármacos por kg) o concentración, BLOQUEA.
 *
 * Fórmulas:
 *   por kg:   mL/h = dosis(µg/kg/min) · peso(kg) · 60 / conc(µg/mL)
 *             dosis = mL/h · conc(µg/mL) / (60 · peso)
 *   por min:  mL/h = dosis(µg/min o U/min) · 60 / conc(µg/mL o U/mL)
 *             dosis = mL/h · conc / 60
 *   conc(µg/mL) = mg_en_bolsa · 1000 / mL_bolsa   (para U: U_en_bolsa / mL_bolsa)
 */

export const INFUSIONES_VERSION = '1.0.0'

const r = (x: number, d = 2) => { const f = 10 ** d; return Math.round(x * f) / f }

// Unidades soportadas por la conversión (todas por-minuto). No se incluye 'µg/kg/h'
// hasta que la conversión tenga la rama de tiempo por hora (ningún fármaco la usa).
export type UnidadDosis = 'µg/kg/min' | 'µg/min' | 'U/min'

export interface Dilucion { label: string; mgOU: number; mlBolsa: number; concentracion: number; unidadConc: 'µg/mL' | 'U/mL' }
export interface Farmaco {
  key: string
  nombre: string
  unidad: UnidadDosis
  porKg: boolean
  unidadConc: 'µg/mL' | 'U/mL'
  diluciones: Dilucion[]     // la 1ª es la estándar/predeterminada
  rango?: [number, number]   // rango habitual de dosis (para advertir)
  nota?: string
}

/** Construye una dilución calculando su concentración. `esU` para vasopresina. */
function dil(label: string, mgOU: number, mlBolsa: number, esU = false): Dilucion {
  const concentracion = esU ? r(mgOU / mlBolsa, 4) : r((mgOU * 1000) / mlBolsa, 2)
  return { label, mgOU, mlBolsa, concentracion, unidadConc: esU ? 'U/mL' : 'µg/mL' }
}

/** Catálogo con diluciones ESTÁNDAR frecuentes (México / literatura). */
export const CATALOGO_INFUSIONES: Farmaco[] = [
  { key: 'norepinefrina', nombre: 'Norepinefrina', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('4 mg / 250 mL', 4, 250), dil('8 mg / 250 mL', 8, 250), dil('16 mg / 250 mL', 16, 250)], rango: [0.01, 3] },
  { key: 'epinefrina', nombre: 'Epinefrina (adrenalina)', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('4 mg / 250 mL', 4, 250), dil('8 mg / 250 mL', 8, 250)], rango: [0.01, 0.5] },
  { key: 'dopamina', nombre: 'Dopamina', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('400 mg / 250 mL', 400, 250), dil('800 mg / 250 mL', 800, 250)], rango: [2, 20] },
  { key: 'dobutamina', nombre: 'Dobutamina', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('500 mg / 250 mL', 500, 250), dil('250 mg / 250 mL', 250, 250)], rango: [2, 20] },
  { key: 'vasopresina', nombre: 'Vasopresina', unidad: 'U/min', porKg: false, unidadConc: 'U/mL',
    diluciones: [dil('20 U / 100 mL', 20, 100, true), dil('40 U / 100 mL', 40, 100, true)], rango: [0.01, 0.04], nota: 'Suele usarse fija (0.03–0.04 U/min); no titular por presión.' },
  { key: 'levosimendan', nombre: 'Levosimendán', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('12.5 mg / 500 mL', 12.5, 500), dil('12.5 mg / 250 mL', 12.5, 250)], rango: [0.05, 0.2], nota: 'Infusión 24 h; carga opcional 6–12 µg/kg en 10 min (a menudo se omite si hipotenso).' },
  { key: 'milrinona', nombre: 'Milrinona', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('20 mg / 100 mL', 20, 100), dil('40 mg / 200 mL', 40, 200)], rango: [0.375, 0.75], nota: 'Ajustar en falla renal.' },
  { key: 'fenilefrina', nombre: 'Fenilefrina', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('10 mg / 100 mL', 10, 100), dil('50 mg / 250 mL', 50, 250)], rango: [0.1, 5] },
  { key: 'nitroglicerina', nombre: 'Nitroglicerina', unidad: 'µg/min', porKg: false, unidadConc: 'µg/mL',
    diluciones: [dil('50 mg / 250 mL', 50, 250), dil('50 mg / 500 mL', 50, 500)], rango: [5, 200] },
  { key: 'nitroprusiato', nombre: 'Nitroprusiato', unidad: 'µg/kg/min', porKg: true, unidadConc: 'µg/mL',
    diluciones: [dil('50 mg / 250 mL', 50, 250)], rango: [0.3, 10], nota: 'Proteger de la luz; riesgo de cianuro en infusión prolongada/dosis alta.' },
]
export const farmacoPorKey = (k: string): Farmaco | undefined => CATALOGO_INFUSIONES.find(f => f.key === k)

/**
 * E0-05 — la dosis de una infusión vive en TRES dimensiones distintas y no hay
 * puente entre ellas (decisión D3 de E0-04): µg/kg/min necesita el peso, U/min
 * mide actividad biológica y su equivalencia en masa depende del fármaco.
 */
export type DosisInfusion =
  | ClinicalQuantity<'tasa_dosis_peso'>    // µg/kg/min
  | ClinicalQuantity<'tasa_dosis'>         // µg/min
  | ClinicalQuantity<'tasa_actividad'>     // U/min

/** Concentración de la bolsa: masa (µg/mL) o actividad (U/mL). Nunca la misma cosa. */
export type ConcentracionInfusion =
  | ClinicalQuantity<'concentracion_masa'>
  | ClinicalQuantity<'concentracion_actividad'>

export interface ResultadoInfusion {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  /** E0-05: `unidadDosis` desapareció — la unidad ya viaja DENTRO de la cantidad. */
  dosis: DosisInfusion | null
  rateMlH: ClinicalQuantity<'tasa_volumen'> | null
  /** E0-05: `unidadConc` desapareció por el mismo motivo. */
  concentracion: ConcentracionInfusion | null
  advertencias: string[]
  interpretacion: string
}

const bloq = (motivo: string): ResultadoInfusion => ({ ok: false, bloqueado: true, motivoBloqueo: motivo, dosis: null, rateMlH: null, concentracion: null, advertencias: [], interpretacion: '' })

interface Entrada { farmacoKey?: string; pesoKg?: ClinicalQuantity<'masa'> | null; concentracion?: ConcentracionInfusion | null; dilucionIdx?: number }

/**
 * Concentración del fármaco COMO CANTIDAD, en la unidad que ese fármaco usa.
 * Se construye aquí (y no en el catálogo) para no tocar `Dilucion`, que es
 * puramente de presentación en el selector de diluciones.
 */
function concComoCantidad(farmaco: Farmaco, conc: number): ConcentracionInfusion {
  return farmaco.unidadConc === 'U/mL'
    ? cantidad(conc, 'U/mL', 'concentracion_actividad')
    : cantidad(conc, 'µg/mL', 'concentracion_masa')
}

/**
 * Número de la dosis EN LA UNIDAD DEL FÁRMACO. Devuelve null si la cantidad no
 * pertenece a la dimensión de ese fármaco (p.ej. µg/min para norepinefrina, que
 * se dosifica por kg): eso ya no se convierte en silencio, BLOQUEA.
 */
function dosisEnUnidadDelFarmaco(q: DosisInfusion, u: UnidadDosis): number | null {
  if (u === 'µg/kg/min' && q.dimension === 'tasa_dosis_peso') return valorEn(q, 'µg/kg/min')
  if (u === 'µg/min' && q.dimension === 'tasa_dosis') return valorEn(q, 'µg/min')
  if (u === 'U/min' && q.dimension === 'tasa_actividad') return valorEn(q, 'U/min')
  return null
}

/** Concentración en la unidad del fármaco; null si la dimensión no corresponde. */
function concEnUnidadDelFarmaco(q: ConcentracionInfusion, u: 'µg/mL' | 'U/mL'): number | null {
  if (u === 'U/mL' && q.dimension === 'concentracion_actividad') return valorEn(q, 'U/mL')
  if (u === 'µg/mL' && q.dimension === 'concentracion_masa') return valorEn(q, 'µg/mL')
  return null
}

function resolver(e: Entrada): { farmaco: Farmaco; peso: number | null; conc: number } | ResultadoInfusion {
  const farmaco = e.farmacoKey ? farmacoPorKey(e.farmacoKey) : undefined
  if (!farmaco) return bloq('Elige un fármaco del catálogo')
  // E0-05: una concentración en U/mL para un fármaco que se mide en µg/mL (o al
  // revés) ya no se cuela como si fuera el mismo número.
  const concCustom = e.concentracion != null ? concEnUnidadDelFarmaco(e.concentracion, farmaco.unidadConc) : null
  if (e.concentracion != null && concCustom === null) {
    return bloq(`La concentración capturada no está en ${farmaco.unidadConc} (${farmaco.nombre})`)
  }
  const conc = concCustom ?? farmaco.diluciones[e.dilucionIdx ?? 0]?.concentracion ?? farmaco.diluciones[0].concentracion
  if (conc === null || conc <= 0) return bloq('Falta la concentración de la dilución')
  const peso = e.pesoKg != null ? valorEn(e.pesoKg, 'kg') : null
  // peso ≤ 0 (num('0')=0) NO es válido: rateADosis dividiría entre 0 → dosis Infinity
  // mostrada como cálculo válido al intensivista (auditoría P1).
  if (farmaco.porKg && (peso === null || peso <= 0)) return bloq(`Falta el peso válido (${farmaco.nombre} se dosifica por kg)`)
  return { farmaco, peso, conc }
}

/** Reconstruye la dosis como cantidad en la unidad (y dimensión) del fármaco. */
function dosisComoCantidad(farmaco: Farmaco, dosis: number): DosisInfusion {
  return farmaco.unidad === 'µg/kg/min' ? cantidad(dosis, 'µg/kg/min', 'tasa_dosis_peso')
    : farmaco.unidad === 'U/min' ? cantidad(dosis, 'U/min', 'tasa_actividad')
    : cantidad(dosis, 'µg/min', 'tasa_dosis')
}

function advertenciaRango(farmaco: Farmaco, dosis: number): string[] {
  if (!farmaco.rango) return []
  const [lo, hi] = farmaco.rango
  if (dosis > hi) return [`Dosis ${r(dosis, 3)} ${farmaco.unidad} por ENCIMA del rango habitual (${lo}–${hi}); verifica.`]
  if (dosis > 0 && dosis < lo) return [`Dosis ${r(dosis, 3)} ${farmaco.unidad} por debajo del rango habitual (${lo}–${hi}).`]
  return []
}

/** DOSIS → velocidad de infusión (mL/h). */
export function dosisARate(e: Entrada & { dosis?: DosisInfusion | null }): ResultadoInfusion {
  const rr = resolver(e); if ('ok' in rr && rr.bloqueado) return rr as ResultadoInfusion
  const { farmaco, peso, conc } = rr as { farmaco: Farmaco; peso: number | null; conc: number }
  if (e.dosis == null) return bloq('Falta la dosis')
  const dosis = dosisEnUnidadDelFarmaco(e.dosis, farmaco.unidad)
  if (dosis === null) return bloq(`La dosis no está en ${farmaco.unidad} (${farmaco.nombre})`)
  // Aritmética INTACTA (los pasos intermedios siguen siendo `number`: el tipo
  // protege entradas y salidas, no las dimensiones derivadas — DISENO §3.1).
  const rate = farmaco.porKg ? (dosis * (peso as number) * 60) / conc : (dosis * 60) / conc
  return {
    ok: true, bloqueado: false, motivoBloqueo: null,
    dosis: dosisComoCantidad(farmaco, dosis),
    rateMlH: cantidad(r(rate, 1), 'mL/h', 'tasa_volumen'),
    concentracion: concComoCantidad(farmaco, conc),
    advertencias: advertenciaRango(farmaco, dosis),
    interpretacion: `${farmaco.nombre} ${dosis} ${farmaco.unidad}${farmaco.porKg ? ` (peso ${peso} kg)` : ''} · conc ${conc} ${farmaco.unidadConc} → ${r(rate, 1)} mL/h`,
  }
}

/** Velocidad de infusión (mL/h) → DOSIS. */
export function rateADosis(e: Entrada & { rateMlH?: ClinicalQuantity<'tasa_volumen'> | null }): ResultadoInfusion {
  const rr = resolver(e); if ('ok' in rr && rr.bloqueado) return rr as ResultadoInfusion
  const { farmaco, peso, conc } = rr as { farmaco: Farmaco; peso: number | null; conc: number }
  if (e.rateMlH == null) return bloq('Falta la velocidad de infusión (mL/h)')
  const rate = valorEn(e.rateMlH, 'mL/h')
  const dosis = farmaco.porKg ? (rate * conc) / (60 * (peso as number)) : (rate * conc) / 60
  return {
    ok: true, bloqueado: false, motivoBloqueo: null,
    dosis: dosisComoCantidad(farmaco, r(dosis, 3)),
    rateMlH: cantidad(rate, 'mL/h', 'tasa_volumen'),
    concentracion: concComoCantidad(farmaco, conc),
    advertencias: advertenciaRango(farmaco, dosis),
    interpretacion: `${farmaco.nombre} ${rate} mL/h · conc ${conc} ${farmaco.unidadConc}${farmaco.porKg ? ` (peso ${peso} kg)` : ''} → ${r(dosis, 3)} ${farmaco.unidad}`,
  }
}
