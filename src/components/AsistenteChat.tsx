'use client'
/**
 * Chat del asistente de ayuda (bot). Conversación + input + sugerencias.
 * Reutilizable: va embebido en la Guía y en el botón flotante de ayuda.
 * Toda la lógica de red vive aquí; habla con /api/ayuda-bot.
 */
import { useState, useRef, useEffect } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { Send, Loader2 } from 'lucide-react'

export type Turno = { rol: 'user' | 'bot'; texto: string }

const SUGERENCIAS = [
  '¿Cómo hago una nota por voz?',
  '¿Qué diferencia hay entre los motores de IA?',
  '¿Cómo funcionan los créditos?',
  '¿Cómo pido factura?',
]

export function AsistenteChat({ alto = 300 }: { alto?: number }) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [q, setQ] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turnos, cargando])

  const preguntar = async (texto: string) => {
    const t = texto.trim()
    if (!t || cargando) return
    setQ('')
    const nuevos: Turno[] = [...turnos, { rol: 'user', texto: t }]
    setTurnos(nuevos); setCargando(true)
    try {
      const r = await fetchAutenticado('/api/ayuda-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: t, historial: nuevos.map(x => ({ rol: x.rol, texto: x.texto })) }),
      })
      const d = await r.json()
      setTurnos([...nuevos, { rol: 'bot', texto: d.ok ? d.respuesta : (d.error || 'No pude responder.') }])
    } catch {
      setTurnos([...nuevos, { rol: 'bot', texto: 'Error de conexión. Intenta de nuevo.' }])
    } finally { setCargando(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: alto, maxHeight: alto, overflowY: 'auto', marginBottom: 10, paddingRight: 2 }}>
        {turnos.length === 0 && !cargando && (
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', textAlign: 'center', marginBottom: 2 }}>
              Pregúntame cómo usar la app.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {SUGERENCIAS.map(s => (
                <button key={s} onClick={() => preguntar(s)}
                  style={{ fontSize: 12, color: 'var(--teal)', background: 'var(--s1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 'var(--r-pill)', padding: '5px 11px', cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {turnos.map((t, i) => (
          <div key={i} style={{ alignSelf: t.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', fontSize: 13, lineHeight: 1.5, padding: '9px 12px', borderRadius: 12, whiteSpace: 'pre-wrap', background: t.rol === 'user' ? 'var(--nexus-solido)' : 'var(--s2)', color: t.rol === 'user' ? '#FFF' : 'var(--text)', border: t.rol === 'bot' ? '1px solid var(--border)' : 'none' }}>
            {t.texto}
          </div>
        ))}
        {cargando && <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Pensando…</div>}
        <div ref={finRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') preguntar(q) }}
          placeholder="Escribe tu pregunta…" disabled={cargando}
          style={{ flex: 1, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: 'var(--text)', outline: 'none' }} />
        <button onClick={() => preguntar(q)} disabled={cargando || !q.trim()} aria-label="Enviar"
          style={{ flexShrink: 0, width: 42, borderRadius: 10, border: 'none', cursor: cargando || !q.trim() ? 'default' : 'pointer', background: cargando || !q.trim() ? 'var(--s3)' : 'var(--nexus-solido)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cargando ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
