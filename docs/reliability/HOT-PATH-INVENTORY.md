# Inventario del camino caliente — Ausculta Consultorio

**Carril:** #310 (escala, resiliencia y arquitectura sin pantalla blanca).
**Tablero:** #296. **Estándar:** #320. **Golden paths:** #321 (agenda), #322 (encuentro).
**Modo:** lectura + artefactos no solapados. Ningún archivo de #302, #303, #306 ni #341
se modifica aquí; lo que toca a esos carriles va como *handoff* en
[`HANDOFF-306.md`](HANDOFF-306.md).

Esto es un inventario **medido leyendo el repositorio**, con archivo y línea. No es una
estimación y no contiene ninguna afirmación de capacidad.

---

## 1. El camino, tal y como está cableado hoy

```
/citas · /calendario                     ← agenda (useAppointments: onSnapshot con ventana de 120 días)
   └─ POST /api/appointments             ← alta/reagenda ATÓMICA (transacción + centinela por día)
        ├─ config/main + doctors/{id}    ← 2 lecturas de documento
        ├─ time_blocks (COLECCIÓN ENTERA)  ⚠ P1
        └─ audit_log (fire-and-forget, no bloquea)

/pacientes · PaletteBusqueda · +11 pantallas
   └─ getPatients(clinicId)              ← COLECCIÓN ENTERA de pacientes, orderBy nombre  ⚠ P0
        · caché en memoria, TTL 30 s

/consulta/[patientId]
   ├─ getPatient(clinicId, patientId)    ← 1 documento ✔
   ├─ getNotas(clinicId, patientId)      ← TODAS las notas del paciente, sin límite  ⚠ P1
   ├─ onSnapshot sobre la nota en curso
   ├─ autoguardado cada 30 s → createNota/updateNota (documento único, tope 1 MB)  ⚠ P1
   ├─ respaldo local (localStorage + IndexedDB para el audio) ✔ es la red de seguridad real
   └─ captura de voz → /api/expediente/transcribir(-chunk|-diarizado)

trabajo asíncrono, hoy EN LÍNEA dentro de la petición:
   /api/expediente/procesar          maxDuration = 800 s
   /api/expediente/corregir          maxDuration = 300 s
   /api/expediente/evidencia         maxDuration = 300 s
   /api/consultor-evidencia          maxDuration = 300 s
   /api/expediente/verificar-nota    maxDuration =  45 s
        └─ src/lib/ia/gateway.ts → fetchConTimeout(…, TIMEOUT.ia = 60 s)
             · con tiempo máximo ✔   · sin cortacircuitos ⚠   · sin presupuesto de reintentos ⚠

firma/cierre → NOM-004 → nota firmada (inmutable por reglas de Firestore) ✔
```

---

## 2. Hallazgos, con archivo y línea

Severidad según #320: **P0** bloquea el lanzamiento, **P1** bloquea la afirmación de escala,
**P2** entra al backlog.

### P0-1 · La lista completa de pacientes se descarga en 13 pantallas

`src/lib/firestore.ts:114` — `getPatients()` hace
`getDocs(query(col(patients), orderBy('nombre','asc')))`: **sin `limit`, sin paginación,
sin búsqueda indexada**. La consumen 13 pantallas (`src/components/PaletteBusqueda.tsx`,
`/pacientes`, `/citas`, `/crm`, `/asistente`, `/farmacia`, `/reactivacion`, `/membresias`,
`/migracion`, `/consultor`, `/cumplimiento`, `/cumplimiento/retencion`,
`/hospitalizacion`).

Hay una caché en memoria con TTL de 30 s, que reduce las lecturas repetidas y **no cambia
el orden de magnitud**: la primera visita de cada sesión sigue bajando la colección entera.

#310 fija explícitamente el objetivo de «30 000+ pacientes por médico». Con esa cifra, la
paleta de búsqueda —que la asistente abre con el paciente al teléfono— descarga, ordena y
filtra 30 000 documentos en el hilo principal antes de pintar el primer resultado.

**Por qué es P0 y no P1.** No es lentitud: es el criterio de aceptación literal de #310
(«paginación/keyset e indexación; ninguna lectura de colección sin acotar») en el camino
caliente de los dos golden paths a la vez.

**Reparación propuesta.** Búsqueda por prefijo indexada + `limit(n)` con paginación keyset
sobre `nombre`; un contador agregado para lo que hoy se resuelve con `.length`. Es un
cambio en `src/lib/firestore.ts` y en 13 pantallas → **pertenece a #306**.

### P0-2 · `findNotaByIdInClinic` hace una lectura por paciente

`src/lib/expediente/firestore.ts:57-67` — lista **todos** los pacientes del consultorio y
lanza un `getDoc` por cada uno hasta encontrar la nota. Es O(pacientes) lecturas de
documento en una sola petición.

Es una ruta de rescate (`/nota/[patientId]` cuando el URL llega con un solo segmento) y por
eso se dispara poco. Pero con 30 000 pacientes son 30 000 lecturas facturadas y un lambda
ocupado varios minutos, disparables por un URL mal formado — cualquiera con sesión puede
provocarlo pegando un enlace roto.

**Reparación propuesta.** Un índice inverso `notaId → patientId` (o guardar `patientId`
dentro de la nota y usar un `collectionGroup` con `where`). → **#306**.

### P1-1 · `time_blocks` se lee entera en cinco caminos de reserva

`src/app/api/appointments/route.ts:164`, `src/app/api/public/booking/route.ts:159`,
`src/app/api/public/availability/[clinicId]/route.ts:120`,
`src/app/api/whatsapp/webhook/route.ts:66`, `src/app/api/portal/route.ts:98`.

`.collection('time_blocks').get()` sin `where` ni `limit`. La colección **no tiene purga ni
TTL** (`grep` sobre `src/lib/time-blocks*.ts`: no hay borrado por antigüedad), así que
guarda todas las vacaciones, ausencias y quirófanos desde el día uno. Crece de forma
monótona y se lee entera en cada reserva — incluidas las del paciente y las del bot.

**Reparación propuesta.** `where('fecha','>=', hoy)` + `limit`, y purga o archivado de
bloqueos vencidos. Ruta compartida agenda/portal/WhatsApp → **#306**.

### P1-2 · Un reintento de alta de cita responde 409 sobre el hueco que uno mismo acaba de ocupar

`src/app/api/appointments/route.ts:18-260`. La ruta **no acepta llave de idempotencia**.

La transacción es correcta y detecta el empalme, así que el reintento **no crea una cita
duplicada**: devuelve `409 «Ese horario ya está ocupado.»`. Y ése es el defecto — la
asistente acaba de agendar esa cita ella misma dos segundos antes; el sistema le dice que
el hueco está tomado por otro. Lo que hace a continuación es buscar otro hueco o llamar al
paciente para moverlo.

Es exactamente el caso negativo obligatorio de #320/#321 «network timeout after successful
server commit», y hoy falla en la respuesta, no en los datos.

**Y con sobreagenda autorizada sí duplica.** Cuando el médico manda `sobreagendarMotivo`
(línea 82 y siguientes), la detección de empalme se desactiva a propósito: ahí el reintento
**crea la segunda cita**.

**Reparación propuesta.** Cabecera `Idempotency-Key` + asiento con `create()` atómico —el
mismo patrón que ya usa `src/lib/whatsapp/dedup.ts` para los webhooks de Meta—, devolviendo
el resultado original en la repetición. El contrato ejecutable y su golden están en
`src/lib/reliability/idempotencia.ts` y
`src/__tests__/reliability-idempotencia.test.ts`. → **#306**.

### P1-3 · El gateway de IA no tiene cortacircuitos ni presupuesto de reintentos

`src/lib/ia/gateway.ts:138-154`. Tiene tiempo máximo por llamada
(`fetchConTimeout(…, TIMEOUT.ia)` = 60 s) y **eso protege una llamada, no doscientas**. Con
el proveedor caído, cada consulta abierta espera sus 60 s completos antes de enterarse: el
médico ve una rueda girando un minuto entero, el lambda se factura, y el proveedor —que se
estaba recuperando— recibe el mismo tráfico que lo tumbó.

Tampoco hay presupuesto de reintentos común: la única política del repositorio
(`src/lib/whatsapp/reintentos.ts`) es de WhatsApp, con base de 5 minutos y **sin jitter**.
Sin jitter, mil consultorios reintentan en el mismo milisegundo tras una caída.

**Reparación propuesta.** Cablear `src/lib/reliability/cortacircuitos.ts` y
`src/lib/reliability/reintentos.ts` (ya escritos y probados) en el gateway. El gateway es
del carril de Voz/Razonamiento → **#302/#303**.

### P1-4 · El trabajo pesado corre EN LÍNEA, no en una cola

`maxDuration` de 800 s (`/api/expediente/procesar`), 300 s (`corregir`, `evidencia`,
`consultor-evidencia`) y 45 s (`verificar-nota`). No hay cola, no hay reintento con
retroceso, no hay estado terminal visible, no hay deduplicación por identidad y no hay
guardia de resultado caduco.

Consecuencias concretas: si el navegador se recarga a mitad, el trabajo se pierde sin dejar
asiento; si el cliente reintenta, el trabajo se hace dos veces y se paga dos veces; y un
resultado que vuelve tarde **se aplica igual**, aunque el médico ya haya editado o firmado
—que es lo que #320 Golden Path B punto 9 prohíbe expresamente.

**Reparación propuesta.** El contrato está en `src/lib/reliability/cola.ts` con su golden
(`src/__tests__/reliability-cola-y-degradacion.test.ts`), incluida la guardia
`resultadoCaduco()`. No introduce proveedor de colas: describe lo que uno tendría que
cumplir. → **#303** (razonamiento/evidencia) y **#302** (transcripción).

### P1-5 · El token del portal del paciente llegaba al registro de errores — **REPARADO AQUÍ**

`src/lib/security/sanitize.ts`. `redactarRuta` no tapaba `/mi/<token>`: el segmento `mi` no
estaba declarado y la heurística de identificador exigía `^[A-Za-z0-9_-]+$`, que el punto
del token (`base64url.base64url`) esquivaba. Un error no atrapado en el portal mandaba el
token entero a la colección **raíz** `errores`, legible desde `/superadmin/errores`.

`/mi/<token>` no lleva un identificador: el token **es la sesión del paciente**.

Reparado en esta rama (**REG-323**) porque el archivo no pertenece a ningún carril activo y
la fuga es de credenciales. Golden:
`src/__tests__/reg-323-el-token-del-paciente-no-va-al-registro.test.ts`.
Lo que **no** arregla: el token sigue viajando en la URL, en el historial del navegador y
en cualquier `Referer` que salga del dominio → ver P1-6.

### P1-6 · El token del paciente vive en la ruta del URL

`src/app/mi/[token]/page.tsx`. Sacarlo de ahí es un cambio de arquitectura del portal
(canje del enlace por cookie de sesión en la primera visita, con redirección que limpia la
barra). No pertenece a este carril y no se toca aquí. → **decisión del dueño + carril del
portal**.

### P1-7 · La nota es un documento único con tope de 1 MB

`src/lib/expediente/firestore.ts:79-90`. El guardián avisa a 950 KB con un mensaje claro y
el respaldo local conserva el contenido — eso está bien resuelto. Lo que no está resuelto es
qué pasa **después**: una consulta larga con transcripción cruda + diálogo diarizado +
entidades puede llegar al techo, y a partir de ahí el autoguardado en la nube deja de
funcionar durante el resto de la consulta.

#320 Gate 2 pide además mover las cargas binarias grandes fuera de Firestore antes de
apoyar en ellas ninguna afirmación de escala.

**Reparación propuesta.** Separar la transcripción cruda a un documento aparte o a
almacenamiento de objetos con referencia. Toca el modelo de la nota → **#301/#306**.

### P2-1 · `useAppointments` acota por fecha, no por cardinalidad

`src/hooks/useAppointments.ts:63` — `where('fechaHora','>=',desde)` con ventana de 120 días
y **sin `limit`**. Ya fue una reparación (antes era la colección entera) y para un
consultorio va sobrado. Para un consultorio grande con varios médicos, 120 días pueden ser
miles de documentos en un `onSnapshot` montado en todas las pantallas del panel.

**Reparación propuesta.** Añadir `limit` con paginación y estrechar la ventana por defecto
a lo que la pantalla muestra. → **#306**.

### P2-2 · `getNotas` trae el historial completo del paciente

`src/lib/expediente/firestore.ts:39-42` — `orderBy('fechaConsulta','desc')` sin `limit`. Un
paciente crónico de diez años en el consultorio del dueño puede tener cientos de notas, y se
descargan enteras al abrir la consulta. → **#306**.

### P2-3 · Lecturas de colección completa fuera del camino caliente

`src/app/api/fhir/paciente/[patientId]/route.ts:43` y
`src/app/api/arco/cancelar/route.ts:65` (`notas` entero — legítimo: son exportación y
derecho ARCO, y ahí la completitud es el requisito);
`src/app/api/mantenimiento/backfill-contadores/route.ts:44` (`appointments` entero — ruta de
mantenimiento);
`src/app/api/clinic/miembros/route.ts:23` y `src/app/api/facturacion/pagos/route.ts:22`
(filtradas por `where` pero sin `limit`).

No bloquean el lanzamiento. Se declaran para que no se cuenten como «acotadas» en la
revisión de escala.

---

## 3. Puntos únicos de fallo

| Componente | Qué se cae con él | Hay degradación hoy |
|---|---|---|
| Firestore (lectura) | apertura de paciente/encuentro, agenda | parcial: la consulta abierta sigue con respaldo local |
| Firestore (escritura) | autoguardado en la nube, alta de citas | sí para la nota (`localStorage` + IndexedDB); **no** para la agenda |
| Proveedor de IA (Anthropic/OpenAI) | estructuración, razonamiento, verificación | mensaje ya bueno (`src/lib/ia/fallo-proveedor.ts`); falta cortacircuitos |
| Proveedor de transcripción | dictado | el audio se conserva en IndexedDB ✔ |
| Vercel (una región) | todo | ninguna; es dependencia de plataforma asumida |
| WhatsApp / 360dialog | avisos al paciente | sí: outbox con reintentos ✔ |
| Reglas de Firestore | autorización | se despliegan aparte de la app ⚠ (ver `deployment-and-flags.md`) |

---

## 4. Dónde puede haber pantalla blanca

Ver [`NO-WHITE-SCREEN-INVENTORY.md`](NO-WHITE-SCREEN-INVENTORY.md).

---

## 5. Lo que este inventario NO cubre, declarado

- **No mide.** No hay una sola latencia real aquí. Todo son rutas de código leídas.
- **No cubre Hospital/UCI.** Fuera del alcance de Consultorio y de este carril.
- **No cubre las reglas de Firestore** más allá de señalar que se despliegan aparte.
- **No revisó las 96 rutas de API una a una.** Se recorrió el camino de los dos golden
  paths y las lecturas de colección de todo `src/app/api`. Una ruta administrativa poco
  usada puede tener un defecto de escala que aquí no aparece.
- **No prueba que las reparaciones propuestas funcionen.** Son propuestas con su archivo y
  su línea, para el carril que sí puede tocarlas.
