/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v742'  // MASTER LOOP V3 · P1-2: CARTERA DE CREDITOS (reservar -> confirmar -> devolver). LOS CREDITOS SE CONTABAN DESPUES DE GASTARLOS: la ruta preguntaba «¿le quedan?», llamaba al modelo, y al final incrementaba el contador. Entre la pregunta y el incremento caben TREINTA SEGUNDOS, y en ese hueco pasan dos cosas: (1) DOS NOTAS SIMULTANEAS DEL MISMO CONSULTORIO PASAN LAS DOS CON EL SALDO DE UNA —increment es atomico, pero la DECISION de gastar no lo era, y en un consultorio de cuatro medicos que comparten la bolsa del plan eso es rutina a fin de mes—; y (2) si la funcion se caia despues de responder, el gasto existio y el contador no se entero: la IA salio gratis y la pago la plataforma. Ahora se APARTAN antes de llamar, dentro de una transaccion que lee el saldo y descuenta EN EL MISMO PASO, y los reservados cuentan como gastados al calcular lo disponible (ignorarlos seria volver al mismo defecto). LA DECISION QUE MAS IMPORTA ES QUE PASA CUANDO ALGO SALE MAL: falla ABIERTO. Si la reserva no se puede leer o escribir por un problema de infraestructura, la llamada procede y queda marcada — dejar a un intensivista sin su nota a las tres de la mañana porque Firestore tuvo un mal minuto es peor que regalar unos creditos. LO CONTRARIO NO SE HACE NUNCA: si el proveedor falla, si la salida no se puede leer, o si se cae la red, los creditos VUELVEN a la bolsa; a un medico al que se le cobra una nota que nunca salio se le quitan dos cosas, el credito y la confianza en el contador. Solo aplica sobre la llave del DUEÑO: con llave propia del consultorio el gasto es suyo y descontarle de nuestra bolsa seria cobrarle dos veces — y un caso fija que es EL MISMO criterio que el gate que ya existia, porque dos respuestas a «¿quien paga esto?» acabarian discrepando y la discrepancia se veria como creditos que desaparecen sin explicacion. AL CABLEARLO SALTO UN COBRO DOBLE: tres rutas migradas al gateway seguian sumando creditos por su lado, asi que la misma nota se habria cobrado dos veces. +24 casos. --- v741:  // MASTER LOOP V3 · P1-1: NEXUS AI GATEWAY. Dieciseis rutas llamaban a Anthropic y OpenAI por su cuenta, cada una repitiendo —CON VARIACIONES— las mismas cuatro decisiones: que modelo intentar, cuando pasar al siguiente, como traducir un HTTP a algo accionable, y como leer la respuesta. LAS VARIACIONES SON LAS QUE COSTARON: el Copilot de UCI se quedo en max_tokens 4000 mientras la nota de consulta ya usaba 24000, y la sintesis llegaba cortada a media llave JUSTO cuando habia mas datos que sintetizar. LO QUE JUSTIFICA EL REFACTOR NO ES LA REPETICION, ES EL LIBRO DE COSTOS: cablearlo ruta por ruta son dieciseis oportunidades de olvidarlo, y luego una mas por cada ruta nueva. Una llamada sin asiento no se ve como un error: se ve como una plataforma que gasta MENOS de lo que gasta. Ahora el asiento no es un paso que el llamador ejecuta, es lo que pasa al volver del fetch — y se anota TAMBIEN cuando la llamada falla, porque un rechazo tras generar tokens se cobra igual (aunque no le quema creditos al medico). Dos reglas que ya habian fallado quedan fijadas: SOLO se cambia de modelo cuando el problema ES el modelo (400/404) —con una llave revocada recorrer la lista entera nada mas retrasa el mismo 401, y reintentar un 429 empeora el limite que acaba de saltar—; y una respuesta TRUNCADA se reporta como truncada y no como ilegible, que manda a buscar el problema al sitio equivocado. La contabilidad nunca bloquea: si Firestore se cae, la sintesis se entrega igual — perder un renglon de contabilidad es un problema, perder la nota que el medico acaba de dictar es otro tamaño de problema. Migradas 5 de 16 (copilot UCI, verificar-nota, atribuir-roles, inmuno, bot de ayuda); las otras cuatro NO dejaban ningun asiento hasta hoy. expediente/procesar se dejo fuera A PROPOSITO: usa razonamiento extendido y migrarla sin soportarlo cambiaria de callado como razona la nota de consulta. +29 casos. --- v740:  // MASTER LOOP V3 · FASE 1 (P1-3 y P1-4). NADA IMPEDIA VENDER UN MODULO EN CONSTRUCCION: buscar INTERNAL/ALPHA/PUBLIC en todo src/ daba cero, asi que Hospital y UCI eran cobrables — y a UCI se le repararon CUATRO fallos de captura del pase ESTE MISMO DIA. Ahora cada producto tiene estado y razon escrita: Free/Agenda/Consulta a la venta; Hospital y UCI en ALPHA sin compra; Acute/Complete/Enterprise internos. LA DISTINCION QUE ORDENA TODO: que el FUNDADOR pueda USAR un modulo no lo pone A LA VENTA. No es diferencia de permisos, es de PROMESA — cuando alguien paga por un modulo, la app afirma que esta terminado, y vender UCI hoy seria cobrar por algo que se esta construyendo. El estado decide si se VENDE; el entitlement decide si se MUESTRA; el Dr. tiene lo segundo sin lo primero y lo usa a diario precisamente para terminarlo. Y EL CIERRE ESTA EN EL SERVIDOR, no en la pantalla: /api/stripe/checkout rechaza con 409 el plan «Hospital + UCI» ($3,499) — la pagina de precios ya no lo enseñaba, pero la ruta aceptaba el plan que viniera en el cuerpo, y esconder una tarjeta no cierra una ruta HTTP. Basta UN modulo en obra para frenar el plan entero: quien paga un paquete no compra cuatro cosas sueltas y no se le entregan tres terminadas y una a medias. --- P1-4: EL FUNDADOR Y UNA CORTESIA ERAN LA MISMA CUENTA. Los dos entran sin pagar y ahi se acaba el parecido: a la CORTESIA se le esta SIRVIENDO el producto (su gasto de IA es costo de operacion, su experiencia es la del cliente); el FUNDADOR esta CONSTRUYENDO el producto (su gasto es I+D). Si lo que el Dr. gasta probando UCI a diario se carga al margen de los usuarios de Consulta, el margen deja de ser real y las decisiones de precio salen mal. Por eso «cuenta como ingreso» y «es costo de servir» son dos preguntas separadas y la cortesia responde distinto a cada una. Ademas /api/uci/copilot llevaba su propia copia suelta de la lista de correos del dueño; ahora hay una sola definicion. DETALLE QUE CASI LO VUELVE UN NO-OP: el primer cableado clasificaba por CORREO, pero el documento de la clinica guarda ownerId (un uid) y no correo — habria devuelto siempre «cliente» viendose identico a una clasificacion que funciona. Ahora cada llamador aporta la verdad que si tiene. +28 casos.
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

