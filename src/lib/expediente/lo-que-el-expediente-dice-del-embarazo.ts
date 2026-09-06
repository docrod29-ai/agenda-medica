/**
 * UNA SOLA LECTURA DE LO QUE EL EXPEDIENTE DICE DEL EMBARAZO.
 *
 * ── POR QUÉ EXISTE (WS-09) ──────────────────────────────────────────────────
 *
 * La lectura vivía **dentro** de `copiloto.ts`, sin exportar. El motor de
 * aplicabilidad necesita la misma pregunta —«¿esta paciente está embarazada?»—
 * para decidir si un estudio que excluye embarazadas le aplica, y escribirla
 * otra vez habría creado dos formas de leer los mismos diagnósticos.
 *
 * Ése es el patrón que este repositorio persigue por todas partes: dos partes
 * que afirman cosas incompatibles y ninguna está mal por su cuenta.
 *
 * ── UNA LECTURA, DOS PREGUNTAS DISTINTAS ────────────────────────────────────
 *
 * Los dos consumidores no preguntan lo mismo, y por eso esto devuelve el estado
 * **con los tipos que lo sostienen**, no un booleano:
 *
 *  · El copiloto **avisa**. Para avisar, la duda cuenta: el riesgo de un embarazo
 *    no detectado pesa más que el ruido de un aviso de más.
 *  · La aplicabilidad **afirma**. Para afirmar, la duda no basta: sale
 *    `datos_insuficientes`, que es lo que obliga a decir la regla 4.
 *
 * Aplanarlo a un booleano habría obligado a elegir una de las dos, y la elegida
 * habría estado mal para el otro.
 *
 * ── UNA DISCREPANCIA QUE SE ENCONTRÓ AL MUDAR ESTO, Y SE RESOLVIÓ ──────────
 *
 * El comentario del copiloto decía, con estas palabras, que «un `presuntivo` o
 * un `diferencial` **sí** cuentan para AVISAR». Su código decía otra cosa:
 *
 *     dxGestacional.some(d => d.tipo !== 'descartado' && d.tipo !== 'diferencial')
 *
 * El `diferencial` estaba **excluido**, y llevaban años contradiciéndose.
 *
 * Al mudar la lectura aquí (WS-09) se conservó la conducta del CÓDIGO y se dejó
 * la pregunta declarada, porque cambiarla movía un aviso de seguridad de
 * medicamentos en embarazo y eso es del médico.
 *
 * **El 31-ago-2026 el dueño decidió: el diferencial SÍ cuenta.** Ahora el
 * comentario es cierto. Ver `LA_DECISION_DEL_DIFERENCIAL`, que además corrige el
 * alcance: la pregunta decía «el aviso de fármaco contraindicado» y era falso —
 * los siete `contraindicado` avisan siempre y no dependían de esto. Lo que
 * cambia son los cuatro `evitar`.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No decide nada clínico y no mira laboratorios: lee los DIAGNÓSTICOS que
 * alguien escribió. Un embarazo que nadie anotó sale `no_consta`, nunca
 * `descartado` — ausencia de dato no es dato de ausencia.
 *
 * Módulo PURO.
 */
import type { Diagnostico } from '@/types/expediente'

/** Lo que el expediente permite afirmar, y nada más. */
export type EstadoDelEmbarazo =
  /** Alguien lo escribió afirmándolo (definitivo, o sin tipo). */
  | 'confirmado'
  /** Consta como sospecha o como diferencial: ni se afirma ni se niega. */
  | 'posible'
  /** Alguien lo descartó con todas las letras. */
  | 'descartado'
  /** Nadie ha dicho nada. NO es «no está embarazada». */
  | 'no_consta'

export interface LecturaDelEmbarazo {
  readonly estado: EstadoDelEmbarazo
  /**
   * Los `tipo` de los diagnósticos gestacionales que la sostienen, tal cual.
   *
   * Van crudos a propósito: cada consumidor aplica SU criterio sobre el mismo
   * material en vez de heredar el del otro. Es lo que permite que esto sea una
   * sola lectura sin volverse una sola política.
   */
  readonly tipos: readonly (Diagnostico['tipo'] | undefined)[]
}

/** Los términos que marcan un diagnóstico como gestacional. Vocabulario, no criterio. */
const GESTACIONAL = /embaraz|gestaci|gr[aá]vid|obst[eé]tric|prenatal/i

export interface DiagnosticoLeible {
  readonly descripcion?: string
  readonly tipo?: Diagnostico['tipo']
}

/** Los diagnósticos gestacionales del cuadro, tal como se escribieron. */
export function diagnosticosGestacionales(
  diagnosticos: readonly DiagnosticoLeible[] | undefined,
): readonly DiagnosticoLeible[] {
  return (diagnosticos ?? []).filter(d => GESTACIONAL.test(String(d.descripcion ?? '')))
}

/**
 * Qué dice el expediente.
 *
 * Se mira primero si algo lo AFIRMA, porque un expediente puede tener las dos
 * cosas —«embarazo» de marzo y «embarazo descartado» de hoy— y en ese caso lo
 * que hay es un conflicto, no una resolución. Se devuelve `posible`, que es el
 * lado que hace preguntar.
 */
export function loQueElExpedienteDiceDelEmbarazo(
  diagnosticos: readonly DiagnosticoLeible[] | undefined,
): LecturaDelEmbarazo {
  const dx = diagnosticosGestacionales(diagnosticos)
  const tipos = dx.map(d => d.tipo)
  if (dx.length === 0) return { estado: 'no_consta', tipos }

  const afirmado = tipos.some(t => t === 'definitivo' || t === undefined)
  const sospechado = tipos.some(t => t === 'presuntivo' || t === 'diferencial')
  const descartado = tipos.some(t => t === 'descartado')

  if (afirmado) return { estado: descartado ? 'posible' : 'confirmado', tipos }
  if (sospechado) return { estado: 'posible', tipos }
  if (descartado) return { estado: 'descartado', tipos }
  return { estado: 'no_consta', tipos }
}

/**
 * Para AVISAR: ¿hay que tratar a esta paciente como potencialmente embarazada?
 *
 * **El `diferencial` cuenta desde el 31-ago-2026**, por decisión del médico
 * dueño. Ver `LA_DECISION_DEL_DIFERENCIAL`: hasta esa fecha quedaba fuera por
 * conservación —el comentario del copiloto y su código llevaban años
 * contradiciéndose— y ahora el comentario es cierto.
 *
 * Sólo se excluye lo que alguien DESCARTÓ. Una paciente con «embarazo
 * descartado» en marzo y «embarazo» como diferencial hoy cuenta: hay una
 * hipótesis viva, y ésa es la que manda.
 */
export function tratarComoEmbarazada(l: LecturaDelEmbarazo): boolean {
  return l.tipos.some(t => t !== 'descartado')
}

/**
 * Para AFIRMAR: el valor que espera el motor de aplicabilidad.
 *
 * `undefined` cuando no consta o sólo se sospecha — el motor lo convierte en
 * `datos_insuficientes`, que es lo correcto: un estudio que excluye embarazadas
 * no se puede declarar aplicable sobre una sospecha, ni inaplicable sobre ella.
 */
export function embarazoParaAplicabilidad(l: LecturaDelEmbarazo): boolean | undefined {
  if (l.estado === 'confirmado') return true
  if (l.estado === 'descartado') return false
  return undefined
}

/**
 * LA DECISIÓN, TOMADA — 31-ago-2026, por el médico dueño.
 *
 * Sustituye a `LA_DISCREPANCIA_DEL_DIFERENCIAL`, que declaraba la pregunta
 * abierta. Se conserva el histórico porque el ledger lo cita.
 *
 * ── EL ALCANCE REAL, QUE LA PREGUNTA SOBREESTIMABA ──────────────────────────
 *
 * La declaración anterior decía que esto movía «el aviso de fármaco
 * CONTRAINDICADO en embarazo». **Era falso**, y se vio al medir el copiloto
 * antes de preguntar: su condición es
 *
 *     x.embarazo === 'contraindicado' || (x.embarazo === 'evitar' && embarazoConfirmado)
 *
 * Los siete `contraindicado` —IECA/ARA II, warfarina, ACOD, isotretinoína,
 * valproato, metotrexato, agonistas GLP-1— avisan **siempre**, en cualquier
 * paciente, y esta decisión no los toca.
 *
 * Lo que decide es la rama `evitar`, que son cuatro: **estatinas, tetraciclinas
 * y doxiciclina, quinolonas y AINE**. Con el embarazo como diferencial, ahora
 * también avisan.
 */
export const LA_DECISION_DEL_DIFERENCIAL =
  'DECIDIDO por el médico dueño el 31-ago-2026: un embarazo listado como '
  + 'DIFERENCIAL SÍ cuenta para avisar. Afecta a la rama `evitar` —estatinas, '
  + 'tetraciclinas y doxiciclina, quinolonas y AINE—; los siete `contraindicado` '
  + 'avisaban ya en cualquier paciente y no dependían de esto. Razón: son cuatro '
  + 'fármacos, así que el riesgo de fatiga de alerta es bajo, y doxiciclina y '
  + 'quinolonas son de lo más prescrito en edad fértil en la especialidad del '
  + 'dueño. Hasta esta fecha regía lo contrario POR CONSERVACIÓN, no por '
  + 'decisión, y el comentario del copiloto llevaba años diciendo lo que el '
  + 'código no hacía.'

export const POR_QUE_NO_ES_UN_BOOLEANO =
  'Porque los dos consumidores preguntan cosas distintas. El copiloto AVISA, y '
  + 'para avisar la duda cuenta: el riesgo de un embarazo no detectado pesa más '
  + 'que el ruido de un aviso de más. La aplicabilidad AFIRMA, y para afirmar la '
  + 'duda no basta. Aplanarlo a un booleano habría obligado a elegir una de las '
  + 'dos, y la elegida habría estado mal para el otro.'

export const POR_QUE_EL_CONFLICTO_NO_SE_RESUELVE =
  'Un expediente puede decir «embarazo» en marzo y «embarazo descartado» hoy. '
  + 'Eso no es una resolución, es un conflicto, y se devuelve `posible` — el lado '
  + 'que hace preguntar. Quedarse con la nota más reciente sería inventar una '
  + 'regla clínica que nadie escribió.'
