/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v485'  // COBRAR CIERRA LA CONSULTA + EL CORTE DE CAJA YA NO SE VACIA DE NOCHE. Dos cosas. (1) El modal de cobro de la consulta nunca recibia el citaId —la consulta no sabia a que cita pertenecia— asi que jamas se marcaba cobroId, el boton Cobrar seguia visible en la agenda (su guarda es justo !cobroId) con riesgo de cobrar dos veces al mismo paciente, y habia que ir a otra pantalla a marcar la cita como atendida, de la que dependen el corte, cuentas por cobrar, el CRM y los recordatorios. Ahora se localiza la cita del dia, se marca atendida al cobrar (sin pisar un estado mas avanzado) y el monto se sugiere desde los precios publicos. (2) cobro.dia se guardaba en UTC: un cobro de las 19:00 del lunes en Mexico quedaba archivado como MARTES, y como las citas si se consultan por hora local, al cerrar caja por la noche —que es cuando se cierra— el corte abria en el dia siguiente, vacio, con el dinero en el cajon y las consultas de la tarde marcadas como atendida y no cobrada. Ahora los cobros se consultan por INSTANTE, no por la etiqueta, lo que corrige tambien todo lo ya guardado sin migrar un solo documento.

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

