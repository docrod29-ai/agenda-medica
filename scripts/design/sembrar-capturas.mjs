/**
 * SIEMBRA SINTÉTICA PARA EL ARNÉS DE CAPTURAS V10 (§33, §39).
 *
 * Puebla los emuladores de Auth y Firestore con un consultorio sintético
 * completo para poder capturar el golden flow AUTENTICADO en un navegador
 * real. Todo aquí es inventado y determinista (regla `data-privacy.md`:
 * cero pacientes reales); el candado es el mismo de `emulator/entorno.ts`:
 * el proyecto empieza por `demo-`, con lo que el SDK se niega a hablar con
 * un proyecto real y no pide credenciales.
 *
 * Uso (emuladores ya levantados en 8080/9099):
 *   node scripts/design/sembrar-capturas.mjs
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-nexusmed-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El proyecto de siembra DEBE empezar por demo- (candado anti-producción)')
}

const app = initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

export const CUENTA = {
  email: 'medico@capturas.demo',
  password: 'captura-v10-demo',
  displayName: 'Dra. Elena Sandoval Rivas',
}

const CLINIC_ID = 'clinica-capturas-v10'
const hoy = new Date()
const yyyy = hoy.getFullYear()
const mm = String(hoy.getMonth() + 1).padStart(2, '0')
const dd = String(hoy.getDate()).padStart(2, '0')
const HOY = `${yyyy}-${mm}-${dd}`
const dia = (n) => {
  const d = new Date(hoy.getTime() + n * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ISO = new Date().toISOString()

async function main() {
  // ── Médico ────────────────────────────────────────────────────────────
  let user
  try {
    user = await auth.getUserByEmail(CUENTA.email)
  } catch {
    user = await auth.createUser({
      email: CUENTA.email,
      password: CUENTA.password,
      displayName: CUENTA.displayName,
      emailVerified: true,
    })
  }
  const uid = user.uid

  // ── Consultorio en prueba (14 días, como vende Practice) ─────────────
  const trialEnds = new Date(hoy.getTime() + 9 * 86400000)
  await db.doc(`clinics/${CLINIC_ID}`).set({
    nombreClinica: 'Consultorio de Medicina Interna Reforma',
    nombreMedico: CUENTA.displayName,
    plan: 'trial',
    status: 'trial',
    trialEndsAt: trialEnds.toISOString(),
    trialEndsAtMs: trialEnds.getTime(),
    createdAt: ISO,
  })
  await db.doc(`clinic_members/${uid}`).set({
    clinicId: CLINIC_ID,
    role: 'medico',
    displayName: CUENTA.displayName,
    createdAt: ISO,
  })

  // ── Pacientes sintéticos (edades y padecimientos plausibles, TODO inventado)
  const pacientes = [
    {
      id: 'pac-aurelio-dominguez',
      nombre: 'Aurelio Domínguez Peña',
      telefono: '+52 55 5555 0101',
      fechaNacimiento: '1954-03-18',
      edad: 72,
      sexo: 'Masculino',
      alergias: 'Penicilina (rash generalizado, 2019)',
      seguroMedico: 'GNP Gastos Médicos',
      tags: [],
      notas: 'DM2 de 15 años de evolución. HbA1c 8.2% (jun 2026).',
      ultimaCita: dia(-30),
      proximoSeguimiento: HOY,
    },
    {
      id: 'pac-refugio-alcantara',
      nombre: 'María del Refugio Alcántara Solís',
      telefono: '+52 55 5555 0102',
      fechaNacimiento: '1968-11-02',
      edad: 57,
      sexo: 'Femenino',
      alergias: '',
      seguroMedico: '',
      tags: [],
      notas: 'HAS en tratamiento. Última TA 138/86.',
      ultimaCita: dia(-90),
    },
    {
      id: 'pac-joaquin-esparza',
      nombre: 'Joaquín Esparza Villarreal',
      telefono: '+52 55 5555 0103',
      fechaNacimiento: '1990-07-25',
      edad: 36,
      sexo: 'Masculino',
      alergias: 'AINE (broncoespasmo)',
      seguroMedico: 'AXA',
      tags: [],
      notas: 'Fiebre de origen a estudiar; segunda valoración.',
      ultimaCita: dia(-7),
    },
    {
      id: 'pac-catalina-ibarra',
      nombre: 'Catalina Ibarra Fuentes',
      telefono: '+52 55 5555 0104',
      fechaNacimiento: '1947-01-30',
      edad: 79,
      sexo: 'Femenino',
      /* EL CASO DE REG-311, SEMBRADO A PROPÓSITO: una frase que MEZCLA una
         negación con una alergia real. Es la que una copia local del criterio
         llegó a pintar como «sin alergias» en gris, y la única forma de ver en
         navegador que la franja enseña la LECTURA del sistema («se lee:
         sulfas») además del texto escrito. Sin este paciente, esa mitad de
         RTC-14 quedaba escrita y sin comprobar. */
      alergias: 'Niega penicilina. Alérgico a sulfas',
      seguroMedico: 'IMSS + particular',
      tags: [],
      notas: 'EPOC GOLD II. Esquema de vacunación al corriente.',
      ultimaCita: dia(-14),
      proximoSeguimiento: dia(3),
    },
    {
      id: 'pac-ernesto-quiroga',
      nombre: 'Ernesto Quiroga Lomelí',
      telefono: '+52 55 5555 0105',
      fechaNacimiento: '1982-09-12',
      edad: 43,
      sexo: 'Masculino',
      alergias: '',
      seguroMedico: 'Metlife',
      tags: [],
      notas: 'Chequeo anual empresarial.',
    },
    {
      id: 'pac-luzmaria-cervantes',
      nombre: 'Luz María Cervantes Ochoa',
      telefono: '+52 55 5555 0106',
      fechaNacimiento: '1975-05-08',
      edad: 51,
      sexo: 'Femenino',
      alergias: 'Levofloxacino (tendinopatía)',
      seguroMedico: '',
      tags: [],
      notas: 'ITU de repetición; urocultivo pendiente de revisar.',
      ultimaCita: dia(-3),
    },
  ]
  for (const p of pacientes) {
    const { id, ...datos } = p
    await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({
      ...datos,
      createdAt: ISO,
      updatedAt: ISO,
    })
  }

  // ── Citas de HOY (y una de mañana) con estados variados ──────────────
  const base = {
    duracion: 30,
    medicoNombre: CUENTA.displayName,
    medicoId: uid,
    confirmadoPaciente: false,
    recordatorio24hEnviado: false,
    recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true,
    createdAt: ISO,
    updatedAt: ISO,
    creadoPor: uid,
    updatedPor: uid,
  }
  const citas = [
    {
      id: 'cita-hoy-0900',
      pacienteId: 'pac-refugio-alcantara',
      pacienteNombre: 'María del Refugio Alcántara Solís',
      pacienteTelefono: '+52 55 5555 0102',
      fechaHora: `${HOY} 09:00`,
      tipo: 'seguimiento',
      motivo: 'Control de hipertensión arterial',
      estado: 'completada',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-0930',
      pacienteId: 'pac-luzmaria-cervantes',
      pacienteNombre: 'Luz María Cervantes Ochoa',
      pacienteTelefono: '+52 55 5555 0106',
      fechaHora: `${HOY} 09:30`,
      tipo: 'estudios',
      motivo: 'Revisión de urocultivo',
      estado: 'completada',
      origen: 'WhatsApp',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1030',
      pacienteId: 'pac-aurelio-dominguez',
      pacienteNombre: 'Aurelio Domínguez Peña',
      pacienteTelefono: '+52 55 5555 0101',
      fechaHora: `${HOY} 10:30`,
      tipo: 'seguimiento',
      motivo: 'Control de diabetes — revisar HbA1c y ajuste de metformina',
      estado: 'en-sala',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1130',
      pacienteId: 'pac-joaquin-esparza',
      pacienteNombre: 'Joaquín Esparza Villarreal',
      pacienteTelefono: '+52 55 5555 0103',
      fechaHora: `${HOY} 11:30`,
      tipo: 'urgente',
      motivo: 'Fiebre persistente de 8 días — segunda valoración',
      estado: 'confirmada',
      origen: 'Teléfono',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1300',
      pacienteId: 'pac-ernesto-quiroga',
      pacienteNombre: 'Ernesto Quiroga Lomelí',
      pacienteTelefono: '+52 55 5555 0105',
      fechaHora: `${HOY} 13:00`,
      tipo: 'primera-vez',
      motivo: 'Chequeo anual empresarial',
      estado: 'pendiente-confirmar',
      origen: 'WhatsApp',
    },
    {
      id: 'cita-hoy-1700',
      pacienteId: 'pac-catalina-ibarra',
      pacienteNombre: 'Catalina Ibarra Fuentes',
      pacienteTelefono: '+52 55 5555 0104',
      fechaHora: `${HOY} 17:00`,
      tipo: 'teleconsulta',
      motivo: 'Seguimiento de EPOC — revisión de espirometría',
      estado: 'pendiente-confirmar',
      origen: 'Manual',
    },
    {
      id: 'cita-manana-1000',
      pacienteId: 'pac-catalina-ibarra',
      pacienteNombre: 'Catalina Ibarra Fuentes',
      pacienteTelefono: '+52 55 5555 0104',
      fechaHora: `${dia(1)} 10:00`,
      tipo: 'seguimiento',
      motivo: 'Resultados de laboratorio',
      estado: 'confirmada',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
  ]
  for (const c of citas) {
    const { id, ...datos } = c
    await db.doc(`clinics/${CLINIC_ID}/appointments/${id}`).set({ ...base, ...datos })
  }

  // ── Tareas clínicas (cabos sueltos de consultas anteriores) ──────────
  // Fuente de la zona CONTINUITY de V15-TODAY-001 (ContinuidadPanel, la
  // misma tareasVivas() que ya lee /pendientes). Sin esto la zona no tiene
  // nada que pintar en el arnés de capturas: se comporta como si no hubiera
  // pendientes, y eso es exactamente lo que NO se quiere verificar.
  const diaISO = (n) => new Date(hoy.getTime() + n * 86400000).toISOString()
  const tareas = [
    {
      id: 'tarea-urocultivo-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'resultado_por_revisar',
      titulo: 'Urocultivo — resultado disponible',
      detalle: 'ITU de repetición; revisar sensibilidad antes de renovar esquema.',
      prioridad: 'alta',
      estado: 'solicitada',
      creadaEn: diaISO(-2),
      venceEn: diaISO(-1), // ya venció: se ve el escalamiento real, no sólo la lista
      origen: 'laboratorio',
    },
    {
      id: 'tarea-seguimiento-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'seguimiento',
      titulo: 'Seguimiento de EPOC — revisar espirometría',
      detalle: 'Control programado tras ajuste de esquema inhalado.',
      prioridad: 'normal',
      estado: 'solicitada',
      creadaEn: diaISO(-14),
      venceEn: diaISO(3),
      origen: 'nota',
    },
    {
      id: 'tarea-reconciliacion-aurelio',
      clinicId: CLINIC_ID,
      patientId: 'pac-aurelio-dominguez',
      patientNombre: 'Aurelio Domínguez Peña',
      tipo: 'reconciliacion_medicamento',
      titulo: 'Confirmar si la metformina sigue vigente',
      detalle: 'El paciente mencionó suspenderla; no coincide con la lista activa.',
      prioridad: 'critica',
      estado: 'solicitada',
      creadaEn: diaISO(-1),
      origen: 'nota',
      /**
       * LA TRAZA HACIA ATRÁS, SEMBRADA — y sin esto la Capa 4 de /pendientes
       * no tenía NADA que enseñar en «por qué está aquí».
       *
       * `TareaClinica.notaId` («de qué consulta salió») se escribe en cada
       * tarea derivada de una nota desde que existe `derivar.ts`, pero NINGUNA
       * tarea sembrada lo traía: el enlace a la consulta de origen habría
       * salido ausente en las siete, y la medición habría fotografiado un
       * hueco declarándolo «no consta». Es el quinto hueco de siembra de esta
       * misma familia (las notas sin `transcripcionCruda` fueron el cuarto).
       *
       * Se siembra sólo donde existe una nota de VERDAD para ese paciente:
       * Catalina no tiene ninguna, así que sus dos tareas se quedan sin traza
       * — y eso es deliberado, porque la rama «no consta de qué consulta
       * salió» también tiene que poder verse en el navegador.
       */
      notaId: 'nota-aurelio-2',
    },
    /**
     * V15-RESULTS-CLOSURE-001 — dos tareas de resultado MÁS, con dueño y
     * estado distintos, para que `ProgresoResultado` (§9) tenga algo real que
     * enseñar en cada una de sus etapas alcanzables: sin la de aquí abajo,
     * 'tarea-urocultivo-luzmaria' es la única de tipo resultado y siempre se
     * ve en el mismo punto (sin dueño, recién solicitada).
     */
    {
      id: 'tarea-estudio-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'estudio_pendiente',
      titulo: 'Espirometría de control — en proceso',
      detalle: 'Pedida para valorar respuesta al ajuste de esquema inhalado.',
      prioridad: 'normal',
      estado: 'en_curso',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-3),
      venceEn: diaISO(2),
      origen: 'nota',
    },
    {
      // 'cerrada' NO aparece en `tareasVivas()` (a propósito: es el worklist
      // de lo VIVO) — 'completada' sí, y es la única forma de ver en el
      // navegador real la etapa "Cerrado" como LA ACTUAL, con Revisión ya
      // hecha: el estudio se hizo, falta que alguien lo mire y decida.
      id: 'tarea-resultado-completado-aurelio',
      clinicId: CLINIC_ID,
      patientId: 'pac-aurelio-dominguez',
      patientNombre: 'Aurelio Domínguez Peña',
      tipo: 'resultado_por_revisar',
      titulo: 'Perfil lipídico — resultado listo',
      detalle: 'Llegó del laboratorio; falta que alguien lo revise y decida.',
      prioridad: 'normal',
      estado: 'completada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-7),
      completadaEn: diaISO(-1),
      origen: 'laboratorio',
    },
    /**
     * V15-FOLLOWUP-WORK-001 (Fase 7, §10) — dos tareas MÁS, para que los
     * grupos "esperando al paciente" y "otros" de `estadoDeAccion` tengan
     * algo real que enseñar. Sin ellas, las cinco tareas de arriba sólo
     * cubren tres de los cinco grupos no-vencidos (las otras dos
     * escalan por crítica-sin-dueño o vencida, así que nunca llegan a
     * `resto`). Ninguna de las dos escala: prioridad no-crítica y sin
     * vencer.
     */
    {
      id: 'tarea-receta-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'receta_por_entregar',
      titulo: 'Entregar receta (2 medicamentos)',
      detalle: 'La receta se generó en la consulta. Se cierra cuando el paciente la tiene.',
      prioridad: 'alta',
      estado: 'solicitada',
      creadaEn: diaISO(-1),
      venceEn: diaISO(4),
      origen: 'nota',
      notaId: 'nota-luzmaria-1',
    },
    {
      id: 'tarea-otra-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'otra',
      titulo: 'Llamar a laboratorio externo por resultado extraviado',
      detalle: 'El laboratorio reportó el estudio como perdido; hay que reprogramarlo.',
      prioridad: 'normal',
      estado: 'solicitada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-1),
      venceEn: diaISO(5),
      origen: 'manual',
    },
    /**
     * V15-FOLLOWUP-WORK-001 (Fase 7, §10), segunda rebanada — «closed
     * recently» necesita una tarea de verdad EN `cerrada` para que
     * `tareasCerradasRecientes()` tenga algo que devolver: `tareasVivas()`
     * la excluye a propósito, así que ninguna de las de arriba sirve.
     */
    {
      id: 'tarea-cerrada-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'resultado_por_revisar',
      titulo: 'Radiografía de tórax — sin hallazgos',
      detalle: 'Revisada en la consulta previa; no hay hallazgo que requiera seguimiento.',
      prioridad: 'normal',
      estado: 'cerrada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-5),
      completadaEn: diaISO(-3),
      cerradaEn: diaISO(-2),
      cerradaPor: uid,
      origen: 'laboratorio',
      // Cerrada por el propio médico de la siembra: es el único caso en que la
      // línea de tiempo puede decir «lo revisaste y lo cerraste» sin resolver
      // un uid contra otra colección.
      notaId: 'nota-luzmaria-1',
    },
  ]
  for (const t of tareas) {
    const { id, ...datos } = t
    await db.doc(`clinics/${CLINIC_ID}/tareas_clinicas/${id}`).set(datos)
  }

  /**
   * ── NOTAS CLÍNICAS ────────────────────────────────────────────────────
   *
   * ── EL HUECO QUE ESTO TAPA ────────────────────────────────────────────
   *
   * Hasta el 14-ago-2026 esta siembra NO creaba ni una sola nota. Todos los
   * expedientes salían con «Sin notas todavía», 0 encuentros y sin signos ni
   * diagnósticos — y sobre eso se midió media docena de rebanadas de V15:
   *
   *   · RTC-10 declaró que `#spine-problemas` NO llegó a pintarse en la
   *     medición «porque ningún paciente sembrado tiene notas firmadas con
   *     dx ni fármacos»;
   *   · las tres pasadas de re-puntuación §29 puntuaron el expediente VACÍO,
   *     y lo dejaron escrito como limitación;
   *   · RTC-31 no pudo medir la convivencia del primario con «Consulta sin
   *     cerrar — continuar», porque para eso hace falta un borrador.
   *
   * Tres huecos declarados con la misma causa. Un arnés que sólo sabe
   * enseñar la pantalla vacía mide el producto que nadie usa.
   *
   * ── QUÉ SE SIEMBRA, Y QUÉ NO ──────────────────────────────────────────
   *
   * Todo inventado y determinista (regla `data-privacy.md`: cero pacientes
   * reales). Las cifras son verosímiles y **no son guía clínica**: existen
   * para que la pantalla tenga volumen real, no para que nadie las lea como
   * referencia. Por eso no hay dosis en mg de nada.
   *
   *   · Aurelio  — DOS notas firmadas (dx crónicos activos) → el Clinical
   *     Spine tiene problemas que pintar y la historia tiene profundidad.
   *   · Luz María — UNA firmada + UN BORRADOR sin firmar → el ancla enseña
   *     «Consulta sin cerrar — continuar», que es lo que no se podía medir.
   *   · Los demás se quedan SIN notas a propósito: el expediente vacío
   *     también hay que poder medirlo, y es el estado del paciente nuevo.
   *
   * ── EL CUARTO HUECO, DE LA MISMA FAMILIA: NINGUNA NOTA TENÍA DICTADO ──
   *
   * Las notas nacieron el 14-ago **sin `transcripcionCruda`**, y eso deja sin
   * pintar las DOS piezas de procedencia de §21 — la firma de este producto:
   *
   *   · `DeDondeSalioEsto` devuelve `null` sin dictado, por construcción
   *     («sin dictado no hay nada que contrastar»);
   *   · `SelloProcedencia` se pinta, pero sin la `transcripcion` que permite
   *     comprobar que las citas textuales EXISTEN, así que se comporta como
   *     antes de REG-213 en vez de enseñar lo que hoy sabe.
   *
   * O sea: la interacción que §21 llama «signature interaction» del producto
   * NUNCA se ha visto en una captura. Se siembra el dictado de las tres notas
   * firmadas —redactado para que sostenga PARTE de lo escrito y no todo, que
   * es el caso interesante: el panel existe para enseñar qué frase NO tiene
   * respaldo—. El borrador se queda sin dictado a propósito: una consulta
   * recién abierta tampoco lo tiene.
   */
  const seccion = (key, label, value) => ({ key, label, value })
  const metadatos = (id, tipo, pacienteId, estado, fecha) => ({
    id, tipoNota: tipo, clinicId: CLINIC_ID, pacienteId,
    medicoId: uid, cedulaProfesional: '00000000', especialidad: 'Medicina Interna',
    establecimiento: 'Consultorio de capturas', fechaCreacion: fecha, fechaModificacion: fecha,
    /* Sello de mentira A PROPÓSITO y con su nombre: estas notas no pasan por
       `sellar()`, así que un hash inventado dejaría creer que sí. */
    hashIntegridad: 'siembra-sintetica-sin-sello', hashVersion: 0,
    version: 1, estado, fuenteGeneracion: 'manual',
  })

  const notas = [
    {
      id: 'nota-aurelio-1', pacienteId: 'pac-aurelio-dominguez', pacienteNombre: 'Aurelio Domínguez Peña',
      tipo: 'primera_vez', estado: 'firmada', fecha: diaISO(-45),
      resumenEjecutivo: 'DM2 e HAS en control irregular; se ajusta seguimiento y se piden laboratorios.',
      secciones: [
        seccion('subjetivo', 'Subjetivo', 'Refiere apego irregular al tratamiento en los últimos dos meses. Niega hipoglucemias, poliuria ni pérdida de peso.'),
        seccion('objetivo', 'Objetivo', 'Consciente, orientado, hidratado. Sin datos de dificultad respiratoria. Exploración cardiopulmonar sin agregados.'),
        seccion('analisis', 'Análisis', 'Control metabólico subóptimo, probablemente por apego. Sin datos de descompensación aguda.'),
        seccion('plan', 'Plan', 'Refuerzo de apego, perfil lipídico y HbA1c de control, cita en cuatro semanas.'),
      ],
      signosVitales: { ta: '138/86', fc: '78', fr: '16', temperatura: '36.4', spo2: '96', peso: '84', talla: '1.72', imc: '28.4' },
      /* El «Análisis» NO está dictado a propósito: es la frase que
         `DeDondeSalioEsto` tiene que marcar como sin respaldo. Un dictado que
         sostiene el 100 % de la nota no enseña para qué sirve el panel. */
      transcripcionCruda:
        'Viene a control. Refiere que ha tomado el tratamiento de manera irregular ' +
        'en los últimos dos meses. Niega hipoglucemias, niega poliuria y niega ' +
        'pérdida de peso. Tensión arterial ciento treinta y ocho sobre ochenta y ' +
        'seis, frecuencia cardiaca setenta y ocho. A la exploración está consciente ' +
        'y orientado, hidratado, sin datos de dificultad respiratoria; la ' +
        'exploración cardiopulmonar sin agregados. Reforzamos el apego, pedimos ' +
        'perfil de lípidos y hemoglobina glucosilada de control y lo cito en cuatro ' +
        'semanas.',
      diagnosticos: [
        { descripcion: 'Diabetes mellitus tipo 2', tipo: 'definitivo', estado: 'cronico', fechaDiagnostico: diaISO(-2000) },
        { descripcion: 'Hipertensión arterial sistémica', tipo: 'definitivo', estado: 'cronico', fechaDiagnostico: diaISO(-1500) },
      ],
    },
    {
      id: 'nota-aurelio-2', pacienteId: 'pac-aurelio-dominguez', pacienteNombre: 'Aurelio Domínguez Peña',
      tipo: 'seguimiento', estado: 'firmada', fecha: diaISO(-12),
      resumenEjecutivo: 'Mejor apego; queda por confirmar si la metformina sigue vigente.',
      secciones: [
        seccion('subjetivo', 'Subjetivo', 'Mejor apego desde la consulta previa. Menciona haber suspendido uno de los medicamentos por cuenta propia; no recuerda cuál.'),
        seccion('objetivo', 'Objetivo', 'Sin cambios relevantes en la exploración.'),
        seccion('analisis', 'Análisis', 'Discrepancia entre lo que el paciente refiere y la lista activa: requiere reconciliación antes de renovar receta.'),
        seccion('plan', 'Plan', 'Reconciliar la lista de medicamentos con el paciente en la próxima visita.'),
      ],
      signosVitales: { ta: '132/84', fc: '74', fr: '16', temperatura: '36.5', spo2: '97', peso: '83', imc: '28.1' },
      transcripcionCruda:
        'Regresa a seguimiento. Dice que ha tomado mejor el tratamiento desde la ' +
        'consulta previa. Menciona que suspendió uno de los medicamentos por cuenta ' +
        'propia y no recuerda cuál. La exploración sin cambios relevantes. Hay que ' +
        'reconciliar la lista de medicamentos con el paciente en la próxima visita ' +
        'antes de renovar la receta.',
      diagnosticos: [
        { descripcion: 'Diabetes mellitus tipo 2', tipo: 'definitivo', estado: 'cronico' },
        { descripcion: 'Hipertensión arterial sistémica', tipo: 'definitivo', estado: 'cronico' },
      ],
    },
    {
      id: 'nota-luzmaria-1', pacienteId: 'pac-luzmaria-cervantes', pacienteNombre: 'Luz María Cervantes Ochoa',
      tipo: 'primera_vez', estado: 'firmada', fecha: diaISO(-20),
      resumenEjecutivo: 'ITU de repetición; se solicita urocultivo con antibiograma.',
      secciones: [
        seccion('subjetivo', 'Subjetivo', 'Tercer episodio de disuria y urgencia en seis meses. Niega fiebre y dolor lumbar.'),
        seccion('objetivo', 'Objetivo', 'Afebril. Abdomen blando, sin dolor a la puñopercusión.'),
        seccion('analisis', 'Análisis', 'Infección urinaria de repetición; conviene documentar sensibilidad antes de repetir esquema.'),
        seccion('plan', 'Plan', 'Urocultivo con antibiograma y revisión del resultado antes de decidir tratamiento.'),
      ],
      signosVitales: { ta: '118/74', fc: '82', fr: '17', temperatura: '36.8', spo2: '98' },
      transcripcionCruda:
        'Acude por tercer episodio de disuria y urgencia en seis meses. Niega ' +
        'fiebre y niega dolor lumbar. Temperatura treinta y seis punto ocho, ' +
        'tensión ciento dieciocho sobre setenta y cuatro. Afebril, abdomen blando, ' +
        'sin dolor a la puñopercusión. Pedimos urocultivo con antibiograma y ' +
        'revisamos el resultado antes de decidir el tratamiento.',
      diagnosticos: [
        { descripcion: 'Infección de vías urinarias de repetición', tipo: 'definitivo', estado: 'activo', fechaDiagnostico: diaISO(-20) },
      ],
    },
    {
      /* EL BORRADOR. Sin él, `PatientAnchor` nunca enseña «Consulta sin
         cerrar — continuar» y esa mitad de la pantalla queda sin medir. */
      id: 'nota-luzmaria-borrador', pacienteId: 'pac-luzmaria-cervantes', pacienteNombre: 'Luz María Cervantes Ochoa',
      tipo: 'seguimiento', estado: 'borrador', fecha: diaISO(-1),
      resumenEjecutivo: '',
      secciones: [
        seccion('subjetivo', 'Subjetivo', 'Acude por el resultado del urocultivo. Refiere mejoría parcial de la disuria.'),
        seccion('objetivo', 'Objetivo', ''),
        seccion('analisis', 'Análisis', ''),
        seccion('plan', 'Plan', ''),
      ],
      diagnosticos: [],
    },
  ]

  for (const n of notas) {
    const { id, fecha, ...datos } = n
    await db.doc(`clinics/${CLINIC_ID}/patients/${datos.pacienteId}/notas/${id}`).set({
      id,
      clinicId: CLINIC_ID,
      ...datos,
      medicamentos: [],
      alergias: [],
      metadata: metadatos(id, datos.tipo, datos.pacienteId, datos.estado, fecha),
      fechaConsulta: fecha,
      createdAt: fecha,
      updatedAt: fecha,
      creadoPor: CUENTA.email,
    })
  }

  console.log(`Sembrado: clínica ${CLINIC_ID}, médico ${CUENTA.email} (uid ${uid}), ${pacientes.length} pacientes, ${citas.length} citas, ${tareas.length} tareas clínicas, ${notas.length} notas (${notas.filter(n => n.estado === 'borrador').length} sin firmar) (${HOY}).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
