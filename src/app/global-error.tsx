'use client'
/**
 * Error boundary GLOBAL (root layout). Solo se activa si falla algo tan arriba
 * que ni el layout carga. Debe renderizar su propio <html>/<body>. Colores
 * fijos (no dependen de globals.css, que podría no haber cargado).
 */
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Global error boundary:', error) }, [error])
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#0B0C0E', color: '#F2EFE9', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px' }}>La app tuvo un problema</h1>
          <p style={{ fontSize: 14, color: '#B9BEC7', margin: '0 0 20px', lineHeight: 1.6 }}>
            Tus datos están a salvo. Vuelve a intentarlo o recarga la página.
          </p>
          <button onClick={() => reset()} style={{ background: '#3D5AFE', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
