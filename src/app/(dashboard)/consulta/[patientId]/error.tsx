'use client'
/**
 * Error boundary de la CONSULTA. Antes, un throw en esta pantalla pintaba una
 * pantalla blanca total a media consulta. Ahora muestra un panel tranquilizador
 * — el audio y la nota se guardan en el dispositivo (IndexedDB/localStorage), no
 * se pierden — con un botón Reintentar (reset) que re-renderiza sin recargar.
 */
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { reportarError } from '@/lib/reportar-error'

/**
 * ¿El error es «no pude bajar un trozo de la aplicación»?
 *
 * ── POR QUÉ SE DISTINGUE (REG-218) ──────────────────────────────────────────
 *
 * La consulta carga ocho piezas bajo demanda y la app tiene service worker. En
 * un celular con red inestable —o justo después de un despliegue, cuando los
 * archivos viejos ya no existen— esa descarga falla y React lanza en el render.
 *
 * Y aquí está lo importante: para ESTE error, **«Reintentar» no puede
 * funcionar**. `reset()` vuelve a renderizar el mismo árbol y el trozo sigue sin
 * estar. El médico pulsa, ve lo mismo, y concluye que la aplicación se rompió.
 *
 * La única salida real es recargar, que pide el índice nuevo y con él los
 * archivos que sí existen. Así que para este caso el botón principal recarga.
 */
function esTrozoQueNoCargo(e: Error): boolean {
  const t = `${e?.name ?? ''} ${e?.message ?? ''}`.toLowerCase()
  return t.includes('chunkloaderror')
    || t.includes('loading chunk')
    || t.includes('failed to fetch dynamically imported module')
    || t.includes('importing a module script failed')
    || t.includes('error loading dynamically imported module')
}

export default function ConsultaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const trozo = esTrozoQueNoCargo(error)
  useEffect(() => {
    console.error('Consulta error boundary:', error)
    // El origen distingue los dos casos en el registro: sin esto, «Algo se
    // atoró» son cinco fallos distintos bajo un mismo mensaje.
    reportarError(error.message, {
      stack: error.stack,
      origen: trozo ? 'boundary:consulta:chunk' : 'boundary:consulta',
    })
  }, [error, trozo])
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={26} style={{ color: 'var(--amber)' }} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        {trozo ? 'Falta bajar una parte de la aplicación' : 'Algo se atoró en esta pantalla'}
      </h1>
      <p style={{ fontSize: 14.5, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
        Tranquilo: <strong style={{ color: 'var(--text)' }}>tu audio y tu nota están guardados en este dispositivo</strong> y no se pierden.{' '}
        {trozo
          ? <>Suele pasar con la red del celular o justo después de una actualización. <strong style={{ color: 'var(--text)' }}>Recarga</strong> y usa “Recuperar” para retomar tu grabación.</>
          : <>Toca “Reintentar”; si sigue, recarga la página y usa <strong style={{ color: 'var(--text)' }}>“Recuperar”</strong> para retomar tu grabación.</>}
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/*
          El botón principal cambia según el error. Para un trozo que no cargó,
          «Reintentar» no puede funcionar —el trozo sigue sin estar— y ofrecerlo
          como acción principal enseña al médico que la app no responde.
        */}
        {trozo ? (
          <button onClick={() => location.reload()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <RotateCcw size={16} /> Recargar
          </button>
        ) : (
          <>
            <button onClick={() => reset()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              <RotateCcw size={16} /> Reintentar
            </button>
            <button onClick={() => location.reload()} style={{ background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Recargar página
            </button>
          </>
        )}
      </div>
    </div>
  )
}
