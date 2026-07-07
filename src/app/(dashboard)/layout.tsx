'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { Sidebar } from '@/components/Sidebar'
import { ToastProvider } from '@/context/ToastContext'
import { ModeProvider } from '@/context/ModeContext'
import { ClinicProvider } from '@/context/ClinicContext'
import { Menu, Loader2, AlertTriangle, Headset } from 'lucide-react'
import Link from 'next/link'
import { OfflineBanner } from '@/components/OfflineBanner'
import { NotificacionesPushOptIn } from '@/components/NotificacionesPushOptIn'
import { useMode } from '@/context/ModeContext'
import { BottomNav } from '@/components/BottomNav'
import { fetchAutenticado } from '@/lib/auth-client'
import { rutaPermitida } from '@/lib/modulos'

function ModeBanner() {
  const { mode } = useMode()
  if (mode !== 'secretaria') return null
  return (
    <div style={{
      background: 'rgba(59,130,246,0.1)', borderBottom: '1px solid rgba(59,130,246,0.25)',
      color: '#60a5fa', fontSize: 12, fontWeight: 600, textAlign: 'center',
      padding: '5px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}>
      <Headset size={13} className="ds-icon" /> Modo Secretaria · vista enfocada en agenda y atención al paciente
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
      <Link href="/configuracion?tab=suscripcion" style={{
        fontSize: 12, fontWeight: 700, color: '#000',
        background: daysLeft <= 3 ? '#f87171' : '#f59e0b',
        padding: '3px 10px', borderRadius: 6, textDecoration: 'none',
      }}>
        Activar plan →
      </Link>
    </div>
  )
}

/**
 * Estado de acceso (Modelo B: tarjeta para iniciar la prueba).
 * - 'ok': suscripción activa o en prueba de Stripe (el webhook mapea trialing→active)
 *   o cuenta de cortesía (status 'active').
 * - 'vencido': se canceló o falló el cobro → reactivar.
 * - 'sin_tarjeta': cuenta nueva sin suscripción → elegir plan + tarjeta.
 * Conservador: ante la duda (sin clínica) NO bloquea.
 */
function estadoAcceso(clinic: { status?: string } | null): 'ok' | 'sin_tarjeta' | 'vencido' {
  if (!clinic) return 'ok'
  if (clinic.status === 'active') return 'ok'
  if (clinic.status === 'suspended' || clinic.status === 'cancelled' || clinic.status === 'canceled' || clinic.status === 'past_due') return 'vencido'
  return 'sin_tarjeta'   // 'trial' o cuenta nueva → necesita tarjeta para iniciar
}

const PLANES_GATE = [
  { key: 'basico',  label: 'Básico',  price: '$699',   nota: '1 médico' },
  { key: 'pro',     label: 'Pro',     price: '$999',   nota: '1 médico · WhatsApp 24/7', destacado: true },
  { key: 'clinica', label: 'Clínica', price: '$1,799', nota: 'Hasta 5 médicos' },
]

/** Tras pagar, el webhook tarda unos segundos. Clínica en vivo → el gate se quita
 *  solo al activarse. Fallback: recargar una vez por si el webhook se retrasa. */
function ActivandoCuenta() {
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), 9000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Loader2 size={30} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 15, color: 'var(--text2)' }}>Activando tu cuenta…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AccesoGate({ estado, clinicId, esMedico, email }: { estado: 'sin_tarjeta' | 'vencido'; clinicId: string | null; esMedico: boolean; email: string }) {
  const [cargando, setCargando] = useState<string | null>(null)
  const nuevo = estado === 'sin_tarjeta'
  const iniciar = async (plan: string) => {
    if (!clinicId) return
    setCargando(plan)
    try {
      const res = await fetchAutenticado('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, plan, email }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url; return }
      setCargando(null)
    } catch { setCargando(null) }
  }
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 720, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>
          {nuevo ? 'Inicia tu prueba gratis de 14 días' : 'Reactiva tu suscripción'}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text2)', margin: '0 auto 28px', maxWidth: 520, lineHeight: 1.5 }}>
          {esMedico
            ? (nuevo
                ? 'Elige tu plan y agrega tu tarjeta. No se te cobra hoy — el primer cargo es hasta el día 15 y puedes cancelar cuando quieras.'
                : 'Tu acceso está en pausa. Elige un plan para continuar; tus datos están a salvo.')
            : 'Pídele al médico responsable del consultorio que active el plan para reanudar el acceso.'}
        </p>
        {esMedico && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, maxWidth: 660, margin: '0 auto' }}>
            {PLANES_GATE.map(p => (
              <div key={p.key} style={{
                background: 'var(--s1)', borderRadius: 14, padding: '22px 18px',
                border: `1px solid ${p.destacado ? 'var(--teal)' : 'var(--border)'}`,
                display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{p.price}<span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>/mes</span></div>
                <div style={{ fontSize: 12, color: 'var(--text3)', minHeight: 32 }}>{p.nota}</div>
                <button onClick={() => iniciar(p.key)} disabled={!!cargando}
                  style={{
                    marginTop: 6, width: '100%', padding: '10px 14px', borderRadius: 9,
                    cursor: cargando ? 'wait' : 'pointer', border: 'none', fontWeight: 700, fontSize: 14,
                    background: p.destacado ? 'var(--teal)' : 'var(--s2)',
                    color: p.destacado ? '#000' : 'var(--text)',
                  }}>
                  {cargando === p.key ? 'Abriendo…' : nuevo ? 'Empezar' : 'Elegir'}
                </button>
              </div>
            ))}
          </div>
        )}
        {esMedico && nuevo && (
          <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--text3)' }}>Pago seguro con Stripe · Cancela cuando quieras</div>
        )}
        <button onClick={() => { import('@/lib/firebase').then(({ auth }) => auth.signOut()) }}
          style={{ marginTop: 22, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { clinicId, loading: clinicLoading, needsSetup, role, clinic } = useClinic()
  const { mode } = useMode()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Rutas que SOLO pueden ver médicos/admin (datos clínicos sensibles).
  // La asistente NUNCA debe verlas, sin importar el toggle de UI.
  const RUTAS_SOLO_MEDICO = [
    '/expedientes', '/expediente/', '/consulta/', '/nota/', '/referencia/',
    '/receta/', '/orden/', '/crm', '/resenas', '/cumplimiento', '/finanzas',
  ]
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''

  // role viene de Firestore (clinic_members) — NO se puede bypassear desde el cliente
  const esMedicoReal = role === 'medico' || role === 'admin'

  useEffect(() => {
    if (authLoading || clinicLoading) return
    if (!user) { router.replace('/login'); return }
    if (needsSetup) { router.replace('/setup'); return }
    // Bloqueo basado en el ROL REAL del Firestore, no en el toggle de UI
    if (!esMedicoReal && RUTAS_SOLO_MEDICO.some(r => pathname.startsWith(r))) {
      router.replace('/dashboard')
      return
    }
    // Bloqueo por MÓDULOS contratados (paquete de la clínica): si intenta entrar
    // directo a una ruta que su paquete no incluye, lo regresa al inicio.
    if (pathname && !rutaPermitida(clinic, pathname)) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, clinicId, clinicLoading, needsSetup, router, esMedicoReal, pathname, clinic])

  if (authLoading || clinicLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user || (!clinicId && !needsSetup)) return null

  // Modelo B: sin suscripción (cuenta nueva) o vencida → bloquea la app y muestra
  // elegir plan + tarjeta. Tras pagar (?checkout=success) muestra "Activando…" hasta
  // que el webhook active la clínica (en vivo → se desbloquea solo).
  const acceso = estadoAcceso(clinic)
  if (acceso !== 'ok') {
    const recienPago = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('checkout') === 'success'
    if (recienPago) return <ActivandoCuenta />
    return <AccesoGate estado={acceso} clinicId={clinicId} esMedico={esMedicoReal} email={user?.email ?? ''} />
  }

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
          borderRight: '1px solid var(--border)',
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
          boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.4)' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="mobile-sidebar-wrap"
      >
        {/* Sidebar con display forzado inline para evitar cualquier CSS que lo oculte */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%' }}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
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
        <NotificacionesPushOptIn />
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
