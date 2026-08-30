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
 * ── UNA DISCREPANCIA QUE SE ENCONTRÓ AL MUDAR ESTO, Y NO SE RESOLVIÓ ────────
 *
 * El comentario del copiloto dice, con estas palabras, que «un `presuntivo` o un
 * `diferencial` **sí** cuentan para AVISAR». Su código dice otra cosa:
 *
 *     dxGestacional.some(d => d.tipo !== 'descartado' && d.tipo !== 'diferencial')
 *
 * El `diferencial` está **excluido**. El comentario y el código no coinciden, y
 * lleva así desde que se escribieron.
 *
 * Aquí se conserva **la conducta del código, no la del comentario**, y se dice
 * por qué: cambiarla movería un aviso de seguridad de medicamentos en embarazo,
 * y si un embarazo listado como diferencial debe disparar ese aviso es una
 * decisión clínica del médico. Está declarada en `LA_DISCREPANCIA_DEL_DIFERENCIAL`
 * para que se pueda resolver, no para que se olvide.
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
 * **Es la línea del copiloto, movida y no cambiada.** El `diferencial` queda
 * fuera, como estaba. Ver `LA_DISCREPANCIA_DEL_DIFERENCIAL`.
 */
export function tratarComoEmbarazada(l: LecturaDelEmbarazo): boolean {
  return l.tipos.some(t => t !== 'descartado' && t !== 'diferencial')
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

export const LA_DISCREPANCIA_DEL_DIFERENCIAL =
  'NEEDS_CLINICAL_REVIEW. El comentario del copiloto dice que un «presuntivo o un '
  + 'diferencial SÍ cuentan para avisar»; su código excluye el diferencial. Se '
  + 'conservó la conducta del CÓDIGO al mudar la lectura aquí, porque cambiarla '
  + 'mueve un aviso de seguridad de medicamentos en embarazo. La pregunta para el '
  + 'médico: un embarazo listado como DIFERENCIAL, ¿debe disparar el aviso de '
  + 'fármaco contraindicado en embarazo? Opción A: sí — más avisos, ninguno '
  + 'perdido, y el comentario pasa a ser cierto. Opción B: no — se queda como '
  + 'está y se corrige el comentario. Hoy rige B por conservación, no por '
  + 'decisión.'

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
