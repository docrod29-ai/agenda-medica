# AUSCULTA — MASTER BOARD

> **Qué es esto.** La fuente operativa del programa de terminación de Ausculta
> Consultorio. Un requisito que está aquí no desaparece porque otro avance.
>
> **Regla de este tablero**: el estado sale del **código leído hoy**, no de la
> documentación ni de un checkpoint anterior. Donde la documentación contradice
> al código, gana el código y la contradicción queda anotada.

| | |
|---|---|
| **Rama** | `claude/ausculta-master-completion-4clx9v` (PR #389) |
| **SHA base** | `ba9d7a2f410157011a73ad87ea24f0edfc05560c` |
| **Fecha** | 2026-08-29 |
| **Base canónica** | `main` (rama 128 commits por delante, 0 por detrás) |
| **Tableros visibles** | #296 (padre) · #310 (escala) · #314 (evidencia) · #389 (este programa) |

## Conteo de la cola prioritaria — con el saldo a la vista

> **Regla de honestidad del conteo.** Un P1 nuevo no borra un P1 cerrado. Se
> escriben los dos movimientos y se enseña el saldo, para que el progreso no se
> pueda maquillar ni por arriba ni por abajo.

| | |
|---|---|
| **P0 internos abiertos** | **0** |
| **P1 internos abiertos** | **0** (más 2 `BLOCKED_EXTERNAL`: P1-6, P1-14) |

**Movimientos del 29-ago-2026:**

| | |
|---|---|
| cerrado −1 | **P1-16** — el importador ya sabe devolver las colecciones de nivel raíz (REG-348, `f2aa2fa`) |
| nuevo +1 | **P1-18** — carrera entre consultorios en el importador, hallada revisando REG-348 |
| cerrado −1 | **P1-18** — reproducida ejecutando la ruta y cerrada con transacción (REG-349) |
| cerrado −1 | **P1-12** — `getNotas` sin cota: el historial entero en cada pantalla (REG-350) |
| cerrado −1 | **P1-11** — las nueve pantallas que recibían el recorte sin declararlo (REG-351) |
| cerrado −1 | **P1-15** — no había circuit breaker ni presupuesto de reintentos (REG-353) |
| cerrado −1 | **P1-2** — ya estaba cerrado por REG-340/343 y el tablero no lo decía; su residuo real (reglas sin desplegar) lo cierra REG-354 haciéndolo visible |
| cerrado −1 | **P1-13** — los otros escritores de scroll, y `overscroll-behavior` (REG-355) |
| cerrado −1 | **P1-9** — la evidencia de la consulta ya declara dónde NO miró (REG-356). La otra mitad —procedencia estructurada sobre #314— se abre como **P1-19** |
| nuevo +1 | **P1-19** — la ruta de evidencia de la consulta sigue sin producir `Source` con procedencia estructurada (#314) |
| cerrado −1 | **P1-10** — el texto completo de PMC ya no se reproduce sin leer la licencia del artículo (REG-357) |
| cerrado −1 | **P1-17** — un duplicado con los nombres al revés ya aparece (REG-358) |
| cerrado −1 | **P1-19** — la verificación de citas tenía cero llamadores; ahora corre y marca lo no respaldado (REG-359) |
| **saldo** | **cerrados 11** · **nuevos 2** (P1-18 y P1-19, los dos abiertos y cerrados dentro de esta tanda) → **0 P1 internos abiertos** |

## Compuertas medidas en este SHA — no citadas de memoria

| Compuerta | Resultado | Observación |
|---|---|---|
| `npx vitest run` | **10 844 pasan · 1 falla** (788 archivos) | Baseline del 28-ago eran 10 566; **+278 casos, cero regresiones**. La única falla sigue siendo `ops-timeout-y-punto-ciego.test.ts` |
| `node scripts/lint-trinquete.mjs` | **96**, igual que el techo | Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** | |
| `npm run build` | **compila** | Con los placeholders del CI (`NEXT_PUBLIC_FIREBASE_*`). Sin ellos falla en «collect page data» por `auth/invalid-api-key`: es del entorno, no del árbol |
| trinquete de diseño | **al techo**, sin holgura | |
| navegador real | **no ejecutado** | ver WS-05 |

Medido el 29-ago-2026 sobre el árbol de esta rama, tras REG-348…REG-362.

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
| ~~P0-1~~ | ~~Un resultado de laboratorio de **consultorio** no genera tarea de revisión.~~ **CERRADO** — REG-501, `7247e1f`. Cierra «recibido → por revisar»; `acted_on` y `patient_notified` siguen sin existir en el modelo. | `src/lib/expediente/laboratorio/firestore.ts` | orquestador |
| ~~P0-2~~ | ~~La bitácora **append-only NOM-004** no está en el respaldo.~~ **CERRADO** — REG-340, `9f14d14`. Eran **9** colecciones, no una; el guardián nuevo deriva el censo del código. **Las reglas no se despliegan aquí**: `members` sigue roto en producción hasta que el dueño las publique. | `respaldo.ts` · `matriz-acceso.ts` · `firestore.rules` | orquestador |
| ~~P0-3~~ | ~~`getPatients()` descarga la colección entera.~~ **CERRADO** — REG-341, `4be92df`. Portado del PR #356 preservando REG-323. **Abre P1-11**: once pantallas reciben el recorte sin declararlo. | `src/lib/firestore.ts` | orquestador |
| ~~P0-4~~ | ~~`findNotaByIdInClinic()` N+1 en serie.~~ **CERRADO** — REG-341, `4be92df`. Consulta indexada acotada a 2 + sondeo con techo; por encima del techo devuelve `no-resoluble`, que no es `no-encontrada`. | `src/lib/expediente/firestore.ts` | orquestador |
| ~~P0-5~~ | ~~`Promise.all` sobre todos los pacientes.~~ **CERRADO** — REG-341, `4be92df`. Páginas con techo, notas en tandas, y **declara** si se quedó corta. Sigue debiendo leerse de un trabajo de servidor. | `cumplimiento/retencion/page.tsx` | orquestador |
| ~~P0-6~~ | ~~Rebote de scroll en iPhone.~~ **CAUSA RAÍZ CERRADA** — REG-342, `148a415`. Dos mecanismos: `scrollIntoView` disparado por el observador de scroll, y la barra sticky saliendo del flujo. **La verificación en iPhone sigue `BLOCKED_EXTERNAL`**: sólo hay Chromium instalado. | `ClinicalSpine.tsx` · `CierreAlPulgar.tsx` | orquestador (aritmética); **falta dispositivo** |
| ~~P0-7~~ | ~~La nota clínica completa se escribe en la consola del navegador.~~ **CERRADO** — REG-503, `7247e1f`. Quedan ids de internamiento en consola fuera del dashboard: son ids, no cuerpos clínicos. | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | orquestador |

## P1 ABIERTOS — los que tienen dueño claro

| ID | Defecto | Dónde |
|---|---|---|
| ~~P1-1~~ | ~~El secreto compartido de 2FA viaja en una URL a `api.qrserver.com`.~~ **CERRADO** — REG-502, `7247e1f`. Sigue abierto lo demás de MFA: **no se exige en el servidor** y `security-controls.ts` aún lo declara `planned`. | `cumplimiento/seguridad/page.tsx` |
| ~~P1-2~~ | ~~Colecciones de nivel raíz con declaración incompleta.~~ **CERRADO — y el tablero estaba atrasado.** REG-340 puso el guardián que **deriva el censo del código** (`scripts/seguridad/colecciones-escritas.mjs`), justo lo que este tablero afirmaba que no existía; REG-343 metió en el respaldo lo que ata una cuenta a un consultorio; REG-348/349 enseñaron a devolverlo. Verificado el 29-ago: las siete de consultorio que se citaban (`memoria_medico`, `whatsapp_*`, `slot_locks`, `uci_copilot_feedback`) están **en los tres sitios**. Su residuo real —las reglas escritas y **no desplegadas**— lo cierra REG-354: deja de vivir en prosa y pasa a derivarse, con una compuerta que exige declarar qué se rompe mientras tanto. Desplegarlas sigue siendo `BLOCKED_EXTERNAL`, ahora **con lista**. | — |
| ~~P1-3~~ | ~~Tareas creadas sin `await` y con el error tragado.~~ **CERRADO** — REG-344, `4f1babd`. Sigue sin bloquear la firma (bloquearla cambiaría un pendiente perdido por una consulta perdida); lo que se arregló fue el silencio. |
| ~~P1-4~~ | ~~`tareasVivas()` truncaba en silencio.~~ **CERRADO** — REG-344, `4f1babd`. **No arregla QUÉ 200 vienen**: siguen siendo arbitrarias, y elegirlas exige un índice compuesto que se crea fuera del repositorio → **P1-14**. |
| ~~P1-5~~ | ~~Llamadas a proveedor sin señal de aborto.~~ **CERRADO** — REG-346, eran **13**, no 7. Sigue sin haber **circuit breaker ni presupuesto de reintentos** en ninguna parte → **P1-15**. |
| **P1-6** | **`BLOCKED_EXTERNAL` — requiere autorización del dueño.** Las alergias viven en `Patient`, que recepción lee (`allow read: if isMember`). E0-06 exige mudarlas a la subcolección `clinico`. **Verificado hoy: la migración no existe** — hay tipo, lista de campos (`CAMPOS_CLINICOS_PACIENTE`) y una prueba de forma; **no hay splitter de escritura, ni script de migración, ni un solo lector o escritor de `ResumenClinicoPaciente` en producción**. Por qué se para aquí: el beneficio de seguridad **sólo aparece cuando los campos se BORRAN de los documentos vivos** y se cierran las reglas — una acción destructiva sobre datos clínicos reales. Construir la mitad reversible no cierra nada y **crea riesgo de doble verdad en el campo más crítico del producto** (alergias): un paciente con la alergia en `clinico` y un lector sin respaldo la pierde. **Qué falta exactamente**: (1) autorización para correr el backfill contra producción, (2) decisión del dueño sobre si recepción conserva algún acceso, (3) despliegue de reglas. |
| ~~P1-7~~ | ~~Los avisos de evidencia se calculaban y la pantalla los tiraba.~~ **CERRADO** — REG-345, `44b52c9`. |
| ~~P1-8~~ | ~~La matriz prometía fuentes inexistentes.~~ **CERRADO** — REG-345, `44b52c9`. La columna cruza catálogo y runtime, con tres estados. |
| ~~P1-9~~ | ~~La ruta de evidencia de la consulta no declara proveedores no consultados.~~ **CERRADO** — REG-356. Declara con la **misma lista** que el consultor (no una copia), incluye lo **operativo que no se usó**, lo dice en **los dos caminos de salida** y **la pantalla lo pinta arriba**, junto al análisis. Queda escrito que la acusación anterior sobre `.catch(() => [])` era **falsa**: hay un `testigo` que la desmiente. |
| ~~P1-19~~ | ~~La verificación de citas existe, está probada y no se llama.~~ **CERRADO** — REG-359. Los artículos se convierten en `Source` con procedencia, el prompt pide el **pasaje literal** y cada afirmación se ancla **carácter a carácter**. Lo no respaldado **no se borra** —puede ser buen razonamiento clínico— pero **pierde el `[n]`** y se marca. **Declarado**: anclar no es entender; esto cierra la invención del respaldo, no la interpretación (por eso el aviso dice «no se pudo comprobar», no «es falso»). El entailment sigue siendo requisito de WS-12. |
| **P1-14** | `tareasVivas` sigue devolviendo **200 arbitrarias** de N. Sigue `BLOCKED_EXTERNAL` —el índice se crea fuera del repositorio— pero desde REG-352 **con el artefacto listo**: `firestore.indexes.json` lo declara y `docs/ops/INDICES-DE-FIRESTORE.md` reúne los cuatro módulos que hoy están peor por no tenerlos (worklist, lista de espera, citas del paciente, resumen de notas). Antes vivían en comentarios sueltos y nadie podía saber cuántos faltaban. **Falta la acción del dueño**: `npx firebase deploy --only firestore:indexes`. |
| ~~P1-15~~ | ~~No hay circuit breaker ni presupuesto de reintentos.~~ **CERRADO** — REG-353 para el gateway de IA, que es por donde pasan las 16 rutas. Interruptor con enfriamiento creciente y una sola prueba, más presupuesto de la operación entera (no sólo por intento). **Lo que hay que saber para no sobreestimarlo**: (1) el estado es **por instancia**, no global — cada instancia caliente paga su primer timeout; hacerlo global costaría una lectura compartida en el camino de una nota; (2) **WhatsApp y Evidence siguen sin interruptor**: tienen timeout y el outbox tiene backoff, pero no pasan por esta puerta. Lo segundo queda abierto en WS-04. |
| ~~P1-16~~ | ~~El **importador** no sabe reescribir las colecciones de nivel raíz.~~ **CERRADO** — REG-348, `f2aa2fa`. Vuelven las tres que pertenecen al consultorio por un campo, re-enraizadas **por campo** y contra la lista blanca del mismo manifiesto que usa el exportador. **Abrió P1-18**, cerrado el mismo día. **Sigue sin haberse restaurado nunca contra Firestore de verdad** (WS-13). |
| ~~P1-18~~ | ~~Restaurar podía **quitarle la cuenta a otro consultorio**.~~ **CERRADO** — REG-349. Hallazgo de revisión independiente sobre REG-348, **reproducido ejecutando la ruta** contra una tienda con concurrencia optimista antes de tocar nada: la comprobación de propiedad existía, pero leía con un `getAll` suelto y escribía en un lote posterior, así que un alta normal del consultorio vecino ocurrida en el hueco se perdía. Ahora el grupo de nivel raíz va dentro de una transacción. |
| ~~P1-11~~ | ~~Nueve pantallas reciben el recorte sin declararlo.~~ **CERRADO** — REG-351. Ninguna pantalla llama ya a `getPatients`, y lo vigila un **guardián de árbol** sobre `src/app`, `src/components` y `src/hooks`, no un comentario. Los selectores preguntan al servidor por un módulo compartido (`pacientes/candidatos.ts`, `useBusquedaDePacientes`, `usePacientesPorId`); los tableros declaran el recorte; y donde la completitud es el producto —exportar e importar— se recorre entero o **la operación se detiene**. Tres cosas quedaron mejor de lo que pedía el requisito: «no se pudo preguntar» ya no se pinta como «no hay»; el `<select>` de controlados y el de la bitácora ARCO ya pueden nombrar a cualquier paciente; y el antiduplicado conserva su precisión (el golden cazó que un tipo recortado lo habría debilitado). |
| ~~P1-17~~ | ~~La búsqueda por prefijo pierde un duplicado con los nombres al revés.~~ **CERRADO** — REG-358. Se sondea también por cada **palabra** del nombre (tres, con ventana corta), sin necesitar ningún índice compuesto. El golden decidió los dos números: con dos palabras se perdía el caso más común, y sin ventana corta cada tecleo se volvía caro. **Sigue sin ser «contiene»**: un expediente que empieza por una palabra más allá de las tres sondeadas, o escrito sin acentos, no se encuentra — probado, no supuesto. Cerrarlo exige un **índice invertido de tokens**, que es un cambio de modelo de datos con retroactivo. |
| ~~P1-12~~ | ~~`getNotas` sin cota: la historia completa de un paciente, con las dos transcripciones dentro.~~ **CERRADO** — REG-350. Contrato paginado con techo que **declara** `truncada`, y la puerta que devolvía un array pelado **se borró**: un array no puede decir que viene recortado. Con ella cayeron dos amplificaciones peores —la pantalla de un ingreso se bajaba el historial completo del paciente, y la de retención NOM-004 hacía eso **por cada uno de hasta 500 pacientes**— y una salvaguarda que habría quedado colgando del techo (el bloqueo NOM-004 de borrado). El recorte llega a la pantalla en el expediente y en la consulta. |
| ~~P1-13~~ | ~~Otros escritores de scroll sin cancelación por gesto; `overscroll-behavior` ausente.~~ **CERRADO** — REG-355. La regla «después del primer gesto manual, el usuario manda» sale de `VolverALaFuente` —donde estaba bien y era la única— a `lib/ui/el-dedo-manda.ts`, y el restaurador de `/consulta` la pregunta **justo antes de escribir** (se re-arma cuando `notaInternamientoId` llega de Firestore). `overscroll-behavior` entra en `<main>`, el riel y el shell. **Queda abierto el tercer mecanismo**: los banners asíncronos que cambian la altura por encima de `<main>` (41 px medidos) — sacarlos del flujo es un cambio de layout del panel que no se hace a ciegas sin navegador. Y **WS-05 NO pasa a `PROVEN`**: sigue sin verse en un iPhone. |
| ~~P1-10~~ | ~~Texto completo de PMC sin filtro de licencia por artículo.~~ **CERRADO** — REG-357. Se lee la licencia del XML **antes de extraer un solo párrafo** y se **falla cerrado**: sólo CC0 y CC-BY. La lista es de identificadores exactos y no de prefijos, porque `cc-by-nc-nd` empieza por `cc-by` — un `startsWith` habría dado permiso a la más restrictiva. **No se pierde nada clínico**: sin texto completo se usa el resumen, como con cualquier artículo de pago. **La decisión de qué subconjunto es reproducible sigue siendo del dueño** y el catálogo lo declara así. | — |

---

## WS-01 — Master Board / custodia del programa

| | |
|---|---|
| **Estado** | `PARTIAL` — el tablero existe, se mantiene y ya lleva saldo explícito |
| **Evidencia** | Reconciliado contra #296/#310/#314, 5 auditorías read-only y verificación directa del orquestador. **29-ago**: reconciliado contra el código tras REG-348 (P1-16 figuraba abierto y estaba cerrado) y contra el hallazgo externo que abrió y cerró P1-18 |
| **Qué falta** | Reconciliar con los 150 comentarios de #296 y con `agent-state/BACKLOG.json` (V9/V10/V15 arrastran requisitos propios) |
| **Siguiente** | Mantenerlo tras cada unidad cerrada, con el saldo a la vista |

**Herramienta nueva que este tablero puede usar desde el 29-ago.** El arnés
`src/__tests__/_harness/firestore-admin-en-memoria.ts` ya cubre `doc()`,
`getAll()`, `batch()` y `tx.getAll()`, más un gancho de interceptación **en la
lectura**. Consecuencia para el programa: una ruta de `/api` que escribe con el
SDK admin **ya no tiene que probarse leyendo su fuente como texto**. Varias
afirmaciones `PARTIAL` de este tablero descansan hoy sobre pruebas de substring
—WS-05 lo dice de las de scroll— y ésta es la vía para convertirlas en medición.

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
| ~~`expediente/firestore.ts:216`~~ | ~~colección **entera** de citas del consultorio, en la baja de un paciente~~ **CERRADO** — REG-352: barrido paginado con techo, y si no se puede revisar entera **el borrado se niega**. El `catch` que lo tragaba dejaba PHI en pie tras una cancelación ARCO |
| ~~`expediente/firestore.ts:41` `getNotas`~~ | ~~historia **completa** de notas de un paciente~~ **CERRADO** — REG-350 |
| ~~`expediente/firestore.ts:472`~~ | ~~todas las notas firmadas → `.sort().slice(0,3)` **en memoria**~~ **CERRADO** — REG-350: ventana ordenada de 40, filtro de estado en memoria sobre ella |
| ~~`components/PaletteBusqueda.tsx:60`~~ | ~~Cmd-K descarga 50 000 pacientes para enseñar 6~~ — **el tablero estaba atrasado**: REG-341 ya lo cerró (página de 6 en frío + búsqueda indexada al teclear). Verificado leyendo el archivo el 29-ago |
| ~~`pacientes/page.tsx:934`~~ | ~~segunda descarga completa sin caché para deduplicar al guardar~~ **CERRADO** — REG-347, y desde REG-351 por el módulo compartido |
| `hooks/useAppointments.ts:94` | historia de citas de un paciente **en vivo**, sin cota — **`BLOCKED_EXTERNAL` con nombre desde REG-352**: acotarla exige un índice compuesto que no se puede crear desde el repositorio, y acotar sin orden perdería la cita de hoy. Declarado en `firestore.indexes.json` y en `docs/ops/INDICES-DE-FIRESTORE.md` |

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
| **Lo que sí hay** | Idempotencia por intención (`lib/idempotencia.ts`), rate-limit respaldado en Firestore y fail-open, `fetchConTimeout` con presupuestos por destino, **interruptor de circuito por proveedor y por llave** con presupuesto de operación (REG-353), reembolso de créditos cuando ningún modelo contestó —también cuando el circuito estaba abierto—, degradación con procedencia honesta (`procesar/route.ts:264` sella `parser-local` en vez de heredar el modelo anterior) |
| **Lo que no hay** | **Ninguna cola, contrapresión ni dead-letter** para las llamadas de IA. El **circuit breaker** ya existe en el gateway (REG-353) pero es **por instancia**, no global, y **no cubre WhatsApp ni Evidence**, que no pasan por esa puerta. Las señales de aborto las cerró REG-346 |
| **Precedente** | `docs/maintenance/sw-changelog.md:1519` documenta un socket colgado que inmovilizó una lambda de 300 s. `procesar` está en **800 s** |

## WS-05 — Móvil / rebote de scroll en iPhone

| | |
|---|---|
| **Estado** | `PARTIAL` — **tres de los cuatro mecanismos candidatos, cerrados en código**; **sin reproducir en dispositivo** |
| **Prioridad** | **P0** (defecto reportado por el dueño) |

**Estado de los cuatro candidatos, al 29-ago-2026:**

| Candidato | Estado |
|---|---|
| 1 · `ClinicalSpine` llamaba a `scrollIntoView` | **CERRADO** — REG-342 |
| 2 · `CierreAlPulgar` sticky que se desmonta | **CERRADO** — REG-342 |
| 3 · Banners asíncronos por encima de `<main>` (41 px medidos) | **ABIERTO** — sacarlos del flujo es un cambio de layout del panel, y no se hace a ciegas |
| 4 · El restaurador de `/consulta` sin cancelación por gesto | **CERRADO** — REG-355, con la regla en un módulo compartido |
| + · `overscroll-behavior` ausente en todo el repositorio | **CERRADO** — REG-355 (`<main>`, riel y shell) |

**Y aun así no es `PROVEN`.** Falta lo que §38 exige y ninguna de estas
reparaciones sustituye: WebKit, 390 px, diez repeticiones, `scrollTop` que nunca
baje solo. Sólo hay Chromium instalado. El propio CSS lleva escrito dentro que no
está verificado, con una prueba que falla si alguien borra esa advertencia.

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
| PMC (Open Access) | `LIVE_DIRECT` | **con filtro de licencia por artículo** desde REG-357: sólo CC0 y CC-BY reproducen texto completo; el resto se queda en el resumen |
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

**La verificación de citas ya corre** en la ruta de la consulta (REG-359): el
prompt pide el pasaje literal, cada afirmación se ancla carácter a carácter
contra el resumen que el modelo vio, y lo que no queda anclado **pierde su `[n]`
y se marca**. `mapaDeSoporte`, `esRespuestaRespaldada` y `tasaSinRespaldo` tienen
por fin llamador en producción.

**Lo que sigue abierto, dicho con precisión**: anclar no es entender. Un pasaje
puede citarse fuera de contexto o decir lo contrario en la frase siguiente; esto
cierra **la invención del respaldo**, no la interpretación. El *entailment* es
requisito de WS-12. Y `consultor/page.tsx:230` —la otra pantalla— sigue con la
comprobación de rango a secas.

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
| **Lo que sí existe y está cableado** | `problemas-activos.ts:70`, `ordenes-medicamento.ts:76` y —desde REG-363— `alergias-longitudinales.ts`: proyección longitudinal real de **problemas activos**, **medicación activa** y **alergias**, con la regla dura correcta: el silencio no resuelve nada |
| **Lo que falta** | Banderas de riesgo, respuesta al tratamiento y compromisos de seguimiento. **Procedimientos** y **dispositivos**: lo capturado ya llega a donde se decide (REG-370/371); el registro ESTRUCTURADO de ambos exige el **sello v4**, declarado abajo. **Procedimientos**: lo dictado ya no se pierde en silencio (REG-370); el registro ESTRUCTURADO exige un **sello v4**, declarado abajo. Los **laboratorios** ya llegan a los motores (REG-368) y su tendencia ya se dibuja en el panel; falta llevarla a la consulta. Las proyecciones se recalculan en el navegador; **ninguna se persiste**, y sólo la de alergias lleva `asOf` y `version` |

**REG-368 — los laboratorios que el paciente ya tiene llegan a los motores.** Es
REG-188 en el eje que aquella reparación no tocó: `entradaCopiloto.labs` era sólo
lo dictado hoy, y los paneles del paciente los leía **un solo componente** — el
de la pestaña de Laboratorios **de la misma pantalla**. Una creatinina de 2.4 del
mes pasado no ajustaba nada al recetar metformina hoy. Mirando la interfaz el
hueco es invisible: el número está a la vista y el aviso no sale.

Hoy manda, el expediente completa, y **lo del expediente viaja con su fecha** —el
aviso dice «creatinina 2.4 mg/dL, medida el 2026-07-14»—. Los valores censurados
(«>400») no entran: un límite no es un número.

**RESUELTO por el dueño el 29-ago-2026 → REG-375.** Cuánto puede tener una
creatinina para seguir sirviendo para dosificar: **≤24 h** con AKI, hospitalizado
o función renal inestable; **≤30 días** en ambulatorio clínicamente estable;
**≤7 días** cuando no se puede demostrar estabilidad o el contexto es ambiguo.
Fuera de ventana se marca `STALE_RENAL_FUNCTION` y se pide función renal
actualizada — **sin bloquear ni retirar la recomendación**, que es lo que la
política ordena. Sólo dentro de `ajusteRenal`, que es donde se dosifica por riñón.

**Lo que NO se infiere, declarado**: la estabilidad clínica no se deduce de cuánto
se movió la creatinina —eso exigiría un umbral de variación que nadie ha
validado—, así que sólo cuenta si alguien la declara. **Hoy nada la declara**, y
por eso en ambulatorio rige la ventana conservadora de 7 días; la de 30 queda
implementada y probada esperando a quien pueda declararla.

**REG-369 — y la trayectoria ya se ve donde se prescribe.** `seriesDesdeHistorial`
existía y su único lector era la pestaña de Laboratorios: para ver que la
creatinina va 0.9 → 1.3 → 1.7 había que salir de la consulta. Ahora la frase
—«subió desde 1.3 el 2026-01-10»— viaja pegada al valor dentro del aviso que
cambia la conducta, y hay una línea en la consulta con las de los analitos que
los motores usan.

Dice **aritmética, no clínica**: dos números, dos fechas y `sube`/`baja`/`igual`.
Un guardián quita comentarios y cadenas del módulo y **falla si queda cualquier
literal numérico** que no sea el tope de puntos; otro falla si la frase contiene
«empeoró», «deterioro», «alarma», «grave» o «significativo».

**RESUELTO por el dueño el 29-ago-2026 → REG-376.** **No existe un porcentaje
universal seguro para todos los analitos**, así que no se implementa ningún umbral
global. Se usan primero los umbrales **ya definidos** —el rango de referencia de
`ANALITOS` y los valores de pánico de `lab-criticos`, cada uno con su
procedencia—; **cruzar un límite de decisión importa aunque el porcentaje sea
pequeño**; y sin regla validada se muestran delta absoluto y relativo **sin
etiquetarlos** como clínicamente significativos.

Los dos casos que resumen la política, los dos en el golden: creatinina 0.6 → 0.9
es **+50 %** y no cruza nada → no se marca; creatinina 1.25 → 1.35 es **+8 %** y
cruza 1.3 → sí, y se dice qué línea cruzó.

**RCV / variación biológica**: la política la permite «si existe validada», y en
este repositorio **no existe ninguna**. `RELEVANCIA_POR_RCV` queda vacía y
congelada, con su sitio marcado — rellenarla de memoria sería inventar una cifra.

**REG-370 — el procedimiento que se dictó ya no se pierde en silencio.**
`entidades.procedures` se reconocía con fecha y lateralidad, se pintaba en el
panel, y **no tenía un solo consumidor más**. Ahora se compara con lo que la nota
dice y lo que falta se señala antes de firmar — así queda sellado (REG-366) y
vuelve a salir en la consulta siguiente (REG-367). No se documenta solo: escribir
un antecedente quirúrgico sin que nadie lo revise es redactar historia clínica.

**REG-371 — y los dispositivos invasivos ya se ven fuera de su pestaña.** La
valoración del inmunocomprometido captura prótesis valvular, marcapaso/DAI,
catéter central y ocho más, y **su único lector era el texto de esa misma
valoración**: fuera de su pestaña nadie sabía que el paciente lleva una prótesis
valvular — el antecedente que más cambia conducta sin aparecer en ningún
diagnóstico. Ahora está en la línea clínica de la consulta, con la fecha de la
valoración.

**Sólo se afirma lo marcado**: con la lista vacía no se pinta nada, porque un
dispositivo no marcado no es un dispositivo negado. Y **no alimenta ningún
motor**: no hay reglas de dispositivos en el producto y escribirlas sería inventar
criterio clínico; hay un caso que comprueba que no se le pasa a ninguno.

**LO QUE ESTO DEJA ABIERTO, Y ES INGENIERÍA, NO DECISIÓN DEL DUEÑO — el sello v4.**
Un registro **estructurado** de procedimientos (y de dispositivos) exige un campo
nuevo en `NotaMedica`, y un campo de contenido clínico tiene que ir **dentro del
sello**. `canonicoV3` es una lista explícita, así que añadir uno obliga a un
**sello v4** —canónico, vector golden y partición de cobertura— para que las
notas firmadas con v3 sigan verificando, igual que hoy verifican las v2. Es el
camino que el propio sello tiene diseñado (`VERSIONES_VERIFICABLES`), y es la
siguiente unidad de esta área. Hacerlo sin v4 dejaría contenido clínico firmado
**fuera del sello**, que es lo que E0-12 cerró.

**REG-363 — las alergias ya son longitudinales, y la regla NO es la de sus dos
hermanas.** Cada nota firmada sella una **copia** de la lista de alergias, y
nadie la volvía a leer: los veintitantos llamadores del cruce alergia↔fármaco,
la receta impresa, el FHIR y el sesgo de voz leen todos el mismo campo mutable de
`Patient`. Vaciado ese campo —un import, una migración, un dedo en el móvil— el
producto se comportaba como si dos notas inmutables que dicen «anafilaxia por
penicilina» no existieran.

La regla es **asimétrica a propósito**: afirmar suma, el silencio no resta, y una
negación de hoy **no borra: pone en conflicto**. Porque el sello no es una palabra
(«ya no es alérgico») sino una copia («el campo decía esto cuando firmé»), y
tratar una copia vacía como retractación convertiría cualquier borrado accidental
en una decisión clínica retroactiva.

**No alimenta la compuerta que bloquea la firma**, y hay un guardián que lo
comprueba: si lo hiciera, una nota de 2024 pisaría una corrección que el médico
hizo hoy a conciencia. Enseña lo que la compuerta no está mirando, con la fecha de
la nota que lo dice, y ofrece devolverlo a la lista — acto del médico.

**No cierra E0-06.** Las alergias siguen viviendo en `Patient`, legibles por
recepción bajo `allow read: if isMember`. Eso es P1-6, `BLOCKED_EXTERNAL`.

**El activo mejor construido de esta área** es el ciclo de vida del medicamento
(`EstadoOrdenMedicamento`, `types/expediente.ts:72`), con
`probablemente_terminada` — «el sistema sabe que venció el calendario, no que el
paciente terminó» — y `procedenciaClinica: 'ya_lo_toma' | 'se_prescribe_hoy'`
(REG-183), que es exactamente `HISTORIA ≠ PLAN`.

**REG-364 — lo que el médico DESCARTÓ ya no llega a los motores como diagnóstico
suyo.** `problemasDelCuadro` recibía la lista de HOY sin filtrar y aplanada a la
descripción, así que un «embarazo descartado» —como se documenta una prueba
negativa— entraba al cuadro que ven el copiloto y el prompt de evidencia. Medido:
el copiloto escribía «La paciente cursa embarazo» y ofrecía insertarlo en la nota
firmada. El criterio correcto (`estaVigente`) estaba exportado y probado desde
que existe la proyección, y **tres lectores lo aplicaban y el cuarto no**. Ahora
`tipo` viaja, y `nombreConCerteza` es **una** definición para los cuatro. Ningún
aviso se calla: el gestacional de un embarazo presuntivo se sigue dando.

**REG-365 — y la mitad de REG-364 que estaba mal, corregida el mismo día.**
REG-364 etiquetaba «(presuntivo)» en los cuatro lectores. `presuntivo` es el
**valor de fábrica** del esquema (`extraction-schema.ts:40`), lo que el prompt
manda poner por defecto, y lo que escribe el botón de añadir diagnóstico — y
**ninguna pantalla deja al médico elegir el tipo**. Así que la etiqueta afirmaba
una duda que nadie expresó, sobre casi todos los renglones: una diabetes crónica
confirmada se leía «Diabetes mellitus tipo 2 (presuntivo)». Hoy sólo se etiqueta
lo que **no se alcanza por omisión** (`descartado`, `diferencial`), y el copiloto
cita el expediente en vez de afirmar cuando no consta.

**Lo que esto deja abierto, y es de producto**: el médico **no puede elegir el
tipo de un diagnóstico en ninguna pantalla**. Mientras siga así, el sistema no
distingue un presuntivo elegido de uno de fábrica, y por eso no puede enseñarlo.
Darle ese control obliga a separar «elegido» de «por defecto» en el modelo.

**REG-366 — lo que se avisó al firmar ya no se tira.** Los avisos que el médico
confirma haber revisado («Los revisé, firmar») se quedan sellados en
`iaAuditoria.avisosAlFirmar`, con su origen y **la frase tal como la leyó**, y la
pantalla de la nota firmada los enseña (`no-print`: es cómo se revisó la nota, no
parte del documento que se entrega). El orden es la mitad del arreglo:
`iaAuditoria` está dentro del conjunto sellado, así que el campo entra **antes**
del hash — añadirlo después reabriría la nota marcada como «alterada» (REG-060).

**REG-367 — y esa duda ya sale sola en la consulta siguiente.** `certeza.ts` lo
tenía escrito: «a partir de la segunda consulta ya nadie sabe que era una duda».
Ésa era exactamente la pantalla que faltaba. Los avisos sellados que **viajan**
—dato incierto, antecedente del familiar, contradicción, desajuste temporal, sin
respaldo— se emparejan con los problemas vigentes de hoy y se pintan bajo la
lista, con la fecha de la nota que lo dice. Heurística que **señala de menos** y
lo declara: casa por palabras de seis letras o más, así que un problema de
palabras cortas no se empareja nunca.

**El hueco de fondo**: negación, temporalidad, experienciador y certeza corren
**en el momento de la consulta y producen avisos**. Desde REG-366 esos avisos
**se conservan** y desde REG-367 **vuelven a salir**; lo que sigue sin
estructurarse es el eje dentro de la entidad (`Diagnostico` no tiene `certeza`,
`Medicamento` no tiene `temporalidad`), que es decisión de modelo.
`Diagnostico` no tiene campo `certeza`; `Medicamento` no tiene `temporalidad`.
Un diagnóstico capturado como «creo que me dijeron que tenía anemia» se guarda
igual que uno confirmado. **REG-364 cerró la mitad que sí se guardaba** —`tipo`—;
la del PACIENTE se conserva desde REG-366/367 como aviso sellado y relegible.

**REG-372 — y la autoridad del médico sobre `tipo` ya está registrada.** `tipo`
acaba siendo un `verificationStatus` de FHIR que otro sistema lee como un hecho, y
la exportación convertía un `definitivo` **del modelo** en `confirmed`: una
afirmación clínica firmada por nadie. En el mismo ternario, un `descartado` salía
como `provisional` y una enfermedad **crónica** salía como **`resolved`**.

`Diagnostico.tipoOrigen` (`medico` | `extraccion` | `por_defecto`) registra quién
lo puso —dentro del objeto que el sello v3 ya cubre, así que **sin sello nuevo**—
y `confirmed` se reserva a `medico`. Lo demás sale `unconfirmed`, que no dice que
el diagnóstico sea falso: dice que nadie firmó su verificación.

**Lo que esto deja visible en vez de resolver en falso**: sigue sin existir la
pantalla donde el médico elija `tipo`, así que hoy `tipoOrigen: 'medico'` sólo lo
lleva el diagnóstico añadido a mano.

**REG-373 — y una mención histórica ya no se vuelve medicación vigente.**
`estadoDeOrden()` lee la ausencia de `estado` como `activa` —correcto, para no
vaciar el histórico— y **el esquema de extracción no tiene campo `estado`**: «le
dieron warfarina cuando la operaron» entraba a la medicación vigente, salía en
«Toma:», entraba al cuadro de los motores y disparaba la regla de sangrado sobre
un fármaco dejado hace años. El eje temporal existente sólo vigila padecimientos;
los fármacos **no tenían ninguna defensa temporal**.

Ahora se señala mientras se receta —anclado donde está el botón «ya no»— y **no se
reclasifica**: «ya no la toma» y «se la suspendimos y la vamos a reanudar» se
dictan igual de pasado, y la diferencia la sabe el médico. Y sólo se mira lo que el
dictado **nombra**: un crónico del expediente que hoy no se mencionó no se toca,
porque el silencio no suspende nada.

**REG-374 corrigió el mismo día el falso positivo de REG-373**: usaba
`esFrasePasada` —el criterio de los PADECIMIENTOS— y «le receté amoxicilina hace
tres días» es pasado gramatical con el paciente tomándola, así que avisaba sobre
todos los antibióticos recién iniciados. Ahora exige **cesación dicha** («ya no la
toma», «se lo suspendimos») o **pasado remoto** («hace tres años», «cuando la
operaron»), y **sin umbral de días**: cuántos días deja de estar tomándolo es una
pregunta clínica que depende del fármaco.

**Con esto los dos huecos de modelo del área quedan cubiertos sin inventar juicio
clínico**: la autoridad sobre `tipo` (REG-372) y la temporalidad del fármaco
(REG-373). Lo que sigue abierto es de producto y de sello: la pantalla donde el
médico elija `tipo`, y el **sello v4** para el registro estructurado de
procedimientos y dispositivos.

**Tres vocabularios de verdad clínica en paralelo** — `TruthState`
(`clinical-truth/index.ts:1`), `ClinicalTruthStatus` (`types/uci.ts:19`) y
`ClinicalFact` de `types/clinical-fact.ts:185`. El **mejor diseñado** (bitemporal,
con `supersedes` y procedencia discriminada) es el que está **muerto**.
Cuál se vuelve canónico es **decisión clínica del dueño**, no un refactor:
queda como `NEEDS_CLINICAL_REVIEW`.

## WS-11 — Trabajo clínico de ciclo cerrado

| | |
|---|---|
| **Estado** | `PARTIAL` — la base es sólida y desde REG-360 el modelo ya distingue las tres etapas del cierre |
| **Base canónica** | `src/lib/tareas-clinicas/` — máquina de estados real (`modelo.ts:124`), dueño, vencimiento, escalación |
| **Lo que ya distingue bien** | `completada` ≠ `cerrada`. El código lo dice: *«el laboratorio hecho, el resultado en el sistema, y nadie que lo lea»* |
| **Lo que ya existe desde REG-360** | **DECISION, ACTION y PATIENT COMMUNICATION tienen campo** (`TareaClinica.cierre`) y hay **registro de transiciones** acotado. Cerrar **exige decir qué se decidió**; el aviso al paciente no se exige —un worklist que cuesta se abandona— pero **tampoco se inventa**: sin registrar sale `sin_dato`, nunca «se avisó» |
| **Y ya se llena** | REG-361: `/pendientes` cierra por **formulario**, no avanzando de estado. La decisión es obligatoria; la acción y el aviso no, pero lo que no se marca **no se manda** — «no consta» ≠ «no se hizo» |
| **Lo que sigue sin existir** | `scheduled` como estado propio; **interconsultas, referencias e imagen fuera del ciclo**; y el cierre sólo se puede hacer desde `/pendientes` |

**P0-1 en detalle.** REG-252 descubrió que `tareaDeResultado()` no tenía
llamadores y lo arregló **sólo para el camino hospitalario**
(`hospital/firestore.ts:417`). El camino de consultorio no se arregló:
`guardarPanelLab` no importa `tareaDeResultado` ni `crearTareas`, y
`PanelLaboratorio` **no tiene `revisado`, `revisadoPor`, `revisadoEn` ni
`criticoNotificado`**. En el producto que es prioridad comercial, un resultado
entra al expediente y **su mera existencia cuenta como hecho**.

**Interconsultas y referencias no están en el ciclo**: `Interconsulta` es un
array embebido con dos estados, sin dueño ni vencimiento; la referencia de
consultorio es **sólo un impreso**. Imagen no tiene entidad. **Es lo que queda
abierto de WS-11 tras REG-360**, junto con el formulario de cierre.

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
| **Hueco de regla** | ~~`evals/patient-ai/` no existe~~ **CERRADO** — REG-362. El fixture permanente existe (18 casos: las doce de V9 + seis del equipo rojo) y su compuerta corre. **Encontró un defecto la primera vez**: la ingesta accidental sólo se detectaba en tercera persona, así que «me tomé por accidente la medicina de otra persona» —una de las doce— no escalaba. **Lo que sigue abierto**: la puerta prueba el SERVIDOR, no lo que el modelo redacta, y sólo una de las cinco clases de respuesta tiene clasificador — el golden lo comprueba y lo declara en vez de fingir cobertura |

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
| Respaldo | Manifiesto en árbol, con guardián que **deriva el censo del código** (REG-340) y con el camino de vuelta completo (REG-348/349) |
| Reglas desplegadas | **NO.** Lo escrito no es lo que rige, y desde REG-354 el repositorio lo **deriva** en vez de recordarlo: `firestore.rules.estado.json` + `docs/ops/REGLAS-DE-FIRESTORE.md` con la lista de qué no rige y qué se rompe. `BLOCKED_EXTERNAL` con lista |
| Índices desplegados | **NO.** Declarados en `firestore.indexes.json` desde REG-352, con los cuatro módulos que hoy están peor por no tenerlos. `BLOCKED_EXTERNAL` con lista |
| PITR | `UNKNOWN` — no es configurable desde el repositorio. Hay verificador (`respaldos-verificar.mjs`) y **ninguna salida capturada** |
| Simulacro de restauración | **NUNCA EJECUTADO contra Firestore.** El ida-y-vuelta del 2026-08-04 (200 001 docs, 161 ms) mide **su mitad**: que el NDJSON se relee. Desde REG-348/349 el camino de vuelta **existe entero** —incluidas las colecciones de nivel raíz— y REG-349 ejecuta la ruta real contra una tienda con concurrencia optimista, así que ya no es sólo lectura de fuente. Sigue faltando lo que ninguna tienda en memoria puede dar: **reglas, índices, latencia y el tope de 500 escrituras por transacción** |
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

---

## Rescates — trabajo que existe en una rama y NO está en `main`

Añadido el 30-ago-2026, al limpiar el tablero de PRs (de 62 abiertos quedaron
19). Estos ocho PRs **no se cerraron** porque llevan piezas que `main` no tiene;
se midió archivo por archivo cuáles faltan.

**Ninguno se fusiona tal cual.** Van entre 130 y 145 commits por detrás, de la
semana del 23-ago: traerlos por merge es reaplicar un árbol viejo sobre otro que
cambió debajo. Se **portan** —como REG-341 portó el PR #356 en vez de fusionarlo—
o se cierran a sabiendas. El inventario completo, con qué archivo falta en cada
uno, vive en
[`docs/maintenance/PRS-SIN-ABSORBER-2026-08-30.md`](../maintenance/PRS-SIN-ABSORBER-2026-08-30.md).

| Id | PR | Qué aporta que `main` no tenga | Estado |
|---|---|---|---|
| `RESCATE-355` | #355 | Los **dos guardianes** de la capacidad de diseño de receta. La ruta y el token YA están en `main`: falta sólo la prueba | `NOT_STARTED` — el más barato de la lista |
| `RESCATE-342` | #342 | Banco de carga y evidencia de «sin pantalla en blanco» (30 archivos). Es lo que **mediría el P1-15 abierto** | `NOT_STARTED` |
| `RESCATE-349` | #349 | Simulacro de recuperación y registro de riesgos (29). Solapa con REG-343 y el **P1-16** abierto: comprobar antes de portar | `NOT_STARTED` |
| `RESCATE-348` | #348 | Runbooks y simulacro de incidencias (35). Solapa con REG-396, ya en `main`: portar **sólo lo que no cubra** | `NOT_STARTED` |
| `RESCATE-MIGRACION` | #351 · #353 | Contrato de migración, aislamiento, reversión e idempotencia (27 y 29). **Son dos versiones del mismo trabajo: sobra una** | `NOT_STARTED` — decidir cuál |
| `RESCATE-345` | #345 | Router de coste/calidad de IA y su modo sombra (16) | **`BLOCKED_BY_OWNER`** |
| — | #357 | Sólo falta su documento de rebanada; el guardián está en `main` | cerrable |
| — | #332 | Configura el autopiloto n8n que Codex dejó de gobernar el 29-ago | cerrable |

**Por qué `RESCATE-345` está bloqueado en el dueño y no es `NOT_STARTED`.** Un
router de coste/calidad decide **con qué modelo se redacta**, y hay una decisión
del dueño que dice lo contrario: «la nota usa el razonamiento premium —no
escatimar—; no bajar de modelo por velocidad sin avisar». Portarlo sin que él
diga qué puede decidir ese router y qué no sería construir contra una política
vigente. La pregunta exacta está en `OWNER_DECISIONS_REQUIRED.md`.

<!-- CENSO:INICIO — generado por scripts/product/censo-al-tablero.mjs · no editar a mano -->

## Las metas del §1, escalón por escalón

> **Derivado.** Sale de `src/lib/programa/requisitos.ts`; se regenera con
> `npx tsx scripts/product/censo-al-tablero.mjs` y `el-tablero-ensena-las-metas.test.ts`
> falla si el tablero se queda atrás.
>
> **Por qué está aquí.** El §1 del pliego manda conservar estos objetivos. Los
> conservaba el censo, que es TypeScript; este tablero —el que se lee— nombraba
> dos de los once. Un objetivo que sólo existe en un archivo de código no está
> custodiado: está guardado.

### Usuarios registrados

> Usuarios registrados **no** es concurrencia activa. Van por separado a
> propósito: mezclarlos es cómo un «aguanta 100 k» acaba significando algo que
> nadie midió.

| Escalón | Estado | Fila del censo |
|---|---|---|
| 2 000 | `PARTIAL` | `WS-02.registrados-2000` |
| 10 000 | `PARTIAL` | `WS-02.registrados-10000` |
| 15 000 | `BLOCKED_EXTERNAL` | `WS-02.registrados-15000` |
| 20 000 | `BLOCKED_EXTERNAL` | `WS-02.registrados-20000` |
| 30 000 | `BLOCKED_EXTERNAL` | `WS-02.registrados-30000` |
| 50 000 | `BLOCKED_EXTERNAL` | `WS-02.registrados-50000` |
| 100 000 | `BLOCKED_EXTERNAL` | `WS-02.registrados-100000` |

### Pacientes por médico

| Escalón | Estado | Fila del censo |
|---|---|---|
| 10 000 | `PROVEN` | `WS-03.pacientes-10000` |
| 20 000 | `PROVEN` | `WS-03.pacientes-20000` |
| 30 000 | `PROVEN` | `WS-03.pacientes-30000` |
| 50 000 | `PROVEN` | `WS-03.pacientes-50000` |

### Los 21 dominios que el §1 obliga a custodiar

Ninguno puede quedarse sin una sola fila del censo. Seis se habían perdido
antes de que existiera el censo —voz, aprendizaje, autoridad de la
automatización, WhatsApp, razonamiento y accesibilidad— y por eso se vigilan.

- Clinical Truth
- Voice
- Reasoning
- Evidence
- Consultorio
- Automation
- Learning
- Patient Experience
- WhatsApp
- Mobile UX
- Scale
- Reliability
- Observability
- Security
- Disaster Recovery
- Evaluation
- Patient State
- Closed Loop
- Evidence Applicability
- Specialty Packages
- Production Readiness

**Filas en el censo hoy: 78.**

<!-- CENSO:FIN -->
