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
| 10 | Línea base de accesibilidad | ⏳ pendiente | siguiente corrida: axe sobre las capturas del arnés |
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

1. **Arreglo de contenido clínico** `V10-SAFETY-ALERGIAS-WORDING` (una línea,
   reversible, con prueba) — no espera al rediseño del encounter.
2. **Salida 10**: línea base de accesibilidad (axe/playwright sobre el arnés ya
   existente; guardar resultados en `tests/accessibility/`).
3. **Salida 12**: medir carga inicial y transición de ruta sobre `next start`.
4. Con 10 y 12, TRUTH-001 queda completa → abrir `V10-CONSTITUTION-001` si
   V10-D1 (fusión V9) ya aterrizó en main; si no, los P1 móviles de
   `V10-AGENDA-001` que no chocan con la rama V9.
