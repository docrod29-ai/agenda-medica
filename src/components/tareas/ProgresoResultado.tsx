'use client'
/**
 * V15-RESULTS-CLOSURE-001 — la pista de las ocho etapas de §9 pintada sobre
 * una `TareaClinica` de tipo resultado. Ver `@/lib/tareas-clinicas/progreso-resultado`
 * para la razón de por qué tres de las ocho etapas nunca se pintan como
 * "hecha": no hay dato que lo respalde, y no se inventa.
 */
import { progresoResultado, type EstadoEtapa, type EtapaResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import type { EstadoTarea, Prioridad } from '@/lib/tareas-clinicas/modelo'

const COLOR: Record<EstadoEtapa, string> = {
  hecha: 'var(--text)',
  actual: 'var(--teal)',
  pendiente: 'var(--text3)',
  sin_dato: 'var(--text3)',
}

const FONDO: Record<EstadoEtapa, string> = {
  hecha: 'color-mix(in srgb, var(--text) 8%, transparent)',
  actual: 'color-mix(in srgb, var(--teal) 12%, transparent)',
  pendiente: 'transparent',
  sin_dato: 'transparent',
}

const ETIQUETA_ESTADO: Record<EstadoEtapa, string> = {
  hecha: 'hecha', actual: 'etapa actual', pendiente: 'todavía no', sin_dato: 'sin dato — no se registra',
}

function resumenAccesible(etapas: EtapaResultado[]): string {
  return `Progreso del resultado: ${etapas.map(e => `${e.etiqueta}: ${ETIQUETA_ESTADO[e.estado]}`).join('. ')}.`
}

export function ProgresoResultado({ estado, ownerUid, prioridad }: {
  estado: EstadoTarea
  ownerUid?: string
  prioridad?: Prioridad
}) {
  const etapas = progresoResultado({ estado, ownerUid, prioridad })
  return (
    <div
      className="nx-progreso-resultado"
      role="group"
      aria-label={resumenAccesible(etapas)}
      style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}
    >
      {etapas.map(e => (
        <span
          key={e.clave}
          title={e.motivoSinDato ?? `${e.etiqueta} — ${ETIQUETA_ESTADO[e.estado]}`}
          style={{
            fontSize: 10.5,
            lineHeight: 1.4,
            padding: '2px 8px',
            borderRadius: 'var(--r-pill)',
            border: `1px solid ${e.estado === 'pendiente' || e.estado === 'sin_dato' ? 'var(--border)' : COLOR[e.estado]}`,
            color: COLOR[e.estado],
            background: FONDO[e.estado],
            fontStyle: e.estado === 'sin_dato' ? 'italic' : 'normal',
          }}
        >
          {e.etiqueta}
        </span>
      ))}
    </div>
  )
}
