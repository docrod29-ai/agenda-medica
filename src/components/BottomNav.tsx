'use client'
/**
 * Bottom Navigation para móvil (≤768px).
 * 5 destinos principales siempre a un toque. Hace que la app móvil se sienta
 * tan rápida y densa como la versión desktop.
 *
 * En modo Secretaria se reemplaza CRM por Pacientes ya que CRM es solo-médico.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UserSquare2, Calendar, Users, MessageCircle, TrendingUp } from 'lucide-react'
import { useMode } from '@/context/ModeContext'
import { useClinic } from '@/context/ClinicContext'
import { rutaPermitida } from '@/lib/modulos'

type Item = {
  href: string; label: string; icon: typeof LayoutDashboard
  active: (path: string) => boolean
}

const COMMON: Item[] = [
  { href: '/dashboard', label: 'Inicio',     icon: LayoutDashboard, active: p => p === '/dashboard' },
  { href: '/asistente', label: 'Agendar',    icon: UserSquare2,     active: p => p.startsWith('/asistente') },
  { href: '/calendario', label: 'Calendario',icon: Calendar,        active: p => p.startsWith('/calendario') || p.startsWith('/citas') },
  { href: '/pacientes', label: 'Pacientes',  icon: Users,           active: p => p.startsWith('/pacientes') },
]

export function BottomNav() {
  const pathname = usePathname()
  const { mode } = useMode()
  const { clinic } = useClinic()

  // 5to slot cambia según modo
  const lastItem: Item = mode === 'medico'
    ? { href: '/crm', label: 'CRM', icon: TrendingUp, active: p => p.startsWith('/crm') }
    : { href: '/chat', label: 'Chat', icon: MessageCircle, active: p => p.startsWith('/chat') }

  // Oculta accesos a módulos que la clínica no contrató (su paquete).
  const items: Item[] = [...COMMON, lastItem].filter(it => rutaPermitida(clinic, it.href))

  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        background: 'var(--s1)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
        zIndex: 45, flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      className="bottom-nav"
    >
      {items.map(it => {
        const isActive = it.active(pathname)
        const Icon = it.icon
        return (
          <Link
            key={it.href}
            href={it.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '7px 4px 9px',
              color: isActive ? 'var(--teal)' : 'var(--text3)',
              textDecoration: 'none',
              gap: 3,
              minHeight: 52,
              transition: 'color 0.15s',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
              {it.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
