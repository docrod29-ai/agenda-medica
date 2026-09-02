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
    queFalta: 'REG-426 cerró la mitad que faltaba: los otros DOS programas en vuelo ya no son invisibles. El tablero de Ausculta custodia 78 requisitos y está bien vigilado, pero custodiaba UN programa de TRES — V9 (experiencia del paciente) y V10 (excelencia visual) viven en agent-state/ y el tablero no los mencionaba, así que «quedan N accionables» era cierto del censo y falso del producto. Ahora se cuentan en docs/product/PROGRAMAS-EN-VUELO.md, con guardián. NO se fusionan a propósito: V10 es el carril de Product Excellence y el §20 del directivo prohíbe rehacer su trabajo. Al reconciliar V9 se midieron sus 10 abiertos UNO POR UNO contra el árbol y CINCO ya estaban hechos sin marcar. REG-441 cerró lo que faltaba de las CIFRAS: la sección titulada «Compuertas medidas en este SHA — no citadas de memoria» citaba de memoria un trinquete de 96 con el techo en 95, y 10 844 casos con el árbol en 12 019. Cuarta vez este mes —con REG-424, REG-428 y REG-438— de que la garantía mejor explicada es la que nadie fue a comprobar. Ahora los TECHOS se derivan de los cuatro archivos que ya los tenían (lint-techo, techos-de-diseno, MASTER_STATE, invariantes-clinicos) y el guardián compara byte a byte. El RESULTADO de correr la suite NO se deriva a propósito: exige correrla, y una corrida de tres minutos dentro de un generador de documentación es algo que nadie ejecuta — así que sigue siendo una FOTO, se llama así, lleva fecha y dice que si no cuadra con lo de hoy gana lo de hoy. FALTA: la prosa de cada WS sigue a mano, y debe — es criterio, no un grep; lo que ya no puede envejecer son las cifras. Y no se comprueba que la foto sea reciente, que exigiría correr la suite desde el guardián.',
    artefactos: [
      'scripts/programa/tablero-derivado.mjs',
      'scripts/programa/reconciliar-programas.mjs',
      'docs/product/AUSCULTA-MASTER-BOARD.md',
      'docs/product/PROGRAMAS-EN-VUELO.md',
    ],
    pruebas: [
      'src/__tests__/el-tablero-del-loop-no-miente.test.ts',
      'src/__tests__/el-programa-no-pierde-requisitos.test.ts',
      'src/__tests__/un-programa-de-tres-no-es-el-producto.test.ts',
    ],
  }),
  R({
    id: 'WS-01.directivo-durable', ws: 'WS-01', titulo: 'El directivo del loop sobrevive al fin de sesión',
    estado: 'PROVEN',
    evidencia: 'REG-426. `agent-state/AUSCULTA_MASTER_LOOP.md` tenía 33 líneas, nombraba una rama que ya no existe y NO contenía el directivo canónico: sus 26 apartados vivían sólo en el mensaje del dueño. Un loop cuyo contrato se pierde al cerrar la sesión se reinterpreta en la siguiente, y eso ya pasó — se trabajó un censo de tres programas. Ahora el directivo íntegro vive en `agent-state/AUSCULTA_MASTER_LOOP_DIRECTIVO.md`, con guardián que exige los 26 apartados y las condiciones de terminado del §25.',
    comando: 'npx vitest run src/__tests__/un-programa-de-tres-no-es-el-producto.test.ts',
    resultado: 'El directivo trae los 26 apartados numerados, las 8 condiciones del §25 y la regla del §26. El guardián cae si falta cualquiera.',
    artefactos: ['agent-state/AUSCULTA_MASTER_LOOP_DIRECTIVO.md'],
    pruebas: ['src/__tests__/un-programa-de-tres-no-es-el-producto.test.ts'],
  }),
  R({
    id: 'WS-01.programas-paralelos', ws: 'WS-01', titulo: 'Los tres programas en vuelo se cuentan en un solo sitio',
    estado: 'PROVEN',
    evidencia: 'REG-426. Ningún documento derivado puede notar la ausencia de algo que no está en su fuente, y por eso un programa entero podía quedar fuera de la foto sin que nada se pusiera rojo. `reconciliar-programas.mjs` lee los tres backlogs y genera el conteo; el guardián lo compara con los archivos y cae si difieren. V10 se CUENTA y no se ejecuta: es el carril de Product Excellence y el §20 prohíbe rehacer su trabajo.',
    comando: 'node scripts/programa/reconciliar-programas.mjs --verificar',
    resultado: 'Ausculta 78 (34 abiertos) · V9 25 (5 abiertos, tras verificar los 10 contra el árbol) · V10 39 (27 abiertos, carril ajeno).',
    artefactos: ['scripts/programa/reconciliar-programas.mjs', 'docs/product/PROGRAMAS-EN-VUELO.md'],
    pruebas: ['src/__tests__/un-programa-de-tres-no-es-el-producto.test.ts'],
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
    queFalta: 'REG-393 acotó el de Consultorio (asr/aprendizaje-firestore.ts) y encontró de paso dos defectos mayores en el mismo archivo: la LECTURA no tenía cota —getDocs de la colección entera en cada apertura de consulta y de UCI, para usar como mucho las mil palabras que caben en el sesgo— y una lectura fallida se pintaba como «todavía no ha aprendido ninguna palabra». El techo del arrayUnion va sobre lo que APORTA cada escritura, no sobre el acumulado, y se declara: recortar el total exigiría leer-modificar-escribir, que es lo que arrayUnion evita. REG-424 cerró internamientos/{id} en lo que se PODÍA cerrar: `administraciones` crecía sin tope aunque `registro-durable.ts` llevaba desde E0-09 diciendo que estaba topado — y como toda mutación del episodio es un solo update sobre ese documento, al pasar de 1 MB no falla lo último: falla TODO, incluido egresar al paciente. Ahora se topa a 100, recortando por el principio para no perder la última dosis dada (el ancla del atraso del MAR, comprobado contra el motor), y es seguro porque cada dosis queda entera en la subcolección append-only. FALTA: `movimientos`, `indicaciones` e `interconsultas` NO se pueden topar —el doc es su única copia y recortarlas borraría traslados u órdenes vivas—; acotarlas de verdad exige sacarlas a subcolección, que toca `firestore.rules` y es otra unidad. Quedan declaradas como riesgo nombrado en `lo-que-cabe-en-un-episodio.ts`, con un guardián que rompe el CI si alguien añade un array nuevo sin clasificarlo. REG-442: ese módulo terminaba diciendo que «un riesgo declarado SE PUEDE VIGILAR» y NADIE lo vigilaba — quinta vez este mes (con REG-424, 428, 438 y 441) de que la garantía mejor explicada es la que nadie fue a comprobar. Ahora el gateway mide el tamaño del documento que va a ESCRIBIR —sin una lectura de más, porque ya lo tiene en la mano—, dice qué campo lo llena, y avisa a operaciones cuando pasa del 80 %. Los umbrales son margen de OPERACIÓN sobre el límite de 1 MiB de Firestore, no cifras clínicas, y la medida se queda corta a propósito para que el aviso llegue antes y nunca después. NO bloquea la mutación clínica y NO se le devuelve al médico, que no puede hacer nada con ello. FALTA lo que cierra el riesgo de verdad: sacar los tres arrays a subcolección. Es una migración de modelo que toca `firestore.rules`, y desplegarlas es del dueño — el código nuevo con las reglas viejas rompería producción el día del despliegue.',
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
    queFalta: 'CORRECCIÓN DEL CENSO (REG-434): esta entrada decía que la inyección de fallos de WhatsApp y de Evidence «sigue sin medirse» y era FALSO — las dos tienen su golden desde hace tiempo (5xx, tiempo agotado, 429, credencial caducada, circuito por consultorio y por fuente, dead-letter, testigo) y ninguno estaba listado aquí. Lo que sí faltaba salió comparando CLASE POR CLASE contra las seis del gateway de IA: la SALIDA ILEGIBLE no estaba en Evidence. NCBI contesta 200 con `{"esearchresult":{"ERROR":"…"}}` o con una página HTML, el transporte es impecable, y las tres defensas existentes miran el transporte: el testigo se quedaba en false y el médico leía «PubMed no devolvió artículos» de una búsqueda que nunca obtuvo respuesta. Cerrado por la forma de la respuesta, no por su contenido: una búsqueda legítimamente vacía sigue siendo una respuesta. FALTA: la salida ilegible de openFDA (otra forma de contestar, otro cuello de botella); las respuestas PARCIALES de efetch, que se dejan pasar a propósito; y probar que la PANTALLA hace lo que la decisión dice, que exige un navegador — hoy se comprueba que la llama en las cuatro ramas y que no quedan mensajes escritos a mano. REG-435: al ir a por la salida ilegible de openFDA resultó que ahí NO estaba el defecto (devolver null es correcto: quien llama trata la ausencia de etiqueta como «no hay dosis oficial» y el prompt manda verificar sin inventar cifras). El que sí estaba, en las DOS fuentes, era el INTERRUPTOR: `contesto` se anotaba al ver el código de estado, y en la máquina de estados eso cierra el circuito y OLVIDA los fallos anteriores, así que un proveedor degradado que contesta 200 con la página de su balanceador reseteaba su propio interruptor en cada intento. Medido: openFDA 503 → 3 peticiones y circuito abierto; openFDA 200+HTML → 40 de 40 y ninguno; PubMed 200+HTML → 16 de 16 y ninguno. Cerrado anotando el éxito DESPUÉS de leer el cuerpo (una resta, no un fallo nuevo) y contando el cuerpo inservible sólo cuando NO es de este protocolo — un `esearchresult.ERROR` es defecto NUESTRO y apagaría la evidencia de todos los médicos, para siempre por ser constante.',
    evidencia: 'REG-389 corrigió este censo (decía NOT_STARTED y era falso). REG-414 cerró la mitad que faltaba de la CONSULTA: la degradación se comprobaba recortando la rama de error del fuente y mirando que no contuviera setDiagnosticos([]) — una prueba que se pone roja por reformatear y verde por descuido. Ahora la decisión vive en `que-sobrevive-a-un-fallo.ts` y se ejecuta para las cuatro clases de fallo. REG-434 añadió la salida ilegible de Evidence, confirmada EJECUTÁNDOLA antes de arreglarla: 0 artículos y testigo en false.',
    comando: 'npx vitest run src/__tests__/un-200-ilegible-no-es-no-hay-articulos.test.ts',
    resultado: '16 casos verdes. Probado al revés tres veces, una de ellas contra pasarse de frenada: si una lista vacía cuenta como caída, caen dos casos.',
    artefactos: ['src/lib/expediente/que-sobrevive-a-un-fallo.ts', 'src/lib/evidencia/una-respuesta-ilegible-no-es-una-respuesta.ts', 'src/lib/evidencia/fallo-del-proveedor.ts'],
    pruebas: [
      'src/__tests__/ia-gateway.test.ts',
      'src/__tests__/ia-fallo-proveedor.test.ts',
      'src/__tests__/un-proveedor-caido-no-se-reintenta-mil-veces.test.ts',
      'src/__tests__/consultorio-degradacion-segura.test.ts',
      'src/__tests__/una-caida-de-whatsapp-no-mata-la-cola.test.ts',
      'src/__tests__/una-fuente-caida-no-cuelga-la-consulta.test.ts',
      'src/__tests__/un-200-ilegible-no-es-no-hay-articulos.test.ts',
      'src/__tests__/el-interruptor-lo-derrotaba-un-200-con-basura.test.ts',
    ],
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
    queFalta: 'REG-433 cerró la mitad interna. Al medir el `queFalta` anterior contra el árbol resultó que el dato NO faltaba: los cuatro campos ya viajaban al navegador y los tipos de las dos pantallas los borraban — `type ArtEv` de la consulta declaraba cinco campos y `interface Articulo` del consultor otros cinco, así que el DOI, la abreviatura ISO, el PMCID, el acceso abierto y la salvedad de diseño de REG-401 cruzaban la red y se tiraban en la puerta. Ahora se pintan, con tres reglas: un DOI mal formado se enseña SIN enlace (un doi.org roto parece verificable y no lleva a ninguna parte); «hay texto completo en PMC y su licencia no deja copiarlo aquí» se dice, en vez de pintarse igual que «sólo hay resumen»; y el catálogo de alias se OBSERVA de los pares que PubMed ya da en cada registro, nunca se adivina por parecido («Am J Med» y «Am J Med Sci» son dos revistas). FALTA, y las dos mitades necesitan red y declaración de host: validar que el DOI EXISTA contra Crossref (aquí sólo se valida su forma) y saber si hay texto completo FUERA de PMC (Unpaywall o el editor) — hoy eso sale `no_consta`, que es «no se miró», nunca «no hay». Falta también el catálogo NLM completo, que no se escribe de memoria.',
    evidencia: 'REG-433. Guardián probado al revés cuatro veces; la cuarta pasó y destapó un hueco propio: la aserción casaba con `title={a.tipoSalvedad}`, o sea con un tooltip. Un aviso que sólo existe al pasar el ratón no llega, y en móvil no existe. Se exigió texto visible.',
    comando: 'npx vitest run src/__tests__/el-doi-llegaba-a-la-pantalla-y-no-se-pintaba.test.ts',
    resultado: '20 casos verdes.',
    artefactos: ['src/types/evidence.ts', 'src/lib/evidencia/desde-pubmed.ts', 'src/lib/evidencia/identidad-de-la-publicacion.ts'],
    pruebas: ['src/__tests__/la-identidad-de-la-publicacion-no-se-tira.test.ts', 'src/__tests__/el-doi-llegaba-a-la-pantalla-y-no-se-pintaba.test.ts'],
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
    id: 'WS-09.motor', ws: 'WS-09', titulo: '¿Esta evidencia aplica a ESTE paciente?',
    estado: 'PARTIAL',
    queFalta: 'REG-387 lo creó con cuatro dimensiones —edad, embarazo, función renal y alergia—, en español e inglés, con `no_evaluable` que se cuenta y no se da por bueno. REG-427 encontró algo peor que las diez que faltaban: DOS de las cuatro que ya existían estaban MUERTAS. El único sitio que llama al motor sólo le pasaba edad y alergias, así que `embarazo` y `tfg` (con la vigencia de REG-375) no se rellenaban nunca y un ensayo que excluye embarazadas jamás decía nada sobre una paciente embarazada del expediente, teniendo el dato a un campo de distancia. Ahora llegan, la sospecha viaja como AUSENCIA (no como false) y la lectura del embarazo se mudó del copiloto a un módulo único — donde apareció que su comentario y su código no coincidían sobre el `diferencial`. DECIDIDO por el dueño el 31-ago-2026 (D-023, REG-443): el diferencial SÍ cuenta para avisar, y al medir antes de preguntar se vio que la pregunta sobreestimaba el alcance —los siete `contraindicado` avisan siempre y no dependían de ella; lo que mueve son los cuatro `evitar`. Se añadieron `comorbilidad` y `terapia_previa`, las dos ÚNICAS cuyo dato del paciente existe hoy. FALTAN OCHO —organismo, susceptibilidad, sitio de infección, dispositivo, interacción, severidad, entorno de atención, jurisdicción— y lo que falta es el DATO DEL PACIENTE, no el patrón: reservar campos vacíos es la promesa del modelo que REG-370/371 descartó. Organismo y susceptibilidad se desbloquean cuando el antibiograma llegue estructurado al cuadro; dispositivo, cuando exista WS-10.procedimientos-dispositivos; severidad, cuando haya una escala en consultorio.',
    artefactos: ['src/lib/evidencia/aplicabilidad.ts', 'src/lib/expediente/lo-que-el-expediente-dice-del-embarazo.ts'],
    pruebas: [
      'src/__tests__/la-evidencia-no-aplica-a-cualquiera.test.ts',
      'src/__tests__/el-motor-de-aplicabilidad-leia-mas-de-lo-que-le-llegaba.test.ts',
    ],
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
    id: 'WS-10.problemas-medicacion-alergias', ws: 'WS-10', titulo: 'Problemas, medicación y alergias con temporalidad y procedencia',
    estado: 'PARTIAL',
    queFalta: 'REG-405 dio a problemas y medicación el MISMO sobre que alergias ya tenía (asOf, version, historialRecortado). REG-431 cerró el último tramo: el sobre llegaba a las dos pantallas y las dos lo TIRABAN — la consulta se quedaba con `.vigentes` y `.problemas`, y el expediente lo devolvía del useMemo mientras la desestructuración lo dejaba fuera. Las dos escribían «de lo último que se dijo en sus notas firmadas», que afirma sobre el expediente ENTERO y sobre una ventana es falso. Ahora se pinta, pegado a esa frase, con una definición única que sustituye a las tres copias escritas a mano. FALTA la persistencia, y NO se hace a propósito: guardar una proyección sin decidir quién manda cuando el caché y las notas discrepan crea la segunda fuente de verdad que WS-10.proyeccion-no-es-segunda-verdad prohíbe. Falta también decir CUÁNTO se quedó fuera, que no se sabe: el productor sabe que truncó, no cuánto había.',
    artefactos: ['src/lib/expediente/problemas-activos.ts', 'src/lib/expediente/ordenes-medicamento.ts'],
    pruebas: [
      'src/__tests__/una-lista-no-dice-de-cuanto-historial-salio.test.ts',
      'src/__tests__/el-sobre-llegaba-a-la-puerta-y-se-tiraba.test.ts',
    ],
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
    estado: 'PROVEN',
    evidencia: 'REG-407 lo cerró en la consulta: selector de los CUATRO tipos en cada fila, con etiqueta accesible, bloqueado en nota firmada, y elegirlo marca tipoOrigen: medico — la única vía por la que un diagnóstico pasa a estar firmado por una persona. REG-421 corrigió el censo: esta entrada pedía «la misma elección en las otras superficies» y contra el árbol no se sostenía —hospital y UCI no tienen Diagnostico[] sino una cadena libre, y el expediente enseña notas ya FIRMADAS, donde un selector sería una segunda puerta de escritura—. Construirlo habría sido construir el defecto con el censo dando la orden. De paso apareció lo que sí estaba roto: la receta y la orden elegían el principal con `find(definitivo) ?? dxs[0]`, y ese respaldo no mira tipo, así que un «embarazo descartado» salía impreso como el motivo de la receta; ahora hay una sola puerta (diagnosticoQueSeImprime) que usa estaVigente y no rellena nada si nada califica. REG-444 cerró las DOS preguntas que quedaban, las dos del médico dueño: (D-025) firmar con diagnósticos tipados por el dictado AVISA y NO BLOQUEA —se descartaron bloquear la firma y bloquear sólo el que se imprime—, con guardián nuevo que cae si alguien lo convierte en bloqueo o si quita el aviso; y (D-026) `diagnosticoIngreso` de hospital/UCI SIGUE siendo cadena libre, DIFERIDO mientras Hospital sea ALPHA y no esté a la venta.',
    comando: 'npx vitest run src/__tests__/el-medico-elige-el-tipo-de-su-diagnostico.test.ts',
    resultado: '13 casos verdes. Probado al revés dos veces: convertir el aviso en bloqueo tira tres casos; quitarlo, uno.',
    artefactos: ['src/app/(dashboard)/consulta/[patientId]/page.tsx', 'src/lib/expediente/diagnostico-que-se-imprime.ts'],
    pruebas: ['src/__tests__/el-medico-elige-el-tipo-de-su-diagnostico.test.ts', 'src/__tests__/la-certeza-del-diagnostico-no-la-firma-un-modelo.test.ts'],
  }),

  /* ═══ WS-11 · Ciclo cerrado ═══════════════════════════════════════════════ */
  R({
    id: 'WS-11.estados-del-cierre', ws: 'WS-11', titulo: 'Decisión, acción y aviso al paciente son etapas distintas',
    estado: 'PARTIAL',
    queFalta: 'REG-360/361 dieron campo y formulario; REG-404 añadió `agendada` como estado VIVO — el pendiente de seguimiento se cerraba al crear la cita, así que agendar contaba como haber visto al paciente y un no-show no reabría nada. REG-437 cerró la primera de las tres que quedaban: `agendada` era una DECLARACIÓN que nadie podía contrastar, porque TareaClinica no tenía un campo que apuntara a la cita. Con la cita cancelada, movida o sin acudir el paciente, el pendiente se quedaba en `esperando_paciente` para siempre — no había a quién esperar. Ahora `cambiarEstado` EXIGE `citaId` al pasar a agendada (sólo en la transición nueva; inventarle una cita a las viejas sería fabricar el dato), el botón abre un elegidor de las citas futuras del paciente en vez de declarar, y la tarjeta dice qué pasó: la cita ya no está, el paciente no vino, o el paciente ya vino. Lectura por identificador y con tope, porque una ventana futura perdería justo los casos que importan. FALTA: (1) qué hacer con el no-show —cuánto se espera y si escala— que es política clínica y sin ese plazo no se puede poner `venceEn`; (2) el cierre sigue haciéndose sólo desde /pendientes; (3) el elegidor no se ha probado en un navegador: que el modal atrape el foco y se vea bien en móvil está sin comprobar y así queda dicho.',
    evidencia: 'REG-437. Probado al revés cuatro veces, una contra pasarse de frenada (si una cita ilegible se leyera como cancelada, cae el caso). Dos guardianes del propio repositorio dispararon con razón: el trinquete de conexión cazó `pidenAtencion`, un ayudante que escribí y que nadie llamaba —la misma familia que este bucle lleva la semana cerrando, cometida por mí—, y el guardián de REG-361 casaba con el ternario literal del botón: se actualizó a la forma nueva sin debilitarlo y se probó al revés.',
    comando: 'npx vitest run src/__tests__/agendada-era-una-declaracion-no-un-hecho.test.ts',
    resultado: '21 casos verdes.',
    artefactos: ['src/lib/tareas-clinicas/modelo.ts', 'src/lib/tareas-clinicas/lo-que-el-calendario-dice.ts'],
    pruebas: ['src/__tests__/agendada-era-una-declaracion-no-un-hecho.test.ts', 'src/__tests__/el-cierre-se-llena-no-se-adivina.test.ts'],
  }),
  R({
    id: 'WS-11.laboratorio', ws: 'WS-11', titulo: 'Un resultado de laboratorio de consultorio genera tarea de revisión',
    estado: 'PROVEN',
    evidencia: 'CORRECCIÓN DEL CENSO (REG-403): tres de los cuatro campos que esta entrada pedía YA EXISTÍAN, en el sitio correcto y con otro nombre — `revisado` es `estado: cerrada`, `revisadoPor` es `cerradaPor` y `revisadoEn` es `cerradaEn`. Ponerlos en el panel es lo que la arquitectura prohíbe y `laboratorio/firestore.ts` lo tiene escrito bajo el título «DÓNDE VIVE REVISADO»: crearía una segunda fuente de verdad del mismo hecho. Construirlos habría sido construir el defecto con el censo dando la orden. El cuarto sí faltaba y se cerró: nada registraba que un valor crítico se hubiera comunicado, así que «lo vi» y «localicé a alguien» eran el mismo gesto. REG-445 cerró las DOS preguntas que quedaban, las dos del médico dueño: (D-027) un crítico NO vence —se ofrecieron 1 h, 4 h, 24 h y ninguno—, así que la pregunta al cerrar es la única defensa y hay guardián que cae si alguien la quita; y (D-028) cuentan las cuatro vías, incluido un mensaje enviado, advertido de que puede morir sin acuse (REG-432/438). Se guarda CUÁL fue, en un campo que pregunta una sola cosa —de qué manera consta— para no repetir REG-418, y el progreso del resultado lo distingue: «(hablado)» / «(por mensaje)». El trinquete de conexión cazó que el lector quedaba sin llamador y se conectó ahí.',
    comando: 'npx vitest run src/__tests__/de-que-manera-consta-el-aviso-de-un-critico.test.ts',
    resultado: '16 casos verdes. Probado al revés cuatro veces.',
    artefactos: ['src/lib/tareas-clinicas/modelo.ts', 'src/lib/tareas-clinicas/progreso-resultado.ts'],
    pruebas: ['src/__tests__/de-que-manera-consta-el-aviso-de-un-critico.test.ts', 'src/__tests__/el-cierre-se-llena-no-se-adivina.test.ts'],
  }),
  R({
    id: 'WS-11.interconsultas-imagen', ws: 'WS-11', titulo: 'Interconsultas, referencias e imagen dentro del ciclo',
    estado: 'PARTIAL',
    queFalta: 'CERRADA LA INTERCONSULTA (REG-422). Vivía sólo en `Internamiento.interconsultas`, así que `tareasVivas`, `cabosDelPaciente` y `estadoDeAccion` no la veían: una pedida y no contestada era invisible fuera de una pestaña de un episodio. Misma fuga que REG-252. Lo que la desbloqueó: el id lo acuñaba el servidor dentro de la transacción y NO salía de ella —`agregarInterconsulta` devolvía cadena vacía—, así que no había a qué colgarle la tarea; ahora lo acuña quien pide, con `claveDeIntento` + `idIdempotente`, forma cerrada y validada en el servidor, que además reconoce el reintento y ya no duplica la interconsulta. La tarea se crea en la LIBRERÍA, única puerta, no en la pantalla. Contestar la deja `completada` y NO `cerrada` —el censo pedía cerrarla y el modelo lo prohíbe con razón: cerrar es que alguien LEYÓ la respuesta y decidió, y eso es del que la pidió—. FALTA, y las dos son del médico: (1) el PLAZO tras el cual una interconsulta sin contestar está vencida (especialidad, urgencia, acuerdo del hospital): sin él nace sin `venceEn` y `estaVencida` no opina, a propósito; (2) en QUÉ grupo del worklist se enseña — hoy cae en `otros` («Otros pendientes»), que es honesto: `esperando_resultado` mentiría (se espera a un colega, no a una máquina) y una categoría nueva sería modelo sin información, que REG-404 evitó. FALTAN TAMBIÉN, y son problemas aparte: la REFERENCIA sigue siendo sólo un impreso, y la IMAGEN no tiene entidad (modalidad, lateralidad, informe, comparación con previos) — aunque el ORDEN de imagen sí entra ya, porque `estudio_pendiente` cubre «laboratorio o gabinete». Todo esto es carril Hospital, ALPHA y no a la venta.',
    artefactos: ['src/lib/hospital/firestore.ts', 'src/lib/tareas-clinicas/derivar.ts', 'src/app/api/hospital/mutar/route.ts'],
    pruebas: ['src/__tests__/una-interconsulta-pedida-no-entraba-al-bucle.test.ts'],
  }),
  R({
    id: 'WS-11.sobrevive-a-la-navegacion', ws: 'WS-11', titulo: 'Un pendiente no desaparece porque el usuario cambió de pantalla',
    estado: 'PARTIAL',
    queFalta: 'CORRECCIÓN DEL CENSO (REG-428): esta entrada decía «el cierre de sesión lo limpia (lleva PHI)» y era FALSO. La purga borra por prefijo (`nx.consulta.bkp.`, `nx.uci.`) y el cajón se llama `nexusmed.pendientes-no-abiertos`: no casaba con ninguno, así que hasta 50 pendientes con patientNombre, título y detalle dentro se quedaban en el localStorage de un equipo compartido indefinidamente — y la cabecera del módulo aseguraba lo contrario. Cerrado drenando, no borrando: el cierre de sesión intenta crear las tareas mientras el token sirve (igual que la cola de auditoría), lo que entra desaparece del disco y lo que no se queda como el borrador. Nada se marca completado, así que no contradice a REG-390. FALTA, y es lo mismo que antes: NO cruza de dispositivo. Un pendiente perdido en el consultorio no aparece en el teléfono, y eso exige escribir en Firestore justo cuando se acaba de demostrar que no se puede escribir, o una cola con reintento que REG-390 reserva. Puede quedar PHI local —la que no se pudo salvar—, ahora dicho.',
    artefactos: ['src/lib/tareas-clinicas/abrir.ts', 'src/lib/salir-seguro.ts'],
    pruebas: [
      'src/__tests__/un-pendiente-perdido-no-muere-con-el-aviso.test.ts',
      'src/__tests__/el-cajon-de-pendientes-no-se-borraba-al-cerrar-sesion.test.ts',
    ],
  }),

  /* ═══ WS-12 · Evaluación y router ═════════════════════════════════════════ */
  R({
    id: 'WS-12.doce-preguntas', ws: 'WS-12', titulo: 'Las doce preguntas del paciente como compuerta permanente',
    estado: 'PARTIAL',
    queFalta: 'REG-362 creó la puerta (18 casos) y encontró un defecto vivo al correrla. REG-439 añadió la SEGUNDA de las cinco clases del §2 —ESCALATE_TO_CLINICIAN—, que es la única decidible sin el paquete aprobado ni un umbral del médico, y la que el §3 exige que viva en el servidor. Lo no clasificado cae a un SUELO que escala, y eso no es un invento: es el §1 y el §3 dichos en código. El bot escala de verdad (antes «cámbiame la receta» caía en el menú de citas y nadie escalaba) y le dice al paciente que no cambie nada por su cuenta mientras tanto. Al probar el orden al revés se destapó que el fixture no tenía NINGÚN caso que cruzara urgencia y escalación, así que el §6 no estaba vigilado; los dos que se añadieron destaparon a su vez un defecto del detector de urgencia: «me empezó a DOLER el pecho», «me está DOLIENDO el pecho» y «se me APRETÓ el pecho» NO se detectaban — la lista tenía dolor|duele|dolia. Arreglado, con el caso contrario («adolescente» contiene «dol») para que no se pase de frenada. FALTA: las TRES clases restantes, y cada una con lo suyo declarado — ANSWER_FROM_APPROVED_PLAN necesita el PatientVisitPackage liberado y el orden de fuentes del §1; EDUCATIONAL_EXPLANATION exige juzgar que la pregunta es genérica, que es modelo con umbral del médico; ADMINISTRATIVE_ACTION se podría intentar y NO se intenta a propósito, porque tomar una pregunta clínica por administrativa la saca del camino que la protege. Y la puerta sigue probando el SERVIDOR, no lo que el modelo redacta.',
    evidencia: 'REG-439. 44 casos verdes, 24 en el fixture. Probado al revés seis veces, dos de ellas contra pasarse de frenada.',
    comando: 'npx vitest run src/__tests__/las-doce-preguntas-del-paciente.test.ts',
    resultado: '44 casos verdes.',
    artefactos: ['evals/patient-ai/casos.json', 'src/lib/paciente/urgencia.ts', 'src/lib/paciente/hay-que-escalar.ts'],
    pruebas: ['src/__tests__/las-doce-preguntas-del-paciente.test.ts'],
  }),
  R({
    id: 'WS-12.entailment', ws: 'WS-12', titulo: 'Entailment: la cita sostiene la afirmación, no sólo la contiene',
    estado: 'PARTIAL',
    queFalta: 'REG-400 cerró de qué PARTE del artículo sale el pasaje: una cita de los antecedentes ya no se lee como una conclusión. REG-429 cerró las dos comprobaciones deterministas que quedaban — POLARIDAD (el pasaje niega lo que la frase afirma) y MATIZ (el pasaje lo dice con reservas que la frase quitó) —, que pasaban sin marca porque el anclaje pregunta si el texto EXISTE, no si dice lo mismo. Se exigen tres cosas a la vez para no marcar de más, y midiendo aparecieron dos defectos invisibles leyendo: «redujo» no contiene la raíz «reduc» (pretérito irregular, y el español es el idioma del producto) y «super» casaba con «supervivencia», que es un sustantivo. FALTA, y necesita al dueño: el evaluador de entailment propiamente dicho —juzgar si el pasaje SIGNIFICA lo que la afirmación dice— exige un modelo, su conjunto de referencia y un UMBRAL que fija el médico (declarado en ia/contratos-de-evaluacion.ts). Falta también la MAGNITUD: «redujo un 2 %» citado como «redujo» no es inversión ni atenuación y puede engañar igual.',
    artefactos: ['src/lib/evidencia/lo-que-el-pasaje-no-dijo.ts', 'src/lib/evidencia/verificar-la-cita.ts'],
    pruebas: [
      'src/__tests__/una-cita-que-no-dice-eso-ya-no-pasa.test.ts',
      'src/__tests__/el-pasaje-esta-y-dice-lo-contrario.test.ts',
    ],
  }),
  R({
    id: 'WS-12.contratos-de-evaluacion', ws: 'WS-12', titulo: 'Cada capacidad de IA con dataset, métrica, umbral y política de fallo',
    estado: 'PARTIAL',
    queFalta: 'REG-399 creó el contrato: 17 capacidades, cada una con qué decide, QUÉ CUESTA QUE SE EQUIVOQUE, su conjunto (o qué haría falta para que existiera), su métrica y su política de fallo. Un guardián compara el censo contra los `feature` del árbol y el censo se aplica también en ejecución. REG-446: el dueño fijó el PRIMERO el 31-ago-2026 (D-029), el de `nota-consulta`, y lo fijó con DOS ejes porque sus errores no cuestan lo mismo — pérdida ≤ 1 %, alucinación 0 %: un medicamento perdido se nota al leer la nota, uno añadido sale impreso con cédula y nadie lo busca. El tipo `UmbralDecidido` sólo llevaba un número; ahora lleva ejes, con `valor` en el más LAXO a propósito para que quien lea sólo ese campo no se lleve mejor impresión que la real. El guardián se amplió sin bajarlo: un umbral decidido sale de una regla escrita O de una decisión FECHADA del médico, y de ninguna tercera cosa. Falta lo que NO se puede hacer sin el dueño y no se inventó: 14 de los 17 UMBRALES los tiene que fijar un médico —cuánta pérdida de medicamentos es tolerable al extraer una nota es una cifra clínica, y la regla 1 prohíbe inventarlas—. Falta también construir los conjuntos: la mayoría no existe, y el de voz no puede nacer de audio real porque la voz es biométrica. Y la política de fallo se DECLARA; sólo una está comprobada en el código. REG-447 cerró la otra mitad de D-029: el umbral estaba escrito y NO REPROBABA NADA — el arnés medía por un lado, el número vivía por otro y entre los dos no había una función. `aplicarUmbral()` toma el umbral DEL CONTRATO (no una copia; probado con un 50 % armado en la prueba) y da veredicto sobre el corpus oro; vive DENTRO de `ia/evaluacion.ts` porque un arnés que mide y no compara contra el umbral está a medias, y porque los dos trinquetes de conexión rechazaron un módulo aparte —el techo de módulos fuera del camino sólo baja—. Tres huecos que un descuido leería como verde no lo son: umbral pendiente, conjunto VACÍO (sin la guarda, la forma más fácil de estar en verde sería borrar el corpus) y un eje que el arnés no sabe medir; `esVerde()` es el único sitio donde se define verde. Y lo que hay que decir: el 1 % NO se está ejerciendo — con 4 campos esperados el escalón mínimo medible es 25 %, así que hoy la compuerta se comporta como un cero (más estricto, no más laxo) y cada lectura lo declara. Ejercerlo pide ≥ 100 campos esperados, y ese conjunto no existe. REG-448 fijó el SEGUNDO umbral (D-030), el de `transcribir`, con TRES ejes que no se suman: los dos ceros —críticos y sin clasificar— NO los decidió el dueño, salen de `politica-critica.ts` (prohibido, no penalizado); el tercero sí, con la medición delante: error ordinario ≤ 5 %. Y corrigió el censo: el contrato decía «no existe gold de voz… todavía no está» y SÍ EXISTE — `synthetic-data/dialogos-consulta`, 12 diálogos actuados con guion y salida real (novena entrada del censo vieja al ir a construir sobre ella). Medido: 532 palabras, WER crudo 10 % pero normalizado 1,7 %, 5 ordinarios, 0 sin clasificar y 1 CRÍTICO REAL — DLG-004: el motor se comió «Van dos veces este mes» y perdió la cifra y quién la dijo. El dueño eligió trinquete (sellado en 1, sólo baja) en vez de CI rojo; el defecto NO se tapa: queda con nombre en `EL_CRITICO_QUE_SIGUE_ABIERTO` con guardián que cae si se borra, y sigue ABIERTO. La compuerta se mudó a `contratos-de-evaluacion.ts` porque el segundo arnés la necesitaba: dos medidores, un solo tipo `Umbral`, una sola definición de verde. REG-449 fijó el TERCERO (D-031), el de `laboratorio-vision`: valor mal leído 0, unidad mal leída 0, analito perdido ≤ 5 %. Se escribieron 8 hojas sintéticas (`synthetic-data/laboratorio-hojas`) como se imprimen en México y se midió antes de preguntar: 7 de 46 filas no llegan al panel — 15,2 % contra el techo del 5 %, o sea ROJO. La causa NO es la visión: SEIS de las siete son cobertura del catálogo (ácido úrico, neutrófilos, linfocitos, VCM, vitamina D, ferritina; `analitos.ts` cubre 24 y una hoja de rutina trae más), y la séptima es glucosa en mmol/L, que el rango plausible tira entera — el paciente cuyo laboratorio reporte en unidades del SI se queda sin serie de glucosa y nadie se lo dice. Trinquete sellado en 7 con el patrón de D-030: no da por bueno el hueco, la compuerta sigue diciendo `reprueba`. Bajarlo pide añadir analitos con su rango plausible, y ese rango es una cifra que no se inventa: es la siguiente decisión del dueño. Lo que este conjunto NO mide queda declarado: las filas entran perfectas, así que DOS de los tres ejes salen cero por construcción y sólo se ejercen al revés; medir la visión pide imágenes y llamadas de API, la mitad que el dueño dejó para después. Tampoco se le preguntó cuántos analitos INVENTADOS se toleran: se cuenta, se reporta y queda NEEDS_CLINICAL_REVIEW. REG-450 cerró ese rojo POR LA CAUSA, no por el umbral: el dueño entregó su catálogo maestro de plausibilidad (D-032, ~200 analitos, íntegro en `docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md`) y entraron OCHO analitos con SUS números, citados y sin banda de referencia (su §1: el intervalo de referencia lo pone el laboratorio). 15,2 % → 2,2 %, verde. Su §25.2 destapó un defecto que yo iba a cometer: «Neutrófilos 75 %» y «Neutrófilos 7,5 ×10³/µL» son resultados distintos con el MISMO nombre impreso, así que mapear por nombre habría metido el 75 en la serie del absoluto — no un analito perdido sino un VALOR MAL LEÍDO, el eje que él puso en cero. El rango plausible no lo habría cazado (75 cabe en 0–500). Ahora la unidad desambigua y sin unidad NO se adivina. Falta, y es de él: cargar el catálogo entero (~200 analitos), adoptar sus rangos ENSANCHADOS —que sin normalización de unidad haría pasar 7,2 mmol/L como 7,2 mg/dL, con guardián que lo impide— y la arquitectura de sus §25-§36 (LOINC, UCUM, valor original + canónico, doce estados). REG-451 aplicó su §27 y §28: primero se normaliza la unidad, DESPUÉS se juzga el número, y la fila fuera de rango YA NO SE TIRA — se acepta provisionalmente y se marca (su §1), conservando valor y unidad originales (§27.1). Destapó un defecto que nadie había mirado: PCR 84 mg/dL entraba a la serie como 84 mg/L —son 840— y el límite de plausibilidad NO puede cazarlo porque 84 cabe de sobra en 0–600. Una PCR de sepsis dibujada como un resfriado, sin una marca. Sólo hay DOS conversiones y es a propósito: un factor es una equivalencia y la regla 1 las nombra. Vitamina D (§6, literal) y creatinina (§27.1, del ejemplo trabajado). La de la glucosa NO está —18,0182 se sabe de memoria y por eso mismo no se escribe sin fuente— y queda en `CONVERSIONES_QUE_FALTAN`. Y el estado LLEGA a la pantalla: el ámbar se enciende con el estado y no sólo con `noEvaluable` (una ferritina de 2 000 000 en unidad correcta no lo encendía), con el motivo como texto visible y no en un `title` (REG-433). El número cambió de significado, así que ahora son dos: fuera del panel 0 de 46, y SIN GRÁFICA 2 —glucosa y PCR, las dos por falta de factor— con su propio trinquete. REG-452 aplicó su §29: ante un valor imposible se evalúan ×10 ÷10 ×100 ÷100 ×1000 ÷1000 y se SUGIERE revisión, sin tocar el valor y sin botón que lo aplique — el campo ya es editable y la corrección la hace el médico. La mitad del trabajo fue lo que NO se hace: la sugerencia sólo se ofrece con la unidad canónica, porque glucosa 7,2 mmol/L × 10 da 72 —plausible en mg/dL y MAL, son 130—, y una respuesta verosímil a la pregunta equivocada se acepta sin mirar. Con varios candidatos se enseñan todos: en creatinina 120 el «bonito» (1,2) es justo el que puede estar mal si venía en µmol/L (1,36). Sigue sin cubrirse el error de captura que ES plausible (140 tecleado como 145) y el salto imposible respecto del valor previo del paciente. Falta: `MISSING_UNIT` (§33) y LOINC/UCUM (§27.2-3). Quedan 12 umbrales por fijar.',
    artefactos: ['src/lib/ia/contratos-de-evaluacion.ts'],
    pruebas: ['src/__tests__/cada-capacidad-de-ia-tiene-su-contrato.test.ts'],
  }),
  R({
    id: 'WS-12.router', ws: 'WS-12', titulo: 'El médico expresa intención clínica, no elige marca de modelo',
    estado: 'PARTIAL',
    queFalta: 'REG-436 cerró la mitad que pedía esta entrada. El RESPALDO ante caída ya estaba bien y se confirmó: si /v1/models no contesta se usa candidatos[0] —el modelo de arriba— y el 404 redescubre. Lo que degradaba en silencio era la elección cuando la lista SÍ llega: `?? ids[0]` se quedaba con el primer modelo que la cuenta tuviera, que para el perfil premium —la nota que el dueño decidió que no escatima— puede ser Haiku; el modelo viajaba como procedencia y nadie lo comparaba con lo pedido. Y la elección se cacheaba por instancia, así que un último recurso escogido durante una caída parcial quedaba clavado para todas las notas de esa instancia caliente. Cerrado SIN cambiar qué modelo se elige (eso es producto, no limpieza): la decisión se mudó a un módulo puro que dice CÓMO se llegó a él, una degradación no se cachea, y el aviso llega hasta la pantalla como texto visible. DECIDIDO por el dueño el 31-ago-2026 (D-024, REG-443): la nota se genera con lo que haya y se marca; no se niega. La conducta no cambia — deja de regir por conservación y pasa a regir por decisión, que no es lo mismo aunque el código sea idéntico. FALTA: (2) comprobar que el modelo elegido SE COMPORTE como el pedido, que es calidad y no identificadores, y necesita los conjuntos de WS-12.contratos-de-evaluacion; (3) los otros consumidores de IA —consultor, copiloto de UCI, transcripción— eligen su modelo por su cuenta y no pasan por aquí.',
    evidencia: 'REG-436. Medido antes y después: el modelo elegido es idéntico en los cinco casos. Probado al revés cuatro veces, una contra pasarse de frenada (marcar el respaldo de familia en un perfil que ya pedía esa familia tira un caso).',
    comando: 'npx vitest run src/__tests__/el-router-bajaba-de-modelo-sin-avisar.test.ts',
    resultado: '19 casos verdes.',
    artefactos: ['src/lib/planes-ia.ts', 'src/lib/ia/que-modelo-se-eligio.ts'],
    pruebas: ['src/__tests__/el-router-bajaba-de-modelo-sin-avisar.test.ts'],
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
    queFalta: 'REG-420 cerró los errores del navegador (un reporte no es una avería; dos personas distintas con el mismo error, sí) y REG-430 las ANOMALÍAS DE AUTORIZACIÓN, que sólo vivían en un log de servidor —y un log hay que ir a buscarlo sabiendo ya lo que se busca—. La frontera no es un número inventado: una denegación es el sistema funcionando; el MISMO usuario rebotado en DOS consultorios distintos es alguien probando dónde entra, y bastan dos porque el segundo ya no tiene explicación inocente. La insistencia se cuenta por capacidad, no en total. La colección va declarada en los tres sitios y cerrada al cliente por las dos puntas. FALTA: (1) los 5xx genéricos del servidor — medir el error de toda ruta HTTP exige instrumentar el borde y decidir dónde viven esas métricas, LA MISMA infraestructura que WS-12.p99 deja abierta, así que son el mismo bloqueo; (2) el CANAL sigue sin destino: OPS_ALERTA_WEBHOOK es acción del dueño y sin él enviarAlertaOps lo declara y no marca nada como avisado, que es lo correcto; (3) desplegar firestore.rules es acción del dueño — la escritura ya funciona por Admin SDK, lo que espera es el cierre de la lectura desde el cliente.',
    artefactos: ['src/lib/ops/lo-que-se-repite.ts', 'src/lib/ops/lo-que-no-deberia-pasar.ts'],
    pruebas: [
      'src/__tests__/un-error-es-un-reporte-dos-son-una-averia.test.ts',
      'src/__tests__/una-denegacion-no-es-una-anomalia-dos-consultorios-si.test.ts',
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
    id: 'TR-WHATSAPP.entrega', ws: 'TR-WHATSAPP', titulo: 'Lo encolado llega, y lo que no, se ve y se puede reintentar',
    estado: 'PARTIAL',
    queFalta: 'REG-391 puso el interruptor y REG-397 el instrumento (el vigilante cuenta pausadas y rendidas y las distingue). REG-432 cerró la pantalla del dead-letter: contar era el primer paso y no el trabajo — con un número no se ve de qué paciente era, ni qué decía, ni por qué murió, ni se puede reintentar. Ahora se listan y se pueden devolver a la cola, con la MISMA puerta que /entregas (`mensajeria.enviar`) y avisando ANTES del botón de que reintentar puede DUPLICAR el mensaje: desde la cola no se distingue si no llegó nunca o si llegó y se perdió el acuse. Los intentos se reinician y las pausas se conservan, porque cuentan cosas distintas. CORRECCIÓN DEL CENSO (REG-438): esta entrada decía que el mensaje REACTIVO del bot «se pierde y no queda en ninguna cola». Que no se encole es una DECISIÓN argumentada —reintentar fuera de la ventana de 24 h exige plantilla aprobada en Meta, trámite del dueño— y sí quedaba constancia: `registrarNoEntregado` escribe desde el helper `send()`, que cubre sus 36 llamadas. El defecto real era peor: `whatsapp_no_entregados` tenía UN ESCRITOR Y CERO LECTORES. Declarada en los tres sitios, respaldada, cerrada al cliente… e invisible, mientras la cabecera del módulo prometía que «un fallo registrado se puede VER». Y REG-432 había puesto una pantalla llamada «No entregados» que, con la cola limpia y el bot fallando, afirmaba que no se había perdido nada. Cerrado: lector con tope que LANZA en vez de devolver [], las dos listas por la misma ruta y la misma capacidad, los del bot SIN botón (no se pueden reintentar, y prometerlo haría que el médico dejara de llamar), y «ninguno» ahora exige que las dos estén vacías. FALTA: (1) encolar y reintentar de verdad, que espera la plantilla aprobada del dueño; (2) una clave de idempotencia de punta a punta con el proveedor, que es la única defensa REAL contra el duplicado (hoy la defensa es que lo decida una persona informada); (3) archivar o descartar lo que el médico decida no reintentar.',
    artefactos: ['src/lib/whatsapp/outbox.ts', 'src/app/api/whatsapp/no-entregados/route.ts'],
    pruebas: [
      'src/__tests__/una-caida-de-whatsapp-no-mata-la-cola.test.ts',
      'src/__tests__/un-numero-de-mensajes-muertos-no-deja-hacer-nada.test.ts',
    ],
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
    queFalta: 'REG-383 siembra 50 000 pacientes CON tres notas firmadas cada uno (200 300 documentos) y comprueba que navegar no escala con la historia total. REG-440 cerró la distribución: el generador daba a TODOS exactamente los mismos encuentros y nada más, así que el p99 de una consulta era la mediana y el fixture escondía justo el caso que duele, el expediente largo. Ahora hay cola larga, medicamentos con vacío y polifarmacia, y laboratorios y órdenes que NO salen en todos los encuentros —la mitad del coste de navegar un expediente está en los que no tienen nada—. Los pesos se declaran como CARGA y no como epidemiología: nadie los ha medido contra una práctica real, y escribir «el 45 % acude una sola vez» sin fuente es la regla 1 aplicada a un arnés. Los laboratorios no llevan analito ni valor y los medicamentos no llevan fármaco, por lo mismo. La normalización se comprueba en el código (la primera versión daba 1.178: un 18 % más carga de la pedida, en silencio) y el esquema sube a v2 porque una corrida nueva no se compara con una vieja. FALTA: validar los pesos contra una práctica real, que necesita al dueño o un consultorio piloto; y correr el arnés con esta forma nueva en el emulador, que es la mitad que mide el producto y no el fixture.',
    evidencia: 'REG-440. 21 casos verdes. El golden se cazó a sí mismo dos veces: los primeros casos probaban los módulos por separado y NO caían al desconectar la distribución del generador —la familia «escrito, probado y sin conectar» dentro de su propio golden—, y los guardianes de «no traen analito ni valor» casaban con los comentarios que explican por qué no están.',
    comando: 'npx vitest run src/__tests__/el-arnes-daba-a-todos-los-pacientes-la-misma-historia.test.ts',
    resultado: '21 casos verdes. Probado al revés cinco veces.',
    artefactos: ['scripts/product/generate-consultorio-load-fixture.mjs'],
    pruebas: ['src/__tests__/el-arnes-daba-a-todos-los-pacientes-la-misma-historia.test.ts', 'src/__tests__/el-arnes-de-carga-no-inventa-un-cero.test.ts'],
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
