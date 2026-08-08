/**
 * ¿ESTO TIENE FORMA DE FRECUENCIA Y DE DURACIÓN? — REG-238.
 *
 * ── EL CASO REAL, DE UNA NOTA YA FIRMADA ────────────────────────────────────
 *
 * El médico mandó la captura de una nota suya. En el plan de tratamiento decía:
 *
 *     «Moxifloxacino 400 mg vo cada 24 horas por 14 EDITAS»
 *
 * Y unas líneas más abajo, en el plan farmacológico, el mismo fármaco:
 *
 *     «Moxifloxacino tabletas 400 mg · oral · 24 TRAS · 14 días»
 *
 * «14 editas» en vez de «14 días». «24 tras» en vez de «24 horas». La duración
 * y la frecuencia de un antibiótico, en un documento con su cédula y su firma.
 *
 * ── DÓNDE SE ROMPIÓ, MEDIDO ─────────────────────────────────────────────────
 *
 * No fue el corrector léxico: se le pasó el texto limpio y el partido —«por 14
 * di as», «cada 24 ho ras»— y no corrompe ninguno. Tampoco produce «editas» ni
 * «tras»: no están en su vocabulario.
 *
 * Vino de más arriba —el reconocedor oyó mal, o el modelo copió el ruido al
 * rellenar los campos—. Y la prueba está en que **los dos sitios se rompieron
 * distinto**: la prosa perdió los días y conservó las horas; la lista
 * estructurada perdió las horas y conservó los días. Un mismo dictado, dos
 * daños diferentes.
 *
 * ── POR QUÉ NADIE LO CAZÓ ───────────────────────────────────────────────────
 *
 * Porque **no hay nada que compruebe la FORMA de una pauta**. Existe un motor
 * que exige cifra y unidad en la DOSIS (REG-173), y por eso «400 mg» está bien.
 * La frecuencia y la duración no tenían guardián: cualquier cadena pasaba.
 *
 * Y la aplicación **ya sabía** que «14 editas» no es una duración —
 * `diasDeDuracion()` devuelve `null` para eso desde hace tiempo—. Nadie se lo
 * preguntaba. Escrito, probado y sin conectar, otra vez.
 *
 * ── LO QUE ESTE MÓDULO HACE, Y LO QUE NO ────────────────────────────────────
 *
 * **Hace**: mira si lo escrito tiene forma de frecuencia o de duración.
 *
 * **NO hace**: no propone la frecuencia correcta, no corrige, no adivina que
 * «24 tras» quiso decir «24 horas». Decir «esto no parece una frecuencia» es
 * un hecho comprobable; decir «debería ser cada 24 horas» sería inventar una
 * pauta clínica, y eso no se hace aquí ni en ningún sitio.
 *
 * Módulo PURO, sin dependencias de red ni de framework.
 */
import { diasDeDuracion } from '@/lib/expediente/duracion-cumplida'

const norm = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Las formas en que se escribe una frecuencia en una receta mexicana.
 *
 * No es una lista de frecuencias VÁLIDAS —eso sería criterio clínico—: es una
 * lista de FORMAS. «cada 3 horas» y «cada 72 horas» pasan las dos; si una de
 * las dos está mal para este paciente, eso lo juzga el médico.
 */
const FORMAS_DE_FRECUENCIA: readonly RegExp[] = [
  /* «cada 8 horas», «cada 8 h», «cada 8 hrs», «c/8 h», «c/8h» */
  /\bc(?:ada|\/)\s*\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|horas?|min|minutos?|d|dias?|semanas?|meses?)\b/,
  /* «cada hora», «cada día», «cada tercer día», «cada 3er día» */
  /\bcada\s+(?:hora|dia|tercer(?:o)?\s+dia|\d+(?:er|do|to)?\s+dia)\b/,
  /* «3 veces al día», «una vez al día», «dos veces por semana» */
  /\b(?:\d+|una?|dos|tres|cuatro|cinco|seis)\s+ve(?:z|ces)\s+(?:al|por|a la)\s+(?:dia|semana|mes|hora)\b/,
  /* Las siglas de siempre: qd, bid, tid, qid, q8h, q12h, c/8h */
  /\b(?:qd|bid|tid|qid|q\d+h|hs|prn|stat)\b/,
  /* «diario», «cada 24 horas» ya cubierto; «al día», «por la noche» */
  /\b(?:diario|diaria(?:mente)?|al\s+dia|una\s+vez|dosis\s+unica|por\s+la\s+(?:manana|noche))\b/,
  /* «24 horas» a secas — sin el «cada», que el médico se come al dictar */
  /^\s*\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|horas?)\s*$/,
]

/**
 * ¿Esto tiene forma de frecuencia?
 *
 * Vacío responde `true`: la ausencia de frecuencia es otro problema —y ya lo
 * vigila la compuerta de dosis— pero **no es una frecuencia deformada**. Este
 * módulo sólo habla de lo que está escrito y no se entiende.
 */
export function esFrecuenciaReconocible(txt: unknown): boolean {
  const t = norm(txt)
  if (!t) return true
  return FORMAS_DE_FRECUENCIA.some(r => r.test(t))
}

/**
 * ¿Esto tiene forma de duración?
 *
 * Se apoya en `diasDeDuracion()`, que ya sabía leer «7 días», «siete días»,
 * «un mes» y reconocer lo indefinido. Ese motor existía y nadie le preguntaba.
 */
export function esDuracionReconocible(txt: unknown): boolean {
  const t = norm(txt)
  if (!t) return true
  if (diasDeDuracion(t) !== null) return true
  /* Lo crónico: `diasDeDuracion` devuelve null a propósito, y es válido. */
  return /\b(?:indefinid|permanente|cronic|continu|de\s+por\s+vida|sin\s+suspender|hasta\s+nueva|mientras)/.test(t)
    /* «hasta terminar el frasco», «según respuesta» — duraciones reales sin cifra. */
    || /\bhasta\s+\w+|segun\s+(?:respuesta|evolucion|indicacion)\b/.test(t)
}

export type QueNoSeEntiende = 'frecuencia' | 'duracion'

export interface PautaDeformada {
  /** Qué campo no tiene forma de lo que dice ser. */
  campo: QueNoSeEntiende
  /** Lo que quedó escrito, literal. No se parafrasea. */
  loEscrito: string
  /** Lo que se le dice al médico. */
  mensaje: string
}

/**
 * Revisa la pauta de UN medicamento.
 *
 * Devuelve una lista —puede fallar la frecuencia, la duración, o las dos, que
 * es exactamente lo que pasó en la nota real.
 */
export function revisarFormaDeLaPauta(p: {
  farmaco: unknown
  frecuencia?: unknown
  duracion?: unknown
}): PautaDeformada[] {
  const nombre = String(p.farmaco ?? '').trim() || 'el medicamento'
  const out: PautaDeformada[] = []

  const f = String(p.frecuencia ?? '').trim()
  if (f && !esFrecuenciaReconocible(f)) {
    out.push({
      campo: 'frecuencia',
      loEscrito: f,
      mensaje: `${nombre}: «${f}» no se entiende como una frecuencia. ` +
        'Puede ser una palabra mal oída al dictar — revísala antes de firmar, ' +
        'porque sale impresa en la receta.',
    })
  }

  const d = String(p.duracion ?? '').trim()
  if (d && !esDuracionReconocible(d)) {
    out.push({
      campo: 'duracion',
      loEscrito: d,
      mensaje: `${nombre}: «${d}» no se entiende como una duración. ` +
        'Puede ser una palabra mal oída al dictar — revísala antes de firmar, ' +
        'porque sale impresa en la receta.',
    })
  }

  return out
}

/** Todas las pautas deformadas de una lista de medicamentos. */
export function pautasDeformadas(
  meds: readonly { nombre?: unknown; frecuencia?: unknown; duracion?: unknown }[],
): { med: string; avisos: PautaDeformada[] }[] {
  return (meds ?? [])
    .map(m => ({
      med: String(m?.nombre ?? '').trim(),
      avisos: revisarFormaDeLaPauta({ farmaco: m?.nombre, frecuencia: m?.frecuencia, duracion: m?.duracion }),
    }))
    .filter(x => x.avisos.length > 0)
}

export const EL_CASO_QUE_LO_ORIGINO =
  'En una nota firmada: «Moxifloxacino 400 mg vo cada 24 horas por 14 EDITAS», ' +
  'y en la misma nota «24 TRAS · 14 días». Un mismo dictado, dos daños ' +
  'distintos: la prosa perdió los días, la lista perdió las horas.';

export const POR_QUE_NO_SE_CORRIGE_SOLO =
  'Decir «esto no parece una frecuencia» es un hecho comprobable. Decir ' +
  '«debería ser cada 24 horas» sería inventar una pauta clínica.'

export const LO_QUE_YA_EXISTIA_Y_NADIE_PREGUNTABA =
  '`diasDeDuracion()` devuelve null para «14 editas» desde hace tiempo. El ' +
  'motor sabía que no era una duración; nadie se lo preguntaba.'
