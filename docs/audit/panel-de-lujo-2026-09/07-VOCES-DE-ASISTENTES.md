# 07 — Voces de asistentes

**Los cinco asistentes son personajes interpretados por un modelo**, recorriendo la app viva en `localhost:3200` con el consultorio sintético `consultorio-demo-v10` (escritorio 1440×900 y móvil 390×844). Ningún dato es real; ningún mensaje se envió; ningún cobro pasó por Stripe.
**Cada defecto está anclado a `archivo:línea` y pasó por el equipo rojo**: la prioridad que se cita es `prioridad_final` de `crudos/R-AS-*.json`; un `refutado` no se cita como defecto. Fuente: `crudos/AS-*.json` y `crudos/R-AS-*.json`.

Los cinco cerraron 105 hallazgos: 75 confirmados, 24 parciales, 6 refutados (`ASR-014`, `ASR-015`, `ASM-003`, `ASM-021`, `ASM-024`, `ASE-022`). Uno **subió** de prioridad: `ASC-001` pasó de P1 a **P0** porque falla el 100 % de las veces y no tiene camino alternativo.

Regla de la lente 2: la tarea que más se repite en una pantalla cabe en **tres clics o menos**. Lo que la supera se marca abajo con ▲.

---

## 1. Por asistente

### I · Recepción y agenda (`AS-recepcion`, 21 hallazgos: 10 confirmados, 9 parciales, 2 refutados)

**Su tarea de 40 veces al día:** agendar y confirmar citas; marcar llegadas; cancelar y reprogramar.

| Tarea | Clics medidos | Observación |
|---|---|---|
| Agendar paciente existente | 5–6 ▲ | Dashboard «Nueva cita» → `/asistente`: teclear nombre, sugerencia, tipo, día, hora, «Agendar cita». En la siembra termina en «No se pudo agendar la cita» (`ASR-001`, parcial P3: es la siembra, no el producto) |
| Agendar paciente nuevo con teléfono | 4 + 2 campos ▲ | Crea el expediente antes de la cita (`ASR-011`, parcial P3) y la cita nace «confirmada» |
| Confirmar una cita por teléfono | 5 ▲ | ⋮ → Editar cita → Estado → «confirmada» → Guardar, con un select en enum (`ASR-004`, `ASR-006`) |
| Confirmar por WhatsApp | 1 | El botón abre WhatsApp y no registra nada |
| Reprogramar | 5–6 ▲ | Bloqueado con «ocupado» si el día está cerrado (`ASR-008`) |
| Cancelar | 2 | Sin confirmación, sin motivo, sin deshacer (`ASR-005`) |
| Marcar llegada | 2 | Toast «Estado actualizado: en-sala» (`ASR-009`, `ASR-006`) |
| Ver agenda de mañana | 1 | Estado vacío bien escrito |
| Bloquear horario de comida | ≈18 según el auditor; **6** según el equipo rojo ▲ | El descanso nace con 14:00–16:00 puestos (`configuracion/page.tsx:687-691`); lo que falta es «aplicar a todos» (`ASR-010`, parcial P3) |

**La vez de las 40 que sale mal:** la confirmación por teléfono. «El botón “Confirmar” abre WhatsApp y no registra nada, y el menú de estados no tiene “Confirmada”. O me meto a Editar cita en un select que habla como máquina (5 clics, 40 veces), o dejo la cita como está — y entonces el tablero me repite “Confirmar cita de…” todo el día, el riesgo de no-show se calcula con un dato falso y al paciente le vuelve a llegar “confirma tu cita”.» → `ASR-004`, **P2** (bajó de P1: existe camino por Editar cita y el lazo se cierra solo cuando el paciente contesta por WhatsApp o portal). La segunda: la cancelación en móvil, «Cancelada» pegada a «Finalizada» en un menú de 34 px que se aplica al instante → `ASR-005`, **P2**.

**Hallazgos confirmados más graves:**

1. `ASR-004` P2 — No hay forma de marcar «Confirmada» una cita confirmada por teléfono. `src/app/(dashboard)/citas/page.tsx:1061` (`QUICK_STATUSES` sin `'confirmada'`).
2. `ASR-005` P2 — «Cancelada» desde el menú rápido cancela al instante, sin confirmación ni motivo, y dispara aviso a lista de espera y borrado en Google Calendar. `src/app/(dashboard)/citas/page.tsx:406` (Eliminar sí pregunta, `:511`).
3. `ASR-003` P2 — Tablero y agenda no coinciden en qué día es hoy: saludo y «próxima cita en 4h» usan el reloj del navegador; la agenda, la zona del consultorio. `src/app/(dashboard)/dashboard/page.tsx:126`.
4. `ASR-007` P2 — Buscar «Rosalia» sin acento esconde las 8 citas del día; en Pacientes sí funciona. `src/app/(dashboard)/citas/page.tsx:219`.
5. `ASR-008` P2 — Editar una cita en día cerrado dice «Ese horario ya está ocupado» y apaga «Guardar cambios» sin tocar nada. `src/lib/availability.ts:297`.

También P2: `ASR-013` (nombre, teléfono, Desde/Hasta/Motivo sin etiqueta asociada, `asistente/page.tsx:455`).

### J · Cobros y corte de caja (`AS-cobros`, 18 hallazgos: 17 confirmados, 1 parcial, 0 refutados)

**Su tarea de 40 veces al día:** registrar el cobro de cada consulta y cerrar el día.

| Tarea | Clics medidos | Observación |
|---|---|---|
| Cobrar en efectivo | 3 + teclear el importe | Cobrar → importe → Registrar cobro; el importe no viene sugerido |
| Cobrar con tarjeta | 5 ▲ | Los mismos + método + autorización |
| Exentar con motivo | 4 ▲ | Cobrar → No cobrar → motivo → Confirmar |
| Hacer el corte (médico) | 3 | Operaciones → Ver la gestión → Finanzas → pestaña Corte |
| Hacer el corte (asistente) | **sin camino** | En modo secretaria teclea `/corte-caja` o `/finanzas` a mano (`ASC-006`) |
| Exportar para el contador | 2 | Exporta el periodo de Reportes, no el corte; la pestaña Corte no tiene Imprimir (`ASC-007`) |
| Ver lo cobrado esta semana | 2 | Finanzas → Semana |

**La vez de las 40 que sale mal:** «La asistente teclea el importe a mano en cada cobro porque no hay precio sugerido, y un cero de más ($8,000 por $800) pasa sin tope ni pregunta; y cuando quiera corregirlo, hoy la anulación no funciona.» → `ASC-010` **P2** (ningún freno de magnitud en modal, lib ni reglas; el umbral es del dueño) y `ASC-001` **P0** / `ASC-002` **P1** (ningún cobro se puede anular).

**Hallazgos confirmados más graves:**

1. `ASC-001` **P0** — Anular un cobro ligado a una cita falla siempre: la transacción escribe el cobro (`:441`) y después lee la cita (`:467`); Firestore lo rechaza. `src/lib/cobros.ts:441`. `allow delete: if false` en `firestore.rules:982`: no hay salida.
2. `ASC-002` P1 — Anular un cobro sin cita lo niega la regla: compara `citaId`/`patientId` que en ese documento no existen. `firestore.rules:917`.
3. `ASC-003` P1 — Escribir `cobroId` a mano en la cita borra la deuda del corte y de «por cobrar» sin cobro real ni rastro; el camino inverso (`cobroId:''`) también pasa. `firestore.rules:152`.
4. `ASC-004` P1 — Quitar una cortesía no pide motivo, borra quién la autorizó y no deja bitácora: el rastro de REG-003 se deshace con dos clics. `src/lib/cobros.ts:403`.
5. `ASC-017` P2 — Cancelar o marcar «no asistió» una cita cobrada no pregunta qué hacer con el dinero. `src/app/(dashboard)/citas/page.tsx:390`.

También P2: `ASC-006` (sin enlace a Finanzas ni corte para la asistente, `Sidebar.tsx:50`), `ASC-007` (corte sin Imprimir, CSV del mes), `ASC-009` («Cobro registrado: $X» con importe tecleado aunque no registró nada, `cobros.ts:339`), `ASC-011` (campos del modal de cobro sin etiqueta, más tres `<select>` sin nombre que el auditor no contó).

### K · Mensajería y recordatorios (`AS-mensajeria`, 25 hallazgos: 17 confirmados, 5 parciales, 3 refutados)

**Su tarea de 40 veces al día:** confirmar citas por WhatsApp y mantener el teléfono correcto para que el recordatorio llegue.

| Tarea | Clics medidos | Observación |
|---|---|---|
| Confirmar cita por WhatsApp (ciclo completo) | ≈7 acciones en dos aplicaciones ▲ | 1 clic abre `wa.me` → cambiar de app → enviar; la cita no cambia. Cuando el paciente contesta al teléfono personal: ⋮ → Editar cita → estado → Guardar (+4) (`ASM-010`) |
| Recordatorio manual | 3 acciones | Sólo si la cita tiene teléfono; si no, ni botón ni aviso (`ASM-023`) |
| Corregir un teléfono | 4–5 ▲ (+4 por cada cita futura) | Acepta «12345» (`ASM-001`); no llega a las citas ya agendadas (`ASM-004`) |
| Quién no ha confirmado mañana | 2 | Correcto. Lo que no se ve: a quién le falló el recordatorio (`ASM-007`) |
| Contestar a un paciente | 0 — fuera de la app | `/chat` es entre médico y asistente; el bot no tiene bandeja (`ASM-022`, parcial) |

**La vez de las 40 que sale mal:** «La que corrige un teléfono: se guarda sin validar, no se propaga a la cita, y el recordatorio de mañana —con nombre completo, médico y nombre del consultorio— sale al número equivocado; si el número es de EE.UU., la normalización lo convierte en silencio en un número mexicano.» → `ASM-004` **P1**, `ASM-002` **P1**, `ASM-001` P2 (bajó de P1: el daño propio es un envío que no sale; la fuga la aporta `ASM-002`).

**Hallazgos confirmados más graves:**

1. `ASM-002` P1 — Un teléfono con `+1` se convierte en silencio en número mexicano: `+1 619 555 1234 → 526195551234`. Única puerta antes del proveedor, sin comprobación de país. `src/lib/whatsapp/telefono.ts:18`. (Matiz del equipo rojo: 619 no es LADA mexicana, ese caso concreto lo rechaza el proveedor; la mutación silenciosa es el defecto.)
2. `ASM-004` P1 — Corregir el teléfono del paciente no corrige `pacienteTelefono` de sus citas; el cron lee el de la cita (`reminders/route.ts:219`) y nadie lo sincroniza. `src/lib/firestore.ts:638`. Caso canónico de «el dato tiene que LLEGAR».
3. `ASM-006` P1 — El «SÍ» del paciente se pierde si contesta más de 2 h después: el bot borra la sesión y manda el menú (`:574-583`, 44 líneas antes del bloque que atiende SÍ/NO). `src/app/api/whatsapp/webhook/route.ts:574`.
4. `ASM-007` P2 — Un recordatorio que falla no deja huella por cita; el libro de no entregados no tiene pantalla. `src/app/api/cron/reminders/route.ts:353`.
5. `ASM-013` P2 — Un audio, una foto o el botón de respuesta de una plantilla se ignoran sin contestar: el paciente cree que avisó. `src/app/api/whatsapp/webhook/route.ts:1615`.

También P2: `ASM-008` (reseña automática fuera de ventana, sin plantilla), `ASM-009` (cinco llamadores mandan texto libre directo), `ASM-010` («Confirmar» no confirma), `ASM-012` (tres vocabularios para el paciente), `ASM-014` (webhook contesta 200 antes de terminar), `ASM-015` (vista previa que el cron nunca manda), `ASM-005` (parcial: omisión diseñada, pero sin registro por cita).

### L · Expedientes, migración y respaldo (`AS-expedientes`, 27 hallazgos: 21 confirmados, 5 parciales, 1 refutado)

**Su tarea de 40 veces al día:** «tráeme el expediente de <apellido>».

| Tarea | Clics medidos | Observación |
|---|---|---|
| Encontrar expediente por nombre | 2 + texto | Falla por diseño cuando se busca por un apellido que no es la primera palabra (`ASE-001`) o con acento distinto (`ASE-002`, parcial P3) |
| Alta de paciente completo | 3 + captura | 7 campos → Registrar → aviso de privacidad; el aviso de homónimo sí salta (REG-039 sigue cerrado) |
| Importar CSV | 6 ▲ (modo médico) | Sin camino por menú en modo secretaria (`ASE-018`); apellidos, fechas y CURP entran sin validar (`ASE-003`, `ASE-004`, `ASE-005`) |
| Fundir duplicados | **imposible** | El barrido los encuentra y nada los junta (`ASE-009`) |
| Entregar ARCO real | **imposible** | La solicitud del portal llega sin expediente ligado y no hay pantalla para ligarla (`ASE-010`) |
| Exportar todo | 2 | El archivo declara si quedó completo. Restaurarlo: sin interfaz (`ASE-016`) |

**La vez de las 40 que sale mal:** «De 40 búsquedas al día, las de “tráeme el de <apellido>” son las que salen mal.» → `ASE-001` **P1**: con una sola palabra el plan del servidor es prefijo sobre `nombre`, no casa un apellido intermedio, y la respuesta vacía del servidor pisa el acierto del filtro local; `similitudNombre('iparraguirre', 'Tadeo Iparraguirre Nolasco') = 0.67 < 0.8`. (Precisión del equipo rojo: «Barquin Salcedo» sí lo rescata el bloque de parecidos; el fallo sin red es el de una sola palabra.)

**Hallazgos confirmados más graves:**

1. `ASE-001` P1 — Buscar por apellido a secas contesta «Ninguno de los 6 expedientes coincide» aunque exista. `src/app/(dashboard)/pacientes/page.tsx:168`.
2. `ASE-003` P1 — El importador guarda «15/03/1980» tal cual: la edad no se deriva y ese paciente capturado a mano («1980-03-15») es otra persona para el motor de duplicados por siempre. `src/app/(dashboard)/migracion/page.tsx:211`.
3. `ASE-004` P1 — Un Excel con «Nombre», «Apellido paterno», «Apellido materno» importa 1 200 pacientes con sólo el nombre de pila y sin avisar. `src/lib/csv-pacientes.ts:80`.
4. `ASE-010` P1 — Las solicitudes ARCO reales no se pueden ejecutar: llegan sin `patientId`, no hay pantalla para ligarlas y el expediente no tiene acción ARCO. `src/app/(dashboard)/cumplimiento/page.tsx:931`.
5. `ASE-013` P1 — Cerrar sesión desde Pacientes, Agenda u Operaciones (sin consulta abierta) no limpia la caché IndexedDB con los expedientes, aunque Operaciones prometa lo contrario. `src/lib/salir-seguro.ts:101`.

También P2: `ASE-005` (CURP «INVALIDO123» entra; `validarCURP` no tiene ningún llamador), `ASE-006`, `ASE-007`, `ASE-009`, `ASE-011` («Marcar resuelta» descarga con `identidadVerificada: true` a fuego), `ASE-012` (rectificación con `prompt()`), `ASE-014`, `ASE-016`, `ASE-018`, `ASE-020`; `ASE-015` parcial (supresión ARCO borra citas pasadas y deja cobros con nombre: decisión legal del dueño).

### M · Enfermería, signos y triage (`AS-enfermeria`, 14 hallazgos: 10 confirmados, 4 parciales, 0 refutados)

**Su tarea de 40 veces al día:** capturar los signos vitales antes de que pase el paciente.

| Tarea | Clics medidos | Observación |
|---|---|---|
| Capturar 6 signos | 2 + 7 campos con Tab | `/citas` → «Iniciar consulta» → TA, FC, FR, T°, SpO₂, Peso, Talla → «Guardar borrador». Sin glucosa capilar: el campo no existe (`ASN-013`). En móvil los siete campos quedan bajo el pliegue |
| Corregir un signo | 0 en borrador | Se sobreescribe sin motivo ni rastro (`ASN-012`, parcial); tras la firma sólo adenda de texto libre |
| Ver signos de la última consulta | 1 | Sin fecha, sin marca de borrador, sin unidades (`ASN-007` parcial P3, `ASN-008`) |
| Crear tarea con dueño y fecha | **imposible** | Sólo nacen al firmar, de un laboratorio o del portal (`ASN-009`) |
| Cerrar una tarea | 3 | «Tomarla» → «Ya se hizo» → «Lo revisé — cerrar»; «Ya no aplica» pide motivo (bien) |

**La vez de las 40 que sale mal:** «La primera. En cada consulta que abro, el primer signo que tecleo pierde su segunda cifra: “154” queda “14”, “36.7” queda “3.7”, “120/80” queda “10/80”. Si voy rápido y paso al siguiente, queda guardado, sale en el expediente como “Peso 14 kg” y el copiloto no me avisa porque 14 kg no cruza ningún umbral suyo.» → `ASN-001` **P1**, reproducido por el equipo rojo 3/3 en la app viva con navegador limpio.

**Hallazgos confirmados más graves:**

1. `ASN-001` P1 — El primer signo tecleado en una consulta recién abierta pierde su segunda cifra, sin aviso. Mecanismo: `voz` es un objeto nuevo en cada render, el efecto de restauración corre en cada commit, `vacio` no cuenta `signos` (`:3494`) y sale por `:3493` sin fijar `autoRestRef`. `src/app/(dashboard)/consulta/[patientId]/page.tsx:3493`.
2. `ASN-005` P2 — «154 lb» se convierte en 154 kg sin decirlo: el campo se traga « lb» tecla a tecla, la unidad sólo existe como placeholder, y ese peso va a la verificación de dosis por kg. `revisarPesoPediatrico` (REG-013) tiene un solo llamador y no está aquí. `src/app/(dashboard)/consulta/[patientId]/page.tsx:6757`.
3. `ASN-002` P2 — TA 400/300, FC 300, T 45 °C, SpO₂ 9 % se aceptan y se tratan como hipotensión/hipoxemia reales; no hay cota de plausibilidad en ninguna capa (sólo existe en UCI). Los límites: `NEEDS_CLINICAL_REVIEW`. `src/app/(dashboard)/consulta/[patientId]/page.tsx:6756`.
4. `ASN-006` P2 — TA «12/8» o «120-80» se guarda literal y ninguna alerta la lee: el parser exige dos o tres dígitos y diagonal, y calla. `src/lib/expediente/copiloto.ts:125`.
5. `ASN-010` P2 — Un pendiente crítico sin dueño («está convulsionando», escalado desde el portal) no enciende nada fuera de `/pendientes`: «Seguimiento» en el riel no lleva señal. `src/components/FlowRail.tsx:228`.

También P2: `ASN-008` («Últimos signos» toma un borrador sin marcarlo, `ResumenPaciente.tsx:23`), `ASN-009`, `ASN-013`; parciales P2: `ASN-003` (los signos guardados en otro equipo no llegan a la consulta que el médico abre desde la agenda; la «segunda nota» que temía el auditor no existe: GP9 converge al mismo documento), `ASN-004` (rol Enfermería sin alcance en Practice; lo accionable sin decisión: `SignosVitales` no tiene autor ni hora, `types/expediente.ts:203-214`).

---

## 2. Tareas frecuentes vs clics

Ordenada de más a menos clics. ▲ = supera los tres clics de la lente 2. Cuando el equipo rojo corrigió la cifra, van las dos.

| Clics | Tarea | Asistente | Lo que sale mal | Id |
|---|---|---|---|---|
| ≈18 → **6** ▲ | Bloquear horario de comida (L–V) | Recepción | Sin «aplicar a todos»; el descanso nace relleno | `ASR-010` (parcial P3) |
| ≈7 acciones, 2 apps ▲ | Confirmar cita por WhatsApp hasta que quede registrada | Mensajería | «Confirmar» no confirma; cerrar el lazo a mano cuesta 4 más | `ASM-010` P2, `ASR-004` P2 |
| 6 ▲ | Importar CSV | Expedientes | Sólo en modo médico; sin validar apellidos/fechas/CURP | `ASE-018` P2, `ASE-003`/`ASE-004` P1 |
| 5–6 ▲ | Agendar paciente existente | Recepción | En la siembra, 500 | `ASR-001` (parcial P3) |
| 5–6 ▲ | Reprogramar | Recepción | «Ocupado» en día cerrado, Guardar apagado | `ASR-008` P2 |
| 5 ▲ | Confirmar una cita por teléfono | Recepción | Select en enum; «Confirmada» no está en el menú rápido | `ASR-004` P2, `ASR-006` P3 |
| 5 ▲ | Cobrar con tarjeta | Cobros | Importe a mano, sin tope | `ASC-010` P2 |
| 4–5 (+4 por cita futura) ▲ | Corregir un teléfono | Mensajería | Acepta «12345»; no llega a las citas | `ASM-001` P2, `ASM-004` P1 |
| 4 + 2 campos ▲ | Agendar paciente nuevo | Recepción | Expediente antes que cita; nace «confirmada» | `ASR-011` (parcial P3) |
| 4 ▲ | Exentar con motivo | Cobros | — (bien: motivo obligatorio) | — |
| 3 + importe | Cobrar en efectivo | Cobros | El cero de más pasa; la anulación no funciona | `ASC-010` P2, `ASC-001` P0 |
| 3 | Hacer el corte (médico) | Cobros | Es un reporte, no un cierre | `ASC-013` P3 |
| 3 + captura | Alta de paciente | Expedientes | Siete `<label>` sin `htmlFor` | `ASE-020` P2 |
| 3 acciones | Recordatorio manual | Mensajería | Sin teléfono: ni botón ni aviso | `ASM-023` P3 |
| 3 | Cerrar una tarea | Enfermería | — (bien) | — |
| 2 + 7 campos | Capturar 6 signos | Enfermería | La primera cifra se pierde; sin glucosa | `ASN-001` P1, `ASN-013` P2 |
| 2 + texto | Encontrar expediente por nombre | Expedientes | Falla por apellido | `ASE-001` P1 |
| 2 | Cancelar cita | Recepción | Sin confirmación ni deshacer; borra en Google | `ASR-005` P2 |
| 2 | Marcar llegada | Recepción | Toast «en-sala» | `ASR-006` P3 |
| 2 | Quién no ha confirmado mañana | Mensajería | No dice a quién le falló el recordatorio | `ASM-007` P2 |
| 2 | Exportar CSV para el contador | Cobros | Exporta el mes, no el corte | `ASC-007` P2 |
| 2 | Ver lo cobrado esta semana | Cobros | — | — |
| 2 | Exportar todo el consultorio | Expedientes | Restaurar: sin interfaz | `ASE-016` P2 |
| 1 | Ver agenda de mañana | Recepción | — (bien) | — |
| 1 | Ver últimos signos | Enfermería | Sin fecha, sin unidades, puede ser borrador | `ASN-008` P2 |
| 1 | Confirmar por WhatsApp (abrir) | Recepción | No registra nada | `ASM-010` P2 |
| 0 | Corregir un signo en borrador | Enfermería | Sin motivo ni rastro | `ASN-012` (parcial P2) |
| 0 — fuera de la app | Contestar a un paciente | Mensajería | No hay bandeja | `ASM-022` (parcial P3) |
| **sin camino** | Hacer el corte (asistente) | Cobros | Teclear `/corte-caja` a mano | `ASC-006` P2 |
| **imposible** | Fundir duplicados | Expedientes | Sólo fingiendo un ARCO de cancelación | `ASE-009` P2 |
| **imposible** | Entregar un ARCO real | Expedientes | No se puede ligar el expediente | `ASE-010` P1 |
| **imposible** | Crear un pendiente a mano | Enfermería | El modelo declara `origen: 'manual'`; nadie lo escribe | `ASN-009` P2 |

Diez tareas frecuentes superan los tres clics. Las que más pesan al día no son las más largas, sino las de 1–3 clics que no hacen lo que dicen: «Confirmar» (no confirma), «Cobrar» (no se puede anular), buscar (no encuentra por apellido), el primer signo (pierde una cifra).

---

## 3. Lo que resistió

Para que el dueño no repare lo que no está roto. Cada línea trae la línea que lo impide o la decisión que ya lo cubre.

**Refutados (6):**

- `ASR-014` — «Prioridad» y «Rango horario» de la lista de espera sí deciden a quién se ofrece el hueco: `src/lib/whatsapp/ofrecer-hueco.ts:145` ordena por prioridad y `:203-204` descarta huecos que no sirven.
- `ASR-015` — No hay «dos formularios de Nueva cita»: la celda del calendario manda a `/asistente` con fecha y hora (`calendario/page.tsx:196-201`); el modal sólo abre en `openEdit`. La propuesta del auditor es la implementación actual.
- `ASM-003` — El inventario de PHI por plantilla es exacto, pero es el riesgo WA-9, decidido por el dueño el 5-sep (D-034, `docs/whatsapp/policy-risk-register.md:15`): los mensajes al propio número del paciente son administrativos. Cambiarlo es política nueva, no reparación.
- `ASM-021` — `adapter.ts` y `connection.ts` no tienen llamadores, pero están declarados con su motivo en el trinquete `src/__tests__/modulos-sin-conectar.test.ts:93,123`. Deuda declarada, no escondida.
- `ASM-024` — La alerta hospitalaria es módulo en pausa (D-030) y además sí registra el fallo (`alerta/route.ts:90-97`, `registrarFallo`).
- `ASE-022` — «Con acciones disponibles» es un comentario de cabecera del archivo (`retencion/page.tsx:5`), no texto de pantalla.

**Bajados de prioridad, y por qué:**

- `ASR-001` y `ASR-002` (P1 → P3): el 500 y la lista vacía los fabrica la siembra sintética (`sembrar-emulador.mjs:425-435` escribe campos que `ClinicConfig` no tiene). El alta real (`/api/clinic/crear:90-91`) escribe `DEFAULT_CONFIG` entero con horario y 8 duraciones. Sobrevive medio hallazgo: el paso «tipo» no tiene estado vacío.
- `ASR-011` (P3): crear el duplicado ante la duda es la decisión que cerró REG-039. Lo que queda: el orden (expediente antes de saber si la cita se escribió).
- `ASR-016`, `ASR-019`, `ASR-021` (P3): decisiones declaradas en el propio archivo (`citas/page.tsx:947-948`, `:1150-1155`); el tour nunca lo ve una asistente (`layout.tsx:861`, `enabled={esMedicoReal}`).
- `ASC-005` (P2): el reembolso de Stripe no llega al libro, pero requiere anticipo configurado, cobrado y reembolso manual en el panel de Stripe; queda rastro `huerfano: true`.
- `ASC-008` (P3): la hora en zona del navegador sólo muerde si difiere de la del consultorio.
- `ASC-012` (parcial P3): «Reembolso» no es código muerto sino deuda declarada en REG-015; `estado-cobro.ts:112-121` ya consume `REFUND/CREDIT`.
- `ASM-001` (P2): «12345» entra, pero el daño propio es un envío que no sale.
- `ASM-005` (parcial P2): omitir recordatorios fuera de ventana sin plantilla es diseño documentado (`docs/whatsapp/iteration-06-templates-window.md:26`); lo que queda es que no deja registro por cita.
- `ASM-011` (P3): el acuse sí guarda el teléfono destinatario (`status.ts:38-44`); falta la pantalla, no el dato.
- `ASM-016` (P3): «Hora de resumen diario» sin lector — deuda de «escrito y sin conectar», sin consecuencia clínica.
- `ASE-002` (P3): acentos en la búsqueda del servidor es límite declarado y sellado en REG-358; cerrarlo es el mismo trabajo que `ASE-001`.
- `ASE-008` (P3): el selector `accept=".csv"` oculta el .xlsx por omisión; queda una línea de texto que promete Excel.
- `ASN-002`, `ASN-005`, `ASN-010` (P1 → P2): el valor extremo sí dispara alerta crítica visible; lo tecleado no se transforma; la tarea crítica sí se ve en `/pendientes` y en «Siguiente acción» del dashboard. Las cotas por signo y edad son `NEEDS_CLINICAL_REVIEW`.
- `ASN-003` (parcial P2): el núcleo se sostiene, pero «el siguiente autoguardado crea una segunda nota» es falso: `claveEncuentro()` deriva un id determinista y la guarda de versión avisa en vez de pisar (`firestore.ts:519-536, 826-832`).
- `ASN-004` (parcial P2): el rol Enfermería no es botón muerto — tiene alcance en hospital/UCI (`matriz-acceso.ts:73`); su alcance en Practice es decisión del dueño.
- `ASN-007` (P3): el IMC sí se calcula, con motor determinista (`copiloto.ts:622-639`); lo que falta es persistirlo.

**Lo que ya estaba cerrado y sigue cerrado:** REG-039 (aviso de homónimo salta en el alta), la doble reserva (defendida en `AppointmentModal.tsx:228` y `appointments/route.ts:202-224`, transacción con centinela del día), REG-326 (la urgencia va antes que las FAQ en el bot), «Ya no aplica» con motivo obligatorio en tareas, y la idempotencia GP9 de la nota.

---

## 4. Lo que no se pudo probar

| Qué | Por qué | Cómo quedó |
|---|---|---|
| **Stripe real** (anticipo, reembolso, membresías) | Prohibido; el consultorio sintético no tiene `anticipoMonto` | `ASC-005` sólo en código; membresías por Stripe no existen hoy (`ASC-018`) |
| **CFDI / Facturama** | «No se tocó Stripe ni Facturama: todo lo de CFDI se auditó sólo en código» | Sin hallazgo con reproducción viva |
| **WhatsApp real** (envío, plantillas, webhook, bot) | Prohibido; el emulador no tiene proveedor; el único «enviar» abre `wa.me` | Normalización ejecutada con `node`; `ASM-002`, `ASM-004`, `ASM-006` verificados sobre el motor y siguiendo el dato hasta la puerta del proveedor |
| **Google Calendar con cuenta real** | Prohibido | Sólo el botón «Calendario descuadrado» pulsado en vivo (`ASR-019`) |
| **Doble reserva en vivo** | El POST de citas devolvía 500 en la siembra (`ASR-001`) | Defensa verificada en código (cliente y servidor) |
| **Pasos 2–5 de la reserva pública** | La siembra no ofrece tipos de cita (`ASR-002`) | Código |
| **Zona horaria y horario del consultorio** | No se cambiaron para no romper a los demás auditores | Sólo lectura; «+ Añadir descanso» pulsado sin guardar |
| **Segunda cuenta con rol Enfermería** | Cuenta única en el arnés | `ASN-004` deducido de `matriz-acceso.ts:123-126, 244-245` |
| **`ASN-001` en build de producción** | No se levantó; el auditor espera que persista porque la causa es de estado, no de velocidad | Reproducido 7/7 por el auditor y 3/3 por el equipo rojo, ambos en `next dev`; hay que verificarlo en producción |
| **Caché persistente IndexedDB (`ASE-013`)** | No existe en el emulador | Deducido de `salir-seguro.ts:192-210` y `firebase.ts:106-108` |
| **Restauración real del respaldo** | Sin interfaz (`ASE-016`); exige `curl` a `/api/clinic/importar` | No ejecutada |
| **Importación de 1 200 filas** | Se importó un CSV sintético de 3 filas | `ASE-027` (sin reanudación) sobre código |
| **Pantalla `/consulta` desde Recepción** | Fuera de su rebanada; `layout.tsx:592` rebota a la asistente | — |
| **Pesos y tiempos en producción** | Todo medido en servidor de desarrollo (Turbopack) | Declarado por Enfermería y Recepción |

---

## Resumen

- 5 recorridos, 105 hallazgos: 75 confirmados, 24 parciales, 6 refutados. Un P0: `ASC-001` (ningún cobro con cita se puede anular; con `ASC-002`, ninguno).
- P1 confirmados: `ASC-002`, `ASC-003`, `ASC-004` (dinero sin rastro), `ASM-002`, `ASM-004`, `ASM-006` (el recordatorio va al número equivocado o el SÍ se pierde), `ASE-001`, `ASE-003`, `ASE-004`, `ASE-010`, `ASE-013` (búsqueda, importación, ARCO, caché), `ASN-001` (el primer signo pierde una cifra).
- Diez tareas frecuentes superan tres clics; la peor no es la más larga sino «Confirmar», que no confirma (`ASR-004`, `ASM-010`).
- La asistente no tiene camino a Finanzas, corte, Migración ni Cumplimiento (`ASC-006`, `ASE-018`).
- «La vez que sale mal» por asistente: confirmación por teléfono · importe a mano sin anulación · teléfono corregido que no llega · búsqueda por apellido · primer signo mutilado.
- Dos P1 del panel se los comió la siembra (`ASR-001`, `ASR-002`); seis refutados no se reparan.
- No probado: Stripe real, CFDI, WhatsApp real, Google Calendar real, segunda cuenta de enfermería, build de producción para `ASN-001`, caché IndexedDB en emulador.
