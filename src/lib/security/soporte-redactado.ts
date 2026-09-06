/**
 * LO QUE SE GUARDA DEL MENSAJE DE SOPORTE (Panel de Lujo S-003).
 *
 * `soporte` es una colección de PLATAFORMA: se lee desde fuera del consultorio.
 * El médico escribe aquí en prosa, y en la prosa caben el nombre, el teléfono y
 * el motivo de consulta del paciente por el que pregunta. `/api/errores` ya
 * pasaba todo por `redactarString` con ese mismo razonamiento; la ruta de
 * soporte no. La redacción quita el identificador, no el síntoma: la falla se
 * sigue pudiendo describir. Y el `clinicId` sale de la MEMBRESÍA, no del
 * cuerpo: el del cuerpo no concedía acceso a nada, pero etiquetaba mal el ticket.
 *
 * Módulo PURO para que la prueba compruebe lo que se escribe sin Firestore.
 */
import { redactarString } from './sanitize'

export const TIPOS_DE_SOPORTE = ['queja', 'falla', 'felicitacion', 'duda', 'sugerencia'] as const

export function documentoDeSoporte(entrada: {
  uid: string
  clinicId: string
  tipo: string
  mensaje: string
  email?: string
  nombre?: string
  ahoraIso: string
}): Record<string, unknown> {
  return {
    uid: entrada.uid,
    email: redactarString(String(entrada.email ?? '').slice(0, 160)),
    nombre: redactarString(String(entrada.nombre ?? '').slice(0, 160)),
    clinicId: entrada.clinicId,
    tipo: (TIPOS_DE_SOPORTE as readonly string[]).includes(entrada.tipo) ? entrada.tipo : 'duda',
    mensaje: redactarString(String(entrada.mensaje ?? '').trim().slice(0, 3000)),
    estado: 'nuevo',
    fecha: entrada.ahoraIso,
  }
}

/** Texto que el formulario enseña encima del cuadro. Vive aquí para que la prueba lo fije. */
export const AVISO_SIN_DATOS_DEL_PACIENTE =
  'Este mensaje lo lee el equipo de Ausculta, fuera de tu consultorio. Describe la falla sin nombre, teléfono ni datos del paciente: lo que parezca un dato personal se tacha antes de guardarse.'
