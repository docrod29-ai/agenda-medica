# AUSCULTA — MASTER BOARD

> **Qué es esto.** La fuente operativa del programa de terminación de Ausculta
> Consultorio. Un requisito que está aquí no desaparece porque otro avance.
>
> **Regla de este tablero**: el estado sale del **código leído hoy**, no de la
> documentación ni de un checkpoint anterior. Donde la documentación contradice
> al código, gana el código y la contradicción queda anotada.

| | |
|---|---|
| **Rama** | `claude/ausculta-consultorio-completion-hoahgw` |
| **SHA base** | `ba9d7a2f410157011a73ad87ea24f0edfc05560c` |
| **Fecha** | 2026-08-28 |
| **Base canónica** | `main` (rama 126 commits por delante, 0 por detrás) |
| **Tableros visibles** | #296 (padre) · #310 (escala) · #314 (evidencia) |

## Compuertas medidas en este SHA — no citadas de memoria

| Compuerta | Resultado | Observación |
|---|---|---|
| `npx vitest run` | **10 566 pasan · 1 falla · 1 omitido** (769 archivos) | Baseline eran 10 490; **+76 casos, cero regresiones**. La falla es `ops-timeout-y-punto-ciego.test.ts` |
| `node scripts/lint-trinquete.mjs` | **96**, igual que el techo | Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** | |
| navegador real | **no ejecutado** | ver WS-05 |

**Sobre la única falla.** No se hereda la etiqueta «preexistente»: se
reprodujo la causa. El caso exige que `10.255.255.1` **trague** los paquetes
para que venza un timeout de 30 ms; en este contenedor el proxy de salida
**rechaza** la conexión de inmediato, así que el helper lanza un error de
conexión antes de que el temporizador dispare. Es del entorno, no del producto.
Aflojar la aserción para ponerlo en verde está prohibido por §32. Queda
`BLOCKED_EXTERNAL (entorno)`.

## Estados

`NOT_STARTED` · `PREPARED` · `PARTIAL` · `IMPLEMENTED_NOT_PROVEN` · `PROVEN` ·
`BLOCKED_EXTERNAL` · `DEFERRED_BY_OWNER` · `DEFERRED_BY_OWNER_TEMPORARILY`

`PROVEN` exige evidencia de ejecución. Ningún requisito de este tablero está
hoy en `PROVEN` por medición de runtime salvo donde se dice explícitamente.

---

## P0 ABIERTOS — la lista corta

| ID | Defecto | Dónde | Verificado por |
|---|---|---|---|
| ~~P0-1~~ | ~~Un resultado de laboratorio de **consultorio** no genera tarea de revisión.~~ **CERRADO** — REG-337, `7247e1f`. Cierra «recibido → por revisar»; `acted_on` y `patient_notified` siguen sin existir en el modelo. | `src/lib/expediente/laboratorio/firestore.ts` | orquestador |
| ~~P0-2~~ | ~~La bitácora **append-only NOM-004** no está en el respaldo.~~ **CERRADO** — REG-340, `9f14d14`. Eran **9** colecciones, no una; el guardián nuevo deriva el censo del código. **Las reglas no se despliegan aquí**: `members` sigue roto en producción hasta que el dueño las publique. | `respaldo.ts` · `matriz-acceso.ts` · `firestore.rules` | orquestador |
| ~~P0-3~~ | ~~`getPatients()` descarga la colección entera.~~ **CERRADO** — REG-341, `4be92df`. Portado del PR #356 preservando REG-323. **Abre P1-11**: once pantallas reciben el recorte sin declararlo. | `src/lib/firestore.ts` | orquestador |
| ~~P0-4~~ | ~~`findNotaByIdInClinic()` N+1 en serie.~~ **CERRADO** — REG-341, `4be92df`. Consulta indexada acotada a 2 + sondeo con techo; por encima del techo devuelve `no-resoluble`, que no es `no-encontrada`. | `src/lib/expediente/firestore.ts` | orquestador |
| ~~P0-5~~ | ~~`Promise.all` sobre todos los pacientes.~~ **CERRADO** — REG-341, `4be92df`. Páginas con techo, notas en tandas, y **declara** si se quedó corta. Sigue debiendo leerse de un trabajo de servidor. | `cumplimiento/retencion/page.tsx` | orquestador |
| ~~P0-6~~ | ~~Rebote de scroll en iPhone.~~ **CAUSA RAÍZ CERRADA** — REG-342, `148a415`. Dos mecanismos: `scrollIntoView` disparado por el observador de scroll, y la barra sticky saliendo del flujo. **La verificación en iPhone sigue `BLOCKED_EXTERNAL`**: sólo hay Chromium instalado. | `ClinicalSpine.tsx` · `CierreAlPulgar.tsx` | orquestador (aritmética); **falta dispositivo** |
| ~~P0-7~~ | ~~La nota clínica completa se escribe en la consola del navegador.~~ **CERRADO** — REG-339, `7247e1f`. Quedan ids de internamiento en consola fuera del dashboard: son ids, no cuerpos clínicos. | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | orquestador |

## P1 ABIERTOS — los que tienen dueño claro

| ID | Defecto | Dónde |
|---|---|---|
| ~~P1-1~~ | ~~El secreto compartido de 2FA viaja en una URL a `api.qrserver.com`.~~ **CERRADO** — REG-338, `7247e1f`. Sigue abierto lo demás de MFA: **no se exige en el servidor** y `security-controls.ts` aún lo declara `planned`. | `cumplimiento/seguridad/page.tsx` |
| **P1-2** | Quedan **21 colecciones de nivel raíz** con declaración incompleta. Sin exposición de acceso (Admin SDK + comodín de denegación), pero **`clinic_members` sin respaldo = restaurar un consultorio deja a todos sin poder entrar**. La parte de consultorio la cerró REG-340. | `clinic_members`, `platform_*`, `rate_limits`, `errores`, `soporte`… |
| ~~P1-3~~ | ~~Tareas creadas sin `await` y con el error tragado.~~ **CERRADO** — REG-344, `4f1babd`. Sigue sin bloquear la firma (bloquearla cambiaría un pendiente perdido por una consulta perdida); lo que se arregló fue el silencio. |
| ~~P1-4~~ | ~~`tareasVivas()` truncaba en silencio.~~ **CERRADO** — REG-344, `4f1babd`. **No arregla QUÉ 200 vienen**: siguen siendo arbitrarias, y elegirlas exige un índice compuesto que se crea fuera del repositorio → **P1-14**. |
| ~~P1-5~~ | ~~Llamadas a proveedor sin señal de aborto.~~ **CERRADO** — REG-346, eran **13**, no 7. Sigue sin haber **circuit breaker ni presupuesto de reintentos** en ninguna parte → **P1-15**. |
| **P1-6** | **`BLOCKED_EXTERNAL` — requiere autorización del dueño.** Las alergias viven en `Patient`, que recepción lee (`allow read: if isMember`). E0-06 exige mudarlas a la subcolección `clinico`. **Verificado hoy: la migración no existe** — hay tipo, lista de campos (`CAMPOS_CLINICOS_PACIENTE`) y una prueba de forma; **no hay splitter de escritura, ni script de migración, ni un solo lector o escritor de `ResumenClinicoPaciente` en producción**. Por qué se para aquí: el beneficio de seguridad **sólo aparece cuando los campos se BORRAN de los documentos vivos** y se cierran las reglas — una acción destructiva sobre datos clínicos reales. Construir la mitad reversible no cierra nada y **crea riesgo de doble verdad en el campo más crítico del producto** (alergias): un paciente con la alergia en `clinico` y un lector sin respaldo la pierde. **Qué falta exactamente**: (1) autorización para correr el backfill contra producción, (2) decisión del dueño sobre si recepción conserva algún acceso, (3) despliegue de reglas. |
| ~~P1-7~~ | ~~Los avisos de evidencia se calculaban y la pantalla los tiraba.~~ **CERRADO** — REG-345, `44b52c9`. |
| ~~P1-8~~ | ~~La matriz prometía fuentes inexistentes.~~ **CERRADO** — REG-345, `44b52c9`. La columna cruza catálogo y runtime, con tres estados. |
| **P1-9** | **CORREGIDO TRAS VERIFICAR.** La auditoría decía que `.catch(() => [])` escondía el fallo. **No lo esconde**: `buscarEvidenciaMulti` marca un `testigo` mutable antes de que el `catch` lo alcance, y la ruta lo convierte en un aviso que distingue «no se pudo preguntar» de «no hay literatura», y la pantalla lo pinta. **Lo que sí falta**: esta ruta no produce sobre #314 —sin `Source`, sin procedencia estructurada— y **no declara proveedores no consultados**, así que en esta pantalla el médico no puede leer «UpToDate: no se consultó». |
| **P1-14** | `tareasVivas` sigue devolviendo **200 arbitrarias** de N. Elegir las más urgentes exige un índice compuesto de Firestore, que se crea **fuera del repositorio**: `BLOCKED_EXTERNAL` (infraestructura del dueño). Mientras tanto el aviso es la defensa, no la solución. |
| **P1-15** | **No hay circuit breaker ni presupuesto de reintentos** en ninguna parte. Un proveedor caído se sigue reintentando en cada petición. |
| **P1-16** | El **importador** no sabe reescribir las colecciones de nivel raíz que REG-343 metió en el respaldo. Un respaldo que se lleva algo que no se sabe devolver no cierra la recuperación. |
| **P1-11** | Once pantallas llaman a `getPatients` y reciben el **recorte sin declararlo** (`/pacientes`, `/citas`, `/crm`, `/asistente`, `/hospitalizacion`, `/farmacia`, `/membresias`, `/cumplimiento`, `/reactivacion`, `/migracion`). Ya no tumban el navegador, pero pueden decir «no hay» de un paciente que existe. |
| **P1-12** | `getNotas` sigue **sin cota**: la historia completa de un paciente, con las dos transcripciones dentro. La siguiente amplificación. |
| **P1-13** | Quedan otros escritores de scroll: el restaurador de `/consulta` se re-arma tras una lectura de Firestore **sin cancelación por gesto**; los banners asíncronos cambian la altura por encima de `<main>` (41 px medidos); `overscroll-behavior` no aparece en el repositorio. |
| **P1-10** | Texto completo de PMC se reproduce **sin filtro de licencia por artículo**. El catálogo lo declara como decisión pendiente; el filtro no existe. | `evidencia/pubmed.ts:182` · `catalogo.ts:279` |

---

## WS-01 — Master Board / custodia del programa

| | |
|---|---|
| **Estado** | `PARTIAL` — este archivo nace hoy |
| **Evidencia** | Reconciliado contra #296/#310/#314, 5 auditorías read-only y verificación directa del orquestador |
| **Qué falta** | Reconciliar con los 150 comentarios de #296 y con `agent-state/BACKLOG.json` (V9/V10/V15 arrastran requisitos propios) |
| **Siguiente** | Mantenerlo tras cada unidad cerrada |

## WS-02 — Escala / 100 k usuarios

| | |
|---|---|
| **Estado** | `PREPARED` — hay contrato de evidencia, no hay medición |
| **Evidencia** | `docs/product/CONSULTORIO_SCALE_EVIDENCE.md` + `scripts/product/validate-consultorio-load-result.mjs` |
| **Qué es** | Un **validador de forma** del JSON de resultados. Su propio texto lo dice: un exit 0 no significa que el candidato aguante 2 k, 10 k ni nada |
| **Qué falta** | El arnés que **produzca** ese JSON. No existe. Sin él, 2 k/10 k/15 k/20 k/30 k/50 k/100 k son todos `NOT_STARTED` en medición |
| **Bloqueos** | Ninguno interno |
| **Siguiente** | Después de WS-03: sin acotar las lecturas, medir sólo mediría el defecto |

## WS-03 — Consultorio grande / 50 k pacientes por médico

| | |
|---|---|
| **Estado** | `PARTIAL` — **existe implementación canónica y NO está en esta rama** |
| **Implementación canónica** | PR **#356** `product/scale-hotpaths-342` (draft, contra `main`) |
| **Qué trae #356** | `listarPacientesPagina` (keyset por `startAfter(nombre, id)` con `documentId()` de desempate), `buscarPacientes` (ventanas indexadas por prefijo), `listarPacientesCompat` con techo duro y bandera `truncada`, `buscarNotaEnClinica` acotada. Golden de 701 líneas |
| **Riesgo del port** | #356 es **anterior** a REG-323: su `updatePatient` no tiene `vistoEn`. Un merge ciego **regresaría** la guardia de concurrencia de esta rama. Hay que portar la API acotada sobre el archivo nuevo, conservando ambas |

**Inventario medido en este SHA**: 51 `getDocs`, **44 sin `limit()`**. 12
`onSnapshot`, 5 sin `limit()`. `collectionGroup`: **cero en todo el repositorio**.
**No existe paginación de cliente en ninguna parte** — `startAfter` sólo aparece
en 5 rutas de Admin SDK, con el patrón duplicado en línea cinco veces.

Lecturas ilimitadas más caras, además de P0-3/4/5:

| Dónde | Qué |
|---|---|
| `expediente/firestore.ts:216` | colección **entera** de citas del consultorio, en la baja de un paciente |
| `expediente/firestore.ts:41` `getNotas` | historia **completa** de notas de un paciente (llevan las dos transcripciones) |
| `expediente/firestore.ts:472` | todas las notas firmadas → `.sort().slice(0,3)` **en memoria** |
| `components/PaletteBusqueda.tsx:60` | Cmd-K **global** descarga 50 000 pacientes para enseñar 6 |
| `pacientes/page.tsx:934` | segunda descarga completa **sin caché** para deduplicar al guardar |
| `hooks/useAppointments.ts:94` | historia de citas de un paciente **en vivo**, sin cota ni límite |

**Documentos que crecen sin techo**: `internamientos/{id}` guarda seis arrays en
un solo documento; `indicaciones[].administraciones` no tiene tope (≈1 800
entradas en una estancia de UCI de 30 días). El patrón de corte **ya existe en
ese mismo archivo** (`.slice(-100)` en `balanceHidrico`) y no se aplicó a los
cuatro primeros. También `asr/aprendizaje-firestore.ts:81` (`arrayUnion` sin
tope, compartido por consultorio).

**Siguiente**: portar #356 preservando REG-323; después el resto del inventario.

## WS-04 — Resiliencia / colas / contrapresión

| | |
|---|---|
| **Estado** | `PARTIAL` |
| **Lo que sí hay** | Idempotencia por intención (`lib/idempotencia.ts`), rate-limit respaldado en Firestore y fail-open, `fetchConTimeout` con presupuestos por destino, reembolso de créditos cuando ningún modelo contestó (`gateway.ts:174`), degradación con procedencia honesta (`procesar/route.ts:264` sella `parser-local` en vez de heredar el modelo anterior) |
| **Lo que no hay** | **Ninguna cola, contrapresión, dead-letter ni circuit breaker.** `fetchConTimeout` se usa en **3 archivos**; 22 llamadas a proveedor lo esquivan y **7 no tienen señal de aborto** (P1-5) |
| **Precedente** | `docs/maintenance/sw-changelog.md:1519` documenta un socket colgado que inmovilizó una lambda de 300 s. `procesar` está en **800 s** |

## WS-05 — Móvil / rebote de scroll en iPhone

| | |
|---|---|
| **Estado** | `PARTIAL` — causa raíz **probable** identificada y verificada en código; **sin reproducir en dispositivo** |
| **Prioridad** | **P0** (defecto reportado por el dueño) |

**La precondición estructural.** El documento no hace scroll en el dashboard:
`.nx-app-shell` es `100dvh; overflow:hidden` (`globals.css:1049`) y quien scrollea
es `<main>` (`layout.tsx:806`). Y **`overflow-anchor` no aparece en ningún sitio
del repositorio** — Chrome y Firefox lo implementan y compensan solos el
contenido insertado por encima; **WebKit no lo implementa**. El mismo código no
salta en Android y salta en iPhone. Eso explica por qué es sólo de iPhone.
`overscroll-behavior`: **cero apariciones**.

**Candidato 1 — `ClinicalSpine.tsx:82`.** Verificado leyendo el archivo. Un
`IntersectionObserver` (`:53`) pone `activo` **como consecuencia directa de que
el médico baje**; el efecto de `:81-85` llama entonces a
`scrollIntoView({behavior:'smooth', block:'nearest'})`. El riel se pinta arriba
del expediente y **no tiene ninguna regla CSS** que lo fije, así que una vez
que el médico ha bajado el riel queda **fuera de pantalla por arriba**,
`nearest` deja de ser inocuo y `scrollIntoView` sube **todos los ancestros
scrollables** —`<main>` incluido— para enseñarlo. Con `smooth`, además, cancela
el impulso del dedo. El comentario del autor (`:79`, «`nearest`, para no
arrastrar la página») muestra que la intención era justo evitarlo: `nearest`
**minimiza** la corrección, no impide que la haya.

**Candidato 2 — `CierreAlPulgar.tsx:72`.** Una barra `position:sticky` se
**desmonta** cuando su zona entra en pantalla; `main.scrollHeight` encoge justo
cuando `scrollTop` está cerca del máximo, y WebKit recorta. Es sólo móvil por CSS.

**Candidato 3 — banners asíncronos por encima de `<main>`.** `layout.tsx:795,803,804`
montan hasta ocho barras **en flujo** cuando resuelven red o sesión. El propio
repositorio ya midió este mecanismo: `PorQueEstaAqui.tsx:112` registra **41 px de
desplazamiento de `main.scrollTop` en móvil y 0 en escritorio**.

**Candidato 4 — `consulta/page.tsx:3226`.** El restaurador se re-arma cuando
`notaInternamientoId` llega de un `.then()` de Firestore (`:1787`) y entonces
escribe `main.scrollTop` — **sin ninguna cancelación por gesto**, a diferencia de
`VolverALaFuente`.

**Por qué las pruebas están en verde.** Las diez pruebas de scroll son
`readFileSync` + `toContain`. `consultorio-scroll-focus-estable.test.ts:19`
compara **posiciones de caracteres dentro de un archivo**. No renderizan, no
despachan un toque, no leen una posición de scroll. `v15-cierre-al-pulgar.test.ts`
afirma que existe la cadena `'IntersectionObserver'` — es decir, **da por
aprobado el mecanismo que causa el candidato 2**. Sus propias cabeceras lo
declaran («No mide píxeles ni desplaza nada»). Y `e2e/` sólo tiene el humo
público **sin login**: el proyecto `iphone-safari` existe en
`playwright.config.ts:49` y nunca carga el dashboard. `grep scrollTop` en `e2e/`
y `tests/`: **cero**.

`v15-rtc12-la-identidad-no-se-desplaza.test.ts:43` documenta este mismo error
cometido antes: el arnés hacía `window.scrollTo(0,1500)`, que no movía nada
porque quien scrollea es `<main>`, **y aun así reportaba éxito**. Palabras del
repositorio: *«Una condición que pasa porque el gesto no ocurrió es peor que una
que falla.»*

**Qué falta**: reproducir en WebKit 390 px, 10 repeticiones, `scrollTop` que
nunca baje solo. Sin eso no se cierra (§38).

## WS-06/07/08 — Evidencia: estado honesto de las fuentes

| | |
|---|---|
| **Estado** | `PARTIAL` |
| **Prueba dura** | El conjunto **completo** de hosts de evidencia en `src/lib` + `src/app/api` son **dos**: `eutils.ncbi.nlm.nih.gov` y `api.fda.gov` |

**Vivo y alcanzable por un médico hoy — la lista completa:**

| Fuente | Estado | Nota |
|---|---|---|
| PubMed / MEDLINE | `LIVE_DIRECT` | `evidencia/pubmed.ts:108,120` |
| PMC (Open Access) | `LIVE_DIRECT` | sin filtro de licencia por artículo (P1-10) |
| openFDA (etiqueta) | `LIVE_DIRECT` | **cero pruebas** |

| Fuente | Estado |
|---|---|
| NEJM · JAMA · Lancet · BMJ · CID | `LIVE_VIA_INDEX` — resumen y metadatos vía PubMed. **No hay integración con ninguna editorial** |
| UpToDate · Cochrane · OpenEvidence | `READY_BUT_NOT_LICENSED` — adaptador deliberadamente inerte, sin URL y sin `fetch` |
| Perplexity | `DISCOVERY_ONLY` — impedido por tipos de aportar una `Source` |
| ClinicalTrials · WHO · CDC · DailyMed · Crossref · EMA · IDSA · ESCMID/EUCAST | `NOT_CONFIGURED` — fila de catálogo sin adaptador |
| DynaMed · Scopus · Embase · NCCN · ATS/ERS | `NOT_CONFIGURED` — ni siquiera catalogadas |
| NICE · KDIGO · ACC/AHA · ESC · ADA · Surviving Sepsis | `NOT_CONFIGURED` — cadenas de cita **fijas** dentro de motores clínicos |
| CENETEC (GPC mexicana) | `NOT_CONFIGURED` — es **un enlace a una búsqueda de Google** (`consultor-evidencia/route.ts:373`) presentado como botón |

**Sin scraping, y eso está bien construido.** Ni puppeteer, ni credenciales
compartidas, ni corpus copiado. `no-configurado.ts` no importa `fetch` y no
conoce ninguna URL, a propósito. La única credencial de evidencia es
`NCBI_API_KEY`, que es gratuita.

**Sólo 6 de 12 proveedores del catálogo se instancian** (`recuperacion-consultor.ts:194`).
PMC, ClinicalTrials, WHO, CDC y FDA nunca se declaran, así que la regla «un
proveedor no operativo baja pero no desaparece» **nunca dispara** para ellos: el
médico no puede leer «CDC: no se consultó» porque esa fuente no existe para el
selector.

**Metadatos que se pierden**: alias de revista (se lee `<Title>` **o**
`<ISOAbbreviation>`, y el otro se tira), **PMCID** (se resuelve y se descarta),
**DOI** (llega a la UI pero `desde-pubmed.ts` no lo pasa a `Source`), estado de
**acceso abierto** (no existe el campo), disponibilidad de texto completo, y el
ancla de pasaje. `provenance.pmids` existe en el tipo de la nota y **sólo lo
escribe una prueba**.

**La verificación de citas está construida, probada y nunca se llama.**
`mapaDeSoporte`, `esRespuestaRespaldada`, `tasaSinRespaldo` tienen **cero
llamadores fuera de pruebas**. La única comprobación en producción es de rango
numérico (`consultor/page.tsx:230`): un `[2]` que apunte a un artículo que dice
lo contrario pasa.

## WS-09 — Aplicabilidad de la evidencia a ESTE paciente

| | |
|---|---|
| **Estado** | `NOT_STARTED` — **ausente, no parcial** |
| **Evidencia** | `grep aplicabilidad\|applicab\|matchedCriteria` sobre `src/`: sin motor, sin implementación parcial, sin esqueleto |
| **Qué hay hoy** | Adaptación **sólo por prompt**: se le pide al modelo que «personalice por edad, comorbilidades y alergias». No hay compuerta determinista, ni cruce organismo/susceptibilidad, ni comprobación de población, ni forma de decir «este paciente no cumple la población del estudio» |
| **Dónde vive el plan** | `docs/roadmap/nexus-os/backlog.json:60` (E2-08). Las unidades E2 cerradas llegan hasta E2-02 |

## WS-10 — Patient State longitudinal

| | |
|---|---|
| **Estado** | `PARTIAL` |
| **Lo que sí existe y está cableado** | `problemas-activos.ts:70` y `ordenes-medicamento.ts:76` — proyección longitudinal real de **problemas activos** y **medicación activa**, con la regla dura correcta: el silencio no resuelve nada |
| **Lo que falta** | Alergias, procedimientos, dispositivos, laboratorios clave, tendencias, banderas de riesgo, respuesta al tratamiento y compromisos de seguimiento. **Sin versión, sin `asOf`, sin persistir**: se recalcula en el navegador en cada montaje, sobre `getNotas` sin cota |

**El activo mejor construido de esta área** es el ciclo de vida del medicamento
(`EstadoOrdenMedicamento`, `types/expediente.ts:72`), con
`probablemente_terminada` — «el sistema sabe que venció el calendario, no que el
paciente terminó» — y `procedenciaClinica: 'ya_lo_toma' | 'se_prescribe_hoy'`
(REG-183), que es exactamente `HISTORIA ≠ PLAN`.

**El hueco de fondo**: negación, temporalidad, experienciador y certeza corren
**en el momento de la consulta y producen avisos**, y después **se descartan**.
`Diagnostico` no tiene campo `certeza`; `Medicamento` no tiene `temporalidad`.
Un diagnóstico capturado como «creo que me dijeron que tenía anemia» se guarda
igual que uno confirmado.

**Tres vocabularios de verdad clínica en paralelo** — `TruthState`
(`clinical-truth/index.ts:1`), `ClinicalTruthStatus` (`types/uci.ts:19`) y
`ClinicalFact` de `types/clinical-fact.ts:185`. El **mejor diseñado** (bitemporal,
con `supersedes` y procedencia discriminada) es el que está **muerto**.
Cuál se vuelve canónico es **decisión clínica del dueño**, no un refactor:
queda como `NEEDS_CLINICAL_REVIEW`.

## WS-11 — Trabajo clínico de ciclo cerrado

| | |
|---|---|
| **Estado** | `PARTIAL` — hay base sólida sobre la que construir, y un P0 |
| **Base canónica** | `src/lib/tareas-clinicas/` — máquina de estados real (`modelo.ts:124`), dueño, vencimiento, escalación |
| **Lo que ya distingue bien** | `completada` ≠ `cerrada`. El código lo dice: *«el laboratorio hecho, el resultado en el sistema, y nadie que lo lea»* |
| **Lo que no existe** | `acted_on`, `patient_notified`, `scheduled`, y el registro de transiciones. `progreso-resultado.ts:20` **lo declara honestamente** y devuelve `sin_dato` en vez de inventarlo |

**P0-1 en detalle.** REG-252 descubrió que `tareaDeResultado()` no tenía
llamadores y lo arregló **sólo para el camino hospitalario**
(`hospital/firestore.ts:417`). El camino de consultorio no se arregló:
`guardarPanelLab` no importa `tareaDeResultado` ni `crearTareas`, y
`PanelLaboratorio` **no tiene `revisado`, `revisadoPor`, `revisadoEn` ni
`criticoNotificado`**. En el producto que es prioridad comercial, un resultado
entra al expediente y **su mera existencia cuenta como hecho**.

**Interconsultas y referencias no están en el ciclo**: `Interconsulta` es un
array embebido con dos estados, sin dueño ni vencimiento; la referencia de
consultorio es **sólo un impreso**. Imagen no tiene entidad.

**P1-2 — 22 colecciones sin declarar.** Se escriben desde `src/` y no están en
`firestore.rules`, ni en `matriz-acceso.ts`, ni en `respaldo.ts`. Siete son de
consultorio (`memoria_medico`, `whatsapp_outbox`, `whatsapp_contacts`,
`whatsapp_status`, `whatsapp_events`, `slot_locks`, `uci_copilot_feedback`) y una
es **P0-2**. **Por qué los guardianes no lo vieron**: ambos parsean
`firestore.rules` y lo tratan como el censo de lo que existe. Una colección que
nunca entra en las reglas es invisible **para los tres sitios y para los dos
guardianes a la vez**. Ninguna prueba recorre `src/` buscando `.collection('…')`.

## WS-12 — Núcleo de evaluación + router costo/calidad

| | |
|---|---|
| **Estado** | `PARTIAL` |
| **Router** | Existe y respeta la regla del dueño: `planes-ia.ts` documenta que el médico expresa **intención clínica**, nunca una marca. Hay PR **#357** abierto sobre esto (`product/router-physician-ux-345`) |
| **Medición** | `cost-ledger.ts:174` calcula **p50 y p95** de las llamadas de IA. **No hay p99 en ningún sitio del repositorio**, ni latencia/error por ruta HTTP |
| **Hueco de regla** | `evals/patient-ai/` **no existe**, y `.claude/rules/patient-facing-ai.md` §7 lo exige como fixture permanente y compuerta de todo cambio de IA de cara al paciente. Hoy **esa compuerta no puede correr** |

## WS-13 — Seguridad · observabilidad · DR

**Aislamiento entre consultorios — el hallazgo positivo del programa.** 99 rutas
revisadas: **no se encontró ni una sola ruta que escriba datos clínicos sin
validar sesión y pertenencia**. La defensa es real y adversarial: hay un
analizador estático que lee el **argumento literal** de cada guardia por método
HTTP (`authz/analisis-estatico.ts:6`), escrito porque una revisión cambió
`'administrar'` por `'auditoria.registrar'` y la suite siguió verde. Las 19 rutas
sin guardia de usuario son crons con `Bearer` fail-closed, webhooks con firma
HMAC y `timingSafeEqual`, y rutas públicas con rate-limit.

| Control | Estado |
|---|---|
| Correlation ID de navegador → API → job → proveedor | **NO EXISTE**. `requestId` se fabrica en cada ruta, no llega del cliente, no viaja al proveedor, y el gateway lo **muta**: es clave del libro de costos, no traza |
| Alertas | Un canal real (`ops/alerta.ts`), **un solo llamador**. Dispara por cron caído y saldo bajo. **Nada más**: ni 5xx, ni latencia, ni fallo de guardado, ni anomalía de autorización |
| Respaldo | Manifiesto en árbol, con guardián — **pero ver P0-2** |
| PITR | `UNKNOWN` — no es configurable desde el repositorio. Hay verificador (`respaldos-verificar.mjs`) y **ninguna salida capturada** |
| Simulacro de restauración | **NUNCA EJECUTADO**. El ida-y-vuelta del 2026-08-04 (200 001 docs, 161 ms) mide **su mitad**: que el NDJSON se relee. El repositorio lo dice con todas las letras y no sobreafirma |
| App Check | Implementado; que esté activo es `BLOCKED_EXTERNAL` |
| MFA | **TOTP implementado y funcionando**, pero `security-controls.ts:75` sigue diciendo `planned / BLOCKED`, y **no se exige en el servidor en ningún sitio**: una sesión sin segundo factor tiene privilegios idénticos |
| Pentest | `BLOCKED_EXTERNAL` — no se marca PASS sin pentest externo real |
| PHI en analítica | **No hay analítica de terceros en el producto.** Cero |

## WS-22/23/24 — Paquetes por especialidad

| | |
|---|---|
| **Estado** | `PARTIAL`, y bien planteado |
| **Evidencia** | `specialty-packages.ts` **deriva** su catálogo público de la misma tabla que gobierna la consulta, así que no puede prometer una herramienta que la consulta no enseña |
| **Siguiente** | No empezar hasta que el núcleo requerido esté estable (§22) |

## Diferido por el dueño

| Programa | Estado |
|---|---|
| Hospital / UCI | `DEFERRED_BY_OWNER` — no se desarrolla, no se borra. **Excepción**: P0-2 se arregla porque el defecto vive en `respaldo.ts`, que es núcleo compartido |
| Documents Zero-Friction (receta/orden/membrete/firma) | `DEFERRED_BY_OWNER_TEMPORARILY` — sigue en el tablero, no se prioriza |

## Decisiones que sólo puede tomar el dueño

1. **Cuál de los tres vocabularios de verdad clínica es canónico** (WS-10). Es
   política clínica, no un refactor.
2. **Licencias de evidencia**: UpToDate, Cochrane, Scopus, DynaMed, OpenEvidence.
   Sin acuerdo se quedan en `not_configured`; el código ya está construido para
   fallar cerrado.
3. **Filtro de licencia por artículo en PMC** (P1-10): qué subconjunto se
   considera reproducible.
4. Confirmar en el proyecto vivo `OPS_ALERTA_WEBHOOK`,
   `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` y PITR — los tres son
   `BLOCKED_EXTERNAL` desde aquí.
