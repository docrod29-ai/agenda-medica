/**
 * ── UNA SOLA FECHA EN TODO EL PRODUCTO ──────────────────────────────────────
 *
 * MEDIDO el 1-sep-2026 sobre el árbol entero:
 *
 *   pantallas que imprimen ISO CRUDO al médico .......... 7
 *   especificaciones de formato distintas .............. 6+
 *
 * En una sola pantalla —el expediente longitudinal— convivían TRES:
 *
 *   «última visita 01 sep 2026»   ← ResumenPaciente, `{day:'2-digit'}`
 *   «· desde 1 sep 2026»          ← la misma pantalla, `{dateStyle:'medium'}`
 *   «· desde el 2026-09-01»       ← `.slice(0, 10)`, ISO a secas
 *
 * Los tres son la misma clase de hecho —cuándo pasó algo— y el médico tiene que
 * aprenderse tres lecturas. La tercera ni siquiera es española: es el formato en
 * que la base guarda el dato, enseñado tal cual.
 *
 * ── POR QUÉ ESTO IMPORTA MÁS DE LO QUE PARECE ───────────────────────────────
 *
 * Una fecha en un expediente no es adorno: es cuándo se prescribió, cuándo se
 * firmó, desde cuándo toma un fármaco. `2026-09-01` y `01 sep 2026` y
 * `1 sep 2026` son la misma fecha, pero leerlas juntas obliga a traducir, y
 * traducir es donde se equivoca uno. El producto ya tuvo un defecto de esta
 * familia —«08/09/2026», formato de EE. UU. en un producto es-MX, defecto #8 de
 * la auditoría de identidad— y volvió por otra puerta.
 *
 * ── LAS DOS FORMAS, Y NINGUNA MÁS ───────────────────────────────────────────
 *
 * `fechaCorta`   → «1 sep 2026». Para listas, metadatos y renglones de contexto.
 * `fechaConHora` → «1 sep 2026, 12:00». Cuando la hora es parte del hecho
 *                  (una firma, un cobro, un evento de bitácora).
 *
 * Sin ceros a la izquierda: «01 sep» no aporta nada y ocupa una columna más en
 * un renglón que suele ir apretado. Donde el ancho estable importa —un reloj que
 * corre— la regla es la contraria, y por eso vive en otro módulo
 * (`vocabulario-de-la-escucha`): son problemas distintos.
 *
 * ── QUÉ HACE CON LO QUE NO ES UNA FECHA ─────────────────────────────────────
 *
 * Devuelve `''`, nunca «Invalid Date» ni la cadena de entrada. Una fecha que no
 * se pudo leer no se enseña a medias: quien la pinte decide qué decir en su
 * lugar, y así el hueco es visible en vez de disfrazado.
 */

/** Acepta ISO completo o `YYYY-MM-DD`. Mediodía para que la zona no mueva el día. */
function aFecha(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const t = String(iso).trim()
  if (!t) return null
  // `YYYY-MM-DD` a secas se interpreta como UTC y en México retrocede un día.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T12:00:00`) : new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

/** «1 sep 2026». La fecha por defecto del producto. */
export function fechaCorta(iso: string | null | undefined): string {
  const d = aFecha(iso)
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

/** «1 sep 2026, 12:00» — cuando la hora forma parte del hecho. */
export function fechaConHora(iso: string | null | undefined): string {
  const d = aFecha(iso)
  return d
    ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
}
