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
import { notificacionCitaSegura } from '@/lib/mobile/notif-privacidad'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'

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
    const hoy = hoyISO()  // zona MX
    const manana = sumarDiasISO(hoy, 1)

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

      // Aviso 30 minutos antes — SIN PHI en pantalla bloqueada (§8.6): ni nombre
      // ni motivo; el médico ve el detalle al abrir /citas.
      const cuando30 = new Date(fechaHoraMs - 30 * 60 * 1000)
      const seg30 = notificacionCitaSegura('cita_proxima', { minutos: 30 })
      const t30 = programarNotificacion(cuando30, seg30.titulo, {
        body: seg30.body,
        tag: `cita-30-${cita.id}`,
        url: '/citas',
      })
      if (t30) timeoutsRef.current.push(t30)

      // Para teleconsulta: aviso adicional 5 minutos antes (también sin PHI).
      if (cita.tipo === 'teleconsulta') {
        const cuando5 = new Date(fechaHoraMs - 5 * 60 * 1000)
        const seg5 = notificacionCitaSegura('teleconsulta_pronto', { minutos: 5 })
        const t5 = programarNotificacion(cuando5, seg5.titulo, {
          body: seg5.body,
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
