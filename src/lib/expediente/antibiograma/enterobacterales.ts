/**
 * Fenotipos de Enterobacterales: BLEE, AmpC (intrínseca/plasmídica/desreprimida),
 * IRT y carbapenemasas (con inferencia de clase A/B/D e integración a la matriz
 * de inhibidores nuevos).
 * Fuente: Navarro F, et al. 2010 (Tablas 1-2) + Bush & Bradford 2019.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { REF } from './referencias'
import {
  organismoEs, estado, ES_R, ES_S, NO_S,
  CEF3G, CEFOXITINA, CEFEPIME, AZTREONAM, CARBAPENEM, AMOXI_CLAV,
  CEFTAZIDIMA_AVIBACTAM, IMIPENEM, MEROPENEM, ERTAPENEM, PIP_TAZO, algunoR, algunoS,
} from './util'
import { CLASES, terapiaPorClase, type ClaseEnzima } from './betalactamasas'
import { PRIOR_MEXICO, AVISO_ACCESO_MEXICO, METODOS_CONFIRMACION, REF_INVIFAR } from './epidemiologia'

/** Especies con AmpC cromosómica INDUCIBLE (grupo 3 de Navarro / ESCPM). */
const GRUPO_AMPC_INDUCIBLE = [
  'enterobacter', 'klebsiella aerogenes', 'serratia', 'citrobacter freundii',
  'morganella', 'providencia', 'hafnia',
]

const ENTEROBACTERALES = [
  'escherichia', 'e. coli', 'e.coli', 'coli', 'klebsiella', 'enterobacter',
  'serratia', 'citrobacter', 'proteus', 'morganella', 'providencia', 'salmonella',
  'shigella', 'hafnia', 'raoultella', 'pantoea', 'kluyvera', 'enterobacter',
]

export function esEnterobacterales(organismo: string): boolean {
  return organismoEs(organismo, ENTEROBACTERALES)
}

export function analizarEnterobacterales(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()
  if (!esEnterobacterales(organismo)) return out

  const cefoxitinaR = ES_R(estado(r, CEFOXITINA))
  const any3gR = algunoR(r, CEF3G)
  const carbaS = algunoS(r, CARBAPENEM)
  const aztreonamR = ES_R(estado(r, AZTREONAM))
  const aztreonamS = ES_S(estado(r, AZTREONAM))
  const cefepimeS = ES_S(estado(r, CEFEPIME))
  const amoxiClavR = ES_R(estado(r, AMOXI_CLAV))
  const cza = estado(r, CEFTAZIDIMA_AVIBACTAM)
  const czaNoS = NO_S(cza)
  const esAmpCintrinseco = organismoEs(organismo, GRUPO_AMPC_INDUCIBLE)

  const imi = estado(r, IMIPENEM)
  const mer = estado(r, MEROPENEM)
  const ert = estado(r, ERTAPENEM)
  // Proteae (Proteus/Morganella/Providencia): imipenem-R es INTRÍNSECO → cribar CRE con ertapenem/meropenem,
  // NO con imipenem (Simner/Pitout, Clin Microbiol Rev 2024;37(4)).
  const esProteae = organismoEs(organismo, ['proteus', 'morganella', 'providencia'])
  const carbaR = esProteae ? (NO_S(ert) || NO_S(mer)) : algunoR(r, CARBAPENEM)

  // ── 1) CARBAPENEMASA (prioritaria) ─────────────────────────────────────────
  if (carbaR) {
    // Patrón ERTAPENEM-AISLADO: ert no-S con imi Y mer S → pérdida de porina + BLEE/AmpC,
    // o carbapenemasa de bajo nivel tipo OXA-48-like (solo eleva ertapenem). NO es carbapenemasa de alto nivel.
    const ertAislado = NO_S(ert) && ES_S(imi) && ES_S(mer)
    if (ertAislado && !czaNoS) {
      out.fenotipos.push({
        clave: 'porina-perdida', nombre: 'Patrón ertapenem-aislado (pérdida de porina + BLEE/AmpC, u OXA-48-like)', confianza: 'probable',
        base: `Ertapenem no-S con imipenem y meropenem S. El ertapenem es el carbapenémico más sensible a la impermeabilidad y a OXA-48. ${REF.ENTEROBACT}`,
      })
      out.mecanismos.push({ categoria: 'porina', nombre: 'Pérdida de porina (OmpK35/36) + β-lactamasa', confianza: 'probable', explicacion: 'La pérdida de porina SOLA no eleva la CMI de carbapenémicos; con una BLEE/AmpC coproducida sí → carbapenem-R SIN carbapenemasa (más frecuente que la carbapenemasa). Diferencial: OXA-48-like (clase D), que típicamente solo eleva el ertapenem.', referencia: REF.BLI })
      out.advertencias.push('Patrón ertapenem-aislado: CONFIRMAR SIEMPRE por método molecular (incluido OXA-48) antes de fijar esquema. Si es OXA-48 → ceftazidima-avibactam (NO meropenem-vaborbactam).')
      out.didactica.push({ titulo: 'Ertapenem aislado — ¿porina u OXA-48?', texto: 'Pérdida de porina + BLEE/AmpC, o carbapenemasa OXA-48-like de bajo nivel: ambas suben sobre todo el ertapenem. La distinción exige método molecular. ' + METODOS_CONFIRMACION, referencia: REF.BLI })
      out.notificacion = true
      out.aislamiento = 'Precauciones de contacto (posible productor de carbapenemasa — confirmar).'
      return out
    }

    // Discriminador por CAZ-AVI (EUCAST/IDSA + Bush): CAZ-AVI no-S en CRE EXCLUYE KPC y OXA-48
    // (avibactam las inhibe) → orienta a METALO-β-lactamasa. Si aztreonam TAMBIÉN no-S, hay una
    // serino-β-lactamasa COPRODUCIDA: "no es una carbapenemasa, son dos".
    const clase = inferirClaseCarbapenemasa(cza, aztreonamS)
    const desc = CLASES[clase]
    out.fenotipos.push({
      clave: 'carbapenemasa',
      nombre: `Resistencia a carbapenémicos — ${desc.nombre}`,
      confianza: 'probable',
      base: `Carbapenémico R en Enterobacterales. ${claseBase(clase, cza, aztreonamS)} ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({
      categoria: 'β-lactamasa', nombre: desc.nombre, ambler: desc.ambler, confianza: 'probable',
      explicacion: desc.didactica, referencia: REF.BLI,
    })
    out.alertas.push({ nivel: 'critica', mensaje: `Carbapenemasa (${clase}): infectología OBLIGADA. ${claseAlerta(clase)}` })
    out.advertencias.push(`Confirmar la CLASE por método molecular/fenotípico antes de elegir inhibidor. ${METODOS_CONFIRMACION}`)

    // Prior mexicano (INVIFAR): NDM domina en Enterobacterales → sospechar MBL primero si no hay CAZ-AVI.
    if (clase === 'carbapenemasa-indeterminada' && cza === null) {
      out.alertas.push({ nivel: 'alta', mensaje: `Epidemiología local: ${PRIOR_MEXICO.nota}` })
      out.didactica.push({ titulo: 'Prior mexicano (INVIFAR 2024)', texto: `${PRIOR_MEXICO.nota} Por eso, ante CRE sin confirmar en México, la sospecha empírica es MBL (NDM) antes que KPC.`, referencia: REF_INVIFAR })
    }
    // Terapia dirigida por clase + realidad de acceso en México para MBL.
    for (const t of terapiaPorClase(clase)) out.terapiaDirigida.push(t)
    if (clase === 'MBL') {
      out.alertas.push({ nivel: 'alta', mensaje: AVISO_ACCESO_MEXICO })
      out.terapiaDirigida.push({ linea: 'alternativa', agente: 'México (sin aztreonam/cefiderocol): colistina+meropenem, amikacina(si S)+colistina o colistina+tigeciclina+fosfomicina', razon: 'Esquemas locales guiados por susceptibilidad cuando no hay agentes de elección. CONSULTAR INFECTOLOGÍA.', referencia: REF_INVIFAR })
    }
    if (cza === 'S') out.terapiaDirigida.unshift({ linea: 'dirigida', agente: 'Ceftazidima-avibactam (S in vitro)', razon: 'Reportado sensible → confirma carbapenemasa de serina tratable con avibactam.', referencia: REF.BLI })
    out.didactica.push({ titulo: 'Cómo se infiere la clase de carbapenemasa', texto: 'CAZ-AVI S → serina (KPC/OXA-48). CAZ-AVI no-S en CRE → EXCLUYE KPC/OXA-48 → metalo-β-lactamasa (NDM/VIM/IMP); si además aztreonam no-S, hay serino-β-lactamasa coproducida ("son dos"). Aztreonam conservado (S) con carbapenémicos no-S es firma de MBL (hidrolizan todo salvo monobactámicos).', referencia: REF.BLI })
    out.notificacion = true
    out.aislamiento = 'Precauciones de contacto (productor de carbapenemasa).'
    return out // el fenotipo de carbapenemasa domina; no seguir con BLEE/AmpC
  }

  // ── 2) AmpC (intrínseca inducible o plasmídica/desreprimida) ────────────────
  const ampcFenotipico = cefoxitinaR && any3gR
  if (esAmpCintrinseco || ampcFenotipico) {
    const nombre = esAmpCintrinseco
      ? 'AmpC cromosómica inducible (grupo ESCPM)'
      : 'AmpC plasmídica o desreprimida (cefoxitina R + C3G R)'
    out.fenotipos.push({
      clave: 'AmpC', nombre, confianza: esAmpCintrinseco ? 'confirmado' : 'probable',
      base: esAmpCintrinseco
        ? `Especie del grupo con AmpC cromosómica inducible. Riesgo de DESREPRESIÓN y fallo bajo C3G. ${REF.ENTEROBACT}`
        : `Cefoxitina R + C3G R: AmpC (no inhibida por clavulanato). ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: CLASES.AmpC.nombre, ambler: 'C', confianza: esAmpCintrinseco ? 'confirmado' : 'probable', explicacion: CLASES.AmpC.didactica, referencia: REF.ENTEROBACT })
    out.advertencias.push('AmpC: NO usar cefalosporinas de 3ª generación aunque el antibiograma las reporte S (desrepresión/hidrólisis durante el tratamiento).')
    if (ES_S(estado(r, PIP_TAZO))) {
      out.advertencias.push('AmpC: piperacilina-tazobactam «S» NO es fiable (piperacilina es sustrato de AmpC; el tazobactam es inductor débil → efecto inóculo). Meini S, Infection 2019;47:363-75.')
    }
    for (const t of terapiaPorClase('AmpC')) out.terapiaDirigida.push(t)
    out.alertas.push({ nivel: 'alta', mensaje: cefepimeS ? 'AmpC: cefepime (S) por su estabilidad relativa a AmpC; carbapenémico si es grave/alto inóculo.' : 'AmpC: usar carbapenémico (cefepime no S/no disponible).' })
    // ESAC: si además ceftazidima y cefepime R, es AmpC de espectro ampliado.
    if (any3gR && !cefepimeS && ES_R(estado(r, CEFEPIME))) {
      out.didactica.push({ titulo: 'AmpC de espectro ampliado (ESAC)', texto: 'AmpC + cefepime R sugiere ESAC (AmpC de espectro ampliado): sensibilidad disminuida a todas las cefalosporinas incluida cefepime; su diferenciación de una carbapenemasa requiere confirmación.', referencia: REF.ENTEROBACT })
    }
    return out
  }

  // ── 3) BLEE: C3G R + carbapenem S + cefoxitina NO R ─────────────────────────
  if (any3gR && carbaS && !cefoxitinaR) {
    out.fenotipos.push({
      clave: 'BLEE', nombre: 'β-lactamasa de espectro extendido (BLEE)', confianza: 'probable',
      base: aztreonamR
        ? `C3G R + aztreonam R + cefoxitina NO-R + carbapenémico S: patrón de BLEE (inhibida por clavulanato). ${REF.ENTEROBACT}`
        : `C3G R + carbapenémico S + cefoxitina NO-R: BLEE probable; confirmar sinergia con clavulanato. ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: CLASES.ESBL.nombre, ambler: 'A', confianza: 'probable', explicacion: CLASES.ESBL.didactica, referencia: REF.ENTEROBACT })
    out.advertencias.push('BLEE: evitar C3G, aztreonam y cefepime (poco fiable a alto inóculo/bacteriemia) aunque reporten S. Carbapenémico es el estándar en infección seria.')
    for (const t of terapiaPorClase('ESBL')) out.terapiaDirigida.push(t)
    out.alertas.push({ nivel: 'alta', mensaje: 'BLEE probable: carbapenémico dirigido en infección seria; desescalar según foco y evolución.' })
    return out
  }

  // ── 4) IRT: amox-clav R con C3G S (β-lactamasa resistente a inhibidores) ────
  if (amoxiClavR && !any3gR && !cefoxitinaR) {
    out.fenotipos.push({
      clave: 'IRT', nombre: 'β-lactamasa resistente a inhibidores (IRT)', confianza: 'sospecha',
      base: `Amoxicilina-clavulánico R con cefalosporinas de 3G S: patrón de TEM/SHV resistente a inhibidores (IRT). ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({ categoria: 'β-lactamasa', nombre: 'IRT (TEM/SHV inhibidor-resistente)', ambler: 'A', confianza: 'sospecha', explicacion: 'Resistente a clavulanato/sulbactam, sensible a tazobactam y avibactam; mantiene sensibilidad a C3G, monobactámicos y carbapenémicos.', referencia: REF.ENTEROBACT })
    out.advertencias.push('IRT: las cefalosporinas de 3G siguen activas; el problema es sólo con las combinaciones con inhibidor clásico.')
  }

  return out
}

function inferirClaseCarbapenemasa(cza: string | null, aztreonamS: boolean): ClaseEnzima {
  if (cza === 'R' || cza === 'I') return 'MBL'          // CAZ-AVI no-S excluye KPC/OXA-48 → metalo
  if (cza === 'S') return 'carbapenemasa-indeterminada' // serina (KPC/OXA-48) — clase exacta necesita molecular
  if (aztreonamS) return 'MBL'                          // aztreonam conservado + carbapenémico no-S = firma MBL
  return 'carbapenemasa-indeterminada'
}

function claseBase(clase: ClaseEnzima, cza: string | null, aztreonamS: boolean): string {
  if (clase === 'MBL') {
    if (cza === 'R' || cza === 'I') return 'Ceftazidima-avibactam no-S → EXCLUYE KPC y OXA-48 → metalo-β-lactamasa (NDM/VIM/IMP); respeta aztreonam. Si aztreonam también no-S: serino-β-lactamasa coproducida ("son dos").'
    if (aztreonamS) return 'Aztreonam conservado (S) con carbapenémico no-S → firma de metalo-β-lactamasa (NDM/VIM/IMP): hidrolizan todo salvo monobactámicos.'
    return 'Sugiere metalo-β-lactamasa.'
  }
  if (cza === 'S') return 'Ceftazidima-avibactam S → carbapenemasa de SERINA (KPC u OXA-48).'
  return 'Clase no determinada por el panel; confirmar (serina vs metalo).'
}

function claseAlerta(clase: ClaseEnzima): string {
  if (clase === 'MBL') return 'Sospecha de MBL: aztreonam-avibactam o cefiderocol DONDE estén disponibles. La ceftazidima-avibactam SOLA es INACTIVA contra MBL.'
  return 'Ceftazidima-avibactam / meropenem-vaborbactam / imipenem-relebactam según clase (KPC) u OXA-48 (sólo avibactam/cefiderocol).'
}
