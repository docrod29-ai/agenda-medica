import { num } from './num'
/**
 * MOTOR DETERMINISTA NEUROCRÍTICO (Brain ICU) — ICU OS.
 *
 * Funciones PURAS, versionadas y probadas. El LLM NUNCA calcula: entrega los
 * números (PIC, PAM, Na, osmolaridad, PaCO2, temperatura, pupilas) y aquí se
 * razona por reglas ancladas a la Brain Trauma Foundation (BTF 2016) y práctica
 * estándar. Si falta el dato invalidante, BLOQUEA. No ejecuta terapia osmolar ni
 * hiperventilación: detecta el estado y las banderas, el médico decide.
 *
 * Fórmulas: PPC = PAM − PIC. Metas: PPC 60–70 mmHg; PIC tratar > 22 mmHg;
 * normocapnia 35–45 (hiperventilación 30–35 solo de rescate por herniación);
 * osmolaridad < 320; evitar Na > 160; evitar fiebre.
 */

export const NEURO_ENGINE_VERSION = '1.1.0'  // icu-006: GCS no valorable en intubado → RASS


export type Pupilas = 'isocoricas' | 'anisocoria' | 'fijas'

export interface Bandera { nivel: 'critica' | 'alta' | 'moderada' | 'informativa'; parametro: string; mensaje: string; fuenteId?: string }

/** Presión de perfusión cerebral = PAM − PIC. Meta 60–70 mmHg (BTF). */
export function presionPerfusionCerebral(mapMmHg?: number | string, picMmHg?: number | string): { ok: boolean; valor: number | null; motivoBloqueo: string | null; interpretacion: string; fuenteId: string } {
  const map = num(mapMmHg), pic = num(picMmHg)
  if (map === null || pic === null) return { ok: false, valor: null, motivoBloqueo: 'Faltan PAM o PIC para la PPC', interpretacion: '', fuenteId: 'btf2016' }
  const ppc = map - pic
  const interp = ppc < 60 ? `PPC ${ppc} < 60: hipoperfusión cerebral (riesgo isquémico)`
    : ppc <= 70 ? `PPC ${ppc}: en meta (60–70)`
    : `PPC ${ppc} > 70: evitar forzarla con líquidos/vasopresores (riesgo de SDRA; BTF)`
  return { ok: true, valor: ppc, motivoBloqueo: null, interpretacion: interp, fuenteId: 'btf2016' }
}

export interface EntradaNeuro {
  mapMmHg?: number | string
  pic?: number | string
  glasgow?: number | string
  pupilas?: Pupilas
  paco2?: number | string
  temperatura?: number | string
  sodio?: number | string
  osmolaridad?: number | string
  intubado?: boolean          // vía aérea artificial → el verbal del GCS NO es valorable
  rass?: number | string      // Richmond Agitation-Sedation Scale (−5…+4)
}

/**
 * Interpreta el RASS (Richmond Agitation-Sedation Scale, −5 a +4). Es la escala de
 * SEDACIÓN del paciente intubado/sedado — mide agitación/profundidad de sedación,
 * NO el nivel de conciencia por lesión (para eso está el GCS, no valorable si hay
 * tubo). Meta habitual: sedación ligera 0 a −2 (PADIS 2018); la sedación profunda
 * se asocia a más ventilación y delirium y debe justificarse.
 */
export function interpretarRASS(rass?: number | string): { ok: boolean; valor: number | null; etiqueta: string; interpretacion: string; fuenteId: string } {
  const r = num(rass)
  if (r === null) return { ok: false, valor: null, etiqueta: '', interpretacion: '', fuenteId: 'padis2018' }
  const rr = Math.max(-5, Math.min(4, Math.round(r)))
  const ETIQUETAS: Record<number, string> = {
    4: 'Combativo', 3: 'Muy agitado', 2: 'Agitado', 1: 'Inquieto', 0: 'Alerta y tranquilo',
    [-1]: 'Somnoliento', [-2]: 'Sedación ligera', [-3]: 'Sedación moderada', [-4]: 'Sedación profunda', [-5]: 'Sin respuesta',
  }
  const etiqueta = ETIQUETAS[rr] ?? `RASS ${rr}`
  const signo = rr > 0 ? `+${rr}` : `${rr}`
  let interpretacion: string
  if (rr >= 2) interpretacion = `RASS ${signo} (${etiqueta}): agitación. Descartar dolor, delirium, hipoxia o abstinencia antes de subir sedación.`
  else if (rr >= -2) interpretacion = `RASS ${signo} (${etiqueta}): dentro de la meta habitual de sedación ligera (0 a −2); permite valorar al paciente y despertar diario.`
  else interpretacion = `RASS ${signo} (${etiqueta}): sedación profunda. Asociada a más días de ventilación y delirium; justifícala (HTIC, SDRA grave con bloqueo, estatus) o alígerala (PADIS 2018).`
  return { ok: true, valor: rr, etiqueta, interpretacion, fuenteId: 'padis2018' }
}

export interface ResultadoNeuro {
  version: string
  ppc: { ok: boolean; valor: number | null; motivoBloqueo: string | null; interpretacion: string; fuenteId: string }
  picEstado: string | null
  rass: { ok: boolean; valor: number | null; etiqueta: string; interpretacion: string; fuenteId: string }
  gcsValorable: boolean       // false si está intubado (verbal no valorable)
  banderas: Bandera[]
  fuenteId: string
}

const ordenN: Record<Bandera['nivel'], number> = { critica: 0, alta: 1, moderada: 2, informativa: 3 }

/** Analiza el estado neurocrítico y devuelve PPC + banderas jerarquizadas. */
export function analizarNeuro(e: EntradaNeuro): ResultadoNeuro {
  const ppc = presionPerfusionCerebral(e.mapMmHg, e.pic)
  const banderas: Bandera[] = []
  const pic = num(e.pic)
  let picEstado: string | null = null
  if (pic !== null) {
    if (pic > 22) { picEstado = 'PIC elevada (> 22): tratar'; banderas.push({ nivel: 'critica', parametro: 'PIC', mensaje: `PIC ${pic} mmHg > 22: hipertensión intracraneal, iniciar/escalar medidas (BTF).`, fuenteId: 'btf2016' }) }
    else if (pic >= 15) picEstado = 'PIC en zona alta (15–22): vigilar'
    else picEstado = 'PIC normal (< 15)'
  }
  if (e.pupilas === 'fijas') banderas.push({ nivel: 'critica', parametro: 'pupilas', mensaje: 'Pupilas fijas: sospecha de herniación; medida urgente y neuroimagen.', fuenteId: 'btf2016' })
  else if (e.pupilas === 'anisocoria') banderas.push({ nivel: 'alta', parametro: 'pupilas', mensaje: 'Anisocoria: descartar lesión expansiva/herniación; correlacionar con PIC y TAC.', fuenteId: 'btf2016' })

  const paco2 = num(e.paco2)
  if (paco2 !== null) {
    if (paco2 < 30) banderas.push({ nivel: 'alta', parametro: 'PaCO2', mensaje: `PaCO2 ${paco2} < 30: hiperventilación profunda = vasoconstricción/isquemia; reservar 30–35 solo de rescate por herniación (BTF).`, fuenteId: 'btf2016' })
    else if (paco2 > 45) banderas.push({ nivel: 'moderada', parametro: 'PaCO2', mensaje: `PaCO2 ${paco2} > 45: hipercapnia sube la PIC; buscar normocapnia (35–45).`, fuenteId: 'btf2016' })
  }
  const temp = num(e.temperatura)
  if (temp !== null && temp >= 38) banderas.push({ nivel: 'moderada', parametro: 'temperatura', mensaje: `Temperatura ${temp} °C: la fiebre aumenta la demanda y la PIC; control activo.` })
  const na = num(e.sodio)
  if (na !== null && na > 160) banderas.push({ nivel: 'alta', parametro: 'sodio', mensaje: `Na ${na} > 160: límite de la terapia hiperosmolar; riesgo de complicaciones.` })
  const osm = num(e.osmolaridad)
  if (osm !== null && osm > 320) banderas.push({ nivel: 'moderada', parametro: 'osmolaridad', mensaje: `Osmolaridad ${osm} > 320: techo del manitol (riesgo renal); valorar salino hipertónico.` })
  // ── Conciencia vs sedación (icu-006) ──
  // En el paciente INTUBADO el componente VERBAL del GCS no es valorable: un
  // "GCS 15" con tubo es incoherente. Se monitorea la sedación con RASS. Reportar
  // el GCS como "T" (verbal no valorable) y no dejar que sobreestime la conciencia.
  const rass = interpretarRASS(e.rass)
  const gcs = num(e.glasgow)
  const intubado = e.intubado === true
  if (intubado) {
    if (gcs !== null && gcs >= 11) {
      banderas.push({ nivel: 'moderada', parametro: 'Glasgow', mensaje: `GCS ${gcs} en paciente intubado es incoherente: el componente verbal NO es valorable (repórtalo como "T", p. ej. O4 VT M6). La conciencia con tubo se sigue por RASS, no por GCS.` })
    }
    if (!rass.ok) {
      banderas.push({ nivel: 'moderada', parametro: 'RASS', mensaje: 'Paciente intubado sin RASS registrado: usa la escala RASS (−5 a +4) para monitorear la sedación; el GCS no la sustituye.' })
    } else if (rass.valor !== null && rass.valor <= -3) {
      banderas.push({ nivel: 'moderada', parametro: 'RASS', mensaje: rass.interpretacion, fuenteId: 'padis2018' })
    }
  } else if (gcs !== null && gcs <= 8) {
    banderas.push({ nivel: 'alta', parametro: 'Glasgow', mensaje: `Glasgow ${gcs} ≤ 8: coma; asegurar vía aérea y valorar monitoreo de PIC.`, fuenteId: 'btf2016' })
  }

  banderas.sort((a, b) => ordenN[a.nivel] - ordenN[b.nivel])
  return { version: NEURO_ENGINE_VERSION, ppc, picEstado, rass, gcsValorable: !intubado, banderas, fuenteId: 'btf2016' }
}
