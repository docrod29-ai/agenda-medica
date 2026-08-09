# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001`, abierta el 9-ago-2026.
`PATIENT-UX-TRUTH-001` cerrada el 8-ago. Dentro de la iteración en curso,
`DESIGN-THEME-001` **cerrado** (REG-291) y `A11Y-GATE-001` **cerrado**
(REG-292); quedan los literales *slate*, las tablas y `A11Y-AXE-001` — lo que
sólo se ve con la aplicación corriendo.

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

## Cerrado el 9-ago (2): la red de accesibilidad que no existía (REG-292)

De **568 archivos de prueba, uno** era de accesibilidad, y era una expresión
regular sobre `layout.tsx`. Ya no.

**La etiqueta que se ve no era la etiqueta que se oye.** En las pantallas donde
el paciente escribe, el `<label>` se pintaba encima del campo y no lo señalaba.
A la vista, un formulario etiquetado; para un lector de pantalla, «cuadro de
edición» en blanco. Nueve controles, incluidos los cinco del formulario **ARCO**
—un derecho con plazo legal— y las cinco estrellas de `/resena`, que eran cinco
botones mudos: la única acción de esa pantalla era imposible sin ver.

| Compuerta | Dónde | Qué exige |
|---|---|---|
| nombre accesible | superficie del paciente (9 rutas) | **cero** hallazgos |
| nombre accesible | resto de la aplicación | trinquete de 312, sólo baja |

El instrumento (`scripts/a11y/nombres-accesibles.mjs`, también `npm run a11y`)
usa el parseador de TypeScript, no expresiones regulares: con `grep` fallaba en
**las dos direcciones** sobre estas mismas nueve pantallas — escondía el botón
mudo y marcaba cinco que sí tienen texto. Un instrumento que se equivoca en las
dos direcciones no mide: opina.

Y sigue la etiqueta **a través de una frontera de componente** (`FormField`,
`Field`, `Campo`), que es el patrón de esta base de código. Verificar las dos
puntas es lo que manda `el-dato-tiene-que-LLEGAR`.

## Cerrado el 9-ago (1): los tokens existen y hay quien los exija (REG-291)

**La causa raíz está reparada.** `@theme inline` exponía cuatro cosas y ahora
expone 20 colores, 5 radios, 7 espacios, 2 sombras y 6 tamaños de tipo. La
utilidad **existe**; que se adopte es `VISUAL-EXCELLENCE-001`.

Y aparecieron tokens que se usaban **sin estar declarados en ninguna parte**.
CSS no avisa de eso: la declaración se descarta y el color elegido a propósito
no está. Los dos que muerden:

- **`/configuracion`** — el contador «Fallidos» de mensajes al paciente se
  pintaba `var(--danger)`, que no existe. **Nunca se ponía rojo.**
- **`/pacientes`** — el aviso de posible duplicado se pintaba con el respaldo,
  y el respaldo era crema de tema claro. El único panel crema de una aplicación
  oscura, en el aviso que defiende el invariante nº1.

| Lo que se declaró | Fuente |
|---|---|
| `--r-control/--r-card/--r-modal` (6/10/14) | `docs/DESIGN_SYSTEM.md` §4, que ya lo decía en prosa |
| `--sp-*` (2, 4, 8, 12, 16, 24, 32) | §4: «múltiplos de 4» |
| `--sombra-menu`, `--sombra-modal` | §4: «sombra SÓLO en overlays» |
| `--fs-*` (6 pasos) | §3, sacados de dentro de las clases `.t-*` |
| `--warn-bg/-text/-border`, en los dos temas | derivados de las insignias ámbar ya medidas |

**La compuerta**: `un-token-que-no-existe-no-se-calla.test.ts`. Las cuatro
primeras pruebas cuentan sobre el código; la última **compila `globals.css` con
Tailwind** y exige que la utilidad se emita y valga `var(--token)` y no el
hexadecimal — porque una utilidad con el valor congelado compila igual y deja
media aplicación clavada en oscuro. Probada al revés cuatro veces.

## Reparado en la iteración anterior

**REG-266 · `@keyframes spin`** no existía en ningún sitio global, y lo
referencian 90 sitios incluidos `ui/Spinner` y `ui/Button loading`. Lo definían
31 pantallas en `<style>` locales, así que el giro funcionaba «según en qué
pantalla estuvieras». Reparado y sellado con
`toda-animacion-tiene-su-fotograma.test.ts`.

## Compuertas nuevas

| Compuerta | Estado |
|---|---|
| **tokens** | **hecha** (REG-291) — compila el CSS y exige `var(--token)` |
| **accesibilidad · nombre accesible** | **hecha** (REG-292) — cero en el paciente, trinquete en el resto |
| accesibilidad · contraste, foco, `aria-live` | **falta** — `A11Y-AXE-001`, necesita navegador |
| regresión visual | **falta** |
| móvil | **falta** |
| flujo en navegador | **falta** — bloqueada por credenciales de Firebase |

## Orden para `DESIGN-SYSTEM-001`

1. ~~Ensanchar `@theme inline`.~~ **Hecho** (REG-291).
2. ~~Tokens de espacio, radio y sombra.~~ **Hecho** (REG-291), más los de
   tipografía, que estaban dentro de las clases.
3. ~~Red de accesibilidad.~~ **Hecha** en su mitad estática (REG-292). La otra
   mitad —contraste, foco, `aria-live`— es `A11Y-AXE-001` y **necesita
   navegador**: mismo bloqueo que `NAV-NAVEGADOR-001`.
4. **Siguiente sin bloqueo**: los literales *slate* que no siguen al tema, en 10
   archivos. `/privacidad` es el caso de libro — pinta `#374151` y `#d1d5db` a
   mano, y es una pantalla del paciente.
5. Las tablas, adoptando `.table-wrap.rwd` que ya existe.
6. Los 281 respaldos rancios (`DESIGN-RESPALDOS-001`): sustitución pura, sin
   cambio de píxel, que quita ~30 % de los hexadecimales y deja a la vista los
   que sí son deriva.

### Lo que el trinquete de literales **todavía no** es

Se planeó «un guardián de trinquete por token, empezando por `#3d5afe`». Al ir a
escribirlo se vio que **82 de los 127 `#3d5afe` son respaldos**
(`var(--nexus, #3d5afe)`), no tokens reteclados: contarlos como deuda de color
mide otra cosa. El trinquete se escribe después de `DESIGN-RESPALDOS-001`, sobre
los hexadecimales que queden — que son los que de verdad no tienen contraste
medido.

## Lo que este estado NO afirma

Nadie ha abierto una pantalla. Todo son recuentos sobre el código. **Ninguna
pantalla está aprobada**, y la directiva V9 §4 dice que no se aprueba interfaz
leyendo código.
