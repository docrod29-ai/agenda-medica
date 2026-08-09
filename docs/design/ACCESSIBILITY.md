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

## Línea base (TRUTH-001 salida 10) — levantada el 9-ago-2026

**Método**: axe-core 4.11.4 inyectado en las 7 pantallas del golden flow,
autenticado, datos sintéticos, build de producción, 1440 y 390
(`bash scripts/design/arnes-capturas-v10.sh axe`). Resultado completo:
`tests/accessibility/axe-baseline-v10.json`.

**Total: 71 nodos con fallo — 30 críticos, 41 serios. 5 reglas distintas.**

| Regla (impacto) | Dónde | Qué es |
|---|---|---|
| `button-name` (crítico) | **TODAS las pantallas** (1 botón recurrente — el FAB de luna/tema) + 3 en citas y calendario (iconos chat/lápiz/kebab) | Botones sin nombre accesible: un lector de pantalla anuncia «botón» y nada más |
| `label` (crítico) | consulta: **4 textareas clínicas** con `placeholder=""`; citas: `input[type="date"]` | Campos clínicos sin etiqueta programática — el dictado de la nota es invisible para tecnologías de apoyo |
| `color-contrast` (serio) | dashboard: `.prox-hero-cta` (el CTA **primario** «Iniciar consulta»); citas: «Registrar cobro»; calendario: ranuras | Texto bajo 4.5:1 — incluye el botón más importante del dashboard |
| `nested-interactive` (serio) | calendario: `role="button"` dentro de `role="button"` en las ranuras | El elemento interno no es alcanzable por teclado/lector |
| `target-size` (serio) | login: ojo de contraseña; calendario: ranuras | Objetivo táctil bajo el mínimo (WCAG 2.2) |

**Lecturas**: el fallo más repetido (FAB sin nombre) confirma el hallazgo del
revisor visual (V10-FABS-DOBLES). Lo más grave clínicamente son las textareas
de la consulta sin etiqueta. Lo más visible: el contraste del CTA primario.

**Lo que esta línea NO mide** (declarado, para señalar de menos): orden real
de tabulación, visibilidad del foco al navegar, trampas de foco en modales,
experiencia de lector de pantalla. Se mide a mano en `V10-A11Y-001`.

Los defectos están en `V10_BACKLOG.json` (`V10-A11Y-*`); la compuerta de CI
nace en `V10-A11Y-001` cuando los críticos estén en cero.
