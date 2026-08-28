'use client'
/**
 * Wrapper que limita el tamaño visible del RecetaDocumento a un contenedor con
 * ancho/alto máximo. Calcula la escala dinámicamente para que la receta se vea
 * proporcional sin desbordar el layout, sin importar el tamaño de papel elegido.
 *
 * v2: soporta MULTI-HOJA — cuando el documento pagina en N hojas, pasa
 * numPages para que el contenedor crezca y muestre todas las hojas apiladas.
 *
 * Usado en /receta/[patientId]/[notaId], /orden/[patientId]/[notaId] y en el
 * preview de Configuración → Recetas — este último desde que se descubrió que
 * tenía su propia copia del cálculo y se le había desincronizado (la receta
 * salía recortada por la derecha).
 */
import type { ReactNode } from 'react'

/**
 * LA ESCALA DE LA VISTA PREVIA, EN UN SOLO SITIO.
 *
 * La calculaba este componente para sí mismo. La pantalla de configuración,
 * que dibuja un recuadro ARRASTRABLE encima del documento, necesita el mismo
 * número para convertir píxeles de arrastre en milímetros de papel — y por eso
 * tenía su propia copia del cálculo, con su propio contenedor. Copia que se
 * desincronizó: el documento se dibujaba en hoja carta y el marco se
 * dimensionaba a media carta, así que la receta salía RECORTADA por la derecha.
 *
 * Un número que dos sitios tienen que compartir no se copia: se pregunta.
 */
export function escalaDeVistaPrevia({
  paperWidthMm, paperHeightMm, numPages = 1, maxWidth = 380, maxHeight = 720,
}: {
  paperWidthMm: number; paperHeightMm: number
  numPages?: number; maxWidth?: number; maxHeight?: number
}): number {
  const paperWidthPx = (paperWidthMm * 96) / 25.4
  const paperHeightPx = (paperHeightMm * 96) / 25.4
  void numPages   // la escala mira UNA hoja; las demás sólo alargan el contenedor
  return Math.min(maxWidth / paperWidthPx, maxHeight / paperHeightPx, 1)
}

interface RecetaPreviewWrapperProps {
  paperWidthMm: number
  paperHeightMm: number
  /** Cuántas hojas genera el documento (default 1) */
  numPages?: number
  /** Ancho máximo del contenedor visible en px (default 380) */
  maxWidth?: number
  /** Alto máximo POR HOJA en px (default 720) */
  maxHeight?: number
  /** Hijo: típicamente <RecetaDocumento ... /> */
  children: ReactNode
}

export function RecetaPreviewWrapper({
  paperWidthMm, paperHeightMm, numPages = 1, maxWidth = 380, maxHeight = 720, children,
}: RecetaPreviewWrapperProps) {
  // 96 DPI estándar: 1mm ≈ 3.78 px
  const paperWidthPx = (paperWidthMm * 96) / 25.4
  const paperHeightPx = (paperHeightMm * 96) / 25.4
  const scale = escalaDeVistaPrevia({ paperWidthMm, paperHeightMm, maxWidth, maxHeight })
  const pages = Math.max(1, numPages)
  // Hojas FLUSH (gap 0): html2pdf rebana el canvas por altura exacta de página —
  // cualquier margen entre hojas desalinearía los cortes del PDF.
  const innerHeight = paperHeightPx * pages
  const containerWidth = paperWidthPx * scale
  const containerHeight = innerHeight * scale

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
      <div
        className="receta-preview-pages"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: paperWidthPx,
          height: innerHeight,
          // Bloque contenedor de los hijos absolutos (el recuadro arrastrable
          // de configuración): el `transform` ya lo haría, se declara para que
          // nadie lo quite pensando que no hace nada.
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}
