'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
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

  const valid = nombre.trim().length > 2 && email.includes('@') && password.length >= 6

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
    }} className="registro-layout">

      {/* Left — benefits */}
      <div style={{
        background: 'linear-gradient(135deg, #040b12 0%, #0a1628 60%, #0f2040 100%)',
        padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        borderRight: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(0,212,168,0.15)', border: '1px solid rgba(0,212,168,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Stethoscope size={22} color="var(--teal)" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>NexusMED</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>El consultorio, conectado.</div>
          </div>
        </div>

        <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, marginBottom: 12 }}>
          Tu consultorio,<br />
          <span style={{ color: 'var(--teal)' }}>en piloto automático</span>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 40, lineHeight: 1.7 }}>
          Agenda citas, envía recordatorios automáticos por WhatsApp y gestiona tu lista de espera sin esfuerzo.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {BENEFICIOS.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={18} color="var(--teal)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>{b}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 48, padding: '20px 24px',
          background: 'rgba(0,212,168,0.06)', border: '1px solid rgba(0,212,168,0.2)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 6 }}>
            ✨ 14 días de prueba gratis
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Sin tarjeta de crédito. Después solo $499 MXN/mes.
            Cancela cuando quieras.
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
              <a href="#" style={{ color: 'var(--teal)', textDecoration: 'none' }}>términos de servicio</a>
              {' '}y la{' '}
              <a href="#" style={{ color: 'var(--teal)', textDecoration: 'none' }}>política de privacidad</a>.
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
