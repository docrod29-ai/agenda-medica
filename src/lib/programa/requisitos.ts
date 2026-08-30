/**
 * EL CENSO DEL PROGRAMA — para que ningún requisito desaparezca por olvido.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * `docs/product/AUSCULTA-MASTER-BOARD.md` es el tablero canónico y está bien
 * escrito, pero es **prosa**. Un requisito que se cae de una tabla de markdown no
 * rompe nada: simplemente deja de existir, y el siguiente documento derivado
 * —una nota de PR, un resumen de certificación, un `FINAL-READINESS`— hereda el
 * hueco sin notarlo.
 *
 * Eso ya pasó y se puede señalar con el dedo. Reconciliando el tablero contra el
 * alcance canónico completo aparecieron **seis dominios sin una sola fila**:
 * voz, aprendizaje, autoridad de la automatización, WhatsApp, razonamiento y
 * accesibilidad. No estaban en `DEFERRED`, no estaban `BLOCKED_EXTERNAL`, no
 * estaban en ningún estado: **no estaban**. Y el producto tiene un subsistema de
 * voz enorme, con reglas propias en `.claude/rules/voice-asr.md`.
 *
 * Un tablero que puede perder un dominio entero sin ponerse rojo no es custodia:
 * es una foto.
 *
 * ── QUÉ ES ESTE ARCHIVO, Y QUÉ NO ────────────────────────────────────────────
 *
 * Es el **censo**: la lista de requisitos con su estado y con lo que ese estado
 * obliga a escribir. Su guardián (`el-programa-no-pierde-requisitos.test.ts`)
 * falla si un requisito desaparece, si baja de estado sin decirlo, o si un
 * estado se declara sin la evidencia que ese estado exige.
 *
 * **No sustituye al tablero.** El tablero explica *por qué* —la causa raíz, la
 * historia, la cita del archivo— y eso no cabe en una tabla de datos. Aquí vive
 * lo que una máquina puede vigilar; allí, lo que un humano necesita leer.
 *
 * **No se deriva de la documentación.** Donde el repositorio ya tiene la verdad
 * —el catálogo de proveedores de evidencia, el ledger de regresiones— este censo
 * **apunta** a esa fuente en vez de copiarla. Copiar es cómo nacen las dos
 * verdades que este producto persigue por todas partes.
 *
 * ── LA REGLA DEL ESTADO ──────────────────────────────────────────────────────
 *
 * `PROVEN` exige evidencia, comando reproducible y resultado observado. Los tres.
 * Un `PROVEN` sin comando es una opinión con formato de dato.
 *
 * `BLOCKED_EXTERNAL` exige decir **qué acción externa exacta** lo desbloquea y
 * **qué preparación interna ya está hecha**. Sin lo segundo, «bloqueado» es la
 * palabra que se usa para no terminar algo.
 *
 * Todo lo demás exige `queFalta`. Un requisito sin eso es un requisito que nadie
 * puede retomar.
 */

/**
 * Los estados del programa. `NOT_PROVEN` no aparece como estado propio: es la
 * unión de todo lo que no es `PROVEN`, `BLOCKED_EXTERNAL`, `DEFERRED_BY_OWNER`
 * o `NEEDS_CLINICAL_REVIEW`, y así se calcula (`sinProbar()`), para que no se
 * pueda vaciar renombrándolo.
 */
export type EstadoRequisito =
  | 'NOT_STARTED'
  | 'PREPARED'
  | 'PARTIAL'
  | 'IMPLEMENTED_NOT_PROVEN'
  | 'PROVEN'
  | 'BLOCKED_EXTERNAL'
  | 'DEFERRED_BY_OWNER'
  | 'NEEDS_CLINICAL_REVIEW'

/** Orden de fuerza. Bajar por aquí sin declararlo es lo que el guardián caza. */
export const FUERZA: Readonly<Record<EstadoRequisito, number>> = Object.freeze({
  NOT_STARTED: 0,
  PREPARED: 1,
  PARTIAL: 2,
  IMPLEMENTED_NOT_PROVEN: 3,
  PROVEN: 4,
  // Estados laterales: no se comparan por fuerza, se comparan por identidad.
  BLOCKED_EXTERNAL: -1,
  DEFERRED_BY_OWNER: -1,
  NEEDS_CLINICAL_REVIEW: -1,
})

export interface Requisito {
  /** Estable para siempre. Es la llave del censo: cambiarlo es borrar y crear. */
  readonly id: string
  /** A qué workstream o eje transversal pertenece. */
  readonly ws: string
  readonly titulo: string
  readonly estado: EstadoRequisito
  /** `PROVEN`: qué lo demuestra. */
  readonly evidencia?: string
  /** `PROVEN`: cómo se reproduce, tal cual se escribe en una terminal. */
  readonly comando?: string
  /** `PROVEN`: qué se observó al correrlo. */
  readonly resultado?: string
  /** `BLOCKED_EXTERNAL`: la acción externa EXACTA que lo desbloquea. */
  readonly desbloqueaCon?: string
  /** `BLOCKED_EXTERNAL`: lo que ya está hecho de este lado. */
  readonly preparacionInterna?: string
  /** Todo lo demás: qué falta, en términos accionables. */
  readonly queFalta?: string
  /** Archivos, actas o documentos que sostienen la fila. */
  readonly artefactos?: readonly string[]
  /** Pruebas que la vigilan. */
  readonly pruebas?: readonly string[]
}

/**
 * Los dominios que el alcance canónico obliga a representar. El guardián falla
 * si alguno se queda sin una sola fila — que es exactamente cómo se perdieron
 * seis de ellos antes de que este archivo existiera.
 */
export const DOMINIOS_CANONICOS: readonly string[] = Object.freeze([
  'Clinical Truth', 'Voice', 'Reasoning', 'Evidence', 'Consultorio', 'Automation',
  'Learning', 'Patient Experience', 'WhatsApp', 'Mobile UX', 'Scale', 'Reliability',
  'Observability', 'Security', 'Disaster Recovery', 'Evaluation', 'Patient State',
  'Closed Loop', 'Evidence Applicability', 'Specialty Packages', 'Production Readiness',
])

/**
 * Objetivos de escala, explícitos y por separado.
 *
 * **Usuarios registrados no es concurrencia activa.** Se listan aparte a
 * propósito: mezclarlos es cómo un «aguanta 100 k» acaba significando algo que
 * nadie midió.
 */
export const USUARIOS_REGISTRADOS: readonly number[] = Object.freeze([
  2_000, 10_000, 15_000, 20_000, 30_000, 50_000, 100_000,
])

export const PACIENTES_POR_MEDICO: readonly number[] = Object.freeze([
  10_000, 20_000, 30_000, 50_000,
])

/**
 * Las fuentes de evidencia del alcance canónico.
 *
 * Esta lista **no** es el catálogo del producto (`evidence-integrations/
 * catalogo.ts`), y por eso existe: el catálogo tiene doce entradas y el alcance
 * canónico nombra muchas más. Una fuente que el alcance pide y el catálogo no
 * tiene es un requisito, no una ausencia — y sin este censo era invisible.
 */
export const FUENTES_CANONICAS: readonly string[] = Object.freeze([
  // Índices y bases públicas
  'PubMed/MEDLINE', 'PMC', 'ClinicalTrials.gov', 'CDC', 'WHO', 'FDA/DailyMed', 'Crossref',
  // Editoriales
  'NEJM', 'JAMA', 'Lancet', 'BMJ', 'Clinical Infectious Diseases',
  'Nature Medicine', 'Annals of Internal Medicine',
  // Comerciales
  'Cochrane', 'UpToDate', 'DynaMed', 'OpenEvidence', 'Scopus', 'Embase',
  // Organismos de guía
  'IDSA', 'ESC', 'AHA/ACC', 'ATS', 'EASL', 'ECIL', 'NCCN', 'Surviving Sepsis', 'COFEPRIS',
])

const R = (r: Requisito) => r

export const REQUISITOS: readonly Requisito[] = Object.freeze([
  /* ═══ WS-01 · Custodia del programa ═══════════════════════════════════════ */
  R({
    id: 'WS-01.censo', ws: 'WS-01', titulo: 'Censo de requisitos legible por máquina',
    estado: 'PROVEN',
    evidencia: 'Este archivo más su guardián: el censo tiene sello de identidades y de estados.',
    comando: 'npx vitest run src/__tests__/el-programa-no-pierde-requisitos.test.ts',
    resultado: 'Verde con el censo completo; rojo si se borra una fila o baja un estado.',
    artefactos: ['src/lib/programa/requisitos.ts', 'src/lib/programa/censo-sellado.json'],
    pruebas: ['src/__tests__/el-programa-no-pierde-requisitos.test.ts'],
  }),
  R({
    id: 'WS-01.tablero', ws: 'WS-01', titulo: 'Tablero en prosa mantenido y reconciliado con el código',
    estado: 'PARTIAL',
    queFalta: 'El tablero se quedó en REG-362 mientras el árbol iba por REG-381. Reconciliarlo tras cada tanda, y reconciliar con agent-state/BACKLOG.json (V9/V10/V15 arrastran requisitos propios).',
    artefactos: ['docs/product/AUSCULTA-MASTER-BOARD.md'],
  }),
  R({
    id: 'WS-01.dominios', ws: 'WS-01', titulo: 'Ningún dominio canónico se queda sin representación',
    estado: 'PROVEN',
    evidencia: 'DOMINIOS_CANONICOS se cruza contra el censo; seis dominios estaban ausentes del tablero antes de esto.',
    comando: 'npx vitest run src/__tests__/el-programa-no-pierde-requisitos.test.ts',
    resultado: 'Los 21 dominios tienen al menos una fila.',
    pruebas: ['src/__tests__/el-programa-no-pierde-requisitos.test.ts'],
  }),

  /* ═══ WS-02 · Escala ══════════════════════════════════════════════════════ */
  R({
    id: 'WS-02.arnes', ws: 'WS-02', titulo: 'Arnés que produce el JSON de carga que el validador lee',
    estado: 'PROVEN',
    evidencia: 'REG-378. Escribe null donde no midió, y el validador lo rechaza por incompleto a propósito.',
    comando: 'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/product/run-consultorio-load.mjs --tenants=20 --physicians-per-tenant=5 --patients-per-physician=20 --concurrent=50',
    resultado: '8 000 peticiones · 100 médicos · 50 concurrentes · p50 59.8 ms · p95 141.1 ms · p99 187.9 ms · 0 errores.',
    artefactos: ['scripts/product/run-consultorio-load.mjs', 'docs/audit/ws-02-carga/emulador-100-medicos.json'],
    pruebas: ['src/__tests__/el-arnes-de-carga-no-inventa-un-cero.test.ts'],
  }),
  R({
    id: 'WS-02.concurrencia-definida', ws: 'WS-02', titulo: 'Concurrencia activa definida aparte de usuarios registrados',
    estado: 'NOT_STARTED',
    queFalta: 'No hay modelo de carga que diga cuántos de N registrados están en consulta a la vez, ni con qué mezcla de operaciones. Sin eso, «100 k» no nombra ningún experimento.',
  }),
  ...USUARIOS_REGISTRADOS.map(n => R({
    id: `WS-02.registrados-${n}`, ws: 'WS-02',
    titulo: `Escenario de ${n.toLocaleString('es-MX')} usuarios registrados, medido`,
    estado: 'NOT_STARTED',
    queFalta: 'El arnés existe (WS-02.arnes) pero sólo se ha corrido a 100 médicos contra un emulador local. Falta el perfil de carga de este escenario y un entorno donde ejecutarlo.',
  })),

  /* ═══ WS-03 · Consultorio grande ══════════════════════════════════════════ */
  ...PACIENTES_POR_MEDICO.map(n => R({
    id: `WS-03.pacientes-${n}`, ws: 'WS-03',
    titulo: `Comportamiento con ${n.toLocaleString('es-MX')} pacientes por médico, medido`,
    estado: 'PROVEN',
    evidencia: `REG-383. Práctica sintética de ${n.toLocaleString('es-MX')} pacientes CON historia (3 notas firmadas cada uno) contra el emulador con las reglas reales, corriendo las funciones del producto.`,
    comando: `WS03_PACIENTES=${n} npm run test:emulador`,
    resultado: 'Para enseñar 20 pacientes se leen 21 documentos — el mismo número que con 200. Búsqueda 125 (5 ventanas), historial 11.',
    artefactos: [`docs/audit/ws-03-consultorio-grande/lecturas-${n}.json`],
    pruebas: ['emulator/ws03-consultorio-grande.emu.test.ts'],
  })),
  R({
    id: 'WS-03.lecturas-sin-cota', ws: 'WS-03', titulo: 'Ninguna lectura de consultorio descarga la colección entera',
    estado: 'PARTIAL',
    queFalta: 'REG-383 midió las tres del camino diario —lista, búsqueda e historial— y salen planas hasta 50 000 pacientes. REG-394 convirtió el recuento a mano en un TRINQUETE que sólo baja (Consultorio 29, Hospital 9) y dejó nombrados los dos peores, sin cerrarlos: (1) getAppointments(clinicId, []) descarga todas las citas que el consultorio haya tenido nunca, y NO se arregla con un limit suelto —sin orderBy propio recortaría por el extremo equivocado y perdería citas en silencio, que en una agenda es peor que la lectura cara—; (2) useAppointments es un onSnapshot cuya ventana SÓLO CRECE: navegar el calendario a hace un año deja el resto de la sesión recibiendo en vivo todas las citas desde entonces. Arreglarlo es rediseñar la ventana de la agenda y no se hace a ciegas (regla de diseño: una interfaz no se aprueba leyendo el código). Falta además medir el resto en el emulador como se midieron las tres del camino diario.',
    artefactos: ['docs/product/AUSCULTA-MASTER-BOARD.md'],
  }),
  R({
    id: 'WS-03.indices-declarados', ws: 'WS-03', titulo: 'Toda consulta compuesta tiene su índice declarado',
    estado: 'PROVEN',
    evidencia: 'REG-379. Cuatro consultas que el producto ya hacía no tenían índice declarado; ahora la lista se deriva del árbol.',
    comando: 'npx vitest run src/__tests__/el-indice-que-nadie-declaro.test.ts',
    resultado: '4 casos verdes; quitando el índice de reviews el guardián se pone rojo.',
    artefactos: ['firestore.indexes.json', 'docs/ops/INDICES-DE-FIRESTORE.md'],
    pruebas: ['src/__tests__/el-indice-que-nadie-declaro.test.ts'],
  }),
  R({
    id: 'WS-03.documentos-que-crecen', ws: 'WS-03', titulo: 'Ningún documento crece sin techo',
    estado: 'PARTIAL',
    queFalta: 'REG-393 acotó el de Consultorio (asr/aprendizaje-firestore.ts) y encontró de paso dos defectos mayores en el mismo archivo: la LECTURA no tenía cota —getDocs de la colección entera en cada apertura de consulta y de UCI, para usar como mucho las mil palabras que caben en el sesgo— y una lectura fallida se pintaba como «todavía no ha aprendido ninguna palabra». El techo del arrayUnion va sobre lo que APORTA cada escritura, no sobre el acumulado, y se declara: recortar el total exigiría leer-modificar-escribir, que es lo que arrayUnion evita. Queda internamientos/{id} (seis arrays en un documento, administraciones sin tope), que es Hospital/UCI y está fuera de este carril.',
    artefactos: ['src/lib/asr/aprendizaje-firestore.ts'],
    pruebas: ['src/__tests__/lo-aprendido-no-se-descarga-entero.test.ts'],
  }),

  /* ═══ WS-04 · Resiliencia ═════════════════════════════════════════════════ */
  R({
    id: 'WS-04.interruptor-ia', ws: 'WS-04', titulo: 'Interruptor de circuito en el gateway de IA',
    estado: 'PARTIAL',
    queFalta: 'REG-353 lo puso por proveedor y por llave, con presupuesto de operación. Es POR INSTANCIA, no global: cada instancia caliente paga su primer timeout.',
  }),
  R({
    id: 'WS-04.interruptor-otros', ws: 'WS-04', titulo: 'WhatsApp y Evidence bajo el mismo interruptor',
    estado: 'PROVEN',
    evidencia: 'REG-391. El motor pasó a `red/interruptor.ts` sin vocabulario de proveedor y cada uno trae su traductor. Al medir aparecieron TRES defectos, y el primero era peor que lo que se venía a arreglar: el outbox contaba con una sola cifra «el teléfono está mal» y «Meta devuelve 503», así que con el cron cada hora CINCO HORAS DE CAÍDA mataban toda la cola — y el interruptor solo lo habría empeorado, porque al fallar rápido las cinco horas se vuelven cinco minutos. Además, `openfda.ts` llamaba con `fetch` pelado, SIN TIEMPO MÁXIMO NINGUNO, desde una ruta de 300 s; y PubMed tenía `signal` y nadie se lo pasaba en el camino del médico.',
    comando: 'npx vitest run src/__tests__/una-caida-de-whatsapp-no-mata-la-cola.test.ts src/__tests__/una-fuente-caida-no-cuelga-la-consulta.test.ts',
    resultado: '27 casos verdes. Probados al revés desactivando la puerta: cae el caso correspondiente. La corrección separa `intentos` (del mensaje) de `pausas` (del proveedor), acota las pausas, y al morir la entrada dice de QUÉ murió.',
    artefactos: [
      'src/lib/red/interruptor.ts', 'src/lib/whatsapp/fallo-del-proveedor.ts',
      'src/lib/evidencia/fallo-del-proveedor.ts', 'src/lib/whatsapp/reintentos.ts',
    ],
    pruebas: [
      'src/__tests__/una-caida-de-whatsapp-no-mata-la-cola.test.ts',
      'src/__tests__/una-fuente-caida-no-cuelga-la-consulta.test.ts',
    ],
  }),
  R({
    id: 'WS-04.colas', ws: 'WS-04', titulo: 'Colas, contrapresión y dead-letter donde corresponde',
    estado: 'PROVEN',
    evidencia: 'REG-390. CORRECCIÓN: «ninguna cola» era falso — existen dos y están bien hechas (outbox de WhatsApp con dead-letter, cola de bitácora acotada y por uid). Lo que faltaba era CONTRAPRESIÓN, y la llamada de IA se RECHAZA bajo saturación en vez de encolarse, porque una operación clínica no puede parecer completada si sólo quedó encolada.',
    comando: 'npx vitest run src/__tests__/lo-encolado-no-es-lo-hecho.test.ts',
    resultado: '16 casos verdes, con el defecto clásico del contador reproducido al revés: sin soltar el sitio, la instancia rechaza todo sin nada en vuelo.',
    artefactos: ['src/lib/ia/contrapresion.ts', 'src/lib/ops/lo-sincrono-y-lo-encolado.ts'],
    pruebas: ['src/__tests__/lo-encolado-no-es-lo-hecho.test.ts'],
  }),
  R({
    id: 'WS-04.idempotencia', ws: 'WS-04', titulo: 'Ninguna operación clínica no idempotente se reintenta a ciegas',
    estado: 'PARTIAL',
    queFalta: 'lib/idempotencia.ts existe y cubre por intención. Falta recorrer receta, órdenes, citas y acciones de WhatsApp comprobando que ningún reintento pueda duplicar un acto clínico.',
  }),
  R({
    id: 'WS-04.inyeccion-de-fallos', ws: 'WS-04', titulo: 'Comportamiento ante caída de proveedor, probado inyectando el fallo',
    estado: 'PARTIAL',
    queFalta: 'CORRECCIÓN DE ESTE CENSO (REG-389): decía NOT_STARTED y era falso. El gateway de IA SÍ tiene inyección de fallos con comportamiento medido —404, 429, red caída, llave revocada, salida ilegible, créditos devueltos, sin PHI en el asiento— en ia-gateway, ia-fallo-proveedor y un-proveedor-caido-no-se-reintenta-mil-veces. Lo que falta: WhatsApp y Evidence, y que la degradación de la CONSULTA se comprueba hoy por substring y no por comportamiento.',
    pruebas: ['src/__tests__/ia-gateway.test.ts', 'src/__tests__/ia-fallo-proveedor.test.ts', 'src/__tests__/un-proveedor-caido-no-se-reintenta-mil-veces.test.ts'],
  }),

  /* ═══ WS-05 · Móvil ═══════════════════════════════════════════════════════ */
  R({
    id: 'WS-05.mecanismos', ws: 'WS-05', titulo: 'Mecanismos del rebote de iPhone, cerrados en código',
    estado: 'PARTIAL',
    queFalta: 'Tres de cuatro cerrados (REG-342, REG-355). Abierto el candidato 3: banners asíncronos que cambian la altura por encima de <main> (41 px medidos).',
  }),
  R({
    id: 'WS-05.webkit-390', ws: 'WS-05', titulo: 'WebKit a 390 px, 10 repeticiones del recorrido, scrollTop que nunca baja solo',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Una máquina con salida a internet donde `npx playwright install webkit` funcione. Aquí la descarga está bloqueada («Failed to download WebKit 26.5»).',
    preparacionInterna: 'El proyecto iphone-safari existe en playwright.config.ts. REG-380 añadió el recorrido medible a tamaño de teléfono sobre Chromium y lo metió en CI.',
    artefactos: ['playwright.config.ts', 'e2e/telefono.spec.ts'],
  }),
  R({
    id: 'WS-05.iphone-real', ws: 'WS-05', titulo: 'Verificación en un iPhone físico',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Un iPhone. Recorrido: consulta → receta → volver → orden → volver, 10 veces, más dictado con la vista arriba y espera en paciente hospitalizado.',
    preparacionInterna: 'REG-342/355 cerraron tres mecanismos; REG-380 mide layout, objetivo táctil, consola y foco en CI.',
  }),
  R({
    id: 'WS-05.pantalla-390', ws: 'WS-05', titulo: 'Las rutas públicas no desbordan a lo ancho en 390 px',
    estado: 'PROVEN',
    evidencia: 'REG-380, en navegador real contra el build, no leyendo el árbol.',
    comando: 'npm run build && PLAYWRIGHT_CHROMIUM_PATH=<chromium> npm run e2e:telefono',
    resultado: '11/11 verdes dos veces seguidas; corre en el job e2e-publico del CI.',
    artefactos: ['e2e/telefono.spec.ts'],
    pruebas: ['e2e/telefono.spec.ts'],
  }),
  R({
    id: 'WS-05.a11y-wcag', ws: 'WS-05', titulo: 'WCAG 2.2 AA en las superficies de consultorio',
    estado: 'PARTIAL',
    queFalta: 'REG-380 mide objetivo táctil y foco visible en la landing. Falta contraste, semántica, etiquetas, movimiento reducido y lector de pantalla sobre las pantallas con sesión — y el juicio manual que ninguna herramienta automática sustituye.',
  }),

  /* ═══ WS-06/07/08 · Evidencia ═════════════════════════════════════════════ */
  R({
    id: 'WS-06.censo-de-fuentes', ws: 'WS-06', titulo: 'Cada fuente canónica tiene estado declarado y auditable',
    estado: 'PROVEN',
    evidencia: 'REG-389. Las 29 canónicas están en el catálogo, que ya traía la ficha completa —vía oficial, PHI, credencial, caché, cita profunda, frescura, límites, precio, semántica de fallo y reuso generativo— y a la que le faltaban 17 fuentes enteras.',
    comando: 'npx vitest run src/__tests__/el-catalogo-de-fuentes-no-calla-ninguna.test.ts',
    resultado: '9 casos verdes. Las 17 nuevas entran con la matriz SIN VERIFICAR, que es lo honesto, y con su decisión pendiente escrita.',
    artefactos: ['src/lib/evidence-integrations/catalogo.ts', 'docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md'],
    pruebas: ['src/__tests__/el-catalogo-de-fuentes-no-calla-ninguna.test.ts'],
  }),
  R({
    id: 'WS-06.sin-scraping', ws: 'WS-06', titulo: 'Ninguna fuente se obtiene saltándose su licencia',
    estado: 'PARTIAL',
    queFalta: 'Verificado por lectura: no hay puppeteer, ni credenciales compartidas, ni corpus copiado; no-configurado.ts no conoce ninguna URL. Falta un guardián que lo mantenga así.',
  }),
  R({
    id: 'WS-06.editorial-no-es-integracion', ws: 'WS-06', titulo: 'Descubrir por índice no se presenta como integración editorial',
    estado: 'PROVEN',
    evidencia: 'REG-389. Las siete editoriales entran al catálogo SIN `proveedorCanonico`: por el modelo de tipos no pueden producir un `Source`, y sin `Source` no hay `Passage` ni afirmación respaldada. Su ficha dice con todas las letras que hoy sólo se descubren vía PubMed.',
    comando: 'npx vitest run src/__tests__/el-catalogo-de-fuentes-no-calla-ninguna.test.ts',
    resultado: 'Un caso falla si alguien le pone `proveedorCanonico` a una editorial «para que funcione».',
    pruebas: ['src/__tests__/el-catalogo-de-fuentes-no-calla-ninguna.test.ts'],
  }),
  R({
    id: 'WS-07.identidad-de-revista', ws: 'WS-07', titulo: 'Identidad de revista normalizada, con alias, DOI, PMCID y acceso abierto',
    estado: 'NOT_STARTED',
    queFalta: 'Se lee <Title> O <ISOAbbreviation> y el otro se tira; PMCID se resuelve y se descarta; DOI llega a la UI pero desde-pubmed.ts no lo pasa a Source; no existe campo de acceso abierto ni de disponibilidad de texto completo.',
  }),
  R({
    id: 'WS-07.prestigio-no-es-calidad', ws: 'WS-07', titulo: 'La marca de la revista no sube la calidad metodológica',
    estado: 'NOT_STARTED',
    queFalta: 'Sin identidad de revista normalizada (WS-07.identidad-de-revista) no hay dónde comprobarlo. Falta el guardián que separe jerarquía metodológica de identidad de fuente.',
  }),
  R({
    id: 'WS-07.guias', ws: 'WS-07', titulo: 'Motor de guías con organización, versión, fecha, jurisdicción y estado de vigencia',
    estado: 'NOT_STARTED',
    queFalta: 'NICE, KDIGO, ACC/AHA, ESC, ADA y Surviving Sepsis son cadenas de cita FIJAS dentro de motores clínicos. No hay objeto de guía, ni versión, ni superseded, ni discrepancia entre dos guías válidas.',
  }),
  R({
    id: 'WS-08.costuras-comerciales', ws: 'WS-08', titulo: 'Costura oficial preparada para cada fuente comercial',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Contrato y credenciales de UpToDate, Cochrane, Scopus, DynaMed, OpenEvidence o Embase. Sin acuerdo se quedan en not_configured.',
    preparacionInterna: 'Adaptador deliberadamente inerte (no-configurado.ts): sin URL y sin fetch, falla cerrado. UpToDate, Cochrane y OpenEvidence están catalogadas como READY_BUT_NOT_LICENSED.',
    artefactos: ['src/lib/evidence-integrations/adaptadores/no-configurado.ts'],
  }),

  /* ═══ WS-09 · Aplicabilidad ═══════════════════════════════════════════════ */
  R({
    id: 'WS-09.motor', ws: 'WS-09', titulo: 'Motor determinista de aplicabilidad de la evidencia a ESTE paciente',
    estado: 'PARTIAL',
    queFalta: 'REG-387 lo creó y lo conectó de punta a punta en cuatro dimensiones —edad, embarazo, función renal y alergia—, en español e inglés. Faltan las otras: organismo, susceptibilidad, sitio de infección, dispositivo, comorbilidad, interacción, severidad, entorno de atención, terapia previa y jurisdicción. Caen en `no_evaluable` y se cuentan, no se dan por buenas.',
    artefactos: ['src/lib/evidencia/aplicabilidad.ts'],
    pruebas: ['src/__tests__/la-evidencia-no-aplica-a-cualquiera.test.ts'],
  }),
  R({
    id: 'WS-09.datos-insuficientes', ws: 'WS-09', titulo: 'Un dato ausente produce insufficient_patient_data, no una suposición',
    estado: 'PROVEN',
    evidencia: 'REG-387. `datos_insuficientes` es un veredicto de primera clase, y la duda gana a la tranquilidad: un solo criterio dudoso tiñe el conjunto. El caso que lo justifica es un estudio que excluye embarazadas con el embarazo sin constar.',
    comando: 'npx vitest run src/__tests__/la-evidencia-no-aplica-a-cualquiera.test.ts',
    resultado: '36 casos verdes. No existe el veredicto «aplica»: el máximo es «nada lo excluye», con la cuenta de lo que no se supo leer.',
    pruebas: ['src/__tests__/la-evidencia-no-aplica-a-cualquiera.test.ts'],
  }),

  /* ═══ WS-10 · Patient State ═══════════════════════════════════════════════ */
  R({
    id: 'WS-10.proyeccion-no-es-segunda-verdad', ws: 'WS-10', titulo: 'Patient State es proyección sobre Clinical Truth, no una segunda fuente',
    estado: 'PARTIAL',
    queFalta: 'Las proyecciones se recalculan en el navegador y ninguna se persiste; sólo la de alergias lleva asOf y version. Persistirlas sin decidir la autoridad crearía la segunda verdad que esto evita.',
  }),
  R({
    id: 'WS-10.problemas-medicacion-alergias', ws: 'WS-10', titulo: 'Problemas activos, medicación activa y alergias, longitudinales',
    estado: 'PARTIAL',
    queFalta: 'Los tres existen y están cableados (REG-363). Falta persistencia y asOf/version en los tres.',
    artefactos: ['src/lib/expediente/alergias-longitudinales.ts'],
  }),
  R({
    id: 'WS-10.historico-no-es-actual', ws: 'WS-10', titulo: 'Histórico ≠ actual en diagnóstico y en medicamento',
    estado: 'PROVEN',
    evidencia: 'REG-372 (autoridad sobre tipo, tipoOrigen), REG-373/374 (mención histórica no es medicación vigente, sin umbral de días inventado).',
    comando: 'npx vitest run src/__tests__/lo-que-tomo-no-es-lo-que-toma.test.ts src/__tests__/la-certeza-del-diagnostico-no-la-firma-un-modelo.test.ts',
    resultado: 'Verde; probado al revés en ambos.',
    pruebas: ['src/__tests__/lo-que-tomo-no-es-lo-que-toma.test.ts', 'src/__tests__/la-certeza-del-diagnostico-no-la-firma-un-modelo.test.ts'],
  }),
  R({
    id: 'WS-10.sello-v4', ws: 'WS-10', titulo: 'Evolución de esquema del sello sin romper notas firmadas',
    estado: 'PROVEN',
    evidencia: 'REG-377. transcripcionMotor entra al sello; CANONICO despacha por la versión que la nota declara.',
    comando: 'npx vitest run src/__tests__/el-sello-v4-no-rompe-lo-firmado.test.ts src/__tests__/e0-12-sello-integridad.test.ts',
    resultado: '17 + 64 verdes. Probado al revés: re-verificar una v3 con el algoritmo de v4 la marcaría alterada.',
    pruebas: ['src/__tests__/el-sello-v4-no-rompe-lo-firmado.test.ts'],
  }),
  R({
    id: 'WS-10.procedimientos-dispositivos', ws: 'WS-10', titulo: 'Registro estructurado de procedimientos y dispositivos',
    estado: 'PARTIAL',
    queFalta: 'Lo capturado ya llega a donde se decide (REG-370/371). El registro ESTRUCTURADO necesita el acto del médico —una pantalla donde confirme lo que el extractor oyó— y después su propio sello v5. Reservar campos vacíos se intentó y se descartó: un campo que nadie escribe es una promesa del modelo.',
  }),
  R({
    id: 'WS-10.laboratorios-y-tendencia', ws: 'WS-10', titulo: 'Laboratorios del expediente y su trayectoria, en la consulta',
    estado: 'PROVEN',
    evidencia: 'REG-368/369 llevan valor y trayectoria a donde se prescribe; REG-375/376 aplican las dos políticas del dueño sin inventar umbrales.',
    comando: 'npx vitest run src/__tests__/lo-que-ya-esta-medido-llega-al-motor.test.ts src/__tests__/la-funcion-renal-caduca-se-dice.test.ts src/__tests__/no-hay-un-porcentaje-universal.test.ts',
    resultado: 'Verde. Un guardián falla si aparece cualquier literal numérico clínico en los módulos.',
    pruebas: ['src/__tests__/la-funcion-renal-caduca-se-dice.test.ts', 'src/__tests__/no-hay-un-porcentaje-universal.test.ts'],
  }),
  R({
    id: 'WS-10.banderas-y-respuesta', ws: 'WS-10', titulo: 'Banderas de riesgo, respuesta al tratamiento y compromisos de seguimiento',
    estado: 'NOT_STARTED',
    queFalta: 'Ninguna de las tres existe como proyección.',
  }),
  R({
    id: 'WS-10.vocabulario-canonico', ws: 'WS-10', titulo: 'Un solo vocabulario de verdad clínica',
    estado: 'NEEDS_CLINICAL_REVIEW',
    queFalta: 'Tres en paralelo: TruthState, ClinicalTruthStatus y ClinicalFact. El mejor diseñado (bitemporal, con supersedes y procedencia discriminada) es el que está muerto. Cuál se vuelve canónico es política clínica del dueño, no un refactor.',
  }),
  R({
    id: 'WS-10.pantalla-de-certeza', ws: 'WS-10', titulo: 'El médico puede elegir el tipo de un diagnóstico',
    estado: 'NOT_STARTED',
    queFalta: 'Ninguna pantalla lo permite, así que tipoOrigen: medico sólo lo lleva el diagnóstico añadido a mano. Mientras siga así el sistema no distingue un presuntivo elegido de uno de fábrica.',
  }),

  /* ═══ WS-11 · Ciclo cerrado ═══════════════════════════════════════════════ */
  R({
    id: 'WS-11.estados-del-cierre', ws: 'WS-11', titulo: 'Decisión, acción y aviso al paciente son etapas distintas',
    estado: 'PARTIAL',
    queFalta: 'REG-360/361 dieron campo y formulario. Falta `scheduled` como estado propio, y el cierre sólo se puede hacer desde /pendientes.',
  }),
  R({
    id: 'WS-11.laboratorio', ws: 'WS-11', titulo: 'Un resultado de laboratorio de consultorio genera tarea de revisión',
    estado: 'PARTIAL',
    queFalta: 'REG-337 cerró «recibido → por revisar». PanelLaboratorio sigue sin revisado/revisadoPor/revisadoEn/criticoNotificado.',
  }),
  R({
    id: 'WS-11.interconsultas-imagen', ws: 'WS-11', titulo: 'Interconsultas, referencias e imagen dentro del ciclo',
    estado: 'NOT_STARTED',
    queFalta: 'Interconsulta es un array embebido con dos estados, sin dueño ni vencimiento; la referencia es sólo un impreso; imagen no tiene entidad.',
  }),
  R({
    id: 'WS-11.sobrevive-a-la-navegacion', ws: 'WS-11', titulo: 'Nada pendiente desaparece al cambiar de pantalla',
    estado: 'NOT_STARTED',
    queFalta: 'Sin prueba que cruce la frontera de navegación o de sesión.',
  }),

  /* ═══ WS-12 · Evaluación y router ═════════════════════════════════════════ */
  R({
    id: 'WS-12.doce-preguntas', ws: 'WS-12', titulo: 'Las doce preguntas del paciente como compuerta permanente',
    estado: 'PARTIAL',
    queFalta: 'REG-362 creó la puerta (18 casos) y encontró un defecto vivo al correrla. Prueba el SERVIDOR, no lo que el modelo redacta, y sólo una de las cinco clases de respuesta tiene clasificador.',
    artefactos: ['evals/patient-ai/'],
  }),
  R({
    id: 'WS-12.entailment', ws: 'WS-12', titulo: 'Entailment: la cita sostiene la afirmación, no sólo la contiene',
    estado: 'NOT_STARTED',
    queFalta: 'REG-359 ancla carácter a carácter y cierra la invención del respaldo, no la interpretación. Un pasaje puede citarse fuera de contexto. Falta el evaluador de entailment.',
  }),
  R({
    id: 'WS-12.contratos-de-evaluacion', ws: 'WS-12', titulo: 'Cada capacidad de IA con dataset, métrica, umbral y política de fallo',
    estado: 'NOT_STARTED',
    queFalta: 'No existe el contrato por capacidad. Sin umbral con significado, una métrica es decorativa.',
  }),
  R({
    id: 'WS-12.router', ws: 'WS-12', titulo: 'El médico expresa intención clínica, no elige marca de modelo',
    estado: 'PARTIAL',
    queFalta: 'planes-ia.ts respeta la regla. Falta probar el fallback del router ante caída de proveedor, y que no degrade calidad clínica en silencio para ahorrar.',
  }),
  R({
    id: 'WS-12.p99', ws: 'WS-12', titulo: 'p99 de latencia por capacidad y por ruta',
    estado: 'PARTIAL',
    queFalta: 'cost-ledger.ts calcula p50 y p95 de las llamadas de IA. No hay p99 en ningún sitio del repositorio salvo el acta del arnés de carga, ni latencia/error por ruta HTTP.',
  }),

  /* ═══ WS-13 · Seguridad · observabilidad · DR ═════════════════════════════ */
  R({
    id: 'WS-13.aislamiento', ws: 'WS-13', titulo: 'Ninguna ruta escribe datos clínicos sin validar sesión y pertenencia',
    estado: 'PROVEN',
    evidencia: '99 rutas revisadas con analizador estático del argumento literal por método HTTP; y REG-378 lo midió corriendo, con sesiones de cliente contra las reglas cargadas.',
    comando: 'npx vitest run src/__tests__/api-authz-guard.test.ts && node scripts/product/run-consultorio-load.mjs …',
    resultado: '0 fugas en 200 sondas cruzadas (100 de lectura + 100 de escritura) sobre 20 consultorios.',
    artefactos: ['src/lib/authz/analisis-estatico.ts', 'docs/audit/ws-02-carga/emulador-100-medicos.json'],
    pruebas: ['src/__tests__/api-authz-guard.test.ts', 'src/__tests__/el-arnes-de-carga-no-inventa-un-cero.test.ts'],
  }),
  R({
    id: 'WS-13.correlation-id', ws: 'WS-13', titulo: 'Traza navegador → API → job → proveedor sin PHI',
    estado: 'PARTIAL',
    queFalta: 'REG-388: el hilo existe del navegador al asiento del libro de costos, en las 16 rutas de IA, con la forma validada para que no pueda llevar PHI. Faltan los trabajos de fondo —un cron no nace de un navegador y su traza tendría que acuñarse al arrancar— y mandarla al proveedor como cabecera.',
    artefactos: ['src/lib/observabilidad/correlacion.ts'],
    pruebas: ['src/__tests__/la-traza-cruza-la-frontera.test.ts'],
  }),
  R({
    id: 'WS-13.alertas', ws: 'WS-13', titulo: 'Alertas sobre degradación, 5xx, fallo de guardado y anomalía de autorización',
    estado: 'PARTIAL',
    queFalta: 'Hay un canal real (ops/alerta.ts) con un solo llamador: dispara por cron caído y saldo bajo. Nada más.',
  }),
  R({
    id: 'WS-13.reglas-desplegadas', ws: 'WS-13', titulo: 'Las reglas de Firestore escritas son las que rigen',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'npx firebase deploy --only firestore:rules --project nexomed-agenda',
    preparacionInterna: 'REG-354: el repositorio DERIVA qué no rige y qué se rompe mientras tanto, en vez de recordarlo.',
    artefactos: ['firestore.rules.estado.json', 'docs/ops/REGLAS-DE-FIRESTORE.md'],
  }),
  R({
    id: 'WS-13.indices-desplegados', ws: 'WS-13', titulo: 'Los índices declarados están construidos en el proyecto',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'npx firebase deploy --only firestore:indexes --project nexomed-agenda, y verificar en la consola que los 8 salen Enabled y no Building.',
    preparacionInterna: 'REG-352 los declaró; REG-379 añadió los cuatro que faltaban y puso el guardián que los deriva del árbol.',
    artefactos: ['firestore.indexes.json'],
  }),
  R({
    id: 'WS-13.restauracion', ws: 'WS-13', titulo: 'El respaldo se restaura contra un Firestore de verdad',
    estado: 'PROVEN',
    evidencia: 'REG-381. Escribe con leerLinea y reenraizar del producto y RELEE cada documento del otro lado.',
    comando: 'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/simulacro-restauracion-firestore.mjs --docs=2000',
    resultado: '2 000 escritos · 2 000 releídos · 0 faltantes · 513 ms (3 898 doc/s). El tope del lote NO queda comprobado: el emulador acepta 600.',
    artefactos: ['docs/audit/ws-02-carga/restauracion-emulador.json'],
    pruebas: ['src/__tests__/el-respaldo-llega-a-firestore.test.ts'],
  }),
  R({
    id: 'WS-13.pitr-rto', ws: 'WS-13', titulo: 'PITR activo y RTO medido',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'gcloud firestore databases update --enable-pitr, y un gcloud firestore databases restore sobre una base de ENSAYO para cronometrar el RTO.',
    preparacionInterna: 'REG-381 mide restaurar un NDJSON en una base ya viva, que no es el RTO y lo declara.',
  }),
  R({
    id: 'WS-13.mfa-servidor', ws: 'WS-13', titulo: 'El segundo factor se exige en el servidor',
    estado: 'PARTIAL',
    queFalta: 'REG-384: el servidor ya LEE sign_in_second_factor —lo descartaba— y la consola del dueño lo exige a quien lo tiene enrolado. Extenderlo al resto de rutas privilegiadas cuesta una lectura de usuario por petición y es decisión de política del dueño, no de este código.',
    artefactos: ['src/lib/auth-server.ts', 'src/lib/superadmin.ts'],
    pruebas: ['src/__tests__/el-segundo-factor-llega-al-servidor.test.ts'],
  }),
  R({
    id: 'WS-13.app-check', ws: 'WS-13', titulo: 'App Check activo en el proyecto',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Confirmar NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY en el proyecto vivo.',
    preparacionInterna: 'Implementado en el árbol.',
  }),
  R({
    id: 'WS-13.pentest', ws: 'WS-13', titulo: 'Pentest externo',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Contratar un tercero. No hay mitad automatizable.',
    preparacionInterna: '99 rutas revisadas, analizador estático de autorización, aislamiento medido corriendo (REG-378).',
  }),

  /* ═══ Transversales que el tablero no tenía ═══════════════════════════════ */
  R({
    id: 'TR-VOZ.pipeline', ws: 'TR-VOZ', titulo: 'El orden del pipeline de voz es política y está vigilado',
    estado: 'PARTIAL',
    queFalta: 'El pipeline y sus reglas existen (.claude/rules/voice-asr.md) con pruebas. Falta que este eje tenga estado en el programa: hasta este censo no tenía NINGUNA fila.',
    artefactos: ['src/lib/asr/'],
  }),
  R({
    id: 'TR-VOZ.error-clinicamente-pesado', ws: 'TR-VOZ', titulo: 'Evaluación de voz ponderada por consecuencia clínica, no sólo WER',
    estado: 'NOT_STARTED',
    queFalta: 'Un WER genérico bajo no compensa un error de dosis, unidad, negación o lateralidad. Falta el análisis ponderado sobre consulta larga.',
  }),
  R({
    id: 'TR-VOZ.consulta-larga', ws: 'TR-VOZ', titulo: 'Consulta larga de verdad, con proveedor real',
    estado: 'BLOCKED_EXTERNAL',
    desbloqueaCon: 'Credenciales de un proveedor de ASR y audio actuado o sintético de consulta larga.',
    preparacionInterna: 'Léxico, corrector vigilado, guardián, siglas, presupuesto de prompt y aprendizaje por consultorio, todos con pruebas.',
  }),
  R({
    id: 'TR-APRENDIZAJE.no-es-politica', ws: 'TR-APRENDIZAJE', titulo: 'Lo aprendido del médico no se vuelve política clínica',
    estado: 'PROVEN',
    evidencia: 'REG-386. Grafo de importaciones TRANSITIVO: ningún módulo de seguridad ni clínico alcanza el vocabulario aprendido, ni dando rodeos. Y ni el corrector ni el guardián lo leen: sólo sesga.',
    comando: 'npx vitest run src/__tests__/lo-aprendido-no-baja-una-defensa.test.ts',
    resultado: '7 casos verdes, con el buscador de caminos probado al revés sobre un camino que sí existe.',
    pruebas: ['src/__tests__/lo-aprendido-no-baja-una-defensa.test.ts'],
  }),
  R({
    id: 'TR-AUTOMATIZACION.autoridad', ws: 'TR-AUTOMATIZACION', titulo: 'La automatización no crea estado clínico autoritativo',
    estado: 'PROVEN',
    evidencia: 'REG-385. Auditadas las 21 rutas que corren sin sesión de médico: ninguna escribe estado clínico autoritativo. Y ninguna ruta del servidor —con médico o sin él— pone una nota en firmada.',
    comando: 'npx vitest run src/__tests__/la-automatizacion-no-firma.test.ts',
    resultado: '10 casos verdes, con el detector probado al revés sobre fuentes sintéticas que llevan el defecto dentro.',
    artefactos: ['src/lib/authz/analisis-estatico.ts'],
    pruebas: ['src/__tests__/la-automatizacion-no-firma.test.ts'],
  }),
  R({
    id: 'TR-WHATSAPP.entrega', ws: 'TR-WHATSAPP', titulo: 'Un mensaje al paciente ni se pierde ni se duplica',
    estado: 'PARTIAL',
    queFalta: 'El interruptor y la caída del proveedor ya están (REG-391): una caída ya no gasta el presupuesto de reintentos del mensaje, y hay prueba. Sigue PARTIAL por una razón distinta y honesta: NADIE LEE EL DEAD-LETTER. Las entradas muertas quedan en Firestore con su motivo y ninguna pantalla las enseña, así que un mensaje que se rindió de verdad se pierde igual, sólo que ahora con su causa escrita. Cerrar esto es enseñarlas donde alguien mire.',
  }),
  R({
    id: 'TR-RAZONAMIENTO.procedencia', ws: 'TR-RAZONAMIENTO', titulo: 'Lo que la IA redacta enseña de dónde salió',
    estado: 'PARTIAL',
    queFalta: 'La procedencia hasta el segundo del dictado existe (REG-213/250) y la verificación de citas corre (REG-359). Falta cerrar la procedencia estructurada de evidencia (WS-07.identidad-de-revista).',
  }),
  R({
    id: 'TR-PACIENTE.experiencia', ws: 'TR-PACIENTE', titulo: 'Experiencia del paciente de punta a punta',
    estado: 'DEFERRED_BY_OWNER',
    queFalta: 'Pertenece al carril de Excelencia de Producto (PR #399). Se conserva en el censo para que no desaparezca por estar en otro carril; este programa no la toca.',
  }),
  R({
    id: 'TR-BORRADORES.cero-perdidos', ws: 'TR-BORRADORES', titulo: 'Cero pantallas en blanco y cero borradores perdidos',
    estado: 'PARTIAL',
    queFalta: 'REG-392 cerró dos caminos de fallo que no se podían ni provocar porque la decisión vivía dentro del componente: el ALMACENAMIENTO LLENO (las dos escrituras a localStorage acababan en `catch { }` con el comentario «no es crítico» — sin cuota el respaldo dejaba de escribirse y nadie se enteraba) y la TRANSICIÓN DE SESIÓN. Además unificó las cinco copias de «¿hay algo que guardar?»: REG-300 había unificado tres y su guardián contaba exactamente esas tres, así que las dos que deciden si el trabajo del médico se guarda seguían sueltas. Faltan los caminos que sólo se pueden probar en un navegador: recarga, cambio de ruta y `pagehide` — son de e2e, no de vitest.',
    artefactos: ['src/lib/expediente/el-borrador-no-se-pierde.ts'],
    pruebas: ['src/__tests__/el-borrador-no-se-pierde.test.ts'],
  }),
  R({
    id: 'TR-HISTORIA.practica-longitudinal', ws: 'TR-HISTORIA', titulo: 'Práctica sintética con años de historia, no cascarones',
    estado: 'PARTIAL',
    queFalta: 'REG-383 siembra 50 000 pacientes CON tres notas firmadas cada uno (200 300 documentos) y comprueba que navegar no escala con la historia total. Falta la distribución de medicamentos, laboratorios y órdenes, y una mezcla realista en vez de tres notas iguales por paciente.',
    artefactos: ['scripts/product/generate-consultorio-load-fixture.mjs'],
  }),
  R({
    id: 'TR-ESPECIALIDAD.infecto', ws: 'TR-ESPECIALIDAD', titulo: 'Paquete de Infectología y optimización de antimicrobianos',
    estado: 'PARTIAL',
    queFalta: 'specialty-packages.ts deriva su catálogo público de la misma tabla que gobierna la consulta, así que no promete de más. Falta cruzar organismo, susceptibilidad, sitio, dispositivo y aplicabilidad de la evidencia — que depende de WS-09.',
  }),
  R({
    id: 'TR-ENTORNO.timeout', ws: 'TR-ENTORNO', titulo: 'La suite distingue un fallo del entorno de una regresión',
    estado: 'PROVEN',
    evidencia: 'ops-timeout-y-punto-ciego falla en el contenedor de agente porque el proxy contesta 403 al IP agujero-negro antes de que venza el timeout; en CI, sin proxy, pasa.',
    comando: 'Comparar el job `verificar` del CI contra `npx vitest run` local.',
    resultado: 'CI verde (11 119 casos) con el mismo árbol que aquí da 1 fallo. No se aflojó la aserción.',
  }),
])

/** Los que no están probados y no tienen excusa externa ni diferimiento. */
export function sinProbar(rs: readonly Requisito[] = REQUISITOS): readonly Requisito[] {
  return rs.filter(r => !['PROVEN', 'BLOCKED_EXTERNAL', 'DEFERRED_BY_OWNER', 'NEEDS_CLINICAL_REVIEW'].includes(r.estado))
}

export const POR_QUE_ESTE_CENSO =
  'Un requisito que se cae de una tabla de markdown no rompe nada: deja de existir. ' +
  'Reconciliando el tablero contra el alcance canónico aparecieron SEIS dominios sin ' +
  'una sola fila —voz, aprendizaje, automatización, WhatsApp, razonamiento y ' +
  'accesibilidad—, ninguno diferido ni bloqueado: ausentes. Este archivo existe para ' +
  'que la próxima ausencia ponga el CI en rojo en vez de pasar desapercibida.'
