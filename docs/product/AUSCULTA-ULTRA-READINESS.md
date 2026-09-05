# AUSCULTA — ULTRA READINESS

> **Qué es esto.** El documento vivo del programa *Preservation, Audit &
> Intelligence Transformation* (pliego del dueño, 5-sep-2026). Reúne en un solo
> sitio qué capacidad está probada, qué está escrita sin probar, qué está rota,
> qué espera algo de fuera y qué decidió el dueño — sin que las cinco cosas se
> parezcan.
>
> **Regla**: el estado sale del **código y de las compuertas medidas hoy**, no
> de un checkpoint anterior. Donde una auditoría dice una cosa y el orquestador
> no la verificó, se dice «reportado, no verificado».
>
> Hermanos: [`AUSCULTA-CONSULTORIO-FINAL-READINESS.md`](AUSCULTA-CONSULTORIO-FINAL-READINESS.md)
> (los 13 workstreams del Master Completion Loop, 29-ago) y
> [`AUSCULTA-MASTER-BOARD.md`](AUSCULTA-MASTER-BOARD.md). Este documento no los
> sustituye: añade la capa de **preservación** (KEEP LIST) y las auditorías del
> 5-sep.

| | |
|---|---|
| **Rama** | `claude/ausculta-preservation-improvement-44lutz` (nace de `main` `e78e1242`, v1181) |
| **Producción** | `nexusmed-v1181` (botón pinado, PR #453) |
| **Escritor** | esta sesión, única. El bucle de Actions apunta a PR #401 (cerrado) y se planta solo |
| **Actualizado** | 2026-09-05 |

## Estados

`PROVEN` · `IMPLEMENTED_NOT_PROVEN` · `PARTIAL` · `BROKEN` · `BLOCKED_EXTERNAL` ·
`DEFERRED_BY_OWNER` · `NOT_IMPLEMENTED` · `NOT_APPLICABLE`

`PROVEN` exige una prueba que **falla sin el arreglo** y corre en cada
`vitest run`. «Codificado» no es «terminado»; «funciona en el emulador» no es
«producción».

---

## 1 · Compuertas, medidas en esta rama (5-sep-2026)

| Compuerta | Antes del tramo (main `e78e1242`) | Tras REG-512…521 |
|---|---|---|
| `npx vitest run` | **12 598 pasan · 1 falla · 1 skip** (934 archivos, 253 s) | **12 698 pasan · 1 falla (entorno)** tras REG-521 (943 archivos); cada slice anota la suya en su commit |
| La falla | `ops-timeout-y-punto-ciego` exige que `10.255.255.1` trague paquetes; el proxy del contenedor rechaza al instante. **Entorno, no árbol.** La aserción no se toca | igual |
| `npx tsc --noEmit` | limpio | limpio |
| `node scripts/lint-trinquete.mjs` | **94** = techo | **93**, techo apretado con REG-517 |
| Sello `invariantes-clinicos.json` | 457 archivos · 6 453 casos | **467 · 6 547** |
| Ledger | 305 REG · última REG-511 | **315 · REG-521** |
| `npm run build` | compila en CI con placeholders `NEXT_PUBLIC_FIREBASE_*` | 163/163 páginas en cada slice |

**Corrección a un bloqueo declarado.** `agent-state/BLOCKERS.md` B-12 decía que
el producto no se puede abrir en un navegador desde este entorno. Hoy se
comprobó que **el emulador de Firebase arranca aquí** (auth y firestore listos,
jar descargado), así que el arnés `arnes:emuladores → arnes:sembrar → arnes:dev`
con Chromium es viable. Lo que sigue sin existir es WebKit (403 de la política de
red). B-12 pasa de «bloqueado» a «no ejecutado todavía en esta rama».

---

## 2 · KEEP LIST — lo que ya es bueno y se protege

Verificado **en el código**, no en la documentación. Cada línea nombra la
prueba o el guardián que lo defiende. Tocar cualquiera de estos exige demostrar
equivalencia (§«Ninguna pérdida funcional sin autorización» del pliego).

| Activo | Dónde vive | Cómo se defiende | Estado |
|---|---|---|---|
| **Clinical Truth**: 7 estados (`NEGADO … CONFLICTIVO`), procedencia obligatoria, un hecho en conflicto no se sobreescribe | `src/lib/clinical-truth/index.ts` | `validateClinicalFact` lanza; `appendClinicalFact` marca CONFLICTIVO en vez de pisar | PROVEN |
| **Autoridad explícita del médico**: sólo `tipoOrigen: 'medico'` firma un diagnóstico; el modelo nunca «confirma» | `fhir/la-certeza-que-sale-al-mundo.ts`, REG-364/365/372/407 | golden sellados | PROVEN |
| **El crudo nunca se borra**: `transcripcionMotor` y `transcripcionCruda` se guardan los dos y van bajo el sello | `expediente/firestore.ts`, `integrity.ts` | auditoría de voz 5-sep: seguido hasta la escritura y el hash | PROVEN |
| **Aprendizaje del médico** 1→1, visto dos veces, sin cifra/unidad/par prohibido, nunca nombre del paciente, **sólo sesga** | `src/lib/asr/aprendizaje*` | probado al revés | PROVEN |
| **Presupuesto del sesgo por modelo** (224 Whisper · 1000 / 200 AAI) y orden paciente > catálogo | `asr/lexicon.ts`, `sesgo-diarizado.ts` | `whisper-prompt-presupuesto`, `sesgo-llega-al-motor-bueno` | PROVEN |
| **Gateway único de IA**: costo asentado aunque falle, interruptor por proveedor **y por llave**, contrapresión, correlación ≠ requestId | `src/lib/ia/gateway.ts` | REG-353, 17 rutas por la puerta; sólo `ai-keys` y `health` fuera | PROVEN |
| **Agenda transaccional**: allowlist anti mass-assignment, fecha validada en servidor, sobreagenda sólo médico y auditada, `branchId` rechazado a propósito | `api/appointments/route.ts` | leído hoy por el orquestador | IMPLEMENTED_NOT_PROVEN (cableado leído, no ejecutado hoy) |
| **Portal del paciente**: HMAC en tiempo constante, alcance fail-closed, revocación en 3 estados (503 no quema el enlace), 429 estricto, lista blanca de salida | `patient-token.ts`, `portal/vigencia-del-enlace.ts`, `api/portal/route.ts` | REG-331, y desde hoy REG-512 en la tercera ruta | PROVEN |
| **Aislamiento entre consultorios**: guard = path en las 99 rutas; modelo path-scoped | `firestore.rules`, `authz/`, `test:emulador` (140 casos) | equipo rojo 5-sep: refutado en las 99 | PROVEN (emulador) |
| **Tres sitios por colección** (reglas · matriz · respaldo) con guardián que deriva el censo del código | `scripts/seguridad/colecciones-escritas.mjs` | REG-340 | PROVEN |
| **IA del paciente sin modelo**: clasifica antes de contestar; urgencia > acto prohibido > administrativo > plan > escalar; nivel 9 no origina datos | `paciente/pregunta-del-paciente.ts` | 29 fixtures en `evals/patient-ai/` bajo vitest | PROVEN |
| **Motores deterministas registrados** con `pendiente_validacion` honesto | `clinical/registry.ts` | 47 marcas; el LLM no calcula (guardián de prompts) | PROVEN, validación clínica pendiente del dueño (C-1) |
| **Marco de regresión**: 306 REG con causa raíz, «qué NO cubre», familia de defecto y sello | `docs/audit/regression-ledger.md`, `calidad/familias-de-defecto.ts` | `clinical-safety-gate`, `de-que-se-enferma-este-sistema`, `dos-escritores-no-pueden-dar-el-mismo-numero` | PROVEN |
| **Pausa reversible** de Hospital/UCI en una línea | `navegacion/modulos-en-pausa.ts` | guardián en las dos direcciones | PROVEN |
| **Compuertas de despliegue**: botón que deriva la versión del árbol autorizado, acta antes de publicar | `deploy-production.yml`, REG-504/505 | `el-tablero-del-loop-no-miente` | PROVEN |

---

## 3 · Auditoría del 5-sep — seis frentes read-only, verificados por el orquestador

Panel en paralelo (equipo rojo de API · voz · medicación · test-the-test ·
seguridad · experiencia del paciente). El orquestador **verificó en el código**
lo que marca ✔; lo demás es «reportado».

### P0

**Ninguno confirmado.** Cross-tenant en escritura clínica: **refutado en las 99
rutas** (la variable que se verifica es la que enraíza la ruta de Firestore).

### P1 — confirmados

| ID | Qué | Verificado | Estado |
|---|---|---|---|
| **P1-A** | `telesalud/sala` aceptaba el magic-link **sin comprobar `portalTokenVersion`**: un enlace revocado seguía abriendo la sala de video 7 días. El cron que lo emite afirmaba lo contrario | ✔ leído y reproducido (200 con URL donde debía ser 401) | **CERRADO — REG-512** |
| **P1-B** | Voz: los **alérgenos del expediente no llegaban a Whisper** por ningún camino (`anexarContexto` y `flushChunks` omitían `alergias`; las dos rutas lo leían y recibían `[]`). El guardián casaba el literal en la rama de AssemblyAI | ✔ reproducido sobre un `FormData` real | **CERRADO — REG-513** (una lista para los cuatro puntos de envío) |
| **P1-C** | Portal: una pregunta **escalada** (incluso `URGENT_REVIEW_REQUIRED`) en un consultorio sin teléfono no avisaba a nadie ni dejaba rastro, y al paciente se le decía «el consultorio la va a ver». Nadie leía `preguntas_paciente` | ✔ reproducido ejecutando la ruta: documento escrito, cero tareas, cero avisos | **CERRADO — REG-514 + REG-516**: la escalación abre una tarea `pregunta_paciente` en `/pendientes` (crítica si urgente), haya teléfono o no; y cerrarla marca `atendidaEn` por una ruta de servidor, así que el portal dice «ya la revisó» |
| **P1-D** | Test-the-test: el guardián del **paciente equivocado** (asistente, booking, webhook) se satisfacía con un COMENTARIO — mutante verde en los 3 caminos. El código es sano; el guardián no protegía, y no estaba sellado | ✔ mutantes reproducidos dentro del propio archivo | **CERRADO — REG-515**: comentarios fuera, se exige la llamada Y que su resultado decida, un solo `[0]` declarado, autotest contra los mutantes, barrido de cuartos caminos, sellado |

### Receta (medication-safety) — PARTIAL / BROKEN, después de los P1

- ~~Sin detección de **terapia duplicada** (paracetamol + Tempra pasa)~~ — **CERRADO, REG-521**: misma sustancia en dos renglones (por el catálogo de `dosis.ts`, que ya sabía que Tempra es paracetamol) o ya vigente en el expediente; la suma diaria contra el techo que ya estaba en el catálogo. En la consulta y en la receta. Clases terapéuticas (dos AINE distintos) siguen `NOT_IMPLEMENTED`, declarado.
- ~~**Red pediátrica apagada en silencio** cuando `edad` falta~~ — **CERRADO, REG-517**: la fecha de nacimiento manda, la edad congelada después, y sin ninguna la receta lo pinta en ámbar junto a las dosis. No bloquea (D-A).
- ~~La **creatinina del expediente** (`labsDelCuadro`) llega a la consulta y **no a la receta**; `interaccionesDelCuadro` (REG-188) tampoco~~ — **CERRADO, REG-520**: la receta carga paneles y notas firmadas, cruza lo de hoy con lo vigente (y dice qué ya existía) y precarga la creatinina más reciente con su fecha y su vigencia a 7 días (`STALE_RENAL_FUNCTION` cuando caduca; se sigue calculando, REG-375).
- `validacionesGeneralesMedicamentos`, `tieneAlergiaGrave`, `esMedicamentoCritico`: **cero llamadores, verificado el 5-sep** (sólo pruebas y el registro). Clasificación: `IMPLEMENTED_NOT_PROVEN`. No se cablean en este tramo a propósito: `validacionesGeneralesMedicamentos` necesita un contexto (embarazo, ERC, anticoagulación) que la receta no tiene estructurado y sus patrones (`aines`, `prednisona` como crítico) no los ha revisado el médico; conectarlos sin esa revisión sería señalar de más. Queda para el dueño (§9): decidir si esas reglas valen tal cual, y entonces se cablean con su prueba. `esMedicamentoCritico` y `tieneAlergiaGrave` son marcas de pantalla sin pantalla; el registro los declara como puertas de entrada y **existen**, pero no se llaman.
- ~~El hash de lo impreso puede **perderse entero** si `meta` se trunca~~ — **CERRADO, REG-518**: se acota por campo, el hash y el folio siempre caben, lo omitido se declara en el asiento.
- Que las alertas **no bloqueen** la impresión es **política**: no se toca sin decisión del dueño (cola §9).

### Seguridad — reportado

- `safeLog` no redacta `nombre`, `pacienteNombre`, `diagnosticos`, `motivo` ni `sk_live_`/`whsec_` pese a prometerlo en su cabecera (hoy sin fuga activa: los ~40 sitios pasan ids y `Error`). MEDIO.
- `reclamarCanal` es check-then-write sin transacción; `dueño === ''` cuenta como libre. MEDIO-BAJO.
- 360dialog: la llave viva como id de documento; webhook sin HMAC. MEDIO-BAJO.
- `String(err)` hacia el cliente en ~25 rutas y en un redirect. BAJO.
- ~~`arco/cancelar` no sube `portalTokenVersion`~~ — **CERRADO, REG-519 (D-034)**: el bloqueo ARCO revoca el portal en el mismo acto.
- `npm audit`: 0 críticas; lo único servido al navegador es `dompurify` (moderada) vía `html2pdf.js`.

### Test-the-test — cifras

571 de 934 archivos leen fuente; **215 son 100 % guardianes de texto**; 75 de
ellos sellados. 82 bucles sobre listas derivadas sin guarda de longitud. 27
casos con `toBeDefined` como única aserción. **0** tautologías, **0**
`continue-on-error` en `ci.yml`. `csp-manifest`: 4 casos que nunca corren en CI
porque vitest va antes del build. `autorizacion-servidor.test.ts`: el doble
ignora el id del documento (la frontera del Admin SDK). Sello con 31 casos de
holgura.

---

## 4 · Trabajo válido sin absorber

| Qué | Dónde | Qué hace falta |
|---|---|---|
| PR **#442** — REG-444 y REG-506 (vista previa del papel medida contra una constante; la captura «completa» enseñaba un tercio) | `claude/ausculta-product-transformation-mckih5`, 52 commits atrás | **Sus dos números ya los gastó `main`** (REG-444 = token en registro de errores; REG-506 = índices). Renumerar, traer `main`, PR nuevo. Es la séptima colisión del contador |
| Commit «huérfano» 5ce5da80 (alergias en el teléfono) | — | **Ya está en `main` como REG-437.** El consolidado del 2-sep estaba atrasado; no hay nada que hacer |

---

## 5 · Bloqueado por fuera (sin cambios respecto al 29-ago, salvo B-12)

Reglas de Firestore nuevas sin desplegar (dueño) · WebKit/iPhone real · PITR y
`gcloud firestore databases restore` · pentest externo · licencias de evidencia ·
llave de AssemblyAI local (B-11) · `OPS_ALERTA_WEBHOOK` · cuenta de prueba en CI.

**B-12 ya no es bloqueo** (ver §1).

---

## 6 · Diferido por el dueño

Hospital / UCI (`DEFERRED_BY_OWNER`, en pausa de navegación D-030) · Documents
Zero-Friction (`DEFERRED_BY_OWNER_TEMPORARILY`). No se desarrolla nada nuevo ahí.

---

## 7 · Regresiones de este programa

| REG | Qué | Prueba | Al revés |
|---|---|---|---|
| **512** | El enlace revocado del paciente seguía abriendo la sala de video | `el-enlace-revocado-no-abre-la-sala.test.ts` (8) | 200 con URL → 401/503; el guardián de enumeración nombraba la ruta |
| **513** | Los alérgenos del expediente no llegaban a Whisper por ningún camino | `los-alergenos-llegan-tambien-a-whisper.test.ts` (8) | la lista vieja sobre un `FormData` real pierde `alergias`; el guardián nombraba las dos listas de Whisper |
| **514** | La pregunta escalada del paciente no le llegaba a nadie del consultorio | `la-pregunta-escalada-llega-al-worklist.test.ts` (8) | sin el arreglo: 4 rojos (ninguna escritura en `tareas_clinicas`), 4 verdes |
| **515** | El guardián del paciente equivocado se satisfacía con un comentario | `paciente-equivocado-guardia.test.ts` (10 ejecutados) | autotest: los mutantes «el primero» con import y comentarios intactos ponen rojo el detector; el código real pasa |
| **516** | La pregunta atendida seguía «pendiente de revisar» en el portal | `la-pregunta-atendida-se-ve-en-el-portal.test.ts` (9) | con `/pendientes` sin el gancho, el guardián se pone rojo |
| **517** | Sin edad en el expediente, la receta aplicaba topes de adulto a un niño, en silencio | `la-edad-que-falta-se-dice-no-se-supone-adulto.test.ts` (9) | con las dos pantallas como estaban, cuatro casos rojos |
| **518** | La huella de una receta larga se perdía entera en la bitácora, con `ok: true` | `la-huella-de-la-receta-larga-no-se-pierde.test.ts` (8) | con la ruta como estaba, `meta: null` para 80 fármacos |
| **519** | La cancelación ARCO dejaba vivo el enlace del portal del paciente | `la-cancelacion-arco-apaga-el-portal.test.ts` (5) | con la ruta como estaba, la versión no subía y `decidirVigencia` seguía diciendo «vigente» |
| **520** | La receta sólo veía el papel de hoy: ni la medicación vigente ni la creatinina del expediente | `la-receta-ve-el-expediente-completo.test.ts` (16) | con la pantalla como estaba, los cuatro casos del guardián rojos; `detectarInteracciones(hoy)` no ve warfarina + ketorolaco y el cuadro sí |
| **521** | «Paracetamol 500 mg» + «Tempra 1 g» pasaban renglón a renglón: 4 500 mg/día sin aviso | `la-misma-sustancia-dos-veces-se-dice.test.ts` (17) | `revisarDosis` por renglón, vacío; con la lista y las dos pantallas como estaban, cinco rojos |

Compuertas tras REG-512: se anotan en el commit y en la bitácora de sesión
(`docs/maintenance/`), no aquí de memoria.

---

## 8 · Verificación en navegador

**Ninguna en esta rama todavía.** GP-FINAL (74 casos, Chromium, 1-sep) es el
último recorrido completo, sobre otro árbol. Con el emulador comprobado hoy, el
recorrido se repite en esta rama cuando haya un cambio de pantalla que lo pida;
REG-512 es de servidor y se midió ejecutando la ruta.

---

## 9 · Decisiones que sólo puede tomar el dueño (nuevas hoy)

| # | Decisión | Recomendación por omisión | Qué sigue sin ella |
|---|---|---|---|
| ~~D-A~~ | **RESUELTA 5-sep-2026 (D-032): sólo AVISAR.** Una alergia crítica o una interacción mayor no bloquea imprimir ni firmar. Escrita en la receta, junto al cruce de alergias | — | — |
| ~~D-B~~ | **RESUELTA 5-sep-2026 (D-033): SÍ viaja completa.** La pregunta escalada va entera (hasta 300 caracteres, con nombre) al WhatsApp del consultorio. WA-9 queda resuelto por decisión. Escrita en `pregunta-del-paciente.ts` | — | — |
| ~~D-C~~ | **RESUELTA 5-sep-2026 (D-034): SÍ.** El bloqueo ARCO sube `portalTokenVersion` en el mismo acto y el enlace del paciente deja de servir. Implementada como **REG-519** | — | — |
| **D-D** | Tres validadores escritos y sin llamador (`validacionesGeneralesMedicamentos`: embarazo/ERC/anticoagulación por expresión regular; `esMedicamentoCritico`; `tieneAlergiaGrave`). ¿Valen sus reglas tal cual para conectarlas a la receta y a la consulta, o se revisan antes? Conectarlas sin revisar sería señalar de más (regla 5) | `src/lib/expediente/medical-dictionary.ts`, `src/lib/seguridad/alergias.ts` | Se cablean con prueba en cuanto lo diga; si dice que no, se quitan del registro como puertas de entrada |

Las anteriores (C-1…C-6, O-1…O-4, E-2, N-1, N-2, D-08) siguen en
`agent-state/OWNER_DECISIONS_REQUIRED.md`.

---

## 10 · Preparación para producción — lectura honesta

- **No hay P0 abierto.** Los cuatro P1 confirmados están cerrados (REG-512 a
  516). Lo que queda son los hallazgos de receta reportados y sin verificar
  (§3), y los guardianes de texto del test-the-test.
- **Lo que se vende (Practice)** sigue siendo lo que GP-FINAL recorrió el 1-sep.
- **Este programa no despliega ni fusiona.** Llega a rama + commit + PR + CI.

## 11 · Siguiente slice

**La receta queda cerrada en lo verificado** (REG-517, 518, 520, 521); los
tres validadores sin llamador esperan decisión del dueño (§3, §9). Sigue el
port de #442 con números nuevos, y los tres siguientes del
test-the-test (`autorizacion-servidor` ignora el id del documento;
`csp-manifest` no corre en CI; `el-llm-no-calcula` casa literales).
