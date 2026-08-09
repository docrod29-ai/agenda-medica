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
| **SHA de cierre** | *(el commit de esta sesión)* |
| **Unidad cerrada** | **`DESIGN-SYSTEM-001` — el cimiento.** Queda abierta la adopción y `A11Y-GATE-001` |
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

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | 8 472 casos · **1 fallo preexistente y de entorno** (`ops-timeout-y-punto-ciego`: abre conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Idéntico al checkpoint anterior |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `trinquete-de-diseno` | **1 865**, igual que el techo |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 39.8s» + «Finished TypeScript in 55s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de
`DESIGN-SYSTEM-001` y correr `node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer el cimiento del sistema de diseño.** Está cerrado. Lo que queda
es adopción, y la adopción tiene dueño: `VISUAL-EXCELLENCE-001`.

**3. `A11Y-GATE-001`** (P1, dentro de esta misma iteración): `axe` sobre las 9
pantallas del paciente, objetivo WCAG 2.2 AA. Hoy hay **1** prueba de
accesibilidad entre 540 y es una expresión regular sobre `layout.tsx`. Ojo: sin
credenciales de Firebase, `axe` contra la app corriendo puede no ser posible en
este contenedor — mirar primero qué pantallas rinden sin sesión.

**4. Luego `NAVIGATION-001`**, empezando por `NAV-AGENDA-001` (Agenda → Consulta
→ atrás nunca vuelve a la Agenda).

**5. `DESIGN-COLOR-001`** (P2, nuevo en el backlog) tiene el trabajo medido y las
tres trampas escritas: `var()` **no funciona en atributos de presentación SVG**,
satori no resuelve variables, y `global-error` se activa cuando ni el layout ha
cargado.

**6. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en P0.**

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla** — tampoco en esta
sesión. Los dos cambios visibles (medio píxel en el texto de ayuda de un campo,
dos radios de esqueleto de carga) **no se han mirado en un navegador**, y la
directiva V9 §4 no aprueba interfaz leyendo código. El trinquete cuenta valores
fuera del sistema; no dice que ninguna pantalla esté bien.
