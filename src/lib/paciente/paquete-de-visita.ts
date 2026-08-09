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
 * ── LA COMPOSICIÓN LLEGÓ CON QUIEN LA LLAMA (V9 `POSTVISIT-001`) ─────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se retiraron el mismo día: el guardián de conexión
 * las cazó como motores con cuerpo real y **sin un solo llamador**.
 *
 * Vuelven ahora porque ya existe quien las llama: `POST /api/paciente/paquete`,
 * la ruta que el médico usa para revisar y liberar. Ése era el trato.
 */

import { comoTomarlo, pautaEnLlano, type MedicamentoParaExplicar } from './como-se-lo-explico'

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
 *
 * ── POR QUÉ HAY UN CUARTO CASO: `modificado` ────────────────────────────────
 *
 * La declaración original tenía tres —`nuevo`, `suspendido`, `sin-cambio`— y al
 * escribir la comparación de verdad se vio que **con tres hay que mentir**: el
 * cotejo es por nombre, así que «metformina 850 mg» y «metformina 425 mg» caen
 * las dos en el mismo nombre y el paciente leería **«sin cambio»** sobre una
 * dosis que su médico acaba de bajar a la mitad.
 *
 * Un «sin cambio» falso es peor que no decir nada: el paciente que lo lee deja
 * de comprobar la caja. Por eso, cuando el nombre coincide y **la pauta no**
 * —dosis, vía, frecuencia o duración—, el cambio es `modificado`.
 */
export interface CambioDeMedicacion {
  nombre: string
  tipo: 'nuevo' | 'modificado' | 'suspendido' | 'sin-cambio'
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

/* ═══════════════════════════════════════════════════════════════════════════
   LA COMPOSICIÓN — `POSTVISIT-001`
   ═══════════════════════════════════════════════════════════════════════════ */

/** Idioma inicial de la superficie del paciente. `PATIENT-LANGUAGE-001` abrirá el resto. */
export const IDIOMA_POR_DEFECTO = 'es-MX'

/** Por qué una nota NO puede convertirse en paquete. Cada motivo es una compuerta. */
export type MotivoNoComponible =
  /** La nota no está firmada. Un borrador clínico no se le enseña al paciente. */
  | 'sin-firma'
  /** Nota de hospital o UCI: el paciente no se lleva nada a casa hoy. */
  | 'paciente-internado'
  /** Sin `id` no hay a qué nota referirse, y el paquete referencia, no copia. */
  | 'sin-nota'

/**
 * El fallo de composición es un TIPO, no un texto.
 *
 * La ruta traduce cada motivo a su respuesta HTTP, y mapear por el mensaje del
 * error es la forma más fácil de que un cambio de redacción se convierta en un
 * 500 donde había un 409.
 */
export class PaqueteNoComponible extends Error {
  constructor(public readonly motivo: MotivoNoComponible, mensaje: string) {
    super(mensaje)
    this.name = 'PaqueteNoComponible'
  }
}

/** La nota firmada, con lo poco que el paquete necesita de ella. */
export interface NotaParaElPaquete {
  id: string
  estado: string
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
  /** Presente ⇒ nota de internamiento. */
  internamientoId?: unknown
}

/**
 * Lo que NO está en la nota y hace falta para el paquete.
 *
 * Va aparte a propósito: son datos de otras fuentes —el expediente del paciente,
 * la configuración del consultorio— y quien los lee es el servidor. Este módulo
 * sigue siendo puro.
 */
export interface ContextoDelPaquete {
  /** Lo que el médico escribió como próximo seguimiento. Literal, sin reescribir. */
  proximoSeguimiento?: unknown
  /** Cómo contactar al consultorio. Sale de la configuración; no se inventa. */
  comoContactar?: unknown
  /**
   * La medicación de la visita ANTERIOR.
   *
   * `undefined`/`null` = **no se sabe qué había antes**, y eso no es «no había
   * nada». Un arreglo vacío sí afirma algo: la visita anterior no dejó
   * medicación. La diferencia decide entre `medicationChanges: null` y una
   * lista de altas.
   */
  medicacionPrevia?: readonly MedicamentoParaExplicar[] | null
  idioma?: string
}

/** Sin acentos, sin mayúsculas y sin espacios de más: para COMPARAR, nunca para mostrar. */
function clave(v: unknown): string {
  return texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

/**
 * Qué cambió respecto de la visita anterior.
 *
 * **Sin lista previa devuelve `null`**, y ésa es la regla que da sentido al
 * campo: «no aparecía antes» y «no sé qué había antes» son cosas distintas, y
 * confundirlas es tratar la ausencia de dato como dato de ausencia (regla 4 de
 * seguridad clínica).
 *
 * El orden de salida es el del riesgo para el paciente, no el alfabético: lo que
 * empieza, lo que cambió, lo que se suspende y al final lo que sigue igual.
 */
export function cambiosDeMedicacion(
  actual: readonly MedicamentoParaExplicar[] | undefined,
  previa: readonly MedicamentoParaExplicar[] | null | undefined,
): CambioDeMedicacion[] | null {
  if (!previa) return null

  const conNombre = (l: readonly MedicamentoParaExplicar[]) => l.filter(m => texto(m.nombre))
  const hoy = conNombre(actual ?? [])
  const antes = conNombre(previa)

  const antesPorClave = new Map(antes.map(m => [clave(m.nombre), m]))
  const hoyClaves = new Set(hoy.map(m => clave(m.nombre)))

  const nuevos: CambioDeMedicacion[] = []
  const modificados: CambioDeMedicacion[] = []
  const iguales: CambioDeMedicacion[] = []

  for (const m of hoy) {
    const nombre = texto(m.nombre)
    const anterior = antesPorClave.get(clave(m.nombre))
    if (!anterior) { nuevos.push({ nombre, tipo: 'nuevo' }); continue }
    /* Mismo nombre y distinta PAUTA = cambio. Ver la nota del tipo: con tres
       casos habría que llamarlo «sin cambio», y eso es falso.

       Se cotejan las pautas normalizadas y no las líneas enteras: la línea lleva
       el nombre dentro, y entonces «Losartan» y «Losartán» salían como cambio de
       tratamiento por un acento. */
    if (clave(pautaEnLlano(anterior)) !== clave(pautaEnLlano(m))) modificados.push({ nombre, tipo: 'modificado' })
    else iguales.push({ nombre, tipo: 'sin-cambio' })
  }

  const suspendidos: CambioDeMedicacion[] = antes
    .filter(m => !hoyClaves.has(clave(m.nombre)))
    .map(m => ({ nombre: texto(m.nombre), tipo: 'suspendido' as const }))

  return [...nuevos, ...modificados, ...suspendidos, ...iguales]
}

/**
 * Arma el paquete a partir de una nota FIRMADA. Determinista, sin modelo.
 *
 * ── LA COMPUERTA VIVE AQUÍ, NO SÓLO EN LA RUTA ──────────────────────────────
 *
 * `POST /api/paciente/paquete` comprueba la firma antes de llamar, y aun así
 * esta función vuelve a comprobarla. No es redundancia por gusto: el día que
 * alguien escriba un segundo llamador —un trabajo por lotes, una migración— la
 * compuerta tiene que viajar con el motor. Una comprobación que sólo vive en el
 * llamador se pierde en el segundo llamador.
 *
 * El paquete nace `DRAFT` **siempre**, aunque la nota esté firmada: firmar va
 * hacia el expediente y liberar va hacia el paciente. Quien libera es `liberar`,
 * y sólo el servidor sabe quién aprueba.
 */
export function componerPaquete(nota: NotaParaElPaquete, ctx: ContextoDelPaquete = {}): PaqueteDeVisita {
  const notaId = texto(nota?.id)
  if (!notaId) {
    throw new PaqueteNoComponible('sin-nota', 'Un paquete referencia a una nota: sin `notaId` no hay paquete')
  }
  if (nota.estado !== 'firmada') {
    throw new PaqueteNoComponible(
      'sin-firma',
      'No se compone el paquete de una nota sin firmar: sería enseñarle al paciente un borrador clínico',
    )
  }
  if (texto(nota.internamientoId)) {
    throw new PaqueteNoComponible(
      'paciente-internado',
      'Un paciente internado no se lleva instrucciones a casa: la hoja de «cómo tomarlo» sobre fármacos intravenosos confunde en vez de ayudar',
    )
  }

  const medicamentos = (nota.medicamentos ?? []).filter(m => texto(m.nombre))

  return {
    notaId,
    encounterSummary: texto(nota.resumenEjecutivo),
    medicationInstructions: medicamentos
      .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
      .filter(m => m.instruccion),
    medicationChanges: cambiosDeMedicacion(medicamentos, ctx.medicacionPrevia),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(ctx.proximoSeguimiento),
    /* Indicación médica y evidencia curada: o existen firmadas, o van vacías.
       Rellenarlas con «lo habitual» es la regla 1 de seguridad clínica al revés. */
    warningSigns: [],
    educationalMaterial: [],
    /* Los llena `DOCUMENTS-001` y `PATIENT-AI-001`. Vacíos y declarados. */
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(ctx.comoContactar),
    language: texto(ctx.idioma) || IDIOMA_POR_DEFECTO,
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}

/**
 * ¿Tiene algo que decirle al paciente?
 *
 * Es el mismo criterio que `HojaParaElPaciente` aplica antes de pintarse: una
 * hoja vacía le hace leer al paciente una línea que no le dice nada. Liberar un
 * paquete vacío es además peor que no liberarlo — le llega un aviso de que su
 * médico le mandó algo, y al abrirlo no hay nada.
 *
 * `medicationChanges` NO cuenta como contenido: sin nada más, una lista de
 * «sin cambio» no es un mensaje.
 */
export function tieneAlgoQueDecir(p: PaqueteDeVisita): boolean {
  return !!(
    p.encounterSummary ||
    p.medicationInstructions.length ||
    p.orders.length ||
    p.followUp ||
    p.warningSigns.length ||
    p.documents.length
  )
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
