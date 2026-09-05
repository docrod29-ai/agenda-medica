/**
 * GUION DEL VIDEO DE DEMOSTRACIÓN DE AUSCULTA.
 *
 * Una sola fuente de verdad para tres consumidores:
 *   · tts.py           → sintetiza la narración y el diálogo (una pista por escena)
 *   · grabar.mjs       → graba la pantalla real de cada escena en el arnés local
 *   · remotion/src     → compone narración + clips + rótulos + subtítulos
 *
 * Todo lo que se dice aquí sobre el producto sale del código del repositorio
 * (ver README.md de esta carpeta, sección «De dónde sale cada afirmación»).
 *
 * Reglas del texto de la narración: números en palabras (el sintetizador los
 * lee mejor), sin siglas sueltas, sin cifras clínicas que no haya dicho la
 * paciente ficticia en el diálogo.
 */

/** Capítulos: agrupan escenas bajo un rótulo. */
export const CAPITULOS = [
  { id: 'agenda', numero: 1, titulo: 'La agenda', sub: 'Del paciente al consultorio' },
  { id: 'consulta', numero: 2, titulo: 'La consulta', sub: 'Escuchar, escribir, firmar' },
  { id: 'documentos', numero: 3, titulo: 'Receta y órdenes', sub: 'Con seguridad antes del papel' },
  { id: 'paciente', numero: 4, titulo: 'El paciente', sub: 'Portal, preguntas y seguimiento' },
]

/**
 * Escenas. `clip` es el nombre del archivo que graba grabar.mjs (sin
 * extensión). `formato`: 'escritorio' 1920×1080 · 'telefono' 390×844 en marco.
 * `narracion` es lo que se oye; `sub` es el subtítulo (más corto) que se pinta.
 */
export const ESCENAS = [
  {
    id: '00-intro',
    capitulo: null,
    clip: 'landing',
    formato: 'escritorio',
    narracion:
      'Ésta es Ausculta. Una plataforma clínica hecha para que el médico salga de la consulta con la nota terminada, sin haber dejado de mirar al paciente. ' +
      'En los próximos minutos vamos a recorrer el ciclo completo: desde que un paciente pide una cita, hasta la nota firmada, la receta, las órdenes, y el portal donde el paciente sigue su cuidado. ' +
      'Todo lo que ves es la aplicación real, corriendo sobre un consultorio de prueba con pacientes ficticios.',
  },
  {
    id: '01-paciente-reserva',
    capitulo: 'agenda',
    clip: 'reservar',
    formato: 'escritorio',
    narracion:
      'Empecemos por el paciente. Cada consultorio tiene un perfil público, indexable en Google, con un botón para reservar. ' +
      'Desde ahí, sin crear una cuenta, el paciente elige el tipo de consulta y el día, y ve únicamente los horarios que están libres de verdad: ' +
      'el sistema descuenta la agenda del médico, sus descansos, los días festivos, y hasta su Google Calendar. ' +
      'Deja su nombre y su teléfono, acepta el aviso de privacidad, y la cita queda solicitada. El consultorio recibe el aviso por WhatsApp al instante.',
  },
  {
    id: '02-whatsapp-bot',
    capitulo: 'agenda',
    clip: null, // animación hecha en Remotion con el guion del bot
    formato: 'chat',
    narracion:
      'El paciente también puede agendar por WhatsApp. El asistente conversacional entiende si quiere agendar, cancelar o reagendar, ' +
      'le ofrece los horarios disponibles, y confirma la cita en la misma conversación, con recordatorio incluido.',
  },
  {
    id: '03-asistente-agenda',
    capitulo: 'agenda',
    clip: 'asistente',
    formato: 'escritorio',
    narracion:
      'Ahora el otro lado del mostrador. La recepción tiene una pantalla de alta rápida: escribe el nombre, y si el paciente ya existe, lo encuentra. ' +
      'Elige el tipo de consulta, el día, y una hora disponible. Un clic, y la cita queda creada. ' +
      'Para casos con más detalle, el calendario abre una ficha completa: médico, motivo, origen, notas internas. ' +
      'Y si dos personas intentan tomar el mismo hueco a la vez, el servidor lo resuelve con una transacción: el lugar se entrega una sola vez.',
  },
  {
    id: '04-confirmar',
    capitulo: 'agenda',
    clip: 'citas',
    formato: 'escritorio',
    narracion:
      'En la agenda del día, cada cita muestra su estado: solicitada, pendiente de confirmar, confirmada, en sala, en consulta, atendida. ' +
      'La recepción ve de un vistazo cuántas faltan por confirmar, y las confirma por WhatsApp con un botón. ' +
      'Todo cambio de estado se escribe en el servidor con bitácora, y actualiza el historial del paciente: cuántas veces faltó, cuántas canceló. ' +
      'Los recordatorios salen solos: veinticuatro horas antes, y otra vez el mismo día. El paciente responde sí o no en WhatsApp, y la agenda se actualiza sin que nadie tenga que capturarlo.',
  },
  {
    id: '05-lista-espera',
    capitulo: 'agenda',
    clip: 'lista-espera',
    formato: 'escritorio',
    narracion:
      '¿Y cuando no hay lugar? Existe la lista de espera, con prioridad y fecha deseada. ' +
      'Cuando alguien cancela una cita futura, Ausculta busca en la lista a quien mejor encaja con ese médico y ese horario, le manda el hueco por WhatsApp, y le da unas horas para aceptarlo. ' +
      'Si responde que sí, la cita se crea sola. Si no, pasa al siguiente. Nadie del consultorio tiene que hacer llamadas.',
  },
  {
    id: '06-consulta-escucha',
    capitulo: 'consulta',
    clip: 'consulta-grabar',
    formato: 'escritorio',
    // Esta escena tiene dos narraciones: antes y después del diálogo, que se oye entero.
    narracion:
      'Llegó la hora de la consulta. La médica abre el encuentro desde la agenda. Arriba, las alergias en rojo. Abajo, lo que la paciente está tomando según sus notas firmadas. ' +
      'Y un solo botón: grabar la consulta. Ausculta capta a las dos personas y separa las voces. Escuchemos.',
    narracionDespues:
      'Al terminar, la transcripción llega separada por hablante: médica y paciente. ' +
      'Las palabras que el reconocedor oyó con duda quedan marcadas para verificarlas. Nunca se corrigen en silencio.',
    dialogo: true,
  },
  {
    id: '07-nota',
    capitulo: 'consulta',
    clip: 'consulta-nota',
    formato: 'escritorio',
    narracion:
      'Con eso, la nota se escribe. Subjetivo, objetivo, evaluación y plan. Diagnósticos con su código. Los medicamentos con dosis, vía y frecuencia. Y las alergias. ' +
      'Fíjate en los detalles que importan. «Fiebre no» quedó como negación, no como fiebre. ' +
      'La metformina dice ochocientos cincuenta miligramos cada doce horas, exactamente como se dijo. ' +
      'Y el ajuste de la dosis, que era condicional, no se convirtió en una orden. ' +
      'El modelo de lenguaje redacta y extrae. No calcula escalas ni decide dosis: eso lo hacen motores deterministas, con pruebas.',
  },
  {
    id: '08-procedencia-firma',
    capitulo: 'consulta',
    clip: 'consulta-firma',
    formato: 'escritorio',
    narracion:
      'Cada frase de la nota guarda de dónde salió. Al tocarla, Ausculta muestra el fragmento del dictado que la sostiene, y puede reproducir el segundo exacto del audio. ' +
      'Antes de firmar, un panel separa lo que bloquea de lo que sólo hay que revisar: lo que exige la norma oficial cero cero cuatro, las dosis sin cifra, las atribuciones dudosas. ' +
      'La médica revisa, corrige lo que quiera, y firma. La nota se sella con un hash de integridad conforme a la norma cero veinticuatro, queda en la bitácora de auditoría, ' +
      'y a partir de ahí sólo se puede enmendar por adenda.',
  },
  {
    id: '09-receta',
    capitulo: 'documentos',
    clip: 'receta',
    formato: 'escritorio',
    narracion:
      'De la nota firmada sale la receta, ya cargada con lo que la médica indicó hoy, y sólo con eso: lo que la paciente refirió que toma no baja al papel. ' +
      'Cada fármaco se cruza contra las alergias, las interacciones, la dosis máxima y la función renal. ' +
      'Si alguien intentara agregar una penicilina a esta paciente, la alerta salta antes de imprimir. ' +
      'La receta lleva folio, firma del médico, y un código QR que cualquier farmacia puede verificar. Se imprime o se descarga en PDF, con el membrete del consultorio.',
  },
  {
    id: '10-ordenes',
    capitulo: 'documentos',
    clip: 'orden',
    formato: 'escritorio',
    narracion:
      'Las órdenes de laboratorio e imagen siguen el mismo camino: los estudios que la médica pidió en la consulta ya vienen marcados, con el diagnóstico que los justifica. ' +
      'Cuando llegan los resultados, se suben como foto o PDF. La inteligencia artificial sólo transcribe; un motor determinista valida cada valor, marca los críticos, ' +
      'y arma la trayectoria en el tiempo de esta paciente: glucosa, creatinina, hemoglobina glucosilada.',
  },
  {
    id: '11-entregar-portal',
    capitulo: 'paciente',
    clip: 'entregar',
    formato: 'escritorio',
    narracion:
      'Firmar la nota y entregarle algo al paciente son dos actos distintos. La médica libera un paquete de visita: resumen en palabras llanas, medicamentos con instrucciones, ' +
      'qué cambió, estudios pendientes, señales de alarma y próxima cita. Hasta que ella lo libera, el paciente no ve nada. ' +
      'El enlace viaja por WhatsApp, sin contenido clínico adentro.',
  },
  {
    id: '12-portal',
    capitulo: 'paciente',
    clip: 'portal',
    formato: 'telefono',
    narracion:
      'Así se ve el portal en el teléfono del paciente. Cinco destinos: Hoy, Preguntar, Cuidado, Documentos y Perfil. ' +
      'En Hoy están sus citas: puede confirmar, reagendar viendo los huecos libres reales, o cancelar. ' +
      'En Cuidado, su plan, tal como la médica lo aprobó. En Documentos, su receta, lista para descargar.',
  },
  {
    id: '13-preguntar',
    capitulo: 'paciente',
    clip: 'portal-preguntar',
    formato: 'telefono',
    narracion:
      'En Preguntar, el paciente puede hacer preguntas. Y aquí Ausculta hace algo distinto a un chat: cada respuesta se clasifica antes de escribirse. ' +
      'Si la pregunta se contesta con el plan aprobado, responde citando el plan. ' +
      'Si pide cambiar una dosis, escala al médico: la inteligencia artificial nunca cambia un tratamiento. ' +
      'Y si describe una urgencia, lo primero que aparece es cómo pedir ayuda. El consultorio recibe la escalación por WhatsApp.',
  },
  {
    id: '14-seguimiento',
    capitulo: 'paciente',
    clip: 'seguimiento',
    formato: 'escritorio',
    narracion:
      'Del lado del médico, todo lo que quedó abierto se vuelve un pendiente: estudios por revisar, seguimientos, escalaciones del paciente, con lo urgente arriba. ' +
      'El expediente longitudinal reúne cada encuentro, diagnóstico, medicamento y laboratorio en una sola línea de tiempo. ' +
      'Y la bitácora de auditoría registra quién hizo qué y cuándo, exportable para cumplimiento.',
  },
  {
    id: '15-configuracion-cierre',
    capitulo: null,
    clip: 'configuracion',
    formato: 'escritorio',
    narracion:
      'Todo esto se configura en minutos: horarios por día, duraciones por tipo de consulta, festivos, bloqueos, recordatorios, el enlace público y su código QR. ' +
      'Ausculta. Sal de la consulta con la nota hecha. Catorce días gratis, sin tarjeta.',
  },
]

/**
 * EL DIÁLOGO DE LA CONSULTA — ficticio, actuado por voces sintéticas.
 *
 * Paciente ficticia del arnés: Rosalía Mendieta Cuevas (pac-001), diabetes
 * tipo 2 con nefropatía incipiente, alérgica a penicilina, sulfas y AINEs.
 * Ejercita, como el corpus de `synthetic-data/dialogos-consulta`: negación
 * («fiebre no»), dosis dictada en palabras (REG-091), alergia y una indicación
 * CONDICIONAL que no debe volverse orden (REG-130).
 *
 * Ninguna cifra de aquí es una recomendación: son las palabras de una paciente
 * inventada y de una médica inventada.
 */
export const DIALOGO = [
  { rol: 'Médico', texto: 'Buenos días, doña Rosalía. Vamos con el control de su diabetes. ¿Cómo ha estado de la glucosa?' },
  { rol: 'Paciente', texto: 'Pues en las mañanas me sale entre ciento diez y ciento treinta, doctora. En la noche a veces sube.' },
  { rol: 'Médico', texto: '¿Sigue tomando la metformina?' },
  { rol: 'Paciente', texto: 'Sí, ochocientos cincuenta, dos veces al día, sin faltar.' },
  { rol: 'Médico', texto: '¿Ha tenido fiebre, ardor al orinar, o hinchazón en los pies?' },
  { rol: 'Paciente', texto: 'Fiebre no. Los pies sí se me hinchan un poco por la tarde.' },
  { rol: 'Médico', texto: '¿Alguna alergia nueva a medicamentos?' },
  { rol: 'Paciente', texto: 'No, sólo la penicilina, que me da anafilaxia. Y las sulfas.' },
  {
    rol: 'Médico',
    texto:
      'Muy bien. Por la nefropatía incipiente le voy a pedir creatinina, urea, examen general de orina y hemoglobina glucosilada. ' +
      'Le renuevo la metformina ochocientos cincuenta miligramos cada doce horas por tres meses. ' +
      'Y si la función renal salió más baja, la ajustamos en la siguiente cita.',
  },
]

/** Guion del bot de WhatsApp (escena 02). Ficticio; sigue la máquina de estados real del webhook. */
export const CHAT_BOT = [
  { de: 'paciente', texto: 'Hola, quiero una cita con la doctora' },
  { de: 'bot', texto: '¡Hola! Soy el asistente del Consultorio de Medicina Interna. ¿Me dices tu nombre completo?' },
  { de: 'paciente', texto: 'Leonor Castañeda Vidal' },
  { de: 'bot', texto: 'Gracias, Leonor. ¿Qué tipo de consulta necesitas?\n1️⃣ Primera vez\n2️⃣ Seguimiento' },
  { de: 'paciente', texto: '1' },
  { de: 'bot', texto: 'Tengo estos horarios el lunes 7 de septiembre:\n🕐 10:00\n🕐 11:30\n🕐 16:00\n¿Cuál prefieres?' },
  { de: 'paciente', texto: '11:30' },
  { de: 'bot', texto: '✅ Listo, Leonor. Tu cita quedó el lunes 7 de septiembre a las 11:30 con la Dra. Ximena Alcántara.\n\nTe recuerdo un día antes. Responde CANCELAR si necesitas cambiarla.' },
]

/** Recordatorio de 24 h (escena 04). Texto real de `api/cron/reminders`. */
export const CHAT_RECORDATORIO = [
  { de: 'bot', texto: 'Hola Aurelio 👋\n\nTe recordamos que tienes una cita *mañana* con Dra. Ximena Alcántara Robledo.\n\n📅 martes 8 de septiembre\n🕐 09:30\nConsultorio de Medicina Interna\n\n¿Confirmas tu asistencia? Responde *SÍ* para confirmar o *NO* para cancelar.' },
  { de: 'paciente', texto: 'Sí' },
  { de: 'bot', texto: '✅ Cita confirmada. Te esperamos mañana a las 09:30.' },
]

/** Oferta de hueco a la lista de espera (escena 05). Texto real de `lib/whatsapp/ofrecer-hueco.ts`. */
export const CHAT_HUECO = [
  { de: 'bot', texto: '🔔 *Espacio disponible en Consultorio de Medicina Interna*\n\nHola Fermín, se liberó un horario:\n\n📅 *martes 8 de septiembre*\n🕐 *17:15 hrs*\n\n¿Desea tomar este horario? Responda *SÍ* antes de que se ocupe.' },
  { de: 'paciente', texto: 'SÍ' },
  { de: 'bot', texto: '✅ Su cita quedó agendada: martes 8 de septiembre, 17:15 hrs. Le recordamos un día antes.' },
]

/** Escalación al consultorio (escena 13). */
export const CHAT_ESCALACION = [
  { de: 'bot', texto: '⚠️ *Pregunta escalada desde el portal*\n\nPaciente: Rosalía M.\n«¿Puedo tomar el doble de metformina si me sale alta la glucosa?»\n\nClase: ESCALATE_TO_CLINICIAN · motivo: cambio de dosis.\nSe le respondió que lo consulte con su médica antes de cambiar nada.' },
]
