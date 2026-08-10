/**
 * Imagen OG/Twitter (1200×630) generada on-brand con next/og.
 * Antes NO existía → al compartir el link salía un cuadro negro. Ahora Next la
 * sirve automáticamente como og:image y twitter:image.
 *
 * Identidad Cantera+Instrumento (Identity Lock V1, OD-2): alabastro cálido,
 * jamaica profundo, tinta café. Satori NO resuelve variables CSS, por eso los
 * hex van literales — son los mismos del Lock, no colores propios.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'NexusMED — El consultorio, conectado.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OG() {
  const CANVAS = '#FAF7F2'
  const BRAND = '#8E2A47'
  const INK = '#2A2420'
  const MUTED = '#6E645A'
  const BRAND_SOFT = '#F5E7EC'
  const LINE = '#D8CFC0'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: CANVAS, padding: 72,
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* Halo de marca — suave, cálido */}
        <div style={{ position: 'absolute', top: -160, right: -120, width: 520, height: 520, borderRadius: 520, background: BRAND_SOFT, display: 'flex' }} />

        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: 16, border: `3px solid ${CANVAS}`, display: 'flex' }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: INK, letterSpacing: -0.5 }}>NexusMED</div>
        </div>

        {/* Titular */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 66, fontWeight: 600, color: INK, letterSpacing: -2, lineHeight: 1.05, maxWidth: 900 }}>
            El consultorio, conectado.
          </div>
          <div style={{ fontSize: 30, color: MUTED, maxWidth: 820, lineHeight: 1.35 }}>
            Agenda, expediente clínico, recetas e inteligencia clínica en una sola herramienta.
          </div>
        </div>

        {/* Pie: capacidades */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {['Agenda', 'Expediente', 'Recetas', 'Hospitalización', 'IA clínica'].map((t) => (
            <div key={t} style={{ display: 'flex', fontSize: 22, color: BRAND, border: `1px solid ${LINE}`, borderRadius: 999, padding: '8px 18px' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
