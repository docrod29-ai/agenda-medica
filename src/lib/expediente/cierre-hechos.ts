/**
 * QUÉ YA SE HIZO AL CERRAR — V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20).
 *
 * ── EL HUECO ──────────────────────────────────────────────────────────────
 *
 * `ComoCerrarLaConsulta` (REG-244) sabe enseñar lo que FALTA — recibe una
 * prop `hechos` para lo que ya se hizo. Esa prop existía desde que se
 * escribió el componente y nunca se conectó en `/consulta/[patientId]`: cada
 * vuelta de `/receta` o `/orden` a la consulta enseñaba la MISMA lista sin
 * una sola marca, aunque el médico acabara de imprimir la receta hace diez
 * segundos. Es el patrón de «escrito y sin conectar» que ya tiene su propia
 * regla en este repositorio.
 *
 * La continuidad que pide §20 del Master Loop V15 — un mismo objeto
 * haciéndose más detallado, nunca un reinicio — se rompía justo en el paso
 * que las nombra a las dos: cerrar la nota. Ese es el defecto que resuelve
 * este módulo.
 *
 * ── POR QUÉ `sessionStorage` Y NO FIRESTORE ──────────────────────────────
 *
 * Es estado de ESTA pestaña sobre ESTA nota — «lo que ya se hizo aquí»— no
 * un hecho clínico: nada que auditar, nada que respaldar (`clinica/respaldo.ts`),
 * nada que otro consultorio necesite leer. Escribirlo en Firestore sería
 * inventar una colección para un recordatorio de UI. Si se pierde (pestaña
 * nueva, `sessionStorage` bloqueado), el peor caso es que el checklist
 * vuelve a mostrarse sin marcas — nunca un dato clínico incorrecto.
 *
 * Módulo casi-puro: las dos funciones de lectura/escritura tocan
 * `sessionStorage`, pero ninguna otra lógica se mezcla aquí.
 */

function claveCierre(notaId: string): string {
  return `nx-cierre-hechos:${notaId}`
}

/** Lo que ya se hizo para cerrar ESTA nota, en esta pestaña. */
export function leerHechosDeCierre(notaId: string | null | undefined): string[] {
  if (!notaId || typeof window === 'undefined') return []
  try {
    const crudo = window.sessionStorage.getItem(claveCierre(notaId))
    if (!crudo) return []
    const parseado: unknown = JSON.parse(crudo)
    return Array.isArray(parseado) ? parseado.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Marca `clave` (p. ej. `'receta'`, `'orden'`, `'hoja_del_paciente'`) como
 * ya hecha para `notaId`. Devuelve la lista resultante para que quien llama
 * pueda actualizar su estado sin leer `sessionStorage` dos veces.
 */
export function marcarHechoDeCierre(notaId: string | null | undefined, clave: string): string[] {
  const actuales = leerHechosDeCierre(notaId)
  if (!notaId || typeof window === 'undefined' || actuales.includes(clave)) return actuales
  const siguiente = [...actuales, clave]
  try {
    window.sessionStorage.setItem(claveCierre(notaId), JSON.stringify(siguiente))
  } catch {
    /* Sin sessionStorage (privado, cuota llena): se pierde el recordatorio
       visual, nunca el cierre de la nota — no es una compuerta clínica. */
  }
  return siguiente
}

function claveSeguimiento(notaId: string): string {
  return `nx-cierre-seguimiento:${notaId}`
}

/**
 * LA FECHA DE CONTROL SOBREVIVE AL REMONTE — quinta rebanada de la Fase 8.
 *
 * El documento de la nota NO guarda `proximoSeguimiento` (va al expediente
 * del paciente y a la tarea del worklist; añadirle el campo a la nota es un
 * cambio de esquema congelado por V15 §1 — `firestore.rules` sella la forma
 * con `hasOnly` y lo rechazaría). Así que al volver de `/citas` a la nota
 * recién firmada, el remonte dejaba `proximoSeguimiento` vacío y el paso
 * «Agendar el seguimiento» DESAPARECÍA del checklist — ni marcado ni
 * pendiente: inexistente, mientras sus hermanos (receta/orden) sí volvían.
 * Lo encontró el propio arnés de esta rebanada (`marcado: null`), no una
 * lectura del código.
 *
 * Mismo criterio que las marcas de arriba: estado de ESTA pestaña sobre ESTA
 * nota, no un hecho clínico — el hecho clínico (la tarea, el campo del
 * paciente) ya quedó escrito al firmar por los caminos de siempre.
 */
export function guardarSeguimientoDeCierre(notaId: string | null | undefined, fechaISO: string): void {
  if (!notaId || typeof window === 'undefined' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return
  try {
    window.sessionStorage.setItem(claveSeguimiento(notaId), fechaISO)
  } catch { /* igual que arriba: se pierde el recordatorio, nunca la nota */ }
}

/** La fecha guardada para `notaId`, o `''` si no hay (nunca inventa una). */
export function leerSeguimientoDeCierre(notaId: string | null | undefined): string {
  if (!notaId || typeof window === 'undefined') return ''
  try {
    const crudo = window.sessionStorage.getItem(claveSeguimiento(notaId)) ?? ''
    return /^\d{4}-\d{2}-\d{2}$/.test(crudo) ? crudo : ''
  } catch {
    return ''
  }
}

export const POR_QUE_SESSION_STORAGE =
  'Es estado de esta pestaña sobre esta nota, no un hecho clínico: nada que ' +
  'auditar, nada que respaldar, nada que otro consultorio necesite leer.'
