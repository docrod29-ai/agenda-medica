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
| 17 | Primera iteración de implementación | ✅ **HOME-001** | `/dashboard` rediseñada — ver abajo |

## HOME-001 — la pantalla de inicio deja de ser un tablero

**Orden del dueño**, 9-ago-2026, después de ver su propia aplicación a 390 px de
ancho en su sesión: *«arranca ya con el rediseño de esta pantalla»*.

**Lo medido antes de tocar nada** (captura real, cuenta del dueño, 390×844):
las cuatro tarjetas seguían de dos en dos, «Agenda de hoy» y «Accesos rápidos»
seguían lado a lado en un teléfono, la columna derecha quedaba cortada fuera de
la pantalla y «Citas hoy 0» salía dos veces.

**La causa**: `gridTemplateColumns: '1fr 300px'` —fija, en píxeles— y **ni una
sola consulta de medios propia** en toda la pantalla. Una rejilla así no se
apila nunca. No se arregla con un `minmax`: se arregla no teniendo dos columnas
que defender, y eso obliga a decidir qué sobra en la pantalla.

**Lo que quedó**, por el orden de urgencia de §14:

1. **¿Quién sigue?** — la próxima cita, arriba del todo. Antes salía en cuarto
   lugar, debajo de cuatro tarjetas de estadística.
2. **¿Qué necesita atención?** — la cola de pendientes.
3. **¿Qué pasa hoy?** — la agenda a todo el ancho, con el recuento del día en un
   renglón de texto dentro de su encabezado.

**Lo que se fue**: las 4 tarjetas KPI (§14), «Accesos rápidos» (§9, navegación
duplicada), el «Citas hoy» del encabezado (§9, encabezado duplicado) y el
sparkline de 7 días (métrica sin acción).

**Verificado**: 8 577 pruebas en verde (575 archivos), `tsc` limpio, lint 96
(el techo, sin deuda nueva), build de producción limpio. El trinquete de diseño
**bajó** en tres contadores: `hexEnLinea` 565→561, `tamanosFueraDeEscala`
2027→2021, `radiosFueraDeEscala` 638→637.

**Cerrojo**: `src/__tests__/la-pantalla-de-hoy-no-es-un-tablero.test.ts` —
19 casos. Falla si vuelve una columna fija en píxeles, si vuelve una tarjeta
KPI, si «Accesos rápidos» reaparece, si «Citas hoy» sale dos veces, si alguno
de los cuatro destinos desaparece del menú al haber quitado el atajo, o si el
color de la línea de resumen deja de estar reservado a lo accionable.

**Sin desplegar**: §6 lo prohíbe («never deploy production»). Espera el visto
bueno del dueño.

**Lo que esta pantalla todavía no contesta**: de las cinco preguntas de §14
quedan dos sin fuente de datos — «qué puedo continuar» y «qué preparó
NexusMED». Declaradas en `V10_BACKLOG.json` (`V10-HOME-002`, `V10-HOME-003`)
en vez de rellenarse con algo que lo pareciera.

**Regla de esta iteración**: no re-auditar lo que V9 ya midió con método y
guardián. TRUTH-001 **reconcilia y completa**; no repite.

## Corrida del 9-ago-2026 (tarde) — TRUTH-001: capturas + puntuación + axe

**Lo que cerró** (era la «próxima acción exacta» y se hizo entera):

1. **Arnés de capturas del golden flow — construido y corriendo** (B-V10-2
   resuelto): emuladores Auth+Firestore, siembra sintética que ABORTA sin
   emuladores, `NEXT_PUBLIC_FIREBASE_EMULATORS=1` en `src/lib/firebase.ts`
   (constante en build: en Vercel el bloque no existe), build de producción,
   login real y **36 capturas** (9 pantallas × 4 anchos) en
   `docs/design/capturas/golden-flow/`. Receta: `tests/visual/README.md`.
2. **Salidas 14 y 15**: `V10_VISUAL_SCORECARD.json` — 5 pantallas puntuadas
   con ambos anchos inspeccionados (hoy 8.2 · expediente 8.0 · consulta 7.8 ·
   calendario 6.6 · citas 6.6; generic-AI ≤ 2.5 en todas). 4 quedan
   declaradas sin puntuar (landing, login, pacientes, pendientes).
3. **Salida 10**: línea base axe en `docs/design/capturas/axe-linea-base.json`
   y resumida en `docs/design/ACCESSIBILITY.md` — 2 reglas CRÍTICAS
   (`button-name` ×8, `label` ×10), 4 serias; pacientes/expediente/pendientes
   limpias.
4. **V10-D1 ya decidida y ejecutada** por el dueño (PR #279): B-V10-1 cerrado,
   V10-DEBT-001/002 desbloqueadas.

**El hallazgo que manda**: la agenda en móvil está ROTA (citas conserva la
rejilla de escritorio con botones fuera de pantalla; calendario mete 7 columnas
en 390 px). Registrado como `V10-AGENDA-MOVIL` (P1) con capturas. HOME-001 en
cambio SÍ se apila — verificado en navegador por primera vez.

## Próxima acción exacta (siguiente corrida)

1. **`V10-AGENDA-MOVIL` (P1)**: vista móvil nativa de Citas (tarjeta apilada,
   acciones dentro del viewport, una sola representación de fecha) y vista
   día por defecto del Calendario en móvil. Con capturas antes/después del
   mismo arnés y prueba tipo «cabe-en-un-telefono» que falle con la rejilla
   fija (probada al revés).
2. **`V10-A11Y-CRITICOS` (P1)**: nombre accesible a los 8 botones, etiqueta a
   los 10 campos; re-correr `linea-base-axe.mjs` y actualizar la línea base.
3. Puntuar las 4 pantallas restantes del scorecard (capturas ya tomadas).
4. El servidor/emuladores del arnés NO quedan corriendo entre corridas: se
   relevantan con la receta de `tests/visual/README.md`.
