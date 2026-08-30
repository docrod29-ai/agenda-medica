# AUSCULTA — MASTER COMPLETION LOOP
## CONTINUACIÓN CANÓNICA DESDE EL ESTADO ACTUAL

> **Fuente**: pegado por el dueño (Dr. David Alonso Rodríguez Luna) el
> **30-ago-2026**, literal y completo. Hasta esa fecha este pliego sólo existía
> dentro de conversaciones de chat. `docs/product/AUSCULTA-MASTER-BOARD.md` es
> la **derivación** de este pliego hecha por un agente, no su fuente: los
> nombres `WS-01 … WS-13` del tablero salen de las secciones 1–13 de aquí.
>
> **Regla**: no se resume, no se reescribe. Si el tablero contradice este
> pliego, gana el pliego — salvo §0, que manda que el estado real del
> repositorio gane a las cifras escritas en el pliego.
>
> Carril: **A — Master Completion**. Tablero vivo en
> `docs/product/AUSCULTA-MASTER-BOARD.md`; reanudación en
> `agent-state/AUSCULTA_LAST_SAFE_CHECKPOINT.md`.

---

MISIÓN

Llevar Ausculta Consultorio desde su estado ACTUAL hasta el máximo nivel de completitud técnica, clínica, operativa y de producción que pueda demostrarse honestamente dentro del repositorio y del entorno disponible.

ESTE ES UN LOOP DE EJECUCIÓN, NO UNA AUDITORÍA DE POWERPOINT.

No quiero una lista de cosas que podrían hacerse.
No quiero un reporte bonito.
No quiero que vuelvas a descubrir trabajo ya descubierto.
No quiero que declares completitud por cansancio.
No quiero que conviertas trabajo difícil en BLOCKED_EXTERNAL.

Quiero:

DESCUBRIR GAP REAL
→ localizar causa raíz
→ implementar
→ probar
→ intentar romper
→ medir
→ documentar evidencia
→ actualizar ledger
→ seleccionar siguiente gap
→ continuar.

==================================================
0. REGLA DE CONTINUIDAD — CRÍTICA
==================================================

ANTES DE HACER NADA:

lee el estado ACTUAL del repositorio, rama, commits, PRs, ledger, matrices,
certificaciones, tests y documentación canónica.

NO uses como fuente de verdad cifras históricas escritas en este prompt.

El último estado conocido mostró una reducción importante de NOT_STARTED,
pero TU fuente de verdad debe ser el ledger más reciente.

Si algo ya está:

PROVEN
CLOSED
IMPLEMENTED
VERIFIED

NO LO REHAGAS.

Si otro agente modificó main o integró trabajo mientras estabas ejecutando:
reconcilia de forma conservadora.
No fuerces.
No destruyas trabajo.
No pierdas seals/regression guards.

NO reinicies el programa.
CONTINÚA desde el último checkpoint válido.

==================================================
1. MASTER BOARD / CUSTODIA DEL PROGRAMA — WS-01
==================================================

Debe existir una representación canónica, verificable y actualizada del programa.

Debe custodiar explícitamente, como mínimo:

Clinical Truth
Voice
Clinical Reasoning
Evidence
Consultorio
Automation
Learning
Patient Experience
WhatsApp
Mobile UX
Scale
Reliability
Observability
Security
Disaster Recovery
Evaluation
Patient State
Closed Loop
Evidence Applicability
Specialty Packages
Production Readiness

y conservar los objetivos:

15k / 20k / 30k / 50k / 100k usuarios

10k / 20k / 30k / 50k pacientes por médico

Ningún requisito puede desaparecer simplemente porque cambió el documento,
se regeneró una matriz o otro agente tocó el repositorio.

Para cada requisito debe existir estado inequívoco:

PROVEN
PARTIAL
NOT_STARTED
BLOCKED_EXTERNAL
NEEDS_CLINICAL_REVIEW
DEFERRED

PARTIAL no significa terminado.

NOT_PROVEN tampoco significa terminado.

==================================================
2. SCALE / CAPACITY — WS-02
==================================================

No aceptar afirmaciones del tipo:

“la arquitectura soporta 100,000 usuarios”.

Necesitamos separar claramente:

registered users
active users
daily active users
concurrent active sessions
concurrent requests
concurrency per tenant
concurrency per physician
burst concurrency
sustained concurrency

Crear o completar un modelo de workload reproducible.

Escenarios objetivo:

2k
10k
15k
20k
30k
50k
100k usuarios registrados.

Para cada escenario definir:

- usuarios registrados;
- médicos activos;
- pacientes activos;
- sesiones concurrentes;
- requests concurrentes;
- request mix;
- read/write ratio;
- Firestore operations;
- AI calls;
- Evidence calls;
- Voice-related operations cuando corresponda;
- background jobs;
- queue depth;
- burst profile;
- sustained duration;
- throughput;
- timeout rate;
- error rate;
- p50;
- p95;
- p99;
- retries;
- provider failures;
- backpressure;
- cost signals.

Si el entorno actual NO puede generar 100k reales:

NO marques WS-02 entero como BLOCKED_EXTERNAL.

Construye el harness completo.
Valida escalas alcanzables.
Deja perfiles reproducibles.
Deja comandos/scripts/configuración.
Define exactamente qué infraestructura externa falta para ejecutar cada escala.

Sólo la ejecución imposible puede quedar BLOCKED_EXTERNAL.

==================================================
3. CONSULTORIOS GRANDES / 50K PACIENTES POR MÉDICO — WS-03
==================================================

Audita rutas calientes y elimina patrones incompatibles con expedientes grandes:

- lecturas ilimitadas;
- getDocs masivos;
- listeners sin límite;
- Promise.all explosivos;
- filtrado cliente de colecciones grandes;
- cargar historial completo para mostrar una pantalla;
- fan-out innecesario;
- N+1;
- queries no indexables;
- re-render costoso;
- almacenamiento local sin límites;
- serialización gigantesca.

Usar cuando corresponda:

keyset pagination
limit
startAfter
indexed search
bounded history
lazy loading
virtualization
progressive retrieval
cache
summary projections

Regla:

PARA MOSTRAR 20 PACIENTES NO DESCARGAR 50,000.

Probar datasets grandes/sintéticos cuando sea posible.

==================================================
4. RELIABILITY / BACKPRESSURE / IDEMPOTENCY — WS-04
==================================================

Cerrar de forma seria:

idempotencia
retry policy
deduplication
queue semantics
backpressure
dead-letter behavior
timeouts
provider failure
partial failure
network interruption
duplicate submission
double-click
refresh/retry
race conditions

Nunca repetir ciegamente operaciones no idempotentes.

Para acciones clínicas o administrativas importantes:

cada intento debe tener semántica clara.

Probar:

same request twice
retry after timeout
provider succeeds but client times out
network disconnect after write
duplicate callback
duplicate webhook
refresh during save
parallel tabs
slow provider
provider unavailable
queue saturation

No perder notas.
No duplicar órdenes.
No duplicar mensajes.
No duplicar cobros.
No duplicar tareas.

==================================================
5. MOBILE / SCROLL / NAVIGATION INTEGRITY — WS-05
==================================================

Encontrar causas raíz, no parches.

Auditar:

scrollTop
scrollIntoView
focus
hydration
visualViewport
100vh
100dvh
sticky
fixed
keyboard
safe areas
banners
anchoring
nested scrolling
route transitions
restoration
iOS/WebKit behavior

Validación crítica:

390 px / WebKit.

Recorridos largos.

Repeticiones múltiples.

Consulta → receta → volver
Consulta → orden → volver
Consulta → evidencia → volver
Paciente → consulta → volver
Editar → navegar → regresar

El trabajo clínico NO debe desaparecer por navegación.

==================================================
6. EVIDENCE SOURCE AUDIT — WS-06
==================================================

Inventariar y representar honestamente fuentes científicas y regulatorias.

Como mínimo revisar:

PubMed / MEDLINE
PMC
ClinicalTrials.gov
CDC
WHO
FDA / DailyMed
NEJM
JAMA
Lancet
BMJ
Clinical Infectious Diseases
Nature Medicine
Annals
Cochrane
UpToDate
DynaMed
OpenEvidence
Scopus
Embase
Crossref

y guías relevantes:

IDSA
CDC
WHO
NIH
EASL
ECIL
NCCN
Surviving Sepsis
COFEPRIS

cuando corresponda.

PARA CADA FUENTE:

canonical name
aliases
publisher
official route
adapter
runtime
license
authentication
metadata availability
abstract availability
full-text availability
cache semantics
PHI policy
freshness
failure semantics
provenance
tests
known gaps

Estados honestos, por ejemplo:

LIVE_DIRECT
LIVE_VIA_INDEX
READY_BUT_NOT_LICENSED
METADATA_ONLY
EXTERNAL_LINK
BLOCKED_LICENSE
UNAVAILABLE

No afirmar “integración NEJM” si sólo recuperamos un PMID vía PubMed.

==================================================
7. JOURNAL-AWARE RETRIEVAL + GUIDELINE ENGINE — WS-07
==================================================

Preservar:

journal canonical
journal aliases
publisher
PMID
PMCID
DOI
publication date
article type
provider
open access
full-text availability
provenance

Normalizar nombres de revistas.

NO otorgar mayor peso metodológico sólo por marca editorial.

Para guías preservar:

organization
guideline title
version
date
section/passage
jurisdiction
population
topic
superseded status
provenance

Si dos guías discrepan:

MOSTRAR LA DISCREPANCIA.

No decidir silenciosamente cuál “gana”.

==================================================
8. COMMERCIAL EVIDENCE READINESS — WS-08
==================================================

Preparar legalmente seams/adapters para fuentes comerciales.

NO:

scraping ilegal
bypass de paywall
credenciales personales compartidas
endpoints privados no documentados
copiar corpus protegido

Para UpToDate, DynaMed, Scopus, Embase, OpenEvidence u otros:

dejar explícito:

qué existe;
qué no existe;
qué contrato/licencia falta;
qué credencial falta;
qué API oficial se requiere;
qué desbloquearía LIVE.

READY_BUT_NOT_LICENSED ≠ LIVE.

==================================================
9. EVIDENCE APPLICABILITY — WS-09
==================================================

Construir/terminar un motor explícito que responda:

“¿ESTA evidencia puede aplicarse razonablemente a ESTE paciente?”

NO delegarlo exclusivamente al LLM.

Considerar cuando esté disponible:

edad
sexo cuando sea clínicamente pertinente
embarazo
lactancia
función renal
función hepática
inmunosupresión
alergias
microorganismo
susceptibilidad
resistencia
sitio de infección/enfermedad
prótesis
dispositivos
comorbilidades
interacciones
gravedad
setting
tratamiento previo
jurisdicción

El sistema NO debe convertir desconocimiento en seguridad.

Estados semánticos conservadores.

Ejemplo:

si un ensayo excluyó embarazadas y no sabemos si la paciente está embarazada:

INSUFFICIENT_PATIENT_DATA

NO “aplica”.

Nunca inventar datos ausentes.

La aplicabilidad debe viajar junto con la evidencia y su provenance.

==================================================
10. PATIENT STATE LONGITUDINAL — WS-10
==================================================

Construir sobre Clinical Truth.

NO crear una segunda verdad clínica.

Debe representar longitudinalmente, con temporalidad/provenance:

problemas activos
diagnósticos confirmados
diagnósticos sugeridos
medicamentos reportados
medicamentos activos
alergias
reacciones
procedimientos
dispositivos
laboratorios
tendencias
riesgos
pendientes
respuesta al tratamiento
follow-up commitments

HISTÓRICO ≠ ACTUAL.

SUGERIDO ≠ CONFIRMADO.

REPORTADO ≠ PRESCRITO.

PRESCRITO ≠ TOMADO.

El médico conserva autoridad explícita.

Resolver banderas y respuesta cuando sea internamente accionable.

==================================================
11. CLOSED LOOP CLINICAL WORK — WS-11
==================================================

Órdenes
laboratorios
imagen
interconsultas
resultados
referencias
mensajes
seguimientos
tareas

deben tener ciclo real cuando corresponda:

proposed
→ ordered
→ scheduled
→ performed
→ resulted
→ reviewed
→ acted_on
→ patient_notified
→ closed

Con:

owner
patient
encounter
deadline
priority
transition history
provenance

Un resultado recibido NO está cerrado sólo porque llegó.

Un pendiente NO desaparece porque el usuario cambió de pantalla.

Resolver especialmente, si siguen pendientes:

interconsultas-imagen
sobrevive-a-la-navegación
banderas/response integration

Las decisiones clínicas/operativas que requieran owner deben quedar explícitas,
no inventadas.

==================================================
12. EVALUATION KERNEL + COST/QUALITY ROUTER — WS-12
==================================================

Toda función IA relevante debe poder evaluarse.

Métricas según feature:

accuracy
clinical omissions
hallucination
unsupported claims
citation quality
entailment
attribution
applicability
provenance
safety
latency
cost
editing burden
completion
regression

Cada feature importante debe tener:

dataset
metric
threshold
failure policy

El médico NO debería elegir manualmente:

GPT vs Claude vs proveedor X.

El router interno debe poder decidir según:

complejidad
riesgo clínico
latencia
costo
provider health
calidad demostrada

SIN degradar silenciosamente la calidad clínica.

==================================================
13. SECURITY / OBSERVABILITY / DR / SCALE PROOF — WS-13
==================================================

Observabilidad end-to-end:

browser
→ API
→ job
→ provider

con correlation ID seguro y sin PHI.

Medir cuando corresponda:

availability
request rate
error rate
p50/p95/p99
AI health
Evidence health
Firestore health
jobs
queues
retries
failed saves
recovery
white screens
provider health
authorization anomalies
tenant violations

Alertas útiles para:

degradation
outage
retry storm
queue saturation
failed save spike
provider failure
tenant isolation anomaly

Seguridad:

tenant isolation
least privilege
App Check
MFA
secret handling
authorization guards
auditability

DR:

backup
PITR
restore drill
synthetic restore validation
RPO
RTO

Cubrir dependencias:

Firestore
Storage
Vercel
AI providers
Evidence providers
WhatsApp/Meta

No declarar DR probado sin restore real cuando éste sea necesario.

==================================================
14. VOICE
==================================================

Voice debe tolerar consultas largas y lenguaje clínico.

Evaluar específicamente errores clínicamente pesados:

medicamentos
dosis
unidades
números
negación
lateralidad
temporalidad
speaker attribution
diagnósticos
alergias

WER global NO es suficiente.

Debe existir scoring clínico ponderado.

Si falta gold externo legítimo:

construir internamente:

scoring infrastructure
error taxonomy
fixtures permitidos
thresholds
failure policy
regression framework

y dejar SOLAMENTE la validación que necesita audio/gold externo como
BLOCKED_EXTERNAL.

==================================================
15. LEARNING
==================================================

El sistema puede aprender preferencias del médico.

Pero:

PREFERENCIA DEL MÉDICO ≠ POLÍTICA CLÍNICA.

Aprender:

formato
orden
estilo
frecuencia de acciones
plantillas
preferencias administrativas
preferencias de documentación

NO convertir automáticamente hábitos en:

diagnóstico
tratamiento
orden
receta
firma
regla clínica universal.

==================================================
16. AUTOMATION
==================================================

Automatizar:

drafts
context retrieval
follow-up reminders
administrative workflows
result routing
task creation
patient communication preparation

pero NO ejecutar automáticamente sin autoridad apropiada:

diagnóstico confirmado
orden clínica
prescripción
firma médica
cambio terapéutico crítico

==================================================
17. SPECIALTY PACKAGES
==================================================

Prioridad:

Infectología / Antimicrobial Stewardship primero.

Medicina Interna después.

Los paquetes deben reutilizar el núcleo canónico.

NO crear Clinical Truth paralela por especialidad.

==================================================
18. UX / MOBILE SAFETY REQUIREMENTS COMPARTIDOS
==================================================

Aunque Product Excellence tenga su propio carril, Master debe preservar
invariantes funcionales:

390 px
WebKit
WCAG 2.2 AA
keyboard/focus integrity
no lost drafts
no white screens
no hidden critical pending work
no navigation-induced data loss

No invadas cambios puramente visuales propiedad del otro carril.

==================================================
19. HOSPITAL / ICU
==================================================

Hospital/UCI permanecen fuera del alcance de este loop salvo:

defecto del núcleo compartido;
regresión;
tenant/security issue;
Clinical Truth shared invariant;
infraestructura compartida.

No ampliar scope.

==================================================
20. CROSS-LANE SAFETY
==================================================

Existe Product Excellence en paralelo.

NO rehagas su trabajo.

Si detectas que otro carril ya modificó la misma región:

investiga.

Si son cambios compatibles:
reconcilia conservadoramente.

Si existe conflicto real:
CROSS_LANE_CONFLICT.

Documenta:

archivo
región
intención Master
intención Product Excellence
riesgo
resolución recomendada

NO destruyas silenciosamente el trabajo del otro carril.

==================================================
21. GATES
==================================================

Después de cambios significativos ejecutar las compuertas pertinentes.

Como mínimo cuando corresponda:

vitest
typecheck / tsc
lint trinquete
design debt guard
build
emulator/integration
targeted regression
browser/e2e
security invariants

Un fallo ambiental conocido debe distinguirse de una regresión real.

NO ocultar rojo nuevo.

==================================================
22. ANTI-REPETICIÓN
==================================================

ANTES de implementar un requisito:

buscar evidencia de que ya existe.

Si ya existe y está correctamente probado:
NO reimplementarlo.

Si existe parcialmente:
cerrar solamente el gap.

Si el ledger está equivocado:
corregir el ledger.

No crear una segunda implementación sólo porque el censo está desactualizado.

==================================================
23. BLOCKED_EXTERNAL
==================================================

Sólo usar BLOCKED_EXTERNAL cuando el trabajo realmente necesite algo fuera
del control de este repositorio/entorno.

Ejemplos:

licencia comercial
credencial oficial
infraestructura de carga real
proveedor no disponible
dispositivo físico necesario
gold externo legítimo
pentest externo
owner decision imprescindible

Siempre documentar:

WHAT_IS_BLOCKED
WHY
WHAT_IS_ALREADY_DONE
EXACT_UNLOCK
HOW_TO_VERIFY_AFTER_UNLOCK

Y CONTINUAR con otro requisito independiente.

==================================================
24. NEEDS_CLINICAL_REVIEW
==================================================

No inventar decisiones clínicas del owner.

Documentar:

pregunta exacta;
opciones;
consecuencia de cada opción;
default seguro si existe;
qué código queda esperando.

Después seguir trabajando en otra cosa.

==================================================
25. DEFINICIÓN DE “TERMINADO”
==================================================

NO declares Master Completion terminado porque:

CI está verde;
compila;
hay muchos commits;
quedan sólo PARTIAL;
o llevas mucho tiempo trabajando.

Puedes detener el loop sólo cuando:

1. no quede ningún NOT_STARTED internamente accionable;
2. no quede ningún PARTIAL internamente accionable;
3. no quede ningún NOT_PROVEN internamente accionable;
4. los BLOCKED_EXTERNAL tengan unlock concreto;
5. NEEDS_CLINICAL_REVIEW tenga pregunta concreta;
6. DEFERRED sea deliberado y documentado;
7. las compuertas relevantes estén verdes;
8. el ledger refleje el repositorio real.

==================================================
26. MODO DE EJECUCIÓN
==================================================

NO te detengas después de cada requisito.

Haz:

seleccionar siguiente requisito por dependencia
→ inspeccionar implementación existente
→ encontrar gap mínimo real
→ implementar
→ pruebas específicas
→ reverse-proven regression guard
→ gates pertinentes
→ actualizar ledger
→ siguiente.

Si encuentras un bloqueo:
regístralo y continúa.

Si encuentras un requisito ya hecho:
pruébalo/corrige ledger y continúa.

Si main cambia durante la ejecución:
reconcilia sin destruir trabajo.

NO MERGE salvo instrucción explícita actual del owner.
NO DEPLOY salvo instrucción explícita actual del owner.

OBJETIVO FINAL:

AGOTAR TODO EL TRABAJO INTERNAMENTE ACCIONABLE DEL MASTER PROGRAM
SIN REPETIR TRABAJO, SIN INVENTAR EVIDENCIA Y SIN PERDER NINGÚN REQUISITO.

EJECUTA AHORA.
