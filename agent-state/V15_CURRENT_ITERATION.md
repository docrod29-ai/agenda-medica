# V15 — estado vivo

**Rama canónica:** `v15/structural-uiux` · **PRs V15 abiertos:** 1 (#292)

## Iteración en curso

`V15-ENCOUNTER-MODE-001` (Fase 5) — EN CURSO, 11-ago-2026 (segunda
rebanada: Firmar y cerrar nota domina el cierre, §8.6). Ver sección propia
abajo. Primera rebanada (FlowRail se aquieta al grabar, §8.1) y
`V15-PATIENT-WORKSPACE-001` (Fase 4) — CERRADAS 11-ago-2026 (ver secciones
abajo). `V15-TODAY-001` (Fase 3), `V15-IA-001` y `V15-SHELL-GREYBOX-001` —
cerradas antes, misma fecha.

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

### V15-PATIENT-WORKSPACE-001 — CERRADA (segunda rebanada: Clinical Spine)

- **`src/components/expediente/ClinicalSpine.tsx`** — el riel de §7: "a
  longitudinal structural element... should allow movement through
  encounters, diagnoses, medications, labs...". Antes de esta corrida el
  expediente era una pila lineal sin forma de moverse entre categorías
  salvo la rueda del ratón. El riel sólo enseña las categorías que
  **de verdad tienen algo para ESE paciente** ("señalar de menos, nunca de
  más" — regla 5 de seguridad clínica aplicada a navegación, no sólo a
  vocabulario clínico): Encuentros siempre (incluso en 0, es el corazón del
  expediente), Diagnósticos y medicamentos / Pendientes / Ingresos sólo
  cuando ya cargaron y hay algo. Microbiología, imágenes, procedimientos,
  órdenes y comunicaciones **no tienen todavía sección propia** en esta
  pantalla — no se inventan entradas para secciones que no existen; quedan
  para cuando esas pantallas se construyan.
- **Ningún conteo se inventa ni se recalcula dos veces.** `problemas`/
  `vigentes` se levantaron de la IIFE local (que ya existía, REG-262) a un
  `useMemo` de la página: el bloque "Problemas/Toma" y el riel leen el
  MISMO cálculo. Para Pendientes/Ingresos —cuyos datos vive dentro de
  `CabosSueltosDelPaciente`/`InternamientosDelPaciente`— se añadió un
  callback opcional (`onResumen`/`onCargado`) que reporta hacia arriba lo
  que esos componentes YA leyeron, con un `ref` para que el callback no
  entre al array de dependencias del efecto de carga (si entrara, una
  función inline nueva en cada render releería Firestore sin que
  `clinicId`/`patientId` hubieran cambiado). Ninguna de las tres fuentes se
  duplicó.
- **Interacción real, no sólo un índice de atajos**: `IntersectionObserver`
  resalta (`aria-current`) la categoría que el médico está leyendo mientras
  baja con la rueda — no sólo tras pulsar un botón. Verificado con scroll
  real (ver abajo), no sólo leído en el código.
- **Greybox real**: estado activo en `var(--text)`/`var(--bg)`, no
  `var(--nexus)` — mismo patrón que ya fijó `FlowRail.tsx` en
  `V15-SHELL-GREYBOX-001`; el acento de marca espera a
  `V15-VISUAL-SYSTEM-001` (Fase 10).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-clinical-spine-cableado.test.ts` — falla si la página
  deja de importar/renderizar `ClinicalSpine`, si un item del riel apunta a
  un ancla que no existe en el DOM, si `ClinicalSpine.tsx` ganara su propia
  consulta a Firestore, o si `onResumen`/`onCargado` entraran al array de
  dependencias del efecto de carga (11 de 15 casos fallan contra el árbol
  sin el cambio — verificado con `git stash`).
- Dos pruebas existentes se actualizaron para reflejar la MISMA conducta con
  forma de código distinta (el `if (...) return null` de la IIFE pasó a
  condición de render; el `.catch` de `InternamientosDelPaciente` ahora
  también reporta `null` hacia arriba): `el-expediente-resume-el-estado.test.ts`
  y `el-expediente-ensena-los-ingresos.test.ts`. Ninguna prueba se debilitó
  — se comprobó que las dos siguen fallando si se revierte la conducta real
  que protegen.
- **Hallazgo y arreglo de paso, encontrado por este mismo arnés**: axe marcó
  `button-name` (crítico) en `NotificacionesPushOptIn.tsx` — el botón de
  cerrar el banner de recordatorios de citas (`<X size={14} />` sin texto ni
  `aria-label`) no tenía nombre accesible. Preexistente, no causado por esta
  corrida (el componente vive fuera del expediente y no se tocó su lógica),
  pero se arregló aquí por ser un cambio de una línea, seguro, y porque el
  propio arnés de esta corrida lo encontró — mismo criterio que ya usó
  `V15-PATIENT-WORKSPACE-001` (primera rebanada) con el `<h1>` perdido.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore + build
de producción + `npm start` + siembra sintética). Arnés nuevo:
`scripts/design/capturar-clinical-spine-v15.mjs` — no sólo screenshot: prueba
comportamiento real. Capturas en `docs/design/capturas/v15-clinical-spine/`
(desktop 1440 + mobile 390):

- **El riel real, con datos reales**: `Encuentros 0 · Laboratorios y
  fotografía · Pendientes 1` — exactamente las 3 categorías que este
  paciente sintético tiene (0 encuentros, 0 diagnósticos/medicamentos
  firmados, 1 pendiente en plazo, 0 ingresos) — ninguna categoría vacía se
  enseña.
- **Clic navega, medido de verdad**: se pulsó el botón "Pendientes" y se
  midió `getBoundingClientRect().top` de su ancla (`#spine-pendientes`)
  antes (694.5px) y después (312.5px) del `scrollIntoView` suave. Se movió
  382px hacia arriba — el máximo físicamente posible en esta página
  (documento de 1282px de alto, viewport de 900px) — y quedó visible en
  pantalla.
- **Scroll resalta, medido de verdad**: tras volver a `scrollTop=0` y bajar
  900px con la rueda, `aria-current` pasó de "Pendientes" a "Laboratorios y
  fotografía" — el `IntersectionObserver` responde a scroll real, no sólo
  a clics.
- **Axe, 0 violaciones nuevas** tras el arreglo de `button-name`: quedan las
  dos familias ya conocidas y preexistentes — `landmark-unique` (cajón móvil
  de `FlowRail`) y `region` (banner de prueba gratuita / banner de push,
  ninguno dentro de `.nx-clinical-spine`, confirmado inspeccionando los
  `target` de axe).
- **Consola**: sin errores nuevos en desktop; el único mensaje en móvil es
  el warning ya familiar de reconexión de Firestore del emulador.
- **Móvil**: el riel se desplaza horizontalmente sin desbordar la pantalla
  (mismo patrón `overflowX: auto` que ya usan los filtros Todas/Consulta/
  Hospital de esta misma pantalla).

### Compuertas de esta corrida (Clinical Spine)

- `npx vitest run`: 8696 pasan, 0 fallos propios (la falla ambiental
  `ops-timeout-y-punto-ciego` es intermitente por el proxy de red del
  contenedor — reproduce igual en el árbol limpio, no relacionada).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores); `/expediente/[patientId]`
  sigue en la lista de rutas dinámicas del build.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/expediente/[patientId]`
  pasó de 648 a 701 líneas de fuente por la extracción del riel y el
  `useMemo` compartido).

### Verificación en navegador real — CERRADA (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore +
siembra sintética + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-patient-anchor-v15.mjs` (navega a
`/expediente/pac-aurelio-dominguez`, un paciente sintético con una nota
firmada y una en borrador sembradas para esta verificación — ver siembra
ad-hoc, no forma parte del repo). Capturas en
`docs/design/capturas/v15-patient-anchor/` (desktop 1440 + mobile 390):

- **El ancla real, con datos reales**: `Aurelio Domínguez Peña · 72 años ·
  Masculino · +52 55 5555 0101 · Consulta sin cerrar — continuar · Alergias:
  Penicilina (rash generalizado, 2019) · Último cambio: Nota de Seguimiento
  · hace 10 días`. Las cinco piezas de §7 (identidad, edad/sexo, alergia,
  encuentro actual, último cambio) están en el DOM real, no sólo en el JSX.
- **"SIEMPRE visible" verificado como COMPORTAMIENTO**: se leyó
  `getBoundingClientRect().top` del ancla antes y después de hacer scroll
  600px dentro de `<main>` — 106.5px en los dos casos (`siguePegado: true`).
  Si no fuera `sticky` de verdad, el segundo valor habría sido muy negativo.
- **`page-has-heading-one` — DEFECTO ENCONTRADO Y ARREGLADO por este mismo
  arnés**: la primera captura (antes de este hallazgo) mostró una violación
  axe nueva que NO estaba en la línea base: al mover la identidad del
  paciente de un `<h1 className="t-h1">` a un `<div>` dentro del ancla, la
  página se quedó sin su único encabezado de nivel 1. Arreglado devolviendo
  el nombre del paciente a un `<h1>` (ahora dentro de `PatientAnchor.tsx`).
  Recapturado: la violación desaparece, quedan sólo las dos preexistentes.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2 nodos, el `<aside>`
  del cajón móvil de `FlowRail`) y `region` (2-3 nodos, el banner de prueba
  gratuita) — **mismo fingerprint exacto** que
  `docs/design/capturas/v15-today-continuidad/resultado.json`: ninguna de
  las dos vive en `.nx-patient-anchor` (confirmado inspeccionando los
  `target` de axe), y esta corrida no tocó ni `FlowRail.tsx` ni el banner.
- **Móvil**: hallazgo de pulido encontrado por la propia captura — el CTA
  "Consulta sin cerrar — continuar" compartía fila con el nombre partido en
  varias líneas y quedaba apretado a media altura. Arreglado con una regla
  `@media (max-width: 480px) { flex-basis: 100% }` sobre el botón (mismo
  patrón que `exp-actions` en la página, DEBT-006): pasa a su propia fila
  completa sin tocar el DOM ni el layout de escritorio.
- **Consola**: el único hallazgo nuevo (no visto en capturas V15 previas) es
  un `401 Unauthorized` en la escritura de bitácora (`logAudit` de
  `login_exitoso`/`expediente_lectura`) contra los emuladores — código que
  esta corrida NO tocó (vive en `layout.tsx` y en el `useEffect` de
  `expediente/[patientId]/page.tsx` desde antes de V15). Es un artefacto del
  arnés de emuladores (el token del emulador no valida igual contra la ruta
  de auditoría que un ID token real), no una regresión de este cambio — se
  deja anotado para quien retome el arnés de capturas en general, no se
  investiga más aquí por no salirse de fase.

### Compuertas de esta corrida

- `npx vitest run`: 8677 pasan, 1 skip, 0 fallos (dos fallos vistos en un
  corrida intermedia — `ops-timeout-y-punto-ciego` y `la-agenda-es-un-riel`
  — resultaron ser contención de recursos al correr la suite completa en
  paralelo: ambos pasan en aislamiento y en la corrida completa final).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: bajó de verdad
  (`tamanosFueraDeEscala` 2007→2004, `radiosFueraDeEscala` 636→635),
  resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) igual que las
  corridas anteriores.

### V15-PATIENT-WORKSPACE-001 — Active Patient Canvas, DECISIÓN (11-ago-2026, tercera rebanada)

La pregunta que dejó la corrida anterior: de los botones de `NotaCard`
(`onEditar`/`onImprimir`/`onGenerarReceta`/`onGenerarOrden`) y de
`CabosSueltosDelPaciente.alAbrirPendientes`, ¿cuáles navegan a un modo
DISTINTO legítimo (§8, Encounter Mode) y cuáles deberían abrir sin perder el
ancla/riel? Se investigó cada uno antes de tocar código — la respuesta no
era la misma para los cinco:

- **`onEditar`** (`/consulta/[patientId]?nota=...`, continuar un encuentro sin
  cerrar) — modo distinto legítimo. Es exactamente la entrada a Encounter
  Mode (§8, Fase 5, todavía sin construir); forzarlo a abrir inline
  adelantaría trabajo de una fase que aún no arrancó. **Sin cambio.**
- **`onImprimir`** (`/nota/[pid]/[id]`) — genera un documento para imprimir:
  necesita su propia página con hoja de estilo de impresión, no un panel
  dentro del expediente. **Sin cambio.**
- **`onGenerarReceta`/`onGenerarOrden`** (`/receta/...`, `/orden/...`) — el
  propio master loop los nombra explícitamente en la Fase 8 («Integrate
  Note → Rx → Orders → Instructions → Follow-up», §33, DESPUÉS de Encounter
  Mode/Results-Closure/Follow-up). Adelantarlos aquí sería invertir el orden
  obligatorio de fases (§18). **Sin cambio, diferido a Fase 8 a propósito —
  no es un olvido.**
- **`CabosSueltosDelPaciente.alAbrirPendientes`** (`/pendientes`, worklist
  global) — se investigó si esto es el defecto real de «reseteo mental» y
  NO lo es: `src/__tests__/los-cabos-sueltos-del-paciente.test.ts` (caso «el
  componente no cierra tareas») ya prueba, con su razón escrita en el propio
  componente, que CERRAR una tarea exige la validación de `cambiarEstado`
  (transiciones legales del modelo) y que repetirla aquí la desalinearía en
  la primera prisa. Además el componente YA enseña el detalle completo
  in-line (título, grupo, días vencido, dueño) — **leer** un pendiente de
  este paciente no pierde el ancla; sólo **cerrarlo** navega, y eso es
  correcto por diseño ya probado. Revertir esa decisión sin motivo nuevo
  contradiría un guardián existente. **Sin cambio.**

Con los cinco candidatos resueltos como modos legítimos o fases diferidas a
propósito, lo que SÍ quedaba genuinamente pendiente de §7 no era ninguno de
ellos: era `InstrumentStrip` sin pintar «paciente actual» — anotado desde
`V15-SHELL-GREYBOX-001` y otra vez al cierre de la corrida anterior («ahora
que el Patient Anchor existe, esa corrida puede decidir qué significa
"paciente actual" fuera del expediente»). Ver entrega abajo.

### `InstrumentStrip` pinta «paciente actual» (11-ago-2026, tercera rebanada)

- **`src/lib/nav/paciente-de-la-ruta.ts`** (módulo puro, nuevo) —
  `patientIdDeLaRuta(pathname)` deriva el `patientId` de la URL para las seis
  rutas que lo llevan como primer segmento dinámico (`expediente`,
  `consulta`, `nota`, `receta`, `orden`, `referencia`). No toca Firestore: es
  URL, no una consulta.
- **`src/components/InstrumentStrip.tsx`** — añade `usePacienteActual()`,
  que llama `getPatient()` de `@/lib/firestore` — LA MISMA función, con el
  mismo alcance de clínica, que ya usan expediente/consulta/receta/orden/
  nota/referencia — no una lectura nueva con su propio criterio de permisos
  (la razón por la que esto quedó pendiente desde V15-SHELL-GREYBOX-001).
  El nombre se muestra como enlace de vuelta a `/expediente/[patientId]`
  (continuidad, §20). Así el médico no pierde de vista EN QUIÉN ESTÁ al
  pasar del expediente a `/receta`/`/orden`, aunque esas pantallas sigan
  sin tocarse (Fase 8, diferida a propósito — ver decisión arriba).
- **Nunca enseña el paciente ANTERIOR mientras carga el siguiente**: el
  hook guarda el último `{id, nombre}` resuelto y sólo lo devuelve si ese
  `id` coincide con el `patientId` de la URL actual — filtrado derivado en
  el valor de retorno, no un `setState(null)` a ciegas al principio del
  efecto (la primera versión SÍ lo hacía así; `node scripts/lint-trinquete.mjs`
  lo cazó como `react-hooks/set-state-in-effect` antes de sellarse — ver
  compuertas abajo).
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/paciente-de-la-ruta.test.ts` (la función pura — qué
  rutas SÍ llevan paciente y cuáles no, con `/hospitalizacion/[id]` como
  caso trampa porque su segundo segmento es un internamiento, no un
  paciente) y `src/__tests__/v15-instrument-strip-paciente-actual.test.ts`
  (que reutiliza `getPatient` en vez de una consulta propia, que filtra por
  id antes de enseñar, y que no volvió al patrón de `setState` síncrono que
  cazó el trinquete de lint).

**Pendiente, no bloqueante:** PREPARED BY NEXUS (quinta zona de Hoy) sigue
sin construirse — depende de la MISMA pregunta de «paciente actual» fuera
del expediente, pero para el caso «próximo paciente de la agenda», que es
distinto al caso que esta corrida resolvió («paciente cuya pantalla estoy
viendo ahora»). Candidata para una corrida futura de `V15-TODAY-001` o de
esta misma fase si vuelve a abrirse.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores: emuladores Auth/Firestore reales
+ siembra sintética (`scripts/design/sembrar-capturas.mjs`) + build de
producción + `npm start`. Arnés nuevo: `scripts/design/capturar-instrument-strip-paciente-v15.mjs`.
Capturas en `docs/design/capturas/v15-instrument-strip-paciente/` (desktop
1440 + mobile 390):

- **Persiste al salir del expediente, medido de verdad, no leído en JSX**:
  la franja dice `Ausculta · Aurelio Domínguez Peña` en `/expediente/
  pac-aurelio-dominguez` Y en `/referencia/pac-aurelio-dominguez` (Carta de
  referencia — pantalla sin ningún otro rastro del paciente en su UI salvo
  el formulario) — la razón de ser de este cambio, confirmada con el
  paciente real.
- **Se limpia al salir a una pantalla sin paciente**: en `/dashboard` la
  franja vuelve a decir sólo `Ausculta`, sin arrastrar el nombre del
  paciente anterior.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2 nodos) y `region`
  (2-3 nodos) — mismas dos familias preexistentes ya documentadas en
  `v15-today-continuidad` y `v15-patient-anchor` (cajón móvil de `FlowRail`
  y banner de prueba gratuita), ninguna en `.nx-instrument-strip`.
- **Consola**: sin errores, en desktop ni en móvil.
- **Móvil**: el nombre cabe en la segunda fila de la franja sin desbordar
  ni truncarse con este paciente; queda anotado como algo a vigilar con
  nombres más largos cuando `V15-MOBILE-001` (Fase 9) recomponga el shell
  completo, no se resuelve aquí por no salirse de fase.
- Nota operativa para quien retome el arnés de capturas en general: la
  siembra de `sembrar-capturas.mjs` vive bajo el proyecto de emulador
  `demo-nexusmed-test` (hardcoded en el script), NO `demo-nexusmed-v10` que
  usa la familia `arnes:*` de V10 — arrancar los emuladores con
  `--project demo-nexusmed-v10` (como sugiere `package.json`) siembra y
  sirve la app en proyectos distintos y el login falla en silencio con
  `EMAIL_NOT_FOUND` sin que nada lo señale como error de proyecto. Costó
  tres reconstrucciones de `npm run build` en esta corrida diagnosticarlo
  (las variables `NEXT_PUBLIC_FIREBASE_*` se hornean en el build, no se
  leen en caliente) — se deja escrito aquí para que la próxima corrida no
  lo repita.

Con la decisión de Active Patient Canvas tomada y `InstrumentStrip`
entregado, **`V15-PATIENT-WORKSPACE-001` (Fase 4) puede darse por
CERRADA** — sigue `V15-ENCOUNTER-MODE-001` (Fase 5) como siguiente tarea
exacta para la corrida que retome este routine.

### V15-ENCOUNTER-MODE-001 — medición de baseline (11-ago-2026)

Antes de tocar código se leyó completo `src/app/(dashboard)/consulta/
[patientId]/page.tsx` (5881 líneas) y se comparó contra el ciclo de vida y
los 9 comportamientos de §8 (misma disciplina que `V15-BASELINE-001` aplicó
a la navegación). Resumen:

- **No existe una máquina de estados de "encounter"** — confirmado por grep
  (`encounterPhase`/`estadoEncuentro`/`EncounterMode`: 0 resultados). Las 10
  fases de §8 existen como FUNCIONALIDAD (nada clínico falta) pero ninguna
  existe como fase visual o de navegación: todo vive en una sola columna de
  ~2000 líneas de JSX gobernada sólo por `audio.estado` y `firmada`.
- **De los 9 comportamientos de §8**: 3 cumplen (grabación inconfundible,
  contexto clínico siempre disponible, transcripción opcional), 1 cumple
  sólo al inicio (acción primaria dominante — `EmpezarAGrabar`, ejemplar),
  2 parciales, **2 NO cumplen**: #1 «navigation visually quiets» y #5
  «nonessential admin disappears».
- **#1 medido como el más lejano y el más seguro/barato de arreglar**: la
  infraestructura de señal (`EVENTO_GRABANDO`) ya existe y ya la consumen
  `MarcoEscuchando` e `InstrumentStrip` — pero `FlowRail.tsx` no tenía
  NINGUNA referencia a ella. Con el marco perimetral encendido durante la
  grabación, la navegación de al lado no reaccionaba en absoluto. Rebanada
  elegida para esta corrida.
- Riesgo de lógica clínica evaluado y documentado: todo lo que se tocó en
  esta corrida es JSX/CSS del shell (`FlowRail.tsx`, `globals.css`) — cero
  archivos de `src/lib/asr/`, `src/lib/expediente/`, `src/lib/seguridad/`,
  ni hooks de grabación.

### FlowRail se aquieta al grabar (§8.1) — primera rebanada de Encounter Mode

- **`src/components/FlowRail.tsx`** — nuevo hook `useGrabando()`, suscrito al
  MISMO `EVENTO_GRABANDO` que ya escuchan `MarcoEscuchando` e
  `InstrumentStrip` (no es una fuente de verdad nueva). El `<aside>` añade
  `nx-flow-rail--quieto` mientras `activo === true`.
- **Hallazgo de esta misma corrida, encontrado por su propio arnés**: el
  primer intento atenuaba con `opacity` plano TODO lo no esencial, ETIQUETAS
  de texto incluidas. `scripts/design/probar-opacidad-quieta-v15.mjs` (axe
  real contra el riel real, no lectura de JSX) lo cazó como una violación
  `color-contrast` NUEVA — `--text3` sobre `--s1` en modo oscuro mide apenas
  ~5.6:1, sin margen para atenuar sin caer bajo el mínimo AA de 4.5:1. Subir
  la opacidad hasta un valor que pasara AA (~0.95) dejaba el atenuado
  invisible: ni cumplía §8.1 ni pasaba la compuerta de accesibilidad. Se
  midió el margen real con el mismo arnés (0.42→11 nodos, 0.85→2 nodos,
  0.95→0) antes de decidir la forma final — no se adivinó un valor.
- **Forma final, sin ese conflicto**: separa qué se atenúa de qué
  desaparece. `.nx-flow-rail-quiet-icon` (SVG decorativos: marca, lupa,
  cerrar sesión, e íconos de ítems NO activos vía
  `.nav-item:not(.active) .nav-icon`) usa `opacity` — sujeto al umbral
  WCAG 1.4.11 no-textual (3:1, no 4.5:1), verificado en 0 violaciones entre
  0.3–0.5. `.nx-flow-rail-quiet-hide` (texto puramente secundario y NO
  interactivo: nombre del médico, correo bajo "Cerrar sesión", atajo "⌘K",
  rótulo "Operaciones") usa `display:none` de verdad — seguro porque ninguno
  de esos nodos recibía el foco de teclado, así que no hay tabulación que
  perder; es además la lectura correcta de §8.5 («nonessential admin
  disappears»). **Las etiquetas de navegación (Hoy/Paciente/Encuentro/
  Seguimiento/Operaciones) y el nombre del consultorio no se tocan** — se
  quedan con su contraste de siempre; regla 6 de seguridad clínica en
  lenguaje de interfaz: bajar contraste en la navegación por estética no
  vale el precio de un defecto de accesibilidad bloqueante (§24).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-flow-rail-se-aquieta-al-grabar.test.ts` — 9 de sus 20
  casos fallan contra el árbol previo a este cambio (verificado con
  `git stash`), incluido el caso que habría dejado pasar la PRIMERA versión
  con opacidad plana sobre texto si no se hubiera corregido.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore +
siembra sintética + build de producción + `npm start`). El evento se simuló
con el mismo `CustomEvent('nx:grabando', {detail:{activo}})` que dispara
`avisarEscucha()` — no se activó el micrófono real, que no es lo que este
cambio toca. Arnés nuevo: `scripts/design/capturar-flow-rail-quieto-v15.mjs`.
Capturas y medición en
`docs/design/capturas/v15-encounter-mode-flow-rail-quieto/` (desktop 1440):

- **Antes de grabar**: `claseQuieto=false`, íconos y etiquetas en opacidad 1,
  las 8 piezas de texto secundario visibles.
- **Grabando, en `/expediente/[patientId]` (activo="Paciente") y en
  `/consulta/[patientId]` (activo="Encuentro")**: `claseQuieto=true`, los 14
  íconos no-activos bajan a 0.4, las 8 piezas de texto secundario se ocultan
  — Y las 10 etiquetas de navegación + el nombre del consultorio + el ícono y
  la etiqueta del contexto activo se quedan en opacidad 1, sin tocar.
  Confirmado con datos reales, no leído en JSX.
- **Después de grabar**: los tres grupos vuelven exactamente a su estado
  inicial.
- **Foco de teclado**: el ícono dentro del botón enfocado (`Buscar…`) vuelve
  a opacidad 1 mientras el resto del riel sigue atenuado.
- **Axe, 0 violaciones nuevas** en `/consulta/[patientId]` con la grabación
  activa (0 violaciones en total en esa corrida — ni siquiera las dos
  familias preexistentes ya conocidas aparecieron en esta página/estado).
- **Consola**: 0 errores.
- Capturas visuales (`expediente--antes.png` vs `expediente--grabando.png`)
  confirman la diferencia a simple vista: el marco perimetral se enciende, el
  subtítulo "Consultorio", el atajo "⌘K" y el rótulo "Operaciones"
  desaparecen, y los íconos de Hoy/Encuentro/Seguimiento/Operaciones se ven
  visiblemente más tenues — mientras "Paciente" (el contexto activo en esa
  pantalla) se mantiene con su peso completo.

### Compuertas de esta corrida

- `npx vitest run`: 8737 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores).

**Deuda anotada, no bloqueante:**
- `BottomNav.tsx` (navegación persistente en móvil) tampoco se suscribe a
  `EVENTO_GRABANDO` — mismo hallazgo que tenía `FlowRail`, pero fuera de
  alcance de esta rebanada (la recomposición de móvil es
  `V15-MOBILE-001`, Fase 9, deliberadamente diferida). Verificado (no
  supuesto): `grep EVENTO_GRABANDO src/components/BottomNav.tsx` → sin
  coincidencias.
- Dos familias de violaciones axe moderadas preexistentes —
  `landmark-unique` (cajón móvil de `FlowRail`) y `region` (banners fuera de
  landmark) — siguen sin tocarse, candidatas a `V15-A11Y-001`.
- §8.5 «nonessential admin disappears» sigue sólo PARCIALMENTE resuelto: esta
  corrida lo resolvió para la navegación persistente (FlowRail/
  InstrumentStrip); el admin DENTRO de la propia página de consulta (menú de
  motor de IA, banner de créditos/plan, enlaces a `/precios`) sigue con su
  peso completo durante la grabación — es el hallazgo #5 del mapeo de
  baseline, candidato real para la siguiente rebanada de esta misma fase.
- §8.6 «one primary action dominates» sigue sin resolverse fuera del inicio
  (`EmpezarAGrabar`): en el cierre, "Firmar y cerrar nota" comparte peso
  visual con "Guardar borrador"/"Leer resumen"/"Descartar" (líneas 5660-5699
  del baseline medido). Candidato alternativo para la siguiente rebanada.

### "Firmar y cerrar nota" domina el cierre (§8.6) — segunda rebanada de Encounter Mode (11-ago-2026)

- **`consulta-ui.tsx` (`S.firmar`/`S.guardar`/`S.descartar`)** — `S.firmar`
  creció de verdad (relleno 13px→15/28px, tamaño 15→16, y ganó una sombra que
  ninguna otra acción del cierre lleva). `S.guardar` y `S.descartar`
  PERDIERON su caja: sin `border`, sin fondo, tamaño 14→12 — pasan de ser
  botones del mismo peso que Firmar a texto de apoyo. Aplica la regla del
  sistema de diseño (posición → tipografía → espacio → agrupación → énfasis,
  antes que cajas con borde) al hallazgo #6 que dejó anotado la rebanada
  anterior (baseline: las cuatro acciones vivían en una sola fila del mismo
  alto, líneas 5660-5699).
- **`page.tsx`** — el `<div>` que contenía las cuatro acciones en una sola
  fila con wrap se partió en DOS filas: Firmar (con el motivo de bloqueo
  justo debajo, donde está el dedo) en su propio contenedor; Guardar
  borrador/Leer resumen/Descartar/Completitud en un segundo contenedor,
  visualmente subordinado. Ningún `onClick`, `disabled`, `title` ni el texto
  de `motivoNoFirma`/`bloqueosDeFirma` cambió — es reordenar JSX/CSS de lo
  que ya existía, no lógica nueva (`firmar`, `bloqueosDeFirma`,
  `motivoNoFirma`, `guardarBorrador`, `leerResumen`, `descartar` — ninguna
  de esas seis definiciones se tocó).
- **Hallazgo y arreglo de la misma corrida, encontrado por su propio
  arnés**: el primer intento atenuaba `S.descartar` con `opacity: 0.8` sobre
  `var(--red)` para bajarle peso visual. `scripts/design/capturar-firmar-domina-v15.mjs`
  (axe real, no lectura de JSX) lo cazó como una violación `color-contrast`
  NUEVA: `#ba5253` sobre `#0b0c0e` mide 4.11:1, bajo el mínimo AA de 4.5:1
  para texto normal (12px). Se quitó la opacidad — el color `var(--red)` a
  plena intensidad ya tenía margen de sobra sin necesitar atenuado — y la
  violación desapareció en la recaptura, en desktop y en móvil.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-firmar-domina-al-cerrar.test.ts` — 4 de sus 8 casos
  fallan contra el árbol previo a este cambio (verificado con `git stash`):
  padding/tamaño de `S.firmar`, `border`/`background` de
  `S.guardar`/`S.descartar`, y que Firmar viva en un contenedor separado del
  de las acciones de apoyo. Los otros 4 casos protegen el freeze funcional
  (mismo `onClick`/`disabled`/texto de motivo que antes).
- `node scripts/design/inventario-de-pantallas.mjs` regenerado
  (`/consulta/[patientId]` bajó de 5900 a 5882 líneas de fuente por la
  extracción de la estructura de dos filas) y
  `node scripts/design/trinquete-de-diseno.mjs --actualizar` (bajó de
  verdad: `tamanosFueraDeEscala` 2004→2003 — el `fontSize: 15` viejo de
  `S.firmar`, fuera de escala, pasó a 16, que sí está en la escala oficial;
  `radiosFueraDeEscala` se quedó igual, no subió).

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
siembra sintética `sembrar-capturas.mjs` + build de producción + `npm start`).
Arnés nuevo: `scripts/design/capturar-firmar-domina-v15.mjs`. Capturas en
`docs/design/capturas/v15-firmar-domina/` (desktop 1440 + mobile 390, más una
captura de cada uno desplazada hasta el pie de cierre):

- **Medido con `getComputedStyle`, no leído en JSX**: `Firmar` renderiza
  `fontSize: 16px`/`padding: 15px 28px`/con sombra; `Guardar`/`Descartar`
  renderizan `fontSize: 12px`/`padding: 6px 8px`/sin borde/sin fondo. Las dos
  filas están realmente separadas (`filasSeparadas: true`,
  `altoFirmarMayorQueGuardar: true`).
- **Nota operativa para quien retome el arnés de capturas**: `.env.local`
  necesita `NEXT_PUBLIC_FIREBASE_EMULATORS=1` (con **S** al final) — la
  variable que de verdad lee `src/lib/firebase.ts`. El nombre sin `S` que
  sugiere `arnes:dev` en `package.json` deja el login colgado en «Entrando…»
  sin ningún error visible, porque el cliente nunca intenta conectar contra
  el emulador. Costó un ciclo de build completo diagnosticarlo — las
  `NEXT_PUBLIC_*` se hornean en el build, no se leen en caliente.
- **Axe, 0 violaciones nuevas** tras el arreglo de contraste: quedan sólo las
  dos familias ya conocidas y preexistentes — `landmark-unique` (cajón móvil
  de `FlowRail`) y `region` (banner de prueba gratuita) — mismo fingerprint
  que las corridas anteriores de esta fase.
- **Consola**: 0 errores en desktop; el único mensaje en móvil es el warning
  ya familiar de reconexión de Firestore del emulador.
- Capturas visuales (`consulta--desktop-cierre.png`,
  `consulta--mobile-cierre.png`) confirman la jerarquía a simple vista:
  Firmar es el bloque más grande y oscuro de la fila, con el motivo de
  bloqueo justo debajo en rojo; Guardar borrador/Leer resumen/Descartar
  quedan como texto plano sin caja, con Completitud alineada a la derecha.

### Compuertas de esta corrida

- `npx vitest run`: 8745 pasan, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: bajó de verdad
  (`tamanosFueraDeEscala` 2004→2003), resellado con `--actualizar`.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores).
- `docs/design/SCREEN_INVENTORY.md` regenerado.

## Siguiente tarea exacta

`V15-ENCOUNTER-MODE-001` (Fase 5) continúa con el hallazgo #5 que queda de
los dos anotados por la medición de baseline: admin no esencial DENTRO de la
propia página de consulta (menú de motor de IA, banner de créditos/plan,
enlaces a `/precios`) sigue con su peso completo durante la grabación —
`EVENTO_GRABANDO` sólo se aplicó al shell persistente (FlowRail/
InstrumentStrip) en la primera rebanada. Con los hallazgos #1 y #6 ya
cerrados, la siguiente corrida debe medir #5 con el mismo rigor (línea/bloque
concreto de la página, qué depende de `EVENTO_GRABANDO` ya existente vs. qué
sería lógica nueva) antes de tocar código. Cuando #5 cierre, revisar si algo
de los 9 comportamientos de §8 sigue sin cubrirse antes de dar la fase por
completa.

**Deuda anotada, no bloqueante:**
- `BottomNav.tsx` (navegación persistente en móvil) tampoco se suscribe a
  `EVENTO_GRABANDO` — mismo hallazgo que tenía `FlowRail`, pero fuera de
  alcance de esta fase (la recomposición de móvil es `V15-MOBILE-001`, Fase
  9, deliberadamente diferida).
- Dos familias de violaciones axe moderadas preexistentes —
  `landmark-unique` (cajón móvil de `FlowRail`, mismo `aria-label` que la
  versión de escritorio) y `region` (banner de prueba gratuita / banner de
  recordatorios de push, contenido fuera de landmark) — vistas en
  `/dashboard`, `/expediente/[patientId]`, `/consulta/[patientId]` y donde
  sea que esos componentes se monten. Candidata para `V15-A11Y-001` cuando
  llegue esa fase.

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
