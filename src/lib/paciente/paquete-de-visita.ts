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
 * ── LA COMPOSICIÓN LLEGÓ CON QUIEN LA LLAMA (V9 · POSTVISIT-001) ────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se **quitaron el mismo día**: el guardián de
 * conexión las cazó como motores con cuerpo real y cero llamadores, y
 * «escrito, probado y sin conectar» es la familia de defectos más grande de
 * este repositorio —32 de 127 regresiones—.
 *
 * Vuelven ahora porque ya existe quien las llame: `POST /api/expediente/
 * paquete-visita`, la ruta que el médico dispara al liberar. Y vuelven con la
 * compuerta que les faltaba: **de una nota que no está firmada no se compone
 * nada**.
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
 *
 * ── POR QUÉ HAY UN CUARTO TIPO, `ajustado` ──────────────────────────────────
 *
 * `PATIENT-COMPANION-001` declaró tres —nuevo, suspendido, sin-cambio— sin la
 * composición delante. Al escribirla se vio el hueco: un fármaco que sigue en
 * las dos listas **con otra dosis** caía en `sin-cambio`, y eso no es un
 * matiz. «Sigue igual» sobre un medicamento cuya dosis se acaba de duplicar es
 * la frase que hace que el paciente siga tomando la vieja.
 *
 * Se compara la **instrucción compuesta entera** —nombre, dosis, vía,
 * frecuencia y duración—, no sólo el nombre: cualquier cosa que el paciente
 * tenga que hacer distinta entra por ahí.
 */
export interface CambioDeMedicacion {
  nombre: string
  tipo: 'nuevo' | 'suspendido' | 'ajustado' | 'sin-cambio'
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
 * De todos los paquetes de un paciente, **el último de cada consulta**.
 *
 * Un paquete liberado es inmutable: corregirlo es liberar una versión nueva,
 * igual que una adenda no reescribe la nota. Eso deja dos documentos de la
 * misma visita en la base, y **los dos pasan la compuerta** — el viejo se
 * liberó de verdad, con su aprobador y su fecha.
 *
 * Enseñarle al paciente los dos, uno al lado del otro, es exactamente cómo se
 * toma la dosis corregida y la equivocada el mismo día. El expediente conserva
 * las dos versiones —eso es la trazabilidad—; **el paciente ve la vigente**.
 */
export function ultimaVersionPorNota<T extends Pick<PaqueteDeVisita, 'notaId' | 'version'>>(
  paquetes: readonly T[],
): T[] {
  const porNota = new Map<string, T>()
  for (const p of paquetes) {
    const previo = porNota.get(p.notaId)
    if (!previo || (p.version ?? 0) > (previo.version ?? 0)) porNota.set(p.notaId, p)
  }
  return [...porNota.values()]
}

/** Comparación de nombres de fármaco: sin acentos, sin mayúsculas, sin espacios de más. */
const claveDeFarmaco = (v: unknown): string =>
  texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

/**
 * Qué cambió respecto de la visita anterior.
 *
 * **`undefined` como lista previa devuelve `null`**, y ésa es toda la razón de
 * ser de esta firma. «No aparecía antes» y «no sé qué había antes» son cosas
 * distintas: la primera se le puede decir al paciente, la segunda no. Un
 * arreglo vacío sí es conocimiento —la visita anterior existió y no llevaba
 * medicación—, y por eso no se confunde con la ausencia de lista.
 */
export function cambiosDeMedicacion(
  actuales: readonly MedicamentoParaExplicar[],
  previas: readonly MedicamentoParaExplicar[] | undefined,
): CambioDeMedicacion[] | null {
  if (!previas) return null

  /* La instrucción se compara NORMALIZADA: `AMOXICILINA` y `Amoxicilina` son
     el mismo fármaco, y decirle al paciente que uno se suspendió y otro empezó
     —el mismo día, por una mayúscula— es peor que no decirle nada. */
  const antes = new Map<string, string>()
  for (const m of previas) {
    const k = claveDeFarmaco(m?.nombre)
    if (k) antes.set(k, claveDeFarmaco(comoTomarlo(m)))
  }

  const salida: CambioDeMedicacion[] = []
  const vistos = new Set<string>()

  for (const m of actuales) {
    const k = claveDeFarmaco(m?.nombre)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    const nombre = texto(m?.nombre)
    if (!antes.has(k)) { salida.push({ nombre, tipo: 'nuevo' }); continue }
    salida.push({ nombre, tipo: antes.get(k) === claveDeFarmaco(comoTomarlo(m)) ? 'sin-cambio' : 'ajustado' })
  }

  for (const m of previas) {
    const k = claveDeFarmaco(m?.nombre)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    salida.push({ nombre: texto(m?.nombre), tipo: 'suspendido' })
  }

  return salida
}

/** Lo que la ruta le pasa a la composición: una nota tal como está en la base. */
export interface NotaParaComponer {
  id?: unknown
  estado?: unknown
  resumenEjecutivo?: unknown
  diagnosticos?: readonly { descripcion?: unknown }[]
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

/** Lo que la composición NO puede sacar de la nota y quien llama tiene que traer. */
export interface ContextoDelPaquete {
  /**
   * La medicación de la visita anterior. **Omitir** —no `[]`— cuando no se
   * sabe: de ahí sale el `null` de `medicationChanges`.
   */
  medicacionPrevia?: readonly MedicamentoParaExplicar[]
  /** El seguimiento que el médico indicó en ESTA consulta. Vive en su tarea. */
  seguimiento?: unknown
  /** Cómo contactar al consultorio. Dato administrativo, no indicación clínica. */
  contactoDelConsultorio?: unknown
  /** es-MX hoy. `PATIENT-LANGUAGE-001` traerá los demás. */
  idioma?: string
}

/** El error de la compuerta de firma, con nombre para poder exigirlo en una prueba. */
export const NOTA_SIN_FIRMAR = 'De una nota sin firmar no se compone un paquete para el paciente'

/**
 * Compone el paquete de una visita. **Determinista, sin modelo de lenguaje.**
 *
 * ── LA COMPUERTA DE FIRMA (`POSTVISIT-GATE-001`) ────────────────────────────
 *
 * Se niega si la nota no está `firmada`, y ésa es la reparación que da nombre a
 * esta unidad. Hasta hoy la hoja del paciente se componía **del borrador en
 * curso**: el médico podía imprimirle y entregarle en mano un tratamiento que
 * todavía estaba escribiendo, y que diez minutos después sería otro.
 *
 * Se lanza en vez de devolver `null` a propósito. Un `null` se ignora con un
 * `?.` y el camino sigue; lo que este error protege es que **no exista una
 * segunda puerta** por la que un borrador llegue al paciente.
 *
 * ── DE DÓNDE SALE CADA CAMPO, Y DE DÓNDE NO ─────────────────────────────────
 *
 * El resumen va **literal** del documento firmado. Reescribirlo «en palabras
 * más sencillas» es lo único que aquí podría inventar algo, y quien lo haría
 * sería un modelo: eso es `PATIENT-LANGUAGE-001` y `PATIENT-AI-001`, con las
 * defensas de §1 de `patient-facing-ai.md`, no esta función.
 *
 * Las instrucciones de los medicamentos las compone `como-se-lo-explico`, que
 * ya tiene la garantía probada: ninguna cifra puede aparecer si no está en la
 * nota, y una frecuencia que no divide 24 no se convierte en «veces al día».
 *
 * Y tres campos se quedan **vacíos y declarados**: los signos de alarma son
 * indicación médica —los escribe el médico o no existen—, el material
 * educativo es evidencia curada, y los documentos llegan con `DOCUMENTS-001`.
 * Rellenarlos con «lo habitual» es la regla 1 de seguridad clínica al revés.
 *
 * Nace `DRAFT` **siempre**: liberar es otro acto, y lo hace `liberar()`.
 */
export function componerPaquete(nota: NotaParaComponer, ctx: ContextoDelPaquete = {}): PaqueteDeVisita {
  const notaId = texto(nota?.id)
  if (!notaId) throw new Error('No se puede componer un paquete sin saber de qué nota sale')
  if (texto(nota?.estado) !== 'firmada') throw new Error(NOTA_SIN_FIRMAR)

  const medicamentos = (nota.medicamentos ?? []).filter(m => texto(m?.nombre))
  const diagnosticos = (nota.diagnosticos ?? []).map(d => texto(d?.descripcion)).filter(Boolean)

  return {
    notaId,
    /* El resumen firmado; si no lo hay, los diagnósticos, que también lo están. */
    encounterSummary: texto(nota.resumenEjecutivo) || diagnosticos.join(', '),
    medicationInstructions: medicamentos.map(m => ({
      nombre: texto(m?.nombre),
      instruccion: comoTomarlo(m),
    })),
    medicationChanges: cambiosDeMedicacion(medicamentos, ctx.medicacionPrevia),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(ctx.seguimiento),
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(ctx.contactoDelConsultorio),
    language: texto(ctx.idioma) || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
  }
}

/** Los cinco destinos del compañero. El orden es el de la especificación. */
export const DESTINOS_PACIENTE = ['hoy', 'preguntar', 'cuidado', 'documentos', 'perfil'] as const
export type DestinoPaciente = (typeof DESTINOS_PACIENTE)[number]
