/**
 * Organismos fastidiosos y reglas especiales:
 *  - Haemophilus influenzae: β-lactamasa (nitrocefina) y BLNAR (β-lactamasa-negativo
 *    ampicilina-resistente = mutación de PBP3, afecta también amox-clav/cefalos orales).
 *  - Neisseria gonorrhoeae: penicilinasa; sensibilidad reducida a ceftriaxona (emergente).
 *  - Salmonella/Shigella: la R a ácido nalidíxico (o pefloxacino no-S) PREDICE fallo con
 *    fluoroquinolonas aunque el ciprofloxacino parezca S (mutación de primer paso qnr/gyrA).
 * Fuente: CLSI M100-Ed35 (Tablas 2E Haemophilus / 2F Neisseria / 2A-2 Salmonella).
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { organismoEs, estado, ES_R, ES_S } from './util'

const M100 = 'CLSI M100-Ed35 (2025)'

export function analizarFastidiosos(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()

  // ── Haemophilus influenzae ────────────────────────────────────────────────
  if (organismoEs(organismo, ['haemophilus', 'influenzae'])) {
    const amp = estado(r, ['ampicilina'])
    const amc = estado(r, ['amoxicilina-clavulanico', 'amoxicilina/clavulanico', 'amoxicilina-clavulanato'])
    if (ES_R(amp) && ES_S(amc)) {
      out.fenotipos.push({ clave: 'penicilinasa-estafilococica', nombre: 'H. influenzae productor de β-lactamasa (ampicilina R, amox-clav S)', confianza: 'confirmado', base: `β-lactamasa (TEM-1/ROB-1): ampicilina R restaurada por clavulanato. ${M100} Tabla 2E.` })
      out.advertencias.push('H. influenzae β-lactamasa +: usar amoxicilina-clavulanato, cefalosporinas de 3G o azitromicina; no ampicilina sola.')
    } else if (ES_R(amp) && (amc === null || ES_R(amc))) {
      out.fenotipos.push({ clave: 'penicilinasa-estafilococica', nombre: 'H. influenzae BLNAR (β-lactamasa negativo, ampicilina R)', confianza: 'probable', base: `Ampicilina R SIN β-lactamasa (o amox-clav también R): mutación de PBP3 (ftsI). Afecta amox-clav y cefalosporinas orales. ${M100} Tabla 2E.` })
      out.mecanismos.push({ categoria: 'diana', nombre: 'Mutación de PBP3 (ftsI) — BLNAR', confianza: 'probable', explicacion: 'La R no la da una β-lactamasa (el clavulanato NO la revierte), sino una PBP3 de baja afinidad. Reduce la fiabilidad de amox-clav y cefalosporinas orales; usar cefalosporina de 3G parenteral (ceftriaxona) en infección seria.', referencia: `${M100} Tabla 2E` })
      out.advertencias.push('H. influenzae BLNAR: el clavulanato NO ayuda (no es β-lactamasa). Ceftriaxona/cefotaxima en infección seria; los orales pierden fiabilidad.')
    }
  }

  // ── Neisseria gonorrhoeae ─────────────────────────────────────────────────
  if (organismoEs(organismo, ['gonorrhoeae', 'gonococo', 'neisseria gonorr'])) {
    out.advertencias.push('N. gonorrhoeae: tratamiento de elección ceftriaxona (dosis alta); vigilar la sensibilidad reducida a cefalosporinas (emergente). No usar fluoroquinolonas empíricas (R difundida).')
    if (ES_R(estado(r, ['penicilina']))) {
      out.fenotipos.push({ clave: 'penicilinasa-estafilococica', nombre: 'Gonococo productor de penicilinasa (PPNG)', confianza: 'confirmado', base: `Penicilina R por β-lactamasa plasmídica. ${M100} Tabla 2F.` })
    }
  }

  // ── Salmonella / Shigella: ciprofloxacino vs ácido nalidíxico/pefloxacino ──
  if (organismoEs(organismo, ['salmonella', 'shigella'])) {
    const nal = estado(r, ['acido nalidixico', 'ácido nalidíxico', 'nalidixico'])
    const pef = estado(r, ['pefloxacino'])
    const cip = estado(r, ['ciprofloxacino'])
    if ((ES_R(nal) || ES_R(pef)) && !ES_R(cip)) {
      out.fenotipos.push({ clave: 'FQ-R', nombre: 'Salmonella con resistencia de primer paso a fluoroquinolonas (nalidíxico/pefloxacino R, cipro «S»)', confianza: 'probable', base: `La R a ácido nalidíxico (o pefloxacino no-S) predice FALLO clínico con fluoroquinolonas aunque el ciprofloxacino parezca S (mutación única en gyrA / qnr). ${M100} Tabla 2A-2.` })
      out.advertencias.push('Salmonella nalidíxico/pefloxacino-R: NO usar fluoroquinolonas aunque cipro salga «S» (fallo documentado en infección invasora). Preferir ceftriaxona o azitromicina.')
      out.alertas.push({ nivel: 'alta', mensaje: 'Salmonella invasora: si nalidíxico/pefloxacino R, evitar fluoroquinolonas (respuesta lenta/fallo). Ceftriaxona o azitromicina.' })
    }
  }

  return out
}
