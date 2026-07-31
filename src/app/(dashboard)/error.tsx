'use client'
/**
 * Error boundary de TODO el dashboard: cualquier pantalla que lance un error
 * muestra este panel en vez de una pantalla blanca. Con Reintentar (reset).
 */
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { reportarError } from '@/lib/reportar-error'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Dashboard error boundary:', error); reportarError(error.message, { stack: error.stack, origen: 'boundary:dashboard' }) }, [error])
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={24} style={{ color: 'var(--amber)' }} />
      </div>
      <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Algo salió mal</h1>
      <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
        Ocurrió un error en esta pantalla. Tus datos están a salvo. Intenta de nuevo.
      </p>
      <button onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
        <RotateCcw size={16} /> Reintentar
      </button>
    </div>
  )
}
