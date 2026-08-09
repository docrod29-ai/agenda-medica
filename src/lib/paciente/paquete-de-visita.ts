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
 * ── LA COMPOSICIÓN VUELVE AQUÍ, CON SU LLAMADOR ─────────────────────────────
 *
 * `componerPaquete` y su ayudante `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se **retiraron el mismo día**: el guardián de
 * conexión las cazó como motores con cuerpo real y **sin un solo llamador**.
 *
 * «Escrito, probado y sin conectar» es la familia de defectos más grande de este
 * proyecto, y añadirle una más a sabiendas —aunque fuera con una nota
 * explicándolo— era exactamente lo que este repositorio lleva meses
 * persiguiendo.
 *
 * Vuelven ahora porque ahora existe quien las llame:
 * `/api/expediente/paquete-visita`, la ruta con la que el médico revisa y
 * libera. Un motor llega **con** su pantalla, no antes.
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
 * nuevo. Se calcula contra la medicación previa, y por eso exige que quien llame
 * le pase esa lista: **sin lista previa no se afirma nada**, porque «no aparecía
 * antes» y «no sé qué había antes» son cosas distintas y confundirlas es dato de
 * ausencia.
 *
 * ── POR QUÉ HAY UN CUARTO TIPO, `cambiado` ──────────────────────────────────
 *
 * Con sólo `nuevo · suspendido · sin-cambio`, la comparación se hace por
 * NOMBRE, y entonces un paciente cuya warfarina pasó de 2 mg a 10 mg lee
 * literalmente **«sin cambio»** junto a su warfarina. Es la peor frase posible
 * en el peor sitio posible: la lista dice la verdad sobre la lista —el fármaco
 * sigue— y miente sobre lo único que al paciente le importa, que es cuánto
 * tomar. Y se lo dice a alguien que no puede detectar el error.
 *
 * Por eso se compara el nombre **y la línea de instrucción ya compuesta**. Dos
 * hechos distintos, dos etiquetas distintas:
 *
 * - `sin-cambio` — estaba antes, sigue, **y se toma igual**.
 * - `cambiado`   — estaba antes, sigue, **y se toma distinto**.
 */
export interface CambioDeMedicacion {
  nombre: string
  tipo: 'nuevo' | 'suspendido' | 'sin-cambio' | 'cambiado'
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

/** El estado que una nota tiene que tener para poder componer un paquete. */
export const ESTADO_NOTA_FIRMADA = 'firmada'

/**
 * El mensaje de la compuerta de firma. Vive aquí y no dentro de la ruta para que
 * la pantalla del médico pueda decir lo mismo sin copiarlo.
 */
export const NO_SE_COMPONE_DE_UN_BORRADOR =
  'La nota todavía no está firmada. Un paquete sólo se compone de una nota ' +
  'firmada: lo que se le entrega al paciente no puede salir de un borrador.'

/** Lo que este módulo necesita de una nota. Deliberadamente poco. */
export interface NotaParaPaquete {
  id?: unknown
  /** Sólo `'firmada'` compone. Cualquier otra cosa es un borrador. */
  estado?: unknown
  resumenEjecutivo?: unknown
  diagnosticos?: readonly { descripcion?: unknown }[]
  medicamentos?: readonly MedicamentoParaExplicar[]
  estudiosOrden?: readonly unknown[]
}

/**
 * Lo que NO está en la nota y hace falta igual.
 *
 * Cada campo es opcional y cada ausencia significa **«no se sabe»**, nunca «no
 * hay». La distinción es la regla 4 de seguridad clínica y aquí decide si
 * `medicationChanges` sale con contenido o sale `null`.
 */
export interface ContextoDelPaquete {
  /**
   * Lo que el paciente tomaba ANTES de esta consulta, ya compuesto en las mismas
   * líneas que produce `comoTomarlo` — porque la comparación mira la línea, no
   * sólo el nombre.
   *
   * `undefined` = **no se sabe qué tomaba**. `[]` = se sabe que no tomaba nada.
   * Son cosas distintas y confundirlas es dato de ausencia.
   */
  medicacionPrevia?: readonly MedicacionDelPaquete[]
  /** Lo que el médico escribió como próximo seguimiento. Sus palabras, literales. */
  proximoSeguimiento?: unknown
  /** Cómo contactar al consultorio. Dato administrativo, no clínico. */
  contactoDelConsultorio?: unknown
  /** Hoy siempre es-MX. `PATIENT-LANGUAGE-001` lo abrirá. */
  idioma?: string
}

/** Nombre comparable: sin acentos, sin mayúsculas, sin espacios de más. */
const claveDeNombre = (n: string): string =>
  n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * Es la casilla donde el paciente más se equivoca —sigue tomando lo que ya no
 * toca, o no empieza lo nuevo— y la que ningún competidor documenta en público.
 *
 * ── LA REGLA QUE GOBIERNA ESTA FUNCIÓN ──────────────────────────────────────
 *
 * **Sin lista previa no se afirma nada.** `undefined` devuelve `null`, y `null`
 * quiere decir «no se pudo determinar», que es lo contrario de «no hubo
 * cambios». Una lista vacía SÍ es un dato —el paciente no tomaba nada— y con
 * ella todo sale `nuevo`.
 *
 * ── QUÉ **NO** DETECTA ──────────────────────────────────────────────────────
 *
 * Un cambio de marca comercial a genérico (o al revés) se lee como una
 * suspensión más un alta. Comparar «Tafil» con «alprazolam» exige un catálogo de
 * equivalencias que este proyecto no tiene, y **adivinarlo sería inventar**: es
 * preferible que el paciente vea dos renglones y pregunte, a que el producto
 * decida por su cuenta que son el mismo fármaco.
 */
export function cambiosDeMedicacion(
  actuales: readonly MedicacionDelPaquete[],
  previas: readonly MedicacionDelPaquete[] | null | undefined,
): CambioDeMedicacion[] | null {
  if (!Array.isArray(previas)) return null

  const antes = new Map<string, string>()
  for (const m of previas) {
    const k = claveDeNombre(texto(m?.nombre))
    if (k) antes.set(k, texto(m?.instruccion))
  }

  const out: CambioDeMedicacion[] = []
  const vistos = new Set<string>()

  for (const m of actuales) {
    const nombre = texto(m?.nombre)
    const k = claveDeNombre(nombre)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    if (!antes.has(k)) { out.push({ nombre, tipo: 'nuevo' }); continue }
    /* Mismo fármaco: lo que decide es si se toma igual, no si sigue en la lista. */
    out.push({ nombre, tipo: antes.get(k) === texto(m?.instruccion) ? 'sin-cambio' : 'cambiado' })
  }

  for (const m of previas) {
    const nombre = texto(m?.nombre)
    const k = claveDeNombre(nombre)
    if (k && !vistos.has(k)) { vistos.add(k); out.push({ nombre, tipo: 'suspendido' }) }
  }

  return out
}

/**
 * COMPONE EL PAQUETE A PARTIR DE UNA NOTA **FIRMADA**.
 *
 * ── LA COMPUERTA DE FIRMA, QUE ES EL CORAZÓN DE `POSTVISIT-001` ─────────────
 *
 * Lanza si la nota no está firmada, y lanza en vez de devolver algo vacío a
 * propósito: un valor de retorno se ignora, una excepción no. Hasta hoy la hoja
 * del paciente se componía del **borrador en curso** —estado vivo de la
 * pantalla, a medio dictar— y nada lo impedía (`POSTVISIT-GATE-001`). La
 * cabecera del módulo hermano decía que el contenido salía «de lo ya revisado y
 * firmado»: era intención de diseño, no precondición. Ahora es precondición.
 *
 * ── DE DÓNDE SALE CADA CAMPO, Y QUÉ SE QUEDA VACÍO ──────────────────────────
 *
 * Todo de material firmado y compuesto de forma determinista: aquí no hay
 * modelo de lenguaje, ni uno. `warningSigns` y `educationalMaterial` se quedan
 * **vacíos y declarados** porque no hay de dónde sacarlos sin inventar — los
 * signos de alarma son indicación médica y el material educativo es evidencia
 * curada. Rellenarlos con «lo habitual» es la regla 1 de seguridad clínica.
 *
 * Y nace `DRAFT`, siempre, **aunque la nota esté firmada**. Firmar es un acto
 * hacia el expediente; liberar es un acto hacia el paciente.
 */
export function componerPaquete(nota: NotaParaPaquete, ctx: ContextoDelPaquete = {}): PaqueteDeVisita {
  if (texto(nota?.estado) !== ESTADO_NOTA_FIRMADA) throw new Error(NO_SE_COMPONE_DE_UN_BORRADOR)
  const notaId = texto(nota?.id)
  if (!notaId) throw new Error('No se puede componer un paquete sin saber de qué nota sale')

  const medicationInstructions: MedicacionDelPaquete[] = (nota.medicamentos ?? [])
    .map(m => ({ nombre: texto(m?.nombre), instruccion: comoTomarlo(m) }))
    .filter(m => m.nombre && m.instruccion)

  /**
   * El resumen: el que el médico firmó, y si no lo hay, sus diagnósticos. En ese
   * orden y sin tercera opción — un resumen «compuesto» de las secciones sería
   * este módulo decidiendo qué es lo importante de una consulta.
   */
  const encounterSummary = texto(nota.resumenEjecutivo)
    || (nota.diagnosticos ?? []).map(d => texto(d?.descripcion)).filter(Boolean).join(' · ')

  return {
    notaId,
    encounterSummary,
    medicationInstructions,
    medicationChanges: cambiosDeMedicacion(medicationInstructions, ctx.medicacionPrevia),
    orders: (nota.estudiosOrden ?? []).map(texto).filter(Boolean),
    followUp: texto(ctx.proximoSeguimiento),
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: texto(ctx.contactoDelConsultorio),
    language: ctx.idioma || 'es-MX',
    estado: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    version: 1,
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
