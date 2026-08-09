# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001`, abierta el 9-ago-2026.
`DESIGN-THEME-001` **CERRADO** · `A11Y-GATE-001` abierto.
Antes: `PATIENT-UX-TRUTH-001` **cerrada** el 8-ago-2026.

El sistema, escrito: [`docs/design/NEXUS_DESIGN_SYSTEM.md`](../docs/design/NEXUS_DESIGN_SYSTEM.md).

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

## Hecho en `DESIGN-SYSTEM-001` (9-ago) — la mecánica, no el repintado

`@theme inline` pasó de **4 a 47** tokens, y nacieron las escaleras que
faltaban: `--sp-1..9` (**no había ninguna escala de espacio**), `--fs-1..9`
anclada en 13 px, `--r-xs..2xl` y `--elev-1..3`. Cada peldaño con la medición
que lo justifica escrita al lado.

Prefijo `nx-` en las utilidades nuevas, y no es cosmética: el código ya usa
`text-xs` (29), `text-sm` (24), `p-6`, `rounded-md` (8). Declarar `--text-sm`
aquí las habría reescrito **en silencio**, encogiendo pantallas que hoy están
bien sin que ninguna prueba lo notara.

**No se repintó nada, a propósito.** Colapsar 12,5 px en 13 px son 466 cambios
visuales por toda la aplicación, y §4 de la directiva prohíbe aprobar interfaz
leyendo el código.

Trinquete: `scripts/design/trinquete-de-diseno.mjs`, congelado en
`docs/design/design-techo.json`, corriendo dentro de `vitest`.

| Métrica congelada | Techo |
|---|---|
| Hexadecimales a mano | 1 199 usos · 141 distintos |
| Tamaños de letra en línea | 2 903 usos · 39 distintos |
| Radios en línea | 1 099 usos · 22 distintos |
| Espacio en línea | 1 246 usos · 33 distintos |
| `style={{` | 6 193 en 182 archivos |

## Una corrección a lo que decía este archivo

Decía que sustituir `#3d5afe` por su token «es puro y no cambia un píxel».
**Es falso en el tema claro**: `--nexus-solido` vale `#2845EA` ahí. Sustituir
sigue siendo lo correcto —el literal ignora el tema— pero es un cambio visual en
127 sitios y necesita navegador. Va en `DESIGN-LITERAL-001`.

## Compuertas nuevas: una de cuatro

| Compuerta | Estado |
|---|---|
| trinquete de tokens de diseño | **existe** (9-ago) |
| accesibilidad | **sin definir** — `A11Y-GATE-001` |
| regresión visual | **sin definir** |
| móvil / flujo en navegador | **sin definir** |

Hoy hay **1** prueba de accesibilidad entre 540, y es una expresión regular
sobre `layout.tsx`.

## Orden para lo que queda de `DESIGN-SYSTEM-001`

1. ~~Ensanchar `@theme inline`~~ ✅
2. ~~Tokens de espacio, radio y sombra~~ ✅
3. ~~Trinquete por token~~ ✅ (uno, con cuatro métricas)
4. `axe` sobre las 9 pantallas del paciente. Objetivo WCAG 2.2 AA.
5. Migrar `components/ui/` (12 primitivas, 24 % de adopción) a las utilidades
   `nx-`: es donde el cambio se multiplica sin repintar a mano.
6. Los literales *slate* que no siguen al tema, en 10 archivos.
7. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
