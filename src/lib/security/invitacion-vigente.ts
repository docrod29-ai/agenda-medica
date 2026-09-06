/**
 * ¿La invitación sigue viva? Puro; lo usan el cliente (`esValida`) y el
 * servidor (`/api/clinic/unirse`) para no decir cosas distintas.
 *
 * SIN CADUCIDAD NO ES VÁLIDA (Panel de Lujo ZL-011). Antes el servidor hacía
 * `if (inv.expiresAt && …)`, y la ausencia del campo convertía la invitación
 * en eterna: bastaba crear el documento sin `expiresAt` desde una consola para
 * tener un enlace que nunca moría. Ausente, ilegible o vencida: las tres se
 * rechazan igual.
 */
export function invitacionVigente(
  inv: { used?: boolean; expiresAt?: unknown },
  ahoraMs: number,
): { ok: true } | { ok: false; motivo: string } {
  if (inv.used === true) return { ok: false, motivo: 'Esta invitación ya fue usada.' }
  const limite = typeof inv.expiresAt === 'string' ? Date.parse(inv.expiresAt) : NaN
  if (Number.isNaN(limite) || ahoraMs > limite) return { ok: false, motivo: 'Esta invitación ha expirado.' }
  return { ok: true }
}
