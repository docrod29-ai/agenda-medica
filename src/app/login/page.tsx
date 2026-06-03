'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Stethoscope, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')
  const destino = invite ? `/unirse/${invite}` : '/dashboard'

  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(destino)
  }, [user, loading, router, destino])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace(destino)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <Loader2 size={24} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      {/* Halo de marca discreto — cobalto soft */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 720, height: 720, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--nexus-soft) 0%, transparent 65%)',
        pointerEvents: 'none', opacity: 0.6,
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Hero brand block */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Mark NexusMED — N geométrica */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--s1)',
            border: '1px solid var(--border2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="30" height="30" viewBox="0 0 48 48" aria-hidden="true">
              <g stroke="#3D5AFE" strokeWidth="5" strokeLinecap="round" fill="none">
                <line x1="8" y1="8" x2="8" y2="40"/>
                <line x1="40" y1="8" x2="40" y2="40"/>
                <line x1="8" y1="8" x2="40" y2="40"/>
              </g>
              <circle cx="24" cy="24" r="3" fill="#F2EFE9"/>
              <circle cx="24" cy="24" r="1.2" fill="#0B0C0E"/>
            </svg>
          </div>
          <h1 className="nx-display" style={{
            fontSize: 36, color: 'var(--text)', margin: 0,
            fontWeight: 500,
          }}>
            NexusMED
          </h1>
          <p style={{
            fontSize: 14, color: 'var(--text2)', marginTop: 8,
            letterSpacing: '-0.005em',
          }}>
            El consultorio, conectado.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--s1)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '28px 28px',
        }}>
          <h2 style={{
            fontSize: 17, fontWeight: 600, color: 'var(--text)',
            margin: '0 0 22px', letterSpacing: '-0.01em',
          }}>
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="doctor@clinica.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px 16px' }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Entrando…
                </>
              ) : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 20 }}>
          NexusMED © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
