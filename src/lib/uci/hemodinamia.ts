import { num } from './num'
/**
 * MOTOR DETERMINISTA DE HEMODINAMIA — ICU (iteración nexusmed-icu-008).
 *
 * Funciones puras, versionadas y probadas. Regla del contrato: NO se convierte
 * automáticamente entre unidades de vasopresor sin PESO válido, concentración y
 * velocidad — si falta, se BLOQUEA ese componente (no se asume).
 *
 * Fórmulas:
 *   PAM = (PAS + 2·PAD) / 3
 *   Shock index (SI) = FC / PAS
 *   Shock index modificado (MSI) = FC / PAM
 *   Equivalente de norepinefrina (NEE, mcg/kg/min) — factores citados:
 *     norepinefrina ×1 · epinefrina ×1 · dopamina /100 · fenilefrina /10 ·
 *     vasopresina (U/min) ×2.5. Inotrópicos (dobutamina/milrinona) NO cuentan.
 *
 * NOTA CLÍNICA: los factores de equivalencia deben ser VALIDADOS por el médico
 * (como los breakpoints del antibiograma); aquí se implementa la fórmula citada
 * más usada, transparente y auditable.
 */

export const HEMODINAMIA_ENGINE_VERSION = '1.0.0'

const r2 = (x: number) => Math.round(x * 100) / 100

export interface CalculoHemo {
  ok: boolean
  valor: number | null
  unidad: string
  formula: string
  faltantes: string[]
  motivoBloqueo: string | null
  advertencias: string[]
  interpretacion?: string
}

const bloq = (unidad: string, formula: string, motivo: string, faltantes: string[] = []): CalculoHemo =>
  ({ ok: false, valor: null, unidad, formula, faltantes, motivoBloqueo: motivo, advertencias: [] })

/** Presión arterial media = (PAS + 2·PAD) / 3. */
export function presionArterialMedia(pas?: number | string, pad?: number | string): CalculoHemo {
  const s = num(pas), d = num(pad)
  const formula = '(PAS + 2·PAD) / 3'
  const faltantes: string[] = []
  if (s === null) faltantes.push('PAS')
  if (d === null) faltantes.push('PAD')
  if (faltantes.length) return bloq('mmHg', formula, 'Datos insuficientes', faltantes)
  if (s! < 40 || s! > 300 || d! < 20 || d! > 200 || d! >= s!) return bloq('mmHg', formula, `Presiones no fisiológicas (PAS ${s}/PAD ${d})`)
  const map = Math.round((s! + 2 * d!) / 3)
  return {
    ok: true, valor: map, unidad: 'mmHg', formula, faltantes: [], motivoBloqueo: null,
    advertencias: map < 65 ? [`PAM ${map} mmHg: por debajo de la meta habitual (≥ 65)`] : [],
    interpretacion: map < 65 ? 'Hipotensión (meta PAM ≥ 65)' : 'Adecuada',
  }
}

/** Shock index = FC / PAS. Alerta si > 0.9. */
export function shockIndex(fc?: number | string, pas?: number | string): CalculoHemo {
  const f = num(fc), s = num(pas)
  const formula = 'FC / PAS'
  const faltantes: string[] = []
  if (f === null) faltantes.push('FC')
  if (s === null) faltantes.push('PAS')
  if (faltantes.length) return bloq('', formula, 'Datos insuficientes', faltantes)
  if (s! <= 0 || f! <= 0) return bloq('', formula, 'Valores no fisiológicos')
  const si = r2(f! / s!)
  return {
    ok: true, valor: si, unidad: '', formula, faltantes: [], motivoBloqueo: null,
    advertencias: si > 0.9 ? [`Shock index ${si}: elevado (normal < 0.7; > 0.9 sugiere compromiso hemodinámico)`] : [],
    interpretacion: si < 0.7 ? 'Normal' : si <= 0.9 ? 'Limítrofe' : 'Elevado',
  }
}

export type UnidadDosis = 'mcg_kg_min' | 'mcg_min' | 'units_min' | 'units_hour'
export interface InfusionVasoactiva {
  farmaco: string
  dosis: number | string
  unidad: UnidadDosis
}

/** Factores de equivalente de norepinefrina (por mcg/kg/min salvo vasopresina). */
const FACTOR_NEE: Record<string, number> = {
  norepinefrina: 1, noradrenalina: 1, norepi: 1,
  epinefrina: 1, adrenalina: 1,
  dopamina: 1 / 100,
  fenilefrina: 1 / 10,
}
const INOTROPICOS = ['dobutamina', 'milrinona', 'levosimendan', 'levosimendán']

export interface ResultadoNEE {
  ok: boolean
  valorTotal: number | null      // mcg/kg/min equivalente de norepinefrina
  unidad: string
  componentes: { farmaco: string; aporte: number | null; bloqueado: boolean; motivo?: string }[]
  advertencias: string[]
  formula: string
}

/**
 * Equivalente de norepinefrina de una lista de infusiones. BLOQUEA un componente
 * (aporte=null) cuando no se puede convertir con seguridad: p.ej. dosis en
 * mcg/min sin PESO. Los inotrópicos no aportan al NEE (se anotan).
 */
export function equivalenteNorepinefrina(infusiones: InfusionVasoactiva[], pesoKg?: number | string): ResultadoNEE {
  const peso = num(pesoKg)
  const advertencias: string[] = []
  let total = 0
  let algunoBloqueado = false

  const componentes = infusiones.map(inf => {
    const nombre = inf.farmaco.toLowerCase().trim()
    const dosis = num(inf.dosis)
    if (dosis === null) { algunoBloqueado = true; return { farmaco: inf.farmaco, aporte: null, bloqueado: true, motivo: 'dosis no numérica' } }

    if (INOTROPICOS.includes(nombre)) {
      advertencias.push(`${inf.farmaco}: inotrópico, no cuenta para el equivalente de norepinefrina`)
      return { farmaco: inf.farmaco, aporte: 0, bloqueado: false }
    }

    // Vasopresina: equivalencia fija por U/min (no requiere peso).
    if (nombre.includes('vasopresina')) {
      let uMin: number | null = null
      if (inf.unidad === 'units_min') uMin = dosis
      else if (inf.unidad === 'units_hour') uMin = dosis / 60
      if (uMin === null) { algunoBloqueado = true; return { farmaco: inf.farmaco, aporte: null, bloqueado: true, motivo: 'vasopresina requiere U/min o U/h' } }
      const aporte = r2(uMin * 2.5)
      total += aporte
      return { farmaco: inf.farmaco, aporte, bloqueado: false }
    }

    const factor = FACTOR_NEE[nombre]
    if (factor === undefined) { algunoBloqueado = true; return { farmaco: inf.farmaco, aporte: null, bloqueado: true, motivo: 'fármaco sin factor de equivalencia definido' } }

    // Necesitamos la dosis en mcg/kg/min.
    let dosisKgMin: number | null = null
    if (inf.unidad === 'mcg_kg_min') dosisKgMin = dosis
    else if (inf.unidad === 'mcg_min') {
      if (peso === null || peso <= 0) { algunoBloqueado = true; return { farmaco: inf.farmaco, aporte: null, bloqueado: true, motivo: 'dosis en mcg/min sin PESO válido: no se convierte a mcg/kg/min' } }
      dosisKgMin = dosis / peso
    } else { algunoBloqueado = true; return { farmaco: inf.farmaco, aporte: null, bloqueado: true, motivo: `unidad ${inf.unidad} no convertible para este fármaco` } }

    const aporte = r2(dosisKgMin * factor)
    total += aporte
    return { farmaco: inf.farmaco, aporte, bloqueado: false }
  })

  if (algunoBloqueado) advertencias.push('Uno o más componentes no se pudieron convertir con seguridad: el equivalente total es PARCIAL')

  return {
    ok: !algunoBloqueado,
    valorTotal: componentes.length ? r2(total) : null,
    unidad: 'mcg/kg/min (equiv. norepinefrina)',
    componentes, advertencias,
    formula: 'NEE = norepi + epi + dopamina/100 + fenilefrina/10 + vasopresina(U/min)·2.5',
  }
}
