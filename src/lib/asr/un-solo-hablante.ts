/**
 * UN MONÓLOGO NO ES UN DIÁLOGO — I-4 del loop «grabación perfecta».
 *
 * ── LO QUE EL MÉDICO CONTESTÓ ───────────────────────────────────────────────
 *
 * Preguntado quién habla en la grabación, marcó tres cosas y **no** marcó una
 * cuarta:
 *
 *   ✓ Consulta: el paciente y yo conversando
 *   ✓ UCI: yo dictando por aparatos
 *   ✓ Hospital: yo dictando la evolución
 *   ✗ Consulta: yo dictando solo
 *
 * O sea: **en dos de los tres módulos habla una sola persona**. Y el sistema
 * pedía separación de voces en los tres por igual.
 *
 * ── POR QUÉ IMPORTA, Y NO ES SÓLO COSTO ─────────────────────────────────────
 *
 * El texto que ve la IA se arma como un diálogo con etiquetas:
 *
 *     Médico: ¿desde cuándo la fiebre?
 *     Paciente: como tres días
 *
 * Si el reconocedor parte a UNA sola persona en dos hablantes —cosa que hace,
 * porque los diarizadores tienden a sobre-segmentar cuando cambia el tono o hay
 * una pausa larga—, ese mismo armado produce:
 *
 *     Médico adscrito: el paciente lleva tres días con fiebre
 *     Paciente: y la creatinina en uno punto ocho
 *
 * Y a partir de ahí, **el motor de negaciones y el de procedencia razonan sobre
 * una atribución falsa**: la diferencia entre «el paciente lo afirmó» y «el
 * médico lo dictó» es justo la que sostiene esas dos defensas.
 *
 * En un pase de visita, el médico dictando los datos de su propio paciente se
 * convierte en un paciente que nunca habló.
 *
 * ── LAS DOS PIEZAS, Y POR QUÉ HACEN FALTA LAS DOS ───────────────────────────
 *
 * **1. La red de seguridad (`esMonologo`).** Si al final sólo hubo UN hablante,
 * no se arma diálogo: se manda texto plano. Funciona **pase lo que pase** —
 * aunque el tipo de nota esté mal clasificado, aunque el médico dicte solo una
 * consulta, aunque el diarizador devuelva algo raro.
 *
 * **2. El ahorro (`esDictado`).** Si el tipo de nota es de dictado, ni siquiera
 * se pide la separación: es trabajo, dinero y espera para nada.
 *
 * El orden importa: **la red va primero**. Con ella puesta, equivocarse en la
 * clasificación de la pieza 2 no hace daño — como mucho se paga una diarización
 * inútil. Sin ella, un tipo mal clasificado se traga la conversación real.
 *
 * ── POR QUÉ LA LISTA DE DICTADO ES CORTA A PROPÓSITO ────────────────────────
 *
 * Sólo entran las dos que él nombró. La nota de INGRESO no entra, aunque sea de
 * hospital: un ingreso se hace interrogando al paciente, y ahí sí hay dos voces.
 *
 * La regla al clasificar es **ante la duda, diarizar**. Quedarse sin separación
 * en una conversación real pierde información que no se recupera; diarizar un
 * monólogo sólo cuesta unos segundos, y la pieza 1 limpia el resultado.
 *
 * Módulo PURO, sin dependencias de red ni de framework.
 */

/** Un turno diarizado, en lo mínimo que hace falta mirar. */
export interface TurnoDeHabla {
  speaker: string
}

/** Cuántas personas distintas se oyeron. */
export function hablantesDistintos(turnos: readonly TurnoDeHabla[] | undefined): string[] {
  const vistos = new Set<string>()
  for (const t of turnos ?? []) {
    const s = String(t?.speaker ?? '').trim()
    if (s) vistos.add(s)
  }
  return [...vistos].sort()
}

/**
 * ¿Habló una sola persona?
 *
 * Sin turnos también responde `true`: si no hay diarización no hay diálogo que
 * armar, y tratar la ausencia como si fuera una conversación es justo el error
 * que este módulo evita.
 */
export function esMonologo(turnos: readonly TurnoDeHabla[] | undefined): boolean {
  return hablantesDistintos(turnos).length <= 1
}

/**
 * Los tipos de nota que el médico dicta SOLO.
 *
 * Salen de lo que contestó, literal, y de nada más. Si mañana dice que también
 * dicta solo los egresos, se añade aquí — no se deduce.
 */
export const TIPOS_DE_DICTADO: readonly string[] = [
  /** «UCI: yo dictando por aparatos». */
  'evolucion_uci',
  /** «Hospital: yo dictando la evolución». */
  'evolucion',
]

/**
 * ¿Este tipo de nota se dicta solo?
 *
 * Ante la duda, `false` — o sea, se diariza. Perder la separación en una
 * conversación real cuesta información que no se recupera; diarizar un monólogo
 * sólo cuesta unos segundos, y `esMonologo` limpia el resultado.
 */
export function esDictado(tipoNota: unknown): boolean {
  return TIPOS_DE_DICTADO.includes(String(tipoNota ?? ''))
}

export const POR_QUE_LA_RED_VA_PRIMERO =
  'Con la red puesta, equivocarse al clasificar un tipo de nota sólo cuesta una ' +
  'diarización inútil. Sin ella, un tipo mal clasificado se traga la ' +
  'conversación real y no hay forma de recuperarla.'

export const POR_QUE_EL_INGRESO_NO_ES_DICTADO =
  'Un ingreso se hace interrogando al paciente: ahí sí hay dos voces. Es de ' +
  'hospital, pero no es un dictado.'

export const LO_QUE_PASABA =
  'El reconocedor parte a una sola persona en dos hablantes cuando cambia el ' +
  'tono o hay una pausa larga. Con el armado de diálogo, el médico dictando los ' +
  'datos de su paciente se convertía en un paciente que nunca habló — y el ' +
  'motor de negaciones y el de procedencia razonaban sobre esa atribución falsa.'
