'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Página 404 personalizada con auto-recovery + diagnóstico de URL fallido.
 */
export default function NotFound() {
  const [intentando, setIntentando] = useState(false)
  const [urlFallido, setUrlFallido] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrlFallido(window.location.pathname + window.location.search)
    }
  }, [])

  const reintentarLimpio = async () => {
    setIntentando(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      // Reset flags para forzar re-corrida del kill-switch
      try { localStorage.removeItem('__am_sw_reset_v6') } catch {}
    } finally {
      window.location.replace('/dashboard')
    }
  }

  // Auto-intento al cargar (silencioso, solo una vez por sesión)
  useEffect(() => {
    const KEY = '__am_404_autofix'
    try {
      if (sessionStorage.getItem(KEY)) return
      sessionStorage.setItem(KEY, '1')
      // Si el SW está activo, intentar limpiarlo automáticamente
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => {
          if (rs.length > 0) {
            Promise.all(rs.map(r => r.unregister())).then(() => {
              if ('caches' in window) {
                return caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
              }
            }).then(() => window.location.reload()).catch(() => {})
          }
        }).catch(() => {})
      }
    } catch {}
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      background: '#0B0C0E', color: '#F2EFE9', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: 'var(--nexus)', marginBottom: 12, letterSpacing: '-0.04em' }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Página no encontrada</h1>
        <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.6, marginBottom: 24 }}>
          Es posible que tu navegador esté usando una versión vieja de la app.
          Toca <strong>Reintentar</strong> para limpiar la caché y volver al inicio.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reintentarLimpio}
            disabled={intentando}
            style={{
              background: 'var(--nexus-solido)', color: '#fff', border: 'none',
              padding: '12px 22px', borderRadius: 10, fontWeight: 600, fontSize: 14,
              cursor: 'pointer', minWidth: 140, letterSpacing: '-0.005em',
            }}
          >
            {intentando ? 'Limpiando…' : 'Reintentar'}
          </button>
          <Link href="/dashboard">
            <button style={{
              background: 'transparent', color: '#F2EFE9', border: '1px solid rgba(242,239,233,0.14)',
              padding: '12px 22px', borderRadius: 10, fontWeight: 500, fontSize: 14,
              cursor: 'pointer', minWidth: 140, letterSpacing: '-0.005em',
            }}>
              Ir al dashboard
            </button>
          </Link>
        </div>

        <div style={{ fontSize: 12, color: '#6C7075', marginTop: 24 }}>
          Si el problema persiste, cierra y vuelve a abrir la app desde tu pantalla de inicio.
        </div>

        {/* Diagnóstico — útil para reportar el problema */}
        {urlFallido && (
          <div style={{
            marginTop: 20, padding: '10px 14px', background: '#131518',
            border: '1px solid rgba(242,239,233,0.08)', borderRadius: 8, fontSize: 11,
            color: '#A8ACAE', fontFamily: 'ui-monospace, monospace',
            wordBreak: 'break-all', textAlign: 'left',
          }}>
            <div style={{ color: '#6C7075', marginBottom: 4 }}>URL fallida:</div>
            <div style={{ color: '#F2EFE9' }}>{urlFallido}</div>
            <div style={{ color: '#6C7075', marginTop: 8 }}>Build: 2026-06-03-ausculta</div>
          </div>
        )}
      </div>
    </div>
  )
}
