'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Stethoscope, Eye, EyeOff, Loader2 } from 'lucide-react'
import { MarcaAuth } from '@/components/brand/MarcaAuth'

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
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(destino)
  }, [user, loading, router, destino])

  // Completa el inicio de sesión con Google por REDIRECCIÓN (Safari) y muestra errores.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      else if (code) setError(`No se pudo entrar con Google: ${code}`)
    })
  }, [])

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
        setError('Correo o contraseña incorrectos. Si te registraste con Google, entra con el botón "Continuar con Google" de arriba. Si olvidaste tu contraseña, usa el enlace de abajo.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento e inténtalo de nuevo.')
      } else {
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(''); setInfo(''); setSubmitting(true)
    // Redirección SIEMPRE (no popup): el popup de Firebase se cuelga en blanco en
    // Chrome y lo bloquea Safari. La redirección funciona en todos los navegadores.
    // prompt:'select_account' → SIEMPRE muestra el selector de cuentas de Google,
    // así el médico elige su correo correcto (evita entrar con la cuenta equivocada).
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithRedirect(auth, provider)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      } else {
        setError(`No se pudo entrar con Google: ${code || 'error desconocido'}`)
      }
      setSubmitting(false)
    }
  }

  const handleReset = async () => {
    setError(''); setInfo('')
    if (!email.includes('@')) {
      setError('Escribe tu correo arriba y vuelve a tocar “¿Olvidaste tu contraseña?”.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo('Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja (y spam).')
    } catch {
      // No revelamos si el correo existe (privacidad): mismo mensaje siempre.
      setInfo('Si ese correo tiene cuenta, te llegará un enlace para restablecer la contraseña.')
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
      {/* Motivo de red/nexo de marca — muy tenue, detrás del formulario */}
      <MarcaAuth style={{ top: '4%', left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 120vw)', opacity: 0.14 }} />

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

          {/* Google — un clic, menos fricción */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="btn"
            style={{
              width: '100%', justifyContent: 'center', gap: 10, padding: '11px 16px',
              background: '#fff', color: '#1a1a1a', border: '1px solid var(--border2)', fontWeight: 600,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z"/>
              <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.4l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.3 0-11.6-3.7-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>o con tu correo</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

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
              <button
                type="button"
                onClick={handleReset}
                style={{
                  marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 12.5, color: 'var(--teal)', textAlign: 'left',
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171',
              }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{
                background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--teal)',
              }}>
                {info}
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

        {/* Registro — para quien AÚN no tiene cuenta */}
        <div style={{
          textAlign: 'center', marginTop: 18, padding: '14px 16px',
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12,
          fontSize: 14, color: 'var(--text2)',
        }}>
          ¿No tienes cuenta?{' '}
          <Link href={invite ? `/registro?invite=${invite}` : '/registro'} style={{ color: 'var(--teal)', fontWeight: 700, textDecoration: 'none' }}>
            Crea una gratis →
          </Link>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 20 }}>
          NexusMED © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
