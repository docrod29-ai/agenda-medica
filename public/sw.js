/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v681'  // Loop auditoria ciclo 1: (P1 clinico) amikacina: la dosis POR TOMA no se acotaba con topeMgKgDia -> en 1 toma/dia la receta salia 50% arriba del tope seguro (22.5 vs 15 mg/kg); fix propaga el tope mg/kg/dia a porToma + invariante universal porToma<=porDia en el harness. (P2 auth) WhatsApp disconnect/connect y CFDI solicitar pasan a verificarMedico (antes any-member: una recepcion podia desconectar la mensajeria a pacientes). --- v680: CSP report-only + Playwright.  // CSP fase 1: Content-Security-Policy-Report-Only global (no bloquea, solo reporta a /api/csp-report los origenes fuera de politica) para observar 1 semana antes de pasar a enforce. Endpoint redacta token/PHI de document-uri. + matriz Playwright (firefox/webkit/iphone/android). --- v679: fix login MFA.  // FIX login MFA: la cuenta con 2FA quedaba fuera porque el login no manejaba 'auth/multi-factor-auth-required'. Ahora, tras el primer factor (correo/Google), se muestra la pantalla del codigo de 6 digitos (TOTP) y se resuelve con getMultiFactorResolver + assertionForSignIn. Aplica a ambos flujos. --- v678: react 19.2.8.  // Seguridad deps: react/react-dom 19.2.4 -> 19.2.8 (cierra DoS HIGH CVSS 7.5 de RSC/Server Functions, parcheado en 19.2.6). Next ya estaba en 16.2.12 (>=16.2.11, cubre las 4 HIGH/5 MED de julio + el RSC vendorizado). Residual conocido: sharp/libvips HIGH transitiva DENTRO de next/node_modules/sharp (el fix de npm degrada Next a 9.3.3 = absurdo); dep de build de optimizacion de imagenes, no camino clinico; espera a que Next publique sharp parcheado. Build limpio, 1832 tests. --- P2 (auditoria) v677: XSS brazalete, mass-assignment citas/mutar, precios canonicos, demo crisis HT real, corte-caja tz. (1) XSS almacenado en brazalete BCMA: servicio/cama/nombre eran texto libre inyectado en document.write -> escape HTML completo. (2) mass-assignment en /api/appointments y /api/hospital/mutar(crear): allowlist de campos + autoria fijada por el servidor (no el cliente). (3) precios desincronizados: Pro $1,899->$1,590, Hospital $2,900->$3,499, Clinica 160->200 creditos alineados al canonico PLANES en todos los banners/ayuda. (4) demo razonamiento: TA 168/96 (que el motor clasifica 'cifras elevadas') -> 186/118 para que la alerta critica de crisis HT sea real. (5) corte-caja: 'hoy' y ventana de cobros ahora en la zona horaria real del consultorio (config.zonaHoraria), no CDMX por defecto -> corrige el dia en el norte (Tijuana UTC-8).
// (v601):

self.addEventListener('install', (event) => {
  // AUTO-ACTUALIZAR: la versión nueva toma control de inmediato (skipWaiting).
  // Evita que alguien se quede pegado en una versión vieja sin poder entrar.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/']).catch(() => {})))
})

// El cliente fuerza la activación SOLO cuando el usuario toca "Actualizar"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
  // Devuelve la versión de ESTE SW para que el cliente sepa si el aviso ya se
  // descartó para esta versión exacta (y no reaparezca por la misma).
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE })
  }
})

// Cuando el usuario hace click en una notificación → enfocar/abrir la app en la URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        // Si ya hay una pestaña abierta de la app, enfocarla y navegar
        for (const c of clientsArr) {
          if ('focus' in c) {
            c.navigate(url).catch(() => {})
            return c.focus()
          }
        }
        // Si no hay ninguna, abrir nueva
        if (self.clients.openWindow) return self.clients.openWindow(url)
      })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }

  // Solo manejar mismo origen; Firestore/APIs externas pasan directo
  if (url.origin !== self.location.origin) return
  // No interferir con rutas API del servidor
  if (url.pathname.startsWith('/api/')) return
  // No interferir con el handler de autenticación de Firebase (proxy /__/auth/*,
  // /__/firebase/*) — debe ir SIEMPRE a la red sin caché, o el login de Google se rompe.
  if (url.pathname.startsWith('/__/')) return

  // Rutas CLÍNICAS: aunque hoy el HTML es un shell (los datos del paciente cargan
  // después desde Firestore), por defensa en profundidad (§11.2) NO cacheamos su
  // HTML — así ningún dato clínico puede quedar en la caché del navegador.
  const esRutaClinica = /^\/(expediente|consulta|nota|receta|orden|referencia|hospitalizacion|valoracion)(\/|$)/.test(url.pathname)

  // Navegaciones de página: network-first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // No cachear respuestas de error (404/500) ni rutas clínicas.
          if (res && res.ok && res.status === 200 && !esRutaClinica) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    )
    return
  }

  // Estáticos: stale-while-revalidate
  const esEstatico = url.pathname.startsWith('/_next/') ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|ico|json)$/.test(url.pathname)
  if (esEstatico) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok && res.status === 200) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})

