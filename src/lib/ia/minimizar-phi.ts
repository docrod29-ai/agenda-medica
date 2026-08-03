/**
 * LO QUE SALE HACIA EL PROVEEDOR, Y LO QUE SE QUEDA GUARDADO.
 *
 * ── DOS REGLAS ESCRITAS EN UN COMENTARIO QUE NADA HACÍA CUMPLIR ──────────────
 *
 * **1. El contexto del paciente.** `api/consultor-evidencia` recibe
 * `contextoPaciente` como **texto libre** del cliente y lo manda al proveedor.
 * Las dos pantallas que lo llaman ya lo minimizan —una de ellas con un comentario
 * que dice, literalmente, «SIN EL NOMBRE… había dos políticas opuestas para el
 * mismo endpoint»—, pero la corrección se aplicó a los clientes, **no a la
 * puerta**. Una tercera pantalla, o un cliente modificado, manda lo que quiera.
 *
 * **2. La memoria del médico.** `extraerAprendizajes` le pide a un modelo que
 * saque hechos durables y `aprenderDeMedico` los **persiste**. La única
 * protección era una instrucción en el prompt: «NUNCA extraigas datos de
 * pacientes». Un prompt no es una compuerta — describe una intención, y lo que
 * el modelo devuelva se guarda tal cual, filtrado sólo por longitud.
 *
 * ── LO QUE ESTE MÓDULO NO PUEDE HACER, Y HAY QUE DECIRLO ─────────────────────
 *
 * **No detecta nombres.** «María González» y «monoterapia con vancomicina» son
 * dos cadenas de texto y ninguna regla determinista las distingue sin un
 * diccionario que no existe. Prometer que aquí se quitan los nombres sería
 * cambiar un riesgo por un riesgo peor: la falsa tranquilidad.
 *
 * Lo que sí se quita es lo que tiene FORMA propia y comprobable: CURP, RFC,
 * teléfonos, correos, fechas completas y tiras largas de dígitos (folios,
 * expedientes, pólizas). Y lo que se quitó se DECLARA, para que un
 * consultorio pueda ver que su equipo está pegando identificadores.
 *
 * Módulo PURO.
 */

export interface Redaccion {
  texto: string
  /** Qué clases de identificador se encontraron. Vacío = ninguno. */
  redactados: string[]
}

/**
 * Patrones con forma propia. El orden importa: el CURP contiene una fecha, así
 * que va antes de la regla de fechas para no dejar la mitad.
 */
const PATRONES: { clase: string; re: RegExp; marca: string }[] = [
  // CURP: 4 letras + 6 dígitos + H/M + 5 letras + 2 alfanum. Formato oficial.
  { clase: 'CURP', re: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}\b/gi, marca: '[CURP]' },
  // RFC de persona física (4 letras) o moral (3). Con o sin homoclave.
  { clase: 'RFC', re: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3}\b/gi, marca: '[RFC]' },
  { clase: 'correo', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, marca: '[correo]' },
  // Fecha completa: una fecha de nacimiento identifica más que la edad, y para
  // decidir clínicamente basta la edad, que sí pasa.
  { clase: 'fecha completa', re: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g, marca: '[fecha]' },
  /**
   * Tiras largas de dígitos —folio, expediente, póliza, NSS— ANTES que el
   * teléfono, y con lookarounds.
   *
   * Sin las dos cosas, una póliza de catorce dígitos la mordía primero el patrón
   * de teléfono por en medio y quedaba `304[teléfono]`: **una redacción parcial
   * que deja los primeros dígitos a la vista**. Tachar a medias es peor que no
   * tachar, porque parece que sí se tachó.
   */
  { clase: 'identificador numérico', re: /(?<!\d)\d{7,}(?!\d)/g, marca: '[folio]' },
  // Teléfono MX: 10 dígitos, con o sin lada internacional y separadores. Los
  // lookarounds impiden que empiece o termine en mitad de un número más largo.
  { clase: 'teléfono', re: /(?<!\d)(?:\+?52[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}(?!\d)/g, marca: '[teléfono]' },
]

/**
 * Quita los identificadores con forma reconocible.
 *
 * @returns el texto ya redactado y las clases encontradas.
 */
export function redactarIdentificadores(texto: string | undefined | null): Redaccion {
  let t = String(texto ?? '')
  const redactados: string[] = []
  for (const p of PATRONES) {
    p.re.lastIndex = 0
    if (p.re.test(t)) {
      redactados.push(p.clase)
      p.re.lastIndex = 0
      t = t.replace(p.re, p.marca)
    }
  }
  return { texto: t, redactados }
}

/** Tope del contexto que viaja. Lo que no cabe, no viaja. */
export const TOPE_CONTEXTO = 1500

/**
 * El contexto del paciente, listo para salir hacia el proveedor.
 *
 * Se aplica **en la puerta**, no en cada pantalla: una regla que vive en el
 * cliente sólo la cumplen los clientes que se acuerden.
 */
export function minimizarContextoPaciente(texto: string | undefined | null): Redaccion {
  const r = redactarIdentificadores(String(texto ?? '').trim().slice(0, TOPE_CONTEXTO))
  return r
}

/**
 * ¿Este «hecho durable» puede guardarse en la memoria del médico?
 *
 * La memoria describe al MÉDICO —su especialidad, los esquemas que prefiere, la
 * población que atiende—. Un hecho con un identificador dentro no describe al
 * médico: describe a un paciente concreto, y ahí no va.
 *
 * Se rechaza en vez de redactar: un hecho al que hay que tacharle un teléfono
 * no era un hecho sobre la práctica del médico, y guardarlo a medias deja una
 * frase rara en la memoria para siempre.
 */
export function seguroParaMemoria(hecho: string | undefined | null): boolean {
  const t = String(hecho ?? '').trim()
  if (t.length <= 3 || t.length >= 200) return false
  return redactarIdentificadores(t).redactados.length === 0
}

export const LO_QUE_NO_DETECTA =
  'Este módulo NO detecta nombres propios: «María González» y «monoterapia con ' +
  'vancomicina» son dos cadenas de texto y ninguna regla determinista las ' +
  'distingue sin un diccionario que no existe. Prometer que aquí se quitan los ' +
  'nombres sería cambiar un riesgo por otro peor: la falsa tranquilidad. Lo que ' +
  'se quita es lo que tiene forma propia y comprobable.'
