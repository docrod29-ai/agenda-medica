# Nexus Accessibility

Normalización V14 sobre `ACCESSIBILITY.md` y la regla
`.claude/rules/design-system.md` (WCAG 2.2 AA o mejor).

Estado real medido (heredado en esta rama, con commits):

- líneas base axe del golden flow autenticado unidas y reconciliadas;
  0 critical tras las reparaciones (commit a63fefe7);
- AGENDA-IDENTITY-001: axe 0 en 1440 y 390 (commit b6a8c343);
- mínimos que fallan la compuerta (regla del repo): control interactivo no
  `<button>` · campo sin etiqueta · modal sin trampa de foco/Escape · foco
  invisible · contraste <4.5:1 · objetivo táctil <44×44.

Obligación V14: toda pantalla migrada por IDENTITY-001 re-pasa axe — el cambio
de paleta puede romper contraste que hoy pasa (riesgo R-1).
