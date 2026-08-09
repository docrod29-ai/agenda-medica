/**
 * LOS BUZONES DE LA APLICACIÓN, EN UN SOLO SITIO.
 *
 * ── EL DEFECTO QUE LO MOTIVA (9-ago-2026) ───────────────────────────────────
 *
 * La aplicación publicaba **ocho** direcciones en `@nexusmed.mx`, escritas a
 * mano en seis archivos. Ese dominio **no es nuestro**: está registrado desde
 * el 5-feb-2026 por otro médico, con un producto del mismo mercado, y tiene
 * **registros MX activos** (Cloudflare Email Routing) — es decir, recibe correo.
 *
 * Dos daños, y ninguno es estético:
 *
 * 1. **El canal ARCO era inoperante.** `privacidad@nexusmed.mx` es la dirección
 *    que el aviso de privacidad ofrece para ejercer los derechos de Acceso,
 *    Rectificación, Cancelación y Oposición. La LFPDPPP obliga a tener ese
 *    canal y a que funcione. Un canal ARCO que apunta a un dominio ajeno no es
 *    un defecto de redacción: es un aviso de privacidad que no se puede
 *    cumplir.
 *
 * 2. **Correo con datos de paciente hacia fuera.** `soporte@nexusmed.mx` se
 *    ofrece en la pantalla de migración —«¿tienes miles de expedientes en otro
 *    sistema?»—. Un médico que responda a esa invitación manda nombres de
 *    pacientes y de su consultorio a un buzón que no controlamos.
 *
 * **Lo que NO se comprobó, a propósito**: si el dominio tiene catch-all y
 * entrega de verdad esos correos. Comprobarlo exigía mandar un mensaje al
 * dominio de un competidor, y eso no se hace para confirmar una hipótesis.
 *
 * ── POR QUÉ UNA CONSTANTE Y NO OCHO CADENAS ─────────────────────────────────
 *
 * Porque el nombre del producto va a cambiar —`nexusmed.mx` está tomado— y la
 * lección de este mismo repositorio, contada 34 veces, es que lo que se
 * escribe en ocho sitios se arregla en siete.
 *
 * Cuando haya dominio propio, se cambia **aquí** y se acabó.
 */

/**
 * Buzón para asuntos de privacidad y derechos ARCO.
 *
 * Por defecto, el correo del responsable. No es la solución definitiva —un
 * canal ARCO merece un buzón dedicado— pero un correo personal que SÍ se lee
 * es incomparablemente mejor que una dirección de un dominio ajeno.
 */
export const CORREO_PRIVACIDAD =
  process.env.NEXT_PUBLIC_CORREO_PRIVACIDAD?.trim() || 'docrod29@gmail.com'

/** Buzón de soporte y de migración de expedientes. */
export const CORREO_SOPORTE =
  process.env.NEXT_PUBLIC_CORREO_SOPORTE?.trim() || 'docrod29@gmail.com'

/**
 * Lo que hace falta del dueño para cerrar esto del todo.
 *
 * Sigue la convención `FALTA_` a propósito: así lo recoge
 * `scripts/calidad/lo-que-espera-al-dueno.mjs` sin que nadie tenga que
 * acordarse de apuntarlo en ninguna lista.
 */
export const FALTA_BUZON_PROPIO =
  'NEEDS_CLINICAL_REVIEW: el canal ARCO y el de soporte apuntan hoy al correo ' +
  'personal del responsable (docrod29@gmail.com). Es correcto y operante, pero ' +
  'no es un buzón institucional. Cuando exista el dominio propio del producto, ' +
  'defina NEXT_PUBLIC_CORREO_PRIVACIDAD y NEXT_PUBLIC_CORREO_SOPORTE en Vercel. ' +
  'Hasta entonces NO se toca: lo que había antes era un dominio de un tercero.'
