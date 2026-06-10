import type { NextConfig } from "next";

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
const nextConfig: NextConfig = {
  async headers() {
    return [
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
        ],
      },
    ];
  },
};

export default nextConfig;
