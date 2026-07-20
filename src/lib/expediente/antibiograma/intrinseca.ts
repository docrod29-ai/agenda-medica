/**
 * Resistencia intrínseca (natural) por especie/grupo.
 *
 * Doble utilidad clínica (ambas descritas en las fuentes):
 *   1. CONFLICTO: si el laboratorio reporta «S» para un antibiótico al que la
 *      especie es intrínsecamente resistente, es una señal de error de
 *      identificación o de prueba → hay que reconfirmar. [EB, NF, CLSI]
 *   2. CONTEXTO: recordar al clínico la resistencia esperada para que no elija
 *      un fármaco inútil aunque no se haya probado.
 *
 * Fuente principal de enterobacterias: Navarro F, et al. 2010, Tabla 1
 * (patrones de resistencia natural, modificada del CASFM).
 * No fermentadores y Gram+ : Vila & Marco 2010 / Torres & Cercenado 2010.
 */
import type { NotaIntrinseca, ResultadoAntibiograma } from './tipos'
import { REF } from './referencias'
import {
  organismoEs, ES_S, todosLosEstados,
  AMPICILINA, AMOXI_CLAV, CEF1G, CEFOXITINA, COLISTINA, NITROFURANTOINA,
  TETRACICLINA, TIGECICLINA, CARBAPENEM, AZTREONAM, COTRIMOXAZOL, CEF3G, CEFEPIME,
} from './util'

interface ReglaIntrinseca {
  /** Claves para reconocer la especie/grupo. */
  claves: string[]
  /** Antibióticos (sinónimos) a los que es intrínsecamente R. */
  resistentes: { agente: string[]; nota: string }[]
  ref: string
}

const REGLAS: ReglaIntrinseca[] = [
  // ── Enterobacterales (Navarro 2010, Tabla 1) ──────────────────────────────
  {
    claves: ['klebsiella'],
    resistentes: [{ agente: AMPICILINA, nota: 'Klebsiella spp. porta β-lactamasa cromosómica natural (SHV-1/K1) → ampicilina/ticarcilina R de forma intrínseca.' }],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['proteus mirabilis'],
    resistentes: [
      { agente: COLISTINA, nota: 'Proteus mirabilis es intrínsecamente R a colistina/polimixina (lipopolisacárido modificado).' },
      { agente: TIGECICLINA, nota: 'Proteae (Proteus/Providencia/Morganella) intrínsecamente R a tigeciclina.' },
      { agente: NITROFURANTOINA, nota: 'Proteus es intrínsecamente R a nitrofurantoína.' },
      { agente: TETRACICLINA, nota: 'Proteus es intrínsecamente R a tetraciclina/minociclina.' },
    ],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['proteus vulgaris', 'proteus penneri'],
    resistentes: [
      { agente: AMPICILINA, nota: 'P. vulgaris/penneri portan β-lactamasa cromosómica clase A → ampicilina y cefuroxima R.' },
      { agente: CEF1G, nota: 'P. vulgaris/penneri: cefalosporinas de 1ª generación R.' },
      { agente: COLISTINA, nota: 'Proteus spp. intrínsecamente R a colistina.' },
      { agente: NITROFURANTOINA, nota: 'Proteus spp. intrínsecamente R a nitrofurantoína.' },
    ],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['morganella'],
    resistentes: [
      { agente: AMPICILINA, nota: 'Morganella morganii: AmpC cromosómica inducible → ampicilina, amox-clav y C1G R.' },
      { agente: AMOXI_CLAV, nota: 'Morganella: amoxicilina-clavulánico R (AmpC no inhibida por clavulanato).' },
      { agente: CEF1G, nota: 'Morganella: cefalosporinas de 1ª generación R.' },
      { agente: COLISTINA, nota: 'Morganella intrínsecamente R a colistina.' },
      { agente: NITROFURANTOINA, nota: 'Morganella intrínsecamente R a nitrofurantoína.' },
    ],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['providencia'],
    resistentes: [
      { agente: AMPICILINA, nota: 'Providencia spp.: AmpC cromosómica inducible → aminopenicilinas y C1G R.' },
      { agente: AMOXI_CLAV, nota: 'Providencia: amoxicilina-clavulánico R.' },
      { agente: CEF1G, nota: 'Providencia: C1G R.' },
      { agente: COLISTINA, nota: 'Providencia intrínsecamente R a colistina.' },
      { agente: NITROFURANTOINA, nota: 'Providencia intrínsecamente R a nitrofurantoína.' },
    ],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['serratia'],
    resistentes: [
      { agente: AMPICILINA, nota: 'Serratia marcescens: AmpC cromosómica inducible → aminopenicilinas, amox-clav y C1G R.' },
      { agente: CEF1G, nota: 'Serratia: cefalosporinas de 1ª generación R.' },
      { agente: COLISTINA, nota: 'Serratia marcescens intrínsecamente R a colistina/polimixina.' },
    ],
    ref: REF.ENTEROBACT,
  },
  {
    claves: ['enterobacter', 'klebsiella aerogenes', 'hafnia', 'citrobacter freundii'],
    resistentes: [
      { agente: AMPICILINA, nota: 'Grupo con AmpC cromosómica inducible (Enterobacter/K. aerogenes/C. freundii/Hafnia): aminopenicilinas R.' },
      { agente: AMOXI_CLAV, nota: 'AmpC inducible → amoxicilina-clavulánico R (clavulanato no inhibe AmpC).' },
      { agente: CEF1G, nota: 'AmpC inducible → cefalosporinas de 1ª generación R.' },
      { agente: CEFOXITINA, nota: 'AmpC inducible → cefoxitina (cefamicina) R.' },
    ],
    ref: REF.ENTEROBACT,
  },
  // ── No fermentadores (Vila & Marco 2010) ──────────────────────────────────
  {
    claves: ['stenotrophomonas', 'maltophilia'],
    resistentes: [
      { agente: CARBAPENEM, nota: 'S. maltophilia produce metalo-β-lactamasa cromosómica L1 → intrínsecamente R a TODOS los carbapenémicos. El cotrimoxazol es el fármaco de elección.' },
    ],
    ref: REF.NO_FERM,
  },
  {
    claves: ['pseudomonas', 'aeruginosa'],
    resistentes: [
      { agente: AMPICILINA, nota: 'P. aeruginosa: AmpC + baja permeabilidad + MexAB-OprM → R intrínseco a penicilinas/aminopenicilinas.' },
      { agente: AMOXI_CLAV, nota: 'P. aeruginosa intrínsecamente R a amoxicilina-clavulánico.' },
      { agente: CEF1G, nota: 'P. aeruginosa: C1G/C2G R intrínseco.' },
      { agente: ['ceftriaxona', 'cefotaxima'], nota: 'P. aeruginosa: cefotaxima/ceftriaxona (no antipseudomónicas) R intrínseco; usar ceftazidima/cefepime.' },
      { agente: ['ertapenem'], nota: 'P. aeruginosa intrínsecamente R a ertapenem (no cubre Pseudomonas).' },
      { agente: TETRACICLINA, nota: 'P. aeruginosa: tetraciclinas R intrínseco.' },
      { agente: COTRIMOXAZOL, nota: 'P. aeruginosa: cotrimoxazol R intrínseco.' },
    ],
    ref: REF.NO_FERM,
  },
  {
    claves: ['acinetobacter', 'baumannii'],
    resistentes: [
      { agente: ['ertapenem'], nota: 'Acinetobacter: ertapenem R intrínseco.' },
      { agente: AZTREONAM, nota: 'Acinetobacter: aztreonam R intrínseco.' },
      { agente: CEF1G, nota: 'Acinetobacter: cefalosporinas de 1ª/2ª generación R intrínseco.' },
    ],
    ref: REF.NO_FERM,
  },
  // ── Gram positivos (Torres & Cercenado 2010) ──────────────────────────────
  {
    claves: ['enterococcus', 'enterococo', 'faecium', 'faecalis'],
    resistentes: [
      { agente: CEF3G, nota: 'Enterococcus es intrínsecamente R a TODAS las cefalosporinas (no las use aunque el reporte diga S).' },
      { agente: CEFEPIME, nota: 'Enterococcus: cefepime (y toda cefalosporina) R intrínseco.' },
      { agente: AZTREONAM, nota: 'Enterococcus (Gram+): aztreonam R intrínseco (los monobactámicos no cubren Gram+).' },
      { agente: COLISTINA, nota: 'Enterococcus (Gram+): colistina/polimixina R intrínseco.' },
      { agente: COTRIMOXAZOL, nota: 'Enterococcus: cotrimoxazol R in vivo (puede aparecer S in vitro — no fiable).' },
      { agente: ['clindamicina'], nota: 'Enterococcus: clindamicina R intrínseco.' },
    ],
    ref: REF.GRAM_POS,
  },
  {
    claves: ['staphylococc', 'aureus', 'streptococc', 'neumococo', 'pneumococ', 'pyogenes', 'agalactiae'],
    resistentes: [
      { agente: AZTREONAM, nota: 'Gram positivos: aztreonam R intrínseco (los monobactámicos solo cubren Gram-negativos aerobios).' },
      { agente: COLISTINA, nota: 'Gram positivos: colistina/polimixina R intrínseco.' },
    ],
    ref: REF.GRAM_POS,
  },
]

/**
 * Evalúa la resistencia intrínseca del organismo contra el panel reportado.
 * Devuelve notas de CONFLICTO (S reportada que no debería existir) y ESPERADAS.
 */
export function evaluarIntrinseca(
  organismo: string,
  resultados: ResultadoAntibiograma[],
): NotaIntrinseca[] {
  const notas: NotaIntrinseca[] = []
  for (const regla of REGLAS) {
    if (!organismoEs(organismo, regla.claves)) continue
    for (const { agente, nota } of regla.resistentes) {
      if (!agente.length) continue
      /**
       * TODAS las filas que correspondan, no solo la primera.
       *
       * `estado()` devuelve la primera coincidencia, así que un panel con
       * "Meropenem R, Imipenem S" en Stenotrophomonas —o "Ceftriaxona R,
       * Ceftazidima S" en Enterococcus faecium— no reportaba conflicto: la
       * segunda fila, la biológicamente imposible, ni se miraba. Y esa es
       * justamente la señal de un error de identificación del aislamiento, que es
       * para lo que existe este módulo.
       */
      for (const fila of todosLosEstados(resultados, agente)) {
        if (!ES_S(fila.interpretacion)) continue
        notas.push({
          tipo: 'conflicto',
          antibiotico: fila.antibiotico || nombreLegible(agente),
          mensaje: `⚠️ Reporte «S» para un agente de resistencia intrínseca. ${nota} Reconfirmar identificación de especie y la prueba.`,
          referencia: regla.ref,
        })
      }
    }
  }
  return notas
}

function nombreLegible(sinonimos: string[]): string {
  const s = sinonimos[0] || ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** ¿La especie es intrínsecamente R a carbapenémicos? (S. maltophilia). Útil para el motor. */
export function carbapenemIntrinsecoR(organismo: string): boolean {
  return organismoEs(organismo, ['stenotrophomonas', 'maltophilia'])
}
