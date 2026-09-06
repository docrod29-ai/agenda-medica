'use client'
import { esFalloDeRed, MENSAJE_SIN_RED } from '@/lib/auth/fallo-de-red'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { obtenerResolverMfa, resolverLoginTotp, type MultiFactorResolver } from '@/lib/mfa'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { MarcaAuth } from '@/components/brand/MarcaAuth'
import { MarcaAusculta } from '@/components/MarcaAusculta'
import { EsperaDeLaPuerta } from '@/components/landing/EsperaDeLaPuerta'

export default function LoginPage() {
  return (
    <Suspense fallback={<EsperaDeLaPuerta />}>
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
  // Segundo factor (MFA): cuando la cuenta tiene 2FA, el primer factor deja un
  // "resolvedor" pendiente y pedimos el código de 6 dígitos para completar.
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace(destino)
  }, [user, loading, router, destino])

  // Completa el inicio de sesión con Google por REDIRECCIÓN (Safari) y muestra errores.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      // Cuenta con 2FA: no es un error, hay que pedir el código de 6 dígitos.
      const resolver = obtenerResolverMfa(err)
      if (resolver) { setMfaResolver(resolver); return }
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/unauthorized-domain') setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      else if (code) setError(`No se pudo entrar con Google: ${code}`)
    })
  }, [])

  // Completa el acceso con el código del segundo factor (TOTP).
  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaResolver) return
    setError(''); setSubmitting(true)
    try {
      await resolverLoginTotp(mfaResolver, mfaCode)
      router.replace(destino)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
      if (code === 'auth/invalid-verification-code' || code === 'auth/argument-error' || code === 'auth/totp-challenge-timeout') {
        setError('Código incorrecto o expirado. Abre tu app de autenticación y escribe el código actual de 6 dígitos.')
      } else {
        setError('No se pudo verificar el código. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace(destino)
    } catch (err: unknown) {
      // Cuenta con 2FA: pedir el código de 6 dígitos (no es contraseña incorrecta).
      const resolver = obtenerResolverMfa(err)
      if (resolver) { setMfaResolver(resolver); setSubmitting(false); return }
      // La red primero: sin ella, ningún código de credenciales significa nada.
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
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
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
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

  if (loading) return <EsperaDeLaPuerta comprobando />

  return (
    /* <main>: la página entera es el landmark — axe (landmark-one-main/region)
       lo pedía desde siempre; primera medición de la puerta en V15 lo pagó. */
    <main className="nx-puerta">
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

      <div className="nx-puerta-columna">
        {/*
          LA MARCA ES UN ENLACE A LA PORTADA, y no lo era.

          Quien llega a /login sin cuenta —de un enlace compartido, de un
          resultado de búsqueda, de una invitación caducada— se encontraba con
          un formulario y NINGUNA salida: ni un enlace a la portada, ni a
          precios, ni a nada. La única puerta era el navegador. Un logotipo que
          no lleva a inicio es el enlace que todo el mundo intenta y no está.

          Y la promesa dice la de HOY: «El consultorio, conectado» era el
          posicionamiento retirado con la transformación de producto, y dejarlo
          aquí partía en dos la experiencia — se venía de una portada que
          promete una cosa y se entraba a una puerta que promete otra.
        */}
        <div className="nx-puerta-marca">
          <Link href="/" className="nx-puerta-volver" aria-label="Ausculta — volver al inicio">
            <span className="nx-puerta-sello"><MarcaAusculta size={28} /></span>
            <h1 className="nx-display nx-puerta-nombre">Ausculta</h1>
          </Link>
          <p className="nx-puerta-promesa">
            Sal de la consulta con la nota hecha.
          </p>
        </div>

        {/* Card */}
        <div className="nx-puerta-tarjeta">
          {mfaResolver ? (
            /* ── Segundo factor (2FA): pedir el código de 6 dígitos ── */
            <form onSubmit={handleMfa} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 2 }}>
                <ShieldCheck size={18} style={{ color: 'var(--teal)' }} />
                <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
                  Verificación en dos pasos
                </h2>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                Tu cuenta tiene segundo factor. Abre tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos.
              </p>
              <div className="form-group">
                <label className="label" htmlFor="codigo-de-6-digitos">Código de 6 dígitos</label>
                <input
                id="codigo-de-6-digitos"
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  style={{ letterSpacing: '0.3em', fontSize: 18, textAlign: 'center' }}
                />
              </div>
              {error && (
                <div role="alert" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--red)' }}>
                  {error}
                </div>
              )}
              {/* minHeight 48: CTA primaria táctil, no baja del objetivo de 44
                  (§24) — .btn trae height 36 fijo y min-height gana. */}
              <button type="submit" className="btn btn-primary" disabled={submitting || mfaCode.length < 6}
                style={{ width: '100%', justifyContent: 'center', minHeight: 48 }}>
                {submitting ? (<><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verificando…</>) : 'Verificar y entrar'}
              </button>
              {/* Objetivo táctil 44px (§24): el alto lo pone minHeight, no un padding
                  que desplace el texto — el enlace se ve igual, se toca mejor. */}
              <button type="button" onClick={() => { setMfaResolver(null); setMfaCode(''); setError('') }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: 'var(--text3)', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                ← Volver
              </button>
            </form>
          ) : (
          <>
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
              width: '100%', justifyContent: 'center', gap: 10, minHeight: 48,
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
              <label className="label" htmlFor="correo-electronico">Correo electrónico</label>
              <input
                id="correo-electronico"
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
              <label className="label" htmlFor="contrasena">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="contrasena"
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
                  /* Sin esto el lector de pantalla sólo dice «botón». */
                  aria-label={showPwd ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                  /* Área táctil 44×44 (axe: target-size; regla propia de diseño).
                     El icono queda donde estaba: 44 de caja, centrado, right 0 ≈ right 12 + icono. */
                  style={{
                    position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Objetivo táctil 44px (§24) sin mover el texto: minHeight + flex,
                  margen negativo compensa lo que el alto añade bajo el campo. */}
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 12.5, color: 'var(--teal)', textAlign: 'left',
                  minHeight: 44, display: 'inline-flex', alignItems: 'center',
                  alignSelf: 'flex-start', marginBottom: -10,
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <div role="alert" style={{
                background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}
            {info && (
              /* El aviso habla el token POR TEMA (lección TrialBanner): el teal
                 crudo rgba(20,184,166,…) era el trazo del tema oscuro fijado a
                 mano — en claro ni el tinte ni el texto cambiaban. El texto va
                 en var(--text): el aviso es información, el tinte ya lo marca. */
              <div style={{
                background: 'color-mix(in srgb, var(--teal) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--teal) 30%, transparent)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)',
              }}>
                {info}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4, minHeight: 48 }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Entrando…
                </>
              ) : 'Iniciar sesión'}
            </button>
          </form>
          </>
          )}
        </div>

        {/* Registro — para quien AÚN no tiene cuenta.
            Sin caja: era una tarjeta con borde, fondo y radio para sostener UNA
            frase, justo debajo de otra tarjeta. Dos cajas seguidas no crean
            jerarquía; la crean el espacio y el peso del texto. */}
        <div style={{
          textAlign: 'center', marginTop: 18,
          fontSize: 14, color: 'var(--text2)',
        }}>
          ¿No tienes cuenta?{' '}
          {/* Subrayado: enlace DENTRO de una frase — sólo color no lo distingue
              (WCAG 1.4.1, la misma razón de a.nx-ident). */}
          <Link className="nx-enlace-tactil" href={invite ? `/registro?invite=${invite}` : '/registro'} style={{ color: 'var(--teal)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Crea una gratis →
          </Link>
        </div>

        <p className="nx-meta" style={{ textAlign: 'center', marginTop: 20 }}>
          Ausculta © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
