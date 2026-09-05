import React from 'react'
import { CalculateMetadataFunction, Composition } from 'remotion'
import { Composicion, FUNDIDO } from './Composicion'
import { construirLinea, type LineaDeTiempo } from './datos'
import { ALTO, ANCHO, FPS } from './tema'


type Props = { linea: LineaDeTiempo | null; musica: boolean }

const calcular: CalculateMetadataFunction<Props> = async ({ props }) => {
  const linea = await construirLinea()
  const fundidos = (linea.piezas.length - 1) * FUNDIDO
  return { props: { ...props, linea }, durationInFrames: linea.totalFrames - fundidos }
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AuscultaDemo"
    component={Composicion}
    width={ANCHO}
    height={ALTO}
    fps={FPS}
    durationInFrames={30 * 60}
    defaultProps={{ linea: null, musica: true }}
    calculateMetadata={calcular}
  />
)
