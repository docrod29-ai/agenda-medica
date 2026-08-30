/**
 * EL VOCABULARIO DE FALLOS DE LA IA, traducido al interruptor.
 *
 * El motor del interruptor vive en `red/interruptor.ts` y **no sabe nada de
 * ningún proveedor**: sólo pregunta si el fallo dice que el proveedor no está
 * (ver la cabecera de ese archivo, y REG-391 para por qué se separó).
 *
 * Aquí vive la mitad que sí es de la IA: qué significa cada clase de fallo del
 * protocolo de Anthropic y OpenAI. Es una traducción, no un segundo interruptor
 * — el estado es uno solo y está allá.
 *
 * ── LO QUE NO ABRE EL CIRCUITO, Y POR QUÉ ───────────────────────────────────
 *
 *  · `llave` (401/403). Una llave revocada es de QUIEN la puso. Si abriera el
 *    circuito, **un consultorio con su llave mal escrita dejaría sin IA a todos
 *    los demás**.
 *  · `saldo` (402). Es el saldo de una cuenta, no la salud del proveedor.
 *  · `limite` (429). Es el límite de una llave, y además contesta rápido: abrir
 *    el circuito no ahorraría nada y cortaría un servicio que sí funciona.
 *  · `modelo` (400/404). El proveedor está perfectamente; lo que no existe es
 *    ese modelo para esa llave. Para eso está la cascada.
 *  · `respuesta`. Llegó una respuesta HTTP buena y no se pudo leer. Eso no se
 *    arregla dejando de llamar.
 */
import { anotarVeredicto, type Veredicto } from '@/lib/red/interruptor'

/** Clases de fallo del protocolo de IA que este módulo distingue. */
export type ClaseFalloIA = 'llave' | 'limite' | 'saldo' | 'proveedor' | 'modelo' | 'red' | 'respuesta'

/**
 * ¿Este fallo dice que el PROVEEDOR no está?
 *
 * Es la pregunta que decide todo lo demás, y por eso está sola y con nombre.
 */
export function esFalloDelProveedor(clase: ClaseFalloIA): boolean {
  return clase === 'proveedor' || clase === 'red'
}

/** La traducción. `null` = la llamada salió bien. */
export function veredictoIA(clase: ClaseFalloIA | null): Veredicto {
  if (clase === null) return 'contesto'
  return esFalloDelProveedor(clase) ? 'el_proveedor_no_esta' : 'no_dice_nada_del_proveedor'
}

/** Registra el resultado de un intento de IA. `clase` null = salió bien. */
export function anotarResultado(clave: string, clase: ClaseFalloIA | null, ahoraMs = Date.now()): void {
  anotarVeredicto(clave, veredictoIA(clase), ahoraMs)
}

export const POR_QUE_NO_ABRE_CON_UNA_LLAVE_MALA =
  'Una llave revocada es de quien la puso. Si abriera el circuito, un ' +
  'consultorio con su llave mal escrita dejaría sin IA a todos los demás: no ' +
  'mueve datos de un consultorio a otro, mueve la CAÍDA. Por eso sólo abren el ' +
  'circuito los fallos que dicen que el PROVEEDOR no está, y por eso la llave ' +
  'forma parte de la clave del circuito.'
