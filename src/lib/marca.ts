/**
 * EL NOMBRE DEL PRODUCTO, Y LO QUE NO ES EL NOMBRE DEL PRODUCTO.
 *
 * ── POR QUÉ CAMBIÓ ──────────────────────────────────────────────────────────
 *
 * Se llamaba **NexusMED**. El nombre lo puso un agente el 3-jun-2026 (commit
 * `9395cc61`) **sin comprobar disponibilidad**, y `nexusmed.mx` estaba
 * registrado desde el 5-feb-2026 por otro médico con un producto del mismo
 * mercado — expediente clínico electrónico para México.
 *
 * Cuatro meses antes. No fue una coincidencia desafortunada: fue no mirar.
 *
 * ── POR QUÉ AUSCULTA ────────────────────────────────────────────────────────
 *
 * Verificado el 9-ago-2026 con `whois` (NIC-MX y Verisign), `dig`, TMview
 * (MX/ES/EUIPO) y la App Store de México:
 *
 *   · `ausculta.mx` y `ausculta.com.mx` — **libres**
 *   · IMPI — **cero coincidencias en todo el registro**
 *   · Sin ningún producto de salud homónimo
 *
 * Y dice lo que el producto hace: auscultar es **escuchar al paciente**. Un
 * médico mexicano lo entiende sin que nadie se lo explique, que es más de lo
 * que puede decirse de una palabra latina inventada.
 *
 * ── LA FRONTERA: CINCO COSAS QUE PARECEN LA MARCA Y NO LO SON ───────────────
 *
 * Renombrar 625 menciones a ciegas habría roto cosas que no se ven. Estas
 * **conservan `nexusmed` para siempre**, y cada una por un motivo distinto:
 *
 * 1. **`nexusmed-recovery`** — el nombre de la base IndexedDB donde vive el
 *    **audio de una consulta en curso**. Renombrarla no migra nada: la base
 *    vieja sigue ahí y la aplicación deja de mirarla. El médico que estuviera
 *    grabando cuando se despliegue **pierde el audio**. No es un riesgo
 *    teórico: es el fallo que este repositorio ya cerró en REG-283 y REG-287.
 *
 * 2. **`nexusmed.theme`** — su preferencia de tema en `localStorage`.
 *    Renombrarla se la borra. Es menor, y no hay ninguna razón para pagarlo.
 *
 * 3. **`nexusmed-expediente-1` y `nexusmed-respaldo-1`** — no son marca, son
 *    **identificadores de FORMATO de archivo**. Van escritos dentro de cada
 *    respaldo y de cada exportación que el médico ya descargó. Un importador
 *    que espere otro nombre no los lee. Un formato se versiona; no se
 *    rebautiza porque cambie el logotipo.
 *
 * 4. **`nexusmed-v1168`** — el nombre de la caché del service worker y el
 *    sello de `version.txt`. Cambiar el prefijo rompe la comprobación de
 *    versión desplegada, que es justamente la que descubrió que v1146 mentía
 *    (REG-267).
 *
 * 5. **La bitácora, el changelog y los ADR.** Son **historia**. REG-060 pasó
 *    en una aplicación que se llamaba NexusMED y reescribirlo sería falsear
 *    el registro. Lo que se documenta no se maquilla.
 *
 * La regla, en una línea: **se renombra lo que el médico LEE; no se renombra
 * lo que la máquina BUSCA.**
 */

/** El nombre del producto, tal y como se escribe. */
export const MARCA = 'Ausculta'

/** Lo que hace, en una línea, para metadatos y para la portada. */
export const LEMA = 'El consultorio que escucha.'

/**
 * Prefijos que NO son la marca y que sobreviven al cambio de nombre.
 *
 * Existe exportado para que un guardián pueda comprobarlo: si alguien
 * «termina» el renombrado tocando uno de éstos, la prueba falla y dice por
 * qué. Una frontera que sólo vive en un comentario es una frontera que se
 * cruza.
 */
/**
 * EL PREFIJO DEL SELLO DE VERSIÓN, EN UN SOLO SITIO.
 *
 * Lo escriben `public/sw.js` (`CACHE`) y `scripts/version-sw.mjs`
 * (`public/version.txt`); lo LEE `ServiceWorkerRegister` para decidir si el
 * navegador se quedó con una versión vieja y hay que purgar.
 *
 * Existe como constante porque el renombrado de marca cruzó la frontera justo
 * por el lado que nadie miraba: el escritor conservó `nexusmed-v` —como manda
 * la regla— y el LECTOR pasó a buscar `ausculta-v`. Los dos lados «correctos»
 * por separado, y la comparación devolviendo `null` contra `null` en silencio:
 * la purga llevaba muerta desde entonces.
 */
export const PREFIJO_VERSION = 'nexusmed-v'

export const NO_SE_RENOMBRAN = [
  'nexusmed-recovery',      // IndexedDB · audio de consulta en curso
  'nexusmed.theme',         // localStorage · preferencia de tema
  'nexusmed-expediente-1',  // formato de exportación ya emitido
  'nexusmed-respaldo-1',    // formato de respaldo ya emitido
  PREFIJO_VERSION,          // caché del service worker y version.txt
] as const
