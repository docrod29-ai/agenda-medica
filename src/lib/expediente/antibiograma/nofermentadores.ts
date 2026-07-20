/**
 * Fenotipos de bacilos gramnegativos no fermentadores.
 * Fuente: Vila J, Marco F. Enferm Infecc Microbiol Clin. 2010;28(10):726-736.
 *
 * Aporta el razonamiento que distingue mecanismos que un simple S/I/R no separa:
 *   - P. aeruginosa: pérdida de porina OprD vs carbapenemasa vs bomba de expulsión.
 *   - A. baumannii: carbapenemasa tipo OXA (+ sulbactam intrínseco).
 *   - S. maltophilia: R intrínseca a carbapenémicos (L1) → cotrimoxazol de elección.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { REF } from './referencias'
import {
  organismoEs, estado, ES_R, ES_S,
  IMIPENEM, MEROPENEM, CEFTAZIDIMA, CEFEPIME, PIP_TAZO, AZTREONAM,
  CEFTAZIDIMA_AVIBACTAM, COTRIMOXAZOL, CARBAPENEM, algunoR, algunoS,
} from './util'
import { CLASES } from './betalactamasas'

export function analizarNoFermentadores(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()
  if (organismoEs(organismo, ['pseudomonas', 'aeruginosa'])) pseudomonas(r, out)
  if (organismoEs(organismo, ['acinetobacter', 'baumannii'])) acinetobacter(r, out)
  if (organismoEs(organismo, ['stenotrophomonas', 'maltophilia'])) maltophilia(r, out)
  return out
}

// ── Pseudomonas aeruginosa ──────────────────────────────────────────────────
function pseudomonas(r: ResultadoAntibiograma[], out: AporteModulo) {
  const imi = estado(r, IMIPENEM)
  const mero = estado(r, MEROPENEM)
  const caz = estado(r, CEFTAZIDIMA)
  const fep = estado(r, CEFEPIME)
  const piptazo = estado(r, PIP_TAZO)
  const cza = estado(r, CEFTAZIDIMA_AVIBACTAM)
  const carbaR = algunoR(r, CARBAPENEM)
  const otrosBetaR = ES_R(caz) || ES_R(piptazo) || ES_R(fep)

  // Patrón 1: imipenem R aislado (meropenem S y demás β-lactámicos S) → pérdida de OprD.
  if (ES_R(imi) && (ES_S(mero) || mero === 'I') && !ES_R(caz) && !ES_R(piptazo)) {
    out.fenotipos.push({ clave: 'porina-perdida', nombre: 'Pérdida de porina OprD (imipenem R aislado)', confianza: 'probable', base: `Imipenem R con meropenem y otros β-lactámicos conservados: la pérdida de OprD afecta sobre todo al imipenem, NO es carbapenemasa. ${REF.NO_FERM}` })
    out.mecanismos.push({ categoria: 'porina', nombre: 'Pérdida de porina OprD', confianza: 'probable', explicacion: 'OprD es la vía de entrada de los carbapenémicos en P. aeruginosa; su pérdida sube la CMI del imipenem (y menos del meropenem). No confundir con carbapenemasa.', referencia: REF.NO_FERM })
    out.advertencias.push('P. aeruginosa imipenem-R por OprD: el meropenem/otros antipseudomónicos pueden seguir útiles; NO es productor de carbapenemasa. No requiere prueba de carbapenemasa por este patrón aislado.')
    return out
  }

  /**
   * Patrón 1b: AMBOS carbapenémicos R con las cefalosporinas antipseudomónicas
   * CONSERVADAS.
   *
   * Antes este caso no disparaba NADA: ningún fenotipo, ninguna alerta, ninguna
   * precaución. El patrón 1 exige meropenem S o I, el 2 exige otros β-lactámicos
   * R y el 3 exige cefepime R — un imipenem-R + meropenem-R con ceftazidima,
   * pip-tazo y cefepime S se caía por el hueco entre los tres.
   *
   * Indicación clínica del médico: en P. aeruginosa ese perfil es característico
   * de la COMBINACIÓN de pérdida de porina (OprD) con sobreexpresión de bombas de
   * expulsión (MexAB-OprM), no de una carbapenemasa — precisamente porque una
   * carbapenemasa arrastraría también a las cefalosporinas.
   */
  if (carbaR && !otrosBetaR) {
    out.fenotipos.push({
      clave: 'porina-perdida',
      nombre: 'Carbapenémicos R con cefalosporinas conservadas (porina + bomba de expulsión)',
      confianza: 'probable',
      base: `Imipenem y meropenem no-S con ceftazidima/cefepime/piperacilina-tazobactam conservados. En P. aeruginosa este perfil sugiere la combinación de pérdida de porina OprD con sobreexpresión de bombas de expulsión (MexAB-OprM), NO una carbapenemasa: una carbapenemasa arrastraría también a las cefalosporinas. ${REF.NO_FERM}`,
    })
    out.mecanismos.push({
      categoria: 'porina',
      nombre: 'Pérdida de OprD + sobreexpresión de bombas de expulsión (MexAB-OprM)',
      confianza: 'probable',
      explicacion: 'La pérdida de OprD cierra la vía de entrada de los carbapenémicos y la sobreexpresión de bombas expulsa lo que entra. El efecto se concentra en los carbapenémicos y respeta las cefalosporinas antipseudomónicas, que es lo que distingue este patrón de una carbapenemasa.',
      referencia: REF.NO_FERM,
    })
    out.advertencias.push('Carbapenémicos R con cefalosporinas S: valorar ceftazidima o cefepime a dosis optimizada (infusión extendida) guiado por CMI, en vez de escalar a un β-lactámico nuevo. Confirmar con prueba de carbapenemasa si el contexto epidemiológico lo justifica.')
    return out
  }

  // Patrón 2: carbapenémicos R + otros β-lactámicos R → carbapenemasa probable (MBL frecuente).
  if (carbaR && otrosBetaR) {
    const esMBL = cza === 'R'
    out.fenotipos.push({ clave: 'carbapenemasa', nombre: esMBL ? 'Carbapenemasa (sugiere metalo-β-lactamasa)' : 'Resistencia a carbapenémicos (posible carbapenemasa o mecanismos combinados)', confianza: 'probable', base: `Carbapenémicos + otros β-lactámicos R. ${esMBL ? 'Ceftazidima-avibactam R → MBL (VIM/IMP/NDM); respeta aztreonam.' : 'Confirmar clase; en P. aeruginosa suelen coexistir AmpC + bomba + porina.'} ${REF.NO_FERM}` })
    if (esMBL) {
      out.mecanismos.push({ categoria: 'β-lactamasa', nombre: CLASES.MBL.nombre, ambler: 'B', confianza: 'probable', explicacion: CLASES.MBL.didactica, referencia: REF.BLI })
      out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Aztreonam-avibactam o cefiderocol', razon: 'MBL: el aztreonam resiste la hidrólisis; cefiderocol es activo frente a metalo.', referencia: REF.BLI })
    } else {
      out.advertencias.push('P. aeruginosa carbapenem-R: la resistencia suele ser MULTIFACTORIAL (AmpC desreprimida + bomba MexAB-OprM + pérdida de OprD). Confirmar carbapenemasa (MBL/GES) antes de asumir enzima.')
      out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Ceftolozano-tazobactam / ceftazidima-avibactam (según S) o cefiderocol', razon: 'Opciones antipseudomónicas nuevas; elegir por susceptibilidad y clase.', referencia: REF.BLI })
    }
    out.alertas.push({ nivel: 'critica', mensaje: 'P. aeruginosa carbapenem-R: infectología + microbiología; considerar ceftolozano-tazobactam, ceftazidima-avibactam o cefiderocol según fenotipo.' })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (P. aeruginosa MDR/carbapenem-R).'
    return out
  }

  // Patrón 3: cefepime R con carbapenémicos S → sobreexpresión de bomba (MexXY/MexCD) o AmpC.
  if (ES_R(fep) && !carbaR) {
    out.fenotipos.push({ clave: 'bomba-expulsion', nombre: 'Posible sobreexpresión de bomba de expulsión / AmpC', confianza: 'sospecha', base: `Cefepime afectado con carbapenémicos conservados: sistemas MexXY-OprM/MexCD-OprJ o desrepresión de AmpC. ${REF.NO_FERM}` })
    out.mecanismos.push({ categoria: 'bomba de expulsión', nombre: 'MexXY-OprM / MexCD-OprJ', confianza: 'sospecha', explicacion: 'Las bombas RND expulsan β-lactámicos, fluoroquinolonas y aminoglucósidos; el cefepime es especialmente afectado por MexXY.', referencia: REF.NO_FERM })
  }
}

// ── Acinetobacter baumannii ─────────────────────────────────────────────────
function acinetobacter(r: ResultadoAntibiograma[], out: AporteModulo) {
  const carbaR = algunoR(r, CARBAPENEM)
  if (carbaR) {
    out.fenotipos.push({ clave: 'carbapenemasa', nombre: 'A. baumannii resistente a carbapenémicos (oxacilinasa tipo OXA)', confianza: 'probable', base: `Carbapenémico R en A. baumannii: lo más frecuente es una oxacilinasa con actividad carbapenemasa (OXA-23/24/58) sobre la OXA-51 intrínseca, potenciada por ISAba1. ${REF.NO_FERM}` })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: 'Carbapenemasa OXA (clase D)', ambler: 'D', confianza: 'probable', explicacion: 'Las OXA de A. baumannii no se inhiben con clavulanato; ISAba1 aporta el promotor que sobreexpresa la enzima. También pueden coexistir MBL (IMP/VIM/NDM) y AmpC (ADC).', referencia: REF.NO_FERM })
    out.alertas.push({ nivel: 'critica', mensaje: 'A. baumannii carbapenem-R: opciones limitadas — ampicilina-sulbactam a dosis altas (sulbactam tiene actividad intrínseca), cefiderocol, o combinaciones con polimixina/minociclina. Infectología obligada.' })
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Ampicilina-sulbactam (dosis altas) o cefiderocol', razon: 'El sulbactam tiene actividad intrínseca frente a Acinetobacter; cefiderocol es activo frente a OXA/MBL.', referencia: REF.NO_FERM })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (A. baumannii MDR).'
  }
}

// ── Stenotrophomonas maltophilia ────────────────────────────────────────────
function maltophilia(r: ResultadoAntibiograma[], out: AporteModulo) {
  out.fenotipos.push({ clave: 'S-maltophilia-intrinseca', nombre: 'S. maltophilia — resistencia intrínseca a carbapenémicos (L1/L2)', confianza: 'confirmado', base: `Produce metalo-β-lactamasa L1 (carbapenemasa) + β-lactamasa L2 → intrínsecamente R a carbapenémicos. ${REF.NO_FERM}` })
  out.mecanismos.push({ categoria: 'β-lactamasa', nombre: 'β-lactamasas cromosómicas L1 (metalo) + L2 (serina)', ambler: 'B', confianza: 'confirmado', explicacion: 'L1 es una metalo-β-lactamasa dependiente de Zn²⁺ que hidroliza carbapenémicos (no inhibida por EDTA en clínica); L2 es una serina-β-lactamasa que hidroliza cefalosporinas y aztreonam. Ambas inducibles.', referencia: REF.NO_FERM })
  out.advertencias.push('S. maltophilia: NO usar carbapenémicos (R intrínseco por L1) — un reporte «S» a carbapenémico es un error a reconfirmar. El cotrimoxazol es el fármaco de elección; alternativas: levofloxacino, minociclina.')
  const smx = estado(r, COTRIMOXAZOL)
  if (ES_S(smx) || smx === null) {
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Trimetoprim-sulfametoxazol (cotrimoxazol)', razon: 'Fármaco de primera elección frente a S. maltophilia.', referencia: REF.NO_FERM })
  } else if (ES_R(smx)) {
    out.alertas.push({ nivel: 'alta', mensaje: 'S. maltophilia cotrimoxazol-R: usar levofloxacino o minociclina; infectología.' })
    out.terapiaDirigida.push({ linea: 'alternativa', agente: 'Levofloxacino o minociclina', razon: 'Alternativas cuando el cotrimoxazol no es opción.', referencia: REF.NO_FERM })
  }
  void AZTREONAM
}
