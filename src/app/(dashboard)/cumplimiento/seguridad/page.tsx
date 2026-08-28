'use client'
/**
 * Configuración de seguridad de la cuenta — incluye 2FA opcional.
 *
 * Firebase Auth ofrece MFA con TOTP (Google Authenticator, Authy, 1Password).
 * Esta página guía al médico para enrollar/desenrollar su factor TOTP.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { multiFactor, TotpMultiFactorGenerator, TotpSecret, getMultiFactorResolver } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { ArrowLeft, Shield, ShieldCheck, AlertTriangle, Loader2, Smartphone, KeyRound, Check, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { useToast } from '@/context/ToastContext'

type Paso = 'estado' | 'instrucciones' | 'qr' | 'verificar' | 'completado'

export default function SeguridadPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [paso, setPaso] = useState<Paso>('estado')
  const [tieneTotp, setTieneTotp] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [secret, setSecret] = useState<TotpSecret | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [nombreFactor, setNombreFactor] = useState('Mi dispositivo')

  useEffect(() => {
    if (!user) return
    const mfaUser = multiFactor(user)
    const totp = mfaUser.enrolledFactors.find(f => f.factorId === 'totp')
    setTieneTotp(!!totp)
    setFactorId(totp?.uid ?? null)
  }, [user])

  /**
   * EL QR SE DIBUJA AQUÍ, NO EN UN TERCERO (REG-338).
   *
   * Antes esta pantalla componía `https://api.qrserver.com/...?data=<otpauth://>`
   * y lo ponía de `src` en un `<img>`. El `otpauth://` **lleva dentro el secreto
   * compartido del segundo factor**: pedirle el dibujo a un tercero le entrega,
   * en la cadena de consulta de una URL, la semilla que genera los códigos. Un
   * segundo factor cuya semilla viajó a un servidor ajeno ya no es un segundo
   * factor.
   *
   * La hermana `configuracion/secciones-seguridad.tsx` ya lo hacía en local, con
   * este mismo comentario. Había dos pantallas de enrolamiento y se arregló una.
   */
  useEffect(() => {
    if (!qrUrl) return
    // `vivo` y no un `setQrDataUrl('')` de entrada: escribir estado de forma
    // síncrona en el cuerpo del efecto encadena renders (lo caza el linter), y
    // aquí no hace falta — el QR sólo se pinta cuando hay `qrUrl`.
    let vivo = true
    import('qrcode')
      .then(QR => QR.toDataURL(qrUrl, { width: 220, margin: 2 }))
      .then(url => { if (vivo) setQrDataUrl(url) })
      .catch(() => { /* sin QR se puede seguir: la clave manual está debajo */ })
    return () => { vivo = false }
  }, [qrUrl])

  const iniciarEnrolar = async () => {
    if (!user) return
    setCargando(true)
    try {
      const mfaUser = multiFactor(user)
      const session = await mfaUser.getSession()
      const newSecret = await TotpMultiFactorGenerator.generateSecret(session)
      setSecret(newSecret)
      const url = newSecret.generateQrCodeUrl(user.email ?? 'medico', 'Agenda Médica')
      setQrUrl(url)
      setPaso('qr')
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/requires-recent-login') {
        toast('Por seguridad debes volver a iniciar sesión antes de activar 2FA', 'error')
      } else {
        toast(`Error: ${err.message ?? 'desconocido'}`, 'error')
      }
    } finally {
      setCargando(false)
    }
  }

  const verificarYEnrolar = async () => {
    if (!user || !secret) return
    setCargando(true)
    try {
      const mfaUser = multiFactor(user)
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, codigo.trim())
      await mfaUser.enroll(assertion, nombreFactor || 'Mi dispositivo')
      setTieneTotp(true)
      setPaso('completado')
      toast('2FA activado correctamente', 'success')
    } catch (e) {
      const err = e as { code?: string }
      if (err.code === 'auth/invalid-verification-code') {
        toast('Código incorrecto. Verifica los 6 dígitos y vuelve a intentar.', 'error')
      } else {
        toast('No se pudo verificar el código', 'error')
      }
    } finally {
      setCargando(false)
    }
  }

  const desactivar = async () => {
    if (!user || !factorId) return
    if (!(await confirm('¿Seguro que quieres desactivar 2FA? Tu cuenta quedará protegida solo por contraseña.', { peligro: true, confirmar: 'Desactivar 2FA' }))) return
    setCargando(true)
    try {
      const mfaUser = multiFactor(user)
      await mfaUser.unenroll(factorId)
      setTieneTotp(false)
      setFactorId(null)
      setPaso('estado')
      toast('2FA desactivado', 'info')
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err.code === 'auth/requires-recent-login') {
        toast('Vuelve a iniciar sesión antes de modificar 2FA', 'error')
      } else {
        toast(`Error: ${err.message ?? 'desconocido'}`, 'error')
      }
    } finally {
      setCargando(false)
    }
  }

  if (!user) {
    return <Spinner center label="Cargando…" />
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <button onClick={() => router.push('/cumplimiento')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', color: 'var(--text3)',
        fontSize: 13, cursor: 'pointer', marginBottom: 14,
      }}>
        <ArrowLeft size={14} /> Cumplimiento
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Shield size={22} color="var(--teal)" />
        <h1 className="t-h1" style={{ margin: 0 }}>Seguridad de la cuenta</h1>
      </div>

      {/* PASO: estado actual */}
      {paso === 'estado' && (
        <div>
          <Estado activo={tieneTotp} email={user.email ?? ''} />
          <div style={{ marginTop: 16 }}>
            {tieneTotp ? (
              <Button variant="danger" loading={cargando} icon={<X size={14} />} onClick={desactivar}>Desactivar 2FA</Button>
            ) : (
              <Button icon={<Shield size={14} />} onClick={() => setPaso('instrucciones')}>Activar 2FA</Button>
            )}
          </div>
        </div>
      )}

      {/* PASO: instrucciones */}
      {paso === 'instrucciones' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>¿Cómo funciona el 2FA?</h2>
          <ol style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 20, margin: '0 0 16px' }}>
            <li>Instala en tu celular una app autenticadora (recomendado: Google Authenticator, Authy, 1Password)</li>
            <li>Te mostraré un código QR — lo escaneas con la app</li>
            <li>La app generará códigos de 6 dígitos que cambian cada 30 segundos</li>
            <li>Al iniciar sesión, además de tu contraseña, te pediré el código actual</li>
          </ol>
          <div style={{
            padding: 10, background: 'color-mix(in srgb, var(--amber) 6%, transparent)', borderLeft: '2px solid #f59e0b',
            borderRadius: 4, fontSize: 12, color: 'var(--text2)', marginBottom: 14,
            display: 'flex', alignItems: 'flex-start', gap: 7,
          }}>
            <AlertTriangle size={14} className="ds-icon" style={{ marginTop: 1, flexShrink: 0, color: 'var(--amber)' }} />
            <span>Si pierdes tu celular y no tienes el código de recuperación, NO podrás iniciar sesión.
            Guarda el código de respaldo que te daré después.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPaso('estado')} className="btn btn-secondary">Cancelar</button>
            <button onClick={iniciarEnrolar} disabled={cargando} className="btn btn-primary">
              {cargando ? <><Loader2 size={14} className="spin" /> Generando…</> : <>Continuar <Smartphone size={14} /></>}
            </button>
          </div>
        </div>
      )}

      {/* PASO: QR */}
      {paso === 'qr' && qrUrl && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Escanea el código QR</h2>
          <div style={{ textAlign: 'center', padding: 18, background: '#fff', borderRadius: 10, marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrDataUrl
              ? <img src={qrDataUrl} alt="QR para 2FA" style={{ width: 220, height: 220 }} />
              : <div style={{ width: 220, height: 220, display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>Generando el código…</div>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14 }}>
            ¿No puedes escanear? Copia este código en tu app:<br />
            <code style={{ display: 'block', fontFamily: 'monospace', padding: 8, marginTop: 4, background: 'var(--s2)', borderRadius: 4, wordBreak: 'break-all' }}>
              {secret?.secretKey}
            </code>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPaso('instrucciones')} className="btn btn-secondary">Atrás</button>
            <button onClick={() => setPaso('verificar')} className="btn btn-primary">Ya lo escaneé →</button>
          </div>
        </div>
      )}

      {/* PASO: verificar código */}
      {paso === 'verificar' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Confirma el código</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
            Abre la app autenticadora y escribe el código de 6 dígitos que está mostrando para Agenda Médica.
          </p>

          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
            Nombre del dispositivo (opcional)
          </label>
          <input
            value={nombreFactor}
            onChange={(e) => setNombreFactor(e.target.value)}
            placeholder="iPhone de Dr. García"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
              fontSize: 13, boxSizing: 'border-box', marginBottom: 12,
            }}
          />

          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
            Código de 6 dígitos
          </label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
              fontSize: 22, fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center',
              boxSizing: 'border-box', marginBottom: 14,
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPaso('qr')} className="btn btn-secondary">Atrás</button>
            <button onClick={verificarYEnrolar} disabled={cargando || codigo.length !== 6} className="btn btn-primary">
              {cargando ? <><Loader2 size={14} className="spin" /> Verificando…</> : <><Check size={14} /> Activar 2FA</>}
            </button>
          </div>
        </div>
      )}

      {/* PASO: completado */}
      {paso === 'completado' && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <ShieldCheck size={48} color="#10b981" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>2FA activado</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18, lineHeight: 1.6 }}>
            A partir de ahora, cada vez que inicies sesión te pediré además de tu contraseña
            el código de 6 dígitos de tu app autenticadora.
          </p>
          <button onClick={() => setPaso('estado')} className="btn btn-primary">Volver</button>
        </div>
      )}

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function Estado({ activo, email }: { activo: boolean; email: string }) {
  return (
    <div style={{
      padding: 18, borderRadius: 12, border: `1px solid ${activo ? 'rgba(16,185,129,0.3)' : 'color-mix(in srgb, var(--amber) 30%, transparent)'}`,
      background: activo ? 'rgba(16,185,129,0.04)' : 'color-mix(in srgb, var(--amber) 4%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {activo ? <ShieldCheck size={20} color="#10b981" /> : <AlertTriangle size={20} color="var(--amber)" />}
        <span style={{ fontSize: 15, fontWeight: 700, color: activo ? '#10b981' : '#f59e0b' }}>
          {activo ? '2FA activo' : '2FA NO está activo'}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
        Cuenta: <strong>{email}</strong><br />
        {activo
          ? 'Tu sesión está protegida con un segundo factor de autenticación (TOTP).'
          : 'Tu cuenta solo está protegida por contraseña. Activar 2FA agrega una capa extra contra accesos no autorizados.'}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  padding: 20, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12,
}

// Imports no usados: suprimimos warnings de no-unused
void getMultiFactorResolver
