/**
 * EL PAQUETE DE LA VISITA — lo que el paciente puede ver de su consulta.
 *
 * V9 · `PATIENT-COMPANION-001`. La especificación lo pide con nombre propio
 * (`PatientVisitPackage`) y con dos estados: `DRAFT` hasta que el médico
 * apruebe, `RELEASED` después. Y con una frase que gobierna todo este archivo:
 *
 *     «Never expose a clinical draft to the patient as final.»
 *
 * ── FIRMAR Y LIBERAR SON DOS ACTOS ──────────────────────────────────────────
 *
 * Es la regla 4 de `.claude/rules/patient-facing-ai.md`, y es la decisión de
 * diseño más importante de este módulo.
 *
 * **Firmar** es un acto medicolegal hacia el expediente: la nota queda inmutable
 * y con cédula profesional detrás. **Liberar** es un acto de comunicación hacia
 * el paciente: «esto es lo que quiero que leas». Se pueden hacer en el mismo
 * gesto de la interfaz, pero se registran aparte, porque responden preguntas
 * distintas y porque un día el médico querrá firmar sin liberar todavía.
 *
 * Que la nota esté firmada es **condición necesaria y no suficiente** para
 * liberar. Un paquete nace `DRAFT` aunque su nota ya esté firmada.
 *
 * ── POR QUÉ SE GUARDA UNA COPIA Y NO SÓLO UN PUNTERO ────────────────────────
 *
 * El invariante nº1 del proyecto prohíbe duplicar la fuente de verdad de una
 * entidad clínica. Aquí no se duplica: **la nota firmada sigue siendo la única
 * fuente**, y el paquete guarda su `notaId`.
 *
 * Lo que sí se congela es **la redacción que se le entregó al paciente**, con su
 * `version`. Y eso no es una copia redundante: es un artefacto distinto. Si
 * dentro de un año hay que responder «¿qué se le dijo exactamente a este
 * paciente el 9 de agosto?», la respuesta no puede ser «lo que compondría hoy el
 * código a partir de la nota» — el código cambia, y una adenda posterior puede
 * cambiar la nota. Lo que se entregó se entregó.
 *
 * Un paquete liberado es, por eso, **inmutable**. Corregirlo es liberar una
 * versión nueva, igual que una adenda no reescribe la nota.
 *
 * ── DE DÓNDE SALE CADA CAMPO ────────────────────────────────────────────────
 *
 * De material ya firmado, y **compuesto de forma determinista** — nunca
 * generado por un modelo. Se reutiliza `como-se-lo-explico.ts`, que ya existía
 * y ya tenía la garantía: ninguna cifra puede aparecer si no está en la nota.
 *
 * El §1 de `patient-facing-ai.md` fija el orden de las fuentes. Este módulo se
 * queda en los niveles 1-6 (receta firmada, plan liberado, instrucciones
 * aprobadas, órdenes firmadas, resultados revisados, nota firmada) y **no toca
 * el nivel 9**: aquí no hay modelo de lenguaje. Ninguno.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * - **No decide cuándo liberar.** Compone y sabe pasar a `RELEASED`, pero quien
 *   decide es el médico en su pantalla y quien comprueba su identidad es el
 *   servidor (`/api/expediente/paquete-visita`).
 * - **No escribe en Firestore.** Es un módulo puro. Quien persiste es el
 *   servidor, que es el único que puede comprobar quién aprueba.
 * - **No compone `warningSigns` ni `educationalMaterial`.** La especificación
 *   los pide y el campo existe, pero **no hay de dónde sacarlos sin inventar**:
 *   los signos de alarma son indicación médica y el material educativo es
 *   evidencia curada. Se quedan vacíos y declarados, no rellenos con «lo
 *   habitual». Es la regla 1 de seguridad clínica.
 */

/**
 * ── LA COMPOSICIÓN LLEGA AQUÍ CON SU LLAMADOR (V9 · `POSTVISIT-001`) ────────
 *
 * `componerPaquete` y `cambiosDeMedicacion` se difirieron en
 * `PATIENT-COMPANION-001` porque el guardián de conexión las cazó: motor con
 * cuerpo real y **sin un solo llamador**. Ahora existe el llamador —
 * `POST /api/expediente/paquete-visita`, la ruta que el médico usa para
 * entregarle la consulta al paciente— y por eso entran.
 *
 * «Escrito, probado y sin conectar» es la familia de defectos más grande de este
 * proyecto. La regla que la evita no es «no escribas motores»: es **que no
 * lleguen antes que quien los llama**.
 */
import { comoTomarlo, fechaEnLlano, type MedicamentoParaExplicar } from './como-se-lo-explico'

/**
 * La colección donde viven los paquetes, en UN sitio.
 *
 * REG-160 fue exactamente esto: un importador que validaba la colección
 * declarada y **escribía en otra ruta**, porque el nombre estaba escrito dos
 * veces. Aquí quien escribe (`/api/expediente/paquete-visita`) y quien lee
 * (`/api/portal`) tienen que nombrar la misma, y con una constante compartida no
 * pueden separarse sin que se vea.
 */
export const COLECCION_PAQUETES = 'paquetes_visita'

/** Los dos únicos estados. No hay un tercero, y `DRAFT` no se le enseña a nadie. */
export type EstadoPaquete = 'DRAFT' | 'RELEASED'

/** Un medicamento tal como el paciente lo ve: sin jerga y sin nada añadido. */
export interface MedicacionDelPaquete {
  nombre: string
  /** La línea ya en español llano, compuesta por `como-se-lo-explico`. */
  instruccion: string
}

/**
 * Qué cambió respecto de la visita anterior.
 *
 * Es la casilla que **ningún competidor documenta públicamente** y donde el
 * paciente más se equivoca: sigue tomando lo que ya no toca, o no empieza lo
 * nuevo. Se calcula comparando nombres contra la medicación previa, y por eso
 * exige que quien llame le pase esa lista: **sin lista previa no se afirma
 * nada**, porque «no aparecía antes» y «no sé qué había antes» son cosas
 * distintas y confundirlas es dato de ausencia.
 */
export interface CambioDeMedicacion {
  nombre: string
  /**
   * `cambiado` existe por seguridad, no por completitud.
   *
   * Comparando sólo nombres, una amoxicilina que pasa de 500 mg a 875 mg sale
   * como `sin-cambio` — y el paciente lee «sigue igual» junto a una dosis
   * distinta. Decirle que no cambió nada cuando cambió la dosis es peor que no
   * decirle nada.
   *
   * Se detecta comparando la **pauta compuesta** (dosis · vía · frecuencia ·
   * duración), que sale entera de campos firmados: si una sola letra de esa línea
   * difiere, es `cambiado`. El nombre se deja fuera de la comparación a propósito
   * —si no, «losartan» y «Losartán» serían un cambio de pauta inventado—. No se
   * dice QUÉ cambió: eso exigiría interpretar, y aquí no se interpreta.
   */
  tipo: 'nuevo' | 'cambiado' | 'suspendido' | 'sin-cambio'
}

export interface PaqueteDeVisita {
  /** La nota firmada de la que sale todo. La fuente de verdad sigue siendo ella. */
  notaId: string
  encounterSummary: string
  medicationInstructions: MedicacionDelPaquete[]
  /** `null` = no se pudo determinar. NO es lo mismo que «no hubo cambios». */
  medicationChanges: CambioDeMedicacion[] | null
  orders: string[]
  followUp: string
  /** Indicación médica: o la escribió el médico, o va vacío. Nunca se compone. */
  warningSigns: string[]
  /** Evidencia curada. Vacío hasta que exista de dónde sacarlo. */
  educationalMaterial: string[]
  /** Identificadores de documentos de la cartera. Los llena `DOCUMENTS-001`. */
  documents: string[]
  /** Lo que el paciente preguntó y nadie contestó todavía. Lo llena PATIENT-AI-001. */
  unansweredQuestions: string[]
  clinicianContactRules: string
  language: string
  estado: EstadoPaquete
  /** Sólo con `RELEASED`. En `DRAFT` son `null` por construcción. */
  approvedAt: number | null
  approvedBy: string | null
  version: number
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Comparación de nombres de fármaco: sin mayúsculas, sin acentos, sin espacios de más. */
const claveDeFarmaco = (v: unknown): string =>
  texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * ── LA REGLA QUE GOBIERNA ESTA FUNCIÓN ──────────────────────────────────────
 *
 * **Sin lista previa no se afirma nada.** `previa === undefined` devuelve `null`,
 * no un arreglo de «sin-cambio»: «no aparecía antes» y «no sé qué había antes»
 * son cosas distintas, y confundirlas es dato de ausencia (regla 4 de seguridad
 * clínica). Un arreglo vacío SÍ es un dato: la visita anterior no llevaba
 * medicación, así que todo lo de hoy es nuevo.
 *
 * ── EL ORDEN NO ES ALFABÉTICO ───────────────────────────────────────────────
 *
 * Nuevo → cambiado → suspendido → sin cambio. Lo que el paciente tiene que
 * **hacer** distinto va primero; lo que sigue igual va al final, donde estorba
 * menos. Un listado donde todo pesa lo mismo no tiene jerarquía: tiene
 * inventario.
 *
 * ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
 *
 * No dice POR QUÉ se suspendió algo (eso es `motivoEstado`, y sólo si el médico
 * lo escribió), ni QUÉ cambió dentro de la línea, ni distingue un fármaco que
 * cambió de nombre comercial. Compara lo que hay escrito.
 */
export function cambiosDeMedicacion(
  actual: readonly MedicamentoParaExplicar[] | undefined,
  previa: readonly MedicamentoParaExplicar[] | undefined,
): CambioDeMedicacion[] | null {
  if (!previa) return null

  /**
   * La pauta SIN el nombre dentro.
   *
   * `comoTomarlo` compone «Losartán 50 mg por la boca cada 24 horas», con el
   * nombre incluido — y comparar esa línea entera hace que «losartan» y
   * «Losartán» salgan como un cambio de pauta que no existió. Se compara con un
   * nombre neutro y el MISMO composer, para que lo comparado sea exactamente lo
   * que el paciente lee, menos el nombre.
   */
  const pauta = (m: MedicamentoParaExplicar) => comoTomarlo({ ...m, nombre: '·' })

  const porClave = (lista: readonly MedicamentoParaExplicar[]) => {
    const m = new Map<string, { nombre: string; pauta: string }>()
    for (const med of lista) {
      const k = claveDeFarmaco(med?.nombre)
      if (k) m.set(k, { nombre: texto(med.nombre), pauta: pauta(med) })
    }
    return m
  }

  const hoy = porClave(actual ?? [])
  const antes = porClave(previa)

  const nuevos: CambioDeMedicacion[] = []
  const cambiados: CambioDeMedicacion[] = []
  const iguales: CambioDeMedicacion[] = []
  for (const [k, med] of hoy) {
    const previo = antes.get(k)
    if (!previo) nuevos.push({ nombre: med.nombre, tipo: 'nuevo' })
    else if (previo.pauta !== med.pauta) cambiados.push({ nombre: med.nombre, tipo: 'cambiado' })
    else iguales.push({ nombre: med.nombre, tipo: 'sin-cambio' })
  }

  const suspendidos: CambioDeMedicacion[] = []
  for (const [k, med] of antes) {
    if (!hoy.has(k)) suspendidos.push({ nombre: med.nombre, tipo: 'suspendido' })
  }

  return [...nuevos, ...cambiados, ...suspendidos, ...iguales]
}

/** La nota firmada, con lo poco que la composición necesita de ella. */
export interface NotaParaElPaquete {
  id: string
  /** Tiene que ser `'firmada'`. Cualquier otra cosa hace fallar la composición. */
  estado?: unknown
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

export interface EntradaComposicion {
  nota: NotaParaElPaquete
  /**
   * La medicación de la visita ANTERIOR. Omitirla no es lo mismo que pasar `[]`:
   * omitida significa «no se sabe» y deja `medicationChanges` en `null`.
   */
  medicacionPrevia?: readonly MedicamentoParaExplicar[]
  /** La fecha de seguimiento que fijó el médico, si la fijó. */
  cuandoVolver?: unknown
  idioma?: string
}

/**
 * ── POR QUÉ NO HAY PARÁMETRO PARA LOS SIGNOS DE ALARMA NI PARA EL CONTACTO ──
 *
 * Los dos campos existen en el paquete y los dos se quedan vacíos, y no es un
 * olvido:
 *
 * - **`warningSigns`** es indicación médica —«acuda a urgencias si…»— y hoy no
 *   hay ningún campo firmado de donde salga. Un parámetro para rellenarlo
 *   invitaría a que el primer llamador con prisa le metiera «lo habitual».
 * - **`clinicianContactRules`** es del consultorio, vive en su configuración, y
 *   la superficie del paciente ya la lee de ahí. Copiarla al paquete duplicaría
 *   la fuente de verdad de un dato que cambia cuando el consultorio cambia de
 *   teléfono, y dejaría paquetes viejos con un número que ya no contesta.
 */

export const NOTA_SIN_FIRMAR =
  'No se puede componer el paquete de una nota que no está firmada'
export const PAQUETE_SIN_NOTA =
  'No se puede componer un paquete sin la nota de la que sale'

/**
 * COMPONE EL PAQUETE DE UNA NOTA FIRMADA. Nace `DRAFT`, siempre.
 *
 * ── LA COMPUERTA DE FIRMA (`POSTVISIT-GATE-001`) ────────────────────────────
 *
 * Lanza si la nota no está firmada, y eso es lo primero que hace. Hasta hoy la
 * hoja del paciente se componía del **estado vivo de la pantalla**: el médico
 * podía copiar y entregar una hoja hecha de un borrador a medio dictar, y nada
 * lo impedía. La cabecera del módulo de composición afirmaba que el contenido
 * salía de lo «ya revisado y firmado» — era intención de diseño, no
 * precondición.
 *
 * Se lanza en vez de devolver `null` a propósito: un `null` se propaga y se
 * confunde con «no había nada que decirle». Esto no es un caso vacío, es un
 * intento de entregar un borrador.
 *
 * ── DETERMINISTA, SIN MODELO ────────────────────────────────────────────────
 *
 * Ni una línea la escribe un modelo de lenguaje. Cada campo sale de otro campo
 * ya firmado, y lo que no tiene de dónde salir se queda vacío y declarado — no
 * se rellena con «lo habitual» (regla 1 de seguridad clínica).
 */
export function componerPaquete(e: EntradaComposicion): PaqueteDeVisita {
  const notaId = texto(e.nota?.id)
  if (!notaId) throw new Error(PAQUETE_SIN_NOTA)
  if (texto(e.nota.estado) !== 'firmada') throw new Error(NOTA_SIN_FIRMAR)

  const medicamentos = e.nota.medicamentos ?? []

  return {
    notaId,
    encounterSummary: texto(e.nota.resumenEjecutivo),
    medicationInstructions: medicamentos
      .map(m => ({ nombre: texto(m?.nombre), instruccion: comoTomarlo(m) }))
      .filter(m => m.nombre && m.instruccion),
    medicationChanges: cambiosDeMedicacion(medicamentos, e.medicacionPrevia),
    orders: (e.nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: fechaEnLlano(e.cuandoVolver),
    /* Indicación médica sin campo de origen. Vacío y declarado, nunca «lo habitual». */
    warningSigns: [],
    /* Evidencia curada: no existe todavía de dónde sacarla. Vacío y declarado. */
    educationalMaterial: [],
    /* Los llena `DOCUMENTS-001` y `PATIENT-AI-001`. */
    documents: [],
    unansweredQuestions: [],
    /* El teléfono del consultorio vive en su configuración; el paquete no lo copia. */
    clinicianContactRules: '',
    language: texto(e.idioma) || 'es-MX',
    /* DRAFT aunque la nota esté firmada: firmar y liberar son dos actos. */
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}

/**
 * Pasa un paquete a `RELEASED`. Exige quién aprueba y cuándo.
 *
 * `aprobadoPor` es obligatorio y no puede ir vacío: un paquete liberado «por
 * nadie» es exactamente lo que la especificación prohíbe cuando dice
 * `approvedBy`. Se rechaza en vez de aceptar una cadena vacía, porque un campo
 * vacío en la base es indistinguible de un campo que nadie llenó.
 */
export function liberar(p: PaqueteDeVisita, aprobadoPor: string, cuando: number): PaqueteDeVisita {
  const quien = texto(aprobadoPor)
  if (!quien) throw new Error('No se puede liberar un paquete sin saber quién lo aprueba')
  if (!Number.isFinite(cuando) || cuando <= 0) throw new Error('No se puede liberar un paquete sin fecha de aprobación')
  return { ...p, estado: 'RELEASED', approvedBy: quien, approvedAt: cuando }
}

/**
 * ¿Puede este paquete llegar a los ojos del paciente?
 *
 * **Es la única compuerta**, y el servidor la llama antes de responder. Se
 * escribe como función y no como `p.estado === 'RELEASED'` suelto por dentro de
 * la ruta a propósito: una comprobación con nombre se puede exigir en una
 * prueba, y una comparación suelta se olvida en la segunda ruta que se escriba.
 *
 * Exige las tres cosas a la vez. Un paquete `RELEASED` sin `approvedBy` es un
 * paquete al que alguien le puso el estado a mano.
 */
export function visibleParaElPaciente(p: Pick<PaqueteDeVisita, 'estado' | 'approvedAt' | 'approvedBy'>): boolean {
  return p.estado === 'RELEASED' && !!p.approvedBy && !!p.approvedAt
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
