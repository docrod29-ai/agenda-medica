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
| 2 | Inventario de capturas escritorio/móvil | ✅ **golden flow autenticado** | `npm run capturas:golden` → 14 capturas (7 pantallas × 2 vistas) en `docs/design/capturas/golden-flow/`; B-V10-2 RESUELTO |
| 3 | Inventario de tokens de diseño | ✅ inicial | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` (V9) |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ heredado | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` (conteos medidos) |
| 6 | Mapa de navegación | ✅ heredado | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ heredado + reparado | REG-276…279 (rama V9, sin fusionar) |
| 9 | Inconsistencias visuales | ✅ heredado | `agent-state/DESIGN_STATE.md`: 6 065 `style={{`, 1 205 hex a mano |
| 10 | Línea base de accesibilidad | ⏳ pendiente | `docs/design/ACCESSIBILITY.md` |
| 11 | Línea base móvil | 🔄 parcial | 7 capturas a 390×844; puntuada la de inicio (8.2), el resto por revisar |
| 12 | Línea base de rendimiento | ⏳ pendiente | con navegador |
| 13 | Matriz de principios de competidores | ✅ heredada, extender | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | 🔄 6 vistas puntuadas CON evidencia | `V10_VISUAL_SCORECARD.json`: hoy 8.9/8.2, citas 7.6, calendario 8.6, expediente 8.3, consulta 8.9 — 8 vistas capturadas sin puntuar aún |
| 15 | Puntuación «cara de IA» por pantalla | 🔄 6 vistas | citas 4.0 (botonera+chips) es la peor; calendario 1.0 la mejor |
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

## Compuertas de esta corrida (9-ago-2026)

- `npx vitest run`: **8 458 pasan · 1 falla preexistente y de entorno**
  (`ops-timeout-y-punto-ciego`, la misma que documentó V9 en
  `LAST_SAFE_CHECKPOINT.md`: espera un timeout contra IP no enrutable y el
  proxy del contenedor falla rápido). Cambio de esta corrida: sólo docs/estado.
- `lint-trinquete`: **96, igual que el techo.** Sin deuda nueva.

## Corrida 9-ago-2026 (tarde) — el arnés existe y el golden flow ya se VE

**Dónde vive**: rama de sesión `claude/kind-brahmagupta-gu7h9g` (la plataforma
de esta corrida solo permite empujar ahí), basada en la punta de
`claude/nexus-visual-excellence-v10` — no se pierde nada; la siguiente corrida
parte de la más nueva de las dos.

**Qué se cerró** (era la «próxima acción exacta» de la corrida anterior):

- **B-V10-2 RESUELTO**: `npm run capturas:golden` — emuladores Auth+Firestore,
  consultorio sintético sembrado, sesión real, 14 capturas (7 pantallas × 2
  vistas). Las lecciones duras (Next 16 bloquea `/_next/*` desde `127.0.0.1`;
  `networkidle` nunca llega con Firestore vivo; el zombi del pipe huérfano)
  quedaron escritas en `V10_BLOCKERS.md`.
- **B-V10-1 RESUELTO**: PR #279 fusionó la rama V9 a main (verificado por
  ancestría, no por acta). `V10-CONSTITUTION-001` desbloqueada.
- **Salidas 14/15 arrancadas con evidencia**: 6 vistas puntuadas
  (`V10_VISUAL_SCORECARD.json`). HOME-001 verificado en producto real:
  el orden de §14 se cumple y el defecto móvil no volvió.
- **5 hallazgos nuevos con captura** en `V10_BACKLOG.json`: hydration
  mismatch en todas las rutas (V10-BUG-001, P1), botonera de /citas
  (cara-de-IA 4.0, la peor), tarjeta móvil que trunca al paciente,
  «Nueva consulta con IA» contra REG-292, tarjetas vacías del expediente.

**Compuertas**: vitest 8580/8581 en verde (el 1 que falla es ambiental de este
contenedor — el proxy contesta 403 a IPs no enrutables y el test de timeout
espera un socket colgado; mismo diagnóstico que la corrida anterior);
lint-trinquete 96 = techo; build en verificación al cierre de la corrida.

## Próxima acción exacta (siguiente corrida)

1. **Puntuar las 8 vistas capturadas sin puntuar** (pacientes, pendientes y
   los 6 móviles restantes) con su captura enfrente — §34 prohíbe rellenar.
2. **V10-BUG-001**: reproducir el hydration mismatch (arnés ya lo enseña en
   consola), encontrar el atributo exacto y arreglarlo con su prueba.
3. Con el arnés vivo: **línea base de accesibilidad** (salida 10) sobre las
   mismas pantallas — axe-core dentro del mismo recorrido.
4. Después: la reparación más barata con mayor evidencia es
   **V10-CONTENIDO-REG292** («Nueva consulta con IA» → «Nueva consulta»), y
   la de mayor peso **V10-AGENDA-BOTONERA** (requiere decisión de jerarquía
   de acciones: una primaria por renglón, el resto al kebab).
