# Handoff del carril #310 hacia #306 (y #302 / #303)

**De:** SCALE / RESILIENCE — #310.
**Para:** Consultorio #306 · Voz #302 · Razonamiento #303.

Este carril **no ha tocado ningún archivo de esos carriles**. Lo que sigue es la lista de
lo que hace falta cablear, con el archivo, la línea y el contrato ya escrito y probado que
lo resuelve. Cada entrada tiene su golden: quien la tome no empieza de cero ni tiene que
inventar el criterio.

---

## H-1 · Idempotencia en el alta y la reagenda de citas → **#306**

**Archivo:** `src/app/api/appointments/route.ts`
**Contrato:** `src/lib/reliability/idempotencia.ts`
**Golden:** `src/__tests__/reliability-idempotencia.test.ts`

**El defecto, en concreto.** Una respuesta perdida tras un commit correcto hace que el
reintento reciba `409 «Ese horario ya está ocupado.»` (línea 250). La asistente acaba de
agendar esa cita ella misma; el sistema le dice que el hueco está tomado por otro, y ella
busca otro hueco o llama al paciente para moverlo.

Y con sobreagenda autorizada (`sobreagendarMotivo`, línea 82) la detección de empalme se
desactiva a propósito: ahí el reintento **sí crea la cita duplicada**.

**Cableado propuesto.**

1. Aceptar la cabecera `Idempotency-Key` (rechazar la petición si falta, en cuanto los
   clientes la manden).
2. `claveIdempotencia(clinicId, 'crear-cita', llaveDelCliente)` — el `clinicId` en la clave
   no es decorativo: sin él, dos consultorios con el mismo identificador de cliente
   comparten asiento, y eso es fuga entre consultorios.
3. Envolver la transacción en `ejecutarUnaVez(...)` con un almacén de Firestore que use
   `create()` atómico — el mismo patrón de `src/lib/whatsapp/dedup.ts`, pero **fail-closed**:
   ahí el peor caso es responder dos veces a un mensaje; aquí es una segunda cita.
4. `motivo: 'en-curso'` → responder «se está procesando», nunca «falló». Decirle «falló» al
   usuario en mitad de algo que sí va a completarse es lo que provoca el tercer clic.

**Cierra:** casos negativos obligatorios de #320/#321 «network timeout after successful
server commit», «same request replayed multiple times» y «webhook/event retry».

## H-2 · Búsqueda de pacientes acotada e indexada → **#306** · **P0**

**Archivo:** `src/lib/firestore.ts:114` (`getPatients`) y sus 13 consumidores.

`getDocs(query(col(patients), orderBy('nombre','asc')))` sin `limit`. La caché de 30 s
reduce las lecturas repetidas y no cambia el orden de magnitud. Con los 30 000 pacientes por
médico que #310 fija como objetivo, la paleta de búsqueda —que la asistente abre con el
paciente al teléfono— descarga, ordena y filtra 30 000 documentos en el hilo principal.

**Propuesta:** búsqueda por prefijo indexada + `limit(n)` con paginación keyset sobre
`nombre`; contador agregado para lo que hoy se resuelve con `.length`. La clase de trabajo
`hot:buscar-paciente` ya declara su presupuesto (1 000 ms, 1 reintento).

## H-3 · `findNotaByIdInClinic` no puede hacer una lectura por paciente → **#306** · **P0**

**Archivo:** `src/lib/expediente/firestore.ts:57-67`.

O(pacientes) lecturas de documento en una petición, disparables por un URL mal formado.
**Propuesta:** índice inverso `notaId → patientId`, o guardar `patientId` en la nota y usar
`collectionGroup` con `where`.

## H-4 · `time_blocks` acotada y con purga → **#306** · **P1**

**Archivos:** `src/app/api/appointments/route.ts:164`,
`src/app/api/public/booking/route.ts:159`,
`src/app/api/public/availability/[clinicId]/route.ts:120`,
`src/app/api/whatsapp/webhook/route.ts:66`, `src/app/api/portal/route.ts:98`.

`.collection('time_blocks').get()` sin `where` ni `limit`, sobre una colección **sin purga
ni TTL**. Crece de forma monótona y se lee entera en cada reserva.

**Propuesta:** `where('fecha','>=', hoy)` + `limit`, y archivado de bloqueos vencidos.

## H-5 · Cortacircuitos y presupuesto de reintentos en el gateway → **#302 / #303** · **P1**

**Archivo:** `src/lib/ia/gateway.ts:138-154`
**Contratos:** `src/lib/reliability/cortacircuitos.ts`, `src/lib/reliability/reintentos.ts`
**Golden:** `src/__tests__/reliability-reintentos-y-circuito.test.ts`

`fetchConTimeout(…, TIMEOUT.ia)` protege **una** llamada, no doscientas. Con el proveedor
caído, cada consulta abierta espera sus 60 s completos.

**Cableado propuesto.**

1. `claveDeCircuito(proveedor, clase)` — proveedor + clase de trabajo, **nunca** inquilino
   ni paciente: un circuito por inquilino no aprende nada y una clave con paciente sería PHI
   en telemetría.
2. `permitirLlamada()` antes de llamar; circuito abierto → devolver el modo limitado que ya
   redacta `src/lib/ia/fallo-proveedor.ts`, al instante y sin esperar.
3. `registrarExito` / `registrarFallo` después.
4. `decidirReintento()` en vez de la lógica ad hoc: presupuesto de intentos **y** de tiempo,
   con jitter completo.

Este carril **no** toca el gateway: es de Voz/Razonamiento y hay escritor activo.

## H-6 · Colas para el trabajo pesado → **#303** (razonamiento/evidencia) · **#302** (transcripción) · **P1**

**Archivos:** `/api/expediente/procesar` (`maxDuration = 800`), `corregir` y `evidencia`
(300), `/api/consultor-evidencia` (300), `verificar-nota` (45).
**Contrato:** `src/lib/reliability/cola.ts`
**Golden:** `src/__tests__/reliability-cola-y-degradacion.test.ts`

Hoy todo eso corre en línea. Lo crítico y barato de la lista es la guardia de resultado
caduco: `resultadoCaduco(trabajo, versionActual, encuentroFirmado)` impide que un resultado
que vuelve tarde pise verdad clínica confirmada o firmada — que es #320 Golden Path B
punto 9, hoy sin ninguna defensa.

Nota para quien lo tome: la comprobación `versionActual > versionAlEncolar` **sola no
basta**; sobre un encuentro firmado no hay versión que valga. El golden lo prueba al revés.

## H-7 · Telemetría con `correlationId` y sin PHI → **los tres carriles**

**Contratos:** `src/lib/observability/evento.ts`, `src/lib/observability/correlacion.ts`
**Golden:** `src/__tests__/observability-sin-phi.test.ts`

El conjunto de campos es **cerrado**: lo que no está en `CAMPOS_PERMITIDOS` hace fallar la
validación, no se poda en silencio. Una lista de lo prohibido siempre va por detrás — el día
que alguien meta `motivoConsulta`, ningún patrón de redacción lo caza porque parece una
frase, y es PHI.

Se declara antes de cablear precisamente porque el cableado cruza los tres carriles: si cada
uno inventa el suyo, no habrá forma de seguir una petición de punta a punta.

## H-8 · Frenos de error en las rutas de cara al paciente → **carril del portal** · **P1**

**Archivos que NO existen:** `src/app/mi/error.tsx`, `src/app/reservar/error.tsx`,
`src/app/teleconsulta/error.tsx`.

Hoy un fallo de componente ahí sube hasta `global-error.tsx`, que reemplaza el documento
entero. `/reservar/[clinicId]` es el autoagendado del paciente: Golden Path A.

Este carril no los crea porque son superficie de cara al paciente, y la regla de diseño del
repositorio exige lanzar el producto y recorrer el flujo antes de dar una interfaz por
terminada — cosa que este carril no puede hacer. El patrón a copiar es
`src/app/(dashboard)/consulta/[patientId]/error.tsx`, y el mensaje ya está redactado en
`MODOS_LIMITADOS['componente-secundario'].loQueVeElMedico`.

---

## Lo que este carril SÍ cambió, y por qué no colisiona

| Archivo | Cambio | Por qué era seguro |
|---|---|---|
| `src/lib/security/sanitize.ts` | REG-323: el token del portal ya no llega al registro de errores | ningún carril activo lo toca; es fuga de credenciales |
| `docs/audit/regression-ledger.md` | entrada REG-323 | apéndice |
| `src/lib/calidad/familias-de-defecto.ts` | REG-323 en la familia `aislamiento` | una línea; lo exige el gate del ledger |
| `src/lib/clinical/invariantes-clinicos.json` | sello del golden de REG-323 | lo exige el gate del ledger |
| `docs/quality/FAMILIAS-DE-DEFECTO.md`, `docs/data-room/INDICE.md` | cifras derivadas | regeneradas con su script |
| `agent-state/MASTER_STATE.json` | tablero derivado | regenerado con `scripts/agent-state/actualizar.mjs` |

### Dos que sí rozan a otros carriles — declarado

1. **`src/__tests__/modulos-sin-conectar.test.ts`** — seis entradas nuevas en
   `HUERFANOS_ACEPTADOS` (los contratos escritos y no cableados). #341 también edita este
   archivo. El conflicto sería de apéndice y trivial de resolver.

2. **`src/__tests__/el-camino-del-medico-llega-entero.test.ts`** —
   `FUERA_DEL_CAMINO_HOY` de 29 a 37, con la justificación escrita en el propio archivo.
   **#302 lo sube a 31 en su rama por el mismo motivo** (contratos escritos antes de
   cablear), así que habrá un conflicto de una línea al fusionar: el valor correcto será la
   suma de los módulos declarados por ambos.

   No había alternativa: el trinquete recorre `src/lib` entera y el mecanismo declarado del
   propio archivo es «puede ser legítimo, pero entonces se declara, no se ignora». Dejarlo
   rojo habría sido peor. **Cerrar los handoffs de arriba baja ese número en ocho**, que es
   la única forma legítima de moverlo.
