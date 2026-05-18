'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { ToastProvider } from '@/context/ToastContext'
import { ModeProvider } from '@/context/ModeContext'
import { Menu, Loader2 } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return null

  return (
    <ModeProvider>
      <ToastProvider>
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
          {/* Desktop sidebar */}
          <div className="hidden md:flex" style={{ flexShrink: 0 }}>
            <Sidebar />
          </div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49, backdropFilter: 'blur(2px)' }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {sidebarOpen && (
            <div style={{ position: 'fixed', inset: '0 auto 0 0', zIndex: 50, width: 260 }}>
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          )}

          {/* Main area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Mobile topbar */}
            <div className="md:hidden" style={{
              height: 52, background: 'var(--s1)', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0,
            }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', display: 'flex' }}
              >
                <Menu size={22} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Agenda Médica</span>
            </div>

            <main style={{ flex: 1, overflowY: 'auto' }}>
              {children}
            </main>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </ToastProvider>
    </ModeProvider>
  )
}
