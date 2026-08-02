/**
 * QUÉ CITAS PUEDE CANCELAR EL PACIENTE DESDE WHATSAPP.
 *
 * ── LO QUE HABÍA: UNA PROMESA SIN NADA DETRÁS ────────────────────────────────
 *
 * El menú del bot ofrece «3️⃣ Cancelar cita». Al elegirla, el bot contestaba:
 *
 *   «Para cancelar su cita, comuníquese al 555…
 *    También puede escribir su nombre completo y le ayudamos.»
 *
 * …y el estado siguiente **ignoraba por completo lo que el paciente escribiera**:
 * respondía otra vez el teléfono del consultorio y volvía al menú. O sea, el
 * paciente teclea su nombre completo —dato personal, a un canal externo— para
 * nada, y la cita sigue viva. El día de la consulta cuenta como no-show.
 *
 * Y el bot SÍ sabe cancelar: cuando alguien contesta «NO» a un recordatorio, la
 * cita se cancela sin problema. Lo que faltaba era encontrar la cita cuando el
 * paciente escribe por su cuenta.
 *
 * ── LAS REGLAS ───────────────────────────────────────────────────────────────
 *
 *  · Sólo citas FUTURAS y en estado tocable. Lo terminado y lo que ya movió
 *    dinero lo resuelve el consultorio, no un mensaje de WhatsApp — es el mismo
 *    criterio que ya aplica el portal del paciente (`lib/portal/estados.ts`).
 *  · Se respeta la política de cancelación del consultorio. Si el bot cancelara
 *    sin mirarla, sería la puerta trasera para saltarse lo que el portal exige,
 *    y el consultorio se enteraría tarde.
 *  · Una cita bloqueada por la política NO se esconde: se enseña diciendo por
 *    qué no se puede, para que el paciente llame en vez de creer que no tiene
 *    cita.
 *
 * Módulo PURO.
 */

/** Estados que el paciente no puede tocar desde un mensaje. */
const INTOCABLES = new Set([
  'atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada', 'pagada', 'pendiente-pago',
])

export interface CitaMinima {
  id: string
  /** Hora de PARED, como se guarda: `2026-08-10 10:00`. */
  fechaHora: string
  estado?: string
  tipo?: string
  medicoNombre?: string
}

export interface CitaCancelable extends CitaMinima {
  /** Horas que faltan para la cita. */
  horasFaltan: number
}

export interface Clasificacion {
  /** Se pueden cancelar aquí y ahora. */
  cancelables: CitaCancelable[]
  /** Existen, pero la política del consultorio pide llamar. */
  bloqueadas: CitaCancelable[]
}

/**
 * Reparte las citas del paciente en cancelables y bloqueadas.
 *
 * @param ahoraMs instante de referencia.
 * @param aInstante convierte la hora de pared en instante (la zona la pone quien
 *   llama: el bot ya sabe la del consultorio).
 * @param minHoras política de cancelación del consultorio.
 */
export function clasificarCitas(
  citas: readonly CitaMinima[],
  ahoraMs: number,
  aInstante: (fechaHora: string) => number,
  minHoras: number,
): Clasificacion {
  const cancelables: CitaCancelable[] = []
  const bloqueadas: CitaCancelable[] = []

  for (const c of citas) {
    if (INTOCABLES.has(String(c.estado ?? ''))) continue
    const t = aInstante(c.fechaHora)
    if (!Number.isFinite(t) || t <= ahoraMs) continue   // ya pasó: no hay nada que cancelar
    const horasFaltan = (t - ahoraMs) / 3_600_000
    const conHoras: CitaCancelable = { ...c, horasFaltan }
    if (horasFaltan < minHoras) bloqueadas.push(conHoras)
    else cancelables.push(conHoras)
  }

  const porFecha = (a: CitaCancelable, b: CitaCancelable) => a.horasFaltan - b.horasFaltan
  return { cancelables: cancelables.sort(porFecha), bloqueadas: bloqueadas.sort(porFecha) }
}

/** El aviso de una cita que la política deja fuera. */
export function mensajeBloqueada(minHoras: number, telefono: string): string {
  return `Tu cita está muy cerca: por política del consultorio, las cancelaciones ` +
    `con menos de ${minHoras} h de anticipación se hacen por teléfono. ` +
    `Llámanos al ${telefono || 'consultorio'} y te ayudamos. 🙏`
}

export const POR_QUE_NO_SE_ESCONDE =
  'Porque una cita que no se puede cancelar aquí sigue existiendo. Si el bot ' +
  'contestara «no encontré citas», el paciente se quedaría tranquilo, no ' +
  'llamaría, y no se presentaría: el consultorio pierde el lugar igual, pero ' +
  'además sin saber por qué.'
