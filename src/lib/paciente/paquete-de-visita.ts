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
 * ── `componerPaquete` Y `cambiosDeMedicacion` — POSTVISIT-001 ──────────────
 *
 * Se escribieron una vez en `PATIENT-COMPANION-001` y se retiraron de aquí: el
 * guardián de conexión (`scripts/calidad/motores-conectados.mjs`, REG-255) las
 * cazó al instante, motor con cuerpo real y sin un solo llamador. Su llamador
 * natural es la pantalla donde el médico revisa y libera, y esa pantalla no
 * existía todavía.
 *
 * Ahora sí: `POST /api/expediente/paquete-visita` (acción `liberar`) es el
 * llamador, y el botón de «Liberar al paciente» en la consulta
 * (`src/components/LiberarPaqueteAlPaciente.tsx`) es el camino desde `app/`.
 * Las dos llegan en el mismo commit que estas funciones — no antes, no en dos
 * pasos — precisamente para no repetir el defecto que las mantuvo fuera.
 *
 * `componerPaquete` sigue sin hacer I/O: recibe ya resuelto —por quien la
 * llama— **qué está vigente hoy** y **qué estaba vigente antes de esta nota**.
 * No decide eso aquí porque ya existe quien lo decide bien:
 * `medicamentosVigentes` (`src/lib/expediente/ordenes-medicamento.ts`), con su
 * regla de que el silencio no suspende un crónico. Repetir esa lógica aquí
 * sería la segunda fuente de verdad que el invariante nº1 prohíbe.
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

/** Para comparar «el mismo fármaco» sin que un acento o una mayúscula cuenten como dos. */
const claveFarmaco = (nombre: unknown): string =>
  texto(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Qué cambió, comparando dos listas ya resueltas de «lo vigente».
 *
 * `previas === null` es «no se pudo determinar», y se propaga tal cual: no es
 * lo mismo que «no había nada antes» (una primera consulta sí lo sabe con
 * certeza — cero fármacos previos — y ahí `previas` es `[]`, no `null`).
 * Confundir las dos cosas convertiría «no sé» en «no tomaba nada», que es
 * exactamente el dato de ausencia que la regla 4 de seguridad clínica prohíbe.
 *
 * Módulo PURO: no decide qué es «vigente» — eso ya lo decide
 * `medicamentosVigentes` (`ordenes-medicamento.ts`), con la regla de que el
 * silencio no suspende un crónico. Aquí sólo se comparan dos listas por nombre.
 */
export function cambiosDeMedicacion(
  actuales: readonly { nombre?: unknown }[],
  previas: readonly { nombre?: unknown }[] | null,
): CambioDeMedicacion[] | null {
  if (previas === null) return null

  const nombresPrevios = new Map(
    previas.map(p => [claveFarmaco(p.nombre), texto(p.nombre)] as const).filter(([k]) => k),
  )
  const nombresActuales = new Map(
    actuales.map(a => [claveFarmaco(a.nombre), texto(a.nombre)] as const).filter(([k]) => k),
  )
  const todasLasClaves = new Set([...nombresPrevios.keys(), ...nombresActuales.keys()])

  const cambios: CambioDeMedicacion[] = []
  for (const clave of todasLasClaves) {
    const enActual = nombresActuales.has(clave)
    const enPrevia = nombresPrevios.has(clave)
    const nombre = (nombresActuales.get(clave) ?? nombresPrevios.get(clave))!
    const tipo: CambioDeMedicacion['tipo'] = enActual && enPrevia ? 'sin-cambio' : enActual ? 'nuevo' : 'suspendido'
    cambios.push({ nombre, tipo })
  }
  return cambios.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Lo que hace falta para componer un paquete. Nada de esto se calcula aquí. */
export interface EntradaComposicion {
  notaId: string
  /**
   * Lo vigente HOY, ya resuelto por `medicamentosVigentes` sobre todas las
   * notas firmadas del paciente hasta e incluyendo ésta. No es «lo que
   * menciona esta nota»: un crónico que hoy no se tocó sigue vigente.
   */
  medicamentosVigentes: readonly MedicamentoParaExplicar[]
  /** Lo vigente ANTES de esta nota. `null` = no se pudo determinar. */
  medicamentosVigentesAntes: readonly { nombre?: unknown }[] | null
  /** Estudios pedidos en esta nota, tal como quedaron en la orden. */
  estudios?: readonly unknown[]
  /** El resumen ejecutivo YA escrito y firmado. No se redacta aquí. */
  resumenEncuentro?: unknown
  /** Fecha o texto de la próxima cita, si la hay. */
  proximaCita?: unknown
  /** Ya resuelto por quien llama (teléfono del consultorio, p. ej.). Puede ir vacío. */
  reglasDeContactoClinico?: string
  /** BCP-47. Hoy sólo hay es-MX; el paquete lo declara igual. */
  idioma?: string
  /** Lo decide quien persiste, contando paquetes previos de esta misma nota. */
  version: number
}

/**
 * Arma un `PaqueteDeVisita` en estado `DRAFT` a partir de material YA firmado.
 *
 * Determinista, sin modelo de lenguaje. Reutiliza `comoTomarlo` —la misma
 * función que ya usaba `HojaParaElPaciente`— para que la instrucción que ve el
 * paciente sea idéntica se componga desde donde se componga: una sola fuente
 * de «cómo se dice esto en español llano», no dos que puedan divergir.
 *
 * Nunca libera: eso es un acto aparte (`liberar`), y de quien decide cuándo —
 * el médico, en su pantalla — no de esta función.
 */
export function componerPaquete(e: EntradaComposicion): PaqueteDeVisita {
  const medicationInstructions: MedicacionDelPaquete[] = (e.medicamentosVigentes ?? [])
    .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
    .filter(m => m.nombre && m.instruccion)

  const medicationChanges = cambiosDeMedicacion(e.medicamentosVigentes ?? [], e.medicamentosVigentesAntes)

  const orders = (e.estudios ?? []).map(texto).filter(Boolean)

  return {
    notaId: e.notaId,
    encounterSummary: texto(e.resumenEncuentro),
    medicationInstructions,
    medicationChanges,
    orders,
    followUp: texto(e.proximaCita),
    /* Indicación médica: no hay de dónde sacarla sin interpretar texto libre
       (regla 1). Ver el header del archivo. */
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(e.reglasDeContactoClinico),
    language: texto(e.idioma) || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: e.version,
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
