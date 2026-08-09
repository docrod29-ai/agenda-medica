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

Método: `tests/visual/arnes-a11y.mjs` — axe-core (WCAG 2.x A/AA + 2.2 AA) sobre
el golden flow autenticado contra emuladores, en 1440 y 390. Evidencia completa
en `tests/visual/capturas/reporte-a11y.json`.

**12 hallazgos critical/serious, 5 tipos distintos:**

| Pantalla | Impacto | Regla | Qué es |
|---|---|---|---|
| agenda | critical | `button-name` ×2 | botones de icono (chat/editar) sin nombre accesible |
| agenda | critical | `label` | `input[type=date]` sin etiqueta |
| consulta | critical | `label` ×4 | 4 textareas de la nota sin etiqueta |
| hoy | serious | `color-contrast` ×4 | `.prox-hero-cta` bajo 4.5:1 |
| agenda | serious | `color-contrast` ×3–6 | botones de acción de fila bajo 4.5:1 |
| login | serious | `target-size` | «Mostrar contraseña» < 24px de objetivo |

`pacientes` y `expediente`: **0 violaciones axe** en ambos anchos (con la
lista de pacientes VACÍA — ver actualización abajo).

Los tres critical entran al backlog como `V10-DEBT-005` (P1): son campos y
botones del flujo clínico central sin nombre para un lector de pantalla. El
resto se arregla en `V10-A11Y-001` o al rediseñar cada pantalla — sin dejar
que un rediseño los reintroduzca.

## Re-medición — 9-ago-2026 (noche): 12 → 8, CERO critical

Los 4 critical se repararon y se verificaron con axe en navegador real la
misma corrida; guardián de fuente probado al revés en
`src/__tests__/a11y-flujo-central-etiquetas.test.ts` (6/6 fallan sin el
arreglo). También cayeron: `.prox-hero-cta` (mismo 3.28:1 de v1104, pero en
CSS global, donde el guardián de estilos en línea no mira) y el `target-size`
del toggle de contraseña en login/registro (ahora 44×44).

**Los 8 serious restantes, con dueño:**

| Pantalla | Regla | Dueño |
|---|---|---|
| hoy 1440+390 | `color-contrast` ×3 (subtítulos de la agenda del día) | V10-TODAY-001 |
| agenda 1440+390 | `color-contrast` ×3–6 («Registrar cobro» y pares) | V10-AGENDA-001 |
| pacientes 1440+390 | `nested-interactive` ×3 (fila `div[role=button]` con botones dentro) — **nuevo**: sólo aparece con la lista POBLADA; la línea base original lo midió vacío | V10-DEBT-010 |
| nota 1440+390 | `color-contrast` ×7 (etiquetas grises de la tabla de datos) — **nuevo**: la ruta no existía en la línea base sin nota sembrada | V10-DEBT-008 |

Lección de método: una pantalla auditada con su estado VACÍO puntúa
accesibilidad de más — `pacientes` pasó de 0 violaciones a 3 serious al
poblarla. La siembra manda (V10 §33.2: datos sintéticos realistas).

Pendiente de la línea base (no lo cubre axe): recorrido de teclado completo,
lector de pantalla real y foco visible — se levantan en `V10-A11Y-001`.
