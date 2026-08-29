'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Página 404 personalizada con auto-recovery + diagnóstico de URL fallido.
 */
export default function NotFound() {
  const [intentando, setIntentando] = useState(false)
  const [urlFallido, setUrlFallido] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrlFallido(window.location.pathname + window.location.search)
    }
  }, [])

  /**
   * LA VERSIÓN QUE SE ENSEÑA ES LA QUE HAY, O NO SE ENSEÑA NADA.
   *
   * Aquí había un literal, `Build: 2026-06-03-ausculta`, escrito a mano. Este
   * recuadro es lo que el médico copia y manda cuando reporta «no me abre»,
   * así que soporte recibía un identificador falso —y desfasado por meses—
   * para localizar el despliegue.
   *
   * El sello real lo sirve `/version.txt`, que lo genera el build desde
   * `sw.js`: una sola fuente. Si no se puede leer, no se escribe nada. Una
   * versión inventada es peor que ninguna, porque nadie duda de ella.
   */
  useEffect(() => {
    let vivo = true
    fetch('/version.txt', { cache: 'no-store' })
      .then(r => (r.ok ? r.text() : ''))
      .then(t => { if (vivo) setVersion(t.trim()) })
      .catch(() => { /* sin sello: no se enseña ninguno */ })
    return () => { vivo = false }
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
      background: 'var(--bg)', color: 'var(--text)', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: 'var(--nexus)', marginBottom: 12, letterSpacing: '-0.04em' }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Página no encontrada</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
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
          {/* El enlace ES el control: un <button> dentro de un <a> es HTML
              inválido y deja dos paradas de teclado para un destino.
              (Antes decía aquí que esta página «vive FUERA del shell y no
              hereda sus tokens». No era cierto: `not-found` se pinta dentro
              del layout raíz, que carga `globals.css` — la prueba es que los
              `var(--nexus…)` de esta misma página funcionan. Lo que hacía la
              paleta fija era pintar de oscuro un 404 dentro de una app en
              claro.) */}
          <Link href="/dashboard" style={{
            background: 'transparent', color: 'var(--text)', border: '1px solid var(--border2)',
            padding: '12px 22px', borderRadius: 10, fontWeight: 500, fontSize: 14,
            cursor: 'pointer', minWidth: 140, letterSpacing: '-0.005em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}>
            Ir al dashboard
          </Link>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 24 }}>
          Si el problema persiste, cierra y vuelve a abrir la app desde tu pantalla de inicio.
        </div>

        {/* Diagnóstico — útil para reportar el problema */}
        {urlFallido && (
          <div style={{
            marginTop: 20, padding: '10px 14px', background: 'var(--s1)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 11,
            color: 'var(--text2)', fontFamily: 'ui-monospace, monospace',
            wordBreak: 'break-all', textAlign: 'left',
          }}>
            <div style={{ color: 'var(--text3)', marginBottom: 4 }}>URL fallida:</div>
            <div style={{ color: 'var(--text)' }}>{urlFallido}</div>
            {version && <div style={{ color: 'var(--text3)', marginTop: 8 }}>Versión: {version}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
