/**
 * LA RECOMENDACIÓN SIN FUENTE NO SALE A LA CLÍNICA — decisión 10 del Dr.
 * (3-ago-2026).
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * De las **42** recomendaciones del módulo de inmunocomprometido, **39 no
 * declaran fuente**. Todo lo demás del motor clínico la lleva; éstas no.
 *
 * En inmunocomprometidos eso no es un detalle de forma. Una recomendación sin
 * respaldo puede afectar profilaxis, vacunación, diagnóstico, uso de
 * antimicrobianos, tamizajes, suspensión de inmunosupresión y tiempos de
 * tratamiento.
 *
 * ── POR QUÉ NO SE MARCAN COMO «CRITERIO DEL AUTOR» ───────────────────────────
 *
 * Era la opción B y el Dr. la descartó con una razón que vale para todo el
 * producto: **dentro del motor clínico habitual, una etiqueta discreta acaba
 * adquiriendo visualmente la misma autoridad que una guía**. Quien lee una lista
 * de recomendaciones no distingue el matiz; lee recomendaciones.
 *
 * Cuando de verdad sea opinión experta local, existirá — pero **en un carril
 * aparte** (`LOCAL EXPERT POLICY`), no como recomendación de guía.
 *
 * ── LO QUE **NO** SE HACE: BORRAR ────────────────────────────────────────────
 *
 * El contenido se conserva íntegro, en estado `UNSOURCED /
 * NOT_FOR_CLINICAL_DISPLAY`, y se puede exportar entero para que el Dr. les
 * asigne fuente. Borrarlas perdería trabajo real y haría imposible el camino de
 * vuelta, que es el plan: **C ahora, A después**.
 *
 * ── EL CAMINO DE VUELTA ──────────────────────────────────────────────────────
 *
 * Cada recomendación necesita, para volver a la salida clínica: `statement` ·
 * `population` · `trigger` · `exceptions` · `source` · `publicationDate` ·
 * `guidelineVersion` · `evidenceStrength` · `lastReviewedAt` · `reviewer`.
 *
 * Este módulo sólo implementa la puerta —`source`—; los demás campos son parte
 * del trabajo de reincorporación y no se inventan aquí.
 *
 * Ver `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`, decisión 10.
 *
 * Módulo PURO.
 */
import type { Rec } from './recomendaciones'

/** ¿Tiene una fuente utilizable? Una cadena vacía o de espacios NO cuenta. */
export function tieneFuente(r: Rec): boolean {
  return typeof r.fuente === 'string' && r.fuente.trim().length > 0
}

export interface Separadas {
  /** Las que pueden mostrarse a un médico. */
  clinicas: Rec[]
  /** `UNSOURCED / NOT_FOR_CLINICAL_DISPLAY`. Se conservan, no se muestran. */
  sinFuente: Rec[]
}

/**
 * Parte la lista en lo que sale y lo que se retiene.
 *
 * **Una sola puerta.** Si cada pantalla decidiera por su cuenta qué mostrar,
 * bastaría con que una se olvidara del filtro para que las 39 volvieran a salir
 * — y saldrían con el mismo aspecto que las respaldadas, que es exactamente el
 * riesgo que esto viene a cerrar.
 */
export function separarPorFuente(recs: Rec[]): Separadas {
  const clinicas: Rec[] = []
  const sinFuente: Rec[] = []
  for (const r of recs) (tieneFuente(r) ? clinicas : sinFuente).push(r)
  return { clinicas, sinFuente }
}

/**
 * Sólo lo que puede mostrarse. El atajo que usan las salidas clínicas.
 */
export function paraSalidaClinica(recs: Rec[]): Rec[] {
  return separarPorFuente(recs).clinicas
}

/**
 * El aviso que acompaña a la lista recortada.
 *
 * **Se dice lo que se retiró.** Una lista que encoge en silencio se lee como «no
 * hay más que recomendar», y eso es peor que la lista original: convierte una
 * omisión administrativa en una afirmación clínica.
 */
export function avisoDeRetenidas(sinFuente: Rec[]): string | null {
  if (!sinFuente.length) return null
  return `⚠ ${sinFuente.length} recomendación(es) de este módulo NO se muestran porque `
    + 'todavía no tienen fuente declarada. No se han borrado: están retenidas hasta '
    + 'que se les asigne guía, población, condiciones de aplicación, excepciones, '
    + 'versión y revisor. Consúltalo con el responsable del módulo antes de asumir '
    + 'que no había nada más que recomendar.'
}

/** Fila de la tabla que el Dr. tiene que llenar para recuperarlas. */
export interface FilaRevision {
  titulo: string
  detalle: string
  severidad: Rec['sev']
  /** Los campos que faltan, en el orden en que el Dr. los enumeró. */
  fuente: ''
  poblacion: ''
  condicionAplicacion: ''
  excepciones: ''
  fechaPublicacion: ''
  versionGuia: ''
  fuerzaEvidencia: ''
  revisor: ''
}

/**
 * La tabla para revisar, con las columnas vacías listas para llenarse.
 *
 * Las columnas van **vacías a propósito**: rellenarlas con una suposición mía
 * sería exactamente el problema que esta decisión viene a resolver, sólo que
 * disfrazado de dato.
 */
export function tablaDeRevision(sinFuente: Rec[]): FilaRevision[] {
  return sinFuente.map(r => ({
    titulo: r.titulo,
    detalle: r.detalle,
    severidad: r.sev,
    fuente: '', poblacion: '', condicionAplicacion: '', excepciones: '',
    fechaPublicacion: '', versionGuia: '', fuerzaEvidencia: '', revisor: '',
  }))
}

export const POR_QUE_NO_SE_MARCAN_COMO_OPINION =
  'Dentro del motor clínico habitual, una etiqueta discreta acaba adquiriendo ' +
  'visualmente la misma autoridad que una guía: quien lee una lista de ' +
  'recomendaciones no distingue el matiz, lee recomendaciones. Cuando de verdad ' +
  'sea opinión experta local existirá, pero en un carril aparte.'

export const POR_QUE_NO_SE_BORRAN =
  'El contenido se conserva íntegro y exportable. Borrarlas perdería trabajo ' +
  'real y haría imposible el camino de vuelta, que es el plan: retirar ahora, ' +
  'reincorporar una por una cuando tengan fuente.'
