# Sistema de motion — V10

> Ley: V10 §25. Motion comunica causalidad, estado o continuidad — nunca
> espectáculo. Se desarrolla a fondo en `V10-MOTION-001` (iteración 19).

## Vigente hoy (heredado de `docs/DESIGN_SYSTEM.md` §Motion)

- Curva única: `cubic-bezier(0.16, 1, 0.3, 1)`.
- `prefers-reduced-motion` se respeta siempre.
- `@keyframes spin` global existe desde REG-266 (V9 lo encontró ausente con
  90 referencias).

## Tokens nombrados requeridos (V10 §25) — pendientes de definir con uso real

`feedback-rapido` · `transicion-estandar` · `panel-entra/sale` ·
`insercion-en-lista` · `modal/hoja` · `transicion-de-ruta` ·
`estado-streaming`.

Regla dura: no animar cifras críticas ni advertencias de forma que distraiga
(V10 §25); ninguna animación en el camino de una alerta clínica.
