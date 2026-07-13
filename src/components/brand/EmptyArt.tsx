/**
 * Ilustraciones de marca para estados vacíos. Line-art cobalto (var(--nexus))
 * con el pulso cardiaco que las une como familia. Usan currentColor → respetan
 * claro/oscuro y el color de marca. Transparentes, nítidas, ~1KB.
 */
import type { CSSProperties } from 'react'

const wrap = (size: number): CSSProperties => ({ color: 'var(--nexus)', width: size, height: size * 0.8 })

export function AgendaVacia({ size = 150 }: { size?: number }) {
  return (
    <svg style={wrap(size)} viewBox="0 0 150 120" fill="none" role="img" aria-label="Agenda sin citas">
      <rect x="28" y="30" width="94" height="76" rx="9" stroke="currentColor" strokeWidth="2.5" />
      <line x1="28" y1="50" x2="122" y2="50" stroke="currentColor" strokeWidth="2.5" />
      <line x1="50" y1="22" x2="50" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="100" y1="22" x2="100" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="86" y="76" width="24" height="18" rx="4" fill="currentColor" opacity="0.16" />
      <g fill="currentColor" opacity="0.4">
        <circle cx="45" cy="66" r="2.6" /><circle cx="66" cy="66" r="2.6" /><circle cx="87" cy="66" r="2.6" /><circle cx="108" cy="66" r="2.6" />
        <circle cx="45" cy="85" r="2.6" /><circle cx="66" cy="85" r="2.6" />
      </g>
      <path d="M92 85 h4 l2 -5 l3 9 l2 -4 h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

export function ExpedienteVacio({ size = 150 }: { size?: number }) {
  return (
    <svg style={wrap(size)} viewBox="0 0 150 120" fill="none" role="img" aria-label="Expediente sin notas">
      <path d="M46 24 H90 L104 38 V98 H46 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M90 24 V38 H104" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.4">
        <line x1="56" y1="54" x2="94" y2="54" /><line x1="56" y1="66" x2="94" y2="66" /><line x1="56" y1="78" x2="80" y2="78" />
      </g>
      <path d="M52 90 h9 l3 -7 l4 12 l3 -6 h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CensoVacio({ size = 150 }: { size?: number }) {
  return (
    <svg style={wrap(size)} viewBox="0 0 150 120" fill="none" role="img" aria-label="Censo vacío">
      <path d="M34 58 h30 a10 10 0 0 1 10 8 h34 a8 8 0 0 1 8 8 v18 H34 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="34" y1="46" x2="34" y2="100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="40" y="60" width="20" height="12" rx="3" fill="currentColor" opacity="0.16" />
      <circle cx="48" cy="104" r="4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="104" cy="104" r="4" stroke="currentColor" strokeWidth="2.2" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <line x1="98" y1="34" x2="98" y2="48" /><line x1="91" y1="41" x2="105" y2="41" />
      </g>
    </svg>
  )
}

export function SinResultados({ size = 150 }: { size?: number }) {
  return (
    <svg style={wrap(size)} viewBox="0 0 150 120" fill="none" role="img" aria-label="Sin resultados">
      <circle cx="66" cy="56" r="26" stroke="currentColor" strokeWidth="2.5" />
      <line x1="85" y1="75" x2="104" y2="94" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M54 56 h9 l3 -7 l4 12 l3 -6 h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}
