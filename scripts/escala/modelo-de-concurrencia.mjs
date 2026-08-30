/**
 * WS-02 — EL MODELO QUE CONVIERTE «100 000 USUARIOS» EN UN EXPERIMENTO.
 *
 * ── QUÉ FALTABA ─────────────────────────────────────────────────────────────
 *
 * El censo lo decía así: «No hay modelo de carga que diga cuántos de N
 * registrados están en consulta a la vez, ni con qué mezcla de operaciones. Sin
 * eso, «100 k» no nombra ningún experimento.»
 *
 * Y era literal. `run-consultorio-load.mjs` pide `--tenants`,
 * `--physicians-per-tenant` y `--concurrent`: tres números que hay que inventarse
 * a mano cada vez. Nadie podía decir si la corrida de 100 médicos correspondía a
 * 2 000 registrados o a 100 000, porque **no existía la función que traduce**.
 *
 * ── LA CONFUSIÓN QUE ESTE ARCHIVO EXISTE PARA IMPEDIR ───────────────────────
 *
 * «Usuarios registrados» es un **inventario**: no tiene ventana de tiempo.
 * «Sesiones concurrentes» es una **foto**: sólo significa algo con un instante
 * pegado. Y «peticiones concurrentes» no es ninguna de las dos, sino el producto
 * de un caudal por un tiempo de servicio.
 *
 * Mezclarlas es el modo clásico de decir un número grande sin haber medido nada:
 * se anuncia «soporta 100 000 usuarios» y se ha probado un caudal que 300 habrían
 * producido. Por eso los ocho conceptos de abajo llevan **`ventana`** y llevan
 * **`noCuenta`**: lo que un número NO afirma es la mitad de lo que significa.
 *
 * ── LOS SUPUESTOS SON SUPUESTOS, Y LO DICEN ─────────────────────────────────
 *
 * Cuántos de los registrados están en consulta al mismo tiempo **no se sabe**:
 * este producto no tiene todavía telemetría de la que sacarlo. Así que cada razón
 * de este archivo lleva `medidoEn: null` y una `base` que dice de dónde sale la
 * suposición.
 *
 * Eso NO los convierte en cifras inventadas del tipo que el charter prohíbe —una
 * dosis, un umbral clínico—, y la diferencia importa: un supuesto de carga
 * declarado sirve para **nombrar un experimento** («esto es lo que voy a
 * provocar»), no para afirmar un hecho sobre el paciente. Lo que sí sería
 * inventar es lo de abajo:
 *
 * ── LOS OBJETIVOS NO SE INVENTAN ────────────────────────────────────────────
 *
 * Qué p95 es aceptable, qué tasa de error se tolera y a partir de cuándo un
 * escenario «pasa» son **decisiones del dueño**, igual que el validador declara
 * («does not invent or approve capacity/SLO thresholds»). Van con
 * `PENDIENTE_DEL_DUENO` y no con un número plausible.
 *
 * Un umbral plausible es peor que ninguno: convierte una corrida en un aprobado
 * que nadie firmó.
 *
 * ── LO MEDIDO VA EN NULL HASTA QUE SE MIDA ──────────────────────────────────
 *
 * Throughput, error rate, timeout rate, percentiles, operaciones de Firestore,
 * profundidad de cola y salud del proveedor son **salidas de la corrida**, no
 * entradas del escenario. El escenario declara la casilla y su unidad; el arnés
 * la rellena o escribe `null`, que es la misma disciplina de REG-378.
 */

export const VERSION_DEL_MODELO = 1

/** Lo que decide el dueño y este archivo no rellena. */
export const PENDIENTE_DEL_DUENO = 'NEEDS_OWNER_DECISION'

/* ── 1 · los ocho conceptos, cada uno con su ventana y con lo que NO cuenta ── */

/**
 * `ventana: null` marca un inventario (un stock). Todo lo demás es una foto o un
 * caudal, y sin ventana no significa nada.
 *
 * `noCuenta` no es prosa de adorno: es la frase que impide que dos filas de esta
 * tabla se usen como sinónimos en una diapositiva.
 */
export const CONCEPTOS = Object.freeze([
  {
    id: 'usuarios_registrados',
    nombre: 'Usuarios registrados',
    unidad: 'cuentas',
    ventana: null,
    cuenta: 'Cuentas dadas de alta en la plataforma: médicos, recepción y personal del consultorio.',
    noCuenta: 'No cuenta pacientes, y no dice cuántas de esas cuentas se usaron nunca. Es un inventario, no una carga.',
    comoSeObtiene: 'declarado',
  },
  {
    id: 'usuarios_activos',
    nombre: 'Usuarios activos',
    unidad: 'cuentas',
    ventana: '1 día',
    cuenta: 'Cuentas que abrieron el producto y tocaron algo en la ventana.',
    noCuenta: 'No cuenta a los que estaban dentro a la vez: repartidos en el día pueden no haberse cruzado nunca.',
    comoSeObtiene: 'derivado',
  },
  {
    id: 'sesiones_activas_concurrentes',
    nombre: 'Sesiones activas concurrentes',
    unidad: 'sesiones',
    ventana: '1 minuto (el minuto pico)',
    cuenta: 'Sesiones con trabajo clínico abierto en el mismo instante: la consulta que está ocurriendo.',
    noCuenta: 'No cuenta la pestaña abierta y olvidada, que no produce peticiones. Una sesión ociosa no es carga.',
    comoSeObtiene: 'derivado',
  },
  {
    id: 'peticiones_concurrentes',
    nombre: 'Peticiones concurrentes',
    unidad: 'peticiones en vuelo',
    ventana: 'instantánea',
    cuenta: 'Peticiones esperando respuesta a la vez. Por Little: caudal × tiempo de servicio.',
    noCuenta: 'No es el número de sesiones. Una sesión con una petición cada 8 s aporta muy poco a esta cifra, y ahí es donde «100 000 usuarios» se desinfla.',
    comoSeObtiene: 'medido',
  },
  {
    id: 'concurrencia_por_consultorio',
    nombre: 'Concurrencia por consultorio (tenant)',
    unidad: 'sesiones por consultorio',
    ventana: '1 minuto (el minuto pico)',
    cuenta: 'Sesiones simultáneas dentro de un mismo `clinicId`. Es el eje que decide la contención sobre los MISMOS documentos.',
    noCuenta: 'No se reparte uniformemente: el promedio esconde al consultorio grande, que es el que rompe primero.',
    comoSeObtiene: 'derivado',
  },
  {
    id: 'concurrencia_por_medico',
    nombre: 'Concurrencia por médico',
    unidad: 'sesiones por médico',
    ventana: 'instantánea',
    cuenta: 'El mismo médico con varias sesiones vivas: consultorio y teléfono, o dos pestañas.',
    noCuenta: 'No es «pacientes por médico» (eso es WS-03) ni consultas al día. Es de cuántos sitios escribe la misma persona a la vez, que es de donde salen los conflictos de escritura sobre una nota.',
    comoSeObtiene: 'declarado',
  },
  {
    id: 'concurrencia_en_rafaga',
    nombre: 'Concurrencia en ráfaga (burst)',
    unidad: 'sesiones',
    ventana: '≤ 5 minutos',
    cuenta: 'El pico corto: el arranque de la mañana, la vuelta tras la comida, el reintento en masa cuando un proveedor vuelve.',
    noCuenta: 'No se sostiene. Dimensionar el sistema entero para la ráfaga es pagar de más; ignorarla es caerse a las 9:00.',
    comoSeObtiene: 'derivado',
  },
  {
    id: 'concurrencia_sostenida',
    nombre: 'Concurrencia sostenida',
    unidad: 'sesiones',
    ventana: '≥ 60 minutos',
    cuenta: 'El nivel que se mantiene durante la hora pico. Es contra el que se dimensionan cuotas, índices y presupuesto.',
    noCuenta: 'No es el máximo observado. Un pico de un minuto no es carga sostenida, y presentarlo como tal infla el número por el factor de ráfaga.',
    comoSeObtiene: 'derivado',
  },
])

export const idsDeConceptos = () => CONCEPTOS.map(c => c.id)

/* ── 2 · los supuestos: declarados, sin medir, y dicen de dónde salen ─────── */

/**
 * Ninguno está medido. Cuando exista telemetría, `medidoEn` deja de ser `null` y
 * los escenarios cambian solos — que es la razón de que las razones vivan aquí y
 * no repartidas por siete perfiles escritos a mano.
 */
export const SUPUESTOS = Object.freeze([
  {
    id: 'medicosDeLosRegistrados', valor: 0.55, unidad: 'fracción',
    base: 'Una cuenta de consultorio típica es un médico más recepción; no toda cuenta registrada abre consulta.',
    medidoEn: null,
  },
  {
    id: 'activosEnElDia', valor: 0.45, unidad: 'fracción de los médicos',
    base: 'Consulta privada: no se pasa consulta todos los días, y hay vacaciones, quirófano y hospital.',
    medidoEn: null,
  },
  {
    id: 'enConsultaALaVez', valor: 0.12, unidad: 'fracción de los activos del día',
    base: 'Jornada repartida en mañana y tarde con hora pico: en el minuto pico está en consulta una minoría de quien consulta ese día.',
    medidoEn: null,
  },
  {
    id: 'medicosPorConsultorio', valor: 2, unidad: 'médicos',
    base: 'El producto se vende a médico independiente y consultorio pequeño (CLAUDE.md, «Practice»).',
    medidoEn: null,
  },
  {
    id: 'sesionesPorMedico', valor: 1.3, unidad: 'sesiones',
    base: 'Escritorio del consultorio más teléfono; la segunda sesión existe pero no siempre está trabajando.',
    medidoEn: null,
  },
  {
    id: 'consultasPorMedicoDia', valor: 18, unidad: 'consultas',
    base: 'Agenda de consulta externa llena, en franjas de 20 minutos.',
    medidoEn: null,
  },
  {
    id: 'duracionConsultaSegundos', valor: 20 * 60, unidad: 'segundos',
    base: 'La franja de agenda que el producto usa por omisión.',
    medidoEn: null,
  },
  {
    id: 'factorDeRafaga', valor: 3, unidad: 'multiplicador',
    base: 'El arranque de la mañana concentra citas en pocos minutos; el reintento en masa tras un proveedor caído es del mismo orden.',
    medidoEn: null,
  },
])

const S = Object.fromEntries(SUPUESTOS.map(s => [s.id, s.valor]))

/* ── 3 · la mezcla de operaciones de UNA consulta ─────────────────────────── */

/**
 * De aquí salen el read/write ratio, las llamadas a IA/Evidence y el presupuesto
 * de operaciones de Firestore. Es el «con qué mezcla de operaciones» que el censo
 * echaba en falta, y sin él dos corridas con el mismo número de sesiones miden
 * cosas distintas.
 *
 * `caminoDelArnes` marca lo que `run-consultorio-load.mjs` HACE HOY. Lo que no lo
 * lleva, el arnés no lo provoca — y la corrida tiene que decirlo en vez de dejar
 * creer que midió la consulta entera.
 */
export const MEZCLA_DE_OPERACIONES = Object.freeze([
  { op: 'abrir el expediente', clase: 'lectura', porConsulta: 4, caminoDelArnes: true },
  { op: 'listar la página de pacientes', clase: 'lectura', porConsulta: 1, caminoDelArnes: true },
  { op: 'releer la nota antes de firmar', clase: 'lectura', porConsulta: 1, caminoDelArnes: true },
  { op: 'guardar el borrador', clase: 'escritura', porConsulta: 8, caminoDelArnes: false },
  { op: 'alta del paciente y de la nota', clase: 'escritura', porConsulta: 2, caminoDelArnes: true },
  { op: 'firmar la nota', clase: 'escritura', porConsulta: 1, caminoDelArnes: true },
  { op: 'receta u orden', clase: 'escritura', porConsulta: 1, caminoDelArnes: false },
  { op: 'transcribir el dictado', clase: 'ia', porConsulta: 1, caminoDelArnes: false },
  { op: 'redactar la nota', clase: 'ia', porConsulta: 1, caminoDelArnes: false },
  { op: 'consultar evidencia', clase: 'evidencia', porConsulta: 0.3, caminoDelArnes: false },
])

const suma = (clase, soloArnes = false) => MEZCLA_DE_OPERACIONES
  .filter(o => o.clase === clase && (!soloArnes || o.caminoDelArnes))
  .reduce((a, o) => a + o.porConsulta, 0)

export const PETICIONES_POR_CONSULTA = Object.freeze({
  lecturas: suma('lectura'),
  escrituras: suma('escritura'),
  ia: suma('ia'),
  evidencia: suma('evidencia'),
  get total() { return this.lecturas + this.escrituras + this.ia + this.evidencia },
  /** Lo que el arnés provoca hoy: ni una operación más. */
  enElArnes: suma('lectura', true) + suma('escritura', true),
})

/* ── 4 · las casillas que rellena la corrida, y sus umbrales sin decidir ──── */

/**
 * Cada una es una SALIDA. El escenario declara la casilla y su unidad; quien
 * corre la rellena o escribe `null`. El umbral de aceptación es del dueño.
 */
export const LO_QUE_MIDE_LA_CORRIDA = Object.freeze([
  { campo: 'throughput', unidad: 'peticiones/s', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'errorRate', unidad: 'fracción', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'timeoutRate', unidad: 'fracción', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'latencyMs.p50', unidad: 'ms', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'latencyMs.p95', unidad: 'ms', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'latencyMs.p99', unidad: 'ms', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'firestoreOps', unidad: 'operaciones', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'queues', unidad: 'profundidad, reintentos, duplicados', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'backpressureRejections', unidad: 'peticiones rechazadas al admitir', umbral: PENDIENTE_DEL_DUENO },
  { campo: 'providerHealth', unidad: 'circuitos abiertos y fallos por proveedor', umbral: PENDIENTE_DEL_DUENO },
])

/* ── 5 · dónde se puede correr cada escenario ─────────────────────────────── */

/**
 * COTAS DEL ENTORNO LOCAL — MEDIDAS, Y LA MEDICIÓN CAMBIÓ LA COTA.
 *
 * La primera versión de este archivo puso `sesiones: 200` a ojo. Al medirlo
 * salieron dos cosas que no se habrían adivinado:
 *
 *   · **400 sesiones simultáneas aguantan** — 3 200 peticiones, cero errores. La
 *     cota supuesta se quedaba corta a la mitad.
 *   · Y sin embargo **el caudal no subió**: 221 pet/s con 200 sesiones y 220 con
 *     400. Lo único que creció fue la espera (p50 460 → 1 042 ms, p95 2 320 →
 *     4 542 ms).
 *
 * Es decir: la cota del entorno local **no es un número de sesiones**, es una
 * meseta de caudal. Añadir sesiones por encima de ella no mide más carga; mide
 * cola. Un arnés que no lo supiera reportaría «aguantó 400 sesiones» como si
 * fuera el doble de trabajo que 200, cuando es el mismo trabajo esperando más.
 *
 * `documentosResidentes` no se midió aquí: se toma de WS-03, que sí llevó el
 * emulador a 50 000 pacientes y dejó actas. Más allá de eso nadie ha mirado, y
 * por eso la cota es 50 000 y no un número mayor que sonaría mejor.
 */
export const COTAS_LOCALES = Object.freeze({
  sesiones: 400,
  throughputReqS: 220,
  documentosResidentes: 50_000,
  medidoEn: Object.freeze([
    'docs/audit/ws-02-carga/cota-local-200-sesiones.json',
    'docs/audit/ws-02-carga/cota-local-400-sesiones.json',
    'docs/audit/ws-03-consultorio-grande/lecturas-50000.json',
  ]),
  porQue: 'Una app de cliente por sesión concurrente (con su canal gRPC) contra un emulador de Firestore de un solo proceso, que guarda los documentos en memoria.',
  laMeseta: 'De 200 a 400 sesiones el caudal se queda en ~220 pet/s y la latencia se dobla. Por encima de la meseta se mide cola, no carga.',
})

/**
 * LA SEPARACIÓN QUE HACE EJECUTABLE LA MITAD DE WS-02.
 *
 * No hacen falta N sesiones para representar N registrados. Un registrado que no
 * está en consulta no produce ni una petición: sólo deja **documentos
 * residentes**. Así que cada escenario se parte en dos ejes que se prueban
 * aparte:
 *
 *   · CONCURRENCIA — cuesta `sesionesConcurrentes` sesiones de verdad;
 *   · VOLUMEN      — cuesta documentos, y es lo que WS-03 ya midió a 50 000
 *                    pacientes por médico con las lecturas planas.
 *
 * Sin esta separación, «100 000 registrados» parece pedir 100 000 sesiones y todo
 * WS-02 se declara bloqueado. Con ella, la parte de concurrencia de los primeros
 * escenarios **cabe aquí**, y lo que queda externo queda dicho con precisión.
 */
export const LOS_DOS_EJES = Object.freeze({
  concurrencia: 'Cuesta sesiones vivas. Es lo que el arnés provoca.',
  volumen: 'Cuesta documentos residentes. No produce peticiones por sí mismo; cambia lo que cuesta cada lectura.',
})

/* ── 6 · el escenario ─────────────────────────────────────────────────────── */

const redondear = (n) => Math.max(1, Math.round(n))

/**
 * Traduce N usuarios registrados en un experimento concreto.
 *
 * Todo lo que devuelve bajo `derivado` sale de `SUPUESTOS`, que no están medidos:
 * es la hipótesis de carga, no una predicción del comportamiento. Lo que el
 * sistema HAGA bajo esa carga es lo que la corrida averigua.
 */
export function escenario(usuariosRegistrados) {
  if (!Number.isSafeInteger(usuariosRegistrados) || usuariosRegistrados < 1) {
    throw new Error('usuariosRegistrados debe ser un entero positivo')
  }

  const medicos = redondear(usuariosRegistrados * S.medicosDeLosRegistrados)
  const medicosActivos = redondear(medicos * S.activosEnElDia)
  const enConsulta = redondear(medicosActivos * S.enConsultaALaVez)
  const sesionesConcurrentes = redondear(enConsulta * S.sesionesPorMedico)
  const consultorios = redondear(medicos / S.medicosPorConsultorio)

  /* Caudal: cada consulta reparte sus peticiones a lo largo de su duración. */
  const throughputSostenido = (enConsulta * PETICIONES_POR_CONSULTA.total) / S.duracionConsultaSegundos

  const documentosResidentes = medicos * S.consultasPorMedicoDia * 2

  const cabeLaConcurrencia = sesionesConcurrentes <= COTAS_LOCALES.sesiones
  const cabeElVolumen = documentosResidentes <= COTAS_LOCALES.documentosResidentes

  return Object.freeze({
    id: `WS-02.registrados-${usuariosRegistrados}`,
    usuariosRegistrados,
    version: VERSION_DEL_MODELO,

    derivado: Object.freeze({
      medicos,
      medicosActivos,
      pacientesActivosDia: medicosActivos * S.consultasPorMedicoDia,
      medicosEnConsultaALaVez: enConsulta,
      sesionesConcurrentes,
      consultorios,
      concurrenciaPorConsultorio: Number((sesionesConcurrentes / consultorios).toFixed(3)),
      concurrenciaPorMedico: S.sesionesPorMedico,
      concurrenciaSostenida: sesionesConcurrentes,
      concurrenciaEnRafaga: redondear(sesionesConcurrentes * S.factorDeRafaga),
      documentosResidentes,
    }),

    mezcla: Object.freeze({
      porConsulta: PETICIONES_POR_CONSULTA,
      lecturasPorEscritura: Number((PETICIONES_POR_CONSULTA.lecturas / PETICIONES_POR_CONSULTA.escrituras).toFixed(3)),
      llamadasIaPorSegundo: Number(((enConsulta * PETICIONES_POR_CONSULTA.ia) / S.duracionConsultaSegundos).toFixed(4)),
      llamadasEvidenciaPorSegundo: Number(((enConsulta * PETICIONES_POR_CONSULTA.evidencia) / S.duracionConsultaSegundos).toFixed(4)),
      throughputSostenido: Number(throughputSostenido.toFixed(3)),
      throughputEnRafaga: Number((throughputSostenido * S.factorDeRafaga).toFixed(3)),
    }),

    /** Duración y forma del pico. Sin esto, «sostenida» y «ráfaga» no se distinguen al correr. */
    duracion: Object.freeze({
      sostenidaMinutos: 60,
      rafagaMinutos: 5,
      factorDeRafaga: S.factorDeRafaga,
    }),

    /** Casillas de salida: `null` hasta que una corrida las rellene. */
    medido: Object.freeze(Object.fromEntries(LO_QUE_MIDE_LA_CORRIDA.map(m => [m.campo, null]))),

    ejecutable: Object.freeze({
      concurrenciaAqui: cabeLaConcurrencia,
      volumenAqui: cabeElVolumen,
      /** Lo que hace falta fuera, dicho para poder pedirlo — no «un entorno más grande». */
      faltaFuera: Object.freeze([
        ...(cabeLaConcurrencia ? [] : [{
          eje: 'concurrencia',
          necesita: `${sesionesConcurrentes} sesiones de cliente simultáneas (cota local: ${COTAS_LOCALES.sesiones})`,
          conQue: 'Generadores de carga repartidos en varias máquinas contra un proyecto de Firebase de ensayo con las reglas desplegadas. Una sola máquina no sostiene tantos canales gRPC.',
        }]),
        ...(cabeElVolumen ? [] : [{
          eje: 'volumen',
          necesita: `${documentosResidentes.toLocaleString('es-MX')} documentos residentes (cota local: ${COTAS_LOCALES.documentosResidentes.toLocaleString('es-MX')})`,
          conQue: 'Un proyecto de Firestore de ensayo con los índices desplegados y siembra previa. El emulador guarda los documentos en memoria y no llega.',
        }]),
        ...(PETICIONES_POR_CONSULTA.ia > 0 ? [{
          eje: 'proveedores',
          necesita: 'Proveedores de voz, razonamiento y evidencia de verdad al otro lado',
          conQue: 'Cuotas de ensayo y presupuesto autorizado por el dueño. Sin proveedor no hay cola, ni contrapresión, ni salud de proveedor que medir: esos cuatro campos van en null.',
        }] : []),
      ]),
    }),

    /** Los argumentos con los que se corre. Es la traducción que no existía. */
    argumentosDelArnes: Object.freeze({
      tenants: Math.min(consultorios, Math.max(1, Math.ceil(sesionesConcurrentes / S.medicosPorConsultorio))),
      physiciansPerTenant: S.medicosPorConsultorio,
      concurrent: Math.min(sesionesConcurrentes, COTAS_LOCALES.sesiones),
    }),
  })
}

/** Los siete del contrato. Se derivan, no se escriben a mano. */
export const USUARIOS_REGISTRADOS = Object.freeze([2_000, 10_000, 15_000, 20_000, 30_000, 50_000, 100_000])

export const ESCENARIOS = Object.freeze(USUARIOS_REGISTRADOS.map(escenario))

export const escenarioDe = (n) => ESCENARIOS.find(e => e.usuariosRegistrados === n) ?? escenario(n)
