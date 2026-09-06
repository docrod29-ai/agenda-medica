# 11 — Botones muertos y datos que no llegan

> Esta auditoría **no borra ni repara nada**: propone, y decide el dueño.
> Cada fila cita `archivo:línea`, el id del hallazgo y el veredicto del equipo rojo; lo refutado va aparte para que nadie lo repare.

Fecha: 2026-09-06 · Fuente: `crudos/*.json` (lente 1 del §4.0, «botones y funciones que no sirven») cruzados con los veredictos `crudos/R-*.json`. La prioridad que manda es `prioridad_final` del equipo rojo.

## Qué entra aquí

- Los **30** hallazgos `tipo: boton_muerto` de los 20 auditores.
- Además, **12** hallazgos `tipo: defecto` de la misma familia —«escrito y sin conectar» o «el dato no llega»— localizados por grep en título y evidencia: «nadie lo llama», «no llega», «sin llamador», «huérfano», «no se renderiza», «no persiste», y sus variantes literales en los JSON («nadie la lee», «cero llamadores», «no se guarda», «nunca aparecen»).

Veredictos sobre esos 42: **31 confirmados · 5 parciales · 6 refutados**. Los refutados están en la última sección.

Lectura de columnas: *Control* es el texto que ve el usuario (o el símbolo, si no hay pantalla). *Qué hace hoy* y *Qué debería hacer* salen de `evidencia` y `propuesta` del auditor, recortadas. Un `parcial` significa que el hecho es cierto pero la consecuencia o la tipificación no lo era del todo; la nota del rojo dice cuál.

---

## Tabla por pantalla

### `/configuracion`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Textarea «Mensaje para pacientes (opcional)» · pestaña Portal · contador 0/280 | Se guarda en `publicBookingNote`. La ruta pública sólo devuelve `publicBookingEnabled`; `/reservar` nunca lo lee. **El dato se guarda y muere.** | Devolverlo en `/api/public/clinic/[clinicId]` y pintarlo en `/reservar`, o retirar el campo hasta que llegue | `src/app/(dashboard)/configuracion/page.tsx:2297` · `src/app/api/public/clinic/[clinicId]/route.ts:80` | C-001 | P2 | confirmado |
| Campo «Hora de resumen diario» · pestaña Notificaciones | Se guarda `horaResumenDiario`. Ningún cron lo lee; `msgResumenDiario` (`whatsapp.ts:101`) tampoco tiene llamador. No existe el resumen | Esconder o retirar el campo (y `msgResumenDiario`) hasta que exista; si se quiere, conectarlo al cron de recordatorios | `src/app/(dashboard)/configuracion/page.tsx:843` | C-002 · ASM-016 | P3 | confirmado (los dos) |
| Toggle «Mostrar signos vitales (en órdenes)» · pestaña Recetas | `mostrarSignosVitales` no aparece en `/orden/**` ni en `RecetaDocumento`. La orden se imprime igual con o sin él | Leerlo en la orden (pintar los signos de la nota) o retirar el toggle | `src/app/(dashboard)/configuracion/secciones-recetas.tsx:1076` | C-003 | P3 | confirmado |
| Opción «Enfermería» en el selector de rol · Equipo | Se puede asignar. En Practice la nota y `tareas_clinicas` exigen `isMedico`: la enfermera no puede capturar signos ni ver pendientes y termina usando la cuenta del médico. El rojo aclara: sí sirve en Hospital/UCI (`isClinicoHospital`), luego no es botón muerto sino **rol sin alcance en Practice** | Decidir qué puede hacer «Enfermería» en Practice (signos con autor y hora, tareas de llamada) con lista blanca en el servidor; o retirar la opción del selector fuera de Hospital/UCI | `src/lib/authz/matriz-acceso.ts:123` · `secciones-cuenta.tsx:726` | ASN-004 | P2 | parcial |
| Textarea del bot de FAQ deshabilitado sin motivo (`disabled={!doctor}`) | El porqué sólo aparece como toast al intentar guardar | `title` o texto con la condición, o esconder hasta que aplique | `src/app/(dashboard)/configuracion/page.tsx:1527` | C-027 (parte) | P3 | confirmado |

### `/migracion`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Texto «Sube un CSV o Excel exportado desde tu sistema actual» | El selector sólo acepta `.csv`; un `.xlsx` forzado se lee con `readAsText` y termina en «No se encontró una columna de Nombre». El rojo baja a P3: con `accept=".csv"` el sistema oculta el `.xlsx` por omisión; es texto desalineado, no botón muerto | Leer `.xlsx` de verdad (SheetJS ya se usa al exportar) o cambiar el texto a «CSV (desde Excel: Guardar como → CSV UTF-8)» | `src/app/(dashboard)/migracion/page.tsx:327` (accept) · `:319` (texto) · `:152` | ASE-008 | P3 | parcial |
| Texto «…está el respaldo completo en Pacientes» | Apunta a una pantalla de la que la función se mudó; el respaldo vive en Operaciones (`operaciones/page.tsx:481`) y el propio comentario de `pacientes/page.tsx:130-134` documenta la mudanza | «en Operaciones → Respaldo», o mejor, el enlace | `src/app/(dashboard)/migracion/page.tsx:277` | ASE-019 | P3 | confirmado |
| Columna CURP del CSV importado | Se escribe `curp: fila.curp?.trim()` sin validar. `validarCURP` existe, está probado y **no lo llama nadie** (declarado huérfano con una razón hoy inexacta: el campo sigue vivo en migración, booking público y webhook) | Pasar por `validarCURP` e importar lo inválido **marcado y contado**, nunca descartado en silencio (regla 3); o retirar el campo de la importación | `src/lib/curp.ts:23` · `src/app/(dashboard)/migracion/page.tsx:217` | A-013 | P2 | confirmado |
| Misma importación: CURP inválido y sexo «F»/«Mujer» | «INVALIDO123» se guardó como CURP; «Mujer» y «M» se tiraron sin aviso. `validarCURP` y `sexoDesdeCURP` existen y no se llaman aquí (el rojo: no los llama **nadie** en el producto) | `normalizarCURP` + `validarCURP`; marcar la fila en la vista previa; aceptar sinónimos de sexo o derivarlo del CURP | `src/app/(dashboard)/migracion/page.tsx:216` · `src/lib/curp.ts:22,47` | ASE-005 | P2 | confirmado |

### `/cumplimiento`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Botón «Marcar resuelta» sobre una solicitud ARCO de **acceso** (y de oposición) | Descarga el expediente completo con `identidadVerificada: true` **constante**, sin la casilla que la cancelación sí exige (`:433`, `:474`). La tarjeta puede decir «Identidad sin verificar» y aun así entrega. El rojo: la misma constante quemada está también en oposición (`:314`) | Renombrar por tipo («Entregar expediente…», «Ejecutar oposición…») y pasar acceso y oposición por el mismo modal con casilla de identidad; `identidadVerificada` sale del estado de la casilla, nunca de una constante | `src/app/(dashboard)/cumplimiento/page.tsx:268` · `:314` · `:943` | ASE-011 | P2 | confirmado |

### `/login` (llega desde cerrar sesión)

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Aviso `?pendiente=guardado_lento\|guardado_fallido\|sin_confirmar` que emite `salir-seguro` | **Nadie lo lee**: `/login` sólo lee `invite`. El médico cierra sesión con trabajo sin confirmar y la pantalla de entrada es idéntica a la normal (reproducido: `/login?pendiente=sin_confirmar`) | Leer `pendiente` en `/login` y avisar en lenguaje de persona («Quedó trabajo sin confirmar en este equipo…»); o mejor, avisar **antes** de cerrar con opción de esperar | `src/lib/salir-seguro.ts:206` · `src/app/login/page.tsx:25-26` | ASE-014 | P2 | confirmado |

### `/membresias` (y `/finanzas`, `/hospitalizacion/unidades`)

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| «Asignar a paciente» (gris sin planes) · CSV de Finanzas (`finanzas:219`) · campos de Unidades para no-admin (`unidades:128-136`) | Deshabilitados **sin decir por qué**. Contraste: `uci/page.tsx:935` sí lleva `title` explicativo | `title`/texto de ayuda con la condición («Crea un plan para poder asignarlo») o esconder el control hasta que aplique | `src/app/(dashboard)/membresias/page.tsx:119` | C-027 | P3 | confirmado |

### `/motores`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| La pantalla entera («Lo que te protege, funcionando») | Cero enlaces entrantes: ni Sidebar, ni Operaciones, ni paleta, ni `contextos.ts`. Sólo se llega tecleando la URL. `/cumplimiento/motores` sí está enlazada | El auditor de diseño propone enlazarla desde `/cumplimiento/motores` y Operaciones › Sistema, o fusionar ambas. **Ojo**: el mismo hecho, propuesto por el programador (C-029), fue **refutado**: `/motores` está desenlazada **a propósito** por REG-292 y un guardián (`lo-que-hace-si-como-lo-hace-no.test.ts:65-79`) pone el CI en rojo si una superficie del cliente la ofrece. Enlazarla es decisión del dueño, no reparación | `src/app/(dashboard)/motores/page.tsx:3` | D-009 (ver C-029 abajo) | P3 | confirmado |

### `/operaciones`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Tarjeta «Chat — Mensajes con pacientes y con el equipo» | Abre el chat interno médico ↔ asistente (`lib/chat.ts:2`, `isMember`). Un paciente no es miembro; en `chat/page.tsx` no aparece la palabra «paciente» | Texto que diga lo que hace: «Mensajes con tu equipo». El Sidebar ya dice sólo «Chat» | `src/app/(dashboard)/operaciones/page.tsx:154` | N-012 (y ASM-022) | P3 | confirmado |
| Tarjeta «CRM — De dónde llegan los pacientes y qué pasó con cada contacto» | La pantalla no tiene un solo dato de origen (grep `origen\|fuente\|canal` = 0); muestra tasas de confirmación, no-show y retención | Corto plazo: «Cómo va la agenda: confirmaciones, ausencias y retención». Medio plazo: sellar `origen` en la cita al crearla (portal, bot, mostrador, lista de espera) — trabajo nuevo, no defecto | `src/app/(dashboard)/operaciones/page.tsx:132` | N-013 | P3 | confirmado |

### `/pendientes`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| (Control ausente) «Nuevo pendiente» | El modelo declara y explica `origen: 'manual'` y `por-que-esta-aqui.ts:163` tiene el `case 'manual'` preparado; **ninguna pantalla lo escribe**. Los únicos importadores de `tareas-clinicas/abrir` son la consulta y la orden. No hay forma de crear «llamar a la señora por su resultado» | «Nuevo pendiente» en `/pendientes` y en el expediente (paciente, texto, dueño, vence), reusando `abrir` con origen `'manual'` y la misma guarda | `src/lib/tareas-clinicas/modelo.ts:242` | ASN-009 | P2 | confirmado |

### `/consulta/[patientId]`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Etiqueta ámbar «sin validar» junto a resultados de motores (prometida en `/cumplimiento/motores:93`) | `SelloMotor` está **importado y nunca se pinta** (`grep '<SelloMotor' src/` = vacío). 23 de 89 motores están `pendiente_validacion` y ninguna cifra lo enseña. Tercer falso negativo del guardián de huérfanos (importado ≠ usado) | Pintar el sello junto a los resultados de motores no validados, o corregir el texto de cumplimiento para que no afirme lo que no ocurre; enseñar al guardián a distinguir «importado» de «usado» | `src/app/(dashboard)/consulta/[patientId]/page.tsx:154` · `cumplimiento/motores/page.tsx:93` | MI-003 | P2 | confirmado |
| Campos de glucosa capilar, Glasgow y escala de dolor | Existen en `SignosVitales` y el resumen del expediente los **lee** (`ResumenPaciente.tsx:98`), FHIR los exporta; **ningún campo los captura** (el bloque de signos tiene siete: ta, fc, fr, temperatura, spo2, peso, talla). La glucometría de la enfermera va a texto libre sin validar | Campo «Glucosa capilar (mg/dL)» en el bloque de signos con compuerta de plausibilidad (límites: `NEEDS_CLINICAL_REVIEW`); o retirar `glucometria` del tipo si va a laboratorios | `src/types/expediente.ts:212` · `consulta/[patientId]/page.tsx:6727` | ASN-013 | P2 | confirmado |
| «Entregar al paciente»: «Sin signos de alarma: no se inventan. Si quieres que los lea, escríbelos en tus indicaciones» | Las indicaciones **nunca entran al paquete**: `componerPaquete` fija `warningSigns: []` y la ruta no le pasa ninguna indicación. El médico escribe donde el dato no sale. Duplicado de MG-015/PG-002 | El paquete incluye las indicaciones literales del médico (nivel 3 del §1, sin reescribir) o se quita la frase que lo promete | `src/components/EntregarAlPaciente.tsx:257` · `src/lib/paciente/paquete-de-visita.ts:344` | PO-004 · MG-015 | P2 | confirmado (los dos) |
| Hoja para el paciente (`HojaParaElPaciente`) | La consulta no le pasa `indicacionesDelMedico`: **cero llamadores** en `app/` y `components/`. El motor sí lo pintaría (`como-se-lo-explico.ts:155`). Las indicaciones postoperatorias (herida, drenajes, alarma) no llegan a la hoja ni al portal | Pasar a la hoja el texto literal de las secciones de plan del tipo activo como `indicacionesDelMedico`, por clave de template, sin heurística | `src/app/(dashboard)/consulta/[patientId]/page.tsx:6544` · `src/lib/paciente/como-se-lo-explico.ts:59,155` | MC-002 | P2 | confirmado |
| «Iniciar consulta» desde la agenda | Abre `/consulta/<id>` sin `?nota=`; la pantalla lee memoria y `localStorage` y **nunca consulta el servidor** (`:3477-3491`): los signos que la enfermera guardó en otro equipo no están delante del médico. El rojo refuta la consecuencia «crea una segunda nota» (la clave `cita:<id>` lo impide) | Sin `?nota=`, preguntar al servidor si hay nota no firmada de ese paciente (PatientAnchor ya tiene la regla) y adoptarla u ofrecerla; que «Iniciar consulta» lleve `?nota=` cuando exista | `src/app/(dashboard)/consulta/[patientId]/page.tsx:3477` · `citas/page.tsx:774` | ASN-003 | P2 | parcial |
| Columna `lactancia` de `EMBARAZO_LACTANCIA` | Escrita en la tabla y **nadie la lee**: `riesgoGestacional` sólo consulta `x.embarazo`; `revisarFarmaco` (que sí la devuelve) no tiene llamador. Sub-caso de MG-001 (no hay estado de lactancia que leer) y la tabla está `pendiente_validacion` | Estado de lactancia en la fuente de MG-001 y una rama que lea `x.lactancia`. Fármacos y categorías: `NEEDS_CLINICAL_REVIEW` | `src/lib/expediente/copiloto.ts:488` · `prescripcion-segura.ts:287-303` | MG-003 | P2 | confirmado |
| Eje hepático del copiloto | Sólo `riesgo === 'evitar'` produce sugerencia: 4 de las 9 entradas (`ajustar`/`vigilar`: tope de paracetamol en cirrosis, opioides) **no llegan nunca** a la consulta ni a la receta. Simétrico a lo que ya se corrigió en el eje renal | Recorrer también `ajustar` y `vigilar` con nivel menor (la escala ya tiene `DOSE_ADJUST`/`MONITOR`) y llevar el eje hepático a la receta como el renal. Sin tocar cifras | `src/lib/expediente/copiloto.ts:685` | MI-010 | P2 | confirmado |
| Firma de nota postoperatoria / valoración preoperatoria | `requiereDx` no las incluye: se firman sin diagnóstico estructurado y el dx **no llega** a CIE-10, FHIR (`Condition` sólo desde `diagnosticos[]`) ni a la carta de referencia (`referencia:89` prellena desde `nota.diagnosticos`) | Incluirlas en `requiereDx` o aviso de nivel alto antes de firmar; tipo de documento FHIR por `nota.tipo` (LOINC: `NEEDS_CLINICAL_REVIEW`) | `src/lib/expediente/nom004.ts:29` · `fhir-export.ts:216,318-322` | MC-010 | P2 | confirmado |

### `/orden/[patientId]/[notaId]`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Emitir la orden (imprimir / PDF / Word) | La única escritura es abrir pendientes; **no persiste** la lista en la nota (grep `updateNota\|setDoc` en la pantalla = 0). Al reabrir, la orden está vacía; el expediente no dice qué se pidió; la hoja del paciente lista cero estudios. El propio comentario `L347-351` lo confiesa. El rojo baja a P2: sí queda tarea `estudio_pendiente` y evento de auditoría con folio | Al emitir, persistir la lista como orden emitida versionada (adenda si la nota está firmada, para no romper el sello v3) o como entidad Orden con folio; que el paquete del paciente y FHIR lean de ahí | `src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx:358` · `:417` · `:609` | MO-005 | P2 | confirmado |

### `/referencia/[patientId]`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Carta de referencia: «Imprimir» / «PDF» | **No se guarda en ninguna parte**: sin colección, sin `logAudit`, sin línea de tiempo. Se imprime y desaparece. Grep de `referencia\|interconsulta\|derivaci` en `lib/` y `api/`: ninguna colección ni evento | Persistirla como documento del expediente (colección declarada en los TRES sitios: rules con `hasOnly`, matriz, respaldo), con auditoría y línea de tiempo; prellenar estudios desde `estudiosOrden`; firmar con `useFirmaProtegida` | `src/app/(dashboard)/referencia/[patientId]/page.tsx:35` · `:46-61` · `:141` | MC-004 | **P1** | confirmado |

### `/citas` (recordatorios) y `/configuracion › Entregas`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Recordatorio automático que falla | Sólo suma `totals.failed`: la cita **no se marca** y el cron **no escribe** `whatsapp_no_entregados` (no importa `registrarNoEntregado`). Y esa colección —respaldada y en la matriz— **no la lee ninguna pantalla** | Marcar en la cita `recordatorio24hFallo: { at, motivo }` y pintar en `/citas` «recordatorio no entregado» con «Llamar»; lista «Mensajes que no salieron» en Operaciones o en Entregas | `src/app/api/cron/reminders/route.ts:353` · `:371` | ASM-007 | P2 | confirmado |

### `/finanzas`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Reembolso en Stripe de un anticipo de paciente (`charge.refunded`) | Busca la clínica por `stripeCustomerId`, que un Checkout de anticipo no tiene, y escribe en `platform_payments` con `huerfano: true`. **Nunca llega** a `clinics/*/cobros` ni a la cita: el cobro sigue vivo y la cita «pagada». El rojo: probabilidad baja, P2 | Si la sesión tiene metadata `tipo: 'paciente_anticipo'`, escribir en `cobros` un documento `tipo: 'REFUND'` con `cobroOriginalId` y liberar `cita.cobroId`. Primera pieza del REFUND tipado (REG-015) | `src/app/api/stripe/webhook/route.ts:677` · `:690-692` · `payment/create-checkout:103-116` | ASC-005 | P2 | confirmado |

### `/precios`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| «Precio fundador — los primeros 50 médicos congelan su tarifa de por vida. Aplica tu código FUNDADOR al pagar» | **No existe en el código**: ni contador de 50, ni comprobación de plazas, ni campo que congele la tarifa cuando el catálogo suba (`/precios` revalida cada 60 s). El único apoyo es `allow_promotion_codes: true`. Si el cupón no está en Stripe, lo rechaza con el médico ya en la pantalla de pago | Tres piezas o retirar la frase: contador real (`platform_config/fundadores`, tope 50) que apaga el bloque al agotarse; `tarifaCongelada: { plan, precioMXN, desde }` en la clínica respetado por `catalogoEfectivo`; cupón verificado | `src/app/precios/page.tsx:193` · `(dashboard)/layout.tsx:496` · `api/stripe/checkout/route.ts:137` | N-004 | **P1** | confirmado |

### `/reservar/[clinicId]`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Paso «¿Qué tipo de consulta deseas?» | Con `tiposCita: []` y `publicBookingEnabled: true` pinta la pregunta **sin un solo botón ni explicación**: callejón sin salida; el único control de la página es el tema. Cuatro auditores lo vieron (PG-007, PI-005, PO-006, PP-012); PC-007 añade el loader sin tope de tiempo. El rojo baja PC-007 a P3 porque un consultorio creado por el camino normal nace con ocho tipos (`DEFAULT_CONFIG.duraciones`); lo que sí llega a producción es la **asimetría** de la ruta pública: reserva encendida por omisión, tipos vacíos por omisión | Estado vacío honesto («Este consultorio todavía no abrió su agenda en línea; llama al …») con teléfono; no permitir `publicBookingEnabled` sin al menos un tipo con duración > 0; aviso al médico en Configuración; timeout con mensaje en el loader | `src/app/reservar/[clinicId]/page.tsx:203` · `:151` · `:157` · `api/public/clinic/[clinicId]/route.ts:83` | PG-007 · PI-005 · PC-007 | P2 (PC-007: P3) | confirmado |

### `/privacidad/[clinicId]` (portal ARCO del paciente)

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| Botón «Cerrar» tras enviar la solicitud | `window.close()`: sólo cierra ventanas abiertas por script; el paciente llega por enlace copiado, así que **no hace nada**. Cosmético: el folio (`:107`) es el cierre real | Enlace al aviso de privacidad o a `/dr/{clinicId}`, o quitar el botón y dejar el folio como cierre | `src/app/privacidad/[clinicId]/page.tsx:114` | C-005 | P3 | confirmado |
| Botón «Enviar solicitud» deshabilitado desde el primer render | Lector de pantalla: «Enviar solicitud, no disponible» sin `aria-describedby` ni texto de por qué. Los campos sí llevan `<label>` y asterisco (REG-331). Mismo patrón que C-027 | Botón siempre activo que valide y anuncie el campo faltante con `role=alert`, o «Faltan nombre y teléfono» junto al botón | `src/app/privacidad/[clinicId]/page.tsx:234` | PI-023 | P3 | confirmado |

### `/expediente/[patientId]`

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| `esHospitalaria` exportada en `templates.ts` | Dice que `nota_postoperatoria` y `nota_anestesia` son hospitalarias; **ninguna pantalla la usa**. El expediente responde con su **propia copia** (`page.tsx:63`) que dice lo contrario. Dos respuestas a la misma pregunta, una muerta | Una sola `esHospitalaria(nota)` en `templates.ts` con la regla del expediente, consumida por la pantalla; borrar la copia local | `src/lib/expediente/templates.ts:195` · `expediente/[patientId]/page.tsx:63` | MC-020 | P3 | confirmado |

### Sin pantalla (registro de motores)

| Control | Qué hace hoy | Qué debería hacer | archivo:línea | id | Prioridad | Veredicto |
|---|---|---|---|---|---|---|
| `entryPoints: ['revisarFarmaco', 'ajustePorTFG', 'revisarListaRenal', 'estadioERC']` del motor de prescripción segura | `revisarFarmaco` y `estadioERC`: **cero llamadores** de producción; `revisarListaRenal` sólo en un comentario. Sólo corre `ajustePorTFG`. El rojo refuta la parte cara («el copiloto reimplementa el emparejador con otras reglas»): reutiliza `coincideRenal`/`coincideHepatico`; el registro miente, no el copiloto | Aserción en el guardián del registro: cada `entryPoint` declarado tiene al menos un llamador fuera de su archivo y de las pruebas, o está en una lista de excepciones con su razón (patrón `HUERFANOS_ACEPTADOS`). Ver MI-012 en `13-`: conectar `estadioERC`, retirar los otros dos del registro | `src/lib/clinical/registry.ts:1733` · `prescripcion-segura.ts:306` | A-002 | P2 | parcial |

---

## Se propuso y no procede (refutados por el equipo rojo)

Que nadie lo repare. La columna «motivo» resume la refutación con su `archivo:línea`.

| id | Se propuso | Motivo del equipo rojo | Prioridad final |
|---|---|---|---|
| A-004 | Que el guardián de «escrito y sin conectar» dejara de exentar los `index` porque `voice-engine/index.ts` (385 líneas) es una isla que nadie declara | Falso: el **segundo** guardián, `el-camino-del-medico-llega-entero.test.ts:39`, lo declara por nombre con su razón y trinquete `FUERA_DEL_CAMINO_HOY = 33`. El auditor sólo miró un guardián de los dos | P3 |
| A-012 | Que el guardián de huérfanos pasara de «nadie me importa» a alcanzabilidad transitiva, porque las islas de dos archivos le pasan por debajo | Ese guardián **ya existe**: `alcanzableDesdeLaApp()` (`grafo-de-dependencias.ts:326`) con lista de islas declaradas y aserción doble (`:111`). Los 11 archivos «no declarados» están todos declarados en `el-camino-del-medico-llega-entero.test.ts:30-39` | P3 |
| B-014 | Que UCI y hospitalización aportaran al vocabulario aprendido, porque sólo la consulta llama `acumular(` | Premisa falsa: el pase de UCI **no se firma en UCI** (`uci/page.tsx:872` → `router.push('/consulta?tipo=evolucion_uci')`); la nota se guarda con `transcripcionMotor` y entra al corpus. Un solo `acumular(` significa «una pantalla firma», no «una pantalla aprende» | P3 |
| MG-016 | Conectar el chip «Embarazo» del resumen fijo móvil y el checklist de cierre (`resumenFijo`, `checklistCierre`: cero llamadores) | El hecho es cierto pero **no es un botón**: nada se renderiza ni promete nada al médico, y el aplazamiento está escrito en el propio archivo (`consulta-cierre.ts:11-12`) y en la bitácora móvil. Sobrevive como candidato en `13-` (D-012) | P3 |
| C-029 | Enlazar `/motores` desde `/cumplimiento/motores` y mapearla en `contextos.ts` (mismo hecho que D-009, arriba) | Está desenlazada **a propósito**: REG-292 («al cliente le importan lo funcional… eso escóndelo»), con guardián que comprueba que ninguna superficie del cliente la ofrezca (`lo-que-hace-si-como-lo-hace-no.test.ts:65-79`) y otro que exige que la página exista (`:108-117`). Implementar la propuesta pondría el CI en rojo | P3 |
| PP-004 | Que «Avisamos al consultorio de que usted escribió» dependiera de si hubo aviso, porque sin teléfono «no se avisa a nadie» | Falso por la regla 5 del briefing: el auditor citó `route.ts:930` (la línea de la que nació REG-521) y no las 14 líneas de arriba (`:905-919`) que ya abren una `TareaClinica` crítica **sin** depender del teléfono, que `/pendientes` lista. Queda P3 informativo: «Avisamos» sugiere una llamada que no ocurre (ver PI-014 en `12-`) | P3 |
| MP-001 | Derivar la edad una vez en la consulta porque `esPediatrico` usa `patient.edad` congelado y un niño sin edad no tiene panel pediátrico | Falso: `patient` es el que devuelve `conLaEdadAlDia(p)` (`page.tsx:353`, `:1967`), que sustituye `edad` por la derivada de `fechaNacimiento`. Sólo queda el caso sin fecha **y** sin edad, donde la consulta no pinta el aviso ámbar que sí tiene la receta: P3 y no lo que decía el título | P3 |

---

## Conteo por pantalla

Sólo confirmados y parciales (los 7 refutados no cuentan). Un id con dos pantallas cuenta en las dos.

| Pantalla | Hallazgos | ids | P1 | P2 | P3 |
|---|---|---|---|---|---|
| `/consulta/[patientId]` | 9 | MI-003, ASN-013, PO-004, MG-015, MC-002, ASN-003, MG-003, MI-010, MC-010 | 0 | 9 | 0 |
| `/configuracion` | 6 | C-001, C-002, ASM-016, C-003, ASN-004, C-027 (parte) | 0 | 2 | 4 |
| `/migracion` | 4 | ASE-008, ASE-019, A-013, ASE-005 | 0 | 2 | 2 |
| `/reservar/[clinicId]` | 3 | PG-007, PI-005, PC-007 | 0 | 2 | 1 |
| `/operaciones` | 2 | N-012, N-013 | 0 | 0 | 2 |
| `/privacidad/[clinicId]` | 2 | C-005, PI-023 | 0 | 0 | 2 |
| `/cumplimiento` | 1 | ASE-011 | 0 | 1 | 0 |
| `/login` | 1 | ASE-014 | 0 | 1 | 0 |
| `/membresias` (+finanzas, unidades) | 1 | C-027 | 0 | 0 | 1 |
| `/motores` | 1 | D-009 | 0 | 0 | 1 |
| `/pendientes` | 1 | ASN-009 | 0 | 1 | 0 |
| `/orden/[patientId]/[notaId]` | 1 | MO-005 | 0 | 1 | 0 |
| `/referencia/[patientId]` | 1 | MC-004 | **1** | 0 | 0 |
| `/citas` (recordatorios) | 1 | ASM-007 | 0 | 1 | 0 |
| `/finanzas` | 1 | ASC-005 | 0 | 1 | 0 |
| `/precios` | 1 | N-004 | **1** | 0 | 0 |
| `/expediente/[patientId]` | 1 | MC-020 | 0 | 0 | 1 |
| Sin pantalla (registro) | 1 | A-002 | 0 | 1 | 0 |
| **Total** | **38 filas · 36 ids distintos** | | **2** | **23** | **14** |

Los dos P1 son los que un médico ve todos los días: la carta de referencia que se imprime y desaparece (MC-004) y una promesa comercial pública sin nada detrás (N-004).

Patrón que se repite (5 de 36): **campo de configuración que se guarda y nadie lee** — C-001, C-002/ASM-016, C-003, más C-004 en `13-`. Cabe un solo guardián: todo campo escrito por `saveConfig` tiene un lector fuera de `configuracion/` y `types/`, o está en una lista de excepciones con su razón.
