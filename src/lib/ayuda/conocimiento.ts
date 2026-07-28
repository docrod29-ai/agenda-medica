/**
 * BASE DE CONOCIMIENTO de la app (NexusMED). Fuente ÚNICA que alimenta:
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
    ojo: ['La separación de voces (médico/paciente) requiere que el dueño tenga configurada la llave de AssemblyAI; si no, transcribe sin separar.'],
  },
  {
    id: 'menu-ia', titulo: 'Menú de IA y créditos (MUY importante)', roles: ['medico', 'dueno'],
    intro: 'Cada nota se hace con un "motor" de IA. Elegir bien te ahorra créditos.',
    pasos: [
      { t: '⚡ Rápida (Haiku)', d: 'La más económica. Ideal para notas simples o de seguimiento. Cuesta 1 crédito.' },
      { t: '⭐ Estándar (Sonnet 5 + separación de voces)', d: 'El día a día, muy buena. Cuesta 3 créditos. Es el default del plan Clínica.' },
      { t: '💎 Máxima (Opus 4.8 + GPT-5 + 2ª opinión)', d: 'El máximo razonamiento, para casos complejos. Cuesta 10 créditos. Es el default del plan Pro.' },
      { t: '¿Por qué cuestan distinto?', d: 'Porque los modelos de IA cuestan distinto de verdad: Rápida es un modelo ligero y barato; Máxima usa DOS inteligencias top (Opus de Anthropic + GPT-5 de OpenAI) que son mucho más caras. Los créditos son proporcionales a ese costo real.' },
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
      { t: 'La IA corrige SOLO eso', d: 'Cambia únicamente lo que pediste, sin inventar ni tocar lo demás. Usa doble cerebro (Claude + GPT) para verificar que no se pase.' },
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
      { t: 'Doble cerebro', d: 'La respuesta la redacta Claude y la revisa/mejora GPT contra la misma evidencia — verás "Razonado por Claude + GPT".' },
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
    id: 'recetas', titulo: 'Configurar tu receta (paso a paso)', roles: ['medico'],
    intro: 'Deja la receta idéntica a tu papel. Son 7 pasos y se hace UNA sola vez.',
    pasos: [
      {
        t: '1. Mide tu papel con una regla',
        d: 'Antes de tocar la app, mide tu receta de borde a borde, en centímetros: primero el ANCHO, luego el ALTO. Anótalo (por ejemplo 13 × 23 cm). Todo lo demás depende de este número; si lo pones mal, la receta sale corrida.',
      },
      {
        t: '2. Entra al editor',
        d: 'Configuración → “Recetas y órdenes” (grupo Documentos clínicos). A la derecha verás una vista previa en vivo: cada cambio se refleja al momento.',
      },
      {
        t: '3. Elige el tamaño de papel',
        d: 'En “Tamaño de papel” escoge el que coincida con tu medida: Receta vertical (13 × 23 cm), Receta acostada (23 × 13 cm), Media carta, Carta, A4, Oficio o A5. Si el tuyo no está, elige “Personalizado” y escribe el ancho y el alto en milímetros (13 cm = 130 mm).',
      },
      {
        t: '4. Sube tu formato (si ya tienes papel impreso)',
        d: 'En “Usa TU propia receta” sube una foto o PDF de tu papel membretado. La app lo pone de fondo y solo encima los datos del paciente, los medicamentos y la firma. Si no tienes papel propio, sáltate esto: la app genera un encabezado con los datos de tu consultorio y también en “Membrete” puedes subir solo tu logo/encabezado.',
      },
      {
        t: '5. Si tu papel YA trae líneas de Nombre/Edad/Fecha',
        d: 'Activa la casilla “Mi diseño ya tiene campos del paciente impresos”. Así la app no vuelve a dibujar esas líneas encima de las tuyas. Después, en “Coloca cada dato en tu formato”, arrastra las etiquetas (Nombre, Edad, Fecha, Folio, QR, Firma) justo sobre las líneas de tu papel. El botón “Detectar campos con IA” los coloca solos y tú nada más los acomodas.',
      },
      {
        t: '6. Sube tu firma',
        d: 'Firma en una hoja BLANCA con plumón negro, tómale foto de frente con buena luz y recórtala. Súbela en la sección de firma. Aparecerá en la receta y en las notas. También puedes ajustar su tamaño con el deslizador.',
      },
      {
        t: '7. Guarda y haz una prueba',
        d: 'Pulsa “Guardar template”. Luego “Imprimir prueba”: saca una receta de ejemplo con un paciente ficticio. Compárala contra tu papel real antes de usarla con un paciente.',
      },
    ],
    tips: [
      'El recuadro cian de la vista previa marca dónde caerán los medicamentos. Si se encima con algo impreso de tu papel, arrastra sus bordes (o usa el ajuste fino en mm) hasta que quede en la zona libre.',
      'Cada médico del consultorio tiene su propia receta: lo que configures aquí aplica solo a tus recetas y órdenes.',
      'Las NOTAS (evolución, ingreso, egreso) tienen su propio ajuste, “Tamaño de papel de las notas”, y vienen en carta. Cambiar el papel de la receta no mueve el de las notas.',
    ],
    ojo: [
      'MUY IMPORTANTE — el tamaño también hay que elegirlo en la impresora. La app manda el tamaño correcto, pero el diálogo de impresión de tu computadora decide el papel físico. Ahí revisa: (1) “Tamaño del papel” = el mismo que elegiste; si no aparece, créalo con “Administrar tamaños personalizados”; (2) “Escala” = 100 %, nunca “Ajustar al papel”; (3) “Orientación” = vertical u horizontal según tu hoja. Si la miniatura se ve como una hoja grande con tu receta chiquita adentro, es este paso.',
      'Si no tienes papel cortado a la medida, elige el tamaño de tu receta y en “¿En qué papel imprime tu impresora?” deja “Hoja carta + corte”: sale en una hoja carta normal con una línea punteada para recortar. Funciona en cualquier impresora.',
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
