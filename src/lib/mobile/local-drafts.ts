/**
 * Limpieza de borradores clínicos en localStorage (Iteración 7 · P0 de PHI).
 *
 * El respaldo de la consulta (`nx.consulta.bkp.<paciente>…`) guarda contenido
 * clínico (dx, medicamentos, transcripción). En un dispositivo COMPARTIDO ese
 * residuo no debe quedar tras cerrar sesión (§7.2, §9.2 "limpiar caché sensible
 * al cerrar sesión"). Este módulo borra SOLO esas claves — nunca preferencias
 * (tema, etc.). NO toca el round-trip activo de recuperación (para no arriesgar
 * la pérdida de borradores); esa parte se endurece por separado con verificación
 * en dispositivo.
 *
 * Funciones puras (clasificación de claves) + un wrapper delgado sobre localStorage.
 */

/** Prefijo exacto de las claves de borrador clínico. */
export const PREFIJO_BORRADOR = 'nx.consulta.bkp.'

/** ¿Es una clave de borrador clínico (a limpiar al cerrar sesión)? */
export function esClaveBorrador(clave: string): boolean {
  return clave.startsWith(PREFIJO_BORRADOR)
}

/** De un conjunto de claves, cuáles deben borrarse. Pura y testeable. */
export function clavesABorrar(claves: readonly string[]): string[] {
  return claves.filter(esClaveBorrador)
}

/**
 * Borra los borradores clínicos locales. Segura: no lanza si no hay localStorage
 * (SSR) y solo toca claves de borrador. Devuelve cuántas borró.
 */
export function limpiarBorradoresLocales(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0
  try {
    const todas: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) todas.push(k)
    }
    const aBorrar = clavesABorrar(todas)
    for (const k of aBorrar) {
      try { localStorage.removeItem(k) } catch { /* ignora una clave problemática */ }
    }
    return aBorrar.length
  } catch {
    return 0
  }
}
