'use client'
/**
 * Guía de uso + Asistente de ayuda (bot). El contenido vive en
 * lib/ayuda/conocimiento.ts (misma fuente que alimenta al bot /api/ayuda-bot).
 * Secciones desplegables + buscador + filtro por rol + chat de ayuda arriba.
 */
import { useState, useMemo } from 'react'
import { GUIA, type Rol } from '@/lib/ayuda/conocimiento'
import { AsistenteChat } from '@/components/AsistenteChat'
import {
  BookOpen, Search, ChevronDown, Calendar, BedDouble, FileSignature,
  Settings, Users, CreditCard, Smartphone, Lightbulb, AlertTriangle, PlayCircle,
  Mic, Sparkles, FlaskConical, MessageSquare, ReceiptText, LifeBuoy,
} from 'lucide-react'

const ICONO: Record<string, React.ReactNode> = {
  inicio: <PlayCircle size={18} />, agenda: <Calendar size={18} />, voz: <Mic size={18} />,
  'menu-ia': <Sparkles size={18} />, corregir: <MessageSquare size={18} />, consultor: <FlaskConical size={18} />,
  analisis: <FlaskConical size={18} />, recetas: <FileSignature size={18} />, hospital: <BedDouble size={18} />,
  equipo: <Users size={18} />, facturas: <ReceiptText size={18} />, soporte: <LifeBuoy size={18} />,
  planes: <CreditCard size={18} />, navegacion: <Smartphone size={18} />, config: <Settings size={18} />,
}

const ROLES: { id: Rol; label: string }[] = [
  { id: 'todos', label: 'Todo' }, { id: 'recepcion', label: 'Recepción' },
  { id: 'medico', label: 'Médico' }, { id: 'enfermeria', label: 'Enfermería' }, { id: 'dueno', label: 'Dueño' },
]

function AsistenteAyuda() {
  return (
    <div style={{ border: '1px solid rgba(20,184,166,0.35)', borderRadius: 14, background: 'rgba(20,184,166,0.05)', padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        <Sparkles size={16} style={{ color: 'var(--teal)' }} /> Asistente de ayuda
      </div>
      <AsistenteChat alto={220} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function GuiaPage() {
  const [rol, setRol] = useState<Rol>('todos')
  const [q, setQ] = useState('')
  const [abierta, setAbierta] = useState<string | null>('inicio')

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return GUIA.filter(s => {
      const porRol = rol === 'todos' || s.roles.includes('todos') || s.roles.includes(rol)
      if (!porRol) return false
      if (!texto) return true
      const enTexto = (s.titulo + ' ' + s.intro + ' ' + s.pasos.map(p => p.t + ' ' + p.d).join(' ')).toLowerCase()
      return enTexto.includes(texto)
    })
  }, [rol, q])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <BookOpen size={24} className="ds-icon" style={{ color: 'var(--teal)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Guía de uso</h1>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text3)', margin: '0 0 16px' }}>
        Todo lo que hace la app, en pasos simples. Pregúntale al asistente o abre una sección.
      </p>

      <AsistenteAyuda />

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la guía (ej. receta, voz, créditos)…"
          style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s1)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
      </div>

      {/* Filtro por rol */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {ROLES.map(r => (
          <button key={r.id} onClick={() => setRol(r.id)} style={{
            fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
            border: '1px solid ' + (rol === r.id ? 'var(--teal)' : 'var(--border)'),
            background: rol === r.id ? 'rgba(20,184,166,0.1)' : 'var(--s2)', color: rol === r.id ? 'var(--teal)' : 'var(--text2)',
          }}>{r.label}</button>
        ))}
      </div>

      {/* Secciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map(s => {
          const open = abierta === s.id
          return (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', overflow: 'hidden' }}>
              <button onClick={() => setAbierta(open ? null : s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                <span style={{ color: 'var(--teal)', flexShrink: 0 }}>{ICONO[s.id] ?? <Lightbulb size={18} />}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, display: 'block' }}>{s.titulo}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{s.intro}</span>
                </span>
                <ChevronDown size={18} style={{ color: 'var(--text3)', flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
              </button>
              {open && (
                <div style={{ padding: '0 16px 16px 46px' }}>
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {s.pasos.map((p, i) => (
                      <li key={i} style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text)' }}>{p.t}.</strong> {p.d}
                      </li>
                    ))}
                  </ol>
                  {s.tips?.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 12.5, color: 'var(--text2)', background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8, padding: '9px 11px' }}>
                      <Lightbulb size={14} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} /> {t}
                    </div>
                  ))}
                  {s.ojo?.map((o, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12.5, color: 'var(--text2)', background: 'color-mix(in srgb, var(--amber) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)', borderRadius: 8, padding: '9px 11px' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} /> {o}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {visibles.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>Nada encontrado. Prueba otra palabra o pregúntale al asistente.</div>}
      </div>
    </div>
  )
}
