'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { salirSeguro } from '@/lib/salir-seguro'

/**
 * Cierre automático de sesión por inactividad (control de seguridad LFPDPPP /
 * buenas prácticas para datos de salud). Tras INACTIVIDAD_MIN sin interacción,
 * avisa AVISO_SEG segundos antes y luego cierra la sesión.
 *
 * Diseño anti-interrupción: cualquier actividad reinicia el contador; el aviso
 * permite "Seguir conectado" antes de cerrar.
 *
 * ANTES DE CERRAR SE GUARDA LA NOTA EN EL SERVIDOR. El escenario que rompía esto
 * es el normal en consulta: el médico DICTA, y dictar no genera mousemove ni
 * teclas, así que a los 30 min se cerraba la sesión; se purgaban los borradores
 * locales (correcto: dispositivo compartido) y la consulta dictada desaparecía,
 * porque solo vivía en el respaldo del navegador. El aviso decía, mientras tanto,
 * "Tus borradores están a salvo".
 *
 * La purga local se mantiene —es el control de PHI en dispositivo compartido—,
 * pero primero se emite `nx:guardar-todo` y se le da un momento a la pantalla
 * abierta para persistir en Firestore, que es la fuente de verdad.
 */

/**
 * Se re-exporta desde su nuevo hogar (`lib/salir-seguro`) para no romper los
 * imports existentes. La lógica de guardar-y-esperar vive allí, no aquí: la
 * necesitan también el Sidebar y las dos salidas del layout.
 */
export { EVENTO_GUARDAR_TODO } from '@/lib/salir-seguro'

const INACTIVIDAD_MIN = 30           // minutos sin actividad
const AVISO_SEG = 60                 // segundos de aviso antes de cerrar
const MS = 60_000

export function AutoLogout() {
  const [avisando, setAvisando] = useState(false)
  const [restante, setRestante] = useState(AVISO_SEG)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null)
  // Espejo de `avisando` para leerlo en los listeners SIN re-montar el efecto
  // (antes `avisando` estaba en las deps y desmontaba el efecto al aparecer el
  // aviso, matando el countdown → el cierre por inactividad nunca ocurría).
  const avisandoRef = useRef(false)

  /**
   * La espera fija de 1200 ms se fue: ahora `salirSeguro` ESPERA el acuse del
   * guardado y sólo purga lo local si el trabajo llegó al servidor. Ver
   * `lib/salir-seguro.ts` para el porqué completo — en resumen, con la red
   * lenta se borraba a la vez el borrador, la cola de escrituras pendientes de
   * Firestore y el audio, mientras el aviso prometía lo contrario.
   */
  const cerrarSesion = useCallback(() => {
    void salirSeguro('/login?motivo=inactividad')
  }, [])

  const limpiar = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (countdown.current) clearInterval(countdown.current)
  }

  const iniciarAviso = useCallback(() => {
    setAvisando(true)
    avisandoRef.current = true
    setRestante(AVISO_SEG)
    countdown.current = setInterval(() => {
      setRestante(r => {
        if (r <= 1) { limpiar(); cerrarSesion(); return 0 }
        return r - 1
      })
    }, 1000)
  }, [cerrarSesion])

  const reiniciar = useCallback(() => {
    limpiar()
    setAvisando(false)
    avisandoRef.current = false
    idleTimer.current = setTimeout(iniciarAviso, INACTIVIDAD_MIN * MS)
  }, [iniciarAviso])

  useEffect(() => {
    // Throttle: no reiniciar en cada pixel de mousemove.
    let ultimo = 0
    const onActividad = () => {
      if (avisandoRef.current) return          // durante el aviso, solo el botón reactiva
      const ahora = Date.now()
      if (ahora - ultimo < 5000) return
      ultimo = ahora
      reiniciar()
    }
    const eventos: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    eventos.forEach(e => window.addEventListener(e, onActividad, { passive: true }))
    reiniciar()
    return () => {
      eventos.forEach(e => window.removeEventListener(e, onActividad))
      limpiar()
    }
    // El efecto ya NO depende de `avisando` → no se re-monta al aparecer el aviso.
  }, [reiniciar])

  if (!avisando) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--s1)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 26, textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>¿Sigues ahí?</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 20px' }}>
          Por seguridad, cerraremos tu sesión en <strong style={{ color: 'var(--nexus)' }}>{restante}s</strong> por
          inactividad. Guardaremos tu nota en el servidor antes de cerrar.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reiniciar} className="lift" style={{
            background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            Seguir conectado
          </button>
          <button onClick={cerrarSesion} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10,
            padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
