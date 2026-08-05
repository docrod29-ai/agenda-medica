/**
 * LA VÍA, EN EL VOCABULARIO DEL TIPO — Y «NO SÉ» COMO AUSENCIA.
 *
 * ── ENCONTRADO EN LAS NOTAS FIRMADAS DEL DR. (5-ago-2026) ────────────────────
 *
 * Auditando sus 28 medicamentos en notas firmadas aparecieron vías que **no
 * existen en el tipo**:
 *
 *     oral ................ 23
 *     «no especificada» ....  4   ← no está en el enum
 *     «subcutanea» .........  1   ← el enum dice `sc`
 *
 * `Medicamento.via` sólo admite `oral | iv | im | sc | topica | inhalatoria |
 * sublingual | rectal | otra`. Lo que devuelve la IA se guardaba sin validar.
 *
 * ── LOS DOS HUECOS QUE ESO ABRÍA ────────────────────────────────────────────
 *
 * **1. El guard de parenterales puros dejaba de proteger.** Existe para que
 * nunca se imprima «insulina · oral» —una vía que para ese fármaco no existe— y
 * sólo actúa si la vía es `oral` o está vacía. Comprobado:
 *
 *     insulina + 'oral'             → sc   ✅
 *     insulina + ''                 → sc   ✅
 *     insulina + 'no especificada'  → «no especificada»   ❌
 *
 * Con el valor que la IA escribe DE VERDAD, el guard no hacía nada.
 *
 * **2. El aviso de vía no dictada tampoco avisaba.** Se añadió el 4-ago por
 * decisión del médico dueño («déjalo oral pero que avise si no se dictó») y
 * miraba `oral` o vacío. «No especificada» es exactamente el caso que tenía que
 * cazar, y era el único que se le escapaba.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Se traduce al vocabulario del tipo lo que es traducible —«subcutánea» es `sc`,
 * «intravenosa» es `iv`— y **«no especificada» se trata como ausencia**, que es
 * lo que significa. Una vía que nadie decidió no es un dato: es un hueco, y los
 * huecos ya tienen quien los cuide.
 *
 * No se inventa ninguna vía: lo que no se reconoce se devuelve tal cual, para
 * que se vea en pantalla y el médico lo corrija.
 *
 * Módulo PURO.
 */
import type { Medicamento } from '@/types/expediente'

type Via = Medicamento['via']

/** Las nueve del tipo. Cualquier otra cosa es traducción o hueco. */
const DEL_TIPO: readonly string[] = [
  'oral', 'iv', 'im', 'sc', 'topica', 'inhalatoria', 'sublingual', 'rectal', 'otra',
]

/**
 * Cómo se escribe cada vía cuando no se escribe con su código.
 *
 * Sale de lo que la IA y los médicos escriben de verdad, no de un diccionario:
 * «subcutanea» apareció en sus notas firmadas.
 */
const SINONIMOS: Readonly<Record<string, Via>> = {
  // Oral
  'vo': 'oral', 'v.o.': 'oral', 'per os': 'oral', 'bucal': 'oral', 'via oral': 'oral',
  // Intravenosa
  'intravenosa': 'iv', 'intravenoso': 'iv', 'endovenosa': 'iv', 'endovenoso': 'iv', 'ev': 'iv', 'i.v.': 'iv',
  // Intramuscular
  'intramuscular': 'im', 'i.m.': 'im',
  // Subcutánea — la que apareció en sus notas
  'subcutanea': 'sc', 'subcutánea': 'sc', 'subcutaneo': 'sc', 'subcutáneo': 'sc', 's.c.': 'sc',
  // Otras
  'topico': 'topica', 'tópica': 'topica', 'tópico': 'topica', 'cutanea': 'topica', 'cutánea': 'topica',
  'inhalada': 'inhalatoria', 'inhalado': 'inhalatoria', 'nebulizada': 'inhalatoria',
  'sl': 'sublingual', 'debajo de la lengua': 'sublingual',
}

/**
 * Formas de decir «no lo sé» que se guardaban como si fueran una vía.
 *
 * Se tratan como ausencia. Es la diferencia entre un dato y un hueco, y de ella
 * dependen el guard de parenterales y el aviso al médico.
 */
const HUECOS: readonly string[] = [
  'no especificada', 'no especificado', 'sin especificar', 'no definida', 'no definido',
  'desconocida', 'desconocido', 'n/a', 'na', 'no aplica', '?', '-', '--',
]

const limpia = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ¿Esta vía es en realidad un hueco?
 *
 * La cadena vacía también, claro: es el hueco de toda la vida.
 */
export function esViaAusente(via: unknown): boolean {
  const v = limpia(via)
  if (!v) return true
  return HUECOS.some(h => limpia(h) === v)
}

/**
 * La vía en el vocabulario del tipo.
 *
 * Devuelve cadena vacía cuando es un hueco —para que quien decida sepa que no
 * hay dato— y lo original cuando no se reconoce, porque inventar una vía es
 * peor que enseñar una rara.
 */
export function normalizarVia(via: unknown): string {
  const v = limpia(via)
  if (esViaAusente(v)) return ''
  if (DEL_TIPO.includes(v)) return v
  const traducida = SINONIMOS[v]
  if (traducida) return traducida
  // Con acentos o sin ellos, por si el sinónimo se escribió con tilde.
  for (const [k, val] of Object.entries(SINONIMOS)) if (limpia(k) === v) return val
  return String(via ?? '').trim()
}

export const POR_QUE_UN_HUECO_NO_ES_UNA_VIA =
  '«No especificada» se guardaba como si fuera una vía de administración, y con ' +
  'eso el guard de parenterales puros dejaba de actuar: insulina con vía «oral» ' +
  'se corregía a subcutánea, pero insulina con «no especificada» se quedaba así. ' +
  'El aviso de vía no dictada tampoco saltaba. Tratarlo como ausencia devuelve ' +
  'los dos cuidados al caso que más los necesita.'
