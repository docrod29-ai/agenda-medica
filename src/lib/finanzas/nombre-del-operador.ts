/**
 * EL NOMBRE DE QUIEN OPERA, NUNCA SU CORREO.
 *
 * ── EL FALLO (ASC-015, Panel de Lujo 2026-09, P3) ────────────────────────────
 * Al marcar una cortesía, el nombre sellado era `displayName || email`: en una
 * cuenta sin displayName el corte de caja imprimía «autorizó demo@…». Para las
 * anulaciones ya existía el resolvedor correcto (`quienAnulo` con
 * `nombrePorUid`, que traduce uid → nombre del equipo y nunca cae al correo);
 * la cortesía no lo usaba.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * displayName → nombre en el equipo del consultorio (por uid, o por correo si
 * el equipo lo tiene registrado) → «usuario xxxxxx…». El correo no se sella
 * jamás como nombre: es dato de contacto, no identidad legible, y acaba
 * impreso.
 *
 * Módulo PURO.
 */

export interface MiembroDelEquipo {
  uid?: string | null
  email?: string | null
  nombre?: string | null
}

export function nombreDelOperador(
  operador: { uid?: string | null; displayName?: string | null; email?: string | null },
  equipo: readonly MiembroDelEquipo[] = [],
): string {
  const propio = (operador.displayName ?? '').trim()
  if (propio) return propio
  const uid = (operador.uid ?? '').trim()
  const correo = (operador.email ?? '').trim().toLowerCase()
  const enEquipo = equipo.find(m =>
    (uid && (m.uid ?? '').trim() === uid) ||
    (correo && (m.email ?? '').trim().toLowerCase() === correo),
  )
  const nombreEquipo = (enEquipo?.nombre ?? '').trim()
  if (nombreEquipo) return nombreEquipo
  if (uid) return `usuario ${uid.slice(0, 6)}…`
  return 'sin nombre registrado'
}
