'use client'
/**
 * Botón flotante de ayuda, presente en todas las pantallas del dashboard.
 * Abre un panel con el asistente (bot) sin salir de donde estás. Un enlace
 * lleva a la Guía completa. Se coloca abajo-derecha, libre del bottom-nav móvil.
 */
import { useState } from 'react'
import Link from 'next/link'
import { AsistenteChat } from '@/components/AsistenteChat'
import { HelpCircle, X, BookOpen } from 'lucide-react'

export function BotonAyuda() {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        onClick={() => setAbierto(v => !v)}
        aria-label={abierto ? 'Cerrar ayuda' : 'Abrir ayuda'}
        className="boton-ayuda-fab"
        style={{
          position: 'fixed', right: 20, zIndex: 60, width: 52, height: 52, borderRadius: '50%',
          border: 'none', cursor: 'pointer', background: 'var(--teal)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(20,184,166,0.4)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(20,184,166,0.06)' }}>
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
        .boton-ayuda-fab { bottom: 24px; }
        .boton-ayuda-panel { bottom: 88px; }
        @media (max-width: 768px) {
          .boton-ayuda-fab { bottom: 78px; }
          .boton-ayuda-panel { bottom: 140px; }
        }
      `}</style>
    </>
  )
}
