'use client'
/**
 * Buzón de soporte del dueño (solo superadmin). Lee quejas, fallas,
 * felicitaciones, dudas y sugerencias que envían los usuarios, y las marca como
 * vistas o resueltas. El gate real lo hace el servidor.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, LifeBuoy, Loader2 } from 'lucide-react'

const META: Record<string, { label: string; emoji: string; color: string }> = {
  falla:        { label: 'Falla',        emoji: '🐞', color: 'var(--red)' },
  duda:         { label: 'Duda',         emoji: '❓', color: 'var(--blue)' },
  sugerencia:   { label: 'Sugerencia',   emoji: '💡', color: 'var(--amber)' },
  queja:        { label: 'Queja',        emoji: '⚠️', color: 'var(--amber)' },
  felicitacion: { label: 'Felicitación', emoji: '🎉', color: 'var(--green)' },
}
const fechaTxt = (iso: string) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

interface Msg { id: string; tipo: string; mensaje: string; nombre?: string; email?: string; estado: string; fecha: string; clinicId?: string }

export default function SoporteInbox() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<string>('todos')

  const cargar = useCallback(() => {
    setCargando(true)
    fetchAutenticado('/api/soporte').then(r => r.json())
      .then(d => { if (d.ok) setMsgs(d.mensajes || []) })
      .catch(() => {}).finally(() => setCargando(false))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const marcar = async (id: string, estado: string) => {
    setMsgs(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
    try {
      await fetchAutenticado('/api/soporte', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }) })
    } catch { /* noop */ }
  }

  const lista = filtro === 'todos' ? msgs : filtro === 'pendientes' ? msgs.filter(m => m.estado !== 'resuelto') : msgs.filter(m => m.tipo === filtro)
  const nuevos = msgs.filter(m => m.estado === 'nuevo').length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <LifeBuoy size={20} style={{ color: 'var(--teal)' }} /> Soporte
        {nuevos > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#FFF', background: 'var(--red)', borderRadius: 'var(--r-pill)', padding: '2px 9px' }}>{nuevos} nuevo{nuevos === 1 ? '' : 's'}</span>}
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px' }}>Quejas, fallas, felicitaciones, dudas y sugerencias de tus usuarios.</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['pendientes', 'todos', 'falla', 'duda', 'sugerencia', 'queja', 'felicitacion'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              border: '1px solid ' + (filtro === f ? 'var(--teal)' : 'var(--border)'),
              background: filtro === f ? 'rgba(20,184,166,0.1)' : 'var(--s2)', color: filtro === f ? 'var(--teal)' : 'var(--text2)' }}>
            {f === 'pendientes' ? 'Pendientes' : f === 'todos' ? 'Todos' : (META[f]?.emoji + ' ' + META[f]?.label)}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: 20 }}>Sin mensajes.</div>
      ) : lista.map(m => {
        const meta = META[m.tipo] ?? META.duda
        return (
          <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14, marginBottom: 10, opacity: m.estado === 'resuelto' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, borderRadius: 6, padding: '2px 8px' }}>{meta.emoji} {meta.label}</span>
              {m.estado === 'nuevo' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FFF', background: 'var(--red)', borderRadius: 6, padding: '2px 7px' }}>NUEVO</span>}
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{m.nombre || m.email || 'Anónimo'}{m.email && m.nombre ? ` · ${m.email}` : ''}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text3)', marginLeft: 'auto' }}>{fechaTxt(m.fecha)}</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.mensaje}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {m.estado !== 'resuelto' && <button onClick={() => marcar(m.id, 'resuelto')} style={{ fontSize: 12, fontWeight: 600, background: 'var(--nexus-solido)', color: '#FFF', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Marcar resuelto</button>}
              {m.estado === 'nuevo' && <button onClick={() => marcar(m.id, 'visto')} style={{ fontSize: 12, fontWeight: 600, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Marcar visto</button>}
              {m.estado === 'resuelto' && <button onClick={() => marcar(m.id, 'visto')} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reabrir</button>}
              {m.email && <a href={`mailto:${m.email}`} style={{ fontSize: 12, color: 'var(--nexus, #3D5AFE)', textDecoration: 'none', alignSelf: 'center' }}>Responder por correo →</a>}
            </div>
          </div>
        )
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
