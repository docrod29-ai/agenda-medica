'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { obtenerInvitacion, esValida, aceptarInvitacion, type Invitacion, type RolInvitacion } from '@/lib/invitations'
import { Stethoscope, Loader2, CheckCircle2, AlertTriangle, UserPlus } from 'lucide-react'
import { MarcaAusculta } from '@/components/MarcaAusculta'

const ROL_LABEL: Record<RolInvitacion, string> = {
  secretaria: 'asistente',
  medico: 'médico',
  admin: 'administrador',
  enfermeria: 'enfermería',
  farmacia: 'farmacia',
  laboratorio: 'laboratorio',
}

export default function UnirsePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [inv, setInv] = useState<Invitacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aceptando, setAceptando] = useState(false)
  const [aceptado, setAceptado] = useState(false)

  useEffect(() => {
    if (!code) return
    obtenerInvitacion(code).then(i => {
      if (!i) { setError('Invitación no encontrada o el enlace es incorrecto.'); setLoading(false); return }
      const v = esValida(i)
      if (!v.ok) { setError(v.motivo); setLoading(false); return }
      setInv(i)
      setLoading(false)
    }).catch(() => {
      setError('No se pudo cargar la invitación. Verifica el enlace.')
      setLoading(false)
    })
  }, [code])

  const aceptar = async () => {
    if (!inv || !user) return
    setAceptando(true)
    try {
      const r = await aceptarInvitacion(code, { uid: user.uid, email: user.email ?? '' })
      if (r.ok) {
        setAceptado(true)
        setTimeout(() => router.replace('/dashboard'), 1500)
      } else {
        setError(r.motivo ?? 'No se pudo aceptar')
      }
    } catch {
      setError('Error al aceptar la invitación.')
    } finally {
      setAceptando(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom))',
  }
  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: 460, background: 'var(--s1)',
    border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', textAlign: 'center',
  }

  if (loading || authLoading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Cargando invitación…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <AlertTriangle size={36} color="var(--red)" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Enlace no válido</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 18px' }}>{error}</p>
          {/* Si el problema es que ya pertenece a otra clínica, ofrecer SALIDA clara. */}
          {user && /otra clínica/i.test(error) && (
            <button onClick={() => import('firebase/auth').then(({ getAuth, signOut }) => signOut(getAuth()))}
              style={{ display: 'block', width: '100%', marginBottom: 12, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--teal)', color: '#040b12', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Cerrar sesión para aceptar con otra cuenta
            </button>
          )}
          <Link href="/" style={{ color: 'var(--teal)', textDecoration: 'underline', fontSize: 13 }}>Ir al inicio</Link>
        </div>
      </div>
    )
  }

  if (aceptado) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <CheckCircle2 size={40} color="var(--teal)" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>¡Bienvenida!</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Entrando al panel…</p>
        </div>
      </div>
    )
  }

  // Invitación válida — usuario sin sesión
  if (!user) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--s1)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <MarcaAusculta size={28} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>
            {inv?.nombreInvitado ? `¡Hola, ${inv.nombreInvitado.split(' ')[0]}!` : '¡Te invitaron a una clínica!'}
          </h1>
          <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 20px' }}>
            <strong style={{ color: 'var(--text)' }}>{inv?.clinicNombre}</strong> te invitó a unirte como{' '}
            <strong style={{ color: 'var(--teal)' }}>{ROL_LABEL[inv!.role]}</strong>.
            Crea tu cuenta para entrar.
          </p>
          <Link
            href={`/registro?invite=${code}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--nexus-solido)', color: '#fff', fontWeight: 600,
              fontSize: 15, padding: '12px 22px', borderRadius: 12, textDecoration: 'none',
            }}
          >
            <UserPlus size={17} /> Crear mi cuenta
          </Link>
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text3)' }}>
            ¿Ya tienes cuenta?{' '}
            <Link href={`/login?invite=${code}`} style={{ color: 'var(--teal)' }}>Inicia sesión</Link>
          </div>
        </div>
      </div>
    )
  }

  // Usuario logueado — pedir confirmación para aceptar
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--s1)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <MarcaAusculta size={28} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>Unirte a la clínica</h1>
        <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 6px' }}>
          <strong style={{ color: 'var(--text)' }}>{inv?.clinicNombre}</strong> te invitó como{' '}
          <strong style={{ color: 'var(--teal)' }}>{ROL_LABEL[inv!.role]}</strong>.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 20px' }}>
          Conectado como {user.email}
        </p>
        <button
          onClick={aceptar}
          disabled={aceptando}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--nexus-solido)', color: '#fff', fontWeight: 600,
            fontSize: 15, padding: '12px 24px', borderRadius: 12, border: 'none',
            cursor: aceptando ? 'default' : 'pointer',
          }}
        >
          {aceptando
            ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Uniéndote…</>
            : <><CheckCircle2 size={17} /> Aceptar y entrar</>}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
