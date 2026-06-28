/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v136'  // Lanzamiento: Google login + recuperar contrasena + paywall al vencer trial

self.addEventListener('install', (event) => {
  // NO skipWaiting automático: la versión nueva ESPERA hasta que el usuario toque
  // "Actualizar" (mensaje SKIP_WAITING). Así el aviso sale una vez por versión real
  // y no genera churn ni se "traba" reapareciendo.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/']).catch(() => {})))
})

// El cliente fuerza la activación SOLO cuando el usuario toca "Actualizar"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
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

  // Navegaciones de página: network-first
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // No cachear respuestas de error (404/500) — evita 404 "fantasmas"
          if (res && res.ok && res.status === 200) {
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
