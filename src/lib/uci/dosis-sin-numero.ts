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

/** Palabras que, colocadas antes de la unidad, SÍ son una cantidad. */
const ES_CANTIDAD = new RegExp(
  '^(\\d+([.,]\\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|'
  + 'once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|'
  + 'noventa|cien|ciento|cientos|doscientos|trescientos|cuatrocientos|quinientos|'
  + 'seiscientos|setecientos|ochocientos|novecientos|mil|medio|media)$', 'i')

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
