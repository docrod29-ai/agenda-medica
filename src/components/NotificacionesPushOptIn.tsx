'use client'
/**
 * Banner discreto que pide al médico/asistente activar notificaciones del navegador.
 *
 * Solo aparece si:
 *  - El navegador soporta Notifications API
 *  - El usuario aún no ha decidido (status: 'default')
 *  - El usuario no lo dimisó antes (flag en localStorage)
 *
 * Una vez aceptado o denegado, no vuelve a aparecer.
 */
import { useEffect, useState } from 'react'
import { obtenerPermisoPush, solicitarPermisoPush } from '@/lib/push-notifications'
import { Bell, X } from 'lucide-react'
import { useNotificacionesCitas } from '@/hooks/useNotificacionesCitas'

const DISMISS_KEY = 'agenda-medica:push-dismissed'

/**
 * Programa los avisos de citas. Aislado en su propio componente para que el
 * listener de citas (useAppointments, ventana de 120 días) SOLO se monte cuando
 * el usuario ya concedió permiso de push. Antes se llamaba el hook a nivel del
 * layout "siempre" — abría el listener en TODAS las pantallas aunque nadie hubiera
 * aceptado notificaciones, reintroduciendo justo el gasto que useAppointments evita.
 */
function ProgramadorNotificaciones() {
  useNotificacionesCitas()
  return null
}

export function NotificacionesPushOptIn() {
  const [visible, setVisible] = useState(false)
  const [solicitando, setSolicitando] = useState(false)
  const [concedido, setConcedido] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    const p = obtenerPermisoPush()
    setConcedido(p.granted)   // solo entonces montamos el programador (y su listener)
    if (!p.default) return  // ya decidió antes
    if (localStorage.getItem(DISMISS_KEY)) return
    // Esperamos 3 segundos para no molestar al cargar
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  const aceptar = async () => {
    setSolicitando(true)
    const ok = await solicitarPermisoPush()
    setSolicitando(false)
    setVisible(false)
    if (ok) {
      setConcedido(true)
      // Notificación de bienvenida
      const { mostrarNotificacion } = await import('@/lib/push-notifications')
      mostrarNotificacion('Recordatorios activados', {
        body: 'Te avisaré 30 min antes de cada cita',
        tag: 'welcome',
      })
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  // El programador se monta apenas hay permiso (aunque el banner no se muestre);
  // el banner solo aparece cuando corresponde pedirlo.
  if (!visible) return concedido ? <ProgramadorNotificaciones /> : null

  return (
    <>
    {concedido && <ProgramadorNotificaciones />}
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
      maxWidth: 360, background: 'var(--s1)',
      border: '1px solid var(--border)', borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(20,184,166,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Bell size={18} color="var(--teal)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Recordatorios de citas
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.45, marginBottom: 10 }}>
          Activa notificaciones del navegador para recibir un aviso 30 min antes de cada cita
          y 5 min antes de teleconsultas.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={aceptar}
            disabled={solicitando}
            style={{
              background: 'var(--nexus-solido)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {solicitando ? 'Pidiendo…' : 'Activar'}
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'transparent', color: 'var(--text3)', border: 'none',
              borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
            }}
          >
            Después
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar aviso de notificaciones"
        style={{
          background: 'none', border: 'none', color: 'var(--text3)',
          cursor: 'pointer', padding: 2, flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
    </>
  )
}
