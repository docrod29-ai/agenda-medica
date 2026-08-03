'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Calendar, Stethoscope, Mic, FileText, X, ArrowRight } from 'lucide-react'

/**
 * Tour de bienvenida (4 pasos) para el primer ingreso del médico.
 * - Tarjetas centradas (no ancladas a elementos que se mueven en responsive) →
 *   robusto en cualquier tamaño de pantalla.
 * - Se puede saltar; se marca "visto" por médico en localStorage para no repetir.
 * - Aditivo: no toca ninguna otra pantalla ni el flujo clínico.
 */

const VERSION = 'v1'
const claveVisto = (uid: string) => `nexus_tour_${VERSION}_${uid}`

const PASOS = [
  {
    icon: Calendar,
    titulo: 'Tu agenda, siempre a la mano',
    texto: 'Aquí ves las citas del día y creas nuevas en segundos. Es tu pantalla de inicio.',
  },
  {
    icon: Stethoscope,
    titulo: 'Empieza una consulta',
    texto: 'Abre el expediente del paciente y comienza. Todo queda guardado en su historia clínica.',
  },
  {
    icon: Mic,
    titulo: 'Dicta y la nota se escribe sola',
    texto: 'Dentro de la consulta, presiona grabar y habla con naturalidad. La IA redacta tu nota estructurada.',
  },
  {
    icon: FileText,
    titulo: 'Receta con tu membrete y firma',
    texto: 'Genera e imprime la receta con tu formato. También puedes enviarla al paciente por WhatsApp.',
  },
]

export function OnboardingTour({ enabled }: { enabled: boolean }) {
  const { user } = useAuth()
  const router = useRouter()
  const [paso, setPaso] = useState(0)
  const [visible, setVisible] = useState(false)

  // Decide si mostrar: solo médico, solo si no lo ha visto en este dispositivo.
  useEffect(() => {
    if (!enabled || !user?.uid) return
    try {
      if (localStorage.getItem(claveVisto(user.uid))) return
    } catch { return }
    // pequeño retraso para no competir con la carga del dashboard
    const t = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(t)
  }, [enabled, user?.uid])

  const cerrar = () => {
    try { if (user?.uid) localStorage.setItem(claveVisto(user.uid), '1') } catch { /* noop */ }
    setVisible(false)
  }

  // Escape salta el tour
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
      if (e.key === 'ArrowRight' || e.key === 'Enter') avanzar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, paso])

  const avanzar = () => {
    if (paso < PASOS.length - 1) setPaso(paso + 1)
    // '/calendario', NO '/agenda': la pantalla que el menú rotula «Agenda» es
    // /calendario (BottomNav.tsx:26). No existe ninguna página en /agenda, así
    // que el médico nuevo terminaba su tour de bienvenida en un 404 — lo caza
    // csp-guard.test.ts al cruzar las rutas contra el árbol real.
    else { cerrar(); router.push('/calendario') }
  }

  if (!visible) return null

  const P = PASOS[paso]
  const Icono = P.icon
  const ultimo = paso === PASOS.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a NexusMED"
      onClick={cerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nx-tour-card"
        style={{
          width: '100%', maxWidth: 420, background: 'var(--s1)',
          border: '1px solid var(--border)', borderRadius: 18,
          padding: '30px 26px 22px', position: 'relative',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        <button
          onClick={cerrar}
          aria-label="Saltar"
          style={{
            position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
            color: 'var(--text3)', cursor: 'pointer', padding: 4, lineHeight: 0,
          }}
        >
          <X size={18} />
        </button>

        {/* Icono en marco de marca */}
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--nexus-soft)', border: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, color: 'var(--nexus)',
        }}>
          <Icono size={26} />
        </div>

        {paso === 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--nexus)', marginBottom: 8 }}>
            Bienvenido a NexusMED
          </div>
        )}
        <h2 className="nx-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', textWrap: 'balance' }}>
          {P.titulo}
        </h2>
        <p style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.55, margin: 0, minHeight: 66 }}>
          {P.texto}
        </p>

        {/* Puntos de progreso + acciones */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PASOS.map((_, i) => (
              <span key={i} style={{
                width: i === paso ? 20 : 7, height: 7, borderRadius: 'var(--r-pill)',
                background: i === paso ? 'var(--nexus)' : 'var(--border2)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!ultimo && (
              <button onClick={cerrar} style={{
                background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13.5,
                fontWeight: 500, cursor: 'pointer', padding: '9px 10px',
              }}>
                Saltar
              </button>
            )}
            <button onClick={avanzar} className="lift" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              {ultimo ? 'Empezar' : 'Siguiente'}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
