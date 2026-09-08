import { Appointment, ClinicConfig } from '@/types'
import type { TimeBlock } from '@/lib/time-blocks-core'
// Del NÚCLEO PURO, no de time-blocks: esta cadena la importa /api/portal (servidor)
// y time-blocks arrastra el SDK del navegador, que se inicializa al importarse.
import { pisaBloqueo } from '@/lib/time-blocks-core'
import { hoyISO, ahoraMinutosDelDia } from '@/lib/timezone'
import { format } from 'date-fns'

const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

/**
 * TOPE DE HUECOS POR DÍA — REESCRITO, PORQUE EL ANTERIOR BORRABA LA TARDE.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * El tope era 24, fijo, «equivale a 12 horas con citas de 30 min». Pero cuenta
 * HUECOS OFRECIDOS y corta en orden cronológico, así que a una agenda legítima
 * le desaparecía el final del día:
 *
 *   Un dentista o un oftalmólogo con seguimientos de 15 minutos, de 09:00 a
 *   19:00, tiene 40 huecos. La agenda ofrecía hasta las ~15:00 y el resto del
 *   día salía como «sin lugares» — en el panel Y en el portal público. El único
 *   aviso era un `console.warn` que ve el servidor y nadie más.
 *
 * ── LO QUE CAMBIA ────────────────────────────────────────────────────────────
 *
 * El tope deja de ser un número clínico inventado aquí y pasa a derivarse de lo
 * que el propio consultorio configuró: su horario y su intervalo. Si el médico
 * declara que atiende de 09:00 a 19:00 cada 15 minutos, ésa ES su agenda, y el
 * software no tiene autoridad para decidir que son demasiadas citas.
 *
 * Lo que queda es un FRENO ANTI-DESBOCADO. Es defensa en profundidad, no la
 * defensa principal: el límite real lo ponen dos reglas que ya existían más
 * arriba —jornada máxima de 14 h e intervalo mínimo de 5 min—, y de ahí sale un
 * techo matemático de 168 huecos en el día más largo posible. Con 200, este
 * freno NO se dispara con ninguna configuración que las otras dos dejen pasar;
 * está por si alguna de ellas se relaja algún día. Se declara así para que nadie
 * lo lea como «el tope son 200».
 *
 * Cuántas citas caben en un día SÍ es criterio del dueño; si algún día quiere un
 * límite propio, se configura y se declara. Lo que no puede seguir pasando es
 * que se recorte en silencio.
 */
const TECHO_ANTIDESBOCADO = 200

/**
 * Los descansos del día, en minutos desde medianoche.
 *
 * Se normalizan aquí y no dentro del bucle: convertir «14:00» a 840 en cada uno
 * de los 168 huecos posibles es trabajo repetido, y peor, es donde se cuelan las
 * inconsistencias si alguien cambia el formato en un sitio y no en el otro.
 *
 * Un descanso mal formado se IGNORA en vez de romper el día: una hora de comida
 * escrita mal no puede dejar al médico sin agenda.
 */
export function descansosEnMinutos(descansos?: { inicio: string; fin: string }[]): { desde: number; hasta: number }[] {
  const aMin = (hhmm: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim())
    if (!m) return null
    const h = Number(m[1]), mm = Number(m[2])
    if (h > 23 || mm > 59) return null
    return h * 60 + mm
  }
  return (descansos ?? [])
    .map(d => ({ desde: aMin(d.inicio), hasta: aMin(d.fin) }))
    .filter((d): d is { desde: number; hasta: number } => d.desde != null && d.hasta != null && d.hasta > d.desde)
}

/** ¿Este hueco pisa un descanso? Basta con que se solapen, no hace falta contenerlo. */
export function pisaDescanso(inicio: number, fin: number, descansos: readonly { desde: number; hasta: number }[]): boolean {
  return descansos.some(d => inicio < d.hasta && fin > d.desde)
}

/**
 * ¿ESTE DÍA ES FESTIVO PARA EL CONSULTORIO?
 *
 * Acepta dos formas: `YYYY-MM-DD` (un día concreto: el puente de este año) y
 * `MM-DD` (RECURRENTE: el 25 de diciembre, todos los años).
 *
 * La lista era sólo de fechas exactas. Cargar «2026-12-25» funciona en 2026 y
 * deja de aplicar el 25 de diciembre de 2027 sin que nadie se entere — el
 * consultorio aparece abierto en Navidad y el portal agenda. Una fecha que
 * caduca en silencio es peor que no tenerla.
 */
export function esFestivo(fecha: string, festivos?: readonly string[]): boolean {
  if (!festivos?.length || !fecha) return false
  const mmdd = fecha.slice(5, 10)
  return festivos.some(f => {
    const t = String(f ?? '').trim()
    return t === fecha || (t.length === 5 && t === mmdd)
  })
}

/** Duración mínima razonable de una cita (anti config=0 que rompía el loop). */
const DURACION_MIN_SEGURA = 5

/** Hora máxima razonable para "fin" (00:00-23:59). 24:00 está mal formado. */
const HORA_MAX_MIN = 23 * 60 + 59  // 1439

/** Resultado de validar un horario diario — semánticamente claro para callers. */
export interface ValidacionHorario {
  valido: boolean
  motivo?: string
  startMin: number
  endMin: number
}

/**
 * Valida un horario { inicio: "HH:MM", fin: "HH:MM" }.
 * Reglas:
 *   - inicio y fin deben tener formato HH:MM válido
 *   - fin > inicio estrictamente (no se permite jornada 0)
 *   - duración total ≤ 14 horas (anti config 8:00-24:00 por accidente)
 *   - endMin se clampea a 23:59 si excede (24:00 → 23:59)
 *
 * Diseño: tolerante en lectura (clamp), estricto en validación (rechaza
 * el día con motivo claro). Esto cubre AMBOS escenarios:
 *  a) Datos ya corruptos en BD: el slot calc usa los valores clampados
 *     y nunca genera > MAX_SLOTS_POR_DIA → no aparecen 32 lugares.
 *  b) Datos nuevos al guardar: el caller debe rechazar el save.
 */
export function validarHorarioDia(inicio: string, fin: string): ValidacionHorario {
  const reHora = /^\d{1,2}:\d{2}$/
  if (!reHora.test(inicio) || !reHora.test(fin)) {
    return { valido: false, motivo: 'Formato de hora inválido', startMin: 0, endMin: 0 }
  }
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fin.split(':').map(Number)
  if ([hI, mI, hF, mF].some(n => Number.isNaN(n))) {
    return { valido: false, motivo: 'Hora no numérica', startMin: 0, endMin: 0 }
  }
  let startMin = hI * 60 + mI
  let endMin = hF * 60 + mF
  // Clamp: 24:00 → 23:59 (24:00 NO es válido en HH:MM)
  if (endMin > HORA_MAX_MIN) endMin = HORA_MAX_MIN
  if (startMin < 0) startMin = 0
  if (endMin <= startMin) {
    return { valido: false, motivo: 'La hora de fin debe ser mayor que la de inicio', startMin, endMin }
  }
  const horasTotal = (endMin - startMin) / 60
  if (horasTotal > 14) {
    return { valido: false, motivo: `Jornada de ${horasTotal.toFixed(1)}h parece un error (máximo razonable 14h)`, startMin, endMin }
  }
  return { valido: true, startMin, endMin }
}

/**
 * UNA PARED: cualquier cosa contra la que una cita no puede empezar ni terminar.
 * El cierre del día, una cita ya puesta, un descanso. Minutos desde medianoche,
 * `[desde, hasta)`, porque para la aritmética de huecos son lo mismo.
 */
export interface Pared { desde: number; hasta: number }

/**
 * LOS INSTANTES EN QUE PUEDE EMPEZAR UNA CONSULTA DE `duracion` MINUTOS.
 *
 * ── POR QUÉ ESTO ES UNA FUNCIÓN Y NO TRES BUCLES ───────────────────────────
 *
 * Esta aritmética vivía suelta en tres sitios: aquí, en
 * `GET /api/public/availability` y en el preview del horario de Configuración.
 * Mientras las tres copias dijeran lo mismo no se notaba. Dejaron de decirlo:
 * REG-654 enseñó a ÉSTA a recolocar la rejilla donde termina una cita, y las
 * otras dos se quedaron atrás — el portal ofrecía al paciente menos horas que
 * el panel al médico, y el preview prometía un número de espacios que no era
 * el que se iba a ver.
 *
 * Es el mismo patrón que ya costó cinco implementaciones del cálculo de huecos.
 * Ahora la aritmética vive una vez y los tres la llaman.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────
 *
 * A la rejilla del reloj —que arranca en la apertura y avanza a `paso`— se le
 * suman las ARISTAS, en las dos direcciones:
 *
 *  · `pared.hasta` — donde algo TERMINA nace un hueco, y la siguiente consulta
 *    puede empezar en ese mismo minuto, sin separación artificial (REG-654);
 *  · `pared.desde - duracion` — el último arranque que cabe ENTERO antes de la
 *    siguiente pared, que es lo que permite terminar pegado al cierre
 *    (18:15-19:00 con jornada hasta las 19:00) y llenar un hueco por su final.
 *
 * Es ADITIVO —ningún inicio de los de antes desaparece— y ACOTADO: como mucho
 * dos anclas por pared, no una rejilla más fina.
 *
 * ── QUÉ NO DECIDE ──────────────────────────────────────────────────────────
 *
 * Si el hueco está LIBRE. Sólo dice qué horas vale la pena mirar; descartar
 * solapes, descansos, bloqueos y horas pasadas es del llamador, con los mismos
 * filtros aplicados por igual a la rejilla y a las anclas — así un ancla nunca
 * puede colar una hora que no cabe.
 *
 * Un inicio fuera de `[startMin, endMin - duracion]` se descarta; no se redondea
 * hacia dentro, que sería inventar una hora que nadie pidió.
 */
export function iniciosPosibles(
  startMin: number,
  endMin: number,
  duracion: number,
  paso: number,
  paredes: readonly Pared[] = [],
): number[] {
  // Un paso corrupto no puede colgar el bucle ni dejar el día en una sola hora.
  const pasoSeguro = Number.isFinite(paso) && paso >= 1 ? Math.floor(paso) : DURACION_MIN_SEGURA
  const inicios = new Set<number>()
  for (let m = startMin; m + duracion <= endMin; m += pasoSeguro) inicios.add(m)
  const anclar = (min: number) => {
    if (Number.isFinite(min) && min > startMin && min + duracion <= endMin) inicios.add(Math.round(min))
  }
  anclar(endMin - duracion)
  for (const p of paredes) {
    if (!Number.isFinite(p?.desde) || !Number.isFinite(p?.hasta)) continue
    anclar(p.hasta)
    anclar(p.desde - duracion)
  }
  return [...inicios].sort((a, b) => a - b)
}

export function getDaySchedule(fecha: string, config: ClinicConfig) {
  const d = new Date(fecha + 'T12:00:00')
  const dayKey = DAY_KEYS[d.getDay()]
  const schedule = config.horario[dayKey as keyof typeof config.horario]
  if (!schedule?.activo) return null
  if (esFestivo(fecha, config.diasFestivos)) return null
  return schedule
}

export function getAvailableSlots(
  fecha: string,
  duracionMin: number,
  appointments: Appointment[],
  config: ClinicConfig,
  excludeId?: string,
  bloques: TimeBlock[] = [],
  medicoId?: string,
): string[] {
  const schedule = getDaySchedule(fecha, config)
  if (!schedule) return []

  // ── HARD GUARDRAIL 1: duración debe ser razonable ───────────────
  // Si la duración es 0/NaN/negativa el for() loop nunca avanza o
  // genera infinitos. Default seguro: 30 min (mediana clínica).
  const duracionSegura = (Number.isFinite(duracionMin) && duracionMin >= DURACION_MIN_SEGURA)
    ? duracionMin
    : 30

  /**
   * EL PASO ES LA DURACIÓN DE LA CITA. Punto.
   *
   * Antes era `max(intervaloMinutos, duración)`, con `intervaloMinutos` elegido
   * en Configuración. Ese máximo venía del defecto histórico —intervalo 10 con
   * citas de 30 daba huecos cada 10 minutos, o sea tres pacientes citados sobre
   * la misma media hora— y lo arreglaba, pero dejaba una perilla que en la
   * práctica no podía ganar nunca: cualquier duración clínica normal (20, 30,
   * 40 min) es mayor que cualquier intervalo ofrecido (5…30). El médico leía
   * «cada 5 minutos» en su pantalla y la agenda iba de 30 en 30.
   *
   * Retirada la perilla (petición del dueño, 7-sep-2026), el paso lo decide la
   * duración del tipo de cita, que es lo que el médico piensa de verdad. El
   * defecto histórico sigue cerrado por construcción: el paso ES la duración,
   * así que dos huecos consecutivos nunca se solapan.
   *
   * `intervaloMinutos` se conserva en el tipo y en los respaldos —hay
   * documentos vivos que lo traen— pero ya no gobierna nada.
   */
  const interval = duracionSegura

  // ── HARD GUARDRAIL 2: validar el horario ────────────────────────
  // Si el horario está corrupto (fin ≤ inicio, jornada > 14h), NO
  // generamos slots. Mejor que mostrar 32 lugares fantasma.
  const validacion = validarHorarioDia(schedule.inicio, schedule.fin)
  if (!validacion.valido) {
    // Diagnóstico en consola sin exponer detalle de paciente
    if (typeof console !== 'undefined') {
      console.warn(`[availability] Horario inválido para ${fecha}: ${validacion.motivo}`)
    }
    return []
  }
  const { startMin, endMin } = validacion

  // Si la fecha es HOY, no ofrecer horas que ya pasaron (en la zona de la clínica).
  const tz = config.zonaHoraria || 'America/Mexico_City'
  const minMinutoHoy = fecha === hoyISO(tz) ? ahoraMinutosDelDia(tz) : -1

  const dayAppts = appointments.filter(a =>
    a.fechaHora.slice(0, 10) === fecha &&
    a.id !== excludeId &&
    !['cancelada', 'reagendada', 'no-asistio'].includes(a.estado) &&
    // MULTI-MÉDICO: si se pide la agenda de un médico, solo cuentan SUS citas.
    // Sin esto, el slot de la Dra. A se marcaba ocupado por una cita del Dr. B
    // (agendas cruzadas). Si la cita no tiene medicoId (legacy), cuenta siempre.
    (!medicoId || !a.medicoId || a.medicoId === medicoId)
  )

  const slots: string[] = []
  let truncado = false
  // HORARIO PARTIDO: la hora de comida deja de ofrecerse a los pacientes sin que
  // el médico tenga que crear un bloqueo a mano para cada día del año.
  const descansos = descansosEnMinutos(schedule.descansos)

  /**
   * LA REJILLA SE RE-ANCLA DONDE ACABA LO QUE YA HAY.
   *
   * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
   *
   * Los inicios posibles salían de UN SOLO sitio: la hora de apertura, a saltos
   * fijos. Nada volvía a anclar la rejilla, así que en cuanto una cita de
   * duración distinta rompía el ritmo, el hueco que dejaba **no existía** para
   * el producto.
   *
   * El caso que lo destapó, contado por una dermatóloga: 45 min, luego 15, luego
   * 30. Con jornada 09:00-14:00, la de 45 acaba a las 09:45 y la siguiente cabe
   * entera antes de las 10:00 — y ese cuarto de hora no se ofrecía NINGÚN día.
   * Tampoco había forma de pedirlo: el campo de hora manual sólo aparecía
   * cuando no quedaba ni un hueco.
   *
   * ── QUÉ QUEDA DE ESO DESPUÉS DE REG-653 ────────────────────────────────────
   *
   * REG-653 aterrizó primero y cambió el paso —de `Math.max(intervaloMinutos,
   * duración)` a la duración a secas—, así que el ejemplo de arriba con la cita
   * de 15 min ya lo cubre la rejilla base. **El defecto NO se cerró con eso**:
   * el paso se sigue contando DESDE LA APERTURA, y un hueco que no cae en
   * múltiplo de la duración desde la hora de abrir sigue sin existir.
   *
   * El caso vivo hoy es la tercera cita de la dermatóloga:
   *
   *     tras la de 45 (09:00-09:45), una de 30
   *     rejilla base       09:00  09:30  10:00  ...   ← las 09:45 no están
   *
   * Las dos reparaciones se componen: REG-653 hace que el paso diga la verdad,
   * ésta hace que la rejilla se recoloque cuando las duraciones se mezclan.
   *
   * ── LA REGLA ───────────────────────────────────────────────────────────────
   *
   * Una hora libre de verdad se ofrece. A los inicios del reloj se les suman los
   * instantes donde TERMINA algo: cada cita del día y cada descanso. Es aditivo
   * —ningún hueco de los de antes desaparece— y acotado: como mucho un ancla por
   * cita, no una rejilla más fina. Los filtros de abajo (pasado, descanso,
   * bloqueo, empalme) se aplican igual a las anclas que a la rejilla, así que un
   * ancla no puede colar una hora que no cabe.
   *
   * El paso de la rejilla base NO se toca: lo fija REG-653 y es la duración del
   * tipo de cita, en el panel y en el portal público.
   *
   * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
   *
   * El final de un BLOQUEO (vacaciones, ausencia) no ancla. `TimeBlock` guarda
   * instantes ISO que pueden venir en absoluto o en hora de pared, y pasarlos a
   * minutos del día pide la zona del consultorio; se dejó fuera a propósito en
   * vez de hacerlo a medias. Un bloqueo que acaba a las 11:20 sigue sin ofrecer
   * las 11:20 — se pide a mano, que desde ahora siempre se puede.
   *
   * Tampoco cambia nada para el paciente en el portal público ni para el bot:
   * les llega más oferta, que es lo mismo que ve el médico. Un hueco que existe
   * no se esconde según quién pregunte.
   */
  const minutosDeCita = (a: Appointment): number => {
    const [h, m] = a.fechaHora.slice(11, 16).split(':').map(Number)
    return h * 60 + m
  }
  /**
   * La aritmética vive en `iniciosPosibles` y la comparten el portal público y
   * el preview del horario. Aquí sólo se dice CUÁLES son las paredes de este
   * día: las citas vivas del médico y los descansos del horario partido.
   *
   * Los BLOQUEOS no entran como pared, igual que en REG-654: `TimeBlock` guarda
   * instantes que pueden venir en absoluto o en hora de pared, y pasarlos a
   * minutos del día pide la zona del consultorio. Se deja fuera a propósito en
   * vez de hacerlo a medias; el filtro de abajo los sigue descartando, y esa
   * hora se pide a mano, que siempre se puede.
   */
  const paredes: Pared[] = [
    ...dayAppts.map(a => ({ desde: minutosDeCita(a), hasta: minutosDeCita(a) + a.duracion })),
    ...descansos,
  ]

  for (const m of iniciosPosibles(startMin, endMin, duracionSegura, interval, paredes)) {
    // ── FRENO ANTI-DESBOCADO ────────────────────────────────────
    // Ninguna agenda real llega aquí: son 200 huecos en un día. Si se alcanza,
    // la configuración está corrupta, y se DECLARA en la salida en vez de
    // recortar en silencio como antes.
    if (slots.length >= TECHO_ANTIDESBOCADO) {
      truncado = true
      console.warn(`[availability] freno anti-desbocado (${TECHO_ANTIDESBOCADO}) en ${fecha} — revisar horario e intervalo`)
      break
    }
    // 0. ¿Ya pasó esta hora hoy? No ofrecer horas del pasado.
    if (m < minMinutoHoy) continue

    const slotEnd = m + duracionSegura
    // 0b. ¿Cae en la comida o en otro descanso del día?
    if (pisaDescanso(m, slotEnd, descansos)) continue
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    const slot = `${hh}:${mm}`

    // 1. ¿Cae en un bloque de tiempo (vacaciones, ausencia, etc.)?
    if (bloques.length > 0) {
      // Con la DURACIÓN: un hueco de 30 min a las 10:00 que termina dentro de un
      // bloqueo de 10:15 no es un hueco libre.
      const bloqueado = pisaBloqueo(`${fecha} ${slot}`, duracionSegura, bloques, medicoId, tz)
      if (bloqueado) continue
    }

    // 2. ¿Se solapa con una cita existente?
    const hasConflict = dayAppts.some(a => {
      const [ch, cm] = a.fechaHora.slice(11, 16).split(':').map(Number)
      const aStart = ch * 60 + cm
      const aEnd = aStart + a.duracion
      return m < aEnd && slotEnd > aStart
    })
    if (!hasConflict) slots.push(slot)
  }
  ultimoDiagnostico = { fecha, truncado, techo: TECHO_ANTIDESBOCADO }
  return slots
}

/**
 * Diagnóstico de la ÚLTIMA llamada a `getAvailableSlots`.
 *
 * Se expone así, y no cambiando el tipo de retorno, porque `getAvailableSlots`
 * tiene siete llamadores y devolver un objeto obligaría a tocarlos todos para
 * un dato que casi ninguno necesita. Quien quiera saber si la lista se recortó
 * lo pregunta justo después de llamar.
 */
let ultimoDiagnostico: { fecha: string; truncado: boolean; techo: number } | null = null

export function diagnosticoDeHuecos(): { fecha: string; truncado: boolean; techo: number } | null {
  return ultimoDiagnostico
}

/**
 * POR QUÉ ESA HORA NO CABE — para poder DECIRLO, en vez de borrarla.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El modal borraba la hora elegida en cuanto dejaba de estar en la lista de
 * huecos (subir la duración después de elegir la hora es el camino corto). El
 * campo se quedaba en blanco sin una palabra, y al médico le parecía que la
 * pantalla se había «reseteado sola». Eso choca con la regla 3 de seguridad
 * clínica dicha en lenguaje de interfaz: nada cambia en silencio.
 *
 * Pero no basta con dejar la hora quieta: `hasConflict` devuelve `true` tanto
 * por un empalme como por salirse del horario, y el aviso decía siempre «ese
 * horario ya está ocupado». Con una cita de 45 min a las 13:30 en una jornada
 * que cierra a las 14:00, ese mensaje es sencillamente falso, y encima el
 * servidor responde 409 sin salida autorizada: el sobreagendamiento cubre el
 * empalme, no el cierre.
 *
 * Esto separa las dos causas para que la pantalla diga la de verdad y proponga
 * lo que sí arregla el caso (bajar la duración o mover la hora).
 *
 * Devuelve `null` cuando la cita SÍ cabe en el horario del día. Que quepa no
 * significa que esté libre: el empalme lo sigue mirando `hasConflict`.
 */
export type PorQueNoCabe =
  | { razon: 'dia-cerrado' }
  | { razon: 'horario-invalido'; detalle: string }
  | { razon: 'fuera-del-horario'; abre: string; cierra: string }
  | null

export function porQueNoCabeEnElHorario(
  fecha: string,
  hora: string,
  duracionMin: number,
  config: ClinicConfig,
): PorQueNoCabe {
  if (!fecha || !hora) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim())
  if (!m) return null                        // hora a medio teclear: aún no se juzga
  const schedule = getDaySchedule(fecha, config)
  if (!schedule) return { razon: 'dia-cerrado' }
  const vh = validarHorarioDia(schedule.inicio, schedule.fin)
  if (!vh.valido) return { razon: 'horario-invalido', detalle: vh.motivo ?? 'horario mal configurado' }
  const inicio = Number(m[1]) * 60 + Number(m[2])
  const dur = Number.isFinite(duracionMin) && duracionMin > 0 ? duracionMin : 30
  if (inicio < vh.startMin || inicio + dur > vh.endMin) {
    return { razon: 'fuera-del-horario', abre: schedule.inicio, cierra: schedule.fin }
  }
  return null
}

export function hasConflict(
  fecha: string,
  hora: string,
  duracionMin: number,
  appointments: Appointment[],
  excludeId?: string,
  bloques: TimeBlock[] = [],
  medicoId?: string,
  /** Config del consultorio. Sin ella NO se puede validar día ni horario. */
  config?: ClinicConfig,
): boolean {
  const [h, m] = hora.split(':').map(Number)
  const startMin = h * 60 + m
  const endMin = startMin + duracionMin

  /**
   * DÍA Y HORARIO, no solo solapes.
   *
   * Esto solo miraba si la cita chocaba con otra. Nadie validaba que el día
   * estuviera activo, que no fuera festivo, ni que la cita cupiera dentro del
   * horario — ni aquí, ni en POST /api/appointments. El único que sí lo hacía era
   * el booking público.
   *
   * Por ahí se colaban dos cosas del uso diario: agendar en domingo o en festivo
   * (cuando no hay huecos, el desplegable de horas se sustituye por un campo
   * libre, sin ninguna advertencia), y subir la duración después de elegir la
   * hora, que dejaba la cita terminando después del cierre.
   */
  if (config) {
    const schedule = getDaySchedule(fecha, config)
    if (!schedule) return true                      // día inactivo o festivo
    const vh = validarHorarioDia(schedule.inicio, schedule.fin)
    if (!vh.valido || startMin < vh.startMin || endMin > vh.endMin) return true
    /**
     * EL HORARIO PARTIDO TAMBIÉN SE COMPRUEBA AQUÍ — y era lo que faltaba.
     *
     * Un médico que atiende 10-13 y 15-19 lo declara con un descanso de 13:00 a
     * 15:00. `getAvailableSlots` ya se salta las horas que lo pisan, y el
     * booking público ya lo rechaza… pero este guardián —el que usa el modal
     * del consultorio y el que respalda el alta desde el panel— sólo miraba
     * `inicio` y `fin`. Una cita de 12:45 a 13:15 cruza el hueco de comida
     * entero y pasaba: no se OFRECÍA, pero sí se ACEPTABA.
     *
     * Y el camino para llegar ahí no es raro: el campo de hora manual permite
     * pedir cualquier hora, que es justo lo que se abrió al arreglar la rejilla.
     *
     * Es la misma lección que este repositorio ya tiene escrita dos veces para
     * los bloqueos: «no ofrecer» y «no aceptar» son dos cosas distintas.
     */
    if (pisaDescanso(startMin, endMin, descansosEnMinutos(schedule.descansos))) return true
  }

  // Bloqueo (vacaciones/ausencia) del médico o de toda la clínica — en la zona de la clínica.
  if (bloques.length > 0 && pisaBloqueo(`${fecha} ${hora}`, endMin - startMin, bloques, medicoId, config?.zonaHoraria || 'America/Mexico_City')) return true

  return appointments.some(a => {
    if (a.id === excludeId) return false
    if (a.fechaHora.slice(0, 10) !== fecha) return false
    if (['cancelada', 'reagendada', 'no-asistio'].includes(a.estado)) return false
    // MULTI-MÉDICO: solo choca con citas del MISMO médico (o legacy sin medicoId).
    // Antes chocaba con las de TODOS → bloqueaba huecos válidos de otro doctor.
    if (medicoId && a.medicoId && a.medicoId !== medicoId) return false
    const [ah, am] = a.fechaHora.slice(11, 16).split(':').map(Number)
    const aStart = ah * 60 + am
    const aEnd = aStart + a.duracion
    return startMin < aEnd && endMin > aStart
  })
}

/**
 * Los 7 días de la semana de `date`, ANCLADOS A MEDIODÍA.
 *
 * Se construían a medianoche local del navegador y luego se formateaban con la
 * zona del consultorio (America/Mexico_City). En un navegador al ESTE de CDMX esa
 * medianoche cae en el día anterior visto desde México: en Cancún (UTC-5, todo el
 * año, y mercado real de turismo médico) `new Date(2026,6,15)` formateado en CDMX
 * da 2026-07-14. Toda la cuadrícula del calendario se corría un día, y el médico
 * veía la agenda de la fecha equivocada.
 *
 * A mediodía sobran 12 horas de margen: ninguna diferencia horaria realista
 * cambia el día.
 */
export function getWeekDates(date: Date): Date[] {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 12)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12),
  )
}

export function formatDateMX(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T12:00:00' : '')) : date
  return d.toLocaleDateString('es-MX', opts ?? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
