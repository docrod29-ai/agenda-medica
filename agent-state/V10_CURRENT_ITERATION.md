# V10 — Iteración actual

**Directiva**: leer COMPLETO
[`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`](../docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md)
antes de tocar nada. Rama canónica: `claude/nexus-visual-excellence-v10`
(la corrida del 10-ago trabajó en `claude/kind-brahmagupta-ls02dp`, basada en
la punta de la canónica — misma historia, PR aparte).

**Iteración en curso**: `V10-TRUTH-001` — auditoría de verdad visual y de
producto (V10 §47). **15 de 17 salidas cerradas.**

## Estado de V10-TRUTH-001 (17 salidas requeridas)

| # | Salida | Estado | Dónde |
|---|---|---|---|
| 1 | Inventario de pantallas Practice | ✅ | `docs/design/SCREEN_INVENTORY.md` (generado; guardián en CI) |
| 2 | Inventario de capturas escritorio/móvil | ✅ **10-ago** | 32 capturas reales autenticadas: 8 pantallas del golden flow × 4 viewports — `tests/visual/capturas/` |
| 3 | Inventario de tokens de diseño | ✅ | `docs/design/DESIGN_SYSTEM.md` + `agent-state/DESIGN_STATE.md` |
| 4 | Inventario de componentes | 🔄 en curso | `docs/design/COMPONENT_INVENTORY.md` |
| 5 | Inventario de anti-patrones «cara de IA» | ✅ | `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` + por pantalla en el scorecard |
| 6 | Mapa de navegación | ✅ | `docs/design/NAVIGATION_STATE_AUDIT.md` |
| 7 | Mapa de interacción | ⏳ pendiente | `docs/design/INTERACTION_PATTERNS.md` |
| 8 | Defectos de pérdida de estado | ✅ | REG-300…303 (fusionados en main vía PR #279) |
| 9 | Inconsistencias visuales | ✅ | `agent-state/DESIGN_STATE.md` + defectos nuevos medidos (scorecard) |
| 10 | Línea base de accesibilidad | ✅ **10-ago** | `docs/design/ACCESSIBILITY.md` — 8 hallazgos únicos A1-A8, axe crudo en `tests/visual/capturas/axe-*.json` |
| 11 | Línea base móvil | ✅ **10-ago** | capturas 390×844 + puntuaciones móviles del scorecard (promedio 7.26; peor: calendario 4.5) |
| 12 | Línea base de rendimiento | 🔶 parcial | tiempos de navegación por pantalla en `resumen.json` — **modo dev, no producción**; la base de producción queda para V10-PERF-001 |
| 13 | Matriz de principios de competidores | ✅ | `docs/competitive/V10_COMPETITIVE_VISUAL_MATRIX.md` |
| 14 | Puntuación visual por pantalla crítica | ✅ **10-ago** | `agent-state/V10_VISUAL_SCORECARD.json` — 8 pantallas, con evidencia y razonamiento |
| 15 | Puntuación «cara de IA» por pantalla | ✅ **10-ago** | mismo scorecard (promedio 1.75; peor: citas 3.5) |
| 16 | Backlog visual P0–P3 | ✅ **10-ago** | `V10_BACKLOG.json` — 13 defectos medidos nuevos + deuda desbloqueada |
| 17 | Primera iteración de implementación | ✅ | **HOME-001** — `/dashboard`, ahora VERIFICADA en navegador real (capturas del 10-ago) |

## Lo que la corrida del 10-ago-2026 dejó medido (resumen ejecutivo)

- **HOME-001 confirmada en navegador**: cola de atención arriba, agenda a todo
  lo ancho, cero KPI, cero duplicados. El diseño aguanta 390px.
- **Promedios honestos**: escritorio 8.33 / móvil 7.26 / cara-de-IA 1.75 —
  lejos de la meta (9.3 / 9.0 / ≤1.0). Los déficits están concentrados, no
  repartidos: agenda móvil, sobrecarga de citas, y accesibilidad de controles.
- **El peor hallazgo clínico**: los campos de signos vitales de la consulta no
  tienen nombre programático (axe critical ×4) — `V10-A11Y-VITALES`.
- **El peor hallazgo móvil**: el calendario a 390px es la rejilla de
  escritorio encogida (4.5/10) — `V10-AGENDA-MOVIL`.
- 401 de auditoría y agenda vacía por zona horaria eran defectos del ARNÉS,
  no del producto; ambos corregidos y documentados en `V10_BLOCKERS.md`.

## Compuertas de esta corrida (10-ago-2026)

- Cambios de producto: **solo** `src/lib/firebase.ts` (bloque de emulador
  opt-in) y `firebase.json` (puerto del emulador de Auth). Todo lo demás es
  arnés (`scripts/design/`), evidencia (`tests/visual/capturas/`) y estado.
- `npx tsc --noEmit` y `lint-trinquete` — ver bitácora del commit.

## Cerrado también en esta corrida: `V10-A11Y-NOTA` (antes «VITALES»)

El hallazgo A1 se reparó el mismo día: las 4 secciones narrativas de la nota
llevan `aria-label={s.label}` (el DOM vivo desmintió la primera atribución a
los vitales — esos inputs pasan axe) y el botón de cerrar del aviso de
recordatorios dejó de ser mudo. **axe en vivo sobre /consulta: 0 violaciones
(antes 5).** Cerrojo probado al revés:
`src/__tests__/la-nota-se-puede-dictar-a-un-lector.test.ts`.

## DECISIÓN DEL DUEÑO — 10-ago-2026, EN VIVO

> «la app ahora se va llamar **ausculta**»

Registrada en `V10_DECISION_LOG.md` (V10-D2). El renombre de cara al usuario
es trabajo V10 legítimo (marca visible); el renombre profundo (dominios,
repositorio, legales, Stripe) es del dueño. Ver el plan en el log de decisión.

## Cerrado también en esta corrida: `V10-BRAND-AUSCULTA-001`

El renombre visible se ejecutó el mismo día de la orden: 66 archivos, toda
superficie que el usuario ve (login, sidebar, cabecera móvil —adiós «Agenda
Médica»—, tour, manifest, títulos, landing, portal del paciente, documentos
exportados, descripción de eventos de Google Calendar, bot de ayuda, emisor
TOTP). Verificado en navegador (login--1440x900.jpg dice Ausculta).

**Lo que NO se renombró, con razón**: 4 textos legales (el nombre LEGAL lo
decide el dueño — `V10_OWNER_DECISIONS_REQUIRED.md`); identificadores de
contrato (`__NEXUSMED_VERSION`, HL7, Facturama, caché `nexusmed-v*`); y dos
motores UCI sellados cuyo guardián de versión (A6) cazó el cambio de huella
por un comentario — se revirtieron: **la huella de un motor sellado manda
sobre la marca**. Cerrojo de todo esto:
`src/__tests__/la-app-se-llama-ausculta.test.ts` (9 casos).

Pendiente de marca (no de esta unidad): el LOGO sigue siendo la «N» —
rediseñarlo es una decisión de identidad que merece propuesta propia.

## Próxima acción exacta (siguiente corrida)

1. Salidas 4 y 7 de TRUTH-001 (inventario de componentes + mapa de
   interacción) — con eso TRUTH-001 se cierra del todo.
2. Re-correr el arnés de capturas completo para refrescar las 32 evidencias
   con la marca Ausculta (hoy solo login--1440x900 está actualizada).
3. Después, por prioridad del backlog: `V10-CONSTITUTION-001` (deuda
   desbloqueada) y `V10-AGENDA-MOVIL` bajo `V10-AGENDA-001`.
4. Propuesta de logo/wordmark Ausculta (sustituir la «N») — llevarla al dueño
   como opciones, no como hecho consumado.

Para levantar el arnés otra vez: bloque «B-V10-2 · RESUELTO» de
`V10_BLOCKERS.md` (emuladores → siembra → dev con env de emulador → captura).
