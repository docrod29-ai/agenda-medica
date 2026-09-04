/**
 * MATRIZ DE ACCESO — quién puede leer y escribir qué (unidad Nexus OS E0-06).
 *
 * Por qué existe este archivo y no un documento en prosa: la separación entre PHI
 * administrativo y PHI clínico ya estaba IMPLEMENTADA en `firestore.rules`, pero
 * dispersa en 44 bloques `match` y sin ningún sitio donde se pudiera comprobar de
 * una sola vez. La consecuencia práctica: nadie podía responder «¿la recepción lee
 * las alergias?» sin leer 658 líneas de reglas, y la respuesta era que SÍ.
 *
 * Aquí la matriz es un DATO, no una tabla en un .md que se queda vieja:
 *  - `matriz-acceso.test.ts` verifica que cada guarda nombrada existe de verdad
 *    como `function <nombre>(` en `firestore.rules`,
 *  - que cada `match` de `firestore.rules` tiene entrada aquí (nadie añade una
 *    colección sin clasificarla),
 *  - que ningún recurso de clase `clinico` queda bajo una guarda que admita a un
 *    rol no clínico,
 *  - y que `docs/security/matriz-acceso-phi.md` es exactamente lo que genera
 *    `matrizComoMarkdown()`.
 *
 * MÓDULO PURO: sin imports de Firebase, sin red, sin PHI. Es una declaración.
 * La autorización REAL la siguen haciendo las reglas y las rutas de API; esto es
 * el espejo comprobable de esa autorización.
 */

/**
 * Roles del sistema. Ojo con la diferencia entre lo asignable y lo declarado:
 * `clinic_members.role` (src/types/index.ts) solo admite
 * admin|medico|secretaria|enfermeria|farmacia|laboratorio, así que en producción
 * «recepción» es hoy `secretaria`. `recepcion` y `facturacion` solo existen en
 * `src/lib/permissions.ts`. Se incluyen igual: la aceptación de E0-06 habla de
 * «rol recepción», y una matriz que no lo evalúe pasaría en verde probando un rol
 * que nadie tiene.
 */
export const ROLES = [
  'admin', 'medico', 'secretaria', 'recepcion', 'facturacion',
  'enfermeria', 'farmacia', 'laboratorio',
] as const
export type Rol = (typeof ROLES)[number]

/** Qué clase de dato guarda el recurso. Determina qué guarda le corresponde. */
export type ClasePHI =
  | 'administrativo'          // identifica y contacta, no revela salud
  | 'clinico'                 // secreto médico (NOM-004 · dato sensible LFPDPPP)
  | 'financiero'              // cobros, planes, facturación
  | 'identidad_profesional'   // firma, cédula — falsificable, no es PHI del paciente
  | 'plataforma'              // membresías, secretos, config de la plataforma

/**
 * Nombre LITERAL de la guarda en `firestore.rules`, más dos pseudo-guardas:
 *  - `servidor`: la regla es `if false` → solo Admin SDK (el cliente nunca).
 *  - `publico`: accesible sin sesión (get por id/token opaco).
 */
export type Guarda =
  | 'isMember' | 'isMedico' | 'isClinicoHospital' | 'isLabStaff' | 'isAdmin'
  | 'servidor' | 'publico'

/** Guardas que DEBEN existir como función en firestore.rules (las otras dos no lo son). */
export const GUARDAS_EN_REGLAS: readonly Guarda[] = [
  'isMember', 'isMedico', 'isClinicoHospital', 'isLabStaff', 'isAdmin',
]

/**
 * Roles que satisfacen cada guarda. DERIVADO de firestore.rules, no inventado:
 * cada lista es la transcripción del `role ==` / `role in [...]` de la función
 * correspondiente. Si alguien afloja una guarda en las reglas y no toca esto, el
 * test de coherencia no lo caza — por eso el test también compara los nombres de
 * rol que aparecen DENTRO de cada función con esta tabla.
 */
const ROLES_POR_GUARDA: Record<Guarda, readonly Rol[]> = {
  // isMember = pertenecer a la clínica: CUALQUIER rol la satisface.
  isMember: ROLES,
  isMedico: ['medico', 'admin'],
  isClinicoHospital: ['medico', 'admin', 'enfermeria', 'farmacia', 'laboratorio'],
  isLabStaff: ['medico', 'admin', 'laboratorio'],
  isAdmin: ['admin'],
  // `if false` desde el cliente: ningún rol del SDK. El Admin SDK ignora reglas.
  servidor: [],
  // Sin sesión: cualquiera, incluidos todos los roles.
  publico: ROLES,
}

/** Roles que NO deben poder leer contenido clínico (aceptación de E0-06). */
export const ROLES_NO_CLINICOS: readonly Rol[] = ['secretaria', 'recepcion', 'facturacion']

export interface RecursoAcceso {
  /** Ruta completa del `match`, tal cual está anidado en firestore.rules. */
  readonly ruta: string
  readonly clase: ClasePHI
  readonly guardaLectura: Guarda
  /** La guarda MÁS PERMISIVA de create/update/delete (el peor caso). */
  readonly guardaEscritura: Guarda
  /** Por qué está clasificado así. Se imprime en la matriz publicada. */
  readonly porQue: string
}

/**
 * LA MATRIZ. Una entrada por cada `match` de firestore.rules, en el mismo orden
 * en que aparecen en el archivo (facilita revisarlas en paralelo).
 */
export const MATRIZ_ACCESO: readonly RecursoAcceso[] = [
  {
    ruta: 'clinics/{clinicId}',
    clase: 'plataforma',
    guardaLectura: 'isMember',
    guardaEscritura: 'isAdmin',
    porQue: 'Metadatos del consultorio. Los campos de facturación/entitlement están congelados por campo: solo el servidor los cambia.',
  },
  {
    ruta: 'clinics/{clinicId}/appointments/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'La agenda es el trabajo de recepción. RESIDUAL ACEPTADO (D4): `motivo` es dato de salud y viaja aquí; la aceptación de E0-06 exige explícitamente que recepción lea la cita.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Directorio del paciente (nombre, teléfono, CURP, seguro): recepción lo necesita para agendar. PENDIENTE Fase B/C: hoy este documento TODAVÍA contiene los campos clínicos de CAMPOS_CLINICOS_PACIENTE, que deben mudarse a la subcolección `clinico`.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/notas/{notaId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Expediente clínico electrónico. Secreto médico (NOM-004). Las notas firmadas son inmutables (NOM-024).',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/notas/{notaId}/versions/{versionId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Trazabilidad de cambios del borrador (NOM-024 Art. 6.4). Inmutables una vez creadas.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/notas/{notaId}/adendas/{adendaId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Corrección a una nota ya firmada sin alterar el original (NOM-004). Se agregan, nunca se editan ni se borran.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/paquetes_visita/{docId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'servidor',
    porQue: 'El paquete de la visita: lo que el paciente puede LEER de su consulta, compuesto de material ya firmado (V9 PATIENT-COMPANION-001). Lo escribe el servidor y nadie más: liberar un paquete es un acto de aprobación clínica, y si el navegador pudiera escribirlo, cualquiera con el token del portal podría poner `estado: RELEASED` sobre un borrador. El paciente NO lo lee directo de Firestore — lo sirve /api/portal tras comprobar `visibleParaElPaciente`, igual que el resto de su superficie.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/preguntas_paciente/{docId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'servidor',
    porQue: 'Lo que el paciente preguntó por el portal, con la clase del §2 de patient-facing-ai que le puso el servidor (V9 PATIENT-AI-001). Lo escribe el servidor y nadie más, y la razón es la CLASE: si el navegador pudiera escribir aquí, quien tuviera el token del portal podría guardar su pregunta ya marcada ANSWER_FROM_APPROVED_PLAN y fabricarse la constancia de que el sistema le contestó algo que nunca le contestó. Clasificar exige ver el plan liberado, y eso sólo lo ve el servidor. Es secreto médico —el texto de la pregunta habla de síntomas y medicamentos—, así que la lectura es isMedico, no isMember. El paciente ve su propio historial por /api/portal, filtrado por su patientId.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/formularios_previos/{docId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'servidor',
    porQue: 'Lo que el paciente cuenta antes de la consulta (P-019): motivo, medicamentos, alergias y antecedentes. Es secreto médico, así que lo lee quien lee las notas — NO recepción ni facturación. Lo escribe /api/portal tras validar el token: el enlace del paciente no es sesión de Firebase, y si él pudiera escribir directo podría hacerlo sobre el expediente de otro paciente de la misma clínica.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/laboratorios/{labId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Valores de laboratorio del paciente. Mismo secreto médico que las notas.',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/fotos/{fotoId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Fotografía clínica seriada. Dato personal sensible; se permite borrar (una toma sin consentimiento debe poder eliminarse).',
  },
  {
    ruta: 'clinics/{clinicId}/patients/{docId}/clinico/{clinicoId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'E0-06: alergias, antecedentes y valoración del inmunocomprometido. Viven FUERA del documento del paciente porque Firestore no autoriza por campo — mientras sean campos de `patients/{id}` (que es `isMember`), recepción los lee y ninguna regla puede impedirlo.',
  },
  {
    ruta: 'clinics/{clinicId}/waitlist/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Lista de espera de la agenda. Trabajo de recepción.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'servidor',
    porQue: 'Episodio hospitalario (diagnósticos, indicaciones, MAR). Se lee todo el staff clínico; se escribe SOLO por /api/hospital/mutar, que valida el rol por acción.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}/signos/{signoId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Signos vitales seriados. Enfermeria y medicos AÑADEN; corregir es anexar otro documento con `corrigeA`, nunca editar (decision del 29-jul-2026). El `update` abierto —la pregunta E0-09-Q5— se cierra con la MISMA forma ya aceptada para icu_observations: solo puede tocar `estadoObservacion`, asi que una toma se marca como corregida pero sus MEDIDAS son inmutables. Nadie borra desde el cliente.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}/icu_stays/{stayId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'servidor',
    porQue: 'Estancia en UCI dentro del episodio: soportes activos, peso de dosificacion, codigo de reanimacion, aislamiento. Se lee todo el staff clinico; se escribe SOLO por el servidor, que valida el rol por accion — igual que el doc de internamiento.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}/icu_observations/{obsId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Tomas de UCI capturadas a pie de cama (ICU-003). El cliente SI crea, igual que en signos: obligarlas a pasar por el servidor anadiria latencia en el momento en que el dato se esta tomando. El APPEND-ONLY se hace cumplir en la REGLA — el update solo puede tocar `estado`, asi que una toma se marca como corregida pero sus MEDIDAS son inmutables. Borrar esta cerrado.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}/handoff_revisiones/{diaId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Quién revisó la entrega de turno y cuándo (charter §36: «siempre revisado por médico»). Es un acto del médico que entrega, no del sistema, así que lo firma su sesión. No se edita ni se borra: es justo lo que se consulta cuando algo se pasó en el cambio de turno.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{intId}/bed_assignments/{asigId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'servidor',
    porQue: 'Asignacion de cama APPEND-ONLY. El delete esta cerrado a proposito: borrar una asignacion destruiria la trazabilidad de quien ocupo que cama y cuando, que es justo lo que esta coleccion vino a crear. Cerrar una asignacion es un update del servidor (poner `hasta`), nunca un borrado.',
  },
  {
    ruta: 'clinics/{clinicId}/hospital_roles/{uid}',
    clase: 'plataforma',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isMedico',
    porQue: 'Rol hospitalario por usuario. La escritura NO puede ser de todo el staff: sería auto-escalada de privilegios.',
  },
  {
    ruta: 'clinics/{clinicId}/tareas_clinicas/{tareaId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Los cabos sueltos de la consulta: estudios pedidos, resultados por revisar, seguimientos. El título de una tarea es «Perfil tiroideo» junto al nombre del paciente — información clínica, así que la asistente no entra, igual que en las notas. No se borran: la constancia de que algo se dejó de hacer es justo lo que hace falta si un día se revisa el caso.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_no_entregados/{envioId}',
    // 'administrativo': identifica y contacta (4 dígitos del teléfono y el
    // arranque del mensaje), pero no revela salud. Por eso guarda un extracto y
    // no el texto entero: un recordatorio de cita no dice nada clínico, pero la
    // confirmación de una consulta sí puede llevar el motivo.
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'servidor',
    porQue: 'Mensajes de WhatsApp que no salieron (confirmaciones del bot y del portal). Los lee todo el equipo porque el seguimiento es trabajo del mostrador: hay que llamar por teléfono. Sólo los escribe el servidor y no se borran: un fallo de entrega que se puede hacer desaparecer no sirve para nada. Guarda los últimos 4 dígitos del teléfono y las primeras palabras del mensaje, no el texto completo.',
  },
  {
    ruta: 'clinics/{clinicId}/alertas_no_entregadas/{alertaId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'servidor',
    porQue: 'Alertas críticas (lab crítico, NEWS2, interconsulta) que NO llegaron. Las escribe sólo el servidor; desde el navegador se leen y nada más. Poder borrarlas convertiría «no llegó la alerta» en algo que se puede hacer desaparecer, que es justo lo que hay que poder revisar después.',
  },
  {
    ruta: 'clinics/{clinicId}/laboratorio/{ordenId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Solicitudes y resultados de laboratorio. Cualquier clínico SOLICITA (create); cargar/corregir un resultado y borrar la orden es de isLabStaff.',
  },
  {
    ruta: 'clinics/{clinicId}/hospital_alertas/{alertaId}',
    clase: 'clinico',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Alertas de lab critico / NEWS2 / interconsulta. Se crean y no se borran: una alerta critica no debe poder desaparecer. Y tampoco VACIARSE: el documento ES el registro, asi que el update solo puede tocar `leida` —la marca de bandeja—; titulo, detalle y tipo son inmutables. Borrarla estaba prohibido y reescribirla no, que es la misma alerta dicha de otra forma.',
  },
  {
    ruta: 'clinics/{clinicId}/camas/{camaId}',
    clase: 'administrativo',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isMedico',
    porQue: 'Inventario y ocupación de camas. No es PHI, pero el censo revela quién está internado: se restringe al staff clínico igual que el módulo.',
  },
  {
    ruta: 'clinics/{clinicId}/unidades/{unidadId}',
    clase: 'administrativo',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isMedico',
    porQue: 'Unidades del hospital con su TIPO. Mismos permisos que camas: es inventario, no PHI. La escritura es de médico/admin porque marcar una unidad como «cuidados críticos» cambia el comportamiento clínico de la aplicación — de eso depende en qué pantalla aparece cada paciente.',
  },
  {
    ruta: 'clinics/{clinicId}/config/firma',
    clase: 'identidad_profesional',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'REG-014. La firma y el sello viven en su propio documento: quien pueda escribirlos puede emitir recetas a nombre del médico, incluidas las de controlados.',
  },
  {
    ruta: 'clinics/{clinicId}/dosing_validations/{farmacoId}',
    clase: 'identidad_profesional',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMedico',
    porQue: 'La firma con la que un MEDICO declara que coteje una regla de dosificacion contra su fuente. Lectura para todo el consultorio (farmacia y enfermeria necesitan saber que esta validado y que no); escritura solo de medico, porque validar una dosis es un acto clinico y lleva nombre. Se permite delete a proposito: un medico tiene que poder retirar una validacion equivocada, y dejarla puesta por no poder deshacerla seria peor.',
  },
  {
    ruta: 'clinics/{clinicId}/antimicrobial_limits/{limiteId}',
    clase: 'identidad_profesional',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMedico',
    porQue: 'Topes de dosis antimicrobiana con su fuente. Los lee el equipo porque la alerta se le enseña a quien prescribe; solo un medico los escribe.',
  },
  {
    ruta: 'clinics/{clinicId}/config/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Horarios, duraciones y sucursales: recepción los necesita. La escritura es de isMember pero BLOQUEADA POR CAMPO sobre firma/cédula/especialidad, y el documento `config/firma` queda excluido de la lectura genérica.',
  },
  {
    ruta: 'clinics/{clinicId}/doctors/{docId}',
    clase: 'identidad_profesional',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMedico',
    porQue: 'Alta/baja de médicos y su cédula. Se publica en el perfil público, así que recepción no debe poder dar de alta a un médico inexistente.',
  },
  {
    ruta: 'clinics/{clinicId}/bot_sessions/{docId}',
    clase: 'administrativo',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Estado conversacional del bot de WhatsApp. Solo Admin SDK.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_optout/{telefono}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'servidor',
    porQue: 'Bajas de WhatsApp. El equipo las LEE para no volver a contactar a quien pidió baja; solo el bot (servidor) las escribe.',
  },
  {
    ruta: 'clinics/{clinicId}/secretos/{docId}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'API keys de IA del consultorio. Nunca accesibles desde el cliente.',
  },
  {
    ruta: 'clinics/{clinicId}/audit_log/{docId}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'servidor',
    porQue: 'No contiene notas, pero sí patientId/notaId: revela a QUIÉN se atendió y cuándo, que es dato de salud inferido. La escribe solo /api/auditoria/registrar; una bitácora forjable por el auditado no acredita nada.',
  },
  {
    ruta: 'clinics/{clinicId}/asr_aprendizaje/{palabra}',
    clase: 'clinico',
    guardaLectura: 'isMedico',
    guardaEscritura: 'isMedico',
    porQue: 'Vocabulario que el dictado aprendio de las correcciones del medico. NO es PHI —el motor excluye explicitamente las partes del nombre del paciente antes de guardar— pero revela COMO DICTA el medico y que farmacos maneja, asi que no es de una asistente. Se puede BORRAR desde Configuracion: un aprendizaje que no se puede deshacer es peor que no aprender, porque el sistema estaria empujando una palabra torcida en cada consulta sin que nadie pueda pararlo. La forma esta congelada con hasOnly para que esta coleccion no se use de cajon de sastre.',
  },
  {
    ruta: 'clinics/{clinicId}/arco_requests/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'publico',
    porQue: 'Solicitudes ARCO (LFPDPPP). El paciente las crea desde el portal publico con campos acotados; el equipo las resuelve. Nunca se borran, y desde v918 tampoco se REESCRIBEN: lo que declaro el solicitante —solicitante, tipo, descripcion, fecha y origen— esta congelado. Reescribir es peor que borrar, porque el resultado parece integro: cambiar «solicito la SUPRESION de mis datos» por «solicito acceso» dejaria el registro legal diciendo que se cumplio con otra cosa.',
  },
  {
    ruta: 'clinics/{clinicId}/notification_logs/{docId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Bitácora de recordatorios enviados. Append-only.',
  },
  {
    ruta: 'clinics/{clinicId}/branches/{branchId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Sucursales/sedes. Necesarias para agendar.',
  },
  {
    ruta: 'clinics/{clinicId}/time_blocks/{blockId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Bloqueos de horario (vacaciones, ausencias). Trabajo de recepción.',
  },
  {
    ruta: 'clinics/{clinicId}/farmacia/{itemId}',
    clase: 'administrativo',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Inventario de farmacia interna. No es PHI de un paciente, pero el manejo de medicamentos —incluidos controlados— no es de recepción/facturación.',
  },
  {
    ruta: 'clinics/{clinicId}/membership_plans/{planId}',
    clase: 'financiero',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Catálogo de planes de membresía. El cobro real pasa por `cobros`, con sus propias reglas anti-fraude.',
  },
  {
    ruta: 'clinics/{clinicId}/memberships/{membershipId}',
    clase: 'financiero',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Asignación de plan a paciente. Administrativo-financiero, sin contenido clínico.',
  },
  {
    ruta: 'clinics/{clinicId}/learning/{uid}',
    clase: 'plataforma',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Preferencias de sugerencias POR MÉDICO. No son datos del paciente, pero se aíslan por autor (uid == el propio uid).',
  },
  {
    ruta: 'clinics/{clinicId}/farmacia_movimientos/{movId}',
    clase: 'administrativo',
    guardaLectura: 'isClinicoHospital',
    guardaEscritura: 'isClinicoHospital',
    porQue: 'Movimientos de farmacia, inmutables. El autor lo sella la regla (realizadoPor == uid): el registro de controlados debe acreditar quién dispensó.',
  },
  {
    ruta: 'clinics/{clinicId}/cobros/{cobroId}',
    clase: 'financiero',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Registro contable: no se edita ni se borra, solo se ANULA, y anular deja huella (quien, cuando, por que) sellada contra el uid que firma. Desde v927 los cuatro campos de la anulacion quedan congelados TAMBIEN en la rama de vincular factura: sobre un cobro ya anulado esa rama aceptaba reescribir canceladoPor y culpar a un compañero, y el corte de caja lo imprime tal cual desde v907. Un control que señala a la persona equivocada es peor que no tenerlo.',
  },
  {
    ruta: 'clinics/{clinicId}/reviews/{reviewId}',
    clase: 'administrativo',
    guardaLectura: 'publico',
    guardaEscritura: 'isMember',
    porQue: 'Solo lo PUBLICADO es público; las pendientes y rechazadas solo las ve la clínica. Crear es exclusivo del servidor (/api/public/resena).',
  },
  {
    ruta: 'clinics/{clinicId}/chat/{msgId}',
    clase: 'administrativo',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Chat interno médico↔asistente, mensajes inmutables. RESIDUAL ACEPTADO: el texto libre puede contener referencias clínicas; el canal existe precisamente para que médico y asistente se coordinen.',
  },
  {
    ruta: 'clinics/{clinicId}/chat_reads/{uid}',
    clase: 'plataforma',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'Marca de leído por usuario. Cada quien solo toca la suya.',
  },
  {
    ruta: 'clinics/{clinicId}/members/{uid}',
    clase: 'plataforma',
    guardaLectura: 'isMember',
    guardaEscritura: 'isMember',
    porQue: 'El apodo que cada quien elige para el chat interno. Cada uno escribe sólo el suyo y la forma está congelada a `displayName`: no es sitio para un rol ni para nada clínico. REG-340: se leía y escribía desde el navegador SIN regla, así que la negaba el catch-all y no se guardaba nunca.',
  },
  {
    ruta: 'clinics/{clinicId}/internamientos/{docId}/registros/{registroId}',
    clase: 'clinico',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'La bitácora append-only del episodio, íntegra y sin truncar: es la copia que existe para la NOM-004. Sólo la escribe el Admin SDK. REG-340: faltaba en los tres sitios, y por tanto en el respaldo.',
  },
  {
    ruta: 'clinics/{clinicId}/memoria_medico/{uid}',
    clase: 'clinico',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Resúmenes de las últimas notas del médico para dar continuidad. Contiene material clínico y sólo lo toca el servidor.',
  },
  {
    ruta: 'clinics/{clinicId}/uci_copilot_feedback/{docId}',
    clase: 'clinico',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Lo que el médico contestó a una sugerencia del copiloto, con su contexto. Sólo servidor.',
  },
  {
    ruta: 'clinics/{clinicId}/slot_locks/{fecha}',
    clase: 'administrativo',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Candado efímero de un hueco de agenda mientras se confirma una cita. Sólo servidor; se excluye del respaldo a propósito.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_outbox/{docId}',
    clase: 'administrativo',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Cola de salida de WhatsApp. Lleva el texto del mensaje, que puede nombrar al paciente y su cita. Sólo servidor.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_contacts/{docId}',
    clase: 'administrativo',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Teléfonos del consultorio y su consentimiento para recibir mensajes. Dato identificable; sólo servidor.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_status/{docId}',
    clase: 'administrativo',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Estado de entrega por mensaje. Sólo servidor.',
  },
  {
    ruta: 'clinics/{clinicId}/whatsapp_events/{docId}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Conexiones y desconexiones del canal de WhatsApp del consultorio. Sólo servidor.',
  },
  {
    ruta: 'clinic_review_requests/{token}',
    clase: 'administrativo',
    guardaLectura: 'publico',
    guardaEscritura: 'publico',
    porQue: 'GET por token, LIST cerrado: con `read` abierto se podía enumerar nombre de paciente + médico de TODAS las clínicas (dato de salud inferido) y robar los tokens. El paciente solo puede marcarla usada (hasOnly).',
  },
  {
    ruta: 'clinic_invitations/{code}',
    clase: 'plataforma',
    guardaLectura: 'publico',
    guardaEscritura: 'isMedico',
    porQue: 'GET por código aleatorio para que el invitado sin cuenta la vea; LIST cerrado. Solo médico/admin invita, y para invitar `admin` hay que ser admin.',
  },
  {
    ruta: 'clinic_members/{uid}',
    clase: 'plataforma',
    guardaLectura: 'isMember',
    guardaEscritura: 'isAdmin',
    porQue: 'La membresía ES el rol: quien la escriba se auto-asigna privilegios. LIST cerrado (el equipo se sirve por Admin SDK) y el clinicId es inmutable.',
  },
  {
    ruta: 'googleTokens/{uid}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Access/refresh tokens de Google = credencial persistente. Deny total cierra el robo por XSS.',
  },
  {
    ruta: 'platform_cost_ledger/{eventoId}',
    clase: 'financiero',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Libro de costos de IA. No lleva PHI, pero enseña el gasto de todos los consultorios: se lee sólo por API del dueño.',
  },
  {
    ruta: 'platform_payments/{payId}',
    clase: 'financiero',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Facturación de la PLATAFORMA (nivel dueño). Solo el webhook de Stripe y /superadmin vía API.',
  },
  {
    ruta: 'platform_admin_log/{logId}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Bitácora de acciones del dueño. Nunca desde el cliente.',
  },
  {
    ruta: 'platform_packages/{pkgId}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Paquetes de módulos y precio. Los define el dueño desde /superadmin.',
  },
  {
    ruta: 'platform_meta/{docId}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'Metadatos de la plataforma. Solo Admin SDK.',
  },
  {
    ruta: '{document=**}',
    clase: 'plataforma',
    guardaLectura: 'servidor',
    guardaEscritura: 'servidor',
    porQue: 'DEFAULT-DENY. Todo lo que no esté declarado arriba queda cerrado al cliente.',
  },
]

/** Roles que satisfacen una guarda. */
export function rolesDe(g: Guarda): readonly Rol[] {
  return ROLES_POR_GUARDA[g]
}

/**
 * Normaliza los comodines de una ruta (`{docId}` → `{}`) para poder comparar la
 * matriz con lo que hay en firestore.rules sin que un renombre cosmético del
 * comodín rompa el test.
 */
export function normalizarRuta(ruta: string): string {
  return ruta.replace(/\{[^}]*\}/g, '{}')
}

function buscar(ruta: string): RecursoAcceso | undefined {
  const n = normalizarRuta(ruta)
  return MATRIZ_ACCESO.find(r => normalizarRuta(r.ruta) === n)
}

/** ¿Este rol puede LEER esta ruta? Falla-cerrado si la ruta no está en la matriz. */
export function puedeLeer(rol: Rol, ruta: string): boolean {
  const r = buscar(ruta)
  if (!r) return false
  return rolesDe(r.guardaLectura).includes(rol)
}

/** ¿Este rol puede ESCRIBIR esta ruta? Falla-cerrado si la ruta no está en la matriz. */
export function puedeEscribir(rol: Rol, ruta: string): boolean {
  const r = buscar(ruta)
  if (!r) return false
  return rolesDe(r.guardaEscritura).includes(rol)
}

const ETIQUETA_CLASE: Record<ClasePHI, string> = {
  administrativo: 'Administrativo',
  clinico: 'CLÍNICO (secreto médico)',
  financiero: 'Financiero',
  identidad_profesional: 'Identidad profesional',
  plataforma: 'Plataforma',
}

/**
 * Genera el documento publicado. Es la ÚNICA fuente del .md: el test compara el
 * archivo en disco con la salida de esta función, así que la matriz publicada no
 * puede quedarse vieja.
 */
export function matrizComoMarkdown(): string {
  const L: string[] = []
  L.push('# Matriz de acceso a PHI — Ausculta')
  L.push('')
  L.push('> **ARCHIVO GENERADO — no editar a mano.** Sale de `matrizComoMarkdown()` en')
  L.push('> `src/lib/authz/matriz-acceso.ts`. `src/__tests__/matriz-acceso.test.ts` falla')
  L.push('> si este archivo y la matriz divergen.')
  L.push('>')
  L.push('> Unidad Nexus OS **E0-06** — separación de PHI administrativo vs clínico.')
  L.push('')
  L.push('## Guardas y roles')
  L.push('')
  L.push('| Guarda | Roles que la satisfacen |')
  L.push('|---|---|')
  for (const g of Object.keys(ROLES_POR_GUARDA) as Guarda[]) {
    const roles = rolesDe(g)
    L.push(`| \`${g}\` | ${roles.length ? roles.join(', ') : '_ninguno desde el cliente_'} |`)
  }
  L.push('')
  L.push(`**Roles SIN acceso clínico:** ${ROLES_NO_CLINICOS.join(', ')}.`)
  L.push('')
  L.push('`recepcion` y `facturacion` todavía no son asignables en `clinic_members.role`:')
  L.push('en producción «recepción» es `secretaria`. Se evalúan igual para que el día que')
  L.push('se activen no entren por una puerta abierta.')
  L.push('')
  L.push('## Recursos')
  L.push('')
  L.push('| Ruta | Clase | Lectura | Escritura | Por qué |')
  L.push('|---|---|---|---|---|')
  for (const r of MATRIZ_ACCESO) {
    L.push(`| \`${r.ruta}\` | ${ETIQUETA_CLASE[r.clase]} | \`${r.guardaLectura}\` | \`${r.guardaEscritura}\` | ${r.porQue} |`)
  }
  L.push('')
  L.push('## Invariante que verifica el test')
  L.push('')
  L.push('Ningún recurso de clase **CLÍNICO** puede quedar bajo una guarda cuyo conjunto')
  L.push('de roles incluya a un rol sin acceso clínico. Firestore **no autoriza por**')
  L.push('**campo**: si un dato clínico vive dentro de un documento que recepción puede')
  L.push('leer, ninguna regla lo protege — hay que moverlo de documento.')
  L.push('')
  return L.join('\n')
}
