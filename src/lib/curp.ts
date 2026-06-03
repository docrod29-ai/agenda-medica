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

/** Extrae fecha de nacimiento de un CURP válido (formato YYYY-MM-DD). Asume siglo según año actual. */
export function fechaNacimientoDesdeCURP(curp: string): string | null {
  if (!validarCURP(curp)) return null
  const aa = curp.substring(4, 6)
  const mm = curp.substring(6, 8)
  const dd = curp.substring(8, 10)
  const ahoraAA = new Date().getFullYear() % 100
  // Si AA <= año actual de 2 cifras → siglo XXI; si no → siglo XX
  const siglo = parseInt(aa) <= ahoraAA ? '20' : '19'
  return `${siglo}${aa}-${mm}-${dd}`
}

/** Extrae sexo del CURP (H=Masculino, M=Femenino) */
export function sexoDesdeCURP(curp: string): 'Masculino' | 'Femenino' | null {
  if (!validarCURP(curp)) return null
  const letra = curp.charAt(10)
  return letra === 'H' ? 'Masculino' : letra === 'M' ? 'Femenino' : null
}
