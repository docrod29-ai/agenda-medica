'use client'
/**
 * Soporte y sugerencias (usuario). Envía quejas, fallas, felicitaciones o dudas
 * al buzón del dueño. Se muestra en Configuración.
 */
import { useState } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { auth } from '@/lib/firebase'
import { LifeBuoy, Loader2, CheckCircle2 } from 'lucide-react'

const TIPOS: { v: string; label: string; emoji: string }[] = [
  { v: 'falla', label: 'Reportar una falla', emoji: '🐞' },
  { v: 'duda', label: 'Tengo una duda', emoji: '❓' },
  { v: 'sugerencia', label: 'Sugerencia', emoji: '💡' },
  { v: 'queja', label: 'Queja', emoji: '⚠️' },
  { v: 'felicitacion', label: 'Felicitación', emoji: '🎉' },
]

export default function SoporteSection({ clinicId, nombre }: { clinicId?: string; nombre?: string }) {
  const [tipo, setTipo] = useState('falla')
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const enviar = async () => {
    if (!mensaje.trim()) { setError('Escribe tu mensaje.'); return }
    setEnviando(true); setError('')
    try {
      const r = await fetchAutenticado('/api/soporte', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, mensaje, clinicId, nombre, email: auth.currentUser?.email ?? '' }),
      })
      const d = await r.json()
      if (d.ok) { setEnviado(true); setMensaje('') }
      else setError(d.error || 'No se pudo enviar.')
    } catch { setError('Error de conexión.') } finally { setEnviando(false) }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        <LifeBuoy size={17} style={{ color: 'var(--teal)' }} /> Soporte y sugerencias
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
        ¿Una falla, una duda, una idea? Cuéntanos — leemos todo.
      </div>

      {enviado ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--teal)', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 10, padding: '12px 14px' }}>
          <CheckCircle2 size={16} /> ¡Gracias! Recibimos tu mensaje. Te contactaremos si hace falta.
          <button onClick={() => setEnviado(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Enviar otro</button>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {TIPOS.map(t => (
              <button key={t.v} onClick={() => setTipo(t.v)}
                style={{
                  fontSize: 12.5, fontWeight: 600, padding: '6px 11px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                  border: '1px solid ' + (tipo === t.v ? 'var(--teal)' : 'var(--border)'),
                  background: tipo === t.v ? 'rgba(20,184,166,0.1)' : 'var(--s2)',
                  color: tipo === t.v ? 'var(--teal)' : 'var(--text2)',
                }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={4}
            placeholder="Escribe aquí lo que quieras contarnos…"
            style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, color: 'var(--text)', outline: 'none', resize: 'vertical' }} />
          {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{error}</div>}
          <button onClick={enviar} disabled={enviando}
            style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: enviando ? 'wait' : 'pointer' }}>
            {enviando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</> : 'Enviar'}
          </button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
