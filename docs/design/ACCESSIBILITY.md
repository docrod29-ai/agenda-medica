# Accesibilidad — V10

> Ley: V10 §27 + `.claude/rules/design-system.md` (WCAG 2.2 AA o mejor).
> Los fallos críticos de accesibilidad que impiden uso seguro **bloquean
> release** (V10 §27). Endurecimiento a fondo en `V10-A11Y-001` (iteración 18).

## Mínimos que fallan la compuerta (ya vigentes en el repo)

- Control interactivo que no es `<button>`.
- Campo sin etiqueta.
- Modal que no atrapa el foco o no cierra con Escape.
- Foco invisible.
- Contraste < 4.5:1 en texto normal.
- Objetivo táctil < 44×44.

`docs/DESIGN_SYSTEM.md` documenta cocientes de contraste calculados a mano en
el propio CSS — esa práctica se conserva.

## Línea base (TRUTH-001 salida 10) — **9-ago-2026, medida**

Con la app **servida** (build de producción, emuladores, datos sintéticos) y
axe-core 4.11 sobre cada pantalla del golden flow en escritorio. El JSON crudo
vive junto a las capturas: `docs/design/capturas/v10-truth/axe-baseline.json`.
Se regenera con `scripts/design/capturar-golden-flow.mjs`.

| Pantalla | Violaciones WCAG 2.x AA (axe) |
|---|---|
| `/dashboard` | **0** — tras REG-308 (el CTA del héroe usaba el azul de texto como relleno: 2.9:1) |
| `/citas` | `button-name` ×2 (botones de icono sin nombre) · `color-contrast` ×7 · `label` ×1 (input de fecha) |
| `/calendario` | `button-name` ×2 · `nested-interactive` ×5 (huecos `div[role=button]` con botones dentro) · `target-size` ×1 |
| `/pacientes` | `nested-interactive` ×5 (fila entera `div[role=button]` conteniendo botones) |
| `/expediente/[id]` | **0** |
| `/consulta/[id]` | `label` ×4 — **las textareas de la nota clínica no tienen nombre programático** (crítico: es el campo de trabajo principal) |
| `/pendientes` | **0** |

**Lectura.** Los ceros demuestran que el patrón base del producto es sano; las
violaciones se concentran en dos familias reparables de una vez: (1) botones de
icono sin `aria-label` y campos sin etiqueta — la compuerta de arriba ya los
prohíbe, pero no se estaba midiendo sobre la app servida (familia `sin_medir`);
(2) filas/huecos clicables hechos con `div[role=button]` que anidan botones
reales — el mínimo «control interactivo que no es `<button>`» de esta misma
página. Ambas están en `V10_BACKLOG.json` (`V10-A11Y-001`, P1).

**Qué NO cubre esta línea base todavía**: teclado (orden y foco visible),
lector de pantalla, `prefers-reduced-motion`, zoom 200 %, y las pantallas fuera
del golden flow. Se amplía en `V10-A11Y-001`.
