'use client'
/**
 * Pestaña de Seguridad (MFA/2FA) — extraída del monolito configuracion/page.tsx.
 * MOVE puro, sin cambio de comportamiento.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { iniciarEnrolamientoTotp, completarEnrolamientoTotp, listarFactores, desactivarFactor } from '@/lib/mfa'
import type { TotpSecret } from 'firebase/auth'
import { KeyRound, Lock } from 'lucide-react'
import { cfgInput } from './estilos'

export function SeguridadTab() {
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [factores, setFactores] = useState<{ uid: string; displayName?: string | null; enrollmentTime?: string; factorId?: string }[]>([])
  const [paso, setPaso] = useState<'idle' | 'enrolando' | 'verificando'>('idle')
  const [secret, setSecret] = useState<TotpSecret | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')   // QR generado LOCAL (el secreto no sale del navegador)
  const [manualKey, setManualKey] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aliasNuevo, setAliasNuevo] = useState('Llave principal')

  useEffect(() => { setFactores(listarFactores(user)) }, [user])

  // Genera el QR del TOTP en el navegador (antes se mandaba el otpauth con el
  // SECRETO a api.qrserver.com — fuga del secreto de 2FA a un tercero).
  useEffect(() => {
    if (!qrUrl) { setQrDataUrl(''); return }
    import('qrcode').then(QR => QR.toDataURL(qrUrl, { width: 220, margin: 2 }).then(setQrDataUrl).catch(() => {}))
  }, [qrUrl])

  const iniciar = async () => {
    setPaso('enrolando')
    try {
      const r = await iniciarEnrolamientoTotp('Agenda Médica')
      setSecret(r.secret)
      setQrUrl(r.qrCodeUrl)
      setManualKey(r.manualKey)
      setPaso('verificando')
    } catch (e) {
      const msg = (e as Error).message
      toast(msg.includes('multi-factor') ? 'Tu proyecto Firebase no tiene Identity Platform habilitado. Activalo en Firebase Console → Authentication.' : msg, 'error')
      setPaso('idle')
    }
  }

  const verificar = async () => {
    if (!secret) return
    try {
      await completarEnrolamientoTotp(secret, codigo.trim(), aliasNuevo || 'Llave TOTP')
      toast('2FA activado', 'success')
      setFactores(listarFactores(user))
      setPaso('idle')
      setSecret(null)
      setCodigo('')
    } catch (e) {
      toast(`Código inválido: ${(e as Error).message}`, 'error')
    }
  }

  const remover = async (uid: string) => {
    // confirm in-app: el nativo se ignora en silencio en la PWA instalada.
    if (!(await confirm('¿Quitar este factor 2FA?', { peligro: true, confirmar: 'Quitar' }))) return
    try {
      await desactivarFactor(uid)
      toast('Factor eliminado', 'success')
      setFactores(listarFactores(user))
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <div style={{ maxWidth: 600, display: 'grid', gap: 16 }}>
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Lock size={20} style={{ color: 'var(--teal)' }} />
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Autenticación de dos factores (2FA)</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.55 }}>
          Mejora la protección de tu expediente clínico. Después de tu contraseña, te pediremos
          un código de 6 dígitos generado por una app como Google Authenticator, Authy o 1Password.
          Recomendado por <strong>LFPDPPP Art. 19</strong> (medidas de seguridad razonables).
        </div>
      </div>

      {/* Factores actuales */}
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          Factores activos ({factores.length})
        </div>
        {factores.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 10, background: 'var(--s2)', borderRadius: 6, textAlign: 'center' }}>
            Aún no tienes 2FA configurado.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {factores.map(f => (
              <div key={f.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--s2)', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.displayName || 'Llave sin nombre'}</div>
                  {f.enrollmentTime && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Agregada {new Date(f.enrollmentTime).toLocaleDateString('es-MX')}</div>}
                </div>
                <button onClick={() => remover(f.uid)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activar nuevo */}
      {paso === 'idle' && (
        <button onClick={iniciar} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          <KeyRound size={15} /> Activar 2FA con app autenticadora
        </button>
      )}

      {paso === 'verificando' && (
        <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--teal)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            Paso 1: Escanea el QR con tu app
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrDataUrl && <img
              src={qrDataUrl}
              alt="QR TOTP"
              style={{ width: 200, height: 200, background: '#fff', padding: 8, borderRadius: 6 }}
            />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 4 }}>O pega esta clave manualmente:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center', padding: '6px 10px', background: 'var(--s2)', borderRadius: 6, marginBottom: 14, userSelect: 'all', wordBreak: 'break-all' }}>
            {manualKey}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Paso 2: Ingresa el código de 6 dígitos que muestra tu app
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              style={{ ...cfgInput, fontFamily: 'monospace', fontSize: 18, textAlign: 'center', letterSpacing: 4 }}
            />
            <input
              value={aliasNuevo}
              onChange={(e) => setAliasNuevo(e.target.value)}
              placeholder='Nombre para esta llave (ej "iPhone")'
              style={cfgInput}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setPaso('idle'); setSecret(null); setCodigo('') }} className="btn btn-secondary">Cancelar</button>
              <button onClick={verificar} disabled={codigo.length !== 6} className="btn btn-primary">
                Verificar y activar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

