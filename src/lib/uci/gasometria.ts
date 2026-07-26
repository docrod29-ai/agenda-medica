/**
 * MOTOR DETERMINISTA DE GASOMETRÍA / ÁCIDO-BASE — ICU (iteración nexusmed-icu-007).
 *
 * Funciones PURAS, versionadas y probadas. El LLM NUNCA interpreta el ácido-base:
 * entrega los números crudos (pH, PaCO2, HCO3, Na, Cl…) y este motor razona por
 * reglas. Muestra fórmula, datos usados y limitaciones. Si falta un dato, BLOQUEA.
 *
 * Reglas (fisiología estándar):
 *   Winters (acidosis metabólica): PaCO2 esperado = 1.5·HCO3 + 8 (±2)
 *   Compensación alcalosis metab.: PaCO2 esperado = 0.7·HCO3 + 21 (±2)
 *   Resp. aguda:   ΔHCO3 = 1·(ΔPaCO2/10) ;  crónica: 3.5·(ΔPaCO2/10)
 *   Resp. alcalosis aguda: ΔHCO3 = −2·(ΔPaCO2/10) ; crónica: −4·(ΔPaCO2/10)
 *   Anion gap = Na − (Cl + HCO3) ; corregido = AG + 2.5·(4 − albúmina g/dL)
 *   Delta-delta = (AG − 12) / (24 − HCO3)
 *
 * El ÁCIDO-BASE puede evaluarse en sangre venosa con matices; la OXIGENACIÓN
 * arterial (PaO2/FiO2) NO — eso vive en el motor de ventilación.
 */

export const GASOMETRIA_ENGINE_VERSION = '1.0.0'

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const r1 = (x: number) => Math.round(x * 10) / 10

export type TrastornoPrimario =
  | 'acidosis_metabolica'
  | 'alcalosis_metabolica'
  | 'acidosis_respiratoria'
  | 'alcalosis_respiratoria'
  | 'normal'
  | 'indeterminado'

export interface EntradaGasometria {
  ph?: number | string
  paco2?: number | string     // mmHg
  hco3?: number | string      // mmol/L (bicarbonato)
  na?: number | string
  cl?: number | string
  albumina?: number | string  // g/dL (para corregir el AG)
  cronicidadRespiratoria?: 'aguda' | 'cronica'
}

export interface AnalisisGasometria {
  version: string
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  faltantes: string[]
  acidemia: 'acidemia' | 'alcalemia' | 'normal' | null
  trastornoPrimario: TrastornoPrimario
  compensacion: { esperadoPaCO2: number | null; formula: string | null; adecuada: boolean | null; comentario: string }
  mixto: boolean
  anionGap: { valor: number | null; corregidoAlbumina: number | null; elevado: boolean | null; formula: string }
  deltaDelta: { valor: number | null; interpretacion: string | null }
  advertencias: string[]
  interpretacion: string
}

function bloquear(faltantes: string[]): AnalisisGasometria {
  return {
    version: GASOMETRIA_ENGINE_VERSION, ok: false, bloqueado: true,
    motivoBloqueo: 'Datos insuficientes para interpretar el ácido-base', faltantes,
    acidemia: null, trastornoPrimario: 'indeterminado',
    compensacion: { esperadoPaCO2: null, formula: null, adecuada: null, comentario: '' },
    mixto: false,
    anionGap: { valor: null, corregidoAlbumina: null, elevado: null, formula: 'Na − (Cl + HCO3)' },
    deltaDelta: { valor: null, interpretacion: null },
    advertencias: [], interpretacion: `No se interpreta: faltan ${faltantes.join(', ')}.`,
  }
}

export function analizarGasometria(e: EntradaGasometria): AnalisisGasometria {
  const ph = num(e.ph), paco2 = num(e.paco2), hco3 = num(e.hco3)
  const na = num(e.na), cl = num(e.cl), alb = num(e.albumina)

  const faltantes: string[] = []
  if (ph === null) faltantes.push('pH')
  if (paco2 === null) faltantes.push('PaCO2')
  if (hco3 === null) faltantes.push('HCO3')
  if (faltantes.length) return bloquear(faltantes)

  // Rangos fisiológicos (fuera = error de dato)
  if (ph! < 6.5 || ph! > 8.0) return { ...bloquear([]), motivoBloqueo: `pH no fisiológico (${ph})`, faltantes: [], interpretacion: `pH fuera de rango (${ph}).` }

  const advertencias: string[] = []

  // 1) Acidemia / alcalemia
  const acidemia = ph! < 7.35 ? 'acidemia' : ph! > 7.45 ? 'alcalemia' : 'normal'

  // 2) Trastorno primario (por la dirección del pH y quién lo explica)
  let trastornoPrimario: TrastornoPrimario = 'normal'
  if (acidemia === 'acidemia') {
    trastornoPrimario = hco3! < 22 ? 'acidosis_metabolica' : paco2! > 45 ? 'acidosis_respiratoria' : 'acidosis_metabolica'
  } else if (acidemia === 'alcalemia') {
    trastornoPrimario = hco3! > 26 ? 'alcalosis_metabolica' : paco2! < 35 ? 'alcalosis_respiratoria' : 'alcalosis_metabolica'
  } else {
    // pH normal pero puede haber trastorno compensado o mixto
    if (hco3! < 22 && paco2! < 35) trastornoPrimario = 'acidosis_metabolica'
    else if (hco3! > 26 && paco2! > 45) trastornoPrimario = 'alcalosis_metabolica'
    else trastornoPrimario = 'normal'
  }

  // 3) Compensación esperada
  let esperadoPaCO2: number | null = null
  let formulaComp: string | null = null
  let compAdecuada: boolean | null = null
  let comentarioComp = ''
  const cron = e.cronicidadRespiratoria ?? 'aguda'

  if (trastornoPrimario === 'acidosis_metabolica') {
    esperadoPaCO2 = r1(1.5 * hco3! + 8)
    formulaComp = 'Winters: 1.5·HCO3 + 8 (±2)'
    compAdecuada = Math.abs(paco2! - esperadoPaCO2) <= 2
    comentarioComp = compAdecuada ? 'Compensación respiratoria adecuada'
      : paco2! > esperadoPaCO2 + 2 ? 'PaCO2 mayor a lo esperado → acidosis respiratoria concomitante'
      : 'PaCO2 menor a lo esperado → alcalosis respiratoria concomitante'
  } else if (trastornoPrimario === 'alcalosis_metabolica') {
    esperadoPaCO2 = r1(0.7 * hco3! + 21)
    formulaComp = '0.7·HCO3 + 21 (±5)'
    compAdecuada = Math.abs(paco2! - esperadoPaCO2) <= 5
    comentarioComp = compAdecuada ? 'Compensación respiratoria adecuada'
      : paco2! < esperadoPaCO2 - 5 ? 'PaCO2 menor a lo esperado → alcalosis respiratoria concomitante'
      : 'PaCO2 mayor a lo esperado → acidosis respiratoria concomitante'
  } else if (trastornoPrimario === 'acidosis_respiratoria' || trastornoPrimario === 'alcalosis_respiratoria') {
    const deltaCO2 = (paco2! - 40) / 10
    const esAcidosis = trastornoPrimario === 'acidosis_respiratoria'
    const espAgudo = r1(24 + (esAcidosis ? 1 : -2) * deltaCO2)
    const espCronico = r1(24 + (esAcidosis ? 3.5 : -4) * deltaCO2)
    if (e.cronicidadRespiratoria === undefined) {
      // NO asumir cronicidad: un retenedor crónico de CO2 (EPOC) tiene un HCO3 alto
      // NORMAL para su compensación. Asumir "aguda" inventaba una alcalosis
      // metabólica superpuesta. Se muestran AMBOS rangos y NO se declara mixto.
      formulaComp = `HCO3 esperado: agudo ≈ ${espAgudo}, crónico ≈ ${espCronico} (especifica cronicidad)`
      // Adecuada si el HCO3 encaja en AGUDO o CRÓNICO. Solo si queda fuera de AMBOS
      // hay verdadero componente metabólico. Así un retenedor crónico (EPOC) con HCO3
      // alto NO se marca como alcalosis metabólica superpuesta inventada.
      const compatibleAlguno = Math.abs(hco3! - espAgudo) <= 3 || Math.abs(hco3! - espCronico) <= 3
      compAdecuada = compatibleAlguno
      comentarioComp = compatibleAlguno
        ? `HCO3 ${hco3} compatible con compensación ${Math.abs(hco3! - espCronico) <= Math.abs(hco3! - espAgudo) ? 'crónica' : 'aguda'}; especifica cronicidad para afinar`
        : `HCO3 ${hco3} fuera de ambos rangos (agudo ${espAgudo} / crónico ${espCronico}) → componente metabólico concomitante`
      advertencias.push('Cronicidad respiratoria no especificada: no se asume; se evalúan ambos rangos (agudo y crónico)')
    } else {
      const factor = esAcidosis ? (cron === 'cronica' ? 3.5 : 1) : (cron === 'cronica' ? -4 : -2)
      const hco3Esperado = r1(24 + factor * deltaCO2)
      formulaComp = esAcidosis
        ? `HCO3 esperado = 24 + ${cron === 'cronica' ? '3.5' : '1'}·(ΔPaCO2/10)`
        : `HCO3 esperado = 24 − ${cron === 'cronica' ? '4' : '2'}·(ΔPaCO2/10)`
      compAdecuada = Math.abs(hco3! - hco3Esperado) <= 3
      comentarioComp = compAdecuada
        ? `Compensación metabólica ${cron} adecuada (HCO3 esperado ≈ ${hco3Esperado})`
        : `HCO3 (${hco3}) difiere del esperado (${hco3Esperado}) → componente metabólico concomitante`
    }
  }

  // 4) Anion gap
  let ag: number | null = null, agCorr: number | null = null, agElevado: boolean | null = null
  if (na !== null && cl !== null) {
    ag = r1(na - (cl + hco3!))
    agCorr = alb !== null ? r1(ag + 2.5 * (4 - alb)) : null
    agElevado = (agCorr ?? ag) > 12
    if (alb === null) advertencias.push('Albúmina no disponible: el anion gap no se pudo corregir')
  } else {
    advertencias.push('Faltan Na y/o Cl: no se calculó el anion gap')
  }

  // 5) Delta-delta y detección de trastorno MIXTO por anion gap. Independiente del
  //    primario: un AG elevado con HCO3 normal/alto delata un proceso oculto (clásico
  //    AG↑ + alcalosis metabólica) que la sola compensación del primario no ve.
  let dd: number | null = null, ddInterp: string | null = null
  let mixtoPorAG = false
  const agUsar = agCorr ?? ag
  if (agUsar !== null && agElevado) {
    const deltaHCO3 = 24 - hco3!
    if (Math.abs(deltaHCO3) < 1) {
      // AG elevado pero HCO3 ≈ normal: la caída esperada de HCO3 no ocurrió → algo
      // lo sostiene (típicamente alcalosis metabólica concomitante).
      ddInterp = 'AG elevado con HCO3 ≈ normal: la caída esperada de HCO3 no ocurrió → sospecha de alcalosis metabólica concomitante (MIXTO)'
      mixtoPorAG = true
    } else {
      dd = r1((agUsar - 12) / deltaHCO3)
      // Corte clásico en ~1 (antes 0.4, que dejaba pasar la acidosis hiperclorémica
      // concomitante cuando la caída de HCO3 excedía el aumento del AG).
      if (dd < 1) {
        ddInterp = 'ΔΔ < 1: la caída de HCO3 excede el aumento del AG → acidosis metabólica sin AG (hiperclorémica) concomitante'
        mixtoPorAG = true
      } else if (dd <= 2) {
        ddInterp = 'ΔΔ 1–2: acidosis con AG elevado pura'
      } else {
        ddInterp = 'ΔΔ > 2: HCO3 mayor a lo esperado → alcalosis metabólica o acidosis respiratoria crónica concomitante'
        mixtoPorAG = true
      }
    }
  }

  const mixto = compAdecuada === false || mixtoPorAG

  const partes: string[] = []
  partes.push(acidemia === 'normal' ? 'pH normal' : acidemia === 'acidemia' ? 'Acidemia' : 'Alcalemia')
  if (trastornoPrimario !== 'normal') partes.push(trastornoPrimario.replace('_', ' '))
  if (mixto) partes.push('trastorno MIXTO')
  if (agElevado) partes.push('anion gap elevado')

  return {
    version: GASOMETRIA_ENGINE_VERSION, ok: true, bloqueado: false, motivoBloqueo: null, faltantes: [],
    acidemia, trastornoPrimario,
    compensacion: { esperadoPaCO2, formula: formulaComp, adecuada: compAdecuada, comentario: comentarioComp },
    mixto,
    anionGap: { valor: ag, corregidoAlbumina: agCorr, elevado: agElevado, formula: 'Na − (Cl + HCO3); corregido = AG + 2.5·(4 − albúmina)' },
    deltaDelta: { valor: dd, interpretacion: ddInterp },
    advertencias,
    interpretacion: partes.join(' · ') + '. Apoyo decisional; el médico integra el cuadro clínico.',
  }
}
