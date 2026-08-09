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

## Línea base — 9-ago-2026 (TRUTH-001 salida 10)

**Método**: axe-core 4.x dentro del mismo recorrido que captura la evidencia
visual (`npm run capturas:golden`): sesión real contra emuladores, datos
sintéticos, 7 pantallas × 2 vistas (1440×900 y 390×844). Detalle completo por
pantalla en [`a11y-golden-flow.json`](a11y-golden-flow.json).

**Total: 38 violaciones en 14 vistas — 20 serias/críticas.** Ninguna pantalla
salió limpia; la mejor es el expediente (1 moderada por vista).

### Los cinco patrones (no 38 defectos sueltos)

| # | Patrón | Regla axe | Impacto | Dónde |
|---|---|---|---|---|
| 1 | Botones de sólo-icono sin nombre accesible | `button-name` | **crítico** | `/citas` (3), `/calendario` (3), `/pacientes` (1), `/pendientes` (1) — incluye los `.btn-ghost.btn-icon` de los renglones y el mismo `button` compartido que se repite por ruta (flotante del shell) |
| 2 | Campos sin etiqueta | `label` | **crítico** | `/citas` (`input[type=date]`), `/consulta` (4 `textarea` de la nota con `placeholder=""`) |
| 3 | Contraste < 4.5:1 | `color-contrast` | serio | `/dashboard` (7 nodos, **incluye `.prox-hero-cta` de HOME-001**), `/citas` («Registrar cobro» ×fila), `/calendario` (bloque 16:00) |
| 4 | Interactivo anidado (`role=button` dentro de `role=button`) | `nested-interactive` | serio | `/calendario` — 7 celdas «Agendar a las HH:00»; un lector de pantalla no puede separar la celda del bloque |
| 5 | Marcas de región duplicadas / contenido fuera de landmark | `landmark-unique` · `region` | moderado | El shell entero (`aside` duplicado bajo `.hidden`, `.mobile-topbar > span`) — se arregla UNA vez en el shell, no por pantalla |

### Lectura clínica de la lista

- Los patrones 1 y 2 son los mínimos que la propia compuerta del repo declara
  fallo («campo sin etiqueta», arriba). **El textarea sin etiqueta está en la
  NOTA CLÍNICA** — la pantalla de mayor riesgo del producto.
- El patrón 3 toca el CTA primario de la pantalla de inicio recién rediseñada:
  HOME-001 queda con una corrección pendiente de contraste, no de estructura.
- Los patrones 1, 3 (parcial) y 5 viven en el **shell compartido**: van a
  `V10-SHELL-001`, donde arreglarlos una vez limpia las 7 pantallas.

Defectos priorizados en `agent-state/V10_BACKLOG.json`
(`V10-A11Y-BOTONES-SIN-NOMBRE`, `V10-A11Y-CAMPOS-SIN-ETIQUETA`,
`V10-A11Y-CONTRASTE`, `V10-A11Y-CALENDARIO-ANIDADO`, `V10-A11Y-LANDMARKS`).

**Qué NO cubre esta línea base**: axe automatizado no ve orden de foco,
navegación por teclado real, atrapamiento de foco en modales, ni lector de
pantalla de verdad — eso es recorrido manual de `V10-A11Y-001`. Cero
violaciones axe ≠ accesible; es el piso, no el techo.
