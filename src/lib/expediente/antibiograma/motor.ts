/**
 * Orquestador del motor de antibiograma. Reúne los módulos órgano-específicos,
 * la resistencia intrínseca y las reglas transversales (FQ-R, colistina, MDR),
 * y produce la interpretación final citada.
 */
import {
  type EntradaAntibiograma, type InterpretacionAntibiograma, type AporteModulo,
  type FenotipoDetectado, type ResultadoAntibiograma, aporteVacio,
} from './tipos'
import { REF } from './referencias'
import {
  norm, estado, ES_R, ES_S, NO_S,
  FLUOROQUINOLONA, COLISTINA, CEF3G, CEFEPIME, CARBAPENEM, AMINOGLUCOSIDO,
  PIP_TAZO, VANCOMICINA, TEICOPLANINA, ERITROMICINA, TETRACICLINA, COTRIMOXAZOL,
  AMPICILINA, algunoS,
} from './util'
import { analizarGramPositivos } from './grampositivos'
import { analizarEnterobacterales } from './enterobacterales'
import { analizarNoFermentadores } from './nofermentadores'
import { analizarConfirmatorias } from './confirmatorias'
import { analizarAminoglucosidos } from './aminoglucosidos'
import { analizarMDR, analizarDTR } from './mdr'
import { evaluarIntrinseca } from './intrinseca'
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
  ap = fusionar(ap, analizarConfirmatorias(entrada.pruebas, organismo))
  // MDR/XDR/PDR formal (Magiorakos) + DTR ANTES que el conteo aproximado: por dedup de
  // clave, la clasificación FORMAL gana; el conteo de transversales queda solo como
  // respaldo para organismos no cubiertos por Magiorakos (Gram+, etc.).
  ap = fusionar(ap, analizarDTR(organismo, r))
  ap = fusionar(ap, analizarMDR(organismo, r))
  ap = fusionar(ap, transversales(r))

  const resistenciaIntrinseca = evaluarIntrinseca(organismo, r)

  // Capa de seguridad EUCAST: fenotipos excepcionales + cross-resistencia FQ.
  const seg = analizarSeguridad(organismo, r)
  const alertas = [...seg.excepcionales, ...ap.alertas]
  const advertencias = [...ap.advertencias, ...seg.avisos]
  const edicionesInterpretativas = seg.edicionesFQ

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
    const cat = interpretarCMI(organismo, x.antibiotico, x.cmi, entrada.sitio)
    if (!cat) continue
    categoriasCMI.push({
      antibiotico: x.antibiotico,
      cmi: x.cmi,
      categoriaCLSI: cat.categoria,
      categoriaReportada: x.interpretacion,
      concuerda: x.interpretacion ? x.interpretacion === cat.categoria : null,
      soloUTI: cat.soloUTI,
      referencia: cat.referencia,
    })
    refs.add(cat.referencia)
  }

  return {
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
    pruebasSugeridas,
    categoriasCMI,
    referencias: [...refs],
  }
}

/** Reglas transversales independientes de organismo: FQ-R, colistina-R, MDR + PK/PD. */
function transversales(r: ResultadoAntibiograma[]): AporteModulo {
  const out = aporteVacio()

  if (FLUOROQUINOLONA.some(f => ES_R(estado(r, [f])))) {
    out.fenotipos.push({ clave: 'FQ-R', nombre: 'Resistencia a fluoroquinolonas', confianza: 'confirmado', base: `Fluoroquinolona R. ${REF.CLSI}` })
    out.mecanismos.push({ categoria: 'diana', nombre: 'Mutaciones en la topoisomerasa (gyrA/parC, QRDR)', confianza: 'probable', explicacion: 'Mutaciones en la región determinante de resistencia a quinolonas de la ADN-girasa (gyrA) y topoisomerasa IV (parC), ± bombas de expulsión (AcrAB-TolC) ± genes plasmídicos qnr. La R a la FQ más activa implica R a toda la clase.', referencia: REF.CLSI })
  }

  if (ES_R(estado(r, COLISTINA))) {
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

  // MDR aproximado (Magiorakos requiere el mapeo formal de categorías).
  const clasesR = contarClasesResistentes(r)
  if (clasesR >= 3) {
    out.fenotipos.push({ clave: 'MDR', nombre: `Multidrogorresistente (no-S en ${clasesR} clases, aproximado)`, confianza: 'sospecha', base: `Clasificación formal MDR/XDR/PDR requiere el mapeo de categorías de Magiorakos et al. ${REF.MAGIORAKOS}` })
  }
  return out
}

function contarClasesResistentes(r: ResultadoAntibiograma[]): number {
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
  for (const agentes of clases) {
    if (r.some(x => NO_S(x.interpretacion) && agentes.some(a => norm(x.antibiotico).includes(norm(a))))) n++
  }
  return n
}

function dedupFenotipos(fs: FenotipoDetectado[]): FenotipoDetectado[] {
  const seen = new Set<string>()
  const out: FenotipoDetectado[] = []
  for (const f of fs) {
    if (seen.has(f.clave)) continue
    seen.add(f.clave)
    out.push(f)
  }
  return out
}

function reconocer(organismo: string): string {
  const o = norm(organismo)
  if (!o) return ''
  return organismo
}

// evita warnings de imports reservados para futuras reglas
void ES_S
