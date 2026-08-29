/**
 * EL HORIZONTE DE LA AGENDA — UNA SOLA VERDAD PARA TODA FECHA QUE SE AGENDA.
 *
 * ── LOS DOS DEFECTOS QUE LO TRAEN AQUÍ ───────────────────────────────────────
 *
 * **1 · Había fechas que no existen, y el motor las atendía.**
 *
 * Las tres rutas que validaban algo usaban `/^\d{4}-\d{2}-\d{2}$/`, que es una
 * comprobación de FORMA, no de calendario. `2027-02-30` la pasa. Y después:
 *
 *     new Date('2027-02-30T12:00:00')  →  2 de marzo de 2027
 *
 * JavaScript no rechaza el 30 de febrero: lo DESBORDA al día que toque. Así que
 * `getDaySchedule` leía el horario del **2 de marzo** —su día de la semana, su
 * bandera de activo, su lista de festivos— y ofrecía huecos… para una cita que
 * se guardaba como `fechaHora: '2027-02-30 09:00'`.
 *
 * Lo que sale de ahí:
 *
 *   · La cita se valida contra un día y se archiva en otro.
 *   · El chequeo de solapes consulta `fechaHora >= '2027-02-30 00:00'`, así que
 *     **no choca** con las citas reales del 2 de marzo: doble reserva sobre el
 *     mismo hueco del médico.
 *   · No aparece en la vista de ningún día, porque ese día no existe. Una cita
 *     invisible que sí cuenta.
 *
 * Medido: `2027-02-30`, `2027-02-31` y `2026-04-31` generaban diez huecos cada
 * una. `0000-01-01`, también.
 *
 * **2 · No había techo. Ninguno, en ninguna superficie.**
 *
 * `9999-12-31` generaba sus diez huecos igual que un martes de la semana que
 * viene. Ni los `<input type="date">` llevaban `max`, ni `/api/appointments`
 * miraba la fecha —se limita a rebanar `fechaHora`—, ni el booking público, ni
 * la disponibilidad pública, ni el portal del paciente.
 *
 * Un dedo que teclea `2205-03-14` en vez de `2025-03-14` crea una cita a ciento
 * ochenta años vista. Nadie la ve nunca —ninguna vista de día llega ahí— y sin
 * embargo existe: cuenta para el paciente, para los contadores y para la
 * bitácora.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Una fecha sirve para agendar si, y sólo si:
 *
 *   1. tiene la forma `YYYY-MM-DD`;
 *   2. **existe en el calendario** (el 30 de febrero no, el 29 de febrero de
 *      2040 sí, porque 2040 es bisiesto);
 *   3. cae dentro del horizonte `[FECHA_MINIMA_AGENDA, FECHA_MAXIMA_AGENDA]`.
 *
 * Y el mismo motivo, con las mismas palabras, en las nueve superficies. Que el
 * portal diga «Fecha inválida» y el panel no diga nada era la misma pregunta
 * contestada de dos maneras.
 *
 * ── NO SE PREGENERAN FECHAS ──────────────────────────────────────────────────
 *
 * Aquí no hay ninguna lista de días, ni se construye una. El horizonte llega a
 * 2050 y enumerar ese rango serían ~9 000 cadenas mantenidas en memoria para
 * responder una pregunta que es una comparación de texto: las fechas `YYYY-MM-DD`
 * ordenan lexicográficamente igual que cronológicamente, así que el techo se
 * comprueba con `>`. La disponibilidad de un día se CALCULA cuando se pide ese
 * día, como ya hacía `getAvailableSlots`.
 *
 * Hay un guardián que comprueba que este módulo no cría una lista de fechas.
 *
 * ── QUÉ **NO** DECIDE ESTE MÓDULO ────────────────────────────────────────────
 *
 * - **Si la fecha ya pasó.** Eso depende de la zona horaria del consultorio y
 *   cambia según la superficie (el portal no ofrece hoy; el panel sí registra
 *   una cita de esta mañana). Vive donde ya vivía, con `instanteMX`.
 * - **Si el consultorio abre ese día.** Eso es `getDaySchedule` — horario,
 *   festivos y bloqueos. Una fecha válida puede estar perfectamente cerrada.
 * - **Cuánto puede adelantarse un PACIENTE.** Esto es el techo de la
 *   plataforma, no la política comercial de un consultorio.
 */

/**
 * EL TECHO. Hasta aquí llega la agenda de este producto.
 *
 * No es una cifra clínica ni de negocio: es el límite de lo que el software se
 * compromete a representar. Se elige lejos —un cuarto de siglo— para que jamás
 * estorbe a una cita real, y finito para que un error de tecleo no cree una
 * cita fuera de todo alcance humano.
 */
export const FECHA_MAXIMA_AGENDA = '2050-12-31'

/**
 * EL SUELO. No es historia: es un guardarraíl contra el dedo.
 *
 * Nada de este producto ocurrió antes de 2000, así que un año por debajo es un
 * tecleo (`0000-01-01`, `0207-03-14`), no un expediente antiguo. Se declara
 * aquí para que sea una decisión visible y no un efecto colateral.
 */
export const FECHA_MINIMA_AGENDA = '2000-01-01'

/** Por qué una fecha no sirve. La superficie elige cómo enseñarlo; el motivo es uno. */
export type MotivoFechaAgenda = 'forma' | 'inexistente' | 'antes-del-suelo' | 'despues-del-techo'

/** Los mensajes, en un solo sitio: la misma pregunta se contesta igual en todas partes. */
export const MENSAJE_FECHA_AGENDA: Record<MotivoFechaAgenda, string> = {
  forma: 'La fecha debe escribirse como AAAA-MM-DD.',
  inexistente: 'Esa fecha no existe en el calendario.',
  'antes-del-suelo': `La agenda no admite fechas anteriores al ${FECHA_MINIMA_AGENDA}.`,
  'despues-del-techo': `La agenda llega hasta el ${FECHA_MAXIMA_AGENDA}.`,
}

export type FechaAgendaValida = { ok: true; fecha: string }
export type FechaAgendaInvalida = { ok: false; motivo: MotivoFechaAgenda; mensaje: string }
export type ResultadoFechaAgenda = FechaAgendaValida | FechaAgendaInvalida
/** El resultado de `YYYY-MM-DD HH:MM` trae además la cadena ya normalizada. */
export type FechaHoraAgendaValida = { ok: true; fecha: string; fechaHora: string }
export type ResultadoFechaHoraAgenda = FechaHoraAgendaValida | FechaAgendaInvalida

const FORMA = /^(\d{4})-(\d{2})-(\d{2})$/

const no = (motivo: MotivoFechaAgenda): FechaAgendaInvalida =>
  ({ ok: false, motivo, mensaje: MENSAJE_FECHA_AGENDA[motivo] })

/**
 * ¿EXISTE ESTE DÍA EN EL CALENDARIO?
 *
 * Se construye la fecha en UTC desde las tres partes y se comprueba que las tres
 * VUELVAN iguales. Es la única forma fiable: `Date` desborda en silencio, así
 * que el 30 de febrero se convierte en el 2 de marzo y `getMonth()` delata el
 * desbordamiento. Cubre los bisiestos sin tabla propia — 2040-02-29 vuelve
 * entero, 2039-02-29 no.
 *
 * UTC y no local a propósito: aquí sólo se pregunta por el CALENDARIO, y el
 * calendario no depende del huso. La hora real de la cita la resuelve
 * `instanteMX` con la zona del consultorio.
 */
function existeEnElCalendario(anio: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(anio, mes - 1, dia))
  /**
   * `setUTCFullYear` después del constructor, y no es adorno.
   *
   * `Date.UTC(0, 0, 1)` NO es el año 0: JavaScript conserva la regla heredada
   * de que los años 0–99 significan 1900+año, así que devuelve 1900. Sin esta
   * línea, `0000-01-01` fallaba el viaje de ida y vuelta y se rechazaba como
   * «no existe en el calendario» — se rechazaba, sí, pero por el motivo
   * equivocado, y el motivo es la mitad del valor de esta función.
   */
  d.setUTCFullYear(anio)
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

/**
 * La puerta única. Toda fecha que vaya a agendar algo pasa por aquí.
 *
 * Devuelve el motivo, no sólo un booleano: una superficie que sólo sabe «no
 * vale» obliga al usuario a adivinar cuál de las tres cosas está mal.
 */
export function validarFechaDeAgenda(fecha: unknown): ResultadoFechaAgenda {
  const s = typeof fecha === 'string' ? fecha.trim() : ''
  const m = FORMA.exec(s)
  if (!m) return no('forma')
  if (!existeEnElCalendario(Number(m[1]), Number(m[2]), Number(m[3]))) return no('inexistente')
  // `YYYY-MM-DD` ordena igual como texto que como fecha: por eso no hace falta
  // construir nada para comparar, ni enumerar el rango.
  if (s < FECHA_MINIMA_AGENDA) return no('antes-del-suelo')
  if (s > FECHA_MAXIMA_AGENDA) return no('despues-del-techo')
  return { ok: true, fecha: s }
}

/** Atajo para quien sólo necesita el sí/no. */
export function esFechaDeAgendaValida(fecha: unknown): boolean {
  return validarFechaDeAgenda(fecha).ok
}

const FORMA_FECHA_HORA = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/

/**
 * Lo mismo para `'YYYY-MM-DD HH:MM'`, que es como viaja `fechaHora`.
 *
 * `/api/appointments` —la vía del médico y de la asistente— no comprobaba NADA:
 * rebanaba `fechaHora.slice(0, 10)` y seguía. Una cadena vacía, un `'mañana'` o
 * un `'2027-02-30 09:00'` llegaban enteros a Firestore.
 */
export function validarFechaHoraDeAgenda(fechaHora: unknown): ResultadoFechaHoraAgenda {
  const s = typeof fechaHora === 'string' ? fechaHora.trim() : ''
  const m = FORMA_FECHA_HORA.exec(s)
  if (!m) return no('forma')
  const h = Number(m[2]), min = Number(m[3])
  if (h > 23 || min > 59) return no('forma')
  const dia = validarFechaDeAgenda(m[1])
  if (!dia.ok) return dia
  // Se devuelve la cadena YA NORMALIZADA (sin espacios de sobra) para que quien
  // llama guarde lo validado y no lo que llegó del navegador.
  return { ok: true, fecha: dia.fecha, fechaHora: s }
}

/**
 * LA VENTANA DEL PORTAL PÚBLICO — CUÁNTO PUEDE ADELANTARSE UN DESCONOCIDO.
 *
 * El horizonte de arriba es el de la PLATAFORMA. Éste es otro asunto: hasta
 * dónde llega quien reserva desde la calle, sin haber pisado el consultorio.
 * Un año es lo que ya aplicaba el GET de disponibilidad; lo que no había era
 * coherencia.
 *
 * ── EL AGUJERO QUE CIERRA ────────────────────────────────────────────────────
 *
 * La regla vivía suelta dentro del GET, y el POST de reserva **no la tenía**.
 * O sea: la disponibilidad pública se negaba a OFRECER un hueco a tres años, y
 * el endpoint de reserva lo ACEPTABA igual con una petición directa. Es la misma
 * lección que ese archivo ya tiene escrita dos veces —para los descansos y para
 * los bloqueos—: «no ofrecer» y «no aceptar» son dos cosas distintas.
 *
 * Y el GET además contestaba `200 { ok: true, slots: [] }` con un `motivo` que
 * decía «Fuera de rango»: para el navegador eso es indistinguible de un día
 * lleno o cerrado. La fecha no estaba llena; estaba fuera de lo que se puede
 * pedir.
 *
 * ── SE COMPARA CONTRA EL DÍA DEL CONSULTORIO ─────────────────────────────────
 *
 * `hoy` es el de la zona horaria de la clínica, no la del servidor. En Vercel
 * el proceso corre en UTC, así que a partir de las 18:00 en México el servidor
 * ya está en el día siguiente y la ventana se corría un día. Es el mismo fallo
 * que el POST de reserva ya documenta para `instanteMX`.
 */
export const DIAS_VENTANA_RESERVA_PUBLICA = 365

/** Suma días a una fecha `YYYY-MM-DD` sin tocar husos: aritmética de calendario pura. */
function sumarDias(fechaISO: string, dias: number): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d + dias))
  return t.toISOString().slice(0, 10)
}

export type VentanaPublica =
  | { ok: true }
  | { ok: false; motivo: 'pasado' | 'fuera-de-ventana'; mensaje: string }

/**
 * ¿Cabe esta fecha en lo que el portal público puede pedir?
 *
 * `hoyEnLaClinica` se pasa desde fuera —ya calculado con `hoyISO(tz)`— porque
 * este módulo es PURO: no lee reloj ni configuración. Así la misma función
 * sirve al GET, al POST y a la prueba, que necesita fijar el día.
 */
export function dentroDeLaVentanaPublica(fecha: string, hoyEnLaClinica: string): VentanaPublica {
  if (fecha < hoyEnLaClinica) {
    return { ok: false, motivo: 'pasado', mensaje: 'Esa fecha ya pasó.' }
  }
  const tope = sumarDias(hoyEnLaClinica, DIAS_VENTANA_RESERVA_PUBLICA)
  if (fecha > tope) {
    return {
      ok: false,
      motivo: 'fuera-de-ventana',
      mensaje: `Las citas en línea se abren con hasta un año de anticipación (hasta el ${tope}).`,
    }
  }
  return { ok: true }
}
