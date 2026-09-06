/**
 * BASE DE CONOCIMIENTO de la app (Ausculta). Fuente ÚNICA que alimenta:
 *  1) la Guía de uso (/guia)  y  2) el bot de soporte (/api/ayuda-bot).
 *
 * Es texto puro (sin JSX) para poder pasarlo como contexto al bot. Al agregar
 * una función nueva a la app, actualiza AQUÍ y se refleja en la guía y el bot.
 */
export type Rol = 'todos' | 'recepcion' | 'medico' | 'enfermeria' | 'dueno'
export type Paso = { t: string; d: string }
export type SeccionGuia = {
  id: string; titulo: string; roles: Rol[]
  intro: string; pasos: Paso[]; tips?: string[]; ojo?: string[]
}

export const GUIA: SeccionGuia[] = [
  /* ────────────────────────────────────────────────────────────────────────
     AUDITADA CONTRA EL PRODUCTO, no contra la memoria.

     La guía cubría 14 temas. Faltaban doce de los que un médico necesita —y
     entre ellos, **firmar**, que es el acto medicolegal del producto, y todo
     el ciclo de la orden hasta el resultado. Como esta misma base alimenta al
     bot de soporte (`/api/ayuda-bot`), el hueco no era sólo de la guía: el bot
     tampoco podía contestar sobre la firma, las órdenes, los resultados, el
     portal ni qué hacer cuando algo falla.

     Cada sección de aquí abajo se escribió MIRANDO la pantalla que describe:
     los rótulos, los estados y los caminos son los que existen hoy. Lo que el
     producto no hace, no se documenta.
     ──────────────────────────────────────────────────────────────────────── */
  {
    id: 'que-es', titulo: '¿Qué es Ausculta?', roles: ['todos'],
    intro: 'En una frase: escucha la consulta y te deja la nota hecha, sin que dejes de mirar al paciente.',
    pasos: [
      { t: 'Lo que hace', d: 'Grabas la consulta y Ausculta separa lo que dijo el paciente de lo que dijiste tú, entiende lo que el paciente AFIRMA y lo que NIEGA, y redacta la nota. Tú la revisas, la corriges y la firmas.' },
      { t: 'Lo que guarda', d: 'Cada frase de la nota conserva el segundo del dictado del que salió. Tocas la frase y oyes ese momento: para revisarla hoy, y para sostenerla dentro de tres años.' },
      { t: 'Lo que NO hace por su cuenta', d: 'No calcula una dosis ni una escala con inteligencia artificial: eso lo hace código con pruebas. No rellena un hueco para que la nota se vea completa. No cambia nada en silencio. Y no firma nada: firmas tú.' },
      { t: 'Y alrededor', d: 'Agenda con recordatorios, recetas y órdenes con tu membrete, seguimiento de resultados, y un portal donde el paciente ve lo que tú liberaste.' },
    ],
    tips: ['Si sólo vas a leer una sección de esta guía, que sea «Nota por voz».'],
  },
  {
    id: 'inicio', titulo: 'Primeros pasos', roles: ['todos'],
    intro: 'Lo mínimo para arrancar el primer día.',
    pasos: [
      { t: 'Entra con tu correo', d: 'Abre la app, escribe tu correo y contraseña (o entra con Google). Al entrar con Google, elige SIEMPRE el correo correcto en el selector — si eliges otro, verás una cuenta vacía distinta.' },
      { t: 'Reconoce el menú', d: 'A la izquierda (o abajo en el celular) están las secciones: Dashboard, Citas, Consulta, Hospitalización, Consultor IA, etc. Arriba, la flecha "← Atrás" te regresa a donde estabas.' },
      { t: 'Elige tu modo', d: 'Si eres médico, abajo del menú puedes cambiar entre "Médico" y "Recepción" según lo que hagas.' },
      { t: 'Configura lo básico', d: 'Configuración → Datos del consultorio y Horario de atención. Con eso ya puedes agendar.' },
    ],
    tips: ['Todo se guarda solo en la nube; entras desde compu, celular o tablet con el mismo correo.'],
  },
  {
    id: 'agenda', titulo: 'Agenda y citas', roles: ['recepcion', 'medico'],
    intro: 'Cómo agendar, mover, confirmar y recordar citas.',
    pasos: [
      { t: 'Agendar una cita', d: 'Citas → "Nueva cita". Escribe el paciente (si existe, aparece solo), elige médico, fecha y hora. Solo se ofrecen horas libres. Guarda.' },
      { t: 'Agendar rápido', d: 'Para recepción con prisa: "Agendar rápido" te lleva paso a paso: paciente → motivo → primer hueco disponible.' },
      { t: 'Reagendar o cancelar', d: 'Abre la cita → "Editar" para cambiar día/hora, o "Cancelar". Si el paciente tiene WhatsApp, le avisas con un toque.' },
      { t: 'Lista de espera', d: 'Si no hay hueco, mete al paciente a Lista de espera. Cuando se libere un lugar, la app te dice a quién llamar.' },
      { t: 'Recordatorios por WhatsApp', d: 'En la cita, "Recordar" abre WhatsApp con el mensaje ya escrito. Solo lo envías.' },
    ],
    tips: ['La cita nunca se agenda en un hueco ocupado ni en el pasado: la app lo impide sola.'],
  },
  {
    id: 'voz', titulo: 'Nota por voz (dictado con IA)', roles: ['medico'],
    intro: 'Habla normal y la IA arma la nota médica ordenada. Es la función estrella.',
    pasos: [
      { t: 'Abre al paciente', d: 'Consulta → toca al paciente. Verás sus datos, alergias, notas anteriores.' },
      { t: 'Graba la conversación', d: 'Toca el micrófono y habla normal (motivo, exploración, diagnóstico, plan). Puedes grabar solo tu dictado o TODA la conversación médico–paciente: la IA separa las voces automáticamente y sabe quién dijo qué.' },
      { t: 'Elige el motor de IA', d: 'Antes o al procesar, eliges con qué IA se arma la nota: ⚡ Rápida, ⭐ Estándar o 💎 Máxima (ver la sección "Menú de IA y créditos"). Por defecto usa la de tu plan.' },
      { t: 'Procesar con IA', d: 'Toca "Procesar con IA": transcribe tu voz y arma una nota estructurada (resumen, exploración, diagnósticos con CIE-10, medicamentos, plan).' },
      { t: 'Revisa lo que entendió', d: 'Los datos seguros se aceptan solos; los delicados (dosis, alergias) te los marca para confirmar de un vistazo.' },
      { t: 'Firma la nota', d: 'Cuando esté bien, "Firmar". Una nota firmada queda blindada (ya no se cambia, NOM-004). Antes de firmar editas o descartas libre.' },
    ],
    tips: [
      'Si el audio es largo, no lo pierdes: queda guardado y lo reprocesas.',
      'La nota se puede re-proyectar a otro tipo (evolución, interconsulta) sin volver a dictar.',
    ],
    ojo: ['La separación de voces (médico/paciente) necesita que el dueño la tenga habilitada en la configuración del consultorio. Si no está, Ausculta transcribe igual pero SIN separar quién dijo qué — y te lo dice, en vez de repartir las frases al azar.'],
  },
  {
    id: 'menu-ia', titulo: 'Menú de IA y créditos (MUY importante)', roles: ['medico', 'dueno'],
    intro: 'Cada nota se hace con un "motor" de IA. Elegir bien te ahorra créditos.',
    pasos: [
      { t: '⚡ Rápida', d: 'Estructura la nota y resume el caso, con la menor espera. Para nota rutinaria o de seguimiento simple. Cuesta 1 crédito.' },
      { t: '⭐ Estándar', d: 'Añade separación de voces médico–paciente, detección de omisiones, revisión básica de seguridad y escalas clínicas calculadas con código. Para la consulta compleja. Cuesta 3 créditos, y es lo que trae el plan Clínica.' },
      { t: '💎 Máxima', d: 'Añade un segundo verificador independiente que revisa la nota, evidencia con PMID comprobado y revisión farmacológica (dosis, interacciones, función renal). Para el caso difícil. Cuesta 10 créditos, y es lo que trae el plan Pro.' },
      { t: '¿Por qué cuestan distinto?', d: 'Porque hacen distinto trabajo: Rápida es un solo paso; Máxima razona más, busca evidencia y luego una segunda inteligencia independiente revisa lo que la primera escribió. Los créditos son proporcionales a ese costo real, no a un margen.' },
      { t: '¿Cuántas notas alcanzan mis créditos?', d: 'Depende del motor. Ej. con 200 créditos (plan Clínica): ~66 notas Estándar, o 20 Máximas, o 200 Rápidas, o una mezcla. El plan Pro trae 450 créditos.' },
      { t: 'Cuando se acaban los créditos', d: 'La IA NO se detiene: sigue GRATIS en ⚡ Rápida (hasta un tope generoso al mes). Para recuperar la IA máxima, compras más créditos o subes de plan. Nunca te quedas sin poder trabajar.' },
      { t: 'Comprar más créditos (recarga)', d: 'Cuando quieras más IA máxima, compras un paquete de recarga. Se suman al instante a los del mes.' },
    ],
    tips: [
      'Usa ⭐ Estándar para lo normal y 💎 Máxima solo para el caso difícil: así tus créditos rinden mucho más.',
      'El medidor te muestra cuántos créditos te quedan.',
    ],
  },
  {
    id: 'corregir', titulo: 'Corregir la nota por chat', roles: ['medico'],
    intro: 'Arregla la nota escribiendo, sin volver a dictar.',
    pasos: [
      { t: 'Escribe el cambio', d: 'En la nota, en "Corregir por chat", escribe qué está mal: "la dosis de amoxicilina es 500 mg", "quita la diabetes", "el Dx correcto es apendicitis".' },
      { t: 'La IA corrige SOLO eso', d: 'Cambia únicamente lo que pediste, sin inventar ni tocar lo demás. Una segunda inteligencia, independiente de la que escribió, verifica que no se haya pasado.' },
      { t: 'Deshacer', d: 'Si no te gustó, "Deshacer" regresa la nota a como estaba.' },
    ],
    tips: ['También puedes editar a mano cualquier campo (diagnósticos, medicamentos, texto).'],
  },
  {
    id: 'consultor', titulo: 'Consultor de IA (evidencia médica)', roles: ['medico'],
    intro: 'Pregúntale cualquier duda clínica y te responde con evidencia real y citas.',
    pasos: [
      { t: 'Abre el Consultor', d: 'En el menú, "Consultor IA". Es un chat clínico tipo OpenEvidence.' },
      { t: 'Haz tu pregunta', d: 'Escribe tu duda ("mejor antibiótico para… en paciente con…", dosis, esquemas). Presiona Enter.' },
      { t: 'Respuesta con evidencia', d: 'Busca en PubMed (NEJM, JAMA, Cochrane, Lancet) y responde citando los artículos [n] que la respaldan, más dosis oficiales (FDA) y la guía mexicana (GPC/CENETEC) cuando aplica.' },
      { t: 'Segunda opinión automática', d: 'Una inteligencia redacta la respuesta y otra, independiente, la revisa contra la MISMA evidencia antes de enseñártela. Verás en pantalla que pasó por las dos.' },
      { t: 'Sobre un paciente', d: 'Desde el expediente puedes abrir el Consultor con el contexto del paciente para que personalice (edad, alergias, tratamiento).' },
    ],
    tips: ['Cada pregunta gasta una fracción de crédito (mucho menos que una nota).'],
  },
  {
    id: 'analisis', titulo: 'Análisis de evidencia en la nota', roles: ['medico'],
    intro: 'Convierte tu diagnóstico/tratamiento en un análisis basado en literatura, dentro de la nota.',
    pasos: [
      { t: 'Genera el análisis', d: 'En la nota con diagnósticos/medicamentos, botón "Análisis de evidencia → agregar a la nota".' },
      { t: 'Qué hace', d: 'Cruza tu plan con PubMed y te da evaluación del tratamiento, alternativas y diagnóstico diferencial, con citas reales.' },
      { t: 'Se agrega a la nota', d: 'El análisis se inserta como una sección más de la nota, listo para revisar.' },
    ],
  },
  {
    id: 'recetas', titulo: 'Configurar tu receta (3 pasos)', roles: ['medico'],
    intro: 'Deja la receta idéntica a tu papel. Son 3 pasos y se hace UNA sola vez.',
    pasos: [
      {
        t: '1. Sube tu papel de receta',
        d: 'Configuración → “Recetas, órdenes y notas” (grupo Documentos clínicos). En el paso 1 sube una foto o un PDF de la receta que ya usas, en blanco. La app mide tu hoja sola —no hace falta que la midas con regla— y lee tu formato para colocar Nombre, Edad, F. nacimiento, Sexo, Fecha, Folio, firma y QR sobre las líneas que ya trae impresas. La fecha de nacimiento la piden las farmacias para dispensar, y sale con su etiqueta: «Fecha de nacimiento: 15/03/1984». Si algo quedó fuera de su sitio, pulsa “Ajustar dónde caen los datos” y arrastra la etiqueta. Si no tienes papel propio, marca la casilla de abajo: se genera un encabezado con los datos de tu consultorio.',
      },
      {
        t: '2. Sube tu firma y tu sello',
        d: 'Firma en una hoja BLANCA con plumón negro, con tu sello al lado, tómale foto de frente con buena luz y súbela. Se guarda sola —no hay que darle a Guardar— y aparece sobre la línea de firma de tus recetas, órdenes y notas.',
      },
      {
        t: '3. Imprime una prueba',
        d: 'Pulsa “Imprimir una prueba”: sale una receta de ejemplo, a tamaño real, por el MISMO camino que la receta que recibe el paciente. Compárala contra tu papel antes de usarla con nadie. Si quedó bien, ya está. Si no, pulsa “No cuadró” y salen las tres averías más comunes con su arreglo.',
      },
    ],
    tips: [
      'Todo lo demás —tamaño de papel, estilo, color, qué datos se imprimen, RFC, registro de psicotrópicos, vigencia y aviso legal— vive plegado en “Ajustes avanzados”. Casi nunca hace falta abrirlo.',
      'Cuando cambies algo, abajo aparece una barra con “Guardar”. Mientras esa barra esté puesta, hay cambios sin guardar.',
      'El recuadro cian de la vista previa marca dónde caerán los medicamentos. Si se encima con algo impreso de tu papel, arrastra sus bordes hasta la zona libre.',
      'Cada médico del consultorio tiene su propia receta y su propia firma: lo que configures aquí aplica solo a las tuyas.',
      'Las NOTAS (evolución, ingreso, egreso) tienen su propio papel y su propia hoja membretada, dentro de “Ajustes avanzados”. Cambiar el papel de la receta no mueve el de las notas.',
    ],
    ojo: [
      'MUY IMPORTANTE — el tamaño también hay que elegirlo en la impresora. La app manda el tamaño correcto, pero el diálogo de impresión de tu computadora decide el papel físico. Ahí revisa: (1) “Tamaño del papel” = el mismo que elegiste; si no aparece, créalo con “Administrar tamaños personalizados”; (2) “Escala” = 100 %, nunca “Ajustar al papel”; (3) “Orientación” = vertical u horizontal según tu hoja. Si la miniatura se ve como una hoja grande con tu receta chiquita adentro, es este paso.',
      'Si no tienes papel cortado a la medida, pulsa “No cuadró” en el paso 3 y en “¿En qué papel imprime tu impresora?” deja “Hoja carta + corte”: sale en una hoja carta normal con una línea punteada para recortar. Funciona en cualquier impresora.',
      'Al imprimir una receta real se abre una ventana limpia con SOLO la receta. Si tu navegador bloquea las ventanas emergentes, permítelas para este sitio o usa “Descargar PDF”.',
    ],
  },
  {
    id: 'hospital', titulo: 'Hospitalización', roles: ['medico', 'enfermeria'],
    intro: 'Censo, indicaciones/MAR, interconsultas, signos y egreso.',
    pasos: [
      { t: 'Ingresar', d: 'Hospitalización → "Ingresar": paciente, servicio y cama. Queda como episodio activo en el censo.' },
      { t: 'La ficha', d: 'Toca al paciente del censo: pestañas Notas, Indicaciones · MAR, Signos, Laboratorio, Enfermería, Interconsultas.' },
      { t: 'Indicaciones/MAR', d: 'Agregas medicamentos y cuidados; enfermería registra cada administración (MAR) con los 5 correctos.' },
      { t: 'Interconsultas por WhatsApp', d: '"Solicitar interconsulta": eliges especialidad/médico y le llega WhatsApp con el motivo; su respuesta te regresa.' },
      { t: 'Signos y NEWS2', d: 'Enfermería registra signos; la app calcula el NEWS2 (riesgo de deterioro) y grafica tendencias.' },
      { t: 'Egresar', d: '"Egresar": motivo + nota de egreso. Sale del censo pero queda en el expediente.' },
    ],
    tips: ['UN solo expediente por paciente: consulta y hospital viven juntos.'],
  },
  {
    id: 'equipo', titulo: 'Tu equipo (médicos y personal)', roles: ['dueno', 'medico'],
    intro: 'Invitar médicos, asistentes, enfermería con el permiso correcto.',
    pasos: [
      { t: 'Abrir Equipo', d: 'Configuración → Equipo (asistentes y hospital) o Médicos.' },
      { t: 'Invitar', d: 'Nombre + correo + ROL (especialidades médicas, psicología, nutrición, enfermería, farmacia, laboratorio, recepción, admin).' },
      { t: 'Se crea solo', d: 'Si el rol es una especialidad médica, se crea también su ficha para que aparezca en la agenda.' },
      { t: 'La invitación', d: 'Se genera un enlace/código; la persona entra con su correo y tiene acceso a lo que le toca.' },
    ],
    tips: ['La asistente/secretaria NO cuenta como médico para el cobro.', 'Cada médico adicional se cobra aparte (ver "Planes y cobro").'],
  },
  {
    id: 'facturas', titulo: 'Pedir factura (CFDI)', roles: ['medico', 'recepcion', 'dueno'],
    intro: 'Si necesitas factura de tus pagos, la pides tú mismo — solo cuando la quieras.',
    pasos: [
      { t: 'Abre Facturas', d: 'Configuración → Mi suscripción → sección "Facturas". Ves tus pagos.' },
      { t: 'Solicita', d: 'En el pago que quieras facturar, "Solicitar factura", y captura tus datos fiscales: RFC, razón social, régimen fiscal, uso de CFDI y código postal.' },
      { t: 'Descarga', d: 'Se timbra tu CFDI 4.0 ante el SAT y descargas el PDF y el XML. Tus datos se guardan para la próxima.' },
    ],
    ojo: ['Verifica que tus datos coincidan EXACTO con tu Constancia de Situación Fiscal — el SAT rechaza si no.'],
  },
  {
    id: 'soporte', titulo: 'Soporte y sugerencias', roles: ['todos'],
    intro: 'Manda quejas, fallas, dudas, sugerencias o felicitaciones.',
    pasos: [
      { t: 'Abre Soporte', d: 'Configuración → "Soporte y sugerencias".' },
      { t: 'Elige el tipo y escribe', d: 'Falla, duda, sugerencia, queja o felicitación. Escribe tu mensaje y envía.' },
      { t: 'Te contestamos', d: 'Tu mensaje llega al equipo; si hace falta, te contactamos por correo.' },
    ],
    tips: ['También puedes preguntarle al asistente (bot de ayuda) aquí mismo en la Guía.'],
  },
  {
    id: 'planes', titulo: 'Planes, créditos y cobro (para el dueño)', roles: ['dueno'],
    intro: 'Cómo están armados los planes y cómo cobrar sin perder.',
    pasos: [
      { t: 'Los planes', d: 'Agenda ($349, sin IA) · Clínica ($899, 200 créditos, IA Estándar) · Pro ($1,590, 450 créditos, IA Máxima) · Hospital + UCI ($3,499).' },
      { t: 'Cobro por médico', d: 'Cada plan incluye 1 médico; cada médico adicional se cobra aparte (Clínica +$499, Pro +$999) y trae su propia bolsa de créditos. La asistente no cuenta.' },
      { t: 'Nunca pierdes', d: 'Los créditos son proporcionales al costo real de la IA, y el modo económico gratis tiene un tope al mes: aunque un consultorio tenga varios médicos, tu costo queda acotado.' },
      { t: 'La consola del dueño', d: '/superadmin: ves todas las clínicas, quién paga, das pase libre, cambias nivel de IA, eliminas consultorios de prueba. Botones "Contabilidad" (ingresos, costos, utilidad, export CSV) y "Soporte" (buzón de mensajes).' },
      { t: 'Recarga y facturación', d: 'Los clientes compran recargas de créditos y piden su factura (CFDI) solos desde la app.' },
    ],
  },
  {
    id: 'cuenta', titulo: 'Tu cuenta, contraseña y sesión', roles: ['todos'],
    intro: 'Entrar, salir, recuperar la contraseña y el segundo factor.',
    pasos: [
      { t: 'Entrar', d: 'Con tu correo y contraseña, o con el botón «Continuar con Google». Si entras con Google, elige SIEMPRE el correo correcto en el selector: con otro correo verás una cuenta vacía distinta, no la tuya.' },
      { t: 'Olvidaste la contraseña', d: 'Escribe tu correo en el campo de arriba y pulsa «¿Olvidaste tu contraseña?». Te llega un enlace para ponerte una nueva. Revisa también la carpeta de spam.' },
      { t: 'Verificación en dos pasos', d: 'Si tu cuenta la tiene activada, después de la contraseña te pide el código de 6 dígitos de tu app de autenticación. Si el código no lo acepta, abre la app y escribe el ACTUAL: caducan cada 30 segundos.' },
      { t: 'La sesión se cierra sola', d: 'Tras un rato sin usarla, Ausculta cierra la sesión. Es a propósito: en un consultorio la pantalla queda a la vista de quien pase.' },
      { t: 'Al cerrar sesión', d: 'Se borra lo que estaba guardado en ese navegador. Si compartes computadora, cierra sesión al terminar.' },
    ],
    ojo: ['Ausculta nunca te pedirá tu contraseña por correo ni por WhatsApp.'],
  },
  {
    id: 'pacientes', titulo: 'Pacientes y expediente', roles: ['recepcion', 'medico'],
    intro: 'Dar de alta, buscar y leer la historia completa de alguien.',
    pasos: [
      { t: 'Buscar antes de crear', d: 'Escribe el nombre en el buscador. Ausculta busca también con los apellidos al revés y con variantes de escritura, justamente para que no acabes con la historia partida en dos expedientes.' },
      { t: 'Dar de alta', d: 'Pacientes → «Nuevo». Nombre, fecha de nacimiento, sexo y teléfono bastan para empezar; lo demás se llena solo con las consultas.' },
      { t: 'Abrir el expediente', d: 'Toca al paciente. Arriba, lo que hay que saber ahora: alergias, problemas activos y lo que está tomando. Abajo, la línea de tiempo con todo lo que ha pasado.' },
      { t: 'Leer la línea de tiempo', d: 'Va de lo más reciente a lo más antiguo: consultas, notas firmadas, recetas, órdenes, resultados y documentos. Puedes filtrar por tipo.' },
      { t: 'Alergias', d: 'Las alergias que aparecen no son sólo las que alguien tecleó: Ausculta las relee de las notas ya firmadas. Una alergia dicha en una consulta de hace dos años sigue avisando hoy.' },
    ],
    tips: ['Desde el expediente puedes abrir el Consultor con el contexto de ESE paciente, para que la respuesta tenga en cuenta su edad, sus alergias y lo que toma.'],
  },
  {
    id: 'estado-paciente', titulo: 'Sospechado, confirmado, activo, resuelto', roles: ['medico'],
    intro: 'Qué significa cada etiqueta del expediente. Confundirlas es el error caro.',
    pasos: [
      { t: 'Sugerido ≠ confirmado', d: 'Lo que la IA propone sale marcado como propuesto hasta que tú lo confirmas. Un diagnóstico propuesto no entra al expediente como diagnóstico del paciente.' },
      { t: 'Descartado es descartado', d: 'Si marcas algo como descartado, deja de contar como diagnóstico: no llega a los motores de seguridad ni al texto que la IA redacta. «Embarazo descartado» no puede volverse «cursa embarazo».' },
      { t: 'Activo ≠ histórico', d: 'Lo que el paciente tiene hoy y lo que tuvo se pintan distinto. Una mención de pasado —«le dieron warfarina cuando la operaron»— se señala mientras recetas, pero NO se convierte en medicación vigente por su cuenta.' },
      { t: 'La duda se conserva', d: 'Si el paciente dijo «creo que me dijeron que tenía anemia», eso queda como una duda registrada, no como «Anemia». Y llega a la consulta siguiente.' },
      { t: 'Vacío es vacío', d: 'Un campo en blanco significa que nadie lo dijo — no que el paciente lo niegue. Ausculta no lo rellena para que la nota se vea completa.' },
    ],
    ojo: ['Ausculta nunca reclasifica sola lo que tú marcaste. Si algo cambió de estado, fuiste tú o quedó registrado quién fue.'],
  },
  {
    id: 'firma', titulo: 'Firmar la nota', roles: ['medico'],
    intro: 'El acto medicolegal del producto. Qué revisa antes, qué pasa después y qué hacer si el botón está apagado.',
    pasos: [
      { t: 'Antes de firmar, revisa la barra de avisos', d: 'Tres cosas nunca se pliegan y hay que resolverlas: una alergia del paciente contra algo que estás recetando, una contradicción con lo que el paciente negó, y una dosis peligrosa. El resto de los avisos sí se pliegan.' },
      { t: 'Si el botón está apagado', d: 'Dice su motivo. Suele ser un campo que la NOM-004 exige y que está vacío, o un aviso que no se ha resuelto. No adivines: lee lo que dice el botón.' },
      { t: 'Firmar', d: 'Al firmar, la nota queda sellada. Ya no se edita: si hay que corregirla, se hace una nota nueva que la referencia — así lo pide la norma y así se sostiene después.' },
      { t: 'Lo que se guarda con la firma', d: 'Además del texto: los avisos que revisaste, las dudas que quedaron abiertas y la procedencia de cada frase. Todo eso se sella ANTES del hash, o la nota se reabriría marcada como alterada.' },
      { t: 'Firmar no es liberar', d: 'Firmar la nota y darle información al paciente son dos actos distintos, y se registran aparte. El paciente NUNCA ve un borrador.' },
    ],
    ojo: ['Antes de firmar puedes editar y descartar libremente. Después, no. Tómate el momento de revisar.'],
  },
  {
    id: 'ordenes', titulo: 'Órdenes, resultados y seguimiento', roles: ['medico'],
    intro: 'Pedir un estudio no cierra nada. Aquí se sigue hasta que hay una decisión.',
    pasos: [
      { t: 'Pedir el estudio', d: 'Desde la consulta, «Orden». Sale con tu membrete y tu firma, y el paciente se la lleva impresa o la recibe por WhatsApp.' },
      { t: 'Dónde vive después', d: 'En «Pendientes». Ahí está todo lo que quedó abierto, agrupado por lo que hay que hacer: Vencidos · Necesita revisión · Esperando resultado · Necesita agendar · Esperando al paciente · Otros.' },
      { t: 'Cuando llega el resultado', d: 'Se adjunta a la orden. La tarea pasa a «Necesita revisión»: hecha, pero nadie la ha mirado todavía.' },
      { t: 'Revisar no es decidir', d: 'Al revisarla registras qué decidiste (ajustar tratamiento, repetir, citar, nada). Son dos pasos distintos a propósito: un resultado leído y un resultado sobre el que se actuó no son lo mismo.' },
      { t: 'Si el resultado es crítico', d: 'Además hay que dejar constancia de que se avisó al paciente. Un resultado crítico cerrado sin que nadie llamara no puede verse igual que uno donde sí se llamó.' },
      { t: 'Cerrar', d: 'Cerrar pasa por un formulario corto. No es lo mismo que mover la tarea de estado, y no se puede cerrar sin haber mirado el resultado.' },
    ],
    tips: ['Lo que hay que escalar aparece arriba y aparte, no mezclado con lo demás.'],
  },
  {
    id: 'portal', titulo: 'El portal del paciente', roles: ['medico', 'recepcion'],
    intro: 'Lo que el paciente ve, y lo que no.',
    pasos: [
      { t: 'Cómo entra', d: 'Con un enlace seguro, sin contraseña. El enlace está atado a ESE paciente de ESE consultorio.' },
      { t: 'Qué ve', d: 'Sus próximas citas, sus recetas, los documentos que le liberaste, y puede reagendar.' },
      { t: 'Qué NO ve', d: 'Nada que esté en borrador. Un paquete de información al paciente nace en borrador y sólo lo ve cuando alguien autorizado lo libera, con la fecha y el nombre de quién lo hizo.' },
      { t: 'Cuidadores', d: 'Un familiar autorizado es una autorización explícita, revocable y con bitácora — no un segundo dueño del expediente.' },
    ],
    ojo: ['Un enlace de paciente se reenvía por WhatsApp y acaba en sitios que nadie controla. Compártelo sólo con quien debe tenerlo.'],
  },
  {
    id: 'privacidad', titulo: 'Privacidad y seguridad', roles: ['todos'],
    intro: 'Qué protege Ausculta, y qué te toca a ti.',
    pasos: [
      { t: 'Tu consultorio está aislado', d: 'Ningún otro consultorio puede ver a tus pacientes. El aislamiento se aplica en el servidor, no escondiendo botones en la pantalla.' },
      { t: 'Permisos por rol', d: 'Tu asistente ve agenda y datos de contacto; la información clínica sensible y la configuración, no. No es una vista simplificada: son permisos de verdad.' },
      { t: 'La información es tuya', d: 'Puedes llevártela. Al cancelar te entregamos la exportación completa de pacientes y expedientes.' },
      { t: 'Derechos del paciente', d: 'Si un paciente pide su expediente, se le ENTREGA: el expediente completo más un acuse. Si algo no se pudo leer, se declara en vez de omitirlo.' },
      { t: 'Lo que te toca a ti', d: 'Cierra sesión en computadoras compartidas, no compartas tu contraseña, y activa la verificación en dos pasos si atiendes desde varios equipos.' },
    ],
    tips: ['El estado de cada control de seguridad está publicado en la página /seguridad, incluidos los que todavía no están listos.'],
  },
  {
    id: 'problemas', titulo: 'Cuando algo falla', roles: ['todos'],
    intro: 'Los tropiezos más comunes y qué hacer con cada uno.',
    pasos: [
      { t: 'Se fue el internet a media consulta', d: 'Sigue grabando. El audio no se pierde: queda guardado y lo procesas cuando vuelva la conexión. Verás un aviso de que estás sin red.' },
      { t: 'La IA tardó o falló', d: 'El audio sigue ahí. Vuelve a «Procesar con IA»: no hay que volver a dictar. Si cambiaste de pantalla mientras pensaba, siguió trabajando y el resultado te espera.' },
      { t: 'La nota entendió algo mal', d: 'Corrígela: a mano en el campo, o por chat («la dosis es 500 mg»). El cambio es real, no cosmético — lo que quitas de la nota sale de la nota.' },
      { t: 'No separó las voces', d: 'Ausculta te dice por qué en vez de repartir las frases al azar. Suele ser audio con mucho ruido, o que la separación no está habilitada en la configuración del consultorio.' },
      { t: 'La receta salió descuadrada', d: 'Configuración → «Recetas, órdenes y notas» → «Ajustar dónde caen los datos», y arrastra la etiqueta a su sitio. Se hace una vez.' },
      { t: 'Entré y la cuenta está vacía', d: 'Casi siempre es haber entrado con otro correo de Google. Cierra sesión y vuelve a entrar eligiendo el correo correcto en el selector.' },
      { t: 'Se acabaron los créditos', d: 'La IA no se detiene: sigue en ⚡ Rápida sin costo hasta un tope al mes. Para recuperar la máxima, recarga o sube de plan.' },
    ],
    tips: ['Si nada de esto lo resuelve, Configuración → «Soporte y sugerencias», o pregúntale al asistente de esta misma guía.'],
  },
  {
    id: 'navegacion', titulo: 'Trucos y móvil', roles: ['todos'],
    intro: 'Para moverte rápido y usar todo desde el celular.',
    pasos: [
      { t: 'Regresar', d: 'La flecha "← Atrás" te devuelve a donde estabas, no a un lugar fijo.' },
      { t: 'Menú en celular', d: 'La barra de abajo tiene los accesos; el botón ☰ abre todo lo demás.' },
      { t: 'Se actualiza solo', d: 'Cuando hay versión nueva, se aplica sola al cerrar y reabrir la app.' },
      { t: 'No pierdes lo escrito', d: 'Si cambias de pantalla mientras la IA piensa, sigue trabajando y el resultado te espera.' },
    ],
  },
]

/** Serializa la guía a texto plano para dárselo como contexto al bot de ayuda. */
export function conocimientoTexto(): string {
  return GUIA.map(s => {
    const pasos = s.pasos.map(p => `- ${p.t}: ${p.d}`).join('\n')
    const tips = s.tips?.length ? `\nTips: ${s.tips.join(' ')}` : ''
    const ojo = s.ojo?.length ? `\nOjo: ${s.ojo.join(' ')}` : ''
    return `## ${s.titulo}\n${s.intro}\n${pasos}${tips}${ojo}`
  }).join('\n\n')
}
