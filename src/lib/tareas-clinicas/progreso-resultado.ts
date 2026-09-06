/**
 * V15-RESULTS-CLOSURE-001 (Fase 6, §9 del master loop) — el progreso de UN
 * resultado como las ocho etapas que pide el master loop, no como un semáforo
 * de tres estados.
 *
 * ── EL HALLAZGO, ANTES DE ESCRIBIR CÓDIGO ───────────────────────────────────
 *
 * §9 pide: RESULT → SIGNIFICANCE → OWNER → REVIEW → DECISION → ACTION →
 * PATIENT COMMUNICATION → CLOSED, «como cola de trabajo, no como tabla
 * estática».
 *
 * `TareaClinica` (`./modelo.ts`) sólo tiene dato real para CINCO de las ocho:
 *
 *   RESULT        — la tarea existe.
 *   SIGNIFICANCE  — `prioridad`, obligatorio desde que la tarea nace.
 *   OWNER         — `ownerUid`/`ownerNombre`.
 *   REVIEW        — la progresión de `estado` (aceptada → en_curso).
 *   CLOSED        — `estado === 'cerrada'`.
 *
 * DECISION, ACTION y PATIENT COMMUNICATION **no tienen campo propio**. El
 * propio modelo lo dice en `POR_QUE_COMPLETADA_NO_ES_CERRADA`: «cerrada» es
 * que alguien LO MIRÓ y decidió — hoy «cerrar» es el único acto, y abarca las
 * tres etapas de golpe sin registrar cada una por separado. Ni siquiera
 * después de cerrar hay campo que diga QUÉ se decidió, QUÉ acción se tomó o
 * SI se avisó al paciente.
 *
 * Rellenar esas tres con "hecha" en cuanto `estado === 'cerrada'` sería
 * INVENTAR un dato que el sistema no tiene — justo lo que la regla 5 de
 * seguridad clínica prohíbe («señalar de menos, nunca de más»: que falte un
 * dato significa que ESO no se vigila, no que se dé por bueno). Por eso las
 * tres quedan `sin_dato` SIEMPRE, cerrada o no — es el hallazgo estructural
 * de esta fase, no un defecto de esta función.
 *
 * Módulo PURO — ninguna consulta a Firestore, ningún cálculo clínico.
 */
import { avisoRegistrado, constaQueLoRecibieron } from './modelo'
import type { EstadoTarea, Prioridad, TareaClinica } from './modelo'

export type EstadoEtapa = 'hecha' | 'actual' | 'pendiente' | 'sin_dato'

export interface EtapaResultado {
  clave: string
  etiqueta: string
  estado: EstadoEtapa
  /** Sólo presente cuando `estado === 'sin_dato'`: por qué no se puede saber. */
  motivoSinDato?: string
}

/**
 * Los dos tipos de `TareaClinica` que SON un resultado en el sentido de §9:
 * un estudio pedido que falta, o un resultado que ya llegó y falta revisar.
 * Un seguimiento o una receta por entregar no son "resultados" — no se les
 * pinta esta pista para no sugerir una etapa que no aplica.
 */
const TIPOS_DE_RESULTADO = new Set(['estudio_pendiente', 'resultado_por_revisar'])

export function esTareaDeResultado(tipo: string): boolean {
  return TIPOS_DE_RESULTADO.has(tipo)
}

const MOTIVO_SIN_DATO_CIERRE =
  'No se registra aparte de "cerrar" la tarea: hoy ese único acto abarca decisión, acción y aviso al paciente sin distinguirlos.'

/**
 * ── LO QUE CAMBIÓ, Y LO QUE SIGUE IGUAL A PROPÓSITO (REG-360) ───────────────
 *
 * Las tres etapas del §9 que faltaban —DECISION, ACTION, PATIENT
 * COMMUNICATION— ya tienen dónde vivir: `TareaClinica.cierre`. Así que cuando
 * el dato EXISTE, se enseña.
 *
 * Lo que **no** cambia es la regla que hizo bien esta función desde el
 * principio: **nada se deduce de `estado === 'cerrada'`**. Una tarea cerrada sin
 * registrar el aviso sigue diciendo `sin_dato`, no «avisado» ni «no avisado».
 *
 * Es la regla 5 de seguridad clínica: que falte un dato significa que ESO no se
 * vigila, no que se dé por bueno. Y aquí tiene una consecuencia concreta — si el
 * sistema afirmara que se avisó, nadie volvería a mirar; si afirmara que no,
 * alguien lo arreglaría. La única respuesta honesta a «no lo sé» es no lo sé.
 */
const MOTIVO_NO_REGISTRADO =
  'La tarea se cerró sin registrar esto. No significa que no se hiciera: significa que no consta.'

function etapaSinDato(clave: string, etiqueta: string, motivo = MOTIVO_SIN_DATO_CIERRE): EtapaResultado {
  return { clave, etiqueta, estado: 'sin_dato', motivoSinDato: motivo }
}

/** Una etapa del cierre: hecha si consta, `sin_dato` si no. Nunca deducida. */
function etapaDeCierre(clave: string, etiqueta: string, consta: boolean, cerrada: boolean): EtapaResultado {
  if (consta) return { clave, etiqueta, estado: 'hecha' }
  // Cerrada y sin constar: se DICE que no consta. Sin cerrar: sigue pendiente.
  return cerrada
    ? etapaSinDato(clave, etiqueta, MOTIVO_NO_REGISTRADO)
    : { clave, etiqueta, estado: 'pendiente' }
}

export function progresoResultado(
  t: Pick<TareaClinica, 'estado' | 'ownerUid' | 'cierre'> & { prioridad?: Prioridad },
): EtapaResultado[] {
  const estado: EstadoTarea = t.estado
  const terminal = estado === 'cerrada' || estado === 'cancelada'
  const tieneDueno = !!t.ownerUid
  const enRevision = estado === 'en_curso' || estado === 'completada' || estado === 'cerrada'
  const cerrada = estado === 'cerrada'

  // «actual» sólo se marca en la primera etapa sin completar de una tarea
  // viva: una terminal (cerrada/cancelada) no tiene "siguiente paso".
  const actualEsDueno = !terminal && !tieneDueno
  const actualEsRevision = !terminal && tieneDueno && !enRevision
  const actualEsCierre = !terminal && enRevision

/**
 * Cómo se llama la etapa del aviso. «Aviso al paciente» a secas cuando no
 * consta cómo — que es lo que decía antes de REG-548 y sigue diciendo cuando el
 * médico no lo detalla, porque el campo es opcional.
 */
function etiquetaDelAviso(t: Pick<TareaClinica, 'cierre'>): string {
  const recibido = constaQueLoRecibieron(t.cierre?.comoSeAviso)
  if (recibido === null) return 'Aviso al paciente'
  return recibido ? 'Aviso al paciente (hablado)' : 'Aviso al paciente (por mensaje)'
}

  const marcar = (hecha: boolean, actual: boolean): EstadoEtapa => (hecha ? 'hecha' : actual ? 'actual' : 'pendiente')

  return [
    { clave: 'resultado', etiqueta: 'Resultado', estado: 'hecha' },
    { clave: 'significado', etiqueta: 'Significado', estado: 'hecha' },
    { clave: 'dueno', etiqueta: 'Dueño', estado: marcar(tieneDueno, actualEsDueno) },
    { clave: 'revision', etiqueta: 'Revisión', estado: marcar(enRevision, actualEsRevision) },
    etapaDeCierre('decision', 'Decisión', !!t.cierre?.decision?.trim(), cerrada),
    etapaDeCierre('accion', 'Acción', !!t.cierre?.accion?.trim(), cerrada),
    /**
     * `no_aplica` cuenta como registrado: alguien miró y decidió que no había
     * que avisar. Es un dato, no un hueco — lo contrario sería castigar la
     * respuesta honesta.
     *
     * Se pregunta con `avisoRegistrado`, que devuelve `null` cuando NO CONSTA,
     * y no leyendo el campo aquí: la distinción entre «no lo sé» y «no se
     * avisó» decide si alguien llama a un paciente, y no puede vivir en dos
     * sitios con la posibilidad de divergir.
     */
    /**
     * REG-548 · la etiqueta dice DE QUÉ MANERA, cuando consta.
     *
     * El dueño decidió (D-037) que las cuatro vías cuentan como avisado,
     * incluido un mensaje enviado, sabiendo que un mensaje puede morir sin acuse
     * — este producto lo mide en dos pantallas (REG-535, REG-541).
     *
     * Así que cuenta igual y el estado de la etapa no cambia. Lo que cambia es
     * que aquí, donde el médico LEE el progreso del resultado, se distingue una
     * conversación de un mensaje. Sin esto, la decisión se habría guardado en un
     * campo que nadie mira, que es la familia que este repositorio persigue.
     */
    etapaDeCierre('aviso_paciente', etiquetaDelAviso(t), avisoRegistrado(t) !== null, cerrada),
    { clave: 'cerrado', etiqueta: 'Cerrado', estado: marcar(cerrada, actualEsCierre) },
  ]
}
