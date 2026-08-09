# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama de trabajo de esta sesión**: `claude/kind-brahmagupta-iurzog` (la rama
asignada por el arnés de la sesión; contiene fusionado todo el estado de
`claude/nexus-visual-excellence-v10`, que queda como historia).

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47).

## Estado de V10-TRUTH-001 (17 salidas requeridas)

| # | Salida | Estado | Dónde |
|---|---|---|---|
| 1 | Inventario de pantallas Practice | ✅ heredado, vivo | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Inventario de capturas escritorio/móvil | ✅ **9-ago-2026** | arnés `scripts/design/arnes-capturas-v10.sh`; 29 capturas del golden flow (login, dashboard, citas, calendario, pacientes, expediente, consulta) en 1440/1024/768/390, autenticadas, build de producción, datos sintéticos |
| 3 | Inventario de tokens de diseño | ✅ inicial | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ heredado + por pantalla | `GENERIC_AI_AESTHETIC_AUDIT.md` (conteos) + scorecard por pantalla |
| 6 | Mapa de navegación | ✅ heredado | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ heredado + reparado | REG-276…279 (rama V9, PR a main en curso — V10-D1) |
| 9 | Inconsistencias visuales | ✅ heredado + capturas | DESIGN_STATE (conteos) + backlog nuevo con evidencia visual |
| 10 | Línea base de accesibilidad | ✅ **9-ago-2026** | `tests/accessibility/axe-baseline-v10.json`: 14 auditorías (7 pantallas × 2 anchos), 71 nodos (30 críticos, 41 serios), 5 reglas; resumen en `docs/design/ACCESSIBILITY.md`, defectos en backlog (`V10-A11Y-*`) |
| 11 | Línea base móvil | ✅ **9-ago-2026** | capturas 390px + hallazgos P1 móviles en `V10_BACKLOG.json` |
| 12 | Línea base de rendimiento | ⏳ pendiente | el arnés ya usa build de producción; falta medir |
| 13 | Matriz de principios de competidores | ✅ heredada, extender | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | ✅ **9-ago-2026** | `V10_VISUAL_SCORECARD.json` — con captura y revisor independiente (design-systems-lead) |
| 15 | Puntuación «cara de IA» por pantalla | ✅ **9-ago-2026** | mismo scorecard |
| 16 | Backlog visual P0–P3 | ✅ poblado con evidencia | `V10_BACKLOG.json`: 13 items, 5 P1 (1 de contenido clínico, 3 móviles, 1 heredado) |
| 17 | Primera iteración de implementación | decidida | ver «Próxima acción» |

## Hallazgos clave de esta corrida (9-ago-2026, con captura)

1. **P1 contenido clínico**: la consulta dice «Sin alergias conocidas» cuando
   no hay registro — afirma ausencia sin dato (regla 4 de seguridad clínica).
   El expediente dice «no registradas» (correcto). `V10-SAFETY-ALERGIAS-WORDING`.
2. **P1 móvil ×3**: citas rotas a 390px (pill encima del nombre, botones fuera
   de pantalla), dashboard = escritorio apilado, calendario semanal ilegible.
3. **Escritorio**: identidad sólida (oscuro, Fraunces, cobalto; login original
   con motivo ECG). La deuda es de patrón, no de tema: KPI genérico en el
   dashboard, botonera arcoíris por fila en citas, sidebar-almacén de ~20 items.
4. **E0-06**: el expediente lee alergias sólo del campo legado; registrado para
   que la migración no deje el banner mintiendo.

## Compuertas de esta corrida

- guardián nuevo `emulador-solo-demo.test.ts` 4/4, probado al revés
- `lint-trinquete`: 96 = techo
- `npm run build`: compila (el arnés fotografía ese build)
- `npx vitest run` completo: correr antes del cierre de la corrida

## Próxima acción exacta (siguiente corrida)

1. ~~Arreglo `V10-SAFETY-ALERGIAS-WORDING`~~ **hecho** (932d788).
2. ~~Salida 10: línea base de accesibilidad~~ **hecha** (axe 4.11.4, 14
   auditorías, 71 nodos). Quedan los arreglos: los dos P1 críticos
   (`V10-A11Y-BOTONES-SIN-NOMBRE`, `V10-A11Y-CAMPOS-SIN-ETIQUETA`) son
   aria-label/label reversibles y elegibles para arreglo directo con guardián.
3. **Salida 12**: medir carga inicial y transición de ruta sobre `next start`
   (el arnés ya lo levanta; instrumentar con playwright metrics/CDP).
4. **Puntuar expediente y consulta** (recapturadas con siembra fiel) con
   contrarrevisión independiente — cierra las salidas 14/15 al 100 %.
5. Con 12 y la puntuación completa, TRUTH-001 queda cerrada → abrir
   `V10-CONSTITUTION-001` si V10-D1 (fusión V9) ya aterrizó en main; si no,
   los P1 elegibles que no chocan con la rama V9 (a11y críticos, citas-390).
