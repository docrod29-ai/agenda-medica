import React from 'react'
import { AbsoluteFill, staticFile } from 'remotion'
import { Audio } from '@remotion/media'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import type { LineaDeTiempo } from './datos'
import { TEMA } from './tema'
import { EscenaClip } from './escenas/Clip'
import { EscenaChat, EscenaCierre, EscenaIntro } from './escenas/Otras'
import { TarjetaCapitulo } from './ui/Capitulo'
import { useFuentes } from './fuentes'

export const FUNDIDO = 12

export const Composicion: React.FC<{ linea: LineaDeTiempo | null; musica: boolean }> = ({ linea, musica }) => {
  useFuentes()
  if (!linea) return <AbsoluteFill style={{ background: TEMA.fondo }} />
  return (
    <AbsoluteFill style={{ background: TEMA.fondo }}>
      <TransitionSeries>
        {linea.piezas.flatMap((p, i) => {
          const escena = (
            <TransitionSeries.Sequence key={p.id} durationInFrames={p.frames}>
              {p.tipo === 'intro' && <EscenaIntro pieza={p} />}
              {p.tipo === 'capitulo' && <TarjetaCapitulo capitulo={p.capitulo} />}
              {p.tipo === 'clip' && <EscenaClip pieza={p} />}
              {p.tipo === 'chat' && <EscenaChat pieza={p} />}
              {p.tipo === 'cierre' && <EscenaCierre />}
            </TransitionSeries.Sequence>
          )
          if (i === 0) return [escena]
          return [
            <TransitionSeries.Transition key={`t-${p.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: FUNDIDO })} />,
            escena,
          ]
        })}
      </TransitionSeries>
      {musica && <Audio src={staticFile('musica/cama.mp3')} volume={0.16} loop />}
    </AbsoluteFill>
  )
}
