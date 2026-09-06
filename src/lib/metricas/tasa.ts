/**
 * UNA TASA SIN DENOMINADOR NO ES CERO: NO EXISTE.
 *
 * Este repositorio ya tiene la regla escrita para lo clínico: un motor al que le
 * falta un dato **dice que no puede calcular**, no estima. «No se puede calcular
 * Kirby: falta PaO₂ y FiO₂». Lo mismo vale para los indicadores del consultorio,
 * y por la misma razón: un número inventado se lee igual que uno medido.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * `/crm` calculaba `total > 0 ? (n / total) * 100 : 0`. Con un consultorio
 * recién abierto, o una semana sin agenda, eso pinta **«Tasa de atención 0% ·
 * Tasa de confirmación 0% · Tasa de no-show 0%»**: un boletín de notas pésimo
 * donde no había nada que calificar. Medido sobre un consultorio dado de alta de
 * cero, `/crm` era la única de las catorce pantallas que no decía estar vacía —
 * decía ceros.
 *
 * `null` significa «no hay con qué», y se pinta con una raya. Un cero de verdad
 * —cero ausencias de ocho citas— sigue siendo `0` y se pinta `0%`, que es
 * información y no un hueco.
 */

/**
 * Porcentaje de `parte` sobre `total`, o `null` cuando no hay denominador.
 *
 * `null` no es «cero»: es «todavía no se puede saber». Quien lo pinte tiene que
 * distinguirlo — para eso está `porcentaje()`.
 */
export function tasa(parte: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  return (parte / total) * 100
}

/** Cómo se escribe una tasa, incluida la que no existe. */
export function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(0)}%`
}
