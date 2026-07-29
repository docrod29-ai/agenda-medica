/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v703'  // E0-15b — 'dato ausente != resistente'. estado() devolvia null tanto si el farmaco NO SE PROBO como si no aplica: una E. coli erta-R/mero-S SIN imipenem en el panel salia como MBL + NOM-045 + aislamiento a partir de un dato que nadie midio. Igual en P. aeruginosa al reves: sin cefalosporinas probadas se degradaba a fenotipo benigno y SUPRIMIA la alerta critica. Ahora MISSING -> UNKNOWN, con fenotipo 'indeterminado', peticion explicita de completar el panel y sin generar medidas de control desde un dato faltante. E0-15 COMPLETA (a,b,c,d). +9 tests, 2022 en total. --- v702: E0-15a — el defecto P0 que marco el Dr: 'nunca debe existir una pantalla donde Nexus muestre R y el LLM siga razonando con S'. La edicion experta EUCAST (FQ S->R) vivia solo en su lista y la nota, el prompt del LLM, el validador y el PK/PD leian el panel CRUDO. Ahora hay UNA fuente: resultadosEfectivos. El dato del laboratorio NO se destruye (interpretacionLab) y la nota declara 'lab: S -> R por regla experta' con su fuente. Ademas la nota ya no descarta las alertas 'alta' y la segunda opinion muestra su caja roja de contradicciones (el cliente tiraba el campo que el servidor ya mandaba). +8 tests, 2013 en total. --- v701: E0-15 (c y d) con las decisiones del Dr: la CMI deja de ser un numero pelado y conserva su OPERADOR — un neumococo con penicilina '>2' ya no sale 'S = tratable con penicilina' (el valor real esta POR ENCIMA de 2); igual en betalactamicos de reserva. Y el carbapenemico con alergia a penicilina baja de CRITICA a precaucion (reactividad cruzada <1%), porque bloquear la primera linea en sepsis/meningitis mata mas que el riesgo que evita — vuelve a critica con SCAR, dano de organo o alergia al propio carbapenemico. +16 tests, 2005 en total. --- v700: E0-02 CERRADA con la decision clinica del Dr: amoxicilina pasa de UN techo a TRES niveles (habitual 1000mg/toma y 3000mg/dia; ABSOLUTOS 2000 y 4000; en medio 'dosis alta: verifica indicacion', no sobredosis) -> un nino de 35kg con 1575mg c/12h ya no sale marcado como critico. Y el redondeo ya no puede violar un tope: CLAMP-ROUND-RECHECK-FLOOR (metronidazol 666.6x3=1999.8, no 2000.1). +12 tests de la decision, 1989 en total. --- v699: TODO lo de impresos en UNA pestaña: 'Firma + sello' y 'Hoja membretada para notas' se movieron de 'Datos del consultorio' a la pestana de recetas, que ahora se llama 'Recetas, ordenes y notas'. Estaban lejos de donde se configura lo que se imprime. Se guardan solas (saveConfigPartial), asi que el cambio de pestana no toca la persistencia. --- v698: ENSENAR a configurar la receta para que el cliente no batalle: (1) guia PASO A PASO dentro de la propia pantalla de Recetas y ordenes (abierta sola mientras no haya nada configurado, plegada en cuanto ya esta), y (2) seccion 'Configurar tu receta (paso a paso)' reescrita en conocimiento.ts, que alimenta la Guia de uso Y al bot de ayuda. Incluye el paso que NO esta en la app y es el que mas confunde: en el dialogo de impresion hay que poner el mismo tamano de papel, escala 100% y la orientacion correcta. --- v697: Receta de 13x23 cm en sus DOS orientaciones: 'Receta vertical (13x23)' = hoja cortada a tamano de receta (la del Dr; CABE en carta, asi que admite el modo hoja carta + linea de corte) y 'Receta acostada (23x13)'. La autodeteccion normaliza a vertical y devuelve la vertical como canonica: no puede distinguir orientacion, eso lo decide el medico. --- v696: Papel de receta 23x13 cm (el formato REAL del Dr: 230x130 mm) + opcion PERSONALIZADO donde escribe ancho y alto en mm, con rango 50-500 y fallback seguro (una medida invalida imprimiria una hoja en blanco sin avisar). Asi sirve para cualquier formato sin tener que agregar tamanos uno por uno. --- v695: FIX 'sale descuadrada': la hoja blanca se dibujaba con las medidas del CATALOGO (PAPER_SIZES[paperSize]) mientras la vista previa y el @page usaban las del DISENO subido -> dos tamanos para la misma receta y el contenido corrido fuera de la hoja. Ahora los tres salen de paperEfectivo. Ademas, mientras carga la imagen del membrete se asumia VERTICAL: con un papel ya apaisado (25x15) la hoja se dibujaba de pie y saltaba al cargar; ahora el default es la orientacion del propio papel. --- v694: Simplificado a DOS ajustes independientes: 'Tamano de papel' (recetas y ordenes, ya con la forma continua apaisada 25x15) y 'Tamano de papel de las notas' (evolucion/ingreso/egreso, por DEFAULT carta). Cambiar uno no mueve el otro. Ademas el selector de receta ahora MANDA de verdad: si hay diseno propio subido, se re-encaja al tamano elegido (antes el diseno ganaba en silencio y elegir un tamano no hacia nada visible). 18 tests fijan la separacion. --- v693: papel 250x150.
// v693 fue: // RECETA + ORDEN MEDICA: papel continuo APAISADO 250x150 mm (forma continua de matriz de puntos, p.ej. Epson). Antes la vista previa mostraba una hoja VERTICAL grande con la receta chiquita dentro porque el papel se 'hospedaba' en carta; una hoja mas ANCHA que la carta (250>216) ya no puede hospedarse y sale a su tamano real al 100%, sin escalar. Nuevo tamano seleccionable en Configuracion, @page 250mm 150mm margin 0, html/body fijados a la hoja y print-color-adjust exact (para que el membrete se imprima). Solo receta y orden: las NOTAS (evolucion/ingreso/egreso) NO cambian, va bajo bandera hojaExacta. +10 tests. --- v692: numeros dictados UCI, PHI homonimos, firma bloqueada.
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

