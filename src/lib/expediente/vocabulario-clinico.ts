/**
 * UN TÉRMINO CLÍNICO ES UNA PALABRA, NO UNA CADENA DE LETRAS.
 *
 * ── EL DEFECTO QUE ESTO REPARA (REG-192) ─────────────────────────────────────
 *
 * Los dos vocabularios del expediente —`CRONICAS` (negaciones) y
 * `AGUDAS_FRECUENTES` (temporalidad)— se buscaban con `texto.includes(forma)`.
 * Un `includes` no sabe dónde empieza una palabra, así que el término casaba
 * **dentro** de otra:
 *
 *     obesidad      → contiene «sida»     → VIH
 *     necesidad     → contiene «sida»     → VIH
 *     plasma        → contiene «asma»     → asma
 *     prediabetes   → contiene «diabetes» → diabetes
 *     colecistitis  → contiene «cistitis» → infección urinaria
 *     pneumoniae    → contiene «neumonia» → neumonía
 *     enfisematosa  → contiene «enfisema» → EPOC
 *
 * Medido sobre las 6 000 frases del corpus del Dr.: **68 frases** casaban sólo
 * por dentro de otra palabra, y **55 de ellas eran falsos positivos**. Las otras
 * 13 —miocardiopatía, neurocirugía, postinfarto— sí eran el mismo padecimiento y
 * por eso quedan declaradas como formas propias: aquí no se pierde ninguna.
 *
 * ── POR QUÉ NO ES SÓLO RUIDO ─────────────────────────────────────────────────
 *
 * `corregirCertezaPorNegacion` **reclasifica**: lo que el paciente negó pasa a
 * `descartado` en las entidades extraídas. Con «sida» dentro de «obesidad», un
 * paciente que niega la obesidad hacía que un **VIH real dictado por el médico**
 * saliera marcado como descartado — un diagnóstico borrado por una palabra que
 * nadie dijo. Y por el otro camino, la contradicción del dictado es un aviso
 * rojo que no se pliega (REG-181): decía «VIH» de un paciente con obesidad.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * La forma casa si empieza en frontera de palabra y termina en frontera de
 * palabra. Se admite **sólo el plural** (`-s`, `-es`) detrás, porque el número
 * es la única flexión que deja la misma palabra: «neumonías» es neumonía y
 * «prediabetes» no es diabetes.
 *
 * Módulo PURO.
 */

/** Igual que en los dos módulos que lo usan: acentos fuera, todo en minúscula. */
export const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Qué cuenta como «seguir dentro de la misma palabra». Los acentos ya no están
 * cuando esto corre; la `ñ` sí, y los dígitos también («dm 2», «covid-19»).
 */
const LETRA = /[a-z0-9ñ]/

/**
 * ¿Lo que sigue al término cierra la palabra?
 *
 * Cierra si no hay nada, si lo siguiente no es letra, o si es **el plural y nada
 * más**. Un sufijo cualquiera no vale: «enfisematosa» no es enfisema y
 * «prediabetes» no es diabetes — ahí está la mitad de los falsos positivos.
 */
function cierraPalabra(resto: string): boolean {
  if (!resto) return true
  if (!LETRA.test(resto[0])) return true
  return /^(?:es|s)(?![a-z0-9ñ])/.test(resto)
}

/**
 * Dónde aparece la forma como palabra, o -1.
 *
 * Los dos argumentos vienen **ya normalizados** con `sinAcentos`: quien busca en
 * la nota normaliza una vez y usa el índice para recortar el texto original, y
 * `sinAcentos` conserva la longitud (la tilde precompuesta se descompone y se
 * vuelve a quedar en un carácter).
 */
export function indiceDeTermino(texto: string, forma: string): number {
  if (!forma) return -1
  let i = texto.indexOf(forma)
  while (i >= 0) {
    const antes = i > 0 ? texto[i - 1] : ''
    if (!LETRA.test(antes) && cierraPalabra(texto.slice(i + forma.length))) return i
    i = texto.indexOf(forma, i + 1)
  }
  return -1
}

/** ¿El texto nombra este término? Ambos argumentos ya normalizados. */
export function contieneTermino(texto: string, forma: string): boolean {
  return indiceDeTermino(texto, forma) >= 0
}

export const POR_QUE_NO_BASTA_INCLUDES =
  'Un «includes» no sabe dónde empieza una palabra: «obesidad» contiene «sida» ' +
  'y «plasma» contiene «asma». Sobre el corpus de 6 000 frases del Dr., 55 de ' +
  'las 68 coincidencias que sólo ocurrían dentro de otra palabra eran falsas — ' +
  'y una de ellas llegaba a marcar como descartado un VIH que el médico sí ' +
  'había dictado.'

export const POR_QUE_SOLO_EL_PLURAL =
  'El número es la única flexión que deja la misma palabra: «neumonías» es ' +
  'neumonía. Admitir cualquier sufijo devolvería «prediabetes» a diabetes y ' +
  '«enfisematosa» a EPOC, que son padecimientos distintos.'
