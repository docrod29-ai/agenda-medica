/**
 * QUÉ PUEDE CRECER DENTRO DEL DOCUMENTO DE UN EPISODIO, Y HASTA DÓNDE.
 *
 * ── QUÉ FALLABA (WS-03) ─────────────────────────────────────────────────────
 *
 * `registro-durable.ts` lleva escrito en su cabecera, desde E0-09, que los
 * arrays del doc de internamiento —incluido `indicaciones[].administraciones[]`—
 * son caché de display y **«están topados por el límite de 1 MB por documento»**.
 *
 * Tres lo estaban de verdad: `balanceHidrico` y `escalas` a 100, `sbar` a 50.
 * **`administraciones` no.** Se anexaba sin tope.
 *
 * O sea: el documento decía que había un techo y el código no lo ponía. El
 * «límite de 1 MB» no era un tope: era el punto donde el episodio deja de
 * funcionar.
 *
 * ── POR QUÉ ESO NO ES UNA DEGRADACIÓN, ES UN PARO ───────────────────────────
 *
 * Firestore rechaza la escritura de un documento que pase de 1 MB. Y todas las
 * mutaciones de un episodio son **un solo `tx.update` sobre ese documento**. En
 * cuanto lo rebasa no falla «lo último que se añadió»: falla **todo** — no se
 * puede registrar una administración, no se puede suspender una orden, y no se
 * puede egresar al paciente.
 *
 * Una UCI de veinte días con ocho fármacos cada seis horas son ~2 500 objetos de
 * administración en un documento. No es un caso raro: es una estancia larga.
 *
 * ── POR QUÉ SÓLO SE PUEDE TOPAR UNO ─────────────────────────────────────────
 *
 * **Topar un array sólo es seguro si el hecho vive en otro sitio.** Y aquí no
 * todos viven en otro sitio:
 *
 *   · `administraciones` SÍ — `administrar` está en `ACCIONES_CON_EVENTO_DURABLE`
 *     y cada dosis queda entera en la subcolección append-only `registros`.
 *     Recortar el array no pierde nada: pierde la COPIA de display.
 *   · `movimientos` NO — `registro-durable.ts` declara que `trasladar` no emite
 *     evento **precisamente porque** «queda en `movimientos[]`, que nunca se
 *     sobrescribe». Es la única copia. Toparlo borraría traslados.
 *   · `indicaciones` e `interconsultas` NO — son la orden y la interconsulta
 *     MISMAS, no un registro de que ocurrieron. Toparlas no recorta un historial:
 *     hace desaparecer órdenes activas.
 *
 * Así que este módulo no reparte topes: **reparte el árbol en los que se pueden
 * topar y los que no**, con la razón de cada uno, y deja los segundos como un
 * riesgo NOMBRADO en vez de uno que nadie ha mirado. Un riesgo declarado se
 * puede vigilar; uno que vive en la forma de un documento, no.
 *
 * ── EL TOPE NO ES UNA CIFRA CLÍNICA ─────────────────────────────────────────
 *
 * 100 no dice nada de medicina: dice cuánto cabe en un documento sin acercarse
 * al límite. Y está muy por encima de lo que lee cualquiera — la pantalla
 * enseña `slice(-6)` y el motor del MAR ancla en la ÚLTIMA dosis dada.
 *
 * Por eso se recorta por el principio (`slice(-N)`): lo que se va es lo más
 * viejo, y `ultima` —de la que depende si una dosis está atrasada— nunca se
 * toca. Lo único que se acorta es la lista histórica de omisiones que se pinta,
 * y ésa está completa en `registros`.
 *
 * Módulo PURO.
 */

/** Un array del documento del episodio, con su decisión tomada. */
export interface ArrayDelEpisodio {
  /** Ruta dentro del documento. `indicaciones[].administraciones` es anidado. */
  readonly campo: string
  /** Cuántos elementos se conservan en el doc, o `null` si NO se puede topar. */
  readonly tope: number | null
  /** Dónde vive el hecho completo. `null` = el doc es la única copia. */
  readonly copiaCompleta: string | null
  /** Por qué ese tope, o por qué no lo hay. Se lee, no se adivina. */
  readonly porQue: string
}

export const ARRAYS_DEL_EPISODIO: readonly ArrayDelEpisodio[] = [
  {
    campo: 'indicaciones[].administraciones',
    tope: 100,
    copiaCompleta: 'registros (subcolección append-only, evento `administracion`)',
    porQue:
      'El que más crece con diferencia: una entrada por dosis y por fármaco. Se '
      + 'puede topar porque cada administración queda ENTERA en el libro durable, '
      + 'así que el recorte pierde la copia de display y no el hecho. Se recorta '
      + 'por el principio: la ÚLTIMA dosis dada, que es de la que depende el '
      + 'atraso del MAR, nunca se va.',
  },
  {
    campo: 'balanceHidrico',
    tope: 100,
    copiaCompleta: 'registros (evento `balance`)',
    porQue: 'Caché de display; el balance completo está en el libro durable.',
  },
  {
    campo: 'escalas',
    tope: 100,
    copiaCompleta: 'registros (evento `escala`)',
    porQue: 'Caché de display; cada escala queda en el libro durable.',
  },
  {
    campo: 'sbar',
    tope: 50,
    copiaCompleta: 'registros (evento `sbar`)',
    porQue: 'Texto libre, el más pesado por elemento; su tope es menor por eso.',
  },
  {
    campo: 'movimientos',
    tope: null,
    copiaCompleta: null,
    porQue:
      'NO se puede topar: `registro-durable.ts` declara que `trasladar` y '
      + '`cambiar_tratante` no emiten evento durable PRECISAMENTE porque quedan '
      + 'aquí. Es la única copia, y recortarla borraría traslados del episodio. '
      + 'Crece despacio —un traslado no es un evento horario— pero crece sin '
      + 'techo, y eso queda dicho.',
  },
  {
    campo: 'indicaciones',
    tope: null,
    copiaCompleta: null,
    porQue:
      'NO se puede topar: es la lista de ÓRDENES vigentes, no un registro de que '
      + 'ocurrieron. Recortarla no acorta un historial: hace desaparecer órdenes '
      + 'activas del MAR. Su alta y su suspensión sí van al libro durable, pero la '
      + 'orden viva vive aquí.',
  },
  {
    campo: 'interconsultas',
    tope: null,
    copiaCompleta: null,
    porQue:
      'NO se puede topar, por lo mismo: es la interconsulta misma. El libro '
      + 'durable la deja fuera a propósito («fuera del alcance MAR, órdenes y '
      + 'UCI»), así que el doc es su única copia.',
  },
  {
    campo: 'medicamentosCasa',
    tope: null,
    copiaCompleta: null,
    porQue:
      'No crece con el tiempo: la conciliación REEMPLAZA la lista entera, no le '
      + 'anexa. Su tamaño es el de la medicación del paciente, no el de la '
      + 'estancia.',
  },
]

/** Los que sí se topan, por su ruta. Una sola definición para toda la ruta. */
export const TOPES: Readonly<Record<string, number>> = Object.fromEntries(
  ARRAYS_DEL_EPISODIO.filter(a => a.tope !== null).map(a => [a.campo, a.tope as number]),
)

/**
 * Aplica el tope conservando **el final**: se va lo más viejo.
 *
 * Al revés perdería la última dosis dada, que es el ancla del atraso del MAR:
 * un recorte por el otro lado convertiría un paciente al día en uno «nunca
 * administrado».
 */
export function cabe<T>(campo: string, lista: readonly T[]): T[] {
  const tope = TOPES[campo]
  return tope === undefined ? [...lista] : lista.slice(-tope)
}

export const POR_QUE_NO_SE_TOPA_TODO =
  'Porque topar un array sólo es seguro si el hecho vive en otro sitio. '
  + '`administraciones` tiene copia entera en el libro append-only; `movimientos`, '
  + '`indicaciones` e `interconsultas` NO la tienen —el doc es su única copia— y '
  + 'recortarlas borraría traslados u órdenes vivas. Quedan como riesgo nombrado, '
  + 'que es lo que se puede vigilar.'

export const POR_QUE_1MB_NO_ERA_UN_TOPE =
  'Porque todas las mutaciones del episodio son un solo update sobre el mismo '
  + 'documento. Al pasar de 1 MB no falla lo último que se añadió: falla todo. No '
  + 'se puede registrar una administración, ni suspender una orden, ni egresar al '
  + 'paciente. El límite de Firestore no es un techo: es el punto donde el '
  + 'episodio deja de funcionar.'


/**
 * ── CUÁNTO LE QUEDA AL EPISODIO ANTES DE PARARSE — REG-442 ──────────────────
 *
 * Este módulo terminaba diciendo que los tres arrays sin tope quedan «como
 * riesgo NOMBRADO en vez de uno que nadie ha mirado. Un riesgo declarado **se
 * puede vigilar**; uno que vive en la forma de un documento, no».
 *
 * Nadie lo vigilaba. Era la garantía escrita y sin cumplir — la misma forma que
 * REG-424, REG-428, REG-438 y REG-441.
 *
 * Y aquí importa más que en ninguna: cuando el documento pasa de 1 MB no falla
 * lo último que se añadió, **falla egresar al paciente**. Un aviso que llega
 * después de eso no es un aviso.
 *
 * ── LOS UMBRALES NO SON CIFRAS CLÍNICAS ─────────────────────────────────────
 *
 * `LIMITE_FIRESTORE` es un hecho del proveedor: 1 MiB por documento, no una
 * elección. Las dos fracciones son cuánto margen se quiere para reaccionar, y se
 * declaran como lo que son — margen de operación, no medicina.
 *
 * `vigilar` al 60 % y no al 90 %: a los tres arrays sin tope les crecen
 * elementos grandes de golpe —una indicación con su texto, una interconsulta con
 * su motivo— y del 90 % al 100 % puede haber una sola escritura.
 */

/** 1 MiB. Es el límite de Firestore por documento, no una elección nuestra. */
export const LIMITE_FIRESTORE = 1_048_576

/** Margen de OPERACIÓN, no cifra clínica: cuánto se quiere para reaccionar. */
export const FRACCION_VIGILAR = 0.6
export const FRACCION_CRITICO = 0.8

export type EstadoDeTamano = 'holgado' | 'vigilar' | 'critico'

export interface QueLoLlena {
  readonly campo: string
  readonly bytes: number
  /** Cuántos elementos tiene, cuando es un array. */
  readonly elementos: number | null
  /** ¿Está topado? Si no, es de los que crecen sin techo. */
  readonly topado: boolean
}

export interface TamanoDelEpisodio {
  readonly bytes: number
  readonly fraccion: number
  readonly estado: EstadoDeTamano
  /** Los campos más pesados, de mayor a menor. Sin esto el aviso no es accionable. */
  readonly queLoLlena: readonly QueLoLlena[]
  /** Qué decirle a quien lo lea. Vacío cuando está holgado. */
  readonly aviso: string
}

/** Bytes reales de un valor serializado, en UTF-8. */
function bytesDe(v: unknown): number {
  if (v === undefined) return 0
  try { return Buffer.byteLength(JSON.stringify(v), 'utf8') } catch { return 0 }
}

const CAMPOS_SIN_TOPE = new Set(
  ARRAYS_DEL_EPISODIO.filter(a => a.tope === null).map(a => a.campo),
)

/**
 * Cuánto ocupa el episodio y qué lo está llenando. PURO.
 *
 * Se mide sobre el documento que se va a ESCRIBIR, no sobre el que se leyó: el
 * que importa es el que puede ser rechazado.
 */
export function tamanoDelEpisodio(doc: Record<string, unknown> | null | undefined): TamanoDelEpisodio {
  const d = doc ?? {}
  const bytes = bytesDe(d)
  const fraccion = bytes / LIMITE_FIRESTORE
  const queLoLlena = Object.entries(d)
    .map(([campo, v]) => ({
      campo,
      bytes: bytesDe(v),
      elementos: Array.isArray(v) ? v.length : null,
      topado: TOPES[campo] !== undefined,
    }))
    .filter(c => c.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)

  const estado: EstadoDeTamano =
    fraccion >= FRACCION_CRITICO ? 'critico' : fraccion >= FRACCION_VIGILAR ? 'vigilar' : 'holgado'

  return { bytes, fraccion, estado, queLoLlena, aviso: avisoDeTamano(estado, fraccion, queLoLlena) }
}

function avisoDeTamano(
  estado: EstadoDeTamano, fraccion: number, queLoLlena: readonly QueLoLlena[],
): string {
  if (estado === 'holgado') return ''
  const culpable = queLoLlena.find(c => !c.topado && CAMPOS_SIN_TOPE.has(c.campo)) ?? queLoLlena[0]
  const porQuien = culpable ? ` Lo que más ocupa: \`${culpable.campo}\`${culpable.elementos !== null ? ` (${culpable.elementos} elementos)` : ''}.` : ''
  const pct = Math.round(fraccion * 100)
  return estado === 'critico'
    ? `El episodio ocupa el ${pct} % del máximo por documento. Al llegar al 100 % NO falla lo último: deja de poder registrarse una administración, suspenderse una orden o EGRESAR AL PACIENTE.${porQuien}`
    : `El episodio ocupa el ${pct} % del máximo por documento y sigue creciendo.${porQuien}`
}

export const POR_QUE_SE_MIDE_ANTES_DE_ESCRIBIR =
  'Porque el documento que puede ser rechazado es el que se va a escribir, no el '
  + 'que se leyó. Y porque cuando el límite se alcanza no falla lo último que se '
  + 'añadió: falla TODO, incluido egresar al paciente. Un aviso que llega después '
  + 'de eso no es un aviso.'

export const POR_QUE_LOS_UMBRALES_NO_SON_CLINICOS =
  'Porque `LIMITE_FIRESTORE` es un hecho del proveedor —1 MiB por documento— y '
  + 'las dos fracciones son margen de OPERACIÓN: cuánto se quiere para reaccionar. '
  + 'Se vigila al 60 % y no al 90 % porque a los tres arrays sin tope les crecen '
  + 'elementos grandes de golpe, y del 90 % al 100 % puede haber una sola '
  + 'escritura.'

export const LO_QUE_ESTA_MEDIDA_NO_HACE: readonly string[] = [
  'No topa nada nuevo: `movimientos`, `indicaciones` e `interconsultas` siguen sin techo, porque el documento es su única copia y recortarlas borraría traslados u órdenes vivas.',
  'No mide el tamaño REAL que Firestore cobra: éste cuenta el JSON en UTF-8, y el proveedor añade el nombre de cada campo, los índices y una sobrecarga por documento. La cifra queda POR DEBAJO de la real, así que el aviso llega antes — nunca después, que es el error que importaría.',
  'No migra a subcolección, que es lo que cerraría el riesgo de verdad: toca `firestore.rules`, y desplegarlas es del dueño.',
  'No bloquea la escritura. Frenar una mutación clínica por un umbral de tamaño sería peor que el riesgo que evita.',
]
