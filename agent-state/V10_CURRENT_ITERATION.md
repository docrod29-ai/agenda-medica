# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada. Rama: `claude/nexus-visual-excellence-v10`.

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47).

## Estado de V10-TRUTH-001 (17 salidas requeridas)

| # | Salida | Estado | Dónde |
|---|---|---|---|
| 1 | Inventario de pantallas Practice | ✅ heredado, vivo | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Inventario de capturas escritorio/móvil | 🔄 método probado | públicas capturadas (landing/login, 1440×900 y 390×844); golden flow autenticado requiere arnés de emulador — ver `V10_BLOCKERS.md` B-V10-2 |
| 3 | Inventario de tokens de diseño | ✅ inicial | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ heredado | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` (conteos medidos) |
| 6 | Mapa de navegación | ✅ heredado | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ heredado + reparado | REG-276…279 (rama V9, sin fusionar) |
| 9 | Inconsistencias visuales | ✅ heredado | `agent-state/DESIGN_STATE.md`: 6 065 `style={{`, 1 205 hex a mano |
| 10 | Línea base de accesibilidad | ⏳ pendiente | `docs/design/ACCESSIBILITY.md` |
| 11 | Línea base móvil | ⏳ pendiente | con la salida 2 |
| 12 | Línea base de rendimiento | ⏳ pendiente | con navegador |
| 13 | Matriz de principios de competidores | ✅ heredada, extender | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | ⏳ pendiente | `agent-state/V10_VISUAL_SCORECARD.json` (exige captura — V10 §34) |
| 15 | Puntuación «cara de IA» por pantalla | ✅ parcial | conteos globales sí; por pantalla exige captura |
| 16 | Backlog visual P0–P3 | 🔄 en curso | `agent-state/V10_BACKLOG.json` |
| 17 | Primera iteración de implementación | ⏳ decidir al cierre | depende de la fusión de V9 (ver herencia) |

**Regla de esta iteración**: no re-auditar lo que V9 ya midió con método y
guardián. TRUTH-001 **reconcilia y completa**; no repite.

## Compuertas de esta corrida (9-ago-2026)

- `npx vitest run`: **8 458 pasan · 1 falla preexistente y de entorno**
  (`ops-timeout-y-punto-ciego`, la misma que documentó V9 en
  `LAST_SAFE_CHECKPOINT.md`: espera un timeout contra IP no enrutable y el
  proxy del contenedor falla rápido). Cambio de esta corrida: sólo docs/estado.
- `lint-trinquete`: **96, igual que el techo.** Sin deuda nueva.

## Próxima acción exacta (siguiente corrida)

1. **Arnés de capturas del golden flow**: levantar emuladores Auth+Firestore
   (`demo-nexusmed-test`), sembrar paciente/citas sintéticos, iniciar sesión y
   capturar las pantallas del golden flow en 1440×900, 1024, 768 y 390×844
   (V10 §39). Método base ya probado — ver `V10_BLOCKERS.md` B-V10-2.
2. Con capturas: puntuar pantallas críticas con `V10_VISUAL_RUBRIC.md` →
   `V10_VISUAL_SCORECARD.json` (salidas 14 y 15).
3. Línea base de accesibilidad sobre esas mismas pantallas (salida 10).
4. Revisar si el dueño ya decidió V10-D1 (fusión de la rama V9); si sí,
   desbloquear V10-DEBT-001/002.
