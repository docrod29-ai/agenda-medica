/**
 * POR LOTES, Y REANUDABLE.
 *
 * ── LO QUE NO PUEDE PASAR ────────────────────────────────────────────────────
 *
 * Cargar 50 000 pacientes en memoria y escribirlos de golpe falla de tres
 * maneras a la vez: se agota la memoria del proceso, se pasa del tiempo máximo
 * de la ruta, y si algo se cae a mitad no hay forma de saber por dónde iba. Las
 * tres fallan en el mismo sitio: en la importación grande, que es exactamente la
 * que este carril existe para atender.
 *
 * ── EL PUNTO DE CONTROL ES UN NÚMERO, NO UN ESTADO ───────────────────────────
 *
 * Reanudar es saber cuál fue el último lote COMPLETO. Se guarda ese número y
 * nada más. La tentación es guardar «las filas que faltan», y es un error: esa
 * lista se desincroniza del archivo en cuanto alguien vuelve a subirlo, y
 * entonces el reanudado escribe otra cosa.
 *
 * Con el número basta porque el troceado es DETERMINISTA: el mismo archivo con
 * el mismo tamaño de lote da siempre los mismos lotes, así que «el lote 37» es
 * una dirección estable. Esa es la propiedad que hay que proteger — si algún día
 * el troceado dependiera del orden de llegada o del reloj, el reanudado
 * empezaría a saltarse filas en silencio.
 *
 * ── EL TRABAJADOR ZOMBI ──────────────────────────────────────────────────────
 *
 * Un proceso que perdió la red pero sigue vivo cree que es el dueño del trabajo
 * y sigue escribiendo mientras otro lo reanuda. Dos escritores sobre el mismo
 * trabajo duplican todo lo que la llave idempotente no cubra. Se resuelve con un
 * arrendamiento que caduca: quien escribe tiene que poder demostrar que el suyo
 * sigue vigente.
 *
 * Módulo PURO: aritmética y política. Sin reloj propio — «ahora» se inyecta.
 */
import { idDeLote } from './huella'

/* ═══════════════════════ EL TROCEADO ═══════════════════════ */

/**
 * Filas por lote.
 *
 * 400 y no 500: Firestore admite 500 operaciones por escritura en bloque, y
 * dejar el margen permite que una fila produzca más de un documento (el paciente
 * y su sello de procedencia) sin partir el lote a mitad. `clinic/importar` ya usa
 * este mismo número por la misma razón.
 */
export const FILAS_POR_LOTE = 400

/**
 * Tope de filas que se tienen en memoria a la vez.
 *
 * No es el tamaño del lote: es cuántas filas del archivo se sostienen mientras
 * se procesan. Con 50 000 filas de ~200 bytes son ~10 MB si se sostienen todas,
 * y eso todavía cabe; con documentos adjuntos declarados por fila, no. El
 * arnés mide contra este número y falla si se pasa.
 */
export const MAXIMO_FILAS_EN_MEMORIA = 2_000

export interface Lote {
  readonly numero: number
  readonly id: string
  /** Índice de la primera fila (0 = primera fila de datos). */
  readonly desde: number
  /** Índice de la última fila, INCLUSIVE. */
  readonly hasta: number
  readonly filas: number
}

/**
 * Trocea un número de filas en lotes. Determinista y sin tocar los datos.
 *
 * Se calcula sobre el CONTEO, no sobre el arreglo: así se puede planificar el
 * trabajo —y enseñar «esto van a ser 125 lotes»— antes de haber leído el archivo
 * entero a memoria, que es justo lo que hay que evitar.
 */
export function planificar(totalFilas: number, importJobId: string, porLote = FILAS_POR_LOTE): Lote[] {
  if (totalFilas <= 0) return []
  if (porLote <= 0) throw new Error('migración: el tamaño de lote tiene que ser positivo')
  const lotes: Lote[] = []
  for (let i = 0, n = 0; i < totalFilas; i += porLote, n++) {
    const hasta = Math.min(i + porLote, totalFilas) - 1
    lotes.push({ numero: n, id: idDeLote(importJobId, n), desde: i, hasta, filas: hasta - i + 1 })
  }
  return lotes
}

/** Cuántos lotes van a hacer falta. Para el ensayo, sin trocear nada. */
export function cuentaDeLotes(totalFilas: number, porLote = FILAS_POR_LOTE): number {
  return totalFilas <= 0 ? 0 : Math.ceil(totalFilas / porLote)
}

/* ═══════════════════════ EL PUNTO DE CONTROL ═══════════════════════ */

export interface PuntoDeControl {
  readonly importJobId: string
  /**
   * Número del último lote CONFIRMADO. `-1` = ninguno todavía.
   *
   * «Confirmado» quiere decir que su escritura volvió bien. Un lote enviado y
   * sin respuesta NO se marca: si de verdad entró, la llave idempotente hace que
   * repetirlo no duplique, y ese es el desenlace barato. Marcarlo por si acaso
   * sería el desenlace caro — saltarse un lote que nunca entró.
   */
  readonly ultimoLoteConfirmado: number
  readonly filasEscritas: number
  /** ISO. Cuándo se confirmó el último lote. */
  readonly actualizadoEn: string
  /** Quién está trabajando. Para detectar dos escritores. */
  readonly trabajador: string
  /** ISO. Hasta cuándo vale el arrendamiento de este trabajador. */
  readonly arrendamientoHasta: string
}

/**
 * Cuánto dura el arrendamiento de un trabajador.
 *
 * Tiene que ser MAYOR que lo que tarda un lote y MENOR que la paciencia del
 * médico. Cinco minutos coincide con `maxDuration` de las rutas de importación:
 * si la ruta murió, el arrendamiento ya no puede estar vivo.
 */
export const ARRENDAMIENTO_MS = 5 * 60 * 1000

export function nuevoPuntoDeControl(importJobId: string, trabajador: string, ahora: string): PuntoDeControl {
  return {
    importJobId,
    ultimoLoteConfirmado: -1,
    filasEscritas: 0,
    actualizadoEn: ahora,
    trabajador,
    arrendamientoHasta: new Date(Date.parse(ahora) + ARRENDAMIENTO_MS).toISOString(),
  }
}

/**
 * Por qué lote sigue el trabajo.
 *
 * Es una suma y existe para que la suma esté en un solo sitio: un `+1` de más o
 * de menos aquí se traduce en un lote saltado o en uno repetido, y ninguna de
 * las dos cosas se ve en el resultado — la llave idempotente tapa la repetición
 * y el salto sólo se detecta cuando las cuentas no cuadran, mucho después.
 */
export function siguienteLote(p: PuntoDeControl): number {
  return p.ultimoLoteConfirmado + 1
}

/** Avanza el punto de control tras confirmar un lote. */
export function confirmarLote(p: PuntoDeControl, lote: Lote, ahora: string): PuntoDeControl {
  /**
   * Un lote fuera de orden es un defecto del llamador, no un caso a tolerar.
   *
   * Aceptarlo dejaría el punto de control apuntando más adelante de lo que de
   * verdad se escribió, y el reanudado se saltaría todo lo que hay en medio. Se
   * prefiere fallar aquí, ruidosamente, que perder filas allí, en silencio.
   */
  if (lote.numero !== siguienteLote(p)) {
    throw new Error(
      `migración: se confirmó el lote ${lote.numero} cuando tocaba el ${siguienteLote(p)} — reanudar así saltaría filas`,
    )
  }
  return {
    ...p,
    ultimoLoteConfirmado: lote.numero,
    filasEscritas: p.filasEscritas + lote.filas,
    actualizadoEn: ahora,
    arrendamientoHasta: new Date(Date.parse(ahora) + ARRENDAMIENTO_MS).toISOString(),
  }
}

/** Los lotes que quedan por hacer. Reanudar es esto. */
export function lotesPendientes(lotes: readonly Lote[], p: PuntoDeControl): Lote[] {
  const desde = siguienteLote(p)
  return lotes.filter(l => l.numero >= desde)
}

export function trabajoTerminado(lotes: readonly Lote[], p: PuntoDeControl): boolean {
  return lotes.length === 0 || p.ultimoLoteConfirmado === lotes.length - 1
}

/* ═══════════════════════ EL ARRENDAMIENTO ═══════════════════════ */

/**
 * ¿Puede ESTE trabajador escribir ahora mismo?
 *
 * Dos condiciones y ninguna sobra:
 *
 *  · Si el arrendamiento sigue vivo, sólo escribe su dueño. Es lo que impide
 *    que un reanudado impaciente se ponga a escribir en paralelo con el que
 *    todavía va bien.
 *  · Si caducó, escribe cualquiera. Es lo que impide que un proceso muerto deje
 *    el trabajo bloqueado para siempre.
 *
 * El zombi —vivo pero sin red— se cuela por la segunda: cree tener el
 * arrendamiento y ya no lo tiene. Por eso la comprobación va JUNTO a la
 * escritura y no al empezar: entre «puedo» y «escribo» pueden pasar minutos.
 */
export function puedeEscribirLote(p: PuntoDeControl, trabajador: string, ahora: string): boolean {
  if (p.trabajador === trabajador) return true
  return Date.parse(ahora) >= Date.parse(p.arrendamientoHasta)
}

/** Toma el relevo de un trabajo abandonado. Falla si el arrendamiento sigue vivo. */
export function tomarRelevo(p: PuntoDeControl, trabajador: string, ahora: string): PuntoDeControl {
  if (!puedeEscribirLote(p, trabajador, ahora)) {
    throw new Error('migración: el trabajo lo tiene otro trabajador con arrendamiento vigente')
  }
  return {
    ...p,
    trabajador,
    arrendamientoHasta: new Date(Date.parse(ahora) + ARRENDAMIENTO_MS).toISOString(),
  }
}

/* ═══════════════════════ EL PRESUPUESTO DE REINTENTOS ═══════════════════════ */

/**
 * Cuántas veces se reintenta un lote antes de rendirse.
 *
 * Rendirse es una opción legítima: dejar el trabajo en `PARTIAL` con el punto de
 * control puesto es MEJOR que reintentar para siempre, porque lo primero se
 * reanuda cuando el problema esté arreglado y lo segundo consume la cuota de
 * escritura del consultorio entero mientras nadie mira.
 */
export const REINTENTOS_POR_LOTE = 3

/**
 * Espera antes del siguiente intento, con crecimiento y dispersión.
 *
 * La dispersión no es adorno: sin ella, veinte lotes que fallaron por el mismo
 * corte de red reintentan todos en el mismo milisegundo y vuelven a tumbar lo
 * que se estaba recuperando. El factor de dispersión se INYECTA (0..1) para que
 * la función siga siendo determinista y se pueda probar.
 */
export function esperaMs(intento: number, dispersion: number): number {
  const base = Math.min(1000 * 2 ** intento, 30_000)
  return Math.round(base * (0.5 + 0.5 * Math.min(Math.max(dispersion, 0), 1)))
}

/* ═══════════════════════ EL PROGRESO ═══════════════════════ */

export interface Progreso {
  readonly lotesTotales: number
  readonly lotesHechos: number
  readonly filasTotales: number
  readonly filasEscritas: number
  /** 0..1. Sobre LOTES, que es lo que de verdad avanza a saltos. */
  readonly fraccion: number
  readonly cancelado: boolean
}

export function progreso(lotes: readonly Lote[], p: PuntoDeControl, cancelado = false): Progreso {
  const hechos = p.ultimoLoteConfirmado + 1
  const filasTotales = lotes.reduce((s, l) => s + l.filas, 0)
  return {
    lotesTotales: lotes.length,
    lotesHechos: hechos,
    filasTotales,
    filasEscritas: p.filasEscritas,
    fraccion: lotes.length === 0 ? 1 : hechos / lotes.length,
    cancelado,
  }
}

/**
 * Cancelar es DEJAR DE EMPEZAR lotes, no deshacer los hechos.
 *
 * Un lote a medio confirmar se termina; lo ya escrito se queda. Deshacer al
 * cancelar significaría borrar expedientes que ya entraron bien, y ése es el
 * camino corto a perder trabajo real por haber pulsado un botón de «parar».
 *
 * El trabajo queda en `PARTIAL` con su punto de control: se reanuda o se
 * revierte a propósito, con `rollback.ts`, que es una decisión aparte.
 */
export function alCancelar(p: PuntoDeControl): { readonly conservar: number; readonly estado: 'PARTIAL' } {
  return { conservar: p.filasEscritas, estado: 'PARTIAL' }
}
