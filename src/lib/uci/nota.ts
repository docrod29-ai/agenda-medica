/**
 * CONSTRUCTOR DETERMINISTA DE LA NOTA DE EVOLUCIÓN UCI (por aparatos y sistemas).
 *
 * Toma los valores capturados en el Panel UCI (a mano o dictados) y los pasa por
 * los MOTORES deterministas (ventilación, gasometría, hemodinamia, SOFA, POCUS).
 * Devuelve las secciones de la nota `evolucion_uci` ya redactadas. NUNCA inventa:
 * una sección solo incluye una línea si su dato existe; el LLM no calcula nada.
 * El plan queda para el médico. El texto es un BORRADOR que el médico revisa y firma.
 */
import { analizarVentilacion } from './ventilacion'
import { analizarGasometria } from './gasometria'
import { presionArterialMedia } from './hemodinamia'
import { calcularSOFA } from './scores'
import { vexus, respuestaPLR, disfuncionVD_TAPSE, sobrecargaVD_VDVI, lineasB, type PatronVena, type ParametroPLR } from './pocus'

export const UCI_NOTA_VERSION = '1.0.0'

export interface SeccionNota { key: string; label: string; value: string }

const MODO_LABEL: Record<string, string> = {
  'AC-VC': 'Asistido-controlado por volumen (A/C VC)',
  'AC-PC': 'Asistido-controlado por presión (A/C PC)',
  SIMV: 'SIMV',
  PSV: 'Presión soporte (PSV)',
  CPAP: 'CPAP',
  APRV: 'APRV / BiVent',
  VNI: 'Ventilación no invasiva (BiPAP)',
  AFNC: 'Cánula nasal de alto flujo',
  aire: 'Aire ambiente / O₂ suplementario',
}

type Campos = Record<string, string>
const val = (v: Campos, k: string): string | undefined => (v[k] === undefined || v[k] === '' ? undefined : v[k])
const patron = (v: Campos, k: string): PatronVena | undefined => (v[k] === 'normal' || v[k] === 'leve' || v[k] === 'grave' ? (v[k] as PatronVena) : undefined)
/** Une líneas no vacías; devuelve '' si no hubo ninguna (sección queda vacía). */
const join = (xs: (string | null | undefined)[]): string => xs.filter((x): x is string => !!x && x.trim() !== '').join('\n')

/**
 * Construye las 10 secciones de la nota de evolución UCI desde los valores crudos.
 * `opts.dia` (día de UCI), `opts.discusion` (pase multi-voz etiquetado por rol).
 */
export function construirSeccionesUCI(v: Campos, opts?: { dia?: string; discusion?: string }): SeccionNota[] {
  const n = (k: string) => val(v, k)

  const vent = analizarVentilacion({
    sexo: v.sexo === 'F' ? 'F' : v.sexo === 'M' ? 'M' : undefined, tallaCm: n('talla'), vtMl: n('vt'),
    fio2: n('fio2'), fio2Unidad: '%', pplat: n('pplat'), peep: n('peep'), autoPeep: n('autoPeep'),
    pao2: n('pao2'), muestraGasometria: (v.muestra as 'arterial' | 'venosa' | 'capilar') || undefined,
  })
  const gaso = analizarGasometria({ ph: n('ph'), paco2: n('paco2'), hco3: n('hco3'), na: n('na'), cl: n('cl'), albumina: n('alb') })
  const pam = presionArterialMedia(n('pas'), n('pad'))
  const sofa = calcularSOFA({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor ?? undefined : undefined, soporteRespiratorio: v.soporte === 'si',
    plaquetas: n('plaquetas'), bilirrubina: n('bili'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    norepinefrina: n('norepi'), glasgow: n('glasgow'), creatinina: n('creat'),
  })
  const vex = vexus({ vciCm: n('vci'), hepatica: patron(v, 'vHep'), porta: patron(v, 'vPor'), renal: patron(v, 'vRen') })
  const plr = respuestaPLR(n('plrDelta'), (v.plrParam as ParametroPLR) || undefined)
  const tapse = disfuncionVD_TAPSE(n('tapse'))
  const vdvi = sobrecargaVD_VDVI(n('vdvi'))
  const lb = lineasB(n('lineasB'))

  // ── Contexto ──
  const contexto = join([
    opts?.dia ? `Día de UCI: ${opts.dia}.` : null,
    n('modo') ? `Modo ventilatorio: ${MODO_LABEL[v.modo] ?? v.modo}.` : null,
    (sofa.total != null) ? `SOFA ${sofa.total}${sofa.parcial ? ' (parcial, con los datos disponibles)' : ''}.` : null,
  ])

  // ── Neurológico ──
  const neurologico = join([
    n('glasgow') ? `Glasgow ${v.glasgow}.` : null,
  ])

  // ── Respiratorio ──
  const respiratorio = join([
    n('modo') ? `Modo: ${MODO_LABEL[v.modo] ?? v.modo}.` : null,
    n('fio2') ? `FiO₂ ${v.fio2}%.` : null,
    n('fr') ? `FR ${v.fr} rpm.` : null,
    n('vt') ? `VT ${v.vt} mL${vent.vtPorPbw.ok ? ` (${vent.vtPorPbw.valor} mL/kg PBW — ${vent.vtPorPbw.interpretacion})` : ''}.` : null,
    n('peep') ? `PEEP ${v.peep}${n('autoPeep') ? ` + auto-PEEP ${v.autoPeep}` : ''} cmH₂O.` : null,
    n('ppico') ? `P. pico ${v.ppico} cmH₂O.` : null,
    n('pplat') ? `Pplateau ${v.pplat} cmH₂O.` : null,
    n('psoporte') ? `Presión soporte ${v.psoporte} cmH₂O.` : null,
    n('ie') ? `Relación I:E ${v.ie}.` : null,
    vent.drivingPressure.ok ? `Driving pressure ${vent.drivingPressure.valor} cmH₂O (${vent.drivingPressure.interpretacion}).` : null,
    vent.complianceEstatica.ok ? `Compliance estática ${vent.complianceEstatica.valor} mL/cmH₂O (${vent.complianceEstatica.interpretacion}).` : null,
    vent.indiceKirby.ok ? `PaO₂/FiO₂ ${vent.indiceKirby.valor} — ${(vent.indiceKirby.interpretacion ?? '').split('.')[0]}.` : null,
    n('spo2') ? `SpO₂ ${v.spo2}%.` : null,
    gaso.ok ? `Gasometría: ${gaso.interpretacion.split('.')[0]}.` : null,
  ])

  // ── Hemodinámico ──
  const hemodinamico = join([
    (n('pas') && n('pad')) ? `TA ${v.pas}/${v.pad} mmHg${pam.ok ? ` (PAM ${pam.valor} mmHg)` : ''}.` : null,
    n('norepi') ? `Norepinefrina ${v.norepi} µg/kg/min.` : null,
    n('lactato') ? `Lactato ${v.lactato} mmol/L.` : null,
    plr.ok ? `PLR: ${plr.interpretacion.split('.')[0]}.` : null,
    tapse.ok ? `TAPSE ${tapse.valor} mm (${tapse.hallazgo}).` : null,
    vdvi.ok ? `VD/VI ${vdvi.valor} (${vdvi.hallazgo}).` : null,
  ])

  // ── Renal e hidrometabólico ──
  const renal = join([
    n('creat') ? `Creatinina ${v.creat} mg/dL.` : null,
    n('na') ? `Na ${v.na}.` : null,
    n('k') ? `K ${v.k}.` : null,
    n('cl') ? `Cl ${v.cl}.` : null,
    gaso.ok ? `Ácido-base: ${gaso.interpretacion.split('.')[0]}${gaso.mixto ? ' (MIXTO)' : ''}${gaso.compensacion.comentario ? ` — ${gaso.compensacion.comentario}` : ''}.` : null,
    (gaso.ok && gaso.anionGap.valor != null) ? `Anion gap ${gaso.anionGap.corregidoAlbumina ?? gaso.anionGap.valor}${gaso.anionGap.corregidoAlbumina != null ? ' (corregido)' : ''}${gaso.anionGap.elevado ? ' — elevado' : ''}.` : null,
  ])

  // ── Hematológico e infeccioso ──
  const hemato = join([
    n('plaquetas') ? `Plaquetas ${v.plaquetas} ×10³.` : null,
    n('bili') ? `Bilirrubina ${v.bili} mg/dL.` : null,
  ])

  // ── Ultrasonido crítico (POCUS) ──
  const ultrasonido = join([
    vex.ok ? `VExUS-C ${vex.hallazgo}: ${vex.interpretacion.split('.')[0]}.` : (vex.bloqueado && (n('vci') || patron(v, 'vHep') || patron(v, 'vPor') || patron(v, 'vRen')) ? `VExUS: ${vex.motivoBloqueo}.` : null),
    n('vci') ? `VCI ${v.vci} cm.` : null,
    lb.ok ? `Líneas B: ${lb.interpretacion.split(':').slice(1).join(':').trim() || lb.hallazgo}.` : null,
    plr.ok ? `Respuesta a precarga (PLR): ${plr.hallazgo}.` : null,
    'Ninguna medición aislada decide conducta.',
  ])

  const secciones: SeccionNota[] = [
    { key: 'contexto', label: 'Contexto y objetivos del día', value: contexto },
    { key: 'neurologico', label: 'Neurológico', value: neurologico },
    { key: 'respiratorio', label: 'Respiratorio', value: respiratorio },
    { key: 'hemodinamico', label: 'Hemodinámico y cardiovascular', value: hemodinamico },
    { key: 'renal_metabolico', label: 'Renal e hidrometabólico', value: renal },
    { key: 'gastrointestinal', label: 'Gastrointestinal y nutrición', value: '' },
    { key: 'hematoinfeccioso', label: 'Hematológico e infeccioso', value: hemato },
    { key: 'piel_dispositivos', label: 'Piel, músculo y dispositivos', value: '' },
    { key: 'ultrasonido', label: 'Ultrasonido crítico (POCUS)', value: ultrasonido },
    { key: 'plan', label: 'Plan por sistema', value: opts?.discusion ? `Discusión del pase:\n${opts.discusion}` : '' },
  ]
  return secciones
}
