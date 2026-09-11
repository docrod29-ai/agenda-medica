import type { Appointment } from '@/types'

type CitaDeHoy = Pick<Appointment, 'id' | 'fechaHora' | 'estado' | 'pacienteId'>

/** La cita que encabeza Hoy; recibe el reloj del consultorio, nunca el del dispositivo. */
export function citaEnFoco<T extends CitaDeHoy>(citas: readonly T[], dia: string, ahoraMinutos: number | null): T | null {
  if (ahoraMinutos === null) return null
  const hora = `${String(Math.floor(ahoraMinutos / 60)).padStart(2, '0')}:${String(ahoraMinutos % 60).padStart(2, '0')}`
  const abiertas = citas.filter(c => c.fechaHora.startsWith(`${dia} `)
    && ['solicitada', 'pendiente-datos', 'pendiente-confirmar', 'confirmada', 'recordatorio-enviado', 'en-sala', 'en-consulta'].includes(c.estado))
    .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  return abiertas.find(c => c.estado === 'en-consulta')
    ?? abiertas.find(c => c.estado === 'en-sala')
    ?? abiertas.find(c => c.fechaHora >= `${dia} ${hora}`)
    ?? null
}

/** Destino de presentación; los permisos efectivos siguen en servidor y reglas. */
export function accionDeCitaEnFoco(cita: CitaDeHoy, puedeConsultar: boolean): { href: string; texto: string; consulta: boolean } {
  if (!puedeConsultar || !cita.pacienteId) {
    return { href: `/citas?id=${encodeURIComponent(cita.id)}`, texto: 'Ver cita', consulta: false }
  }
  return {
    href: `/consulta/${encodeURIComponent(cita.pacienteId)}`,
    texto: cita.estado === 'en-consulta' ? 'Retomar consulta' : 'Iniciar consulta',
    consulta: true,
  }
}
