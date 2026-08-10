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
 * ── LA COMPOSICIÓN, Y QUIÉN LA LLAMA ─────────────────────────────────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` vivieron fuera de este
 * archivo hasta `POSTVISIT-001`, a propósito: se habían escrito una vez y el
 * guardián de conexión las cazó al instante — motor con cuerpo real, sin un
 * solo llamador. «Escrito, probado y sin conectar» es la familia de defectos
 * más grande de este proyecto, y añadir una más a sabiendas era exactamente lo
 * que el repositorio lleva meses persiguiendo. Se quitaron las dos.
 *
 * Su llamador es `POST /api/expediente/paquete-visita`, que sólo compone desde
 * una nota con `estado === 'firmada'` — este módulo lo exige y no confía en que
 * el llamador ya lo haya comprobado. Ver `.claude/rules/patient-facing-ai.md`
 * regla 4: firmar y liberar son dos actos, y componer un `DRAFT` no libera
 * nada — `liberar()`, abajo, sigue siendo el único camino a `RELEASED`.
 */

import { comoTomarlo } from './como-se-lo-explico'

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

/** Lo mínimo de una nota que hace falta para componer un paquete. */
export interface NotaParaComponerPaquete {
  id: string
  estado: string
  diagnosticos?: readonly { descripcion: string; tipo?: string }[]
  medicamentos?: readonly MedicamentoParaComponer[]
  estudiosOrden?: readonly unknown[]
  secciones?: readonly { key: string; value: string }[]
  resumenEjecutivo?: unknown
}

export interface MedicamentoParaComponer {
  nombre?: unknown
  dosis?: unknown
  via?: unknown
  frecuencia?: unknown
  duracion?: unknown
  estado?: string
}

/** Un fármaco reducido a su nombre, para comparar dos listas vigentes. */
export interface FarmacoPorNombre {
  nombre: string
}

/**
 * ¿Qué cambió respecto de la visita anterior?
 *
 * Compara dos listas YA VIGENTES (el resultado de `medicamentosVigentes` de
 * `ordenes-medicamento.ts`, antes y después de esta nota) — nunca la lista
 * cruda de la nota contra la lista previa. Esa es la trampa: un fármaco
 * crónico que hoy no se mencionó sigue vigente por el propio algoritmo de
 * `medicamentosVigentes` («el silencio no es dato de ausencia»), así que sólo
 * cae de la lista DESPUÉS cuando esta nota lo cambió de estado de verdad —
 * comparar contra la nota cruda lo habría marcado «suspendido» por no
 * repetirlo, que es justo el dato de ausencia que la regla 4 prohíbe.
 *
 * `null` cuando no hay lista previa: «no sé qué había antes» no es lo mismo
 * que «no había nada», y de ahí no se afirma un cambio.
 */
export function cambiosDeMedicacion(
  vigentesDespues: readonly FarmacoPorNombre[],
  vigentesAntes: readonly FarmacoPorNombre[] | null,
): CambioDeMedicacion[] | null {
  if (vigentesAntes === null) return null
  const clave = (s: string) => s.trim().toLowerCase()
  const despues = new Map<string, string>()
  for (const m of vigentesDespues) {
    const k = clave(texto(m.nombre))
    if (k) despues.set(k, texto(m.nombre))
  }
  const antes = new Map<string, string>()
  for (const m of vigentesAntes) {
    const k = clave(texto(m.nombre))
    if (k) antes.set(k, texto(m.nombre))
  }
  const out: CambioDeMedicacion[] = []
  for (const [k, nombre] of despues) out.push({ nombre, tipo: antes.has(k) ? 'sin-cambio' : 'nuevo' })
  for (const [k, nombre] of antes) if (!despues.has(k)) out.push({ nombre, tipo: 'suspendido' })
  return out
}

export interface ComponerPaqueteOpts {
  /** `medicamentosVigentes` sobre las notas ANTERIORES a ésta. `null` = no se pudo determinar. */
  medicacionVigenteAntes: readonly FarmacoPorNombre[] | null
  /** `medicamentosVigentes` incluyendo ya esta nota. Lo calcula el llamador: este módulo no lee Firestore. */
  medicacionVigenteDespues: readonly FarmacoPorNombre[]
  /** De dónde sale el consultorio si el paciente tiene dudas. Nunca inventado: lo trae la config de la clínica. */
  clinicianContactRules: string
  language?: string
}

/**
 * Arma un `PaqueteDeVisita` en `DRAFT` a partir de una nota firmada.
 *
 * Exige `estado === 'firmada'` y no confía en que el llamador ya lo haya
 * comprobado: componer desde un borrador es exactamente lo que el §1 de
 * `patient-facing-ai.md` prohíbe (nivel 6 de las fuentes es «nota firmada»,
 * no «nota en curso»).
 *
 * Nace `DRAFT` siempre. Liberar es un acto aparte — `liberar()`, arriba.
 */
export function componerPaquete(nota: NotaParaComponerPaquete, opts: ComponerPaqueteOpts): PaqueteDeVisita {
  if (nota.estado !== 'firmada') {
    throw new Error('Sólo se compone un paquete de la visita a partir de una nota firmada')
  }

  const diagnosticosRelevantes = (nota.diagnosticos ?? []).filter(d => d.tipo !== 'descartado')
  const encounterSummary =
    diagnosticosRelevantes.map(d => texto(d.descripcion)).filter(Boolean).join('; ') ||
    texto(nota.resumenEjecutivo)

  const medicamentosVigentesDeLaNota = (nota.medicamentos ?? []).filter(m => (m.estado ?? 'activa') === 'activa')
  const medicationInstructions: MedicacionDelPaquete[] = medicamentosVigentesDeLaNota
    .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
    .filter(m => m.nombre && m.instruccion)

  const seccionPlan = (nota.secciones ?? []).find(s => s.key === 'plan')

  return {
    notaId: nota.id,
    encounterSummary,
    medicationInstructions,
    medicationChanges: cambiosDeMedicacion(opts.medicacionVigenteDespues, opts.medicacionVigenteAntes),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(seccionPlan?.value),
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(opts.clinicianContactRules),
    language: opts.language ?? 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}
