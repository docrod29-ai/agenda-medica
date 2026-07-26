/**
 * ICU COPILOT — capa de RAZONAMIENTO sobre los motores deterministas (ICU OS).
 *
 * Contrato inviolable: el Copilot NO calcula escalas ni dosis. Recibe SOLO las
 * SALIDAS de los motores deterministas (ventilación, gasometría, PAM, SOFA, POCUS,
 * CKRT, ECMO, alertas) y las SINTETIZA en un plan por sistemas: qué cambió, por qué
 * puede haber cambiado, qué soporte sostiene al paciente y qué falta para decidir el
 * siguiente paso. Todo con provenance (qué valor usó) e incertidumbre explícita, y
 * SIN órdenes terapéuticas automáticas. El médico decide y firma.
 *
 * Este archivo es PURO y testeable: arma el snapshot y los prompts, y fusiona las
 * dos opiniones (Anthropic + OpenAI). La llamada a los modelos vive en la ruta.
 */
import { analizarVentilacion } from './ventilacion'
import { analizarGasometria } from './gasometria'
import { presionArterialMedia } from './hemodinamia'
import { calcularSOFA } from './scores'
import { vexus, respuestaPLR, disfuncionVD_TAPSE, sobrecargaVD_VDVI, lineasB, type PatronVena, type ParametroPLR } from './pocus'
import { analizarCKRT, analizarCitrato, type ModalidadCKRT } from './ckrt'
import { analizarECMO, type ConfigECMO } from './ecmo'
import { analizarNeuro, type Pupilas } from './neuro'
import { analizarSeguridadUCI } from './seguridad'

export const COPILOT_VERSION = '1.0.0'

type Campos = Record<string, string>
const val = (v: Campos, k: string): string | undefined => (v[k] === undefined || v[k] === '' ? undefined : v[k])
const patron = (v: Campos, k: string): PatronVena | undefined => (v[k] === 'normal' || v[k] === 'leve' || v[k] === 'grave' ? (v[k] as PatronVena) : undefined)

/** Snapshot DETERMINISTA: pasa los campos crudos por los motores y devuelve solo
 *  sus salidas (lo único que el LLM podrá ver y sintetizar). Sin PHI. */
export function snapshotUCI(v: Campos) {
  const n = (k: string) => val(v, k)
  const vent = analizarVentilacion({
    sexo: v.sexo === 'F' ? 'F' : v.sexo === 'M' ? 'M' : undefined, tallaCm: n('talla'), vtMl: n('vt'),
    fio2: n('fio2'), fio2Unidad: '%', pplat: n('pplat'), peep: n('peep'), autoPeep: n('autoPeep'),
    pao2: n('pao2'), muestraGasometria: (v.muestra as 'arterial' | 'venosa' | 'capilar') || undefined,
  })
  const gaso = analizarGasometria({ ph: n('ph'), paco2: n('paco2'), hco3: n('hco3'), na: n('na'), cl: n('cl'), albumina: n('alb') })
  const pam = presionArterialMedia(n('pas'), n('pad'))
  const sofa = calcularSOFA({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor ?? undefined : undefined,
    soporteRespiratorio: ['si', 'sí', 'true', '1'].includes((v.soporte || '').trim().toLowerCase()),
    plaquetas: n('plaquetas'), bilirrubina: n('bili'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    norepinefrina: n('norepi'), dopamina: n('dopa'), dobutamina: n('dobu'), epinefrina: n('epi'),
    glasgow: n('glasgow'), creatinina: n('creat'),
  })
  const alertas = analizarSeguridadUCI({
    ph: n('ph'), glucosa: n('glucosa'), potasio: n('k'), sodio: n('na'),
    pam: pam.ok ? pam.valor ?? undefined : undefined,
    pplat: n('pplat'), drivingPressure: vent.drivingPressure.ok ? vent.drivingPressure.valor ?? undefined : undefined,
    vtPorPbw: vent.vtPorPbw.ok ? vent.vtPorPbw.valor ?? undefined : undefined, spo2: n('spo2'), fio2: vent.fio2.valor ?? undefined,
    lactato: n('lactato'),
  })
  const pocus = {
    vexus: vexus({ vciCm: n('vci'), hepatica: patron(v, 'vHep'), porta: patron(v, 'vPor'), renal: patron(v, 'vRen') }),
    plr: respuestaPLR(n('plrDelta'), (v.plrParam as ParametroPLR) || undefined),
    tapse: disfuncionVD_TAPSE(n('tapse')), vdvi: sobrecargaVD_VDVI(n('vdvi')), lineasB: lineasB(n('lineasB')),
  }
  const ckrt = analizarCKRT({
    modalidad: (v.ckrtMod as ModalidadCKRT) || undefined, pesoKg: n('ckrtPeso'), qbMlMin: n('ckrtQb'),
    dializadoMlH: n('ckrtDial'), reposicionPreMlH: n('ckrtPre'), reposicionPostMlH: n('ckrtPost'),
    ufNetaMlH: n('ckrtUf'), hematocrito: n('ckrtHto'), tiempoActivoH: n('ckrtHoras'),
  })
  const citrato = analizarCitrato({ caIonicoSistemico: n('ciCaSis'), caPostfiltro: n('ciCaPost'), caTotal: n('ciCaTot') })
  const ecmo = analizarECMO({
    config: (v.ecmoConf as ConfigECMO) || undefined,
    presionPre: n('ecmoPre'), presionPost: n('ecmoPost'), deltaPBasal: n('ecmoBasal'),
    plasmaFreeHb: n('ecmoPfhb'), ldh: n('ecmoLdh'), haptoglobina: n('ecmoHapto'),
    flujoLMin: n('ecmoFlujo'), gastoCardiacoLMin: n('ecmoCo'), saO2: n('ecmoSao2'), preOxiSvO2: n('ecmoSvo2'), sweepLMin: n('ecmoSweep'), paco2: n('ecmoPaco2'),
    spo2ManoDerecha: n('ecmoSpD'), spo2MiembroInferior: n('ecmoSpI'), pas: n('ecmoPas'), pad: n('ecmoPad'),
    valvulaAorticaAbre: v.ecmoValv === 'si' ? true : v.ecmoValv === 'no' ? false : undefined,
    edemaPulmonar: v.ecmoEdema === 'si' ? true : v.ecmoEdema === 'no' ? false : undefined,
  })
  const neuro = analizarNeuro({
    mapMmHg: pam.ok ? pam.valor ?? undefined : undefined, pic: n('pic'), glasgow: n('glasgow'),
    pupilas: (v.pupilas as Pupilas) || undefined, paco2: n('paco2'), temperatura: n('temp'), sodio: n('na'), osmolaridad: n('osm'),
  })
  return { version: COPILOT_VERSION, ventilacion: vent, gasometria: gaso, pam, sofa, alertas, pocus, ckrt, citrato, ecmo, neuro }
}

export const COPILOT_SYSTEM = `Eres el COPILOT de una Unidad de Cuidados Intensivos dentro de NexusMED. Trabajas para un médico intensivista.

REGLAS ABSOLUTAS (no negociables):
1. NO calculas NADA. Los valores (SOFA, P/F, driving pressure, PAM, VExUS, dosis CKRT, ΔP de ECMO, etc.) YA los calcularon motores deterministas y te llegan en el JSON. Úsalos tal cual; jamás recalcules ni "corrijas" un número.
2. Si un motor viene "bloqueado" o falta un dato, NO lo inventes: decláralo como dato faltante.
3. NO das órdenes terapéuticas ejecutables ni dosis nuevas. Sugieres CONSIDERACIONES y qué VERIFICAR/DECIDIR; el médico decide y firma.
4. Cada afirmación cita el/los valores en que se apoya (provenance) y expresa INCERTIDUMBRE cuando la haya. Ninguna medición aislada decide conducta.

TU TAREA: sintetizar el estado por SISTEMAS respondiendo, para cada problema: (a) QUÉ cambió/está alterado, (b) POR QUÉ puede estar pasando (fisiología), (c) QUÉ SOPORTE lo sostiene, (d) QUÉ FALTA para decidir el siguiente paso.

Responde SOLO con JSON válido, sin texto fuera del JSON, con este esquema:
{
  "resumen": "1-3 frases de la situación global",
  "problemas": [
    { "sistema": "neurologico|respiratorio|hemodinamico|abdominodigestivo|hidrometabolico|hematoinfeccioso|musculoesqueletico",
      "titulo": "problema en pocas palabras",
      "cambio": "qué está alterado (con el valor)",
      "porque": "hipótesis fisiológica, con incertidumbre",
      "soporte": "qué soporte/tratamiento lo sostiene (o 'ninguno documentado')",
      "faltante": "qué dato falta para decidir (o '')",
      "prioridad": "alta|media|baja" }
  ],
  "faltantesClave": ["datos que más limitan la decisión ahora"],
  "seguridad": ["banderas de seguridad a verificar, si las hay"]
}`

/** Arma el mensaje de usuario: el snapshot determinista + contexto opcional. */
export function buildCopilotUser(snapshot: unknown, opts?: { discusion?: string; tendencias?: string; preferencias?: string[] }): string {
  const partes = [
    'SNAPSHOT DETERMINISTA (salidas de los motores; sintetiza, no recalcules):',
    '```json', JSON.stringify(snapshot), '```',
  ]
  if (opts?.tendencias) partes.push('\nTENDENCIAS (valores previos → actuales):\n' + opts.tendencias)
  if (opts?.discusion) partes.push('\nDISCUSIÓN DEL PASE (adscritos/residentes, contexto, NO órdenes):\n' + opts.discusion)
  if (opts?.preferencias && opts.preferencias.length) {
    partes.push('\nPREFERENCIAS DE ESTE MÉDICO (aprendidas de su feedback previo; respétalas en estilo/énfasis, nunca en seguridad):')
    partes.push(opts.preferencias.map(p => '- ' + p).join('\n'))
  }
  return partes.join('\n')
}

export interface ProblemaCopilot {
  sistema: string; titulo: string; cambio: string; porque: string; soporte: string; faltante: string; prioridad: 'alta' | 'media' | 'baja'
}
export interface SalidaCopilot {
  resumen: string; problemas: ProblemaCopilot[]; faltantesClave: string[]; seguridad: string[]
}

/** Extrae el JSON de una respuesta de modelo (tolerante a texto alrededor). */
export function parseSalidaCopilot(texto: string): SalidaCopilot | null {
  const m = texto.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0]) as Partial<SalidaCopilot>
    return {
      resumen: typeof o.resumen === 'string' ? o.resumen : '',
      problemas: Array.isArray(o.problemas) ? o.problemas as ProblemaCopilot[] : [],
      faltantesClave: Array.isArray(o.faltantesClave) ? o.faltantesClave as string[] : [],
      seguridad: Array.isArray(o.seguridad) ? o.seguridad as string[] : [],
    }
  } catch { return null }
}

export interface FusionCopilot {
  primario: SalidaCopilot | null
  segunda: SalidaCopilot | null
  /** Problemas que la 2ª opinión (OpenAI) planteó y el primario NO (por sistema). */
  divergencias: ProblemaCopilot[]
  modelos: { primario: string | null; segunda: string | null }
}

/**
 * Fusiona las dos opiniones. El PRIMARIO (Anthropic) manda; se listan aparte los
 * problemas que la 2ª opinión levantó en sistemas que el primario no tocó, para
 * que el médico vea desacuerdos en vez de un promedio que los oculte.
 */
export function fusionarCopilot(primario: SalidaCopilot | null, segunda: SalidaCopilot | null, modelos: { primario: string | null; segunda: string | null }): FusionCopilot {
  const sistemasPrim = new Set((primario?.problemas ?? []).map(p => p.sistema))
  const divergencias = (segunda?.problemas ?? []).filter(p => !sistemasPrim.has(p.sistema))
  return { primario, segunda, divergencias, modelos }
}
