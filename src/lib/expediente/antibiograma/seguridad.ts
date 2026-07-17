/**
 * Capa de SEGURIDAD del antibiograma — EUCAST Expert Rules
 * (Leclercq, Cantón et al., Clin Microbiol Infect 2013;19:141-160), Tablas 5-7 y 12-13.
 *
 *   1. FENOTIPOS EXCEPCIONALES (T5-7): un resultado no descrito o rarísimo = probable error
 *      de identificación/susceptibilidad → confirmar / enviar a referencia.
 *   2. CROSS-RESISTENCIA de FLUOROQUINOLONAS (T13): la R a la FQ más activa implica R a todas →
 *      edición interpretativa (marcar como R un fármaco reportado «S» que fallaría).
 *   3. HLAR (T12): en enterococo, la R de alto nivel a aminoglucósidos anula la sinergia.
 *
 * (La resistencia intrínseca «S engañosa» de T1-4 se resuelve en intrinseca.ts.)
 */
import type { AlertaAntibiograma, ResultadoAntibiograma, EdicionInterpretativa } from './tipos'
import {
  organismoEs, estado, ES_R, ES_S, NO_S,
  VANCOMICINA, TEICOPLANINA, LINEZOLID, DAPTOMICINA, TIGECICLINA,
  IMIPENEM, MEROPENEM, AMPICILINA, COLISTINA,
  CIPROFLOXACINO, LEVOFLOXACINO, MOXIFLOXACINO,
} from './util'

const EUCAST = 'EUCAST Expert Rules (Leclercq/Cantón, Clin Microbiol Infect 2013;19:141-160)'

export interface AporteSeguridad {
  excepcionales: AlertaAntibiograma[]
  edicionesFQ: EdicionInterpretativa[]
  avisos: string[]
}

/** Fenotipos excepcionales = probable error de ID/AST (EUCAST T5-7). */
export function fenotiposExcepcionales(organismo: string, r: ResultadoAntibiograma[]): AlertaAntibiograma[] {
  const out: AlertaAntibiograma[] = []
  const anyR = (...grupos: string[][]) => grupos.some(g => NO_S(estado(r, g)))

  // 6.1 — S. aureus R a glucopéptido/linezolid/daptomicina/tigeciclina = rarísimo.
  if (organismoEs(organismo, ['staphylococcus', 'aureus']) && anyR(VANCOMICINA, TEICOPLANINA, LINEZOLID, DAPTOMICINA, TIGECICLINA)) {
    out.push({ nivel: 'alta', mensaje: `Fenotipo EXCEPCIONAL: S. aureus R a vancomicina/teicoplanina/linezolid/daptomicina/tigeciclina → confirmar ID/AST y enviar a laboratorio de referencia. ${EUCAST} T6.` })
  }
  // 6.4 — neumococo R a carbapenémico/glucopéptido/linezolid.
  if (organismoEs(organismo, ['streptococcus pneumoniae', 'neumococo', 'pneumococ']) && !organismoEs(organismo, ['klebsiella']) && anyR(IMIPENEM, MEROPENEM, VANCOMICINA, TEICOPLANINA, LINEZOLID)) {
    out.push({ nivel: 'alta', mensaje: `Fenotipo EXCEPCIONAL: S. pneumoniae R a imipenem/meropenem/vancomicina/teicoplanina/linezolid → confirmar ID/AST. ${EUCAST} T6.` })
  }
  // 6.5 — estreptococo β-hemolítico R a penicilina/ampicilina.
  if (organismoEs(organismo, ['pyogenes', 'agalactiae', 'grupo a', 'grupo b', 'β-hemol', 'beta-hemol']) && ES_R(estado(r, AMPICILINA))) {
    out.push({ nivel: 'alta', mensaje: `Fenotipo EXCEPCIONAL: estreptococo β-hemolítico R a penicilina/ampicilina (uniformemente sensible) → confirmar ID/AST. ${EUCAST} T6.` })
  }
  // 6.7-6.8 — E. faecalis R a ampicilina → sospechar identificación errónea (probable E. faecium).
  if (organismoEs(organismo, ['faecalis']) && ES_R(estado(r, AMPICILINA))) {
    out.push({ nivel: 'alta', mensaje: `E. faecalis R a ampicilina es raro → sospechar identificación errónea (probable E. faecium). ${EUCAST} T6.` })
  }
  // 5.3 — colistina-R en P. aeruginosa / Acinetobacter = emergente.
  if (organismoEs(organismo, ['aeruginosa', 'acinetobacter', 'baumannii']) && ES_R(estado(r, COLISTINA))) {
    out.push({ nivel: 'alta', mensaje: `Colistina-R en P. aeruginosa/Acinetobacter es EXCEPCIONAL (resistencia emergente) → confirmar y notificar. ${EUCAST} T5.` })
  }
  return out
}

/**
 * Cross-resistencia de fluoroquinolonas (EUCAST T13): la R a la FQ más activa implica R a todas.
 *   - Gram-negativos: cipro es la más activa → cipro-R ⇒ marcar levo/moxi como R (13.5).
 *   - Gram-positivos (estafilo/neumococo): levo/moxi son las más activas → levo/moxi-R ⇒ todas R
 *     (13.2/13.4); cipro-R con levo/moxi-S = mutación de primer paso → aviso (13.1/13.3).
 */
export function crossResistenciaFQ(organismo: string, r: ResultadoAntibiograma[]): { ediciones: EdicionInterpretativa[]; avisos: string[] } {
  const ediciones: EdicionInterpretativa[] = []
  const avisos: string[] = []
  const isR = (g: string[]) => NO_S(estado(r, g))
  const isS = (g: string[]) => ES_S(estado(r, g))
  const editar = (g: string[], nombre: string, regla: string) => {
    if (isS(g)) ediciones.push({ antibiotico: nombre, de: 'S', a: 'R', razon: `Inferencia por cross-resistencia de fluoroquinolonas (${regla}).`, referencia: `${EUCAST} T13` })
  }
  const esGN = organismoEs(organismo, ['coli', 'klebsiella', 'enterobacter', 'serratia', 'citrobacter', 'cloacae', 'aerogenes', 'freundii', 'koseri', 'hafnia', 'escherichia', 'proteus', 'providencia', 'morganella', 'aeruginosa', 'acinetobacter', 'baumannii', 'salmonella', 'shigella'])
  const esStaph = organismoEs(organismo, ['staphylococcus', 'aureus'])
  const esNeumo = organismoEs(organismo, ['streptococcus pneumoniae', 'neumococo', 'pneumococ']) && !organismoEs(organismo, ['klebsiella'])

  if (esGN) {
    if (isR(CIPROFLOXACINO)) { editar(LEVOFLOXACINO, 'Levofloxacino', '13.5'); editar(MOXIFLOXACINO, 'Moxifloxacino', '13.5') }
  } else if (esStaph || esNeumo) {
    if (isR(LEVOFLOXACINO) || isR(MOXIFLOXACINO)) {
      editar(CIPROFLOXACINO, 'Ciprofloxacino', esStaph ? '13.2' : '13.4')
      editar(LEVOFLOXACINO, 'Levofloxacino', esStaph ? '13.2' : '13.4')
      editar(MOXIFLOXACINO, 'Moxifloxacino', esStaph ? '13.2' : '13.4')
    } else if (isR(CIPROFLOXACINO)) {
      avisos.push(`Cipro/ofloxacino-R con levo/moxi-S: mutación de PRIMER PASO → riesgo de selección de R a todas las fluoroquinolonas durante el tratamiento. ${EUCAST} T13 (13.1/13.3).`)
    }
  }
  return { ediciones, avisos }
}

export function analizarSeguridad(organismo: string, r: ResultadoAntibiograma[]): AporteSeguridad {
  const excepcionales = fenotiposExcepcionales(organismo, r)
  const { ediciones, avisos } = crossResistenciaFQ(organismo, r)
  return { excepcionales, edicionesFQ: ediciones, avisos }
}
