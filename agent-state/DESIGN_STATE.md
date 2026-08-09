# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001`, **primer paso cerrado** el
9-ago-2026: los tokens, las tres escalas y el trinquete. Falta la parte de
accesibilidad (`A11Y-GATE-001`) y la adopción, que es bajar el techo.
**Anterior**: `PATIENT-UX-TRUTH-001` **cerrada** el 8-ago-2026.

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

## La causa raíz — REPARADA el 9-ago-2026

`@theme inline` exponía a Tailwind **cuatro** valores. Todo lo demás vivía en
variables CSS que Tailwind no ve, así que **no había utilidades que usar** y el
código no tenía alternativa al estilo en línea. No era dejadez: era mecánica.

Hoy expone **51**: color por papel (superficie, borde, texto 1/2/3, marca de
texto y marca de relleno, y las cinco semánticas clínicas), espacio, radio,
tipografía y sombra. Verificado con el CLI real de Tailwind: las clases salen.

**Y no rompe lo que ya había.** La escala de espacio se llama `p-e8`, `gap-e12`
—con `e`— porque `--spacing-4` habría cambiado en silencio los 57 usos que la
aplicación ya tiene de la escala numérica de Tailwind: `px-2` habría pasado de
8 px a 2 px. Lo mismo con el radio, que se nombra por PIEZA (`rounded-tarjeta`,
`rounded-control`) y no por talla, porque `rounded-xs`/`-lg`/`-xl` ya existen.

**No se empezó por colores** — lo prohíbe §13 de la directiva y además el color
no era el problema.

## El trinquete: la deuda ya no puede crecer

`node scripts/design/trinquete-de-diseno.mjs` mide, y
`docs/design/trinquete-de-diseno.json` congela el techo. Cada medida **sólo
puede bajar**; el guardián es
`src/__tests__/el-sistema-de-diseno-tiene-donde-agarrarse.test.ts` y corre con
toda la suite.

| Medida | Techo 9-ago |
|---|---|
| `style={{` | 6 191 en 180 de 208 archivos |
| Hexadecimales a mano | 1 096 (131 distintos) |
| `fontSize` en línea | 2 899 (39 valores) |
| `borderRadius` en línea | 1 238 (25 valores) |
| Azul de marca en minúscula | **0** (eran 98) |
| Tokens que Tailwind ve | **51** (esta sube, no baja) |

**Una pantalla nueva escrita con estilos en línea sube el número y pone la
prueba en rojo** — que es exactamente la condición de terminado que pide §1 de
la directiva para esta iteración.

Primer pago del trinquete: el azul de marca convivía en dos mayúsculas
(`#3D5AFE` y `#3d5afe`), lo que no cambia un píxel pero hace que una búsqueda
encuentre la mitad de los sitios. Normalizado a una sola forma: 98 → 0.

## Las tres escalas, y por qué se eligieron así

Están **pegadas a lo que el código ya usa**, no en contra:

- **Espacio** — hoy conviven todos los enteros del 1 al 14 px: 10 px (179 usos),
  8 (168), 9 (99), 4 (92), 12 (92), 7 (85)… Eso no es una escala, es un continuo,
  y un continuo no crea jerarquía porque dos separaciones que difieren en un
  píxel se leen igual. La escala va de dos en dos hasta 12 y de cuatro después:
  cada valor real cae en un token vecino y lo que desaparece es la diferencia
  que nadie percibe.
- **Tipografía** — 39 tamaños con medios píxeles (13 px con 538 usos, 12,5 con
  466, 12 con 424…). Medio píxel no es jerarquía: es indecisión escrita. Por eso
  los tokens se nombran por **papel** (`--t-cuerpo`, `--t-titulo`) y no por
  tamaño: mientras se llame `--t-12`, la siguiente pantalla se inventará un
  12,75 porque «se veía mejor».
- **Radio** — 25 valores, con 3, 4, 6, 7, 8, 9, 10, 11, 12, 14 y 16 px a la vez.
  Cinco pasos cubren el 90 % de lo que ya existe.

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

## Compuertas nuevas: una hecha, tres pendientes

| Compuerta | Estado |
|---|---|
| **Deuda de estilo (trinquete)** | ✅ 9-ago-2026 · script + techo + guardián en la suite |
| accesibilidad | ❌ `A11Y-GATE-001`. Sigue habiendo **1** prueba entre 540, y es una expresión regular sobre `layout.tsx` |
| regresión visual | ❌ sin definir |
| móvil / flujo en navegador | ❌ sin definir · exige credenciales de Firebase que este contenedor no tiene |

## Orden para `DESIGN-SYSTEM-001`

1. ✅ Ensanchar `@theme inline` — 4 → 51 tokens.
2. ✅ Tokens de espacio, radio, tipografía y sombra, con su razón escrita.
3. ✅ Trinquete con techo sellado. Primer pago: el azul de marca en dos
   mayúsculas, 98 → 0 (puro, no cambia un píxel).
4. `axe` sobre las 9 pantallas del paciente. Objetivo WCAG 2.2 AA.
5. Los literales *slate* que no siguen al tema, en 10 archivos.
6. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
