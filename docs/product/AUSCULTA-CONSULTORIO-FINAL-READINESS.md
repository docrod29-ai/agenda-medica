# Ausculta Consultorio — estado de preparación

**Generado**: 29-ago-2026 · **Rama**: `claude/ausculta-master-completion-4clx9v`
**Derivado de**: `docs/product/AUSCULTA-MASTER-BOARD.md`,
`docs/audit/regression-ledger.md` (222 REG), `src/lib/clinical/invariantes-clinicos.json`
y las compuertas que se corren en cada unidad.

Este documento existe para poder decir **qué está probado, qué está bloqueado por
algo de fuera, y qué sencillamente no está hecho** — sin que las tres cosas se
parezcan. Un tablero que llama «listo» a lo que sólo compila es la forma más cara
de mentirse.

---

## Cómo leer los estados

| Estado | Qué significa exactamente |
|---|---|
| `PROVEN` | Hay una prueba que **falla sin el arreglo**, corre en cada `vitest run`, y su golden explica qué fallaba, cómo se descubrió, la causa raíz y **qué no cubre** |
| `BLOCKED_EXTERNAL` | El trabajo interno está hecho; falta una acción que **no se puede ejecutar desde este repositorio**. Se nombra la acción exacta |
| `DEFERRED_BY_OWNER` | Decisión del dueño. No se desarrolla y no se borra |
| `NOT_DONE` | No está hecho. Se dice, no se disfraza |

**`PROVEN` no es «terminado como producto».** Es «este defecto concreto no puede
volver sin que una prueba se ponga roja». Las dos cosas se confunden con
facilidad y aquí no se confunden.

---

## Compuertas, medidas en esta rama

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **11 080 casos, 800 archivos** · 1 fallo conocido del entorno |
| Fallo conocido | `ops-timeout-y-punto-ciego.test.ts` exige que `10.255.255.1` trague paquetes; el proxy del contenedor rechaza al instante. **La aserción no se tocó** |
| `node scripts/lint-trinquete.mjs` | **96**, en el techo. Sin deuda nueva |
| `node scripts/design/trinquete-de-diseno.mjs` | Sin deuda de diseño nueva |
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Compila con los placeholders `NEXT_PUBLIC_FIREBASE_*` del CI |
| Cola de prioridad | **P0 internos = 0 · P1 internos = 0** |

El build necesita los placeholders del CI porque sin variables de Firebase falla
en «collect page data» con `auth/invalid-api-key`. Es del entorno, no del árbol.

---

## Los 13 workstreams, reconciliados

| WS | Estado | Lo que sostiene ese estado |
|---|---|---|
| **01** Master Board | `PROVEN` | El tablero se **deriva**: `el-tablero-del-loop-no-miente` falla si la última REG, el conteo del ledger o el número de archivos de prueba dejan de coincidir con el repositorio |
| **02** Escala / 100 k | `PARTIAL` | REG-378: **ya hay arnés y ya hay medición**. 100 médicos, 8 000 peticiones, 50 concurrentes contra el emulador con `firestore.rules` cargadas: p95 141 ms, 0 errores, **0 fugas entre consultorios en 200 sondas**. No es producción y no son 100 k: la evidencia lo dice y el validador la **rechaza** por incompleta, a propósito |
| **03** Consultorio grande | `PARTIAL` | Las lecturas sin cota que sí se encontraron están acotadas y **declaran su recorte** (REG-350/351). Queda el inventario de lecturas de citas |
| **04** Resiliencia | `PROVEN` (interruptor) | REG-353: interruptor por proveedor **y por llave** — una llave revocada de un consultorio no apaga a los demás. Colas y contrapresión: `NOT_DONE` |
| **05** Móvil / rebote iPhone | `BLOCKED_EXTERNAL` | REG-355 cerró los escritores de scroll que no preguntaban y `overscroll-behavior`. **No se marca PROVEN: sólo se comprobó en Chromium.** Falta un iPhone real |
| **06/07/08** Evidencia | `PARTIAL`, honesto | La consulta **dice dónde NO miró** (REG-356), el texto completo de PMC sólo se reproduce si la licencia lo permite (REG-357), y una cita que no dice eso ya no pasa (REG-359). Las licencias comerciales son `BLOCKED_EXTERNAL` |
| **09** Aplicabilidad | `NOT_DONE` | No hay motor que diga si una evidencia aplica a ESTE paciente |
| **10** Patient State | `PARTIAL`, y es donde más se avanzó | Ver la tabla propia, abajo |
| **11** Ciclo cerrado | `PARTIAL` | REG-360/361: el cierre distingue decisión, acción y aviso al paciente, y `/pendientes` los llena por formulario. Faltan interconsultas, referencias e imagen |
| **12** Evaluación | `PARTIAL` | REG-362 creó la puerta que la regla exigía (`evals/patient-ai/`) y **encontró un defecto vivo al correrla**. Falta evaluar lo que el modelo REDACTA |
| **13** Seguridad · DR | `PARTIAL` | 99 rutas revisadas: **ni una escribe datos clínicos sin validar sesión y pertenencia**, con analizador estático del argumento literal por método. Índices y reglas: `BLOCKED_EXTERNAL` |
| **22/23/24** Especialidad | `PARTIAL` | El catálogo público se **deriva** de la misma tabla que gobierna la consulta: no puede prometer una herramienta que la consulta no enseña |

---

## WS-10 · Patient State — el detalle

Es el workstream que este tramo cerró casi entero. Cada línea tiene su REG y su
golden.

| Pieza | Estado | REG |
|---|---|---|
| Problemas activos · medicación vigente | `PROVEN` | previos |
| **Alergias longitudinales** | `PROVEN` | 363 |
| Autoridad del médico sobre el tipo de diagnóstico | `PROVEN` | 364, 365, 372 |
| Conservación de los avisos al firmar | `PROVEN` | 366 |
| Relectura de esos avisos en la consulta siguiente | `PROVEN` | 367 |
| Laboratorios del expediente en los motores | `PROVEN` | 368 |
| Trayectoria del laboratorio donde se prescribe | `PROVEN` | 369 |
| Procedimientos dictados que no quedan escritos | `PROVEN` | 370 |
| Dispositivos invasivos fuera de su pestaña | `PROVEN` | 371 |
| Temporalidad del fármaco | `PROVEN` | 373, 374 |
| **Vigencia de la función renal para dosificar** | `PROVEN` | 375 |
| **Cuándo el cambio de un analito importa** | `PROVEN` | 376 |
| Registro **estructurado** de procedimientos y dispositivos | `NOT_DONE` | exige **sello v4** |
| Persistir las proyecciones | `NOT_DONE` | arrastra los tres sitios de declaración de una colección |
| Pantalla donde el médico **elija** el tipo de un diagnóstico | `NOT_DONE` | es de producto |

### Las dos políticas del dueño, ya dentro del producto

Resueltas el 29-ago-2026 y implementadas literal:

**Función renal para dosificar** — ≤24 h con AKI, hospitalizado o función renal
inestable; ≤30 días en ambulatorio clínicamente estable; ≤7 días cuando no se
puede demostrar estabilidad. Fuera de ventana: `STALE_RENAL_FUNCTION`, se pide
función renal actualizada, **no se bloquea ni se retira la recomendación**, y la
autoridad final es del médico.

*Declarado*: la estabilidad clínica **no se deduce** de cuánto se movió la
creatinina. Hoy nada en el producto la declara, así que en ambulatorio rige la
ventana conservadora de 7 días.

**Cambio de un analito** — no existe un porcentaje universal seguro, así que no
hay umbral global. Se usan los umbrales **ya definidos** (rango de referencia de
`ANALITOS`, valores de pánico de `lab-criticos`); cruzar un límite importa aunque
el porcentaje sea pequeño; sin regla validada salen los deltas **sin etiquetar**.

*Declarado*: **no hay tabla de RCV validada** en este repositorio.
`RELEVANCIA_POR_RCV` queda vacía y congelada, con su sitio marcado.

---

## Lo que está bloqueado por algo de fuera

Cada uno con la acción exacta que lo desbloquea. Ninguno es una excusa: el trabajo
interno está hecho y hay un artefacto que dice qué se rompe mientras tanto.

| Bloqueo | La acción que falta |
|---|---|
| Índices de Firestore | `npx firebase deploy --only firestore:indexes` — declarados en `firestore.indexes.json` desde REG-352, con los cuatro módulos que hoy están peor por no tenerlos |
| Reglas de Firestore | `npx firebase deploy --only firestore:rules --project nexomed-agenda`. `vercel --prod` **no** las publica. Desde REG-354 el repositorio lo **deriva** del sha256 en vez de recordarlo |
| E0-06 · alergias fuera de `Patient` | Backfill sobre datos clínicos vivos + decisión de política del dueño + despliegue de reglas. **No se reabrió** |
| iPhone / WebKit real | Un dispositivo. REG-355 no se marca PROVEN sin él |
| PITR y simulacro de restauración | Configuración del proyecto vivo. El ida y vuelta del NDJSON está probado; reglas, índices, latencia y el tope de 500 escrituras por transacción no los da ninguna tienda en memoria |
| Pentest externo | No se marca PASS sin uno real |
| Licencias de evidencia | UpToDate, Cochrane, Scopus, DynaMed, OpenEvidence. Sin acuerdo se quedan en `not_configured`; el código ya falla cerrado |
| `OPS_ALERTA_WEBHOOK` y App Check | Confirmarlos en el proyecto vivo |

---

## Diferido por el dueño

| Programa | Estado |
|---|---|
| Hospital / UCI | `DEFERRED_BY_OWNER` — se usa, **no se vende**. Excepción ya aplicada: los defectos del núcleo compartido sí se arreglan |
| Documents Zero-Friction | `DEFERRED_BY_OWNER_TEMPORARILY` |

---

## Revisión adversarial de este tramo

Sin panel externo: es una relectura hostil de lo que este tramo escribió, y lo que
encontró está arreglado y contado. Se dice así en vez de llamarlo «equipo rojo de
20 expertos», que sería inventar una evidencia que no existe.

**Cuatro defectos, y los cuatro salieron del propio arreglo:**

1. **REG-363** — el sello de alergias se quedaba con la nota más reciente y perdía
   «edema de glotis», lo que distingue una anafilaxia de un exantema. *Lo cazó su
   golden.* Se guardan todos los sellos, enteros y por separado; componerlos habría
   fabricado un registro que nadie escribió.
2. **REG-365** — REG-364 etiquetaba «(presuntivo)» sin ver que **es el valor de
   fábrica del esquema**: afirmaba una duda que nadie expresó, en casi todos los
   renglones. *Lo cazó preguntar de dónde sale el valor.*
3. **REG-374** — REG-373 usaba el criterio de los padecimientos para los fármacos y
   avisaba sobre **todos los antibióticos recién iniciados**. *Lo cazó preguntarle
   al arreglo por su caso más frecuente, no por el que lo motivó.*
4. **Vigencia renal** — el instante se calculaba en cada render y rompía la
   memoización de la entrada del copiloto, que se recalculaba en cada tecla del
   dictado. *Lo cazó releer el cableado buscando efectos de rendimiento.*

**Lo que la revisión NO encontró, y por qué no es garantía**: no se ejecutó el
producto en un navegador, no hay medición de carga, y no se probó contra datos
reales. Las tres cosas están arriba con su estado.

---

## Qué haría falta para llamar a esto «listo para vender»

Por orden de lo que más pesa:

1. **Desplegar índices y reglas.** Es una tarde de trabajo del dueño y desbloquea
   dos filas de la tabla de arriba.
2. ~~**Medir la escala de verdad** (WS-02): el arnés que produzca el JSON que el
   validador ya sabe leer.~~ **Hecho (REG-378)** en lo que un emulador puede
   responder. Lo que falta ya no es código: es un entorno que se parezca a
   producción —índices desplegados, latencia de red, contención real— y los tres
   bloqueadores de navegador y proveedor que el informe declara en `null`.
3. **Un iPhone**, para cerrar WS-05.
4. ~~**El sello v4**~~ **Hecho (REG-377)**: `transcripcionMotor` entra al sello sin
   volver «alterada» ni una nota firmada. **Corrección de lo que esta línea decía
   antes**: el sello NO era lo que bloqueaba el registro estructurado de
   procedimientos y dispositivos. Lo que falta es el ACTO — un sitio donde el
   médico confirme lo que el extractor oyó, porque documentar un procedimiento es
   suyo (REG-370). Reservar las ranuras en el modelo «por si acaso» se intentó y
   se descartó: un campo que nadie escribe es una promesa del modelo. Cuando
   exista quien lo escriba entra con su propio v5, y v4 es la migración ya
   recorrida que demuestra que eso no rompe lo firmado.
5. **Pentest y PITR**, que son las dos que ningún trabajo interno puede sustituir.

Nada de esto es un descubrimiento de última hora: los cinco estaban en el tablero
antes de empezar este tramo, y siguen exactamente donde estaban porque ninguno
depende de escribir más código.
