/**
 * ¿DE DÓNDE SALIÓ ESA CATEGORÍA? — decisión 3 del Dr. (3-ago-2026).
 *
 * ── LA PREGUNTA ──────────────────────────────────────────────────────────────
 *
 * Cuando la CMI dice R y el reporte del laboratorio dice S, ¿el motor **edita**
 * la categoría o sólo **advierte**?
 *
 * Respuesta del Dr.: **B condicionada**. Edita, pero SÓLO cuando se ha
 * verificado que el punto de corte aplicable es el mismo. CLSI reconoce que un
 * equipo comercial puede estar usando puntos de corte de la FDA, de otra edición
 * de CLSI, o configuraciones sin actualizar. Recalcular sin comprobar eso no
 * corrige un error: **inventa una resistencia**.
 *
 * Y descartó explícitamente la corrección asimétrica «sólo hacia lo más
 * restrictivo» (la opción C): no es una regla de CLSI y puede crear falsas
 * resistencias.
 *
 * ── LOS OCHO CAMPOS ──────────────────────────────────────────────────────────
 *
 * La procedencia está PLENAMENTE verificada cuando coinciden los ocho que el Dr.
 * enumeró. Ni siete ni «los importantes»: los ocho. Cada uno puede, por sí solo,
 * cambiar el punto de corte que aplica.
 *
 * ── LO QUE ESTO SIGNIFICA HOY, Y HAY QUE DECIRLO ─────────────────────────────
 *
 * El extractor de la foto captura método y sistema, pero **no** el estándar ni su
 * edición: eso no viene impreso en la mayoría de los reportes. Así que, mientras
 * el médico no lo declare, la procedencia NO está verificada y el motor **no
 * edita** — que es el escenario 2, el conservador.
 *
 * No es un defecto de esta implementación: es la consecuencia correcta de la
 * regla. Editar por omisión sería exactamente lo que la decisión prohíbe.
 *
 * ── «BLOQUEAR LAS CONCLUSIONES DEPENDIENTES» ─────────────────────────────────
 *
 * En el escenario 2 el Dr. pidió mostrar ambas interpretaciones y bloquear las
 * conclusiones que dependan de ese resultado. Este módulo marca **la fila**, y
 * las salidas la señalan y le dicen al modelo que no construya sobre ella.
 *
 * Un rastreo completo de dependencias —qué fenotipo y qué línea de terapia
 * cuelgan de qué celda— NO está hecho. Se dice aquí en vez de dejarlo implícito:
 * el bloqueo es a nivel de fila, no del grafo de conclusiones.
 *
 * Ver `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`, decisión 3.
 *
 * Módulo PURO.
 */

/** Qué estándar dice el laboratorio que aplicó. */
export type Estandar = 'CLSI' | 'FDA' | 'EUCAST' | 'otro' | 'desconocido'

/** Método de sensibilidad, tal como lo captura el extractor de la foto. */
export type MetodoAST = 'disco' | 'mic' | 'automatizado' | 'gradiente' | 'desconocido'

/**
 * Lo que el laboratorio declara sobre CÓMO obtuvo sus categorías.
 *
 * Todo opcional: un reporte real rara vez lo trae completo, y exigirlo para
 * poder interpretar dejaría el motor mudo. Lo que cambia con la procedencia no
 * es si el motor razona, es si se permite **editar** al laboratorio.
 */
export interface ProcedenciaAntibiograma {
  estandar?: Estandar
  /** Edición del estándar: «M100-Ed35», «2025», … Texto libre a propósito. */
  edicion?: string
  metodo?: MetodoAST
  /** Unidad de la CMI. La única que el motor sabe interpretar es mg/L (µg/mL). */
  unidad?: string
  sistema?: string
}

/** El estándar y la edición con los que están escritas las tablas del motor. */
export const ESTANDAR_DEL_MOTOR: Estandar = 'CLSI'
export const EDICION_DEL_MOTOR = 'M100-Ed35'

/** Unidades que significan mg/L. Cualquier otra cosa NO se asume equivalente. */
const UNIDADES_MGL = ['mg/l', 'mg/L', 'µg/ml', 'ug/ml', 'mcg/ml', 'μg/ml']

export interface Verificacion {
  /** `true` sólo si los OCHO campos están satisfechos. */
  verificada: boolean
  /** Qué falta, en palabras que puedan enseñarse. */
  faltan: string[]
  /** Qué se comprobó y sí cuadra. */
  cumplen: string[]
}

export interface DatosDeFila {
  /** El motor encontró tabla para este organismo + fármaco + sitio. */
  hayPuntoDeCorte: boolean
  /** La CMI es un número utilizable. */
  hayValor: boolean
  /** El punto de corte que se aplicó depende del sitio, y el sitio se declaró. */
  sitioResueltoSiHaceFalta: boolean
}

/**
 * ¿Se puede EDITAR la categoría del laboratorio con la del punto de corte?
 *
 * Devuelve además qué falta, porque un «no» sin motivo obliga al médico a
 * adivinar qué tiene que capturar para desbloquearlo.
 */
export function verificarProcedencia(
  p: ProcedenciaAntibiograma | undefined,
  fila: DatosDeFila,
): Verificacion {
  const faltan: string[] = []
  const cumplen: string[] = []

  // 1 · organismo y especie · 2 · antimicrobiano — los dos los resuelve la tabla:
  //     si el motor encontró punto de corte, es que reconoció ambos.
  if (fila.hayPuntoDeCorte) cumplen.push('organismo y antimicrobiano reconocidos en la tabla')
  else faltan.push('no hay punto de corte para este organismo y antimicrobiano')

  // 3 · método
  if (p?.metodo && p.metodo !== 'desconocido') cumplen.push(`método declarado (${p.metodo})`)
  else faltan.push('el MÉTODO no está declarado (disco, CMI, automatizado o gradiente)')

  /**
   * El disco NO produce una CMI. Si el método declarado es disco y aun así hay
   * un número, algo no cuadra en la captura y no se puede editar sobre eso.
   */
  if (p?.metodo === 'disco') faltan.push('el método declarado es DIFUSIÓN EN DISCO, que no produce una CMI comparable')

  // 4 · sitio o indicación cuando existan cortes específicos
  if (fila.sitioResueltoSiHaceFalta) cumplen.push('sitio/indicación resuelto donde el corte lo exige')
  else faltan.push('el punto de corte depende del SITIO y el sitio no está definido')

  // 5 · estándar seleccionado
  if (!p?.estandar || p.estandar === 'desconocido') {
    faltan.push('no se declaró QUÉ ESTÁNDAR usó el laboratorio (CLSI, FDA, EUCAST…)')
  } else if (p.estandar !== ESTANDAR_DEL_MOTOR) {
    faltan.push(`el laboratorio usó ${p.estandar} y el motor interpreta con ${ESTANDAR_DEL_MOTOR}: son estándares distintos`)
  } else {
    cumplen.push(`mismo estándar (${p.estandar})`)
  }

  // 6 · EDICIÓN del estándar
  if (!p?.edicion?.trim()) {
    faltan.push('no se declaró la EDICIÓN del estándar (los puntos de corte cambian entre ediciones)')
  } else if (!mismaEdicion(p.edicion, EDICION_DEL_MOTOR)) {
    faltan.push(`el laboratorio usó ${p.edicion} y el motor ${EDICION_DEL_MOTOR}: los cortes pueden diferir`)
  } else {
    cumplen.push(`misma edición (${p.edicion})`)
  }

  // 7 · unidad
  if (!p?.unidad?.trim()) faltan.push('no se declaró la UNIDAD de la CMI')
  else if (!UNIDADES_MGL.includes(p.unidad.trim().toLowerCase())) {
    faltan.push(`la unidad declarada (${p.unidad}) no es mg/L: el motor sólo interpreta mg/L`)
  } else cumplen.push(`unidad en mg/L (${p.unidad})`)

  // 8 · valor de la CMI
  if (fila.hayValor) cumplen.push('valor de CMI utilizable')
  else faltan.push('no hay un valor de CMI utilizable')

  return { verificada: faltan.length === 0, faltan, cumplen }
}

/**
 * Compara ediciones con tolerancia razonable: «M100-Ed35», «M100 Ed35», «Ed 35»
 * y «35» son la misma. Comparar cadenas crudas convertiría un espacio en una
 * discrepancia de estándar, y el médico no entendería por qué no se desbloquea.
 */
export function mismaEdicion(a: string, b: string): boolean {
  /**
   * La edición es el número que sigue a «Ed», y si no lo hay, el ÚLTIMO del
   * texto. La primera versión juntaba TODOS los números, así que «M100-Ed35» se
   * normalizaba a «100-35» y no casaba con «Ed35» → «35»: dos formas de escribir
   * la misma edición se leían como estándares distintos, y el médico no habría
   * entendido por qué no se desbloqueaba. Lo destapó su propia prueba.
   */
  const n = (s: string) => {
    const tras = s.match(/ed[\s.-]*?(\d{1,3})/i)
    if (tras) return tras[1]
    const todos = s.match(/\d{1,4}/g)
    return todos ? todos[todos.length - 1] : ''
  }
  const na = n(a), nb = n(b)
  return !!na && na === nb
}

export const POR_QUE_NO_SE_EDITA_SIN_VERIFICAR =
  'CLSI reconoce que un equipo comercial puede estar usando puntos de corte de ' +
  'la FDA, de otra edición, o configuraciones sin actualizar. Recalcular sin ' +
  'comprobar eso no corrige un error: INVENTA una resistencia. Por eso se ' +
  'exigen los ocho campos, y por eso el motor no edita por omisión.'

export const POR_QUE_NO_LA_CORRECCION_ASIMETRICA =
  'La opción «editar sólo cuando el corte es más restrictivo» quedó descartada ' +
  'por el Dr.: no es una regla de CLSI y puede crear falsas resistencias. ' +
  'Corregir en una sola dirección no es prudencia, es sesgo.'

export const ALCANCE_DEL_BLOQUEO =
  'El bloqueo es a nivel de FILA: se marca el resultado y las salidas dicen que ' +
  'no se construya sobre él. Un rastreo completo de dependencias —qué fenotipo ' +
  'y qué línea de terapia cuelgan de qué celda— NO está hecho, y se dice en vez ' +
  'de dejarlo implícito.'

/* ═══════════════════════════════════════════════════════════════════════════
 * EL ESCENARIO 1, APLICADO ANTES QUE NADA
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * La edición por punto de corte, lista para aplicarse al panel.
 *
 * Tiene la MISMA forma que una edición interpretativa EUCAST a propósito: las
 * dos sustituyen la categoría del laboratorio conservando el original, y la
 * infraestructura para eso ya existe y está probada. Duplicarla habría creado
 * dos caminos de edición que acaban divergiendo.
 */
export interface EdicionPorCorte {
  antibiotico: string
  de: SIR
  a: SIR
  razon: string
  referencia: string
}

/** `SIR` se re-declara aquí para no crear un ciclo de importación con `tipos`. */
type SIR = 'S' | 'I' | 'R'

export interface FilaParaCorte {
  antibiotico: string
  /** Categoría del laboratorio. `SDD` no se compara: no es S/I/R. */
  categoriaLab: SIR | 'SDD'
  /** Categoría que da el punto de corte, o `null` si no hay tabla. */
  categoriaCorte: SIR | 'SDD' | null
  /** El corte no aplica a este caso (foco/especie): no hay discordancia que resolver. */
  noAplicable: boolean
  soloUTI: boolean
  hayValor: boolean
  referencia: string
}

/**
 * Qué filas se EDITAN por punto de corte, y cuáles quedan bloqueadas.
 *
 * ── POR QUÉ ESTO CORRE ANTES DE LOS MÓDULOS ──────────────────────────────────
 *
 * Si la sustitución se hiciera al final —al armar la tabla de CMI— el panel
 * diría R y los fenotipos se habrían calculado con la S del laboratorio. Es
 * exactamente el defecto E0-15a que costó la v958: una pantalla donde el sistema
 * muestra R y sigue razonando con S.
 *
 * Así que la edición se decide aquí, se aplica al panel, y TODO lo demás cuelga
 * del panel ya editado.
 */
export function edicionesPorPuntoDeCorte(
  filas: FilaParaCorte[],
  procedencia: ProcedenciaAntibiograma | undefined,
  haySitio: boolean,
): { ediciones: EdicionPorCorte[]; bloqueadas: { antibiotico: string; faltan: string[] }[] } {
  const ediciones: EdicionPorCorte[] = []
  const bloqueadas: { antibiotico: string; faltan: string[] }[] = []

  for (const f of filas) {
    if (f.noAplicable || !f.categoriaCorte) continue
    // Un SDD no entra en la comparación: no es S/I/R (decisión 2 del Dr.).
    if (f.categoriaLab === 'SDD' || f.categoriaCorte === 'SDD') continue
    if (f.categoriaLab === f.categoriaCorte) continue

    const v = verificarProcedencia(procedencia, {
      hayPuntoDeCorte: true,
      hayValor: f.hayValor,
      sitioResueltoSiHaceFalta: haySitio || !f.soloUTI,
    })
    if (v.verificada) {
      ediciones.push({
        antibiotico: f.antibiotico,
        de: f.categoriaLab, a: f.categoriaCorte,
        razon: `La CMI da ${f.categoriaCorte} por el punto de corte y el laboratorio reportó `
          + `${f.categoriaLab}. La procedencia está verificada (${ESTANDAR_DEL_MOTOR} ${EDICION_DEL_MOTOR}, `
          + 'método, unidad y sitio comprobados), así que manda la CMI.',
        referencia: f.referencia,
      })
    } else {
      bloqueadas.push({ antibiotico: f.antibiotico, faltan: v.faltan })
    }
  }
  return { ediciones, bloqueadas }
}

/** El aviso de una fila bloqueada, listo para enseñarse. */
export function avisoBloqueo(b: { antibiotico: string; faltan: string[] }): string {
  return `⚠ ${b.antibiotico}: la CMI y la categoría del laboratorio NO coinciden, y la `
    + 'procedencia del punto de corte no está verificada, así que el motor NO edita nada. '
    + `Para poder resolverlo falta: ${b.faltan.join(' · ')}. `
    + 'Mientras tanto, NO construyas conclusiones sobre este resultado.'
}
