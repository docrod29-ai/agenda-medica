/**
 * EL PLAN, ATADO AL PROBLEMA QUE LO MOTIVÓ — REG-243.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * De la investigación del mercado (I-12). Suki lo llama **problem-based
 * charting**: cada problema con su CIE-10 y, debajo, el plan de ESE problema.
 * Eczema L20 con su plan; ansiedad F41.1 con el suyo.
 *
 * Aquí la nota tenía una lista de diagnósticos y, aparte, una lista de
 * medicamentos. Sin relación entre ellas. Con dos problemas y cinco fármacos,
 * quién es de quién queda en la cabeza del médico — y en la cabeza del que lea
 * la nota después, que no estuvo.
 *
 * ── LA LÍNEA QUE NO SE CRUZA ────────────────────────────────────────────────
 *
 * Sería fácil, y sería un desastre, **inferir** el vínculo: «moxifloxacino es
 * un antibiótico, hay una neumonía, luego el moxifloxacino es de la neumonía».
 * Eso es razonamiento clínico, y este módulo no razona clínicamente. Con un
 * antibiótico y dos infecciones simultáneas acertaría por suerte.
 *
 * **Sólo se ata lo que el médico dijo.** Se busca el fármaco y el diagnóstico
 * en el MISMO tramo del dictado: «para la neumonía le doy moxifloxacino» ata;
 * dos frases que nunca se tocaron, no.
 *
 * Lo que no se ata queda **sin asignar**, y se ve que está sin asignar. Un
 * hueco visible es información; un vínculo inventado es un error que se lee
 * como un acierto.
 *
 * ── POR QUÉ EL DICTADO Y NO LA NOTA ─────────────────────────────────────────
 *
 * Porque la nota es prosa reordenada por el modelo: en ella el fármaco y el
 * diagnóstico pueden acabar juntos sin que nadie los relacionara nunca. El
 * dictado es lo que se dijo, en el orden en que se dijo.
 *
 * Módulo PURO. Se apoya en `segmentar()` de `trazabilidad.ts`, el mismo motor
 * que ya sostiene «¿de dónde salió esto?».
 */
import { segmentar, type Segmento } from '@/lib/expediente/trazabilidad'

const norm = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras demasiado comunes para que su coincidencia signifique algo. */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'por', 'para', 'en',
  'no', 'un', 'una', 'que', 'se', 'su', 'al', 'aguda', 'agudo', 'cronica',
  'cronico', 'leve', 'grave', 'moderada', 'moderado', 'no', 'especificada',
])

/** Las palabras con contenido de un diagnóstico: «neumonía adquirida…» → neumonia, adquirida. */
function nucleoDe(dx: unknown): string[] {
  return norm(dx).split(/[^a-z0-9]+/).filter(p => p.length >= 4 && !VACIAS.has(p))
}

/** El primer nombre del fármaco: «Moxifloxacino tabletas» → moxifloxacino. */
function nucleoDelFarmaco(nombre: unknown): string {
  return norm(nombre).split(/[^a-z0-9]+/).filter(Boolean)[0] ?? ''
}

export interface AtadoAlProblema {
  /** El diagnóstico, literal, tal como está en la nota. */
  diagnostico: string
  /** El tramo del dictado donde aparecen los dos. Es la prueba. */
  evidencia: Segmento
}

/**
 * ¿A qué problema pertenece este fármaco, según lo que se DIJO?
 *
 * Devuelve `null` cuando no consta. Nunca adivina.
 */
export function aQuienPertenece(
  farmaco: unknown,
  diagnosticos: readonly unknown[],
  dictado: unknown,
): AtadoAlProblema | null {
  const nucleo = nucleoDelFarmaco(farmaco)
  if (!nucleo || nucleo.length < 4) return null

  const segmentos = segmentar(String(dictado ?? ''))
  if (!segmentos.length) return null

  for (const seg of segmentos) {
    const t = norm(seg.texto)
    if (!t.includes(nucleo)) continue

    /**
     * Se exige que coincida **más de una** palabra de contenido, o una sola si
     * es larga. «Neumonía» sola basta; «aguda» sola no ataría nada útil, y con
     * dos diagnósticos que compartan un adjetivo ataría el equivocado.
     */
    for (const dx of diagnosticos) {
      const palabras = nucleoDe(dx)
      if (!palabras.length) continue
      const halladas = palabras.filter(p => t.includes(p))
      const basta = halladas.length >= 2 || (halladas.length === 1 && halladas[0].length >= 6)
      if (basta) return { diagnostico: String(dx ?? '').trim(), evidencia: seg }
    }
  }
  return null
}

export interface Problema {
  /** El diagnóstico, o `null` para el grupo de lo que no consta. */
  diagnostico: string | null
  medicamentos: readonly { nombre: string; evidencia?: Segmento }[]
}

/**
 * El plan agrupado por problema.
 *
 * El grupo de `diagnostico: null` va SIEMPRE al final y siempre existe si hay
 * algo sin atar: es el que dice «esto no consta que sea de nadie».
 */
export function planPorProblema(e: {
  diagnosticos?: readonly unknown[]
  medicamentos?: readonly { nombre?: unknown }[]
  dictado?: unknown
}): Problema[] {
  const dxs = (e.diagnosticos ?? []).map(d => String(d ?? '').trim()).filter(Boolean)
  const meds = (e.medicamentos ?? []).map(m => String(m?.nombre ?? '').trim()).filter(Boolean)

  const porDx = new Map<string, { nombre: string; evidencia?: Segmento }[]>()
  const sinAsignar: { nombre: string }[] = []

  for (const nombre of meds) {
    const atado = aQuienPertenece(nombre, dxs, e.dictado)
    if (atado) {
      const lista = porDx.get(atado.diagnostico) ?? []
      lista.push({ nombre, evidencia: atado.evidencia })
      porDx.set(atado.diagnostico, lista)
    } else {
      sinAsignar.push({ nombre })
    }
  }

  /* Se recorren los diagnósticos EN SU ORDEN, no en el del Map: el orden de la
     nota es el que el médico eligió. */
  const out: Problema[] = dxs
    .filter(dx => porDx.has(dx))
    .map(dx => ({ diagnostico: dx, medicamentos: porDx.get(dx)! }))

  if (sinAsignar.length) out.push({ diagnostico: null, medicamentos: sinAsignar })
  return out
}

export const POR_QUE_NO_SE_INFIERE =
  '«Moxifloxacino es un antibiótico, hay una neumonía, luego es de la neumonía» ' +
  'es razonamiento clínico. Con dos infecciones simultáneas acertaría por ' +
  'suerte. Sólo se ata lo que el médico dijo en el mismo tramo del dictado.'

export const POR_QUE_EL_HUECO_SE_VE =
  'Un hueco visible es información. Un vínculo inventado es un error que se lee ' +
  'como un acierto.'

export const POR_QUE_EL_DICTADO_Y_NO_LA_NOTA =
  'La nota es prosa reordenada por el modelo: en ella el fármaco y el ' +
  'diagnóstico pueden acabar juntos sin que nadie los relacionara nunca. El ' +
  'dictado es lo que se dijo, en el orden en que se dijo.'
