import React from 'react'
import { AbsoluteFill, Audio, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Pieza } from '../datos'
import { FUENTE, TEMA } from '../tema'
import { Campana, Logotipo } from '../ui/Marca'
import { Subtitulos } from '../ui/Subtitulos'
import { FondoMarca, TelefonoChat } from '../ui/Chat'
import { ChipCapitulo } from '../ui/Capitulo'

/** Apertura: el sitio real de fondo, la marca y la frase del producto encima. */
export const EscenaIntro: React.FC<{ pieza: Extract<Pieza, { tipo: 'intro' }> }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  const velo = interpolate(t, [0, 1.5, 7.5, 9.5], [1, 0.82, 0.82, 0.1], { extrapolateRight: 'clamp' })
  const s1 = spring({ frame: frame - 10, fps, config: { damping: 200 } })
  const s2 = spring({ frame: frame - 28, fps, config: { damping: 200 } })
  const fuera = interpolate(t, [7.6, 9.2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const zoom = interpolate(t, [0, 12], [1.08, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: TEMA.fondo }}>
      <OffthreadVideo src={staticFile(`clips/${pieza.toma}.mp4`)} trimBefore={Math.round(pieza.desde * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }} />
      <AbsoluteFill style={{ background: TEMA.fondo, opacity: velo }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fuera }}>
        <div style={{ opacity: s1, transform: `translateY(${(1 - s1) * 20}px)` }}><Logotipo size={64} /></div>
        <div style={{ marginTop: 44, fontFamily: FUENTE.display, fontSize: 96, color: TEMA.texto, textAlign: 'center', lineHeight: 1.08, letterSpacing: -1.5, opacity: s2, transform: `translateY(${(1 - s2) * 24}px)` }}>
          Sal de la consulta<br />con la nota <em style={{ color: TEMA.nexus, fontStyle: 'italic' }}>hecha</em>.
        </div>
        <div style={{ marginTop: 30, fontFamily: FUENTE.mono, fontSize: 22, letterSpacing: 4, color: TEMA.texto3, opacity: s2 }}>DEMOSTRACIÓN COMPLETA · CONSULTORIO DE PRUEBA · PACIENTES FICTICIOS</div>
      </AbsoluteFill>
      <Audio src={staticFile(pieza.voz)} />
      <Subtitulos texto={pieza.texto} segundos={pieza.frames / fps - 0.9} />
    </AbsoluteFill>
  )
}

/** Escena de WhatsApp a pantalla completa (el bot que agenda). */
export const EscenaChat: React.FC<{ pieza: Extract<Pieza, { tipo: 'chat' }> }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 200 } })
  const puntos = ['Entiende agendar, cancelar y reagendar', 'Ofrece sólo horarios libres de verdad', 'Confirma en la misma conversación', 'Recuerda un día antes y el mismo día']
  return (
    <AbsoluteFill>
      <FondoMarca />
      <div style={{ position: 'absolute', left: 150, top: 200, width: 860 }}>
        <div style={{ fontFamily: FUENTE.display, fontSize: 84, color: TEMA.texto, lineHeight: 1.05, letterSpacing: -1.5, opacity: s }}>También por WhatsApp</div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {puntos.map((p, i) => {
            const k = spring({ frame: frame - Math.round((2 + i * 2.6) * fps), fps, config: { damping: 200 } })
            return (
              <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'center', opacity: k, transform: `translateX(${(1 - k) * -20}px)` }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: TEMA.nexus, flexShrink: 0 }} />
                <span style={{ fontFamily: FUENTE.sans, fontSize: 34, color: TEMA.texto2 }}>{p}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 300, top: 70, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <TelefonoChat mensajes={pieza.mensajes} titulo={pieza.titulo} desdeFrame={Math.round(0.8 * fps)} cadaSeg={1.55} escala={1.02} />
      </div>
      <ChipCapitulo capitulo={pieza.capitulo} />
      <Audio src={staticFile(pieza.voz)} />
      <Subtitulos texto={pieza.texto} segundos={pieza.frames / fps - 0.9} />
    </AbsoluteFill>
  )
}

/** Cierre: marca, frase, oferta. */
export const EscenaCierre: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 200 } })
  const s2 = spring({ frame: frame - 20, fps, config: { damping: 200 } })
  const fuera = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: fuera }}>
      <FondoMarca />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ opacity: s, transform: `scale(${0.9 + 0.1 * s})` }}><Campana size={120} /></div>
        <div style={{ marginTop: 26, opacity: s }}><Logotipo size={72} /></div>
        <div style={{ marginTop: 40, fontFamily: FUENTE.display, fontSize: 66, color: TEMA.texto, textAlign: 'center', letterSpacing: -1, opacity: s2 }}>Sal de la consulta con la nota hecha.</div>
        <div style={{ marginTop: 36, display: 'flex', gap: 18, alignItems: 'center', opacity: s2 }}>
          <span style={{ padding: '16px 30px', borderRadius: 14, background: TEMA.nexus, color: '#06232A', fontFamily: FUENTE.sans, fontSize: 30, fontWeight: 600 }}>Catorce días gratis</span>
          <span style={{ fontFamily: FUENTE.sans, fontSize: 30, color: TEMA.texto2 }}>sin tarjeta · con la inteligencia artificial incluida</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
