// ════════════════════════════════════════════════════════════════════
// Motor DETERMINISTA de recomendaciones — port PURO de _txValRecs (StewardMX).
// Sin DOM. Lee un objeto de campos hc_* y devuelve Rec[]. Reglas duras:
// SOLO infectología, SIN citas, SIN emojis, NO inventar dosis ("validación clínica"),
// gateado por el estado de inmunosupresión y dirigido por los resultados capturados.
// ════════════════════════════════════════════════════════════════════

import { recsFarmacos } from './farmacos'
import { diasDesde } from '@/lib/fecha-local'

export type Sev = 'alta' | 'media' | 'baja'
/** `fuente` = guía/artículo de donde proviene la recomendación (para citarla en la nota). */
export interface Rec { titulo: string; detalle: string; sev: Sev; fuente?: string }
export interface RecInput { v: Record<string, string>; nowMs?: number }

export function recomendaciones(input: RecInput): Rec[] {
  const v = input.v || {}
  const g = (id: string) => v[id] || ''
  const huesped = g('hc_huesped')
  // Las reglas por HUÉSPED necesitan huésped; las reglas por FÁRMACO y por RESULTADO
  // disparan aunque no se haya declarado huésped (p. ej. biológico en autoinmune).
  const hayFarmaco = Object.keys(v).some((k) => k.startsWith('hc_cb_inmuno_') && v[k] === '1')
  const hayHuesped = !!huesped && huesped !== '—'
  if (!hayHuesped && !hayFarmaco && !Object.keys(v).some((k) => k.startsWith('hc_res_') && v[k] && v[k] !== '—')) return []

  const isSOT = /^SOT/.test(huesped), isTCMH = /TCMH/.test(huesped)
  const isAllo = /alog|haplo|cord/i.test(huesped), isVIH = /^VIH/.test(huesped)
  const isNeutro = /Neutropenia|Quimio/.test(huesped)
  const isTx = isSOT || isTCMH
  const motivo = g('hc_motivo'), isEst = g('hc_is_estado')
  const cd4 = parseFloat(g('hc_cd4'))
  const activeIS = isEst === 'En curso'
  const preProto = isEst === 'Va a iniciar (pre-protocolo)' || motivo === 'aptitud_pretx' || motivo === 'aptitud_biologico'
  const noIS = isEst === 'Ninguna / suspendida'
  const unknownIS = !isEst || isEst === '—'
  const resVal = (k: string) => (g('hc_res_' + k) || '').toLowerCase()
  const resPos = (k: string) => /positivo/.test(resVal(k))
  const neg = (k: string) => /negativo/.test(resVal(k))
  const g6pdDef = /defic/.test(resVal('g6pd'))
  const tienePJP = g('hc_cb_prof_pjp') === '1'

  const out: Rec[] = []
  const rec = (titulo: string, detalle: string, sev: Sev, fuente?: string) => out.push({ titulo, detalle, sev, fuente })

  if (hayHuesped) {
  if (isVIH) {
    if (!isNaN(cd4)) {
      const l: string[] = []
      if (cd4 < 200) l.push('Pneumocystis con trimetoprima-sulfametoxazol' + (g6pdDef ? ' (atovacuona por déficit de G6PD)' : ''))
      if (cd4 < 100) l.push('Toxoplasma si la serología es positiva, y descartar criptococo con antígeno sérico')
      if (cd4 < 50) l.push('complejo Mycobacterium avium y vigilancia de citomegalovirus')
      if (l.length) rec('VIH — profilaxis por CD4 (' + cd4 + ' células/µL)', 'Profilaxis indicada: ' + l.join('; ') + '. Optimizar el tratamiento antirretroviral y suspender la profilaxis tras una reconstitución inmune sostenida.', 'alta')
      else rec('VIH — CD4 ' + cd4 + ' células/µL', 'Sin profilaxis de oportunistas indicada por el recuento (≥200). Mantener el tratamiento antirretroviral.', 'baja')
    } else rec('VIH — falta el recuento de CD4', 'Capturar CD4 y carga viral para definir el escalón de profilaxis (Pneumocystis con CD4 <200, Toxoplasma <100, complejo M. avium <50).', 'media')
  } else if (preProto) {
    rec('Pre-protocolo (aún sin inmunosupresión)', 'Completar el tamizaje basal y la vacunación antes de iniciar la inmunosupresión. En esta etapa no está indicada la profilaxis de oportunistas: se inicia al comenzar la inmunosupresión.', 'media')
    rec('Tuberculosis latente', 'Tamizar con IGRA y radiografía de tórax; si es positivo, tratar antes de inmunosuprimir, vigilando la interacción de las rifamicinas con los inhibidores de calcineurina.', 'media')
    rec('Vacunación', 'Aplicar las vacunas inactivadas pertinentes (influenza, neumococo conjugada y polisacárida, hepatitis B y SARS-CoV-2). Las vacunas vivas solo pueden aplicarse ahora, al menos cuatro semanas antes de iniciar la inmunosupresión.', 'media')
  } else if (noIS) {
    rec('Sin inmunosupresión activa', 'Menor riesgo de infecciones oportunistas; no se indica profilaxis sistemática. Reevaluar según la enfermedad de base y el plan terapéutico.', 'baja')
  } else if (activeIS) {
    const fx = g('hc_fechatx')
    if (isTx && fx) {
      /**
       * La fecha del trasplante se captura como `AAAA-MM-DD`, y leída como
       * medianoche UTC se corría un día en México. Las fases de riesgo están en
       * los días 30, 100 y 180: un paciente en el día 29 podía reportarse en el
       * 30 y saltar de fase, cambiando los patógenos esperados que se listan.
       */
      const d = diasDesde(fx, input.nowMs ?? Date.now())
      if (d != null && d >= 0) {
        const faseTxt = isTCMH
          ? (d < 30 ? 'fase preinjerto/neutropénica (menos de 30 días): bacterias gramnegativas y grampositivas, Candida y reactivación de herpes simple.' : (d < 100 ? 'fase temprana (30 a 100 días): citomegalovirus, Aspergillus, Pneumocystis y adenovirus.' : 'fase tardía (más de 100 días): bacterias encapsuladas, varicela zóster, citomegalovirus tardío y Pneumocystis, sobre todo con enfermedad injerto contra huésped crónica.'))
          : (d < 30 ? 'primer mes: infecciones nosocomiales y por multirresistentes, candidiasis, infecciones derivadas del donante, del sitio quirúrgico y reactivación de herpes simple.' : (d < 180 ? 'periodo de 1 a 6 meses: infecciones oportunistas — Pneumocystis, citomegalovirus, hongos, reactivación de virus BK, hepatitis B o tuberculosis, Listeria y Nocardia.' : 'más de 6 meses: predominan las infecciones adquiridas en la comunidad; persisten las oportunistas si la inmunosupresión sigue siendo intensa.'))
        rec('Fase post-trasplante (aproximadamente ' + d + ' días)', 'Patógenos esperados en esta ventana: ' + faseTxt, 'media')
      }
    }
    if (tienePJP) rec('Profilaxis para Pneumocystis en curso', 'Mantenerla mientras persista la inmunosupresión relevante.', 'baja')
    else rec('Profilaxis para Pneumocystis indicada', 'Bajo inmunosupresión relevante (trasplante, corticoides en dosis altas y prolongadas, análogos de purina o regímenes equivalentes). De elección trimetoprima con sulfametoxazol; ' + (g6pdDef ? 'usar atovacuona por el déficit de G6PD documentado' : 'usar atovacuona si hay déficit de G6PD') + '. Ajustar la dosis a la función renal (validación clínica).', 'media')
    if (isTx) rec('Citomegalovirus', 'Estratificar por el serostatus donante/receptor; la combinación donante positivo con receptor negativo es la de mayor riesgo. Definir profilaxis (valganciclovir; letermovir en trasplante hematopoyético) o estrategia anticipada guiada por carga viral.', 'media')
    if (/Pulmonar/.test(huesped)) rec('Profilaxis antifúngica', 'Trasplante pulmonar: indicar cobertura frente a hongos filamentosos según el protocolo del centro.', 'media')
    else if (isTCMH && isAllo) rec('Profilaxis antifúngica', 'Trasplante hematopoyético alogénico: cobertura frente a hongos filamentosos durante la neutropenia y la enfermedad injerto contra huésped, con vigilancia de galactomanano.', 'media')
    if (isNeutro) rec('Neutropenia', 'Ante fiebre: tomar hemocultivos e iniciar un betalactámico con actividad antipseudomonas dentro de la primera hora, con estratificación de riesgo.', 'media')
  } else if (unknownIS) {
    rec('Define el estado de inmunosupresión', 'Indica en «¿Inmunosupresión hoy?» si está en curso, va a iniciar (pre-protocolo) o ninguna. El plan de profilaxis depende de ello; sin ese dato no se recomienda profilaxis para no inducir tratamientos innecesarios.', 'media')
  }
  if (/Biológicos/.test(huesped) && (preProto || activeIS)) rec('Tamizaje según el biológico', 'Anti-CD20: tamizar hepatitis B e indicar profilaxis antiviral si hay anti-HBc positivo. Anti-TNF: descartar tuberculosis latente antes de iniciar. Inhibidores de JAK: riesgo de herpes zóster, considerar la vacuna recombinante. Anti-complemento: vacunación antimeningocócica.', 'media')
  if (motivo === 'vacunacion' && activeIS) rec('Vacunación bajo inmunosupresión', 'Aplicar vacunas inactivadas (influenza, neumococo conjugada y polisacárida, hepatitis B, SARS-CoV-2 y herpes zóster recombinante). Las vacunas vivas están contraindicadas. La respuesta es subóptima; programar refuerzos o aprovechar los periodos de menor intensidad de inmunosupresión.', 'media')
  if (/Asplenia/.test(huesped)) rec('Asplenia', 'Riesgo de sepsis fulminante por bacterias encapsuladas (neumococo, Haemophilus influenzae tipo b y meningococo). Asegurar la vacunación correspondiente, un antibiótico de reserva domiciliario y un umbral bajo para el tratamiento empírico ante fiebre.', 'alta', 'AST IDCOP 2019; KDIGO 2020')
  }

  // ── Dirigidas por resultados (seguimiento) ──
  if (resPos('cmvpcr')) rec('Citomegalovirus detectable', 'Carga viral positiva: iniciar tratamiento anticipado (valganciclovir oral o ganciclovir IV según gravedad) y seguir la carga viral hasta su negativización; reducir la inmunosupresión si es posible (validación clínica).', 'alta')
  if (resPos('gm') || resPos('bdg')) rec('Marcador fúngico positivo', 'Galactomanano o β-D-glucano positivo: ampliar el estudio (tomografía de tórax, cultivos, antígenos dirigidos) y valorar tratamiento antifúngico de hongos filamentosos según el foco (validación clínica).', 'alta')
  if (resPos('crag')) rec('Antígeno criptocócico positivo', 'Realizar punción lumbar para descartar meningitis; en afección del sistema nervioso central, tratar con anfotericina B liposomal y flucitosina en la inducción (validación clínica).', 'alta')
  if (resPos('cocci') || resPos('histo')) rec('Micosis endémica positiva', 'Confirmar con la prueba específica, estadificar la extensión e iniciar tratamiento antifúngico dirigido; ajustar la inmunosupresión (validación clínica).', 'media')
  if (resPos('bkpcr')) rec('Viremia por BK', 'En trasplante renal sugiere nefropatía por BK: la intervención principal es reducir la inmunosupresión, con seguimiento de la carga viral y de la función del injerto.', 'media')
  if (resPos('hemo')) rec('Hemocultivo positivo', 'Tratar la bacteriemia según la identificación y el antibiograma; buscar el foco y retirar los dispositivos intravasculares implicados.', 'alta')
  if (resPos('uro')) rec('Urocultivo positivo', 'Tratar según el antibiograma y la presencia de síntomas; evitar tratar bacteriuria asintomática salvo situaciones específicas.', 'media')
  if (resPos('cdiff')) rec('Clostridioides difficile positivo', 'Suspender el antimicrobiano no esencial e iniciar tratamiento dirigido (vancomicina oral o fidaxomicina); evitar antiperistálticos.', 'media')
  if (resPos('igra')) rec('Tuberculosis latente positiva', 'IGRA/PPD positivo: tratar la infección latente; si va a iniciar inmunosupresión, hacerlo antes, vigilando las interacciones de las rifamicinas.', 'media')

  // ── Hepatitis B por patrón serológico ──
  const hbsagPos = resPos('hbsag'), hbcPos = resPos('antihbc'), hbsPos = resPos('antihbs')
  if (hbsagPos) rec('Hepatitis B activa (HBsAg positivo)', 'Cuantificar HBV DNA y transaminasas e iniciar tratamiento antiviral con un análogo de alta barrera genética (entecavir o tenofovir), imprescindible antes y durante la inmunosupresión por el riesgo de reactivación e insuficiencia hepática. Coordinar con hepatología; dosis y duración con validación clínica.', 'alta', 'Morrison CID 2014; ASH 2020')
  else if (hbcPos) rec('Hepatitis B resuelta u oculta (anti-HBc positivo, HBsAg negativo)', 'Riesgo de reactivación bajo inmunosupresión, alto con anti-CD20 (rituximab), corticoides en dosis altas o quimioterapia. Indicar profilaxis antiviral (entecavir o tenofovir) durante la inmunosupresión y al menos 6 a 12 meses después —más prolongada tras rituximab—, con vigilancia de HBV DNA y transaminasas; si no se administra profilaxis, monitorización estrecha. Dosis con validación clínica.', 'media', 'Morrison CID 2014; ASH 2020')
  else if (neg('hbsag') && neg('antihbc') && neg('antihbs')) rec('Hepatitis B: susceptible', 'Sin infección ni inmunidad (HBsAg, anti-HBc y anti-HBs negativos): vacunar contra hepatitis B. En candidatos a inmunosupresión, considerar esquema acelerado o de doble dosis y verificar la seroconversión (anti-HBs ≥10 mUI/mL).', 'media')
  else if (hbsPos && neg('antihbc')) rec('Hepatitis B: inmune por vacuna', 'Anti-HBs positivo con anti-HBc negativo: inmunidad vacunal; sin medidas adicionales. Vigilar el título si recibe inmunosupresión intensa y reforzar si cae por debajo de 10 mUI/mL.', 'baja')

  // ── Serologías por resultado ──
  if (resPos('cmv')) rec('CMV IgG positivo (receptor seropositivo)', 'Riesgo de reactivación bajo inmunosupresión: definir profilaxis o estrategia anticipada guiada por carga viral, según el órgano y el régimen.', 'media')
  else if (neg('cmv')) rec('CMV IgG negativo (receptor seronegativo)', 'Con donante positivo (D+/R−) es el escenario de mayor riesgo de enfermedad por CMV: indicar profilaxis y usar hemoderivados leucorreducidos o CMV-negativos.', 'alta')
  if (resPos('ebv')) rec('EBV IgG positivo', 'Riesgo bajo de síndrome linfoproliferativo postrasplante; vigilancia clínica.', 'baja')
  else if (neg('ebv')) rec('EBV IgG negativo (seronegativo)', 'Con donante positivo, riesgo de primoinfección y de enfermedad linfoproliferativa postrasplante: monitorizar la carga viral de EBV y minimizar la inmunosupresión.', 'media')
  if (resPos('hsv')) rec('HSV seropositivo', 'Riesgo de reactivación: profilaxis con aciclovir o valaciclovir durante la inmunosupresión intensa o el postrasplante temprano, salvo que ya reciba un antiviral que lo cubra (dosis con validación clínica).', 'media')
  if (resPos('vzv')) rec('VZV seropositivo', 'Inmunidad presente; ante exposición o herpes zóster, tratamiento antiviral oportuno. Considerar la vacuna recombinante de zóster.', 'baja')
  else if (neg('vzv')) rec('VZV seronegativo', 'Susceptible a varicela grave: aplicar la vacuna de varicela ANTES de inmunosuprimir (es viva, contraindicada bajo inmunosupresión) y dar profilaxis postexposición ante un contacto.', 'media')
  if (resPos('toxo')) rec('Toxoplasma seropositivo', 'Riesgo de reactivación bajo inmunosupresión (mayor en trasplante cardiaco y hematopoyético); la profilaxis con trimetoprima-sulfametoxazol lo cubre.', 'media')
  else if (neg('toxo')) rec('Toxoplasma seronegativo', 'En trasplante cardiaco con donante positivo (D+/R−) es el grupo de mayor riesgo: indicar profilaxis dirigida.', 'media')
  if (resPos('hcv')) rec('Anti-VHC positivo', 'Confirmar con carga viral (HCV RNA); si hay viremia, tratar con antivirales de acción directa y referir a hepatología; vigilar la función hepática bajo inmunosupresión.', 'media')
  if (resPos('sifilis')) rec('VDRL/RPR positivo', 'Confirmar con prueba treponémica (FTA-ABS o TP-PA); estadificar y tratar con penicilina según la etapa; ante datos neurológicos o coinfección por VIH, valorar punción lumbar.', 'media')

  // ── Reglas gatilladas por FÁRMACO inmunosupresor (basadas en guías, con cita) ──
  out.push(...recsFarmacos(v))

  return out
}
