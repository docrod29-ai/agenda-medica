/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v431'  // Antibiograma DINAMICO: la interpretacion se recalcula SOLA al cambiar organismo/S-I-R/CMI/pruebas (ya no hay que picar Interpretar; adios resultado viejo). Parser fino de CMI con simbolos (<, ≤, >, ≥, razon TMP-SMX 2/38). Version visible en pantalla (chip). SDD 'dependiente de dosis' (cefepime 4-8).  // Antibiograma: captura de PRUEBAS CONFIRMATORIAS del reporte (tamiz cefoxitina MRSA, D-test clindamicina inducible, BLEE confirmatoria, carbapenemasa mCIM/Carba-NP +clase, beta-lactamasa nitrocefina, HLAR) con toggles POS/NEG -> confirman el fenotipo con maxima confianza y ajustan terapia. 650 tests.  // AUTO-UPDATE del SW (recarga sola al desplegar, ya no te quedas en JS viejo) + version visible en consola (window.__NEXUSMED_VERSION). Antibiograma: categoria SDD 'dependiente de dosis' (cefepime Enterobacterales 4-8) ademas de S/I/R. Nota: vanco MIC 2 = Sensible (no intermedio).  // FIX DE RAIZ bibliografia: PubMed devolvia 0 citas de forma intermitente por RATE-LIMIT (la busqueda disparaba hasta 12 requests en paralelo, PubMed sin llave permite 3/s -> 429). Throttle que espacia las llamadas -> ahora IVU da 9,9,9 (antes 9,0,0) y la ruta 12 con meta-analisis. Beneficia tambien 'agregar a la nota'. + fix foto antibiograma (fetchAutenticado).  // FIX foto antibiograma: usaba fetch sin token -> 'No autenticado'; ahora fetchAutenticado (Bearer idToken). Recarga fuerte para tomar el JS nuevo con TODOS los arreglos de evidencia (citas, niveles, agregar a la nota) que llevaban 2 meses atorados por la caida de Vercel.  // Motor de dosis (capa de seguridad del paciente, validado por el Dr) cableado a la receta + comandos de voz on-device (Picovoice, dormido hasta poner la llave). 644 tests.  // Motor de antibiograma de CLASE MUNDIAL (validado por el Dr): inferencia de mecanismo (β-lactamasas/porinas/bombas/carbapenemasas con clase Ambler, citado), paridad EUCAST + epidemiología INVIFAR/GLASS + terapia local MX, extracción por FOTO (foto→perfil S/I/R editable→motor razona), PRUEBAS microbiológicas CLSI M100-Ed35 (ESBL/Carba NP/mCIM-eCIM/D-zone/HLAR con cuándo/método/interpretación) y PUNTOS DE CORTE CMI→S/I/R de 6 grupos (Enterobacterales/Pseudomonas/Acinetobacter/Staph/Enterococcus/neumococo por sitio). 632 tests. // Re-disparar despliegue (Vercel quedó atorado en v419). Incluye v420-v423: citas PubMed (quitar ventana de años + queries cortas), coherencia de niveles (Haiku<Sonnet<Opus, sin ensamble), NER con timeouts, motor respetado. COHERENCIA de niveles en el análisis de evidencia: UN solo modelo por motor, monotónico (Rápida=Haiku < Estándar=Sonnet < Máxima=Opus). Se quita el ensamble Claude+GPT fusionado que ensuciaba Estándar y la hacía ver PEOR que Rápida. Ahora cada nivel es limpio, reproducible y claramente mejor que el anterior. // FIX DEFINITIVO citas PubMed: probado en vivo que (query + filtro HQ + ventana 7 años) daba 0 para IVU recurrente, pero SIN ventana da 12. Se quita la ventana rígida de años (la búsqueda ya prioriza alta calidad internamente) + Haiku genera queries CORTAS (2-4 palabras, no frases largas que traen 0). Verificado: IVU->12 fuentes, IC->10, neumonía->9. // FIX NER "error de red" (timeouts AbortSignal en la lista de modelos y en la llamada Claude, ya no cuelga) + citas: respaldo amplio de PubMed sin ventana de años cuando el filtro estricto no devuelve nada -> casi siempre aparecen fuentes con PMID. // El análisis de evidencia RESPETA EL MOTOR que eliges: Rápida→Haiku (solo, veloz), Estándar→Sonnet+GPT, Máxima→Opus+GPT. Antes usaba solo el nivel del plan -> daba igual el motor. El aviso ahora dice qué modelo usó (Opus/Sonnet/Haiku). // El análisis de evidencia RESPETA el plan otra vez: Premium -> Opus (no Sonnet forzado). Clave: Opus SIN razonamiento extendido = rápido (~15-25s) Y de máximo nivel (lo lento era el thinking, no Opus). Ahora cambiar de modelo SÍ se nota. La nota ya respetaba el motor elegido. // VELOCIDAD del análisis de evidencia: el constructor de consulta pasa de Sonnet (~12s en serie) a HAIKU (~2-3s) + la búsqueda determinista corre EN PARALELO (nunca esperamos solo al constructor). Sin perder calidad (sigue búsqueda HQ + razonamiento Sonnet+GPT). // Calidad de evidencia: (1) prioriza el MOTIVO DE CONSULTA (problema activo) sobre comorbilidades en la búsqueda y el razonamiento; (2) usa buscarEvidenciaMulti (ALTA calidad: revisiones sistemáticas/meta-análisis/RCT/guías, reciente 7 años + landmark) en vez de la búsqueda simple; (3) quita GPC-CENETEC/NOM del prompt -> evidencia internacional (Cochrane/IDSA/AUA/EAU/ADA), inglés. // FIX guardado de suscripciones (superadmin): onHecho cerraba el modal (setSel(null)) en CADA acción -> se perdían ediciones pendientes y parecía "no se guarda". Ahora el modal se queda abierto, guarda cada cosa (nivel IA + módulos, Admin SDK) y confirma con "Guardado ✓" o muestra el error real si falla. // FIX RAÍZ del timeout de evidencia: el análisis usaba nivelIADe(plan); si era 'premium' corría Opus + razonamiento extendido -> >40s -> "operation aborted due to timeout" en Claude Y GPT. Ahora el análisis SIEMPRE usa Sonnet SIN thinking + gpt-4o (rápidos) + max_tokens 4000, independiente del plan. Debe responder en segundos. // Evidencia: (a) el aviso ahora dice el MOTIVO real del fallo del modelo (Claude/GPT: llave inválida/sin créditos/timeout) en vez de genérico; (b) timeout de red real (AbortSignal) a cada modelo; (c) regresa el constructor de consulta con IA (con timeout 12s) para fuentes RELEVANTES (antes traía artículos administrativos por "management"). // FIX 504 (timeout) del análisis de evidencia: el ensamble hacía 4 llamadas EN SECUENCIA (construir query + PubMed + Claude + GPT + síntesis) -> se pasaba del tiempo de la función. Ahora: consulta determinista (sin llamada extra), Claude+GPT en PARALELO con timeout por modelo, y FUSIÓN programática (sin 3ª llamada de síntesis). Igual el ensamble de la nota (Máxima) con presupuesto de 25s. // FIX DEFINITIVO evidencia: nivelIADe() (Firestore) estaba SIN try/catch -> lanzaba 500 -> toast mudo. Ahora: nivelIADe blindado + RED DE SEGURIDAD TOTAL (try global: ninguna excepción da 500, devuelve el error REAL) + el cliente muestra el motivo real y lo loguea en consola. // FIX "No se pudo analizar la evidencia" (era un 500: la búsqueda de PubMed lanzaba excepción FUERA del try/catch). Ahora todo el bloque de búsqueda + la resolución de llave van protegidos: un fallo de PubMed nunca tumba el análisis, la IA razona igual. + ENSAMBLE DE LA NOTA (💎 Máxima): Claude y GPT redactan y Claude fusiona lo mejor de ambos (a prueba de fallos: si falla, queda la nota de Claude). // ENSAMBLE MULTI-MODELO en el análisis de evidencia: Claude (Opus/Sonnet) y GPT (OpenAI) analizan el MISMO caso en paralelo y Claude FUSIONA en una sola respuesta (consenso=alta confianza; discrepancia=reconcilia). Sin llave OpenAI usa solo Claude (sin regresión). El panel avisa cuándo es respuesta combinada. // CAMBIO DE FONDO evidencia: la IA (Opus/Sonnet) ahora RAZONA SIEMPRE el caso a nivel subespecialista — antes se rendía si PubMed no traía artículos. PubMed pasa a REFORZAR con citas, no a condicionar. Acepta todo el contexto (dx+meds+resumen), no solo campos estructurados. Prompt de razonamiento profundo. // Simplificación UX evidencia: de 3 botones a 2 (Análisis basado en evidencia + Preguntar a la evidencia). El "agregar a la nota" ahora vive DENTRO del resultado (ves la evidencia y decides si la agregas). // FIX evidencia PubMed: decía "no hay evidencia" para IVU recurrente (¡de lo más estudiado!) porque el traductor no conocía "IVU" y buscaba en español -> 0 resultados. Ahora la IA arma la consulta EN inglés/MeSH (entiende IVU/DM2/HAS/etc.) + diccionario ampliado con abreviaturas MX + reintento sin filtro de años. Verificado: IVU -> 3+ artículos reales. // FIX robusto JSON cortado: auto-reparación — si la IA de estructura corta el JSON por max_tokens, reintenta SOLO 1 vez SIN thinking y con 32000 (todo el presupuesto al JSON); base subida a 24000 en Sonnet/Opus. Ya no debe salir "JSON cortado". // FIX URGENTE consulta por voz: (1) corrector destrozaba español correcto ("hipertensión arterial"->"hypotension bacterial", "tabaquismo"->"Tabacism") — desactivado el fuzzy palabra-por-palabra, n-gramas endurecido, typos legítimos al diccionario curado, +11 tests de regresión. (2) IA de estructura cortaba el JSON por max_tokens — subido a 24000 con thinking (18000 para el JSON). 583 tests. // Loop iter 4 (IA clínica anti-alucinación): validador de formato CIE-10 (RE_CIE10) + cie10EnCatalogoBase en cie10.ts; validarNOM004 advierte códigos CIE-10 con formato inválido (probable alucinación de la IA). 572 tests. // Loop iter 3: seguridad de paciente — validarNOM004 ahora usa el matcher por FAMILIAS (betalactámicos/sulfas/AINE) como compuerta que BLOQUEA la firma (antes solo avisaba: alergia penicilina + cefalosporina se escapaba). + honestidad: panel de cumplimiento aclara autoevaluación, no certificación. 566 tests. // Loop iter 2 (AppSec): cron/reminders fail-CLOSED en prod (sin CRON_SECRET no corre; antes fail-open) + rate-limit en 8 endpoints de IA/transcripción sin límite (detectar-campos, consultor-evidencia, evidencia, atribuir-roles, extraer-entidades, verificar-nota, transcribir-chunk/diarizado). // Loop de mejora (panel 4.93/10) iter 1: FIX pérdida de datos hospital (balance/escala/SBAR se truncaban con .slice -> ahora registro DURABLE append-only en subcolección `registros`, NOM-004) + LOINC SpO2 unificado (2708-6) entre los 2 mappers FHIR. 565 tests. // Herramienta de Antibiograma (/antibiograma): motor determinista PROA validado por el Dr (MRSA+vancoMIC>2, VRE, carbapenemasa+clase por CZA, AmpC por cefoxitina R incl. plasmídicos, BLEE, PK/PD, notificación NOM-045). 561 tests, tsc + next build OK. Motor separado — no toca la consulta.

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

