/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v555'  // PAYWALL EN SERVIDOR (decision del Dr: 1 dia de gracia). Antes el bloqueo de prueba vencida vivia SOLO en React -> se podia saltar la pantalla y seguir escribiendo gratis; el servidor no revisaba trialEndsAt. Ahora la regla clinicaPuedeEscribir bloquea status=='trial' vencido + 1 dia de gracia, comparando trialEndsAtMs (epoch, las reglas no parsean ISO) que clinic/crear y superadmin/accion ahora escriben junto al ISO. SOLO afecta 'trial': quien paga o esta en Stripe-trialing queda 'active' y NUNCA se bloquea; fail-open si falta trialEndsAtMs (clinicas viejas). Cerrado tambien el hueco de crear una clinica cliente SIN reloj (create exige status 'trial' + trialEndsAtMs acotado <=15d). AUDITORIA INTEGRAL lote 8 (WhatsApp Fix3 + iconos PWA). (1) BOT WhatsApp Fix 3 (REQUIERE prueba en vivo): las citas del bot ya NO quedan huerfanas — resolverPacienteBot busca al paciente por telefono (candidatos: 10 digitos, canonico 52+10, 521+10, crudo; Firestore 'in') y lo CREA si no existe (como el booking), en agendar_confirm y en lista de espera. Sin esto el no-show del segmento WhatsApp nunca se contabilizaba. (2) ICONOS PWA: generados icon-192/512.png + apple-icon.png (180, opaco #0B0C0E) desde icon.svg con sharp; layout apunta apple-touch a PNG (iOS no soporta SVG -> icono en blanco) y el manifest suma los PNG rasterizados (instalabilidad Android/Lighthouse + maskable). AUDITORIA INTEGRAL lote 7 (clinico, validado por el Dr). (1) Alergia a SULFAS ya NO marca furosemida/hidroclorotiazida como choque (sin reactividad cruzada sustentada entre sulfonamidas antibioticas y no-antibioticas; evitaba retirar un diuretico necesario). (2) Betalactamicos: ante alergia a penicilina, los CARBAPENEMICOS (mero/imi/erta/dori) pasan de choque CRITICO a aviso de PRECAUCION (reactividad cruzada ~1%, por cadena lateral) para no descartar 1a linea; las cefalosporinas siguen criticas. (3) Embarazo: se avisa de teratogenos categoria 'evitar' (estatinas/tetraciclinas/quinolonas/AINE) SOLO cuando el Dx/nota indican embarazo confirmado (no por edad, para no meter ruido); los 'contraindicado' (IECA/ARA/warfarina/DOAC/isotretinoina/valproato/MTX/GLP1) siguen avisando siempre. +9 tests. AUDITORIA INTEGRAL lote 6 (bot WhatsApp — REQUIERE prueba en vivo del Dr). (P1) el bot ignoraba los time_blocks (vacaciones/ausencias) y ofrecia/agendaba huecos en dias bloqueados; ahora getAvailableSlotsForDate carga time_blocks y excluye lo bloqueado (por medico o de toda la clinica), como el panel y el booking publico. (P1) la lista de espera agendaba con el PRIMER doctor activo, no con el medico del hueco liberado: waitlist-notify ahora persiste medicoId en la sesion y el bot usa datos.medicoId al confirmar. PENDIENTE (difiero por normalizacion de telefono, necesita datos reales): vincular paciente por telefono en agendar_confirm (hoy pacienteId=''). AUDITORIA INTEGRAL lote 5 (cierre frontend + seguridad segura). Membresias: crear/asignar/pausar/reactivar ahora con try/catch (antes un fallo dejaba el modal abierto sin aviso = unhandled rejection). Superadmin paquetes: borrar pide CONFIRM (accion destructiva) y guardar/borrar verifican res.ok (antes un fallo del server cerraba el modal como si hubiera guardado). SEGURIDAD (regla firestore): clinic_review_requests delete pasa de "if isAuth()" (cualquier usuario logueado borraba la solicitud de otra clinica) a isMember(clinica dueña). AUDITORIA INTEGRAL lote 4 (PWA/privacidad P1). Al cerrar sesion solo se limpiaba localStorage (fraccion menor); la caja fuerte de PHI en disco quedaba: la cache OFFLINE de Firestore en IndexedDB (expedientes/Dx/medicamentos/transcripciones consultadas) y el AUDIO crudo de consultas (nexusmed-recovery). En tablet compartida el siguiente usuario podia leerlas con DevTools. Ahora el logout (Sidebar + AutoLogout por inactividad) ademas: borra la BD de audio (deleteDatabase 'nexusmed-recovery') y limpia la cache Firestore (terminate + clearIndexedDbPersistence), best-effort tras signOut, justo antes de navegar a /login. AUDITORIA INTEGRAL lote 3 (frontend/correctitud). (P2) el modal de signos en hospitalizacion conservaba valores abandonados y podia registrar un signo que la enfermera creia descartado -> se resetea al ABRIR. (P2) finanzas: la tarjeta "Cobros anulados" no se actualizaba tras anular -> recargar tambien refresca los cancelados. (P2) calendario vista MES: dayAppts sin ordenar antes de slice(0,3) ocultaba la cita mas temprana -> sort por hora. (P3) citas: el filtro "por-cobrar" quedaba atascado en lista vacia tras cobrar al ultimo -> regresa a "todas". AUDITORIA INTEGRAL lote 2 (rendimiento). (P1) el listener de citas de 120 dias se montaba en TODA pantalla del panel aunque no hubiera permiso de push (useNotificacionesCitas en el layout "siempre"); ahora el programador vive en un hijo condicional que solo se monta con permiso concedido. (P2) la ficha de hospitalizacion bajaba la coleccion ENTERA de pacientes para resolver 1 nombre -> getPatient (una lectura). (P2) citas: cada fila hacia pacientes.find() lineal -> Map<id,paciente> O(1) (adios jank al buscar con miles de pacientes). (P2) orden "con alerta" de pacientes daba NaN con contadores undefined -> ?? 0. AUDITORIA INTEGRAL lote 1 (seguridad clinica + IA + privacidad + audio). (P1) el gate de negacion de alergias apagaba TODO el chequeo si aparecia una negacion referida a OTRAS alergias ("sulfas; no refiere otras" + sulfa dejaba pasar el choque); ahora solo suprime en negacion PURA. (P1 IA) el schema estampaba via='oral' y severidad='moderada' por defecto (valor plausible-pero-falso que podia degradar una anafilaxia o poner una via inexistente); ahora via='' y severidad='desconocida'. (P2) la red de dosis leia "5 mL" como 5 mg y no parseaba frecuencias en palabra ("cada ocho horas"); ahora mL->null (no valida sin concentracion) y parsea numeros en letra. (P2 privacidad) se quito el NOMBRE del paciente del contexto enviado a la IA. (P2 audio) el audio de una transcripcion fallida ya no se sobrescribe al re-grabar. +18 tests. ANTIBIOGRAMA — 2 decisiones clinicas del Dr (validadas por el). (1) Enterococcus + TMP-SMX: ya NO se marca como "conflicto/reconfirmar especie" (es fenomeno conocido, no error de ID: S in vitro sin folatos, R in vivo con folatos exogenos). Nuevo tipo 'alerta_clinica' -> "No reportar susceptibilidad clinica para TMP-SMX en Enterococcus spp. La aparente susceptibilidad in vitro no predice eficacia clinica." (2) Fosfomicina/Nitrofurantoina: gating conservador — la celda solo es "S/verde" en su indicacion validada. Nitrofurantoina: solo si sitio=orina; fuera de IVU -> gris "No aplicable". Fosfomicina: solo E. coli urinaria; en Klebsiella/Enterobacter/Citrobacter/Serratia/Proteus/Morganella NO se pinta verde con el breakpoint de E. coli. Principio del Dr: perder sensibilidad antes que inducir error terapeutico. +7 tests. (3) Cefepime SDD: revisado — YA correcto (Enterobacterales tiene SDD; en Pseudomonas/Acinetobacter el CLSI define I verdadera, no SDD; no se inventa categoria). AUDITORIA PERDIDA DE DATOS (consulta) — 2 fixes. (P1) "Procesar de nuevo" con IA REEMPLAZABA el arreglo completo de diagnosticos/medicamentos -> borraba en silencio el Dx (con su CIE-10) que el medico habia agregado a mano y que la IA nunca supo. Ahora FUSIONA (anade lo nuevo, respeta lo manual) en los dos sitios (procesar + aplicar-resultado-tras-navegar); solo la re-proyeccion a otra modalidad (tipoOverride) parte de plantilla limpia. (P2) el autoguardado de 30s al servidor tenia como deps resumen/transcripcion/Dx/medicamentos -> se reiniciaba en cada palabra del dictado y NUNCA disparaba dictando sin pausas (solo salvaba el respaldo local del mismo dispositivo). Ahora patron useInterval por ref: intervalo estable armado una vez + closure fresca cada render. AUDITORIA (equipo de auditores) — 7 bugs confirmados reparados. FINANZAS: (P1) un ABONO marcaba la cita como cobrada (CobrarModal ponia cobroId aunque registrarCobro NO lo hace a proposito) -> el saldo quedaba imposible de cobrar; ahora abono/reembolso NO cierran la cita. (P2) membresia "mensual" se cobraba cada 30 dias (12.17 ciclos/ano, sobrefacturacion) -> ahora por MES DE CALENDARIO (sumarMesesISO, +tests). (P2) cobrarMembresia sin candado + boton sin deshabilitar -> boton se bloquea en curso. (P3) cortesia atribuia el nombre del MEDICO como autorizador -> ahora el operador logueado. ANTIBIOGRAMA: (P1) "Razonar con IA" mandaba la CMI como OBJETO no numero -> el motor del server descartaba TODA la logica de CMI (VRSA/VISA/HLAR/SDD) y la IA razonaba sobre panel mutilado; ahora cmi.valor. (P1 SEGURIDAD) "No se detecta carbapenemasa/BLEE/MRSA" se leia como POSITIVO (guard /no detect/ no cubria "no SE detecta") -> inventaba carbapenemasa desde reporte negativo; ahora el negativo gana con fraseo real MX (+tests). (P2) alias suelto 'tazobactam' en PIP_TAZO casaba ceftolozano-tazobactam -> quitado. FIX ANTIBIOGRAMA (cont.): una celda SDD (sensible dosis-dependiente, p. ej. cefepime CMI 4-8, Regla 2 del Dr) que la IA SI leyo caia en el aviso enganoso "NO se pudo leer la interpretacion" porque el panel solo maneja S/I/R. Ahora las SDD se separan y dan un aviso propio y honesto ("Reportados como SDD: X. Capturalos segun el punto de corte de dosis alta"), no se mezclan con las ilegibles. FIX ANTIBIOGRAMA: la foto disparaba "La lectura no cumplio del todo el formato esperado" aunque el antibiograma fuera legible. RAIZ: el schema PerfilExtraido era fragil — una sola variante valida (interpretacion en minuscula 's', palabra 'Sensible', metodo 'Kirby-Bauer', cmi:0) hacia fallar TODO el parseo y devolvia _schemaWarning. Ahora normalizadores tolerantes (z.preprocess) que NO cambian ningun S/I/R real ('sensible'->'S' es transcripcion): interpretacion/metodo/cmi/halo/conf normalizados; una fila ilegible cae a vacio y se descarta SIN tumbar el resto; organismo ausente ya no rompe. +6 tests de regresion. Ademas: el aviso de pruebas mostraba las CLAVES crudas ('dTest, cefoxitinaScreen') -> ahora los nombres legibles (D-test, Tamiz cefoxitina); el sitio auto mostraba la clave 'hueso-articulacion' -> 'Hueso/articulacion'. FINANZAS: COMISIONES POR MEDICO. Nueva lib comisiones.ts (pura, +6 tests) que calcula el reparto por medico sobre lo COBRADO del periodo: el dueno fija el % por medico (o un default) y marca conceptos no comisionables (medicamento/material=costo); base = suma cobrada atribuida menos reembolsos (ya negativos); comision = base*%. Es REPORTE solo lectura (no paga, no mueve dinero). Honesto: % arranca en 0, no inventa tasas. Config en config/comisiones (regla existente: lee miembro, escribe medico). Nueva pestana 'Comisiones' en /finanzas con % editable por medico + tabla en vivo (base/comision/queda-al-consultorio) + cobros sin atribuir. FASE 2 build 4: SELLO DE PROCEDENCIA (trazabilidad por campo). Nueva lib procedencia.ts (pura, +5 tests): para CADA dato estructurado de la nota (dx/medicamento/alergia/signo) DERIVA su origen cruzando la lista final contra la extraccion auditada de IA: 'dictado' (con cita textual literal), 'ia' (inferencia sin cita), 'manual' (lo puso el medico). Nuevo componente SelloProcedencia (tira colapsable 'Procedencia de la nota: 6 del dictado · 2 de IA · 1 a mano', despliega campo por campo con la frase exacta). Montado en la consulta (tambien en nota firmada = parte del registro) y sellado en iaAuditoria.procedencia al guardar. Demostrado en /demo/razonamiento con extraccion sembrada. Honesto: origen derivado de evidencia real, jamas inventado; solo lectura, no altera valores clinicos. FASE 2 build 3: LEARNING ENGINE v1. Nueva lib learning.ts (parte pura testeable, +4 tests) que APRENDE del estilo del medico: cada vez que ACEPTA una sugerencia del copiloto se cuenta su CATEGORIA (prefijo del id: renal/calc/meta/gesta...) en clinics/{id}/learning/{uid}. Con esas frecuencias, las sugerencias NO criticas se reordenan para poner arriba las que ESE medico suele usar; las CRITICAS nunca se mueven (seguridad primero). Arranque en frio honesto: sin datos no cambia nada, mejora con el uso. Personalizacion POR MEDICO, aislada por uid (regla firestore). Persistencia fail-safe: aprender jamas rompe la consulta. FASE 2 build 2: WORKFLOW ORCHESTRATOR v1. Nueva lib workflow.ts (pura, +2 tests) que UNIFICA los flujos sueltos en una sola lista priorizada de 'siguiente accion': consultas atendidas hoy sin cobro, membresias vencidas, citas de hoy sin confirmar. Nuevo PanelPendientes en el dashboard ('Siguiente accion' con badge de urgentes) — auto-carga citas/cobros/membresias. Deterministico, no inventa: cada accion sale de un estado real. Se amplia por especialidad en fases siguientes.

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

