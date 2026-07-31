/**
 * FUNDADOR — quién es el dueño de la plataforma, y por qué no es un cliente.
 *
 * Master Loop V3 §BK–BN, y el P1-4 de la auditoría. Hoy el acceso del dueño se
 * expresa con `paseLibre: boolean` en el documento de la clínica, más una copia
 * suelta de la lista de correos dentro de `/api/uci/copilot`. Funciona, pero
 * confunde dos cuentas que no se parecen en nada:
 *
 *   · **Fundador** — el dueño del sistema. No paga, no cuenta como ingreso, ve
 *     todos los módulos aunque no estén lanzados, y lo que gasta en IA es
 *     INVESTIGACIÓN, no costo de servir a un cliente.
 *   · **Cortesía** — un cliente de verdad al que se le regaló el acceso. No
 *     paga, pero es alguien a quien hay que servir: su gasto SÍ es costo de
 *     operación y su experiencia sí es la del producto.
 *
 * ── POR QUÉ IMPORTA MÁS ALLÁ DE LOS PERMISOS ─────────────────────────────────
 *
 * §CD: si el gasto que el fundador genera PROBANDO UCI se atribuye al costo de
 * servir a los usuarios de Consulta, el margen deja de ser real y las decisiones
 * de precio salen mal. El Dr. usa UCI a diario justamente para terminarla; ese
 * consumo puede ser el más grande de la plataforma y no le corresponde a ningún
 * cliente.
 *
 * ── DE DÓNDE SALE LA VERDAD ──────────────────────────────────────────────────
 *
 * Del **correo verificado**, no de un campo del documento de la clínica. Un
 * booleano en Firestore describe una cuenta con todo desbloqueado; ser dueño de
 * la plataforma es otra cosa y no debería poder concedérselo un `update`.
 *
 * §BK además lo pide explícito: «el acceso del fundador NO debe depender de una
 * suscripción de pago. No crear suscripciones falsas para habilitar módulos al
 * fundador».
 *
 * Módulo PURO: recibe el correo ya verificado, no lo verifica.
 */

/** Se conserva como respaldo para que el sistema funcione sin configurar nada. */
const DUENO_POR_DEFECTO = 'docrod29@gmail.com'

/**
 * Correos del dueño de la plataforma.
 *
 * Misma fuente que `superadmin.ts` (`SUPERADMIN_EMAILS`): ser dueño de la
 * consola y ser fundador son la misma persona, y dos listas separadas se
 * desincronizan el día que se agregue un socio.
 */
export function correosFundador(env?: string | null): string[] {
  return (env ?? DUENO_POR_DEFECTO)
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

/**
 * ¿Este correo es del fundador?
 *
 * El llamador tiene que haber verificado ya el correo (token de Firebase). Aquí
 * sólo se compara: este módulo no autentica a nadie.
 */
export function esFundador(email?: string | null, env?: string | null): boolean {
  if (!email) return false
  return correosFundador(env).includes(email.trim().toLowerCase())
}

/** Cómo se trata a esta cuenta para permisos, contabilidad y costos. */
export type ClaseCuenta =
  /** El dueño de la plataforma. Ni ingreso ni COGS. */
  | 'fundador'
  /** Cliente real con acceso regalado. No es ingreso, pero SÍ es costo de servir. */
  | 'cortesia'
  /** Cliente que paga. */
  | 'cliente'

export interface CuentaClasificable {
  paseLibre?: boolean | null
  plan?: string | null
}

/**
 * Clasifica una cuenta.
 *
 * El segundo argumento es un **booleano ya decidido**, no un correo, porque cada
 * llamador conoce una verdad distinta y ninguna se puede adivinar desde aquí:
 * una petición trae el correo verificado del token, mientras que el documento de
 * la clínica sólo guarda `ownerId` (un uid) — no hay correo que comparar. Pedir
 * el dato que el llamador sí tiene evita el peor resultado posible: una
 * clasificación que nunca dispara y que en el tablero se ve idéntica a una que
 * funciona.
 *
 * Y ese booleano manda sobre el documento: si el que entra es el fundador, es
 * fundador aunque su clínica esté marcada como cortesía — que es exactamente el
 * estado en el que está hoy la cuenta del Dr.
 */
export function claseDeCuenta(c: CuentaClasificable | null | undefined, esDelFundador: boolean): ClaseCuenta {
  if (esDelFundador) return 'fundador'
  if (c?.paseLibre === true || c?.plan === 'cortesia') return 'cortesia'
  return 'cliente'
}

/** ¿Cuenta como ingreso? Ni el fundador ni las cortesías. */
export function cuentaComoIngreso(clase: ClaseCuenta): boolean {
  return clase === 'cliente'
}

/**
 * ¿Su gasto de IA es costo de servir (COGS)?
 *
 * La cortesía SÍ: es un cliente al que se le está sirviendo, sólo que gratis, y
 * esconder ese costo haría ver un margen que no existe. El fundador NO: está
 * construyendo el producto, y eso es I+D.
 */
export function esCogs(clase: ClaseCuenta): boolean {
  return clase !== 'fundador'
}

export const POR_QUE_FUNDADOR_NO_ES_CORTESIA =
  'Los dos entran sin pagar, y ahí se acaba el parecido. A la cortesía se le ' +
  'está sirviendo el producto: su gasto es costo de operación y su experiencia ' +
  'es la del cliente. El fundador está construyendo el producto: su gasto es ' +
  'investigación, y probar UCI todos los días puede ser el consumo más grande ' +
  'de la plataforma sin que le corresponda a ningún cliente. Mezclarlos hace ' +
  'que el margen deje de ser real.'
