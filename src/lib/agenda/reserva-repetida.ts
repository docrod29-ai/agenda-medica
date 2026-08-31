/**
 * ¿ESTA RESERVA YA LA HIZO ESTE MISMO PACIENTE?
 *
 * ── EL FALLO, MEDIDO CONTRA EL EMULADOR ──────────────────────────────────────
 *
 * Enviando tres veces la misma reserva desde el portal público —un doble clic, o
 * un reintento después de perder la respuesta— la primera creaba la cita y las
 * otras dos contestaban:
 *
 *     409  «Ese horario acaba de ocuparse. Elige otro.»
 *
 * Al paciente se le dice que otra persona le quitó el hueco cuando quien lo tomó
 * fue él. Lo razonable entonces es elegir otra hora, y acabar con **dos citas**.
 *
 * El caso que más duele no es el doble clic: es el **resultado desconocido**. El
 * servidor creó la cita y la respuesta se perdió por el camino. El paciente no
 * tiene forma de saber que ya la tiene, y el consultorio recibe dos avisos de
 * «🔔 Nueva cita» para la misma persona.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Reenviar exactamente la misma reserva devuelve **la que ya existe**. No se
 * crea nada, no se avisa dos veces y no se miente sobre lo ocurrido.
 *
 * «La misma» es: mismo teléfono normalizado, mismo instante (`fechaHora`), mismo
 * tipo de cita, y una cita todavía viva.
 *
 * ── POR QUÉ EL TELÉFONO, Y POR QUÉ NORMALIZADO ───────────────────────────────
 *
 * En el portal público no hay sesión: el teléfono es lo único que identifica a
 * quien reserva, y es lo que el propio endpoint ya usa para limitar abuso. Se
 * comparan los últimos diez dígitos —igual que hace el limitador— porque la
 * misma persona escribe `614-123-4567`, `6141234567` y `+52 614 123 4567` en
 * momentos distintos, y las tres son ella.
 *
 * ── QUÉ **NO** DECIDE ────────────────────────────────────────────────────────
 *
 * - **No decide conflictos.** Que dos citas se solapen es otra pregunta, y la
 *   contesta el chequeo de solape del endpoint. Ésta sólo reconoce un reenvío.
 * - **No mira el nombre ni el motivo.** Quien reenvía puede haber corregido una
 *   letra del nombre; sigue siendo la misma reserva. Exigir igualdad de texto
 *   libre haría que un espacio de más creara una cita duplicada, que es el
 *   fallo que esto existe para evitar.
 * - **Dos personas con un mismo teléfono** (una familia) no pierden nada: el
 *   hueco es uno solo, así que la segunda no podría reservarlo de todos modos.
 */

/** Los estados en los que una cita ya no ocupa su lugar. */
const ESTADOS_MUERTOS = ['cancelada', 'reagendada', 'no-asistio']

/** Últimos diez dígitos — la misma normalización que usa el limitador de abuso. */
export function telefonoNormalizado(tel: unknown): string {
  return String(tel ?? '').replace(/\D/g, '').slice(-10)
}

export interface CitaComparable {
  estado?: string
  pacienteTelefono?: string
  fechaHora?: string
  tipo?: string
}

export interface ReservaEntrante {
  telefono: string
  fechaHora: string
  tipo: string
}

/**
 * ¿La cita `existente` es el mismo acto de reserva que `entrante`?
 *
 * Devuelve `false` ante cualquier duda: un teléfono vacío no identifica a nadie,
 * así que dos reservas sin teléfono NO son la misma. Confundirlas fusionaría las
 * citas de dos personas distintas, que es mucho peor que crear una de más.
 */
export function esLaMismaReserva(existente: CitaComparable, entrante: ReservaEntrante): boolean {
  if (ESTADOS_MUERTOS.includes(String(existente.estado ?? ''))) return false
  const telExistente = telefonoNormalizado(existente.pacienteTelefono)
  const telEntrante = telefonoNormalizado(entrante.telefono)
  if (!telExistente || !telEntrante) return false
  if (telExistente !== telEntrante) return false
  if (existente.fechaHora !== entrante.fechaHora) return false
  return existente.tipo === entrante.tipo
}
