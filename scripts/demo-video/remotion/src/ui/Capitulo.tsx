import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Capitulo } from '../datos'
import { FUENTE, TEMA } from '../tema'
import { Campana } from './Marca'
import { FondoMarca } from './Chat'

/** Tarjeta de capítulo: número grande, título en Fraunces, una línea de contexto. */
export const TarjetaCapitulo: React.FC<{ capitulo: Capitulo }> = ({ capitulo }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 200, stiffness: 120 } })
  const s2 = spring({ frame: frame - 6, fps, config: { damping: 200, stiffness: 120 } })
  const salida = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: salida }}>
      <FondoMarca />
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>
          <Campana size={44} />
          <span style={{ fontFamily: FUENTE.mono, color: TEMA.nexus, fontSize: 26, letterSpacing: 4 }}>CAPÍTULO {String(capitulo.numero).padStart(2, '0')}</span>
        </div>
        <div style={{ fontFamily: FUENTE.display, fontSize: 132, fontWeight: 500, color: TEMA.texto, lineHeight: 1.02, marginTop: 26, letterSpacing: -2, opacity: s2, transform: `translateY(${(1 - s2) * 24}px)` }}>
          {capitulo.titulo}
        </div>
        <div style={{ fontFamily: FUENTE.sans, fontSize: 38, color: TEMA.texto2, marginTop: 22, opacity: s2 }}>{capitulo.sub}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Chip persistente arriba a la izquierda con el capítulo en curso. */
export const ChipCapitulo: React.FC<{ capitulo: Capitulo | null }> = ({ capitulo }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!capitulo) return null
  const s = spring({ frame, fps, config: { damping: 200 } })
  return (
    <div style={{ position: 'absolute', top: 30, left: 40, display: 'flex', alignItems: 'center', gap: 12, opacity: s, transform: `translateY(${(1 - s) * -10}px)`, padding: '10px 18px 10px 12px', borderRadius: 999, background: 'rgba(11,12,14,.72)', border: `1px solid ${TEMA.borde}`, backdropFilter: 'blur(8px)' }}>
      <Campana size={26} />
      <span style={{ fontFamily: FUENTE.mono, color: TEMA.nexus, fontSize: 16, letterSpacing: 2 }}>{String(capitulo.numero).padStart(2, '0')}</span>
      <span style={{ fontFamily: FUENTE.sans, color: TEMA.texto, fontSize: 20, fontWeight: 500 }}>{capitulo.titulo}</span>
    </div>
  )
}
