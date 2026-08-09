# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-5njokt` (nace de `main` = `0144257`) |
| **SHA base de esta sesión** | `0144257` (merge del PR #271, v1163) |
| **SHA de cierre** | `cd238f4` (`DESIGN-SYSTEM-001`) · `3125a98` (`A11Y-GATE-001`) |
| **Unidad cerrada** | **`DESIGN-SYSTEM-001` — el cimiento** · **`A11Y-GATE-001` — parcial**: las dos compuertas que se pueden ejecutar sin navegador |
| **Siguiente unidad** | ver «Qué hacer al reanudar» |

### Qué quedó hecho

**1. `@theme inline` pasa de 4 tokens a 30** (`src/app/globals.css`). Era la
causa raíz de `DESIGN-THEME-001`: sin utilidades que ofrecer, el `style={{ … }}`
no era dejadez, era la única forma de escribir un color. Ahora hay `bg-nx-s2`,
`text-nx-caption`, `rounded-nx-card`, `shadow-nx-modal`… todos inlineados con
`var(--…)` **para que sigan al tema** en vez de congelarse en oscuro.

**2. Las escalas pasan de prosa a token.** `docs/DESIGN_SYSTEM.md` las declaraba
desde junio y no existían en el CSS: espacio (`--sp-1`…`--sp-7`), radio
(`--r-control/card/modal`), elevación (`--sh-overlay`, `--sh-modal`) y la escala
tipográfica, que **pasa de 6 pasos a 8**. De los cuatro tamaños más usados de la
aplicación —13 (538), 12,5 (466), 12 (424), 11 (295)— **dos no estaban en la
escala declarada**: una escala que la aplicación no usa es un deseo, no una
escala. Se absorben 13 y 11; se rechazan los medios píxeles.

**3. El trinquete de diseño**: `scripts/design/trinquete-de-diseno.mjs` +
`el-diseno-tiene-trinquete.test.ts`, techo **1 865** en
`docs/design/diseno-techo.json`. Tres reglas: no subir, bajar el techo al
limpiar, y **un archivo NUEVO con deuda falla siempre** — que es la compuerta que
pide la directiva V9 («falla si una pantalla nueva no los usa») y que ningún
techo global puede dar.

No duplica a los dos guardianes que ya existían, y lo dice por escrito: el color
es de `color-trinquete` (con sus excepciones razonadas: el papel que se
rasteriza, las paletas categóricas) y la variedad es de `escala-visual-trinquete`.
Éste aporta la cuenta **por archivo**.

**4. REG-291 — el guardián que penalizaba adoptar el sistema.**
`escala-visual-trinquete` contaba `var(--r-card)` como un valor más de variedad,
igual que un `borderRadius: 17` inventado. Al declarar el segundo y tercer token
de radio, **la prueba se puso roja por hacer lo correcto**. No se había visto
antes porque hasta ese día sólo existía `--r-pill` y el error costaba +1. Techo
de radios 24 → **23**, sin migrar una sola pantalla.

**5. Primera vuelta de tuerca en los primitivos** (1 869 → 1 865): `Field` subía
el mensaje de error bajo un campo —el de la dosis incluido— de 11,5 px a
`--fs-caption`; y `Skeleton` tenía `r` tipado como `number`, así que **el propio
componente obligaba a escribir `999`** para pedir una píldora.

**6. `A11Y-GATE-001` — de 1 prueba de accesibilidad entre 540, a dos compuertas.**

**REG-292 · el tema claro reprobaba AA, y el CSS decía que no.** Sobre `--s3` —la
superficie activa, que es la peor y no la que se suele medir— `--text3` daba
**4,20** y `--amber` **4,17**, con el comentario del propio CSS afirmando que
cumplían. Y `--amber` fallaba **por los dos lados**: también se usa de relleno
bajo texto casi negro (la franja de «sin conexión», dos botones de la consulta) y
ahí daba 4,18. Es el defecto de `--nexus`/`--nexus-solido` **repetido en otro
color**: la lección se había aplicado al caso, no a la familia. Nace
`--amber-solido`.

La aritmética deja de estar escrita a mano: `src/lib/design/contraste.ts` la
ejecuta en cada CI, en los dos temas, componiendo el alfa de las insignias —que
sin componer se mediría como si el tinte fuera opaco— y comprobando que el tema
claro manual y el automático no se separen.

**REG-293 · doce botones de sólo icono sin nombre accesible**, entre ellos dos que
borran y **las cinco estrellas de la reseña del paciente**. Los doce reparados:
techo **CERO**, no un trinquete que baja.

El medidor se rehízo dos veces, y las dos por la misma razón: con `grep` daba 65
con 40 falsos, y su primera versión con AST señalaba los elementos que usan
`activable()` —el ayudante que este repositorio escribió para hacerlo bien—. Otra
vez el medidor castigando la mejora, horas después de REG-291.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 472 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Idéntico al checkpoint anterior |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `trinquete-de-diseno` | **1 865**, igual que el techo |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 39.8s» + «Finished TypeScript in 55s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| `trinquete-de-accesibilidad` | **0**, igual que el techo |
| contraste WCAG (motor) | **verde** en los dos temas, sobre la peor superficie |
| navegador / móvil / `axe` | **no ejecutadas** — sin credenciales de Firebase |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de
`DESIGN-SYSTEM-001` y correr `node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer el cimiento del sistema de diseño.** Está cerrado. Lo que queda
es adopción, y la adopción tiene dueño: `VISUAL-EXCELLENCE-001`.

**3. `NAVIGATION-001`**, empezando por `NAV-AGENDA-001` (Agenda → Consulta →
atrás nunca vuelve a la Agenda). Es la siguiente unidad del §1 de la directiva.

**4. `A11Y-AXE-001`** queda abierto y **bloqueado por el entorno**, no por el
código: `axe` sobre las nueve pantallas del paciente exige levantar el producto,
y este contenedor no tiene las variables de Firebase. `@playwright/test` ya es
dependencia; falta `@axe-core/playwright`.

**5. `DESIGN-COLOR-001`** (P2, nuevo en el backlog) tiene el trabajo medido y las
tres trampas escritas: `var()` **no funciona en atributos de presentación SVG**,
satori no resuelve variables, y `global-error` se activa cuando ni el layout ha
cargado.

**6. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en P0.**

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla** — tampoco en esta
sesión. Sin mirar quedan: medio píxel en el texto de ayuda de un campo, dos
radios de esqueleto de carga, y sobre todo **los tres tokens de color que
cambiaron en el tema claro** (`--text3`, `--amber`, el nuevo `--amber-solido`).
Están medidos y son estrictamente más legibles, pero medido no es visto, y la
directiva V9 §4 no aprueba interfaz leyendo código.

Y las compuertas nuevas **no son `axe`**: miden pares de tokens y parsean JSX. No
ven el árbol de accesibilidad renderizado, ni el orden de foco real, ni el tamaño
del objetivo táctil. Un control cuyo nombre venga de una variable **no se
vigila** — que significa eso exactamente, no que esté bien.
