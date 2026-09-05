import React from 'react'
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Pieza } from '../datos'
import { FUENTE, TEMA } from '../tema'
import { Subtitulos } from '../ui/Subtitulos'
import { ChipCapitulo } from '../ui/Capitulo'
import { TarjetaChat } from '../ui/Chat'

type PiezaClip = Extract<Pieza, { tipo: 'clip' }>

/**
 * Acercamientos por escena: { t: segundo de inicio, dur, x, y (0-1 del cuadro), z }.
 * Se afinan a mano mirando el clip; sin ellos el video se ve bien pero plano.
 */
const FOCOS: Record<string, { t: number; dur: number; x: number; y: number; z: number }[]> = {
  '01-paciente-reserva': [{ t: 9, dur: 12, x: 0.5, y: 0.35, z: 1.35 }],
  '03-asistente-agenda': [{ t: 2, dur: 9, x: 0.32, y: 0.3, z: 1.3 }, { t: 11, dur: 7, x: 0.62, y: 0.38, z: 1.3 }],
  '04-confirmar': [{ t: 3, dur: 8, x: 0.42, y: 0.35, z: 1.32 }],
  '05-lista-espera': [{ t: 4, dur: 8, x: 0.5, y: 0.35, z: 1.3 }],
  '06-consulta-escucha': [{ t: 5, dur: 8, x: 0.5, y: 0.3, z: 1.22 }, { t: 15, dur: 5, x: 0.52, y: 0.62, z: 1.3 }],
  '07-nota': [{ t: 10, dur: 12, x: 0.5, y: 0.5, z: 1.35 }, { t: 24, dur: 10, x: 0.5, y: 0.5, z: 1.35 }],
  '08-procedencia-firma': [{ t: 2, dur: 9, x: 0.8, y: 0.42, z: 1.3 }],
  '09-receta': [{ t: 11, dur: 10, x: 0.35, y: 0.45, z: 1.35 }, { t: 24, dur: 7, x: 0.68, y: 0.45, z: 1.35 }],
  '10-ordenes': [{ t: 3, dur: 8, x: 0.35, y: 0.45, z: 1.3 }],
  '11-entregar-portal': [{ t: 4, dur: 12, x: 0.5, y: 0.5, z: 1.3 }],
  '14-seguimiento': [{ t: 2, dur: 7, x: 0.5, y: 0.4, z: 1.25 }],
}

function acercamiento(id: string, t: number) {
  const focos = FOCOS[id] ?? []
  let z = 1, x = 0.5, y = 0.5
  for (const f of focos) {
    const entra = interpolate(t, [f.t, f.t + 1.1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const sale = interpolate(t, [f.t + f.dur - 1.1, f.t + f.dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const k = Math.min(entra, sale)
    const suave = k * k * (3 - 2 * k)
    if (suave > 0) { z = 1 + (f.z - 1) * suave; x = 0.5 + (f.x - 0.5) * suave; y = 0.5 + (f.y - 0.5) * suave }
  }
  return { z, x, y }
}

/** El video de pantalla con acercamientos suaves; `formato` decide si va en un marco de teléfono. */
const Pantalla: React.FC<{ pieza: PiezaClip }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  const src = staticFile(`clips/${pieza.toma}.mp4`)
  if (pieza.formato === 'telefono') {
    const s = spring({ frame, fps, config: { damping: 200 } })
    return (
      <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 30% 40%, #10262B 0%, ${TEMA.fondo} 60%)` }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* El clip del teléfono se grabó a 390×844 dentro de un cuadro de 780×1688: se enseña su esquina a escala 1:1, nítida. */}
        <div style={{ position: 'absolute', right: 330, top: 84, width: 414, height: 892, borderRadius: 56, background: '#000', padding: 12, boxShadow: '0 50px 100px rgba(0,0,0,.65), inset 0 0 0 2px #2a2d33', opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
          <div style={{ width: 390, height: 868, borderRadius: 46, overflow: 'hidden', background: TEMA.fondo, position: 'relative' }}>
            <OffthreadVideo src={src} trimBefore={Math.round(pieza.desde * fps)} muted style={{ position: 'absolute', left: 0, top: 24, width: 780, height: 1688, objectFit: 'none', objectPosition: 'left top' }} />
          </div>
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', width: 120, height: 28, borderRadius: 16, background: '#000' }} />
        </div>
        <TextoLateral pieza={pieza} />
      </AbsoluteFill>
    )
  }
  const { z, x, y } = acercamiento(pieza.id, t)
  return (
    <AbsoluteFill style={{ background: TEMA.fondo }}>
      <OffthreadVideo src={src} trimBefore={Math.round(pieza.desde * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, transformOrigin: `${x * 100}% ${y * 100}%` }} />
    </AbsoluteFill>
  )
}

/** En las escenas de teléfono, el lado izquierdo lleva el mensaje grande. */
const TEXTO_LATERAL: Record<string, { titulo: string; puntos: string[] }> = {
  '12-portal': { titulo: 'El portal del paciente', puntos: ['Hoy · sus citas: confirmar, reagendar, cancelar', 'Cuidado · el plan tal como lo aprobó su médico', 'Documentos · su receta, lista para descargar', 'Un enlace firmado, sin contraseña, que caduca'] },
  '13-preguntar': { titulo: 'Preguntar, con límites', puntos: ['Responde citando el plan aprobado', 'Una dosis, un cambio: escala al médico', 'Una urgencia: primero cómo pedir ayuda', 'Nunca diagnostica ni cambia un tratamiento'] },
}
const TextoLateral: React.FC<{ pieza: PiezaClip }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const d = TEXTO_LATERAL[pieza.id]
  if (!d) return null
  return (
    <div style={{ position: 'absolute', left: 150, top: 220, width: 900 }}>
      <div style={{ fontFamily: FUENTE.display, fontSize: 84, color: TEMA.texto, lineHeight: 1.05, letterSpacing: -1.5, opacity: spring({ frame, fps, config: { damping: 200 } }) }}>{d.titulo}</div>
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {d.puntos.map((p, i) => {
          const s = spring({ frame: frame - Math.round((2.5 + i * (pieza.frames / fps - 6) / d.puntos.length) * fps), fps, config: { damping: 200 } })
          return (
            <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'center', opacity: s, transform: `translateX(${(1 - s) * -20}px)` }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: TEMA.nexus, flexShrink: 0 }} />
              <span style={{ fontFamily: FUENTE.sans, fontSize: 34, color: TEMA.texto2 }}>{p}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Subtítulos del diálogo (médica/paciente) mientras se oye la consulta. */
const SubtitulosDialogo: React.FC<{ pieza: PiezaClip }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!pieza.dialogo) return null
  const tMs = (frame / fps - pieza.dialogo.desde) * 1000
  const turno = pieza.dialogo.turnos.find(u => tMs >= u.inicioMs - 150 && tMs < u.finMs + 350)
  if (!turno) return null
  const medico = turno.rol === 'Médico'
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 1240, padding: '16px 28px', borderRadius: 16, background: 'rgba(11,12,14,0.82)', border: `1px solid ${TEMA.borde}`, backdropFilter: 'blur(10px)', display: 'flex', gap: 20, alignItems: 'baseline' }}>
        <span style={{ fontFamily: FUENTE.mono, fontSize: 18, letterSpacing: 2, color: medico ? TEMA.nexus : TEMA.amber, whiteSpace: 'nowrap' }}>{medico ? 'MÉDICA' : 'PACIENTE'}</span>
        <span style={{ fontFamily: FUENTE.sans, fontSize: 30, color: TEMA.texto, lineHeight: 1.35 }}>{turno.texto}</span>
      </div>
    </div>
  )
}

/** Indicador «grabando» con nivel, arriba a la derecha, mientras se oye el diálogo. */
const Grabando: React.FC<{ pieza: PiezaClip }> = ({ pieza }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!pieza.dialogo) return null
  const t = frame / fps
  const fin = pieza.dialogo.desde + pieza.dialogo.turnos[pieza.dialogo.turnos.length - 1].finMs / 1000 + 0.8
  if (t < pieza.dialogo.desde || t > fin) return null
  const seg = Math.max(0, t - pieza.dialogo.desde)
  return (
    <div style={{ position: 'absolute', top: 30, right: 40, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', borderRadius: 999, background: 'rgba(11,12,14,.75)', border: `1px solid ${TEMA.borde}` }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: TEMA.red, opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 3)) }} />
      <span style={{ fontFamily: FUENTE.mono, color: TEMA.texto, fontSize: 20 }}>{String(Math.floor(seg / 60)).padStart(1, '0')}:{String(Math.floor(seg % 60)).padStart(2, '0')}</span>
      <span style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 22 }}>
        {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ width: 4, borderRadius: 2, background: TEMA.nexus, height: 5 + 16 * Math.abs(Math.sin(t * (4 + i * 0.7) + i)) }} />)}
      </span>
    </div>
  )
}

export const EscenaClip: React.FC<{ pieza: PiezaClip }> = ({ pieza }) => {
  const { fps } = useVideoConfig()
  const frame = useCurrentFrame()
  const segNarracion = pieza.dialogo ? pieza.dialogo.desde : pieza.frames / fps - 0.9
  const entrada = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ opacity: entrada }}>
      <Pantalla pieza={pieza} />
      <Audio src={staticFile(pieza.voz)} />
      <ChipCapitulo capitulo={pieza.capitulo} />
      {pieza.dialogo ? (
        <>
          <Subtitulos texto={pieza.texto} segundos={segNarracion} />
          <Sequence from={Math.round(pieza.dialogo.desde * fps)} layout="none"><Audio src={staticFile(pieza.dialogo.voz)} volume={0.95} /></Sequence>
          <SubtitulosDialogo pieza={pieza} />
          <Grabando pieza={pieza} />
          <Sequence from={Math.round(pieza.dialogo.desdeDespues * fps)} layout="none"><Audio src={staticFile(pieza.dialogo.vozDespues)} /></Sequence>
          <Subtitulos texto={pieza.dialogo.textoDespues} segundos={pieza.frames / fps - pieza.dialogo.desdeDespues - 0.9} desdeFrame={Math.round(pieza.dialogo.desdeDespues * fps)} />
        </>
      ) : (
        <Subtitulos texto={pieza.texto} segundos={segNarracion} abajo={pieza.formato === 'telefono' ? 40 : 54} />
      )}
      {pieza.chat && <TarjetaChat mensajes={pieza.chat.mensajes} titulo={pieza.chat.titulo} desdeFrame={Math.round(pieza.chat.desde * fps)} />}
    </AbsoluteFill>
  )
}
