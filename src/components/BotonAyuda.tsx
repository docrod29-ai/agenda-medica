'use client'
/**
 * Ayuda del dashboard: el panel del asistente (bot) sin salir de donde estás.
 *
 * ── RTC-05 (registro canónico del equipo rojo) ──────────────────────────────
 *
 * El FAB de 52px vivía en la esquina del pulgar de TODAS las pantallas: en
 * móvil ocluía trabajo clínico en 4 de 6 superficies (el médico mandó
 * capturas con el botón encima de «Peso» y de «Exploración física») y no se
 * enteraba de la grabación. Ahora:
 *
 *  - En MÓVIL el FAB no existe (CSS ≤768px): el trigger es un botón ESTÁTICO
 *    de la topbar — cero oclusión, fuera del arco del pulgar — que despacha
 *    `EVENTO_ABRIR_AYUDA`. El nombre se declara AQUÍ una vez y el layout lo
 *    importa (la lección de `estoy-grabando`: una cadena repetida en dos
 *    archivos es una compuerta que se abre sola).
 *  - En ESCRITORIO sigue flotando abajo-derecha (ahí la esquina no ocluye la
 *    columna clínica), con sombra del sistema — el halo teal murió (RTC-19).
 *  - GRABANDO desaparece entero (FAB y panel) y vuelve al detener — §8.5 por
 *    la compuerta compartida `@/hooks/useGrabando`, no una copia privada.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AsistenteChat } from '@/components/AsistenteChat'
import { useGrabando } from '@/hooks/useGrabando'
import { HelpCircle, X, BookOpen } from 'lucide-react'

/** Lo despacha el trigger de la topbar móvil; lo escucha este componente. */
export const EVENTO_ABRIR_AYUDA = 'nx:abrir-ayuda'

export function BotonAyuda() {
  const [abierto, setAbierto] = useState(false)
  const grabando = useGrabando()

  useEffect(() => {
    const abrir = () => setAbierto(v => !v)
    window.addEventListener(EVENTO_ABRIR_AYUDA, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_AYUDA, abrir)
  }, [])

  if (grabando) return null

  return (
    <>
      <button
        onClick={() => setAbierto(v => !v)}
        aria-label={abierto ? 'Cerrar ayuda' : 'Abrir ayuda'}
        className="boton-ayuda-fab"
        style={{
          position: 'fixed', right: 20, zIndex: 60, width: 52, height: 52, borderRadius: '50%',
          border: 'none', cursor: 'pointer', background: 'var(--nexus-solido)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--elev-2)',
        }}
      >
        {abierto ? <X size={24} /> : <HelpCircle size={26} />}
      </button>

      {abierto && (
        <div
          className="boton-ayuda-panel"
          role="dialog"
          aria-label="Asistente de ayuda"
          style={{
            position: 'fixed', right: 20, zIndex: 60,
            width: 'min(92vw, 380px)',
            background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--nexus) 6%, transparent)' }}>
            <HelpCircle size={17} style={{ color: 'var(--teal)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Asistente de ayuda</span>
            <Link href="/guia" onClick={() => setAbierto(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--teal)', textDecoration: 'none' }}>
              <BookOpen size={13} /> Guía
            </Link>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 2 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: 14 }}>
            <AsistenteChat alto={320} />
          </div>
        </div>
      )}
      <style>{`
        /* Escritorio: apilado ENCIMA del toggle de tema (abajo-derecha). */
        .boton-ayuda-fab { bottom: 64px; }
        .boton-ayuda-panel { bottom: 126px; }
        /* Móvil (RTC-05): el FAB muere (regla en globals.css, junto a sus
           hermanas de esquina) — el trigger vive en la topbar. El panel
           cuelga bajo la topbar, no del borde del pulgar. */
        @media (max-width: 768px) {
          .boton-ayuda-panel { top: calc(60px + env(safe-area-inset-top, 0px)); bottom: auto; right: 12px; }
        }
      `}</style>
    </>
  )
}
