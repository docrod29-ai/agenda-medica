/**
 * Orquestador del motor de antibiograma. Reúne los módulos órgano-específicos,
 * la resistencia intrínseca y las reglas transversales (FQ-R, colistina, MDR),
 * y produce la interpretación final citada.
 */
import {
  type EntradaAntibiograma, type InterpretacionAntibiograma, type AporteModulo,
  type FenotipoDetectado, type ResultadoAntibiograma, type Confianza, aporteVacio,
} from './tipos'
import { REF } from './referencias'
import {
  norm, estado, ES_R, ES_S, NO_S,
  FLUOROQUINOLONA, COLISTINA, CEF3G, CEFEPIME, CARBAPENEM, AMINOGLUCOSIDO,
  PIP_TAZO, VANCOMICINA, TEICOPLANINA, ERITROMICINA, TETRACICLINA, COTRIMOXAZOL,
  AMPICILINA, algunoS, aplicarEdicionesInterpretativas,
} from './util'
import { analizarGramPositivos } from './grampositivos'
import { analizarEnterobacterales } from './enterobacterales'
import { analizarNoFermentadores } from './nofermentadores'
import { analizarConfirmatorias } from './confirmatorias'
import { analizarAminoglucosidos } from './aminoglucosidos'
import { analizarFastidiosos } from './fastidiosos'
import { analizarMDR, analizarDTR } from './mdr'
import { construirAlgoritmo } from './algoritmo'
import { evaluarIntrinseca, esIntrinsecamenteResistente } from './intrinseca'
import { analizarSeguridad } from './seguridad'
import { pruebasRecomendadas } from './clsi-pruebas'
import { interpretarCMI } from './clsi-breakpoints'
import type { CategoriaCMI } from './tipos'

function fusionar(a: AporteModulo, b: AporteModulo): AporteModulo {
  return {
    fenotipos: [...a.fenotipos, ...b.fenotipos],
    mecanismos: [...a.mecanismos, ...b.mecanismos],
    alertas: [...a.alertas, ...b.alertas],
    advertencias: [...a.advertencias, ...b.advertencias],
    didactica: [...a.didactica, ...b.didactica],
    terapiaDirigida: [...a.terapiaDirigida, ...b.terapiaDirigida],
    optimizacionPKPD: [...a.optimizacionPKPD, ...b.optimizacionPKPD],
    notificacion: a.notificacion || b.notificacion,
    aislamiento: a.aislamiento ?? b.aislamiento,
    carbapenemasa: a.carbapenemasa ?? b.carbapenemasa,
  }
}

export function interpretarAntibiograma(entrada: EntradaAntibiograma): InterpretacionAntibiograma {
  const organismo = (entrada.organismo || '').trim()
  const r = entrada.resultados || []

  let ap = aporteVacio()
  ap = fusionar(ap, analizarGramPositivos(organismo, r, entrada.sitio))
  ap = fusionar(ap, analizarEnterobacterales(organismo, r))
  ap = fusionar(ap, analizarNoFermentadores(organismo, r))
  ap = fusionar(ap, analizarAminoglucosidos(organismo, r))
  ap = fusionar(ap, analizarFastidiosos(organismo, r))
  ap = fusionar(ap, analizarConfirmatorias(entrada.pruebas, organismo))
  // MDR/XDR/PDR formal (Magiorakos) + DTR ANTES que el conteo aproximado: por dedup de
  // clave, la clasificación FORMAL gana; el conteo de transversales queda solo como
  // respaldo para organismos no cubiertos por Magiorakos (Gram+, etc.).
  ap = fusionar(ap, analizarDTR(organismo, r))
  ap = fusionar(ap, analizarMDR(organismo, r))

  // Capa de seguridad EUCAST: fenotipos excepcionales + cross-resistencia FQ.
  // Se calcula ANTES de `transversales` porque el PK/PD debe razonar sobre la
  // interpretación EFECTIVA, no sobre el panel crudo (ver abajo).
  const seg = analizarSeguridad(organismo, r)
  const edicionesInterpretativas = seg.edicionesFQ

  /**
   * INTERPRETACIÓN EFECTIVA — fuente única de TODAS las salidas (E0-15a).
   *
   * Antes, la edición experta EUCAST vivía solo en `edicionesInterpretativas`:
   * la nota, el prompt del LLM, el validador y el PK/PD seguían leyendo `r`
   * (crudo) y mostraban la «S» que este mismo motor ya había declarado R.
   * El médico dueño lo marcó como defecto P0: «nunca debe existir una pantalla
   * donde Nexus muestre R y el LLM continúe razonando con S».
   *
   * `resultadosEfectivos` es lo que debe consumir cualquier salida clínica.
   * El dato del laboratorio NO se destruye: viaja en `interpretacionLab`.
   */
  const resultadosEfectivos = aplicarEdicionesInterpretativas(r, edicionesInterpretativas)

  /**
   * `transversales` recibe el panel EFECTIVO porque de ahí sale el PK/PD: con el
   * panel crudo, una fluoroquinolona editada a R por regla experta seguía
   * imprimiendo «Fluoroquinolonas: dosis plena» — consejo de optimización para
   * un fármaco que el propio motor acababa de descartar.
   *
   * Los módulos de FENOTIPO sí siguen leyendo `r` (crudo) a propósito: el
   * fenotipo se infiere del dato del laboratorio, no de una edición derivada.
   */
  ap = fusionar(ap, transversales(organismo, resultadosEfectivos))

  const resistenciaIntrinseca = evaluarIntrinseca(organismo, r)
  const alertas = [...seg.excepcionales, ...ap.alertas]
  const advertencias = [...ap.advertencias, ...seg.avisos]

  // Referencias efectivamente usadas.
  const refs = new Set<string>()
  ap.mecanismos.forEach(m => refs.add(m.referencia))
  ap.terapiaDirigida.forEach(t => refs.add(t.referencia))
  ap.didactica.forEach(d => refs.add(d.referencia))
  resistenciaIntrinseca.forEach(n => refs.add(n.referencia))
  edicionesInterpretativas.forEach(e => refs.add(e.referencia))
  seg.excepcionales.forEach(() => refs.add('EUCAST Expert Rules (Leclercq/Cantón, Clin Microbiol Infect 2013;19:141-160)'))
  if (ap.notificacion) refs.add(REF.NOM045)
  if (ap.fenotipos.length) refs.add(REF.CLSI)

  const fenotipos = dedupFenotipos(ap.fenotipos)
  const pruebasSugeridas = pruebasRecomendadas(organismo, fenotipos.map(f => f.clave))
  pruebasSugeridas.forEach(p => refs.add(p.referencia))

  // Interpretación de CMI con puntos de corte del CLSI M100 (donde haya CMI numérica).
  const categoriasCMI: CategoriaCMI[] = []
  for (const x of r) {
    if (typeof x.cmi !== 'number') continue
    /**
     * El OPERADOR de la CMI viaja hasta el motor (E0-15c). El modelo ya guardaba
     * `cmiCensurada`, pero aquí se descartaba y sólo se pasaba el número pelado:
     * un neumococo con penicilina «>2» se interpretaba como «2 → S», es decir,
     * tratable con penicilina. El valor real está POR ENCIMA de 2.
     */
    const cat = interpretarCMI(organismo, x.antibiotico, x.cmi, entrada.sitio, x.cmiCensurada)
    if (!cat) continue
    categoriasCMI.push({
      antibiotico: x.antibiotico,
      cmi: x.cmi,
      cmiCensurada: x.cmiCensurada,
      categoriaCLSI: cat.categoria,
      categoriaReportada: x.interpretacion,
      // Si el corte NO aplica (foco/organismo), no tiene sentido marcar discordancia.
      concuerda: cat.noAplicable ? null : (x.interpretacion ? x.interpretacion === cat.categoria : null),
      soloUTI: cat.soloUTI,
      noAplicable: cat.noAplicable,
      motivoNoAplicable: cat.motivoNoAplicable,
      desdeCmiCensurada: cat.desdeCmiCensurada,
      referencia: cat.referencia,
    })
    refs.add(cat.referencia)
  }

  const resultado: InterpretacionAntibiograma = {
    organismo,
    organismoNormalizado: reconocer(organismo),
    fenotipos,
    mecanismos: ap.mecanismos,
    alertas,
    notificacionObligatoria: ap.notificacion,
    aislamiento: ap.aislamiento,
    optimizacionPKPD: [...new Set(ap.optimizacionPKPD)],
    advertencias: [...new Set(advertencias)],
    resistenciaIntrinseca,
    terapiaDirigida: ap.terapiaDirigida,
    didactica: ap.didactica,
    edicionesInterpretativas,
    resultadosEfectivos,
    carbapenemasa: ap.carbapenemasa,
    pruebasSugeridas,
    categoriasCMI,
    algoritmo: [],
    referencias: [...refs],
  }
  // El algoritmo se arma AL FINAL: necesita la interpretación completa del caso.
  resultado.algoritmo = construirAlgoritmo(entrada, resultado)
  return resultado
}

/** Reglas transversales independientes de organismo: FQ-R, colistina-R, MDR + PK/PD. */
function transversales(organismo: string, r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()

  // fosfomicina: fosA cromosómica INTRÍNSECA en Klebsiella/Enterobacter/Serratia/Citrobacter →
  // la fosfomicina es menos fiable (la S in vitro no siempre predice éxito); solo E. coli tiene
  // punto de corte validado para IVU. Aviso cuando se reporta fosfomicina en estas especies.
  if (/klebsiella|enterobacter|serratia|citrobacter/.test(norm(organismo)) && estado(r, ['fosfomicina']) !== null) {
    out.advertencias.push('Fosfomicina: estas especies (Klebsiella/Enterobacter/Serratia/Citrobacter) portan fosA cromosómica intrínseca → la fosfomicina es MENOS fiable; el punto de corte validado es para E. coli en IVU. No extrapolar una «S».')
  }

  if (FLUOROQUINOLONA.some(f => ES_R(estado(r, [f])))) {
    out.fenotipos.push({ clave: 'FQ-R', nombre: 'Resistencia a fluoroquinolonas', confianza: 'confirmado', base: `Fluoroquinolona R. ${REF.CLSI}` })
    out.mecanismos.push({ categoria: 'diana', nombre: 'Mutaciones en la topoisomerasa (gyrA/parC, QRDR)', confianza: 'probable', explicacion: 'Mutaciones en la región determinante de resistencia a quinolonas de la ADN-girasa (gyrA) y topoisomerasa IV (parC), ± bombas de expulsión (AcrAB-TolC) ± genes plasmídicos qnr. La R a la FQ más activa implica R a toda la clase.', referencia: REF.CLSI })
  }

  /**
   * LA COLISTINA-R DE UN GRAM POSITIVO NO ES UNA LÍNEA PERDIDA: NUNCA LA TUVO.
   *
   * Esto miraba el panel sin preguntar de qué organismo se trata. Un
   * *Enterococcus faecalis* PAN-SENSIBLE —sensible a ampicilina y a
   * vancomicina— trae sus tres R naturales en el reporte (cefalosporinas de 3ª,
   * cotrimoxazol y colistina), y salía de la máquina con «última línea
   * comprometida», alerta CRÍTICA y un mecanismo `mcr` **plasmídico y
   * transferible** afirmado con confianza `probable`.
   *
   * Lo mismo un *Proteus mirabilis* completamente sensible, y un
   * *S. maltophilia* salvaje.
   *
   * El predicado que lo distingue —`esIntrinsecamenteResistente`— ya existía y
   * `mdr.ts` YA lo aplicaba, con un comentario que describe exactamente este
   * fallo para Proteus. Pero `analizarMDR` vuelve temprano para todo lo que no
   * sea Enterobacterales o Pseudomonas, así que los Gram positivos y los
   * no-fermentadores caían a este contador de respaldo, que no filtraba nada.
   *
   * La corrección estaba escrita y no se aplicaba en este camino. Otra vez.
   */
  const adquirida = (agentes: string[]) =>
    ES_R(estado(r, agentes)) && !agentes.some(a => esIntrinsecamenteResistente(organismo, a))

  if (adquirida(COLISTINA)) {
    out.fenotipos.push({ clave: 'colistin-R', nombre: 'Resistencia a colistina/polimixina', confianza: 'confirmado', base: `Colistina R: última línea comprometida. ${REF.CLSI}` })
    out.mecanismos.push({ categoria: 'permeabilidad', nombre: 'Modificación del lípido A (mcr / pmrAB-mgrB)', confianza: 'probable', explicacion: 'Adición de fosfoetanolamina o 4-amino-arabinosa al lípido A del LPS → reduce la carga negativa y la unión de la polimixina. Por mcr-1 plasmídico (transferible) o mutación cromosómica (pmrAB/phoPQ; mgrB en Klebsiella).', referencia: REF.CLSI })
    out.alertas.push({ nivel: 'critica', mensaje: 'Colistina-R: opciones muy limitadas. Infectología + microbiología para terapia combinada guiada por CMI.' })
  }

  // PK/PD determinista por clase presente y sensible.
  if (algunoS(r, [...PIP_TAZO, ...CEF3G, ...CEFEPIME, ...CARBAPENEM])) {
    out.optimizacionPKPD.push('β-lactámicos (tiempo-dependientes): en infección grave o CMI alta, optimizar con infusión extendida/continua para maximizar %fT>CMI.')
  }
  if (algunoS(r, AMINOGLUCOSIDO)) {
    out.optimizacionPKPD.push('Aminoglucósidos (concentración-dependientes): dosis única diaria, objetivo AUC/CMI; monitorizar función renal y niveles.')
  }
  if (algunoS(r, FLUOROQUINOLONA)) {
    out.optimizacionPKPD.push('Fluoroquinolonas (concentración-dependientes): eficacia por AUC/CMI; dosis plena, no reducir salvo por función renal.')
  }

  /**
   * MDR aproximado, SIN CONTAR LAS RESISTENCIAS NATURALES DE LA ESPECIE.
   *
   * Contarlas convertía en «multidrogorresistente» a cualquier organismo con
   * tres R intrínsecas — es decir, a un aislamiento salvaje y tratable. Y la
   * etiqueta MDR no es decorativa: cambia el aislamiento, la notificación y la
   * elección empírica.
   *
   * NEEDS_CLINICAL_REVIEW: queda por decidir si este conteo de respaldo debe
   * existir siquiera para Gram positivos —Magiorakos no define categorías para
   * enterococo/estafilococo del mismo modo— o si el fenotipo simplemente no
   * debería emitirse ahí. Filtrar lo intrínseco es correcto en cualquiera de los
   * dos casos; esa pregunta es del Dr.
   */
  const { clases: clasesR, excluidos } = contarClasesResistentes(organismo, r)
  if (clasesR >= 3) {
    out.fenotipos.push({
      clave: 'MDR',
      nombre: `Multidrogorresistente (no-S en ${clasesR} clases, aproximado)`,
      confianza: 'sospecha',
      base: `Clasificación formal MDR/XDR/PDR requiere el mapeo de categorías de Magiorakos et al. ${REF.MAGIORAKOS}`
        + (excluidos.length ? ` No se contaron las resistencias NATURALES de la especie: ${excluidos.join(', ')}.` : ''),
    })
  }
  return out
}

/**
 * Cuántas CLASES tienen una R adquirida, y cuáles se dejaron fuera por naturales.
 *
 * Devolver los excluidos no es un adorno: es lo que permite que la nota diga
 * «no se contaron las R naturales de la especie» en vez de callar un criterio.
 */
function contarClasesResistentes(
  organismo: string, r: ResultadoAntibiograma[],
): { clases: number; excluidos: string[] } {
  const clases: string[][] = [
    [...AMPICILINA, ...PIP_TAZO],
    [...CEF3G, ...CEFEPIME],
    CARBAPENEM,
    FLUOROQUINOLONA,
    AMINOGLUCOSIDO,
    COTRIMOXAZOL,
    TETRACICLINA,
    COLISTINA,
    [...VANCOMICINA, ...TEICOPLANINA],
    ERITROMICINA,
  ]
  let n = 0
  const excluidos: string[] = []
  for (const agentes of clases) {
    const conR = r.filter(x => NO_S(x.interpretacion)
      && agentes.some(a => norm(x.antibiotico).includes(norm(a))))
    if (!conR.length) continue
    // Sólo cuenta si AL MENOS UNO de los R de esa clase no es natural de la especie.
    const adquiridos = conR.filter(x => !esIntrinsecamenteResistente(organismo, x.antibiotico))
    if (adquiridos.length) n++
    else excluidos.push(...conR.map(x => x.antibiotico))
  }
  return { clases: n, excluidos: [...new Set(excluidos)] }
}

const RANGO_CONFIANZA: Record<Confianza, number> = { confirmado: 3, probable: 2, sospecha: 1 }

/**
 * Ante dos fenotipos con la misma clave, gana el de MAYOR CONFIANZA — no el que
 * llegó primero.
 *
 * Se conservaba la primera ocurrencia, y como la inferencia por patrón S/I/R se
 * fusiona ANTES que las pruebas confirmatorias, **la inferencia siempre le ganaba
 * al dato del laboratorio**. Eso contradice literalmente el encabezado de
 * `confirmatorias.ts`, que dice que confirmar es mejor que inferir.
 *
 * El caso real: Klebsiella con carbapenémicos R, CAZ-AVI R y PCR positiva para
 * KPC. El motor mostraba "carbapenemasa de clase no determinada [probable]" —el
 * inferido, que apunta a metalo-β-lactamasa— en vez de la KPC confirmada, y la
 * terapia mezclaba las recomendaciones de ambos mecanismos: prescribía y prohibía
 * ceftazidima-avibactam en la misma lista.
 *
 * Ordenar por confianza es más robusto que reordenar las fusiones: no depende de
 * en qué línea del motor se añada un módulo nuevo.
 */
function dedupFenotipos(fs: FenotipoDetectado[]): FenotipoDetectado[] {
  const mejor = new Map<string, FenotipoDetectado>()
  const orden: string[] = []
  for (const f of fs) {
    const previo = mejor.get(f.clave)
    if (!previo) { mejor.set(f.clave, f); orden.push(f.clave); continue }
    if (RANGO_CONFIANZA[f.confianza] > RANGO_CONFIANZA[previo.confianza]) mejor.set(f.clave, f)
  }
  return orden.map(c => mejor.get(c)!).filter(Boolean)
}

function reconocer(organismo: string): string {
  const o = norm(organismo)
  if (!o) return ''
  return organismo
}

// evita warnings de imports reservados para futuras reglas
void ES_S
