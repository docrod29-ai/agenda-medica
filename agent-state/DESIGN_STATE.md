# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `MASTER_STATE.json` y en `docs/design/SCREEN_INVENTORY.md` (generado).

**Iteración en curso**: `DESIGN-SYSTEM-001` · **parte 1 cerrada** el 9-ago-2026
(REG-291). `PATIENT-UX-TRUTH-001` cerrada el 8-ago.
**Siguiente**: `DESIGN-TIPOGRAFIA-001`, luego `A11Y-GATE-001`.

---

## Lo que se sabe hoy, y no se sabía ayer

**La premisa de la directiva no se cumple aquí.** No hay «cara de producto
generado por IA»: cero degradados, cero `from-purple`, una `rounded-2xl`, una
`shadow-2xl`, un `backdrop-blur`. Hay una identidad declarada, oscura por
defecto, con los cocientes de contraste WCAG calculados a mano y escritos en el
propio CSS.

**El defecto real es otro: el sistema existe y la aplicación no le obedece.**

| Medida | Al abrir V9 | Hoy |
|---|---|---|
| Tokens que Tailwind ve | **4** | **31** (color, radio) |
| `style={{` | 6 065 en 177 de 200 archivos (88,5 %) | igual — el barrido no ha empezado |
| Hexadecimales a mano | 1 205 (151 distintos) | igual, menos el azul de marca |
| `#3D5AFE` crudo en posición de color | **18 sin justificar** | **0** — el resto, en lista blanca razonada |
| Adopción de `components/ui/` | 48 de 200 (~24 %) | igual |

## La causa raíz, y qué se hizo con ella

`@theme inline` exponía **cuatro** valores. Todo lo demás vivía en variables CSS
que Tailwind no mira, así que **no había utilidades que usar** y el código no
tenía alternativa al estilo en línea. No era dejadez: era mecánica.

Ese bloque ahora expone las familias del sistema —superficies, texto, marca,
semántica clínica, radio—. Y **se comprobó del otro lado**, compilando Tailwind
contra una sonda que las usa: `.text-nexus { color: var(--nexus) }`, no el
hexadecimal congelado. La utilidad sigue leyendo la variable, así que sigue
cambiando con el tema.

### La trampa que casi entra con el arreglo

El primer intento declaró también `--spacing-4 … --spacing-24`. En Tailwind v4
`p-6` **no** sale de un mapa: es `calc(var(--spacing) * 6)` = 24 px. Declarar
`--spacing-6: 6px` no añade un token — sustituye ese cálculo, y los 3 `p-6` y 2
`px-6` del árbol habrían encogido de 24 px a 6 px **sin que fallara ninguna
prueba**, porque ninguna mira píxeles.

Se vio compilando, no razonando. Los `--sp-*` se quedan en `:root` para uso en
línea, y hay guardián que impide volver a declararlos en `@theme`.

## La prueba de que el enfoque funciona

`--r-pill`: la píldora estaba escrita de cinco formas (`100`, `999`, `9999`,
`99`, `50`); un token con su razón escrita tiene hoy **131 adopciones**.

Y ahora `--nexus`: 18 sitios reparados, con la medición hecha en la prueba y no
en un comentario. Las escalas nuevas (`--r-1…5`, `--sp-4…24`) se sacaron de los
**picos reales** del producto, no de una progresión bonita — una escala que no
describe al producto no se adopta, se ignora, y entonces son 20 valores en vez
de 19.

## Reparado en esta iteración

**REG-291 · el azul de marca escrito a mano.** El sistema había separado
`--nexus` (texto, 4,63–5,96 : 1) de `--nexus-solido` (relleno bajo blanco, 5,13),
y dieciocho sitios se saltaban la separación con `#3D5AFE` literal en posición de
texto o icono: **2,96–3,81 : 1 en oscuro, 4,25 en el chip del tema claro**.
Ninguno llega a 4,5. Y un hexadecimal a mano tampoco cambia con el tema.

**REG-266 (iteración anterior) · `@keyframes spin`** no existía en ningún sitio
global pese a 90 referencias, incluidos los dos primitivos compartidos.

## Compuertas nuevas

| Compuerta | Estado |
|---|---|
| contraste de token, **computado** desde `globals.css` | ✅ `el-azul-de-marca-no-se-escribe-a-mano` (sellada, 10 casos en línea) |
| trinquete de literal de color, con lista blanca razonada | ✅ misma prueba |
| `@theme` no puede volver a encogerse ni declarar `--spacing-N` | ✅ misma prueba |
| accesibilidad (axe, WCAG 2.2 AA) | ❌ sigue sin definirse — `A11Y-GATE-001` |
| regresión visual | ❌ sin definir |
| móvil · flujo en navegador | ❌ sin definir |

## Orden para lo que queda de `DESIGN-SYSTEM-001`

1. ~~Ensanchar `@theme inline`~~ ✅ REG-291.
2. ~~Tokens de radio~~ ✅ · espacio ✅ en `:root` · **sombra: no.** Son ~10 usos
   en línea y no justifican una escala; declararla invitaría a usarla, y la
   regla de diseño prohíbe el exceso de sombras.
3. ~~Un guardián de trinquete por token, empezando por el azul~~ ✅ REG-291.
4. **`DESIGN-TIPOGRAFIA-001`** — la escala existe como clases `.t-*` y no
   describe al producto: sus cuatro tamaños más usados (13 · 12,5 · 12 · 11) no
   están en ella. Mismo mecanismo que el color, en el eje del tamaño.
5. **`A11Y-GATE-001`** — `axe` sobre las 9 pantallas del paciente.
6. Los literales *slate* que no siguen al tema, en 10 archivos.
7. Las tablas, adoptando `.table-wrap.rwd` que ya existe.

## Lo que este estado NO afirma

**Nadie ha abierto una pantalla.** Todo son recuentos y cálculos sobre el
código: el contraste se computó con la fórmula de WCAG 2.1 sobre los valores que
declara el CSS, no se miró en un navegador. **Ninguna pantalla está aprobada**, y
la directiva V9 §4 dice que no se aprueba interfaz leyendo código.

Cumplir el contraste de un token tampoco es cumplir WCAG 2.2 AA: faltan foco,
orden de tabulación, etiquetas, objetivo táctil y todo lo demás.
