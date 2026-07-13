'use client'
/**
 * Error boundary de la CONSULTA. Antes, un throw en esta pantalla pintaba una
 * pantalla blanca total a media consulta. Ahora muestra un panel tranquilizador
 * — el audio y la nota se guardan en el dispositivo (IndexedDB/localStorage), no
 * se pierden — con un botón Reintentar (reset) que re-renderiza sin recargar.
 */
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function ConsultaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Consulta error boundary:', error) }, [error])
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={26} style={{ color: '#f59e0b' }} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Algo se atoró en esta pantalla</h1>
      <p style={{ fontSize: 14.5, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
        Tranquilo: <strong style={{ color: 'var(--text)' }}>tu audio y tu nota están guardados en este dispositivo</strong> y no se pierden.
        Toca “Reintentar”; si sigue, recarga la página y usa <strong style={{ color: 'var(--text)' }}>“Recuperar”</strong> para retomar tu grabación.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <RotateCcw size={16} /> Reintentar
        </button>
        <button onClick={() => location.reload()} style={{ background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Recargar página
        </button>
      </div>
    </div>
  )
}
