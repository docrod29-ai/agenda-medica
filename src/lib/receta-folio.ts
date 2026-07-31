/**
 * Folio de receta derivado de la nota.
 *
 * POR QUÉ VIVE APARTE: este cálculo estaba SOLO en el componente cliente de la
 * receta (`receta/[patientId]/[notaId]/page.tsx`), mientras que el certificado
 * del QR lo recibía por el body de una API. Es decir: el folio impreso en el
 * papel y el folio que el servidor firmaba eran dos valores independientes que
 * "casualmente" coincidían. Si divergían, el paciente se llevaba un documento
 * con dos identificadores distintos y ninguna forma de saber cuál es el bueno.
 *
 * Ahora es UNA sola función que importan cliente y servidor. No puede vivir en
 * `receta-token.ts` porque ese módulo es server-only (`node:crypto`).
 *
 * Puro y determinista → testeable y estable ante reimpresión.
 */

/**
 * `"abc123def456"` → `"RX-3DEF456"` · `""` → `""`.
 * Devuelve cadena vacía cuando no hay notaId: el llamador decide su respaldo
 * (aquí NO se inventa un folio con el reloj, porque el servidor no debe acuñar
 * certificados de algo que no puede identificar).
 */
export function folioDeNota(notaId: string | undefined | null): string {
  const base = (notaId ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return base ? `RX-${base.slice(-7)}` : ''
}
