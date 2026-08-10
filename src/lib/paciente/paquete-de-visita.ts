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
 * - **No decide cuándo liberar.** `liberar()` construye el estado; **quién**
 *   puede pulsarlo lo decide el servidor, que es el único que sabe quién es el
 *   que pide. Aquí no hay sesión ni rol.
 * - **No escribe en Firestore.** Es un módulo puro. Quien persiste es el
 *   servidor, que es el único que puede comprobar quién aprueba.
 * - **No compone `warningSigns` ni `educationalMaterial`.** La especificación
 *   los pide y el campo existe, pero **no hay de dónde sacarlos sin inventar**:
 *   el material educativo es evidencia curada, y se queda vacío y declarado.
 *   Los signos de alarma se **copian** de lo que el médico escribió en la
 *   pantalla de liberación — su teclado es la fuente citada. Ninguno de los dos
 *   se rellena con «lo habitual»: es la regla 1 de seguridad clínica.
 */

/**
 * ── LA COMPOSICIÓN LLEGÓ CON SU LLAMADOR (POSTVISIT-001) ────────────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y **se retiraron el mismo día**: el guardián de
 * conexión las cazó como motores con cuerpo real y cero llamadores. Se
 * difirieron a esta unidad, que es donde vive quien las llama —la pantalla
 * donde el médico revisa y libera, y la ruta de servidor que la sirve.
 *
 * Vuelven ahora, con llamador. Lo que se conserva de aquella nota es la razón:
 * «escrito, probado y sin conectar» es la familia de defectos más grande del
 * proyecto, y la forma de no engordarla no es documentarla — es no crearla.
 */
import { comoTomarlo, type MedicamentoParaExplicar } from './como-se-lo-explico'

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
  tipo: 'nuevo' | 'suspendido' | 'sin-cambio'
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

/**
 * ── LA COMPUERTA DE FIRMA (`POSTVISIT-GATE-001`) ────────────────────────────
 *
 * El estado de nota que permite componer un paquete. **Uno solo, y con nombre.**
 *
 * Antes de esta unidad, `HojaParaElPaciente` se componía del borrador EN CURSO:
 * el médico dictaba, la hoja se actualizaba en vivo, y lo que se copiaba al
 * WhatsApp del paciente podía ser una dosis que aún no había revisado. La hoja
 * no mentía —enseñaba lo que había— pero no había nada que dijera «esto todavía
 * no está firmado».
 *
 * Se escribe como constante y como función con nombre, y no como un
 * `if (nota.estado === 'firmada')` suelto dentro de la ruta, por lo mismo que
 * `visibleParaElPaciente`: una comprobación con nombre se puede exigir en una
 * prueba; una comparación suelta se olvida en la segunda ruta que se escriba.
 */
export const ESTADO_QUE_PERMITE_COMPONER = 'firmada'

/** La nota, tal como la lee el servidor. Sólo los campos que el paquete usa. */
export interface NotaParaComponer {
  id: string
  estado?: unknown
  resumenEjecutivo?: unknown
  diagnosticos?: readonly { descripcion?: unknown }[]
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

/**
 * ¿Se puede componer un paquete de esta nota?
 *
 * **Sólo de una nota firmada.** No es una preferencia de flujo: un paquete es
 * lo que el paciente se lleva a casa, y un borrador es texto que el médico
 * todavía está corrigiendo.
 */
export function puedeComponerse(nota: Pick<NotaParaComponer, 'estado'>): boolean {
  return texto(nota.estado) === ESTADO_QUE_PERMITE_COMPONER
}

export interface EntradaPaquete {
  nota: NotaParaComponer
  /**
   * La medicación de la visita ANTERIOR.
   *
   * `null`/`undefined` significa **«no se sabe qué había antes»** y produce
   * `medicationChanges: null`. No es lo mismo que `[]`, que significa «la visita
   * anterior existe y no traía medicamentos». Confundirlos es exactamente la
   * regla 4 de seguridad clínica: ausencia de dato no es dato de ausencia.
   */
  medicacionPrevia?: readonly MedicamentoParaExplicar[] | null
  /** Texto de la próxima cita, si la hay. Lo resuelve quien llama. */
  proximaCita?: unknown
  /**
   * Signos de alarma, **escritos por el médico**. No se componen ni se
   * sugieren: son indicación médica, y la regla 1 dice que o salen de una
   * fuente citada o no existen. Aquí la fuente citada es su propio teclado.
   */
  signosDeAlarma?: readonly unknown[]
  /** Cómo contactar al consultorio. Dato administrativo, no clínico. */
  comoContactar?: unknown
  /** es-MX hoy. `PATIENT-LANGUAGE-001` traerá el resto. */
  language?: string
}

const lineas = (xs: readonly unknown[] | undefined) => (xs ?? []).map(texto).filter(Boolean)

/** Nombre de fármaco normalizado para comparar: sin acentos, sin caja, sin bordes. */
function claveDeFarmaco(m: MedicamentoParaExplicar): string {
  return texto(m?.nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * Es la casilla donde el paciente más se equivoca —sigue tomando lo que ya no
 * toca, o no empieza lo nuevo— y la que ningún competidor documenta en público.
 *
 * **Sin lista previa no se afirma nada.** `null`, no `[]`, y no «sin cambios»:
 * «no aparecía antes» y «no sé qué había antes» son cosas distintas, y decirle
 * al paciente «sin cambios» cuando en realidad no se consultó el historial es
 * inventarle una tranquilidad.
 *
 * Se compara **por nombre**, no por dosis: un cambio de dosis del mismo fármaco
 * sale como `sin-cambio` a propósito. Detectarlo exige comparar cifras, y una
 * comparación de cifras que se equivoque le diría al paciente que su dosis
 * cambió cuando no cambió — o al revés. Eso llega cuando haya de dónde
 * compararlo con garantía; hoy la instrucción completa va escrita al lado.
 */
export function cambiosDeMedicacion(
  actual: readonly MedicamentoParaExplicar[] | undefined,
  previa: readonly MedicamentoParaExplicar[] | null | undefined,
): CambioDeMedicacion[] | null {
  if (!previa) return null

  const ahora = (actual ?? []).filter(m => claveDeFarmaco(m))
  const antes = previa.filter(m => claveDeFarmaco(m))
  const clavesDeAntes = new Set(antes.map(claveDeFarmaco))
  const clavesDeAhora = new Set(ahora.map(claveDeFarmaco))

  const out: CambioDeMedicacion[] = []
  const vistos = new Set<string>()
  for (const m of ahora) {
    const k = claveDeFarmaco(m)
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push({ nombre: texto(m.nombre), tipo: clavesDeAntes.has(k) ? 'sin-cambio' : 'nuevo' })
  }
  for (const m of antes) {
    const k = claveDeFarmaco(m)
    if (vistos.has(k) || clavesDeAhora.has(k)) continue
    vistos.add(k)
    out.push({ nombre: texto(m.nombre), tipo: 'suspendido' })
  }
  return out
}

/**
 * ARMA EL PAQUETE A PARTIR DE LA NOTA FIRMADA.
 *
 * **Determinista de principio a fin.** Ni un modelo de lenguaje toca esto: cada
 * línea sale de un campo que el médico ya revisó y firmó, y la traducción a
 * español llano la hace `como-se-lo-explico`, que tiene su propio golden
 * comprobando que no puede aparecer una cifra que no esté en la nota.
 *
 * Nace **siempre** `DRAFT`, con `approvedAt` y `approvedBy` en `null` por
 * construcción, y `version: 1`. Firmar no libera: son dos actos.
 *
 * Lanza si la nota no está firmada. Se prefiere lanzar a devolver `null` porque
 * un `null` se puede ignorar por accidente en el sitio de uso, y lo que hay al
 * otro lado de este error es un borrador clínico camino del paciente.
 */
export function componerPaquete(e: EntradaPaquete): PaqueteDeVisita {
  const { nota } = e
  if (!puedeComponerse(nota)) {
    throw new Error('No se puede componer el paquete de una nota que no está firmada')
  }

  const dx = (nota.diagnosticos ?? []).map(d => texto(d?.descripcion)).filter(Boolean)
  const meds = (nota.medicamentos ?? []).filter(m => texto(m?.nombre))

  return {
    notaId: nota.id,
    /* El resumen del médico si lo hay; si no, sus diagnósticos. Nunca una
       redacción nueva: las dos cosas son texto que él firmó. */
    encounterSummary: texto(nota.resumenEjecutivo) || dx.join(' · '),
    medicationInstructions: meds
      .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
      .filter(x => x.instruccion),
    medicationChanges: cambiosDeMedicacion(meds, e.medicacionPrevia),
    orders: lineas(nota.estudiosOrden),
    followUp: texto(e.proximaCita),
    warningSigns: lineas(e.signosDeAlarma),
    /* Vacíos y declarados. No hay de dónde sacarlos sin inventar: el material
       educativo es evidencia curada y llega con su propia unidad. */
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(e.comoContactar),
    language: texto(e.language) || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
