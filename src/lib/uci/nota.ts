/**
 * CONSTRUCTOR DETERMINISTA DE LA NOTA DE EVOLUCIÓN UCI (por aparatos y sistemas).
 *
 * Toma los valores capturados en el Panel UCI (a mano o dictados) y los pasa por
 * los MOTORES deterministas (ventilación, gasometría, hemodinamia, SOFA, POCUS).
 * Devuelve las secciones de la nota `evolucion_uci` ya redactadas. NUNCA inventa:
 * una sección solo incluye una línea si su dato existe; el LLM no calcula nada.
 * El plan queda para el médico. El texto es un BORRADOR que el médico revisa y firma.
 */
import { analizarVentilacion, esModoEspontaneo, esModoInvasivo } from './ventilacion'
import { analizarGasometria } from './gasometria'
import { presionArterialMedia } from './hemodinamia'
import { calcularSOFA } from './scores'
import { vexus, respuestaPLR, disfuncionVD_TAPSE, sobrecargaVD_VDVI, lineasB, type PatronVena, type ParametroPLR } from './pocus'
import { analizarCKRT, analizarCitrato, type ModalidadCKRT } from './ckrt'
import { analizarECMO, type ConfigECMO } from './ecmo'
import { analizarNeuro, type Pupilas } from './neuro'

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
    esfuerzoEspontaneo: esModoEspontaneo(v.modo),
    pao2: n('pao2'), muestraGasometria: (v.muestra as 'arterial' | 'venosa' | 'capilar') || undefined,
  })
  const gaso = analizarGasometria({ ph: n('ph'), paco2: n('paco2'), hco3: n('hco3'), na: n('na'), cl: n('cl'), albumina: n('alb') })
  const pam = presionArterialMedia(n('pas'), n('pad'))
  const sofa = calcularSOFA({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor ?? undefined : undefined,
    soporteRespiratorio: ['si', 'sí', 'true', '1'].includes((v.soporte || '').trim().toLowerCase()),
    plaquetas: n('plaquetas'), bilirrubina: n('bili'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    // Los 4 vasopresores (igual que el panel y el Copilot): omitir dopa/dobu/epi
    // subestimaba el subscore cardiovascular en la NOTA FIRMADA.
    norepinefrina: n('norepi'), dopamina: n('dopa'), dobutamina: n('dobu'), epinefrina: n('epi'),
    glasgow: n('glasgow'), creatinina: n('creat'),
  })
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
  const intubadoNeuro = esModoInvasivo(v.modo)
  const neuro = analizarNeuro({
    mapMmHg: pam.ok ? pam.valor ?? undefined : undefined, pic: n('pic'), glasgow: n('glasgow'),
    pupilas: (v.pupilas as Pupilas) || undefined, paco2: n('paco2'), temperatura: n('temp'), sodio: n('na'), osmolaridad: n('osm'),
    intubado: intubadoNeuro, rass: n('rass'),
  })
  const neurologico = join([
    // En intubado el verbal se reporta como "T"; un GCS alto (≥11) es incoherente
    // con vía aérea artificial, uno bajo (coma) se conserva con la convención "T".
    n('glasgow')
      ? (intubadoNeuro
          ? (Number(v.glasgow) >= 11
              ? `Glasgow verbal no valorable por vía aérea artificial (reportar como “T”); seguir sedación por RASS.`
              : `Glasgow ${v.glasgow} (intubado, verbal “T”).`)
          : `Glasgow ${v.glasgow}.`)
      : null,
    neuro.rass.ok ? `RASS ${neuro.rass.valor! > 0 ? '+' : ''}${neuro.rass.valor} (${neuro.rass.etiqueta}).` : (intubadoNeuro ? 'RASS no registrado (paciente intubado: monitorizar sedación con RASS).' : null),
    n('pic') ? `PIC ${v.pic} mmHg${neuro.picEstado ? ` (${neuro.picEstado})` : ''}.` : null,
    neuro.ppc.ok ? `PPC ${neuro.ppc.valor} mmHg — ${neuro.ppc.interpretacion.split(':').slice(1).join(':').trim() || neuro.ppc.interpretacion}.` : null,
    v.pupilas ? `Pupilas: ${v.pupilas}.` : null,
    ...neuro.banderas.map(b => `⚠ ${b.mensaje}`),
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
    lb.ok ? `USG pulmonar — líneas B: ${lb.interpretacion.split(':').slice(1).join(':').trim() || lb.hallazgo}.` : null,
    gaso.ok ? `Gasometría: ${gaso.interpretacion.split('.')[0]}.` : null,
    // ECMO veno-venoso (soporte respiratorio) — si la config es VV.
    ecmo.config === 'VV' ? `ECMO VV${ecmo.oxigenador.ok ? ` · ΔP oxigenador ${ecmo.oxigenador.deltaP} mmHg` : ''}.` : null,
    ...(ecmo.config === 'VV' ? ecmo.señales.map(s => `ECMO — ${s.mensaje}`) : []),
  ])

  // ── Hemodinámico (incluye POCUS cardiaco, VExUS/congestión y ECMO VA) ──
  const hemodinamico = join([
    (n('pas') && n('pad')) ? `TA ${v.pas}/${v.pad} mmHg${pam.ok ? ` (PAM ${pam.valor} mmHg)` : ''}.` : null,
    n('norepi') ? `Norepinefrina ${v.norepi} µg/kg/min.` : null,
    n('dopa') ? `Dopamina ${v.dopa} µg/kg/min.` : null,
    n('dobu') ? `Dobutamina ${v.dobu} µg/kg/min.` : null,
    n('epi') ? `Epinefrina ${v.epi} µg/kg/min.` : null,
    n('lactato') ? `Lactato ${v.lactato} mmol/L.` : null,
    tapse.ok ? `TAPSE ${tapse.valor} mm (${tapse.hallazgo}).` : null,
    vdvi.ok ? `VD/VI ${vdvi.valor} (${vdvi.hallazgo}).` : null,
    plr.ok ? `Respuesta a precarga (PLR): ${plr.hallazgo} — ${plr.interpretacion.split('.')[0]}.` : null,
    n('vci') ? `VCI ${v.vci} cm.` : null,
    vex.ok ? `VExUS-C ${vex.hallazgo}: ${vex.interpretacion.split('.')[0]}.` : (vex.bloqueado && (n('vci') || patron(v, 'vHep') || patron(v, 'vPor') || patron(v, 'vRen')) ? `VExUS: ${vex.motivoBloqueo}.` : null),
    (ecmo.config === 'VA' || ecmo.config === 'VAV') ? `ECMO ${ecmo.config}${ecmo.oxigenador.ok ? ` · ΔP oxigenador ${ecmo.oxigenador.deltaP} mmHg` : ''}.` : null,
    // ECMO VV es soporte respiratorio: sus señales van al sistema respiratorio (arriba).
    ...(ecmo.config !== 'VV' ? ecmo.señales.map(s => `ECMO — ${s.mensaje}`) : []),
  ])

  // ── Abdominodigestivo (el médico completa; sin cálculo automático) ──
  const abdominodigestivo = ''

  // ── Hidrometabólico (electrolitos, ácido-base, renal, CKRT/citrato) ──
  const hidrometabolico = join([
    n('na') ? `Na ${v.na}.` : null,
    n('k') ? `K ${v.k}.` : null,
    n('cl') ? `Cl ${v.cl}.` : null,
    n('glucosa') ? `Glucosa ${v.glucosa} mg/dL.` : null,
    n('creat') ? `Creatinina ${v.creat} mg/dL.` : null,
    gaso.ok ? `Ácido-base: ${gaso.interpretacion.split('.')[0]}${gaso.mixto ? ' (MIXTO)' : ''}${gaso.compensacion.comentario ? ` — ${gaso.compensacion.comentario}` : ''}.` : null,
    (gaso.ok && gaso.anionGap.valor != null) ? `Anion gap ${gaso.anionGap.corregidoAlbumina ?? gaso.anionGap.valor}${gaso.anionGap.corregidoAlbumina != null ? ' (corregido)' : ''}${gaso.anionGap.elevado ? ' — elevado' : ''}.` : null,
    ckrt.ok ? `CKRT ${ckrt.modalidad}: efluente ${ckrt.efluenteMlH} mL/h${ckrt.dosisEntregadaMlKgH != null ? `, dosis entregada ${ckrt.dosisEntregadaMlKgH} mL/kg/h` : ckrt.dosisPrescritaMlKgH != null ? `, dosis prescrita ${ckrt.dosisPrescritaMlKgH} mL/kg/h` : ''}${ckrt.fraccionFiltracionPct != null ? `, FF ${ckrt.fraccionFiltracionPct}%` : ''}.` : null,
    (ckrt.ok && ckrt.advertencias.length) ? `CKRT — ${ckrt.advertencias.join('; ')}.` : null,
    citrato.ratioCaTotalIonico != null ? `Citrato: ratio Ca total/iónico ${citrato.ratioCaTotalIonico}${citrato.patronAcumulacion ? ' (patrón de acumulación — verificar)' : ''}.` : null,
  ])

  // ── Hematoinfeccioso ──
  const hemato = join([
    n('plaquetas') ? `Plaquetas ${v.plaquetas} ×10³.` : null,
    n('bili') ? `Bilirrubina ${v.bili} mg/dL.` : null,
  ])

  const secciones: SeccionNota[] = [
    { key: 'contexto', label: 'Contexto y objetivos del día', value: contexto },
    { key: 'neurologico', label: 'Neurológico', value: neurologico },
    { key: 'respiratorio', label: 'Respiratorio', value: respiratorio },
    { key: 'hemodinamico', label: 'Hemodinámico y cardiovascular', value: hemodinamico },
    { key: 'abdominodigestivo', label: 'Abdominodigestivo', value: abdominodigestivo },
    { key: 'hidrometabolico', label: 'Hidrometabólico', value: hidrometabolico },
    { key: 'hematoinfeccioso', label: 'Hematoinfeccioso', value: hemato },
    { key: 'musculoesqueletico', label: 'Musculoesquelético', value: '' },
    { key: 'plan', label: 'Plan por sistema', value: opts?.discusion ? `Discusión del pase:\n${opts.discusion}` : '' },
  ]
  return secciones
}
