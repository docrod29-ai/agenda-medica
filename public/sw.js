/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v503'  // BADGES DE ESTADO LEGIBLES EN MODO CLARO. Los StatusBadge (Confirmada, Atendida, Pagada, Cancelada... que salen por toda la app) usaban colores FIJOS de modo oscuro: pasteles claros (verde/azul #34d399/#93c5fd) sobre fondo translucido. En modo claro esos pasteles caian sobre el crema y casi desaparecian (~2.3:1): el medico no distinguia Atendida de Pagada. Ahora cada estado se mapea a un TONO y usa una paleta de badge DEDICADA por tema (texto oscuro sobre fondo muy claro en modo claro; los colores probados de modo oscuro via variables). Medido en el navegador en ambos temas: claro 6.2-7.5:1, oscuro 6.1-8.8:1, todos muy por encima de AA.

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

