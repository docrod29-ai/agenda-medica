'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Stethoscope, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const BENEFICIOS = [
  'Agenda y calendario inteligente',
  'Bot de WhatsApp para auto-agendamiento',
  'Recordatorios automáticos a pacientes',
  'Lista de espera con notificación automática',
  'Google Calendar sincronizado',
  'Portal simplificado para secretaria',
]

export default function RegistroPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <RegistroInner />
    </Suspense>
  )
}

function RegistroInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')   // si viene de /unirse/CODE
  const destinoTrasRegistro = invite ? `/unirse/${invite}` : '/setup'

  const { user, loading } = useAuth()
  const [step, setStep] = useState<'form' | 'verifying'>('form')
  const [nombre, setNombre] = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(destinoTrasRegistro)
  }, [user, loading, router, destinoTrasRegistro])

  // Completa el registro con Google por REDIRECCIÓN (Safari) y muestra errores.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      else if (code) setError(`No se pudo registrar con Google: ${code}`)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !email.trim() || password.length < 6) return
    setError('')
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: nombre.trim() })
      router.replace(destinoTrasRegistro)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/email-already-in-use') {
        setError('Este correo ya tiene una cuenta. ¿Quieres iniciar sesión?')
      } else if (code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setError('Error al crear la cuenta. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setSubmitting(true)
    // Redirección SIEMPRE (no popup): el popup de Firebase se cuelga/bloquea.
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      } else {
        setError(`No se pudo registrar con Google: ${code || 'error desconocido'}`)
      }
      setSubmitting(false)
    }
  }

  const valid = nombre.trim().length > 2 && email.includes('@') && password.length >= 6

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
    }} className="registro-layout">

      {/* Left — benefits */}
      <div style={{
        background: 'var(--bg)',
        padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        borderRight: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
      }}>
        {/* Halo cobalto soft */}
        <div style={{
          position: 'absolute', top: '50%', left: '20%', transform: 'translate(-30%, -50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--nexus-soft) 0%, transparent 65%)',
          pointerEvents: 'none', opacity: 0.6,
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: 'var(--s1)', border: '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
                <g stroke="#3D5AFE" strokeWidth="5" strokeLinecap="round" fill="none">
                  <line x1="8" y1="8" x2="8" y2="40"/>
                  <line x1="40" y1="8" x2="40" y2="40"/>
                  <line x1="8" y1="8" x2="40" y2="40"/>
                </g>
                <circle cx="24" cy="24" r="3" fill="#F2EFE9"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>NexusMED</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>El consultorio, conectado.</div>
            </div>
          </div>

          <h2 className="nx-display" style={{
            fontSize: 40, color: 'var(--text)', lineHeight: 1.05, marginBottom: 14,
            fontWeight: 500, letterSpacing: '-0.03em',
          }}>
            Tu consultorio,<br />
            <span style={{ color: 'var(--nexus)', fontStyle: 'italic' }}>conectado.</span>
          </h2>
          <p style={{
            fontSize: 15, color: 'var(--text2)', marginBottom: 36, lineHeight: 1.6,
            letterSpacing: '-0.005em', maxWidth: 380,
          }}>
            Agenda, expediente, recetas y cobros en una sola herramienta.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {BENEFICIOS.map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} color="var(--nexus)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: 'var(--text2)', letterSpacing: '-0.005em' }}>{b}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 40, padding: '18px 22px',
            background: 'var(--nexus-soft)', border: '1px solid rgba(61,90,254,0.22)',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', fontWeight: 600, marginBottom: 6, letterSpacing: '-0.005em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nexus)' }} />
              14 días de prueba gratis
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, letterSpacing: '-0.005em' }}>
              Sin tarjeta de crédito. Después solo $499 MXN/mes.
              Cancela cuando quieras.
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Crea tu cuenta
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 32 }}>
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
              Inicia sesión
            </Link>
          </p>

          {/* Google — registro en un clic */}
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Nombre */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Tu nombre completo
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Dr. Juan García"
                autoFocus
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="doctor@email.com"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 44px 12px 16px', fontSize: 14, color: 'var(--text)',
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!valid || submitting}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 10,
                background: valid ? 'var(--teal)' : 'var(--s3)',
                color: valid ? '#000' : 'var(--text3)',
                fontSize: 15, fontWeight: 700, border: 'none',
                cursor: valid && !submitting ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {submitting
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creando cuenta…</>
                : 'Comenzar prueba gratis →'
              }
            </button>

            <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
              Al registrarte aceptas los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>términos de servicio</a>
              {' '}y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>política de privacidad</a>.
            </p>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .registro-layout { grid-template-columns: 1fr !important; }
          .registro-layout > div:first-child { display: none !important; }
        }
      `}</style>
    </div>
  )
}
