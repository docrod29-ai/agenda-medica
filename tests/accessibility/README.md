# tests/accessibility — V10

## Línea base axe-core (V10 §47 salida 10, tomada 9-ago-2026)

`linea-base-axe.mjs` corre axe-core (WCAG 2.x A/AA + 2.2 AA) sobre las nueve
pantallas del golden flow, en escritorio y móvil, con el mismo arnés de
emuladores de `tests/visual/README.md` (pasos 1–3):

```bash
node tests/accessibility/linea-base-axe.mjs docs/design/capturas/axe-linea-base.json
```

**Qué NO cubre** (se revisa a mano, V10 §33): orden de tabulación real, foco
visible en uso, lector de pantalla, atrapado de foco en modales y objetivos
táctiles en interacción. axe mide lo medible por DOM; aprobar una pantalla
exige además el recorrido con teclado.

Las pruebas-compuerta (que fallen el build ante una regresión) se añaden con
`V10-A11Y-001`; una prueba que no puede fallar no se admite
(`.claude/rules/testing-gates.md`).
