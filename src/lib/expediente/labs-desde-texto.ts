/**
 * MAPEO DE ESTUDIOS EXTRAÍDOS → VALORES DE LABORATORIO PARA EL COPILOTO
 *
 * EL PROBLEMA: el copiloto ya sabe calcular solo, sin pedirle nada al médico —
 * TFG por CKD-EPI 2021, FIB-4, ajuste renal de fármacos, PREVENT, metas
 * lipídicas. Todo escrito y con pruebas. Pero la consulta NUNCA le pasaba los
 * laboratorios: un grep de `labs` en esa pantalla devolvía cero. El único
 * cálculo automático vivo era el IMC.
 *
 * Consecuencia doble: el médico no veía la TFG de su paciente, y además acababa
 * tecleando a mano escalas que el sistema ya sabía calcular.
 *
 * El NER ya extrae los estudios del dictado como `{texto, valor, unidad}`. Esto
 * los traduce al vocabulario que el copiloto espera.
 *
 * PRINCIPIO: ante la duda, NO se mapea. Un valor mal asignado alimenta una
 * fórmula que produce una conducta — una creatinina leída como urea daría una TFG
 * falsa y un ajuste de dosis equivocado. Es preferible no calcular a calcular mal.
 *
 * Puro y determinista → testeable.
 */

export interface EstudioExtraido {
  texto: string
  valor?: string
  unidad?: string
}

/**
 * Sinónimos por analito. Se buscan como PALABRA, no como subcadena: sin eso,
 * «urea» casaría dentro de otras palabras y «creatinina» dentro de «creatinina
 * en orina», que no es lo mismo que la sérica.
 */
const ANALITOS: { clave: string; patron: RegExp; min: number; max: number }[] = [
  // Rango plausible por analito: fuera de él NO se mapea. Un valor absurdo suele
  // ser una unidad distinta o un error de transcripción, y meterlo a una fórmula
  // es peor que dejar el campo vacío.
  { clave: 'creatinina', patron: /\bcreatinina\b(?!\s*(en\s*)?orina)/i, min: 0.1, max: 25 },
  { clave: 'tfg', patron: /\b(tfg|filtrado glomerular|egfr|depuracion de creatinina)\b/i, min: 1, max: 200 },
  { clave: 'ast', patron: /\b(ast|tgo|aspartato)\b/i, min: 1, max: 5000 },
  { clave: 'alt', patron: /\b(alt|tgp|alanino)\b/i, min: 1, max: 5000 },
  { clave: 'plaquetas', patron: /\bplaquetas?\b/i, min: 1, max: 2_000_000 },
  { clave: 'colesterolTotal', patron: /\bcolesterol total\b/i, min: 50, max: 800 },
  { clave: 'hdl', patron: /\b(hdl|colesterol hdl)\b/i, min: 5, max: 150 },
  { clave: 'ldl', patron: /\b(ldl|colesterol ldl)\b/i, min: 10, max: 500 },
  { clave: 'trigliceridos', patron: /\btrigli(c|s)eridos\b/i, min: 20, max: 5000 },
  { clave: 'hba1c', patron: /\b(hba1c|hemoglobina glucosilada|hemoglobina glicada)\b/i, min: 3, max: 20 },
  { clave: 'glucosa', patron: /\bglucosa\b/i, min: 20, max: 1500 },
  { clave: 'potasio', patron: /\b(potasio|k\+?)\b/i, min: 1, max: 10 },
  { clave: 'sodio', patron: /\b(sodio|na\+?)\b/i, min: 100, max: 190 },
  { clave: 'hemoglobina', patron: /\bhemoglobina\b(?!\s*(glucosilada|glicada))/i, min: 2, max: 25 },
  { clave: 'leucocitos', patron: /\bleucocitos\b/i, min: 100, max: 500_000 },
]

/**
 * Lee el número de una cadena de resultado. Acepta coma decimal y desigualdades,
 * pero NO inventa: si hay más de un número (p. ej. «120/80») devuelve null,
 * porque no se puede saber cuál es el analito.
 */
export function valorNumerico(valor: string | undefined): number | null {
  if (!valor) return null
  const t = valor.trim().replace(',', '.')
  if (/\d\s*\/\s*\d/.test(t)) return null            // "120/80" no es un analito
  const nums = t.match(/-?\d+(\.\d+)?/g)
  if (!nums || nums.length !== 1) return null        // varios números: ambiguo
  const n = Number(nums[0])
  return Number.isFinite(n) ? n : null
}

/**
 * Plaquetas y leucocitos se reportan en miles ("250 mil", "250 x10³"). El
 * copiloto los espera en unidades absolutas para el FIB-4.
 */
function normalizarConteo(clave: string, n: number, unidad: string): number {
  if (clave !== 'plaquetas' && clave !== 'leucocitos') return n
  const u = (unidad || '').toLowerCase()
  const enMiles = /10\^?3|10³|mil|k\/|x10\*?3/.test(u) || n < 1500
  return enMiles ? n * 1000 : n
}

/**
 * Traduce los estudios extraídos al vocabulario del copiloto.
 *
 * Ante colisión gana el PRIMERO: el dictado suele mencionar el valor actual antes
 * que los históricos, y sobrescribir con uno viejo daría un cálculo desfasado.
 */
export function labsDesdeEstudios(estudios: readonly EstudioExtraido[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of estudios ?? []) {
    /**
     * Sin acentos. El reporte del laboratorio escribe «Triglicéridos» y el
     * dictado «trigliceridos»; comparar contra el texto crudo hacía que el
     * acentuado —el que de verdad llega— no casara con nada y el valor se
     * perdiera en silencio. Lo cazó el test.
     */
    const texto = (e.texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    if (!texto) continue
    const n0 = valorNumerico(e.valor)
    if (n0 === null) continue

    for (const a of ANALITOS) {
      if (!a.patron.test(texto)) continue
      if (out[a.clave] !== undefined) break        // ya se tomó el primero
      const n = normalizarConteo(a.clave, n0, e.unidad ?? '')
      // Fuera de rango plausible NO se mapea: sería alimentar una fórmula con un
      // valor que casi seguro está en otra unidad o mal transcrito.
      if (n < a.min || n > a.max) break
      out[a.clave] = n
      break
    }
  }
  return out
}
