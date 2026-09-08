'use client'
/**
 * /unirse/[code] — LA INVITACIÓN CREA LA CUENTA AQUÍ, NO EN OTRA PANTALLA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Esta pantalla no daba de alta a nadie: enseñaba «Crear mi cuenta» y rebotaba
 * a `/registro?invite=CODE`. Ese rebote tenía tres salidas malas, y las tres se
 * vieron en producción con la primera asistente que se dio de alta:
 *
 *  1. **Con la sesión del médico puesta** (el enlace se abre en su navegador, o
 *     él lo prueba para ver qué sale) la pantalla no ofrecía crear cuenta: sólo
 *     «Aceptar y entrar». Y como el médico YA es miembro de esa clínica, el
 *     servidor contestaba `ok` — «¡Bienvenida!» y adentro. Nunca se pidió una
 *     contraseña porque nunca se creó una cuenta: se estaba trabajando dentro
 *     de la sesión del médico, sin rastro propio en la bitácora.
 *  2. **Con Google**, un clic y dentro: cuenta sin contraseña y sin correo de
 *     confirmación (Google ya viene verificado), que es exactamente lo que se
 *     reportó — «la asistente no tiene contraseña y no le llegó el correo».
 *  3. **Si el rebote se perdía** (pestaña cerrada, ida y vuelta de Google), el
 *     siguiente arranque acababa en `/setup` y la asistente se creaba SU PROPIO
 *     consultorio: por eso nada de lo que configuraba el médico le aparecía.
 *     Ver `src/lib/clinica/invitacion-pendiente.ts`.
 *
 * ── CÓMO QUEDA ───────────────────────────────────────────────────────────────
 *
 * El alta ocurre en esta misma pantalla, con nombre, correo y **contraseña** a
 * la vista, y termina diciendo a qué dirección se mandó el correo de
 * confirmación (o que no se pudo mandarlo, en vez de tragárselo). Si hay una
 * sesión abierta que no es la de la persona invitada, se dice de quién es y se
 * ofrece salir de ella antes de nada.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createUserWithEmailAndPassword, updateProfile, sendEmailVerification,
  GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { obtenerInvitacion, esValida, aceptarInvitacion, type Invitacion, type RolInvitacion } from '@/lib/invitations'
import { invitacionEsParaEsteCorreo, correoNormalizado } from '@/lib/security/invitacion-vigente'
import { recordarInvitacion, olvidarInvitacion } from '@/lib/clinica/invitacion-pendiente'
import { pedirCorreoDeConfirmacion, type EnvioDeConfirmacion } from '@/lib/auth/correo-de-confirmacion'
import { esFalloDeRed, MENSAJE_SIN_RED } from '@/lib/auth/fallo-de-red'
import { enEspanolLlano } from '@/lib/texto-es'
import { Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, MailCheck, MailWarning } from 'lucide-react'
import { MarcaAusculta } from '@/components/MarcaAusculta'
import { BotonGoogle } from '@/components/brand/BotonGoogle'

const ROL_LABEL: Record<RolInvitacion, string> = {
  secretaria: 'asistente',
  medico: 'médico',
  admin: 'administrador',
  enfermeria: 'enfermería',
  farmacia: 'farmacia',
  laboratorio: 'laboratorio',
}

const contenedor: React.CSSProperties = {
  minHeight: '100vh', background: 'var(--bg)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 'max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))',
}
const tarjeta: React.CSSProperties = {
  width: '100%', maxWidth: 460, background: 'var(--s1)',
  border: '1px solid var(--border)', borderRadius: 14, padding: '32px 28px',
}

function Marca() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 14, background: 'var(--s1)', border: '1px solid var(--border2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
    }}>
      <MarcaAusculta size={28} />
    </div>
  )
}

export default function UnirsePage() {
  const params = useParams<{ code: string }>()
  const code = String(params?.code ?? '')
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [inv, setInv] = useState<Invitacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aceptando, setAceptando] = useState(false)
  const [aceptado, setAceptado] = useState(false)

  // Alta en esta misma pantalla
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [creando, setCreando] = useState(false)
  const [envio, setEnvio] = useState<EnvioDeConfirmacion | null>(null)
  const [reenviando, setReenviando] = useState(false)

  useEffect(() => {
    if (!code) return
    // Se recuerda ANTES de nada: si el navegador se va a Google y vuelve, o si
    // esta pestaña se cierra, el código ya no depende de la barra de direcciones.
    recordarInvitacion(code)
    obtenerInvitacion(code).then(i => {
      if (!i) { setError('Invitación no encontrada o el enlace es incorrecto.'); setLoading(false); return }
      const v = esValida(i)
      if (!v.ok) { setError(v.motivo); setLoading(false); return }
      setInv(i)
      setNombre(n => n || (i.nombreInvitado ?? ''))
      setEmail(e => e || (i.emailInvitado ?? ''))
      setLoading(false)
    }).catch(() => {
      setError('No se pudo cargar la invitación. Verifica el enlace.')
      setLoading(false)
    })
  }, [code])

  // Vuelta de «Continuar con Google»: sin esto el fallo se quedaba mudo.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const c = (err as { code?: string }).code ?? ''
      if (c === 'auth/unauthorized-domain') setError('Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).')
      else if (c) setError(`No se pudo entrar con Google. ${enEspanolLlano(err)}`)
    })
  }, [])

  /** ¿La sesión abierta es la de la persona invitada? (Sin destinatario: cualquiera.) */
  const sesionCorrecta = useMemo(
    () => (inv && user ? invitacionEsParaEsteCorreo(inv, user.email) : { ok: true as const }),
    [inv, user],
  )

  const correoFijado = correoNormalizado(inv?.emailInvitado)

  const salirDeLaSesion = async () => {
    // No se limpia la invitación pendiente: salir de la sesión ajena es un paso
    // DENTRO de aceptarla, no un abandono.
    try { await signOut(auth) } catch { /* la sesión local se cae igual */ }
  }

  const entrar = () => { olvidarInvitacion(); router.replace('/dashboard') }

  const aceptar = async () => {
    if (!inv || !user) return
    setAceptando(true)
    setError('')
    try {
      const r = await aceptarInvitacion(code, { uid: user.uid, email: user.email ?? '' })
      if (r.ok) { olvidarInvitacion(); setAceptado(true); setTimeout(entrar, 1500) }
      else setError(r.motivo ?? 'No se pudo aceptar')
    } catch {
      setError('Error al aceptar la invitación.')
    } finally {
      setAceptando(false)
    }
  }

  const crearCuenta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inv) return
    const correo = email.trim()
    if (nombre.trim().length < 3 || !correo.includes('@') || password.length < 6) return
    // La invitación nominativa manda: el servidor lo va a exigir igual, y es
    // mejor decirlo aquí que después de haber creado la cuenta.
    const deQuien = invitacionEsParaEsteCorreo(inv, correo)
    if (!deQuien.ok) { setError(deQuien.motivo); return }

    setError('')
    setCreando(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, password)
      await updateProfile(cred.user, { displayName: nombre.trim() })

      // El correo de confirmación se pide ANTES de aceptar y su resultado se
      // guarda: la pantalla siguiente dice a dónde se mandó, o que no se pudo.
      const resultado = await pedirCorreoDeConfirmacion(
        cred.user,
        (ajustes) => (ajustes ? sendEmailVerification(cred.user, ajustes) : sendEmailVerification(cred.user)),
        typeof window !== 'undefined' ? window.location.origin : null,
      )
      setEnvio(resultado)

      const r = await aceptarInvitacion(code, { uid: cred.user.uid, email: correo })
      if (!r.ok) { setError(r.motivo ?? 'La cuenta se creó, pero no se pudo aceptar la invitación.'); return }
      olvidarInvitacion()
      setAceptado(true)
    } catch (err: unknown) {
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
      const c = (err as { code?: string }).code ?? ''
      if (c === 'auth/email-already-in-use') setError('Este correo ya tiene una cuenta. Inicia sesión con ella para aceptar la invitación.')
      else if (c === 'auth/weak-password') setError('La contraseña debe tener al menos 6 caracteres.')
      else if (c === 'auth/invalid-email') setError('Ese correo no parece válido. Revísalo.')
      else setError(`No se pudo crear la cuenta. ${enEspanolLlano(err)}`)
    } finally {
      setCreando(false)
    }
  }

  const conGoogle = async () => {
    setError('')
    recordarInvitacion(code)
    try {
      await signInWithRedirect(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      if (esFalloDeRed(err)) { setError(MENSAJE_SIN_RED); return }
      setError(`No se pudo entrar con Google. ${enEspanolLlano(err)}`)
    }
  }

  const reenviar = async () => {
    if (!auth.currentUser) return
    setReenviando(true)
    const u = auth.currentUser
    const r = await pedirCorreoDeConfirmacion(
      u,
      (ajustes) => (ajustes ? sendEmailVerification(u, ajustes) : sendEmailVerification(u)),
      typeof window !== 'undefined' ? window.location.origin : null,
    )
    setEnvio(r)
    setReenviando(false)
  }

  if (loading || authLoading) {
    return (
      <main style={contenedor}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Cargando invitación…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    )
  }

  // Enlace roto, caducado o ya usado: sin invitación no hay pantalla que dar.
  if (!inv) {
    return (
      <main style={contenedor}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <AlertTriangle size={36} color="var(--red)" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Enlace no válido</h1>
          <p role="alert" style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 18px' }}>{error || 'Pide a tu clínica un enlace nuevo.'}</p>
          <Link href="/" style={{ color: 'var(--teal)', textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 14 }}>Ir al inicio</Link>
        </div>
      </main>
    )
  }

  // Cuenta lista / invitación aceptada.
  if (aceptado) {
    return (
      <main style={contenedor}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <CheckCircle2 size={40} color="var(--teal)" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Ya eres parte de {inv.clinicNombre}</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 16px' }}>
            Entras como <strong style={{ color: 'var(--teal)' }}>{ROL_LABEL[inv.role]}</strong>.
          </p>

          {/* EL CORREO SE DICE. Se manda desde Firebase, así que aquí sólo se
              afirma lo que se sabe: que se pidió el envío, no que haya llegado. */}
          {envio?.enviado && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left',
              padding: '10px 12px', borderRadius: 10, marginBottom: 14,
              background: 'var(--nexus-soft)', border: '1px solid color-mix(in srgb, var(--nexus) 25%, transparent)',
            }}>
              <MailCheck size={16} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>
                Te mandamos un correo de confirmación a <strong style={{ color: 'var(--text)' }}>{envio.a}</strong>.
                Si no aparece en unos minutos, revisa el <strong>correo no deseado</strong>.
              </div>
            </div>
          )}
          {envio && !envio.enviado && (
            <div role="alert" style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left',
              padding: '10px 12px', borderRadius: 10, marginBottom: 14,
              background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)',
            }}>
              <MailWarning size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>
                Tu cuenta quedó creada, pero <strong>no pudimos enviar el correo de confirmación</strong> a {envio.a}.
                {' '}
                <button
                  type="button" onClick={reenviar} disabled={reenviando}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--teal)', fontWeight: 600, fontSize: 14, cursor: reenviando ? 'wait' : 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  {reenviando ? 'Enviando…' : 'Reintentar'}
                </button>
                {' '}o hazlo más tarde desde el panel.
              </div>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={entrar} style={{ width: '100%', justifyContent: 'center', minHeight: 48, fontSize: 16 }}>
            Entrar al panel
          </button>
        </div>
      </main>
    )
  }

  // Hay sesión abierta, pero NO es la de la persona invitada.
  if (user && !sesionCorrecta.ok) {
    return (
      <main style={contenedor}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <Marca />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Esta sesión no es la invitada</h1>
          <p role="alert" style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 18px' }}>{sesionCorrecta.motivo}</p>
          <button type="button" className="btn btn-primary" onClick={salirDeLaSesion} style={{ width: '100%', justifyContent: 'center', minHeight: 48, fontSize: 16 }}>
            Cerrar sesión y crear la cuenta invitada
          </button>
        </div>
      </main>
    )
  }

  // Hay sesión abierta y sí puede aceptar.
  if (user) {
    return (
      <main style={contenedor}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <Marca />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>Unirte a la clínica</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 6px' }}>
            <strong style={{ color: 'var(--text)' }}>{inv.clinicNombre}</strong> te invitó como{' '}
            <strong style={{ color: 'var(--teal)' }}>{ROL_LABEL[inv.role]}</strong>.
          </p>
          {/* De quién es la sesión, dicho fuerte y no como pie de página: es el
              dato que decide si se está creando una cuenta o usando la ajena. */}
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 18px' }}>
            Vas a unirte con la cuenta <strong style={{ color: 'var(--text)' }}>{user.email}</strong>.
          </p>
          {error && (
            <div role="alert" style={{
              background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              borderRadius: 6, padding: '10px 14px', fontSize: 14, color: 'var(--red)', marginBottom: 14, textAlign: 'left',
            }}>{error}</div>
          )}
          <button type="button" className="btn btn-primary" onClick={aceptar} disabled={aceptando} style={{ width: '100%', justifyContent: 'center', minHeight: 48, fontSize: 16 }}>
            {aceptando
              ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Uniéndote…</>
              : <><CheckCircle2 size={17} /> Aceptar y entrar</>}
          </button>
          <button
            type="button" onClick={salirDeLaSesion}
            style={{ marginTop: 14, minHeight: 44, background: 'none', border: 'none', color: 'var(--teal)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            No soy yo · crear una cuenta nueva
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    )
  }

  // SIN sesión: el alta ocurre AQUÍ, con contraseña a la vista.
  const puedeCrear = nombre.trim().length > 2 && email.includes('@') && password.length >= 6
  return (
    <main style={contenedor}>
      <div style={tarjeta}>
        <Marca />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', textAlign: 'center' }}>
          {inv.nombreInvitado ? `¡Hola, ${inv.nombreInvitado.split(' ')[0]}!` : '¡Te invitaron a una clínica!'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 20px', textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>{inv.clinicNombre}</strong> te invitó a unirte como{' '}
          <strong style={{ color: 'var(--teal)' }}>{ROL_LABEL[inv.role]}</strong>.
          Crea tu contraseña para entrar.
        </p>

        <form onSubmit={crearCuenta} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="label" htmlFor="unirse-nombre">Tu nombre completo</label>
            <input id="unirse-nombre" className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="María Pérez" autoFocus />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="unirse-correo">Correo electrónico</label>
            <input
              id="unirse-correo" className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="maria@email.com"
              readOnly={!!correoFijado}
              aria-describedby={correoFijado ? 'unirse-correo-fijo' : undefined}
            />
            {correoFijado && (
              <div id="unirse-correo-fijo" style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5 }}>
                La invitación es para esta dirección. Si no es la tuya, pide otra a tu clínica.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="label" htmlFor="unirse-contrasena">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="unirse-contrasena" className="input" type={showPwd ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" style={{ paddingRight: 44 }}
              />
              <button
                type="button" onClick={() => setShowPwd(s => !s)}
                aria-label={showPwd ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                style={{
                  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, display: 'flex', justifyContent: 'center', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0,
                }}
              >
                {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5 }}>
              Es <strong>tu</strong> contraseña, distinta de la de tu médico: la bitácora del consultorio
              tiene que poder decir quién hizo cada cosa.
            </div>
          </div>

          {error && (
            <div role="alert" style={{
              background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              borderRadius: 6, padding: '10px 14px', fontSize: 14, color: 'var(--red)',
            }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={!puedeCrear || creando} style={{ width: '100%', justifyContent: 'center', minHeight: 48, fontSize: 16 }}>
            {creando
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creando tu cuenta…</>
              : 'Crear mi cuenta y entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>o</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <BotonGoogle onClick={conGoogle} disabled={creando} />

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href={`/login?invite=${code}`} style={{ color: 'var(--teal)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Inicia sesión</Link>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  )
}
