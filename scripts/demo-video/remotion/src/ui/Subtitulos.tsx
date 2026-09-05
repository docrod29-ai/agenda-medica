import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { subtitulosDe } from '../datos'
import { FUENTE, TEMA } from '../tema'

/**
 * Subtítulos de la narración, oración por oración, repartidos por longitud.
 * El sintetizador no da tiempos por palabra; la aproximación por caracteres
 * queda a menos de un segundo del audio, que es lo que tolera un subtítulo.
 */
export const Subtitulos: React.FC<{ texto: string; segundos: number; desdeFrame?: number; abajo?: number; ancho?: number }> = ({ texto, segundos, desdeFrame = 0, abajo = 54, ancho = 1180 }) => {
  const frame = useCurrentFrame() - desdeFrame
  const { fps } = useVideoConfig()
  const t = frame / fps
  const partes = subtitulosDe(texto, segundos)
  const actual = partes.find(p => t >= p.desde && t < p.hasta)
  if (!actual || frame < 0) return null
  const entrada = interpolate(t, [actual.desde, actual.desde + 0.18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const salida = interpolate(t, [actual.hasta - 0.12, actual.hasta], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const o = Math.min(entrada, salida)
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: abajo, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{
        maxWidth: ancho, padding: '14px 26px', borderRadius: 14,
        background: 'rgba(11,12,14,0.78)', border: `1px solid ${TEMA.borde}`,
        backdropFilter: 'blur(10px)', color: TEMA.texto, fontFamily: FUENTE.sans, fontSize: 30, lineHeight: 1.35,
        textAlign: 'center', opacity: o, transform: `translateY(${(1 - entrada) * 8}px)`,
        textShadow: '0 1px 2px rgba(0,0,0,.6)', fontWeight: 500,
      }}>
        {actual.texto}
      </div>
    </div>
  )
}
