# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001` — **cimiento cerrado** el 9-ago-2026
(tokens, escalas, trinquete). Abierta la adopción y la compuerta de
accesibilidad. `PATIENT-UX-TRUTH-001` cerrada el 8-ago-2026.
**Siguiente**: `A11Y-GATE-001` dentro de esta misma iteración, y luego
`NAVIGATION-001`.

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
| Tokens que Tailwind ve | **4** el 8-ago → **30** el 9-ago (`DESIGN-THEME-001`) |

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

## Compuertas nuevas: la primera ya existe

**Trinquete de diseño** — `node scripts/design/trinquete-de-diseno.mjs`, sellado
por `el-diseno-tiene-trinquete.test.ts`. Cuenta los valores fuera del sistema en
`src/app/` y `src/components/` y aplica tres reglas:

| Regla | Por qué |
|---|---|
| Más deuda que el techo → falla | Lo de siempre |
| Menos → falla, pidiendo bajar el techo | Un trinquete que no se aprieta es un tope |
| **Archivo NUEVO con deuda → falla siempre** | Es la cláusula que pide la directiva V9 con todas las letras |

La tercera no la necesita el trinquete de lint y aquí sí: 1 865 es un número
grande, y un archivo nuevo con doce tamaños inventados cabría dentro del margen de
cualquier limpieza en curso sin que nadie se enterara.

Accesibilidad, regresión visual, móvil y flujo en navegador **siguen sin
definirse** (`A11Y-GATE-001`). Hoy hay **1** prueba de accesibilidad entre 540, y
es una expresión regular sobre `layout.tsx`.

## `DESIGN-SYSTEM-001` — cerrado el cimiento, abierta la adopción

Hecho el 9-ago-2026:

1. ✅ **`@theme inline` pasa de 4 valores a 30.** Color, radio, tipografía y
   elevación, con prefijo `nx-` y inlineados con `var(--…)` para que las
   utilidades **sigan al tema** en vez de congelarse en oscuro. Hay prueba que
   falla si alguien mete un hexadecimal dentro del bloque.
2. ✅ **Tokens de espacio (`--sp-1`…`--sp-7`), radio (`--r-control/card/modal`) y
   elevación (`--sh-overlay`, `--sh-modal`).** Ninguno inventa un valor: son los
   que `docs/DESIGN_SYSTEM.md` declaraba en prosa desde junio y los que la
   aplicación ya pinta. Un valor que sólo vive en un documento no lo puede usar
   nadie: hay que acordarse de él.
3. ✅ **La escala tipográfica pasa de 6 pasos a 8.** La declarada no era la
   usada: de los cuatro tamaños más frecuentes —13 (538 usos), 12,5 (466), 12
   (424), 11 (295)— **dos no estaban en la escala**. Se absorben los dos pasos
   enteros que faltaban y se **rechazan los medios píxeles**, que no los decidió
   nadie y no sobreviven al redondeo con el zoom del sistema al 110 %.
4. ✅ **El trinquete**, con su techo en `docs/design/diseno-techo.json`.
5. ✅ **Primera vuelta de tuerca: 1 869 → 1 865**, en los primitivos compartidos,
   que son la implementación de referencia. `Field` subía el mensaje de error
   bajo un campo —el de la dosis incluido— de 11,5 a `--fs-caption`; `Skeleton`
   tenía el tipo de `r` como `number`, así que **el propio componente obligaba a
   escribir `999`** para pedir una píldora: la píldora de cinco formas reabierta
   por un tipo de TypeScript.

Pendiente, en el backlog y con su ficha:

- `DESIGN-COLOR-001` (P2) — los 127 `#3D5AFE` ciegos al tema. Se midió y **no se
  barrió**: cambia píxeles en tema claro y hay tres contextos donde `var()` no
  vale (SVG por atributo, satori, `global-error`). Con lo aprendido escrito.
- `A11Y-GATE-001` (P1) — `axe` sobre las 9 pantallas del paciente.
- Los literales *slate* que no siguen al tema, en 10 archivos.
- Las tablas, adoptando `.table-wrap.rwd` que ya existe (`DESIGN-TABLAS-001`).

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
