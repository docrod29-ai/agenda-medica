# AUSCULTA — MASTER COMPLETION LOOP · DIRECTIVO CANÓNICO

> **Éste es el contrato del canal.** No es un resumen ni una interpretación: es el
> directivo del dueño, íntegro. Si algo de este repositorio lo contradice, gana
> este documento.
>
> Vive en disco porque la memoria de una sesión no sobrevive a su cierre. Ya
> ocurrió lo que eso provoca: `AUSCULTA_MASTER_LOOP.md` quedó en 33 líneas
> apuntando a una rama muerta, los 26 apartados vivían sólo en el mensaje del
> dueño, y una sesión posterior trabajó **un censo de tres programas** creyendo
> que era el producto entero.

Custodiado por `src/__tests__/un-programa-de-tres-no-es-el-producto.test.ts`.

---

## MISIÓN

Llevar Ausculta Consultorio desde su estado ACTUAL hasta el máximo nivel de
completitud técnica, clínica, operativa y de producción que pueda demostrarse
honestamente dentro del repositorio y del entorno disponible.

**ESTE ES UN LOOP DE EJECUCIÓN, NO UNA AUDITORÍA DE POWERPOINT.**

No una lista de cosas que podrían hacerse. No un reporte bonito. No volver a
descubrir trabajo ya descubierto. No declarar completitud por cansancio. No
convertir trabajo difícil en `BLOCKED_EXTERNAL`.

El ciclo es:

```
DESCUBRIR GAP REAL → causa raíz → implementar → probar → intentar romper
→ medir → documentar evidencia → actualizar ledger → siguiente gap → continuar
```

---

## 0. REGLA DE CONTINUIDAD — CRÍTICA

Antes de nada, leer el estado ACTUAL: repositorio, rama, commits, PRs, ledger,
matrices, certificaciones, pruebas y documentación canónica.

**NO usar como fuente de verdad cifras históricas escritas en el prompt.** La
fuente es el ledger más reciente.

Lo que ya esté `PROVEN` / `CLOSED` / `IMPLEMENTED` / `VERIFIED` **no se rehace**.

Si otro agente tocó `main` durante la ejecución: reconciliar de forma
conservadora. No forzar. No destruir trabajo. No perder sellos ni guardianes de
regresión. **No reiniciar el programa**: continuar desde el último checkpoint.

## 1. MASTER BOARD / CUSTODIA — WS-01

Representación canónica, verificable y actualizada del programa, que custodie
explícitamente al menos: Clinical Truth · Voice · Clinical Reasoning · Evidence ·
Consultorio · Automation · Learning · Patient Experience · WhatsApp · Mobile UX ·
Scale · Reliability · Observability · Security · Disaster Recovery · Evaluation ·
Patient State · Closed Loop · Evidence Applicability · Specialty Packages ·
Production Readiness.

Conservando los objetivos **15k/20k/30k/50k/100k usuarios** y
**10k/20k/30k/50k pacientes por médico**.

Ningún requisito puede desaparecer porque cambió un documento, se regeneró una
matriz o otro agente tocó el repositorio. Estados: `PROVEN` · `PARTIAL` ·
`NOT_STARTED` · `BLOCKED_EXTERNAL` · `NEEDS_CLINICAL_REVIEW` · `DEFERRED`.

**`PARTIAL` no significa terminado. `NOT_PROVEN` tampoco.**

## 2. SCALE / CAPACITY — WS-02

No aceptar «la arquitectura soporta 100 000 usuarios». Separar: registered ·
active · **daily active** · concurrent active sessions · concurrent requests ·
per tenant · per physician · burst · sustained.

Escenarios: 2k · 10k · 15k · 20k · 30k · 50k · 100k. Cada uno define: usuarios
registrados · médicos activos · pacientes activos · sesiones concurrentes ·
requests concurrentes · request mix · read/write ratio · Firestore operations ·
AI calls · Evidence calls · **voice-related operations** · **background jobs** ·
queue depth · burst profile · sustained duration · throughput · timeout rate ·
error rate · p50 · p95 · p99 · **retries** · **provider failures** ·
backpressure · **cost signals**.

Si el entorno no puede generar 100k reales: **NO marcar WS-02 entero
`BLOCKED_EXTERNAL`.** Construir el arnés completo, validar escalas alcanzables,
dejar perfiles reproducibles, comandos y configuración, y definir exactamente qué
infraestructura falta para cada escala. **Sólo la ejecución imposible queda
bloqueada.**

## 3. CONSULTORIOS GRANDES / 50K PACIENTES POR MÉDICO — WS-03

Eliminar de rutas calientes: lecturas ilimitadas · getDocs masivos · listeners
sin límite · `Promise.all` explosivos · filtrado cliente de colecciones grandes ·
cargar historial completo para una pantalla · fan-out innecesario · N+1 · queries
no indexables · re-render costoso · almacenamiento local sin límites ·
serialización gigantesca.

Usar: keyset pagination · limit · startAfter · indexed search · bounded history ·
lazy loading · virtualization · progressive retrieval · cache · summary
projections.

**PARA MOSTRAR 20 PACIENTES NO DESCARGAR 50 000.**

## 4. RELIABILITY / BACKPRESSURE / IDEMPOTENCY — WS-04

Cerrar: idempotencia · retry policy · deduplication · queue semantics ·
backpressure · dead-letter · timeouts · provider failure · partial failure ·
network interruption · duplicate submission · double-click · refresh/retry · race
conditions.

Probar: same request twice · retry after timeout · **provider succeeds but client
times out** · network disconnect after write · duplicate callback · **duplicate
webhook** · refresh during save · **parallel tabs** · slow provider · provider
unavailable · **queue saturation**.

No perder notas. No duplicar órdenes, mensajes, cobros ni tareas.

## 5. MOBILE / SCROLL / NAVIGATION INTEGRITY — WS-05

Causas raíz, no parches: scrollTop · scrollIntoView · focus · hydration ·
visualViewport · 100vh/100dvh · sticky · fixed · keyboard · safe areas · banners ·
anchoring · nested scrolling · route transitions · restoration · iOS/WebKit.

Validación crítica **390 px / WebKit**, recorridos largos, repeticiones: consulta
→ receta → volver · consulta → orden → volver · consulta → evidencia → volver ·
paciente → consulta → volver · editar → navegar → regresar.

**El trabajo clínico NO debe desaparecer por navegación.**

## 6. EVIDENCE SOURCE AUDIT — WS-06

Inventariar honestamente: PubMed/MEDLINE · PMC · ClinicalTrials.gov · CDC · WHO ·
FDA/DailyMed · NEJM · JAMA · Lancet · BMJ · Clinical Infectious Diseases · Nature
Medicine · Annals · Cochrane · UpToDate · DynaMed · OpenEvidence · Scopus ·
Embase · Crossref; y guías IDSA · CDC · WHO · NIH · EASL · ECIL · NCCN ·
Surviving Sepsis · COFEPRIS.

Por fuente: canonical name · aliases · publisher · official route · adapter ·
runtime · license · authentication · metadata · abstract · full-text · cache
semantics · PHI policy · freshness · failure semantics · provenance · tests ·
known gaps.

Estados honestos: `LIVE_DIRECT` · `LIVE_VIA_INDEX` · `READY_BUT_NOT_LICENSED` ·
`METADATA_ONLY` · `EXTERNAL_LINK` · `BLOCKED_LICENSE` · `UNAVAILABLE`.

**No afirmar «integración NEJM» si sólo se recupera un PMID vía PubMed.**

## 7. JOURNAL-AWARE RETRIEVAL + GUIDELINE ENGINE — WS-07

Preservar: journal canonical · aliases · publisher · PMID · PMCID · DOI · fecha ·
article type · provider · open access · full-text availability · provenance.
Normalizar nombres de revistas. **No dar más peso metodológico por marca
editorial.**

Guías: organization · title · version · date · section/passage · jurisdiction ·
population · topic · superseded · provenance. **Si dos guías discrepan, MOSTRAR
LA DISCREPANCIA** — no decidir en silencio.

## 8. COMMERCIAL EVIDENCE READINESS — WS-08

Preparar legalmente los adaptadores. **NO**: scraping ilegal · bypass de paywall ·
credenciales personales compartidas · endpoints privados no documentados · copiar
corpus protegido.

Dejar explícito qué existe, qué no, qué contrato/licencia falta, qué credencial,
qué API oficial, y qué desbloquearía LIVE. **`READY_BUT_NOT_LICENSED` ≠ `LIVE`.**

## 9. EVIDENCE APPLICABILITY — WS-09

Motor explícito que responda «¿ESTA evidencia aplica a ESTE paciente?».
**No delegarlo al LLM.**

Dimensiones: edad · sexo cuando sea pertinente · embarazo · lactancia · función
renal · función hepática · inmunosupresión · alergias · microorganismo ·
susceptibilidad · resistencia · sitio · prótesis · dispositivos · comorbilidades ·
interacciones · gravedad · setting · tratamiento previo · jurisdicción.

**El sistema NO debe convertir desconocimiento en seguridad.** Si un ensayo
excluyó embarazadas y no sabemos si lo está: `INSUFFICIENT_PATIENT_DATA`, nunca
«aplica». La aplicabilidad viaja con la evidencia y su provenance.

## 10. PATIENT STATE LONGITUDINAL — WS-10

Sobre Clinical Truth, **sin crear una segunda verdad clínica**. Representar con
temporalidad y provenance: problemas activos · diagnósticos confirmados ·
sugeridos · medicamentos reportados · activos · alergias · reacciones ·
procedimientos · dispositivos · laboratorios · tendencias · riesgos · pendientes ·
respuesta al tratamiento · follow-up commitments.

**HISTÓRICO ≠ ACTUAL. SUGERIDO ≠ CONFIRMADO. REPORTADO ≠ PRESCRITO.
PRESCRITO ≠ TOMADO.** El médico conserva autoridad explícita.

## 11. CLOSED LOOP — WS-11

Órdenes · laboratorios · imagen · interconsultas · resultados · referencias ·
mensajes · seguimientos · tareas, con ciclo real:

```
proposed → ordered → scheduled → performed → resulted → reviewed
→ acted_on → patient_notified → closed
```

Con owner · patient · encounter · deadline · priority · transition history ·
provenance.

**Un resultado recibido NO está cerrado sólo porque llegó. Un pendiente NO
desaparece porque el usuario cambió de pantalla.**

## 12. EVALUATION KERNEL + COST/QUALITY ROUTER — WS-12

Toda función IA relevante debe poder evaluarse: accuracy · clinical omissions ·
hallucination · unsupported claims · citation quality · entailment · attribution ·
applicability · provenance · safety · latency · cost · editing burden ·
completion · regression.

Cada feature importante: **dataset · metric · threshold · failure policy**.

El médico no debería elegir proveedor a mano. El router decide por complejidad ·
riesgo clínico · latencia · costo · provider health · calidad demostrada, **sin
degradar en silencio la calidad clínica**.

## 13. SECURITY / OBSERVABILITY / DR — WS-13

Observabilidad de punta a punta (browser → API → job → provider) con correlation
ID seguro **y sin PHI**.

Medir: availability · request rate · error rate · p50/p95/p99 · AI health ·
Evidence health · Firestore health · jobs · queues · retries · failed saves ·
recovery · white screens · provider health · **authorization anomalies** ·
**tenant violations**.

Alertas: degradation · outage · retry storm · queue saturation · failed save
spike · provider failure · tenant isolation anomaly.

Seguridad: tenant isolation · least privilege · App Check · MFA · secret
handling · authorization guards · auditability.

DR: backup · PITR · restore drill · synthetic restore validation · **RPO** ·
**RTO**, cubriendo Firestore · Storage · Vercel · AI providers · Evidence
providers · WhatsApp/Meta. **No declarar DR probado sin restore real.**

## 14. VOICE

Tolerar consultas largas y lenguaje clínico. Evaluar errores **clínicamente
pesados**: medicamentos · dosis · unidades · números · negación · lateralidad ·
temporalidad · speaker attribution · diagnósticos · alergias.

**WER global NO es suficiente**: hace falta scoring clínico ponderado. Si falta
gold externo legítimo, construir internamente la infraestructura de scoring, la
taxonomía de error, los fixtures permitidos, los umbrales, la política de fallo y
el marco de regresión — y dejar bloqueado **sólo** lo que necesita audio externo.

## 15. LEARNING

**PREFERENCIA DEL MÉDICO ≠ POLÍTICA CLÍNICA.**

Aprender formato · orden · estilo · frecuencia de acciones · plantillas ·
preferencias administrativas y de documentación. **No** convertir hábitos en
diagnóstico · tratamiento · orden · receta · firma · regla clínica universal.

## 16. AUTOMATION

Automatizar drafts · context retrieval · recordatorios · flujos administrativos ·
result routing · creación de tareas · preparación de comunicación al paciente.

**No ejecutar automáticamente** sin autoridad: diagnóstico confirmado · orden
clínica · prescripción · firma médica · cambio terapéutico crítico.

## 17. SPECIALTY PACKAGES

Infectología / Antimicrobial Stewardship primero; Medicina Interna después. Los
paquetes reutilizan el núcleo canónico: **no crear Clinical Truth paralela por
especialidad**.

## 18. UX / MOBILE SAFETY COMPARTIDOS

Aunque Product Excellence tenga su carril, Master preserva los invariantes
funcionales: 390 px · WebKit · WCAG 2.2 AA · keyboard/focus · no lost drafts · no
white screens · no hidden critical pending work · no navigation-induced data loss.
**No invadir cambios puramente visuales del otro carril.**

## 19. HOSPITAL / ICU

Fuera de alcance salvo: defecto del núcleo compartido · regresión · tenant/security ·
invariante compartido de Clinical Truth · infraestructura compartida. **No ampliar
scope.**

## 20. CROSS-LANE SAFETY

Product Excellence corre en paralelo. **No rehacer su trabajo.** Si otro carril
tocó la misma región: investigar; si es compatible, reconciliar conservador; si
hay conflicto real, `CROSS_LANE_CONFLICT` documentando archivo · región ·
intención Master · intención Product Excellence · riesgo · resolución recomendada.
**No destruir en silencio el trabajo del otro carril.**

## 21. GATES

Tras cambios significativos: vitest · typecheck/tsc · lint trinquete · design debt
guard · build · emulator/integration · targeted regression · browser/e2e ·
security invariants.

**Un fallo ambiental conocido debe distinguirse de una regresión real. No ocultar
rojo nuevo.**

## 22. ANTI-REPETICIÓN

Antes de implementar, buscar evidencia de que ya existe. Si existe y está probado,
no reimplementar. Si existe parcialmente, cerrar sólo el gap. **Si el ledger está
equivocado, corregir el ledger** — no crear una segunda implementación porque el
censo esté desactualizado.

## 23. BLOCKED_EXTERNAL

Sólo cuando el trabajo necesite algo fuera del control del repositorio: licencia
comercial · credencial oficial · infraestructura de carga real · proveedor no
disponible · dispositivo físico · gold externo legítimo · pentest externo ·
decisión imprescindible del dueño.

Documentar siempre: `WHAT_IS_BLOCKED` · `WHY` · `WHAT_IS_ALREADY_DONE` ·
`EXACT_UNLOCK` · `HOW_TO_VERIFY_AFTER_UNLOCK`. Y **continuar con otro requisito**.

## 24. NEEDS_CLINICAL_REVIEW

No inventar decisiones clínicas del dueño. Documentar: pregunta exacta · opciones ·
consecuencia de cada opción · default seguro si existe · qué código queda
esperando. Después **seguir trabajando en otra cosa**.

## 25. DEFINICIÓN DE «TERMINADO»

No se declara terminado porque el CI esté verde, compile, haya muchos commits,
queden sólo `PARTIAL`, o se lleve mucho tiempo trabajando.

El loop se detiene **sólo** cuando:

1. no queda ningún `NOT_STARTED` internamente accionable;
2. no queda ningún `PARTIAL` internamente accionable;
3. no queda ningún `NOT_PROVEN` internamente accionable;
4. los `BLOCKED_EXTERNAL` tienen unlock concreto;
5. `NEEDS_CLINICAL_REVIEW` tiene pregunta concreta;
6. `DEFERRED` es deliberado y documentado;
7. las compuertas relevantes están verdes;
8. el ledger refleja el repositorio real.

## 26. MODO DE EJECUCIÓN

**NO detenerse después de cada requisito.**

```
seleccionar siguiente por dependencia → inspeccionar lo existente
→ encontrar el gap mínimo real → implementar → pruebas específicas
→ guardián de regresión probado al revés → compuertas → ledger → siguiente
```

Si hay bloqueo: registrarlo y continuar. Si el requisito ya está hecho: probarlo,
corregir el ledger y continuar. Si `main` cambia: reconciliar sin destruir.

**NO MERGE salvo instrucción explícita actual del dueño.
NO DEPLOY salvo instrucción explícita actual del dueño.**

**OBJETIVO FINAL: AGOTAR TODO EL TRABAJO INTERNAMENTE ACCIONABLE DEL MASTER
PROGRAM SIN REPETIR TRABAJO, SIN INVENTAR EVIDENCIA Y SIN PERDER NINGÚN
REQUISITO.**
