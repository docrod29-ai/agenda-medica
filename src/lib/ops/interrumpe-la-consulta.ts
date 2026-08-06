/**
 * CON UN PACIENTE ENFRENTE, SÓLO SE INTERRUMPE POR LO QUE IMPIDE ATENDERLO.
 *
 * ── LO QUE VIO EL DR. EN SU PANTALLA (5-ago-2026) ────────────────────────────
 *
 * Debajo de la nota de una consulta real, en rojo y a lo ancho:
 *
 *     «5 trabajo(s) automático(s) dejaron de correr · 5 veces
 *      reminders: No hay ni un latido… · limpiar-audio: … · retencion: …»
 *
 * Todo cierto y todo suyo —es el dueño de la plataforma— pero **nada de eso se
 * arregla desde la consulta**, y ninguno de esos trabajos afecta al paciente que
 * tiene delante. Era el octavo bloque de aviso de esa pantalla.
 *
 * ── LA LECCIÓN, POR SEGUNDA VEZ ──────────────────────────────────────────────
 *
 * El 4-ago la franja ya había aprendido a callarse los timeouts del proveedor:
 * «un timeout es información de tablero; la franja es para lo que está caído
 * hasta que él entre a arreglarlo». El filtro se escribió sobre la URGENCIA, y
 * un trabajo automático muerto **es** urgente. Por eso volvió a colarse.
 *
 * La pregunta correcta no era «¿esto es urgente?» sino **«¿esto se arregla desde
 * donde estoy, y afecta a quien tengo delante?»**. Un cron mudo puntúa alto en
 * la primera y cero en la segunda.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * En una pantalla con un paciente enfrente sólo entra lo que **impide atenderlo
 * ahora**: la IA caída, la llave rechazada, la cuenta sin saldo. Lo demás no
 * desaparece — espera a que salga de la consulta, que es cuando puede hacer algo
 * al respecto.
 *
 * Módulo PURO.
 */

/**
 * Las pantallas donde hay una persona esperando.
 *
 * Se comparan por prefijo de ruta. Están las cuatro donde se atiende: la
 * consulta, el expediente, la ficha de hospitalización y el pase de UCI.
 */
export const PANTALLAS_CON_PACIENTE: readonly string[] = [
  '/consulta',
  '/expediente',
  '/hospitalizacion',
  '/uci',
]

/** ¿Esta ruta es una pantalla con un paciente enfrente? */
export function hayPacienteEnfrente(ruta: string | null | undefined): boolean {
  const r = String(ruta ?? '')
  return PANTALLAS_CON_PACIENTE.some(p => r === p || r.startsWith(`${p}/`))
}

export interface IncidenteVisible {
  titulo: string
  queHacer: string
  urgente: boolean
  veces?: number
  /**
   * ¿Merece cortar una consulta?
   *
   * Lo pone quien crea el incidente, porque es quien sabe si impide atender.
   * Ausente se toma como `false`: **el silencio es el valor seguro**. Un aviso
   * de más en consulta cuesta la atención del médico con un paciente delante; el
   * mismo aviso en la agenda, cinco minutos después, no cuesta nada.
   */
  interrumpeConsulta?: boolean
}

/**
 * Los que se pueden pintar en esta ruta.
 *
 * Fuera de las pantallas con paciente no se filtra nada: allí es donde el dueño
 * puede y debe enterarse de todo.
 */
export function visiblesEn<T extends IncidenteVisible>(
  incidentes: readonly T[],
  ruta: string | null | undefined,
): T[] {
  if (!hayPacienteEnfrente(ruta)) return [...incidentes]
  return incidentes.filter(i => i.interrumpeConsulta === true)
}

export const POR_QUE_NO_BASTA_LA_URGENCIA =
  'El filtro anterior preguntaba «¿es urgente?», y un trabajo automático muerto ' +
  'lo es. La pregunta que importa con un paciente delante es «¿se arregla desde ' +
  'aquí, y le afecta a él?» — un cron mudo puntúa alto en la primera y cero en ' +
  'la segunda.'

export const POR_QUE_EL_SILENCIO_ES_EL_VALOR_SEGURO =
  'Un incidente que no declara si interrumpe se calla en consulta. Un aviso de ' +
  'más ahí cuesta la atención del médico con alguien delante; el mismo aviso en ' +
  'la agenda, cinco minutos después, no cuesta nada. La asimetría manda.'
