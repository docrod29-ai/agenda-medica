# Bitácora · 10-sep-2026 (tarde) — los pendientes que Codex dejó declarados

Contexto: v1195 en producción (PR #478 rematado y publicado, run #34). El dueño
preguntó por los tres pendientes del checkpoint de Codex y pidió arreglarlos y
definirlos. Aquí está qué se hizo con cada uno, qué se probó y qué le toca a él.

## 1 · «Posible mezcla de pacientes sin secuencia identificada»

**Qué era.** Codex sospechaba que una respuesta tardía de la IA (estructurar,
corregir) pudiera caer en el expediente de otro paciente si el médico cambiaba
de paciente mientras la petición seguía en vuelo. No tenía secuencia ni prueba.

**Qué se hizo.** Sonda de navegador sobre el arnés con emuladores y datos
sintéticos: `scripts/ausculta-transformacion/respuesta-tardia-cambio-de-paciente.mjs`.

| Corrida | Navega a pac-002 | SENTINEL en pantalla | SENTINEL en Firestore pac-002 | SENTINEL en Firestore pac-001 |
|---|---|---|---|---|
| Control positivo | no | **sí** | no | **sí** (autoguardado a los 30 s) |
| Caso | sí, a los ~0,6 s; la respuesta llega a los 7,1 s | **no** | **no** | no |

El control positivo demuestra que la sonda detecta lo que busca (sin él, un
«no aparece» no vale nada). En el caso, la pantalla de consulta se desmonta al
cambiar de paciente —el segmento dinámico `[patientId]` cambia de clave en el
App Router— y el `setState` de la instancia vieja ya no llega a nadie.

**Veredicto.** No hay mezcla por esta vía. **Residual declarado:** la
corrección que el médico pidió se PIERDE en silencio si se va antes de que
llegue (ni pac-001 la recibe). Es pérdida, no mezcla; queda anotado en la sonda
y en `docs/clinical-safety/REGISTRO-DE-PELIGROS.md`.

**Qué NO cubre.** Cambiar de NOTA del mismo paciente por `?nota=` (los
parámetros de búsqueda no desmontan) — ahí la guardia es `firmadaRef`, porque
la nota que se reabre está firmada. No se probó la estructuración en vivo
mientras se graba y se navega: la grabación vive en la misma pantalla y se
corta al salir.

## 2 · Decisiones de agenda, portal y roles del 9-sep

Auditadas las ocho contra el código (agente Explore, muy exhaustivo) y luego
resueltas una por una:

| Decisión | Estado antes | Hoy |
|---|---|---|
| A · duración por tipo, ajustable por cita | ya existía | sin cambios |
| B · consecutivas, sin huecos obligatorios | ya existía (`intervaloMinutos` retirado) | sin cambios; queda un fósil en `agenda/prompts.ts` («buffer_minimo_respetado»), sin motor detrás |
| C · confirmación directa o manual por médico | **faltaba** | **D-054**: `confirmacionDeCitas` por consultorio (Configuración → Portal) con override por médico; un solo módulo decide y lo llaman portal público, bot y lista de espera. «Por sede» pendiente: no hay sede |
| D · cancelar/reagendar hasta 12 h; después, solicitar | parcial (sólo el «no») | **D-055**: `cambioEnLinea` por cita, acción `solicitar-cambio`, tarea de recepción colgada de la cita, pantalla que ofrece pedir el cambio |
| E · lista de espera: avisar a todos, el primero gana | parcial (`LIMITE_NOTIFICAR = 3`) | **D-053**: se avisa a todos los compatibles; la reserva atómica ya existía |
| F · portal: documentos, subir estudios, preconsulta, mensajes | parcial (falta subir estudios) | **D-058 definida**, no implementada: exige `storage.rules` nuevas (despliegue del dueño) y tres respuestas suyas |
| G · admin → recepción; clínico → médico | parcial (lo admin no llegaba a nadie) | **D-056**: tarea `area: 'recepcion'`, prioridad normal, escalada, aviso al consultorio; `/pendientes` la etiqueta «Recepción» |
| H · cada médico ve sus pacientes; compartir con autorización | **faltaba** | **D-057 definida**, no implementada: toca reglas, matriz, respaldo, listas y migración; cuatro preguntas al dueño |

Pruebas nuevas: `quien-confirma-la-cita-que-pide-el-paciente` (D-054, con
guardián de fuente y autotest), `la-lista-de-espera-avisa-a-todos-los-compatibles`
(D-053, probada al revés: con el `break` cuenta 3 y no 5),
`lo-administrativo-va-a-recepcion` (D-055/D-056). Invertido a propósito el caso 3
de `la-pregunta-escalada-llega-al-worklist` (afirmaba que lo administrativo no
abría tarea).

## 3 · «Objetivo de carga no medido»

No es tiempo de carga de la pantalla: es **capacidad** — 100 000 cuentas
registradas y 100 000 usuarios activos simultáneos, las dos confirmadas por el
dueño («Las dos»). El contrato del ensayo ya está escrito
(`docs/maintenance/AUSCULTA-2026-09-09.md`, «Contrato del ensayo adicional»).

Lo que este contenedor **no puede** hacer: generar esa carga (el arnés local
está acotado a 400 sesiones), apuntarla a producción (prohibido sin
autorización y además es la base viva), ni contratar la infraestructura de
ensayo. Lo que sí hay: modelo de concurrencia, generador sintético y validador
del JSON de carga.

**Lo que hace falta del dueño, en este orden:**

1. Un **proyecto de Firebase de ensayo** aparte (no `nexomed-agenda`) y un
   despliegue de Vercel apuntando a él — o autorización explícita para crear
   ambos con su cuenta.
2. **Presupuesto** para los generadores distribuidos y para el consumo de
   Firestore/Vercel durante el ensayo (lecturas, escrituras, funciones). Sin
   cifra no se puede dimensionar.
3. La **mezcla de roles** (cuántos médicos dictando, cuántas recepciones,
   cuántos pacientes en el portal) y la **duración** del pico. El documento
   propone valores; los tiene que confirmar él.
4. Verificar el **plan de Vercel** (la integración devolvió 403 al consultar la
   configuración): cuotas de funciones y ancho de banda.

Con eso se puede ejecutar y entregar el informe con commit, región, reglas,
índices y métricas. Sin eso, «100 k» sigue siendo un objetivo, no una medida.

## 4 · Segunda vuelta (tarde): D-057 y D-058 implementadas, y el segundo objetivo de carga modelado

El dueño contestó las preguntas de la mañana. Con eso:

### D-057 · cada médico ve sus pacientes

- **Modelo**: `Patient.medicoTitularUid` + `Patient.compartidoCon[]`. Regla única
  en `lib/authz/alcance-del-paciente.ts`: titular, compartido o admin. **Sin
  titular = paciente anterior a la decisión: se ve como siempre** hasta que
  alguien lo asigne (ausencia de dato no es dato de ausencia; esconder el
  consultorio entero el día del despliegue sería el fallo caro).
- **Reglas**: `esMedicoDelPaciente(clinicId, docId)` en TODAS las subcolecciones
  clínicas del paciente (notas, versiones, adendas, paquetes, preguntas,
  formularios, laboratorios, fotos, clínico, estudios aportados). La ficha sigue
  `isMember`: recepción agenda con ella. Titular y compartidos sólo los cambia el
  titular o el admin; al nacer, sólo quien da de alta.
- **Servidor**: `verificarCapacidadSobrePaciente` (módulo propio, para que el
  guardián de identidad sólo lo vea en las rutas que abren expediente) en FHIR,
  exportar, paquete de visita, pregunta atendida y telesalud.
- **Recepción**: lee y mueve sólo tareas `area == 'recepcion'`; el worklist
  consulta con ese filtro; índice nuevo `tareas_clinicas(area, estado,
  pesoUrgencia, creadaEn)` — **pendiente de desplegar**.
- **Pantalla**: `CompartirExpediente` en el expediente (compartir/revocar con
  bitácora; otro médico ve la ficha y PIDE acceso → tarea a nombre del titular);
  la consulta de un paciente ajeno redirige al expediente; el directorio y la
  paleta filtran a los propios para el rol `medico`.
- **Los de antes**: `/api/pacientes/asignar-titulares` (admin; simula primero)
  asigna desde la última cita; lo que no se puede deducir se cuenta y se dice.
- **No hay acceso de emergencia**: no se decidió y no se inventa.

### D-058 · el paciente sube estudios

Ver la fila del registro: valores recomendados, token personalizado en app
aparte, `storage.rules` sólo `create` bajo su carpeta, registro y tarea por el
servidor, URL firmada para el médico, lectura con la IA desde el bucket.
**`storage.rules` se despliega ahora con el botón de producción** (paso nuevo
en `deploy-production.yml`).

### Ensayo de carga · 100 000 activos

`scripts/escala/escenario-de-activos.mjs`: la mezcla de roles declarada
(médicos 8 %, recepción 4 %, pacientes 88 %, con base), una sesión por persona,
caudal/escrituras/IA por rol, y lo que falta fuera con nombre. Para 100 000:
1 519 pet/s sostenidas, 283 escrituras/s, 13 llamadas de IA/s, 816 000
documentos residentes; no cabe aquí por concurrencia ni volumen. El corte local
(400 sesiones: 32 médicos, 16 recepción, 352 pacientes) está etiquetado como
humo del generador, no evidencia. Lo que sigue necesitando del dueño no cambia:
proyecto de ensayo, presupuesto, plan de Vercel.

## 5. Cierre del despliegue de v1196 (11-sep-2026)

PR #488 fusionado (`15b2b91`), pin #489 fusionado (`9a20b06`), botón pulsado:
ejecución **#35**.

| Paso | Resultado |
|---|---|
| Compuertas 0–3 | verde; producción sirvió `nexusmed-v1196` al primer intento |
| Firestore · REGLAS | verde; sello `dca8f9d3…` = sha256 del árbol |
| Firestore · ÍNDICES | verde; el catorce enviado (falta ver `Enabled` en consola) |
| **Storage · REGLAS** | **rojo · 403 `firebasestorage.defaultBucket.get`** |
| Seguridad · producción | 57/57 |
| Smoke público / portal | 10/10 · 401 sin enlace |
| Acta | dijo `SUCCESS` sin contar Storage → REG-668 |

**Lo que rige hoy**: D-053…D-057 completos; de D-058, todo salvo la subida en
sí: el bucket rechaza el archivo del paciente hasta que `storage.rules` se
publique. El registro, la tarea y la lectura firmada están desplegados.

**Lo que es del dueño**: rol `roles/firebasestorage.admin` a la cuenta de
servicio del botón (IAM de `nexomed-agenda`); si ya estaba, vincular el bucket
en Firebase → Storage. Después, volver a pulsar el botón sobre `main`.

**Lo que se arregló aquí**: el acta cuenta Storage y, si sale 403, dice qué rol
falta (`el-acta-dijo-success-con-storage-rojo.test.ts`, 8 casos, probados al
revés contra el YAML de la #35).

## 6. Storage cerrado: ejecución #36 (11-sep-2026, 03:35 UTC)

El dueño dio el rol «Administrador de Cloud Storage para Firebase» a la cuenta
de servicio del botón y dijo «Ya». Se volvió a pulsar sobre `main` (`9a20b06`,
mismo árbol `15b2b91`):

| Paso | Resultado |
|---|---|
| Compuertas 0–3 | verde; producción seguía sirviendo `nexusmed-v1196` |
| Firestore · REGLAS | verde; «already up to date» (reenvío idéntico, sello `dca8f9d3…`) |
| **Storage · REGLAS** | **verde · «released rules storage.rules to firebase.storage»** |
| Firestore · ÍNDICES | verde (reenvío) |
| Seguridad / Smoke / Portal | 57/57 · 10/10 · 401 |
| Acta | `PRODUCTION_RELEASE=SUCCESS`, esta vez con razón |

Con esto **rige todo v1196**, incluida la subida de estudios desde el portal
(D-058). La tabla «PENDIENTE DE DESPLIEGUE · Storage» queda vacía.

Nota: la #36 corrió con el workflow de `main`, que todavía no lleva el acta
corregida de REG-668 (va en el PR #490). Por eso el acta de la #36 no imprime
`STORAGE_RULES=`; el verde de Storage se leyó del paso y del log, no del acta.
