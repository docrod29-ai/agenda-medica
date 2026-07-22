/**
 * Verificación DETERMINISTA de dosis — capa de seguridad del paciente.
 *
 * Objetivo (hallazgo de auditoría de seguridad del paciente): detectar de forma
 * determinista errores graves de dosificación —sobre todo el clásico error de
 * decimal 50 mg → 500 mg— que un LLM puede pasar por alto. NO reemplaza el juicio
 * clínico ni una base farmacológica licenciada.
 *
 * ⚠️ HONESTIDAD DE SEGURIDAD (leer antes de usar en producción):
 *  - La tabla `CATALOGO` es una SEMILLA con valores de referencia comunes. DEBE ser
 *    revisada y ampliada por un médico/farmacéutico antes de confiar en ella.
 *  - AUSENCIA de alerta ≠ dosis segura: si el fármaco no está en el catálogo, el
 *    motor lo dice explícitamente (revision='sin_referencia'), no calla asumiendo OK.
 *  - Todo PURO (sin red/DB) → testeable y auditable.
 */

export type Severidad = 'critica' | 'alta' | 'info'

export interface AlertaDosis {
  severidad: Severidad
  codigo: 'sobre_maximo_dosis' | 'sobre_maximo_diario' | 'posible_error_decimal'
    | 'pediatrico_sobre_mgkg' | 'sin_referencia' | 'dosis_extrema'
  mensaje: string
}

export interface FarmacoRef {
  nombre: string
  alias: string[]
  /** Dosis máxima por TOMA en adulto (mg). */
  maxTomaMg?: number
  /** Dosis máxima DIARIA en adulto (mg). */
  maxDiaMg?: number
  /** Máx mg/kg por toma (pediátrico). */
  pedMaxMgKgToma?: number
  /** Máx mg/kg/día (pediátrico). */
  pedMaxMgKgDia?: number
  nota?: string
}

/**
 * SEMILLA de referencia (valores comunes de referencia adulto; pediátrico donde es
 * ampliamente establecido). Conservador y ACOTADO a propósito. Ampliar/validar.
 */
export const CATALOGO: FarmacoRef[] = [
  { nombre: 'Paracetamol', alias: ['acetaminofen', 'acetaminofén', 'tylenol', 'tempra'], maxTomaMg: 1000, maxDiaMg: 4000, pedMaxMgKgToma: 15, pedMaxMgKgDia: 75, nota: 'Hepatotóxico por sobredosis; vigilar dosis acumulada.' },
  { nombre: 'Ibuprofeno', alias: ['advil', 'motrin'], maxTomaMg: 800, maxDiaMg: 3200, pedMaxMgKgToma: 10, pedMaxMgKgDia: 40 },
  { nombre: 'Naproxeno', alias: ['flanax', 'aleve'], maxTomaMg: 750, maxDiaMg: 1500 },
  { nombre: 'Ketorolaco', alias: ['dolac', 'toradol'], maxTomaMg: 30, maxDiaMg: 120, nota: 'Máx 5 días; oral máx 40 mg/día.' },
  { nombre: 'Metamizol', alias: ['dipirona', 'neomelubrina'], maxTomaMg: 1000, maxDiaMg: 4000 },
  { nombre: 'Amoxicilina', alias: ['amoxil'], maxTomaMg: 1000, maxDiaMg: 3000, pedMaxMgKgDia: 90 },
  { nombre: 'Tramadol', alias: [], maxTomaMg: 100, maxDiaMg: 400 },
  { nombre: 'Metformina', alias: ['glucophage'], maxTomaMg: 1000, maxDiaMg: 2550 },
  { nombre: 'Omeprazol', alias: ['losec'], maxTomaMg: 40, maxDiaMg: 80 },
  { nombre: 'Losartán', alias: ['losartan'], maxTomaMg: 100, maxDiaMg: 100 },
]

function normaliza(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Busca el fármaco por nombre o alias (coincidencia de palabra contenida). */
export function buscarFarmaco(nombre: string): FarmacoRef | null {
  const n = normaliza(nombre)
  if (!n) return null
  for (const f of CATALOGO) {
    const claves = [f.nombre, ...f.alias].map(normaliza)
    if (claves.some(c => n === c || n.includes(c) || c.includes(n))) return f
  }
  return null
}

export interface EntradaDosis {
  farmaco: string
  /** Dosis por toma en mg. */
  dosisMg: number
  /** Tomas al día (para el máximo diario). Default 1. */
  tomasDia?: number
  /** Paciente pediátrico: peso en kg (activa la verificación mg/kg). */
  pesoKg?: number
}

/**
 * Revisa una dosis y devuelve alertas (vacío = sin alertas conocidas, NO "seguro").
 * Determinista, sin efectos secundarios.
 */
export function revisarDosis(e: EntradaDosis): AlertaDosis[] {
  const alertas: AlertaDosis[] = []
  const dosis = Number(e.dosisMg)
  if (!Number.isFinite(dosis) || dosis <= 0) return alertas

  // Dosis absurda absoluta (oral): un solo medicamento > 10 g por toma casi siempre
  // es error de captura/unidad, sin importar el fármaco.
  if (dosis > 10000) {
    alertas.push({ severidad: 'critica', codigo: 'dosis_extrema', mensaje: `Dosis de ${dosis} mg por toma es extremadamente alta — verifica la unidad (¿mg vs mcg?) y la cifra.` })
  }

  const f = buscarFarmaco(e.farmaco)
  if (!f) {
    alertas.push({ severidad: 'info', codigo: 'sin_referencia', mensaje: `Sin referencia de dosis para "${e.farmaco}" en el catálogo. Verifica manualmente (ausencia de alerta ≠ dosis segura).` })
    return alertas
  }

  // Techo por toma (adulto)
  if (f.maxTomaMg && dosis > f.maxTomaMg) {
    // ¿Es exactamente ~10x el máximo? → probable error de decimal.
    const factor = dosis / f.maxTomaMg
    if (factor >= 9 && factor <= 11) {
      alertas.push({ severidad: 'critica', codigo: 'posible_error_decimal', mensaje: `${f.nombre}: ${dosis} mg es ~10× el máximo por toma (${f.maxTomaMg} mg). ¿Error de decimal (p. ej. 500 en vez de 50)?` })
    } else {
      alertas.push({ severidad: 'critica', codigo: 'sobre_maximo_dosis', mensaje: `${f.nombre}: ${dosis} mg por toma supera el máximo de referencia (${f.maxTomaMg} mg).` })
    }
  }

  // Techo diario (adulto)
  const tomas = Math.max(1, Math.floor(e.tomasDia ?? 1))
  if (f.maxDiaMg && dosis * tomas > f.maxDiaMg) {
    alertas.push({ severidad: 'alta', codigo: 'sobre_maximo_diario', mensaje: `${f.nombre}: ${dosis} mg × ${tomas}/día = ${dosis * tomas} mg supera el máximo diario de referencia (${f.maxDiaMg} mg).` })
  }

  // Pediátrico por peso (si hay peso y referencia mg/kg)
  if (e.pesoKg && e.pesoKg > 0) {
    if (f.pedMaxMgKgToma) {
      const mgkg = dosis / e.pesoKg
      if (mgkg > f.pedMaxMgKgToma) {
        alertas.push({ severidad: 'critica', codigo: 'pediatrico_sobre_mgkg', mensaje: `${f.nombre}: ${dosis} mg en ${e.pesoKg} kg = ${mgkg.toFixed(1)} mg/kg por toma, supera ${f.pedMaxMgKgToma} mg/kg.` })
      }
    }
    if (f.pedMaxMgKgDia) {
      const mgkgDia = (dosis * tomas) / e.pesoKg
      if (mgkgDia > f.pedMaxMgKgDia) {
        alertas.push({ severidad: 'alta', codigo: 'pediatrico_sobre_mgkg', mensaje: `${f.nombre}: ${(mgkgDia).toFixed(1)} mg/kg/día supera ${f.pedMaxMgKgDia} mg/kg/día.` })
      }
    }
  }

  return alertas
}

/**
 * Extrae la dosis en mg de un texto libre ("500 mg", "1 g", "250mcg"). Devuelve
 * null si no hay una cantidad clara. Convierte g→mg (×1000) y mcg/µg→mg (÷1000).
 * Puro.
 */
export function extraerMg(texto: string): number | null {
  const t = normaliza(texto)
  // 1) Cantidad con unidad de MASA explícita (mg/g/mcg) — la que de verdad importa.
  const masa = t.match(/(\d+(?:[.,]\d+)?)\s*(mcg|µg|ug|mg|g|gr|gramos?)\b/)
  if (masa) {
    const val = parseFloat(masa[1].replace(',', '.'))
    if (!Number.isFinite(val)) return null
    const u = masa[2]
    if (u.startsWith('mcg') || u === 'µg' || u === 'ug') return val / 1000
    if (u === 'g' || u === 'gr' || u.startsWith('gramo')) return val * 1000
    return val
  }
  // 2) Sin masa pero en VOLUMEN (mL/cc): NO se puede validar en mg sin la
  //    concentración → null. Antes "5 mL" se leía como 5 mg y silenciaba la red de
  //    seguridad (el clásico error de jarabes quedaba fuera).
  if (/\d+(?:[.,]\d+)?\s*(ml|mililitros?|c\.?\s?c\.?|cc)\b/.test(t)) return null
  // 3) Número sin unidad: se asume mg (comportamiento previo para "500").
  const bare = t.match(/(\d+(?:[.,]\d+)?)/)
  if (!bare) return null
  const val = parseFloat(bare[1].replace(',', '.'))
  return Number.isFinite(val) ? val : null
}

/**
 * Estima cuántas TOMAS al día implica una frecuencia en texto libre ("cada 8
 * horas", "c/12h", "3 veces al día", "cada 24 h"). Devuelve null si no se entiende.
 * Puro.
 */
export function extraerTomasDia(frecuencia: string): number | null {
  const t = normaliza(frecuencia)
  if (!t) return null
  let m = t.match(/cada\s*(\d+)\s*(h|hrs?|horas?)/) || t.match(/c\/?\s*(\d+)\s*h/)
  if (m) { const h = parseInt(m[1], 10); return h > 0 ? Math.round(24 / h) : null }
  m = t.match(/(\d+)\s*(veces|vez|x)\b/)
  if (m) return parseInt(m[1], 10)
  // Números ESCRITOS CON LETRA — muy común en dictado ("tres veces al día",
  // "cada ocho horas"). Antes no se parseaban → tomasDia caía a 1 y el techo DIARIO
  // no se comprobaba (ibuprofeno 800 mg "tres veces al día" = 2400 mg se leía 800).
  const NUM: Record<string, number> = {
    una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, ocho: 8, doce: 12, veinticuatro: 24,
  }
  const mp = t.match(/(una?|dos|tres|cuatro|cinco|seis)\s*(veces|vez)\b/)
  if (mp && NUM[mp[1]]) return NUM[mp[1]]
  const mh = t.match(/cada\s*(una?|dos|tres|cuatro|seis|ocho|doce|veinticuatro)\s*(h|hrs?|horas?)/)
  if (mh && NUM[mh[1]]) { const h = NUM[mh[1]]; return h > 0 ? Math.round(24 / h) : null }
  if (/una vez|1 vez|diaria|al dia|cada 24|cada veinticuatro/.test(t)) return 1
  return null
}

/** Peor severidad de un conjunto de alertas (para el color del aviso). */
export function peorSeveridad(alertas: AlertaDosis[]): Severidad | null {
  if (alertas.some(a => a.severidad === 'critica')) return 'critica'
  if (alertas.some(a => a.severidad === 'alta')) return 'alta'
  if (alertas.some(a => a.severidad === 'info')) return 'info'
  return null
}
