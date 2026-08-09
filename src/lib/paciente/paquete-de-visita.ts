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
 *   los signos de alarma son indicación médica —se copian si el médico los
 *   escribió, y sólo entonces— y el material educativo es evidencia curada. Se
 *   quedan vacíos y declarados, no rellenos con «lo habitual». Es la regla 1 de
 *   seguridad clínica.
 */
import { comoTomarlo, type MedicamentoParaExplicar } from './como-se-lo-explico'

/**
 * ── LA COMPOSICIÓN LLEGÓ EN `POSTVISIT-001`, CON QUIEN LA LLAMA ─────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se **quitaron el mismo día**: el guardián de
 * conexión las cazó como motores con cuerpo real y sin un solo llamador, y
 * «escrito, probado y sin conectar» es la familia de defectos más grande de
 * este repositorio.
 *
 * Vuelven ahora porque ya existe quien las llame: `/api/paciente/paquete`, la
 * ruta que el médico usa para revisar y liberar. No antes.
 */

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

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]

/* ──────────────────────────────────────────────────────────────────────────
   LA COMPUERTA DE FIRMA — `POSTVISIT-GATE-001`
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Lo que hace falta saber de la nota para decidir si de ella puede salir algo
 * que lea un paciente. Deliberadamente **no es** `NotaMedica`: este módulo es
 * puro y no debe arrastrar el modelo entero del expediente.
 */
export interface NotaParaElPaquete {
  id?: unknown
  /** `'firmada'` es el único valor que abre la compuerta. */
  estado?: unknown
  tipo?: unknown
  /** Si la nota cuelga de un internamiento, el paciente no se va a casa hoy. */
  internamientoId?: unknown
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

export type Veredicto = { ok: true } | { ok: false; motivo: string }

/**
 * Tipos de nota que describen a un paciente **internado**.
 *
 * Misma decisión que ya tomó `HojaParaElPaciente` en la consulta: una hoja de
 * «cómo tomarlo» sobre fármacos intravenosos de UCI confunde en vez de ayudar,
 * porque hoy el paciente no se lleva nada a casa. La lista es **vocabulario, no
 * criterio** (regla 5 de seguridad clínica): que falte un tipo significa que ese
 * caso no se vigila por aquí, y por eso `internamientoId` se comprueba aparte —
 * es la señal estructural, y no depende de acertar con el nombre del tipo.
 */
const TIPOS_DE_INTERNADO: readonly string[] = [
  'ingreso_hospitalario', 'evolucion_hospitalaria', 'egreso_hospitalario',
  'nota_uci', 'uci', 'interconsulta_hospitalaria',
]

/**
 * ¿Puede componerse un paquete de visita a partir de esta nota?
 *
 * **Ésta es la compuerta de firma**, y se escribe como función con nombre por
 * la misma razón que `visibleParaElPaciente`: una comprobación con nombre se
 * puede exigir en una prueba; un `if` suelto dentro de una ruta se olvida en la
 * segunda ruta que se escriba.
 *
 * Devuelve el **motivo** y no un booleano porque el llamador es una pantalla
 * del médico, y «no se puede» sin decir por qué es lo que hace que alguien
 * pulse tres veces y se rinda.
 */
export function puedeComponerse(n: NotaParaElPaquete): Veredicto {
  if (texto(n.estado) !== 'firmada') {
    return { ok: false, motivo: 'La nota todavía no está firmada. Un borrador no puede llegarle al paciente.' }
  }
  if (!texto(n.id)) {
    return { ok: false, motivo: 'La nota no tiene identificador: el paquete no podría decir de dónde salió.' }
  }
  if (texto(n.internamientoId) || TIPOS_DE_INTERNADO.includes(texto(n.tipo))) {
    return { ok: false, motivo: 'Es una nota de hospitalización: el paciente no se va a casa con estas indicaciones.' }
  }
  return { ok: true }
}

/* ──────────────────────────────────────────────────────────────────────────
   QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR
   ────────────────────────────────────────────────────────────────────────── */

/** Para comparar nombres de fármaco: sin acentos, sin mayúsculas, sin espacios de más. */
const claveDeFarmaco = (v: unknown): string =>
  texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

/**
 * Compara la medicación de hoy contra la que el paciente ya tenía.
 *
 * ── LA REGLA QUE GOBIERNA ESTA FUNCIÓN ──────────────────────────────────────
 *
 * **Sin lista previa no se afirma nada.** `previos === undefined` devuelve
 * `null`, no `[]`: «no aparecía antes» y «no sé qué había antes» son cosas
 * distintas, y confundirlas es exactamente dato de ausencia (regla 4 de
 * seguridad clínica). Una lista vacía **sí** es un dato —el paciente no tomaba
 * nada— y por eso `[]` no se trata como desconocido.
 *
 * ── POR QUÉ «SUSPENDIDO» NO SE LE DICE AL PACIENTE SIN QUE ALGUIEN LO VEA ───
 *
 * Que un fármaco no aparezca en la nota de hoy **no prueba** que el médico lo
 * haya suspendido: pudo no reescribirlo. Por eso este cálculo no llega solo al
 * paciente: nace dentro de un paquete `DRAFT`, el médico lo lee en su pantalla
 * y sólo existe para el paciente si él lo libera. La aprobación humana es lo
 * que convierte una inferencia en una indicación.
 */
export function cambiosDeMedicacion(
  deHoy: readonly { nombre?: unknown }[],
  previos: readonly { nombre?: unknown }[] | null | undefined,
): CambioDeMedicacion[] | null {
  if (!Array.isArray(previos)) return null

  const hoy = new Map<string, string>()
  for (const m of deHoy ?? []) {
    const k = claveDeFarmaco(m?.nombre)
    if (k) hoy.set(k, texto(m?.nombre))
  }
  const antes = new Map<string, string>()
  for (const m of previos) {
    const k = claveDeFarmaco(m?.nombre)
    if (k) antes.set(k, texto(m?.nombre))
  }

  const out: CambioDeMedicacion[] = []
  for (const [k, nombre] of hoy) out.push({ nombre, tipo: antes.has(k) ? 'sin-cambio' : 'nuevo' })
  for (const [k, nombre] of antes) if (!hoy.has(k)) out.push({ nombre, tipo: 'suspendido' })
  return out
}

/* ──────────────────────────────────────────────────────────────────────────
   LA COMPOSICIÓN
   ────────────────────────────────────────────────────────────────────────── */

export interface EntradaDelPaquete {
  nota: NotaParaElPaquete
  /**
   * La medicación que el paciente ya tenía. **Omitirla no es decir que no
   * había**: se propaga como `null` a `medicationChanges`.
   */
  medicacionPrevia?: readonly { nombre?: unknown }[] | null
  /** Fecha o texto del próximo seguimiento, tal como lo escribió el médico. */
  proximoSeguimiento?: unknown
  /**
   * Signos de alarma **escritos por el médico**. Si no escribió ninguno, van
   * vacíos: son indicación médica y no se componen (regla 1).
   */
  signosDeAlarma?: readonly unknown[]
  /** Teléfono del consultorio, para decirle a quién llamar. */
  telefonoDelConsultorio?: unknown
  /** Sube de uno en uno cada vez que se libera una corrección. */
  version?: number
}

/**
 * Cómo se le dice al paciente a quién llamar.
 *
 * No es una indicación clínica: es la vía de contacto y el aviso de urgencia
 * que la especificación pide en `clinicianContactRules` y que la superficie del
 * paciente ya enseña palabra por palabra. Se compone aquí para que la digan
 * igual la pantalla y el paquete guardado.
 */
export function comoContactar(telefono: unknown): string {
  const tel = texto(telefono)
  const llamar = tel
    ? `Si tienes dudas sobre tu tratamiento, llama a tu consultorio: ${tel}.`
    : 'Si tienes dudas sobre tu tratamiento, comunícate con tu consultorio.'
  return `${llamar} Si es una urgencia —dolor en el pecho, dificultad para respirar, síntomas neurológicos— no esperes respuesta por aquí: acude a urgencias o llama al 911.`
}

/**
 * Arma el paquete a partir de una nota **firmada**. Nace `DRAFT`, siempre.
 *
 * ── DE DÓNDE SALE CADA LÍNEA ────────────────────────────────────────────────
 *
 * De campos que el médico ya revisó y firmó, y **compuestas**, no generadas:
 * la instrucción de cada medicamento la escribe `comoTomarlo`, que lleva desde
 * REG-242 con la garantía de que ninguna cifra puede aparecer si no está en la
 * nota. Aquí no entra un modelo de lenguaje. Ninguno.
 *
 * ── LO QUE SE QUEDA VACÍO, Y POR QUÉ ES CORRECTO ────────────────────────────
 *
 * `warningSigns` sólo lleva lo que el médico escribió. `educationalMaterial`,
 * `documents` y `unansweredQuestions` van vacíos hasta que existan sus unidades
 * (`DOCUMENTS-001`, `PATIENT-AI-001`). Rellenarlos con «lo habitual» es el
 * fallo más caro posible aquí: no rompe ninguna prueba y sale con el membrete
 * del médico.
 *
 * @throws si la nota no pasa `puedeComponerse`. Se lanza en vez de devolver un
 * paquete a medias porque un paquete es un documento que se le enseña a alguien
 * que no puede detectar el error: o está bien construido, o no existe.
 */
export function componerPaquete(e: EntradaDelPaquete): PaqueteDeVisita {
  const v = puedeComponerse(e.nota)
  if (!v.ok) throw new Error(v.motivo)

  const meds = (e.nota.medicamentos ?? [])
    .map(m => ({ nombre: texto(m?.nombre), instruccion: comoTomarlo(m) }))
    .filter(m => m.nombre && m.instruccion)

  return {
    notaId: texto(e.nota.id),
    encounterSummary: texto(e.nota.resumenEjecutivo),
    medicationInstructions: meds,
    medicationChanges: cambiosDeMedicacion(e.nota.medicamentos ?? [], e.medicacionPrevia),
    orders: (e.nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(e.proximoSeguimiento),
    warningSigns: (e.signosDeAlarma ?? []).map(texto).filter(Boolean),
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: comoContactar(e.telefonoDelConsultorio),
    language: 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: Number.isFinite(e.version) && (e.version as number) > 0 ? Math.floor(e.version as number) : 1,
  }
}

export const POR_QUE_NACE_DRAFT_AUNQUE_LA_NOTA_ESTE_FIRMADA =
  'Firmar es un acto medicolegal hacia el expediente; liberar es un acto de ' +
  'comunicación hacia el paciente. Se pueden hacer en el mismo gesto y se ' +
  'registran aparte, porque un día el médico querrá firmar sin liberar todavía.'

export const POR_QUE_SIN_LISTA_PREVIA_ES_NULL =
  '«No aparecía antes» y «no sé qué había antes» son cosas distintas. ' +
  'Confundirlas es dato de ausencia, y del lado del paciente el lector no ' +
  'puede detectar el error.'
