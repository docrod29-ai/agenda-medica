/**
 * QUÉ DICE LA FILA DE UN PACIENTE, CLÍNICAMENTE.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * RTC-15 del registro canónico, subido a P1 por la re-puntuación §29 del
 * 14-ago-2026: `/pacientes` puntuó **5.0/10** —la peor superficie del
 * producto— y la razón cabe en una frase: **no dice nada clínico de nadie**.
 * Nombre, teléfono, edad, «Editar», chevron. La lista de contactos de un CRM,
 * en la pantalla que un médico abre veinte veces al día.
 *
 * Lo que un médico necesita saber ANTES de abrir un expediente es lo mismo que
 * `/pendientes` ya sabe: si de ese paciente quedó algo abierto, qué es, y si
 * ya venció o no tiene dueño.
 *
 * ── NO ES UNA FUENTE DE DATOS NUEVA ─────────────────────────────────────────
 *
 * `tareasVivas()` es la MISMA lectura que ya hacen `/pendientes` y el
 * `ContinuidadPanel` de Hoy. Aquí no se recalcula nada: se reutilizan
 * `ordenWorklist`, `debeEscalar` y `estaVencida` del modelo. Un segundo
 * criterio de urgencia en esta pantalla sería una segunda verdad sobre la
 * misma entidad clínica — justo lo que la carta operativa prohíbe.
 *
 * ── AUSENCIA DE DATO NO ES DATO DE AUSENCIA (regla 4) ───────────────────────
 *
 * Esta es la parte delicada, y por eso el estado tiene TRES respuestas y no
 * dos:
 *
 *   · `con-pendientes` — hay algo abierto, y se dice qué.
 *   · `sin-pendientes` — la lectura llegó y no había nada de ese paciente. Es
 *     un hecho sobre el WORKLIST, no sobre la persona: no significa que esté
 *     sana, significa que nadie dejó un cabo suelto anotado.
 *   · `sin-leer`       — la lectura falló o todavía no llegó. **No se pinta
 *     como «sin pendientes».** Una fila que dice «nada pendiente» porque
 *     Firestore devolvió un error es exactamente el daño que este producto
 *     existe para evitar.
 *
 * Por eso `estadoClinicoDeFila` recibe el resultado de la lectura y no lo
 * adivina, y por eso `sin-pendientes` NO se pinta en la fila: no hay nada útil
 * que decir con ello, y decirlo en 300 filas es ruido que compite con las tres
 * que sí tienen algo. Se devuelve igualmente porque quien llame puede
 * necesitarlo (un contador, un filtro), y porque el día que alguien quiera
 * pintarlo la distinción con `sin-leer` ya está hecha.
 */
import {
  ordenWorklist, debeEscalar, estaVencida, ETIQUETA_TIPO,
  type TareaClinica,
} from '@/lib/tareas-clinicas/modelo'

export type LecturaDelWorklist =
  | { estado: 'lista'; tareas: readonly TareaClinica[] }
  | { estado: 'sin-leer' }

export interface EstadoClinicoDeFila {
  /** `sin-leer` NUNCA se pinta como «sin pendientes». Ver la cabecera. */
  clase: 'con-pendientes' | 'sin-pendientes' | 'sin-leer'
  /** Cuántas quedaron abiertas de ese paciente. */
  vivas: number
  /** La que manda, según el MISMO orden que usa el worklist. */
  etiqueta: string | null
  /** Qué le pasa a la que manda: vencida, sin dueño, crítica. */
  porQue: string | null
  /** Si alguna pide escalar (crítica sin dueño, o vencida). §9 del Master Loop. */
  urgente: boolean
}

const SIN_LEER: EstadoClinicoDeFila = {
  clase: 'sin-leer', vivas: 0, etiqueta: null, porQue: null, urgente: false,
}

/**
 * POR QUÉ LA RAZÓN SE ESCRIBE EN PROSA Y NO EN UN CHIP DE COLOR.
 *
 * `/pendientes` es la superficie que mejor puntuó (§29: **1.0**) y lo que la
 * hace distinta es exactamente esto: dice la CONSECUENCIA («Venció y nadie la
 * tomó»), no el estado («overdue»). Un chip rojo obliga a saber qué significa
 * el rojo; una frase no. Y el color como único canal falla en gris, en tema
 * claro y con un médico daltónico — lo dice §29 y ya lo cazó RTC-17.
 */
function porQueImporta(t: TareaClinica, ahoraMs: number): string | null {
  const vencida = estaVencida(t, ahoraMs)
  const sinDueno = !t.ownerUid
  if (vencida && sinDueno) return 'venció y nadie la tomó'
  if (vencida) return 'venció'
  if (t.prioridad === 'critica' && sinDueno) return 'crítica, sin dueño'
  if (sinDueno) return 'sin dueño'
  return null
}

/**
 * LAS TAREAS VIVAS DE UN PACIENTE — el filtro, UNA sola vez.
 *
 * Existe porque la lente contextual necesita enseñar EXACTAMENTE las mismas
 * tareas que la fila resumió. Si la lente aplicara su propio filtro, dos
 * criterios distintos podrían discrepar y el plano acabaría explicando algo
 * que la fila no dice — una explicación que no coincide con lo explicado es
 * peor que no explicar. Por eso `estadoClinicoDeFila` también pasa por aquí.
 *
 * Devuelve vacío cuando la lectura no llegó: quien pinte el resultado tiene que
 * distinguir eso de «no hay ninguna» mirando la CLASE, no la longitud.
 */
export function tareasDelPaciente(
  patientId: string,
  lectura: LecturaDelWorklist,
): readonly TareaClinica[] {
  if (lectura.estado === 'sin-leer') return []
  return lectura.tareas.filter(t => t.patientId === patientId)
}

/**
 * El estado clínico de UN paciente a partir de la lectura del worklist.
 *
 * `ahoraMs` se recibe y no se toma de `Date.now()` aquí: la fila se pinta
 * muchas veces y «vencida» tiene que significar lo mismo en todas ellas
 * durante un mismo pintado — además de ser lo que hace la función probable.
 */
export function estadoClinicoDeFila(
  patientId: string,
  lectura: LecturaDelWorklist,
  ahoraMs: number,
): EstadoClinicoDeFila {
  if (lectura.estado === 'sin-leer') return SIN_LEER

  const suyas = tareasDelPaciente(patientId, lectura)
  if (suyas.length === 0) {
    return { clase: 'sin-pendientes', vivas: 0, etiqueta: null, porQue: null, urgente: false }
  }

  // El MISMO orden del worklist: primero lo que hay que escalar, después por
  // prioridad, y dentro de cada grupo lo más viejo arriba.
  const manda = [...suyas].sort((a, b) => ordenWorklist(a, b, ahoraMs))[0]
  return {
    clase: 'con-pendientes',
    vivas: suyas.length,
    etiqueta: ETIQUETA_TIPO[manda.tipo] ?? ETIQUETA_TIPO.otra,
    porQue: porQueImporta(manda, ahoraMs),
    urgente: suyas.some(t => debeEscalar(t, ahoraMs).escalar || estaVencida(t, ahoraMs)),
  }
}

/**
 * CUÁNDO SE VIO POR ÚLTIMA VEZ, EN PALABRAS DE CONSULTORIO.
 *
 * `ultimaCita` ya vivía en el paciente y sólo se usaba para ORDENAR la pestaña
 * «Recientes»: el dato estaba leído, pintado en ningún sitio, y el médico tenía
 * que abrir el expediente para enterarse de algo que la lista ya sabía.
 *
 * Devuelve `null` cuando no hay fecha —nunca «sin visitas»: que no haya cita
 * registrada no significa que el paciente no haya venido, puede ser un
 * expediente migrado.
 */
export function ultimaVezVisto(iso: string | undefined, ahoraMs: number): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const dias = Math.floor((ahoraMs - t) / 86_400_000)
  if (dias < 0) return null            // una cita futura no es «visto»: es agenda.
  if (dias === 0) return 'visto hoy'
  if (dias === 1) return 'visto ayer'
  if (dias < 30) return `visto hace ${dias} días`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `visto hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(dias / 365)
  return `visto hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}
