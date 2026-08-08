/**
 * DOSIS QUE PERDIÓ SU NÚMERO — detectado en el corpus de 498 audios.
 *
 * El error que sobrevivió a todo lo demás, y es el más peligroso de la corrida:
 *
 *     se dijo:   «Meropenem DOS gramos cada ocho horas en infusión extendida»
 *     se entendió: «Meropenem gramos cada ocho horas en infusión extendida»
 *
 * Falla **6 de 6 veces**, en las tres voces. El reconocedor funde «-nem dos» en
 * «-nem» y la cifra desaparece. Está en el prompt de vocabulario palabra por
 * palabra y aun así falla: no es un problema de sesgo.
 *
 * ── POR QUÉ NO SE ARREGLA ADIVINANDO ─────────────────────────────────────────
 *
 * Sería trivial escribir «si falta el número, pon 2». Y sería inventar una dosis.
 * Un meropenem puede ser de 500 mg, de 1 g o de 2 g según la indicación y la
 * función renal, y el sistema no sabe cuál se dijo — sólo sabe que **había una y
 * se perdió**.
 *
 * Así que esto NO corrige: **detecta y avisa**. Una dosis sin número es una orden
 * rota, y lo peligroso no es que falte: es que pase desapercibida.
 *
 * Módulo PURO.
 */

/** Unidades de dosis que siempre van precedidas de una cifra. */
const UNIDADES_DOSIS = [
  'gramos', 'gramo', 'g',
  'miligramos', 'miligramo', 'mg',
  'microgramos', 'microgramo', 'mcg', 'µg',
  'unidades', 'unidad', 'ui',
  'mililitros', 'mililitro', 'ml',
] as const

/**
 * Palabras que, colocadas antes de la unidad, SÍ son una cantidad.
 *
 * ── EL SIGNO CUENTA COMO PARTE DE LA CIFRA (medido el 4-ago-2026) ────────────
 *
 * Sin `[-+−–]?` esta expresión leía «−1500 mL» y concluía que **faltaba la
 * cantidad**. En el corpus de 6 000 frases del Dr. eso ocurrió **25 veces, todas
 * de balance hídrico**: «Ingresos 1200 mL, egresos 800 mL y balance neto −1500 mL».
 *
 * Un balance negativo es lo normal en un paciente en diuresis o en
 * ultrafiltración. Preguntar en todos ellos es **fatiga de alerta** justo donde
 * la atención del médico es más escasa — y esta misma compuerta es la que avisa
 * de una dosis que perdió su número. Un aviso que salta donde no debe se acaba
 * ignorando, y con él se ignoran los que sí importan.
 *
 * Se aceptan los cuatro signos que aparecen en un dictado transcrito: el menos
 * de teclado, el más, el menos tipográfico (U+2212) y la raya (U+2013), porque
 * el reconocedor y los editores los intercambian sin avisar.
 *
 * **No debilita la defensa**: el signo sólo vale si va pegado a una cifra. Una
 * unidad sin número delante se sigue marcando igual.
 *
 * ── EL HUECO DEL 13 AL 29 (medido el 8-ago-2026) ─────────────────────────────
 *
 * La lista iba 1…12, saltaba a 15, a 20, y de ahí a las decenas. Faltaban en
 * letra el 13, el 14, el 16-19 y **todo el 21-29**. Como el reconocedor
 * transcribe en letra lo que se dicta en letra, «metoprolol veinticinco
 * miligramos» se leía como una unidad sin cantidad delante:
 *
 *     ALERTA  «veinticinco miligramos»: falta la cantidad.
 *
 * — con la cantidad delante, en la misma frase. Y no era sólo un cartel: en
 * `corrector-vigilado.ts` una dosis rota levanta `requiereConfirmacion`, así que
 * la dosis bien dictada le pedía confirmación al médico.
 *
 * El hueco cae justo donde vive la posología de consulta: 25 mg es metoprolol,
 * espironolactona, captopril, hidroclorotiazida, losartán; 18 unidades es una
 * glargina cualquiera. Es el mismo daño que el balance negativo de arriba —
 * fatiga de alerta en la compuerta que avisa de una dosis perdida — pero en la
 * pantalla que más se usa.
 *
 * Las decenas compuestas con «y» ya funcionaban por accidente: en «treinta y
 * cinco miligramos» la palabra previa es «cinco». Sólo fallaban las que se
 * escriben en una sola palabra, que son precisamente las del 21 al 29.
 *
 * Van sin acento a propósito: lo que se compara es la salida de `norm`, que ya
 * quitó los diacríticos («dieciséis» → «dieciseis», «veintiún» → «veintiun»).
 */
const ES_CANTIDAD = new RegExp(
  '^([-+−–]?\\d+([.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|'
  + 'once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|'
  + 'veintiun|veintiuno|veintiuna|veintidos|veintitres|veinticuatro|veinticinco|'
  + 'veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|'
  + 'setenta|ochenta|noventa|cien|ciento|cientos|doscientos|trescientos|cuatrocientos|'
  + 'quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|medio|media)$', 'i')

export interface DosisRota {
  /** La palabra anterior a la unidad: normalmente el fármaco. */
  antes: string
  /** La unidad que quedó huérfana. */
  unidad: string
  /** Frase para la pantalla. */
  mensaje: string
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Busca unidades de dosis sin cifra delante.
 *
 * @returns las dosis rotas encontradas. Vacío = no se detectó ninguna. **No
 *   garantiza que no haya**: sólo detecta el patrón «unidad sin cantidad».
 */
export function dosisSinNumero(texto: string): DosisRota[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const rotas: DosisRota[] = []

  for (let i = 1; i < palabras.length; i++) {
    const limpia = norm(palabras[i]).replace(/[.,;:]$/, '')
    if (!(UNIDADES_DOSIS as readonly string[]).includes(limpia)) continue

    const previa = norm(palabras[i - 1]).replace(/[.,;:]$/, '')
    if (ES_CANTIDAD.test(previa)) continue          // tiene su cifra: correcto
    // «cada ocho horas» y similares no son dosis: la unidad va DESPUÉS del número.
    if (previa === 'cada' || previa === 'por' || previa === 'de') continue

    const antes = palabras[i - 1].replace(/[.,;:]$/, '')
    rotas.push({
      antes,
      unidad: palabras[i].replace(/[.,;:]$/, ''),
      mensaje: `«${antes} ${palabras[i]}»: falta la cantidad. `
        + 'El sistema NO la completa — una dosis inventada es peor que una dosis ausente.',
    })
  }
  return rotas
}

export const AVISO_DOSIS_ROTA =
  'Se detectó una unidad de dosis sin cantidad delante. Es el fallo de dictado ' +
  'más peligroso que se midió en el corpus de UCI: el reconocedor funde el número ' +
  'con el nombre del fármaco («meropenem dos gramos» → «meropenem gramos») y la ' +
  'dosis desaparece sin que nada avise. Revise la cifra antes de firmar.'
