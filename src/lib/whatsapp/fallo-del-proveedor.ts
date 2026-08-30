/**
 * ¿EL FALLO DE ESTE ENVÍO DICE QUE WHATSAPP NO ESTÁ? — el traductor (REG-391).
 *
 * El interruptor de circuito vive en `red/interruptor.ts` y no conoce ningún
 * vocabulario de proveedor: sólo quiere un veredicto. Aquí se traduce el de
 * Meta / 360dialog / Twilio.
 *
 * ── POR QUÉ ESTA DISTINCIÓN IMPORTA MÁS AQUÍ QUE EN LA IA ───────────────────
 *
 * En la IA, confundir «tu llave está mal» con «el proveedor está caído» hace que
 * un consultorio apague la IA de los demás. Malo, y ya está resuelto.
 *
 * Aquí hace algo peor, y es lo que descubrió REG-391: el outbox cuenta intentos
 * y a los cinco manda el mensaje al **dead-letter**. Un mensaje que falla porque
 * Meta devuelve 503 no tiene nada malo — y aun así gastaba su presupuesto de
 * reintentos igual que uno con el teléfono mal escrito. Con el cron cada hora,
 * **cinco horas de caída del proveedor mataban toda la cola**: avisos de lista
 * de espera que nadie envió, huecos de agenda que nadie ocupó, y ni un error a
 * la vista, porque desde fuera el sistema hizo justo lo que dice hacer.
 *
 * Un intento que no se hizo, o que se estrelló contra un proveedor ausente, **no
 * es un intento del mensaje**. De ahí sale todo lo demás.
 *
 * ── QUÉ NO ABRE EL CIRCUITO ─────────────────────────────────────────────────
 *
 * Lo mismo que en la IA, y por el mismo motivo de aislamiento:
 *
 *  · **401 / 403** — el token es del consultorio. Si abriera el circuito, un
 *    consultorio con su credencial caducada dejaría a los demás sin recordatorios.
 *  · **429** — es el límite de ESE número de teléfono, y contesta rápido.
 *  · **400 / 404 / 470** — número mal escrito, plantilla no aprobada, fuera de
 *    la ventana de 24 h. El proveedor está: lo que está mal es la petición, y
 *    ése sí es un fallo del mensaje que debe gastar su reintento.
 */
import type { Veredicto } from '@/lib/red/interruptor'
import { TiempoAgotado } from '@/lib/fetch-con-timeout'

/**
 * Traduce el código HTTP del proveedor de WhatsApp.
 *
 * PURO. `status` es el que devolvió la API, no el que se le enseña a nadie.
 */
export function veredictoDeRespuestaWA(status: number): Veredicto {
  if (status >= 500) return 'el_proveedor_no_esta'
  /* 4xx y cualquier otra cosa: contestó, y lo que dijo es de quien llamó. */
  return 'no_dice_nada_del_proveedor'
}

/**
 * Traduce una excepción del envío.
 *
 * El tiempo agotado y el socket caído son la otra cara del 5xx: el proveedor no
 * está contestando. Un `TypeError` de un cuerpo mal construido, no.
 */
export function veredictoDeExcepcionWA(e: unknown): Veredicto {
  if (e instanceof TiempoAgotado) return 'el_proveedor_no_esta'
  if (e instanceof TypeError) return 'no_dice_nada_del_proveedor'
  if (e instanceof DOMException && e.name === 'AbortError') return 'el_proveedor_no_esta'
  /**
   * `fetch` lanza `TypeError` para casi todo fallo de red en Node, así que la
   * rama de arriba se lleva algunos que sí son del proveedor. Se prefiere
   * quedarse corto: dar por caído a un proveedor que sí está sería dejar de
   * mandar recordatorios que sí saldrían. Señalar de menos, y declararlo.
   */
  return 'no_dice_nada_del_proveedor'
}

/**
 * La clave del circuito de WhatsApp.
 *
 * `propia` = el consultorio puso sus credenciales. Entonces su circuito es suyo
 * y su caída no apaga a nadie más. Con las credenciales de la plataforma el
 * circuito es uno solo, porque la credencial es una sola.
 */
export function claveCircuitoWA(proveedor: string, propia: boolean, clinicId: string): string {
  return propia ? `wa:${proveedor}:clinica:${clinicId}` : `wa:${proveedor}:plataforma`
}

export const POR_QUE_UNA_CAIDA_NO_GASTA_REINTENTOS =
  'El outbox cuenta intentos del MENSAJE y a los cinco lo manda al dead-letter. ' +
  'Un mensaje que falla porque el proveedor devuelve 503 no tiene nada malo: ' +
  'con el cron cada hora, cinco horas de caída mataban toda la cola sin un solo ' +
  'error a la vista. Un intento que se estrelló contra un proveedor ausente no ' +
  'es un intento del mensaje.'
