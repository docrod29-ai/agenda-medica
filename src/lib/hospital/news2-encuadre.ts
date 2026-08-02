/**
 * CÓMO SE PRESENTA EL NEWS2 — el puente que faltaba.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `lib/clinical/news2-set.ts` implementa la decisión ICU-Q4.1 del Dr (29-jul-2026):
 * NEWS2 se calcula sobre un conjunto CONTEMPORÁNEO de observaciones, y si falta
 * una variable el score queda INCOMPLETE — nunca se rellena con el último dato
 * histórico. Está escrito, está probado… y **no lo usaba ninguna pantalla**.
 *
 * Mientras tanto, la ficha del episodio tomaba el último registro de signos,
 * lo puntuaba y enseñaba el número. Con dos consecuencias:
 *
 *  · la insignia de la cabecera decía «NEWS2 2» en verde aunque ese 2 saliera de
 *    dos parámetros de siete — el aviso de score incompleto viajaba sólo en el
 *    `title`, que en un teléfono nadie ve. Es exactamente la subestimación del
 *    deterioro que el score existe para evitar;
 *  · y el panel decía «(parcial: sin conciencia/O₂)» **fuera lo que fuera lo que
 *    faltara**. `calcularNews2` ya devuelve `faltantes` «para poder decirlo en
 *    pantalla», y la pantalla decía otra cosa: cuando lo ausente era FR y SpO₂,
 *    le afirmaba al médico algo falso.
 *
 * ── LO QUE ESTE MÓDULO DECIDE, Y LO QUE NO ───────────────────────────────────
 *
 * Decide **cuál registro se puntúa y con qué encuadre se enseña**. No toca la
 * fórmula: los puntos siguen saliendo de `hospital/news2.ts` (Royal College).
 *
 * Y NO esconde nada. Si el registro vigente está incompleto y no hay ninguno
 * completo antes, se enseña el parcial **declarado como parcial**: ocultar un
 * score parcial con SpO₂ de 88 sería peor que enseñarlo mal etiquetado.
 *
 * Módulo PURO: el instante entra por parámetro.
 */
import { signosComoObservaciones } from '@/lib/hospital/eventos'
import {
  agruparEnSets, presentarNews2, VARIABLES_NEWS2,
  type ObservacionDeSet, type VariableNews2,
} from '@/lib/clinical/news2-set'
import type { RegistroSignos } from '@/types/hospital'

/** De qué campo del registro sale cada variable del score. */
const CAMPO: Record<VariableNews2, keyof RegistroSignos> = {
  fr: 'fr', spo2: 'spo2', ta: 'ta', fc: 'fc', temp: 'temp', conciencia: 'conciencia',
}

interface TomaEfectiva {
  setId: string
  measuredAt: string
  registro: RegistroSignos
  corregida: boolean
}

/**
 * LA TOMA EFECTIVA: el original con sus correcciones aplicadas encima.
 *
 * Una corrección **no es otra toma**, y tampoco invalida la toma entera. Se
 * corrige la SpO₂ mal tecleada de las 08:00, y la FR, la FC y la temperatura de
 * esas mismas 08:00 siguen siendo válidas: fundir primero y explotar después es
 * lo único que respeta las dos cosas.
 *
 * Si en vez de eso se tomara el estado del documento —una corrección deja el
 * original en `CORRECTED`—, corregir un solo valor tiraría los otros cinco y una
 * toma bien hecha se vería «incompleta» para siempre.
 */
function tomasEfectivas(signos: readonly RegistroSignos[]): TomaEfectiva[] {
  const porSet = new Map<string, TomaEfectiva>()
  // Por hora de captura: la corrección más reciente manda sobre la anterior.
  const enOrden = [...signosComoObservaciones(signos)]
    .sort((a, b) => Date.parse(a.fechaRegistro) - Date.parse(b.fechaRegistro))

  for (const o of enOrden) {
    // Un registro anulado no aporta nada: ese hecho nunca ocurrió.
    if (o.estado === 'ENTERED_IN_ERROR') continue
    const r = o.valor
    const setId = r.corrigeA || r.id
    const previa = porSet.get(setId)
    if (!previa) {
      porSet.set(setId, { setId, measuredAt: o.fechaEfectiva, registro: { ...r }, corregida: !!r.corrigeA })
      continue
    }
    // Sólo pisa lo que la corrección trae de verdad; lo que no trae, se queda.
    const fundido = { ...previa.registro }
    for (const k of Object.keys(r) as (keyof RegistroSignos)[]) {
      const v = r[k]
      if (v === undefined || v === null || v === '') continue
      if (k === 'id' || k === 'corrigeA' || k === 'motivoCorreccion') continue
      ;(fundido as Record<string, unknown>)[k] = v
    }
    porSet.set(setId, {
      setId,
      // La hora de la toma es la del ORIGINAL: una corrección la hereda.
      measuredAt: previa.measuredAt,
      registro: fundido,
      corregida: previa.corregida || !!r.corrigeA,
    })
  }
  return [...porSet.values()]
}

/** Cada toma efectiva se explota en las variables que de verdad trae. */
function comoObservaciones(tomas: readonly TomaEfectiva[]): ObservacionDeSet[] {
  const out: ObservacionDeSet[] = []
  for (const t of tomas) {
    const r = t.registro
    const comun = {
      observationSetId: t.setId,
      measuredAt: t.measuredAt,
      /**
       * La toma fundida es la VIGENTE, así que cuenta como confirmada.
       *
       * El `CORRECTED` del documento original describe a ese documento —«fue
       * corregido, ya no calcula»—, no al valor bueno que salió de corregirlo.
       * Heredarlo aquí dejaría fuera del cálculo justamente la versión correcta,
       * que es lo contrario de lo que pide la decisión («debe usar 92»).
       *
       * Lo que sí se respeta es un registro anulado: `ENTERED_IN_ERROR` no entra,
       * porque ese hecho nunca ocurrió.
       */
      status: 'CONFIRMED' as ObservacionDeSet['status'],
      source: r.por || 'expediente',
    }
    for (const v of VARIABLES_NEWS2) {
      const valor = r[CAMPO[v]]
      // Ausente es ausente: un campo vacío NO entra al set, que es justo lo que
      // deja el score en INCOMPLETE en vez de puntuarlo como si valiera cero.
      if (valor === undefined || valor === null || valor === '') continue
      out.push({ ...comun, variable: v, valor: valor as string | number })
    }
    if (r.oxigeno !== undefined) out.push({ ...comun, variable: 'oxigeno', valor: r.oxigeno })
  }
  return out
}

export interface EncuadreNews2 {
  /** Qué se está enseñando, decidido aquí para que ninguna pantalla improvise. */
  encuadre: 'actual' | 'ultimo_valido' | 'incompleto' | 'sin_datos'
  /** El registro que hay que puntuar. `null` si no hay ninguno. */
  registro: RegistroSignos | null
  /** Etiqueta del número: «NEWS2» o «Último NEWS2 válido · 08:00». */
  etiqueta: string
  /**
   * Aviso cuando el número NO describe el estado de ahora. Vacío cuando el
   * registro vigente está completo.
   */
  aviso: string
}

const hhmm = (iso: string) => String(iso ?? '').slice(11, 16)

/**
 * Qué NEWS2 enseñar y cómo llamarlo.
 *
 * @param signos todos los registros del episodio (las correcciones incluidas).
 * @param instanteIso el «ahora» de la pantalla.
 */
export function encuadrarNews2(
  signos: readonly RegistroSignos[],
  instanteIso: string,
): EncuadreNews2 {
  const tomas = tomasEfectivas(signos)
  const porId = new Map(tomas.map(t => [t.setId, t.registro]))
  const sets = agruparEnSets(comoObservaciones(tomas))
  const p = presentarNews2(sets, instanteIso)

  if (!p.setVigente) return { encuadre: 'sin_datos', registro: null, etiqueta: 'NEWS2', aviso: '' }

  if (p.encuadre === 'actual') {
    return {
      encuadre: 'actual',
      registro: porId.get(p.setVigente.observationSetId) ?? null,
      etiqueta: 'NEWS2',
      aviso: '',
    }
  }

  if (p.encuadre === 'ultimo_valido' && p.ultimoSetCompleto) {
    /**
     * El ejemplo literal de la decisión: NO «NEWS2 actual = 3», SÍ «Último NEWS2
     * válido: 3 · 08:00». La toma de ahora está incompleta y no se rellena con
     * historia — pero decir cuál fue el último completo, con su hora, sí informa.
     */
    return {
      encuadre: 'ultimo_valido',
      registro: porId.get(p.ultimoSetCompleto.observationSetId) ?? null,
      etiqueta: `Último NEWS2 válido · ${hhmm(p.ultimoSetCompleto.measuredAt)}`,
      aviso: `La toma de las ${hhmm(p.setVigente.measuredAt)} está incompleta (falta ${p.setVigente.faltantes.join(', ')}): no se calcula un NEWS2 de ahora con datos de otra hora.`,
    }
  }

  // Incompleto y sin ninguno completo antes: se enseña el parcial DECLARADO.
  return {
    encuadre: 'incompleto',
    registro: porId.get(p.setVigente.observationSetId) ?? null,
    etiqueta: 'NEWS2 incompleto',
    aviso: `Falta ${p.setVigente.faltantes.join(', ')}. Un parámetro ausente no suma puntos, así que este total SUBESTIMA el riesgo.`,
  }
}

export const POR_QUE_NO_SE_ESCONDE_EL_PARCIAL =
  'Porque un score parcial con una SpO₂ de 88 sigue diciendo algo que el médico ' +
  'necesita ver. Lo que la decisión prohíbe es presentarlo como si fuera el ' +
  'NEWS2 de ahora, no enseñarlo: se enseña con su nombre y con lo que le falta.'
