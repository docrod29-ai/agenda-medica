/**
 * Epidemiología de resistencia — SOLO de fuentes primarias (regla del Dr.: nada de diapositivas).
 *   México  = Red INVIFAR (Colín-Castro et al., PLoS One 2025;20(4):e0319441; datos Q1-2024).
 *   Mundo   = WHO GLASS 2025 (Global antibiotic resistance surveillance report 2025).
 *
 * Uso clínico: fijar el PRIOR bayesiano. En México NDM domina en Enterobacterales →
 * ante una carbapenemasa sin confirmar, sospechar MBL primero (no el esquema KPC-céntrico).
 * Además: en México frecuentemente NO hay aztreonam NI cefiderocol → esquemas locales reales.
 */
import { REF } from './referencias'

export const REF_INVIFAR =
  'Colín-Castro CA, et al. Red INVIFAR. PLoS One 2025;20(4):e0319441 (datos Q1-2024, 8708 cepas, 41 centros).'
export const REF_GLASS =
  'WHO. Global antibiotic resistance surveillance report (GLASS) 2025. ISBN 978-92-4-011633-7 (datos 2023).'

/** Prior mexicano para carbapenemasa en Enterobacterales (INVIFAR). */
export const PRIOR_MEXICO = {
  ecoliNDM: 0.592,            // 59.2% NDM en E. coli no-S a carbapenémicos (el "84%" era el reporte 2023)
  klebsiellaMixto: true,      // K. pneumoniae: genotipo mixto KPC≈VIM≈OXA-48
  acinetobacterOXA24: 0.894,  // A. baumannii OXA-24 89.4%
  aeruginosaGES: 0.431,       // P. aeruginosa GES 43.1%
  nota:
    'México (INVIFAR 2024): en Enterobacterales NDM es la carbapenemasa más frecuente (59.2% en E. coli no-S). ' +
    'Ante CRE sin confirmar, sospechar MBL PRIMERO. En K. pneumoniae el genotipo es MIXTO (KPC/VIM/OXA-48).',
  referencia: REF_INVIFAR,
}

/**
 * ⚠ Realidad de acceso a fármacos en México: frecuentemente NO hay aztreonam NI cefiderocol
 * (los agentes de elección mundial para MBL). Esquemas locales reales guiados por susceptibilidad.
 * Corrección explícita del Dr. — NO asumir disponibilidad.
 */
export const ESQUEMAS_MBL_MEXICO = [
  'Colistina (carga 9 MUI → 4.5 MUI c/12h) + meropenem 2g c/8h IV en infusión extendida (3h)',
  'Amikacina ajustada por TFG (SOLO si S en el antibiograma) + colistina',
  'Colistina + tigeciclina + fosfomicina (tigeciclina NO en foco urinario ni bacteriémico)',
]

export const AVISO_ACCESO_MEXICO =
  '⚠ En México frecuentemente NO hay aztreonam NI cefiderocol → individualizar por SUSCEPTIBILIDAD ' +
  `(${ESQUEMAS_MBL_MEXICO.join(' · ')}) en combinación + interconsulta a Infectología OBLIGATORIA.`

/** Métodos de confirmación vigentes (Hodge obsoleto). */
export const METODOS_CONFIRMACION =
  'Confirmar carbapenemasa con mCIM/eCIM, inmunocromatografía (Carba 5/RESIST-5) o PCR (Xpert Carba-R). ' +
  'El test de Hodge modificado está obsoleto.'

void REF
