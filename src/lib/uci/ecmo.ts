/**
 * MOTOR DETERMINISTA DE ECMO / ECLS — ICU (ICU OS · nivel P2).
 *
 * Funciones PURAS, versionadas y probadas. El LLM NUNCA interpreta el soporte:
 * entrega los números (flujo, sweep, presiones del oxigenador, gasometrías) y
 * aquí se razona por reglas. REGLA DE ORO del ICU OS: se detecta el CAMBIO vs el
 * basal o el PATRÓN y se pide verificación — NUNCA se autodiagnostica trombosis
 * del oxigenador, hemólisis ni hipoxia diferencial. Si falta un dato invalidante,
 * se BLOQUEA. (ELSO general/anticoagulation guidelines.)
 */

export const ECMO_ENGINE_VERSION = '1.0.0'

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const r1 = (x: number) => Math.round(x * 10) / 10

export type ConfigECMO = 'VA' | 'VV' | 'VAV'

export interface Señal {
  nivel: 'critica' | 'alta' | 'moderada' | 'informativa'
  parametro: string
  mensaje: string
}

/* ── Vigilancia del oxigenador (ΔP) ── */
export interface EntradaOxigenador {
  presionPre?: number | string    // mmHg
  presionPost?: number | string   // mmHg
  deltaP?: number | string        // mmHg (si ya se midió directo)
  deltaPBasal?: number | string   // ΔP de referencia del circuito
}
export interface ResultadoOxigenador {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  deltaP: number | null
  cambioVsBasalPct: number | null
  señales: Señal[]
  interpretacion: string
  fuenteId: string
}

/**
 * ΔP del oxigenador = presión pre − post. Un ASCENSO respecto al basal del propio
 * circuito hace sospechar depósito/trombosis → INSPECCIONAR oxigenador y circuito.
 * No lo diagnostica (el ΔP también sube con el flujo).
 */
export function vigilanciaOxigenador(e: EntradaOxigenador): ResultadoOxigenador {
  const pre = num(e.presionPre), post = num(e.presionPost)
  let dp = num(e.deltaP)
  if (dp === null && pre !== null && post !== null) dp = pre - post
  if (dp === null) return { ok: false, bloqueado: true, motivoBloqueo: 'Falta ΔP del oxigenador (o presiones pre y post)', deltaP: null, cambioVsBasalPct: null, señales: [], interpretacion: '', fuenteId: 'elsoGeneral2021' }

  const señales: Señal[] = []
  const basal = num(e.deltaPBasal)
  let cambioPct: number | null = null
  if (basal !== null && basal > 0) {
    cambioPct = r1(((dp - basal) / basal) * 100)
    if (cambioPct >= 30) señales.push({ nivel: 'alta', parametro: 'ΔP oxigenador', mensaje: `ΔP ${dp} mmHg subió ${cambioPct}% vs basal (${basal}): INSPECCIONAR oxigenador/circuito y correlacionar con hemólisis y flujo. No confirma trombosis.` })
  }
  if (dp >= 50) señales.push({ nivel: 'moderada', parametro: 'ΔP oxigenador', mensaje: `ΔP ${dp} mmHg elevado en absoluto: correlacionar con el flujo actual (el ΔP sube con el flujo).` })

  return {
    ok: true, bloqueado: false, motivoBloqueo: null, deltaP: dp, cambioVsBasalPct: cambioPct, señales,
    interpretacion: `ΔP oxigenador ${dp} mmHg${cambioPct !== null ? ` (${cambioPct >= 0 ? '+' : ''}${cambioPct}% vs basal)` : ''}.`,
    fuenteId: 'elsoGeneral2021',
  }
}

/* ── Panel de hemólisis ── */
export interface EntradaHemolisis {
  plasmaFreeHb?: number | string  // mg/dL
  ldh?: number | string           // U/L
  haptoglobina?: number | string  // mg/dL
  bilirrubinaIndirecta?: number | string
}
export interface ResultadoHemolisis {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  patronHemolisis: boolean
  señales: Señal[]
  interpretacion: string
  fuenteId: string
}
/**
 * Señales de hemólisis del circuito. pfHb > 50 mg/dL es el marcador más específico.
 * Detecta el PATRÓN (pfHb alta + LDH alta + haptoglobina baja); pide verificación,
 * no diagnostica la causa (oxigenador vs bomba vs cánula).
 */
export function panelHemolisis(e: EntradaHemolisis): ResultadoHemolisis {
  const pfhb = num(e.plasmaFreeHb), ldh = num(e.ldh), hapto = num(e.haptoglobina)
  if (pfhb === null && ldh === null && hapto === null) {
    return { ok: false, bloqueado: true, motivoBloqueo: 'Sin marcadores de hemólisis (pfHb/LDH/haptoglobina)', patronHemolisis: false, señales: [], interpretacion: '', fuenteId: 'elsoGeneral2021' }
  }
  const señales: Señal[] = []
  let criterios = 0
  if (pfhb !== null && pfhb > 50) { criterios++; señales.push({ nivel: pfhb > 100 ? 'alta' : 'moderada', parametro: 'plasma-free Hb', mensaje: `Hb libre en plasma ${pfhb} mg/dL > 50: hemólisis significativa; buscar fuente (oxigenador/bomba/cánula) y correlacionar con ΔP.` }) }
  if (ldh !== null && ldh > 500) criterios++
  if (hapto !== null && hapto < 30) criterios++
  // pfHb > 50 mg/dL ya es hemólisis significativa por sí sola (marcador específico).
  const patron = criterios >= 2 || (pfhb !== null && pfhb > 50)
  if (patron && !señales.some(s => s.parametro === 'plasma-free Hb')) {
    señales.push({ nivel: 'moderada', parametro: 'hemólisis', mensaje: 'Patrón bioquímico compatible con hemólisis (LDH alta + haptoglobina baja): confirmar con Hb libre en plasma.' })
  }
  return {
    ok: true, bloqueado: false, motivoBloqueo: null, patronHemolisis: patron, señales,
    interpretacion: patron ? 'Patrón compatible con hemólisis del circuito: verificar.' : 'Sin patrón claro de hemólisis con los datos actuales.',
    fuenteId: 'elsoGeneral2021',
  }
}

/* ── VV-ECMO: recirculación / oxigenación ── */
export interface EntradaVV {
  flujoLMin?: number | string
  gastoCardiacoLMin?: number | string  // CO nativo
  saO2?: number | string               // saturación arterial del paciente (%)
  preOxiSvO2?: number | string         // SvO2 en la línea de drenaje (pre-oxigenador)
  sweepLMin?: number | string
  paco2?: number | string
}
export interface ResultadoVV {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  ratioFlujoCO: number | null
  señales: Señal[]
  interpretacion: string
  fuenteId: string
}
/**
 * VV-ECMO. La oxigenación depende del cociente flujo ECMO / gasto cardiaco nativo
 * (a mayor CO nativo, más sangre no oxigenada se mezcla → hipoxemia pese a buen
 * flujo). Sospecha de RECIRCULACIÓN cuando la SvO2 pre-oxigenador es alta y la
 * SaO2 del paciente baja pese a flujo adecuado. No la mide directamente.
 */
export function evaluarVV(e: EntradaVV): ResultadoVV {
  const flujo = num(e.flujoLMin), co = num(e.gastoCardiacoLMin), sao2 = num(e.saO2), preSvo2 = num(e.preOxiSvO2)
  const señales: Señal[] = []
  let ratio: number | null = null
  if (flujo !== null && co !== null && co > 0) {
    ratio = r1(flujo / co)
    if (sao2 !== null && sao2 < 88 && ratio < 0.6) señales.push({ nivel: 'alta', parametro: 'flujo/CO', mensaje: `SaO2 ${sao2}% con flujo/CO ${ratio}: el gasto nativo supera al flujo ECMO (más shunt). Valorar subir flujo o reducir demanda/CO.` })
  }
  if (sao2 !== null && preSvo2 !== null && sao2 < 90 && preSvo2 > 75) {
    señales.push({ nivel: 'alta', parametro: 'recirculación', mensaje: `SaO2 baja (${sao2}%) con SvO2 pre-oxigenador alta (${preSvo2}%): PATRÓN de posible RECIRCULACIÓN. Revisar posición/separación de cánulas. No confirma recirculación por sí solo.` })
  }
  const sweep = num(e.sweepLMin), paco2 = num(e.paco2)
  if (sweep !== null && paco2 !== null && paco2 > 50) señales.push({ nivel: 'moderada', parametro: 'sweep/CO2', mensaje: `PaCO2 ${paco2} con sweep ${sweep} L/min: el barrido controla la CO2; ajustar sweep según objetivo.` })
  if (flujo === null && co === null && sao2 === null && preSvo2 === null) {
    return { ok: false, bloqueado: true, motivoBloqueo: 'Faltan datos de VV (flujo/CO/SaO2/SvO2)', ratioFlujoCO: null, señales: [], interpretacion: '', fuenteId: 'elsoGeneral2021' }
  }
  return { ok: true, bloqueado: false, motivoBloqueo: null, ratioFlujoCO: ratio, señales, interpretacion: ratio !== null ? `Flujo/CO ${ratio}.` : 'VV-ECMO evaluado con los datos disponibles.', fuenteId: 'elsoGeneral2021' }
}

/* ── VA-ECMO: hipoxia diferencial / distensión de VI ── */
export interface EntradaVA {
  spo2ManoDerecha?: number | string     // territorio pre-ductal (corazón/cerebro)
  spo2MiembroInferior?: number | string  // territorio ECMO (post-oxigenador)
  paO2Postoxigenador?: number | string
  pas?: number | string
  pad?: number | string
  valvulaAorticaAbre?: boolean            // apertura aórtica en eco
  edemaPulmonar?: boolean                 // líneas B / radiografía
}
export interface ResultadoVA {
  ok: boolean
  bloqueado: boolean
  motivoBloqueo: string | null
  pulsatilidadMmHg: number | null
  señales: Señal[]
  interpretacion: string
  fuenteId: string
}
/**
 * VA-ECMO periférico femoral. Vigila (a) HIPOXIA DIFERENCIAL / Harlequin: sangre
 * mal oxigenada del VI nativo perfunde la parte superior (mano derecha) mientras
 * el ECMO oxigena la inferior → SpO2 mano derecha << inferior; pedir gasometría
 * de radial DERECHA. (b) DISTENSIÓN DE VI: baja pulsatilidad (pulso ≈ PAS−PAD),
 * válvula aórtica que no abre y edema pulmonar → valorar descarga (venting).
 * Detecta el patrón; no ejecuta ni confirma conducta.
 */
export function evaluarVA(e: EntradaVA): ResultadoVA {
  const spD = num(e.spo2ManoDerecha), spI = num(e.spo2MiembroInferior)
  const pas = num(e.pas), pad = num(e.pad)
  const señales: Señal[] = []

  if (spD !== null && spI !== null && (spI - spD) >= 5) {
    señales.push({ nivel: 'alta', parametro: 'hipoxia diferencial', mensaje: `SpO2 mano derecha ${spD}% < miembro inferior ${spI}% (Δ ${spI - spD}): PATRÓN de hipoxia diferencial (Harlequin). Tomar gasometría de radial DERECHA; valorar oxigenación nativa/ventilador o conversión de configuración.` })
  } else if (spD !== null && spD < 90) {
    señales.push({ nivel: 'moderada', parametro: 'oxigenación pre-ductal', mensaje: `SpO2 mano derecha ${spD}% baja: vigilar hipoxia diferencial; comparar con territorio ECMO y gasometría de radial derecha.` })
  }

  let pulso: number | null = null
  if (pas !== null && pad !== null) {
    pulso = pas - pad
    const distension = pulso < 15 || e.valvulaAorticaAbre === false
    if (distension) {
      const motivos = [pulso < 15 ? `pulsatilidad ${pulso} mmHg baja` : null, e.valvulaAorticaAbre === false ? 'válvula aórtica no abre' : null, e.edemaPulmonar === true ? 'edema pulmonar' : null].filter(Boolean).join(', ')
      señales.push({ nivel: 'alta', parametro: 'distensión de VI', mensaje: `Signos de distensión del VI (${motivos}): valorar DESCARGA ventricular (venting) y presiones de llenado. No inicia venting automáticamente.` })
    }
  }

  if (spD === null && spI === null && pas === null && pad === null) {
    return { ok: false, bloqueado: true, motivoBloqueo: 'Faltan datos de VA (SpO2 diferencial y presiones)', pulsatilidadMmHg: null, señales: [], interpretacion: '', fuenteId: 'elsoGeneral2021' }
  }
  return { ok: true, bloqueado: false, motivoBloqueo: null, pulsatilidadMmHg: pulso, señales, interpretacion: pulso !== null ? `Pulsatilidad ${pulso} mmHg.` : 'VA-ECMO evaluado con los datos disponibles.', fuenteId: 'elsoGeneral2021' }
}

/* ── Orquestador ── */
export interface EntradaECMO extends EntradaOxigenador, EntradaHemolisis, EntradaVV, EntradaVA {
  config?: ConfigECMO
}
export interface ResultadoECMO {
  version: string
  config: ConfigECMO | null
  oxigenador: ResultadoOxigenador
  hemolisis: ResultadoHemolisis
  vv: ResultadoVV | null
  va: ResultadoVA | null
  señales: Señal[]
}
const ordenN: Record<Señal['nivel'], number> = { critica: 0, alta: 1, moderada: 2, informativa: 3 }
/** Corre la vigilancia de ECMO según la configuración y consolida las señales. */
export function analizarECMO(e: EntradaECMO): ResultadoECMO {
  const oxigenador = vigilanciaOxigenador(e)
  const hemolisis = panelHemolisis(e)
  const vv = (e.config === 'VV' || e.config === 'VAV') ? evaluarVV(e) : null
  const va = (e.config === 'VA' || e.config === 'VAV') ? evaluarVA(e) : null
  const señales = [
    ...oxigenador.señales, ...hemolisis.señales,
    ...(vv?.señales ?? []), ...(va?.señales ?? []),
  ].sort((a, b) => ordenN[a.nivel] - ordenN[b.nivel])
  return { version: ECMO_ENGINE_VERSION, config: e.config ?? null, oxigenador, hemolisis, vv, va, señales }
}
