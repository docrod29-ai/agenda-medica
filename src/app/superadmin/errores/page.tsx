'use client'
/**
 * Consola de errores del dueño (solo superadmin). Ve los errores no atrapados que
 * reportan los clientes en vivo, para arreglar sin depender de que te avisen.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAutenticado } from '@/lib/auth-client'
import { ArrowLeft, Bug, Loader2 } from 'lucide-react'

const fechaTxt = (iso: string) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

interface Err { id: string; mensaje: string; stack?: string; ruta?: string; ua?: string; origen?: string; email?: string; fecha: string; visto?: boolean }

export default function ErroresInbox() {
  const [errs, setErrs] = useState<Err[]>([])
  const [cargando, setCargando] = useState(true)
  const [soloNuevos, setSoloNuevos] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    fetchAutenticado('/api/errores').then(r => r.json())
      .then(d => { if (d.ok) setErrs(d.errores || []) })
      .catch(() => {}).finally(() => setCargando(false))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const marcar = async (id: string) => {
    setErrs(prev => prev.map(e => e.id === id ? { ...e, visto: true } : e))
    try { await fetchAutenticado('/api/errores', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, visto: true }) }) } catch { /* noop */ }
  }

  const lista = soloNuevos ? errs.filter(e => !e.visto) : errs
  const nuevos = errs.filter(e => !e.visto).length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 18px 80px' }}>
      <Link href="/superadmin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
        <ArrowLeft size={15} /> Volver a la consola
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <Bug size={20} style={{ color: 'var(--red)' }} /> Errores
        {nuevos > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--red-solido)', borderRadius: 'var(--r-pill)', padding: '2px 9px' }}>{nuevos}</span>}
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 18px' }}>Errores no atrapados que reportan los clientes en vivo. Sin datos de pacientes.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['nuevos', 'Nuevos'], ['todos', 'Todos']].map(([k, l]) => (
          <button key={k} onClick={() => setSoloNuevos(k === 'nuevos')}
            style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
              border: '1px solid ' + ((soloNuevos ? 'nuevos' : 'todos') === k ? 'var(--teal)' : 'var(--border)'),
              background: (soloNuevos ? 'nuevos' : 'todos') === k ? 'rgba(20,184,166,0.1)' : 'var(--s2)', color: (soloNuevos ? 'nuevos' : 'todos') === k ? 'var(--teal)' : 'var(--text2)' }}>{l}</button>
        ))}
        <button onClick={cargar} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text2)' }}>Refrescar</button>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', padding: 20 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: 20 }}>Sin errores {soloNuevos ? 'nuevos' : ''}. 🎉</div>
      ) : lista.map(e => (
        <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 13, marginBottom: 9, opacity: e.visto ? 0.6 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!e.visto && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />}
            <code style={{ fontSize: 12.5, color: 'var(--text)', fontFamily: 'ui-monospace, monospace', flex: 1, minWidth: 0 }}>{e.mensaje}</code>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fechaTxt(e.fecha)}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
            {e.origen && <span style={{ background: 'var(--s2)', borderRadius: 5, padding: '1px 7px' }}>{e.origen}</span>}
            {e.ruta && <span>{e.ruta}</span>}
            {e.email && <span>{e.email}</span>}
            {e.stack && <button onClick={() => setAbierto(abierto === e.id ? null : e.id)} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 0, fontSize: 11 }}>{abierto === e.id ? 'ocultar' : 'ver stack'}</button>}
            {!e.visto && <button onClick={() => marcar(e.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 0, fontSize: 11, textDecoration: 'underline' }}>marcar visto</button>}
          </div>
          {abierto === e.id && e.stack && (
            <pre style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', background: 'var(--s2)', borderRadius: 8, padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{e.stack}</pre>
          )}
        </div>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
