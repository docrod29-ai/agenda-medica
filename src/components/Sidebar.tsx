'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useMode } from '@/context/ModeContext'
import { useConfig } from '@/hooks/useConfig'
import {
  LayoutDashboard, CalendarDays, Calendar, Users, Clock,
  Settings, LogOut, Stethoscope, Shield,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/citas',         label: 'Citas',          icon: CalendarDays },
  { href: '/calendario',    label: 'Calendario',     icon: Calendar },
  { href: '/pacientes',     label: 'Pacientes',      icon: Users },
  { href: '/lista-espera',  label: 'Lista de espera',icon: Clock },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { mode, setMode, isDoctor } = useMode()
  const { config } = useConfig()

  const handleLogout = async () => {
    await signOut(auth)
    router.replace('/login')
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--teal-glow)', border: '1px solid rgba(0,212,168,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stethoscope size={18} color="var(--teal)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {config.nombreClinica || 'Agenda Médica'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {config.nombreMedico ? `Dr. ${config.nombreMedico}` : 'Consultorio'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`nav-item${pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? ' active' : ''}`}
          >
            <Icon size={17} className="nav-icon" />
            {label}
          </Link>
        ))}

        <div className="nav-section-title" style={{ marginTop: 12 }}>Sistema</div>

        <Link
          href="/configuracion"
          onClick={onClose}
          className={`nav-item${pathname.startsWith('/configuracion') ? ' active' : ''}`}
        >
          <Settings size={17} className="nav-icon" />
          Configuración
        </Link>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 8px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Mode toggle */}
        <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '4px', display: 'flex', gap: 2 }}>
          <button
            onClick={() => setMode('medico')}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: mode === 'medico' ? 'var(--s3)' : 'transparent',
              color: mode === 'medico' ? 'var(--teal)' : 'var(--text3)',
              transition: 'all 0.15s',
            }}
          >
            <Stethoscope size={13} /> Médico
          </button>
          <button
            onClick={() => setMode('secretaria')}
            style={{
              flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: mode === 'secretaria' ? 'var(--s3)' : 'transparent',
              color: mode === 'secretaria' ? 'var(--blue)' : 'var(--text3)',
              transition: 'all 0.15s',
            }}
          >
            <Shield size={13} /> Secretaria
          </button>
        </div>

        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text3)' }}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
