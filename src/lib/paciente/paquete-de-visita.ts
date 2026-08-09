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
 * ── LA COMPOSICIÓN LLEGÓ CON SU LLAMADOR (POSTVISIT-001) ────────────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se QUITARON el mismo día: el guardián de conexión
 * las cazó como lo que eran, motores con cuerpo real y sin un solo llamador.
 * «Escrito, probado y sin conectar» es la familia de defectos más grande de
 * este proyecto, y añadirle una más a sabiendas —aunque fuera con una nota
 * explicándolo— era justo lo que este repositorio lleva meses persiguiendo.
 *
 * Vuelven ahora porque ya existe quien las llama: `/api/paciente/paquete`, que
 * es la ruta que el médico dispara al entregarle la visita a su paciente.
 */
import type { Medicamento } from '@/types/expediente'
import { estadoDeOrden, estaVigente, claveFarmaco } from '@/lib/expediente/ordenes-medicamento'
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
 * El único estado de nota del que se puede componer un paquete.
 *
 * Se nombra en vez de escribir `'firmada'` suelto porque de esta constante
 * cuelga la compuerta entera: un literal repetido en tres sitios se cambia en
 * dos.
 */
export const ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR = 'firmada'

/** Lo que hace falta de un medicamento para componer y para comparar. */
export interface MedicamentoDelEncuentro extends MedicamentoParaExplicar {
  estado?: Medicamento['estado']
}

/**
 * El encuentro, reducido a lo que el paciente puede leer.
 *
 * Todo sale de la nota **firmada**. Lo que la nota no diga, no aparece: no hay
 * un solo campo aquí que admita «lo habitual».
 */
export interface EncuentroParaElPaquete {
  notaId: string
  /** El estado REAL de la nota en la base. Sin `'firmada'` no se compone nada. */
  estadoNota: unknown
  /** `resumenEjecutivo` de la nota, literal. Vacío si el médico no escribió uno. */
  resumenEjecutivo?: unknown
  medicamentos?: readonly MedicamentoDelEncuentro[]
  /** `estudiosOrden` de la nota. */
  estudios?: readonly unknown[]
  /** Cuándo volver, tal como quedó escrito. Vacío si no se acordó nada. */
  proximaCita?: unknown
  /**
   * Lo que el paciente ya tomaba, según sus notas firmadas ANTERIORES.
   *
   * `null` significa **«no se sabe»**, y es distinto de `[]` («se sabe, y no
   * tomaba nada»). Un paciente de primera vez no tiene lista previa: decirle
   * que todos sus medicamentos son «nuevos» sería afirmar algo que nadie
   * comprobó.
   */
  medicacionPrevia?: readonly string[] | null
  /** Teléfono o instrucción de contacto del consultorio, literal. */
  contactoDelConsultorio?: unknown
  /** es-MX hoy. El paquete lo guarda para que `PATIENT-LANGUAGE-001` no adivine. */
  idioma?: string
}

/**
 * Qué cambió respecto de lo que ya tomaba — y qué NO se afirma.
 *
 * ── LAS DOS REGLAS QUE LO GOBIERNAN ─────────────────────────────────────────
 *
 * 1. **Sin lista previa no se afirma nada.** `previa === null` devuelve `null`,
 *    no una lista de «nuevos». «No aparecía antes» y «no sé qué había antes»
 *    son cosas distintas, y confundirlas es dato de ausencia (regla 4 de
 *    seguridad clínica).
 * 2. **El silencio no suspende.** Un fármaco que estaba en la lista previa y
 *    hoy no se menciona **no sale** como suspendido: significa que hoy no se
 *    habló de él. Es la misma regla que ya gobierna `medicamentosVigentes`, y
 *    aquí importa más: al paciente se le estaría diciendo que deje de tomar
 *    algo que su médico no suspendió.
 *
 * Sólo se marca `suspendido` lo que la nota declara suspendido o cancelado.
 */
export function cambiosDeMedicacion(
  previa: readonly string[] | null | undefined,
  actual: readonly MedicamentoDelEncuentro[] | undefined,
): CambioDeMedicacion[] | null {
  if (previa == null) return null
  const antes = new Set(previa.map(n => claveFarmaco({ nombre: String(n ?? '') })).filter(Boolean))
  const salida: CambioDeMedicacion[] = []
  for (const m of actual ?? []) {
    const nombre = texto(m.nombre)
    if (!nombre) continue
    const estado = estadoDeOrden({ estado: m.estado })
    if (estado === 'borrador') continue
    const tipo: CambioDeMedicacion['tipo'] =
      estado === 'suspendida' || estado === 'cancelada' ? 'suspendido'
        : antes.has(claveFarmaco({ nombre })) ? 'sin-cambio'
          : 'nuevo'
    salida.push({ nombre, tipo })
  }
  return salida
}

/**
 * Arma el paquete a partir del encuentro. **Determinista, sin modelo.**
 *
 * ── LA COMPUERTA DE FIRMA, AQUÍ Y NO SÓLO EN LA PANTALLA ────────────────────
 *
 * `POSTVISIT-GATE-001`: la hoja del paciente se componía del borrador EN CURSO.
 * El médico podía copiarla y entregarla a mitad del dictado, con una dosis que
 * todavía iba a corregir, y nada lo impedía.
 *
 * Por eso esto **lanza** en vez de devolver un paquete vacío o marcado: un
 * valor de retorno se ignora —basta con no mirar el campo— y una excepción no
 * se puede ignorar sin escribirlo. La compuerta vive en el motor, no en el
 * botón, para que ninguna pantalla futura pueda saltársela por descuido.
 *
 * ── NACE `DRAFT`, SIEMPRE ───────────────────────────────────────────────────
 *
 * Aunque la nota esté firmada. Firmar es hacia el expediente; liberar es hacia
 * el paciente. Para pasar a `RELEASED` hay que llamar a `liberar()`, que exige
 * saber quién aprueba.
 *
 * ── LO QUE SE QUEDA VACÍO, Y POR QUÉ ────────────────────────────────────────
 *
 * `warningSigns` es indicación médica y hoy **no hay campo donde el médico la
 * escriba**: se queda vacío, declarado, en vez de rellenarse con signos de
 * alarma «típicos» de un diagnóstico. `educationalMaterial` espera evidencia
 * curada; `documents`, la cartera de `DOCUMENTS-001`; `unansweredQuestions`,
 * las preguntas de `PATIENT-AI-001`.
 */
export function componerPaquete(e: EncuentroParaElPaquete): PaqueteDeVisita {
  if (e.estadoNota !== ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR) {
    throw new Error('No se compone un paquete de una nota sin firmar: lo que el paciente lee sale de material firmado')
  }
  const notaId = texto(e.notaId)
  if (!notaId) throw new Error('No se compone un paquete sin saber de qué nota sale')

  /**
   * SÓLO LO QUE ESTÁ VIGENTE lleva instrucción de cómo tomarlo.
   *
   * Un fármaco suspendido hoy no puede aparecer en «sus medicamentos» con su
   * pauta al lado: el paciente leería «tómelo cada 8 horas» de algo que su
   * médico acaba de suspender. Sale en `medicationChanges` como suspendido, que
   * es lo que de verdad pasó. Lo mismo con lo terminado o cancelado.
   */
  const medicationInstructions: MedicacionDelPaquete[] = []
  for (const m of e.medicamentos ?? []) {
    const nombre = texto(m.nombre)
    if (!nombre) continue
    if (!estaVigente({ estado: m.estado })) continue
    const instruccion = comoTomarlo(m)
    if (instruccion) medicationInstructions.push({ nombre, instruccion })
  }

  return {
    notaId,
    /* Literal. Reescribirlo «para que se entienda mejor» es donde entraría un
       matiz que el médico no firmó. */
    encounterSummary: texto(e.resumenEjecutivo),
    medicationInstructions,
    medicationChanges: cambiosDeMedicacion(e.medicacionPrevia, e.medicamentos),
    orders: (e.estudios ?? []).map(texto).filter(Boolean),
    followUp: texto(e.proximaCita),
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(e.contactoDelConsultorio),
    language: e.idioma || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}

/**
 * ¿Cambió lo que se le entregaría respecto de lo ya entregado?
 *
 * Sirve para que pulsar «Entregar» dos veces no le llene el teléfono al
 * paciente de copias idénticas de la misma visita — y para que un cambio real
 * (una adenda que corrige la dosis) sí produzca una versión nueva.
 *
 * Compara **sólo el contenido**, nunca la aprobación: dos paquetes con el mismo
 * texto son el mismo paquete aunque los libere otro médico en otro segundo.
 */
export function mismoContenido(a: PaqueteDeVisita, b: PaqueteDeVisita): boolean {
  const contenido = (p: PaqueteDeVisita) => JSON.stringify({
    notaId: p.notaId,
    encounterSummary: p.encounterSummary,
    medicationInstructions: p.medicationInstructions,
    medicationChanges: p.medicationChanges,
    orders: p.orders,
    followUp: p.followUp,
    warningSigns: p.warningSigns,
    educationalMaterial: p.educationalMaterial,
    documents: p.documents,
    unansweredQuestions: p.unansweredQuestions,
    clinicianContactRules: p.clinicianContactRules,
    language: p.language,
  })
  return contenido(a) === contenido(b)
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
