# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001`, **abierta** el 9-ago-2026.
`PATIENT-UX-TRUTH-001` quedó cerrada el 8-ago-2026.

---

## `DESIGN-SYSTEM-001` · parte A **cerrada** — el contraste (9-ago, REG-291)

Se empezó por donde el sistema **se contradecía a sí mismo**, no por los tokens
que faltan: `--nexus` está ajustado para leerse como TEXTO y se usaba también de
RELLENO bajo texto blanco. El propio CSS tenía la cuenta hecha —3,28:1, reprueba
AA— y el arreglo aplicado sólo a `.btn-primary`.

**48 parejas por debajo de 4,5:1 en 22 archivos**, en los dos temas. Incluidos
seis botones desactivados con texto blanco sobre superficie clara (**1,20:1**: el
texto no estaba) y tres botones de WhatsApp a **1,98:1**.

| | |
|---|---|
| Instrumento | `scripts/design/contraste-en-linea.mjs` · `npm run gate:contraste` |
| Techo | `docs/design/contraste-techo.json` = **0**. Sin deuda congelada |
| Prueba | `el-contraste-no-se-aprueba-a-ojo.test.ts` — 10 casos, sellada |
| Al revés | Revertido el arreglo de `legal/page.tsx`: la prueba falla nombrando archivo, línea, tema y cociente |
| Tokens nuevos | `--red-solido` · `--green-solido` · `--amber-solido` · `--whatsapp` · `--whatsapp-t`, con el cociente medido y **el mismo valor en los dos temas** |

Dos falsos positivos del propio medidor, cazados antes de que naciera: emparejar
ramas de ternario que nunca se pintan juntas, y leer un comentario de CSS como si
declarara un token. Los dos quedan como caso de prueba.

**Lo que falta de `DESIGN-SYSTEM-001` (parte B)**: la escala tipográfica y de
espacio con su trinquete de adopción, ensanchar `@theme inline`, y la compuerta
de accesibilidad más allá del contraste. El orden de abajo sigue vigente.

---

## Lo que se sabe hoy, y no se sabía ayer

**La premisa de la directiva no se cumple aquí.** No hay «cara de producto
generado por IA»: cero degradados, cero `from-purple`, una `rounded-2xl`, una
`shadow-2xl`, un `backdrop-blur`. Hay una identidad declarada, oscura por
defecto, con los cocientes de contraste WCAG calculados a mano y escritos en el
propio CSS.

**El defecto real es otro: el sistema existe y la aplicación no le obedece.**

| Medida | Valor |
|---|---|
| `style={{` | **6 065** en **177 de 200** archivos (88,5 %) |
| `className` | 816 |
| Hexadecimales a mano | **1 205** (151 distintos) |
| `fontSize` en línea | ~3 000, ~**60 valores** — la escala declarada tiene 6 |
| Radios en línea | ~19 valores — el sistema declara 3 |
| Adopción de `components/ui/` | **48 de 200** archivos (~24 %) |
| Tokens que Tailwind ve | **4** (`globals.css:126-131`) |

## La causa raíz, y por dónde se empieza

`@theme inline` expone a Tailwind cuatro valores. Todo lo demás vive en
variables CSS que Tailwind no ve, así que **no hay utilidades que usar** y el
código no tiene alternativa al estilo en línea. No es dejadez: es mecánica.

`DESIGN-SYSTEM-001` empieza ahí. **No por colores** — lo prohíbe §13 de la
directiva y además el color no es el problema.

## La prueba de que el enfoque funciona

`--r-pill`. La píldora estaba escrita de cinco formas (`100`, `999`, `9999`,
`99`, `50`). Se creó **un** token con su razón escrita, y hoy tiene **131
adopciones**. Un token bien puesto sí se adopta aquí. Falta repetirlo para
espacio, radio, tipografía y color, **cada uno con su guardián**.

## Reparado en esta iteración

**REG-266 · `@keyframes spin`** no existía en ningún sitio global, y lo
referencian 90 sitios incluidos `ui/Spinner` y `ui/Button loading`. Lo definían
31 pantallas en `<style>` locales, así que el giro funcionaba «según en qué
pantalla estuvieras». Reparado y sellado con
`toda-animacion-tiene-su-fotograma.test.ts`.

## Compuertas nuevas: **una**, y mide

**Contraste** (9-ago, REG-291): `npm run gate:contraste`, techo 0, sellada.
Es la primera compuerta de accesibilidad de este repositorio que **calcula** en
vez de mirar un patrón de texto.

Regresión visual, móvil y flujo en navegador **siguen sin definirse**, y las tres
necesitan que la aplicación arranque: este contenedor no tiene las variables de
Firebase. Del resto de accesibilidad —foco, etiquetas, orden de tabulación,
objetivo táctil— sigue habiendo **1** prueba, una expresión regular sobre
`layout.tsx`.

## Orden para `DESIGN-SYSTEM-001`

1. Ensanchar `@theme inline`.
2. Tokens de espacio, radio y sombra.
3. Un guardián de trinquete por token. **Corrección del 9-ago**: esta línea decía
   «empezar por `#3d5afe` (125 usos), es puro y no cambia un píxel», y las dos
   mitades eran falsas. De los 127 usos, la gran mayoría son **respaldos muertos**
   dentro de `var(--nexus, #3d5afe)` —el token siempre existe, el respaldo nunca
   se pinta—, así que sustituirlos no arregla nada; y donde el hex sí está suelto,
   cambiarlo por un token **sí** cambia píxeles, porque el tema claro declara otro
   valor. Lo que de verdad había detrás de ese hex era REG-291, y era un defecto
   de contraste, no de limpieza.
4. `axe` sobre las 9 pantallas del paciente. Objetivo WCAG 2.2 AA.
5. Los literales *slate* que no siguen al tema, en 10 archivos.
6. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
