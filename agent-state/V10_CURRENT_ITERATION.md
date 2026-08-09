# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama canónica**: `claude/nexus-visual-excellence-v10`. **OJO**: la 2.ª corrida
(9-ago-2026, tarde) trabajó en `claude/kind-brahmagupta-c51p2n` (rama asignada
por la plataforma a esa sesión; la canónica quedó dentro por fast-forward). Al
reanudar: `git fetch --all` y partir de la rama con el commit V10 más nuevo —
nunca perder trabajo de ninguna de las dos.

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47).

## Estado de V10-TRUTH-001 (17 salidas requeridas)

| # | Salida | Estado | Dónde |
|---|---|---|---|
| 1 | Inventario de pantallas Practice | ✅ heredado, vivo | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Inventario de capturas escritorio/móvil | ✅ **HECHO (9-ago, 2.ª corrida)** | `docs/design/capturas/v10/2026-08-09/` — 9 pantallas × 2–4 viewports, golden flow autenticado con datos sintéticos |
| 3 | Inventario de tokens de diseño | ✅ inicial | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ heredado | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` (conteos medidos) |
| 6 | Mapa de navegación | ✅ heredado | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ heredado + reparado | REG-276…279 (rama V9, sin fusionar) |
| 9 | Inconsistencias visuales | ✅ heredado | `agent-state/DESIGN_STATE.md`: 6 065 `style={{`, 1 205 hex a mano |
| 10 | Línea base de accesibilidad | ✅ **HECHO** | axe-core WCAG 2.2 AA por pantalla en `capturas/v10/2026-08-09/resumen.json`; defectos en `V10_BACKLOG.json` (V10-DEF-002/003) |
| 11 | Línea base móvil | ✅ **HECHO** | capturas 390×844 de las 9 pantallas; hallazgo mayor: agenda móvil rota (V10-DEF-001, P1) |
| 12 | Línea base de rendimiento | ⏳ pendiente | requiere `next build` + `next start` (dev no da números honestos) |
| 13 | Matriz de principios de competidores | ✅ heredada, extender | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | ✅ **HECHO** | `agent-state/V10_VISUAL_SCORECARD.json` — 9 pantallas, 12 dimensiones, con captura y justificación. **Promedio 8.07, mínimo 6.9 (agenda)** vs meta 9.3/9.0 |
| 15 | Puntuación «cara de IA» por pantalla | ✅ **HECHO** | mismo archivo. **Promedio 1.94, peor 3.5 (agenda)** vs meta ≤1.0 |
| 16 | Backlog visual P0–P3 | ✅ **HECHO** | `V10_BACKLOG.json`: 11 defectos concretos con evidencia (1× P1 móvil, 1× P1 a11y, resto P2) + 2 deudas esperando fusión V9 |
| 17 | Primera iteración de implementación | ✅ decidida | ver «Próxima acción exacta» |

**Regla de esta iteración**: no re-auditar lo que V9 ya midió con método y
guardián. TRUTH-001 **reconcilia y completa**; no repite.

## Compuertas de la corrida del 9-ago (2.ª, arnés de capturas)

- Cambios de producto: `src/lib/firebase.ts` (conexión a emuladores con doble
  candado demo) y `firebase.json` (emulador auth). Todo lo demás es arnés
  (`scripts/design/*`), estado y evidencia.
- `node scripts/lint-trinquete.mjs`: **96, igual que el techo.**
- `npx vitest run` y `npm run build`: ver bitácora del commit.

## Próxima acción exacta (siguiente corrida)

1. **`V10-A11Y-QUICKWINS` (adelanto seguro de V10-A11Y-001, no toca archivos
   de la rama V9)**: nombres accesibles del toggle de tema, botón de ayuda y
   los 3 botones de fila de citas; etiqueta del input de fecha en /citas;
   etiquetas de las 4 textareas de /consulta. Con la prueba al revés
   (axe debe pasar de 5 pantallas con `button-name` a 0) usando el arnés.
2. **`V10-AGENDA-001` arranque por el móvil** (V10-DEF-001, P1): diseñar la
   fila de cita móvil nativa (tarjeta vertical: hora+estado arriba, nombre
   completo, motivo, UNA acción primaria según estado + resto en menú).
   Recapturar y re-puntuar con el arnés.
3. Salida 12 (rendimiento): `next build` + `next start` + medición sobre las
   mismas 9 pantallas.
4. Revisar V10-D1 (fusión V9) — sigue abierta; mientras, no tocar shell,
   navegación ni compañero del paciente.

## Cómo levantar el arnés (para la siguiente corrida)

```bash
# 1. .env.local con los valores demo (ver V10_BLOCKERS.md B-V10-2)
# 2. npx firebase emulators:start --only auth,firestore --project demo-nexusmed-test &
# 3. set -a; source .env.local; set +a; node scripts/design/sembrar-emulador-v10.mjs
# 4. npm run dev &
# 5. node scripts/design/capturar-golden-flow-v10.mjs            # todo
#    node scripts/design/capturar-golden-flow-v10.mjs 2026-08-09 --solo=receta  # puntual
```
