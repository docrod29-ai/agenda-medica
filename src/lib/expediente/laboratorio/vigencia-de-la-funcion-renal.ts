/**
 * ¿SIRVE TODAVÍA ESTA CREATININA PARA DOSIFICAR?
 *
 * ── DE DÓNDE SALEN ESTAS VENTANAS ────────────────────────────────────────────
 *
 * REG-368 dejó esto marcado como `NEEDS_CLINICAL_REVIEW`: cuánto puede tener una
 * creatinina para seguir sirviendo para dosificar es un umbral clínico y no se
 * inventa. **El dueño lo resolvió el 29-ago-2026** y ésta es su política, escrita
 * literal para que se pueda auditar contra lo que dijo:
 *
 *   · **AKI, paciente hospitalizado o función renal inestable** → válida **≤24 h**.
 *   · **Ambulatorio clínicamente estable** → válida **≤30 días**.
 *   · **Si no se puede demostrar estabilidad clínica, o el contexto es ambiguo**
 *     → default conservador **≤7 días**.
 *   · Fuera de la ventana: **no se bloquea en silencio y no se inventa función
 *     renal**. Se marca `STALE_RENAL_FUNCTION` y se advierte que hace falta
 *     función renal actualizada **antes de una recomendación de dosificación
 *     dependiente del riñón**.
 *   · **La autoridad final es del médico.**
 *
 * Estas cifras NO son de este módulo: son la decisión del dueño, y por eso son lo
 * único numérico que hay aquí.
 *
 * ── LO QUE ESTE MÓDULO NO INFIERE ────────────────────────────────────────────
 *
 * **No deduce «clínicamente estable» de los números.** Decidir que una función
 * renal es estable mirando cuánto se movió la creatinina exigiría un umbral de
 * variación que nadie ha validado — exactamente lo que la política del otro punto
 * prohíbe. Así que la estabilidad sólo cuenta cuando alguien la **declara**.
 *
 * Consecuencia, dicha sin adornos: **hoy nada en el producto la declara**, así
 * que en la consulta ambulatoria la ventana efectiva es la conservadora de 7
 * días. Es lo que la política del dueño prescribe para un contexto que no se
 * puede demostrar, y la ventana de 30 días queda implementada y probada
 * esperando a quien pueda declararla.
 *
 * ── POR QUÉ LA ANTIGÜEDAD SE MIDE AL ALZA ────────────────────────────────────
 *
 * Los paneles guardan `YYYY-MM-DD`, sin hora. Un panel del día 14 se ancla a las
 * **00:00 de ese día**, así que la antigüedad calculada es un **límite superior**.
 * Con la ventana de 24 h eso significa que un panel con fecha de ayer no la
 * cumple aunque se hubiera tomado anoche: preferimos pedir una creatinina de más
 * que dosificar con una que no se puede demostrar reciente.
 *
 * Módulo PURO.
 */

/** El contexto que decide qué ventana aplica. */
export type ContextoRenal =
  /** AKI, hospitalizado o función renal inestable. */
  | 'inestable'
  /** Ambulatorio y alguien declaró estabilidad clínica. */
  | 'ambulatorio_estable'
  /** No se puede demostrar estabilidad, o el contexto es ambiguo. */
  | 'indeterminado'

/**
 * Las ventanas del dueño, en HORAS.
 *
 * En horas y no en días porque la primera lo está: «≤24 h» no es «≤1 día»
 * cuando lo que se compara es un sello de fecha sin hora.
 */
export const VENTANA_HORAS: Readonly<Record<ContextoRenal, number>> = {
  inestable: 24,
  ambulatorio_estable: 30 * 24,
  indeterminado: 7 * 24,
}

/** La marca que pide la política cuando el dato se pasó de su ventana. */
export const STALE_RENAL_FUNCTION = 'STALE_RENAL_FUNCTION' as const

/**
 * Lo que hace inestable a una función renal, en las palabras con que se dicta.
 *
 * Sólo lo AGUDO. La enfermedad renal **crónica** no entra: un paciente con ERC
 * estable es justamente el caso de la ventana larga, y meterlo aquí convertiría
 * a todo nefrópata en un caso de 24 h.
 *
 * **«IRA» NO está en la lista, a propósito.** En México se dicta muchísimo más
 * como *infección respiratoria aguda* que como insuficiencia renal aguda, y
 * meterla convertiría cada catarro en un caso de ventana de 24 h. Un aviso que
 * salta de más se aprende a cerrar. Se reconocen las formas escritas completas y
 * «AKI», que no es ambigua. Lo que no está aquí **no se vigila** — declarado, no
 * dado por bueno (regla 5).
 */
const RENAL_AGUDO = new RegExp([
  '\\blesion\\s+renal\\s+aguda\\b',
  '\\b(?:insuficiencia|falla|dano)\\s+renal\\s+aguda\\b',
  '\\bnecrosis\\s+tubular\\s+aguda\\b',
  '\\baki\\b',
  '\\banuria\\b|\\boliguria\\b',
  '\\brabdomiolisis\\b',
  '\\bsindrome\\s+hepatorrenal\\b',
].join('|'), 'i')

const sinAcentos = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export interface SenalesDelContexto {
  /** Hay un internamiento activo: el paciente está hospitalizado. */
  hospitalizado?: boolean
  /** Los problemas vigentes y los de hoy, para reconocer lo renal agudo. */
  diagnosticos?: readonly { descripcion?: string }[]
  /**
   * Alguien DECLARÓ que el paciente está clínicamente estable.
   *
   * No se deduce: hoy nada en el producto lo declara, y sin esto no se alcanza
   * la ventana de 30 días. Ver la cabecera.
   */
  estabilidadDeclarada?: boolean
}

/** ¿Alguno de los diagnósticos nombra un cuadro renal AGUDO? */
export function hayRenalAgudo(diagnosticos: SenalesDelContexto['diagnosticos']): boolean {
  return (diagnosticos ?? []).some(d => RENAL_AGUDO.test(sinAcentos(d?.descripcion ?? '')))
}

/** Qué ventana aplica, según la política del dueño. */
export function contextoRenal(s: SenalesDelContexto | undefined): ContextoRenal {
  if (s?.hospitalizado || hayRenalAgudo(s?.diagnosticos)) return 'inestable'
  if (s?.estabilidadDeclarada) return 'ambulatorio_estable'
  return 'indeterminado'
}

export interface VigenciaRenal {
  contexto: ContextoRenal
  ventanaHoras: number
  /** Límite SUPERIOR de la antigüedad. `null` cuando no se puede fechar. */
  antiguedadHoras: number | null
  /** ¿Sirve para una recomendación de dosificación dependiente del riñón? */
  vigente: boolean
  /** `STALE_RENAL_FUNCTION` cuando no. Ausente cuando sí. */
  marca?: typeof STALE_RENAL_FUNCTION
  /** Por qué esa ventana, en palabras, para poder decirlo en pantalla. */
  porQue: string
}

const POR_QUE: Readonly<Record<ContextoRenal, string>> = {
  inestable: 'paciente hospitalizado o con daño renal agudo',
  ambulatorio_estable: 'ambulatorio con estabilidad clínica declarada',
  indeterminado: 'no consta estabilidad clínica, así que se aplica la ventana conservadora',
}

/**
 * ¿La creatinina que van a usar los motores sigue sirviendo para dosificar?
 *
 * @param medidoEn ISO o `YYYY-MM-DD` de la medición. **Vacío o ausente significa
 *                 «se dictó en esta consulta»** —es el contrato de `labsDelCuadro`—
 *                 y entonces la antigüedad es cero.
 * @param ahoraISO El momento de la consulta. Se pasa; no se lee el reloj.
 * @param senales  El contexto que decide la ventana.
 */
export function vigenciaDeLaFuncionRenal(
  medidoEn: string | undefined,
  ahoraISO: string,
  senales?: SenalesDelContexto,
): VigenciaRenal {
  const contexto = contextoRenal(senales)
  const ventanaHoras = VENTANA_HORAS[contexto]
  const base = { contexto, ventanaHoras, porQue: POR_QUE[contexto] }

  /* Sin fecha = de esta consulta (contrato de `labsDelCuadro`): recién medida. */
  if (!medidoEn?.trim()) return { ...base, antiguedadHoras: 0, vigente: true }

  const ahora = Date.parse(ahoraISO)
  /* Una fecha sin hora se ancla a las 00:00 de ese día, así que la antigüedad
     sale al ALZA. Ver la cabecera: pedir de más, nunca dosificar de menos. */
  const medido = Date.parse(medidoEn.length <= 10 ? `${medidoEn}T00:00:00.000Z` : medidoEn)

  if (!Number.isFinite(ahora) || !Number.isFinite(medido)) {
    /**
     * Una fecha que no se puede leer NO se da por reciente. No poder fecharla es
     * justamente no poder demostrar que sirve: ausencia de dato no es dato de
     * ausencia.
     */
    return { ...base, antiguedadHoras: null, vigente: false, marca: STALE_RENAL_FUNCTION }
  }

  const antiguedadHoras = Math.max(0, (ahora - medido) / 3_600_000)
  const vigente = antiguedadHoras <= ventanaHoras
  return vigente
    ? { ...base, antiguedadHoras, vigente: true }
    : { ...base, antiguedadHoras, vigente: false, marca: STALE_RENAL_FUNCTION }
}

/** Cómo se dice una antigüedad, sin fingir precisión que la fecha no tiene. */
export function comoSeDiceLaAntiguedad(horas: number | null): string {
  if (horas === null) return 'de fecha ilegible'
  if (horas < 24) return 'de hoy'
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'de ayer'
  if (dias < 60) return `de hace ${dias} días`
  const meses = Math.floor(dias / 30)
  if (meses < 24) return `de hace ${meses} meses`
  return `de hace ${Math.floor(dias / 365)} años`
}

/**
 * El aviso que pide la política. Vacío cuando el dato está vigente.
 *
 * Dice la marca literal, la ventana que aplicaba y por qué — y termina
 * recordando de quién es la decisión. No bloquea nada.
 */
export function avisoDeFuncionRenalCaduca(v: VigenciaRenal): string {
  if (v.vigente) return ''
  const ventana = v.ventanaHoras < 48 ? `${v.ventanaHoras} h` : `${Math.round(v.ventanaHoras / 24)} días`
  return `${STALE_RENAL_FUNCTION} — la creatinina con la que se estimó la TFG es ` +
    `${comoSeDiceLaAntiguedad(v.antiguedadHoras)} y la ventana aquí es de ${ventana} ` +
    `(${v.porQue}). Hace falta función renal actualizada antes de una recomendación ` +
    'de dosificación dependiente del riñón. La decisión es del médico.'
}

export const DE_QUIEN_SON_ESTAS_CIFRAS =
  'Del dueño, el 29-ago-2026, resolviendo el NEEDS_CLINICAL_REVIEW que abrió ' +
  'REG-368: ≤24 h con AKI, hospitalizado o función renal inestable; ≤30 días en ' +
  'ambulatorio clínicamente estable; ≤7 días cuando no se puede demostrar ' +
  'estabilidad o el contexto es ambiguo. No son de este módulo.'

export const POR_QUE_NO_SE_DEDUCE_LA_ESTABILIDAD =
  'Porque decidir que una función renal es estable mirando cuánto se movió la ' +
  'creatinina exigiría un umbral de variación que nadie ha validado — lo mismo ' +
  'que la política del otro punto prohíbe. La estabilidad sólo cuenta cuando ' +
  'alguien la declara, y hoy nada en el producto la declara: por eso la ventana ' +
  'efectiva en la consulta ambulatoria es la conservadora de 7 días.'
