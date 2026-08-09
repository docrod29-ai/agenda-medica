# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: la canónica `claude/nexus-visual-excellence-v10` quedó como historia
base; la corrida del 9-ago (tarde) trabajó en la rama de sesión configurada
`claude/kind-brahmagupta-exbp9m` (V10 §3: «If an explicitly configured V10
branch already exists, use it» — la sesión sólo puede empujar a la suya).
Ambas comparten historia; la de sesión va estrictamente adelante.

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47).

## Estado de V10-TRUTH-001 (17 salidas requeridas)

| # | Salida | Estado | Dónde |
|---|---|---|---|
| 1 | Inventario de pantallas Practice | ✅ heredado, vivo | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Inventario de capturas escritorio/móvil | ✅ golden flow · 4 anchos | `tests/visual/capturas/` (arnés completo, ver B-V10-2 resuelto) |
| 3 | Inventario de tokens de diseño | ✅ inicial | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ heredado | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` (conteos medidos) |
| 6 | Mapa de navegación | ✅ heredado | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ heredado + reparado | REG-276…279 (rama V9, sin fusionar) |
| 9 | Inconsistencias visuales | ✅ heredado + nuevas | `DESIGN_STATE.md` + hallazgos del arnés (scorecard) |
| 10 | Línea base de accesibilidad | ✅ axe levantada | `docs/design/ACCESSIBILITY.md` + `reporte-a11y.json` (teclado/lector pendientes) |
| 11 | Línea base móvil | ✅ capturada | 390×844 en `tests/visual/capturas/`; defectos P1 en backlog |
| 12 | Línea base de rendimiento | ⏳ pendiente | con navegador (Lighthouse o Web Vitals del arnés) |
| 13 | Matriz de principios de competidores | ✅ heredada, extender | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | ✅ 5 de 7 puntuadas | `agent-state/V10_VISUAL_SCORECARD.json` (promedio 8.3 vs meta 9.3) |
| 15 | Puntuación «cara de IA» por pantalla | ✅ 5 de 7 | scorecard: 1.5–3.0 vs meta ≤1.0 |
| 16 | Backlog visual P0–P3 | ✅ poblado | `V10_BACKLOG.json`: 3 P1 nuevos (agenda móvil, shell móvil, a11y critical) |
| 17 | Primera iteración de implementación | 🔜 decidida | ver «Próxima acción» — cerrar TRUTH-001 y abrir la primera implementación |

**Regla de esta iteración**: no re-auditar lo que V9 ya midió con método y
guardián. TRUTH-001 **reconcilia y completa**; no repite.

## Compuertas de la corrida del 9-ago (tarde)

- Cambios de producto: sólo `src/lib/firebase.ts` (bloque de emuladores tras
  bandera apagada por omisión) y `firebase.json` (puerto del emulador de auth).
  Todo lo demás es arnés (`tests/visual/`), estado y documentación.
- `npx vitest run`: **8 458 pasan · 1 falla preexistente de entorno**
  (`ops-timeout-y-punto-ciego`: espera timeout contra IP no enrutable y el
  proxy del contenedor falla rápido — la misma que documentaron V9 y la
  corrida anterior de V10). Re-verificada en aislado esta corrida.
- `lint-trinquete`: **96, igual que el techo.** Sin deuda nueva.
- `npm run build`: **compila.**

## Próxima acción exacta (siguiente corrida)

1. **Completar la siembra** para las 2 pantallas sin puntuar: escribir
   `ultimaCita` en los pacientes sintéticos (lista «Recientes» poblada) y crear
   una **nota borrador** vía el flujo real para puntuar el editor de nota.
   Con eso, puntuar `pacientes` y `nota` y cerrar las salidas 14–15.
2. **Salida 12** (rendimiento): medir con el arnés TTI/CLS básicos por pantalla
   (Performance API), registrar en el scorecard.
3. **Salidas 4 y 7**: cerrar inventario de componentes y mapa de interacción
   (lectura de código + capturas ya existentes).
4. **Cerrar V10-TRUTH-001** y abrir la primera implementación. Candidata según
   backlog: los tres P1 del arnés (V10-DEBT-003 agenda móvil, -004 shell móvil,
   -005 a11y critical) son adelantables sin esperar la fusión V9 — decidir ahí
   si la primera unidad es un «quick-strike P1» o V10-SHELL-001 completa.
5. Revisar si el dueño ya decidió **V10-D1** (fusión de la rama V9); si sí,
   desbloquear V10-DEBT-001/002 (V10-CONSTITUTION-001).

### Cómo relanzar el arnés (resumen operativo)

```bash
# 1. emuladores            npx firebase emulators:start --only firestore,auth --project demo-nexusmed-test
# 2. siembra               FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
#                            GCLOUD_PROJECT=demo-nexusmed-test node tests/visual/sembrar-sinteticos.mjs
# 3. app                   npm run dev   (con .env.local demo: NEXT_PUBLIC_FIREBASE_EMULATORS=1)
# 4. capturas              ARNES_CHROMIUM=/opt/pw-browsers/chromium node tests/visual/arnes-capturas.mjs
# 5. accesibilidad         npm i --no-save axe-core && ARNES_CHROMIUM=... node tests/visual/arnes-a11y.mjs
```
