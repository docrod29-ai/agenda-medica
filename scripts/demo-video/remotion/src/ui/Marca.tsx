import React from 'react'
import { FUENTE, TEMA } from '../tema'

/** La marca real de Ausculta (public/brand/mark.svg): la campana del estetoscopio. */
export const Campana: React.FC<{ size?: number; color?: string }> = ({ size = 48, color = TEMA.nexus }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Ausculta" style={{ display: 'block' }}>
    <g fill="none" stroke={color} strokeLinecap="round">
      <circle cx="17" cy="24" r="8.5" strokeWidth="3.2" />
      <circle cx="17" cy="24" r="2.6" fill={color} stroke="none" />
      <path d="M31 17.5a9 9 0 0 1 0 13" strokeWidth="3.2" />
      <path d="M37.5 12a17 17 0 0 1 0 24" strokeWidth="3.2" opacity="0.45" />
    </g>
  </svg>
)

export const Logotipo: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = TEMA.texto }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.35 }}>
    <div style={{ width: size * 1.15, height: size * 1.15, borderRadius: size * 0.28, background: TEMA.nexusSuave, border: `1px solid ${TEMA.borde}`, display: 'grid', placeItems: 'center' }}>
      <Campana size={size * 0.8} />
    </div>
    <span style={{ fontFamily: FUENTE.sans, fontWeight: 600, fontSize: size * 0.95, letterSpacing: -0.5, color }}>Ausculta</span>
  </div>
)
