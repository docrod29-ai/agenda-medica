'use client'
/**
 * Página pública de teleconsulta.
 * Carga la sala de Daily.co en un iframe (no requiere SDK adicional para v1).
 * Disponible 30 min antes y hasta 2 h después de la cita.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, Video, AlertTriangle, Stethoscope, Pill, FileText, ExternalLink } from 'lucide-react'

export default function TeleconsultaPage() {
  const { citaId } = useParams<{ citaId: string }>()
  const search = useSearchParams()
  const clinicId = search.get('c') ?? ''
  // Modo médico: panel lateral con nota IA + receta (el paciente NO lleva estos params)
  const esMedico = search.get('dr') === '1'
  const patientId = search.get('p') ?? ''
  const [url, setUrl] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!citaId || !clinicId) { setError('Enlace incompleto'); return }
    fetch('/api/telesalud/sala', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citaId, clinicId, token: search.get('t') ?? undefined }),
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        setUrl(data.url)
        if (data.warning) setWarn(data.warning)
      } else {
        setError(data.error ?? 'No se pudo cargar la sala')
      }
    }).catch(() => setError('Error de conexión'))
  }, [citaId, clinicId])

  if (error) {
    return (
      <Centered>
        <AlertTriangle size={32} color="#f87171" style={{ margin: '0 auto 10px' }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>No disponible</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>{error}</p>
      </Centered>
    )
  }
  if (!url) {
    return (
      <Centered>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Preparando la sala de video…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Centered>
    )
  }

  const mostrarPanel = esMedico && patientId
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 48, background: 'var(--s1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
        <Video size={16} color="var(--teal)" />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>Teleconsulta</span>
        {warn && <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> {warn}</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <iframe
          src={url}
          title="Teleconsulta"
          allow="camera; microphone; fullscreen; speaker; display-capture"
          style={{ flex: 1, border: 0, width: '100%', minWidth: 0 }}
        />
        {mostrarPanel && (
          <aside style={{ width: 280, flexShrink: 0, background: 'var(--bg)', borderLeft: '1px solid var(--border)', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="t-overline" style={{ color: 'var(--nexus)' }}>Herramientas del médico</div>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 4px', lineHeight: 1.5 }}>
              Documenta la consulta sin salir de la llamada. Se abre en otra pestaña.
            </p>
            <a href={`/consulta/${patientId}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
              <Stethoscope size={16} /> Nota con IA (dictado)
            </a>
            <a href={`/expediente/${patientId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              <FileText size={16} /> Expediente
            </a>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <Pill size={12} className="ds-icon" style={{ verticalAlign: '-2px' }} /> La receta y la orden se generan desde la nota (al firmarla).
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}
