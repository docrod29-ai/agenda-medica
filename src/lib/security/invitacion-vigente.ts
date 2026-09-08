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

/** Un correo comparable: sin espacios y en minúsculas. Vacío si no es texto. */
export function correoNormalizado(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

/**
 * ¿ESTA persona puede aceptar ESTA invitación?
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * La invitación se comparte por WhatsApp. El enlace es la única credencial, así
 * que quien lo reenvíe entrega el consultorio entero: expediente, agenda y
 * datos de pacientes. Y hay un caso mucho más frecuente que el ataque — el
 * médico genera el enlace en SU navegador, lo abre para ver qué sale, y la
 * página le ofrece «Aceptar y entrar» con la sesión del médico puesta. La
 * asistente nunca crea cuenta: trabaja dentro de la sesión de su médico, sin
 * contraseña propia y sin rastro separado en la bitácora.
 *
 * Cuando el médico escribe el correo de la persona invitada, la invitación deja
 * de ser un enlace al portador y pasa a ser nominativa: sólo esa dirección la
 * acepta, y el servidor lo comprueba (`/api/clinic/unirse`).
 *
 * ── COMPATIBILIDAD ───────────────────────────────────────────────────────────
 *
 * Sin `emailInvitado` la invitación sigue siendo al portador, como hasta hoy:
 * las que ya estaban emitidas no se rompen. El campo es opcional a propósito.
 */
export function invitacionEsParaEsteCorreo(
  inv: { emailInvitado?: unknown },
  correoDeQuienAcepta: unknown,
): { ok: true } | { ok: false; motivo: string } {
  const esperado = correoNormalizado(inv.emailInvitado)
  if (!esperado) return { ok: true }
  const real = correoNormalizado(correoDeQuienAcepta)
  if (!real) {
    return { ok: false, motivo: `Esta invitación es para ${esperado}. Entra con ese correo para aceptarla.` }
  }
  if (real !== esperado) {
    return {
      ok: false,
      motivo: `Esta invitación es para ${esperado}, y esta sesión es de ${real}. Cierra sesión y crea la cuenta con el correo invitado.`,
    }
  }
  return { ok: true }
}
