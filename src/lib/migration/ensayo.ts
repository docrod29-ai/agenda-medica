/**
 * EL ENSAYO — todo el trabajo, cero escrituras.
 *
 * ── QUÉ ES ───────────────────────────────────────────────────────────────────
 *
 * El ensayo hace la migración ENTERA —lee, mapea, normaliza, valida, empareja,
 * cuarentena y cuenta— y devuelve exactamente lo que pasaría, sin tocar nada.
 * Es lo que el médico mira antes de decir que sí.
 *
 * No es una vista previa de las diez primeras filas. Es el trabajo completo: si
 * la fila 47 813 tiene una fecha ambigua, el ensayo lo dice ANTES, no a los
 * cuatro minutos de haber empezado a escribir.
 *
 * ── POR QUÉ NO PUEDE ESCRIBIR, POR CONSTRUCCIÓN ──────────────────────────────
 *
 * Este módulo no importa `firestore`, ni `firebase-admin`, ni `fetch`. No recibe
 * ningún objeto con el que escribir. Lo único que entra son datos y lo único que
 * sale es un informe. Que no escriba no depende de que nadie se acuerde de no
 * llamar a nada: **no tiene con qué**.
 *
 * Hay una prueba que lo vigila desde fuera, mirando los imports del módulo, para
 * que el día que alguien añada uno «sólo para leer los pacientes existentes» se
 * entere en ese momento y no en producción.
 *
 * ── DETERMINISMO ─────────────────────────────────────────────────────────────
 *
 * Mismo archivo + mismo mapeo + mismo padrón + misma fecha declarada → MISMO
 * resultado, byte por byte. Por eso `hoy` se inyecta y por eso no hay ni un
 * `Date.now()` ni un `Math.random()` en todo el módulo. Sin determinismo, el
 * ensayo no promete nada sobre la importación que viene después: sería una
 * simulación de otra cosa.
 *
 * Módulo PURO.
 */
import {
  aceptada, rechazada, type Veredicto, type Razon,
} from './contrato'
import {
  normalizarTexto, normalizarFecha, normalizarTelefono, normalizarEmail,
  normalizarCurp, normalizarSexo, type FormatoFecha, type Normalizado,
} from './normalizacion'
import { faltaIdentidad, huellaDeMapeo, mapear, type CampoMigrable, type Mapeo } from './mapeo'
import { huellaDeFila, RegistroDeHuellas } from './huella'
import {
  emparejar, puedeCrearse, requiereRevision, IndicePacientes,
  type Emparejamiento,
} from './emparejamiento'
import { ContadorDeVeredictos, reconciliar, type Reconciliacion } from './reconciliacion'
import type { AdaptadorOrigen, FilaOrigen, Lectura } from './adaptadores'
import { procedenciaDeCampo, type ProcedenciaCampo } from './procedencia'
import type { PacienteComparable } from '@/lib/pacientes/duplicados'
import { FILAS_POR_LOTE, cuentaDeLotes } from './lotes'

/* ═══════════════════════ LO QUE SALE DE UNA FILA ═══════════════════════ */

/** Una fila del archivo, ya resuelta del todo. Lo que se escribiría. */
export interface FilaResuelta {
  readonly sourceRow: number
  readonly huella: string
  readonly sourceRecordId?: string
  readonly veredicto: Veredicto
  /** Los campos que sí se resolvieron. Vacío en una fila rechazada. */
  readonly campos: Readonly<Partial<Record<CampoMigrable, string>>>
  /** Procedencia por campo del expediente. Incluye los inciertos. */
  readonly procedencia: Readonly<Record<string, ProcedenciaCampo>>
  /** Columnas que no se supieron mapear, tal cual venían. No se pierden. */
  readonly noMapeados: Readonly<Record<string, string>>
  /** El emparejamiento, cuando se llegó a calcular. */
  readonly emparejamiento?: Emparejamiento
}

/* ═══════════════════════ LA NORMALIZACIÓN POR CAMPO ═══════════════════════ */

/**
 * Qué normalizador le toca a cada campo.
 *
 * Una tabla y no un `switch` para que añadir un campo sea añadir un renglón —y
 * para que se vea de un vistazo que ningún campo se queda sin normalizador, que
 * es como se cuela un dato crudo al expediente.
 */
type Normalizador = (crudo: string, o: { hoy: string; formato?: FormatoFecha }) => Normalizado<string>

const NORMALIZADOR: Readonly<Record<CampoMigrable, Normalizador>> = {
  nombre: c => normalizarTexto(c),
  telefono: c => normalizarTelefono(c),
  whatsapp: c => normalizarTelefono(c),
  email: c => normalizarEmail(c),
  fechaNacimiento: (c, o) => normalizarFecha(c, { hoy: o.hoy, formato: o.formato }),
  sexo: c => normalizarSexo(c) as Normalizado<string>,
  curp: c => normalizarCurp(c),
  seguroMedico: c => normalizarTexto(c),
  alergias: c => normalizarTexto(c),
  notas: c => normalizarTexto(c),
}

/**
 * Los campos cuyo fallo TUMBA la fila, contra los que sólo se anotan.
 *
 * Sólo el nombre tumba. Un correo mal escrito no puede impedir que el paciente
 * exista: se queda sin correo, se dice en el informe, y el expediente entra. Lo
 * contrario —rechazar la fila entera por una columna secundaria— es cómo una
 * migración pierde el 30 % de un padrón por un export sucio.
 */
const CAMPO_CRITICO: ReadonlySet<CampoMigrable> = new Set<CampoMigrable>(['nombre'])

/** Nombre por debajo del cual no identifica a nadie: «X», «-», «NN». */
const MINIMO_NOMBRE = 3

/**
 * Filas con detalle completo que devuelve un ensayo por omisión.
 *
 * Suficiente para que la pantalla enseñe una muestra generosa de cada cubo y
 * bastante por debajo de lo que hace crecer la memoria de forma preocupante.
 */
export const DETALLE_MAXIMO = 1_000

/**
 * Cuántas filas del archivo se sostienen a la vez, por omisión.
 *
 * El mismo número que `FILAS_POR_LOTE`, y no por casualidad: la ventana del
 * ensayo y el lote de escritura son el mismo trozo de trabajo visto dos veces.
 * Que coincidan hace que «el ensayo aguantó» y «la escritura aguanta» hablen del
 * mismo tamaño de bocado; dos números distintos harían que el ensayo prometiera
 * sobre una forma de trabajar que la importación no usa.
 */
export const VENTANA_POR_OMISION = FILAS_POR_LOTE

/* ═══════════════════════ LO QUE SE SOSTIENE A LA VEZ ═══════════════════════ */

/**
 * La memoria del ensayo, DECLARADA en el resultado.
 *
 * ── POR QUÉ SALE EN EL INFORME Y NO SE QUEDA EN UN COMENTARIO ────────────────
 *
 * «El ensayo es de memoria acotada» es una afirmación que hay que poder
 * comprobar, no una intención. Con estos números una prueba puede exigir que
 * procesar 50 000 filas no sostenga 50 000 de nada — y fallar el día que alguien
 * vuelva a juntarlo todo en un `Promise.all` sobre el archivo entero, que es
 * exactamente cómo llegó a pedir 629 MB (`RISK-REGISTER.md`, P1-2).
 *
 * ── LO QUE ESTOS NÚMEROS NO SON ──────────────────────────────────────────────
 *
 * No son megas. Son **conteos de objetos vivos a la vez**, que es lo que se
 * puede medir de forma determinista y sin `--expose-gc`. Un montón medido en
 * megas depende del recolector, del tamaño de los campos y de la máquina; un
 * conteo de filas residentes no. La medición en megas vive en el arnés
 * (`scripts/migration/arnes.mjs`), fuera de la suite y etiquetada como
 * `local observado`.
 */
export interface EstadoAcotado {
  /** Filas que se piden al adaptador de una vez. */
  readonly filasPorVentana: number
  /** Pasadas sobre el archivo. Dos: huellas primero, veredictos después. */
  readonly pasadas: 2
  /** Máximo de filas de ORIGEN vivas a la vez. Nunca más que la ventana. */
  readonly maximoFilasDeOrigenResidentes: number
  /** Máximo de filas TRANSFORMADAS vivas a la vez. Nunca más que la ventana. */
  readonly maximoFilasTransformadasResidentes: number
  /**
   * Huellas retenidas de una pasada a la otra: 32 caracteres por fila DISTINTA.
   *
   * Esto sí crece con el archivo, y se declara en vez de esconderse. Es el
   * precio irreducible de detectar duplicados: para saber que la fila 5 repite a
   * la 40 000 hay que recordar algo de las 40 000. Lo que se recuerda es un
   * hash, no la fila.
   */
  readonly huellasRetenidas: number
  /** Filas con detalle completo que se devuelven. Acotado por `detalleMaximo`. */
  readonly detalleRetenido: number
  /**
   * Expedientes en el índice de emparejamiento: el padrón más lo aceptado.
   *
   * También crece, y por la misma clase de razón: la fila 900 se compara contra
   * las 899 que ya entraron, y sin eso el mismo paciente repetido dentro del
   * archivo se crea dos veces. Se declara para que nadie lea «memoria acotada»
   * como «nada crece».
   */
  readonly expedientesEnElIndice: number
}

/* ═══════════════════════ EL ENSAYO ═══════════════════════ */

export interface OpcionesEnsayo {
  readonly clinicId: string
  /** ISO `YYYY-MM-DD`. Inyectado: el determinismo depende de ello. */
  readonly hoy: string
  /** Formato de fecha declarado del archivo. Sin él, las ambiguas van a cuarentena. */
  readonly formatoFecha?: FormatoFecha
  /** Mapeo forzado por el médico, por índice de columna. */
  readonly forzado?: Readonly<Record<number, CampoMigrable | 'ignorar'>>
  /**
   * Huellas ya importadas en trabajos ANTERIORES.
   *
   * Es lo que hace que subir el mismo archivo por segunda vez no proponga
   * duplicar nada. Va aparte del padrón de pacientes porque responde otra
   * pregunta: no «¿existe esta persona?» sino «¿ya procesé esta fila?».
   */
  readonly huellasPrevias?: ReadonlySet<string>
  /**
   * Cuántas filas se conservan CON TODO SU DETALLE en el resultado.
   *
   * ── POR QUÉ HAY UN TOPE, MEDIDO ────────────────────────────────────────────
   *
   * Cada `FilaResuelta` arrastra su procedencia por campo y sus columnas sin
   * mapear — el valor original de cada celda, que es justo lo que la hace útil.
   * Con 50 000 filas eso son cientos de megas: el arnés midió 882 MB de montón
   * para un archivo de 20 MB, y ahí no hay memoria acotada que valga.
   *
   * Y no hace falta: lo que el médico mira en el ensayo son los CONTEOS y una
   * MUESTRA de lo que va a pasar. Nadie revisa cincuenta mil filas en pantalla.
   *
   * **Los conteos salen SIEMPRE completos, sobre todas las filas** — lo que se
   * recorta es el detalle que se devuelve, nunca la contabilidad. Si se
   * recortara la contabilidad, el ensayo dejaría de poder prometer nada sobre la
   * importación, que es su única razón de existir.
   */
  readonly detalleMaximo?: number
  /**
   * Cuántas filas del archivo se sostienen a la vez. Por omisión, un lote.
   *
   * Se expone para poder PROBARLO: con una ventana de 7 y un archivo de 500, el
   * resultado tiene que ser idéntico al de una ventana de 100 000. Si cambiar el
   * tamaño de la ventana cambiara una sola cuenta, el troceado estaría
   * decidiendo algo que no le toca.
   */
  readonly filasPorVentana?: number
}

export interface ResultadoEnsayo {
  readonly clinicId: string
  readonly mapeo: Mapeo
  readonly huellaMapeo: string
  readonly lectura: Pick<Lectura, 'encabezados' | 'sourceRecords'>
  /**
   * MUESTRA de filas con su detalle. Recortada a `detalleMaximo`.
   *
   * NO es la lista completa cuando el archivo es grande: `filasOmitidas` dice
   * cuántas faltan. Leer `filas.length` como «cuántas filas hay» es el error que
   * ese campo existe para impedir — el total está en `reconciliacion.cuentas`.
   */
  readonly filas: readonly FilaResuelta[]
  /** Cuántas filas se procesaron pero NO se devuelven con detalle. */
  readonly filasOmitidas: number
  readonly reconciliacion: Reconciliacion
  /** Cuántos lotes haría falta escribir. Para que el médico sepa a qué se expone. */
  readonly lotesEstimados: number
  /** Encabezados que no correspondieron a ningún campo. */
  readonly columnasDesconocidas: readonly string[]
  /**
   * Señales de bloqueo que se saturaron y dejaron de vigilarse.
   *
   * ── POR QUÉ ESTO SALE AL INFORME Y NO SE QUEDA DENTRO ──────────────────────
   *
   * El índice deja de recorrer un bloque cuando pasa de `MAXIMO_POR_BLOQUE`
   * (ver `emparejamiento.ts`). Es necesario —si no, vuelve a ser cuadrático—
   * pero tiene un precio real: un duplicado que viviera SÓLO en un bloque
   * saturado no se detecta.
   *
   * El arnés lo midió: con 50 000 filas sintéticas de poca variedad de
   * apellidos, los bloques de nombre se saturan y los emparejamientos dudosos
   * detectados caen de 557 a 2. Callarlo convertiría «no busqué en todos los
   * sitios» en «no hay duplicados», que es la clase de silencio que este carril
   * existe para impedir.
   *
   * Vacío casi siempre en un padrón real, donde los apellidos tienen mucha más
   * variedad que en un fixture generado.
   */
  readonly senalesSaturadas: readonly string[]
  /**
   * Lo que impide seguir. Vacío = se puede aprobar.
   *
   * Son cosas del ARCHIVO, no de las filas: sin columna de nombre, o con dos
   * columnas peleándose por el mismo campo, no tiene sentido dejar aprobar —
   * cada fila saldría mal por la misma razón.
   */
  readonly bloqueos: readonly string[]
  /** Qué se sostuvo a la vez. Ver `EstadoAcotado`. */
  readonly memoria: EstadoAcotado
}

/**
 * Corre la migración entera sin escribir.
 *
 * `existentes` es el padrón actual del consultorio. Se pasa como DATO y no se
 * va a buscar: quien llama decide si lo lee de Firestore, de una prueba o de un
 * archivo. Es lo que mantiene este módulo sin puertas de escritura.
 */
export async function ensayar(
  adaptador: AdaptadorOrigen,
  contenido: string,
  existentes: readonly PacienteComparable[],
  o: OpcionesEnsayo,
): Promise<ResultadoEnsayo> {
  if (!adaptador.disponible) {
    throw new Error(`migración: el adaptador "${adaptador.id}" no está disponible — ${adaptador.porQueNo ?? ''}`)
  }

  /**
   * ── POR QUÉ DOS PASADAS EN FLUJO Y NO UNA SOLA CON TODO DELANTE ────────────
   *
   * La versión anterior leía el archivo entero a un arreglo y construía una
   * entrada por fila; el arnés midió **629 MB de montón para 20 MB de archivo**
   * con 50 000 filas (`RISK-REGISTER.md`, P1-2). No es que fuera lento: es que
   * no cabe en una función sin servidor, y la importación grande es justo la que
   * este carril existe para atender.
   *
   * Se lee por trozos y se sueltan. Y son DOS pasadas porque hay una pregunta
   * que no se puede contestar en una: la fila 5 puede colisionar en id de origen
   * con la 40 000, así que su veredicto no se puede dictar hasta haber visto el
   * final del archivo. Lo que sobrevive entre las dos pasadas es una huella de
   * 32 caracteres por fila distinta — no la fila.
   *
   * El precio es CPU: se normaliza dos veces. Es el intercambio deliberado —
   * tiempo por memoria— y el tiempo se puede repartir en varias invocaciones,
   * mientras que quedarse sin memoria mata la importación entera.
   */
  const ventana = Math.max(1, Math.floor(o.filasPorVentana ?? VENTANA_POR_OMISION))
  /**
   * El detalle pesado sólo se construye para las filas que se van a DEVOLVER.
   *
   * La procedencia por campo guarda el valor original de cada celda; con 50 000
   * filas eso es la mayor parte de la memoria del ensayo. El arnés lo midió:
   * 882 MB de montón para un archivo de 20 MB. Las filas que de todas formas se
   * van a omitir del resultado no necesitan que se construya.
   *
   * Lo que SÍ se calcula para todas, sin excepción, es `campos`, `huella` y las
   * razones — de ahí salen las cuentas, y las cuentas no se recortan nunca.
   */
  const topeDetalle = o.detalleMaximo ?? DETALLE_MAXIMO

  const primeraLectura = adaptador.leerPorTrozos(contenido, ventana)
  const encabezados = primeraLectura.encabezados
  const mapeo = mapear(encabezados, o.forzado)
  const huellaMapeo = huellaDeMapeo(mapeo)

  let maximoOrigen = 0
  let maximoTransformadas = 0

  /**
   * PRIMERA PASADA — sólo huellas e ids de origen.
   *
   * Se llama al MISMO `prepararFila` que la segunda pasada, con el detalle
   * apagado. Dos caminos distintos para calcular la huella de una fila es cómo
   * se llega a que la pasada que detecta duplicados y la que dicta veredictos
   * discrepen sobre qué fila es cuál.
   */
  const registro = new RegistroDeHuellas()
  let sourceRecords = 0
  for (const trozo of primeraLectura.trozos) {
    maximoOrigen = Math.max(maximoOrigen, trozo.filas.length + trozo.rotas.length)
    const preparadas = await Promise.all(trozo.filas.map(f => prepararFila(f, mapeo, o, false)))
    maximoTransformadas = Math.max(maximoTransformadas, preparadas.length)
    for (const p of preparadas) registro.ver(p.huella, p.sourceRow, p.sourceRecordId)
    sourceRecords += trozo.filas.length + trozo.rotas.length
  }

  const bloqueos: string[] = []
  if (sourceRecords === 0) bloqueos.push('El archivo no trae ninguna fila de datos.')
  if (faltaIdentidad(mapeo)) {
    bloqueos.push('No se encontró una columna de Nombre. Sin nombre no se puede abrir un expediente.')
  }
  if (mapeo.hayConflictos) {
    const c = mapeo.columnas.filter(x => x.clase === 'conflicto').map(x => ('encabezado' in x ? x.encabezado : ''))
    bloqueos.push(`Hay columnas peleándose por el mismo campo (${c.join(', ')}). Dinos cuál es cuál.`)
  }

  /**
   * SEGUNDA PASADA — emparejar y dictar veredicto.
   *
   * El índice arranca con el padrón y va CRECIENDO con lo aceptado: la fila 900
   * se compara contra el padrón y contra las 899 anteriores que sí entraron. Sin
   * eso, un archivo con la misma persona dos veces la crea dos veces — y los
   * exports de otros sistemas la traen repetida con frecuencia.
   */
  const indice = new IndicePacientes<PacienteComparable>(existentes)
  const contador = new ContadorDeVeredictos()
  const filas: FilaResuelta[] = []
  let filasOmitidas = 0
  /** Filas de datos ya vistas en esta pasada. Decide a quién le toca detalle. */
  let vistas = 0
  let aceptadasAlIndice = 0

  /**
   * Guarda el veredicto SIEMPRE y el detalle sólo mientras quepa.
   *
   * El orden importa: el veredicto entra en la contabilidad antes de decidir si
   * el detalle se conserva. Al revés, recortar el detalle recortaría también las
   * cuentas y el ensayo mentiría sobre un archivo grande — exactamente el fallo
   * que este carril existe para impedir.
   */
  const registrar = (f: FilaResuelta) => {
    contador.sumar(f.veredicto)
    if (filas.length < topeDetalle) filas.push(f)
    else filasOmitidas++
  }

  for (const trozo of adaptador.leerPorTrozos(contenido, ventana).trozos) {
    maximoOrigen = Math.max(maximoOrigen, trozo.filas.length + trozo.rotas.length)
    const preparadas = await Promise.all(
      trozo.filas.map((f, k) => prepararFila(f, mapeo, o, vistas + k < topeDetalle)),
    )
    maximoTransformadas = Math.max(maximoTransformadas, preparadas.length)
    vistas += preparadas.length

    for (const p of preparadas) {
      const razones: Razon[] = [...p.razones]

      // 1. Lo que tumba la fila antes de mirar a nadie más.
      if (razones.length > 0) {
        registrar({ ...p, veredicto: rechazada('rejected', razones) })
        continue
      }
      // 2. Repetida dentro del propio archivo.
      if (!registro.esPrimera(p.huella, p.sourceRow)) {
        registrar({
          ...p,
          veredicto: rechazada('duplicate', ['DUPLICATE_IN_SOURCE'], { primeraFila: registro.primeraDe(p.huella)! }),
        })
        continue
      }
      // 3. Ya importada en un trabajo anterior. No es un error: es idempotencia.
      if (o.huellasPrevias?.has(p.huella)) {
        registrar({ ...p, veredicto: rechazada('duplicate', ['ALREADY_IMPORTED']) })
        continue
      }
      // 4. El archivo se contradice a sí mismo sobre quién es quién.
      if (registro.colisionDeIdOrigen(p.sourceRecordId)) {
        registrar({ ...p, veredicto: rechazada('quarantined', ['SOURCE_ID_COLLISION']) })
        continue
      }
      // 5. Hay dudas que no tumban la fila pero que nadie debe resolver adivinando.
      if (p.inciertos.length > 0) {
        registrar({
          ...p,
          veredicto: rechazada('quarantined', p.razonesInciertas, { camposInciertos: p.inciertos.join(',') }),
        })
        continue
      }

      // 6. ¿Es alguien que ya está?
      const comparable: PacienteComparable = {
        nombre: p.campos.nombre,
        telefono: p.campos.telefono,
        whatsapp: p.campos.whatsapp,
        curp: p.campos.curp,
        fechaNacimiento: p.campos.fechaNacimiento,
      }
      const em = emparejar(comparable, indice)

      if (puedeCrearse(em.clase)) {
        // Sólo lo ACEPTADO entra al índice. Una fila en cuarentena no puede servir
        // de espejo para juzgar a las siguientes: todavía no se sabe si existe.
        indice.agregar(comparable)
        aceptadasAlIndice++
        registrar({ ...p, emparejamiento: em, veredicto: aceptada() })
      } else if (em.clase === 'EXACT_MATCH') {
        registrar({ ...p, emparejamiento: em, veredicto: rechazada('duplicate', ['DUPLICATE_EXACT']) })
      } else if (requiereRevision(em.clase)) {
        registrar({
          ...p,
          emparejamiento: em,
          veredicto: rechazada('ambiguous', ['DUPLICATE_AMBIGUOUS'], { candidatos: em.candidatos.length }),
        })
      }
    }

    /**
     * LAS FILAS ROTAS CUENTAN.
     *
     * Entran en la contabilidad como rechazadas, en su trozo y no en una lista
     * al final. Éste es el renglón que hace que `sourceRecords` cuadre: sin él,
     * una fila que el parser no pudo separar desaparecería del total y las
     * cuentas darían bien sobre un archivo del que se perdió una parte.
     */
    for (const r of trozo.rotas) contador.sumar(rechazada('rejected', [r.razon], r.detalle))
  }

  const cuentas = contador.cerrar(sourceRecords)
  const aceptadas = cuentas.porDestino.accepted

  return {
    clinicId: o.clinicId,
    mapeo,
    huellaMapeo,
    lectura: { encabezados, sourceRecords },
    filas,
    filasOmitidas,
    reconciliacion: reconciliar(cuentas),
    lotesEstimados: cuentaDeLotes(aceptadas, FILAS_POR_LOTE),
    columnasDesconocidas: mapeo.desconocidas,
    senalesSaturadas: indice.bloquesSaturados(),
    bloqueos,
    memoria: {
      filasPorVentana: ventana,
      pasadas: 2,
      maximoFilasDeOrigenResidentes: maximoOrigen,
      maximoFilasTransformadasResidentes: maximoTransformadas,
      huellasRetenidas: registro.huellasDistintas,
      detalleRetenido: filas.length,
      expedientesEnElIndice: existentes.length + aceptadasAlIndice,
    },
  }
}

/* ═══════════════════════ UNA FILA ═══════════════════════ */

interface Preparada {
  readonly sourceRow: number
  readonly huella: string
  readonly sourceRecordId?: string
  readonly campos: Readonly<Partial<Record<CampoMigrable, string>>>
  readonly procedencia: Readonly<Record<string, ProcedenciaCampo>>
  readonly noMapeados: Readonly<Record<string, string>>
  /** Razones que TUMBAN la fila. */
  readonly razones: readonly Razon[]
  /** Campos con duda que no tumban, pero que mandan a cuarentena. */
  readonly inciertos: readonly string[]
  readonly razonesInciertas: readonly Razon[]
}

async function prepararFila(
  f: FilaOrigen,
  mapeo: Mapeo,
  o: OpcionesEnsayo,
  conDetalle: boolean,
): Promise<Preparada> {
  const campos: Partial<Record<CampoMigrable, string>> = {}
  const procedencia: Record<string, ProcedenciaCampo> = {}
  const noMapeados: Record<string, string> = {}
  const razones: Razon[] = []
  const inciertos: string[] = []
  const razonesInciertas: Razon[] = []

  for (const col of mapeo.columnas) {
    if (col.clase === 'sin-encabezado') continue
    const crudo = f.campos[col.encabezado] ?? f.campos[`columna_${col.indice + 1}`] ?? ''

    if (col.clase === 'desconocida' || col.clase === 'conflicto') {
      /**
       * La columna que no se entendió SE GUARDA.
       *
       * Es lo que separa «no lo importamos» de «lo perdimos». El dato viaja al
       * sello de procedencia tal cual vino, sin interpretarlo y sin que entre a
       * ningún motor clínico — pero está, y la exportación lo devuelve.
       */
      if (conDetalle && crudo.trim() !== '') noMapeados[col.encabezado] = crudo
      continue
    }

    const n = NORMALIZADOR[col.campo](crudo, { hoy: o.hoy, formato: o.formatoFecha })
    if (conDetalle) procedencia[col.campo] = procedenciaDeCampo(col.encabezado, n)

    if (n.clase === 'valor') {
      campos[col.campo] = n.valor
      continue
    }
    if (n.clase === 'vacio') {
      /**
       * Vacío no es un error NI un dato.
       *
       * No se apunta razón: la columna vino vacía y ya. Lo que sí queda es la
       * constancia en la procedencia (`columna-presente-vacia`), porque «no
       * había columna de alergias» y «la columna de alergias vino vacía» son
       * cosas distintas y sólo una de las dos se puede preguntar después.
       */
      if (CAMPO_CRITICO.has(col.campo)) razones.push('MISSING_REQUIRED_IDENTITY')
      continue
    }

    // `ambiguo` o `invalido`.
    if (CAMPO_CRITICO.has(col.campo)) {
      razones.push(n.razon)
    } else {
      /**
       * UNA DUDA NO TUMBA LA FILA, PERO TAMPOCO SE TRAGA.
       *
       * La fila va a cuarentena con el campo señalado. La alternativa —dejarla
       * entrar sin ese campo— convertiría una fecha ambigua en un expediente sin
       * fecha de nacimiento, y nadie volvería a saber que el archivo sí la traía.
       */
      inciertos.push(col.campo)
      if (!razonesInciertas.includes(n.razon)) razonesInciertas.push(n.razon)
    }
  }

  // El nombre puede venir presente y aun así no identificar a nadie.
  const nombre = campos.nombre
  if (nombre === undefined) {
    if (!razones.includes('MISSING_REQUIRED_IDENTITY')) razones.push('MISSING_REQUIRED_IDENTITY')
  } else if (nombre.length < MINIMO_NOMBRE) {
    razones.push('IDENTITY_TOO_SHORT')
  }

  const huella = await huellaDeFila(campos as Record<string, string | undefined>)
  return {
    sourceRow: f.sourceRow,
    huella,
    sourceRecordId: f.sourceRecordId,
    campos, procedencia, noMapeados,
    razones, inciertos, razonesInciertas,
  }
}

/**
 * ¿Se puede aprobar este ensayo?
 *
 * Separado del ensayo mismo porque son dos preguntas distintas: «¿qué pasaría?»
 * la contesta `ensayar`, y «¿te dejo hacerlo?» la contesta esto. Tenerlas juntas
 * llevaría a que un ensayo con bloqueos devolviera algo a medias en vez de un
 * informe completo que explica por qué no se puede seguir.
 */
export function aprobable(r: ResultadoEnsayo): boolean {
  return r.bloqueos.length === 0 && r.reconciliacion.estado === 'COMPLETED'
}
