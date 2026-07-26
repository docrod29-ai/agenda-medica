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
 * quita ("1,234.5"→1234.5, formato MX); si no trae punto, la coma es el decimal
 * ("12,5"→12.5). No numérico → null (nunca inventa un 0).
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (s === '') return null
  const limpio = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.')
  const x = Number(limpio)
  return Number.isFinite(x) ? x : null
}
