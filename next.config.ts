import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { RE_RUTAS_PRIVADAS, RE_RUTAS_PACIENTE } from "./src/lib/security/rutas-privadas";

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
 *   3. Privadas (src/lib/security/rutas-privadas.ts): X-Frame-Options DENY +
 *      frame-ancestors 'none' para evitar clickjacking sobre la zona autenticada.
 *
 * La CSP global sí lleva `script-src`, pero todavía con 'unsafe-inline'/'unsafe-eval'
 * porque Next inyecta scripts inline (SW kill-switch, theme anti-flicker, payload
 * RSC). Quitarlos exige nonces por request: endurecimiento posterior, unidad aparte.
 */
/**
 * CSP parametrizada — unidad Nexus OS E0-10 ("report-only → enforce").
 *
 * El modo se elige con la variable de entorno CSP_MODE **en tiempo de BUILD**:
 *
 *   (sin variable)        → Content-Security-Policy-Report-Only   ← DEFAULT
 *   CSP_MODE=enforce      → Content-Security-Policy               ← bloquea de verdad
 *
 * Así el flip (y su reversión, ~2 min) es una variable de entorno + redeploy, no un
 * cambio de código. Cualquier valor distinto de 'enforce' cae a report-only a
 * propósito: un typo en la variable NUNCA debe empezar a bloquear recursos.
 *
 * script-src incluye 'unsafe-inline'/'unsafe-eval' a propósito en esta fase: Next
 * inyecta scripts inline (SW kill-switch, anti-flicker de tema, payload RSC); sin eso
 * el reporte se inundaría de ruido propio. El endurecimiento de script-src (nonces)
 * es un paso posterior con su propio riesgo de pantalla en blanco.
 */
type CspMode = "report-only" | "enforce";

/** Modo efectivo. Fail-safe: sólo el literal 'enforce' aprieta. */
function modoCsp(): CspMode {
  return process.env.CSP_MODE === "enforce" ? "enforce" : "report-only";
}

/** Nombre de la cabecera según el modo. */
function claveCsp(modo: CspMode): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return modo === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/**
 * Orígenes EXTERNOS que la app carga de verdad hoy. Cada uno está anclado en
 * `src/__tests__/csp-guard.test.ts`: añadir uno obliga a tocar el test (trinquete
 * anti-aflojamiento), y un `https://host` nuevo en una posición de carga del
 * navegador que NO esté aquí tumba el CI.
 */
const ORIGENES_SCRIPT = [
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://www.recaptcha.net",
  "https://js.stripe.com",
  "https://apis.google.com",
  "https://va.vercel-scripts.com",
  // Worker de pdf.js (src/lib/pdf-to-image.ts). Sin esto, con enforce se cae el
  // flujo "subir PDF" de laboratorios / antibiograma por foto / receta por visión.
  // Alternativa mejor pero fuera de esta unidad: auto-alojar el worker en /public
  // y quitar este origen (decisión D-1 del médico dueño — toca un flujo vivo).
  "https://unpkg.com",
];

/** Orígenes desde los que se puede instanciar un Worker (pdf.js, ver arriba). */
const ORIGENES_WORKER = ["https://unpkg.com"];

const ORIGENES_CONNECT = [
  "https://*.googleapis.com",
  "https://*.firebaseio.com",
  "wss://*.firebaseio.com",
  "wss://*.googleapis.com",
  "https://*.google.com",
  "https://*.cloudfunctions.net",
  "https://*.firebasestorage.app",
  "https://api.stripe.com",
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
];

const ORIGENES_FRAME = [
  "'self'",
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://www.google.com",
  "https://recaptcha.net",
  "https://*.firebaseapp.com",
  "https://accounts.google.com",
  // Sala de teleconsulta (src/app/teleconsulta/[citaId]/page.tsx embebe el
  // room.url que devuelve api.daily.co). Sin esto, con enforce el iframe sale
  // EN BLANCO y la videoconsulta deja de existir.
  "https://*.daily.co",
];

/**
 * Meta (Facebook) — Pixel de marketing y SDK del alta de WhatsApp.
 * NO va en la política global a propósito: `src/components/MetaPixel.tsx` advierte
 * que Meta nunca debe ver las URLs del área clínica (llevan IDs de paciente). Se
 * concede SÓLO en las rutas que lo cargan (landing, /registro y /configuracion).
 * Si el Dr. confirma que el Pixel está apagado (decisión D-2), estas dos entradas
 * desaparecen y la superficie queda más pequeña.
 */
const ORIGENES_META = ["https://connect.facebook.net", "https://www.facebook.com"];

/**
 * Qué hacer con `frame-ancestors` en cada zona:
 *   'ninguno'    → 'none' (zona autenticada: nadie nos embebe)
 *   'cualquiera' → *      (widget de reservas / aviso de privacidad, embebibles)
 *   'omitir'     → sin la directiva (resto)
 */
type ZonaFrame = "ninguno" | "cualquiera" | "omitir";

function valorFrameAncestors(zona: Exclude<ZonaFrame, "omitir">): string {
  return zona === "ninguno" ? "'none'" : "*";
}

/** Política completa. `zona` decide la última directiva; `meta` amplía Facebook. */
function politicaCsp(zona: ZonaFrame, opciones: { meta?: boolean } = {}): string {
  const script = opciones.meta ? [...ORIGENES_SCRIPT, ...ORIGENES_META] : ORIGENES_SCRIPT;
  const connect = opciones.meta ? [...ORIGENES_CONNECT, ...ORIGENES_META] : ORIGENES_CONNECT;
  const directivas = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data:",
    `worker-src 'self' blob: ${ORIGENES_WORKER.join(" ")}`,
    `connect-src 'self' ${connect.join(" ")}`,
    `frame-src ${ORIGENES_FRAME.join(" ")}`,
    "form-action 'self'",
    // report-uri está deprecado pero es el único que honran hoy Firefox/Safari;
    // report-to es el sustituto moderno (grupo declarado en Reporting-Endpoints).
    // El receptor entiende los DOS formatos (src/app/api/csp-report/route.ts).
    "report-uri /api/csp-report",
    "report-to csp",
  ];
  if (zona !== "omitir") directivas.push(`frame-ancestors ${valorFrameAncestors(zona)}`);
  return directivas.join("; ");
}

/**
 * Cabeceras CSP de un bloque de rutas.
 *
 * EL PORQUÉ DE LAS DOS CABECERAS: hoy `frame-ancestors` viaja en modo ENFORCE
 * (cabecera `Content-Security-Policy`) mientras el resto de la política va en
 * report-only. Si en modo report-only emitiéramos sólo la política completa bajo
 * la clave report-only, la zona autenticada PERDERÍA el bloqueo real de iframes:
 * sería una regresión de seguridad causada por el propio hardening. Por eso, en
 * report-only se emiten las dos; en enforce colapsan en una sola cabecera que ya
 * lleva su `frame-ancestors`.
 */
function cabecerasCsp(zona: ZonaFrame, opciones: { meta?: boolean } = {}) {
  const modo = modoCsp();
  const completa = { key: claveCsp(modo), value: politicaCsp(zona, opciones) };
  if (modo === "enforce" || zona === "omitir") return [completa];
  return [
    { key: "Content-Security-Policy", value: `frame-ancestors ${valorFrameAncestors(zona)};` },
    completa,
  ];
}

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
      // ── Headers de seguridad GLOBALES (toda ruta) ───────────────
      // ORDEN: este bloque va ANTES que los específicos a propósito. Cuando dos
      // reglas fijan la MISMA cabecera, Next se queda con la ÚLTIMA; en modo
      // enforce todas las CSP comparten clave, así que el general debe ir primero
      // para que el específico (frame-ancestors por zona) gane.
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

          // Grupo de reporte para `report-to` (sustituto moderno de report-uri).
          // Se emite en el bloque global para que valga en TODAS las rutas.
          { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },

          // CSP global, sin frame-ancestors: esa la fijan por zona los bloques de
          // abajo. La clave (report-only vs enforce) la decide CSP_MODE.
          ...cabecerasCsp("omitir"),
        ],
      },

      // ── Páginas públicas embebibles ─────────────────────────────
      // El widget de reservas y el aviso de privacidad se incrustan en los sitios
      // web de los consultorios: deben seguir siendo embebibles en LOS DOS modos.
      {
        source: "/reservar/:path*",
        headers: cabecerasCsp("cualquiera"),
      },
      {
        source: "/privacidad/:path*",
        headers: cabecerasCsp("cualquiera"),
      },

      // ── Zona autenticada: anti-clickjacking ─────────────────────
      // Bloquea que cualquier sitio embeba la app en iframe (clickjacking sobre
      // /consulta, /agenda, /uci…). La lista sale de src/lib/security/rutas-privadas.ts
      // porque el regex incrustado que había aquí se había desincronizado del árbol
      // de rutas: /uci, /hospitalizacion, /superadmin, /receta, /orden y /corte-caja
      // (PHI y consola del dueño) viajaban SIN ninguna protección anti-iframe.
      {
        source: RE_RUTAS_PRIVADAS,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...cabecerasCsp("ninguno"),
        ],
      },

      // ── Rutas que cargan scripts de Meta ────────────────────────
      // Alcance MÍNIMO a propósito (ver ORIGENES_META): Meta sólo entra donde la
      // app lo carga de verdad, nunca en la política global.
      //   /          → landing con el Pixel (src/app/page.tsx)
      //   /registro  → Pixel + evento de conversión
      //   /configuracion → SDK del alta embebida de WhatsApp (área autenticada:
      //                    conserva X-Frame-Options y frame-ancestors 'none')
      {
        source: "/",
        headers: cabecerasCsp("omitir", { meta: true }),
      },
      {
        source: "/registro/:path*",
        headers: cabecerasCsp("omitir", { meta: true }),
      },
      {
        source: "/configuracion/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...cabecerasCsp("ninguno", { meta: true }),
        ],
      },

      // ── Rutas con TOKEN del paciente (magic link) — AL FINAL a propósito ──
      // El token va en la URL: NO indexar y NO enviar referer. Va DESPUÉS del
      // bloque global porque, cuando dos reglas fijan la MISMA cabecera, Next usa
      // la ÚLTIMA (auditoría maestra 2026-07 / reporte externo): así el
      // 'no-referrer' de estas rutas gana sobre el 'strict-origin-when-cross-origin'
      // global, cumpliendo la garantía de que el token no viaje ni en referers
      // same-origin. Aplica a /mi/[token], /resena/[token] y /verificar/[token].
      //
      // Y ANTI-CLICKJACKING, que aquí faltaba. Medido contra producción, estas
      // rutas viajaban sin `X-Frame-Options` y sin `frame-ancestors`: quedaron
      // fuera de RUTAS_PRIVADAS por estar catalogadas como "superficie pública/
      // paciente", pero pública describe cómo se ENTRA, no qué se VE. Dentro de
      // /mi están las recetas del paciente y los botones de cancelar su cita:
      // encuadrarlo en un iframe invisible convierte un clic cualquiera en una
      // cancelación. `teleconsulta` entra también — `frame-ancestors` limita
      // quién nos embebe, no lo que embebemos, así que la sala de Daily (que va
      // por `frame-src`) no se toca. Ver src/lib/security/rutas-privadas.ts.
      {
        source: RE_RUTAS_PACIENTE,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          ...cabecerasCsp("ninguno"),
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
