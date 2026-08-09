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

## Línea base (TRUTH-001 salida 10) — **tomada el 9-ago-2026**

axe-core (WCAG 2.x A/AA + 2.2 AA) sobre las 9 pantallas del golden flow,
escritorio (1440×900) y móvil (390×844), sesión autenticada con datos
sintéticos. Detalle: `docs/design/capturas/axe-linea-base.json`. Repetible con
`tests/accessibility/linea-base-axe.mjs` (arnés en `tests/visual/README.md`).

| Regla | Impacto | Nodos | Dónde |
|---|---|---|---|
| `button-name` — botones sin nombre accesible | **crítico** | 8 | calendario, citas |
| `label` — campos sin etiqueta (incluye `input[type=date]`) | **crítico** | 10 | citas, consulta |
| `color-contrast` < 4.5:1 | serio | 32 | landing, hoy, calendario, citas |
| `nested-interactive` — `role=button` anidado | serio | 10 | calendario |
| `scrollable-region-focusable` | serio | 2 | landing |
| `target-size` < 24 px (`Mostrar la contraseña`) | serio | 2 | login |

3 pantallas limpias en axe: **pacientes, expediente, pendientes** (0 en ambos
anchos). Los 2 críticos van en `V10_BACKLOG.json` como P1
(`V10-A11Y-CRITICOS`); el resto entra al endurecimiento de `V10-A11Y-001`.

**Qué NO mide esta línea base**: teclado real, foco visible, lector de
pantalla, atrapado de foco en modales — se revisan a mano por pantalla (V10
§33) y no están cubiertos todavía.
