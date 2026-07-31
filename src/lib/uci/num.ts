/**
 * Coerción numérica clínica ROBUSTA — fuente única (L4 auditoría maestra 2026-07).
 *
 * Antes cada motor tenía su propio `num()` idéntico con dos fallas:
 *  1. `Number(' ')` es 0 → un campo con solo espacios inyectaba un 0 CLÍNICO donde
 *     el contrato dice "un campo vacío NO es 0/normal". Ahora vacío/espacios → null.
 *  2. `Number('7,35')` es NaN → el dato con COMA DECIMAL mexicana se perdía en
 *     silencio (la escala quedaba parcial o el cálculo se bloqueaba sin motivo).
 *     Ahora la coma se interpreta como separador decimal.
 *
 * Regla de la coma: si el texto trae punto, la coma es separador de MILES y se
 * quita ("1,234.5"→1234.5, formato MX). Sin punto: una coma seguida de EXACTAMENTE
 * 3 dígitos es MILES ("1,200"→1200) — antes se leía como decimal (1.2), y una
 * glucosa "1,200" quedaba en 1.2 disparando alerta de hipoglucemia siendo
 * hiperglucemia (auditoría P1). Cualquier otra coma es el decimal ("12,5"→12.5).
 * No numérico → null (nunca inventa un 0).
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (s === '') return null
  const limpio = s.includes('.')
    ? s.replace(/,/g, '')                          // punto presente → coma = miles
    : /^\d{1,3},\d{3}$/.test(s)
      ? s.replace(',', '')                         // "1,200" → 1200 (miles, 3 dígitos exactos)
      : s.replace(',', '.')                        // "12,5" → 12.5 (decimal)
  const x = Number(limpio)
  return Number.isFinite(x) ? x : null
}
