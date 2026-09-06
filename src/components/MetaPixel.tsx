'use client'
/**
 * Meta (Facebook/Instagram) Pixel — SOLO para páginas públicas de marketing
 * (landing, precios). NUNCA montar en el área autenticada: las URLs del
 * expediente llevan IDs de paciente (/nota/[patientId]/...) y no deben enviarse
 * a Meta. Se activa únicamente si defines NEXT_PUBLIC_META_PIXEL_ID; mientras no
 * exista, no carga nada (no rompe ni rastrea).
 *
 * ── LO QUE EL AVISO DE PRIVACIDAD TIENE QUE DECIR ANTES (Panel de Lujo ZC-010) ──
 *
 * El aviso público (`/privacidad`) enumera las finalidades de los datos de los
 * médicos —cuenta, cobro, CFDI, soporte— y no menciona medición ni publicidad,
 * ni una palabra sobre cookies o píxeles. Mientras eso siga así, el Pixel no
 * puede cargarse aunque la variable exista: la compuerta y su razonamiento
 * viven en `src/lib/security/pixel-de-meta.ts` (puro, con su guardián). Es la
 * decisión D-2 del dueño aplicada por su valor seguro: apagado hasta que esté
 * declarado.
 *
 * Y aunque se declare, en /registro NO se carga cuando la URL trae `?invite=`:
 * `PageView` manda la URL completa y el código de invitación es una llave.
 */
import Script from 'next/script'
import { pixelPermitidoEn } from '@/lib/security/pixel-de-meta'

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID

function pixelActivoAqui(): boolean {
  if (!PIXEL || typeof window === 'undefined') return false
  return pixelPermitidoEn(window.location.pathname, window.location.search)
}

/**
 * Dispara un evento de conversión de Meta (ej. registro completado). Reintenta
 * brevemente por si el script del Pixel aún no terminó de cargar. No-op si no
 * hay Pixel configurado o no está permitido en esta página.
 */
export function trackConversion(evento = 'CompleteRegistration') {
  if (!pixelActivoAqui()) return
  let intentos = 0
  const fire = () => {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq
    if (fbq) { fbq('track', evento); return }
    if (intentos++ < 20) setTimeout(fire, 150)  // hasta ~3s esperando al Pixel
  }
  fire()
}

export function MetaPixel() {
  if (!pixelActivoAqui()) return null
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${PIXEL}');fbq('track','PageView');
      `}</Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  )
}
