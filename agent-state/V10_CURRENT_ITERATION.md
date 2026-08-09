# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada.

**Rama**: historia V10 encadenada — `claude/nexus-visual-excellence-v10`
(instalación) → `claude/kind-brahmagupta-exbp9m` (arnés, 9-ago tarde) →
`claude/kind-brahmagupta-2yxowl` (cierre de TRUTH-001, 9-ago noche). Cada
sesión cloud empuja a su rama configurada y arranca de la punta más adelantada
(V10 §3). OJO para la siguiente corrida: la punta es **2yxowl**.

**Iteración en curso**: ninguna — `V10-TRUTH-001` **CERRADA** (9-ago noche).
La siguiente corrida abre la primera implementación (ver «Próxima acción»).

## V10-TRUTH-001 — cerrada con sus 17 salidas

| # | Salida | Dónde |
|---|---|---|
| 1 | Inventario de pantallas | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Capturas escritorio/móvil | `tests/visual/capturas/` — golden flow × 4 anchos, con nota borrador y pacientes poblados |
| 3 | Tokens de diseño | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | `docs/design/COMPONENT_INVENTORY.md` — **completado 9-ago noche** (93 medidos: 6 primitivos reales, 6 muertos, 56 de-una-pantalla, 3 duplicaciones) |
| 5 | Anti-patrones «cara de IA» | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` (V9, conteos) |
| 6 | Mapa de navegación | `docs/design/NAVIGATION_STATE_AUDIT.md` (V9) |
| 7 | Mapa de interacción | `docs/design/INTERACTION_PATTERNS.md` — **completado 9-ago noche** (4 mecanismos de navegación, ⌘K existe como paleta de navegación, guardado en 3 capas, tabla vacío/carga/error) |
| 8 | Defectos de pérdida de estado | REG-276…279 (rama V9, sin fusionar) |
| 9 | Inconsistencias visuales | `DESIGN_STATE.md` + scorecard |
| 10 | Línea base de accesibilidad | `reporte-a11y.json` — re-medida 9-ago noche: **12 → 8 hallazgos, 0 critical** (los 4 critical reparados esta corrida) |
| 11 | Línea base móvil | capturas 390 × 7 pantallas; defectos en backlog (DEBT-003/004/009/010) |
| 12 | Línea base de rendimiento | `tests/visual/capturas/reporte-rendimiento.json` — **completada 9-ago noche** (Performance API @1440; dev server, cifras relativas) |
| 13 | Matriz de competidores | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual | scorecard: **7 de 7 pantallas** puntuadas con captura |
| 15 | Puntuación «cara de IA» | scorecard: 7 de 7 (rango 1.0–3.0 vs meta ≤1.0) |
| 16 | Backlog P0–P3 | `V10_BACKLOG.json` — 10 items (DEBT-005 y TRUTH-CAPTURAS cerrados) |
| 17 | Primera implementación | **ya empezó**: los 4 axe critical del flujo (DEBT-005) se repararon esta corrida con guardián probado al revés |

## Foto del scorecard al cierre de TRUTH-001

Promedio global **8.2** (6 pantallas críticas; meta 9.3) · ninguna pantalla ≥9.0 ·
cara-de-IA 1.0–3.0 (meta ≤1.0). El déficit vive en RESPONSIVE móvil
(agenda 4.5, nota 5.5, pacientes 6.0) y en los 8 serious de axe restantes.

## Compuertas de la corrida del 9-ago (noche)

- `npx vitest run`: **8 465 pasan · 1 saltada · 0 fallas** (incluye el guardián
  nuevo `a11y-flujo-central-etiquetas`, probado al revés: 6/6 fallan sin el
  arreglo). La falla de entorno `ops-timeout-y-punto-ciego` esta vez PASÓ.
- `lint-trinquete`: **96, igual que el techo.**
- `npm run build`: **compila.**
- axe en navegador real: 12 → 8 critical/serious; **0 critical**.

## Advertencia de concurrencia (V10 §41)

La rama V9 sin fusionar (`origin/claude/nexus-patient-ux-v9`) tocó
`citas/page.tsx`, `pacientes/page.tsx` y `globals.css`. Los arreglos a11y de
esta corrida en esos archivos son mínimos (atributos y un token) y el guardián
`a11y-flujo-central-etiquetas.test.ts` **fallará si una fusión los pierde** —
ese es su segundo trabajo. Rediseños mayores de esas pantallas esperan V10-D1.

## Próxima acción exacta (siguiente corrida)

1. Arrancar de `claude/kind-brahmagupta-2yxowl` (o su descendiente más
   adelantado) y verificar si el dueño ya decidió **V10-D1** (fusión V9).
2. **Abrir V10-NOTE-001 como quick-strike** sobre los dos P1/P2 de la nota
   (DEBT-008: estado BORRADOR invisible — banda no-print + marca de agua en
   impreso; DEBT-009: barra de acciones móvil rota). La nota NO fue tocada por
   la rama V9 → cero riesgo de pisar trabajo validado. Guardián para cada uno.
3. Si V10-D1 ya se decidió a favor: abrir en paralelo la ruta
   V10-CONSTITUTION-001 (DEBT-001/002) sobre main ya fusionado.
4. Si no: después de la nota, V10-DEBT-003 (agenda móvil) sólo si se acepta el
   riesgo de rebase sobre V9 en `citas/page.tsx` — documentar la decisión.

### Cómo relanzar el arnés (resumen operativo)

```bash
# 1. emuladores            npx firebase emulators:start --only firestore,auth --project demo-nexusmed-test
# 2. siembra               FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
#                            GCLOUD_PROJECT=demo-nexusmed-test node tests/visual/sembrar-sinteticos.mjs
# 3. app                   npm run dev   (con .env.local demo: NEXT_PUBLIC_FIREBASE_EMULATORS=1)
# 4. capturas + rendimiento ARNES_CHROMIUM=/opt/pw-browsers/chromium node tests/visual/arnes-capturas.mjs
# 5. accesibilidad         npm i --no-save axe-core && ARNES_CHROMIUM=... node tests/visual/arnes-a11y.mjs
# Trampas: localhost (no 127.0.0.1), --no-proxy-server, waitUntil:'load',
# pre-marcar tour y push en localStorage (ya lo hacen los arneses).
```
