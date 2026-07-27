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

export type Sexo = 'Masculino' | 'Femenino' | 'Otro' | undefined

export interface ResultadoRenal {
  egfrCkdEpi: number          // mL/min/1.73m²
  crClCockcroft: number | null // mL/min (null si no hay peso)
  estadio: string             // G1–G5 (KDIGO)
  estadioDesc: string
  /** Valor recomendado para dosificar (Cockcroft si hay peso; si no, CKD-EPI). */
  depuracionParaDosis: number
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
 * CKD-EPI 2021 (sin coeficiente de raza). Scr en mg/dL.
 * eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^-1.200 × 0.9938^edad × (1.012 si mujer)
 */
export function ckdEpi2021(creatinina: number, edad: number, sexo: Sexo | boolean): number {
  // FUENTE DE VERDAD ÚNICA de CKD-EPI 2021 (decisión del Dr, L6). Ecuación canónica
  // sin raza (NKF), creatinina en mg/dL. Devuelve PRECISIÓN COMPLETA — el redondeo
  // corresponde a la capa de presentación; un Math.round interno podía cambiar
  // clasificaciones, comparaciones o cálculos posteriores. Acepta Sexo o booleano
  // (esMujer) para servir a todos los llamadores (antes había un duplicado).
  const mujer = sexo === true || sexo === 'Femenino'
  const scr = Math.max(creatinina, 0.01)   // guarda anti-división por cero (no altera valores válidos)
  const k = mujer ? 0.7 : 0.9
  const a = mujer ? -0.241 : -0.302
  const r = scr / k
  return 142
    * Math.pow(Math.min(r, 1), a)
    * Math.pow(Math.max(r, 1), -1.200)
    * Math.pow(0.9938, edad)
    * (mujer ? 1.012 : 1)
}

/**
 * Cockcroft-Gault. Scr en mg/dL, peso en kg.
 * CrCl = (140-edad) × peso × (0.85 si mujer) / (72 × Scr)
 */
export function cockcroftGault(creatinina: number, edad: number, sexo: Sexo, pesoKg: number): number {
  const mujer = sexo === 'Femenino'
  const crcl = ((140 - edad) * pesoKg * (mujer ? 0.85 : 1)) / (72 * creatinina)
  return Math.round(crcl)
}

/** Estadio KDIGO de enfermedad renal por TFG. */
export function clasificarTFG(egfr: number): { estadio: string; desc: string } {
  if (egfr >= 90) return { estadio: 'G1', desc: 'Normal o alta' }
  if (egfr >= 60) return { estadio: 'G2', desc: 'Levemente disminuida' }
  if (egfr >= 45) return { estadio: 'G3a', desc: 'Leve-moderada' }
  if (egfr >= 30) return { estadio: 'G3b', desc: 'Moderada-grave' }
  if (egfr >= 15) return { estadio: 'G4', desc: 'Grave' }
  return { estadio: 'G5', desc: 'Falla renal' }
}

export function evaluarFuncionRenal(
  creatinina: number, edad: number, sexo: Sexo, pesoKg?: number,
): ResultadoRenal {
  // Reja de edad — CKD-EPI y Cockcroft son de adultos (auditoría 2026-07).
  if (edad != null && edad < 18) {
    return {
      egfrCkdEpi: NaN, crClCockcroft: null,
      estadio: '—', estadioDesc: 'En menores de 18 años la TFG se estima con la fórmula de Schwartz (usa la talla); CKD-EPI/Cockcroft no aplican.',
      depuracionParaDosis: NaN, noAplicablePorEdad: true,
    }
  }
  // Guarda de UNIDAD/plausibilidad (L4): una creatinina fuera de [0.1, 25] mg/dL
  // no se calcula — daría una TFG absurda (un 80 en µmol/L → TFG ~0; un 0 → ∞).
  if (!Number.isFinite(creatinina) || creatinina < CREAT_MGDL_MIN || creatinina > CREAT_MGDL_MAX) {
    return {
      egfrCkdEpi: NaN, crClCockcroft: null,
      estadio: '—', estadioDesc: `Creatinina ${creatinina} fuera del rango posible en mg/dL (${CREAT_MGDL_MIN}–${CREAT_MGDL_MAX}); revisa la unidad (¿µmol/L?) o el valor antes de estimar la TFG.`,
      depuracionParaDosis: NaN, datoImplausible: true,
    }
  }
  const egfr = ckdEpi2021(creatinina, edad, sexo)
  const crcl = pesoKg && pesoKg > 0 ? cockcroftGault(creatinina, edad, sexo, pesoKg) : null
  const { estadio, desc } = clasificarTFG(egfr)
  return {
    egfrCkdEpi: egfr,
    crClCockcroft: crcl,
    estadio,
    estadioDesc: desc,
    depuracionParaDosis: crcl ?? egfr,  // Cockcroft preferido para dosis
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

/** Revisa los medicamentos contra los umbrales renales dada la depuración. */
export function ajusteRenalFarmacos(
  medicamentos: { nombre?: string }[], crcl: number,
): AlertaRenal[] {
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
