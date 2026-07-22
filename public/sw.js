/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v546'  // ANTIBIOGRAMA — 2 decisiones clinicas del Dr (validadas por el). (1) Enterococcus + TMP-SMX: ya NO se marca como "conflicto/reconfirmar especie" (es fenomeno conocido, no error de ID: S in vitro sin folatos, R in vivo con folatos exogenos). Nuevo tipo 'alerta_clinica' -> "No reportar susceptibilidad clinica para TMP-SMX en Enterococcus spp. La aparente susceptibilidad in vitro no predice eficacia clinica." (2) Fosfomicina/Nitrofurantoina: gating conservador — la celda solo es "S/verde" en su indicacion validada. Nitrofurantoina: solo si sitio=orina; fuera de IVU -> gris "No aplicable". Fosfomicina: solo E. coli urinaria; en Klebsiella/Enterobacter/Citrobacter/Serratia/Proteus/Morganella NO se pinta verde con el breakpoint de E. coli. Principio del Dr: perder sensibilidad antes que inducir error terapeutico. +7 tests. (3) Cefepime SDD: revisado — YA correcto (Enterobacterales tiene SDD; en Pseudomonas/Acinetobacter el CLSI define I verdadera, no SDD; no se inventa categoria). AUDITORIA PERDIDA DE DATOS (consulta) — 2 fixes. (P1) "Procesar de nuevo" con IA REEMPLAZABA el arreglo completo de diagnosticos/medicamentos -> borraba en silencio el Dx (con su CIE-10) que el medico habia agregado a mano y que la IA nunca supo. Ahora FUSIONA (anade lo nuevo, respeta lo manual) en los dos sitios (procesar + aplicar-resultado-tras-navegar); solo la re-proyeccion a otra modalidad (tipoOverride) parte de plantilla limpia. (P2) el autoguardado de 30s al servidor tenia como deps resumen/transcripcion/Dx/medicamentos -> se reiniciaba en cada palabra del dictado y NUNCA disparaba dictando sin pausas (solo salvaba el respaldo local del mismo dispositivo). Ahora patron useInterval por ref: intervalo estable armado una vez + closure fresca cada render. AUDITORIA (equipo de auditores) — 7 bugs confirmados reparados. FINANZAS: (P1) un ABONO marcaba la cita como cobrada (CobrarModal ponia cobroId aunque registrarCobro NO lo hace a proposito) -> el saldo quedaba imposible de cobrar; ahora abono/reembolso NO cierran la cita. (P2) membresia "mensual" se cobraba cada 30 dias (12.17 ciclos/ano, sobrefacturacion) -> ahora por MES DE CALENDARIO (sumarMesesISO, +tests). (P2) cobrarMembresia sin candado + boton sin deshabilitar -> boton se bloquea en curso. (P3) cortesia atribuia el nombre del MEDICO como autorizador -> ahora el operador logueado. ANTIBIOGRAMA: (P1) "Razonar con IA" mandaba la CMI como OBJETO no numero -> el motor del server descartaba TODA la logica de CMI (VRSA/VISA/HLAR/SDD) y la IA razonaba sobre panel mutilado; ahora cmi.valor. (P1 SEGURIDAD) "No se detecta carbapenemasa/BLEE/MRSA" se leia como POSITIVO (guard /no detect/ no cubria "no SE detecta") -> inventaba carbapenemasa desde reporte negativo; ahora el negativo gana con fraseo real MX (+tests). (P2) alias suelto 'tazobactam' en PIP_TAZO casaba ceftolozano-tazobactam -> quitado. FIX ANTIBIOGRAMA (cont.): una celda SDD (sensible dosis-dependiente, p. ej. cefepime CMI 4-8, Regla 2 del Dr) que la IA SI leyo caia en el aviso enganoso "NO se pudo leer la interpretacion" porque el panel solo maneja S/I/R. Ahora las SDD se separan y dan un aviso propio y honesto ("Reportados como SDD: X. Capturalos segun el punto de corte de dosis alta"), no se mezclan con las ilegibles. FIX ANTIBIOGRAMA: la foto disparaba "La lectura no cumplio del todo el formato esperado" aunque el antibiograma fuera legible. RAIZ: el schema PerfilExtraido era fragil — una sola variante valida (interpretacion en minuscula 's', palabra 'Sensible', metodo 'Kirby-Bauer', cmi:0) hacia fallar TODO el parseo y devolvia _schemaWarning. Ahora normalizadores tolerantes (z.preprocess) que NO cambian ningun S/I/R real ('sensible'->'S' es transcripcion): interpretacion/metodo/cmi/halo/conf normalizados; una fila ilegible cae a vacio y se descarta SIN tumbar el resto; organismo ausente ya no rompe. +6 tests de regresion. Ademas: el aviso de pruebas mostraba las CLAVES crudas ('dTest, cefoxitinaScreen') -> ahora los nombres legibles (D-test, Tamiz cefoxitina); el sitio auto mostraba la clave 'hueso-articulacion' -> 'Hueso/articulacion'. FINANZAS: COMISIONES POR MEDICO. Nueva lib comisiones.ts (pura, +6 tests) que calcula el reparto por medico sobre lo COBRADO del periodo: el dueno fija el % por medico (o un default) y marca conceptos no comisionables (medicamento/material=costo); base = suma cobrada atribuida menos reembolsos (ya negativos); comision = base*%. Es REPORTE solo lectura (no paga, no mueve dinero). Honesto: % arranca en 0, no inventa tasas. Config en config/comisiones (regla existente: lee miembro, escribe medico). Nueva pestana 'Comisiones' en /finanzas con % editable por medico + tabla en vivo (base/comision/queda-al-consultorio) + cobros sin atribuir. FASE 2 build 4: SELLO DE PROCEDENCIA (trazabilidad por campo). Nueva lib procedencia.ts (pura, +5 tests): para CADA dato estructurado de la nota (dx/medicamento/alergia/signo) DERIVA su origen cruzando la lista final contra la extraccion auditada de IA: 'dictado' (con cita textual literal), 'ia' (inferencia sin cita), 'manual' (lo puso el medico). Nuevo componente SelloProcedencia (tira colapsable 'Procedencia de la nota: 6 del dictado · 2 de IA · 1 a mano', despliega campo por campo con la frase exacta). Montado en la consulta (tambien en nota firmada = parte del registro) y sellado en iaAuditoria.procedencia al guardar. Demostrado en /demo/razonamiento con extraccion sembrada. Honesto: origen derivado de evidencia real, jamas inventado; solo lectura, no altera valores clinicos. FASE 2 build 3: LEARNING ENGINE v1. Nueva lib learning.ts (parte pura testeable, +4 tests) que APRENDE del estilo del medico: cada vez que ACEPTA una sugerencia del copiloto se cuenta su CATEGORIA (prefijo del id: renal/calc/meta/gesta...) en clinics/{id}/learning/{uid}. Con esas frecuencias, las sugerencias NO criticas se reordenan para poner arriba las que ESE medico suele usar; las CRITICAS nunca se mueven (seguridad primero). Arranque en frio honesto: sin datos no cambia nada, mejora con el uso. Personalizacion POR MEDICO, aislada por uid (regla firestore). Persistencia fail-safe: aprender jamas rompe la consulta. FASE 2 build 2: WORKFLOW ORCHESTRATOR v1. Nueva lib workflow.ts (pura, +2 tests) que UNIFICA los flujos sueltos en una sola lista priorizada de 'siguiente accion': consultas atendidas hoy sin cobro, membresias vencidas, citas de hoy sin confirmar. Nuevo PanelPendientes en el dashboard ('Siguiente accion' con badge de urgentes) — auto-carga citas/cobros/membresias. Deterministico, no inventa: cada accion sale de un estado real. Se amplia por especialidad en fases siguientes.

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

