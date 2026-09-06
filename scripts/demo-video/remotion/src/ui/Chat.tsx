import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Mensaje } from '../datos'
import { FUENTE, TEMA } from '../tema'

/** Burbujas de WhatsApp que van apareciendo. `desdeFrame` = cuándo empieza la conversación. */
export const Burbujas: React.FC<{ mensajes: Mensaje[]; desdeFrame?: number; cadaSeg?: number; ancho?: number; escala?: number }> = ({ mensajes, desdeFrame = 0, cadaSeg = 1.7, ancho = 520, escala = 1 }) => {
  const frame = useCurrentFrame() - desdeFrame
  const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * escala, width: ancho, fontFamily: FUENTE.sans }}>
      {mensajes.map((m, i) => {
        const inicio = Math.round(i * cadaSeg * fps)
        if (frame < inicio) return null
        const s = spring({ frame: frame - inicio, fps, config: { damping: 16, stiffness: 160, mass: 0.7 } })
        const mio = m.de === 'paciente'
        return (
          <div key={i} style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start', opacity: s, transform: `translateY(${(1 - s) * 14}px) scale(${0.96 + 0.04 * s})`, transformOrigin: mio ? 'right bottom' : 'left bottom' }}>
            <div style={{
              maxWidth: '86%', padding: `${9 * escala}px ${13 * escala}px`, borderRadius: 12 * escala,
              borderTopLeftRadius: mio ? 12 * escala : 3, borderTopRightRadius: mio ? 3 : 12 * escala,
              background: mio ? TEMA.waBurbujaMia : TEMA.waBurbuja, color: '#E9EDEF', fontSize: 19 * escala, lineHeight: 1.35,
              whiteSpace: 'pre-wrap', boxShadow: '0 1px 1px rgba(0,0,0,.35)',
            }}>
              {renderNegritas(m.texto)}
              <div style={{ fontSize: 12 * escala, color: 'rgba(233,237,239,.55)', textAlign: 'right', marginTop: 4 }}>{hora(i)}{mio ? ' ✓✓' : ''}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function hora(i: number) { const m = 12 + i * 1; return `10:${String(m).padStart(2, '0')}` }

/** WhatsApp pinta *negritas* con asteriscos; aquí también. */
function renderNegritas(texto: string): React.ReactNode {
  const partes = texto.split(/(\*[^*]+\*)/g)
  return partes.map((p, i) => p.startsWith('*') && p.endsWith('*') ? <strong key={i}>{p.slice(1, -1)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>)
}

/** Un teléfono con la conversación adentro. */
export const TelefonoChat: React.FC<{ mensajes: Mensaje[]; titulo: string; desdeFrame?: number; cadaSeg?: number; escala?: number }> = ({ mensajes, titulo, desdeFrame = 0, cadaSeg = 1.7, escala = 1 }) => {
  const w = 430 * escala, h = 880 * escala
  return (
    <div style={{ width: w, height: h, borderRadius: 54 * escala, background: '#000', padding: 12 * escala, boxShadow: '0 40px 90px rgba(0,0,0,.6), inset 0 0 0 2px #2a2d33', position: 'relative' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 44 * escala, overflow: 'hidden', background: TEMA.waFondo, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: TEMA.wa, padding: `${44 * escala}px ${18 * escala}px ${12 * escala}px`, display: 'flex', alignItems: 'center', gap: 12 * escala }}>
          <div style={{ width: 38 * escala, height: 38 * escala, borderRadius: '50%', background: TEMA.nexusSuave, display: 'grid', placeItems: 'center', color: TEMA.nexus, fontWeight: 700, fontFamily: FUENTE.sans, fontSize: 18 * escala }}>A</div>
          <div style={{ color: '#fff', fontFamily: FUENTE.sans }}>
            <div style={{ fontWeight: 600, fontSize: 17 * escala, lineHeight: 1.1 }}>{titulo}</div>
            <div style={{ fontSize: 12 * escala, opacity: .8 }}>Cuenta de empresa · en línea</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 14 * escala, overflow: 'hidden', backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: `${22 * escala}px ${22 * escala}px` }}>
          <Burbujas mensajes={mensajes} desdeFrame={desdeFrame} cadaSeg={cadaSeg} ancho={w - 50 * escala} escala={escala * 0.92} />
        </div>
        <div style={{ padding: 12 * escala, display: 'flex', gap: 8 * escala, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 40 * escala, borderRadius: 20 * escala, background: '#2A3942', color: '#8696A0', fontFamily: FUENTE.sans, fontSize: 15 * escala, display: 'flex', alignItems: 'center', paddingLeft: 16 * escala }}>Mensaje</div>
          <div style={{ width: 40 * escala, height: 40 * escala, borderRadius: '50%', background: '#00A884' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 14 * escala, left: '50%', transform: 'translateX(-50%)', width: 120 * escala, height: 28 * escala, borderRadius: 16 * escala, background: '#000' }} />
    </div>
  )
}

/** Tarjeta de chat pequeña, para una esquina de una escena de pantalla. */
export const TarjetaChat: React.FC<{ mensajes: Mensaje[]; titulo: string; desdeFrame: number; abajoIzquierda?: boolean }> = ({ mensajes, titulo, desdeFrame, abajoIzquierda = false }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < desdeFrame) return null
  const s = spring({ frame: frame - desdeFrame, fps, config: { damping: 18, stiffness: 140 } })
  return (
    <div style={{ position: 'absolute', ...(abajoIzquierda ? { left: 150, bottom: 150 } : { right: 40, top: 90 }), width: 470, opacity: s, transform: `translateX(${(1 - s) * 40}px)`, borderRadius: 22, overflow: 'hidden', background: TEMA.waFondo, boxShadow: '0 30px 70px rgba(0,0,0,.6)', border: `1px solid ${TEMA.borde}` }}>
      <div style={{ background: TEMA.wa, padding: '12px 18px', color: '#fff', fontFamily: FUENTE.sans, fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: '#25D366', display: 'inline-block' }} />
        {titulo}
      </div>
      <div style={{ padding: 16, backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        <Burbujas mensajes={mensajes} desdeFrame={desdeFrame + 8} cadaSeg={2.4} ancho={438} escala={0.82} />
      </div>
    </div>
  )
}

/** Fondo de marca: gradiente sobrio con una malla de puntos, nada de morado. */
export const FondoMarca: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const d = interpolate(frame, [0, 600], [0, 40])
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(1200px 800px at ${30 + d * 0.2}% 40%, #10262B 0%, ${TEMA.fondo} 60%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '28px 28px', backgroundPosition: `${d}px 0` }} />
      {children}
    </div>
  )
}
