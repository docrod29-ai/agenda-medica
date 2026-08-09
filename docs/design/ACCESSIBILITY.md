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

## Línea base (TRUTH-001 salida 10) — pendiente

Se levanta con la app corriendo (axe/teclado/lector), por pantalla crítica del
golden flow. Resultado y fecha se registran aquí; los defectos van a
`V10_BACKLOG.json` con prioridad de la fórmula §31.
