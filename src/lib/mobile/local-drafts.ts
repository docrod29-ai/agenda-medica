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

/**
 * TODOS los prefijos de claves con PHI que deben purgarse al cerrar sesión
 * (L3 auditoría maestra 2026-07). Además del borrador de consulta, el Panel UCI
 * (SW v54+) guarda `nx.uci.lecturas.<internamientoId>` (mediciones seriadas: PAM,
 * lactato, vasopresores, SOFA…) en localStorage y `nx.uci.seed.<id>` (la nota de
 * evolución) en sessionStorage — todo PHI que sobrevivía el logout en un
 * dispositivo compartido porque la limpieza solo miraba el prefijo de consulta.
 */
export const PREFIJOS_PHI = ['nx.consulta.bkp.', 'nx.uci.'] as const

/**
 * PESTILLO ANTI-RESURRECCIÓN (bug encontrado en la auditoría del Núcleo).
 *
 * Al cerrar sesión el orden real de los hechos era: (1) se borran los borradores,
 * (2) auth.signOut(), (3) window.location → la navegación DESMONTA la consulta y
 * dispara su flush anti-pérdida, que VOLVÍA A ESCRIBIR el borrador. Y lo escribía
 * con `auth.currentUser?.uid ?? 'nx'`, que a esas alturas ya es null → se guardaba
 * con la clave 'nx' y al volver a entrar se leía con el uid real: bytes distintos,
 * JSON.parse reventaba, y el catch vacío lo descartaba en silencio.
 *
 * Lo peor de los dos mundos: el PHI seguía en el disco Y era irrecuperable, con el
 * modal diciendo "Tus borradores están a salvo".
 *
 * El pestillo cierra la ventana: una vez que se limpió por cierre de sesión, ningún
 * flush tardío puede volver a escribir. La nota sigue protegida por su guardado
 * en Firestore, que es la fuente de verdad; localStorage es solo la red de crash.
 */
let sesionCerrada = false

/** ¿Se cerró sesión y por tanto está prohibido volver a escribir borradores? */
export function borradoresBloqueados(): boolean {
  return sesionCerrada
}

/** Reabre la escritura de borradores (al montar una sesión nueva). */
export function permitirBorradores(): void {
  sesionCerrada = false
}

/** ¿Es una clave con PHI (a limpiar al cerrar sesión)? Borrador de consulta o UCI. */
export function esClaveBorrador(clave: string): boolean {
  return PREFIJOS_PHI.some(p => clave.startsWith(p))
}

/** De un conjunto de claves, cuáles deben borrarse. Pura y testeable. */
export function clavesABorrar(claves: readonly string[]): string[] {
  return claves.filter(esClaveBorrador)
}

/**
 * Borra los borradores clínicos locales. Segura: no lanza si no hay localStorage
 * (SSR) y solo toca claves de borrador. Devuelve cuántas borró.
 */
/**
 * Borra la base IndexedDB con el AUDIO crudo de las consultas (`nexusmed-recovery`)
 * al cerrar sesión. El audio se conservaba tras una transcripción fallida (o una
 * grabación interrumpida) y quedaba en disco de un dispositivo compartido — es PHI.
 * Best-effort y gateada a que exista IndexedDB (SSR / navegadores viejos).
 */
export function limpiarAudioLocal(): void {
  if (typeof window === 'undefined' || !window.indexedDB) return
  try { window.indexedDB.deleteDatabase('nexusmed-recovery') } catch { /* best-effort */ }
}

export function limpiarBorradoresLocales(): number {
  sesionCerrada = true   // ← cierra la ventana a los flush tardíos del desmonte
  if (typeof window === 'undefined') return 0
  let borradas = 0
  // localStorage: borrador de consulta + lecturas seriadas de UCI (nx.uci.*).
  if (window.localStorage) {
    try {
      const todas: string[] = []
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) todas.push(k) }
      for (const k of clavesABorrar(todas)) {
        try { localStorage.removeItem(k); borradas++ } catch { /* ignora una clave problemática */ }
      }
    } catch { /* best-effort */ }
  }
  // sessionStorage: semilla de la nota de UCI (nx.uci.seed.*) — también PHI.
  if (window.sessionStorage) {
    try {
      const todas: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k) todas.push(k) }
      for (const k of clavesABorrar(todas)) {
        try { sessionStorage.removeItem(k); borradas++ } catch { /* ignora */ }
      }
    } catch { /* best-effort */ }
  }
  return borradas
}
