/**
 * LABORATORIOS EN LA NOTA DE UCI — sólo lo que cambia una decisión.
 *
 * El Dr., el 30-jul-2026: «los laboratorios sólo lo relevante, si están bien no
 * los pongas, y trata de ponerlos más corto — por ejemplo leucocitos (Leu),
 * creatinina (Cr)».
 *
 * ── DÓNDE ESTÁ LA LÍNEA, Y POR QUÉ IMPORTA ───────────────────────────────────
 *
 * Este módulo NO decide qué es clínicamente importante. Decide qué está **fuera
 * del rango de referencia**, que es una comparación aritmética contra el catálogo
 * de analitos ya existente y auditado (`laboratorio/analitos.ts`), no un juicio
 * médico.
 *
 * La diferencia no es sutil. «Sólo lo anormal» se puede comprobar; «sólo lo
 * importante» exigiría que el software supiera qué importa en ESTE paciente, y no
 * lo sabe. Un sodio de 138 en un cirrótico y en un politraumatizado no significan
 * lo mismo, y ninguna tabla de rangos lo captura.
 *
 * Por eso lo normal **no se borra**: sale de la nota y se queda en el apartado de
 * laboratorio, entero y graficable. La nota se acorta; el dato no se pierde.
 *
 * ── LAS ABREVIATURAS ─────────────────────────────────────────────────────────
 *
 * Son nomenclatura, no medicina: `Leu`, `Cr`, `BT`, `Plq`. Se escriben a mano
 * porque abreviar por regla automática produce colisiones —`Cr` de creatinina y
 * de cromo— y en una nota clínica una abreviatura ambigua es peor que la palabra
 * completa.
 *
 * Módulo PURO.
 */

import { ANALITOS, ANALITOS_EN_TEXTO, analitoPorClave, type Analito } from '@/lib/expediente/laboratorio/analitos'

/**
 * Abreviatura de nota para cada analito.
 *
 * Sólo las que un intensivista escribe de verdad. Un analito sin abreviatura usa
 * su etiqueta: mejor largo que ambiguo.
 */
const CORTA: Readonly<Record<string, string>> = {
  creatinina: 'Cr', urea: 'Ur', bun: 'BUN', tfg: 'TFG',
  glucosa: 'Glu', hba1c: 'HbA1c',
  ast: 'AST', alt: 'ALT', fosfatasaAlcalina: 'FA',
  bilirrubinaTotal: 'BT', bilirrubinaDirecta: 'BD', albumina: 'Alb',
  sodio: 'Na', potasio: 'K', cloro: 'Cl', calcio: 'Ca', magnesio: 'Mg', fosforo: 'P',
  hemoglobina: 'Hb', hematocrito: 'Hto', leucocitos: 'Leu', plaquetas: 'Plq',
  neutrofilos: 'Neu', linfocitos: 'Lin',
  pcr: 'PCR', procalcitonina: 'PCT', vsg: 'VSG', lactato: 'Lac',
  tsh: 'TSH', t4libre: 'T4L',
  colesterolTotal: 'CT', ldl: 'LDL', hdl: 'HDL', trigliceridos: 'TG',
  inr: 'INR', tp: 'TP', ttpa: 'TTPa', fibrinogeno: 'Fbg', dimeroD: 'DD',
}

/** Cómo se llama en la nota: la abreviatura si existe, si no la etiqueta. */
export function nombreCorto(a: Analito): string {
  return CORTA[a.clave] ?? a.etiqueta
}

export interface LabMedido {
  clave: string
  valor: number
  /** Unidad tal como vino. */
  unidad?: string
}

export type Desviacion = 'alto' | 'bajo' | 'normal' | 'sin_referencia'

export interface LabEvaluado extends LabMedido {
  analito: Analito
  corto: string
  desviacion: Desviacion
  /** Texto listo para la nota: «Cr 2.4↑». */
  texto: string
}

/**
 * Compara contra el rango de referencia del catálogo.
 *
 * Un analito SIN rango declarado sale como `sin_referencia` y **se queda en la
 * nota**: callarlo porque no hay con qué compararlo sería esconderlo.
 */
export function evaluar(lab: LabMedido): LabEvaluado | null {
  const a = analitoPorClave(lab.clave)
  if (!a) return null
  const corto = nombreCorto(a)
  let desviacion: Desviacion = 'sin_referencia'
  if (a.refMin != null && a.refMax != null) {
    desviacion = lab.valor > a.refMax ? 'alto' : lab.valor < a.refMin ? 'bajo' : 'normal'
  }
  const flecha = desviacion === 'alto' ? '↑' : desviacion === 'bajo' ? '↓' : ''
  return { ...lab, analito: a, corto, desviacion, texto: `${corto} ${lab.valor}${flecha}` }
}

/**
 * Lo que va en la NOTA: lo anormal y lo que no se puede comparar.
 *
 * Lo normal no desaparece — sigue en el apartado de laboratorio. Aquí sólo deja
 * de ocupar renglones en un documento que se firma.
 */
export function paraLaNota(labs: readonly LabMedido[]): LabEvaluado[] {
  return labs
    .map(evaluar)
    .filter((x): x is LabEvaluado => x !== null && x.desviacion !== 'normal')
    .sort((a, b) => ORDEN.indexOf(a.analito.grupo) - ORDEN.indexOf(b.analito.grupo))
}

/** Los grupos en el orden en que un intensivista los lee. */
const ORDEN: Analito['grupo'][] = [
  'hematologia', 'renal', 'electrolitos', 'hepatico', 'inflamacion',
  'glucemia', 'tiroides', 'lipidos', 'otro',
]

/**
 * La línea de laboratorios de la nota.
 *
 * @returns algo como `Leu 17.8↑ · Cr 2.4↑ · BT 2.1↑ · Plq 118↓`, o cadena vacía
 *   si todo estaba en rango — que es información: significa que no hay nada que
 *   señalar, no que no se midió.
 */
export function lineaDeNota(labs: readonly LabMedido[]): string {
  const rel = paraLaNota(labs)
  if (rel.length === 0) return ''
  return rel.map(x => x.texto).join(' · ')
}

/** Cuántos quedaron fuera de la nota por estar en rango. Para poder DECIRLO. */
export function normalesOmitidos(labs: readonly LabMedido[]): number {
  return labs.map(evaluar).filter(x => x?.desviacion === 'normal').length
}

/**
 * Analitos que el catálogo NO conoce.
 *
 * Sin esto desaparecían en silencio: `evaluar` devuelve `null` y el filtro los
 * tiraba sin que nadie se enterara. Un resultado que el médico midió y que la
 * nota no menciona ni acusa es exactamente el fallo que se lleva reparando todo
 * el día en el dictado — sólo que aquí el dato se pierde después de haberlo
 * capturado bien.
 *
 * Se devuelven para que la pantalla los muestre tal cual y el catálogo pueda
 * crecer con lo que este médico usa de verdad.
 */
export function desconocidos(labs: readonly LabMedido[]): LabMedido[] {
  return labs.filter(l => analitoPorClave(l.clave) === null)
}

/**
 * Resumen para la pantalla: qué entró, qué se omitió y dónde está lo omitido.
 */
export function resumen(labs: readonly LabMedido[]): {
  linea: string; enNota: number; omitidos: number; sinCatalogo: LabMedido[]; aviso: string
} {
  const enNota = paraLaNota(labs).length
  const omitidos = normalesOmitidos(labs)
  const sinCatalogo = desconocidos(labs)
  const partes: string[] = []
  if (omitidos > 0) {
    partes.push(`${omitidos} ${omitidos === 1 ? 'resultado en rango no aparece' : 'resultados en rango no aparecen'} `
      + 'en la nota. Están completos en el apartado de laboratorio, con su gráfica.')
  }
  if (sinCatalogo.length > 0) {
    partes.push(`${sinCatalogo.length} ${sinCatalogo.length === 1 ? 'resultado no está' : 'resultados no están'} `
      + `en el catálogo de analitos (${sinCatalogo.map(l => l.clave).join(', ')}): se conserva el valor, `
      + 'pero no hay rango con qué compararlo ni serie que graficar.')
  }
  return { linea: lineaDeNota(labs), enNota, omitidos, sinCatalogo, aviso: partes.join(' ') }
}

/**
 * ¿Esta línea del pase es SÓLO un laboratorio que ya está en el resumen?
 *
 * Sin esto la nota decía el mismo dato tres veces: «Plaquetas 118 ×10³» del
 * panel, «Plq 118↓» del resumen, y «* Plaquetas: 118,000/µL» del texto dictado.
 * Es la misma duplicación que el Dr. señaló con los aparatos, ahora con las
 * cifras.
 *
 * Se exige que la línea sea SÓLO eso: el nombre del analito, su número y a lo
 * sumo su unidad. Una línea que además dice algo —«Plaquetas 118, se transfunde
 * si baja de 50»— NO se toca, porque ahí el médico añadió información que el
 * resumen no lleva.
 */
export function esLineaDeLabCapturado(linea: string, capturados: readonly LabMedido[]): boolean {
  const l = linea.trim().replace(/^[*·•-]\s*/, '')
  if (!l) return false
  // Nombre + separador + número + unidad opcional, y NADA más.
  const m = l.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ()\/]+?)\s*[:=]\s*([\d.,]+)\s*(?:[A-Za-zµ%\/³×0-9.]+)?\s*\.?$/)
  if (!m) return false
  /** REG-453: el subconjunto de PROSA, no el catálogo entero. Ver `ANALITOS_EN_TEXTO`. */
  const a = ANALITOS_EN_TEXTO.find(x => x.patron.test(m[1]))
  if (!a) return false
  const num = Number(m[2].replace(/,(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(num)) return false
  // Sólo se quita si ESE analito ya viajó al resumen, con el valor que sea: la
  // conversión de unidades pudo cambiar la cifra (118,000/µL → 118).
  return capturados.some(c => c.clave === a.clave)
}

/** Quita del pase los renglones que ya viajan en el resumen de laboratorio. */
export function sinLabsDuplicados(texto: string, capturados: readonly LabMedido[]): string {
  if (!texto || capturados.length === 0) return texto
  return texto.split('\n')
    .filter(l => !esLineaDeLabCapturado(l, capturados))
    .join('\n').replace(/\n{3,}/g, '\n\n')
}

/** Los analitos que este módulo sabe abreviar. Para el golden y para la pantalla. */
export function analitosConAbreviatura(): { clave: string; corto: string }[] {
  return ANALITOS.filter(a => CORTA[a.clave]).map(a => ({ clave: a.clave, corto: CORTA[a.clave] }))
}

export const POR_QUE_SOLO_LO_ANORMAL =
  'El módulo NO decide qué es clínicamente importante: decide qué está fuera del ' +
  'rango de referencia, que es una comparación aritmética contra un catálogo ya ' +
  'auditado. «Sólo lo anormal» se comprueba; «sólo lo importante» exigiría saber ' +
  'qué importa en ESTE paciente, y el software no lo sabe. Lo normal no se borra: ' +
  'sale de la nota y se queda entero en el apartado de laboratorio.'
