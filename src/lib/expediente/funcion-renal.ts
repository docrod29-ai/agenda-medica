/**
 * Función renal y ajuste de dosis de antimicrobianos — núcleo de PROA.
 *
 * Para infectología es diario: la dosis de vancomicina, meropenem, TMP-SMX,
 * fluconazol, etc. depende de la depuración del paciente. Este módulo:
 *   1. Calcula la TFG con CKD-EPI 2021 (no requiere peso) y, si hay peso,
 *      la depuración de creatinina con Cockcroft-Gault (la que usan las
 *      etiquetas de fármacos para ajuste).
 *   2. Clasifica el estadio KDIGO.
 *   3. Revisa los fármacos prescritos contra umbrales de ajuste renal y
 *      devuelve alertas accionables.
 *
 * Apoyo decisional. No sustituye el juicio del médico ni la consulta de
 * fuentes primarias (Sanford, ficha técnica, infectólogo de cabecera).
 */

import type { ClinicalQuantity } from '@/types/clinical-quantity'
import { cantidad, valorEn } from '@/types/clinical-quantity'

export type Sexo = 'Masculino' | 'Femenino' | 'Otro' | undefined

/**
 * Creatinina sérica: concentración de MASA (mg/dL, g/dL, mg/L, µg/mL).
 *
 * E0-05 — ES LA ACEPTACIÓN DE LA UNIDAD. µmol/L vive en `concentracion_sustancia`,
 * que es otra dimensión: pasarla aquí NO COMPILA. Hasta hoy la única defensa era
 * `creatininaPlausibleMgDl` (guarda de RANGO en runtime), que se conserva porque
 * sigue siendo la única que atrapa un valor que ES µmol/L pero viene ETIQUETADO
 * mg/dL — eso ningún sistema de tipos lo ve.
 */
export type CreatininaSerica = ClinicalQuantity<'concentracion_masa'>

/**
 * Depuración usada para dosificar, CON SU PROCEDENCIA.
 *
 * No puede ser un solo ClinicalQuantity: 'depuracion' (mL/min, Cockcroft-Gault) y
 * 'depuracion_indexada' (mL/min/1.73 m², CKD-EPI) son dimensiones SEPARADAS —no
 * existe factor entre ellas sin la superficie corporal del paciente— y el antiguo
 * `depuracionParaDosis: number` las mezclaba en un mismo campo (`crcl ?? egfr`).
 * La unión discriminada NO cambia el comportamiento: lo hace visible.
 */
export type DepuracionParaDosis =
  | { base: 'cockcroft-gault'; q: ClinicalQuantity<'depuracion'> }
  | { base: 'ckd-epi';         q: ClinicalQuantity<'depuracion_indexada'> }

export interface ResultadoRenal {
  /** null = no calculada (antes era NaN, que sí podía colarse en una resta). */
  egfrCkdEpi: ClinicalQuantity<'depuracion_indexada'> | null
  crClCockcroft: ClinicalQuantity<'depuracion'> | null // null si no hay peso
  estadio: string             // G1–G5 (KDIGO)
  estadioDesc: string
  /** Valor recomendado para dosificar (Cockcroft si hay peso; si no, CKD-EPI). */
  depuracionParaDosis: DepuracionParaDosis | null
  /**
   * true en <18 años: CKD-EPI/Cockcroft son de adultos y NO aplican. El valor no
   * debe usarse para ajustar dosis ni escribirse en la nota. Auditoría 2026-07.
   */
  noAplicablePorEdad?: boolean
  /**
   * true si la creatinina es implausible en mg/dL (≤0 o por encima del techo
   * fisiológico) → probable error de UNIDAD (µmol/L: normal ~60–110) o de dedo.
   * No se calcula una TFG falsa. Guarda de SOFTWARE (L4 auditoría maestra); no
   * cambia la fórmula ni los umbrales clínicos.
   */
  datoImplausible?: boolean
}

/**
 * Techo fisiológico de creatinina sérica en mg/dL. Falla renal severa llega a
 * ~15–20; por encima de esto casi siempre es un valor en µmol/L (÷88.4) o un
 * typo. Es una guarda de VALIDACIÓN DE UNIDAD, no un umbral clínico de decisión.
 */
export const CREAT_MGDL_MAX = 25
export const CREAT_MGDL_MIN = 0.1

/**
 * ¿La creatinina es plausible EN mg/dL? Fuera de [0.1, 25] casi siempre es un valor
 * en µmol/L (p.ej. 88) o un typo → estimar TFG con eso daría falla renal fantasma.
 * Cualquier caller que use ckdEpi2021 crudo DEBE filtrar con esto antes (auditoría P0).
 */
export const creatininaPlausibleMgDl = (cr: unknown): boolean =>
  typeof cr === 'number' && Number.isFinite(cr) && cr >= CREAT_MGDL_MIN && cr <= CREAT_MGDL_MAX

/**
 * CKD-EPI 2021 (sin coeficiente de raza). Scr en mg/dL.
 * eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^-1.200 × 0.9938^edad × (1.012 si mujer)
 */
export function ckdEpi2021(
  creatinina: CreatininaSerica, edad: number, sexo: Sexo | boolean,
): ClinicalQuantity<'depuracion_indexada'> {
  // E0-05: la unidad se NOMBRA aquí y muere el bug de la creatinina en µmol/L. La
  // aritmética de abajo NO cambia ni un carácter — el número que sale es el mismo.
  const creat = valorEn(creatinina, 'mg/dL')
  // FUENTE DE VERDAD ÚNICA de CKD-EPI 2021 (decisión del Dr, L6). Ecuación canónica
  // sin raza (NKF), creatinina en mg/dL. Devuelve PRECISIÓN COMPLETA — el redondeo
  // corresponde a la capa de presentación; un Math.round interno podía cambiar
  // clasificaciones, comparaciones o cálculos posteriores. Acepta Sexo o booleano
  // (esMujer) para servir a todos los llamadores (antes había un duplicado).
  const mujer = sexo === true || sexo === 'Femenino'
  const scr = Math.max(creat, 0.01)   // guarda anti-división por cero (no altera valores válidos)
  const k = mujer ? 0.7 : 0.9
  const a = mujer ? -0.241 : -0.302
  const r = scr / k
  const egfr = 142
    * Math.pow(Math.min(r, 1), a)
    * Math.pow(Math.max(r, 1), -1.200)
    * Math.pow(0.9938, edad)
    * (mujer ? 1.012 : 1)
  return cantidad(egfr, 'mL/min/1.73m²', 'depuracion_indexada')
}

/**
 * Cockcroft-Gault. Scr en mg/dL, peso en kg.
 * CrCl = (140-edad) × peso × (0.85 si mujer) / (72 × Scr)
 */
export function cockcroftGault(
  creatinina: CreatininaSerica, edad: number, sexo: Sexo, peso: ClinicalQuantity<'masa'>,
): ClinicalQuantity<'depuracion'> {
  // E0-05: peso en kg y creatinina en mg/dL se NOMBRAN aquí; el peso ya no puede
  // llegar en gramos (ni un volumen colarse en su lugar). Aritmética intacta.
  const creat = valorEn(creatinina, 'mg/dL')
  const pesoKg = valorEn(peso, 'kg')
  const mujer = sexo === 'Femenino'
  const crcl = ((140 - edad) * pesoKg * (mujer ? 0.85 : 1)) / (72 * creat)
  return cantidad(Math.round(crcl), 'mL/min', 'depuracion')
}

/** Estadio KDIGO de enfermedad renal por TFG. */
export function clasificarTFG(egfr: number): { estadio: string; desc: string } {
  // Guard de finitud (auditoría P1): un TFG NaN/∞/negativo NO debe clasificarse como
  // 'G5 Falla renal' por caer al final de la cascada — sería fabricar el peor
  // estadio a partir de un dato inválido. Se devuelve indeterminado.
  if (!Number.isFinite(egfr) || egfr < 0) return { estadio: '—', desc: 'TFG no disponible' }
  if (egfr >= 90) return { estadio: 'G1', desc: 'Normal o alta' }
  if (egfr >= 60) return { estadio: 'G2', desc: 'Levemente disminuida' }
  if (egfr >= 45) return { estadio: 'G3a', desc: 'Leve-moderada' }
  if (egfr >= 30) return { estadio: 'G3b', desc: 'Moderada-grave' }
  if (egfr >= 15) return { estadio: 'G4', desc: 'Grave' }
  return { estadio: 'G5', desc: 'Falla renal' }
}

export function evaluarFuncionRenal(
  creatinina: CreatininaSerica, edad: number, sexo: Sexo, peso?: ClinicalQuantity<'masa'>,
): ResultadoRenal {
  // Reja de edad — CKD-EPI y Cockcroft son de adultos (auditoría 2026-07).
  if (edad != null && edad < 18) {
    return {
      egfrCkdEpi: null, crClCockcroft: null,
      estadio: '—', estadioDesc: 'En menores de 18 años la TFG se estima con la fórmula de Schwartz (usa la talla); CKD-EPI/Cockcroft no aplican.',
      depuracionParaDosis: null, noAplicablePorEdad: true,
    }
  }
  // Guarda de UNIDAD/plausibilidad (L4): una creatinina fuera de [0.1, 25] mg/dL
  // no se calcula — daría una TFG absurda (un 80 en µmol/L → TFG ~0; un 0 → ∞).
  // E0-05: el TIPO ya impide que llegue una µmol/L etiquetada como tal; esta guarda
  // sigue viva porque atrapa el caso que el tipo NO ve — un valor que ES µmol/L
  // pero viene ETIQUETADO mg/dL desde el laboratorio. Defensa en profundidad.
  const creatMgDl = valorEn(creatinina, 'mg/dL')
  if (!Number.isFinite(creatMgDl) || creatMgDl < CREAT_MGDL_MIN || creatMgDl > CREAT_MGDL_MAX) {
    return {
      egfrCkdEpi: null, crClCockcroft: null,
      estadio: '—', estadioDesc: `Creatinina ${creatMgDl} fuera del rango posible en mg/dL (${CREAT_MGDL_MIN}–${CREAT_MGDL_MAX}); revisa la unidad (¿µmol/L?) o el valor antes de estimar la TFG.`,
      depuracionParaDosis: null, datoImplausible: true,
    }
  }
  const egfr = ckdEpi2021(creatinina, edad, sexo)
  const pesoKg = peso ? valorEn(peso, 'kg') : 0
  const crcl = peso && pesoKg > 0 ? cockcroftGault(creatinina, edad, sexo, peso) : null
  const { estadio, desc } = clasificarTFG(valorEn(egfr, 'mL/min/1.73m²'))
  return {
    egfrCkdEpi: egfr,
    crClCockcroft: crcl,
    estadio,
    estadioDesc: desc,
    // Cockcroft preferido para dosis. La procedencia deja de perderse (E0-05).
    depuracionParaDosis: crcl
      ? { base: 'cockcroft-gault', q: crcl }
      : { base: 'ckd-epi', q: egfr },
  }
}

// ─────────────────────────────────────────────────────────────────
// Ajuste renal de fármacos (umbrales en mL/min). Enfoque PROA.
// ─────────────────────────────────────────────────────────────────

interface ReglaRenal {
  terminos: string[]
  umbral: number          // por debajo de este CrCl, alertar
  mensaje: (crcl: number) => string
  severidad: 'ajuste' | 'evitar'
}

const REGLAS_RENALES: ReglaRenal[] = [
  { terminos: ['vancomicina'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Vancomicina con CrCl ${c}: ajustar por nivel sérico (vancocinemia, objetivo AUC 400-600). Espaciar intervalo.` },
  { terminos: ['meropenem'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Meropenem con CrCl ${c}: reducir dosis/intervalo (CrCl 25-50: 1g c/12h; <25: 500mg-1g c/12-24h).` },
  { terminos: ['ertapenem'], umbral: 30, severidad: 'ajuste',
    mensaje: (c) => `Ertapenem con CrCl ${c} (<30): reducir a 500 mg/día.` },
  { terminos: ['piperacilina', 'tazobactam', 'tazocin'], umbral: 40, severidad: 'ajuste',
    mensaje: (c) => `Piperacilina/tazobactam con CrCl ${c}: ajustar (CrCl 20-40: 3.375g c/6h; <20: c/8h).` },
  { terminos: ['cefepime'], umbral: 60, severidad: 'ajuste',
    mensaje: (c) => `Cefepime con CrCl ${c}: ajustar intervalo. Riesgo de neurotoxicidad si no se ajusta.` },
  { terminos: ['ceftazidima'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Ceftazidima con CrCl ${c}: espaciar intervalo según depuración.` },
  { terminos: ['levofloxacino'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Levofloxacino con CrCl ${c}: ajustar (CrCl 20-49: mitad de dosis tras carga).` },
  { terminos: ['ciprofloxacino'], umbral: 30, severidad: 'ajuste',
    mensaje: (c) => `Ciprofloxacino con CrCl ${c} (<30): reducir dosis ~50%.` },
  { terminos: ['trimetoprim', 'sulfametoxazol', 'tmp', 'smx', 'bactrim', 'septrim'], umbral: 30, severidad: 'ajuste',
    mensaje: (c) => `TMP-SMX con CrCl ${c}: CrCl 15-30 reducir 50%; <15 evitar. Vigilar potasio y creatinina.` },
  { terminos: ['fluconazol'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Fluconazol con CrCl ${c} (<50): reducir 50% tras dosis de carga.` },
  { terminos: ['aciclovir', 'valaciclovir', 'ganciclovir', 'valganciclovir'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Antiviral con CrCl ${c}: ajuste obligatorio (riesgo de neuro/nefrotoxicidad, sobre todo IV). Hidratar.` },
  { terminos: ['gentamicina', 'amikacina', 'tobramicina'], umbral: 60, severidad: 'ajuste',
    mensaje: (c) => `Aminoglucósido con CrCl ${c}: ajustar por niveles séricos y espaciar. Nefro/ototóxico.` },
  { terminos: ['colistina', 'colistimetato', 'polimixina'], umbral: 50, severidad: 'ajuste',
    mensaje: (c) => `Colistina con CrCl ${c}: ajuste por depuración y peso. Alta nefrotoxicidad — monitoreo estrecho.` },
  { terminos: ['gabapentina', 'pregabalina', 'lyrica'], umbral: 60, severidad: 'ajuste',
    mensaje: (c) => `Gabapentinoide con CrCl ${c}: ajustar dosis (acumulación → sedación, mareo).` },
  { terminos: ['nitrofurantoina'], umbral: 30, severidad: 'evitar',
    mensaje: (c) => `Nitrofurantoína con CrCl ${c} (<30): EVITAR — ineficaz en orina y riesgo de toxicidad.` },
  { terminos: ['metformina'], umbral: 30, severidad: 'evitar',
    mensaje: (c) => `Metformina con CrCl ${c} (<30): contraindicada (acidosis láctica). 30-45: no iniciar, reducir si ya la toma.` },
  // Auditoría 2026-07 (validado por el Dr): la regla solo daba la dosis de
  // TRATAMIENTO. En PROFILAXIS con CrCl<30 NO se suspende: se reduce a 20 mg SC
  // c/24h (Clexane MX). Se explicitan los dos escenarios.
  { terminos: ['enoxaparina'], umbral: 30, severidad: 'ajuste',
    mensaje: (c) => `Enoxaparina con CrCl ${c} (<30): tratamiento → reducir a 1 mg/kg c/24h; profilaxis → reducir a 20 mg SC c/24h (NO suspender). Alternativa: HNF con anti-Xa. Usa la depuración de creatinina, no la TFG indexada.` },
  { terminos: ['dabigatran', 'rivaroxaban', 'apixaban', 'edoxaban'], umbral: 30, severidad: 'ajuste',
    mensaje: (c) => `Anticoagulante oral directo con CrCl ${c}: ajustar o contraindicado según el fármaco. Revisar ficha técnica.` },
]

export interface AlertaRenal {
  farmaco: string
  severidad: 'ajuste' | 'evitar'
  mensaje: string
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Revisa los medicamentos contra los umbrales renales dada la depuración.
 *
 * E0-05: `dep` ya no es un `number` anónimo — trae su base (Cockcroft o CKD-EPI)
 * y su unidad. Los umbrales de REGLAS_RENALES están en mL/min y NO cambian; los
 * mensajes reciben exactamente el mismo número que hoy (la pregunta de si debe
 * advertirse cuando la base es la TFG indexada es Q2, decisión del médico).
 */
export function ajusteRenalFarmacos(
  medicamentos: { nombre?: string }[], dep: DepuracionParaDosis,
): AlertaRenal[] {
  const crcl = dep.base === 'cockcroft-gault'
    ? valorEn(dep.q, 'mL/min')
    : valorEn(dep.q, 'mL/min/1.73m²')
  const alertas: AlertaRenal[] = []
  for (const m of medicamentos) {
    const n = norm(m.nombre ?? '')
    if (!n) continue
    for (const r of REGLAS_RENALES) {
      if (crcl < r.umbral && r.terminos.some(t => n.includes(t))) {
        alertas.push({ farmaco: m.nombre ?? '', severidad: r.severidad, mensaje: r.mensaje(crcl) })
        break
      }
    }
  }
  return alertas
}
