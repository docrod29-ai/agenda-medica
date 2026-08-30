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
