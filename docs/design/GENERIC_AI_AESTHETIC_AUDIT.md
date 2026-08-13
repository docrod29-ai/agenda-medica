# Auditoría de «cara de producto generado por IA»

> **Unidad**: V9 · `PATIENT-UX-TRUTH-001` · 8-ago-2026
> **Método**: recuentos sobre `src/app` y `src/components` (200 archivos `.tsx`,
> 55 827 líneas) + lectura completa de `src/app/globals.css` (1 604 líneas).
> **Insumo de**: `DESIGN-SYSTEM-001` y `VISUAL-EXCELLENCE-001`.

---

## §0 — La premisa de la directiva **no se cumple aquí**, y hay que decirlo

La directiva V9 pide que la interfaz final no parezca «SaaS generado por Claude,
producto de IA con degradado morado al azar, tablero hecho todo de tarjetas
redondeadas, exceso de píldoras, exceso de sombras, cristal por todas partes».

Se buscó cada una de esas señales. **No están.**

> **CORRECCIÓN (13-ago-2026, RT-01 del equipo rojo de V15).** La tabla de
> abajo contaba **clases Tailwind** en un código que es 88,5 % estilo en
> línea (§1 de este mismo documento): sus ceros eran **artefactos del
> método**, no ausencia de la señal. Medido al nivel del **valor CSS** —
> viva donde viva: TSX en línea o `globals.css` — la foto real del 13-ago
> es: **16 `*-gradient(`**, **16 `backdrop-filter`**, **9 halos de color**
> (sombras `rgba` con croma) y 22 `boxShadow` literales. La señal sigue
> siendo BAJA para 200+ archivos (y ninguno de los degradados es el morado
> de plantilla: el último literal violeta murió con RT-01), pero ya no se
> mide con una vara que no puede ver. Desde hoy la mide el **trinquete**:
> `node scripts/design/trinquete-de-diseno.mjs` (contadores `gradientes`,
> `cristal`, `halosDeColor`, techo sellado sólo-baja en
> `scripts/design/techos-de-diseno.json`, guardián en
> `el-sistema-de-diseno-no-pierde-terreno.test.ts`). La tabla original se
> conserva como acta del error de método:

| Señal que la directiva teme | Cuántas hay *(clases Tailwind — MEDIDA ROTA, ver corrección)* |
|---|---|
| `bg-gradient-to-*` | **0** |
| `from-purple` / `from-indigo` / `from-violet` (cualquier `from-/via-/to-` de color) | **0** |
| `rounded-2xl` / `rounded-3xl` | **1 / 0** |
| `shadow-lg` / `shadow-xl` / `shadow-2xl` | **0 / 0 / 1** |
| `backdrop-blur-*` (utilidad) | **1** |
| Sombras en línea, distintas | 28 usos, 24 valores |

Lo que hay es una identidad **declarada, deliberada y medida**:
`docs/DESIGN_SYSTEM.md` la llama «técnico-precisa», `globals.css` la implementa
oscura por defecto con el claro como opción, y los comentarios del archivo llevan
**los cocientes de contraste WCAG calculados a mano** con la fórmula de
luminancia relativa (`globals.css:64-88`, `:1018-1023`), incluyendo los cuatro
tokens que reprobaban AA y con cuánto pasaron. Los cuatro usos de cristal están
acotados y documentados (`:1104-1122`). Eso está por encima de la media del
sector, no por debajo.

**Conclusión: no hay que rediseñar la identidad. Hay que hacerla cumplir.**

## §1 — El hallazgo de verdad: el sistema existe y la aplicación lo esquiva

**6 065 usos de `style={{` repartidos en 177 de 200 archivos — el 88,5 %.**
Contra 816 usos de `className`.

Y la causa raíz es una sola línea de configuración: el bloque `@theme inline` de
`globals.css:126-131` expone a Tailwind **cuatro** cosas
(`--color-background`, `--color-foreground`, `--font-sans`, `--font-mono`).
Todo lo demás —el color, la superficie, el borde, el radio, la tipografía— vive
en variables CSS que **Tailwind no ve**. Así que no hay utilidad que usar, y el
código cae al estilo en línea. No es dejadez: es la consecuencia mecánica de una
decisión de configuración.

### Lo que la deriva ha producido, con números

| Dimensión | Lo que declara el sistema | Lo que hay de verdad |
|---|---|---|
| **Tipografía** | escala de 6 pasos (`.t-display` 28 → `.t-overline` 10,5) | **~3 000** `fontSize` en línea, **~60 valores** distintos, con medios píxeles. Los cuatro más usados —13 (474), 12,5 (436), 12 (388), 11 (279)— **no están en la escala** |
| **Color** | tokens con contraste medido | **1 205** literales hexadecimales, **151 distintos**. `#3d5afe` aparece 98 veces y `#3D5AFE` otras 27: es `--nexus-solido` retecleado a mano, en dos mayúsculas distintas |
| **Radio** | «radios fijos: 6 / 10 / 14 px» (`globals.css:205`) | **~19 valores** en línea. 3, 5, 7, 9, 11 y 20 son pura deriva |
| **Espacio** | *no hay tokens de espacio* | **23** valores de `gap`, **25** de `padding`. `gap: 6` (288) y `gap: 10` (241) juntos superan al `gap: 8` (452) |
| **Sombra** | *no hay tokens de sombra* | 28 usos, **24 valores distintos** — casi cada sombra es única |
| **Primitivos** | existen 13 en `src/components/ui/` | los usan **48 de 200** archivos (**~24 %**) |

### La adopción de primitivos, en detalle

Existen y están bien escritos: `Alert, Badge, Button, Card, EmptyState, Field,
Modal, PageHeader, Skeleton, Spinner, Table, Tabs`, con barril en
`src/components/ui/index.ts`.

| Primitivo | Se importa | Hecho a mano | Adopción |
|---|---|---|---|
| Button | 26 | **565** `<button>` crudos en 124 archivos (281 con estilo en línea) | ~4 % |
| Input | 8 | **275** `<input>` crudos | ~3 % |
| Badge | 1 | 131 píldoras hechas a mano | ~1 % |
| Table | 1 | 15 `<table>` crudos | ~7 % |
| EmptyState | 12 | 76 bloques «No hay…» escritos a mano | ~14 % |
| Modal | 14 | 13 superposiciones `position:fixed` a mano | ~52 % |

### El contraejemplo que demuestra que el enfoque funciona

`--r-pill`. La píldora estaba escrita de cinco formas (`100`, `999`, `9999`,
`99`, `50`) — el comentario de `globals.css:90-105` lo cuenta. Se creó **un**
token, y hoy tiene **131 adopciones** y la inconsistencia está resuelta.

Un token, bien nombrado y con su razón escrita, sí se adopta aquí. La receta ya
está probada; falta repetirla para espacio, radio, tipografía y color, **cada uno
con su guardián detrás**.

## §2 — Defecto encontrado y **reparado** en esta unidad

**`@keyframes spin` no estaba definido en ningún sitio global.** Se referencia
90 veces, incluidas las dos piezas compartidas —`ui/Spinner.tsx` (27 usos) y el
estado `loading` de `ui/Button.tsx` (58 usos)—. Lo definían, cada uno por su
cuenta, **31 archivos de pantalla** en etiquetas `<style>` locales; y como una
`<style>` renderizada es global al documento, el giro funcionaba mientras alguna
de esas 31 estuviera montada, y se congelaba en cuanto no.

Un indicador de carga parado no dice «esperando»: dice «se colgó». El médico
vuelve a pulsar «Procesar con IA» sobre una petición que sí estaba corriendo.

**Reparado**: el fotograma vive en `globals.css`, con su explicación. **Sellado**:
`src/__tests__/toda-animacion-tiene-su-fotograma.test.ts` exige que un archivo
que referencia una animación la defina él o la encuentre en `globals.css`, y es
más estricto con `components/ui/` — un primitivo compartido no puede depender de
que otra pantalla esté montada. Probado al revés: quitando el fotograma, las tres
pruebas caen.

## §3 — Accesibilidad

**Lo que está bien, y es notable:**

- Anillo de foco global en `:focus-visible` (`globals.css:175-179`) más anillos
  refinados para `.input` y `.btn` (`:1159-1170`).
- Objetivos táctiles forzados a ≥44 px bajo `@media (pointer: coarse)`
  (`:771-791`), con el `!important` explicado (había que vencer al
  `minHeight: 30` en línea).
- Contraste **medido y documentado**, con los valores antes y después.
- `--text3` se subió de ≈3,8:1 a ≈5:1 y se usa **1 263 veces**: mucha palanca.

**Lo que no:**

| Sev | Hallazgo | Evidencia |
|---|---|---|
| **P0** | **No hay red de seguridad automática.** De **540** archivos de prueba, **uno** es de accesibilidad (`a11y-zoom-guard.test.ts`) y es una expresión regular sobre `layout.tsx`. Ni `axe-core`, ni `jest-axe`, ni `@axe-core/playwright` en `package.json` | nada detecta hoy un `aria-label` que falta ni una regresión de contraste |
| P1 | **41 botones sólo-icono, y sólo 4 con `aria-label`** (es un suelo, no un techo: la búsqueda sólo cazaba hijos autocerrados) | p. ej. `receta/[patientId]/[notaId]/page.tsx:924-929`, con `title="Quitar"` y un `<Trash2/>` pelado |
| P1 | `aria-live` **1**, `aria-labelledby` **1**, `aria-busy` **1** en toda la aplicación | un lector de pantalla no se entera de casi ningún cambio dinámico |
| P1 | **Nada obliga a nada.** `eslint.config.mjs` son 18 líneas: `next/core-web-vitals` + `next/typescript`. Sin `jsx-a11y`, sin regla contra hexadecimales ni estilo en línea | `docs/DESIGN_SYSTEM.md:7` dice «si el código contradice esto, el documento gana» — y no hay máquina que lo sostenga |
| P2 | ~4 de 31 `<img>` sin `alt`; **0** usos de `next/image` | |
| P2 | Los 1 205 hexadecimales **nunca se midieron**. Los tokens sí | el riesgo de contraste residual vive ahí |

## §4 — Adaptable a móvil

Las utilidades `sm:`/`md:`/`lg:` casi no se usan (**2** en todo el repositorio),
pero eso no es el defecto: la adaptación vive en `globals.css` y es más seria de
lo que sugiere ese número — puntos de corte en 360/380/460/480/560/640/768/900/
1025 px, `safe-area` para muesca e indicador (`:793-803`, `:914-920`), respaldo de
`100dvh`, un desbordamiento de iPhone 390 px arreglado y documentado (`:263-283`),
16 px forzados en campos de móvil para que iOS no haga zoom (`:806-809`), y una
regla `.table-wrap.rwd` que convierte tablas en tarjetas apiladas por debajo de
640 px (`:1557-1589`). Sólo **1** archivo usa `matchMedia` y **0** usan
`innerWidth`: la adaptación la hace CSS, que es lo correcto.

**P1 — las tablas son el riesgo real a 375 px.** La solución existe (`.rwd`) y
casi nadie la usa. Nueve tablas fijan un `minWidth` de 520 a 720 px
(`superadmin/onboarding:129` 720; `superadmin/simulador:141`,
`superadmin/contabilidad:226`, `superadmin/csp:132`, `superadmin/costos:486` 620;
`TablaNivelesIA.tsx:18`, `seguridad:105` 560; `superadmin/planes:152`,
`superadmin/costos:438` 520). Tres no tienen ni envoltorio ni `minWidth` y
simplemente se desbordan: `superadmin/page.tsx:202`,
`PanelComisiones.tsx:129`, `hospitalizacion/[internamientoId]/page.tsx:821`.

Atenuante real: `minWidth: 0` aparece **59** veces, que es la guarda correcta de
desbordamiento en *flexbox*. Alguien ha estado arreglando esto a conciencia.

## §5 — Dónde empezar el barrido

**Cinco archivos son el 24 % de todo el TSX** (13 395 de 55 827 líneas):

| Archivo | Líneas | `style={{` |
|---|---|---|
| `(dashboard)/consulta/[patientId]/page.tsx` | 5 778 | 225 |
| `(dashboard)/configuracion/page.tsx` | 2 605 | **351** |
| `(dashboard)/uci/page.tsx` | 1 884 | 224 |
| `(dashboard)/hospitalizacion/[internamientoId]/page.tsx` | 1 700 | 230 |
| `(dashboard)/configuracion/secciones-recetas.tsx` | 1 428 | 122 |

Dos de los cinco son **alpha** (UCI, hospitalización) y no entran al tanteo de
Practice. Los otros tres sí, y `consulta` es la pantalla donde el médico vive.

## §6 — Lo que `DESIGN-SYSTEM-001` tiene que hacer, en orden

1. **Ensanchar `@theme inline`** para que Tailwind vea los tokens. Es la causa
   raíz del monolito de estilo en línea; sin esto, todo lo demás es cosmética.
2. **Añadir los tokens que faltan**: espacio, radio y sombra. Existe la prueba de
   que aquí un token bien puesto se adopta (`--r-pill`, 131 usos).
3. **Un guardián por token**, con techo de trinquete que sólo baja — el patrón
   que ya funciona en `lint-trinquete.mjs`. Empezando por el hexadecimal
   retecleado (`#3d5afe`, 125 usos en dos mayúsculas), que es puro y no cambia
   ni un píxel.
4. **Compuerta de accesibilidad**: `axe` sobre las pantallas de la superficie del
   paciente primero, que es lo que V9 gobierna. Objetivo WCAG 2.2 AA.
5. **Los literales *slate* que no siguen al tema** (`#0f172a`, `#64748b`,
   `#334155`, `#e5e7eb`, `#f8fafc`) en 10 archivos: es la reaparición del defecto
   ya documentado en `globals.css:25-30`, donde una página con `var(--panel)`
   caía al respaldo claro y pintaba tarjetas blancas sobre lienzo oscuro.
6. **Las tablas**, adoptando `.table-wrap.rwd` que ya existe.

## §7 — Qué **NO** cubre esta auditoría

- **No se ejecutó la aplicación ni se miró una sola pantalla.** Todo son
  recuentos sobre el código. La directiva V9 §4 prohíbe aprobar interfaz así, y
  esta auditoría **no aprueba** ninguna: prioriza el barrido.
- **No se pudo contar «cuántas pantallas son una rejilla de tarjetas»**: la
  maquetación es en línea y no hay firma de clase que buscar.
- **Los 41 botones sólo-icono son un suelo.** La búsqueda sólo cazaba hijos
  autocerrados de un icono.
- **Los cocientes de contraste reales de los 1 205 hexadecimales no se
  calcularon.** Sólo se sabe que los tokens sí se midieron y ellos no.
- **La sospecha del fotograma `spin` se confirmó de forma estática**, no
  observando la aplicación: `@keyframes spin` no aparece en ningún CSS global y
  `animate-spin` se usa cero veces, así que Tailwind v4 no lo emite. La
  reparación es correcta de todos modos —definir un fotograma que se referencia
  90 veces no puede empeorar nada— pero **la observación en navegador sigue
  pendiente** y está en el backlog.
