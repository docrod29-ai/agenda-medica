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
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

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
  /**
   * Ancho máximo del contenedor visible, en px.
   *
   * **Omitirlo es lo normal**: entonces el componente MIDE el sitio que tiene y
   * se ajusta. Se pasa a mano sólo cuando quien llama necesita conocer la escala
   * por su cuenta — hoy, la pantalla de configuración, que convierte píxeles de
   * arrastre en milímetros de papel y para eso llama a `escalaDeVistaPrevia`
   * con el MISMO número. Ahí el número tiene que ser explícito y compartido, no
   * medido por dos sitios que podrían medir distinto.
   */
  maxWidth?: number
  /** Alto máximo POR HOJA en px (default 720) */
  maxHeight?: number
  /** Hijo: típicamente <RecetaDocumento ... /> */
  children: ReactNode
}

/** Lo que valía el `maxWidth` por omisión antes de medirlo, y lo que se usa
 *  mientras no hay medida (servidor, primer render). */
const ANCHO_DE_ARRANQUE = 380

export function RecetaPreviewWrapper({
  paperWidthMm, paperHeightMm, numPages = 1, maxWidth, maxHeight = 720, children,
}: RecetaPreviewWrapperProps) {
  /**
   * EL ANCHO SE MIDE, NO SE ADIVINA — REG-513.
   *
   * Este componente existe, según su propia cabecera, «para que la receta se vea
   * proporcional **sin desbordar el layout**». Lo hacía para cualquier tamaño de
   * papel y para UN SOLO tamaño de contenedor: `/receta` y `/orden` le pasaban
   * `maxWidth={380}` escrito a mano, elegido para la columna de 420 px del
   * escritorio.
   *
   * A 390 px la columna mide 358, así que la hoja se pintaba a 380 y se salía
   * 22 px de su columna — 6 más allá del borde de la pantalla— con
   * `overflow: hidden` encima: recortada, y sin gesto que la trajera. En la
   * pantalla cuyo trabajo es enseñar cómo va a salir impreso.
   *
   * Se mide con `useLayoutEffect` y no con `useEffect` a propósito: la medida
   * llega antes de pintar, así que no hay salto visible de 380 a 358.
   *
   * Lo que NO se toca es `escalaDeVistaPrevia`: sigue siendo una función pura de
   * sus argumentos. Configuración le pasa su propio número y con ese mismo
   * número coloca su recuadro arrastrable — «un número que dos sitios tienen que
   * compartir no se copia: se pregunta», dice la cabecera de arriba, y por eso
   * quien necesita conocer la escala sigue pasando el ancho explícito en vez de
   * confiar en una medición que sólo ocurre dentro de este componente.
   */
  const cajaDeMedida = useRef<HTMLDivElement | null>(null)
  const [anchoMedido, setAnchoMedido] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (maxWidth !== undefined) return          // quien lo pasa, manda
    const el = cajaDeMedida.current
    if (!el) return
    const medir = () => setAnchoMedido(el.clientWidth || null)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])
  const anchoTope = maxWidth ?? anchoMedido ?? ANCHO_DE_ARRANQUE

  // 96 DPI estándar: 1mm ≈ 3.78 px
  const paperWidthPx = (paperWidthMm * 96) / 25.4
  const paperHeightPx = (paperHeightMm * 96) / 25.4
  const scale = escalaDeVistaPrevia({ paperWidthMm, paperHeightMm, maxWidth: anchoTope, maxHeight })
  const pages = Math.max(1, numPages)
  // Hojas FLUSH (gap 0): html2pdf rebana el canvas por altura exacta de página —
  // cualquier margen entre hojas desalinearía los cortes del PDF.
  const innerHeight = paperHeightPx * pages
  const containerWidth = paperWidthPx * scale
  const containerHeight = innerHeight * scale

  return (
    /* La caja de medida ocupa el ancho disponible y no pinta nada: es de donde
       sale `anchoMedido`. El marco de la hoja sigue centrado dentro. */
    <div ref={cajaDeMedida} style={{ width: '100%' }}>
    <div style={{
      width: containerWidth,
      height: containerHeight,
      overflow: 'hidden',
      position: 'relative',
      margin: '0 auto',
      /* ZC-023 — era '#1a2333' fijo: en tema claro la hoja blanca salía sobre
             un azul noche que no pinta nada más del producto. */
        background: 'var(--s3)',
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
    </div>
  )
}
