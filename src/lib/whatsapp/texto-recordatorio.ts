/**
 * EL TEXTO DE LOS RECORDATORIOS — puro, para que se pueda leer entero en una
 * prueba antes de que salga a un teléfono.
 *
 * Nació en `api/cron/reminders/route.ts` como dos plantillas en línea y salió
 * de ahí por tres hallazgos del Panel de Lujo:
 *
 *  · ASM-017: terminaba «Consultorio: undefined» cuando el consultorio no tenía
 *    teléfono cargado. Ahora la línea del teléfono se OMITE entera si no hay.
 *  · ASM-006: decía «Responde SÍ» sin plazo, y el plazo real eran 2 h (la
 *    caducidad de la sesión del bot). Ahora el bot espera hasta la hora de la
 *    cita y el mensaje lo dice.
 *  · PG-018: llevaba el nombre del médico y «📍 nombre del consultorio»; si
 *    cualquiera de los dos contiene la especialidad, quien vea el teléfono la
 *    infiere. Existe un modo DISCRETO por consultorio (`recordatoriosDiscretos`)
 *    que quita nombre de médico, de consultorio y dirección: sólo la cita, la
 *    hora y el teléfono. NEEDS_LEGAL_REVIEW sobre si el nombre de la clínica es
 *    dato de salud por inferencia; mientras, es opción y no obligación.
 */

export interface DatosRecordatorio {
  paciente: string
  fecha: string
  hora: string
  medico: string
  clinica: string
  /** Línea «📍 nombre del consultorio\n» ya resuelta (vacía en videoconsulta). */
  clinicaLinea: string
  /** Dónde es la cita, ya resuelto por `lib/telesalud/donde-es.ts`. */
  donde: string
  /** Cierre («Te esperamos» / «Nos vemos en la sala»). */
  cierre: string
  direccion: string
  telefono: string
}

export interface OpcionesRecordatorio {
  /** Sin nombre de médico ni de consultorio ni dirección (PG-018). */
  discreto?: boolean
}

/** «Consultorio: 55…» o nada. Nunca «Consultorio: undefined» ni «Consultorio: ». */
export function lineaTelefono(telefono: string | undefined | null, prefijo = 'Consultorio: '): string {
  const t = String(telefono ?? '').trim()
  return t ? `${prefijo}${t}` : ''
}

/** Lo que el paciente puede contestar y hasta cuándo (ASM-006). */
export const INSTRUCCION_RESPUESTA =
  '¿Confirmas tu asistencia? Responde *SÍ* para confirmar, *NO* para cancelar o *CAMBIAR* si necesitas otra fecha. ' +
  'Puedes contestar hasta la hora de tu cita.'

function limpiar(texto: string): string {
  return texto.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim()
}

export function textoRecordatorio24h(d: DatosRecordatorio, o: OpcionesRecordatorio = {}): string {
  const tel = lineaTelefono(d.telefono)
  if (o.discreto) {
    return limpiar([
      `Hola ${d.paciente} 👋`,
      ``,
      `Te recordamos que tienes una cita *mañana*.`,
      ``,
      `📅 ${d.fecha}`,
      `🕐 ${d.hora}`,
      ``,
      INSTRUCCION_RESPUESTA,
      ``,
      tel,
    ].join('\n'))
  }
  return limpiar([
    `Hola ${d.paciente} 👋`,
    ``,
    `Te recordamos que tienes una cita *mañana* con ${d.medico}.`,
    ``,
    `📅 ${d.fecha}`,
    `🕐 ${d.hora}`,
    `${d.clinicaLinea}${d.donde}`,
    ``,
    INSTRUCCION_RESPUESTA,
    ``,
    tel,
  ].join('\n'))
}

export function textoRecordatorioMismoDia(d: DatosRecordatorio, o: OpcionesRecordatorio = {}): string {
  const tel = lineaTelefono(d.telefono, 'Cualquier duda: ')
  if (o.discreto) {
    return limpiar([
      `Buenos días ${d.paciente} ☀️`,
      ``,
      `Hoy tienes tu cita a las 🕐 ${d.hora}.`,
      ``,
      [d.cierre, tel].filter(Boolean).join(' '),
    ].join('\n'))
  }
  return limpiar([
    `Buenos días ${d.paciente} ☀️`,
    ``,
    `Hoy tienes tu cita con ${d.medico}:`,
    ``,
    `🕐 ${d.hora}`,
    `${d.clinicaLinea}${d.donde}`,
    ``,
    [d.cierre, tel].filter(Boolean).join(' '),
  ].join('\n'))
}

/** La solicitud de reseña, también por la puerta proactiva (ASM-008). */
export function textoSolicitudResena(nombre: string, medico: string, link: string): string {
  const n = String(nombre ?? '').trim().split(' ')[0]
  return `Hola ${n || 'de nuevo'} 🙏 ¿Nos ayudas con una reseña de tu consulta con ${medico || 'el médico'}? Solo toma 30 segundos:\n${link}`
}
