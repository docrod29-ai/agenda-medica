/**
 * Fuentes en local: IBM Plex Sans / Mono y Fraunces, las mismas del producto.
 * Se sirven desde `public/fonts` (descargadas una vez con `preparar.sh`) para
 * que el render no dependa de la red ni del certificado del proxy.
 */
import { useEffect, useState } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'
import { CARAS } from './fuentes.generado'

let inyectado = false
function inyectar() {
  if (inyectado || typeof document === 'undefined') return
  inyectado = true
  const css = CARAS.map(c =>
    `@font-face{font-family:'${c.family}';font-style:${c.style};font-weight:${c.weight};font-display:block;src:url(${staticFile('fonts/' + c.file)}) format('woff2');unicode-range:${c.unicodeRange};}`,
  ).join('\n')
  const el = document.createElement('style')
  el.id = 'fuentes-ausculta'
  el.textContent = css
  document.head.appendChild(el)
}

/** Espera a que las caras que usa el video estén cargadas antes de pintar un solo fotograma. */
export function useFuentes() {
  const [handle] = useState(() => delayRender('fuentes'))
  useEffect(() => {
    inyectar()
    const pedidos = [
      '400 20px "IBM Plex Sans"', '500 20px "IBM Plex Sans"', '600 20px "IBM Plex Sans"',
      '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"',
      '400 20px Fraunces', '500 20px Fraunces', 'italic 400 20px Fraunces', 'italic 500 20px Fraunces',
    ]
    Promise.all(pedidos.map(p => document.fonts.load(p, 'Ausculta áéíóúñ'))).catch(() => {}).finally(() => continueRender(handle))
  }, [handle])
}
