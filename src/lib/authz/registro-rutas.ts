/**
 * REGISTRO DE RUTAS — cada ruta de API declara qué exige (unidad Nexus OS E0-07).
 *
 * ESTO ES EL CRITERIO DE ACEPTACIÓN de la unidad: «cada ruta declara la capacidad
 * que exige; no hay any-member implícito». El registro no es documentación, es un
 * dato que `src/__tests__/authz-rutas-declaradas.test.ts` cruza contra los archivos
 * en disco:
 *  - toda ruta de `src/app/api/**​/route.ts` tiene que estar aquí (una ruta nueva
 *    sin declarar pone los tests en rojo),
 *  - no puede haber claves zombis (declarar una ruta que ya no existe),
 *  - toda exención (`publica`/`webhook`/`cron`/`sesion`/`tokenPaciente`/`porAccion`)
 *    tiene que traer `motivo` NO VACÍO: se puede eximir una ruta, pero no en
 *    silencio,
 *  - y el registro no puede MENTIR sobre el código: si declara una capacidad ya
 *    activa, el archivo tiene que llamar de verdad a `verificarCapacidad(`.
 *
 * MÓDULO PURO: solo importa el núcleo de capacidades. Ni `next/server` ni Firebase.
 *
 * ALCANCE EJECUTADO EN E0-07 (regla 5 de la carta operativa: no romper acceso a
 * usuarios reales a ciegas). Se migró el código de las rutas cuyo conjunto de roles
 * NO cambia (todas las de `verificarMedico`, más `hospital/mutar`, `hospital/alerta`
 * y `auditoria/registrar`). Las rutas que ESTRECHAN el acceso de un usuario real
 * quedan declaradas con su capacidad definitiva y con `activacionPendiente`: siguen
 * ejecutando el guardián antiguo hasta que el médico dueño responda Q1–Q5 (ver
 * `docs/roadmap/nexus-os/unidades/E0-07/RESULTADO.json`). Declaradas con capacidad
 * y con la espera anotada por escrito NO son «any-member implícito».
 */
import type { Capacidad } from './capabilities'

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * `activacionPendiente`: la ruta YA declara su capacidad definitiva, pero al menos
 * una de sus ramas sigue usando el guardián antiguo porque activarla estrecharía el
 * acceso de alguien real. El texto dice QUÉ decisión falta. El guardián de tests
 * comprueba que ese estado es real (el archivo aún llama al helper viejo), así que
 * no sirve como escotilla para dejar una ruta sin migrar «por si acaso».
 */
export type ExigenciaRuta =
  /** Una sola capacidad para todos los métodos de la ruta. */
  | { tipo: 'capacidad'; capacidad: Capacidad; activacionPendiente?: string }
  /**
   * Capacidad distinta por verbo HTTP (típico: GET lee, POST configura).
   *
   * NO tiene `activacionPendiente` a nivel de ruta A PROPÓSITO: ese era el agujero
   * P1-3 de la verificación adversarial. Un pendiente de RUTA apagaba la
   * comprobación de TODOS los métodos, así que el `POST` que el registro declaraba
   * «ya migrado» podía volver a `verificarMiembro` con la suite en verde — y el POST
   * de `clinic/ai-keys` ESCRIBE las llaves de IA del consultorio. Aquí el pendiente
   * es POR MÉTODO, con el texto de qué decisión falta.
   */
  | {
      tipo: 'porMetodo'
      metodos: Partial<Record<Metodo, Capacidad>>
      pendientePorMetodo?: Partial<Record<Metodo, string>>
    }
  /** Gateway con sub-acciones en el body: la capacidad depende de la acción. */
  | { tipo: 'porAccion'; acciones: Readonly<Record<string, Capacidad>>; motivo: string }
  /** Entitlement de PLAN (módulo contratado) + capacidad de ROL. */
  | { tipo: 'entitlementIA'; modulo: string; capacidad: Capacidad; activacionPendiente?: string }
  /** OR con el token HMAC del paciente. `capacidadAlternativa` = la rama del equipo. */
  | { tipo: 'tokenPaciente'; capacidadAlternativa?: Capacidad; motivo: string; activacionPendiente?: string }
  /** Solo sesión válida: no hay clínica todavía o el recurso es del propio uid. */
  | { tipo: 'sesion'; motivo: string }
  /** Consola del dueño de la plataforma. */
  | { tipo: 'superadmin' }
  /** Deliberadamente sin sesión (portal del paciente, perfil público, OAuth). */
  | { tipo: 'publica'; motivo: string }
  /** Autenticada por firma del proveedor, no por sesión de usuario. */
  | { tipo: 'webhook'; motivo: string }
  /** Autenticada por secreto de cron. */
  | { tipo: 'cron'; motivo: string }

/**
 * Acciones de `POST /api/hospital/mutar` → capacidad. Sustituye al mapa `GATES` de
 * roles sueltos que vivía en la propia ruta.
 *
 * INVARIANTE PROBADO (test de tabla con el `GATES` viejo copiado literal como
 * oráculo): para las 18 acciones, `rolesCon(ACCIONES_HOSPITAL_MUTAR[a])` es
 * EXACTAMENTE el conjunto de roles que `GATES[a]` autorizaba. Es una traducción de
 * vocabulario, no un cambio de política: cualquier deriva rompería el pase de
 * visita de enfermería o la verificación de farmacia.
 */
export const ACCIONES_HOSPITAL_MUTAR: Readonly<Record<string, Capacidad>> = {
  // Episodio: abrir, cerrar, mover, cambiar tratante → acto médico.
  crear: 'clinico.escribir',
  egresar: 'clinico.escribir',
  trasladar: 'clinico.escribir',
  cambiar_tratante: 'clinico.escribir',
  // Indicaciones y conciliación → prescripción.
  indicacion_agregar: 'prescribir',
  indicacion_suspender: 'prescribir',
  indicacion_editar: 'prescribir',
  indicacion_borrar: 'prescribir',
  conciliar: 'prescribir',
  // Interconsultas → acto médico sobre el expediente.
  interconsulta_agregar: 'clinico.escribir',
  interconsulta_responder: 'clinico.escribir',
  interconsulta_editar: 'clinico.escribir',
  interconsulta_borrar: 'clinico.escribir',
  // Enfermería en la cabecera.
  administrar: 'medicamento.administrar',
  balance: 'pase.registrar',
  escala: 'pase.registrar',
  sbar: 'pase.registrar',
  // Farmacia.
  verificar_farmacia: 'farmacia.verificar',
}

/** Motivo por el que las rutas de IA todavía no exigen rol (pregunta Q1 al dueño). */
const PENDIENTE_Q1 =
  'Q1 — ¿la enfermería de UCI dicta y usa el copiloto, o solo el médico? Activar ' +
  '`clinico.escribir` cerraría el hueco de que un rol no clínico pida una nota ' +
  'redactada por la API de IA, pero dejaría fuera a enfermería si sí lo usa.'

const PENDIENTE_AGENDA =
  'Estrecha a enfermería/farmacia/laboratorio, que hoy pasan por ser miembros. ' +
  'Pendiente de confirmar con el dueño que ningún flujo real de su consultorio ' +
  'depende de que el staff clínico agende o mande mensajes.'

/**
 * LA DECLARACIÓN. Clave = ruta relativa a `src/app/api` SIN `/route.ts`
 * (ej. `hospital/mutar`). Orden alfabético, igual que el walker del test, para que
 * comparar registro y disco a ojo sea posible.
 */
export const REGISTRO_RUTAS: Readonly<Record<string, ExigenciaRuta>> = {
  // ── agenda y portal ──────────────────────────────────────────────────────
  'appointments': {
    tipo: 'capacidad', capacidad: 'agenda.gestionar', activacionPendiente: PENDIENTE_AGENDA,
  },
  'calendar/calendars': { tipo: 'sesion', motivo: 'Lista los calendarios de Google DEL PROPIO uid con su token; no toca datos de la clínica.' },
  'calendar/callback': { tipo: 'publica', motivo: 'Callback OAuth de Google: llega sin sesión y se valida con el `state` firmado.' },
  'calendar/connect': { tipo: 'sesion', motivo: 'Arranca el OAuth del PROPIO uid; el token se guarda en googleTokens/{uid}.' },
  /**
   * Lee los intervalos ocupados del Google Calendar DEL PROPIO uid (su token
   * personal en `googleTokens/{uid}`) para no ofrecer horas que ya tiene
   * tomadas. No trae títulos ni asistentes: sólo intervalos.
   */
  'calendar/ocupado': { tipo: 'capacidad', capacidad: 'agenda.gestionar' },
  'calendar/status': { tipo: 'sesion', motivo: 'Estado y desconexión del vínculo de Google DEL PROPIO uid.' },
  'calendar/sync': {
    tipo: 'capacidad', capacidad: 'agenda.gestionar', activacionPendiente: PENDIENTE_AGENDA,
  },
  'portal/link': {
    tipo: 'capacidad', capacidad: 'agenda.gestionar',
    activacionPendiente:
      'Emite el magic-link del paciente con alcance `agenda` (nunca `clinico`, ' +
      'cerrado en E0-06) y lo usa la asistente del mostrador. `agenda.gestionar` ' +
      'la incluye, pero estrecha a enfermería/farmacia/laboratorio. ' + PENDIENTE_AGENDA,
  },
  'public/availability/[clinicId]': { tipo: 'publica', motivo: 'Huecos libres para el booking público del paciente. Por diseño sin sesión.' },
  'public/booking': { tipo: 'publica', motivo: 'Agendado público del paciente. Rate-limit + validación de campos en la propia ruta.' },
  'public/clinic/[clinicId]': { tipo: 'publica', motivo: 'Perfil público del consultorio (SEO). Solo datos ya publicados.' },
  'public/resena': { tipo: 'publica', motivo: 'El paciente deja reseña con un token de un solo uso; la publicación la moderan después.' },

  // La ESTANCIA en UCI (ICUStay): ingreso a la unidad y soportes activos. Pasa
  // por el servidor porque `icu_stays` tiene create/update/delete: if false en
  // las reglas — a diferencia de `icu_observations`, que enfermería captura a
  // pie de cama. Leer es del equipo clínico del piso; declarar de qué soportes
  // depende el paciente es del médico, porque de eso cuelga cómo se adapta la
  // interfaz (charter §32).
  'uci/estancia': {
    tipo: 'porMetodo',
    metodos: { GET: 'clinico.leer', POST: 'clinico.escribir' },
  },

  // ── expediente e IA clínica (entitlement de plan + rol) ───────────────────
  'consultor-evidencia': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/exportar/[patientId]': { tipo: 'capacidad', capacidad: 'clinico.escribir' },
  'expediente/antibiograma-razonar': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/antibiograma-vision': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/atribuir-roles': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/corregir': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/evidencia': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/extraer-entidades': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/laboratorio-vision': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/procesar': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/transcribir': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/transcribir-chunk': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/transcribir-diarizado': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'expediente/verificar-nota': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'inmuno/redactar': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'receta/detectar-campos': { tipo: 'entitlementIA', modulo: 'expediente', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },
  'uci/copilot': { tipo: 'entitlementIA', modulo: 'uci', capacidad: 'clinico.escribir', activacionPendiente: PENDIENTE_Q1 },

  // ── expediente: export e interoperabilidad ───────────────────────────────
  'fhir/paciente/[patientId]': {
    // Export COMPLETO del expediente. NO se mapea a `clinico.leer` (que incluiría a
    // enfermería/farmacia/laboratorio): un export íntegro de PHI no es «leer una
    // nota en el pase de visita». Se conserva su gate real de hoy, {medico, admin}.
    tipo: 'capacidad', capacidad: 'clinico.escribir',
  },
  'hl7/convertir': {
    tipo: 'capacidad', capacidad: 'clinico.leer',
    activacionPendiente: 'Convierte PHI a HL7 v2. Estrecha a `secretaria`, que hoy pasa por ser miembro.',
  },

  // ── hospitalización ──────────────────────────────────────────────────────
  'hospital/alerta': { tipo: 'capacidad', capacidad: 'clinico.leer' },
  'hospital/mutar': {
    tipo: 'porAccion', acciones: ACCIONES_HOSPITAL_MUTAR,
    motivo: 'Gateway de mutaciones del internamiento: la capacidad depende de la acción del body (18 acciones), no del verbo HTTP.',
  },

  /**
   * La «C» de ARCO. `administrar` porque suprimir o bloquear un expediente es
   * decisión del responsable del tratamiento de los datos, no del mostrador.
   */
  'arco/acceso': { tipo: 'capacidad', capacidad: 'administrar' },
  'arco/cancelar': { tipo: 'capacidad', capacidad: 'administrar' },

  // ── cobro y facturación ──────────────────────────────────────────────────
  'facturacion/descargar': {
    tipo: 'capacidad', capacidad: 'facturar',
    // RESUELTO 2026-08-01 (Q4): la asistente FACTURA, no sólo cobra. Timbrar el
    // CFDI del cobro que acaba de registrar es el mismo trabajo, en el mismo
    // mostrador, y el paciente pide la factura ahí mismo.
  },
  'facturacion/pagos': {
    tipo: 'capacidad', capacidad: 'cobrar',
    activacionPendiente: 'Estrecha a enfermería/farmacia/laboratorio, que hoy leen los pagos por ser miembros.',
  },
  'facturacion/solicitar': {
    // Timbrado CFDI. `facturar` AMPLÍA hacia el rol `facturacion`, pero ese rol no
    // es asignable hoy (ROLES_ASIGNABLES): ningún usuario real gana acceso, y el
    // test del invariante de ampliación lo fija.
    tipo: 'capacidad', capacidad: 'facturar',
  },
  'payment/create-checkout': { tipo: 'tokenPaciente', motivo: 'El PACIENTE paga su anticipo desde el portal con el token HMAC de su cita; no hay sesión de equipo.' },
  'stripe/asientos': {
    tipo: 'porMetodo', metodos: { GET: 'administrar', POST: 'administrar' },
    // El POST ya EXIGE `administrar` y el guardián lo fija en el código; el pendiente
    // es solo del GET (ver `pendientePorMetodo` en el tipo).
    pendientePorMetodo: {
      GET: 'El GET (estado de asientos y precio) sigue en `verificarMiembro`: activarlo lo cerraría a todo el que no sea medico/admin. Pendiente de Q7 del dueño.',
    },
  },
  'stripe/checkout': { tipo: 'capacidad', capacidad: 'administrar' },
  'stripe/portal': { tipo: 'capacidad', capacidad: 'administrar' },
  'stripe/recarga': { tipo: 'capacidad', capacidad: 'administrar' },
  'stripe/webhook': { tipo: 'webhook', motivo: 'Firma `stripe-signature` verificada con el secreto del endpoint. No hay usuario.' },

  // ── consultorio: config, equipo, plataforma ──────────────────────────────
  'cumplimiento/bitacora': { tipo: 'capacidad', capacidad: 'administrar' },
  'clinic/exportar': { tipo: 'capacidad', capacidad: 'administrar' },
  'clinic/exportar-csv': { tipo: 'capacidad', capacidad: 'clinico.escribir' },
  // Mismo contenido que el CSV pero en un solo libro con una pestaña por dominio:
  // MISMA capacidad, a propósito. Dos respuestas distintas a «¿quién puede
  // llevarse el expediente?» acabarían discrepando, y la puerta más floja sería
  // la que vale.
  'clinic/exportar-excel': { tipo: 'capacidad', capacidad: 'clinico.escribir' },
  'clinic/importar': { tipo: 'capacidad', capacidad: 'administrar' },
  'clinic/ai-keys': {
    tipo: 'porMetodo', metodos: { GET: 'administrar', POST: 'administrar' },
    // El POST (que ESCRIBE las llaves de IA del tenant) ya EXIGE `administrar` y el
    // guardián lo fija en el código. El pendiente es solo del GET.
    pendientePorMetodo: {
      GET: 'El GET (estado ENMASCARADO de las llaves y uso del mes) sigue en `verificarMiembro`: activarlo lo cerraría a todo el que no sea medico/admin. Pendiente de Q7 del dueño.',
    },
  },
  'clinic/crear': { tipo: 'sesion', motivo: 'Se ejecuta ANTES de existir la clínica: no hay membresía que verificar todavía.' },
  'clinic/miembros': {
    tipo: 'capacidad', capacidad: 'equipo.leer',
    activacionPendiente: 'Q3 — ¿enfermería/farmacia/laboratorio deben poder listar los correos del equipo? HOY PUEDEN.',
  },
  'clinic/unirse': { tipo: 'sesion', motivo: 'Canjea un código de invitación: el usuario todavía NO es miembro de ninguna clínica.' },
  'clinic/whatsapp-disconnect': { tipo: 'capacidad', capacidad: 'administrar' },
  'config/imagen': { tipo: 'sesion', motivo: 'Sube una imagen de membrete/firma a Storage bajo el propio uid; la ruta no lee datos de la clínica.' },
  'mantenimiento/backfill-contadores': { tipo: 'capacidad', capacidad: 'administrar' },
  'voz/comandos-config': { tipo: 'porMetodo', metodos: { GET: 'administrar', POST: 'administrar' } },

  // ── recetas y verificación ───────────────────────────────────────────────
  'receta/diseno': { tipo: 'publica', motivo: 'Proxy same-origin de la imagen del formato de receta (anti-CORS al generar el PDF). Sirve una URL de Storage ya firmada.' },
  'receta/diseno-url': { tipo: 'sesion', motivo: 'Firma una URL de subida para el diseño de receta del propio usuario.' },
  'receta/verificacion-url': { tipo: 'capacidad', capacidad: 'firmar' },

  // ── teleconsulta ─────────────────────────────────────────────────────────
  'telesalud/sala': {
    tipo: 'tokenPaciente', capacidadAlternativa: 'clinico.leer',
    motivo:
      'OR REAL, no un guard normal: (a) token HMAC del paciente DE ESA cita, o (b) ' +
      'miembro autenticado. El token se evalúa PRIMERO y el fallo devuelve 404, no ' +
      '403, para no confirmar que el citaId existe (fuga cerrada en la auditoría ' +
      'maestra 2026-07).',
    // RESUELTO 2026-08-01: el dueño confirmó que el mostrador NO entra a la sala.
    // Entrar a la teleconsulta es asistir al paciente, no agendarlo. La rama del
    // equipo ya exige `clinico.leer`; `secretaria` queda fuera a propósito.
  },
  'telesalud/token': { tipo: 'capacidad', capacidad: 'clinico.escribir' },

  // ── mensajería ───────────────────────────────────────────────────────────
  'whatsapp/360dialog-callback': { tipo: 'publica', motivo: 'Callback del onboarding de 360dialog: llega del proveedor sin sesión y se valida por el channel devuelto.' },
  'whatsapp/360dialog-connect': { tipo: 'capacidad', capacidad: 'administrar' },
  'whatsapp/360dialog-webhook': { tipo: 'webhook', motivo: 'Entrantes y estados de entrega de 360dialog. Autenticado por el token del webhook, no por sesión.' },
  'whatsapp/entregas': {
    tipo: 'capacidad', capacidad: 'mensajeria.enviar',
    activacionPendiente: PENDIENTE_AGENDA,
  },
  'whatsapp/manual-connect': { tipo: 'capacidad', capacidad: 'administrar' },
  'whatsapp/meta-connect': { tipo: 'capacidad', capacidad: 'administrar' },
  'whatsapp/plantillas-config': { tipo: 'porMetodo', metodos: { GET: 'administrar', POST: 'administrar' } },
  'whatsapp/waitlist-notify': {
    tipo: 'capacidad', capacidad: 'mensajeria.enviar',
    activacionPendiente:
      'Atada al bot y a la lista de espera: un 403 aquí corta confirmaciones de ' +
      'cita. ' + PENDIENTE_AGENDA,
  },
  'whatsapp/webhook': { tipo: 'webhook', motivo: 'Entrantes de Meta/WhatsApp. Firma `x-hub-signature-256` (fail-closed desde v492).' },

  // ── bitácora y cumplimiento ──────────────────────────────────────────────
  'auditoria/registrar': {
    // `auditoria.registrar` la tienen TODOS los roles A PROPÓSITO: es la bitácora
    // de la acción propia y estrecharla perdería entradas EN SILENCIO (el cliente
    // no muestra el fallo), lo que es daño invisible sobre el rastro NOM-024.
    tipo: 'capacidad', capacidad: 'auditoria.registrar',
  },

  // ── portal del paciente ──────────────────────────────────────────────────
  'portal': {
    tipo: 'tokenPaciente',
    motivo: 'El paciente entra con su magic-link. Desde E0-06 el token lleva ALCANCE y la ruta exige `alcance === clinico` antes de devolver documentos.',
  },

  // ── soporte, telemetría y consola del dueño ──────────────────────────────
  'ayuda-bot': { tipo: 'sesion', motivo: 'Asistente de ayuda de la propia app; no lee PHI ni datos de la clínica.' },
  'seguridad/csp-estado': { tipo: 'capacidad', capacidad: 'administrar' },
  'csp-report': { tipo: 'publica', motivo: 'Endpoint de reportes CSP del navegador: por especificación llega sin credenciales.' },
  'demo/evidencia': { tipo: 'publica', motivo: 'Sandbox público de demostración con datos ficticios.' },
  'errores': { tipo: 'sesion', motivo: 'POST reporta un error del propio usuario; GET/PATCH (la bandeja) ya exigen superadmin dentro de la ruta.' },
  'soporte': { tipo: 'sesion', motivo: 'POST abre un ticket del propio usuario; GET/PATCH (la bandeja) ya exigen superadmin dentro de la ruta.' },
  'superadmin/accion': { tipo: 'superadmin' },
  'superadmin/clientes': { tipo: 'superadmin' },
  'superadmin/contabilidad': { tipo: 'superadmin' },
  'superadmin/costos': { tipo: 'superadmin' },
  'superadmin/incidentes': { tipo: 'superadmin' },
  // Lo que la política de seguridad habría bloqueado. No lleva PHI, pero sí dice
  // qué recursos externos usa la aplicación — eso es información de seguridad y
  // no se enseña a un cliente.
  'superadmin/csp': { tipo: 'superadmin' },
  // El catálogo de precios. Escritura del dueño y de nadie más: un precio es
  // dinero de todos los consultorios a la vez.
  'superadmin/planes': { tipo: 'superadmin' },
  // El embudo de alta. Cuenta fechas de todos los consultorios: es información
  // del negocio del dueño, no de un cliente.
  'superadmin/onboarding': { tipo: 'superadmin' },
  // El simulador de precios: márgenes y punto de pérdida. Del negocio del dueño.
  'superadmin/simulador': { tipo: 'superadmin' },
  // El catálogo vigente, de sólo lectura. Un precio de lista no es un secreto:
  // está impreso en la página de precios y se le dice a quien pregunte.
  'planes': { tipo: 'publica', motivo: 'Precios de lista: información pública por definición, la misma que se imprime en /precios.' },
  'superadmin/paquetes': { tipo: 'superadmin' },

  // ── tareas programadas ───────────────────────────────────────────────────
  'cron/reminders': { tipo: 'cron', motivo: 'Recordatorios nocturnos. Autenticado por `CRON_SECRET`; no hay usuario.' },
  'health': { tipo: 'publica', motivo: 'Estado del sistema para un monitor externo. Sólo booleanos, latencias y la versión: ni una clave, ni un dato de paciente. Sin sesión a propósito — un endpoint de salud detrás de login no lo mira nadie a las 3am.' },
  'cron/retencion': { tipo: 'cron', motivo: 'Barre las colecciones OPERATIVAS de plataforma que crecen sin techo. Nada clínico. Autenticado por `CRON_SECRET`; no hay usuario.' },
  'cron/asientos': {
    tipo: 'cron',
    motivo: 'Concilia el cobro por asiento de todos los consultorios. Fail-closed: sin CRON_SECRET no corre, porque un endpoint que MUEVE DINERO no puede quedar abierto.',
  },
  'cron/vigilante': { tipo: 'cron', motivo: 'Vigila los latidos de los otros crons y avisa. Autenticado por `CRON_SECRET`; no hay usuario.' },
  'cron/limpiar-audio': { tipo: 'cron', motivo: 'Barrido diario del audio de consulta abandonado en Storage. Autenticado por `CRON_SECRET`; no hay usuario.' },
}

/** Tipos de exigencia que OBLIGAN a documentar el motivo por escrito. */
export const TIPOS_CON_MOTIVO = [
  'porAccion', 'tokenPaciente', 'sesion', 'publica', 'webhook', 'cron',
] as const

/** Tipos que declaran una capacidad de rol (los que el guardián cruza con el código). */
export const TIPOS_CON_CAPACIDAD = ['capacidad', 'porMetodo', 'entitlementIA'] as const

/** Capacidades que exige una entrada del registro (vacío para las exenciones). */
export function capacidadesDeRuta(e: ExigenciaRuta): readonly Capacidad[] {
  switch (e.tipo) {
    case 'capacidad': return [e.capacidad]
    case 'porMetodo': return Object.values(e.metodos).filter((c): c is Capacidad => !!c)
    case 'porAccion': return Object.values(e.acciones)
    case 'entitlementIA': return [e.capacidad]
    case 'tokenPaciente': return e.capacidadAlternativa ? [e.capacidadAlternativa] : []
    default: return []
  }
}

/**
 * ¿La ruta ejecuta ya su capacidad EN TODOS sus métodos declarados?
 *
 * Se conserva con la firma de siempre (hay tests de E0-07 que la usan), pero con las
 * rutas `porMetodo` significa «ningún método tiene pendiente»: la comprobación fina
 * es `activaEnCodigoMetodo`.
 */
export function activaEnCodigo(e: ExigenciaRuta): boolean {
  if (capacidadesDeRuta(e).length === 0) return false
  if (e.tipo === 'porMetodo') return Object.keys(e.pendientePorMetodo ?? {}).length === 0
  return !('activacionPendiente' in e && e.activacionPendiente)
}

/**
 * Capacidad que la ruta exige PARA ESE MÉTODO, o `null` si no declara ninguna.
 *
 * `porAccion` devuelve `null` a propósito: ahí la capacidad depende del body y la
 * garantía es otra (el mapa vive en este archivo, no en la ruta).
 */
export function capacidadEsperada(e: ExigenciaRuta, m: Metodo): Capacidad | null {
  switch (e.tipo) {
    case 'capacidad': return e.capacidad
    case 'entitlementIA': return e.capacidad
    case 'porMetodo': return e.metodos[m] ?? null
    case 'tokenPaciente': return e.capacidadAlternativa ?? null
    default: return null
  }
}

/** Texto de la decisión pendiente para ese método, o `null` si ya debe estar activo. */
export function pendienteDe(e: ExigenciaRuta, m: Metodo): string | null {
  if (capacidadEsperada(e, m) === null) return null
  if (e.tipo === 'porMetodo') return e.pendientePorMetodo?.[m] ?? null
  const pendiente = (e as { activacionPendiente?: string }).activacionPendiente
  return pendiente && pendiente.trim().length > 0 ? pendiente : null
}

/** ¿Ese par (ruta, método) tiene que EJECUTAR ya su capacidad? */
export function activaEnCodigoMetodo(e: ExigenciaRuta, m: Metodo): boolean {
  return capacidadEsperada(e, m) !== null && pendienteDe(e, m) === null
}

/**
 * Avance del programa contado DEL REGISTRO, no de la prosa: pares (ruta, método) que
 * declaran capacidad, cuántos ya la exigen y cuántos esperan una decisión del dueño.
 *
 * Existe porque el expediente de la unidad llegó a decir «26 rutas pendientes»
 * cuando eran 28 (P3-1 de la verificación adversarial). Un número escrito a mano en
 * un documento se queda viejo; este se calcula.
 */
export function resumenActivacion(
  metodosPorRuta: Readonly<Record<string, readonly Metodo[]>>,
): { declarados: number; activos: number; pendientes: number } {
  let declarados = 0
  let activos = 0
  let pendientes = 0
  for (const [clave, e] of Object.entries(REGISTRO_RUTAS)) {
    for (const m of metodosPorRuta[clave] ?? []) {
      if (capacidadEsperada(e, m) === null) continue
      declarados++
      if (activaEnCodigoMetodo(e, m)) activos++
      else pendientes++
    }
  }
  return { declarados, activos, pendientes }
}
