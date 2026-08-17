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
 * ── QUÉ SE HACE CON EL RESPALDO LOCAL AL ABRIR UN ENCUENTRO ─────────────────
 *
 * LO QUE FALLABA (medido, no leído: `V15-WORKFLOW-BENCHMARK-001`, WF-10).
 *
 * Se abre un encuentro por su nota (`/consulta/<paciente>?nota=<id>`), se
 * teclea, y el teléfono se interrumpe antes de que corra el autoguardado de 30
 * segundos. Al volver, **lo tecleado no está y no se ofrece recuperarlo** — aun
 * cuando el respaldo local SÍ se escribió (comprobado en el navegador: la clave
 * `nx.consulta.bkp.<paciente>` está en `localStorage` antes y después de la
 * recarga). El dato se guarda, se conserva, y no LLEGA a nadie: es exactamente
 * la regla «el dato tiene que LLEGAR» con la escritura del lado correcto y el
 * lector del lado equivocado.
 *
 * LA CAUSA RAÍZ: una sola condición hacía dos trabajos.
 *
 * «Aplicar el respaldo solo» y «ofrecerlo» estaban gobernados por la misma
 * prueba —que el formulario estuviera VACÍO—. Para APLICAR SOLO eso es
 * correcto y no se toca: no se pisa en silencio lo que el médico ve escrito.
 * Para OFRECER es la prueba equivocada, porque al reabrir una nota concreta el
 * formulario **nunca** está vacío: trae la nota. O sea que la única rama capaz
 * de enseñar el respaldo se apagaba justo en el caso para el que existe.
 *
 * LO QUE ESTA FUNCIÓN GARANTIZA
 *
 *  · Un respaldo de OTRO encuentro no se ofrece jamás. La clave es por
 *    paciente, así que no es la familia «paciente equivocado», pero sí la de
 *    «encuentro equivocado»: pegar lo dictado de la nota A dentro de la nota B
 *    es un error medicolegal, no una molestia.
 *  · Sobre una nota FIRMADA no se ofrece nada. Es inmutable (NOM-024).
 *  · Cuando no se puede afirmar de qué nota es el respaldo y se abrió una nota
 *    concreta, se calla. Ausencia de dato no es dato de pertenencia.
 *  · Nunca se aplica solo si hay algo escrito. Se ofrece, que es visible y
 *    reversible — la regla 3 de seguridad clínica dicha en interfaz.
 *
 * Pura a propósito: no mira `window`, no lee `localStorage` y no decide CÓMO se
 * enseña. Quien la llama ya tiene todo esto en la mano.
 */
export type EstadoDelRespaldoLocal = {
  /** ¿Hay un respaldo local leído para este paciente? */
  hayRespaldo: boolean
  /** De qué nota dice el respaldo que es. `null` si no lo dice. */
  respaldoNotaId: string | null
  /** La nota que se pidió abrir (`?nota=`). `null` si es un encuentro nuevo. */
  notaAbierta: string | null
  /** ¿La nota que hay en pantalla ya está firmada? */
  notaFirmada: boolean
  /** ¿El formulario está sin nada escrito? */
  formularioVacio: boolean
}

/**
 * `APLICAR_SOLO` — reponerlo sin preguntar (nada que pisar).
 * `OFRECER`      — enseñarlo y que el médico decida.
 * `CALLAR`       — no hay nada que se pueda afirmar de este respaldo.
 */
export type QueHacerConElRespaldo = 'APLICAR_SOLO' | 'OFRECER' | 'CALLAR'

export function queHacerConElRespaldoLocal(e: EstadoDelRespaldoLocal): QueHacerConElRespaldo {
  if (!e.hayRespaldo) return 'CALLAR'
  if (e.notaFirmada) return 'CALLAR'
  if (e.notaAbierta) {
    // Se abrió una nota concreta: el respaldo tiene que ser DE ELLA, y tiene
    // que poder demostrarlo. Un respaldo mudo no se adopta.
    if (!e.respaldoNotaId || e.respaldoNotaId !== e.notaAbierta) return 'CALLAR'
    return 'OFRECER'
  }
  // Encuentro nuevo: si no hay nada escrito se repone solo (conducta de
  // siempre); si ya hay algo, se ofrece en vez de pisarlo.
  return e.formularioVacio ? 'APLICAR_SOLO' : 'OFRECER'
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
