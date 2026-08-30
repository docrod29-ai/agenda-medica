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
    id: 'WS-01.tablero', ws: 'WS-01', titulo: 'Master Board vivo, con todos los requisitos y su estado',
    estado: 'PARTIAL',
    evidencia: 'REG-416. El tablero decía «el estado sale del código leído hoy» y estaba escrito a mano: SHA y fecha quince REG atrás. Ahora el ESTADO se deriva de requisitos.ts entre marcas, con guardián que falla si está viejo; el CRITERIO se sigue escribiendo a mano, que es la línea que trazó REG-241. El SHA y la fecha no se generan: se borraron, porque MASTER_STATE.json ya los deriva y duplicarlos era crear la segunda fuente de verdad mientras se cierra una.',
    comando: 'node scripts/programa/tablero-derivado.mjs --verificar && npx vitest run src/__tests__/el-tablero-del-loop-no-miente.test.ts',
    resultado: '23 casos. El bloque derivado cuenta y nombra pero NO recomienda — el guardián lo comprueba, porque un generador que dijera «lo siguiente es…» inventaría criterio con aspecto de dato.',
    queFalta: 'La prosa de cada WS sigue a mano y puede envejecer (lo que ya no puede es el estado). Y falta reconciliar con agent-state/BACKLOG.json: V9/V10/V15 arrastran requisitos propios que hoy viven en otro archivo y no entran en este censo.',
    artefactos: ['scripts/programa/tablero-derivado.mjs', 'docs/product/AUSCULTA-MASTER-BOARD.md'],
    pruebas: ['src/__tests__/el-tablero-del-loop-no-miente.test.ts', 'src/__tests__/el-programa-no-pierde-requisitos.test.ts'],
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
    estado: 'PROVEN',
    evidencia: 'REG-408. Ocho conceptos con ventana y con lo que NO cuentan; los siete escenarios se derivan de ahí y el arnés los acepta por nombre. Medir la cota local subió las sesiones de 200 (supuestas) a 400 y enseñó que el techo real es una meseta de caudal, no un número de sesiones.',
    comando: 'npx vitest run src/__tests__/cien-mil-usuarios-no-nombra-un-experimento.test.ts',
    resultado: '32 casos. De 100 000 registrados salen 3 861 sesiones, no 100 000. Umbrales de aceptación en NEEDS_OWNER_DECISION y supuestos con medidoEn: null.',
    artefactos: ['scripts/escala/modelo-de-concurrencia.mjs', 'scripts/product/run-consultorio-load.mjs'],
    pruebas: ['src/__tests__/cien-mil-usuarios-no-nombra-un-experimento.test.ts'],
  }),
  /**
   * LOS DOS QUE CABEN AQUÍ Y LOS CINCO QUE NO.
   *
   * REG-408 partió cada escenario en dos ejes —concurrencia (cuesta sesiones) y
   * volumen (cuesta documentos)— y midió la cota local en vez de suponerla. Con
   * eso, 2 000 y 10 000 registrados resultaron ejecutables aquí; sin la
   * separación, los siete se habrían declarado bloqueados de golpe.
   */
  ...USUARIOS_REGISTRADOS.map(n => (n <= 10_000
    ? R({
      id: `WS-02.registrados-${n}`, ws: 'WS-02',
      titulo: `Escenario de ${n.toLocaleString('es-MX')} usuarios registrados, medido`,
      estado: 'PARTIAL',
      evidencia: `REG-408. docs/audit/ws-02-carga/escenario-${n}-registrados${n === 10_000 ? '-eje-concurrencia' : ''}.json`,
      comando: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/product/run-consultorio-load.mjs --registered=${n}`,
      resultado: n === 2_000
        ? '77 sesiones sobre 39 600 documentos residentes · 3 120 peticiones · 0 errores · 0 fugas en 156 sondas · 20 documentos leídos por consulta, los mismos que sobre una base vacía.'
        : '386 sesiones · 4 632 peticiones · 0 errores · 0 fugas en 772 sondas. Sólo el eje de concurrencia: el volumen de este escenario no cabe en el emulador.',
      queFalta: n === 2_000
        ? 'La corrida es de SATURACIÓN (88× el caudal modelado) y toca el 44 % de la mezcla: no provoca autoguardado, receta, transcripción, redacción ni evidencia. Faltan proveedores de verdad para las colas, la contrapresión y la salud del proveedor.'
        : 'Falta el eje de volumen (198 000 documentos residentes, cota local 50 000) y los proveedores. La corrida cubre el 44 % de la mezcla.',
      artefactos: [`docs/audit/ws-02-carga/escenario-${n}-registrados${n === 10_000 ? '-eje-concurrencia' : ''}.json`],
      pruebas: ['src/__tests__/cien-mil-usuarios-no-nombra-un-experimento.test.ts'],
    })
    : R({
      id: `WS-02.registrados-${n}`, ws: 'WS-02',
      titulo: `Escenario de ${n.toLocaleString('es-MX')} usuarios registrados, medido`,
      estado: 'BLOCKED_EXTERNAL',
      desbloqueaCon: 'Generadores de carga repartidos en varias máquinas contra un proyecto de Firebase de ENSAYO con `firestore.rules` y los índices desplegados, sembrado al volumen del escenario. Una sola máquina no sostiene los canales gRPC que pide, y el emulador guarda los documentos en memoria. Lo autoriza el dueño porque cuesta cuota y presupuesto.',
      preparacionInterna: 'REG-408: el perfil está derivado y el arnés lo acepta por nombre (`--registered`). No hace falta escribir nada más para correrlo: hace falta dónde. El arnés ABORTA si se le pide este escenario aquí, en vez de correr una fracción con la etiqueta puesta.',
      artefactos: ['scripts/escala/modelo-de-concurrencia.mjs'],
      pruebas: ['src/__tests__/cien-mil-usuarios-no-nombra-un-experimento.test.ts'],
    })
  )),

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
    id: 'WS-03.lecturas-sin-cota', ws: 'WS-03', titulo: 'Ninguna lectura del camino diario crece sin techo',
    estado: 'PARTIAL',
    evidencia: 'REG-383 midió las tres del camino diario —lista, búsqueda e historial— y salen planas hasta 50 000 pacientes. REG-394 convirtió el recuento a mano en un trinquete que sólo baja. REG-415 cerró el primero de los dos peores, y de paso corrigió el censo: NINGUNO de los cinco llamadores de `getAppointments` leía sin ventana — los cinco pasaban un where. No era una lectura cara en producción, era la puerta abierta para que la siguiente lo fuera, y eso se cierra con el tipo.',
    comando: 'npx vitest run src/__tests__/la-agenda-no-se-lee-entera.test.ts src/__tests__/las-lecturas-sin-cota-solo-bajan.test.ts',
    resultado: 'La ventana `{ desde, hasta? }` es obligatoria por tipo. No se usó `limit`: la consulta ordena ascendente, así que un tope se quedaría con las citas MÁS ANTIGUAS y tiraría las de esta semana — perder citas en silencio es peor que la lectura cara.',
    queFalta: 'Queda el segundo de los dos peores: `useAppointments` es un onSnapshot cuya ventana SÓLO CRECE — navegar el calendario a hace un año deja el resto de la sesión recibiendo en vivo todas las citas desde entonces. Arreglarlo es rediseñar la ventana de la agenda y la regla de diseño prohíbe hacerlo a ciegas (una interfaz no se aprueba leyendo el código). Y falta medir el resto en el emulador como se midieron las tres del camino diario.',
    artefactos: ['scripts/escala/lecturas-sin-cota.mjs', 'src/lib/firestore.ts'],
    pruebas: ['src/__tests__/las-lecturas-sin-cota-solo-bajan.test.ts', 'src/__tests__/la-agenda-no-se-lee-entera.test.ts'],
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
    queFalta: 'REG-393 acotó el de Consultorio (asr/aprendizaje-firestore.ts) y encontró de paso dos defectos mayores en el mismo archivo: la LECTURA no tenía cota —getDocs de la colección entera en cada apertura de consulta y de UCI, para usar como mucho las mil palabras que caben en el sesgo— y una lectura fallida se pintaba como «todavía no ha aprendido ninguna palabra». El techo del arrayUnion va sobre lo que APORTA cada escritura, no sobre el acumulado, y se declara: recortar el total exigiría leer-modificar-escribir, que es lo que arrayUnion evita. REG-424 cerró internamientos/{id} en lo que se PODÍA cerrar: `administraciones` crecía sin tope aunque `registro-durable.ts` llevaba desde E0-09 diciendo que estaba topado — y como toda mutación del episodio es un solo update sobre ese documento, al pasar de 1 MB no falla lo último: falla TODO, incluido egresar al paciente. Ahora se topa a 100, recortando por el principio para no perder la última dosis dada (el ancla del atraso del MAR, comprobado contra el motor), y es seguro porque cada dosis queda entera en la subcolección append-only. FALTA: `movimientos`, `indicaciones` e `interconsultas` NO se pueden topar —el doc es su única copia y recortarlas borraría traslados u órdenes vivas—; acotarlas de verdad exige sacarlas a subcolección, que toca `firestore.rules` y es otra unidad. Quedan declaradas como riesgo nombrado en `lo-que-cabe-en-un-episodio.ts`, con un guardián que rompe el CI si alguien añade un array nuevo sin clasificarlo.',
    artefactos: ['src/lib/asr/aprendizaje-firestore.ts', 'src/lib/hospital/lo-que-cabe-en-un-episodio.ts'],
    pruebas: ['src/__tests__/lo-aprendido-no-se-descarga-entero.test.ts', 'src/__tests__/un-episodio-largo-no-puede-dejar-de-escribirse.test.ts'],
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
    estado: 'PROVEN',
    evidencia: 'REG-412 (instrumento + farmacia), REG-413 (ARCO y fotos), REG-419 (signos ×2, laboratorio y observación de UCI). El trinquete de escrituras clínicas sin clave de intención está en CERO, y comprueba que sigue contando las doce: un cero por no mirar es indistinguible de un cero por estar bien. La lista a mano de este censo estaba mal en las dos direcciones y no nombraba los signos, que alimentan NEWS2.',
    comando: 'node scripts/idempotencia/escrituras-sin-intencion.mjs && npx vitest run src/__tests__/las-escrituras-sin-intencion-solo-bajan.test.ts src/__tests__/ni-una-escritura-clinica-sin-nombre.test.ts src/__tests__/una-dispensacion-no-se-descuenta-dos-veces.test.ts src/__tests__/un-derecho-y-una-foto-no-se-duplican.test.ts',
    resultado: '24 escrituras con nombre aleatorio en colecciones del consultorio · 12 clínicas · 0 sin clave de intención · 0 sin clasificar. Tres formas de acuñar la clave según lo que exista: modal, archivo o instante medido.',
    artefactos: ['src/lib/idempotencia.ts', 'scripts/idempotencia/escrituras-sin-intencion.mjs'],
    pruebas: [
      'src/__tests__/una-adenda-no-se-escribe-dos-veces.test.ts',
      'src/__tests__/las-escrituras-sin-intencion-solo-bajan.test.ts',
      'src/__tests__/una-dispensacion-no-se-descuenta-dos-veces.test.ts',
      'src/__tests__/un-derecho-y-una-foto-no-se-duplican.test.ts',
      'src/__tests__/ni-una-escritura-clinica-sin-nombre.test.ts',
    ],
  }),
  R({
    id: 'WS-04.inyeccion-de-fallos', ws: 'WS-04', titulo: 'Comportamiento ante caída de proveedor, probado inyectando el fallo',
    estado: 'PARTIAL',
    evidencia: 'REG-389 corrigió este censo (decía NOT_STARTED y era falso). REG-414 cerró la mitad que faltaba de la CONSULTA: la degradación se comprobaba recortando la rama de error del fuente y mirando que no contuviera setDiagnosticos([]) — una prueba que se pone roja por reformatear y verde por descuido. Ahora la decisión vive en `que-sobrevive-a-un-fallo.ts` y se ejecuta para las cuatro clases de fallo.',
    comando: 'npx vitest run src/__tests__/consultorio-degradacion-segura.test.ts',
    resultado: '14 casos, 8 de comportamiento. Ninguna clase de fallo puede perder un campo clínico; la lista incluye signos y alergias, que el guardián viejo nunca miró.',
    queFalta: 'La inyección de fallos de WhatsApp y de Evidence sigue sin medirse (el gateway de IA sí la tiene, con 404, 429, red caída, llave revocada, salida ilegible y créditos devueltos). Y probar que la PANTALLA hace lo que la decisión dice exige un navegador: hoy se comprueba que la llama en las cuatro ramas y que no quedan mensajes escritos a mano.',
    artefactos: ['src/lib/expediente/que-sobrevive-a-un-fallo.ts'],
    pruebas: ['src/__tests__/ia-gateway.test.ts', 'src/__tests__/ia-fallo-proveedor.test.ts', 'src/__tests__/un-proveedor-caido-no-se-reintenta-mil-veces.test.ts', 'src/__tests__/consultorio-degradacion-segura.test.ts'],
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
    estado: 'PROVEN',
    evidencia: 'REG-425. La verificación por lectura era cierta y no era una garantía: un `fetch` nuevo a la página de un editor no habría puesto roja ninguna prueba. Ahora los ocho hosts del camino de evidencia están CLASIFICADOS uno por uno (se_baja / solo_se_enlaza / no_resuelve) con su base legal, y un host que aparezca en el árbol sin clasificar rompe el CI. Sólo se bajan tres APIs oficiales —E-utilities de NCBI, openFDA y el proveedor del modelo—; el resto son enlaces que abre el médico en su navegador. Y no se queda en el CI: `exigeQueSeBaje` corre en las dos puertas de salida y FALLA CERRADO, así que la misma URL que es legítima como enlace lanza si se intenta pedir. Sin navegador sin cabeza en producción, sin analizador de HTML en el camino, y el adaptador de lo no configurado sigue sin conocer ninguna URL.',
    artefactos: ['src/lib/evidence-integrations/de-donde-se-baja.ts', 'scripts/evidence/hosts-del-camino-de-evidencia.mjs'],
    pruebas: ['src/__tests__/una-lectura-no-es-un-guardian.test.ts'],
    comando: 'node scripts/evidence/hosts-del-camino-de-evidencia.mjs && npx vitest run src/__tests__/una-lectura-no-es-un-guardian.test.ts',
    resultado: '8 hosts en el camino de evidencia, los 8 clasificados: 3 se_baja (eutils.ncbi.nlm.nih.gov, api.fda.gov, api.anthropic.com), 4 solo_se_enlaza, 1 no_resuelve. 17 casos verdes. Comprobado al revés con cuatro defectos: un fetch a la página de un editor, Playwright ascendido a dependencia de producción, el adaptador sin contrato aprendiendo una URL, y el escáner apuntando a un directorio vacío — los cuatro ponen el guardián en rojo.',
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
    estado: 'PARTIAL',
    queFalta: 'REG-398 dejó de tirar los cuatro datos que ya se calculaban: las dos formas del nombre de la revista (antes «Title O ISOAbbreviation», y la otra se perdía), el PMCID (se resolvía con una petición y se descartaba), la licencia (se leía y se descartaba, así que no se podía distinguir «sólo hay resumen» de «hay texto completo que la licencia no deja reproducir») y el DOI, que llegaba a la pantalla y NO al Source — o sea, una afirmación respaldada nacía sin el identificador estable de su respaldo. Ausente significa «no se sabe», nunca «no tiene»: nada se rellena con cadena vacía ni con false, y tener PMCID no afirma acceso abierto. Falta: normalizar los ALIAS de revista (un catálogo de nombre entero ↔ abreviatura, que hoy no existe), validar el DOI contra Crossref, y un campo de disponibilidad de texto completo que no sea sólo PMC. Y falta pintarlo: la pantalla todavía no enseña el DOI ni dice «texto completo no reproducible por licencia».',
    artefactos: ['src/types/evidence.ts', 'src/lib/evidencia/desde-pubmed.ts'],
    pruebas: ['src/__tests__/la-identidad-de-la-publicacion-no-se-tira.test.ts'],
  }),
  R({
    id: 'WS-07.prestigio-no-es-calidad', ws: 'WS-07', titulo: 'La marca de la revista no sube la calidad metodológica',
    estado: 'PROVEN',
    evidencia: 'REG-401. Dos mitades. (1) La revista NO entra en el orden —hoy se cumplía y ahora hay guardián, que es lo barato cuando REG-398 acaba de poner nombre, abreviatura ISO y DOI dentro del Source—. (2) La que sí estaba rota: la ETIQUETA del diseño decía de más. `meta-analysis` y `systematic review` salían los dos como «Meta-análisis», y `randomized controlled trial` y `clinical trial` a secas salían los dos como «ECA» — el tipo Clinical Trial de PubMed incluye ensayos NO aleatorizados. El repositorio ya lo sabía y se negaba a traducir esa etiqueta en el modelo de evidencia, pero la etiqueta se consume en el prompt del consultor y en la pantalla del médico, que no pasan por ese borde. NO SE CAMBIÓ EL ORDEN: los diseños recién separados conservan el rango que tenían juntos, porque reordenarlos sería inventar una jerarquía metodológica.',
    comando: 'npx vitest run src/__tests__/la-revista-no-sube-la-calidad.test.ts',
    resultado: '12 casos verdes. Probado al revés añadiendo un desempate por revista al orden: cae el guardián.',
    artefactos: ['src/lib/evidencia/pubmed.ts'],
    pruebas: ['src/__tests__/la-revista-no-sube-la-calidad.test.ts'],
  }),
  R({
    id: 'WS-07.guias', ws: 'WS-07', titulo: 'Motor de guías con organización, versión, fecha, jurisdicción y estado de vigencia',
    estado: 'PARTIAL',
    queFalta: 'REG-402 creó el objeto de guía (organización, versión, jurisdicción, vigencia, fuente y fecha de verificación, superadaPor) y el modelo de discrepancia, y puso el aviso donde el médico lee la referencia: «el sistema NO verifica si esa edición sigue vigente». Lo que FALTA es un hecho clínico y no se inventó: nadie ha verificado qué edición está vigente y cuál quedó superada. GUIAS_VERIFICADAS y DISCREPANCIAS están VACÍAS a propósito — rellenarlas de memoria no rompería nada, no fallaría ninguna prueba, y saldría impreso junto a una recomendación con aspecto de comprobado. NECESITA AL DUEÑO: verificar guía por guía la edición vigente, con su fuente y la fecha de esa comprobación. Falta también la jurisdicción (el campo existe; ninguna cita de texto la declara) y reestructurar los 112 campos `referencia`, muchos de los cuales son prosa y no citas.',
    artefactos: ['src/lib/clinical/guias.ts'],
    pruebas: ['src/__tests__/una-guia-tiene-edicion-y-las-ediciones-caducan.test.ts'],
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
    queFalta: 'REG-405 dio asOf/version/historialRecortado a las TRES (antes sólo alergias), y REG-406 puso el guardián que impide que empiecen a persistirse en silencio — que era el riesgo real, porque el sobre era justamente la precondición para poder guardarlas. Las tres condiciones para persistir con seguridad quedan escritas en el guardián: la proyección nunca es autoridad, trae asOf y version, y una anterior a la última nota firmada NO SE USA. Sigue PARTIAL porque las proyecciones se recalculan en el navegador y ninguna se persiste: cerrar esto es implementar el caché CUMPLIENDO las tres, no sólo prometerlo. De paso quedó anotado que escribir la lógica de ese caché por adelantado fue rechazado por tres guardianes del propio repositorio, con razón.',
    pruebas: ['src/__tests__/la-proyeccion-no-le-gana-a-la-nota.test.ts'],
  }),
  R({
    id: 'WS-10.problemas-medicacion-alergias', ws: 'WS-10', titulo: 'Problemas activos, medicación activa y alergias, longitudinales',
    estado: 'PARTIAL',
    queFalta: 'REG-405 dio a problemas y medicación el MISMO sobre que alergias ya tenía desde REG-363 (asOf, version, historialRecortado) y lo cableó: las dos pantallas tenían `truncada` en la mano y lo dejaban caer en la puerta, así que con un historial largo la medicación vigente se calculaba sobre una ventana y se enseñaba como el expediente entero — un fármaco anterior al techo desaparecía también de la comprobación de interacciones. FALTA la persistencia, y NO se hizo a propósito: guardar una proyección sin decidir quién manda cuando el caché y las notas discrepan crea la segunda fuente de verdad que WS-10.proyeccion-no-es-segunda-verdad prohíbe. El sobre era su precondición. Falta además que la pantalla PINTE el recorte: hoy el dato le llega y no lo enseña.',
    artefactos: [
      'src/lib/expediente/alergias-longitudinales.ts',
      'src/lib/expediente/problemas-activos.ts',
      'src/lib/expediente/ordenes-medicamento.ts',
    ],
    pruebas: ['src/__tests__/una-lista-no-dice-de-cuanto-historial-salio.test.ts'],
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
    estado: 'PARTIAL',
    queFalta: 'BANDERAS cerrado en su mitad accionable (REG-423): `banderasDeclaradas` reúne lo que YA declaró una persona —alergia con severidad grave o anafilaxia, y problema marcado crónico— con su procedencia y desde cuándo, sobre las dos proyecciones que la pantalla ya calcula (sin un cuarto recorrido), y se ve en el expediente. NO fija el catálogo de qué es una bandera: eso es política clínica del médico. CORRECCIÓN DEL CENSO: de las tres fuentes que esta entrada pedía, la tercera —`PatientTag`— NO EXISTE como dato: el tipo tiene 13 valores y `PATIENT_TAG_CONFIG` su color, pero `patient.tags` no tiene un solo escritor ni lector en el árbol, así que recogerla habría sido recoger un campo siempre vacío y hacer que «sin banderas» se leyera como «sin riesgo». Queda declarada en LO_QUE_NO_SE_VIGILA, que se PINTA al lado de la lista. FALTA: (a) la pantalla que escriba las etiquetas, y entonces decidir si entran al eje; (b) RESPUESTA AL TRATAMIENTO — el dato no existe: nada liga un fármaco con el desenlace del problema que trata, `Medicamento.indicacion` es texto libre y casarlo por parecido sería inventar el vínculo; reusar `trayectoriaDe`/`queCambio` y NO añadir un cuarto motor de tendencia; (c) COMPROMISOS — falta el compromiso en sí (qué prometió revisar y cuándo) y la nota no lo guarda porque su esquema está congelado por el sello (WS-10.sello-v4); (d) el catálogo clínico de banderas, que es del médico.',
    artefactos: ['src/lib/expediente/banderas-declaradas.ts', 'src/app/(dashboard)/expediente/[patientId]/page.tsx'],
    pruebas: ['src/__tests__/una-lista-de-banderas-vacia-no-dice-sin-riesgo.test.ts'],
  }),
  R({
    id: 'WS-10.vocabulario-canonico', ws: 'WS-10', titulo: 'Un solo vocabulario de verdad clínica',
    estado: 'NEEDS_CLINICAL_REVIEW',
    queFalta: 'Tres en paralelo: TruthState, ClinicalTruthStatus y ClinicalFact. El mejor diseñado (bitemporal, con supersedes y procedencia discriminada) es el que está muerto. Cuál se vuelve canónico es política clínica del dueño, no un refactor.',
  }),
  R({
    id: 'WS-10.pantalla-de-certeza', ws: 'WS-10', titulo: 'El médico puede elegir el tipo de un diagnóstico',
    estado: 'PARTIAL',
    queFalta: 'REG-407 lo cerró en la consulta: selector de los CUATRO tipos en cada fila del diagnóstico, con etiqueta accesible, bloqueado en nota firmada, y elegirlo marca tipoOrigen: medico — la única vía por la que un diagnóstico pasa a estar firmado por una persona. CORRECCIÓN DEL CENSO (REG-421): esta entrada pedía «la misma elección en las otras superficies (expediente, UCI/hospital)» y contra el árbol no se sostenía. Hospital y UCI NO tienen Diagnostico[]: tienen diagnosticoIngreso, una cadena libre sin tipo, así que no hay certeza que elegir porque no hay campo donde ponerla. Y el expediente enseña notas ya FIRMADAS: un selector ahí sería una segunda puerta de escritura sobre una nota firmada. Construirlo habría sido construir el defecto con el censo dando la orden. Buscando quién LEE diagnósticos aparecieron cinco lectores y dos no los leían: los IMPRIMÍAN. La receta y la orden elegían el principal con `find(definitivo) ?? dxs[0]`, y ese respaldo no mira tipo: un «embarazo descartado» —que es como se documenta una prueba negativa— salía impreso como el motivo de la receta. Cerrado: una sola puerta (diagnosticoQueSeImprime) que usa estaVigente y no rellena nada si nada califica, y los tres lectores de listas (nota, expediente, carta de referencia) pasan por nombreConCerteza. FALTA, y las dos necesitan al médico: (1) si firmar con diagnósticos cuyo tipo puso el dictado debe avisar más fuerte o bloquear —hoy avisa y no obliga, porque obligar sería fijar política clínica—; (2) si diagnosticoIngreso de hospital/UCI debe dejar de ser una cadena libre y llevar tipo, que es un cambio de modelo.',
    artefactos: ['src/app/(dashboard)/consulta/[patientId]/page.tsx', 'src/lib/expediente/problemas-activos.ts'],
    pruebas: ['src/__tests__/el-medico-elige-el-tipo-de-su-diagnostico.test.ts', 'src/__tests__/un-descarte-no-puede-ser-el-motivo-de-la-receta.test.ts'],
  }),

  /* ═══ WS-11 · Ciclo cerrado ═══════════════════════════════════════════════ */
  R({
    id: 'WS-11.estados-del-cierre', ws: 'WS-11', titulo: 'Decisión, acción y aviso al paciente son etapas distintas',
    estado: 'PARTIAL',
    queFalta: 'REG-360/361 dieron campo y formulario; REG-404 añadió `agendada` como estado VIVO — el pendiente de seguimiento se cerraba al crear la cita, así que agendar contaba como haber visto al paciente y un no-show no reabría nada. No se puede saltar de `agendada` a `cerrada`: desde «hay una cita puesta» no hay nada que revisar. Falta: (1) cruzarlo con la colección de citas —hoy `agendada` es lo que alguien DECLARÓ, no lo que el calendario dice—; (2) qué hacer con el no-show, que necesita al médico: cuánto se espera y si escala; (3) el cierre sigue haciéndose sólo desde /pendientes.',
    artefactos: ['src/lib/tareas-clinicas/modelo.ts'],
    pruebas: ['src/__tests__/agendar-no-es-haber-visto-al-paciente.test.ts'],
  }),
  R({
    id: 'WS-11.laboratorio', ws: 'WS-11', titulo: 'Un resultado de laboratorio de consultorio genera tarea de revisión',
    estado: 'PARTIAL',
    queFalta: 'CORRECCIÓN DEL CENSO (REG-403): tres de los cuatro campos que esta entrada pedía YA EXISTEN, en el sitio correcto y con otro nombre — `revisado` es `estado: cerrada` de la tarea, `revisadoPor` es `cerradaPor` y `revisadoEn` es `cerradaEn`. Ponerlos en el panel es lo que la arquitectura prohíbe, y `laboratorio/firestore.ts` lo tiene escrito bajo el título «DÓNDE VIVE REVISADO»: crearía una segunda fuente de verdad del mismo hecho. Construirlos habría sido construir el defecto, con el censo dando la orden. El cuarto SÍ faltaba y se cerró: nada registraba que un valor crítico se hubiera comunicado, así que «lo vi» y «localicé a alguien» eran el mismo gesto. Ahora el cierre de un crítico PREGUNTA (no bloquea: si el aviso debe ser obligatorio y en cuánto tiempo es política clínica, y fijarla está prohibido). FALTA, y necesita al médico: el plazo máximo entre ver un crítico y avisar, y qué destinatarios cuentan — hoy sólo consta sí/todavía no/no hacía falta, sin a quién ni por qué vía.',
    artefactos: ['src/lib/tareas-clinicas/modelo.ts'],
    pruebas: ['src/__tests__/un-critico-visto-no-es-un-critico-avisado.test.ts'],
  }),
  R({
    id: 'WS-11.interconsultas-imagen', ws: 'WS-11', titulo: 'Interconsultas, referencias e imagen dentro del ciclo',
    estado: 'PARTIAL',
    queFalta: 'CERRADA LA INTERCONSULTA (REG-422). Vivía sólo en `Internamiento.interconsultas`, así que `tareasVivas`, `cabosDelPaciente` y `estadoDeAccion` no la veían: una pedida y no contestada era invisible fuera de una pestaña de un episodio. Misma fuga que REG-252. Lo que la desbloqueó: el id lo acuñaba el servidor dentro de la transacción y NO salía de ella —`agregarInterconsulta` devolvía cadena vacía—, así que no había a qué colgarle la tarea; ahora lo acuña quien pide, con `claveDeIntento` + `idIdempotente`, forma cerrada y validada en el servidor, que además reconoce el reintento y ya no duplica la interconsulta. La tarea se crea en la LIBRERÍA, única puerta, no en la pantalla. Contestar la deja `completada` y NO `cerrada` —el censo pedía cerrarla y el modelo lo prohíbe con razón: cerrar es que alguien LEYÓ la respuesta y decidió, y eso es del que la pidió—. FALTA, y las dos son del médico: (1) el PLAZO tras el cual una interconsulta sin contestar está vencida (especialidad, urgencia, acuerdo del hospital): sin él nace sin `venceEn` y `estaVencida` no opina, a propósito; (2) en QUÉ grupo del worklist se enseña — hoy cae en `otros` («Otros pendientes»), que es honesto: `esperando_resultado` mentiría (se espera a un colega, no a una máquina) y una categoría nueva sería modelo sin información, que REG-404 evitó. FALTAN TAMBIÉN, y son problemas aparte: la REFERENCIA sigue siendo sólo un impreso, y la IMAGEN no tiene entidad (modalidad, lateralidad, informe, comparación con previos) — aunque el ORDEN de imagen sí entra ya, porque `estudio_pendiente` cubre «laboratorio o gabinete». Todo esto es carril Hospital, ALPHA y no a la venta.',
    artefactos: ['src/lib/hospital/firestore.ts', 'src/lib/tareas-clinicas/derivar.ts', 'src/app/api/hospital/mutar/route.ts'],
    pruebas: ['src/__tests__/una-interconsulta-pedida-no-entraba-al-bucle.test.ts'],
  }),
  R({
    id: 'WS-11.sobrevive-a-la-navegacion', ws: 'WS-11', titulo: 'Nada pendiente desaparece al cambiar de pantalla',
    estado: 'PARTIAL',
    evidencia: 'REG-411. No faltaba sólo la prueba: `crearTareas` tenía cuatro llamadores y REG-344 sólo había arreglado uno; donde sí había aviso era un toast, que muere al cambiar de pantalla. Ahora la decisión vive en un sitio, lo que no entra se guarda fuera de la sesión y Pendientes lo vuelve a ofrecer.',
    comando: 'npx vitest run src/__tests__/un-pendiente-perdido-no-muere-con-el-aviso.test.ts',
    resultado: '23 casos. Lo perdido sobrevive a la navegación, se aísla por consultorio, dice cuando NO se pudo guardar, y no se reintenta solo.',
    queFalta: 'Sigue siendo almacenamiento local: no cruza a otro equipo ni a otro navegador, y el cierre de sesión lo limpia (lleva PHI). Un pendiente perdido en el consultorio no aparece en el teléfono. Cruzar esa frontera exige escribir en Firestore justo cuando se acaba de demostrar que no se puede escribir, o una cola con reintento — que REG-390 reserva.',
    artefactos: ['src/lib/tareas-clinicas/no-se-abrieron.ts', 'src/lib/tareas-clinicas/abrir.ts'],
    pruebas: ['src/__tests__/un-pendiente-perdido-no-muere-con-el-aviso.test.ts'],
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
    estado: 'PARTIAL',
    queFalta: 'REG-400 cerró la parte que se puede decidir SIN un modelo, y sólo ésa: de qué parte del artículo sale el pasaje. PubMed escribe la sección en el XML y el producto la tiraba, así que una cita de los ANTECEDENTES —lo que se creía antes del estudio, a veces justo lo que vino a refutar— se leía igual que una conclusión. Ahora se marca aparte de lo no respaldado, porque son dos defectos distintos: una cita sin anclar NO EXISTE en el artículo; una anclada en los antecedentes existe y es literal. NO es un evaluador de entailment y no se declara como tal: falta juzgar si el pasaje SIGNIFICA lo que la afirmación dice, y eso exige un modelo, su conjunto de referencia y un umbral que tiene que fijar un médico (declarado en ia/contratos-de-evaluacion.ts). Faltan también las dos comprobaciones deterministas siguientes: POLARIDAD («no redujo la mortalidad» citado como «redujo») y MATIZ («podría reducir» citado como «reduce»).',
    artefactos: ['src/lib/evidencia/de-donde-sale-el-pasaje.ts'],
    pruebas: ['src/__tests__/una-cita-de-los-antecedentes-no-demuestra-nada.test.ts'],
  }),
  R({
    id: 'WS-12.contratos-de-evaluacion', ws: 'WS-12', titulo: 'Cada capacidad de IA con dataset, métrica, umbral y política de fallo',
    estado: 'PARTIAL',
    queFalta: 'REG-399 creó el contrato: 17 capacidades, cada una con qué decide, QUÉ CUESTA QUE SE EQUIVOQUE, su conjunto (o qué haría falta para que existiera), su métrica y su política de fallo. Un guardián compara el censo contra los `feature` del árbol y el censo se aplica también en ejecución. Falta lo que NO se puede hacer sin el dueño y no se inventó: 15 de los 17 UMBRALES los tiene que fijar un médico —cuánta pérdida de medicamentos es tolerable al extraer una nota es una cifra clínica, y la regla 1 prohíbe inventarlas—. Falta también construir los conjuntos: la mayoría no existe, y el de voz no puede nacer de audio real porque la voz es biométrica. Y la política de fallo se DECLARA; sólo una está comprobada en el código.',
    artefactos: ['src/lib/ia/contratos-de-evaluacion.ts'],
    pruebas: ['src/__tests__/cada-capacidad-de-ia-tiene-su-contrato.test.ts'],
  }),
  R({
    id: 'WS-12.router', ws: 'WS-12', titulo: 'El médico expresa intención clínica, no elige marca de modelo',
    estado: 'PARTIAL',
    queFalta: 'planes-ia.ts respeta la regla. Falta probar el fallback del router ante caída de proveedor, y que no degrade calidad clínica en silencio para ahorrar.',
  }),
  R({
    id: 'WS-12.p99', ws: 'WS-12', titulo: 'p99 y tasa de error medidas, no citadas',
    estado: 'PARTIAL',
    evidencia: 'REG-417. CORRECCIÓN DE ESTE CENSO: «no hay p99 en ningún sitio» era falso — `observabilidad/latencias.ts` calcula p50/p95/p99/máximo/fallos por feature y por modelo sobre los asientos de este mismo libro, desde antes. Empecé duplicándolo por fiarme del censo en vez de buscar, y lo retiré. El defecto REAL estaba debajo: DOS implementaciones de percentil sobre los mismos datos —rango más cercano en el libro, interpolación en observabilidad— que dan cifras distintas (p50 190/195, p99 290/288,1).',
    comando: 'npx vitest run src/__tests__/el-p99-no-se-lee-sin-su-letra-pequena.test.ts',
    resultado: '12 casos. Los dos archivos se citan con las cifras de la divergencia dentro, y el guardián comprueba que las notas siguen ahí: ninguno se puede editar sin ver al otro. El resumen del libro gana latenciaP99, muestrasDeLatencia y fallos/tasaDeFallo — este último se registraba desde siempre y nadie lo sumaba.',
    queFalta: 'DECISIÓN DEL DUEÑO, no de código: qué método de percentil se reporta. Los dos están elegidos a conciencia y probados —`finanzas-cost-ledger` fija p95=9000, que es una llamada REAL; `latencias.test.ts` fija percentil([0,10],0.5)=5, que nunca ocurrió— y la cifra sale en el tablero que él mira, así que unificar cambia números que ya ha visto. Aparte: sólo se cubre lo que deja asiento en el libro (llamadas a un proveedor de IA); medir latencia/error de TODA ruta HTTP exige instrumentar el borde y decidir dónde se guardan esas métricas, que es infraestructura. Y ningún umbral está fijado.',
    artefactos: ['src/lib/finanzas/cost-ledger.ts', 'src/lib/observabilidad/latencias.ts'],
    pruebas: ['src/__tests__/un-solo-percentil-en-el-arbol.test.ts'],
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
    id: 'WS-13.correlation-id', ws: 'WS-13', titulo: 'Una traza que cruza del navegador al proveedor y al libro',
    estado: 'PROVEN',
    evidencia: 'REG-388 cosió el hilo del navegador al asiento en las 16 rutas de IA. REG-418 cerró los dos extremos: los cinco crons acuñan su traza AL ARRANCAR —no aceptan la que les manden, porque quien tenga el secreto del cron puede mandarle una cabecera y elegir la traza— y el gateway la manda al proveedor como cabecera validada, la misma que va al asiento.',
    comando: 'npx vitest run src/__tests__/un-trabajo-de-fondo-tambien-deja-hilo.test.ts',
    resultado: '12 casos. Los cinco crons, y en TODOS sus latidos incluido el del catch — que es el de la corrida que falló, la que alguien va a querer seguir. Sin traza no se manda cabecera vacía.',
    artefactos: ['src/lib/observabilidad/correlacion.ts', 'src/lib/ops/latido.ts', 'src/lib/ia/gateway.ts'],
    pruebas: ['src/__tests__/un-trabajo-de-fondo-tambien-deja-hilo.test.ts'],
  }),
  R({
    id: 'WS-13.alertas', ws: 'WS-13', titulo: 'Lo que se rompe llega a alguien, sin que haya que sospecharlo',
    estado: 'PARTIAL',
    evidencia: 'REG-396 conectó la caída de la IA de plataforma. REG-397 conectó la cola de WhatsApp pausada y el dead-letter (este censo decía que faltaba: estaba viejo). REG-420 conecta lo que revienta en el navegador — se recogía en la colección `errores` y había que abrir el panel del dueño para verlo. No avisa de todo y NO usa umbral: un usuario con un error puede ser su navegador; dos usuarios distintos con el mismo error es del producto. Los anónimos se cuentan aparte porque si el login revienta nadie puede identificarse para demostrarlo.',
    comando: 'npx vitest run src/__tests__/un-error-es-un-reporte-dos-son-una-averia.test.ts',
    resultado: '19 casos. La firma normaliza las cifras del mensaje —sin eso cada aparición parecería única y el aviso no saltaría nunca— y no junta rutas distintas. Se marca como visto SÓLO si el aviso salió.',
    queFalta: 'Dos señales siguen sin instrumentar, y hasta que no se escriban en algún sitio no hay nada que leer: los 5xx genéricos del servidor y las anomalías de autorización. Eso es instrumentar antes que avisar. Y el CANAL sigue sin destino: OPS_ALERTA_WEBHOOK es acción del dueño — sin él, enviarAlertaOps lo declara y no marca nada como avisado, que es lo correcto.',
    artefactos: ['src/lib/ops/lo-que-se-repite.ts', 'src/app/api/cron/vigilante/route.ts'],
    pruebas: [
      'src/__tests__/ops-latido-y-alerta.test.ts',
      'src/__tests__/la-averia-de-la-ia-llega-a-alguien.test.ts',
      'src/__tests__/un-error-es-un-reporte-dos-son-una-averia.test.ts',
    ],
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
    estado: 'PROVEN',
    evidencia: 'REG-409. No se pondera: un peso es una penalización y se compensa con volumen. Tres cuentas que no se suman, y se aprueba con cero críticos y cero sin clasificar. Conectado a scripts/medir-wer-limpio.ts, que escribe docs/voice/WER-MEDIDO.json.',
    comando: 'npx vitest run src/__tests__/un-wer-bajo-no-compensa-una-dosis.test.ts',
    resultado: 'Sobre la consulta sintética de 532 palabras, «setenta y cinco microgramos» → «miligramos» da WER 0,188 % y REPRUEBA. Contra sí misma: 0 críticos, 0 sin clasificar. 1 964 términos vigilados.',
    artefactos: ['src/lib/asr/lo-que-pesa-de-un-error.ts', 'scripts/medir-wer-limpio.ts'],
    pruebas: ['src/__tests__/un-wer-bajo-no-compensa-una-dosis.test.ts'],
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
    queFalta: 'El interruptor y la caída del proveedor ya están (REG-391), y REG-397 puso el instrumento que faltaba: el cron cuenta pausadas y rendidas, y el vigilante avisa distinguiéndolas —una pausa se arregla sola cuando el proveedor vuelve; una rendida ya no se reintenta nunca—. Sigue PARTIAL y ahora por una razón precisa: un aviso dice CUÁNTAS hay, no deja verlas, ni reintentarlas, ni saber de qué paciente eran. Cerrar esto es la pantalla del dead-letter. Falta además el mensaje REACTIVO del bot, que no pasa por el outbox: si el proveedor está caído cuando el paciente escribe, esa respuesta se pierde y no queda en ninguna cola.',
    artefactos: ['src/lib/whatsapp/outbox.ts'],
    pruebas: ['src/__tests__/una-cola-en-pausa-no-es-una-tarde-tranquila.test.ts'],
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
