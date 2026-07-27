import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Medición del bundle (opt-in): `ANALYZE=true npm run build` abre el reporte.
// Sin la variable, es un passthrough → el build normal/producción no cambia.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/**
 * Headers de seguridad — ISO 27001 / NOM-024 / LFPDPPP
 *
 * Estrategia por capas:
 *   1. Globales (toda ruta): X-Content-Type-Options, Referrer-Policy,
 *      HSTS, Permissions-Policy.
 *   2. Embebibles (/reservar, /privacidad): permiten iframe externo
 *      (frame-ancestors *) — son páginas sin sesión autenticada.
 *   3. Privadas (resto): X-Frame-Options DENY para evitar clickjacking
 *      sobre la zona autenticada.
 *
 * No usamos CSP global con `script-src` porque Next inyecta varios
 * scripts inline (SW kill-switch, theme anti-flicker, RSC payload).
 * En su lugar protegemos los vectores más peligrosos individualmente.
 */
/**
 * CSP en modo REPORT-ONLY (fase 1 de "report-only → enforce").
 *
 * NO bloquea nada — solo reporta a /api/csp-report lo que se saldría de la política.
 * Sirve para descubrir, con tráfico real, TODOS los orígenes que usa la app antes de
 * apretar la lista y pasar a enforce (cambiar la cabecera a 'Content-Security-Policy').
 *
 * script-src incluye 'unsafe-inline'/'unsafe-eval' a propósito en esta fase: Next
 * inyecta scripts inline (SW kill-switch, anti-flicker de tema, payload RSC); sin eso
 * el reporte se inundaría de ruido propio. El endurecimiento de script-src (nonces)
 * es un paso posterior. Aquí el foco es cazar orígenes EXTERNOS inesperados.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://js.stripe.com https://apis.google.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com wss://*.googleapis.com https://*.google.com https://*.cloudfunctions.net https://*.firebasestorage.app https://api.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.google.com https://recaptcha.net https://*.firebaseapp.com https://accounts.google.com",
  "form-action 'self'",
  "report-uri /api/csp-report",
].join("; ")

const nextConfig: NextConfig = {
  // Anti-plagio / privacidad: no exponer el header "X-Powered-By: Next.js"
  // (no le regalamos el stack a quien escanee) ni los source maps del cliente en
  // producción (evita que descarguen tu código fuente legible desde el navegador).
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // Proxy del handler de autenticación de Firebase a NUESTRO dominio.
  // Permite usar authDomain = dominio propio (same-origin) → el login de Google
  // (popup/redirect) ya no se cuelga por el bloqueo de cookies entre dominios de
  // Chrome/Safari. Reenvía /__/auth/* y /__/firebase/* a firebaseapp.com.
  async rewrites() {
    return [
      { source: '/__/auth/:path*', destination: 'https://nexomed-agenda.firebaseapp.com/__/auth/:path*' },
      { source: '/__/firebase/:path*', destination: 'https://nexomed-agenda.firebaseapp.com/__/firebase/:path*' },
    ]
  },
  async headers() {
    return [
      // ── Service Worker: NUNCA cachear el sw.js ──────────────────
      // Causa raíz de "no veo los cambios": el navegador cachea el propio
      // sw.js por horas, así que reg.update() bajaba la versión vieja y la
      // app nunca se actualizaba. no-cache fuerza revalidar en cada visita
      // → detecta la versión nueva, skipWaiting, recarga sola.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // ── Páginas públicas embebibles ─────────────────────────────
      {
        source: "/reservar/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
      {
        source: "/privacidad/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },

      // ── Zona autenticada: anti-clickjacking ─────────────────────
      // Bloquea que cualquier sitio embeba la app en iframe
      // (clickjacking sobre /consulta, /agenda, etc.)
      {
        source: "/(consulta|expediente|nota|agenda|pacientes|crm|cumplimiento|finanzas|farmacia|configuracion|equipo|reportes|usuarios|valoracion|nueva-consulta|dashboard)(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
        ],
      },

      // ── Headers de seguridad GLOBALES (toda ruta) ───────────────
      {
        source: "/:path*",
        headers: [
          // Bloquea MIME-sniffing (XSS vía content-type confuso)
          { key: "X-Content-Type-Options", value: "nosniff" },

          // Solo enviar el origen al hacer cross-origin (no la ruta completa
          // — evita filtrar IDs de pacientes en referers a terceros)
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // HSTS — fuerza HTTPS por 1 año + preload + subdominios.
          // Vercel ya sirve HTTPS pero esto añade defensa en navegadores.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },

          // Permissions-Policy — restringe APIs sensibles del navegador.
          // La app SOLO necesita microphone (dictado). Todo lo demás bloqueado.
          {
            key: "Permissions-Policy",
            value: [
              "microphone=(self)",
              "camera=()",
              "geolocation=()",
              "payment=()",
              "usb=()", "magnetometer=()", "accelerometer=()",
              "gyroscope=()", "interest-cohort=()",
              "browsing-topics=()",
            ].join(", "),
          },

          // Origin-Agent-Cluster — aislamiento de proceso por origen
          { key: "Origin-Agent-Cluster", value: "?1" },

          // Cross-Origin policies — defensa contra Spectre/timing
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },

          // CSP en modo REPORT-ONLY (fase de observación): no bloquea, solo reporta a
          // /api/csp-report los orígenes fuera de política. Se aprieta y pasa a enforce
          // tras ~1 semana de datos reales. NO incluye frame-ancestors (esa la fijan
          // por-ruta los bloques de arriba, en modo enforce).
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },

      // ── Rutas con TOKEN del paciente (magic link) — AL FINAL a propósito ──
      // El token va en la URL: NO indexar y NO enviar referer. Va DESPUÉS del
      // bloque global porque, cuando dos reglas fijan la MISMA cabecera, Next usa
      // la ÚLTIMA (auditoría maestra 2026-07 / reporte externo): así el
      // 'no-referrer' de estas rutas gana sobre el 'strict-origin-when-cross-origin'
      // global, cumpliendo la garantía de que el token no viaje ni en referers
      // same-origin. Aplica a /mi/[token], /resena/[token] y /verificar/[token].
      {
        source: "/(mi|resena|verificar)/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
