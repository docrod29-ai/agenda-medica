/**
 * LA IDENTIDAD DE LA PUBLICACIÓN, DICHA DONDE EL MÉDICO LA LEE.
 *
 * ── QUÉ QUEDABA (WS-07.identidad-de-revista) ────────────────────────────────
 *
 * REG-398 dejó de tirar cuatro datos —DOI, PMCID, abreviatura ISO y licencia— y
 * los metió en el `Source`. El censo dejó apuntado lo que faltaba, y al medirlo
 * contra el árbol resultó ser **otra vez la misma cola**: los datos ya viajan
 * hasta el navegador y la pantalla los tira en la puerta.
 *
 *  · `/api/consultor-evidencia` manda `doi`, `revistaAbrev`, `pmcid`,
 *    `accesoAbierto` y `tipoSalvedad` en `articulosMin`. El `interface Articulo`
 *    de la pantalla del consultor declara cinco campos y **ninguno de esos
 *    cuatro últimos**, así que TypeScript los borra y nadie los pinta.
 *  · `/api/expediente/evidencia` devuelve los artículos ENTEROS, con su `doi` y
 *    su abreviatura. El `type ArtEv` de la consulta declara cinco campos y el
 *    render pinta `título · revista año`. El DOI estaba a mano y no se veía.
 *  · La salvedad de REG-401 —«PubMed no lo declaró aleatorizado»— tenía una
 *    prueba que comprobaba que la RUTA la mandaba. Nadie comprobó que llegara a
 *    unos ojos, y no llegaba. Es exactamente el defecto que
 *    `.claude/rules/el-dato-tiene-que-llegar.md` describe: una prueba de
 *    contrato comprueba que el código DIGA lo acordado, no que el destinatario
 *    lo acepte.
 *
 * ── LO QUE ESTE MÓDULO SÍ DECIDE, Y CÓMO ────────────────────────────────────
 *
 * **La forma del DOI.** Es sintaxis, no un hecho clínico: un DOI es
 * `10.<registrante>/<sufijo>`. Comprobarla evita pintar un enlace a
 * `https://doi.org/<basura>`, que es peor que no pintar ninguno — parece
 * verificable y no lleva a ninguna parte. **Que el DOI EXISTA es otra cosa** y
 * necesita a Crossref; se declara en `LO_QUE_NO_SE_SABE`.
 *
 * **La disponibilidad del texto completo.** Tres estados, y el que faltaba es el
 * del medio: hay artículos cuyo texto completo **existe** en PMC y cuya licencia
 * **no permite reproducirlo aquí**. Hoy eso se pinta igual que «no hay más que
 * el resumen», y no es lo mismo: el médico puede ir a leerlo, sólo que no se lo
 * podemos copiar. `licencia-pmc.ts` ya distinguía las dos cosas y la distinción
 * se perdía antes de llegar a la pantalla.
 *
 * ── LOS ALIAS DE REVISTA: SE OBSERVAN, NO SE INVENTAN ───────────────────────
 *
 * El censo pedía «un catálogo de nombre entero ↔ abreviatura, que hoy no
 * existe». Un catálogo NLM completo son decenas de miles de entradas y no se
 * escribe de memoria — escribirlo de memoria es la regla 1 aplicada a la
 * bibliografía: saldría impreso al lado de una recomendación y nadie lo
 * revisaría.
 *
 * Pero **no hace falta inventarlo**: cada registro de PubMed trae las DOS formas
 * a la vez (`<Title>` y `<ISOAbbreviation>`), y desde REG-398 las dos se
 * conservan. El catálogo se construye de los pares que la propia fuente ya dio.
 *
 * Y una revista que nunca se ha visto emparejada sale `no_consta` — **nunca se
 * adivina por parecido**. «Am J Med» y «Am J Med Sci» son dos revistas distintas
 * y un emparejamiento por prefijo las fundiría; declarar de menos deja un hueco
 * contado, adivinar deja un error invisible.
 *
 * Módulo PURO.
 */

/** Qué se sabe del texto completo de un artículo. */
export type DisponibilidadTexto =
  /** Existe y la licencia permite reproducirlo aquí. */
  | 'reproducible'
  /** Existe (está en PMC) y la licencia NO permite reproducirlo aquí. */
  | 'existe_no_reproducible'
  /** Nadie lo miró, o no está en PMC. **No** significa que no exista. */
  | 'no_consta'

export interface LecturaDeDisponibilidad {
  readonly estado: DisponibilidadTexto
  /** De dónde sale lo que se sabe. Hoy sólo PMC; ver `LO_QUE_NO_SE_SABE`. */
  readonly origen: 'pmc' | 'ninguno'
  /** Cómo se le dice al médico, sin adjetivos. Vacío cuando no hay nada que decir. */
  readonly frase: string
}

/**
 * Qué se sabe del texto completo, a partir de lo que PMC contestó.
 *
 * `accesoAbierto` sólo es `true` cuando la licencia lo dijo por escrito
 * (`licencia-pmc.ts` falla cerrado). `undefined` con PMCID no es «cerrado»: es
 * «existe y no consta que se pueda reproducir», y las dos se pintan igual de
 * momento porque las dos llevan a lo mismo — al resumen.
 */
export function disponibilidadDeTextoCompleto(
  i: { pmcid?: string; accesoAbierto?: boolean } | undefined,
): LecturaDeDisponibilidad {
  const pmcid = i?.pmcid?.trim()
  if (!pmcid) {
    return {
      estado: 'no_consta', origen: 'ninguno',
      /* Callado a propósito: decir «no hay texto completo» en cada artículo que
         nadie miró sería afirmar una ausencia que nadie comprobó, y además
         convertiría la línea en ruido. Ausencia de dato no es dato de ausencia. */
      frase: '',
    }
  }
  if (i?.accesoAbierto === true) {
    return { estado: 'reproducible', origen: 'pmc', frase: 'Texto completo abierto en PMC.' }
  }
  return {
    estado: 'existe_no_reproducible', origen: 'pmc',
    frase: 'Texto completo en PMC: la licencia no permite reproducirlo aquí.',
  }
}

/** Qué se puede decir de un DOI mirando sólo su forma. */
export type FormaDoi = 'valida' | 'malformada' | 'ausente'

/**
 * La forma de un DOI: `10.<registrante>/<sufijo>`.
 *
 * El registrante son de 4 a 9 dígitos por el registro de la DOI Foundation, y el
 * sufijo es cualquier cosa sin espacios. Esto es **sintaxis**: un DOI bien
 * formado puede no existir, y eso lo dice Crossref, no esta función.
 */
export function formaDelDoi(doi: string | undefined): FormaDoi {
  const d = String(doi ?? '').trim()
  if (!d) return 'ausente'
  return /^10\.\d{4,9}\/\S+$/.test(d) ? 'valida' : 'malformada'
}

/**
 * El enlace que se pinta, o `null`.
 *
 * `null` cuando la forma no cuadra: un enlace a `doi.org` con un DOI roto
 * **parece** verificable y no lleva a ninguna parte, y eso es peor que no
 * ofrecer enlace. El identificador se sigue pudiendo enseñar como texto.
 */
export function enlaceDoi(doi: string | undefined): string | null {
  return formaDelDoi(doi) === 'valida' ? `https://doi.org/${String(doi).trim()}` : null
}

/**
 * Clave de comparación de un nombre de revista.
 *
 * Quita acentos, mayúsculas, puntuación y el artículo inicial: `N. Engl. J. Med.`
 * y `N Engl J Med` son la misma cadena escrita de dos maneras. **No** convierte
 * una forma en la otra — eso es el catálogo.
 */
export function claveDeRevista(nombre: string | undefined): string {
  return String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(the|la|el|le|les)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Un registro que trae las dos formas del nombre, como los da PubMed. */
export interface RegistroConRevista {
  readonly revista?: string
  readonly revistaAbrev?: string
}

/**
 * El catálogo de alias, construido de los pares que la fuente ya dio.
 *
 * Clave: la clave de CUALQUIERA de las dos formas. Valor: las dos formas tal
 * como se escribieron, sin normalizar — lo que se pinta es lo que dijo la
 * fuente, no lo que este módulo dedujo.
 */
export interface Alias {
  readonly nombre: string
  readonly abreviatura: string
}

export function catalogoDeAlias(registros: readonly RegistroConRevista[]): Map<string, Alias> {
  const out = new Map<string, Alias>()
  for (const r of registros ?? []) {
    const nombre = String(r?.revista ?? '').trim()
    const abreviatura = String(r?.revistaAbrev ?? '').trim()
    /* Hace falta el PAR. Un registro con una sola forma no enseña nada sobre la
       otra, y suponerla sería justo lo que este módulo se prohíbe. */
    if (!nombre || !abreviatura) continue
    const alias: Alias = { nombre, abreviatura }
    out.set(claveDeRevista(nombre), alias)
    out.set(claveDeRevista(abreviatura), alias)
  }
  return out
}

/**
 * ¿Son la misma revista?
 *
 * `undefined` —y no `false`— cuando no se puede saber: ninguna de las dos formas
 * se ha visto emparejada. Devolver `false` afirmaría que son distintas, que es
 * un dato que nadie tiene.
 */
export function mismaRevista(
  a: string | undefined, b: string | undefined, catalogo: Map<string, Alias>,
): boolean | undefined {
  const ka = claveDeRevista(a)
  const kb = claveDeRevista(b)
  if (!ka || !kb) return undefined
  if (ka === kb) return true
  const va = catalogo.get(ka)
  const vb = catalogo.get(kb)
  if (!va || !vb) return undefined
  return claveDeRevista(va.nombre) === claveDeRevista(vb.nombre)
}

/**
 * LO QUE ESTE MÓDULO NO SABE. Se exporta para poder decirlo.
 */
export const LO_QUE_NO_SE_SABE: readonly string[] = [
  'Si el DOI EXISTE. Se comprueba su forma, no que resuelva. Eso necesita a Crossref, que es red — y una red en un gate de documentación se cae un martes cualquiera. Falta declarar el host en la política de descargas antes de llamarlo.',
  'Si hay texto completo FUERA de PMC. Un artículo abierto en el sitio de su editorial sale `no_consta`, y eso es «no se miró», no «no hay». Consultarlo necesita Unpaywall o Crossref, con la misma declaración de host.',
  'La abreviatura de una revista que nunca se ha visto emparejada con su nombre entero. El catálogo se observa de los registros; no se adivina por parecido, porque «Am J Med» y «Am J Med Sci» son dos revistas.',
  'Si dos artículos son el MISMO artículo. Esto compara revistas, no publicaciones: la deduplicación va por PMID y por DOI, en otro sitio.',
]

export const POR_QUE_EL_CATALOGO_SE_OBSERVA =
  'Porque un catálogo NLM completo son decenas de miles de entradas y escribirlo '
  + 'de memoria es la regla 1 aplicada a la bibliografía: no rompería ninguna '
  + 'prueba y saldría impreso al lado de una recomendación. No hace falta: cada '
  + 'registro de PubMed trae las dos formas a la vez, y desde REG-398 las dos se '
  + 'conservan. Lo que nunca se vio emparejado sale `no_consta`.'

export const POR_QUE_UN_DOI_ROTO_NO_LLEVA_ENLACE =
  'Porque un enlace a doi.org con un DOI mal formado PARECE verificable y no '
  + 'lleva a ninguna parte. El médico que lo pulsa aprende que las referencias de '
  + 'este producto no van a ningún sitio, y eso se paga con que deje de pulsarlas. '
  + 'El identificador se sigue enseñando como texto: lo que se retira es la '
  + 'promesa de que resuelve.'

export const POR_QUE_EXISTE_ES_DISTINTO_DE_REPRODUCIBLE =
  'Porque «sólo hay resumen» y «hay texto completo y su licencia no deja '
  + 'copiarlo aquí» llevan al médico a cosas distintas: en el segundo caso puede '
  + 'ir a leerlo. `licencia-pmc.ts` ya distinguía las dos y la distinción se '
  + 'perdía antes de llegar a la pantalla, así que las dos se pintaban como la '
  + 'primera.'
