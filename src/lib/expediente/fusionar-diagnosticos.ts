/**
 * FUSIONAR DIAGNÓSTICOS SIN ACUMULAR BASURA.
 *
 * ── EL DEFECTO (7-ago-2026, reportado con captura) ──────────────────────────
 *
 * Una sola nota terminó con **19 diagnósticos**, con parejas que son el mismo
 * diagnóstico redactado distinto — y con el MISMO código CIE-10:
 *
 *     «Adenopatía cervical bilateral»                        R59.1
 *     «Adenopatía cervical bilateral con fiebre y exantema»   R59.1
 *
 *     «Anemia»        D64.9
 *     «Anemia leve»   D64.9
 *
 *     «Infección de vías urinarias recurrente refractaria»    N39.0
 *     «Infecciones recurrentes de vías urinarias refractarias» N39.0
 *
 * La fusión anterior sumaba lo nuevo a lo anterior y sólo descartaba el
 * repetido si el texto era **idéntico letra por letra**. La IA redacta distinto
 * en cada pasada, así que ninguna pareja se detectaba.
 *
 * Y hay CINCO formas de disparar el procesado —automático al terminar de grabar,
 * el botón, «Procesar de nuevo», el atajo de teclado y la reproyección—: cada
 * disparo sumaba otra tanda entera.
 *
 * Eso explica también los **dos cuadros clínicos mezclados** en una misma nota:
 * lo de una pasada anterior se quedaba y lo nuevo se le sumaba encima.
 *
 * ── POR QUÉ NO SE ARREGLA REEMPLAZANDO ─────────────────────────────────────
 *
 * La fusión existe por una razón buena: **reemplazar borraba lo que el médico
 * escribía a mano mientras la IA corría**. Volver a reemplazar sería reintroducir
 * una pérdida de datos para tapar una acumulación.
 *
 * La distinción correcta no es «viejo vs nuevo», es **«lo puso la IA» vs «lo puso
 * el médico»**:
 *
 *   · Lo que produjo la IA en la pasada anterior  → SE SUSTITUYE
 *   · Lo que escribió el médico                    → SE CONSERVA SIEMPRE
 *
 * ── LA DEDUPLICACIÓN, Y POR QUÉ EL CÓDIGO MANDA ────────────────────────────
 *
 * Dos textos distintos con el mismo CIE-10 son **el mismo diagnóstico**: para
 * eso existe el código. Cuando hay código, manda el código. Cuando no lo hay, se
 * compara el texto normalizado y su raíz, que es lo único que queda.
 *
 * Módulo PURO, sin dependencias.
 */
import type { Diagnostico } from '@/types/expediente'

/** Normaliza para comparar: sin acentos, sin plurales obvios, sin relleno. */
function clave(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:de|del|la|el|los|las|con|y|en|por|a)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Las palabras con contenido, en singular aproximado.
 *
 * «infecciones recurrentes» y «infeccion recurrente» tienen que colapsar, o la
 * pareja N39.0 vuelve a colarse cuando el código falta.
 */
function palabras(texto: string): Set<string> {
  return new Set(
    clave(texto).split(' ')
      .filter(w => w.length > 3)
      .map(w => w.replace(/(?:es|s)$/, '')),
  )
}

/**
 * ¿Son el mismo diagnóstico?
 *
 * 1. Si los DOS tienen código CIE-10, manda el código. Para eso existe.
 * 2. Si no, se comparan las palabras de contenido: uno contenido en el otro es
 *    el mismo diagnóstico con más detalle («anemia» ⊂ «anemia leve»).
 */
export function esElMismo(a: Diagnostico, b: Diagnostico): boolean {
  const ca = (a.codigoCIE10 || '').trim().toUpperCase()
  const cb = (b.codigoCIE10 || '').trim().toUpperCase()
  if (ca && cb) return ca === cb

  const ka = clave(a.descripcion)
  const kb = clave(b.descripcion)
  if (!ka || !kb) return false
  if (ka === kb) return true

  const pa = palabras(a.descripcion)
  const pb = palabras(b.descripcion)
  if (!pa.size || !pb.size) return false
  const [chico, grande] = pa.size <= pb.size ? [pa, pb] : [pb, pa]
  return [...chico].every(w => grande.has(w))
}

/**
 * ¿Cuál de los dos se queda?
 *
 * El más específico, medido en palabras de contenido. Entre «Anemia» y «Anemia
 * leve» se queda el segundo: describe mejor al paciente y el código es el mismo.
 */
function elMejor(a: Diagnostico, b: Diagnostico): Diagnostico {
  const na = palabras(a.descripcion).size
  const nb = palabras(b.descripcion).size
  if (na !== nb) return na > nb ? a : b
  // A igualdad, se queda el que trae código: sirve para facturar y para buscar.
  return (a.codigoCIE10 || '').trim() ? a : b
}

export interface FusionDeDiagnosticos {
  /** Lo que había en la nota antes de esta pasada. */
  previos: readonly Diagnostico[]
  /** Lo que la IA acaba de producir. */
  nuevos: readonly Diagnostico[]
  /**
   * Lo que la IA produjo en la pasada ANTERIOR.
   *
   * Es lo único que permite distinguir lo suyo de lo que escribió el médico —y
   * por tanto lo único que hace seguro sustituir en vez de acumular.
   */
  deLaIaAnterior?: readonly Diagnostico[]
}

/**
 * Sustituye lo que puso la IA, conserva lo del médico, y no repite.
 *
 * Si no se sabe qué puso la IA antes (`deLaIaAnterior` ausente), **no se quita
 * nada**: ante la duda se conserva, porque el error caro es borrarle un
 * diagnóstico al médico, no dejarle uno de más.
 */
export function fusionarDiagnosticos(p: FusionDeDiagnosticos): Diagnostico[] {
  const previos = p.previos ?? []
  const nuevos = (p.nuevos ?? []).filter(d => d?.descripcion?.trim())
  const anteriores = p.deLaIaAnterior ?? []

  // 1 · Lo del médico: todo lo previo que la IA no había puesto.
  const delMedico = anteriores.length
    ? previos.filter(d => !anteriores.some(a => esElMismo(a, d)))
    : previos

  // 2 · Se apilan los del médico primero: ante un empate, gana lo suyo.
  const out: Diagnostico[] = []
  for (const d of [...delMedico, ...nuevos]) {
    const i = out.findIndex(x => esElMismo(x, d))
    if (i === -1) { out.push(d); continue }
    // Repetido: se queda el más específico, sin perder el que ya estaba.
    out[i] = elMejor(out[i], d)
  }
  return out
}

export const POR_QUE_NO_SE_REEMPLAZA_A_SECAS =
  'La fusión existe porque reemplazar borraba lo que el médico escribía a mano ' +
  'mientras la IA corría. La distinción correcta no es viejo contra nuevo: es lo ' +
  'que puso la IA contra lo que puso el médico.'

export const POR_QUE_MANDA_EL_CODIGO =
  'Dos textos distintos con el mismo CIE-10 son el mismo diagnóstico: para eso ' +
  'existe el código. Comparar sólo el texto dejaba pasar «Anemia» y «Anemia ' +
  'leve» como si fueran dos.'

export const ANTE_LA_DUDA_SE_CONSERVA =
  'Si no se sabe qué puso la IA en la pasada anterior, no se quita nada. El ' +
  'error caro es borrarle un diagnóstico al médico, no dejarle uno de más.'
