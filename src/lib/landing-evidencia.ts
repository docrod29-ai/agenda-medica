/**
 * Evidencia publicada que respalda las afirmaciones cuantitativas de la landing.
 *
 * Regla dura de PUBLIC_METRICS: en público solo van cifras REALES y VERIFICABLES.
 * Ausculta es nuevo y NO tiene métricas de adopción propias que publicar, así que
 * la única cifra numérica de la landing (reducción de inasistencias con
 * recordatorios) se ancla a revisiones sistemáticas reales, con su PMID y DOI para
 * que cualquiera pueda comprobarlas. Fuente de las referencias: PubMed.
 *
 * Módulo puro (sin React/DOM) → testeable.
 */

export interface ReferenciaEvidencia {
  autores: string
  titulo: string
  fuente: string           // revista, año
  pmid: string
  doi: string              // sin prefijo; el enlace se arma con https://doi.org/
  hallazgo: string         // cifra concreta que respalda la afirmación
}

/** Enlace canónico a un DOI. */
export const doiUrl = (doi: string) => `https://doi.org/${doi}`
/** Enlace a la ficha de PubMed. */
export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`

/**
 * Recordatorios de citas → menos inasistencias. Revisiones sistemáticas /
 * metaanálisis verificados en PubMed (2011–2016).
 */
export const EVIDENCIA_RECORDATORIOS: ReferenciaEvidencia[] = [
  {
    autores: 'Hasvold PE, Wootton R',
    titulo: 'Use of telephone and SMS reminders to improve attendance at hospital appointments: a systematic review',
    fuente: 'J Telemed Telecare, 2011',
    pmid: '21933898',
    doi: '10.1258/jtt.2011.110707',
    hallazgo: 'Reducción relativa media de la inasistencia del 34% del valor basal (hasta 39% con recordatorio telefónico manual).',
  },
  {
    autores: 'Robotham D, et al.',
    titulo: 'Using digital notifications to improve attendance in clinic: systematic review and meta-analysis',
    fuente: 'BMJ Open, 2016',
    pmid: '27798006',
    doi: '10.1136/bmjopen-2016-012116',
    hallazgo: 'Metaanálisis: 25% menos ausencias con recordatorios de texto (15% vs 21%).',
  },
  {
    autores: 'Stubbs ND, et al.',
    titulo: 'Methods to reduce outpatient non-attendance',
    fuente: 'Am J Med Sci, 2012',
    pmid: '22475731',
    doi: '10.1097/MAJ.0b013e31824997c6',
    hallazgo: 'Revisión sistemática: teléfono, correo y SMS mejoran la asistencia; SMS el más costo-efectivo.',
  },
]
