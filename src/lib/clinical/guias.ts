/**
 * UNA GUÍA CLÍNICA ES UN OBJETO, NO UNA CADENA — WS-07.
 *
 * ── QUÉ HAY HOY ─────────────────────────────────────────────────────────────
 *
 * Las guías se citan como texto fijo dentro de los motores: `'KDIGO 2020'`,
 * `'ESC 2024'`, `'IDSA 2026 AMR'`, `'Surviving Sepsis 2026'`. Son 112 campos
 * `referencia` en el registro de motores, y el médico los lee tal cual en la
 * pantalla de cumplimiento, bajo el título «De dónde salen sus reglas».
 *
 * ── EL PROBLEMA, QUE NO ES DE FORMATO ───────────────────────────────────────
 *
 * Una cadena no puede decir **si esa edición sigue siendo la vigente**.
 *
 * Las guías se sustituyen. Un motor que cita `KDIGO 2020` sigue citando
 * `KDIGO 2020` el día que sale la edición siguiente, y la pantalla lo enseña con
 * el mismo aspecto de antes: una referencia, sin más. El médico no tiene forma
 * de saber si está leyendo la actual o una superada, y **el sistema tampoco**.
 *
 * ── LA LÍNEA QUE ESTE MÓDULO NO CRUZA ───────────────────────────────────────
 *
 * **Aquí no se declara qué guía está vigente.** Cuál es la edición actual de
 * KDIGO, si la anterior sigue siendo aceptable, o cuál de dos guías válidas
 * manda cuando discrepan, son **hechos clínicos** — y la regla 1 prohíbe
 * inventarlos igual que prohíbe inventar una dosis.
 *
 * Rellenar esta tabla de memoria sería el fallo más caro posible: no rompe nada,
 * no falla ninguna prueba, y sale impreso al lado de una recomendación con
 * aspecto de haber sido comprobado.
 *
 * Así que **toda guía nace `no_verificada`**, y `vigente` o `superada` exigen
 * fuente y fecha de verificación. Lo que este módulo aporta hoy es que el hueco
 * **se vea**: el médico lee «la vigencia de esta edición no está verificada por
 * el sistema» en vez de leer una referencia muda.
 *
 * Módulo PURO.
 */

/**
 * Estado de vigencia de una edición.
 *
 * `no_verificada` es el estado por defecto y **no es una falta**: es la verdad
 * mientras nadie con criterio clínico lo haya comprobado.
 */
export type Vigencia = 'no_verificada' | 'vigente' | 'superada'

export interface Guia {
  /** Quién la publica: KDIGO, IDSA, ESC, NICE, ADA, CENETEC… */
  readonly organizacion: string
  /** El año o la versión, tal como lo declara la cita. */
  readonly version: string
  readonly titulo?: string
  /** Dónde aplica. Ausente = no se sabe, no «en todas partes». */
  readonly jurisdiccion?: string
  readonly vigencia: Vigencia
  /**
   * Obligatorio si `vigencia` no es `no_verificada`: **quién lo comprobó y
   * contra qué**. Un estado de vigencia sin esto es una afirmación clínica sin
   * respaldo.
   */
  readonly fuente?: string
  /** Instante ISO de esa comprobación. La vigencia caduca; la fecha lo dice. */
  readonly verificadoEn?: string
  /** Qué edición la sustituye, cuando consta. */
  readonly superadaPor?: string
}

/**
 * Las organizaciones que este árbol cita hoy.
 *
 * Salen de leer el registro de motores, no de un catálogo ideal: es el censo de
 * lo que de verdad se nombra. Una organización nueva que aparezca en una
 * referencia y no esté aquí la caza el guardián.
 */
export const ORGANIZACIONES: readonly string[] = Object.freeze([
  'KDIGO', 'IDSA', 'ESC', 'ACC/AHA', 'AHA', 'NICE', 'ADA', 'CENETEC',
  'Surviving Sepsis', 'CLSI', 'EUCAST', 'ASHP', 'ATS', 'GOLD', 'AST', 'PADIS',
])

/** Lo que se pudo leer de una cita de texto, sin adivinar nada. */
export type LecturaDeCita =
  | { readonly reconocida: true; readonly organizacion: string; readonly version: string }
  /** No se reconoce como cita de guía. **No** significa que no lo sea. */
  | { readonly reconocida: false; readonly porQue: string }

/**
 * Lee una cita de guía escrita a mano.
 *
 * Deliberadamente **estricta**: exige una organización conocida seguida de un
 * año de cuatro cifras. Muchos campos `referencia` del registro son prosa larga
 * —el fundamento entero de un algoritmo— y no son citas; tratarlas como tales
 * fabricaría guías que nadie citó.
 *
 * Ante la duda devuelve `reconocida: false`, que es lo honesto: este módulo no
 * puede decir si un párrafo de dos líneas cita KDIGO 2020 o lo menciona de paso.
 */
export function leerCitaDeGuia(texto: string | undefined | null): LecturaDeCita {
  const t = String(texto ?? '').trim()
  if (!t) return { reconocida: false, porQue: 'Sin texto.' }
  const bajo = t.toLowerCase()
  for (const org of ORGANIZACIONES) {
    const i = bajo.indexOf(org.toLowerCase())
    if (i === -1) continue
    /**
     * La organización, y su año **cerca**: dentro de los veinticinco caracteres
     * siguientes. Más lejos ya no es una cita —es un párrafo que la menciona— y
     * tratarlo como cita fabricaría una guía que nadie citó.
     */
    const cerca = t.slice(i + org.length, i + org.length + 25)
    const m = /\b((?:19|20)\d{2})\b/.exec(cerca)
    if (m) return { reconocida: true, organizacion: org, version: m[1] }
  }
  return { reconocida: false, porQue: 'No se reconoce una organización de guía seguida de su año.' }
}

/**
 * La guía que se deduce de una cita de texto — siempre **sin verificar**.
 *
 * No hay ninguna vía en este módulo para que una cita de texto salga `vigente`:
 * eso exige que alguien lo compruebe y lo firme.
 */
export function guiaDesdeCita(texto: string | undefined | null): Guia | null {
  const l = leerCitaDeGuia(texto)
  if (!l.reconocida) return null
  return { organizacion: l.organizacion, version: l.version, vigencia: 'no_verificada' }
}

/**
 * ¿Este estado de vigencia está respaldado?
 *
 * `no_verificada` siempre lo está —no afirma nada—. Los otros dos exigen fuente
 * y fecha, porque afirman un hecho clínico.
 */
export function vigenciaRespaldada(g: Guia): boolean {
  if (g.vigencia === 'no_verificada') return true
  return Boolean(g.fuente?.trim() && g.verificadoEn?.trim())
}

/**
 * Lo que se le dice al médico junto a una referencia que cita una guía.
 *
 * `null` cuando no se reconoce una cita: añadir un aviso a un párrafo de prosa
 * lo llenaría todo de ruido, y un aviso que se ignora no protege a nadie.
 */
export function avisoDeVigencia(
  referencia: string | undefined | null,
  verificadas: readonly Guia[] = GUIAS_VERIFICADAS,
): string | null {
  const g = guiaDesdeCita(referencia)
  if (!g) return null
  /**
   * Si alguien con criterio clínico ya comprobó ESTA edición, se dice lo que
   * comprobó — y sólo si su comprobación viene con fuente y fecha
   * (`vigenciaRespaldada`). Una vigencia declarada sin respaldo no puede ganarle
   * al aviso: sería exactamente la afirmación sin comprobar que este módulo
   * existe para impedir, sólo que escrita en una tabla.
   */
  const v = verificadas.find(x =>
    x.organizacion === g.organizacion && x.version === g.version && vigenciaRespaldada(x),
  )
  if (v?.vigencia === 'vigente') {
    return `Cita ${v.organizacion} ${v.version}, verificada como vigente el ${v.verificadoEn} (${v.fuente}).`
  }
  if (v?.vigencia === 'superada') {
    return `Cita ${v.organizacion} ${v.version}, que quedó SUPERADA${v.superadaPor ? ` por ${v.superadaPor}` : ''} (verificado el ${v.verificadoEn}). Revisa la recomendación antes de apoyarte en ella.`
  }
  return `Cita ${g.organizacion} ${g.version}. El sistema NO verifica si esa edición sigue vigente: compruébalo antes de apoyarte en ella.`
}

/**
 * Las guías cuya vigencia ha comprobado alguien con criterio clínico.
 *
 * **Vacía, y no por descuido.** Ninguna edición se ha verificado todavía; el día
 * que el dueño lo haga, cada fila trae su `fuente` y su `verificadoEn` y la
 * pantalla pasa a decir lo comprobado en vez del aviso. Rellenarla desde aquí
 * sería inventar el hecho clínico que esta tabla existe para NO inventar.
 */
export const GUIAS_VERIFICADAS: readonly Guia[] = Object.freeze([])

/**
 * Dos guías válidas que dicen cosas distintas.
 *
 * El modelo existe; **la tabla está vacía a propósito**. Qué hacer cuando ESC y
 * ACC/AHA discrepan es criterio clínico, y escribirlo aquí sin que lo decida un
 * médico sería fijar política clínica — que está en la lista de prohibiciones
 * del repositorio.
 */
export interface Discrepancia {
  readonly sobre: string
  readonly guias: readonly Guia[]
  /** Qué hacer. Lo escribe un médico o no existe. */
  readonly queHacer: string
  readonly decididoPor: string
}

export const DISCREPANCIAS: readonly Discrepancia[] = Object.freeze([])

export const POR_QUE_NINGUNA_ESTA_VIGENTE =
  'Cuál es la edición actual de una guía, si la anterior sigue siendo aceptable ' +
  'y cuál de dos guías válidas manda cuando discrepan son HECHOS CLÍNICOS. La ' +
  'regla 1 prohíbe inventarlos igual que prohíbe inventar una dosis, y rellenar ' +
  'esta tabla de memoria sería el fallo más caro posible: no rompe nada, no ' +
  'falla ninguna prueba, y sale impreso al lado de una recomendación con aspecto ' +
  'de haber sido comprobado.'

export const POR_QUE_LA_CADENA_NO_BASTA =
  'Una cadena no puede decir si esa edición sigue vigente. Un motor que cita ' +
  '«KDIGO 2020» lo sigue citando igual el día que sale la siguiente edición, y ' +
  'la pantalla lo enseña con el mismo aspecto: una referencia, sin más. Ni el ' +
  'médico ni el sistema pueden distinguir la actual de una superada.'

export const LO_QUE_FALTA_PARA_CERRARLO =
  'Que el dueño (o un médico designado) verifique, guía por guía, cuál es la ' +
  'edición vigente y cuáles quedaron superadas, con la fuente y la fecha de esa ' +
  'comprobación. Hasta entonces, el sistema DICE que no lo sabe, que es lo único ' +
  'honesto que puede hacer.'
