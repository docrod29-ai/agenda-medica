/**
 * ¿EL FALLO DE ESTA BÚSQUEDA DICE QUE LA FUENTE NO ESTÁ? — el traductor (REG-391).
 *
 * Igual que `whatsapp/fallo-del-proveedor.ts`: el interruptor vive en
 * `red/interruptor.ts` y no conoce ningún vocabulario; aquí se traduce el de
 * NCBI E-utilities y openFDA.
 *
 * ── QUÉ CAMBIA ESTO EN LA PANTALLA DEL MÉDICO ───────────────────────────────
 *
 * `expediente/evidencia` y `consultor-evidencia` corren con `maxDuration = 300`.
 * Cuando PubMed no contesta, cada búsqueda de cada médico paga su espera entera
 * antes de degradar — y la ruta de evidencia dispara **varias esearch por
 * consulta**. El interruptor convierte esa espera en un «no se consultó» que
 * llega al momento.
 *
 * Y ese «no se consultó» ya tiene sitio donde vivir: la regla del producto dice
 * que **un proveedor no operativo baja de posición pero no desaparece de la
 * lista**, para que el médico pueda leer dónde NO se miró. Ausencia de dato no
 * es dato de ausencia: una búsqueda que no se hizo no puede parecer una búsqueda
 * sin resultados.
 *
 * ── QUÉ NO ABRE EL CIRCUITO ─────────────────────────────────────────────────
 *
 *  · **429** — NCBI limita por llave (~3 req/s sin ella, ~10 con ella), y el
 *    módulo ya tiene su propio regulador de velocidad. Un 429 dice que se pidió
 *    de más, no que PubMed esté caído; dejar de consultar la evidencia entera
 *    por eso sería cambiar un problema pequeño por uno grande.
 *  · **400 / 404** — la consulta estaba mal formada, o ese PMID no existe.
 */
import type { Veredicto } from '@/lib/red/interruptor'
import { TiempoAgotado } from '@/lib/fetch-con-timeout'

/** Traduce el código HTTP de una fuente de evidencia. PURO. */
export function veredictoDeRespuestaEvidencia(status: number): Veredicto {
  if (status >= 500) return 'el_proveedor_no_esta'
  return 'no_dice_nada_del_proveedor'
}

/** Traduce una excepción de la búsqueda. */
export function veredictoDeExcepcionEvidencia(e: unknown): Veredicto {
  if (e instanceof TiempoAgotado) return 'el_proveedor_no_esta'
  if (e instanceof DOMException && e.name === 'AbortError') return 'el_proveedor_no_esta'
  if (e instanceof DOMException && e.name === 'TimeoutError') return 'el_proveedor_no_esta'
  /* Igual que en WhatsApp: se prefiere quedarse corto. Ver aquel módulo. */
  return 'no_dice_nada_del_proveedor'
}

/**
 * La clave del circuito de una fuente de evidencia.
 *
 * Aquí no hay credencial por consultorio: PubMed y openFDA se consultan con la
 * llave de la plataforma (o sin llave). Un circuito por fuente, y **no uno
 * compartido**: que NCBI esté caído no puede dejar de consultar la etiqueta de
 * la FDA, que es otro servicio y otra máquina.
 */
export function claveCircuitoEvidencia(fuente: 'ncbi' | 'openfda'): string {
  return `ev:${fuente}:plataforma`
}

export const POR_QUE_UN_429_NO_ABRE =
  'NCBI limita por llave y el módulo ya tiene su propio regulador de velocidad. ' +
  'Un 429 dice que se pidió de más, no que PubMed esté caído: dejar de consultar ' +
  'la evidencia entera por eso sería cambiar un problema pequeño por uno grande.'

export const NO_CONSULTADO_NO_ES_SIN_RESULTADOS =
  'Una búsqueda que no se hizo no puede parecer una búsqueda sin resultados. ' +
  'Cuando el circuito está abierto la fuente queda como NO CONSULTADA, que es ' +
  'lo que el médico necesita saber para decidir si busca por su cuenta.'

/**
 * La fuente no se consultó porque su circuito está abierto.
 *
 * Se lanza en vez de devolver una lista vacía **a propósito**: los llamadores ya
 * tienen un `catch` que marca el testigo (`TestigoPubMed.fallo`), y ese testigo
 * es justo lo que separa «no hay artículos» de «no se pudo preguntar». Devolver
 * `[]` en silencio convertiría lo segundo en lo primero, que es la regla 4 de
 * seguridad clínica: ausencia de dato no es dato de ausencia.
 */
export class FuenteNoConsultada extends Error {
  constructor(public readonly fuente: string) {
    super(`No se consultó ${fuente}: no está respondiendo`)
    this.name = 'FuenteNoConsultada'
  }
}
