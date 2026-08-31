/**
 * DE DÓNDE SE BAJA EVIDENCIA, Y DE DÓNDE NO SE BAJA NADA.
 *
 * ── QUÉ FALTABA (WS-06) ─────────────────────────────────────────────────────
 *
 * El requisito —«ninguna fuente se obtiene saltándose su licencia»— estaba
 * verificado **por lectura**: alguien miró el árbol y no encontró nada. Eso no
 * es una garantía, es una foto. El día que un `fetch` nuevo apunte a la página
 * de un editor, ninguna prueba se pondría roja.
 *
 * Este módulo convierte esa lectura en una **partición declarada**: cada host
 * externo que aparece en el camino de evidencia está clasificado, y un host que
 * no esté clasificado rompe el CI. No impide escribir código nuevo — obliga a
 * decir qué se hace con él.
 *
 * ── LA DISTINCIÓN QUE ESTE MÓDULO EXISTE PARA SOSTENER ──────────────────────
 *
 * **Enlazar no es recuperar, y es casi lo contrario.**
 *
 * Un `href` a `doi.org` manda al médico al sitio del editor, donde el editor le
 * enseña lo que quiera bajo sus propios términos: su muro de pago, su registro,
 * su licencia. Es exactamente el trato que el editor ofrece.
 *
 * Bajar esa misma URL desde el servidor y quedarse con el HTML es lo contrario:
 * es tomar el material **sin pasar por donde el editor pone sus condiciones**.
 * La URL es la misma y el acto es otro, así que la clasificación no puede salir
 * de la cadena: tiene que decirla alguien.
 *
 * ── LO QUE SE MIDIÓ, EL 30-AGO-2026 ────────────────────────────────────────
 *
 * Recorrido el camino entero (`lib/evidencia/`, `lib/evidence-integrations/` y
 * las dos rutas de evidencia), los hosts externos son SIETE y ninguno es la
 * página de un editor:
 *
 *   · se baja      eutils.ncbi.nlm.nih.gov   API pública de NCBI
 *   · se baja      api.fda.gov               API pública de openFDA
 *   · se baja      api.anthropic.com         el modelo, no una fuente
 *   · sólo enlace  pubmed.ncbi.nlm.nih.gov   el registro, para que lo abra él
 *   · sólo enlace  www.accessdata.fda.gov    el buscador de la propia FDA
 *   · sólo enlace  www.google.com            búsqueda de la GPC del CENETEC
 *   · sólo enlace  www.ncbi.nlm.nih.gov      en un comentario, sobre la llave
 *
 * Y `example.invalid`, que es del adaptador sintético y por definición no
 * resuelve: un host de pruebas que apuntara a algo real sería una llamada de
 * verdad disfrazada de fixture.
 *
 * ── SE APLICA DONDE SE PIDE, NO SÓLO EN EL CI ───────────────────────────────
 *
 * La primera versión era sólo un guardián de construcción, y tres guardianes de
 * este árbol la rechazaron por no estar conectada. Tenían razón, y por un motivo
 * que va más allá del lint: **una comprobación en CI no cierra un `fetch`**. Es
 * la misma regla que ya dice la política de seguridad de esta casa — esconder un
 * botón no cierra una ruta HTTP.
 *
 * Así que `exigeQueSeBaje` corre **en el momento de pedir**, en las dos únicas
 * puertas por las que este producto baja evidencia (`ncbiFetch` y el `pedir` de
 * openFDA). Cuesta una búsqueda en un conjunto y falla cerrado: una URL cuyo
 * host no esté declarado como `se_baja` **lanza antes de salir a la red**.
 *
 * Hoy no puede ocurrir —los dos hosts están declarados— y ahí está el punto: el
 * día que alguien cambie una constante por la página de un editor, no hace falta
 * que el CI lo alcance.
 *
 * ── LO QUE ESTO NO ES ───────────────────────────────────────────────────────
 *
 * No cubre el resto del producto: WhatsApp, Stripe y el correo tienen sus
 * propios hosts y no son fuentes de evidencia. El alcance es el camino por el
 * que entra material que después se cita.
 *
 * Módulo PURO.
 */

/** Qué se hace con un host. No hay un tercer valor sin decidirlo. */
export type ComoSeUsa =
  /** El servidor le pide datos. Necesita base legal explícita. */
  | 'se_baja'
  /** Sólo aparece como enlace para que lo abra el médico. No se le pide nada. */
  | 'solo_se_enlaza'
  /** De pruebas. No resuelve y no puede resolver. */
  | 'no_resuelve'

export interface HostDeEvidencia {
  readonly host: string
  readonly comoSeUsa: ComoSeUsa
  /**
   * Por qué se puede. En `se_baja` es la base legal —una API pública, un
   * contrato— y es obligatoria. En los otros, por qué no hace falta.
   */
  readonly baseLegal: string
  /** Qué se trae de ahí, o qué se enlaza. */
  readonly que: string
}

export const HOSTS_DE_EVIDENCIA: readonly HostDeEvidencia[] = [
  {
    host: 'eutils.ncbi.nlm.nih.gov',
    comoSeUsa: 'se_baja',
    baseLegal:
      'E-utilities es la vía OFICIAL que NCBI publica para consultar PubMed por '
      + 'programa, con su límite de velocidad documentado (~3 req/s sin llave, ~10 '
      + 'con ella) que el cliente respeta. Usar el API en vez de la página es '
      + 'justamente lo contrario de saltarse la licencia.',
    que: 'Resúmenes, metadatos y —cuando el XML declara CC0 o CC-BY por artículo— el texto abierto.',
  },
  {
    host: 'api.fda.gov',
    comoSeUsa: 'se_baja',
    baseLegal:
      'openFDA es un API público del gobierno de EE. UU., gratis y sin llave, con '
      + 'su límite documentado. Los datos de etiquetado son de dominio público.',
    que: 'La dosis de la etiqueta aprobada, para no depender de una cifra que dé el modelo.',
  },
  {
    host: 'api.anthropic.com',
    comoSeUsa: 'se_baja',
    baseLegal:
      'Es el proveedor del modelo bajo su contrato de uso, no una fuente de '
      + 'evidencia. Aparece aquí porque vive en las rutas de evidencia y un host '
      + 'sin clasificar rompe el guardián — clasificarlo es decir que NO origina '
      + 'material citable: el modelo redacta y reformula lo que ya trajeron los '
      + 'otros dos.',
    que: 'Redacción y reformulación. Nunca una cita ni un dato de paciente.',
  },
  {
    host: 'pubmed.ncbi.nlm.nih.gov',
    comoSeUsa: 'solo_se_enlaza',
    baseLegal:
      'Es el enlace canónico al registro. Mandar al médico al sitio de NCBI es '
      + 'que lo lea donde su dueño lo publica y bajo sus términos.',
    que: 'El registro del artículo, para abrirlo.',
  },
  {
    host: 'doi.org',
    comoSeUsa: 'solo_se_enlaza',
    baseLegal:
      'El resolvedor de la DOI Foundation. Abre en el navegador del médico la '
      + 'página que el editor haya designado para ese artículo, bajo los términos '
      + 'de ese editor. No se le pide nada: se construye la URL y se pinta.',
    que: 'El artículo en el sitio de su editorial, por su identificador estable.',
  },
  {
    host: 'www.accessdata.fda.gov',
    comoSeUsa: 'solo_se_enlaza',
    baseLegal: 'El buscador de la propia FDA. Se enlaza; no se le pide nada.',
    que: 'La ficha del fármaco en Drugs@FDA.',
  },
  {
    host: 'www.google.com',
    comoSeUsa: 'solo_se_enlaza',
    baseLegal:
      'Una URL de búsqueda que abre el navegador del médico. Es su sesión y su '
      + 'navegador, no el servidor haciendo consultas: buscar por él sería, ahí '
      + 'sí, un raspado.',
    que: 'Búsqueda de la Guía de Práctica Clínica del CENETEC, que no tiene API.',
  },
  {
    host: 'www.ncbi.nlm.nih.gov',
    comoSeUsa: 'solo_se_enlaza',
    baseLegal: 'Aparece en un comentario, explicando dónde se saca la llave de E-utilities.',
    que: 'Nada: es documentación dentro del código.',
  },
  {
    host: 'example.invalid',
    comoSeUsa: 'no_resuelve',
    baseLegal:
      'Reservado por RFC 2606 para no resolver NUNCA. Es del adaptador sintético, '
      + 'y ahí está el punto: un host de pruebas que apuntara a algo real sería una '
      + 'llamada de verdad disfrazada de fixture.',
    que: 'Fuentes sintéticas de prueba.',
  },
]

/** Los que el servidor sí consulta. Cada uno necesita base legal. */
export const SE_BAJAN: readonly string[] =
  HOSTS_DE_EVIDENCIA.filter(h => h.comoSeUsa === 'se_baja').map(h => h.host)

/** ¿Está clasificado? Lo que no lo esté rompe el guardián. */
export function estaDeclarado(host: string): boolean {
  return HOSTS_DE_EVIDENCIA.some(h => h.host === host)
}

/** El que lanza `exigeQueSeBaje`. Se distingue para poder no confundirlo con un fallo de red. */
export class HostNoDeclarado extends Error {
  readonly host: string
  constructor(host: string) {
    super(
      `No se puede pedir a «${host}»: no está declarado como fuente que se baja. `
      + 'Si es una vía oficial, decláralo en `de-donde-se-baja.ts` con su base legal; '
      + 'si es la página de un editor, no se baja.',
    )
    this.name = 'HostNoDeclarado'
    this.host = host
  }
}

/**
 * PUERTA DE SALIDA. Se llama justo antes de pedir, y **falla cerrado**.
 *
 * Una URL que no se puede ni analizar tampoco pasa: si no se sabe a qué host va,
 * no se sabe si está permitido. Ante la duda no se sale a la red.
 */
export function exigeQueSeBaje(url: string): void {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    throw new HostNoDeclarado(String(url).slice(0, 60))
  }
  if (!SE_BAJAN.includes(host)) throw new HostNoDeclarado(host)
}

/**
 * LO QUE SERÍA SALTARSE UNA LICENCIA. Se enumera para poder buscarlo, no para
 * documentarlo: cada línea corresponde a una comprobación del guardián.
 */
export const LO_QUE_SERIA_RASPAR: readonly string[] = [
  'Manejar un navegador sin cabeza (Puppeteer, Selenium, Playwright fuera de las pruebas) contra la página de un editor.',
  'Bajar el HTML de un editor y sacarle el texto con un analizador (cheerio, jsdom, DOMParser) en vez de pedirlo por su API.',
  'Usar una credencial institucional compartida para entrar donde el producto no tiene licencia propia.',
  'Guardar un corpus copiado de una fuente de pago y servirlo como si fuera propio.',
  'Bajar desde el servidor una URL que hoy sólo se ENLAZA: la URL es la misma y el acto es otro.',
]

export const POR_QUE_ENLAZAR_NO_ES_RECUPERAR =
  'Un enlace manda al médico al sitio del editor, donde el editor le enseña lo '
  + 'que quiera bajo sus términos: su muro de pago, su registro, su licencia. '
  + 'Bajar esa misma URL desde el servidor y quedarse con el HTML es tomar el '
  + 'material sin pasar por donde el editor pone sus condiciones. La URL es la '
  + 'misma y el acto es el contrario, así que la clasificación no puede salir de '
  + 'la cadena: tiene que decirla alguien.'

export const POR_QUE_UNA_LECTURA_NO_BASTA =
  'Porque una lectura es una foto. El censo decía «verificado por lectura: no '
  + 'hay puppeteer, ni credenciales compartidas, ni corpus copiado», y era cierto '
  + 'el día que se miró. Sin guardián, el día que un `fetch` nuevo apunte a la '
  + 'página de un editor no se pondría roja ninguna prueba.'
