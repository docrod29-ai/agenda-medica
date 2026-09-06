/**
 * Validación de CURP mexicano (Clave Única de Registro de Población).
 *
 * Formato: 18 caracteres
 *   - 4 letras (apellidos + nombre, iniciales)
 *   - 6 dígitos (fecha de nacimiento AAMMDD)
 *   - 1 letra (sexo H/M)
 *   - 2 letras (entidad federativa)
 *   - 3 letras (consonantes internas)
 *   - 1 carácter (homoclave, dígito o letra)
 *   - 1 dígito (dígito verificador)
 *
 * Ejemplo: GARC890101HCHRZN09
 *
 * Nota: NO validamos contra RENAPO (eso requiere endpoint oficial).
 * Solo validamos el FORMATO sintáctico.
 */

const CURP_REGEX = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{2}[BCDFGHJKLMNPQRSTVWXYZ]{3}[A-Z\d]\d$/

/** Valida el formato del CURP. Devuelve true si pasa, false si no. */
export function validarCURP(curp: string): boolean {
  if (!curp) return false
  const limpio = curp.toUpperCase().trim()
  if (limpio.length !== 18) return false
  return CURP_REGEX.test(limpio)
}

/** Normaliza un CURP: mayúsculas, sin espacios. */
export function normalizarCURP(curp: string): string {
  return curp.toUpperCase().replace(/\s/g, '').trim()
}

/**
 * Extrae la fecha de nacimiento de un CURP válido (formato YYYY-MM-DD).
 *
 * ── EL SIGLO SALE DE LA HOMOCLAVE, NO DEL RELOJ — ASE-025 ────────────────────
 *
 * Esto comparaba las dos cifras del año contra el año actual: `AA <= 26 → siglo
 * XXI`. Con eso, un paciente nacido en **1926** salía nacido en **2026**, o sea
 * recién nacido — y de la fecha de nacimiento comen la edad, la dosis
 * pediátrica, los percentiles y las escalas de riesgo. En un consultorio de
 * internista, los pacientes de más de noventa años no son el caso raro.
 *
 * El criterio oficial del RENAPO vive DENTRO de la clave: la posición 17 (la
 * homoclave, `curp[16]`) es un **dígito** para quien nació antes del 2000 y una
 * **letra** para quien nació en el 2000 o después. No hace falta mirar el reloj
 * ni adivinar: el dato está en el propio identificador.
 *
 * Fuente: Instructivo Normativo para la Asignación de la CURP (RENAPO,
 * SEGOB) — la homoclave distingue el siglo de nacimiento.
 */
export function fechaNacimientoDesdeCURP(curp: string): string | null {
  if (!validarCURP(curp)) return null
  const limpio = normalizarCURP(curp)
  const aa = limpio.substring(4, 6)
  const mm = limpio.substring(6, 8)
  const dd = limpio.substring(8, 10)
  const homoclave = limpio.charAt(16)
  const siglo = /\d/.test(homoclave) ? '19' : '20'
  return `${siglo}${aa}-${mm}-${dd}`
}

/** Extrae sexo del CURP (H=Masculino, M=Femenino) */
export function sexoDesdeCURP(curp: string): 'Masculino' | 'Femenino' | null {
  if (!validarCURP(curp)) return null
  const letra = normalizarCURP(curp).charAt(10)
  return letra === 'H' ? 'Masculino' : letra === 'M' ? 'Femenino' : null
}
