'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { Sidebar } from '@/components/Sidebar'
import { ToastProvider } from '@/context/ToastContext'
import { ModeProvider } from '@/context/ModeContext'
import { ClinicProvider } from '@/context/ClinicContext'
import { Menu, Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { OfflineBanner } from '@/components/OfflineBanner'
import { useMode } from '@/context/ModeContext'
import { BottomNav } from '@/components/BottomNav'

function ModeBanner() {
  const { mode } = useMode()
  if (mode !== 'secretaria') return null
  return (
    <div style={{
      background: 'rgba(59,130,246,0.1)', borderBottom: '1px solid rgba(59,130,246,0.25)',
      color: '#60a5fa', fontSize: 12, fontWeight: 600, textAlign: 'center',
      padding: '5px 12px',
    }}>
      🔵 Modo Secretaria · vista enfocada en agenda y atención al paciente
    </div>
  )
}

function TrialBanner() {
  const { clinic } = useClinic()
  if (!clinic || clinic.plan !== 'trial' || clinic.status !== 'trial') return null
  const trialEnds = clinic.trialEndsAt ? new Date(clinic.trialEndsAt) : null
  const daysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000))
    : 14
  return (
    <div style={{
      background: daysLeft <= 3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
      borderBottom: `1px solid ${daysLeft <= 3 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
      padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <AlertTriangle size={14} color={daysLeft <= 3 ? '#f87171' : '#f59e0b'} />
      <span style={{ fontSize: 13, color: daysLeft <= 3 ? '#f87171' : '#f59e0b' }}>
        {daysLeft > 0
          ? `Tu prueba gratuita termina en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}.`
          : 'Tu prueba gratuita ha terminado.'
        }
      </span>
      <Link href="/dashboard/configuracion?tab=suscripcion" style={{
        fontSize: 12, fontWeight: 700, color: '#000',
        background: daysLeft <= 3 ? '#f87171' : '#f59e0b',
        padding: '3px 10px', borderRadius: 6, textDecoration: 'none',
      }}>
        Activar plan →
      </Link>
    </div>
  )
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { clinicId, loading: clinicLoading, needsSetup } = useClinic()
  const { mode } = useMode()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Rutas que NO están disponibles en modo Secretaria
  const RUTAS_SOLO_MEDICO = ['/expedientes', '/expediente/', '/consulta/', '/nota/', '/referencia/', '/crm', '/resenas']
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''

  useEffect(() => {
    if (authLoading || clinicLoading) return
    if (!user) { router.replace('/login'); return }
    if (needsSetup) { router.replace('/setup'); return }
    // Si modo secretaria intenta acceder a ruta solo-médico, devolver a dashboard
    if (mode === 'secretaria' && RUTAS_SOLO_MEDICO.some(r => pathname.startsWith(r))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, clinicId, clinicLoading, needsSetup, router, mode, pathname])

  if (authLoading || clinicLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user || (!clinicId && !needsSetup)) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Mobile sidebar — siempre en DOM, se desliza con transform (más confiable que conditional render) */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 49, backdropFilter: 'blur(2px)',
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />
      <div
        role="dialog"
        aria-label="Menú"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'min(82vw, 320px)',
          background: 'var(--s1)',
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
          boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.4)' : 'none',
        }}
        className="mobile-sidebar-wrap"
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-topbar-btn"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Agenda Médica</span>
        </div>

        <OfflineBanner />
        <ModeBanner />
        <TrialBanner />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
        {/* Barra inferior — solo móvil (gestionada por CSS) */}
        <div className="bottom-nav-wrap">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClinicProvider>
      <ModeProvider>
        <ToastProvider>
          <DashboardInner>{children}</DashboardInner>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </ToastProvider>
      </ModeProvider>
    </ClinicProvider>
  )
}
