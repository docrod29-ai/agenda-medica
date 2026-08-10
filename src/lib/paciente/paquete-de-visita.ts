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
 * - **No decide cuándo liberar.** Eso es una acción del médico, en su pantalla,
 *   y llega en `POSTVISIT-001`.
 * - **No escribe en Firestore.** Es un módulo puro. Quien persiste es el
 *   servidor, que es el único que puede comprobar quién aprueba.
 * - **No compone `warningSigns` ni `educationalMaterial`.** La especificación
 *   los pide y el campo existe, pero **no hay de dónde sacarlos sin inventar**:
 *   los signos de alarma son indicación médica y el material educativo es
 *   evidencia curada. Se quedan vacíos y declarados, no rellenos con «lo
 *   habitual». Es la regla 1 de seguridad clínica.
 */

/**
 * ── LA COMPOSICIÓN LLEGÓ CON QUIEN LA LLAMA (`POSTVISIT-001`) ───────────────
 *
 * `componerPaquete` y `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se **retiraron el mismo día**: el guardián de
 * conexión las cazó como motores con cuerpo real y sin un solo llamador.
 * «Escrito, probado y sin conectar» es la familia de defectos más grande de este
 * proyecto, y añadirle una más a sabiendas era exactamente lo que no tocaba.
 *
 * Vuelven ahora **con su llamador delante**: `POST /api/expediente/paquete-visita`,
 * la ruta por la que el médico revisa y libera. Nada de este archivo existe
 * «para cuando haga falta».
 */

import {
  comoTomarlo, yaNoSeToma,
  type MedicamentoParaExplicar,
} from './como-se-lo-explico'

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

/** Mismo criterio de «el mismo fármaco» que `ordenes-medicamento`. */
const claveFarmaco = (nombre: unknown): string =>
  String(nombre ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * La nota firmada, reducida a lo que este módulo necesita. Se declara aquí y no
 * se importa `NotaMedica` para que el módulo siga siendo puro y probable sin
 * arrastrar el expediente entero.
 */
export interface NotaParaElPaquete {
  id: string
  /** `'firmada'` o cualquier otra cosa. Aquí se comprueba, no se supone. */
  estado?: unknown
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

export interface EntradaComposicion {
  nota: NotaParaElPaquete
  /**
   * Lo que el paciente tomaba ANTES de esta consulta, por nombre.
   *
   * `null` = no se pudo saber. `[]` = se supo, y no había nada. **No son lo
   * mismo**, y de esa diferencia depende que `medicationChanges` sea una lista o
   * un `null` honesto.
   */
  medicacionPrevia: readonly string[] | null
  /** Lo que el médico escribió como indicaciones. Va literal o no va. */
  indicacionesDelMedico?: unknown
  /** Texto de la próxima cita, ya legible. Este módulo no formatea fechas. */
  proximaCita?: unknown
  /** Cómo contactar al consultorio. **Administrativo**, nunca clínico. */
  contactoDelConsultorio?: unknown
  /** Signos de alarma que escribió el médico. Si no escribió, van vacíos. */
  signosDeAlarma?: readonly unknown[]
  idioma?: string
}

/** La nota no estaba firmada. Se distingue por tipo para que la ruta responda 409. */
export class NotaSinFirmar extends Error {
  constructor() { super('No se puede componer el paquete de una nota sin firmar') }
}

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * ── LA DECISIÓN QUE GOBIERNA ESTA FUNCIÓN ───────────────────────────────────
 *
 * **El silencio no suspende.** Un fármaco que estaba en la lista previa y no
 * aparece en la nota de hoy **no se declara suspendido**: significa que hoy no
 * se habló de él. Es la misma regla que ya sostiene `medicamentosVigentes`
 * (`POR_QUE_EL_SILENCIO_NO_SUSPENDE`) y la regla 4 de seguridad clínica —
 * ausencia de dato no es dato de ausencia.
 *
 * Aquí pesa el doble, porque el lector es el paciente: decirle «suspendido»
 * sobre su antihipertensivo crónico porque la nota de una faringitis no lo
 * mencionó es hacer que deje un tratamiento que nadie retiró. La regla de IA de
 * cara al paciente lo tiene en su lista de lo que el código **no debe poder
 * hacer**: suspender un medicamento.
 *
 * `suspendido` sale **sólo** del estado que el médico escribió en la nota
 * (`suspendida`/`cancelada`), que llega de un modal con motivo obligatorio.
 *
 * ── SIN LISTA PREVIA, `null` ────────────────────────────────────────────────
 *
 * «No aparecía antes» y «no sé qué había antes» son cosas distintas. Con
 * `medicacionPrevia === null` se devuelve `null` y el paciente no ve la sección,
 * en vez de leer «sin cambios» sobre algo que nadie comparó.
 */
export function cambiosDeMedicacion(
  medicamentos: readonly MedicamentoParaExplicar[] | undefined,
  medicacionPrevia: readonly string[] | null,
): CambioDeMedicacion[] | null {
  if (medicacionPrevia === null || medicacionPrevia === undefined) return null

  const antes = new Set(medicacionPrevia.map(claveFarmaco).filter(Boolean))
  const cambios: CambioDeMedicacion[] = []

  for (const m of medicamentos ?? []) {
    const nombre = texto(m.nombre)
    const clave = claveFarmaco(nombre)
    if (!clave) continue
    if (yaNoSeToma(m)) { cambios.push({ nombre, tipo: 'suspendido' }); continue }
    cambios.push({ nombre, tipo: antes.has(clave) ? 'sin-cambio' : 'nuevo' })
  }

  /* Lo que estaba antes y hoy no se mencionó NO entra. Ver la cabecera. */
  return cambios
}

/**
 * ARMA EL PAQUETE DESDE LA NOTA FIRMADA. Determinista, sin modelo, y `DRAFT`.
 *
 * ── LA COMPUERTA DE FIRMA (`POSTVISIT-GATE-001`) ────────────────────────────
 *
 * Lanza `NotaSinFirmar` si la nota no está firmada. Es la corrección del defecto
 * que abrió esta unidad: la hoja del paciente se componía del **borrador en
 * curso** y la única guarda era «no es nota de hospital». El médico podía copiar
 * y entregar una hoja hecha de una nota a medio dictar.
 *
 * Se lanza en vez de devolver `null` a propósito: un `null` se ignora en
 * silencio en el primer llamador que se olvide de mirarlo, y esto es la puerta
 * entre un borrador clínico y los ojos de un paciente.
 *
 * ── NACE `DRAFT`, SIEMPRE ───────────────────────────────────────────────────
 *
 * Aunque la nota esté firmada. Firmar va hacia el expediente; liberar va hacia
 * el paciente. Esta función no puede liberar nada: para eso está `liberar()`,
 * que exige saber quién aprueba, y sólo la llama el servidor.
 *
 * ── LO QUE NO COMPONE ───────────────────────────────────────────────────────
 *
 * `warningSigns` sale de lo que el médico escribió, o va vacío;
 * `educationalMaterial`, `documents` y `unansweredQuestions` van vacíos hasta que
 * existan sus unidades. Rellenarlos con «lo habitual» es la regla 1.
 */
export function componerPaquete(e: EntradaComposicion, version = 1): PaqueteDeVisita {
  if (texto(e.nota.estado) !== 'firmada') throw new NotaSinFirmar()

  const meds = e.nota.medicamentos ?? []

  return {
    notaId: e.nota.id,
    /* El resumen del médico, LITERAL. Reescribirlo «para que se entienda» es
       donde se colaría una frase que él no dijo. */
    encounterSummary: texto(e.nota.resumenEjecutivo),
    /* Sólo lo que sí tiene que tomar: lo retirado va en `medicationChanges`, no
       en la lista de «tómese esto» (REG-306). */
    medicationInstructions: meds
      .filter(m => !yaNoSeToma(m))
      .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
      .filter(m => m.nombre && m.instruccion),
    medicationChanges: cambiosDeMedicacion(meds, e.medicacionPrevia),
    orders: (e.nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(e.proximaCita),
    warningSigns: (e.signosDeAlarma ?? []).map(texto).filter(Boolean),
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(e.contactoDelConsultorio),
    language: texto(e.idioma) || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version,
  }
}

export const POR_QUE_EL_SILENCIO_NO_SUSPENDE_TAMPOCO_AQUI =
  'Un fármaco que estaba antes y no aparece en la nota de hoy no está ' +
  'suspendido: hoy no se habló de él. Decírselo al paciente como «suspendido» ' +
  'es hacerle dejar un tratamiento que nadie retiró, y él no tiene cómo ' +
  'detectar el error.'

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
