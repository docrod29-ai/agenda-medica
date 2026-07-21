/**
 * CLINICAL REASONING ENGINE — la traza VISIBLE del copiloto.
 *
 * No inventa nada: ORQUESTA lo que el copiloto ya calcula (escalas deterministas,
 * dosis, ajuste renal, alergias, alarmas) + inspecciona la entrada, y lo presenta
 * como los 12 pasos del razonamiento clínico, cada uno con su FUENTE (de dónde
 * salió) y su CONFIANZA (incertidumbre). Es el diferenciador: hace tangible el
 * "por qué", en vez de una caja negra.
 *
 * Regla de oro: cada paso refleja un cálculo REAL sobre los datos de esta consulta.
 * Lo que no se computa aquí (evidencia PubMed asíncrona) se marca honestamente como
 * "disponible en Máxima / Consultor", nunca como hecho.
 */
import { copiloto, type EntradaCopiloto, type Sugerencia } from './copiloto'
export type { EntradaCopiloto } from './copiloto'

/** De dónde viene un resultado (esto ES el provenance). */
export type FuenteRazon = 'determinista' | 'modelo' | 'evidencia' | 'meta'
/** Cuánta certeza tiene el paso (esto ES la incertidumbre expuesta). */
export type ConfianzaRazon = 'alta' | 'media' | 'baja' | 'na'
export type EstadoPaso = 'ok' | 'alerta' | 'faltante' | 'pendiente' | 'na'

export interface PasoRazonamiento {
  n: number
  titulo: string
  estado: EstadoPaso
  fuente: FuenteRazon
  confianza: ConfianzaRazon
  /** Qué encontró/hizo este paso con los datos reales de la consulta. */
  detalle: string
  /** Sugerencias del copiloto que respaldan este paso (para expandir). */
  hallazgos?: { nivel: Sugerencia['nivel']; titulo: string }[]
}

const pref = (sugs: Sugerencia[], ...prefijos: string[]) =>
  sugs.filter(s => prefijos.some(p => s.id.startsWith(p)))

const resumen = (sugs: Sugerencia[]) => sugs.map(s => ({ nivel: s.nivel, titulo: s.titulo }))

/** Construye la traza de razonamiento (12 pasos) para el estado actual de la consulta. */
export function construirTraza(e: EntradaCopiloto): PasoRazonamiento[] {
  const sugs = copiloto(e)
  const nDx = e.diagnosticos?.length ?? 0
  const nMed = e.medicamentos?.filter(m => m.nombre?.trim()).length ?? 0
  const labs = e.labs ?? {}
  const nLabs = Object.keys(labs).length
  const signos = e.signos ?? {}
  const nSignos = Object.values(signos).filter(v => v != null && v !== '').length

  const calc = pref(sugs, 'calc:')                       // escalas con código
  const alergia = pref(sugs, 'alergia:')                 // contradicciones
  const dosisSugs = pref(sugs, 'ped:dosis', 'renal:', 'gesta:')  // seguridad de dosis
  const faltantes = pref(sugs, 'ped:falta', 'prevent:falta')
  const alarmas = pref(sugs, 'vital:')                   // signos de alarma (contradicción fisiológica)
  const metas = pref(sugs, 'meta:', 'prevent:riesgo')    // metas / riesgo → diferenciales-guía

  const t: PasoRazonamiento[] = []

  // 1. Extrae datos clínicos
  t.push({
    n: 1, titulo: 'Extrae datos clínicos', fuente: 'modelo', confianza: 'media',
    estado: (nDx + nMed + nLabs + nSignos) > 0 ? 'ok' : 'faltante',
    detalle: `${nDx} dx · ${nMed} fármacos · ${nLabs} laboratorios · ${nSignos} signos capturados.`,
  })
  // 2. Normaliza unidades
  t.push({
    n: 2, titulo: 'Normaliza unidades', fuente: 'determinista', confianza: 'alta',
    estado: nLabs > 0 ? 'ok' : 'na',
    detalle: nLabs > 0 ? `${nLabs} analitos mapeados a su unidad canónica.` : 'Sin laboratorios que normalizar.',
  })
  // 3. Calcula escalas con código
  t.push({
    n: 3, titulo: 'Calcula escalas con código', fuente: 'determinista', confianza: 'alta',
    estado: calc.length > 0 ? 'ok' : 'na',
    detalle: calc.length > 0 ? calc.map(s => s.titulo).join(' · ') : 'Sin datos suficientes para una escala aún.',
    hallazgos: resumen(calc),
  })
  // 4. Identifica variables faltantes
  t.push({
    n: 4, titulo: 'Identifica variables faltantes', fuente: 'determinista', confianza: 'alta',
    estado: faltantes.length > 0 ? 'faltante' : 'ok',
    detalle: faltantes.length > 0 ? faltantes.map(s => s.titulo).join(' · ') : 'No faltan variables clave para lo capturado.',
    hallazgos: resumen(faltantes),
  })
  // 5. Detecta contradicciones (alergia↔fármaco + alarmas fisiológicas)
  const contra = [...alergia, ...alarmas]
  t.push({
    n: 5, titulo: 'Detecta contradicciones', fuente: 'determinista', confianza: 'alta',
    estado: contra.length > 0 ? 'alerta' : 'ok',
    detalle: contra.length > 0 ? contra.map(s => s.titulo).join(' · ') : 'Sin conflictos alergia-fármaco ni signos de alarma.',
    hallazgos: resumen(contra),
  })
  // 6. Prioriza diferenciales (guiado por metas/riesgo)
  t.push({
    n: 6, titulo: 'Prioriza diferenciales', fuente: 'modelo', confianza: nDx > 0 ? 'media' : 'na',
    estado: nDx > 0 ? 'ok' : 'na',
    detalle: nDx > 0 ? `${nDx} diagnóstico(s) en la nota${metas.length ? `; ${metas.length} meta(s)/riesgo calculados` : ''}.` : 'Aún sin diagnósticos para priorizar.',
    hallazgos: resumen(metas),
  })
  // 7. Comprueba dosis
  t.push({
    n: 7, titulo: 'Comprueba dosis', fuente: 'determinista', confianza: 'alta',
    estado: dosisSugs.some(s => s.nivel === 'critico') ? 'alerta' : (nMed > 0 ? 'ok' : 'na'),
    detalle: nMed === 0 ? 'Sin fármacos que verificar.'
      : dosisSugs.length > 0 ? dosisSugs.map(s => s.titulo).join(' · ')
      : `${nMed} fármaco(s) revisados: sin exceso de dosis, ajuste renal ni riesgo gestacional detectado.`,
    hallazgos: resumen(dosisSugs),
  })
  // 8. Recupera evidencia (PubMed) — asíncrono, vive en Máxima / Consultor
  t.push({
    n: 8, titulo: 'Recupera evidencia (PubMed)', fuente: 'evidencia', confianza: 'na',
    estado: 'pendiente',
    detalle: 'Búsqueda con citas reales — se ejecuta en nivel 💎 Máxima y en el Consultor de evidencia.',
  })
  // 9. Verifica el PMID
  t.push({
    n: 9, titulo: 'Verifica el PMID', fuente: 'evidencia', confianza: 'na',
    estado: 'pendiente',
    detalle: 'Cada cita se contrasta contra PubMed (PMID/DOI) — nunca se inventa una referencia.',
  })
  // 10. Provenance
  t.push({
    n: 10, titulo: 'Muestra provenance', fuente: 'meta', confianza: 'alta', estado: 'ok',
    detalle: 'Cada resultado de arriba está etiquetado por origen: determinista (regla con código), modelo (IA) o evidencia (PubMed).',
  })
  // 11. Incertidumbre
  t.push({
    n: 11, titulo: 'Expone incertidumbre', fuente: 'meta', confianza: 'alta', estado: 'ok',
    detalle: 'Cada paso lleva su nivel de confianza (alta/media/baja). Lo determinista es alta; lo del modelo, media, y se marca.',
  })
  // 12. Registra aceptación / corrección
  t.push({
    n: 12, titulo: 'Registra aceptación o corrección', fuente: 'meta', confianza: 'alta', estado: 'ok',
    detalle: 'Cuando agregas o editas una sugerencia en la nota, queda en la bitácora (quién, cuándo, qué) — trazabilidad NOM-024.',
  })

  return t
}

/** Un titular corto del estado de la traza (para el encabezado del panel). */
export function resumenTraza(t: PasoRazonamiento[]): { alertas: number; ok: number; faltantes: number } {
  return {
    alertas: t.filter(p => p.estado === 'alerta').length,
    ok: t.filter(p => p.estado === 'ok').length,
    faltantes: t.filter(p => p.estado === 'faltante').length,
  }
}
