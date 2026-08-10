/**
 * EL NOMBRE DEL PRODUCTO, EN UN SOLO SITIO.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El 10-ago-2026 el dueño renombró el producto: **NexusMED → Ausculta**. El
 * nombre viejo estaba escrito a mano en unos cuatrocientos sitios, así que
 * cambiarlo fue una jornada de `sed` con revisión archivo a archivo. La segunda
 * vez no puede costar lo mismo.
 *
 * Familia `depende_de_recordar`: el dato existe y N sitios lo repiten a mano.
 * Se **deriva**, con guardián que falle al separarse
 * (`la-marca-es-una-sola.test.ts`).
 *
 * ── LO QUE ESTA CONSTANTE **NO** GOBIERNA ────────────────────────────────────
 *
 * Hay identificadores que llevan el nombre viejo y **no se renombran**, porque
 * renombrarlos rompe cosas que ya están en manos de la gente:
 *
 *  · `nexusmed.mx` — el dominio y los correos de soporte. Existe y recibe
 *    mensajes; apuntar la app a un dominio que nadie ha comprado deja al médico
 *    sin a quién escribir.
 *  · `nexomed-agenda` — el proyecto de Firebase. Un id de proyecto no se
 *    renombra: se migra, y eso es una decisión del dueño.
 *  · `nexusmed.app` — el `appId` de Capacitor. Cambiarlo convierte la
 *    actualización en una app distinta para quien ya la tenga instalada.
 *  · `nexusmed-vNNN` — el nombre de la caché del service worker, y
 *    `nexusmed.theme` en `localStorage`. Son llaves, no texto: cambiarlas tira
 *    la caché y el tema que el médico eligió.
 *
 * Un identificador no es una marca. Que se parezcan es un accidente de cómo se
 * eligieron, no una razón para tocarlos.
 */

/** El nombre del producto, tal y como lo lee un humano. */
export const MARCA = 'Ausculta'

/**
 * El nombre anterior. Se conserva **escrito** para que el guardián pueda
 * buscarlo y para que quien lea un documento viejo sepa que hablan de lo mismo.
 */
export const MARCA_ANTERIOR = 'NexusMED'

/** Descriptor corto de una línea, para `<meta>` y para el pie de las páginas. */
export const MARCA_DESCRIPTOR = 'Agenda médica y expediente clínico electrónico'
