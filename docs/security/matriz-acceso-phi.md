# Matriz de acceso a PHI — NexusMED

> **ARCHIVO GENERADO — no editar a mano.** Sale de `matrizComoMarkdown()` en
> `src/lib/authz/matriz-acceso.ts`. `src/__tests__/matriz-acceso.test.ts` falla
> si este archivo y la matriz divergen.
>
> Unidad Nexus OS **E0-06** — separación de PHI administrativo vs clínico.

## Guardas y roles

| Guarda | Roles que la satisfacen |
|---|---|
| `isMember` | admin, medico, secretaria, recepcion, facturacion, enfermeria, farmacia, laboratorio |
| `isMedico` | medico, admin |
| `isClinicoHospital` | medico, admin, enfermeria, farmacia, laboratorio |
| `isLabStaff` | medico, admin, laboratorio |
| `isAdmin` | admin |
| `servidor` | _ninguno desde el cliente_ |
| `publico` | admin, medico, secretaria, recepcion, facturacion, enfermeria, farmacia, laboratorio |

**Roles SIN acceso clínico:** secretaria, recepcion, facturacion.

`recepcion` y `facturacion` todavía no son asignables en `clinic_members.role`:
en producción «recepción» es `secretaria`. Se evalúan igual para que el día que
se activen no entren por una puerta abierta.

## Recursos

| Ruta | Clase | Lectura | Escritura | Por qué |
|---|---|---|---|---|
| `clinics/{clinicId}` | Plataforma | `isMember` | `isAdmin` | Metadatos del consultorio. Los campos de facturación/entitlement están congelados por campo: solo el servidor los cambia. |
| `clinics/{clinicId}/appointments/{docId}` | Administrativo | `isMember` | `isMember` | La agenda es el trabajo de recepción. RESIDUAL ACEPTADO (D4): `motivo` es dato de salud y viaja aquí; la aceptación de E0-06 exige explícitamente que recepción lea la cita. |
| `clinics/{clinicId}/patients/{docId}` | Administrativo | `isMember` | `isMember` | Directorio del paciente (nombre, teléfono, CURP, seguro): recepción lo necesita para agendar. PENDIENTE Fase B/C: hoy este documento TODAVÍA contiene los campos clínicos de CAMPOS_CLINICOS_PACIENTE, que deben mudarse a la subcolección `clinico`. |
| `clinics/{clinicId}/patients/{docId}/notas/{notaId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Expediente clínico electrónico. Secreto médico (NOM-004). Las notas firmadas son inmutables (NOM-024). |
| `clinics/{clinicId}/patients/{docId}/notas/{notaId}/versions/{versionId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Trazabilidad de cambios del borrador (NOM-024 Art. 6.4). Inmutables una vez creadas. |
| `clinics/{clinicId}/patients/{docId}/notas/{notaId}/adendas/{adendaId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Corrección a una nota ya firmada sin alterar el original (NOM-004). Se agregan, nunca se editan ni se borran. |
| `clinics/{clinicId}/patients/{docId}/formularios_previos/{docId}` | CLÍNICO (secreto médico) | `isMedico` | `servidor` | Lo que el paciente cuenta antes de la consulta (P-019): motivo, medicamentos, alergias y antecedentes. Es secreto médico, así que lo lee quien lee las notas — NO recepción ni facturación. Lo escribe /api/portal tras validar el token: el enlace del paciente no es sesión de Firebase, y si él pudiera escribir directo podría hacerlo sobre el expediente de otro paciente de la misma clínica. |
| `clinics/{clinicId}/patients/{docId}/laboratorios/{labId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Valores de laboratorio del paciente. Mismo secreto médico que las notas. |
| `clinics/{clinicId}/patients/{docId}/fotos/{fotoId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Fotografía clínica seriada. Dato personal sensible; se permite borrar (una toma sin consentimiento debe poder eliminarse). |
| `clinics/{clinicId}/patients/{docId}/clinico/{clinicoId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | E0-06: alergias, antecedentes y valoración del inmunocomprometido. Viven FUERA del documento del paciente porque Firestore no autoriza por campo — mientras sean campos de `patients/{id}` (que es `isMember`), recepción los lee y ninguna regla puede impedirlo. |
| `clinics/{clinicId}/waitlist/{docId}` | Administrativo | `isMember` | `isMember` | Lista de espera de la agenda. Trabajo de recepción. |
| `clinics/{clinicId}/internamientos/{intId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `servidor` | Episodio hospitalario (diagnósticos, indicaciones, MAR). Se lee todo el staff clínico; se escribe SOLO por /api/hospital/mutar, que valida el rol por acción. |
| `clinics/{clinicId}/internamientos/{intId}/signos/{signoId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `isClinicoHospital` | Signos vitales seriados. Enfermeria y medicos AÑADEN; corregir es anexar otro documento con `corrigeA`, nunca editar (decision del 29-jul-2026). El `update` abierto —la pregunta E0-09-Q5— se cierra con la MISMA forma ya aceptada para icu_observations: solo puede tocar `estadoObservacion`, asi que una toma se marca como corregida pero sus MEDIDAS son inmutables. Nadie borra desde el cliente. |
| `clinics/{clinicId}/internamientos/{intId}/icu_stays/{stayId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `servidor` | Estancia en UCI dentro del episodio: soportes activos, peso de dosificacion, codigo de reanimacion, aislamiento. Se lee todo el staff clinico; se escribe SOLO por el servidor, que valida el rol por accion — igual que el doc de internamiento. |
| `clinics/{clinicId}/internamientos/{intId}/icu_observations/{obsId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `isClinicoHospital` | Tomas de UCI capturadas a pie de cama (ICU-003). El cliente SI crea, igual que en signos: obligarlas a pasar por el servidor anadiria latencia en el momento en que el dato se esta tomando. El APPEND-ONLY se hace cumplir en la REGLA — el update solo puede tocar `estado`, asi que una toma se marca como corregida pero sus MEDIDAS son inmutables. Borrar esta cerrado. |
| `clinics/{clinicId}/internamientos/{intId}/handoff_revisiones/{diaId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `isClinicoHospital` | Quién revisó la entrega de turno y cuándo (charter §36: «siempre revisado por médico»). Es un acto del médico que entrega, no del sistema, así que lo firma su sesión. No se edita ni se borra: es justo lo que se consulta cuando algo se pasó en el cambio de turno. |
| `clinics/{clinicId}/internamientos/{intId}/bed_assignments/{asigId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `servidor` | Asignacion de cama APPEND-ONLY. El delete esta cerrado a proposito: borrar una asignacion destruiria la trazabilidad de quien ocupo que cama y cuando, que es justo lo que esta coleccion vino a crear. Cerrar una asignacion es un update del servidor (poner `hasta`), nunca un borrado. |
| `clinics/{clinicId}/hospital_roles/{uid}` | Plataforma | `isClinicoHospital` | `isMedico` | Rol hospitalario por usuario. La escritura NO puede ser de todo el staff: sería auto-escalada de privilegios. |
| `clinics/{clinicId}/tareas_clinicas/{tareaId}` | CLÍNICO (secreto médico) | `isMedico` | `isMedico` | Los cabos sueltos de la consulta: estudios pedidos, resultados por revisar, seguimientos. El título de una tarea es «Perfil tiroideo» junto al nombre del paciente — información clínica, así que la asistente no entra, igual que en las notas. No se borran: la constancia de que algo se dejó de hacer es justo lo que hace falta si un día se revisa el caso. |
| `clinics/{clinicId}/whatsapp_no_entregados/{envioId}` | Administrativo | `isMember` | `servidor` | Mensajes de WhatsApp que no salieron (confirmaciones del bot y del portal). Los lee todo el equipo porque el seguimiento es trabajo del mostrador: hay que llamar por teléfono. Sólo los escribe el servidor y no se borran: un fallo de entrega que se puede hacer desaparecer no sirve para nada. Guarda los últimos 4 dígitos del teléfono y las primeras palabras del mensaje, no el texto completo. |
| `clinics/{clinicId}/alertas_no_entregadas/{alertaId}` | CLÍNICO (secreto médico) | `isMedico` | `servidor` | Alertas críticas (lab crítico, NEWS2, interconsulta) que NO llegaron. Las escribe sólo el servidor; desde el navegador se leen y nada más. Poder borrarlas convertiría «no llegó la alerta» en algo que se puede hacer desaparecer, que es justo lo que hay que poder revisar después. |
| `clinics/{clinicId}/laboratorio/{ordenId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `isClinicoHospital` | Solicitudes y resultados de laboratorio. Cualquier clínico SOLICITA (create); cargar/corregir un resultado y borrar la orden es de isLabStaff. |
| `clinics/{clinicId}/hospital_alertas/{alertaId}` | CLÍNICO (secreto médico) | `isClinicoHospital` | `isClinicoHospital` | Alertas de lab crítico / NEWS2 / interconsulta. Se crean y se resuelven, no se borran: una alerta crítica no debe poder desaparecer. |
| `clinics/{clinicId}/camas/{camaId}` | Administrativo | `isClinicoHospital` | `isMedico` | Inventario y ocupación de camas. No es PHI, pero el censo revela quién está internado: se restringe al staff clínico igual que el módulo. |
| `clinics/{clinicId}/unidades/{unidadId}` | Administrativo | `isClinicoHospital` | `isMedico` | Unidades del hospital con su TIPO. Mismos permisos que camas: es inventario, no PHI. La escritura es de médico/admin porque marcar una unidad como «cuidados críticos» cambia el comportamiento clínico de la aplicación — de eso depende en qué pantalla aparece cada paciente. |
| `clinics/{clinicId}/config/firma` | Identidad profesional | `isMedico` | `isMedico` | REG-014. La firma y el sello viven en su propio documento: quien pueda escribirlos puede emitir recetas a nombre del médico, incluidas las de controlados. |
| `clinics/{clinicId}/dosing_validations/{farmacoId}` | Identidad profesional | `isMember` | `isMedico` | La firma con la que un MEDICO declara que coteje una regla de dosificacion contra su fuente. Lectura para todo el consultorio (farmacia y enfermeria necesitan saber que esta validado y que no); escritura solo de medico, porque validar una dosis es un acto clinico y lleva nombre. Se permite delete a proposito: un medico tiene que poder retirar una validacion equivocada, y dejarla puesta por no poder deshacerla seria peor. |
| `clinics/{clinicId}/antimicrobial_limits/{limiteId}` | Identidad profesional | `isMember` | `isMedico` | Topes de dosis antimicrobiana con su fuente. Los lee el equipo porque la alerta se le enseña a quien prescribe; solo un medico los escribe. |
| `clinics/{clinicId}/config/{docId}` | Administrativo | `isMember` | `isMember` | Horarios, duraciones y sucursales: recepción los necesita. La escritura es de isMember pero BLOQUEADA POR CAMPO sobre firma/cédula/especialidad, y el documento `config/firma` queda excluido de la lectura genérica. |
| `clinics/{clinicId}/doctors/{docId}` | Identidad profesional | `isMember` | `isMedico` | Alta/baja de médicos y su cédula. Se publica en el perfil público, así que recepción no debe poder dar de alta a un médico inexistente. |
| `clinics/{clinicId}/bot_sessions/{docId}` | Administrativo | `servidor` | `servidor` | Estado conversacional del bot de WhatsApp. Solo Admin SDK. |
| `clinics/{clinicId}/whatsapp_optout/{telefono}` | Administrativo | `isMember` | `servidor` | Bajas de WhatsApp. El equipo las LEE para no volver a contactar a quien pidió baja; solo el bot (servidor) las escribe. |
| `clinics/{clinicId}/secretos/{docId}` | Plataforma | `servidor` | `servidor` | API keys de IA del consultorio. Nunca accesibles desde el cliente. |
| `clinics/{clinicId}/audit_log/{docId}` | CLÍNICO (secreto médico) | `isMedico` | `servidor` | No contiene notas, pero sí patientId/notaId: revela a QUIÉN se atendió y cuándo, que es dato de salud inferido. La escribe solo /api/auditoria/registrar; una bitácora forjable por el auditado no acredita nada. |
| `clinics/{clinicId}/arco_requests/{docId}` | Administrativo | `isMember` | `publico` | Solicitudes ARCO (LFPDPPP). El paciente las crea desde el portal público con campos acotados; el equipo las resuelve. Nunca se borran (registro legal). |
| `clinics/{clinicId}/notification_logs/{docId}` | Administrativo | `isMember` | `isMember` | Bitácora de recordatorios enviados. Append-only. |
| `clinics/{clinicId}/branches/{branchId}` | Administrativo | `isMember` | `isMember` | Sucursales/sedes. Necesarias para agendar. |
| `clinics/{clinicId}/time_blocks/{blockId}` | Administrativo | `isMember` | `isMember` | Bloqueos de horario (vacaciones, ausencias). Trabajo de recepción. |
| `clinics/{clinicId}/farmacia/{itemId}` | Administrativo | `isClinicoHospital` | `isClinicoHospital` | Inventario de farmacia interna. No es PHI de un paciente, pero el manejo de medicamentos —incluidos controlados— no es de recepción/facturación. |
| `clinics/{clinicId}/membership_plans/{planId}` | Financiero | `isMember` | `isMember` | Catálogo de planes de membresía. El cobro real pasa por `cobros`, con sus propias reglas anti-fraude. |
| `clinics/{clinicId}/memberships/{membershipId}` | Financiero | `isMember` | `isMember` | Asignación de plan a paciente. Administrativo-financiero, sin contenido clínico. |
| `clinics/{clinicId}/learning/{uid}` | Plataforma | `isMember` | `isMember` | Preferencias de sugerencias POR MÉDICO. No son datos del paciente, pero se aíslan por autor (uid == el propio uid). |
| `clinics/{clinicId}/farmacia_movimientos/{movId}` | Administrativo | `isClinicoHospital` | `isClinicoHospital` | Movimientos de farmacia, inmutables. El autor lo sella la regla (realizadoPor == uid): el registro de controlados debe acreditar quién dispensó. |
| `clinics/{clinicId}/cobros/{cobroId}` | Financiero | `isMember` | `isMember` | REG-015. Registro contable: no se edita ni se borra, solo se ANULA con autor, fecha y motivo. El autor se valida contra el uid real. |
| `clinics/{clinicId}/reviews/{reviewId}` | Administrativo | `publico` | `isMember` | Solo lo PUBLICADO es público; las pendientes y rechazadas solo las ve la clínica. Crear es exclusivo del servidor (/api/public/resena). |
| `clinics/{clinicId}/chat/{msgId}` | Administrativo | `isMember` | `isMember` | Chat interno médico↔asistente, mensajes inmutables. RESIDUAL ACEPTADO: el texto libre puede contener referencias clínicas; el canal existe precisamente para que médico y asistente se coordinen. |
| `clinics/{clinicId}/chat_reads/{uid}` | Plataforma | `isMember` | `isMember` | Marca de leído por usuario. Cada quien solo toca la suya. |
| `clinic_review_requests/{token}` | Administrativo | `publico` | `publico` | GET por token, LIST cerrado: con `read` abierto se podía enumerar nombre de paciente + médico de TODAS las clínicas (dato de salud inferido) y robar los tokens. El paciente solo puede marcarla usada (hasOnly). |
| `clinic_invitations/{code}` | Plataforma | `publico` | `isMedico` | GET por código aleatorio para que el invitado sin cuenta la vea; LIST cerrado. Solo médico/admin invita, y para invitar `admin` hay que ser admin. |
| `clinic_members/{uid}` | Plataforma | `isMember` | `isAdmin` | La membresía ES el rol: quien la escriba se auto-asigna privilegios. LIST cerrado (el equipo se sirve por Admin SDK) y el clinicId es inmutable. |
| `googleTokens/{uid}` | Plataforma | `servidor` | `servidor` | Access/refresh tokens de Google = credencial persistente. Deny total cierra el robo por XSS. |
| `platform_cost_ledger/{eventoId}` | Financiero | `servidor` | `servidor` | Libro de costos de IA. No lleva PHI, pero enseña el gasto de todos los consultorios: se lee sólo por API del dueño. |
| `platform_payments/{payId}` | Financiero | `servidor` | `servidor` | Facturación de la PLATAFORMA (nivel dueño). Solo el webhook de Stripe y /superadmin vía API. |
| `platform_admin_log/{logId}` | Plataforma | `servidor` | `servidor` | Bitácora de acciones del dueño. Nunca desde el cliente. |
| `platform_packages/{pkgId}` | Plataforma | `servidor` | `servidor` | Paquetes de módulos y precio. Los define el dueño desde /superadmin. |
| `platform_meta/{docId}` | Plataforma | `servidor` | `servidor` | Metadatos de la plataforma. Solo Admin SDK. |
| `{document=**}` | Plataforma | `servidor` | `servidor` | DEFAULT-DENY. Todo lo que no esté declarado arriba queda cerrado al cliente. |

## Invariante que verifica el test

Ningún recurso de clase **CLÍNICO** puede quedar bajo una guarda cuyo conjunto
de roles incluya a un rol sin acceso clínico. Firestore **no autoriza por**
**campo**: si un dato clínico vive dentro de un documento que recepción puede
leer, ninguna regla lo protege — hay que moverlo de documento.
