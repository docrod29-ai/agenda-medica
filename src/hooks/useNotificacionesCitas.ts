'use client'
/**
 * Programa notificaciones locales para las próximas citas mientras la app esté abierta.
 *
 * Aviso 30 min antes (todas las citas) y aviso 5 min antes (solo teleconsulta para
 * recordar entrar a la sala). Los timeouts se cancelan si la cita cambia o se cancela.
 */
import { useEffect, useRef } from 'react'
import { useAppointments } from './useAppointments'
import { programarNotificacion, obtenerPermisoPush } from '@/lib/push-notifications'

export function useNotificacionesCitas() {
  const { appointments } = useAppointments()
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    // Solo si el usuario ya otorgó permiso
    if (!obtenerPermisoPush().granted) return

    // Limpiar timeouts viejos
    timeoutsRef.current.forEach(t => clearTimeout(t))
    timeoutsRef.current = []

    const ahora = Date.now()
    const hoy = new Date().toISOString().slice(0, 10)
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Solo programamos para hoy y mañana (más allá es demasiado lejos)
    const citasProximas = appointments.filter(a => {
      const fecha = a.fechaHora.slice(0, 10)
      if (fecha !== hoy && fecha !== manana) return false
      if (['cancelada', 'reagendada', 'no-asistio', 'finalizada'].includes(a.estado)) return false
      const fechaHoraMs = new Date(a.fechaHora.replace(' ', 'T')).getTime()
      return fechaHoraMs > ahora
    })

    for (const cita of citasProximas) {
      const fechaHoraMs = new Date(cita.fechaHora.replace(' ', 'T')).getTime()

      // Aviso 30 minutos antes
      const cuando30 = new Date(fechaHoraMs - 30 * 60 * 1000)
      const t30 = programarNotificacion(cuando30, `Cita en 30 min — ${cita.pacienteNombre}`, {
        body: `${cita.fechaHora.slice(11, 16)} · ${cita.motivo || 'Consulta'}`,
        tag: `cita-30-${cita.id}`,
        url: '/citas',
      })
      if (t30) timeoutsRef.current.push(t30)

      // Para teleconsulta: aviso adicional 5 minutos antes
      if (cita.tipo === 'teleconsulta') {
        const cuando5 = new Date(fechaHoraMs - 5 * 60 * 1000)
        const t5 = programarNotificacion(cuando5, `🎥 Teleconsulta en 5 min`, {
          body: `${cita.pacienteNombre} · prepara tu cámara`,
          tag: `tele-5-${cita.id}`,
          url: `/teleconsulta/${cita.id}`,
          requireInteraction: true,
        })
        if (t5) timeoutsRef.current.push(t5)
      }
    }

    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t))
      timeoutsRef.current = []
    }
  }, [appointments])
}
