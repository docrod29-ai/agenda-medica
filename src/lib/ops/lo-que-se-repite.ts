/**
 * UN ERROR ES UN REPORTE; EL MISMO ERROR EN VARIOS ES UNA AVERÍA.
 *
 * ── EL HUECO QUE CIERRA ─────────────────────────────────────────────────────
 *
 * `/api/errores` recoge lo que revienta en el navegador —mensaje, traza, ruta,
 * quién— y lo escribe en la colección `errores`. Está bien hecho: acepta sin
 * sesión (si no, la caída más grave sería la única no reportable) y redacta el
 * texto antes de guardarlo.
 *
 * Y ahí se queda. Para enterarse hay que **abrir el panel del dueño**, o sea
 * sospechar la avería antes de saber que existe. Es exactamente la forma que
 * REG-396 cerró para los incidentes de IA, en la colección de al lado.
 *
 * ── POR QUÉ NO SE AVISA DE TODO, Y POR QUÉ NO HAY UN UMBRAL ─────────────────
 *
 * Avisar de cada error convierte el canal en ruido y se aprende a ignorarlo —
 * este árbol ya lo sabe de las alertas clínicas falsas. Pero poner «avisar a
 * partir de N por hora» es inventarse un número: ¿por qué cinco y no tres?
 *
 * Hay una frontera que **no es un número inventado**, y es cualitativa:
 *
 *   · **Un usuario** con un error puede ser su navegador, su red, su extensión,
 *     su sesión caducada. Es un reporte: se guarda y se mira cuando toque.
 *   · **Dos usuarios distintos con el MISMO error** ya no es de ninguno de los
 *     dos. Es del producto.
 *
 * Esa es la línea, y se puede defender sin elegir una cifra. Lo que cae del lado
 * del reporte **no desaparece**: sigue en la colección y en el panel. Lo único
 * que no hace es despertar a nadie a las tres de la mañana.
 *
 * ── LOS ANÓNIMOS SE CUENTAN APARTE, Y CUENTAN ───────────────────────────────
 *
 * Un error sin sesión no trae `uid`: el boundary global y los fallos de login son
 * así por definición, y son los más graves. Contarlos como «un solo usuario»
 * escondería justo la caída que impide entrar. Se cuentan por separado y **su
 * sola presencia repetida basta**: si el login revienta, nadie va a poder
 * identificarse para demostrarlo.
 *
 * Módulo PURO: sin Firestore, sin reloj, sin red.
 */

/** Lo mínimo que hace falta de un error guardado. */
export interface ErrorGuardado {
  readonly mensaje?: string
  readonly ruta?: string
  readonly uid?: string
  readonly fecha?: string
}

export interface Averia {
  /** La firma: qué reventó y dónde. */
  readonly firma: string
  readonly mensaje: string
  readonly ruta: string
  /** Cuántos reportes tiene. */
  readonly veces: number
  /** Cuántas personas DISTINTAS lo vieron. Es lo que la convierte en avería. */
  readonly personas: number
  /** Cuántos llegaron sin sesión. */
  readonly anonimos: number
}

/**
 * La firma agrupa por QUÉ y DÓNDE, no por el texto entero.
 *
 * El mensaje ya viene redactado, pero puede llevar un número que cambia entre
 * ocurrencias («falló tras 3 intentos»). Se recorta y se normaliza para que dos
 * apariciones del mismo fallo caigan juntas — si no, cada una parecería única y
 * ninguna llegaría nunca a dos personas.
 */
export function firmaDelError(e: ErrorGuardado): string {
  const msg = String(e.mensaje ?? '')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${msg} @ ${String(e.ruta ?? '').slice(0, 80)}`
}

/**
 * DOS PERSONAS DISTINTAS. No es un umbral elegido: es la frontera entre «puede
 * ser suyo» y «es nuestro».
 */
export const PERSONAS_PARA_SER_AVERIA = 2

/**
 * Las averías de una tanda de errores.
 *
 * Devuelve sólo lo que cruza la frontera, ordenado por cuánta gente lo vio y
 * luego por cuántas veces pasó — el orden en que se mira cuando algo se rompió.
 */
export function averias(errores: readonly ErrorGuardado[]): Averia[] {
  const grupos = new Map<string, { e: ErrorGuardado; veces: number; uids: Set<string>; anonimos: number }>()
  for (const e of errores) {
    const f = firmaDelError(e)
    const g = grupos.get(f) ?? { e, veces: 0, uids: new Set<string>(), anonimos: 0 }
    g.veces += 1
    const uid = String(e.uid ?? '').trim()
    if (uid) g.uids.add(uid)
    else g.anonimos += 1
    grupos.set(f, g)
  }

  return [...grupos.entries()]
    .map(([firma, g]) => ({
      firma,
      mensaje: String(g.e.mensaje ?? '').slice(0, 160),
      ruta: String(g.e.ruta ?? ''),
      veces: g.veces,
      personas: g.uids.size,
      anonimos: g.anonimos,
    }))
    .filter(a => a.personas >= PERSONAS_PARA_SER_AVERIA || a.anonimos >= PERSONAS_PARA_SER_AVERIA)
    .sort((a, b) => b.personas - a.personas || b.veces - a.veces)
}

/** El texto del aviso. Vacío si no hay nada que decir. */
export function comoSeCuenta(as: readonly Averia[]): string {
  if (!as.length) return ''
  return as.slice(0, 5).map(a => {
    const quien = a.personas >= PERSONAS_PARA_SER_AVERIA
      ? `${a.personas} personas`
      : `${a.anonimos} reportes sin sesión`
    return `· ${a.mensaje || '(sin mensaje)'}\n  en ${a.ruta || '(sin ruta)'} — ${quien}, ${a.veces} veces`
  }).join('\n')
}

export const POR_QUE_DOS_Y_NO_UN_NUMERO =
  'Un usuario con un error puede ser su navegador, su red o su sesión caducada: '
  + 'es un reporte. Dos usuarios distintos con el MISMO error ya no es de ninguno '
  + 'de los dos, es del producto. Esa frontera es cualitativa y se puede defender; '
  + '«a partir de cinco por hora» habría sido un número inventado.'

export const POR_QUE_LOS_ANONIMOS_CUENTAN =
  'Un error sin sesión no trae uid, y ésos son el boundary global y los fallos de '
  + 'login — los más graves. Contarlos como una sola persona escondería justo la '
  + 'caída que impide entrar: si el login revienta, nadie puede identificarse para '
  + 'demostrarlo.'

export const LO_QUE_NO_AVISA =
  'Lo que no cruza la frontera NO desaparece: sigue en la colección y en el panel '
  + 'del dueño. Lo único que no hace es despertar a nadie.'
