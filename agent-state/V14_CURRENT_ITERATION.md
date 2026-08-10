# V14 — Iteración actual

**Directiva**: leer COMPLETA
`docs/ai/NEXUSMED_MASTER_LOOP_V14_UNIFIED_CATEGORY_DIFFERENTIATION.md`
antes de decidir trabajo. No se resume, no se sustituye por un plan propio.

**Rama canónica**: `claude/nexus-master-loop-v14`, nacida el 10-ago-2026 de la
línea V10 reconciliada (`kind-brahmagupta-ajtolc` = main `56d9fc7a` + toda la
cadena V10). Las corridas programadas que nazcan en rama de sesión siguen el
protocolo anti-fragmentación de `V10_CURRENT_ITERATION.md` (fetch → punta más
avanzada → fusionar antes de trabajar → dejar puntero).

## Iteración: `V14-INSTALL-001` — en curso (10-ago-2026)

Hecho en esta corrida:

- Directiva V14 instalada íntegra (1 885 líneas) en su ruta canónica.
- CLAUDE.md apunta a V14 y declara que supersede a V10 en diseño/flujo/evidencia.
- Identity Lock instalado como autoritativo: `docs/design/NEXUS_IDENTITY_LOCK_V1.md`.
- Estado V14 (`agent-state/V14_*`), constitución de flujos, PARITY+, política de
  claims, registro de benchmarks y sala DD creados **sin fabricar evidencia**:
  todo lo no medido dice UNKNOWN / NOT RUN.
- Conflictos con rutinas activas identificados → `V14_DECISION_LOG.md`.

## V14-TRUTH-001 — qué YA está validado (no repetir)

La rama base trae verdad de producto medida en navegador real (V10-TRUTH-001,
cerrada dos veces y reconciliada):

- capturas de dos arneses (público + golden flow autenticado con emuladores);
- scorecard con revisor independiente; 14/14 vistas puntuadas;
- líneas base axe unidas (0 critical en el flujo tras reparaciones);
- hidratación 28→0 avisos, con guardián;
- HOME-001 verificado en navegador (8.6 visual / 1.0 generic);
- AGENDA-IDENTITY-001: /citas como riel del día, axe 0 en 1440/390,
  IDENTITY 7.5 por revisor independiente («los controles delatan librería»).

**Delta pendiente de TRUTH bajo criterios V14** (lo nuevo que V14 pide y V10 no
midió): Logo-Off test formal por pantalla crítica, Three-Second test, scores
IDENTITY/GENERIC bajo la identidad Cantera+Instrumento (los previos se midieron
contra la identidad cobalto, hoy superada), y estado de los 22 golden workflows.

## El P0 de convergencia (V14 §11), ya identificado con evidencia

El revisor independiente de la rama base lo dejó escrito antes de que V14 lo
nombrara: **el shell es un almacén de funciones** — sidebar de ~22 destinos por
módulo, FABs que tapan contenido clínico, marca partida en tres, «Nueva cita»
duplicada a 768px. Es literalmente la falla que §11 declara P0.

## Próxima acción exacta (siguiente corrida)

1. **`V14-IDENTITY-001`** — implementar los tokens del Identity Lock en
   `globals.css` (@theme `nx-*` ya existe como mecanismo; migrar valores a la
   paleta Cantera+Instrumento), tipografías (Bricolage Grotesque / Instrument
   Sans / Spline Sans Mono), radios 4/10/14, y retirar la deriva cobalto.
   Verificar EN NAVEGADOR (arnés existente), re-puntuar contra Logo-Off.
2. **`V14-SHELL-001`** — matar el sidebar-almacén: arquitectura
   NOW/PATIENT/ENCOUNTER/ATTENTION/CONTINUITY (§1, §15). No renombrar menús:
   cambiar la arquitectura de información.
3. Re-captura de /dashboard y nota--* (deuda de evidencia heredada de V10).

## Compuertas de esta corrida (10-ago-2026)

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 636 pasan · 1 fallo de entorno** (`ops-timeout`, host inalcanzable simulado que en este sandbox no cuelga — preexistente y documentado en el checkpoint V9). Dos guardianes que fallaban **en la base** quedaron reparados en esta corrida: inventario de pantallas regenerado (`/citas` 970→1017 tras AGENDA-IDENTITY-001) y techo de diseño sellado sin holgura (2008→2007, el trinquete BAJA) |
| `lint-trinquete` | **96 = techo**, sin deuda nueva |
| `npm run build` | **Compilación y TypeScript limpios**; falla la recolección de page-data de `/dr/[clinicId]` por `auth/invalid-api-key` — este entorno cloud no tiene `.env.local`. Ambiental, no del cambio (el cambio es docs+estado) |
| navegador | **NO ejecutado** — no se tocó UI; la evidencia vigente es la heredada (a63fefe7, b6a8c343). El arnés requiere build con `.env.local`, ausente aquí |
