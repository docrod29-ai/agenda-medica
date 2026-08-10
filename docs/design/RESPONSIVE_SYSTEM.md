# Sistema responsive — V10

> Ley: V10 §27. Escritorio, tableta y móvil son experiencias intencionales;
> móvil NO es escritorio apilado. Los flujos críticos exigen diseño móvil
> explícito. Se desarrolla en `V10-MOBILE-001` (iteración 17) y en cada unidad
> de pantalla.

## Restricciones ya decididas (no renegociar)

- Móvil: **4–5 destinos primarios como máximo** (`.claude/rules/design-system.md`).
- Objetivo táctil ≥ 44×44.
- El inventario generado (`SCREEN_INVENTORY.md`) marca `Resp:` por pantalla,
  con la advertencia de que mide el `page.tsx`, no el árbol de componentes.

## Pendiente

- Breakpoints canónicos y anchos de contenido/panel (V10 §24) — definir junto
  con la consolidación de tokens, tras la fusión de DESIGN-SYSTEM-001 (V9).
- Línea base móvil con capturas (TRUTH-001 salida 11).
