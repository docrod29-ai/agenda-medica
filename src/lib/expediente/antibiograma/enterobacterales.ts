/**
 * Fenotipos de Enterobacterales: BLEE, AmpC (intrínseca/plasmídica/desreprimida),
 * IRT y carbapenemasas (con inferencia de clase A/B/D e integración a la matriz
 * de inhibidores nuevos).
 * Fuente: Navarro F, et al. 2010 (Tablas 1-2) + Bush & Bradford 2019.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { REF } from './referencias'
import {
  organismoEs, estado, ES_R, ES_S,
  CEF3G, CEFOXITINA, CEFEPIME, AZTREONAM, CARBAPENEM, AMOXI_CLAV,
  CEFTAZIDIMA_AVIBACTAM, algunoR, algunoS,
} from './util'
import { CLASES, terapiaPorClase, type ClaseEnzima } from './betalactamasas'

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
  const carbaR = algunoR(r, CARBAPENEM)
  const carbaS = algunoS(r, CARBAPENEM)
  const aztreonamR = ES_R(estado(r, AZTREONAM))
  const cefepimeS = ES_S(estado(r, CEFEPIME))
  const amoxiClavR = ES_R(estado(r, AMOXI_CLAV))
  const cza = estado(r, CEFTAZIDIMA_AVIBACTAM)
  const esAmpCintrinseco = organismoEs(organismo, GRUPO_AMPC_INDUCIBLE)

  // ── 1) CARBAPENEMASA (prioritaria) ─────────────────────────────────────────
  if (carbaR) {
    const clase = inferirClaseCarbapenemasa(cza)
    const desc = CLASES[clase]
    out.fenotipos.push({
      clave: 'carbapenemasa',
      nombre: `Resistencia a carbapenémicos — ${desc.nombre}`,
      confianza: 'probable',
      base: `Carbapenémico R en Enterobacterales. ${claseBase(clase, cza)} ${REF.ENTEROBACT}`,
    })
    out.mecanismos.push({
      categoria: 'β-lactamasa', nombre: desc.nombre, ambler: desc.ambler, confianza: 'probable',
      explicacion: desc.didactica, referencia: REF.BLI,
    })
    out.alertas.push({ nivel: 'critica', mensaje: `Carbapenemasa (${clase}): infectología obligada. ${claseAlerta(clase)}` })
    out.advertencias.push('Confirmar la CLASE por método fenotípico (sinergia con ác. borónico → serina; con EDTA → metalo) o molecular/inmunocromatografía antes de elegir inhibidor nuevo.')
    for (const t of terapiaPorClase(clase)) out.terapiaDirigida.push(t)
    if (cza === 'S') out.terapiaDirigida.unshift({ linea: 'dirigida', agente: 'Ceftazidima-avibactam (S in vitro)', razon: 'Reportado sensible → confirma carbapenemasa de serina tratable con avibactam.', referencia: REF.BLI })
    out.didactica.push({ titulo: 'Cómo se infiere la clase de carbapenemasa', texto: 'Ceftazidima-avibactam S sugiere serina (KPC/OXA-48, avibactam las inhibe). Ceftazidima-avibactam R con carbapenémico R sugiere metalo-β-lactamasa (NDM/VIM/IMP), que NO es inhibida por avibactam pero respeta el aztreonam.', referencia: REF.BLI })
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

function inferirClaseCarbapenemasa(cza: string | null): ClaseEnzima {
  if (cza === 'R') return 'MBL'                       // avibactam no cubre → metalo
  if (cza === 'S') return 'carbapenemasa-indeterminada' // serina (KPC/OXA-48) — clase exacta necesita molecular
  return 'carbapenemasa-indeterminada'
}

function claseBase(clase: ClaseEnzima, cza: string | null): string {
  if (clase === 'MBL') return 'Ceftazidima-avibactam R → sugiere metalo-β-lactamasa (NDM/VIM/IMP); respeta aztreonam.'
  if (cza === 'S') return 'Ceftazidima-avibactam S → carbapenemasa de SERINA (KPC u OXA-48).'
  return 'Clase no determinada por el panel; confirmar (serina vs metalo).'
}

function claseAlerta(clase: ClaseEnzima): string {
  if (clase === 'MBL') return 'Sospecha de MBL: aztreonam-avibactam o cefiderocol. NO sirve ceftazidima-avibactam sola.'
  return 'Ceftazidima-avibactam / meropenem-vaborbactam / imipenem-relebactam según clase (KPC) u OXA-48 (sólo avibactam/cefiderocol).'
}
