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
 * ── LA COMPOSICIÓN YA VIVE AQUÍ — POSTVISIT-001, REG-335 ────────────────────
 *
 * `componerPaquete` y `cambiosDeMedicacion` se escribieron en
 * `PATIENT-COMPANION-001` y se BORRARON el mismo día: el guardián de conexión
 * las cazó como lo que eran, un motor con cuerpo real y sin un solo llamador.
 * La nota que dejaron decía dónde estaba su llamador — la pantalla donde el
 * médico revisa y libera — y que volverían con ella.
 *
 * Vuelven con ella. `/api/expediente/paquete-de-visita` las llama en el
 * servidor, `EntregarAlPaciente` es el gesto del médico que dispara esa ruta, y
 * `/api/portal` sirve lo liberado. El camino entero está recorrido, no
 * declarado.
 *
 * ── POR QUÉ LA COMPOSICIÓN ES PURA Y CORRE EN EL SERVIDOR ───────────────────
 *
 * Pura para poder probarla al revés sin Firestore. En el servidor porque quien
 * decide QUÉ material entra no puede ser el navegador: si el cliente mandara el
 * contenido, la lista de fuentes del §1 de `patient-facing-ai.md` sería una
 * recomendación y no una frontera. La ruta lee la nota firmada de la base y
 * compone; del cuerpo de la petición sólo acepta identificadores y una fecha.
 */

import { medicamentosDeLaReceta } from '@/lib/expediente/que-va-en-la-receta'
import { comoTomarlo } from './como-se-lo-explico'
import type { Medicamento } from '@/types/expediente'

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

/**
 * QUIÉN RESPONDE POR ESTE PAPEL — del snapshot de firma, de ningún otro sitio.
 *
 * `nota.firma` es el sello inmutable del momento de firmar (NOM-024): el médico
 * que de verdad respondió por este acto, con la cédula que tenía ese día. La
 * configuración VIVA del consultorio no sirve aquí — actualizar el perfil
 * cambiaría retroactivamente el autor de un acto medicolegal ya entregado.
 *
 * Es la misma decisión que ya tomó la receta del portal (H-01), dicha una sola
 * vez para que las dos superficies no puedan discrepar.
 */
export interface PrescriptorDelPaquete {
  nombre: string
  cedulaProfesional: string
  especialidad: string
}

export interface PaqueteDeVisita {
  /** La nota firmada de la que sale todo. La fuente de verdad sigue siendo ella. */
  notaId: string
  /** ISO de la nota. El paciente necesita saber DE QUÉ consulta le hablan. */
  fechaConsulta: string
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
  /** Del snapshot de firma. Un papel del paciente sin prescriptor no se entrega. */
  prescriptor: PrescriptorDelPaquete
  /**
   * Alergias canónicas del expediente, o `null` si NO SE PUDIERON LEER.
   *
   * Las dos cosas caben en un solo campo porque `''` y `null` significan cosas
   * distintas y las dos son ciertas: cadena vacía es «se leyó el expediente y no
   * hay nada registrado»; `null` es «no se pudo leer». Un `''` puesto donde
   * debía ir `null` convierte un fallo de lectura en la afirmación «sin
   * alergias», y ese lector no puede detectar el error (regla 4 de seguridad
   * clínica, y §5 de la regla de IA de cara al paciente).
   *
   * Sale de `alergiasParaImpreso`, la misma primitiva del impreso del médico:
   * un paciente cuya alergia sólo está estructurada no puede salir aquí como
   * «sin registro».
   */
  alergias: string | null
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

/* ────────────────────────────────────────────────────────────────────────────
   LA COMPOSICIÓN — POSTVISIT-001
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * La nota tal como la necesita la composición. No es `NotaMedica` entera a
 * propósito: lo que este motor puede mirar es exactamente lo que aquí se
 * enumera, y ampliar la vista obliga a ampliar este tipo — o sea, a decidirlo.
 */
export interface NotaParaElPaquete {
  id: string
  estado?: unknown
  fechaConsulta?: unknown
  /** La lista CRUDA de la nota. La puerta de prescripción se aplica aquí dentro. */
  medicamentos?: readonly Medicamento[]
  estudiosOrden?: readonly unknown[]
  diagnosticos?: readonly { descripcion?: unknown }[]
  firma?: { nombreMedico?: unknown; cedulaProfesional?: unknown; especialidad?: unknown } | null
}

export interface EntradaDelPaquete {
  nota: NotaParaElPaquete
  /**
   * Lo que el médico prescribió en la visita firmada ANTERIOR, ya pasado por la
   * misma puerta. `null` = no se pudo saber (la lectura falló). Sin esta lista
   * no se afirma ningún cambio: «no aparecía antes» y «no sé qué había antes»
   * son cosas distintas, y confundirlas es dato de ausencia.
   */
  medicacionPrevia: readonly string[] | null
  /** Alergias canónicas del expediente; `null` si no se pudo leer. */
  alergias: string | null
  /** Cómo contactar al consultorio. Dato administrativo del consultorio. */
  telefonoDelConsultorio?: unknown
  /**
   * La próxima cita, EN PALABRAS, tal como el médico la puso en su pantalla.
   *
   * Es el único campo que no sale de la nota, porque la nota no lo guarda: vive
   * en «Próxima consulta» y va al paciente y a la tarea del worklist. Lo aporta
   * el médico con el mismo gesto con el que libera, así que es material
   * aprobado por él (nivel 3 del §1) y no una inferencia de nadie.
   */
  proximaCita?: unknown
}

/** Por qué un encuentro no se puede componer. Cada motivo se le dice al médico. */
export type MotivoNoComponible = 'nota-sin-firmar' | 'nota-sin-firma'

export type Composicion =
  | { ok: true; paquete: PaqueteDeVisita }
  | { ok: false; motivo: MotivoNoComponible }

/**
 * QUÉ CAMBIÓ RESPECTO DE LA VISITA ANTERIOR.
 *
 * Es la casilla donde el paciente más se equivoca —sigue tomando lo que ya no
 * toca, o no empieza lo nuevo—, y la que se calla entera cuando no se puede
 * afirmar: sin `previa` devuelve `null`, no una lista de «nuevos».
 *
 * Compara por nombre normalizado. No mira dosis: cambiar de 500 mg a 1 g no se
 * anuncia como «sin cambio», pero tampoco se inventa una categoría «ajustado»
 * que el médico no dijo — la instrucción completa va arriba, en
 * `medicationInstructions`, y ahí se lee la dosis de hoy.
 */
export function cambiosDeMedicacion(
  deHoy: readonly string[],
  previa: readonly string[] | null,
): CambioDeMedicacion[] | null {
  if (previa === null) return null
  const clave = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
  const hoy = new Map(deHoy.map(n => [clave(n), n]))
  const antes = new Map(previa.map(n => [clave(n), n]))
  const out: CambioDeMedicacion[] = []
  for (const [k, nombre] of hoy) out.push({ nombre, tipo: antes.has(k) ? 'sin-cambio' : 'nuevo' })
  for (const [k, nombre] of antes) if (!hoy.has(k)) out.push({ nombre, tipo: 'suspendido' })
  return out
}

/**
 * ARMA EL PAQUETE A PARTIR DE LA NOTA FIRMADA. Nace `DRAFT`, siempre.
 *
 * ── LAS DOS PUERTAS QUE ESTA FUNCIÓN NO DEJA SALTAR ─────────────────────────
 *
 * 1. **La nota tiene que estar FIRMADA.** Componer del borrador en curso era
 *    `POSTVISIT-GATE-001`: la hoja se armaba con el estado vivo de la consulta,
 *    a medio dictar, y la única guarda era que no fuera una nota de hospital.
 *    Aquí no se compone de un borrador ni por accidente: se devuelve el motivo.
 * 2. **La nota tiene que traer FIRMA.** Un paquete sin prescriptor es el papel
 *    con «[FALTA CÉDULA PROFESIONAL]» que ya se reparó una vez en la receta del
 *    portal. Sin `firma` no hay a quién atribuir el acto, así que no hay papel.
 *
 * Y que la nota esté firmada **no libera nada**: lo que sale de aquí es `DRAFT`.
 * Firmar va hacia el expediente; liberar va hacia el paciente. Dos actos.
 *
 * ── LO QUE NO COMPONE, Y POR QUÉ ────────────────────────────────────────────
 *
 * `warningSigns` y `educationalMaterial` siguen vacíos. Los signos de alarma son
 * indicación médica y el material educativo es evidencia curada: no hay de
 * dónde sacarlos sin inventarlos, y «lo habitual» impreso bajo una cédula
 * profesional es exactamente el fallo más caro posible aquí.
 *
 * `encounterSummary` son los DIAGNÓSTICOS que el médico dejó en la nota, no el
 * `resumenEjecutivo`: ese lo redacta un modelo para el clínico, con su jerga y
 * su razonamiento, y no se escribió para este lector.
 */
export function componerPaquete(e: EntradaDelPaquete): Composicion {
  const n = e.nota
  if (texto(n.estado) !== 'firmada') return { ok: false, motivo: 'nota-sin-firmar' }

  const nombreMedico = texto(n.firma?.nombreMedico)
  const cedula = texto(n.firma?.cedulaProfesional)
  if (!nombreMedico || !cedula) return { ok: false, motivo: 'nota-sin-firma' }

  const recetados = medicamentosDeLaReceta(n.medicamentos ?? [])
  const instrucciones: MedicacionDelPaquete[] = recetados
    .map(m => ({ nombre: texto(m.nombre), instruccion: comoTomarlo(m) }))
    .filter(m => m.nombre && m.instruccion)

  const telefono = texto(e.telefonoDelConsultorio)

  return {
    ok: true,
    paquete: {
      notaId: n.id,
      fechaConsulta: texto(n.fechaConsulta),
      encounterSummary: (n.diagnosticos ?? []).map(d => texto(d?.descripcion)).filter(Boolean).join(', '),
      medicationInstructions: instrucciones,
      medicationChanges: cambiosDeMedicacion(instrucciones.map(m => m.nombre), e.medicacionPrevia),
      orders: (n.estudiosOrden ?? []).map(texto).filter(Boolean),
      followUp: texto(e.proximaCita),
      /* Indicación médica y evidencia curada. O las escribe alguien, o van vacías. */
      warningSigns: [],
      educationalMaterial: [],
      documents: [],
      unansweredQuestions: [],
      /* Administrativo, no clínico: cómo se llega al consultorio, sin promesa
         de tiempo de respuesta que nadie se haya comprometido a cumplir. */
      clinicianContactRules: telefono
        ? `Si tienes dudas sobre tu tratamiento, llama a tu consultorio: ${telefono}`
        : '',
      prescriptor: { nombre: nombreMedico, cedulaProfesional: cedula, especialidad: texto(n.firma?.especialidad) },
      alergias: e.alergias,
      language: 'es-MX',
      estado: 'DRAFT',
      approvedAt: null,
      approvedBy: null,
      version: 1,
    },
  }
}

/**
 * Los campos que son CONTENIDO, separados de los que son estado de aprobación.
 *
 * Existe para una sola pregunta, y es la de la idempotencia: «¿lo que me piden
 * liberar es lo mismo que ya está liberado?». Si se comparara el paquete entero,
 * `approvedAt` haría que dos liberaciones idénticas parecieran distintas siempre
 * y cada clic crearía una versión nueva.
 */
function contenido(p: PaqueteDeVisita): unknown {
  return [
    p.notaId, p.fechaConsulta, p.encounterSummary, p.medicationInstructions,
    p.medicationChanges, p.orders, p.followUp, p.warningSigns, p.educationalMaterial,
    p.documents, p.unansweredQuestions, p.clinicianContactRules, p.prescriptor,
    p.alergias, p.language,
  ]
}

/**
 * ¿Dicen lo mismo dos paquetes?
 *
 * Comparación estructural y NO un hash: un hash corto puede colisionar, y una
 * colisión aquí se traduce en «no hace falta versión nueva» sobre un contenido
 * que sí cambió — o sea, el paciente leyendo la versión vieja de su plan
 * mientras el sistema cree haberla actualizado. Comparar de verdad cuesta
 * microsegundos sobre un documento de este tamaño.
 */
export function mismoContenido(a: PaqueteDeVisita, b: PaqueteDeVisita): boolean {
  return JSON.stringify(contenido(a)) === JSON.stringify(contenido(b))
}

/**
 * La versión siguiente de un paquete ya liberado, con el contenido de hoy.
 *
 * Un paquete liberado es INMUTABLE: corregirlo es liberar una versión nueva,
 * igual que una adenda no reescribe la nota. Esta función es la única forma de
 * hacerlo, y sube el contador — nunca lo repite.
 */
export function siguienteVersion(anterior: PaqueteDeVisita, nuevo: PaqueteDeVisita): PaqueteDeVisita {
  return { ...nuevo, version: anterior.version + 1 }
}

/**
 * RETIRAR lo liberado: vuelve a `DRAFT` y sube la versión.
 *
 * La reversibilidad de este módulo es explícita o no existe. No hay un borrado
 * silencioso ni un campo que alguien pueda apagar: retirar es un ACTO, deja su
 * propia versión y su entrada en la bitácora, y lo que el paciente ya leyó
 * consta en la versión anterior. Un documento que desaparece sin rastro es
 * indistinguible de uno que nunca existió.
 */
export function retirar(p: PaqueteDeVisita): PaqueteDeVisita {
  return { ...p, estado: 'DRAFT', approvedBy: null, approvedAt: null, version: p.version + 1 }
}
