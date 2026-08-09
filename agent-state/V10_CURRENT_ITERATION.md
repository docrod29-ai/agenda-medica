# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada. Rama canónica: `claude/nexus-visual-excellence-v10`; la
corrida del 9-ago (tarde) trabajó en `claude/kind-brahmagupta-9r4m7a` (la rama
asignada a su sesión) **partiendo de la punta de la canónica por fast-forward**
— sin divergencia: la canónica quedó como ancestro estricto.

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47). **De las 17 salidas: 14 cerradas, 3 abiertas** (tabla).

## Corrida del 9-ago-2026 (tarde) — el arnés de capturas, construido y cobrando

1. **B-V10-2 RESUELTO.** Arnés completo del golden flow AUTENTICADO:
   emuladores Auth+Firestore (candado `demo-*`), siembra sintética
   (`scripts/design/sembrar-capturas.mjs`), conexión de la app a emuladores
   SÓLO bajo `NEXT_PUBLIC_FIREBASE_EMULATORS=1` (`src/lib/firebase.ts`),
   capturas + axe (`scripts/design/capturar-golden-flow.mjs`). Receta en
   `docs/design/capturas/v10-truth/README.md`.
2. **Salida 2**: 21 capturas — 7 pantallas × 3 anchos (1440/768/390), build de
   producción, datos sintéticos — committeadas como evidencia en
   `docs/design/capturas/v10-truth/`.
3. **Salidas 14 y 15**: `V10_VISUAL_SCORECARD.json`, cada puntuación con su
   captura y su porqué. **Promedio de pantallas críticas: 7.4/10** (meta
   ≥9.3); generic-AI-look ≤1.5 en todas salvo `/citas` (3.5). La distancia a
   la meta quedó medida y nombrada: móvil roto en `/citas` (P0), muro de
   botones, nombres/etiquetas de accesibilidad.
4. **Salida 10**: línea base axe WCAG 2.x AA por pantalla
   (`docs/design/ACCESSIBILITY.md` + `axe-baseline.json`). Tres pantallas en
   CERO (dashboard, expediente, pendientes); el resto son dos familias
   reparables en lote (`V10-A11Y-001`).
5. **El arnés cobró el primer día — REG-307 y REG-308** (v1169): el saludo
   «Buenas tardes, Dra.» (título sin nombre; media defensa) y el CTA del héroe
   a 2.9:1 (el azul de TEXTO usado como relleno). Reparados, con guardián
   `lo-que-la-captura-real-midio.test.ts` (8 casos, probado al revés),
   sellados en invariantes, y verificados **re-capturando**: `/dashboard`
   quedó en 0 violaciones axe.
6. **B-V10-1 RESUELTO**: el dueño decidió V10-D1 — V9 fusionada a main (PR
   #279). `V10-DEBT-001/002` pasan a `desbloqueado`.

## Estado de V10-TRUTH-001 (17 salidas)

| # | Salida | Estado |
|---|---|---|
| 1 | Inventario de pantallas | ✅ heredado, vivo (generado + guardián CI) |
| 2 | Capturas escritorio/móvil | ✅ **21 capturas, golden flow autenticado** |
| 3 | Tokens de diseño | ✅ inicial |
| 4 | Inventario de componentes | 🔄 en curso |
| 5 | Anti-patrones «cara de IA» | ✅ heredado (conteos) + por pantalla (scorecard) |
| 6 | Mapa de navegación | ✅ heredado |
| 7 | Mapa de interacción | ⏳ pendiente |
| 8 | Pérdida de estado | ✅ heredado + reparado (REG-300…303 en main) |
| 9 | Inconsistencias visuales | ✅ heredado |
| 10 | Línea base de accesibilidad | ✅ **axe medido; teclado/lector → V10-A11Y-001** |
| 11 | Línea base móvil | ✅ **medida — es la peor noticia del scorecard** |
| 12 | Línea base de rendimiento | ⏳ pendiente (V10-PERF-001) |
| 13 | Matriz de competidores | ✅ heredada, extender |
| 14 | Puntuación visual por pantalla | ✅ **scorecard con evidencia** |
| 15 | Puntuación «cara de IA» | ✅ **por pantalla en scorecard** |
| 16 | Backlog P0–P3 | ✅ **15 ítems con evidencia y prioridad** |
| 17 | Primera implementación | ✅ HOME-001 (+ REG-307/308 de esta corrida) |

## Compuertas de esta corrida (9-ago-2026, tarde)

Se corren completas antes del commit; resultado en el mensaje del commit.
Guardianes nuevos **probados al revés**: 3 casos fallan con cada defecto
repuesto y pasan con el arreglo.

## Próxima acción exacta (siguiente corrida)

1. **`V10-CITAS-001` (P0)**: la fila de `/citas` a 390 px — botones pintados
   ENCIMA del texto (evidencia `citas--mobile.png`). Misma cirugía que
   HOME-001: decidir qué sobra de la fila (muro de 4 CTA, filtro duplicado,
   badge «Elena», teléfono en cada fila) y hacerla apilable. Re-capturar y
   re-puntuar al cerrar.
2. Con el mismo impulso, **`V10-A11Y-001` primera tanda**: `aria-label` de los
   botones de icono (citas, calendario) y etiquetas de las 4 textareas de la
   nota — es el campo de trabajo principal del médico.
3. Si queda espacio: **`V10-AGENDA-002`** — `/calendario` móvil abre en Día.
4. Salidas 7 (mapa de interacción) y 12 (rendimiento) siguen abiertas para
   cerrar TRUTH-001; no bloquean los P0/P1 ya medidos.
