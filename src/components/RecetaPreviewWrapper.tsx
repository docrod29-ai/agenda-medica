'use client'
/**
 * Wrapper que limita el tamaño visible del RecetaDocumento a un contenedor con
 * ancho/alto máximo. Calcula la escala dinámicamente para que la receta se vea
 * proporcional sin desbordar el layout, sin importar el tamaño de papel elegido.
 *
 * Usado en /receta/[patientId]/[notaId], /orden/[patientId]/[notaId] y en
 * el preview de Configuración → Recetas.
 */
import type { ReactNode } from 'react'

interface RecetaPreviewWrapperProps {
  paperWidthMm: number
  paperHeightMm: number
  /** Ancho máximo del contenedor visible en px (default 380) */
  maxWidth?: number
  /** Alto máximo del contenedor visible en px (default 720) */
  maxHeight?: number
  /** Hijo: típicamente <RecetaDocumento ... /> */
  children: ReactNode
}

export function RecetaPreviewWrapper({
  paperWidthMm, paperHeightMm, maxWidth = 380, maxHeight = 720, children,
}: RecetaPreviewWrapperProps) {
  // 96 DPI estándar: 1mm ≈ 3.78 px
  const paperWidthPx = (paperWidthMm * 96) / 25.4
  const paperHeightPx = (paperHeightMm * 96) / 25.4
  const scaleByWidth = maxWidth / paperWidthPx
  const scaleByHeight = maxHeight / paperHeightPx
  const scale = Math.min(scaleByWidth, scaleByHeight, 1)
  const containerWidth = paperWidthPx * scale
  const containerHeight = paperHeightPx * scale

  return (
    <div style={{
      width: containerWidth,
      height: containerHeight,
      overflow: 'hidden',
      position: 'relative',
      margin: '0 auto',
      background: '#1a2333',
      borderRadius: 6,
    }}>
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: paperWidthPx,
        height: paperHeightPx,
      }}>
        {children}
      </div>
    </div>
  )
}
