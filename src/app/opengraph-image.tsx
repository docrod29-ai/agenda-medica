/**
 * Imagen OG/Twitter (1200×630) generada on-brand con next/og.
 * Antes NO existía → al compartir el link salía un cuadro negro. Ahora Next la
 * sirve automáticamente como og:image y twitter:image. Usa los colores de marca
 * (cobalto var(--nexus) sobre ink #0B0C0E); no depende de ninguna imagen externa.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ausculta — El consultorio, conectado.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OG() {
  const INK = '#0B0C0E'
  const COBALT = 'var(--nexus)'
  const TEXT = '#F2EFE9'
  const MUTED = '#9BA3AE'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: INK, padding: 72,
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* Halo de marca */}
        <div style={{ position: 'absolute', top: -160, right: -120, width: 520, height: 520, borderRadius: 520, background: 'rgba(61,90,254,0.18)', display: 'flex' }} />

        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: COBALT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 16, border: '3px solid #0B0C0E', display: 'flex' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: TEXT, letterSpacing: -0.5 }}>Ausculta</div>
        </div>

        {/* Titular */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 600, color: TEXT, letterSpacing: -2, lineHeight: 1.05, maxWidth: 900 }}>
            El consultorio, conectado.
          </div>
          <div style={{ fontSize: 30, color: MUTED, maxWidth: 820, lineHeight: 1.35 }}>
            Agenda, expediente clínico, recetas e inteligencia clínica en una sola herramienta.
          </div>
        </div>

        {/* Pie: capacidades */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Agenda', 'Expediente', 'Recetas', 'Hospitalización', 'IA clínica'].map((t) => (
            <div key={t} style={{ display: 'flex', fontSize: 22, color: COBALT, border: `1px solid rgba(61,90,254,0.4)`, borderRadius: 'var(--r-pill)', padding: '8px 18px' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
