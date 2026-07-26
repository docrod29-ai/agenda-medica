import { num } from './num'
/**
 * MOTOR DETERMINISTA DE CKRT / PRISMA — ICU (ICU OS · nivel P2).
 *
 * Terapia de reemplazo renal continua. Funciones PURAS, versionadas y probadas.
 * El LLM NUNCA calcula la dosis ni juzga el filtro: entrega los números de la
 * máquina y aquí se razona por reglas, RESPETANDO la modalidad (la fórmula del
 * efluente cambia por modalidad). Si falta un dato invalidante, BLOQUEA. No
 * autodiagnostica trombosis del filtro ni acumulación de citrato: detecta el
 * PATRÓN y pide verificación clínica.
 *
 * Fórmulas (fisiología de CKRT / KDIGO 2012):
 *   Efluente (mL/h): SCUF = UFneta ; CVVH = reposición(total) + UFneta ;
 *                    CVVHD = dializado + UFneta ; CVVHDF = dializado + reposición + UFneta
 *   Dosis (mL/kg/h) = efluente / peso
 *   Dosis ENTREGADA ≈ dosis prescrita × (tiempo activo / 24 h)  [descuenta downtime]
 *   Fracción de filtración = UF total / flujo de plasma que entra al filtro
 *      Qplasma (mL/h) = Qb(mL/min) × 60 × (1 − Hto/100)
 *      pre-dilución reduce la FF efectiva (diluye el plasma antes del filtro)
 *   Ratio Ca total / Ca iónico ≥ 2.5 → sospecha de acumulación de citrato
 */

export const CKRT_ENGINE_VERSION = '1.0.0'

const r1 = (x: number) => Math.round(x * 10) / 10

export type ModalidadCKRT = 'SCUF' | 'CVVH' | 'CVVHD' | 'CVVHDF'

export interface EntradaCKRT {
  modalidad?: ModalidadCKRT
  pesoKg?: number | string
  qbMlMin?: number | string        // flujo de sangre
  dializadoMlH?: number | string    // (CVVHD/CVVHDF)
  reposicionPreMlH?: number | string
  reposicionPostMlH?: number | string
  ufNetaMlH?: number | string       // extracción neta al paciente
  hematocrito?: number | string     // % (para fracción de filtración)
  tiempoActivoH?: number | string   // horas realmente en marcha en 24 h (downtime)
}

export interface ResultadoCKRT {
  version: string
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  modalidad: ModalidadCKRT | null
  efluenteMlH: number | null
  dosisPrescritaMlKgH: number | null
  dosisEntregadaMlKgH: number | null
  fraccionFiltracionPct: number | null
  advertencias: string[]
  interpretacion: string
  fuenteId: string
}

const bloq = (motivo: string): ResultadoCKRT => ({
  version: CKRT_ENGINE_VERSION, ok: false, bloqueado: true, motivoBloqueo: motivo,
  modalidad: null, efluenteMlH: null, dosisPrescritaMlKgH: null, dosisEntregadaMlKgH: null,
  fraccionFiltracionPct: null, advertencias: [], interpretacion: '', fuenteId: 'kdigoAki2012',
})

/** Calcula dosis de CKRT, fracción de filtración y advertencias, por modalidad. */
export function analizarCKRT(e: EntradaCKRT): ResultadoCKRT {
  const mod = e.modalidad
  if (!mod) return bloq('Falta la modalidad de CKRT (SCUF/CVVH/CVVHD/CVVHDF)')
  const peso = num(e.pesoKg)
  const dial = num(e.dializadoMlH) ?? 0
  const pre = num(e.reposicionPreMlH) ?? 0
  const post = num(e.reposicionPostMlH) ?? 0
  const ufNeta = num(e.ufNetaMlH)
  const qb = num(e.qbMlMin)
  const hto = num(e.hematocrito)
  const tActivo = num(e.tiempoActivoH)

  if (ufNeta === null) return bloq('Falta la UF neta (extracción al paciente)')

  // Efluente por modalidad (mL/h)
  let efluente: number
  if (mod === 'SCUF') efluente = ufNeta
  else if (mod === 'CVVH') efluente = pre + post + ufNeta
  else if (mod === 'CVVHD') efluente = dial + ufNeta
  else efluente = dial + pre + post + ufNeta // CVVHDF

  const advertencias: string[] = []
  let dosisPrescrita: number | null = null
  let dosisEntregada: number | null = null
  if (mod !== 'SCUF') {
    if (peso === null) {
      advertencias.push('Sin peso: no se calcula la dosis en mL/kg/h')
    } else {
      const dosisExacta = efluente / peso
      dosisPrescrita = r1(dosisExacta)
      // KDIGO: prescribir 25–30 para ENTREGAR 20–25 mL/kg/h (el downtime la baja).
      if (dosisPrescrita < 20) advertencias.push(`Dosis prescrita ${dosisPrescrita} mL/kg/h < 20: por debajo del objetivo KDIGO (entregar 20–25)`)
      if (tActivo !== null) {
        const frac = Math.min(tActivo, 24) / 24
        dosisEntregada = r1(dosisExacta * frac)
        if (dosisEntregada < 20) advertencias.push(`Dosis ENTREGADA ${dosisEntregada} mL/kg/h < 20 (downtime ${r1(24 - Math.min(tActivo, 24))} h): compensar con más prescripción`)
      } else {
        advertencias.push('Sin tiempo activo: no se puede estimar la dosis entregada (solo la prescrita)')
      }
    }
  }

  // Fracción de filtración (riesgo de coagulación del filtro)
  let ff: number | null = null
  if (qb !== null && hto !== null && (mod === 'CVVH' || mod === 'CVVHDF')) {
    const qplasma = qb * 60 * (1 - hto / 100) // mL/h
    const ufTotal = pre + post + ufNeta        // ultrafiltrado formado
    // La pre-dilución diluye el plasma que entra al filtro → baja la FF efectiva.
    const denom = qplasma + pre
    if (denom > 0) {
      ff = r1((ufTotal / denom) * 100)
      if (ff > 25) advertencias.push(`Fracción de filtración ${ff}% > 25: mayor riesgo de coagulación del filtro (subir Qb, más pre-dilución o bajar UF)`)
    }
  }

  const partes: string[] = [`${mod}`]
  if (dosisPrescrita !== null) partes.push(`dosis ${dosisEntregada ?? dosisPrescrita} mL/kg/h${dosisEntregada !== null ? ' entregada' : ' prescrita'}`)
  partes.push(`efluente ${efluente} mL/h`)
  if (ff !== null) partes.push(`FF ${ff}%`)

  return {
    version: CKRT_ENGINE_VERSION, ok: true, bloqueado: false, motivoBloqueo: null,
    modalidad: mod, efluenteMlH: efluente, dosisPrescritaMlKgH: dosisPrescrita,
    dosisEntregadaMlKgH: dosisEntregada, fraccionFiltracionPct: ff,
    advertencias, interpretacion: partes.join(' · ') + '. Cálculo determinista; el médico integra el cuadro.',
    fuenteId: 'kdigoAki2012',
  }
}

/* ── Anticoagulación regional con citrato (RCA) ── */

export interface EntradaCitrato {
  caIonicoSistemico?: number | string   // mmol/L (objetivo 1.0–1.2)
  caPostfiltro?: number | string          // mmol/L (objetivo circuito 0.25–0.35)
  caTotal?: number | string               // mmol/L (para el ratio de acumulación)
  hco3?: number | string
}

export interface ResultadoCitrato {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  ratioCaTotalIonico: number | null
  sistemicoEnRango: boolean | null
  postfiltroEnRango: boolean | null
  patronAcumulacion: boolean
  advertencias: string[]
  interpretacion: string
  fuenteId: string
}

/**
 * Evalúa la anticoagulación con citrato. NO diagnostica acumulación: detecta el
 * PATRÓN (ratio Ca total/iónico ≥ 2.5, típico en falla hepática/choque) y pide
 * verificación. Objetivos: iCa sistémico 1.0–1.2; iCa postfiltro 0.25–0.35.
 */
export function analizarCitrato(e: EntradaCitrato): ResultadoCitrato {
  const sis = num(e.caIonicoSistemico), post = num(e.caPostfiltro), total = num(e.caTotal)
  if (sis === null && post === null && total === null) {
    return { ok: false, bloqueado: true, motivoBloqueo: 'Sin datos de calcio para evaluar el citrato', ratioCaTotalIonico: null, sistemicoEnRango: null, postfiltroEnRango: null, patronAcumulacion: false, advertencias: [], interpretacion: '', fuenteId: 'rcaKdigoCitrate' }
  }
  const advertencias: string[] = []
  const sistemicoEnRango = sis === null ? null : sis >= 1.0 && sis <= 1.2
  const postfiltroEnRango = post === null ? null : post >= 0.25 && post <= 0.35
  if (sis !== null && sis < 0.9) advertencias.push(`iCa sistémico ${sis} mmol/L bajo: reponer calcio (objetivo 1.0–1.2)`)
  if (post !== null && post > 0.4) advertencias.push(`iCa postfiltro ${post} mmol/L > 0.4: anticoagulación del circuito subóptima (subir citrato)`)
  if (post !== null && post < 0.2) advertencias.push(`iCa postfiltro ${post} mmol/L < 0.2: citrato posiblemente excesivo`)

  let ratio: number | null = null
  let patron = false
  if (total !== null && sis !== null && sis > 0) {
    ratio = r1(total / sis)
    if (ratio >= 2.5) {
      patron = true
      advertencias.push(`Ratio Ca total/iónico ${ratio} ≥ 2.5: PATRÓN compatible con acumulación de citrato (verificar; frecuente en falla hepática/hipoperfusión). Vigilar acidosis metabólica con AG e iCa sistémico bajo pese a más calcio.`)
    }
  }

  const partes: string[] = []
  if (sis !== null) partes.push(`iCa sistémico ${sis}${sistemicoEnRango ? ' (en rango)' : ' (fuera)'}`)
  if (post !== null) partes.push(`iCa postfiltro ${post}`)
  if (ratio !== null) partes.push(`ratio total/iónico ${ratio}`)

  return {
    ok: true, bloqueado: false, motivoBloqueo: null,
    ratioCaTotalIonico: ratio, sistemicoEnRango, postfiltroEnRango, patronAcumulacion: patron,
    advertencias, interpretacion: partes.join(' · ') || 'Citrato: datos insuficientes para una lectura completa',
    fuenteId: 'rcaKdigoCitrate',
  }
}

/* ── Tendencia de vida del filtro ── */

export interface TendenciaFiltro {
  bloqueado: boolean
  motivo: string | null
  descendente: boolean
  ultimaHoras: number | null
  interpretacion: string
}

/**
 * Analiza la duración de los últimos filtros (horas). Detecta una TENDENCIA
 * descendente (acortamiento) para revisar acceso/anticoagulación/FF — NO afirma
 * la causa.
 */
export function tendenciaFiltro(duracionesH: (number | string)[]): TendenciaFiltro {
  const vals = (duracionesH ?? []).map(num).filter((x): x is number => x !== null)
  if (vals.length < 2) return { bloqueado: true, motivo: 'Se requieren ≥2 duraciones de filtro', descendente: false, ultimaHoras: vals[vals.length - 1] ?? null, interpretacion: '' }
  // Descendente si cada filtro dura menos que el anterior (monótono estricto).
  let descendente = true
  for (let i = 1; i < vals.length; i++) if (vals[i] >= vals[i - 1]) { descendente = false; break }
  const ultima = vals[vals.length - 1]
  return {
    bloqueado: false, motivo: null, descendente, ultimaHoras: ultima,
    interpretacion: descendente
      ? `La duración del filtro está DISMINUYENDO (${vals.join('→')} h): revisar acceso, anticoagulación, fracción de filtración y hematocrito.`
      : `Duración de filtros: ${vals.join('→')} h (último ${ultima} h).`,
  }
}
