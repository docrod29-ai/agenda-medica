# V14 — Iteración actual

**Directiva**: leer COMPLETA
`docs/ai/NEXUSMED_MASTER_LOOP_V14_UNIFIED_CATEGORY_DIFFERENTIATION.md`
antes de decidir trabajo. No se resume, no se sustituye por un plan propio.

**Rama canónica**: `claude/nexus-master-loop-v14`, nacida el 10-ago-2026 de la
línea V10 reconciliada (`kind-brahmagupta-ajtolc` = main `56d9fc7a` + toda la
cadena V10). Las corridas programadas que nazcan en rama de sesión siguen el
protocolo anti-fragmentación de `V10_CURRENT_ITERATION.md` (fetch → punta más
avanzada → fusionar antes de trabajar → dejar puntero).

## Iteración: `V14-IDENTITY-001` + `V14-SHELL-001` — en curso (10-ago-2026, 2ª corrida)

El dueño resolvió **OD-2 por escrito**: Cantera+Instrumento gana, el cobalto
V10 no se conserva. Orden ejecutiva: IDENTITY-001 → SHELL-001 con el P0 del
sidebar-almacén. Hecho en esta corrida:

- **IDENTITY-001 (nivel token, completo)**: `:root` migrado entero al Identity
  Lock (canvas alabastro, marca jamaica, tinta café, radios 4/10/14, elevación
  plano/elevado, movimiento ≤300ms, banda de instrumentos como tokens).
  Identidad ÚNICA: los bloques claro/oscuro y el ThemeToggle de la era cobalto
  se retiraron (D-5); el mutador pre-pintada ahora LIMPIA `data-theme`.
  Fuentes: Instrument Sans (cuerpo), Spline Sans Mono (numéricos), Bricolage
  Grotesque (display) vía next/font. OG image en identidad nueva.
  Hallazgo AA honesto: `ink-tertiary` #A79B8D = 2.4:1 → NO es texto; quedó
  decorativo (`--ink-terciario`) y el texto terciario usa ink-secondary.
- **SHELL-001 (P0 §11)**: el sidebar deja de ser una lista plana de 22
  módulos. Primaria clínica: AHORA (Hoy/Agenda/Agendar/Lista de espera) ·
  PACIENTE (Consulta/Pendientes/Hospitalización/UCI/Continuidad) · CLÍNICA
  (Consultor IA/Antibiograma). Infraestructura (CRM, Finanzas, Reseñas,
  Cumplimiento, Legal, Migración, Calendario, Chat, Farmacia, Membresías) en
  grupo plegado «Consultorio» con aria-expanded, badge de chat que sube al
  encabezado si el grupo está cerrado, y auto-apertura si la ruta activa vive
  dentro. Móvil: el 4º destino del médico pasa de CRM a Pendientes (cierre
  clínico). Guardián nuevo: `el-menu-no-es-un-almacen-de-modulos.test.ts`
  (probado al revés). Nada se volvió inalcanzable.
- Trinquete de diseño BAJÓ y se reselló exacto: hex 557→554, radios 637→635.

## Iteración anterior: `V14-INSTALL-001` — CERRADA (10-ago-2026)

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

1. **`V14-IDENTITY-002`** — barrer los ~554 hex de la era anterior pantalla a
   pantalla CON navegador (empezar por login, portada y /mi/[token]: son las
   superficies públicas que siguen oscuras-cobalto sobre el shell alabastro).
2. **Banda de Instrumentos y Sello** como componentes (elementos de firma del
   Lock) — la banda entra con Modo Encuentro.
3. Re-puntuar Logo-Off / Generic-AI-Look bajo la identidad nueva (los scores
   V10 quedaron obsoletos) y re-capturar el golden flow como líneas base.
4. OD-4 (paleta nocturna: hoy identidad única) espera decisión del dueño.

## Compuertas de esta corrida (10-ago-2026)

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 636 pasan · 1 fallo de entorno** (`ops-timeout`, host inalcanzable simulado que en este sandbox no cuelga — preexistente y documentado en el checkpoint V9). Dos guardianes que fallaban **en la base** quedaron reparados en esta corrida: inventario de pantallas regenerado (`/citas` 970→1017 tras AGENDA-IDENTITY-001) y techo de diseño sellado sin holgura (2008→2007, el trinquete BAJA) |
| `lint-trinquete` | **96 = techo**, sin deuda nueva |
| `npm run build` | **Compilación y TypeScript limpios**; falla la recolección de page-data de `/dr/[clinicId]` por `auth/invalid-api-key` — este entorno cloud no tiene `.env.local`. Ambiental, no del cambio (el cambio es docs+estado) |
| navegador | **NO ejecutado** — no se tocó UI; la evidencia vigente es la heredada (a63fefe7, b6a8c343). El arnés requiere build con `.env.local`, ausente aquí |
