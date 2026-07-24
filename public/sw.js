/* Service Worker — Agenda Médica
 * Estrategia conservadora para no romper la carga de Next.js:
 *  - Navegaciones: network-first con respaldo en caché (app shell offline)
 *  - Estáticos (/_next, css, js, fuentes, imágenes): stale-while-revalidate
 *  - API y orígenes externos (Firestore/googleapis): se dejan pasar sin tocar
 *    (Firestore maneja su propia persistencia offline vía IndexedDB)
 */
const CACHE = 'nexusmed-v589'  // LOTE ingenieria 3 ("arregla todo"): (1) P1 SEGUNDA OPINION FALSAMENTE LIMPIA: si el segundo modelo (verificar-nota) no devolvia un JSON parseable, el endpoint respondia hallazgos:[] = "sin observaciones de seguridad", que el medico lee como "nota revisada y limpia". La revision HABIA FALLADO. Ahora el server devuelve {ok:false, incompleto:true, error:"...NO fue verificada; reintenta"} y el cliente NO pinta el verde: muestra un toast de error (antes: silencio). (2) P1 CROSS-CHECK DE ALERGIAS NUNCA RECIBIA LAS DEL EXPEDIENTE: extraer-entidades solo cruzaba las alergias DICTADAS en la consulta; un paciente con "penicilina" en su ficha (pero no dictada) no disparaba el bloqueo alergia-vs-medicamento. Ahora el cliente manda patient.alergias y buildNerUserPrompt las incrusta como confirmadas en el cross-check. (3) P1 descartar() borraba el respaldo del EPISODIO EQUIVOCADO: respaldoKey depende del episodio (internamientoActivo) pero faltaba en las deps del callback -> al cambiar de episodio conservaba la llave vieja; se declaro respaldoKey arriba (evita TDZ) y se completaron las deps. (4) P1 EDITAR CITA PASADA BLOQUEABA EL GUARDADO: getAvailableSlots solo da horas futuras, asi que al editar una cita cuya hora ya paso (marcar atendida/no-asistio, corregir notas) el modal LIMPIABA la hora y handleSave la rechazaba; ahora la hora original de la cita editada es siempre seleccionable y no se borra. 4 tests nuevos de buildNerUserPrompt. 1507 pasando. // LOTE ingenieria 2: (1) P0 AUDIO de recuperacion se CORROMPIA al salir grabando: liberarRecursos hacia rec.stop() (dispara un ondataavailable final async) y reseteaba todosChunksRef=[] -> el ultimo fragmento se guardaba con idx base-1 y PISABA un chunk valido en IndexedDB; ahora se desengancha rec.ondataavailable ANTES de stop(). (2) P1 COBRO SUELTO desde Finanzas fallaba SIEMPRE: Firestore rechaza campos undefined (citaId/pacienteId en un cobro sin cita); se limpian los undefined del payload. (3) P1 firestore.rules ARCO: `create: if true` permitia spamear docs INMUTABLES en cualquier clinica; ahora exige que la clinica exista, estado='recibida', clinicId correcto y campos de texto acotados (reglas desplegadas). 1504 tests. // SEGURIDAD + PERDIDA DE DATOS (P0 de ingenieria de la corrida COMPLETA 452/452): (1) firestore.rules: invitaciones `list` era `if isAuth()` -> cualquier usuario podia ENUMERAR todas las invitaciones de TODAS las clinicas (nombre, invitado, rol y CODIGO de union) = fuga cross-tenant + toma de cuenta; cerrado a `if false` (el cliente nunca lista, el join usa Admin SDK por id). (2) firestore.rules: clinic_members update no fijaba clinicId -> un admin podia reapuntar su membresia a OTRA clinica; ahora se pinnea clinicId. (reglas desplegadas). (3) P0 perdida de datos: si getPatient fallaba, el autoguardado escribia nombre='' y alergias='' encima de la nota y apagaba el cross-check; nuevo flag pacienteError bloquea el guardado. (4) P0 XSS almacenado en /dr/[clinicId]: JSON-LD con datos de usuario dentro de <script> sin escapar; se escapan <,>,& y separadores de linea. 1504 tests. // ANTIBIOGRAMA lote 4 (P1 infecto): DAPTOMICINA CMI 1 en S. aureus (que ES sensible, S<=1) se reportaba como no-S y descartaba un agente de PRIMERA LINEA en bacteriemia por SARM; el umbral estaba en 1 con condicion '>=1'. Corregido a >=2 (primer valor no-S en estafilococo). 2 tests. // ANTIBIOGRAMA lote 3 (P0 infecto): ERTAPENEM es R INTRINSECO en Pseudomonas y Acinetobacter, pero estaba en CARBAPENEM, asi que un ertapenem R en la placa disparaba FALSA carbapenemasa + FALSA notificacion NOM-045 + falso aislamiento. Nuevo CARBAPENEM_ANTIPSEUDOMONAS (mero/imi/dori, SIN ertapenem) usado en el modulo de no-fermentadores. 2 tests. // ANTIBIOGRAMA lote 2 (P0 infecto): un organismo con genero ABREVIADO («K. pneumoniae», «E. cloacae», «S. marcescens») apagaba EN SILENCIO todo el motor de Enterobacterales (sin BLEE, sin AmpC, sin carbapenemasa) porque organismoEs hace includes y «k. pneumoniae» no contiene «klebsiella». Se agregaron las formas abreviadas CON especie (que desambiguan y NO confunden K. pneumoniae con el neumococo) a ENTEROBACTERALES y al grupo AmpC inducible. 3 tests. // ANTIBIOGRAMA lote 1 (P0 infecto, hallado por MUCHOS auditores en la 3a corrida): el alias suelto 'avibactam' hacia que «Aztreonam-avibactam» (el farmaco de las metalo-b-lactamasas/NDM) se leyera como ceftazidima-avibactam en DOS matchers (util.ts y clsi-breakpoints.ts) -> una MBL se informaba con el mecanismo/breakpoints equivocados. Se quito el alias suelto en ambos, se anadio AZTREONAM_AVIBACTAM como farmaco propio, y claveFarmaco de la tabla CLSI ahora usa el matcher endurecido coincideAntibiotico (limite de token + regla de inhibidores) en vez de includes crudo -> tambien arregla cefepime-taniborbactam/enmetazobactam. Sin breakpoints propios de aztreonam-avibactam devuelve 'sin punto de corte' (seguro) hasta que el Dr valide. 4 tests. 1497 pasando. // GRUPO C lote 3 (CIERRE del grupo C): (1) VALOR DE PANICO en unidad no reconocida se archivaba como normal -> extraccion de labs ahora marca noEvaluable + badge 'verificar unidad' en PanelLaboratorios (troponina en ng/L, lactato en mg/dL ya no pasan como buenos); (2) RE-DOSIS intraoperatoria: el texto anclaba a la incision -> ahora dice 'desde el INICIO de la dosis preoperatoria (no desde la incision)'; (3) capa de RIESGO HEPATICO de farmacos que NADIE consumia: sinonimos por clase (AINE/benzodiacepinas/opioides/estatinas) + coincideHepatico + conectada al copiloto (alerta 'evitar' cuando el dx trae hepatopatia). 11 tests. 1494 pasando. GRUPO C COMPLETO. // GRUPO C lote 2: (1) POTASIO y SODIO del dictado se tiraban -> el copiloto ahora alerta hiper/hipokalemia (K>=6.5 o <=2.5) y disnatremia (Na>=160 o <=120) reutilizando los umbrales YA auditados de lab-criticos.ts (sin inventar); (2) la interaccion anticoagulante+AINE solo cubria antivit-K y DOAC: se agregaron HBPM (enoxaparina/dalteparina/tinzaparina...), heparina, fondaparinux y antiagregantes (clopidogrel/prasugrel/ticagrelor). 7 tests. 1488 pasando. // GRUPO C lote 1 (estructurales, sin inventar valores): (1) alerta de alergia de la RECETA no reconocia cefazolina/ceftazidima/cefixima como betalactamicos -> un alergico a penicilina podia recibir cefazolina (profilaxis Qx) sin alerta; se unifico con el copiloto; (2) alergia a un AINE CONCRETO (diclofenaco/ketorolaco) no disparaba con otro AINE porque `dispara` solo tenia 4 terminos; (3) CKD-EPI/Cockcroft (formulas de ADULTO) aplicadas a <18a daban TFG falsamente normal y se ofrecia pegarla a la nota -> reja de edad en copiloto y evaluarFuncionRenal (avisa que en peds se usa Schwartz con talla); la receta ya no ajusta por ese valor en ninos. 10 tests. 1481 pasando. // AUDITORIA LOTE 9 (valores clinicos validados por el Dr): (1) PESO-PARA-EDAD OMS ya no usa cortes de IMC -> >+2DE = 'peso alto para la edad, evaluar IMC', sin sobrepeso/obesidad; (2) SALBUTAMOL nebulizado marcado como RESCATE: sin total diario absurdo; (3) KETOROLACO por via ORAL: tope 40 mg/dia (antes usaba el parenteral 120) + hard-stop VO en <17 anios; revisarDosis ahora conoce via y edad; (4) NEWS2 ESCALA 2 de SpO2 (objetivo 88-92%, tabla completa) activable manual, NO auto por EPOC; (5) KDIGO LRA con VENTANA temporal: Δ≥0.3 en 48h o ≥1.5x basal en 7d; fuera de eso = progresion de ERC, no LRA; (6) ENOXAPARINA profilaxis CrCl<30 -> 20 mg SC c/24h (NO suspender). 20 tests nuevos, 1471 pasando. // AUDITORIA P0 pediatrico (valores validados por el Dr): (1) gentamicina y amikacina eran los UNICOS sin tope -> con peso erroneo la app imprimia miles de mg; ahora amikacina tope absoluto 1500 mg/dia + ambos topeMgKgDia (genta 7.5, amika 15); (2) entrada NEONATAL de gentamicina <=7 dias (5 mg/kg/dia c/12h); (3) reja de EDAD: FarmacoPed.edadMinimaMeses; el panel ya no ofrece a un clic farmacos contraindicados por edad -> muestra "NO CORRESPONDE A ESTA EDAD" sin dosis ni boton; codificadas las 3 notas existentes (ibuprofeno <6m, TMP-SMX <2m, nitrofurantoina <1m); (4) guard estructural: test que falla si algun farmaco queda sin tope. 8 tests nuevos, 1457 pasando. // Honestidad demo (P2 lista del Dr): /demo/razonamiento decia "caso real de consultorio" siendo ficticio -> ahora "caso sintetico (paciente ficticio, sin datos reales)". // v576: GUIA ACC/AHA 2026 (imagenes validadas por el Dr) + fix P1 de metas LDL: (1) el copiloto llamaba metaLipidica solo con {diabetes,ascvd,tg} -> meta SIEMPRE la mas laxa y la nota afirmaba "diabetes SIN factores" sin interrogarlos; ahora deriva factoresRiesgo/erc del dx y calcula preventPct real. (2) Escalon que faltaba: PREVENT <3% -> LDL <130/noHDL <160 (solo cuando el PREVENT bajo esta calculado). (3) NUEVO recomendarEstatina() = imagen "a quien indicar estatina": LDL>=190->alta, ASCVD->alta, DM2 40-75->moderada (alta si multiples FR), ERC 3-4, VIH, CAC>=100, y por PREVENT (<3 no rutina/3-5 potenciadores/5-10 moderada/>=10 alta); se expone en el copiloto. Lp(a), PREVENT 10+30a, CAC ya existian. 15 tests nuevos. 1449 pasando. NOTA: el no-HDL sigue la regla LDL+30 del motor; las imagenes muestran <160 universal -> pendiente confirmar con el Dr. // v575: LOTE 7 renal - P0 QUE HALLARON CINCO ESPECIALISTAS POR SEPARADO: el catalogo renal guardaba dos entradas con nombre de CLASE ('Antiinflamatorios no esteroideos', 'Aminoglucosidos') SIN sinonimos, y el match es por subcadena contra el nombre. Ninguna receta real dice eso: dice "Ketorolaco 30 mg". Resultado: la contraindicacion de AINE con TFG<30 y la nota de la "triple whammy" (AINE+IECA/ARA-II+diuretico) eran CODIGO MUERTO. Un verificador lo reprodujo: TFG 28 + ketorolaco + ibuprofeno + losartan + furosemida devolvia SOLO la TFG. Peor: el medico veia que SI alertaba de metformina, asi que la ausencia de alerta se leia como aprobacion. FIX: campo `sinonimos` en FarmacoRenal + helper coincideRenal() usado en los 3 matchers, poblado REUSANDO las listas que ya existen en el repo (copiloto.ts FAMILIAS_ALERGIA y funcion-renal.ts). Ademas: (2) guard de longitud en copiloto (una fila vacia inventaba contraindicacion de metformina), (3) P2 x3 auditores: el termino 'ara' casaba dentro de "par-ARA-cetamol" -> falsa hiperkalemia con paracetamol+espironolactona; ahora los terminos cortos (<=4) exigen palabra completa y los largos siguen por raiz. 20 tests nuevos. 1434 pasando. // v574: fecha de nacimiento calcula la edad (simulacion con paciente de prueba): la FECHA DE NACIMIENTO ahora CALCULA la edad en el alta de pacientes. Eran dos campos independientes: habia que teclear la edad aunque ya se diera la fecha, nada impedia guardar "nacio 2019" con "edad 40", y la edad guardada envejecia mal (un nino registrado a los 6 seguia teniendo 6 al ano siguiente). De esa edad comen la dosis pediatrica, los percentiles OMS, el esquema de vacunacion y las escalas de riesgo CV. Reusa edadEnAnios() de pediatria.ts; sigue siendo editable a mano (hay pacientes que solo saben su edad aproximada). // v573: LOTE 6 honestidad del paso 7: el paso 7 del panel "Como razone este caso" afirmaba en VERDE "N farmacos revisados: sin exceso de dosis, ajuste renal ni riesgo gestacional detectado" en TODO adulto -- pero sus chequeos (ped:dosis/renal:/gesta:) SOLO corren con paciente pediatrico CON peso, creatinina capturada o embarazo. En un adulto comun no corria ninguno: era un "revisado y limpio" que nunca ocurrio, justo en el panel que existe para dar confianza. Ahora declara QUE pudo evaluar y QUE NO ("falta la creatinina", "falta el peso"), el estado deja de ser 'ok' cuando no se evaluo nada y la confianza baja. 4 tests. 1419 pasando. // v572: LOTE 5 PREVENT: PREVENT infra-estimaba el riesgo CV. "Toma antihipertensivo" es una ENTRADA de la ecuacion, pero la deteccion solo cubria 9 farmacos: un paciente con irbesartan, captopril, ramipril, bisoprolol, carvedilol, nifedipino o indapamida contaba como NO TRATADO y su riesgo salia mal. Se completo por CLASE (ARA-II, IECA, calcioantagonistas, betabloqueadores, diureticos) - clasificacion factual de farmacos, sin tocar umbrales ni la formula. 9 tests nuevos que prueban el EFECTO (el riesgo de los farmacos nuevos ahora iguala al del losartan y difiere del no tratado). 1415 pasando. // v571: LOTE 4: (1) P2 "colesterol no-HDL" casaba \bhdl\b (el guion separa palabra) y un no-HDL de 140 se guardaba como HDL excelente -> PREVENT subestimaba el riesgo CV; ahora no se captura (mejor perder un dato que envenenar una formula). (2) P2 frecuencias en RANGO ("cada 4 a 6 horas") no casaban ningun patron -> null -> se asumia 1 toma/dia y el TECHO DIARIO se apagaba en silencio (paracetamol 1000mg c/4-6h = 6000mg/dia, techo 4000, sin alerta); ahora se toma el intervalo mas corto = peor caso. (3) P1 VACUNAS: el panel llamaba vacunasSegunEdad SIN las aplicadas, asi que TODA vacuna con fecha pasada salia "ATRASADA" en todo nino y se escribia "esquema incompleto" al expediente; la app no guarda que se aplico -> ahora dice "CORRESPONDE POR EDAD", avisa que no hay registro y remite a la cartilla. 12 tests nuevos. 1406 pasando. // v570: LOTE 3: (1) P1 UNIDADES peso/talla en el parser del dictado: el peso del RECIEN NACIDO en kg ("3.5 kg") NUNCA se capturaba (el patron exigia 2-3 digitos) y ahora tambien lee gramos ("3200 gramos"->3.2 kg); la TALLA se guardaba en METROS dentro de un campo documentado en CENTIMETROS (types/expediente.ts) que imc() divide entre 100 -> IMC de 249000; ahora todo se normaliza a cm ("1.70 m"->170, "50 cm"->50) con rangos de plausibilidad. (2) P1 la regla "Anticoagulante + AINE" solo cubria antagonistas de vitamina K: ningun anticoagulante oral directo (apixaban/rivaroxaban/dabigatran/edoxaban, los mas usados hoy en FA) disparaba alerta; se completo la lista sin cambiar severidad ni texto. 14 tests nuevos. 1399 pasando. // v569: P0 pediatrico por-kilo: la red de seguridad de dosis estaba MUERTA cuando la dosis se escribe POR KILO, que es como se prescribe en pediatria. "50 mg/kg" se leia como 50 mg ABSOLUTOS y revisarDosis los dividia OTRA VEZ entre el peso (50/20kg = 2.5 mg/kg) -> jamas superaba el techo -> jamas alertaba. Nuevo esDosisPorKg() + flag dosisPorKg en revisarDosis: con dosis por kilo el valor ES los mg/kg (no se divide) y ahora funciona INCLUSO SIN PESO capturado. 6 tests de regresion. 1385 tests pasando. // v568: LOTE 1 (2 hallazgos graves confirmados 2/2): (1) P0 SCORES INCOMPLETOS: un desplegable sin elegir valia 0 al sumar, subestimando la gravedad -> Child-Pugh con llenado parcial daba "Clase A compensada" a un Child B/C, Glasgow podia cruzar falso el umbral <=8 "Grave", y HEART sin troponina daba "Riesgo bajo" en dolor toracico; ademas el resultado se pegaba al expediente. Ahora ningun score da puntaje hasta responder TODOS los campos ('-' borra el campo en vez de guardar 0) y no se puede pegar a la nota. (2) P1 FIB-4 1000x MAS BAJO: labsDesdeEstudios entrega plaquetas en absoluto/uL (150000) pero fib4() las espera en x10^9/L (150) -> todo paciente salia "riesgo bajo de fibrosis". 8 tests de regresion nuevos. 1379 tests pasando. // v567: Breakpoints CLSI M100-Ed35 VALIDADOS por el Dr (leidos del documento): minociclina/Acinetobacter S<=1/I=2/R>=4 y pip-tazo/Pseudomonas S<=16/I=32/R>=64 (32 es I, NO SDD). Ya estaban correctos en el codigo (estaban marcados "pendiente de validar" porque no podia leer el PDF de 174MB); ahora blindados con 9 tests de regresion + comentarios de procedencia. // v566: Learning Engine REAL (aprende recetas): ahora aprende las RECETAS del medico. Al imprimir/descargar una receta guarda cada farmaco con SU posologia (dosis/via/frecuencia/duracion) en clinics/{id}/learning/{uid}.meds; en la receta aparecen chips "Tus mas recetados" que llenan la fila completa con 1 toque (evita duplicados, respeta tope 6, todo editable). Puro+testeable (8 tests), fail-safe, aislado por autor (regla existente). // v565: Workflow Orchestrator demostrado en publico: DemoWorkflow (sembrado, mismo motor puro accionesPendientes que el dashboard) en /operacion muestra la lista priorizada "Siguiente accion" (consulta sin cobro=alta, membresia vencida=alta, cita sin confirmar=media) y OMITE lo ya cobrado a proposito (prueba que filtra de verdad). Respalda el "Activo" de /arquitectura con evidencia, no solo nombre. // v564: Descubribilidad del Medical OS: la landing ahora enlaza a /arquitectura, /paquetes, /demo/razonamiento y /operacion (footer sitemap + fila de CTAs al final de "Como funciona"). Antes eran inalcanzables desde la entrada. // v563: Honestidad del encabezado del demo: ya no dice "sin internet" (la seccion de evidencia SI consulta PubMed en vivo); aclara que los 12 pasos corren con codigo y la evidencia se recupera de PubMed en vivo. // v562: Pasos 8-9 del razonamiento ENCENDIDOS en vivo y en publico: nuevo endpoint publico cacheado /api/demo/evidencia recupera de PubMed REAL (E-utilities, sin llave ni login) articulos del caso sembrado (triple whammy AINE+IECA+ERC) con PMID/DOI verificables; componente EvidenciaEnVivo montado en /demo/razonamiento. Query FIJA (sin input=seguro), cache 6h en memoria, timeout 15s, degradacion honesta (nunca inventa PMIDs). Verificado: 5 PMIDs reales incl. BMJ 2013 triple whammy 23423372.

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

