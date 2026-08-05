/**
 * ¿LA VÍA SE DICTÓ, O LA PUSIMOS NOSOTROS?
 *
 * ── LA DECISIÓN DEL MÉDICO DUEÑO (4-ago-2026) ────────────────────────────────
 *
 * Literalmente: «déjalo oral pero que avise si no se dictó la vía».
 *
 * Es la decisión correcta y no era mía: yo puedo detectar que falta el dato, no
 * decidir qué se hace clínicamente cuando falta.
 *
 * ── DE DÓNDE VIENE EL PROBLEMA ───────────────────────────────────────────────
 *
 * El prompt de extracción trae `"via": "oral"` en su plantilla, así que el modelo
 * la rellena **siempre**, se haya dictado o no. El resultado es que una receta
 * afirma una vía de administración que nadie dijo, con la misma tinta que las que
 * sí se dictaron. `via-parenteral.ts` ya rescata el caso más grave —«insulina ·
 * oral»— pero sólo para fármacos sin presentación oral; el resto pasa mudo.
 *
 * ── POR QUÉ NO SE LE PREGUNTA AL MODELO ──────────────────────────────────────
 *
 * Se le podría pedir que declare si la vía venía en el audio. Pero eso es fiarse
 * de que confiese, y la señal que importa —«esto no se dijo»— es justo la que un
 * modelo generativo peor distingue: rellenar el hueco es lo que sabe hacer.
 *
 * Aquí se mira **el texto de origen**: si en la frase de la que salió el fármaco
 * no aparece ninguna marca de vía, es que no se dictó. Determinista, auditable, y
 * no cuesta una llamada.
 *
 * ── LA ASIMETRÍA ─────────────────────────────────────────────────────────────
 *
 * Marcar de más cuesta que el médico confirme una vía que ya era correcta — un
 * vistazo. Marcar de menos deja una receta afirmando una vía que nadie dijo.
 *
 * Módulo PURO.
 */
import { normalizarVia } from '@/lib/expediente/via-normalizada'

/**
 * Cómo se dice una vía en una consulta, en voz alta y por escrito.
 *
 * Incluye la forma hablada («que se lo tome», «inyectado») y la abreviatura
 * («VO», «IV», «SC»), porque el dictado se transcribe de las dos maneras.
 */
const MARCAS_DE_VIA: readonly RegExp[] = [
  // Oral
  /\bv[ií]a\s+oral\b/i,
  /\bpor\s+(la\s+)?boca\b/i,
  /\bv\.?\s?o\.?\b/i,
  /\b(tomar|t[oó]mese|que\s+(se\s+)?(lo\s+)?tome|tomado|ingerir|deglutir)\b/i,
  /\b(tableta|c[aá]psula|comprimido|jarabe|suspensi[oó]n\s+oral|gotas\s+orales)\b/i,
  // Parenteral
  /\b(intravenos[oa]|endovenos[oa]|i\.?\s?v\.?)\b/i,
  /\b(intramuscular|i\.?\s?m\.?)\b/i,
  /\b(subcut[aá]ne[oa]|s\.?\s?c\.?)\b/i,
  /\b(inyect(ad[oa]|able|arse|ar)|ampolleta|ampolla|venoclisis|infusi[oó]n)\b/i,
  // Otras
  /\b(sublingual|debajo\s+de\s+la\s+lengua)\b/i,
  /\b(t[oó]pic[oa]|en\s+la\s+piel|ung[uü]ento|crema|pomada)\b/i,
  /\b(inhalad[oa]|inhalador|nebuliz)/i,
  /\b(rectal|supositorio)\b/i,
  /\b(oft[aá]lmic[oa]|en\s+(el\s+)?ojo|colirio)\b/i,
  /\b([oó]tic[oa]|en\s+(el\s+)?o[ií]do)\b/i,
  /\b(nasal|en\s+la\s+nariz)\b/i,
]

/**
 * ¿En este texto se dijo por dónde va el medicamento?
 *
 * `texto` debe ser la CITA de la que salió el fármaco (`source_quote`) o, si no
 * la hay, la frase donde aparece. Pasarle la transcripción entera daría un falso
 * «sí» en cuanto otro fármaco de la consulta llevara vía dictada.
 */
export function seDictoLaVia(texto: string | undefined | null): boolean {
  const t = String(texto ?? '')
  if (!t.trim()) return false
  return MARCAS_DE_VIA.some(r => r.test(t))
}

export interface MedicamentoConVia {
  nombre?: string
  via?: string
  /** La cita de la que salió, si el extractor la conserva. */
  source_quote?: string
}

/**
 * Los que llevan la vía puesta por nosotros, no por el médico.
 *
 * Sólo cuenta cuando la vía resultante es `oral`: es la que el sistema rellena
 * por defecto. Si acabó en `iv` o `sc` es porque alguien —el dictado o el motor
 * de parenterales— lo decidió con un motivo, y avisar ahí sería ruido.
 */
export function conViaAsumida<T extends MedicamentoConVia>(
  medicamentos: readonly T[],
  textoDeRespaldo?: string,
): T[] {
  return medicamentos.filter(m => {
    /**
     * ── «NO ESPECIFICADA» ES UN HUECO, NO UNA VÍA (5-ago-2026) ─────────────
     *
     * Aquí se comparaba contra `'oral'` y contra la cadena vacía. Pero en las
     * notas firmadas del Dr. la IA escribe **«no especificada»** cuando no sabe
     * (4 de 28 medicamentos), y con ese valor este aviso NO saltaba — siendo el
     * caso exacto que tenía que cazar.
     *
     * Se normaliza antes de decidir: los huecos cuentan como vía sin dictar, y
     * «subcutanea» se reconoce como `sc` y por tanto NO se avisa, porque ahí
     * alguien sí decidió.
     */
    const via = normalizarVia(m.via)
    if (via && via !== 'oral') return false
    /**
     * La cita propia manda. El texto de respaldo sólo se usa cuando el extractor
     * no la conservó, y aun así es una señal más débil: dice que en la consulta
     * se habló de vías, no que se hablara de LA de este fármaco.
     */
    const fuente = m.source_quote?.trim() ? m.source_quote : textoDeRespaldo
    return !seDictoLaVia(fuente)
  })
}

/** El aviso, ya redactado. `null` cuando no hay nada que decir. */
export function avisoDeViaAsumida(nombres: readonly string[]): string | null {
  const limpios = nombres.map(n => String(n ?? '').trim()).filter(Boolean)
  if (limpios.length === 0) return null
  const lista = limpios.length <= 3
    ? limpios.join(', ')
    : `${limpios.slice(0, 3).join(', ')} y ${limpios.length - 3} más`
  return limpios.length === 1
    ? `No se dictó la vía de ${lista}: se dejó en ORAL. Revísala antes de firmar.`
    : `No se dictó la vía de ${limpios.length} medicamentos (${lista}): se dejaron en ORAL. Revísalas antes de firmar.`
}

export const DECISION_DEL_MEDICO =
  'Una vía no dictada se queda en ORAL —decisión del médico dueño, 4-ago-2026— ' +
  'pero deja de ser una suposición silenciosa: se avisa para que la revise antes ' +
  'de firmar. Vaciarla habría obligado a teclear la vía en cada receta; callarla ' +
  'deja el documento afirmando algo que nadie dijo.'
