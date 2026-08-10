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
 * - **No decide cuándo liberar.** Compone y sabe pasar a `RELEASED`, pero quién
 *   aprueba y cuándo lo decide el médico desde su consulta, y lo comprueba el
 *   servidor en `POST /api/paciente/paquete` (`POSTVISIT-001`).
 * - **No escribe en Firestore.** Es un módulo puro. Quien persiste es el
 *   servidor, que es el único que puede comprobar quién aprueba.
 * - **No compone `warningSigns` ni `educationalMaterial`.** La especificación
 *   los pide y el campo existe, pero **no hay de dónde sacarlos sin inventar**:
 *   los signos de alarma son indicación médica y el material educativo es
 *   evidencia curada. Se quedan vacíos y declarados, no rellenos con «lo
 *   habitual». Es la regla 1 de seguridad clínica.
 */

/**
 * ── LA COMPOSICIÓN LLEGÓ CON SU LLAMADOR ────────────────────────────────────
 *
 * `componerPaquete` y `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se RETIRARON el mismo día: el guardián de conexión
 * las cazó como lo que eran, motores con cuerpo real y sin un solo llamador.
 *
 * Su llamador es `POST /api/paciente/paquete`, la ruta que el médico usa para
 * entregarle el resumen al paciente, y llega en esta unidad — `POSTVISIT-001`.
 * Vuelven ahora, con quien las llame.
 */
import { comoTomarlo, type MedicamentoParaExplicar } from './como-se-lo-explico'
import { estadoDeOrden, claveFarmaco } from '@/lib/expediente/ordenes-medicamento'
import type { EstadoOrdenMedicamento } from '@/types/expediente'

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
  /**
   * QUIÉN aprobó, para la bitácora: el `uid`, no su correo.
   *
   * Este documento lo lee el PACIENTE a través de `/api/portal`, así que lo
   * que se guarde aquí acaba en su navegador. Un `uid` es opaco; el correo del
   * médico es un dato de contacto del equipo que no tiene por qué viajar a un
   * enlace que se reenvía por WhatsApp.
   */
  approvedBy: string | null
  /** El nombre con el que el médico firmó, que es lo que el paciente sí lee. */
  approvedByName?: string | null
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
export function liberar(
  p: PaqueteDeVisita,
  aprobadoPor: string,
  cuando: number,
  /** Cómo se llama quien aprueba, para que el paciente lea un nombre y no un uid. */
  nombreDeQuienAprueba?: string,
): PaqueteDeVisita {
  const quien = texto(aprobadoPor)
  if (!quien) throw new Error('No se puede liberar un paquete sin saber quién lo aprueba')
  if (!Number.isFinite(cuando) || cuando <= 0) throw new Error('No se puede liberar un paquete sin fecha de aprobación')
  return {
    ...p,
    estado: 'RELEASED',
    approvedBy: quien,
    approvedAt: cuando,
    approvedByName: texto(nombreDeQuienAprueba) || null,
  }
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
 * ── LA COMPOSICIÓN ──────────────────────────────────────────────────────────
 */

/** El medicamento tal como llega de la nota, con lo poco que hace falta aquí. */
export interface MedicamentoDeLaNota extends MedicamentoParaExplicar {
  nombre?: unknown
  estado?: EstadoOrdenMedicamento
}

/**
 * La nota firmada, reducida a lo que el paquete necesita.
 *
 * Se declara un tipo propio y no se importa `NotaMedica` entera para que este
 * módulo siga siendo puro y para que se vea de un vistazo **qué campos de la
 * nota llegan al paciente**: si un día alguien quiere añadir uno, tiene que
 * escribirlo aquí, y eso es una decisión visible en el diff.
 */
export interface NotaParaElPaquete {
  id: string
  /** `'firmada' | 'borrador' | 'cancelada'`. Se compara con `'firmada'`. */
  estado: string
  resumenEjecutivo?: string
  diagnosticos?: readonly { descripcion?: string }[]
  medicamentos?: readonly MedicamentoDeLaNota[]
  estudiosOrden?: readonly string[]
}

export interface EntradaDelPaquete {
  nota: NotaParaElPaquete
  /**
   * Los fármacos que el paciente ya tomaba ANTES de esta nota.
   *
   * `null` significa **no se sabe** —el expediente no tiene ninguna nota
   * firmada anterior— y NO «no tomaba nada». De esa distinción depende que el
   * paquete diga «nuevo» o no diga nada.
   */
  medicacionPrevia: readonly string[] | null
  /** Lo que el médico escribió como próxima cita o seguimiento, literal. */
  seguimiento?: string
  /** Cómo contactar al consultorio. Lo compone el llamador desde la config. */
  reglasDeContacto?: string
  /** Versión de ESTA entrega. La primera es 1; una corrección es la 2. */
  version: number
  idioma?: string
}

/** El mensaje exacto de la compuerta de firma. Lo comparten ruta y prueba. */
export const ERROR_NOTA_SIN_FIRMAR =
  'No se puede entregar el resumen de una consulta cuya nota no está firmada.'

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * ── LAS DOS REGLAS QUE LA GOBIERNAN, Y POR QUÉ ──────────────────────────────
 *
 * **1 · Sin lista previa no se afirma nada.** `previas === null` devuelve
 * `null`, no `[]`. «No aparecía antes» y «no sé qué había antes» son cosas
 * distintas, y confundirlas es tratar la ausencia de dato como dato de
 * ausencia (regla 4 de seguridad clínica).
 *
 * **2 · El silencio NO suspende.** Un fármaco que estaba antes y hoy no se
 * menciona **no sale como suspendido**: sale como nada. Es la misma regla que
 * ya gobierna `medicamentosVigentes` —«si hoy escribo una nota sin mencionar la
 * metformina, eso no significa que la haya dejado»— y aquí importa más, porque
 * quien lee es el paciente y él sí dejaría de tomarla.
 *
 * Sólo se dice `suspendido` cuando la orden lo dice: `suspendida` o
 * `cancelada`. Un fármaco `terminada` o `probablemente_terminada` no aparece:
 * el tipo no tiene esa casilla y no se inventa una traduciéndolo a otra.
 */
export function cambiosDeMedicacion(
  actuales: readonly MedicamentoDeLaNota[] | undefined,
  previas: readonly string[] | null,
): CambioDeMedicacion[] | null {
  if (previas === null) return null

  const antes = new Set(previas.map(n => claveFarmaco({ nombre: n })).filter(Boolean))
  const out: CambioDeMedicacion[] = []
  const vistos = new Set<string>()

  for (const m of actuales ?? []) {
    const nombre = texto(m.nombre)
    const clave = claveFarmaco({ nombre })
    if (!clave || vistos.has(clave)) continue
    vistos.add(clave)

    const estado = estadoDeOrden(m)
    if (estado === 'suspendida' || estado === 'cancelada') { out.push({ nombre, tipo: 'suspendido' }); continue }
    // `terminada`, `probablemente_terminada` y `borrador` no son un cambio que
    // este tipo sepa nombrar. Se callan en vez de traducirse a otra cosa.
    if (estado !== 'activa') continue
    out.push({ nombre, tipo: antes.has(clave) ? 'sin-cambio' : 'nuevo' })
  }

  return out
}

/**
 * ARMA EL PAQUETE A PARTIR DE LA NOTA FIRMADA.
 *
 * ── LA COMPUERTA DE FIRMA (POSTVISIT-GATE-001) ──────────────────────────────
 *
 * **Lanza si la nota no está firmada.** No devuelve un paquete marcado, no
 * avisa y sigue: se niega. Componer desde un borrador a medio dictar y confiar
 * en que alguien más lo detenga es exactamente cómo se entrega una dosis que
 * todavía no estaba revisada.
 *
 * Se lanza en vez de devolver `null` porque el llamador tiene que decidir qué
 * contestarle al médico, y un `null` silencioso se convierte en un `if` que
 * alguien olvida escribir.
 *
 * ── NADA SE REDACTA: TODO SE COPIA O SE COMPONE ─────────────────────────────
 *
 * `encounterSummary` es literal —el resumen que el médico firmó, o sus
 * diagnósticos—. Las instrucciones las compone `comoTomarlo`, que ya tiene su
 * golden y su compuerta de cifras. Los estudios van tal cual. **Aquí no hay
 * modelo de lenguaje.**
 *
 * ── LO QUE SE QUEDA VACÍO, Y SE QUEDA VACÍO A PROPÓSITO ─────────────────────
 *
 * `warningSigns` es indicación médica y `educationalMaterial` es evidencia
 * curada: no hay de dónde sacarlos sin inventarlos. `documents` lo llenará
 * `DOCUMENTS-001` y `unansweredQuestions` `PATIENT-AI-001`. Vacíos y
 * declarados vale; rellenos con «lo habitual» es la regla 1.
 *
 * ── UN SUSPENDIDO NO LLEVA INSTRUCCIÓN ──────────────────────────────────────
 *
 * `medicationInstructions` sólo lleva las órdenes **activas**. Una línea de
 * «cómo tomarlo» sobre un fármaco que el médico acaba de suspender le dice al
 * paciente que lo siga tomando, y aparecería justo debajo del renglón que dice
 * que lo deje.
 */
export function componerPaquete(e: EntradaDelPaquete): PaqueteDeVisita {
  const { nota } = e
  if (nota.estado !== 'firmada') throw new Error(ERROR_NOTA_SIN_FIRMAR)

  const meds = nota.medicamentos ?? []
  const resumen = texto(nota.resumenEjecutivo)
    || (nota.diagnosticos ?? []).map(d => texto(d.descripcion)).filter(Boolean).join(' · ')

  return {
    notaId: nota.id,
    encounterSummary: resumen,
    medicationInstructions: meds
      .filter(m => estadoDeOrden(m) === 'activa')
      .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
      .filter(m => m.nombre && m.instruccion),
    medicationChanges: cambiosDeMedicacion(meds, e.medicacionPrevia),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(e.seguimiento),
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(e.reglasDeContacto),
    language: texto(e.idioma) || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    approvedByName: null,
    version: e.version,
  }
}

/**
 * ¿Hay algo que entregarle al paciente?
 *
 * Un paquete sin resumen, sin medicamentos, sin estudios y sin seguimiento es
 * una hoja en blanco con membrete. Se comprueba ANTES de liberar: entregar
 * «nada» le hace abrir el enlace para no leer nada.
 */
export function tieneContenidoParaElPaciente(p: PaqueteDeVisita): boolean {
  return !!(
    p.encounterSummary
    || p.medicationInstructions.length
    || p.orders.length
    || p.followUp
  )
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
