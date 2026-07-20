/**
 * Clasificación FORMAL de multirresistencia por categorías antimicrobianas:
 *  - MDR/XDR/PDR: Magiorakos AP, et al. Clin Microbiol Infect 2012;18:268-281.
 *    MDR = no-S a ≥1 agente en ≥3 categorías. XDR = sensible a agentes de ≤2 categorías.
 *    PDR = no-S a todos los agentes de todas las categorías.
 *  - DTR (Difficult-to-Treat Resistance, Kadri CID 2018): P. aeruginosa no-S a TODOS
 *    los β-lactámicos de 1ª línea Y fluoroquinolonas → obliga a β-lactámicos nuevos.
 */
import { type AporteModulo, aporteVacio, type ResultadoAntibiograma } from './tipos'
import { esIntrinsecamenteResistente } from './intrinseca'
import { REF } from './referencias'
import {
  norm, estado, NO_S, ES_S,
  AMINOGLUCOSIDO, PIP_TAZO, CARBAPENEM, CEF1G, CEF3G, CEFEPIME, CEFOXITINA,
  FLUOROQUINOLONA, COTRIMOXAZOL, TIGECICLINA, AMPICILINA, AMOXI_CLAV,
  COLISTINA, TETRACICLINA, AZTREONAM, NITROFURANTOINA, CEFTAZIDIMA,
} from './util'

/** Categorías antimicrobianas de Magiorakos para Enterobacterales (subconjunto práctico probado por el panel). */
const CATEGORIAS_ENTERO: { nombre: string; ag: string[] }[] = [
  { nombre: 'Aminoglucósidos', ag: AMINOGLUCOSIDO },
  { nombre: 'Penicilinas antipseudomónicas + IBL', ag: PIP_TAZO },
  { nombre: 'Carbapenémicos', ag: CARBAPENEM },
  { nombre: 'Cefalosporinas 1-2G', ag: CEF1G },
  { nombre: 'Cefalosporinas de espectro extendido (3-4G)', ag: [...CEF3G, ...CEFEPIME] },
  { nombre: 'Cefamicinas', ag: CEFOXITINA },
  { nombre: 'Fluoroquinolonas', ag: FLUOROQUINOLONA },
  { nombre: 'Inhibidores de folato', ag: COTRIMOXAZOL },
  { nombre: 'Glicilciclinas', ag: TIGECICLINA },
  { nombre: 'Penicilinas', ag: AMPICILINA },
  { nombre: 'Penicilina + IBL', ag: AMOXI_CLAV },
  { nombre: 'Polimixinas', ag: COLISTINA },
  { nombre: 'Tetraciclinas', ag: TETRACICLINA },
  { nombre: 'Monobactámicos', ag: AZTREONAM },
  { nombre: 'Nitrofuranos', ag: NITROFURANTOINA },
]

function esEnterobacterales(o: string) {
  return /escherichia|coli|klebsiella|enterobacter|serratia|citrobacter|proteus|morganella|providencia|salmonella|shigella|hafnia/.test(norm(o))
}
function esPseudomonas(o: string) { return /pseudomonas|aeruginosa/.test(norm(o)) }

/** Clasificación MDR/XDR/PDR sobre las categorías con agentes probados. */
export function analizarMDR(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()
  // Por ahora, clasificación formal para Enterobacterales (categorías bien definidas).
  if (!esEnterobacterales(organismo) && !esPseudomonas(organismo)) return out

  /**
   * LA RESISTENCIA INTRÍNSECA NO CUENTA. Magiorakos lo exige explícitamente, y es
   * la indicación del médico: un organismo no es multirresistente por ser lo que
   * es — solo si desarrolla resistencia FUERA de su patrón natural.
   *
   * Sin esta exclusión, un Proteus mirabilis COMPLETAMENTE SENSIBLE salía
   * `MDR[confirmado]`, porque el panel reporta sus cuatro resistencias naturales
   * (nitrofurantoína, tetraciclina, colistina, tigeciclina) y el conteo las sumaba
   * como adquiridas. Igual una Pseudomonas salvaje con ampicilina, cefazolina y
   * cotrimoxazol R, que en ella son intrínsecas.
   *
   * Marcar como multirresistente a un aislamiento sensible dispara aislamiento de
   * contacto y escalada a antibióticos de reserva que el paciente no necesita.
   *
   * Se aplica a TODA especie con patrón intrínseco conocido, no solo a Proteus.
   */
  const cats = CATEGORIAS_ENTERO
  let probadas = 0, conR = 0, conS = 0
  const rNombres: string[] = []
  const intrinsecasIgnoradas: string[] = []
  for (const c of cats) {
    // Se descartan los agentes a los que la especie es intrínsecamente resistente.
    const agentesValorables = c.ag.filter(a => {
      if (!esIntrinsecamenteResistente(organismo, a)) return true
      intrinsecasIgnoradas.push(a)
      return false
    })
    if (!agentesValorables.length) continue      // categoría enteramente intrínseca
    const agsProbados = agentesValorables.map(a => estado(r, [a])).filter(x => x !== null)
    if (agsProbados.length === 0) continue
    probadas++
    const hayR = agsProbados.some(x => NO_S(x))
    const hayS = agsProbados.some(x => ES_S(x))
    if (hayR) { conR++; rNombres.push(c.nombre) }
    if (hayS) conS++
  }
  if (probadas < 3) return out // panel insuficiente para clasificar

  if (conS === 0 && probadas >= 6) {
    out.fenotipos.push({ clave: 'PDR', nombre: 'Panresistente (PDR, aproximado)', confianza: 'sospecha', base: `No-sensible a todos los agentes probados en ${probadas} categorías. Confirmar con panel ampliado (colistina/cefiderocol/nuevos β-lactámicos). ${REF.MAGIORAKOS}` })
    out.alertas.push({ nivel: 'critica', mensaje: 'PDR (panresistente) probable: infectología + microbiología urgente; panel completo de agentes nuevos + terapia combinada.' })
  } else if (probadas >= 6 && conS <= 2 && conR >= 3) {
    out.fenotipos.push({ clave: 'XDR', nombre: `Extensamente resistente (XDR, aproximado — sensible solo a ${conS} categoría(s))`, confianza: 'probable', base: `No-S en ${conR}/${probadas} categorías; sensibilidad conservada en ≤2. ${REF.MAGIORAKOS}` })
    out.alertas.push({ nivel: 'critica', mensaje: 'XDR: opciones muy limitadas → infectología, agentes nuevos según susceptibilidad, terapia combinada.' })
  } else if (conR >= 3) {
    out.fenotipos.push({ clave: 'MDR', nombre: `Multidrogorresistente (MDR — no-S en ${conR} categorías)`, confianza: 'confirmado', base: `No-sensible a ≥1 agente en ${conR} categorías antimicrobianas ADQUIRIDAS (${rNombres.slice(0, 4).join(', ')}${rNombres.length > 4 ? '…' : ''}). Se excluyó la resistencia intrínseca de la especie${intrinsecasIgnoradas.length ? ` (${[...new Set(intrinsecasIgnoradas)].slice(0, 5).join(', ')})` : ''}. ${REF.MAGIORAKOS}` })
  }
  return out
}

/** DTR (Difficult-to-Treat Resistance) en P. aeruginosa: no-S a TODOS los β-lactámicos
 *  de 1ª línea Y las fluoroquinolonas → obliga a los β-lactámicos nuevos. */
export function analizarDTR(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()
  if (!esPseudomonas(organismo)) return out
  const primeraLinea = [
    ...PIP_TAZO, ...CEFTAZIDIMA, ...CEFEPIME, ...AZTREONAM, ...CARBAPENEM, ...FLUOROQUINOLONA,
  ]
  const estados = primeraLinea.map(a => estado(r, [a])).filter(x => x !== null)
  // Requiere que se hayan probado al menos las 3 clases clave (β-lactámico, carbapenémico, FQ).
  const proboBL = [...PIP_TAZO, ...CEFTAZIDIMA, ...CEFEPIME].some(a => estado(r, [a]) !== null)
  const proboCarba = CARBAPENEM.some(a => estado(r, [a]) !== null)
  const proboFQ = FLUOROQUINOLONA.some(a => estado(r, [a]) !== null)
  if (!(proboBL && proboCarba && proboFQ) || estados.length < 4) return out

  const todosNoS = estados.every(x => NO_S(x))
  if (todosNoS) {
    out.fenotipos.push({ clave: 'DTR', nombre: 'P. aeruginosa con Resistencia Difícil de Tratar (DTR)', confianza: 'confirmado', base: `No-sensible a TODOS los agentes de 1ª línea (piperacilina-tazobactam, ceftazidima, cefepime, aztreonam, carbapenémicos y fluoroquinolonas). ${REF.BLI}` })
    out.alertas.push({ nivel: 'critica', mensaje: 'DTR-P. aeruginosa: descartar los agentes tradicionales → usar ceftolozano-tazobactam, ceftazidima-avibactam, imipenem-relebactam o cefiderocol según susceptibilidad. Infectología.' })
    out.terapiaDirigida.push({ linea: 'dirigida', agente: 'Ceftolozano-tazobactam / ceftazidima-avibactam / imipenem-relebactam / cefiderocol (por susceptibilidad)', razon: 'DTR: los β-lactámicos y FQ tradicionales quedaron descartados.', referencia: REF.BLI })
  }
  return out
}
