# V15 — estado vivo

**Rama canónica:** `v15/structural-uiux` · **PRs V15 abiertos:** 1 (#292)

## Iteración en curso

`V15-PATIENT-WORKSPACE-001` (Fase 4) — EN CURSO, 11-ago-2026: Patient Anchor
entregado y verificado por prueba/fuente; Clinical Spine y Active Patient
Canvas quedan para la corrida siguiente. Ver verificación de navegador abajo.
`V15-TODAY-001` (Fase 3) — cerrada 11-ago-2026. `V15-IA-001` +
`V15-SHELL-GREYBOX-001` cerradas antes, misma fecha.

### V15-IA-001 — CERRADA

- Sitemap nuevo, mapa de capacidades contextuales (dónde quedó cada uno de
  los 23 destinos del `Sidebar` de médico) y plan de compatibilidad de rutas:
  `docs/design/v15/IA-001-sitemap.md`.
- Los cinco contextos fijados por el routine: **TODAY · PATIENT · ENCOUNTER ·
  WORK/FOLLOW-UP · SEARCH/COMMAND**. Ninguna URL existente cambió; sólo cambió
  desde dónde se llega a ella.

### V15-SHELL-GREYBOX-001 — CERRADA (Instrument Strip + Flow Rail + Canvas + operaciones)

- **`src/components/FlowRail.tsx`** — reemplaza `Sidebar` (23 destinos) por 5
  contextos, **sólo en modo médico** (`esMedicoReal && mode === 'medico'`;
  Secretaria sigue con `Sidebar` sin cambio — fuera de alcance de esta fase).
  Greybox real, no sólo revisado así: el estado activo usa `var(--text)`, no
  `var(--nexus)` (clase `.nx-flow-rail` en `globals.css`).
- **`src/components/InstrumentStrip.tsx`** — Capa 1 (peor periférica):
  consultorio + grabación activa con duración, releyendo el mismo
  `EVENTO_GRABANDO` que ya usa `MarcoEscuchando` (no es una segunda fuente de
  verdad). Paciente actual queda para `V15-PATIENT-WORKSPACE-001` (Fase 4) —
  anotado, no rellenado con un placeholder.
- **`src/app/(dashboard)/operaciones/page.tsx`** — índice agrupado de los 18
  destinos que salieron del rail primario (Agenda · Clínico · Negocio ·
  Cumplimiento y documentos · Comunicación · Sistema), filtrado por
  `rutaPermitida` (mismo entitlement que ya regía `Sidebar`).
- Cableado en `src/app/(dashboard)/layout.tsx` (desktop + cajón móvil), con
  guardián que se probó al revés:
  `src/__tests__/v15-flow-rail-cableado.test.ts` — falla si `layout.tsx`
  vuelve a `Sidebar` fijo, y falla si algún `href` de los 23 antiguos se
  queda sin ruta de entrada nueva (FlowRail u Operaciones).
- De paso: la topbar móvil decía «Agenda Médica» mientras el resto de la app
  ya dice «Ausculta» (hallazgo anotado en la corrida de baseline) — corregido
  en el mismo archivo que ya se estaba tocando.

### Verificado en navegador real (11-ago-2026)

Build de producción + emuladores Auth/Firestore + siembra sintética
(`scripts/design/sembrar-capturas.mjs`), igual método que V10-TRUTH-001.
Arnés nuevo: `scripts/design/capturar-flow-rail-v15.mjs`. Capturas en
`docs/design/capturas/v15-shell-greybox/` (desktop 1440 + mobile 390):

- `flow-rail-destinos.json` — el DOM real confirma exactamente 5 destinos:
  Hoy · Paciente · Encuentro · Seguimiento · Operaciones, en las 4 pantallas
  probadas (`/dashboard`, `/pacientes`, `/pendientes`, `/operaciones`).
- `axe.json` — 0 violaciones nuevas. La única violación (`nested-interactive`
  en `/pacientes`, 5 nodos) es **preexistente**: mismo fingerprint exacto que
  `docs/design/capturas/v15-baseline-before/axe-baseline.json`, no la causó
  este cambio.
- Consola: un único warning transitorio de reconexión de Firestore del
  emulador, igual que en la captura de baseline — no es una regresión.
- Móvil sin cambio de comportamiento (`BottomNav` no se tocó esta corrida).

### Compuertas

- `npx vitest run`: 8662 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (los 6
  `fontSize`/1 `borderRadius` fuera de escala que introdujeron los componentes
  nuevos se corrigieron a la escala oficial, no se subió el techo).
- `npm run build`: TypeScript compila limpio. Con `.env.local` demo
  (emuladores) el build completo también compila — `/operaciones` sale como
  ruta estática (`○`) en la salida de Next.
- Guardianes de integridad tocados de paso porque el cambio los movía de
  verdad, no accidentalmente: `el-inventario-de-pantallas-no-miente`
  (regenerado — 80 pantallas, +1 `/operaciones`) y `csp-guard` (`/operaciones`
  añadida a `src/lib/security/rutas-privadas.ts`: zona autenticada, hereda
  cabecera anti-clickjacking igual que cualquier pantalla del dashboard).

### V15-TODAY-001 — CERRADA (zona CONTINUITY añadida a `/dashboard`)

- `/dashboard` ya tenía NOW (`ProxHero`) · NEEDS ATTENTION (`PanelPendientes`)
  · TODAY (sección «Agenda de hoy») desde V10-HOME-001. Esta corrida añadió la
  cuarta zona que faltaba de las cinco de §6:
  **`src/components/ContinuidadPanel.tsx`** — CONTINUITY: lo que cruzó de una
  consulta anterior y sigue sin cerrarse (resultado por revisar, seguimiento,
  reconciliación de medicamento). Lee `tareasVivas()` de
  `src/lib/tareas-clinicas/firestore.ts` — la MISMA fuente que ya usa
  `/pendientes`, no una copia (invariante «una entidad, una fuente de
  verdad» de la carta operativa). Vista previa de 5, ordenada por
  `ordenWorklist`, con «Ver todo» hacia `/pendientes`. Se pinta sola y
  desaparece sola cuando no hay nada abierto — no es un bloque fijo con
  estado vacío.
- **PREPARED BY NEXUS queda deliberadamente sin construir.** No existe hook
  que lea «contexto preparado para el próximo paciente» (mismo hallazgo que
  ya declaró `InstrumentStrip` para «paciente actual»). Se documenta en la
  cabecera de `dashboard/page.tsx` en vez de rellenarse con un placeholder —
  le corresponde a `V15-PATIENT-WORKSPACE-001` decidir qué significa
  «paciente actual» antes de que Nexus pueda preparar algo sobre él.
- Guardián nuevo, probado al revés (igual patrón que
  `v15-flow-rail-cableado.test.ts`):
  `src/__tests__/v15-continuidad-en-hoy.test.ts` — falla si
  `ContinuidadPanel` se escribe y no se importa/renderiza en
  `dashboard/page.tsx`, y falla si el panel abriera su propia consulta a
  `tareas_clinicas` en vez de reusar `tareasVivas()` (duplicaría la fuente de
  verdad). `la-pantalla-de-hoy-no-es-un-tablero.test.ts` (V10) sigue vigente
  sin tocarse: el orden que ya probaba (`ProxHero` → `PanelPendientes` →
  «Agenda de hoy») no cambió, sólo se añadió una zona después.
- `scripts/design/sembrar-capturas.mjs` ahora siembra 3 `tareas_clinicas`
  sintéticas (urocultivo vencido sin dueño, seguimiento de EPOC, reconciliación
  crítica de metformina) — sin esto el arnés de capturas no tenía nada que
  mostrar en la zona nueva.

### Verificado en navegador real (11-ago-2026)

Mismo método que V15-SHELL-GREYBOX-001: emuladores Auth/Firestore + build de
producción + `npm start` contra los emuladores + siembra sintética. Arnés
nuevo: `scripts/design/capturar-today-continuidad-v15.mjs`. Capturas en
`docs/design/capturas/v15-today-continuidad/` (desktop 1440 + mobile 390):

- Las 4 zonas presentes hoy se confirman en el DOM real: NOW (`Próxima cita`
  — condicional, no apareció en esta corrida porque no había cita futura a la
  hora real de la captura, comportamiento existente sin cambio), NEEDS
  ATTENTION (`Siguiente acción`), TODAY (`Agenda de hoy`), CONTINUITY (`Sigue
  abierto de antes`) con sus 3 filas sembradas, en el orden correcto y con el
  escalamiento real de `debeEscalar()` visible («Prioridad crítica sin nadie
  asignado.», «Venció y nadie la tomó.»).
- Móvil: la zona nueva se apila debajo de la agenda sin desbordar, mismo
  patrón de fila que `.cita-fila` ya prueba a 560px.
- `axe.json` (`resultado.json` en la carpeta de capturas): 2 violaciones
  moderadas — **ninguna en `ContinuidadPanel`**. `landmark-unique` en el
  `<aside>` del cajón móvil de `FlowRail` (mismo `aria-label` que la versión
  de escritorio) y `region` en el banner de prueba gratuita (contenido fuera
  de un landmark). Las dos son de componentes que esta corrida no tocó
  (`FlowRail.tsx`, banner de suscripción) — **hallazgo nuevo, no regresión de
  esta corrida**, y queda anotado para que una corrida futura de
  accesibilidad lo tome; no se repara aquí para no salirse de fase.
- Consola: un único warning de reconexión de Firestore del emulador
  («Could not reach Cloud Firestore backend… offline mode»), igual familia
  que el ya visto en V15-SHELL-GREYBOX-001 — no es una regresión de esta
  corrida.

### Compuertas

- `npx vitest run`: 8669 pasan, 0 fallos (la falla ambiental
  `ops-timeout-y-punto-ciego` de la corrida anterior no se repitió en ésta).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva — los dos
  `fontSize` fuera de escala que introdujo el primer borrador de
  `ContinuidadPanel.tsx` (11 y 11.5) se corrigieron a 10.5/12 de la escala
  oficial antes de sellar, no se subió el techo.
- `npm run build`: TypeScript compila limpio; con `.env.local` demo
  (emuladores) el build completo también compila, `/dashboard` sigue
  saliendo como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/dashboard` cambió de
  313 a 321 líneas de fuente) — el guardián `el-inventario-de-pantallas-no-miente`
  lo exigía.

### V15-PATIENT-WORKSPACE-001 — EN CURSO (primera rebanada: Patient Anchor)

- **`src/components/expediente/PatientAnchor.tsx`** — el ancla de §7:
  identidad, edad/sexo/teléfono, alergia/seguridad, encuentro actual y
  último cambio, en UN bloque `position: sticky` dentro de `<main>`
  (`overflowY: auto` del layout del dashboard — el contenedor de scroll
  real). Reemplaza los DOS bloques sueltos e independientes que tenía
  `expediente/[patientId]/page.tsx` al inicio (banner de alergias +
  encabezado `<h1>` de identidad, cada uno con su propio layout): el médico
  ya no concilia dos avisos para "¿en qué paciente estoy y qué necesito
  saber ya?". La página bajó de 686 a 648 líneas de fuente por la
  extracción (regenerado en `SCREEN_INVENTORY.md`).
- **"Encuentro actual"** se deriva de `notas` (la MISMA lista que ya carga
  `useExpediente` en la página, no una consulta nueva a Firestore): la nota
  más reciente sin firmar es un encuentro que empezó y no cerró — misma
  noción que ya usa `CabosSueltosDelPaciente`. Con CTA "Consulta sin
  cerrar — continuar" que lleva a `/consulta/[patientId]?nota=...`.
- **"Último cambio"** se deriva igual: la nota firmada más reciente, con su
  tipo y una fecha relativa ("hace 3 días"), al lado del banner de
  alergias — no un bloque nuevo.
- El banner de alergias conserva exactamente su regla de antes (regla 4 de
  seguridad clínica): SIEMPRE visible, "no registradas" cuando el campo
  está vacío (nunca "sin alergias"), rojo sólo con alergias reales. El caso
  del error de lectura del paciente (antes un `<div>` aparte) también se
  mudó al ancla, en el mismo lugar donde iría el banner.
- Guardián nuevo, probado al revés (mismo patrón que
  `v15-flow-rail-cableado.test.ts`):
  `src/__tests__/v15-patient-anchor-cableado.test.ts` — falla si la página
  deja de importar/renderizar `PatientAnchor`, si los dos bloques viejos
  reaparecen, si el ancla abre su propia consulta a Firestore para
  encuentro/último cambio, si el banner de alergias se vuelve condicional,
  o si pierde el `position: sticky`. Verificado manualmente contra el árbol
  sin el cambio (stash): los 3 casos de "bloques viejos ya no están"
  fallan como se espera.
- `src/__tests__/alergias-placeholder-no-afirma.test.ts` actualizado: el
  caso 3 ahora lee `PatientAnchor.tsx` (donde vive el banner ahora) en vez
  de `page.tsx` — el texto y la regla que prueba no cambiaron, sólo dónde
  vive el JSX.
- Trinquete de diseño: la extracción bajó `tamanosFueraDeEscala` (2007→2004)
  y `radiosFueraDeEscala` (636→635) — resellado a la baja con
  `--actualizar` (nunca se sube, y aquí bajó de verdad).

**Pendiente de esta misma fase, para una corrida siguiente:** Clinical
Spine (recorrido longitudinal por encuentros/diagnósticos/medicamentos/
labs/etc., §7) y Active Patient Canvas (abrir un evento/tarea/nota sin
perder el contexto del paciente). Esta corrida sólo entregó el Patient
Anchor — es una rebanada real y verificable, no la fase completa.

### Verificación en navegador real — EN CURSO al momento de este commit

Mismo método que las corridas anteriores (emuladores Auth/Firestore +
siembra sintética + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-patient-anchor-v15.mjs` (navega a
`/expediente/pac-aurelio-dominguez`, comprueba `.nx-patient-anchor` en el
DOM, hace scroll y confirma que el ancla sigue en el viewport — la parte
de "SIEMPRE visible" verificada como comportamiento, no sólo como CSS
declarado — y corre axe + captura desktop/móvil). El build de producción
(`next build`, requerido para que `npm start` sirva la app con las mismas
condiciones que las corridas previas) estaba en curso cuando se hizo este
commit; **si esta entrada no trae un bloque de resultados de captura
debajo, la verificación de navegador quedó `VISUAL_VERIFICATION: BLOCKED`
para esta corrida** — la corrida siguiente debe completarla ANTES de tocar
la Clinical Spine, no proceder a más UI sin cerrar esto primero.

## Siguiente tarea exacta

Completar la verificación en navegador real del Patient Anchor (arriba) si
no quedó cerrada en esta corrida. Después, seguir con `V15-PATIENT-WORKSPACE-001`:
Clinical Spine + Active Patient Canvas (§7). Es lo que permite que
`InstrumentStrip` pinte «paciente actual» sin inventar un selector nuevo
fuera de fase, y lo que `ContinuidadPanel` necesitaría si algún día
quisiera enlazar directo a un evento en vez de sólo al expediente.
PREPARED BY NEXUS (quinta zona de Hoy) sigue bloqueada hasta que exista un
hook real de «contexto preparado para el próximo paciente» — no antes.

**Deuda anotada, no bloqueante:** dos violaciones axe moderadas
preexistentes en `/dashboard` (landmark duplicado del cajón móvil de
`FlowRail`, banner de suscripción fuera de landmark) — ver arriba. Candidata
para `V15-A11Y-001` cuando llegue esa fase, o para una corrida que pase por
`FlowRail.tsx`/el banner de todos modos.

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo — ya aplicado al código,
  no sólo a una revisión puntual.
- Lógica clínica/negocio congelada: ningún cambio de esta corrida tocó una
  ruta de API, una regla de Firestore ni un cálculo clínico.
- Móvil: `V15-MOBILE-001` (Fase 9) sigue pendiente; `BottomNav` no se tocó.


## Nota de CI — PR #292 (11-ago-2026)

`e2e-publico` (A3 · /operaciones anti-clickjacking) sale rojo en el PR y es
**esperado**, no un defecto: `e2e/seguridad.spec.ts` corre contra
PRODUCCIÓN a propósito (sin `PLAYWRIGHT_BASE_URL` en el job), y `/operaciones`
todavía no está desplegada ahí. Mismo patrón que REG-054/REG-062 en
`docs/audit/regression-ledger.md`: «CLOSED en código, PENDIENTE DE
DESPLIEGUE». Verificado local (`next build && next start`) que la cabecera
sale correcta. No tocar el workflow para «arreglarlo» — se resuelve solo al
fusionar y desplegar. Detalle en el comentario del PR.
