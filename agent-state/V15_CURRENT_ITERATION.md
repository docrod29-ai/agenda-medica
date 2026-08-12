# V15 — estado vivo

**Rama canónica:** `v15/structural-uiux` · **PRs V15 abiertos:** 1 (#292)

## Iteración en curso

`V15-MOBILE-001` (Fase 9, §22/§33) — **EN CURSO**, segunda rebanada
12-ago-2026: el cajón lateral móvil retirado en modo médico (era el árbol
de escritorio clonado en un dialog — raíz del `landmark-unique` de toda la
rama, ahora en cero) + topbar con Buscar al pulgar + Cerrar sesión en
/operaciones. Ver su sección al FINAL de este archivo. Primera rebanada
(12-ago-2026): `BottomNav` recompuesto a la IA de V15 en modo médico +
suscrito a `EVENTO_GRABANDO`.
`V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — **CERRADA 12-ago-2026** por
decisión de alcance: la integración por continuidad ES la forma final de
Fase 8 (ver «Fase 8 — decisión de cierre» abajo). Quinta rebanada previa
(11-ago-2026): el cierre agenda el seguimiento y REG-310 sellado. `V15-FOLLOWUP-WORK-001` (Fase 7, §10) — **CERRADA 11-ago-2026**
tras dos rebanadas: primera, `/pendientes` agrupa lo no urgente por
`estadoDeAccion` (necesita revisión · esperando resultado · necesita
agendar · esperando al paciente · otros); segunda, «closed recently» bajo
demanda (`tareasCerradasRecientes()` + botón «Ver cerrados recientemente»,
sólo lectura). Ver secciones propias abajo. `V15-RESULTS-CLOSURE-001`
(Fase 6, §9) — **CERRADA 11-ago-2026** tras
medir los 8 comportamientos de §9 contra el código actual (tabla en su
propia sección) y decidir diferir la extensión de modelo (campo de cierre
decisión/acción/aviso al paciente) a fase futura, con razón escrita — mismo
criterio de cierre que ya usó `V15-ENCOUNTER-MODE-001` con sus 9
comportamientos de §8. `V15-ENCOUNTER-MODE-001` (Fase 5) — CERRADA
11-ago-2026 (cuarta y última rebanada: el Copiloto se pinta junto a los
hechos que interpreta, §8 comportamiento #8). `V15-PATIENT-WORKSPACE-001`
(Fase 4) — CERRADA 11-ago-2026 (ver secciones abajo). `V15-TODAY-001`
(Fase 3), `V15-IA-001` y `V15-SHELL-GREYBOX-001` — cerradas antes, misma
fecha.

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

### Admin no esencial DENTRO de `/consulta/[patientId]` se calla al grabar (§8.5, hallazgo #5) — tercera rebanada de Encounter Mode (11-ago-2026)

- **Medición antes de tocar código**: el hallazgo #5 del baseline decía
  «menú de motor de IA, banner de créditos/plan, enlaces a `/precios` siguen
  con su peso completo durante la grabación». Al medir con precisión (grep +
  lectura de `page.tsx`) resultó ser DOS defectos, no uno:
  1. El «Menú de IA: motor por nota + medidor de créditos» usaba
     `!voz.grabando` como compuerta — que sólo cubre la ruta de Web Speech.
     `modoVoz` está fijo en `'whisper'` (la ruta REAL, diarización/Whisper
     por `voice-asr.md`), y con esa ruta `voz.transcripcion` se llena EN VIVO
     desde `audio.transcripcionParcial` (efecto ya existente en `page.tsx`,
     línea ~530) mientras `voz.grabando` se queda en `false` — así que este
     menú SÍ se mostraba con su peso íntegro durante una grabación de audio
     real, no sólo durante la (inexistente en la práctica) grabación por voz
     del navegador. Es el más severo de los dos: no es sólo peso visual, es
     una compuerta que nunca se cerraba en el camino que de verdad se usa.
  2. Los tres avisos de créditos/plan (tope duro agotado, modo económico,
     candado de gasto suave) no tenían NINGUNA compuerta de grabación —
     visibles sin condición siempre que su estado de negocio fuera cierto,
     grabando o no.
- **`page.tsx`** — los cuatro sitios ahora comparten `grabandoAhora()`, el
  MISMO helper que ya existía en el archivo (línea ~1394,
  `audio.estado === 'grabando' || audio.estado === 'pausado' ||
  voz.grabando` — pausado cuenta como activo, mismo criterio que
  `estoy-grabando.ts`) y que ya usaban `iniciarPorVoz`/`cerrarPorVoz`: no es
  un criterio nuevo, es cerrar el mismo criterio en cuatro sitios que no lo
  usaban. El menú de IA cambió su compuerta de `!voz.grabando` a
  `!grabandoAhora()`; los tres avisos de créditos ganaron `&&
  !grabandoAhora()` al final de su condición existente. Ningún `onClick`,
  texto, ni lógica de negocio de estos bloques se tocó.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-admin-no-esencial-se-calla-al-grabar.test.ts` — 4 de
  sus 8 casos fallan contra el árbol previo a este cambio (verificado con
  `git show HEAD:` del archivo antes de editar): el menú de IA seguía en
  `!voz.grabando` y los tres avisos no llevaban ninguna compuerta.

### Verificado en navegador real (11-ago-2026) — grabación DE VERDAD, no simulada

A diferencia de las dos rebanadas anteriores de esta fase (que simulan
`EVENTO_GRABANDO` con un `CustomEvent` porque el shell vive en otro árbol de
componentes), aquí `audio.estado` es estado interno de
`useGrabacionAudio()` dentro de la propia página — no hay evento externo que
simular sin dejar de probar lo que de verdad importa. Se usó micrófono FALSO
de Chromium (`--use-fake-device-for-media-stream` +
`--use-fake-ui-for-media-stream`) para que `getUserMedia`/`MediaRecorder`
corrieran de verdad, e interceptando (`page.route`) SÓLO la frontera de red
hacia el proveedor de ASR/IA (no hay llave real de AssemblyAI/Whisper/
Anthropic en este entorno) — todo lo demás (React, efectos, DOM) corrió sin
tocar. Arnés: `scripts/design/capturar-admin-se-calla-v15.mjs`. Capturas y
medición en `docs/design/capturas/v15-admin-se-calla/` (desktop 1440):

- **Login real + `/consulta/[patientId]` real + consentimiento real +
  grabación real** con audio sintético. El primer trozo EN VIVO (flush cada
  20 s, `INTERVALO_CHUNK_DEFAULT_MS`) llegó por la ruta real
  (`/api/expediente/transcribir-chunk`, mockeada sólo en la respuesta del
  proveedor) y pobló `voz.transcripcion` de verdad, con
  `audio.estado === 'grabando'` todavía activo: `chunkVisto: true`,
  `grabandoConTranscripcionParcial: {"grabando":true,"menuDeIA":false,...}`
  — el defecto más severo (#1), confirmado y confirmado corregido con datos
  reales, no leído en JSX.
- **El aviso de créditos, disparado MIENTRAS SIGUE GRABANDO** (pulsando
  «Procesar con IA» directamente — visible y habilitado con transcripción no
  vacía sin importar `audio.estado` — contra `/api/expediente/procesar`
  mockeada para devolver `sinCreditos: true`): el estado de negocio se puso
  cierto y el aviso se quedó AUSENTE —
  `creditosAgotadosMientrasGraba: {"grabando":true,"avisoSinCreditos":false}`
  — la prueba directa de que `!grabandoAhora()` gobierna el aviso, no una
  coincidencia de que nunca se disparó.
- **Al detener** (`despuesDeDetenerAvisoAparece`): con `grabando:false`, TANTO
  el menú de IA COMO el aviso de créditos reaparecen en el mismo instante —
  `{"grabando":false,"menuDeIA":true,"avisoSinCreditos":true}` — confirmado
  con capturas (`04-detenido-aviso-aparece.png`): «Motor de IA para esta
  nota» y «Se acabaron tus consultas con IA del mes (30/30)» los dos
  visibles con su peso completo, tal como antes de esta fase.
- **Ojo con el toast**: `sinCreditos` también dispara un TOAST transitorio
  con el MISMO título que el aviso persistente («Se acabaron tus consultas
  con IA del mes») — buscar sólo ese título en el DOM habría dado un falso
  positivo mientras el toast estaba en pantalla (pasó en el primer intento
  de este mismo arnés). Se corrigió buscando una frase que sólo lleva el
  cuerpo del aviso persistente («La IA se pausó para no generarte cargos
  extra»), que el toast no tiene.
- **No se ejercitó la diarización completa al detener** (`aplicar()` nunca
  llegó a `setEstado('listo')` en los primeros intentos de este arnés —
  quedó `audio.estado` fijo en `'subiendo'` incluso con
  `/api/expediente/transcribir-diarizado` mockeada devolviendo `completed`
  en la primera consulta). Diagnosticado como algo del propio sandbox
  (probablemente el intento de `guardarAudioDeLaConsulta` de subir a
  Firebase Storage, sin emulador de Storage levantado aquí, o similar), NO
  del cambio de esta corrida — los cuatro sitios tocados son JSX puro y el
  fallo persistía igual con y sin la compuerta nueva. Se evitó por completo
  disparando el aviso de créditos con «Procesar con IA» directo en vez de
  depender de la vuelta completa detener→diarizar→procesar automático — el
  MISMO botón y la MISMA ruta que el flujo real usa, sin la diarización de
  por medio.
- **Axe, 0 violaciones** en los cuatro estados medidos (antes, grabando,
  grabando-con-aviso-agotado, detenido-con-aviso-visible).
- **Consola**: el único error nuevo son dos `503` esperados de la ruta de
  diarización REAL (sin mockear en el paso 4, sin llave de proveedor en este
  entorno) — degradación conocida y ya manejada por
  `intentarDiarizar`/`falla('error_proveedor')`, no una regresión de esta
  corrida. El aviso de reconexión de Firestore del emulador es el mismo
  transitorio ya visto en corridas anteriores de esta fase.

### Compuertas de esta corrida

- `npx vitest run`: 8750 pasan (8 nuevos), 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — todas las
  rutas generadas, incluida `/consulta/[patientId]`.
- `docs/design/SCREEN_INVENTORY.md` regenerado (consulta subió de 5882 a
  5901 líneas por el comentario que explica el porqué del cambio de
  compuerta).

### V15-ENCOUNTER-MODE-001 — re-medición de los 9 comportamientos de §8 (11-ago-2026, cuarta rebanada)

Con #1 y #5 ya cerrados por rebanadas previas, esta corrida releyó
`/consulta/[patientId]` completa (5924 líneas, tras las tres rebanadas
anteriores) y re-midió los 9 comportamientos de §8 UNO POR UNO contra el
código actual — no contra la medición de baseline, que es de antes de esas
tres rebanadas:

| # | Comportamiento (§8) | Estado | Evidencia |
|---|---|---|---|
| 1 | navigation visually quiets | **PASS** | `FlowRail.tsx` (§8.1, ya cerrado). `BottomNav.tsx` (móvil) sigue sin suscribirse a `EVENTO_GRABANDO` — deuda ya anotada, diferida a `V15-MOBILE-001` (Fase 9), no bloquea Fase 5. |
| 2 | patient identity remains unmistakable | **PASS** | Header de `page.tsx` (`<h1>{patient?.nombre}</h1>` + edad/sexo + banner de alergias, líneas ~4029-4054 de antes de esta corrida) **nunca** está detrás de `grabandoAhora()` — confirmado con `grep grabandoAhora` (sólo 4 sitios: menú IA + 3 avisos de crédito, ninguno es el header). El CSS de "quieto" de §8.1/§8.5 (`.nx-flow-rail-quiet-*`, `globals.css` líneas 772-783) está encapsulado bajo `.nx-flow-rail--quieto`, que sólo existe dentro del `<aside>` de `FlowRail` — no puede alcanzar nada de `/consulta/[patientId]` (confirmado: `grep nx-flow-rail-quiet` en `page.tsx` → 0 resultados). Además `InstrumentStrip` (§ tercera rebanada de `V15-PATIENT-WORKSPACE-001`) también pinta "paciente actual" en `/consulta`, doble refuerzo. |
| 3 | recording state becomes unmistakable | **PASS** | Sin cambio desde el baseline: `MientrasHablas` + `InstrumentStrip` + `MarcoEscuchando`. |
| 4 | clinically important current context remains available | **PASS** | Sin cambio desde el baseline: alergias, "Está tomando", "Visitas anteriores" siguen sin gate de grabación. |
| 5 | nonessential admin disappears | **PASS** | Cerrado por la rebanada anterior (§8.5): menú de IA + 3 avisos de crédito ahora gatean con `grabandoAhora()`, verificado con grabación real. |
| 6 | one primary action dominates | **PASS** | `EmpezarAGrabar` al inicio (ya lo tenía el baseline) y "Firmar y cerrar nota" al cierre (§8.6, ya cerrado). |
| 7 | live transcript is optional, not the default wall | **PASS** | Sin cambio desde el baseline. |
| 8 | contextual intelligence appears beside relevant facts | **Era PARCIAL → PASS esta corrida** | Ver rebanada de abajo. Este era uno de los "2 parciales" que el baseline nunca nombró por número — el otro era el propio #6, que ya se resolvió con §8.6 al pasar de "sólo al inicio" a "también al cierre". |
| 9 | note/plan emerge from the encounter without switching to unrelated modules | **Deliberadamente diferido a Fase 8, no bloquea Fase 5** | Ver razonamiento abajo. |

**Sobre #9** (para que quede explícito y no se re-litigue sin motivo): el
propio master loop ubica "Integrate Note → Rx → Orders → Instructions →
Follow-up" en la Fase 8 (§33), DESPUÉS de Encounter Mode. La corrida de
`V15-PATIENT-WORKSPACE-001` (tercera rebanada, sección "Active Patient
Canvas, DECISIÓN" arriba) ya investigó `onGenerarReceta`/`onGenerarOrden` y
decidió, con razón escrita, que navegar a `/receta`/`/orden` es un diferido
A PROPÓSITO, no un olvido. Esta corrida confirma que esa decisión sigue
vigente (no se tocó `onGenerarReceta`/`onGenerarOrden` ni la navegación de
`NotaCard`) y la adopta para #9: forzar Rx/Orders a vivir inline dentro de
`/consulta/[patientId]` ahora invertiría el orden de fases obligatorio de
§18. Documentado, no bloqueante — no se cuenta como comportamiento
incumplido de esta fase.

Con #1-8 en PASS real y #9 diferido con razón documentada y ya tomada por
una corrida anterior, **los 9 comportamientos de §8 quedan resueltos o
legítimamente diferidos** — condición para cerrar `V15-ENCOUNTER-MODE-001`.

### El Copiloto se pinta junto a los hechos (§8 #8) — cuarta y última rebanada de Encounter Mode

- **Medición antes de tocar código**: `/consulta/[patientId]` es una sola
  columna sin pestañas (confirmado: `grep gridTemplateColumns` sólo
  encuentra la cuadrícula de Signos vitales — ninguna estructura de dos
  columnas en toda la página). El orden real de JSX (no supuesto: medido con
  `grep -n` de cada marcador de sección) era: Grabación → extracción NER →
  avisos de crédito → Resumen ejecutivo → Segunda opinión → **Copiloto +
  PanelRazonamiento** → Herramientas → Evidencia (PubMed) → PROA →
  reproyección de voces → sugerencias de IA pendientes → Signos vitales →
  Preop → Inmuno → Secciones narrativas → **Diagnósticos** → **Medicamentos**
  → Validación + Acciones (cierre). El Copiloto —que calcula alertas de
  dosis/alergia/renal/prevención LEYENDO `diagnosticos`/`medicamentos`/
  `signosNum` vía el `useMemo` `entradaCopiloto`— se pintaba casi 700 líneas
  ANTES de que esos mismos diagnósticos y medicamentos existieran siquiera
  como lista editable en la pantalla. Un médico que lee de arriba abajo veía
  "para este paciente…" y alertas de seguridad antes de haber llegado a
  escribir el diagnóstico o el medicamento que las dispara: la inteligencia
  contextual estaba desconectada de los hechos que interpretaba, no "al
  lado" de ellos — el comportamiento #8 de §8, PARCIAL en la medición.
- **Corrección**: se reubicó el bloque `<Copiloto>` + `<PanelRazonamiento>`
  (sin tocar una sola prop, sin tocar `entradaCopiloto`) a que se pinte
  DESPUÉS de Secciones narrativas + Diagnósticos + Medicamentos, y justo
  ANTES de "Validación + Acciones" (el cierre/firma). El dato que consume
  (`entradaCopiloto`) no cambió — es el mismo `useMemo` de siempre, calculado
  arriba de la función, independiente de dónde se pinte su consumidor. Sólo
  cambió DÓNDE se pinta: ahora el Copiloto reacciona a lo que el médico YA
  fijó, justo antes de firmar, en vez de adelantar una opinión sobre datos
  que todavía no existen en pantalla.
- **No se tocó** `Herramientas`, `Evidencia (PubMed)` ni `PROA` — son
  herramientas bajo demanda (el médico las abre si las necesita), no el
  motor de sugerencias reactivo que dispara #8. Reordenarlas también habría
  sido un cambio mucho más grande y con más riesgo (~1200 líneas de JSX) por
  un beneficio marginal; se dejó fuera de esta rebanada a propósito.
- **Hallazgo de paso, encontrado por el mismo arnés de verificación**: al
  disparar una sugerencia real del Copiloto (agregar un medicamento que
  choca con la alergia del paciente) aparecieron dos violaciones axe
  `critical`/`serious` NUEVAS para esta fase — no en el bloque que se movió,
  sino en las filas de Diagnósticos/Medicamentos que ninguna captura previa
  de esta fase había llegado a poblar: el botón de basurero (`Trash2`, sin
  texto ni `aria-label`, 2 nodos: uno en Diagnósticos y otro en Medicamentos)
  y el `<select>` de vía de administración (sin `<label>` ni `aria-label`, 1
  nodo). Arreglados aquí por ser un cambio de una línea cada uno, seguro
  (sólo agrega `aria-label`, ningún `onClick`/`disabled`/comportamiento
  cambia) y porque el propio arnés de esta corrida los encontró — mismo
  criterio que ya usaron las rebanadas de `V15-PATIENT-WORKSPACE-001` con el
  `<h1>` perdido y el botón de `NotificacionesPushOptIn.tsx`.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-copiloto-junto-a-los-hechos.test.ts` — análisis estático
  de fuente (índice de texto = orden de render, mismo patrón que el resto de
  guardianes `v15-*`). Verificado contra `git stash` del cambio en
  `page.tsx`: el caso "Secciones narrativas → Diagnósticos → Medicamentos →
  Copiloto, en ese orden" falla contra el árbol previo (`<Copiloto` aparecía
  ANTES de "Diagnósticos" en el texto fuente, `299226 < 262140` fallando la
  aserción `toBeLessThan`); los otros 5 casos (freeze funcional + bloque
  contiguo) pasan sin el cambio porque protegen algo que no se tocó.

### Verificado en navegador real (11-ago-2026) — sugerencia crítica real, no simulada

Mismo método que las corridas anteriores de esta fase: emuladores
Auth/Firestore reales (`--project demo-nexusmed-test`) + siembra sintética
(`sembrar-capturas.mjs`) + build de producción + `npm start`. Esta
verificación además EJERCITA una sugerencia real del Copiloto en vez de sólo
medir posición con datos vacíos: sobre `pac-aurelio-dominguez` (alergia
registrada: Penicilina), se agregó un diagnóstico y el medicamento
"Amoxicilina" desde la UI real — `alergiaVsReceta()`
(`src/lib/expediente/copiloto.ts`) clasifica la amoxicilina dentro de la
familia "betalactámicos" que dispara la alergia a penicilina, así que es un
disparador determinista, no supuesto. Arnés nuevo:
`scripts/design/capturar-copiloto-junto-a-hechos-v15.mjs`. Capturas y
medición en `docs/design/capturas/v15-copiloto-junto-a-hechos/` (desktop
1440 + mobile 390):

- **La sugerencia crítica real apareció en el DOM**: `hayCriticaEnDOM: true`,
  `textoCritica: "Amoxicilina choca con una alergia registrada"` — medido
  con `document.querySelectorAll('span')`, no leído en el código fuente.
- **Orden real, medido con `getBoundingClientRect().top`, no supuesto**:
  `topMedicamentos: 1178.66` < `topCopiloto: 1363.41` < `topFirmar:
  2317.16` → `medicamentosAntesDeCopiloto: true`,
  `copilotoAntesDeFirmar: true`. El Copiloto (con la alerta crítica real
  visible) queda entre Medicamentos y el cierre, exactamente donde lo puso
  la corrección.
- **Antes de agregar datos, el Copiloto calla**: `copilotoAntesDeAgregarDatos_desktop: false`,
  `_mobile: false` — sin diagnóstico ni medicamento en la nota nueva, ningún
  texto "Para este paciente"/"cosa que revisar" aparece (silencio como
  condición normal, regla ya documentada en la cabecera de `Copiloto.tsx`).
- **Axe, ANTES del arreglo de aria-label**: `button-name` (crítico, 2 nodos:
  el basurero de Diagnósticos y el de Medicamentos) y `select-name`
  (crítico, 1 nodo: el `<select>` de vía) — NUEVOS para esta fase porque
  ninguna captura previa de `V15-ENCOUNTER-MODE-001` había llegado a poblar
  esas filas. **DESPUÉS del arreglo** (rebuild + recaptura): los dos
  desaparecen — 0 nodos en ambos.
- **Axe, violaciones que quedan tras el arreglo**: `landmark-unique` (2
  nodos, desktop) y `region` (2-3 nodos) son el mismo fingerprint
  preexistente ya documentado en TODAS las capturas anteriores de esta fase
  (cajón móvil de `FlowRail`, banners fuera de landmark) — no se tocan aquí,
  candidatas a `V15-A11Y-001`. `color-contrast` (1 nodo, serio, texto teal
  del encabezado "Análisis basado en evidencia" — `#0f6e56` sobre fondo
  oscuro, 3.03:1) y `heading-order` (1 nodo, `<h4>Sus medicamentos</h4>` de
  `src/lib/paciente/como-se-lo-explico.ts`, la hoja para el paciente) son
  **hallazgos nuevos para esta fase, pero en componentes que esta rebanada
  NO tocó** (el panel de Evidencia/PubMed y la hoja para el paciente no
  forman parte del bloque `Copiloto`/`PanelRazonamiento` que se movió, y su
  estilo/markup no cambió una línea) — aparecen recién ahora porque es la
  primera captura de la fase que puebla Diagnósticos/Medicamentos lo
  suficiente para que esos paneles se activen. Anotados para
  `V15-A11Y-001`, no arreglados aquí para no salirse de una rebanada ya de
  por sí concentrada en #8.
- **Consola**: 0 errores en desktop; en móvil, sólo el warning ya familiar de
  reconexión de Firestore del emulador.

### Compuertas de esta corrida

- `npx vitest run`: 8754 pasan, 1 skip, 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — no relacionado, mismo fallo documentado en todas las
  corridas previas de esta fase).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — todas las
  rutas generadas, incluida `/consulta/[patientId]`, sin error de tipos ni
  de compilación.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/consulta/[patientId]`
  subió de 5912 a 5925 líneas de fuente por el comentario que explica el
  reordenamiento y los dos `aria-label` nuevos).

## V15-ENCOUNTER-MODE-001 (Fase 5) — CERRADA

Los 9 comportamientos de §8 quedan en PASS real (1-8) o diferidos con razón
documentada y ya decidida por una corrida anterior (#9, Fase 8 por diseño
del propio master loop, §18/§33). Tres rebanadas reales cerraron gaps de
verdad (§8.1 navegación, §8.5 admin no esencial, §8.6 acción dominante al
cierre) y una cuarta reposicionó la inteligencia contextual junto a los
hechos que interpreta (§8.8). Ningún cambio de esta fase tocó
`src/lib/asr/`, `src/lib/expediente/` (motor clínico), `src/lib/seguridad/`,
una ruta de API ni una regla de Firestore — presentación/estructura
únicamente, lógica clínica congelada.

## V15-RESULTS-CLOSURE-001 (Fase 6, §9) — EN CURSO, primera rebanada: `ProgresoResultado` en `/pendientes`

**Decisión tomada esta corrida, con razón escrita (no era obvia):** §9 pide
un "work queue" — no exige por sí solo una ruta nueva. Añadir un sexto
destino al `FlowRail` para "Resultados" habría violado `§14` (≤5 destinos
primarios, ya cerrado por `V15-SHELL-GREYBOX-001`). `/pendientes`
(WORK/FOLLOW-UP) YA es una cola de trabajo real (agrupa por escalamiento,
no una tabla) y YA trata `estudio_pendiente`/`resultado_por_revisar` como
tipos de primera clase (`ETIQUETA_TIPO`). El gap real medido contra §9 no
era "falta una pantalla": cada tarjeta de resultado sólo mostraba UN botón
de "siguiente paso" (3 estados visibles) sin exponer las ocho etapas de §9
ni decir cuáles de ellas el sistema ni siquiera registra. Se construyó AHÍ,
no en una ruta nueva. `V15-FOLLOWUP-WORK-001` (Fase 7, siguiente en la
secuencia tras cerrar esta) es quien reorganiza TODO `/pendientes` por
estado de acción (§10); esta rebanada no invade esa fase, sólo hace visible
la progresión de resultado sobre la estructura de tarjeta que ya existe.

- **`src/lib/tareas-clinicas/progreso-resultado.ts`** (módulo puro, nuevo)
  — `progresoResultado()` mapea una `TareaClinica` a las ocho etapas de §9.
  **Hallazgo estructural, no un detalle de implementación**: sólo CINCO de
  las ocho tienen dato real hoy (RESULT, SIGNIFICANCE vía `prioridad`,
  OWNER vía `ownerUid`, REVIEW vía la progresión de `estado`, CLOSED vía
  `estado === 'cerrada'`). DECISION, ACTION y PATIENT COMMUNICATION **no
  tienen campo propio** — el propio modelo (`POR_QUE_COMPLETADA_NO_ES_CERRADA`
  en `modelo.ts`) dice que "cerrar" es hoy el único acto y abarca las tres
  de golpe, sin registrar cada una por separado. La función las marca
  `sin_dato` SIEMPRE, cerrada o no la tarea — inventarlas como "hecha" en
  cuanto se cierra habría sido la regla 5 de seguridad clínica rota en
  código ("señalar de menos, nunca de más"). Es exactamente el mismo
  criterio que ya usó `InstrumentStrip` con "paciente actual" y `dashboard`
  con "PREPARED BY NEXUS": declarar la ausencia, no rellenarla.
- **`src/components/tareas/ProgresoResultado.tsx`** — pinta las ocho
  etiquetas como píldoras (`var(--r-pill)`, escala de fuente oficial
  10.5px): hecha/actual con color de texto normal/`--teal`, pendiente y
  sin_dato en `--text3`, sin_dato ADEMÁS en itálica para que no se confunda
  con "pendiente" a simple vista. `role="group"` con `aria-label` que lee
  la progresión completa para lector de pantalla (no sólo color).
- **`pendientes/page.tsx`** — la pista se pinta SÓLO cuando
  `esTareaDeResultado(t.tipo)` — nunca para seguimiento, receta,
  reconciliación u "otra": no son "un resultado" en el sentido de §9 y
  pintarles la pista sugeriría una progresión que no aplica (regla 5 otra
  vez). Recibe `estado`/`ownerUid`/`prioridad` de la MISMA `TareaClinica`
  que la página ya carga con `tareasVivas()` — no una lectura nueva.
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/progreso-resultado.test.ts` (el módulo puro — 19
  casos, entre ellos uno parametrizado que prueba, para los SEIS estados
  posibles, que DECISION/ACTION/PATIENT COMMUNICATION siguen en `sin_dato`
  — el caso que atraparía a alguien "arreglando" la función para que
  cerrada marcara las tres como hechas) y
  `src/__tests__/v15-progreso-resultado-conectado.test.ts` (que está
  conectado en `/pendientes` y que `ProgresoResultado.tsx` delega en el
  módulo puro en vez de reimplementar transiciones o abrir su propia
  consulta a Firestore). Verificado contra `git stash` del árbol previo:
  las 4 aserciones de conexión fallan (0 import, 0 compuerta), las 19 del
  módulo puro pasan igual porque no dependen del cableado.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
build de producción + `npm start` + siembra sintética). `sembrar-capturas.mjs`
ganó dos tareas de resultado más (`tarea-estudio-catalina` en `en_curso` con
dueño, `tarea-resultado-completado-aurelio` en `completada` con dueño) para
que las tres etapas alcanzables con dato real (Dueño/Revisión/Cerrado) se
vieran en sus tres puntos distintos, no siempre en el mismo. Arnés nuevo:
`scripts/design/capturar-progreso-resultado-v15.mjs`. Capturas y medición en
`docs/design/capturas/v15-progreso-resultado/` (desktop 1440 + mobile 390):

- **Las tres tarjetas, medidas con `getComputedStyle`, no leídas en JSX**:
  Urocultivo (solicitada, sin dueño) → Dueño en `--teal` (actual), Revisión y
  Cerrado en `--text3` (pendientes). Perfil lipídico y Espirometría
  (completada/en_curso, con dueño) → Dueño y Revisión en color de texto
  normal (hechas), Cerrado en `--teal` (actual). Las tres, sin excepción:
  Decisión/Acción/Aviso al paciente en `--text3` e itálica — confirmado
  `fontStyle: "italic"` en las nueve celdas (3 tarjetas × 3 etapas), nunca
  "hecha".
- **La compuerta de tipo, confirmada con datos reales**: "Seguimiento de
  EPOC" y "Confirmar si la metformina" (ninguno es tipo resultado) —
  `tienePista: false` en las dos, medido buscando `.nx-progreso-resultado`
  dentro de su tarjeta, no supuesto por el código fuente.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que todas las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación `color-contrast` en las píldoras nuevas.
- **Consola**: sólo el warning ya familiar de reconexión de Firestore del
  emulador, en desktop y en móvil.
- **Móvil**: las ocho píldoras envuelven en dos líneas sin desbordar,
  legibles a 390px (captura visual confirmada).

### Compuertas de esta corrida

- `npx vitest run`: 8781 pasan (26 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en corridas previas).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (la
  píldora nueva usa `var(--r-pill)` y `fontSize: 10.5`, ambos ya en la
  escala oficial — el primer borrador usaba `borderRadius: 9999` literal y
  `escala-visual-trinquete.test.ts` lo cazó como violación de "la píldora
  se escribe de una sola forma"; corregido antes de sellar).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — `/pendientes`
  sigue como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/pendientes` bajó de 271 a
  259 líneas de fuente — el guardián `el-inventario-de-pantallas-no-miente`
  lo exigía; la baja es real: se reemplazó JSX inline repetido por el
  componente extraído).

**Pendiente de esta misma fase, para una corrida siguiente:**
- `PanelLaboratorios.tsx` sigue siendo la "tabla estática" literal que §9
  nombra como el patrón a evitar (upload + gráfica, cero enlace con
  `tareas_clinicas`). Conectarlo — por ejemplo, que subir un panel de
  laboratorio genere una `resultado_por_revisar` — es una decisión de
  FLUJO DE NEGOCIO (¿siempre? ¿sólo si hay valor crítico? ¿el médico ya
  está revisando en el momento de subir, así que sería una tarea nacida ya
  cerrada?), no sólo de presentación — cruzaría el congelamiento funcional
  de `§1` si se decide sin el dueño. Investigado y diferido a propósito,
  no un olvido.
- Las tres etapas `sin_dato` (DECISION/ACTION/PATIENT COMMUNICATION) son el
  hallazgo real de esta fase: hoy "cerrar" una tarea de resultado no deja
  constancia de QUÉ se decidió, QUÉ acción se tomó ni SI se avisó al
  paciente. Resolverlo de verdad (no fingiendo con la función de
  presentación) exigiría un campo nuevo opcional en `TareaClinica` y un
  pequeño formulario al cerrar — cambio de modelo, con su propia revisión,
  fuera de alcance de una rebanada de presentación. Candidato explícito
  para la siguiente rebanada de esta misma fase o para
  `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8), que ya trata la integración
  Note→Rx→Orders→Instructions→Follow-up.

## V15-RESULTS-CLOSURE-001 (Fase 6) — decisión de cierre y medición de §9 (11-ago-2026)

**Decisión, con razón escrita:** NO se implementa el campo de cierre
(decisión/acción/aviso al paciente) esta corrida. Es una extensión de
MODELO (`TareaClinica` ganaría campos nuevos, con su propio formulario al
cerrar) — cruza exactamente la línea que `§1` marca como "record the
dependency; do not silently modify logic; escalate only if truly
blocking": no es una decisión que un archivo de presentación deba tomar
sin el dueño (¿un formulario obligatorio? ¿opcional? ¿qué pasa con las
~8700 tareas que YA se cerraron sin ese dato?). Queda registrado como
dependencia pendiente de decisión del dueño, no como olvido.

**Medición de los 8 elementos de §9 contra el código actual** (mismo
método que la tabla de 9 comportamientos de §8 en `V15-ENCOUNTER-MODE-001`):

| Etapa (§9) | Estado | Evidencia |
|---|---|---|
| RESULT | **PASS** | La tarea existe — `progresoResultado()` la marca `hecha` siempre. |
| SIGNIFICANCE | **PASS** | `prioridad`, obligatoria desde que la tarea nace. |
| OWNER | **PASS** | `ownerUid`/`ownerNombre`, con su propia etapa `actual` cuando falta. |
| REVIEW | **PASS** | La progresión de `estado` (aceptada→en_curso→completada) enseña revisión real. |
| DECISION | **`sin_dato`, declarado** | No hay campo — ver decisión arriba. |
| ACTION | **`sin_dato`, declarado** | Ídem. |
| PATIENT COMMUNICATION | **`sin_dato`, declarado** | Ídem. |
| CLOSED | **PASS** | `estado === 'cerrada'`. |
| «status progression and next action, no tabla estática» | **PASS** | `ProgresoResultado` pinta las 8 etapas como pista, no un semáforo de 3; `siguientePaso()` ya daba «next action» desde antes de V15. |

5 de 8 etapas con dato real, 3 declaradas `sin_dato` con razón visible en
pantalla (itálica, no confundible con "hecha") — regla 5 de seguridad
clínica aplicada, no un hueco sin explicar. Con la pista conectada
(primera rebanada) y esta medición explícita, **`V15-RESULTS-CLOSURE-001`
(Fase 6) queda CERRADA** — sigue `V15-FOLLOWUP-WORK-001` (Fase 7, §10).

## V15-FOLLOWUP-WORK-001 (Fase 7, §10) — primera rebanada: agrupar `/pendientes` por estado de acción (11-ago-2026)

**Lo que pide §10:** «Group by action state, not by arbitrary module: needs
review · waiting on patient · waiting on result · needs scheduling · needs
communication · needs signature · overdue · closed recently.» Antes de esta
corrida, todo lo que no escalaba (crítico sin dueño / vencido, ya cubierto
por `debeEscalar`) caía en una sola sección plana «Abiertos (n)» — el
médico tenía que leerla entera para saber QUÉ está esperando cada tarea.

- **`src/lib/tareas-clinicas/estado-de-accion.ts`** (módulo puro, nuevo) —
  `estadoDeAccion()` deriva, de `tipo`/`estado`/`venceEn` (sin campo nuevo),
  CINCO de las ocho categorías de §10 con señal real e inequívoca:
  `vencida` (overdue, `estaVencida()`), `necesita_revision` (needs review:
  `tipo === 'resultado_por_revisar'` O `estado === 'completada'`),
  `esperando_resultado` (waiting on result: `tipo === 'estudio_pendiente'`),
  `necesita_agendar` (needs scheduling: `tipo === 'seguimiento'`),
  `esperando_paciente` (waiting on patient: `tipo === 'receta_por_entregar'`,
  cuyo propio texto de creación en `derivar.ts` dice «se cierra cuando el
  paciente la tiene»). **`cerrada_reciente` (closed recently) queda
  deliberadamente sin construir esta rebanada**: `tareasVivas()` EXCLUYE a
  propósito las tareas cerradas (comentario en `firestore.ts`: «Las tareas
  VIVAS»), así que mostrarlo exige una lectura nueva a Firestore, no sólo
  clasificar lo que ya está en memoria — candidata real para la siguiente
  rebanada, no un olvido. **`needs communication` y `needs signature` no
  tienen campo ni tipo que las distinga hoy** — inventar esa distinción
  habría sido la regla 5 de seguridad clínica rota en código; caen en
  `otros`, declarado, igual criterio que ya usó `progreso-resultado.ts` con
  `sin_dato`.
- **`pendientes/page.tsx`** — `resto` (lo que NO escala) ya no se pinta como
  una sección «Abiertos» única: se reparte con `ORDEN_ESTADO_DE_ACCION`
  (filtrando `vencida`, que ya vive en «Requiere atención» arriba) en hasta
  cinco secciones reales. `urgentes`/`debeEscalar` NO se tocaron — la
  escalación sigue exactamente igual que antes de esta corrida.
- Guardianes nuevos, probados al revés (mismo patrón que sus hermanos de
  fase): `src/__tests__/estado-de-accion.test.ts` (el módulo puro, 12
  casos, incluido que vencida gana sobre cualquier otra señal y que
  `reconciliacion_medicamento`/`indicacion_paciente`/`otra` caen en `otros`
  en vez de forzarse a una de las cinco) y
  `src/__tests__/v15-pendientes-agrupa-por-estado-de-accion.test.ts` (que
  la página importa y delega en el módulo puro, y que «Abiertos (» ya no
  existe). Verificado contra `git stash` del cambio en `page.tsx`: 4 de
  los 5 casos de este último fallan contra el árbol previo (el quinto,
  `debeEscalar` sin tocar, pasa igual porque protege algo que no se tocó).
- `scripts/design/sembrar-capturas.mjs` ganó dos tareas más (`receta_por_entregar`
  y `otra`, ninguna escalando) para que los grupos «Esperando al paciente»
  y «Otros pendientes» tuvieran algo real que enseñar — sin ellas, de las
  cinco tareas ya sembradas dos escalan (vencida / crítica-sin-dueño) y las
  otras tres sólo cubren tres de los cinco grupos no-vencidos.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
`sembrar-capturas.mjs` + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-estado-de-accion-v15.mjs`. Capturas y medición en
`docs/design/capturas/v15-estado-de-accion/` (desktop 1440 + mobile 390):

- **Los seis encabezados reales, con las tareas exactas que les
  corresponden — medido en el DOM, no supuesto**: «Requiere atención (2)»
  → Confirmar metformina + Urocultivo; «Necesita revisión (1)» → Perfil
  lipídico; «Esperando resultado (1)» → Espirometría; «Necesita agendar
  (1)» → Seguimiento de EPOC; «Esperando al paciente (1)» → Entregar
  receta; «Otros pendientes (1)» → Llamar a laboratorio externo. Coincide
  exactamente con lo que predice `estadoDeAccion()` para cada fixture
  sembrado.
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que TODAS las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación de contraste en los encabezados nuevos.
- **Consola**: el warning ya familiar de reconexión de Firestore del
  emulador y el `401` de auditoría ya documentado en
  `v15-instrument-strip-paciente` (artefacto del arnés de emuladores, no de
  este cambio) — sin errores nuevos.
- **Móvil**: los seis grupos se apilan sin desbordar ni requerir CSS nuevo
  — la agrupación es puramente semántica (secciones/encabezados que ya
  existían como patrón), confirmado con la captura visual.

### Compuertas de esta corrida

- `npx vitest run`: 8798 pasan (17 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila (con `.env.local` demo de emuladores, recreado
  esta corrida porque `node_modules`/`.env.local` no venían en el
  contenedor — `npm ci` corrido primero) — las 96 rutas del build salen
  limpias, ninguna nueva por este cambio.
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/pendientes` subió de 271
  a 297 líneas de fuente por la agrupación nueva).

## `V15-FOLLOWUP-WORK-001` (Fase 7, §10) — segunda rebanada: «closed recently» (11-ago-2026)

**Decisión tomada esta corrida, con razón escrita:** SÍ se construye la
lectura, pero BAJO DEMANDA — no en el `useEffect` que carga `tareasVivas()`
al montar `/pendientes`. Es la pantalla más visitada del médico; pagarle una
lectura más a Firestore en cada visita, para un dato que la mayoría de las
veces nadie va a mirar, es el costo que la tarea anterior dejó anotado sin
resolver. Cargarla sólo cuando el médico pulsa «Ver cerrados recientemente»
resuelve el §10 (la categoría existe y es real) sin ese costo por defecto.

- **`src/lib/tareas-clinicas/firestore.ts`** — `tareasCerradasRecientes()`,
  módulo nuevo junto a `tareasVivas()`: `where('estado', '==', 'cerrada')`,
  sin `orderBy` (mismo motivo que `tareasVivas()` — evitar el índice
  compuesto; el orden por fecha lo pone quien llama, en cliente). Sólo
  `cerrada`, nunca `cancelada`: son dos cierres semánticamente distintos
  («alguien revisó y decidió» contra «ya no aplica», que ya tiene su propio
  motivo visible en la bitácora) — mezclarlos habría sido inventar una
  categoría que §10 no pide.
- **`pendientes/page.tsx`** — botón «Ver cerrados recientemente» al pie de
  la pantalla, colapsado por defecto (`cerradas: TareaClinica[] | null`,
  `null` = no cargado todavía). Al pulsarlo, `verCerradas()` llama
  `tareasCerradasRecientes()` UNA vez y guarda el resultado; pulsarlo de
  nuevo sólo colapsa (`setCerradas(null)`), sin volver a leer. Las tareas
  cerradas se pintan con `TarjetaCerrada` — un componente NUEVO de sólo
  lectura, no `Tarjeta`: una tarea `cerrada` no tiene transición legal a
  ningún otro estado (`TRANSICIONES.cerrada = []` en `modelo.ts`), así que
  ofrecerle los mismos botones («Tomarla»/«Ya no aplica») sería una acción
  que `cambiarEstado` va a rechazar — la UI prometería algo que el modelo ya
  niega.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-cerrados-recientes-conectado.test.ts` — 4 de sus 5
  casos fallan contra el árbol previo a este cambio (verificado con
  `git stash` de los dos archivos de código, dejando sólo la prueba nueva):
  que `tareasCerradasRecientes` exista y filtre por `cerrada` sin tocar
  `cancelada`, que la página la importe, que NO se llame dentro del
  `useEffect` de montaje, que se llame dentro de un callback aparte, y que
  las tareas cerradas usen `TarjetaCerrada` (sin el botón «Ya no aplica»).
- Trinquete de diseño: el primer borrador de `TarjetaCerrada` copió los
  mismos `fontSize` fuera de escala que ya tenía `Tarjeta` (11/15/13,
  ninguno en la escala oficial `{10.5,12,14,16,20,28}`) — como el nuevo
  componente los REPITE en vez de sólo heredarlos, cada aparición cuenta
  aparte y el trinquete subió de 2003 a 2007. Corregido a 10.5/14/12 (los
  valores de la escala oficial más cercanos) antes de sellar — no se subió
  el techo, y de paso `TarjetaCerrada` no repite la deuda ya conocida de
  `Tarjeta`.
- `scripts/design/sembrar-capturas.mjs` ganó una tarea más en `estado:
  'cerrada'` (`tarea-cerrada-luzmaria`, radiografía sin hallazgos) — sin
  ella, `tareasCerradasRecientes()` no tenía nada real que devolver en el
  arnés de capturas (las ocho tareas sembradas hasta ahora paraban en
  `completada`, nunca llegaban a `cerrada`).

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales +
siembra sintética + build de producción + `npm start`). Arnés nuevo:
`scripts/design/capturar-cerrados-recientes-v15.mjs` — mide la interacción
completa, no sólo una captura. Resultado en
`docs/design/capturas/v15-cerrados-recientes/resultado.json` (desktop 1440 +
mobile 390):

- **Antes de pulsar nada, la carga es de verdad bajo demanda**: con la
  pantalla ya cargada y el botón diciendo «Ver cerrados recientemente», la
  tarea cerrada («Radiografía de tórax») NO está en el DOM
  (`radiografiaEnDOM: false`) — no es un placeholder oculto con CSS, no está
  ahí.
- **Al pulsar, la lectura trae el dato real**: `radiografiaEnDOM: true`,
  `textoCerrada: true` («Cerrada 09-ago» en la tarjeta), y el botón cambia a
  «Ocultar cerrados recientemente» — medido con `document.evaluate`/
  `querySelectorAll`, no supuesto por el código.
- **La tarjeta cerrada es de sólo lectura, confirmado en el DOM real**:
  `tarjetaTieneYaNoAplica: false` — ningún botón «Ya no aplica» en la
  tarjeta de la tarea cerrada, a diferencia de cualquier `Tarjeta` normal.
- **Colapsar no deja rastro**: al pulsar «Ocultar», `radiografiaEnDOM`
  vuelve a `false` y el botón vuelve a decir «Ver cerrados recientemente» —
  el estado es realmente `null`, no `display: none` sobre datos que se
  quedaron en memoria (aunque tampoco importaría clínicamente si lo
  estuviera; se verificó igual).
- **Axe, 0 violaciones nuevas**: `landmark-unique` (2, desktop) y `region`
  (2-3) — mismo fingerprint preexistente que TODAS las capturas V15
  anteriores (cajón móvil de `FlowRail`, banners fuera de landmark).
  Ninguna violación de contraste en `TarjetaCerrada`.
- **Consola**: el único hallazgo es el `401` de auditoría del emulador
  (`login_exitoso` rechazado) ya documentado en `v15-instrument-strip-paciente`
  y corridas posteriores — artefacto conocido del arnés de emuladores, no de
  este cambio.
- **Hallazgo operativo de esta corrida**: el tour de bienvenida
  (`OnboardingTour.tsx`, primera vez del uid en ese navegador) tapa la
  pantalla con un modal («Bienvenida a Ausculta») que ningún arnés previo de
  esta fase había necesitado descartar (sus interacciones no requerían
  pulsar nada bajo el modal). Se descarta con su botón
  `aria-label="Saltar"` antes de interactuar — anotado en el arnés nuevo
  para que scripts futuros que SÍ necesiten hacer clic en la pantalla lo
  reutilicen.

### Compuertas de esta corrida

- `npx vitest run`: 8799 pasan (5 nuevos), 1 fallo PRE-EXISTENTE y ambiental
  (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por el proxy de
  red del contenedor — mismo fallo documentado en todas las corridas
  previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva tras la
  corrección de `fontSize` (ver arriba) — resellado, el techo no subió.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila con `.env.local` demo (emuladores) — `/pendientes`
  sigue como ruta estática (`○`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`el-inventario-de-pantallas-no-miente`
  lo exigía porque `pendientes/page.tsx` cambió de tamaño).

Con las cinco categorías de la primera rebanada más «closed recently» de
ésta (seis de ocho con señal real), y «needs communication»/«needs
signature» declaradas sin campo propio (razón ya escrita en la cabecera de
`estado-de-accion.ts`, regla 5 de seguridad clínica), **los 8 elementos de
§10 quedan resueltos o legítimamente declarados sin dato —
`V15-FOLLOWUP-WORK-001` (Fase 7) puede darse por CERRADA.**

## Siguiente tarea exacta

`V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33): «Integrate Note → Rx → Orders
→ Instructions → Follow-up» — la fase que `V15-PATIENT-WORKSPACE-001`
(tercera rebanada, sección "Active Patient Canvas, DECISIÓN" arriba) y
`V15-ENCOUNTER-MODE-001` (comportamiento #9 de §8) ya identificaron y
diferieron a propósito hacia aquí: `onGenerarReceta`/`onGenerarOrden`
navegando a `/receta`/`/orden` en vez de vivir inline. Empezar releyendo
§8 (comportamiento #9), §33 (Fase 8) y las dos decisiones ya tomadas antes
de tocar código — la pregunta de qué significa "integrar sin salirse de
fase" para esas dos rutas ya tiene contexto escrito, no hay que
redescubrirlo.

**Deuda anotada, no bloqueante (heredada de fases previas, sigue sin
resolverse, candidata a fases futuras — no se repite su detalle si ya está
arriba):**
- `BottomNav.tsx` no se suscribe a `EVENTO_GRABANDO` → `V15-MOBILE-001`
  (Fase 9).
- `landmark-unique` (cajón móvil `FlowRail`) y `region` (banners fuera de
  landmark) → `V15-A11Y-001` (Fase 13).
- `color-contrast` (encabezado teal de "Análisis basado en evidencia",
  3.03:1) y `heading-order` (`<h4>Sus medicamentos</h4>` de la hoja para el
  paciente) → también `V15-A11Y-001`.
- La diarización completa (`/api/expediente/transcribir-diarizado`) cuelga
  en `audio.estado === 'subiendo'` en este sandbox concreto incluso con la
  respuesta del proveedor mockeada — causa no confirmada. Cualquier arnés
  futuro que necesite llegar a `audio.estado === 'listo'` debe investigarlo
  primero o levantar también el emulador de Storage.
- El campo de cierre (decisión/acción/aviso al paciente) de §9 sigue sin
  construirse — decisión de modelo pendiente del dueño, ver arriba, no
  bloqueante para cerrar Fase 6.
- Esta corrida encontró `node_modules` y `.env.local` ausentes del
  contenedor al arrancar — `npm ci` (45s) y un `.env.local` demo
  (`NEXT_PUBLIC_FIREBASE_EMULATORS=1`, proyecto `demo-nexusmed-test`)
  resolvieron ambos sin tocar nada del repositorio (`.env.local` está en
  `.gitignore`). Anotado por si la próxima corrida ve el mismo estado
  limpio del contenedor y quiere ir directo al mismo arreglo.

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

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33 / §20) — primera rebanada: el checklist de cierre recuerda lo hecho (11-ago-2026)

Empezó releyendo exactamente lo que dejó escrito la corrida anterior: §8
(comportamiento #9), §33 (Fase 8) y las dos decisiones ya tomadas
(`onGenerarReceta`/`onGenerarOrden` diferidos a propósito a esta fase). Antes
de tocar código se releyó `ComoCerrarLaConsulta.tsx` (REG-244) completo —
y ahí apareció el hueco real de esta fase, no en `/receta` ni `/orden`:

**El componente sabía DECIR lo que ya se hizo (`hechos?: readonly
string[]`) y nadie se lo decía.** `grep hechos=` en
`/consulta/[patientId]/page.tsx`, su único punto de montaje, no daba nada —
la prop nunca se pasaba. Es el patrón de `.claude/rules/el-dato-tiene-que-llegar.md`
(«escrito y sin conectar»), encontrado dentro de la propia pieza que la Fase 8
pide continuar. Segundo hueco emparentado, mismo archivo: el paso
`hoja_del_paciente` llevaba `ruta: null` desde REG-244 («vive en la propia
consulta: no hay a dónde ir»), pero `ComoCerrarLaConsulta` deshabilita
cualquier botón sin `ruta` — el paso aparecía en la lista y NUNCA se podía
pulsar ni marcar hecho. Un botón muerto disfrazado de tarea.

**Decisión de alcance, con razón escrita:** NO se intentó volver
`/receta`/`/orden` inline dentro de `/consulta` esta corrida. Son
generadores de receta/orden con motores de seguridad completos (dosis,
interacciones, alergias, ajuste renal) — moverlos adentro es el trabajo
grande de Fase 8 y merece su propia corrida, no una decisión apurada al
final de ésta. Lo que SÍ se arregló es más chico, real, y ya estaba
DECLARADO por el propio componente REG-244 sin construirse: que el
checklist de cierre recuerde de una vuelta a otra qué ya se hizo, y que
«Darle sus instrucciones» deje de ser un botón que no hace nada.

- **`src/lib/expediente/cierre-hechos.ts`** (nuevo, casi-puro) —
  `leerHechosDeCierre`/`marcarHechoDeCierre`, sobre `sessionStorage`
  (clave `nx-cierre-hechos:<notaId>`), no Firestore: es estado de esta
  pestaña sobre esta nota — «ya se hizo»—, no un hecho clínico. Nada que
  auditar, nada que respaldar, nada que otro consultorio necesite leer.
- **`src/lib/expediente/que-falta-para-cerrar.ts`** — el paso
  `hoja_del_paciente` pasa de `ruta: null` a `ruta: '#hoja-para-el-paciente'`.
  `aDondeIrDirecto` lo sigue excluyendo del conteo de «un solo destino → se
  va directo» (ya lo excluía por `que`, no por `ruta`), así que el caso
  simple (un solo destino real) sigue sin tocarse — verificado con la
  batería `la-orden-no-se-queda-en-el-tintero.test.ts` completa en verde.
- **`src/components/HojaParaElPaciente.tsx`** — `id="hoja-para-el-paciente"`
  para que el ancla tenga a dónde ir de verdad, y una prop nueva
  `onInteraccion?: () => void` que dispara al copiar O al imprimir (las dos
  cuentan como «se usó», no sólo «se vio» — a propósito, ninguna de las dos
  es más válida que la otra).
- **`/consulta/[patientId]/page.tsx`** — `hechosCierre` (estado, inicializado
  perezosamente desde `leerHechosDeCierre(notaIdParam)` — el caso que
  importa: volver de `/receta`/`/orden` con `useSmartBack` trae la MISMA
  URL con `?nota=...`, y esto la recupera aunque Next remonte la pantalla).
  `alIr` ya no hace SIEMPRE `router.push`: si la ruta empieza con `#`, hace
  `scrollIntoView` en vez de navegar; si es `/receta` o `/orden`, marca el
  paso hecho ANTES de salir. **A propósito NO se sincroniza con un
  `useEffect` cuando `notaId` cambia DESPUÉS del montaje** — ese id nuevo
  nunca tuvo entrada en `sessionStorage` (nota recién creada), así que
  `leerHechosDeCierre` daría `[]` de todos modos, igual al estado inicial;
  añadir el efecto sólo habría repetido, al revés, el mismo defecto que ya
  tiene `uuidRespaldoRef` un poco más arriba (`react-hooks/refs`) — y el
  trinquete de lint (techo 96, sin margen) lo habría cazado igual. Motivo
  completo en el comentario del código, no sólo aquí.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-cierre-recuerda-lo-hecho.test.ts` — el módulo puro
  (con una ventana `sessionStorage` fake, patrón ya usado en
  `salir-seguro.test.ts`) y una batería «está CONECTADO» que falla si se
  deshace cualquiera de los cinco cables (import, `hechos=`, marcar antes de
  navegar, el `#` que no navega, el ancla real, el aviso desde
  `HojaParaElPaciente`). Verificado con `git stash` del código (dejando sólo
  la prueba): el archivo entero falla al cargar (`Cannot find package
  '@/lib/expediente/cierre-hechos'`) — no hay ambigüedad de que sin el
  cambio, la prueba no pasa.

### Verificado en navegador real (11-ago-2026)

Emuladores Auth/Firestore reales + siembra sintética + build de producción +
`npm start` (arnés nuevo: `scripts/design/capturar-cierre-recuerda-lo-hecho-v15.mjs`).
A diferencia de otras capturas de esta rama, aquí hacía falta un encuentro
REAL con dos destinos a la vez (medicamentos Y estudios) para que
`ComoCerrarLaConsulta` se quedara en pantalla — se llegó por Valoración
Inmunocomprometido (motivo «Profilaxis antiinfecciosa», huésped «VIH»), no
mockeando IA. Resultado completo en
`docs/design/capturas/v15-cierre-recuerda-lo-hecho/resultado.json`:

- **El checklist recuerda de verdad, medido en el DOM, no supuesto**: tras
  firmar, «Imprimir la orden de estudios» se pulsa (marca `'orden'` en
  `sessionStorage`, confirmado leyendo la clave real:
  `nx-cierre-hechos:<notaId>` → `["orden","hoja_del_paciente"]`); al volver
  a la nota, «Darle sus instrucciones» pasa de opacidad `1` a `0.55` en
  cuanto se pulsa «Copiar» en la hoja del paciente — captura
  `03-hoja-marcada.png` lo enseña con el círculo verde ✓ real.
- **El ancla funciona sin navegar**: pulsar «Darle sus instrucciones»
  mantiene la URL EXACTA (`sinNavegar: true`) y desplaza
  `#hoja-para-el-paciente` hasta 2px del borde superior del viewport
  (`hojaEnViewport.enViewport: true`) — medido con
  `getBoundingClientRect()`, no leído del JSX.
- **Axe, sin violaciones nuevas**: mismas cuatro familias preexistentes ya
  documentadas en capturas V15 anteriores (`color-contrast` del encabezado
  teal de evidencia, `heading-order`, `landmark-unique` del cajón móvil de
  `FlowRail`, `region` de banners fuera de landmark) — ninguna en el
  checklist ni en la hoja del paciente.
- **Consola**: sólo los artefactos ya documentados del arnés de emuladores
  (401 de auditoría, Firestore offline) — sin errores nuevos.

**Hallazgo de esta corrida, anotado y NO arreglado — condiciona el alcance
real de esta pieza:** `router.back()` (el que usa `useSmartBack` en
`/receta` y `/orden`) NO conserva el contexto de `/consulta` en el caso más
común. `firmar()` nunca escribe el `notaId` en la URL — vive sólo en estado
de React — así que la URL tras firmar sigue siendo `/consulta/[patientId]`
SIN `?nota=...`. Volver desde `/orden` con el botón real de esa pantalla no
encuentra ningún id que releer y el panel entero desaparece (`firmada`
vuelve a `false`), sin que el `sessionStorage` de esta corrida tenga
oportunidad de mostrarse. Verificado también: recargar la nota firmada
explícitamente con `?nota=<id>` (lo que hace un médico que reabre una nota
ya firmada desde el expediente) SÍ conserva `firmada=true` y SÍ deja ver el
checklist con las marcas — pero ahí aparece un SEGUNDO hueco, hermano del
primero: el paso «orden» desaparece de la lista entera (no se pinta
apagado, se pinta INEXISTENTE) porque `estudiosOrden` — a diferencia de
`secciones`/`diagnosticos`/`medicamentos` — nunca se restaura desde
Firestore en el efecto de carga de la nota (`setFirmada(n.estado ===
'firmada')` y sus vecinas no incluyen `setEstudiosOrden(n.estudiosOrden)`).
Los dos son huecos de continuidad PREVIOS a esta corrida («el dato tiene que
LLEGAR», hermana) — no se tocaron aquí porque arreglarlos de verdad exige
decidir CUÁNDO escribir el `notaId` en la URL (¿en cada autoguardado? ¿sólo
al firmar?) y si `estudiosOrden` debe persistirse como campo propio de la
nota o derivarse de otra fuente — ninguna de las dos es una decisión de
presentación pura, y las dos merecen su propia corrida. Candidatos fuertes
para la siguiente rebanada de `V15-NOTE-PLAN-CONTINUITY-001`.

### Compuertas de esta corrida

- `npx vitest run`: 8813 pasan (14 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, falla igual en árbol limpio por
  el proxy de red del contenedor — no relacionado, mismo fallo documentado
  en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva (el primer
  borrador SÍ subió el techo a 97 con un `react-hooks/set-state-in-effect`
  nuevo — corregido quitando el `useEffect` en vez de subir el techo, ver
  el comentario en el código).
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (con `.env.local` demo de emuladores,
  recreado esta corrida — `npm ci` primero porque `node_modules` no venía
  en el contenedor).
- `docs/design/SCREEN_INVENTORY.md` regenerado dos veces (el tamaño de
  `/consulta/[patientId]` cambió dos veces: al insertar el código y al
  corregir el lint).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — tercera rebanada: `firmar()` refleja el notaId en la URL (11-ago-2026)

Empezó exactamente donde la corrida anterior lo dejó escrito: de los dos
huecos («la URL sin `?nota=`» y «`estudiosOrden` no se restaura»), el
primero es la causa raíz y el segundo es su síntoma más visible en el
checklist. Se arreglaron los dos, en el mismo archivo, en el mismo efecto.

- **`firmar()` (`/consulta/[patientId]/page.tsx`)** — justo después de
  `setFirmada(true)`, con el `id` ya definitivo (creado o reusado),
  `router.replace(`/consulta/${patientId}?nota=${id}`)`. **`replace`, no
  `push`**: no es una navegación nueva, es la misma pantalla diciendo la
  verdad sobre qué nota tiene abierta — un `push` habría ensuciado el
  historial con una entrada extra. Corre ANTES de cualquier
  `router.push(destino)` hacia `/receta`/`/orden`, así que la entrada de
  historial que queda atrás YA lleva `?nota=`.
- **El efecto "Cargar nota existente" (mismo archivo)** — ganó
  `if (Array.isArray(n.estudiosOrden)) setEstudiosOrden(n.estudiosOrden)`,
  al lado de `setFirmada(n.estado === 'firmada')`. A diferencia de
  `secciones`/`diagnosticos`/`medicamentos`, este campo nunca se leía de
  vuelta desde Firestore — con la URL ahora llevando `?nota=`, remontar la
  pantalla (volver de `/orden`, o F5 sobre una nota firmada) SÍ dispara este
  efecto, y sin esta línea el paso «Imprimir la orden de estudios»
  desaparecía de `ComoCerrarLaConsulta` en vez de pintarse marcado.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-firmar-refleja-la-url.test.ts` — sus 6 casos fallan
  contra el árbol previo a este cambio (verificado con `git stash` de
  `page.tsx`, dejando sólo la prueba nueva).

### HALLAZGO SEPARADO, IMPORTANTE, NO ARREGLADO AQUÍ: `useSmartBack` nunca hace back de verdad en esta versión de Next

Verificando el arreglo de arriba con el botón "Atrás" REAL de `/orden`
(no `page.goBack()`) apareció un defecto distinto y más grande:
`useSmartBack` decide entre `router.back()` y su `fallback` mirando
`window.history.state.idx` — y en Next.js 16.2.12 (App Router) **ese campo
no existe nunca**. Confirmado con dos scripts de diagnóstico aparte
(`node -e`, no el arnés): con navegación por `page.goto` Y con click SPA
real sobre un `<a>` del `FlowRail`, `window.history.state` sólo trae
`{ __NA, __PRIVATE_NEXTJS_INTERNALS_TREE }` — nunca `idx`. `idx ?? 0 > 0`
es SIEMPRE falso, así que el botón "Atrás" de **las diez pantallas** que
usan `useSmartBack` (`/receta`, `/orden`, `/nota`, `/expediente`,
`/referencia`, `/hospitalizacion/[id]`, `/hospitalizacion/camas`,
`/hospitalizacion/unidades`, `/hospitalizacion/indicadores`, `/uci/*`)
**nunca hace `router.back()` — siempre navega a su `fallback` fijo**,
aunque el usuario sí venga de una navegación real dentro de la app.

Medido en el arnés nuevo (`urlTrasBotonApp`): pulsar "Atrás" en `/orden`
lleva a `/expediente/[patientId]` (el `fallback` de esa pantalla), NO a
`/consulta/[patientId]?nota=...` — aunque la URL de `/consulta` YA es
correcta desde este cambio. Es decir: el arreglo de esta corrida sí
funciona con el atrás NATIVO del navegador (Alt+Izquierda, gesto, botón
del propio navegador — verificado, ver abajo) pero el botón "Atrás" QUE
PINTA LA APP en esas diez pantallas sigue sin beneficiarse, porque el
defecto está en cómo decide entre back y fallback, no en qué URL dejó
`/consulta` atrás.

**No se arregla en esta rebanada** — es un defecto de una pieza compartida
por diez pantallas, con su propia causa (una API de Next que cambió de
forma entre versiones, coherente con el aviso de `AGENTS.md`: "This is NOT
the Next.js you know"), y merece su propia investigación de cuál señal SÍ
existe en `window.history.state` en esta versión para reemplazar `idx` —
no una decisión apurada al cierre de esta corrida. Candidato fuerte y de
alto impacto para la siguiente rebanada de `V15-NOTE-PLAN-CONTINUITY-001`
o su propia unidad: mientras siga así, "el checklist recuerda lo hecho"
(rebanada anterior) sólo se experimenta con back nativo del navegador, no
con el botón que la propia app pinta.

### Verificado en navegador real (11-ago-2026)

Mismo método que las corridas anteriores (emuladores Auth/Firestore reales
+ siembra sintética + build de producción + `npm start`; `node_modules`
volvió a faltar al arrancar el contenedor — `npm ci` de nuevo, sin tocar el
repo). Arnés nuevo: `scripts/design/capturar-firmar-refleja-url-v15.mjs`
— repite el mismo camino de la corrida anterior (Valoración Inmuno,
medicamentos Y estudios a la vez) pero mide el atrás NATIVO por separado
del botón de la app. Resultado completo en
`docs/design/capturas/v15-firmar-refleja-url/resultado.json`:

- **La URL lleva `?nota=` INMEDIATAMENTE al firmar**, antes de navegar a
  ningún lado: `urlTrasFirmar` = `.../consulta/pac-aurelio-dominguez?nota=Gdp8OdahhFtynBkRgZw1`.
- **Atrás NATIVO del navegador (`page.goBack()`) SÍ conserva el contexto,
  medido de verdad**: `urlTrasVolver` conserva el mismo `nota=`
  (`conservaNotaId: true`), `panelTrasVolver: true`, `firmadaBadgeTrasVolver:
  true` — el checklist de cierre YA NO desaparece, que es exactamente el
  defecto que esta rebanada corrige.
- **El checklist recuerda lo hecho, confirmado en el DOM real**: tras
  volver, "Imprimir la orden de estudios" está en opacidad `0.55` (marcado
  — el mismo patrón que ya probó la rebanada anterior), y sigue en la lista
  en absoluto — **prueba indirecta pero real de que `estudiosOrden` se
  restauró**: si `estudiosOrden.length` hubiera vuelto a 0, ese paso ni
  aparecería (`hayEstudios: estudiosOrden.length > 0` lo condiciona).
- **F5 sobre la URL con `?nota=` sobrevive**: `panelTrasRecargar: true` tras
  una recarga dura, no sólo una navegación SPA.
- **El hallazgo separado, medido, no supuesto**: el botón "Atrás" de la
  app en `/orden` navegó a `/expediente/pac-aurelio-dominguez`
  (`fueAlFallbackFijoEnVezDeConsulta: true`).
- **Axe, 0 violaciones nuevas**: las cuatro familias ya conocidas y
  preexistentes de toda esta rama (`color-contrast` del encabezado teal de
  evidencia, `heading-order`, `landmark-unique` del cajón móvil de
  `FlowRail`, `region` de banners fuera de landmark) — ninguna nueva.
- **Consola**: sólo los artefactos ya documentados del arnés de emuladores
  (401 de auditoría) — sin errores nuevos.

### Compuertas de esta corrida

- `npx vitest run`: 8825 pasan (6 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, confirmado con `git stash` que
  falla igual en el árbol limpio — proxy de red del contenedor, no
  relacionado; documentado en todas las corridas previas de esta rama).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo recreado esta
  corrida — emuladores, proyecto `demo-nexusmed-test`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/consulta/[patientId]`
  cambió de tamaño por las dos líneas + comentarios nuevos).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8) — cuarta rebanada: `useSmartBack` ahora sí regresa de verdad (11-ago-2026)

Empezó exactamente donde la corrida anterior lo dejó escrito: releyendo la
sección "HALLAZGO SEPARADO" con la causa raíz ya diagnosticada
(`window.history.state.idx` no existe en Next 16.2.12) y las dos vías
propuestas (investigar una señal real de Next, o el `fallback` calculado
como respaldo). Antes de tocar código se confirmó la causa raíz en el
propio paquete instalado: `grep -n "idx" node_modules/next/dist/client/components/app-router.js`
no encuentra nada — `HistoryUpdater` reescribe `window.history.state` con
`useInsertionEffect` en CADA render (`__NA` + `__PRIVATE_NEXTJS_INTERNALS_TREE`),
incluida la primerísima entrada de la pestaña — y el propio archivo deja el
comentario `// TODO: Use Navigation API if available`, que es exactamente
la señal que faltaba.

- **`src/hooks/useSmartBack.ts`** — se quitó `window.history.state.idx` y se
  reemplazó por `window.navigation.currentEntry.index` (la Navigation API
  del NAVEGADOR, mantenida fuera del control de Next: sube con cada `push`
  real, se queda igual con un `replace` —como el que usa `firmar()` desde
  la rebanada anterior—, baja con un retroceso real). Se extrajeron dos
  funciones puras y exportadas para poder probarlas sin `renderHook` ni
  jsdom (el proyecto corre en `environment: 'node'`): `profundidadDeNavegacion()`
  (lee `window.navigation?.currentEntry?.index`, `undefined` si no existe la
  API o si `window` no existe) y `sePuedeRegresarDeVerdad(profundidad)`
  (`true` sólo si es un número mayor que 0).
- **Decisión de alcance, con razón escrita**: en navegadores SIN Navigation
  API (Firefox, Safari antiguos) NO se reimplementó el historial a mano con
  un contador propio en `sessionStorage` — contar `push`/`replace`/`back`
  por fuera del navegador se desincroniza de su historial real, con su
  propio riesgo de error, y el `fallback` YA es un destino lógico válido.
  El comportamiento en esos navegadores queda IDÉNTICO al de antes de esta
  corrida (siempre `fallback`, cero regresión); la mejora aplica donde la
  API existe (Chromium: Chrome, Edge, el navegador de este mismo arnés).
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos de fase):
  `src/__tests__/v15-smart-back-navigation-api.test.ts` — 10 casos, los 10
  fallan contra el árbol previo a este cambio (verificado con `git stash`
  de `useSmartBack.ts`): unos porque el import de `profundidadDeNavegacion`/
  `sePuedeRegresarDeVerdad` no existía, otros porque el código viejo seguía
  mencionando `history.state`/`idx`.

### Verificado en navegador real (11-ago-2026), DOS de las diez pantallas, con el botón "Atrás" DE LA APP

Primero se verificó el mecanismo suelto (Chromium real, páginas públicas
`/login` → `/registro` → atrás nativo, sin emuladores): `index=0` al cargar
directo, `index=1` tras un clic SPA real en un `<a>`, `index=0` de vuelta
tras el atrás — exactamente la semántica que `idx` pretendía tener y nunca
tuvo.

Después, el camino completo con emuladores Auth/Firestore + siembra
sintética + build de producción + `npm start` (mismo método que todas las
corridas de esta fase), arnés nuevo:
`scripts/design/capturar-atras-de-la-app-v15.mjs`. A diferencia de la
corrida anterior (que probó `page.goBack()`, el atrás NATIVO del
navegador), esta pulsa el botón **"Atrás" que pinta la propia app** — el
`onClick={volver}` real de `useSmartBack` — en `/orden` y en `/receta`.
Resultado completo en
`docs/design/capturas/v15-atras-de-la-app/resultado.json`:

- **`/orden`**: `indiceNavAlLlegarOrden: 3` (Navigation API real, no
  supuesta). Botón "Atrás" pulsado → `urlTrasBotonOrden` es
  `/consulta/pac-aurelio-dominguez?nota=VUmCrc1X966zgluDyfSC` —
  `volvioAConsultaConNota: true`, `fueAlFallbackFijoDeExpediente: false`
  (el defecto que corrige esta rebanada, medido en cero). El checklist de
  cierre («Ya está firmada. Falta esto») sigue visible tras volver:
  `panelTrasVolverDeOrden: true`.
- **`/receta`**: mismo resultado — `indiceNavAlLlegarReceta: 3`,
  `urlTrasBotonReceta` de vuelta en `/consulta/...?nota=...`,
  `volvioAConsultaConNota: true`, `fueAlFallbackFijoDeExpediente: false`.
- **Axe, 0 violaciones nuevas**: las mismas familias preexistentes ya
  documentadas en corridas anteriores de esta fase (`color-contrast`,
  `heading-order`, `landmark-unique`, `region`) — este cambio no tocó JSX
  de ninguna pantalla, sólo la función de decisión del hook.
- **Consola**: sólo los artefactos ya conocidos del arnés de emuladores
  (401 de auditoría, Firestore offline) — sin errores nuevos.

Con esto, el hallazgo que la corrida anterior dejó anotado como "el más
lejano y el más caro" queda cerrado: el botón "Atrás" de las diez pantallas
que usan `useSmartBack` ahora sí regresa a la pantalla anterior real cuando
el médico navegó dentro de la app — verificado con dos de las diez, no
supuesto por extensión al resto (las otras ocho comparten exactamente el
mismo hook sin ninguna lógica por pantalla, así que el riesgo de que se
comporten distinto es bajo, pero no se afirma "diez de diez verificadas").

### Compuertas de esta corrida

- `npx vitest run`: 8839 pasan (10 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego`, confirmado en aislamiento que
  también falla contra el árbol limpio — proxy de red del contenedor, no
  relacionado; documentado en todas las corridas previas de esta rama).
  `la-agenda-es-un-riel` se vio fallar por timeout una vez en la corrida
  completa en paralelo y pasar en aislamiento y con `testTimeout` más
  alto — contención de recursos, mismo patrón ya documentado en
  `V15-PATIENT-WORKSPACE-001`, no relacionado con este cambio (confirmado
  con `git stash` de `useSmartBack.ts`: falla igual sin el cambio).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva (este
  cambio no tocó CSS ni JSX).
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo recreado esta
  corrida — `npm ci` primero porque `node_modules` no venía en el
  contenedor, mismo hallazgo operativo de todas las corridas previas).

## `V15-NOTE-PLAN-CONTINUITY-001` (Fase 8, §33) — quinta rebanada: el cierre agenda el seguimiento (11-ago-2026)

La cadena de §33 Fase 8 es «Note → Rx → Orders → Instructions → Follow-up»
y el último eslabón no existía en el cierre: el médico ponía fecha en
«Próxima consulta», la firma derivaba la tarea del worklist… y el checklist
de cierre no decía nada — la cita se agendaba después, desde `/pendientes`,
con el paciente ya ido. Tres cables conectados, todos del patrón «escrito y
sin conectar»:

- **`que-falta-para-cerrar.ts`** — paso nuevo `seguimiento` («Agendar el
  seguimiento» → `/citas?d=<fecha>`), SÓLO si el médico puso fecha con
  forma ISO exacta (lo único que `paramFecha` de /citas sabe leer — otra
  cosa aterrizaría en «hoy» sin avisar). **No fuerza el panel**
  (`aDondeIrDirecto` lo excluye, razón exportada
  `POR_QUE_EL_SEGUIMIENTO_NO_FUERZA_EL_PANEL`): a diferencia de la orden de
  REG-244, el seguimiento ya tiene red — la tarea del worklist — y forzar el
  panel añadiría un clic a la consulta más común para proteger algo ya
  protegido. El caso común (sólo receta) sigue yendo directo, verificado
  por la batería vieja `la-orden-no-se-queda-en-el-tintero.test.ts` en verde
  sin tocarse.
- **`page.tsx`** — pasa `proximoSeguimiento` al motor de cierre; `alIr`
  marca `seguimiento` hecho ANTES de salir a `/citas` (mismo patrón que
  receta/orden); y `HojaParaElPaciente` deja de recibir
  `proximaCita={undefined}` — el motor (`comoSeLoExplico`, REG-242) tenía el
  bloque «Su próxima cita» desde su primer día y esta pantalla nunca se lo
  alimentó. En la hoja va en palabras (`formatDateMX`): el paciente lee
  «martes, 8 de septiembre de 2026», no «2026-09-08».
- **`cierre-hechos.ts`** — pareja nueva `guardarSeguimientoDeCierre`/
  `leerSeguimientoDeCierre` (`sessionStorage`, mismo criterio escrito del
  módulo): la nota NO guarda `proximoSeguimiento` (va al paciente y a la
  tarea; añadirle el campo sería cambio de esquema congelado por §1), así
  que al volver de `/citas` el remonte dejaba el paso INEXISTENTE — ni
  marcado ni pendiente. Lo encontró el propio arnés de esta rebanada
  (`marcado: null` en la primera pasada), no una lectura del código.
  `firmar()` guarda la fecha; el estado la recupera con inicialización
  perezosa al remontar.

### REG-310 — hallazgo de esta corrida, ARREGLADO y sellado

Verificando lo anterior contra el emulador apareció un defecto PREVIO y más
serio: `firmar` es un `useCallback` sin `proximoSeguimiento` en sus
dependencias (ni en las de `construirNota`), así que teclear la fecha como
ÚLTIMO gesto antes de firmar — el orden natural — dejaba el callback con la
fecha memorizada `''`: **la tarea «Agendar el seguimiento» de REG-300 nunca
nacía y `patient.proximoSeguimiento` (contador del CRM) nunca se
actualizaba**, mientras la pantalla pintaba todo correcto. Medido, no
supuesto: 5 firmas con fecha → `estudio_pendiente`/`receta_por_entregar` SÍ
nacieron y CERO tareas `seguimiento`; tras añadir la dependencia, 2 firmas
→ 2 tareas `seguimiento` y el campo del paciente en `2026-09-08`. Es el
tercer camino de pérdida del MISMO dato (REG-193, REG-300, éste). Entrada
completa en `docs/audit/regression-ledger.md` (REG-310) y
`v15-cierre-agenda-el-seguimiento.test.ts` sellado en
`invariantes-clinicos.json` (16 casos; `clinical-safety-gate` en verde).

- Guardián nuevo, probado al revés (6 de sus casos fallan contra el árbol
  sin el cambio, verificado con `git stash`):
  `src/__tests__/v15-cierre-agenda-el-seguimiento.test.ts` — el paso y su
  ruta, la ausencia sin fecha/con fecha malformada, el orden (hoja →
  seguimiento → expediente), que NO fuerza el panel, la pareja de
  `sessionStorage` con ventana fake, el array de dependencias REAL de
  `firmar` leído de la fuente (REG-310), y los dos lados del enlace («el
  dato tiene que llegar»: `/citas` lee `?d=`).

### Verificado en navegador real (11-ago-2026)

Mismo método (emuladores + siembra + build de producción + `npm start`).
Arnés nuevo: `scripts/design/capturar-cierre-agenda-seguimiento-v15.mjs`.
Resultado y 5 capturas en `docs/design/capturas/v15-cierre-agenda-seguimiento/`
(desktop 1440 + móvil 390, flujo COMPLETO en los dos — el móvil no reabre la
nota del escritorio, firma la suya):

- **La hoja del paciente dice «Su próxima cita · martes, 8 de septiembre de
  2026»** — en palabras, no ISO (`enPalabrasNoISO: true`), desktop y móvil.
- **El checklist trae «Agendar el seguimiento»** tras firmar
  (`seguimientoEnChecklist: true`).
- **Pulsarlo aterriza en la agenda del día exacto del control**:
  `urlCitas=/citas?d=2026-09-08` y el `input[type=date]` de la pantalla
  real dice `2026-09-08` (`agendaAterrizoEnElDia: true`) — el otro lado del
  enlace, medido.
- **Al volver, el paso está MARCADO** (opacidad 0.55 con ✓ verde, captura
  `03-tras-volver-seguimiento-marcado.png`) — en la primera pasada del
  arnés esto daba `marcado: null`; la pareja de `sessionStorage` y REG-310
  salieron de ahí.
- **Emulador como testigo del dato**: tareas `seguimiento` derivadas y
  `patient.proximoSeguimiento` actualizado (ver REG-310 arriba).
- **Axe**: las mismas cuatro familias preexistentes de toda la rama
  (`color-contrast` teal de evidencia, `heading-order`, `landmark-unique`,
  `region`) — ninguna nueva, ninguna en el paso nuevo ni en la hoja.
- **Consola**: sólo los artefactos conocidos del arnés de emuladores (401
  de auditoría, warning de reconexión de Firestore).

### Compuertas de esta corrida

- `npx vitest run`: en verde salvo el fallo PRE-EXISTENTE y ambiental de
  siempre (`ops-timeout-y-punto-ciego`, proxy de red del contenedor,
  verificado en aislamiento) — 16 casos nuevos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (3 veces esta corrida: base, +sessionStorage,
  +REG-310).
- `clinical-safety-gate.test.ts`: en verde con el sello nuevo (totalCasos
  4544→4560).
- `docs/design/SCREEN_INVENTORY.md` regenerado.

## Fase 8 — decisión de cierre (12-ago-2026): la integración por continuidad ES la forma final

La pregunta que la corrida anterior dejó abierta a propósito («¿volver
`/receta`/`/orden` inline dentro de `/consulta`, o declarar la integración
por continuidad como la forma final de Fase 8?») se decidió al inicio de
una corrida fresca, como estaba escrito. **Decisión: la integración por
continuidad es la forma final de Fase 8. La fase se cierra.** Razones:

1. **Lo que §33 Fase 8 pide** es «Make note/prescription/order transition
   part of encounter, not module hopping». El module hopping era la
   PÉRDIDA DE CONTEXTO, y esa ya no existe — verificado en navegador real
   por las cinco rebanadas: la URL dice la verdad (`?nota=`), el atrás de
   la app regresa de verdad a la consulta con su checklist vivo
   (Navigation API), el checklist recuerda receta/orden/seguimiento
   hechos, `InstrumentStrip` mantiene EN QUIÉN ESTÁ el médico dentro de
   `/receta`/`/orden`, y el cierre agenda el seguimiento. §21 («return
   exactly where you were») se cumple medido, no supuesto.
2. **Inlinear los generadores sería el cambio más caro y más riesgoso de
   todo V15**: `/receta` y `/orden` cargan motores de seguridad completos
   (dosis, alergias, interacciones — regla medication-safety) y
   `/consulta` ya es una página de ~5900 líneas. Moverlos a un panel roza
   la lógica congelada de §1 y multiplica el riesgo de regresión clínica
   por un beneficio que la continuidad ya entrega por otra vía.
3. **Es reversible**: si el dueño quiere el inline, es una unidad nueva
   con su propio análisis de riesgo — nada de lo entregado lo estorba.
4. La decisión de la tercera rebanada («Active Patient Canvas, DECISIÓN»)
   ya había clasificado `/receta`/`/orden`/`/nota` como modos distintos
   legítimos (documento imprimible, motores propios) — esta decisión es su
   consecuencia natural, no un giro.

Con esto, la siguiente fase del plan (§33) es `V15-MOBILE-001` (Fase 9).

## Siguiente tarea exacta (histórico pre-decisión)

Con la quinta rebanada cerrada, la cadena «Note → Rx → Orders →
Instructions → Follow-up» de §33 Fase 8 tiene TODOS sus eslabones en el
cierre. La decisión de alcance quedaba abierta para una corrida fresca —
resuelta arriba el 12-ago-2026.

**Deuda anotada, no bloqueante (heredada de fases previas, sigue sin
resolverse, candidata a fases futuras — no se repite su detalle si ya está
arriba):**
- `BottomNav.tsx` no se suscribe a `EVENTO_GRABANDO` → `V15-MOBILE-001`
  (Fase 9).
- `landmark-unique` (cajón móvil `FlowRail`) y `region` (banners fuera de
  landmark) → `V15-A11Y-001` (Fase 13).
- `color-contrast` (encabezado teal de "Análisis basado en evidencia",
  3.03:1) y `heading-order` (`<h4>Sus medicamentos</h4>` de la hoja para el
  paciente) → también `V15-A11Y-001`.
- El campo de cierre (decisión/acción/aviso al paciente) de §9 sigue sin
  construirse — decisión de modelo pendiente del dueño, no bloqueante para
  cerrar Fase 6.
- `useSmartBack` sigue sin mejora en navegadores sin Navigation API
  (Firefox, Safari antiguos) — comportamiento idéntico al de antes de esta
  corrida ahí, decisión de alcance escrita arriba, no un olvido.

## `V15-MOBILE-001` (Fase 9, §22/§33) — primera rebanada: el pulgar navega la misma IA que el escritorio (12-ago-2026)

Medición de baseline de la fase, antes de tocar código: `BottomNav` (médico,
móvil) seguía con la IA VIEJA — Inicio · Agenda · [acción central] ·
Pacientes · CRM — mientras el escritorio ya navegaba por los cinco contextos
de V15 desde `V15-SHELL-GREYBOX-001`. El mismo médico tenía DOS mapas
mentales según el tamaño de su pantalla; en móvil no existía NINGUNA entrada
a `/pendientes` (la cola de cierre de Fase 7) ni a `/operaciones`, y
`BottomNav` ignoraba `EVENTO_GRABANDO` (deuda anotada desde
`V15-ENCOUNTER-MODE-001`). Las dos deudas se pagaron en una rebanada porque
viven en el mismo archivo y el mismo arnés las verifica juntas:

- **`src/components/BottomNav.tsx`** — nuevo bloque `CONTEXTOS_V15` (Hoy ·
  Paciente · Seguimiento · Operaciones — los MISMOS hrefs que pinta
  `FlowRail`, comparados archivo contra archivo por el guardián, no copiados
  a mano) que se usa cuando `navPrimaria` es verdadero. ENCUENTRO no es una
  quinta pestaña: sigue siendo la ACCIÓN CENTRAL contextual que este
  componente ya tenía (`accionContextual`, sin tocar — su prueba vieja sigue
  en verde sin cambios), que es exactamente lo que §22 pide («start
  encounter» como trabajo primario del pulgar). Sin filtro `rutaPermitida`
  en el bloque V15: FlowRail decidió que los contextos núcleo no se recortan
  por paquete y el móvil no diverge del escritorio. Agenda y CRM viven en
  `/operaciones` (§11), igual que en escritorio.
- **`navPrimaria` viene del layout** (`<BottomNav navPrimaria={navPrimaria} />`)
  — el MISMO criterio, calculado UNA vez, que elige FlowRail vs Sidebar
  (`esMedicoReal && mode === 'medico'`): no se recalcula el rol en el
  componente. Secretaria / rol no-médico conservan la barra anterior
  byte-idéntica (COMMON + CRM/Chat + filtro de paquete) — mismo alcance
  escrito que fijó FlowRail.
- **§8.1 también en móvil**: `useGrabando()` local suscrito al MISMO
  `EVENTO_GRABANDO` (patrón FlowRail: el evento es la única fuente de
  verdad; cada pieza del shell se suscribe por su cuenta). Sólo se atenúan
  ÍCONOS de destinos no activos (0.4 — WCAG 1.4.11, no-textual, 3:1);
  ETIQUETAS y acción central jamás (la lección de contraste de FlowRail:
  `--text3` sobre `--s1` no tiene margen AA para atenuarse). Gate
  `navPrimaria && grabando`: la barra heredada no cambia de conducta ni
  durante una grabación. `iconoAtenuado()` exportada pura para probarse
  sin jsdom.
- Guardián nuevo, probado al revés (mismo patrón que sus hermanos):
  `src/__tests__/v15-bottom-nav-cinco-contextos.test.ts` — 6 de sus 10
  casos fallan contra el árbol previo (verificado con `git stash`):
  paridad de hrefs con FlowRail, prop del layout, suscripción al evento,
  `iconoAtenuado`, gate del aquietado y «sólo el ícono se atenúa».

### Verificado en navegador real (12-ago-2026)

Mismo método que todas las corridas de la rama (emuladores Auth/Firestore
+ siembra `sembrar-capturas.mjs` + build de producción + `npm start`;
`node_modules` volvió a faltar al arrancar el contenedor — `npm ci` de
nuevo). Arnés nuevo: `scripts/design/capturar-bottom-nav-v15.mjs`
(viewport móvil 390×844 con touch real + control de escritorio 1440).
Resultado y 3 capturas en `docs/design/capturas/v15-bottom-nav/`:

- **La IA nueva, en el DOM real**: `Hoy→/dashboard · Paciente→/pacientes ·
  Nueva cita→/asistente (central) · Seguimiento→/pendientes ·
  Operaciones→/operaciones`.
- **El enlace llega («el dato tiene que llegar» aplicado a navegación)**:
  se PULSÓ «Seguimiento» con tap real y la URL aterrizó en `/pendientes` —
  la cola de cierre por fin es alcanzable con el pulgar.
- **En el expediente la acción central ofrece la consulta de ESE
  paciente**: `Consulta→/consulta/pac-aurelio-dominguez`.
- **Grabando, medido con `getComputedStyle`**: íconos no activos
  (Hoy/Seguimiento/Operaciones) en 0.4; el contexto activo (Paciente) en 1;
  la acción central en 1; las CINCO etiquetas de texto en 1. Al apagar el
  evento, todo vuelve a 1.
- **Escritorio 1440**: la barra NO se pinta (`display:none` por CSS, sin
  cambio).
- **Axe (móvil, dashboard): 0 violaciones. Consola: 0 errores.**

### Compuertas de esta corrida

- `npx vitest run`: 8855 pasan (10 nuevos), 1 fallo PRE-EXISTENTE y
  ambiental (`ops-timeout-y-punto-ciego` — mismo caso «el error dice cuánto
  esperó y a quién», mismo fingerprint del proxy de red del contenedor
  documentado en todas las corridas previas; reproducido en aislamiento).
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo, emuladores,
  proyecto `demo-nexusmed-test`).

**Siguiente tarea exacta de esta fase:** §22/§23 son más que la barra —
quedan por revisar los trabajos móviles restantes (revisar nota generada,
revisar resultado, firmar/cerrar desde el teléfono, borrador de
comunicación al paciente) y el modelo responsivo §23 por breakpoint (qué
persiste, qué colapsa, qué se vuelve hoja/cajón). El cajón lateral móvil
(`FlowRail` dentro del `role="dialog"` — origen del `landmark-unique`
preexistente) y la topbar móvil tampoco se han recompuesto — candidatos
para la siguiente rebanada de `V15-MOBILE-001`.

## Reglas de la corrida (recordatorio)

- Una sola rama V15; sin PR nuevo por corrida; nunca force-push.
- Estructura antes que piel; greybox antes de estilo — ya aplicado al código,
  no sólo a una revisión puntual.
- Lógica clínica/negocio congelada: ningún cambio de esta corrida tocó una
  ruta de API, una regla de Firestore ni un cálculo clínico.
- Móvil: `V15-MOBILE-001` (Fase 9) EN CURSO — primera rebanada entregada
  (`BottomNav` con la IA de V15 + aquietado al grabar).

## `V15-MOBILE-001` (Fase 9, §22/§23) — segunda rebanada: el cajón se retira y Buscar llega al pulgar (12-ago-2026)

La deuda que la primera rebanada dejó nombrada («el cajón lateral móvil —
origen del `landmark-unique` preexistente — y la topbar móvil tampoco se
han recompuesto») se pagó completa, y la corrida arrancó verificando la
prioridad 1 del routine: el asunto de CSS de `.nx-stat-grid` ya estaba
resuelto y sellado desde `c98525d` (guardián `nx-stat-grid-cableada.test.ts`
+ arnés propio) — verificado, no re-hecho.

- **`layout.tsx`** — el cajón móvil (backdrop + `role="dialog"` + clon de
  `FlowRail`) se renderiza SÓLO cuando `!navPrimaria`. Para el médico era
  exactamente lo que §22 prohíbe («Do not expose the complete desktop
  navigation tree on mobile»): el mismo territorio dos veces (BottomNav con
  los 5 contextos Y una hamburguesa con los mismos 5 en cajón), y el clon
  duplicaba `<aside aria-label="Navegación clínica principal">` — la RAÍZ
  del `landmark-unique` que axe marcó en TODAS las capturas de esta rama
  (13 corridas, verificado contra sus `resultado.json`). No se renombró el
  aria-label (eso callaría a axe dejando el defecto de IA intacto): se
  quitó la segunda navegación. La asistente conserva su cajón con `Sidebar`
  sin cambio.
- **Topbar de médico**: sin hamburguesa (no hay cajón que abrir) y con un
  botón Buscar (44×44, borde derecho — pulgar, §22) que dispara
  `nexus:open-palette`. SEARCH/COMMAND — quinto contexto de la IA V15 — no
  tenía NINGUNA entrada móvil: ⌘K no existe en un teléfono y el único
  botón visible vivía dentro del cajón retirado.
- **`operaciones/page.tsx`** — sección «Sesión» con «Cerrar sesión»
  (`salirSeguro`, el MISMO de FlowRail/Sidebar — espera acuse y purga
  IndexedDB, no una salida propia): era lo único del cajón sin otra casa
  móvil. Operaciones es el área de sistema (§11).
- Guardián nuevo, probado al revés (6 de 7 casos fallan contra el árbol
  previo, verificado con `git stash`):
  `src/__tests__/v15-topbar-y-cajon-movil.test.ts` — compuerta
  `!navPrimaria` del cajón, `FlowRail` renderizado UNA sola vez, hamburguesa
  sólo en rama de asistente, Buscar cableado al evento real con los dos
  lados del enlace (la paleta lo escucha y está habilitada para el médico),
  y el logout de /operaciones con `salirSeguro` (no `firebase/auth`
  directo). `v15-flow-rail-cableado.test.ts` caso 3 actualizado a la
  conducta nueva (el cajón ya no clona FlowRail) — la MISMA conducta
  gruesa, forma nueva.

### Verificado en navegador real (12-ago-2026)

Mismo método de toda la rama (emuladores Auth/Firestore + siembra +
build de producción + `npm start`; `node_modules` volvió a faltar —
`npm ci` de nuevo). Arnés nuevo: `scripts/design/capturar-topbar-movil-v15.mjs`.
Resultado y 5 capturas en `docs/design/capturas/v15-topbar-movil/`
(móvil 390×844 + escritorio 1440):

- **Móvil, medido en DOM real**: `hamburguesaEnDOM: false`,
  `buscarEnDOM: true`, `buscarTactil: 44×44`, `buscarPegadoADerecha: true`,
  `asidesNavPrincipal: 1`, `dialogMenuEnDOM: false` — en `/dashboard` y en
  `/expediente/[patientId]`.
- **El enlace llega, de punta a punta**: tap en Buscar → la paleta ABRE →
  se tecleó «Aurelio» → tap en el resultado → aterrizó en
  `/expediente/pac-aurelio-dominguez`. Los dos lados medidos, no supuestos.
- **`landmark-unique`: CERO por primera vez en la rama.** Las 13 carpetas
  de capturas V15 previas lo traían; esta corrida no (axe con
  `best-practice` incluido, mismo alcance que cuando se detectó). Queda
  sólo la familia `region` preexistente (banners/topbar fuera de landmark,
  3-5 nodos) → sigue anotada para `V15-A11Y-001`.
- **Cerrar sesión desde /operaciones SALE de verdad**: tap → `/login`
  (`cerrarSesionAterrizaEnLogin: true`). El locator necesitó scope a
  `<main>` porque el botón de FlowRail (oculto por CSS en móvil) también
  dice «Cerrar sesión» — anotado en el propio arnés.
- **Escritorio 1440 sin cambio**: topbar móvil `display:none`, FlowRail
  con su propio Cerrar sesión (`railLogout: true`), un solo aside.
- **Consola**: sólo los 401 de auditoría ya documentados como artefacto
  del arnés de emuladores (mismo fingerprint que v15-patient-anchor).

### Compuertas de esta corrida

- `npx vitest run`: en verde (ver commit); guardianes nuevos incluidos.
- `node scripts/lint-trinquete.mjs`: 96 = techo, sin deuda nueva.
- `node scripts/design/trinquete-de-diseno.mjs`: sin deuda nueva.
- `npx tsc --noEmit`: limpio.
- `npm run build`: compila limpio (`.env.local` demo, emuladores,
  proyecto `demo-nexusmed-test`).
- `docs/design/SCREEN_INVENTORY.md` regenerado (`/operaciones` creció por
  la sección «Sesión»).

**Hallazgos de pulido de esta corrida (anotados, no bloqueantes):**
- En móvil la palabra «Ausculta» aparece DOS veces apiladas (topbar +
  `InstrumentStrip` justo debajo) — redundancia visual que la captura
  `dashboard--movil.png` enseña a simple vista. Candidato a fusionar
  topbar e InstrumentStrip en móvil en una rebanada futura de esta fase.
- El pie de la paleta dice «⌘K abrir/cerrar» también en el teléfono, donde
  ⌘K no existe — desktop-ism de contenido (§25), candidato al mismo lote.

**Siguiente tarea exacta de esta fase:** el modelo responsivo §23 por
breakpoint (qué persiste, qué colapsa, qué se vuelve hoja/cajón) y los
trabajos móviles restantes de §22 (revisar nota generada, revisar
resultado, firmar/cerrar desde el teléfono, borrador de comunicación al
paciente) — medirlos primero contra las pantallas reales en 390px antes
de decidir la rebanada.
