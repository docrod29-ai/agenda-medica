# Informe de capacidad — Ausculta Consultorio

<!-- GENERADO por scripts/load/generar-informe-de-capacidad.mjs. No editar a mano: se regenera. -->

**Candidato:** `680d983915429d9e511539e3a280241ebbfa6b12` · **semilla:** 20260823 · **carril:** #310

## Lo primero

> **`capacityProven: false`**
>
> No existe evidencia de que Ausculta Consultorio soporte 2 000 ni 10 000 médicos. Lo que existe es un arnés determinista, un contrato de invariantes y un inventario del camino caliente con tres lecturas de colección sin acotar todavía abiertas.

Este campo **no se puede subir desde la línea de órdenes**. Para cambiarlo hace falta
evidencia medida contra un candidato exacto en un entorno dimensionado, y la aprobación
explícita del dueño sobre umbrales derivados de esa medición.

## Cohortes

| Cohorte | Médicos registrados | ¿Ejecutada (simulada)? | Clase | Nota |
|---|---|---|---|---|
| `baseline-single-tenant` | 1 | sí | `proven-in-ci` | Ejecutada con el controlador simulado. Ejercita el MODELO y sus invariantes, NO el producto. |
| `multi-tenant-2k` | 2,000 | sí | `proven-in-ci` | Ejecutada con el controlador simulado. Ejercita el MODELO y sus invariantes, NO el producto. |
| `multi-tenant-10k` | 10,000 | no | `requires-staging-environment` | Correrla simulada no demostraría nada nuevo; medirla exige entorno dimensionado. |
| `growth-tier` | 25,000 | no | `requires-staging-environment` | Correrla simulada no demostraría nada nuevo; medirla exige entorno dimensionado. |
| `large-practice-30k-patients` | 1 | no | `requires-staging-environment` | Correrla simulada no demostraría nada nuevo; medirla exige entorno dimensionado. |

## Ejecuciones del arnés (controlador simulado)

Clase de evidencia de todas: `harness-only`. Ejercitan el MODELO y sus invariantes; no
tocan Next.js, ni Firestore, ni la red.

| Escenario | Consultas concurrentes | Ops/s camino caliente (modelo) | Peticiones | Bloqueadores incondicionales |
|---|---|---|---|---|
| `baseline-single-tenant::ninguno` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::ia-caida` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::ia-timeout` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::evidencia-caida` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::transcripcion-caida` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::red-intermitente` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::entrega-duplicada` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::saturacion-proveedor` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::almacenamiento-transitorio` | 1 | 0.0378 | 2 | 0 |
| `baseline-single-tenant::resultado-caduco` | 1 | 0.0378 | 2 | 0 |
| `multi-tenant-2k::ninguno` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::ia-caida` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::ia-timeout` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::evidencia-caida` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::transcripcion-caida` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::red-intermitente` | 240 | 11.0222 | 1534 | 0 |
| `multi-tenant-2k::entrega-duplicada` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::saturacion-proveedor` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::almacenamiento-transitorio` | 240 | 11.0222 | 1451 | 0 |
| `multi-tenant-2k::resultado-caduco` | 240 | 11.0222 | 1451 | 0 |

Los bloqueadores incondicionales son: borrador perdido, pantalla blanca, fuga entre
consultorios, lectura sin acotar, duplicado no idempotente y fallo silencioso de proveedor.
Cualquiera por encima de cero es defecto de lanzamiento, se mire la latencia que se mire.

## Bloqueadores abiertos en el producto

Encontrados leyendo el repositorio, no midiendo. Detalle y reparación propuesta en
[`HOT-PATH-INVENTORY.md`](HOT-PATH-INVENTORY.md).

| # | Qué | Dónde | Carril que puede tocarlo |
|---|---|---|---|
| P0-1 | getPatients() descarga la colección entera en 13 pantallas | `src/lib/firestore.ts:114` | #306 |
| P0-2 | findNotaByIdInClinic hace una lectura por paciente | `src/lib/expediente/firestore.ts:57` | #306 |
| P1-1 | time_blocks se lee entera en cinco caminos de reserva | `src/app/api/appointments/route.ts:164 (+4)` | #306 |

## Lo que hace falta y no se tiene

### entorno-dimensionado — `requires-staging-environment`

**Qué:** Un entorno de pruebas con Firestore y despliegue propios donde apuntar el controlador `http` del arnés.

**Por qué:** Sin él, ninguna cifra de latencia, saturación o coste sale del producto: sale del modelo. No puede ser producción.

**Cuesta:** Proyecto de Firebase + despliegue de Vercel de no-producción. Hay coste.

**Bloquea:** 
- toda la columna OBSERVED del contrato SLO
- cualquier afirmación de 2k/10k

### generador-de-carga-distribuido — `requires-owner-approval`

**Qué:** Capacidad de generar concurrencia real (k6, Artillery o equivalente) desde varias máquinas.

**Por qué:** Un solo proceso de Node no produce el pico de 1 200 consultas concurrentes que modela la cohorte de 10k.

**Cuesta:** Servicio de carga de pago o máquinas propias. Hay coste.

**Bloquea:** 
- cohorte multi-tenant-10k medida
- cohorte growth-tier medida

### entorno-dom-para-pruebas-de-componente — `prepared-only`

**Qué:** jsdom o un proyecto de vitest aparte para montar pantallas y comprobar que un hijo que lanza no tumba el resto.

**Por qué:** La suite corre en `environment: node`. Sin DOM no hay prueba determinista de pantalla blanca.

**Cuesta:** Sin coste monetario. Cambia configuración compartida por todos los carriles.

**Bloquea:** 
- F12 de la matriz de fallos
- plan de pruebas de NO-WHITE-SCREEN §3

### e2e-de-recarga-y-reconexion — `prepared-only`

**Qué:** Escenarios de Playwright con corte de red, recarga y segundo plano contra un objetivo local.

**Por qué:** F13 y F14 sólo se pueden demostrar en un navegador de verdad.

**Cuesta:** Sin coste monetario; Playwright ya está en el repositorio.

**Bloquea:** 
- F13
- F14
- la mitad de la matriz adversarial de #322

### simulacro-de-restauracion-medido — `requires-owner-approval`

**Qué:** RPO/RTO medidos en un simulacro real de respaldo → pérdida controlada → restauración → verificación.

**Por qué:** #320 Gate 5 no acepta valores documentados como probados hasta que se hace el simulacro. `npm run simulacro:respaldo` existe; falta un destino seguro donde correrlo.

**Cuesta:** Necesita un destino de datos que no sea producción.

**Bloquea:** 
- Gate 5 de #320

### cableado-de-los-contratos — `prepared-only`

**Qué:** Conectar idempotencia, cortacircuitos, colas y telemetría a las rutas reales.

**Por qué:** Hoy son contratos probados y no cableados. Cablearlos toca #302, #303 y #306.

**Cuesta:** Sin coste monetario. Necesita que el carril correspondiente lo tome.

**Bloquea:** 
- que las invariantes protejan al producto y no sólo al modelo


## Qué se puede decir hoy, con estas palabras exactas

**Sí se puede decir:**

- existe un arnés determinista y reproducible que modela la carga de 2 000, 10 000 y
  25 000 médicos separando registrados de concurrentes;
- las invariantes de fiabilidad están escritas como contrato ejecutable con su golden;
- bajo los diez perfiles de fallo del arnés, ningún bloqueador incondicional se dispara en
  el modelo;
- el inventario del camino caliente encontró dos P0 y siete P1 con archivo y línea.

**No se puede decir:**

- que Ausculta soporte 2 000 médicos;
- que Ausculta soporte 10 000 médicos;
- que ningún SLO se cumple —ninguno se ha medido—;
- que las invariantes protegen al producto: hoy protegen al modelo, porque los contratos
  no están cableados.
