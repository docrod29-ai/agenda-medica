# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001`, **abierta** el 9-ago-2026.
`PATIENT-UX-TRUTH-001` cerrada el 8-ago-2026.

## Lo primero que salió al contar el azul (9-ago, v1163 · REG-289)

Se empezó por el paso 3 de la lista de abajo —el trinquete de `#3d5afe`, que se
suponía «puro y sin cambiar un píxel»— y **no era puro**: de los 131 usos, la
mayoría son `var(--nexus, #3d5afe)`, un respaldo muerto. Debajo había otra cosa.

**Catorce rellenos azules reprobaban WCAG AA**, once de ellos botones primarios
—«Iniciar consulta», «Crear mi consultorio», «Crear cuenta», enviar del chat,
los filtros de pacientes, los CTA de precios—, y **el guardián que existe justo
para eso llevaba dos versiones en verde**.

No falló el color: falló el **ámbito** del guardián. Comprobaba una línea a la
vez, y `background` y `color` viven en líneas distintas del mismo objeto. Y sólo
leía `.tsx`, así que `globals.css` —donde vive el sistema— no se miraba.

Lección para el resto de `DESIGN-SYSTEM-001`: **la unidad que hay que vigilar es
el ámbito que el navegador compone** (el objeto de estilo, la regla CSS), no el
renglón ni el archivo. Los guardianes de espacio, radio y tipografía que faltan
se escriben con ese ámbito desde el principio.

Y el guardián nuevo **mide** en vez de comparar cadenas: calcula el contraste en
los dos temas leyendo los tokens del propio `globals.css`. Ninguna cifra copiada
que se pueda desfasar (REG-241).

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

## Compuertas nuevas: la primera de accesibilidad, y sólo la primera

`el-relleno-y-su-texto-se-miden-juntos.test.ts` es la primera compuerta que
**calcula** un cociente de contraste en vez de comparar cadenas. Cubre una
familia de color —el azul de marca— y dos tipos de ámbito.

Lo que sigue sin existir: regresión visual, móvil y flujo en navegador. Y la
accesibilidad de verdad —contraste heredado, foco, orden de tabulación, nombres
accesibles— necesita `axe` sobre la aplicación corriendo (`A11Y-GATE-001`).

## Orden para `DESIGN-SYSTEM-001`

3. ~~Un guardián de trinquete por token, empezando por `#3d5afe`~~ — **hecho el
   9-ago (REG-289)**, y salió el defecto de contraste de arriba. Lo que queda de
   este paso: los otros tokens.
1. Ensanchar `@theme inline`. **Siguiente.**
2. Tokens de espacio, radio y sombra, cada uno con su guardián **de ámbito**
   (objeto de estilo o regla CSS), no de línea.
4. `axe` sobre las 9 pantallas del paciente. Objetivo WCAG 2.2 AA.
5. Los literales *slate* que no siguen al tema, en 10 archivos.
6. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
