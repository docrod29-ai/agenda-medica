/**
 * Fenotipos de Gram positivos: Staphylococcus, Streptococcus, Enterococcus.
 * Fuente: Torres C, Cercenado E. Enferm Infecc Microbiol Clin. 2010;28(8):541-553.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma, type SitioInfeccion } from './tipos'
import { REF } from './referencias'
import {
  organismoEs, estado, cmiDe, ES_R, ES_S,
  OXACILINA, CEFOXITINA, PENICILINA, VANCOMICINA, ERITROMICINA, CLINDAMICINA,
  GENTAMICINA, AMPICILINA, LINEZOLID, DAPTOMICINA,
} from './util'

export function analizarGramPositivos(
  organismo: string,
  r: ResultadoAntibiograma[],
  sitio?: SitioInfeccion,
): AporteModulo {
  const out = aporteVacio()
  if (organismoEs(organismo, ['staphylococcus', 'aureus', 'estafilococo', 'epidermidis', 'lugdunensis'])) {
    staph(organismo, r, out)
  }
  if (organismoEs(organismo, ['streptococcus pneumoniae', 'neumococo', 'pneumoniae']) &&
      !organismoEs(organismo, ['klebsiella'])) {
    neumococo(r, out, sitio)
  }
  if (organismoEs(organismo, ['streptococcus pyogenes', 'pyogenes', 'estreptococo del grupo a'])) {
    pyogenes(r, out)
  }
  if (organismoEs(organismo, ['enterococcus', 'enterococo', 'faecium', 'faecalis'])) {
    enterococo(organismo, r, out)
  }
  return out
}

// ── Staphylococcus ──────────────────────────────────────────────────────────
function staph(organismo: string, r: ResultadoAntibiograma[], out: AporteModulo) {
  const esAureus = organismoEs(organismo, ['aureus'])
  const oxa = estado(r, OXACILINA)
  const fox = estado(r, CEFOXITINA)
  const pen = estado(r, PENICILINA)
  const meticilinaR = ES_R(oxa) || ES_R(fox)

  if (meticilinaR) {
    out.fenotipos.push({
      clave: 'MRSA',
      nombre: esAureus ? 'S. aureus resistente a meticilina (MRSA)' : 'Estafilococo resistente a meticilina (SARM/ECN-MR)',
      confianza: 'confirmado',
      base: `Oxacilina/cefoxitina R. La cefoxitina es el mejor marcador de mecA. ${REF.GRAM_POS}`,
    })
    out.mecanismos.push({
      categoria: 'diana', nombre: 'PBP2a (gen mecA)', confianza: 'confirmado',
      explicacion: 'mecA codifica una PBP2a de baja afinidad → resistencia a TODOS los β-lactámicos EXCEPTO las nuevas cefalosporinas anti-MRSA (ceftarolina, ceftobiprol).',
      referencia: REF.GRAM_POS,
    })
    out.alertas.push({ nivel: 'critica', mensaje: 'MRSA: los β-lactámicos convencionales NO sirven (mecA/PBP2a). Vancomicina (objetivo AUC/MIC 400-600), daptomicina (no en neumonía) o linezolid según el sitio; ceftarolina es el único β-lactámico útil.' })
    out.advertencias.push('MRSA: ignore cualquier β-lactámico reportado S salvo ceftarolina — la resistencia mecA es de clase.')
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Vancomicina / daptomicina / linezolid (según sitio)', razon: 'Cobertura anti-MRSA; ceftarolina como β-lactámico anti-MRSA.', referencia: REF.GRAM_POS })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (MRSA).'
    out.optimizacionPKPD.push('Vancomicina para MRSA: dosificar por AUC/MIC 400-600 (área bajo la curva), no por valle fijo.')
  } else if (ES_R(pen) && (ES_S(oxa) || oxa === null)) {
    // Penicilinasa estafilocócica: PEN R, OXA S. Inhibida por clavulanato/tazobactam.
    out.fenotipos.push({
      clave: 'penicilinasa-estafilococica', nombre: 'Penicilinasa estafilocócica (PEN R, OXA S)', confianza: 'confirmado',
      base: `Penicilina R con oxacilina S: β-lactamasa de clase A (penicilinasa). No hidroliza penicilinas semisintéticas ni cefalosporinas. ${REF.GRAM_POS}`,
    })
    out.mecanismos.push({
      categoria: 'β-lactamasa', nombre: 'Penicilinasa estafilocócica (blaZ)', ambler: 'A', confianza: 'confirmado',
      explicacion: 'Inhibida por clavulanato/tazobactam/sulbactam. Usar penicilinas antiestafilocócicas (oxacilina/dicloxacilina) o cefalosporinas de 1G.',
      referencia: REF.GRAM_POS,
    })
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Oxacilina/dicloxacilina o cefazolina', razon: 'Estables a la penicilinasa; preferibles a penicilina.', referencia: REF.GRAM_POS })
  }

  // MLSb inducible: eritromicina R + clindamicina S → D-test. Reportar clinda R.
  const ery = estado(r, ERITROMICINA)
  const cli = estado(r, CLINDAMICINA)
  if (ES_R(ery) && ES_S(cli)) {
    out.fenotipos.push({
      clave: 'MLSb-inducible', nombre: 'Resistencia inducible a clindamicina (MLSb inducible, D-test)', confianza: 'probable',
      base: `Eritromicina R + clindamicina S: la eritromicina induce la metilasa erm → riesgo de fallo con clindamicina. Confirmar con D-test. ${REF.GRAM_POS}`,
    })
    out.advertencias.push('MLSb inducible (ERY-R/CLI-S): NO usar clindamicina si el D-test es positivo — puede seleccionar resistencia constitutiva durante el tratamiento. Informar como clindamicina R.')
    out.mecanismos.push({
      categoria: 'diana', nombre: 'Metilasa ribosómica erm (23S rRNA)', confianza: 'probable',
      explicacion: 'La metilación del ARNr 23S bloquea macrólidos, lincosamidas y estreptograminas B. La expresión inducible se desenmascara con el D-test.',
      referencia: REF.GRAM_POS,
    })
  } else if (ES_R(ery) && ES_R(cli)) {
    out.fenotipos.push({
      clave: 'MLSb-constitutivo', nombre: 'MLSb constitutivo (ERY R + CLI R)', confianza: 'confirmado',
      base: `Resistencia constitutiva a macrólidos-lincosamidas-estreptograminas B (metilasa erm constitutiva). ${REF.GRAM_POS}`,
    })
  }

  // VISA / MIC creep de vancomicina. Toda CMI >2 en S. aureus advierte falla probable.
  const vancoCmi = cmiDe(r, VANCOMICINA)
  if (esAureus && vancoCmi !== null && vancoCmi > 2) {
    out.advertencias.push('Vancomicina CMI >2 en S. aureus: mayor probabilidad de falla clínica; preferir alternativa aunque el reporte diga «S».')
    if (vancoCmi >= 4) {
      out.fenotipos.push({
        clave: 'VISA', nombre: 'S. aureus con sensibilidad intermedia a glucopéptidos (VISA/GISA)', confianza: 'probable',
        base: `Vancomicina CMI ${vancoCmi} mg/L (4-8): engrosamiento de pared/secuestro del glucopéptido. ${REF.GRAM_POS}`,
      })
      out.alertas.push({ nivel: 'alta', mensaje: `Vancomicina CMI ${vancoCmi} (VISA/GISA): la vancomicina es poco fiable. Considerar daptomicina (no en neumonía), linezolid o ceftarolina.` })
    } else {
      out.alertas.push({ nivel: 'alta', mensaje: `Vancomicina CMI ${vancoCmi} (>2) en S. aureus: eficacia reducida (MIC creep/hVISA). Preferir alternativa aunque el reporte diga «S».` })
    }
  }
  void LINEZOLID; void DAPTOMICINA
}

// ── Streptococcus pneumoniae ────────────────────────────────────────────────
function neumococo(r: ResultadoAntibiograma[], out: AporteModulo, sitio?: SitioInfeccion) {
  const penCmi = cmiDe(r, PENICILINA)
  const penSir = estado(r, PENICILINA)
  const meningitis = sitio === 'snc'
  // Puntos de corte de penicilina parenteral (CLSI, citados en Torres 2010 Tabla 2b):
  //   No meníngea: S ≤2, I 4, R ≥8 ; Meníngea: S ≤0,06, R ≥0,12.
  if (penCmi !== null) {
    if (meningitis) {
      if (penCmi <= 0.06) {
        out.didactica.push({ titulo: 'Neumococo — penicilina (criterio meníngeo)', texto: `CMI ${penCmi} ≤0,06 → sensible por criterio meníngeo; sensible a todos los β-lactámicos.`, referencia: REF.GRAM_POS })
      } else {
        out.fenotipos.push({ clave: 'neumococo-PNS', nombre: 'Neumococo no sensible a penicilina (criterio meníngeo)', confianza: 'confirmado', base: `CMI ${penCmi} ≥0,12 por criterio meníngeo (S ≤0,06). Alteración de PBP 1a/2x/2b + MurM. ${REF.GRAM_POS}` })
        out.alertas.push({ nivel: 'alta', mensaje: 'Meningitis neumocócica no sensible a penicilina: cefotaxima/ceftriaxona a dosis meníngea ± vancomicina hasta CMI de cefalosporina.' })
      }
    } else {
      if (penCmi <= 2) {
        out.didactica.push({ titulo: 'Neumococo — penicilina (criterio no meníngeo)', texto: `CMI ${penCmi} ≤2 → tratable con penicilina parenteral a dosis altas (12 MU/día); también sensible a ampicilina, amoxicilina, ceftriaxona, cefotaxima.`, referencia: REF.GRAM_POS })
      } else {
        out.fenotipos.push({ clave: 'neumococo-PNS', nombre: 'Neumococo con CMI de penicilina elevada (no meníngea)', confianza: 'confirmado', base: `CMI ${penCmi} (>2 no meníngea): I 4 / R ≥8. Alteración de PBP. ${REF.GRAM_POS}` })
      }
    }
  } else if (ES_R(penSir)) {
    out.fenotipos.push({ clave: 'neumococo-PNS', nombre: 'Neumococo no sensible a penicilina', confianza: 'probable', base: `Penicilina no-S: idealmente determinar CMI e interpretar según sitio (meníngeo vs no meníngeo). ${REF.GRAM_POS}` })
  }
  // MLSb en neumococo.
  const ery = estado(r, ERITROMICINA)
  const cli = estado(r, CLINDAMICINA)
  if (ES_R(ery) && ES_S(cli)) {
    out.advertencias.push('Neumococo ERY-R/CLI-S: descartar MLSb inducible con doble disco antes de usar clindamicina.')
  }
}

// ── Streptococcus pyogenes ──────────────────────────────────────────────────
function pyogenes(r: ResultadoAntibiograma[], out: AporteModulo) {
  const pen = estado(r, PENICILINA)
  if (ES_R(pen)) {
    out.alertas.push({ nivel: 'critica', mensaje: 'S. pyogenes reportado R a penicilina: NO se han descrito cepas R a penicilina ni carbapenémicos. Reconfirmar identificación/CMI y remitir a centro de referencia.' })
  } else {
    out.didactica.push({ titulo: 'S. pyogenes', texto: 'S. pyogenes es universalmente sensible a penicilina (fármaco de elección). Un reporte R obliga a reconfirmar.', referencia: REF.GRAM_POS })
  }
  const ery = estado(r, ERITROMICINA)
  const cli = estado(r, CLINDAMICINA)
  if (ES_R(ery) && ES_S(cli)) {
    out.advertencias.push('S. pyogenes ERY-R/CLI-S: descartar MLSb inducible (D-test) antes de clindamicina; el fenotipo M (mef) sí permite clindamicina.')
  }
}

// ── Enterococcus ────────────────────────────────────────────────────────────
function enterococo(organismo: string, r: ResultadoAntibiograma[], out: AporteModulo) {
  const van = estado(r, VANCOMICINA)
  const amp = estado(r, AMPICILINA)
  const esFaecium = organismoEs(organismo, ['faecium'])

  if (ES_R(van)) {
    out.fenotipos.push({ clave: 'VRE', nombre: 'Enterococo resistente a vancomicina (VRE)', confianza: 'confirmado', base: `Vancomicina R: alteración del precursor de peptidoglicano (VanA teico-R/vanco-R; VanB teico-S). ${REF.GRAM_POS}` })
    out.mecanismos.push({ categoria: 'diana', nombre: 'Ligasa Van (vanA/vanB…)', confianza: 'confirmado', explicacion: 'VanA: R alta a vancomicina y teicoplanina. VanB: R variable a vancomicina, sensible a teicoplanina. Confirmar por CMI.', referencia: REF.GRAM_POS })
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Linezolid o daptomicina (según especie/sitio)', razon: 'Opciones frente a VRE; E. faecium suele ser también ampicilina-R.', referencia: REF.GRAM_POS })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (VRE).'
  }

  if (ES_R(amp)) {
    out.fenotipos.push({ clave: 'ampicilina-R-enterococo', nombre: 'Enterococo resistente a ampicilina', confianza: 'confirmado', base: `Ampicilina R (frecuente en E. faecium por baja afinidad de PBP5). ${REF.GRAM_POS}` })
    if (esFaecium) out.advertencias.push('E. faecium ampicilina-R: perdió la opción de ampicilina; considerar vancomicina (si S), linezolid o daptomicina.')
  } else if (ES_S(amp)) {
    out.didactica.push({ titulo: 'Enterococo — ampicilina S', texto: 'Ampicilina S predice sensibilidad al resto de penicilinas y, en E. faecalis, también a imipenem. Ampicilina tiene mayor actividad intrínseca que penicilina.', referencia: REF.GRAM_POS })
  }

  // HLAR: resistencia de alto nivel a aminoglucósidos → se pierde la sinergia con β-lactámico.
  const gentaCmi = cmiDe(r, GENTAMICINA)
  const gentaSir = estado(r, GENTAMICINA)
  const hlar = (gentaCmi !== null && gentaCmi > 500) || (gentaSir === 'R')
  if (hlar) {
    out.fenotipos.push({ clave: 'HLAR', nombre: 'Resistencia de alto nivel a aminoglucósidos (HLAR)', confianza: gentaCmi !== null ? 'confirmado' : 'probable', base: `Gentamicina de alto nivel R (CMI >500 mg/L): se PIERDE el sinergismo β-lactámico + aminoglucósido. ${REF.GRAM_POS}` })
    out.advertencias.push('HLAR: no esperar sinergia β-lactámico + aminoglucósido en endocarditis; el aminoglucósido NO aporta a bajas dosis. Estreptomicina de alto nivel es un mecanismo independiente (probar por separado).')
  } else {
    out.didactica.push({ titulo: 'Enterococo — aminoglucósidos', texto: 'El enterococo es intrínsecamente R de bajo nivel a aminoglucósidos (transporte deficiente): en monoterapia NO sirven. Sólo aportan por SINERGIA con un agente de pared (β-lactámico/glucopéptido) si NO hay HLAR.', referencia: REF.GRAM_POS })
  }
}
