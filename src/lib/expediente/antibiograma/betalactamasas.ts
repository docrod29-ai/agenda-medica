/**
 * β-lactamasas: clasificación Ambler/Bush y matriz de inhibidores nuevos.
 * Fuente: Bush K, Bradford PA. Nat Rev Microbiol. 2019;17:295-306 (Tablas 1-3).
 *
 * Esta matriz convierte una CLASE de carbapenemasa/β-lactamasa inferida en
 * TERAPIA DIRIGIDA (qué combinación β-lactámico + inhibidor sí funciona).
 */
import type { OpcionTerapeutica } from './tipos'
import { REF } from './referencias'

/** Clase de enzima que el motor puede inferir fenotípicamente. */
export type ClaseEnzima =
  | 'ESBL'        // clase A 2be — BLEE
  | 'AmpC'        // clase C  — cefalosporinasa
  | 'KPC'         // clase A 2f — carbapenemasa de serina
  | 'OXA-48'      // clase D  — oxacilinasa con actividad carbapenemasa
  | 'MBL'         // clase B  — metalo-β-lactamasa (NDM/VIM/IMP)
  | 'carbapenemasa-indeterminada'

/**
 * Cobertura de los inhibidores/agentes nuevos por clase de enzima.
 * ✓ = actividad útil; ✗ = sin actividad (Bush & Bradford 2019, Tabla 2).
 */
export const COBERTURA: Record<string, Record<ClaseEnzima, boolean>> = {
  'ceftazidima-avibactam': { ESBL: true, AmpC: true, KPC: true, 'OXA-48': true, MBL: false, 'carbapenemasa-indeterminada': false },
  'meropenem-vaborbactam': { ESBL: true, AmpC: true, KPC: true, 'OXA-48': false, MBL: false, 'carbapenemasa-indeterminada': false },
  'imipenem-relebactam':   { ESBL: true, AmpC: true, KPC: true, 'OXA-48': false, MBL: false, 'carbapenemasa-indeterminada': false },
  'aztreonam-avibactam':   { ESBL: true, AmpC: true, KPC: true, 'OXA-48': true, MBL: true,  'carbapenemasa-indeterminada': true },
  'cefiderocol':           { ESBL: true, AmpC: true, KPC: true, 'OXA-48': true, MBL: true,  'carbapenemasa-indeterminada': true },
}

export interface DescripcionClase {
  ambler: 'A' | 'B' | 'C' | 'D'
  bush: string
  nombre: string
  inhibidoresClasicos: string
  didactica: string
}

export const CLASES: Record<ClaseEnzima, DescripcionClase> = {
  ESBL: {
    ambler: 'A', bush: '2be', nombre: 'β-lactamasa de espectro extendido (BLEE)',
    inhibidoresClasicos: 'Inhibida por clavulanato, tazobactam y avibactam.',
    didactica: 'Hidroliza penicilinas y cefalosporinas incluidas las de espectro extendido (CTX-M, TEM/SHV derivadas). Respeta carbapenémicos y cefamicinas. Se confirma por sinergia con clavulánico.',
  },
  AmpC: {
    ambler: 'C', bush: '1', nombre: 'cefalosporinasa AmpC',
    inhibidoresClasicos: 'NO inhibida por clavulanato/tazobactam. Inhibida por avibactam y ác. borónico. Cloxacilina antagoniza en la prueba.',
    didactica: 'Confiere R a penicilinas, C1G-C3G y cefamicinas (cefoxitina R). Cefepime es más estable. Los carbapenémicos resisten salvo pérdida de porina asociada. Riesgo de desrepresión bajo C3G en el grupo ESCPM.',
  },
  KPC: {
    ambler: 'A', bush: '2f', nombre: 'carbapenemasa de serina tipo KPC',
    inhibidoresClasicos: 'Inhibida por avibactam, vaborbactam y relebactam; NO por clavulanato/tazobactam.',
    didactica: 'Carbapenemasa de clase A más difundida (K. pneumoniae). Hidroliza penicilinas, cefalosporinas y carbapenémicos. Sensible a ceftazidima-avibactam, meropenem-vaborbactam e imipenem-relebactam.',
  },
  'OXA-48': {
    ambler: 'D', bush: '2df', nombre: 'oxacilinasa con actividad carbapenemasa (OXA-48)',
    inhibidoresClasicos: 'Inhibida por avibactam; NO por vaborbactam ni relebactam. Débilmente por clavulanato.',
    didactica: 'Hidroliza penicilinas y carbapenémicos con hidrólisis débil de cefalosporinas de espectro extendido; a menudo requiere pérdida de porina para MIC alta. Ceftazidima-avibactam y cefiderocol son opciones; NO vaborbactam/relebactam.',
  },
  MBL: {
    ambler: 'B', bush: '3', nombre: 'metalo-β-lactamasa (NDM/VIM/IMP)',
    inhibidoresClasicos: 'Requiere Zn²⁺; NO inhibida por clavulanato, tazobactam, avibactam, vaborbactam ni relebactam. Inhibida in vitro por EDTA/quelantes.',
    didactica: 'Hidroliza todos los β-lactámicos EXCEPTO aztreonam (que sí es hidrolizado por serina-β-lactamasas coproducidas). Por eso la combinación aztreonam + avibactam —o cefiderocol— es la estrategia dirigida.',
  },
  'carbapenemasa-indeterminada': {
    ambler: 'A', bush: '2f/3', nombre: 'carbapenemasa de clase no determinada',
    inhibidoresClasicos: 'Depende de la clase — confirmar por método fenotípico (sinergia con ác. borónico/EDTA, inmunocromatografía) o molecular.',
    didactica: 'El fenotipo confirma carbapenemasa pero no la clase. La elección (avibactam vs aztreonam-avibactam vs cefiderocol) cambia según sea serina (KPC/OXA-48) o metalo (NDM/VIM/IMP).',
  },
}

/**
 * Terapia dirigida por clase de enzima (Bush & Bradford 2019).
 * `czaS`/`czaR` = si se dispone del resultado de ceftazidima-avibactam, afina la inferencia.
 */
export function terapiaPorClase(clase: ClaseEnzima): OpcionTerapeutica[] {
  const ops: OpcionTerapeutica[] = []
  const add = (linea: OpcionTerapeutica['linea'], agente: string, razon: string) =>
    ops.push({ linea, agente, razon, referencia: REF.BLI })

  switch (clase) {
    case 'ESBL':
      add('dirigida', 'Carbapenémico (meropenem/ertapenem)', 'Estándar en infección seria por BLEE; estable a la hidrólisis de clase A 2be.')
      add('alternativa', 'Piperacilina-tazobactam', 'Sólo en foco urinario no grave y con CMI baja; poco fiable a alto inóculo/bacteriemia.')
      add('evitar', 'Cefalosporinas de 3G, aztreonam, cefepime', 'Aunque reporten S pueden fallar a alto inóculo (efecto inóculo de las BLEE).')
      break
    case 'AmpC':
      add('dirigida', 'Cefepime (si S) o carbapenémico', 'Cefepime es más estable a AmpC; carbapenémico en infección grave o alto inóculo.')
      add('evitar', 'Cefalosporinas de 3G y aztreonam', 'Riesgo de desrepresión/hidrólisis aunque el antibiograma las reporte S.')
      break
    case 'KPC':
      add('dirigida', 'Ceftazidima-avibactam, meropenem-vaborbactam o imipenem-relebactam', 'Los tres inhibidores nuevos inhiben KPC (clase A 2f).')
      add('evitar', 'Carbapenémicos en monoterapia', 'Hidrolizados por KPC.')
      break
    case 'OXA-48':
      add('dirigida', 'Ceftazidima-avibactam', 'Avibactam inhibe OXA-48.')
      add('alternativa', 'Cefiderocol', 'Activo frente a OXA-48; útil si co-resistencia.')
      add('evitar', 'Meropenem-vaborbactam e imipenem-relebactam', 'Vaborbactam y relebactam NO inhiben OXA-48.')
      break
    case 'MBL':
      add('dirigida', 'Aztreonam-avibactam (o aztreonam + ceftazidima-avibactam)', 'El aztreonam resiste la hidrólisis de la MBL; el avibactam protege frente a serina-β-lactamasas coproducidas.')
      add('alternativa', 'Cefiderocol', 'Sideróforo activo frente a metalo-β-lactamasas.')
      add('evitar', 'Ceftazidima-avibactam sola, vaborbactam, relebactam', 'Ninguno inhibe MBL de clase B.')
      break
    case 'carbapenemasa-indeterminada':
      add('dirigida', 'Confirmar CLASE antes de elegir', 'Serina (KPC/OXA-48) → avibactam; metalo (NDM/VIM/IMP) → aztreonam-avibactam/cefiderocol.')
      add('alternativa', 'Cefiderocol', 'Cobertura amplia mientras se confirma la clase; infectología obligada.')
      break
  }
  return ops
}
