import type { Patient } from '@/types'

/**
 * Núcleo puro para reactivación de pacientes (Lote 11): identifica pacientes que
 * no han vuelto y arma el mensaje de WhatsApp. Sin efectos secundarios; la fecha
 * "hoy" se inyecta para poder testear.
 */

/** Solo la parte YYYY-MM-DD de un ISO/fecha. */
function soloDia(iso?: string): string | null {
  if (!iso) return null
  const m = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : null
}

/** Días transcurridos entre dos fechas YYYY-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export interface CandidatoReactivacion {
  paciente: Patient
  /** Días desde la última cita (o desde que se dio de alta si nunca ha vuelto). */
  dias: number
  /** true si tiene ultimaCita; false si nunca ha tenido cita registrada. */
  tuvoCita: boolean
}

/**
 * Pacientes a reactivar: última cita más antigua que `umbralDias`, o dados de
 * alta hace más de `umbralDias` sin ninguna cita. Ordenados por más tiempo sin
 * volver. Excluye a quien no tenga teléfono (no se puede contactar).
 */
export function pacientesParaReactivar(pacientes: Patient[], hoy: string, umbralDias = 90): CandidatoReactivacion[] {
  const out: CandidatoReactivacion[] = []
  for (const p of pacientes) {
    if (!(p.telefono || p.whatsapp)) continue
    const ult = soloDia(p.ultimaCita)
    if (ult) {
      const dias = diasEntre(ult, hoy)
      if (dias >= umbralDias) out.push({ paciente: p, dias, tuvoCita: true })
    } else {
      const alta = soloDia(p.createdAt)
      if (alta) {
        const dias = diasEntre(alta, hoy)
        if (dias >= umbralDias) out.push({ paciente: p, dias, tuvoCita: false })
      }
    }
  }
  return out.sort((a, b) => b.dias - a.dias)
}

/** Primer nombre, para un saludo cálido. */
function primerNombre(nombre: string): string {
  return (nombre || '').trim().split(/\s+/)[0] || ''
}

/** Mensaje de reactivación (el médico lo revisa antes de enviar; no se auto-envía). */
export function msgReactivacion(nombrePaciente: string, nombreMedico?: string): string {
  const hola = primerNombre(nombrePaciente)
  const firma = nombreMedico ? `\n\n— ${nombreMedico}` : ''
  return [
    `Hola ${hola} 👋`,
    ``,
    `Le escribimos del consultorio${nombreMedico ? ` de ${nombreMedico}` : ''}. Notamos que ha pasado un tiempo desde su última visita y queremos saber cómo sigue.`,
    ``,
    `Si desea agendar una cita de control o seguimiento, con gusto le apartamos un espacio. Solo responda a este mensaje.${firma}`,
  ].join('\n')
}

/** Mensaje de seguimiento posconsulta (check-in cálido tras una visita reciente). */
export function msgSeguimiento(nombrePaciente: string, nombreMedico?: string): string {
  const hola = primerNombre(nombrePaciente)
  const firma = nombreMedico ? `\n\n— ${nombreMedico}` : ''
  return [
    `Hola ${hola} 👋`,
    ``,
    `Le escribimos para saber cómo ha seguido tras su consulta. ¿Ha notado mejoría? ¿Alguna duda con su tratamiento?`,
    ``,
    `Estamos al pendiente; responda por aquí si necesita algo.${firma}`,
  ].join('\n')
}

/** Mensaje para que un paciente refiera al consultorio (comparte el enlace de reserva). */
export function msgReferido(nombreMedico: string | undefined, urlReserva: string): string {
  return [
    `Te recomiendo al consultorio${nombreMedico ? ` de ${nombreMedico}` : ''} 🩺`,
    ``,
    `Puedes agendar tu cita en línea aquí:`,
    urlReserva,
  ].join('\n')
}
