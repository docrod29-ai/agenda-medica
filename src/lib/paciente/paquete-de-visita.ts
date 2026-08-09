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
 * - **No decide cuándo liberar.** Eso es una acción del médico, en su pantalla.
 *   Aquí sólo vive la transición, y exige quién aprueba y cuándo.
 * - **No escribe en Firestore.** Es un módulo puro. Quien persiste es el
 *   servidor, que es el único que puede comprobar quién aprueba.
 * - **No compone `warningSigns` ni `educationalMaterial`.** La especificación
 *   los pide y el campo existe, pero **no hay de dónde sacarlos sin inventar**:
 *   los signos de alarma son indicación médica y el material educativo es
 *   evidencia curada. Se quedan vacíos y declarados, no rellenos con «lo
 *   habitual». Es la regla 1 de seguridad clínica.
 */

/**
 * ── LA COMPOSICIÓN LLEGÓ CON QUIEN LA LLAMA (POSTVISIT-001) ──────────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se **quitaron** el mismo día: el guardián de
 * conexión las cazó como motores con cuerpo real y cero llamadores.
 *
 * Vuelven ahora porque ya existe quien las llame: `/api/expediente/paquete-visita`,
 * la ruta que compone en el servidor lo que el médico revisa y libera. Y el
 * llamador es el servidor **a propósito** — ver la nota de `componerPaquete`.
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

/* ─────────────────────────────────────────────────────────────────────────────
 * LA COMPOSICIÓN — POSTVISIT-001
 * ────────────────────────────────────────────────────────────────────────── */

/** La nota firmada, con lo poco que hace falta para componer. */
export interface NotaParaComponer {
  id: string
  estado: string
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoParaComponer[]
  estudiosOrden?: readonly unknown[]
  /** Lo que el médico puso como próximo seguimiento al firmar. */
  proximoSeguimiento?: unknown
  /** Presente = nota de hospitalización o UCI. No se compone paquete de casa. */
  internamientoId?: unknown
}

export interface MedicamentoParaComponer extends MedicamentoParaExplicar {
  estado?: unknown
  motivoEstado?: unknown
}

export interface EntradaDelPaquete {
  nota: NotaParaComponer
  /**
   * La medicación que el paciente tenía ANTES de esta visita.
   *
   * `null` o ausente significa **no se sabe**, y entonces `medicationChanges`
   * sale `null`. No sale `[]`: una lista vacía le dice al paciente «no hubo
   * cambios», y eso es dato de ausencia (regla 4 de seguridad clínica).
   */
  medicacionPrevia?: readonly { nombre?: unknown }[] | null
  /** Cómo contactar al consultorio. Dato administrativo, no clínico. */
  comoContactar?: unknown
  language?: string
}

/** Sin acentos, sin caja y sin espacios de sobra: para comparar nombres. */
const clave = (v: unknown): string =>
  texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * ── LO QUE ESTA FUNCIÓN SE NIEGA A DEDUCIR, Y ES LO IMPORTANTE ──────────────
 *
 * Un fármaco que estaba en la lista anterior y **no aparece hoy** NO se reporta
 * como suspendido. Nunca.
 *
 * Es la tentación obvia —«no lo volvió a recetar, luego lo quitó»— y es
 * exactamente el error que la regla 4 de seguridad clínica prohíbe: que el
 * médico no re-listara hoy la metformina de un diabético no significa que la
 * haya suspendido; significa que no la escribió otra vez. Decirle al paciente
 * «suspendido: metformina» le hace **dejar de tomarla**, y el lector no tiene
 * cómo detectar el error.
 *
 * Por eso `suspendido` sale **sólo** de que el propio medicamento traiga
 * `estado: 'suspendida'` o `'cancelada'` — una decisión que el médico tomó
 * explícitamente y que quedó escrita en la nota que firmó.
 *
 * `nuevo` sí se deduce por comparación de nombres, y es seguro en la dirección
 * contraria: si algo aparece hoy y no estaba antes, empezarlo es justo lo que
 * el médico acaba de indicar.
 *
 * @param actual     la medicación de la nota firmada de hoy
 * @param previa     la que tenía antes; `null` = no se sabe
 * @returns `null` cuando no hay lista previa. **`null` no es «sin cambios».**
 */
export function cambiosDeMedicacion(
  actual: readonly MedicamentoParaComponer[] | undefined,
  previa: readonly { nombre?: unknown }[] | null | undefined,
): CambioDeMedicacion[] | null {
  if (!previa) return null

  const antes = new Set(previa.map(m => clave(m.nombre)).filter(Boolean))
  const cambios: CambioDeMedicacion[] = []

  for (const m of actual ?? []) {
    const nombre = texto(m.nombre)
    if (!nombre) continue
    const est = clave(m.estado)
    if (est === 'suspendida' || est === 'cancelada') {
      cambios.push({ nombre, tipo: 'suspendido' })
      continue
    }
    cambios.push({ nombre, tipo: antes.has(clave(nombre)) ? 'sin-cambio' : 'nuevo' })
  }

  return cambios
}

/**
 * COMPONER EL PAQUETE A PARTIR DE LA NOTA FIRMADA.
 *
 * ── LA COMPUERTA DE FIRMA VIVE AQUÍ, Y TAMBIÉN EN EL SERVIDOR ───────────────
 *
 * `POSTVISIT-GATE-001`: hasta hoy, la hoja del paciente se componía del
 * **borrador en curso**. Se montaba con el estado vivo de `medicamentos` y
 * `estudiosOrden`, y su única guarda era «no es nota de hospital». La cabecera
 * del módulo afirmaba que salía de material «ya revisado y firmado»: era
 * intención de diseño, no precondición.
 *
 * Aquí es precondición y **lanza**. Se lanza en vez de devolver `null` porque
 * componer un paquete de un borrador no es un caso vacío que haya que pintar
 * bonito: es un defecto de quien llama, y un defecto que devuelve `null` se
 * confunde con «esta consulta no tiene nada que entregar».
 *
 * Que esté firmada es **necesario y no suficiente**: el paquete que sale de
 * aquí nace `DRAFT` igual, y sólo `liberar()` lo mueve.
 *
 * ── POR QUÉ LA LLAMA EL SERVIDOR Y NO LA PANTALLA ───────────────────────────
 *
 * Porque el contenido clínico tiene que salir de la nota **guardada**, no del
 * estado del navegador. Si la pantalla compusiera y mandara el resultado, la
 * lista blanca de campos del servidor estaría validando la forma de algo que
 * ya viene del cliente: quien controle el navegador escribe lo que quiera en el
 * paquete que va a leer el paciente.
 *
 * ── LO QUE NO SE COMPONE ────────────────────────────────────────────────────
 *
 * `warningSigns` y `educationalMaterial` salen **vacíos**. Los signos de alarma
 * son indicación médica y el material educativo es evidencia curada: no hay de
 * dónde sacarlos sin inventar, y rellenarlos con «lo habitual» es la regla 1 de
 * seguridad clínica al revés. `documents` y `unansweredQuestions` los llenan
 * `DOCUMENTS-001` y `PATIENT-AI-001`.
 *
 * Módulo PURO: no lee la base, no escribe, no llama a ningún modelo.
 */
export function componerPaquete(e: EntradaDelPaquete): PaqueteDeVisita {
  const nota = e.nota
  const notaId = texto(nota?.id)
  if (!notaId) throw new Error('No se puede componer un paquete sin saber de qué nota sale')
  if (texto(nota.estado) !== 'firmada') {
    throw new Error('No se compone un paquete de una nota sin firmar: el paciente leería un borrador')
  }
  /* Una nota de internamiento no produce paquete: el paciente no se lleva nada
     a casa hoy, y «cómo tomarlo» sobre fármacos intravenosos confunde en vez de
     ayudar. Es la misma decisión que ya tomaba la hoja de la consulta. */
  if (texto(nota.internamientoId)) {
    throw new Error('Una nota de internamiento no compone paquete para el paciente')
  }

  const medicamentos = nota.medicamentos ?? []

  return {
    notaId,
    /* El resumen va LITERAL, tal como el médico lo firmó. Reescribirlo «para
       que se entienda mejor» es donde se colaría lo que él no dijo. */
    encounterSummary: texto(nota.resumenEjecutivo),
    medicationInstructions: medicamentos
      .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
      .filter(m => m.nombre && m.instruccion),
    medicationChanges: cambiosDeMedicacion(medicamentos, e.medicacionPrevia),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(nota.proximoSeguimiento),
    warningSigns: [],
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

export const POR_QUE_NO_SE_DEDUCE_UNA_SUSPENSION =
  'Que el médico no re-listara hoy un fármaco crónico no significa que lo haya ' +
  'suspendido. Decirle «suspendido» al paciente le hace dejar de tomarlo, y él ' +
  'no puede detectar el error. Sólo se reporta lo que el médico marcó.'

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
