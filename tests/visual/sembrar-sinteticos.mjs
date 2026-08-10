/**
 * Siembra SINTÉTICA para el arnés de capturas V10 (tests/visual/).
 *
 * TODO es ficticio: personas inventadas, teléfonos no marcables (55 0000 00xx),
 * cédula de utilería. Nada de esto toca producción: el script se niega a correr
 * si no está apuntado a los emuladores locales (FIRESTORE_EMULATOR_HOST +
 * FIREBASE_AUTH_EMULATOR_HOST) y el proyecto es `demo-nexusmed-test`.
 *
 * Uso (lo orquesta tests/visual/arnes-capturas.sh):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   GCLOUD_PROJECT=demo-nexusmed-test node tests/visual/sembrar-sinteticos.mjs
 */
import admin from 'firebase-admin'

const PROYECTO = 'demo-nexusmed-test'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('✗ Este script SOLO corre contra emuladores. Falta FIRESTORE_EMULATOR_HOST o FIREBASE_AUTH_EMULATOR_HOST.')
  process.exit(1)
}
if ((process.env.GCLOUD_PROJECT ?? PROYECTO) !== PROYECTO) {
  console.error(`✗ Proyecto inesperado: sólo se permite ${PROYECTO}.`)
  process.exit(1)
}

admin.initializeApp({ projectId: PROYECTO })
const db = admin.firestore()
const ahora = new Date().toISOString()

const CLINIC_ID = 'clinica-demo'
const UID = 'medico-demo'
const EMAIL = 'dra.demo@nexusmed.test'
const PASSWORD = 'NexusMED-arnes-2026'
const MEDICO = 'Dra. Ana Sofía Robles Grijalva'

/** Fecha local del consultorio (America/Chihuahua) en 'YYYY-MM-DD'. */
function hoyLocal() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chihuahua', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return f.format(new Date())
}

async function sembrarAuth() {
  try {
    await admin.auth().createUser({
      uid: UID, email: EMAIL, password: PASSWORD,
      displayName: MEDICO, emailVerified: true,
    })
    console.log(`✓ auth: ${EMAIL}`)
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      console.log('· auth: usuaria ya existía')
    } else { throw e }
  }
}

async function sembrarClinica() {
  await db.doc(`clinic_members/${UID}`).set({
    clinicId: CLINIC_ID, role: 'medico', displayName: MEDICO, createdAt: ahora,
  })
  await db.doc(`clinics/${CLINIC_ID}`).set({
    id: CLINIC_ID,
    nombreClinica: 'Consultorio de Medicina Interna e Infectología',
    nombreMedico: MEDICO,
    plan: 'cortesia',
    status: 'active',
    paseLibre: true,
    paseLibreMotivo: 'Arnés de capturas V10 — datos sintéticos',
    ownerId: UID,
    createdAt: ahora,
    updatedAt: ahora,
  })
  await db.doc(`clinics/${CLINIC_ID}/config/main`).set({
    nombreMedico: MEDICO,
    nombreClinica: 'Consultorio de Medicina Interna e Infectología',
    cedulaProfesional: '0000000 (DEMO)',
    especialidad: 'Medicina Interna · Infectología',
    direccion: 'Av. Ficticia 123, Col. Sintética, Chihuahua, Chih.',
    telefonoAdmin: '614 000 0000',
    whatsappConsultorio: '',
    zonaHoraria: 'America/Chihuahua',
    publicBookingEnabled: true,
  }, { merge: true })
  console.log('✓ clínica + membresía + config')
}

/** Días atrás → 'YYYY-MM-DD' local del consultorio. */
function diasAtras(n) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chihuahua', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return f.format(new Date(Date.now() - n * 86400000))
}

const PACIENTES = [
  {
    id: 'pac-sint-01', nombre: 'María Fernanda Saldívar Roble', telefono: '55 0000 0001',
    edad: 54, sexo: 'Femenino', alergias: 'Penicilina (rash generalizado)',
    alergiasEstructuradas: [{ alergeno: 'Penicilina', tipo: 'medicamento', severidad: 'moderada', reaccion: 'rash generalizado' }],
    tags: ['seguimiento', 'cronico'], notas: 'HTA esencial en control. DM2 en metas.',
    // Mismo formato que escribe contadores-paciente.ts: fechaHora.slice(0, 10).
    // Sin esto, la vista «Recientes» de /pacientes sale vacía (quedó sin puntuar
    // en la corrida del 9-ago justo por esta ausencia).
    ultimaCita: diasAtras(7),
  },
  {
    id: 'pac-sint-02', nombre: 'José Emilio Carranza Peón', telefono: '55 0000 0002',
    edad: 67, sexo: 'Masculino', alergias: '',
    tags: ['alto-riesgo', 'pendiente-estudios'], notas: 'EPOC GOLD B. Exfumador.',
    ultimaCita: diasAtras(21),
  },
  {
    id: 'pac-sint-03', nombre: 'Guadalupe Contreras Ávila', telefono: '55 0000 0003',
    edad: 41, sexo: 'Femenino', alergias: 'Sulfas',
    alergiasEstructuradas: [{ alergeno: 'Sulfametoxazol', tipo: 'medicamento', severidad: 'grave', reaccion: 'edema facial' }],
    tags: ['nuevo'], notas: '',
  },
  {
    id: 'pac-sint-04', nombre: 'Ernesto Villanueva Paredes', telefono: '55 0000 0004',
    edad: 29, sexo: 'Masculino', alergias: '',
    tags: ['frecuente'], notas: 'Deportista. Sin crónicos.',
    ultimaCita: diasAtras(90),
  },
]

async function sembrarPacientes() {
  for (const p of PACIENTES) {
    await db.doc(`clinics/${CLINIC_ID}/patients/${p.id}`).set({
      ...p, noShowCount: 0, cancelacionCount: 0,
      createdAt: ahora, updatedAt: ahora, creadoPor: UID,
    })
  }
  console.log(`✓ ${PACIENTES.length} pacientes sintéticos`)
}

async function sembrarCitas() {
  const dia = hoyLocal()
  const CITAS = [
    { id: 'cita-01', p: PACIENTES[0], hora: '09:00', tipo: 'seguimiento', motivo: 'Control de hipertensión y DM2', estado: 'atendida', confirmado: true },
    { id: 'cita-02', p: PACIENTES[1], hora: '10:00', tipo: 'seguimiento', motivo: 'EPOC — revisión de espirometría', estado: 'en-consulta', confirmado: true },
    { id: 'cita-03', p: PACIENTES[2], hora: '11:00', tipo: 'primera-vez', motivo: 'Fiebre intermitente de 2 semanas', estado: 'en-sala', confirmado: true },
    { id: 'cita-04', p: PACIENTES[3], hora: '12:30', tipo: 'seguimiento', motivo: 'Resultados de laboratorio', estado: 'confirmada', confirmado: true },
    { id: 'cita-05', p: PACIENTES[0], hora: '17:00', tipo: 'teleconsulta', motivo: 'Ajuste de tratamiento', estado: 'pendiente-confirmar', confirmado: false },
    // Una CANCELADA: sin ella, el estado «cerrado» del riel (tachado, nodo
    // apagado, sin acción) no aparecía en NINGUNA captura y quedaba sin
    // evidencia visual (revisión independiente, P2.7).
    { id: 'cita-06', p: PACIENTES[1], hora: '13:30', tipo: 'seguimiento', motivo: 'Renovación de receta', estado: 'cancelada', confirmado: false },
  ]
  for (const c of CITAS) {
    await db.doc(`clinics/${CLINIC_ID}/appointments/${c.id}`).set({
      id: c.id,
      pacienteId: c.p.id,
      pacienteNombre: c.p.nombre,
      pacienteTelefono: c.p.telefono,
      fechaHora: `${dia} ${c.hora}`,
      duracion: 30,
      tipo: c.tipo,
      motivo: c.motivo,
      estado: c.estado,
      origen: 'Manual',
      medicoNombre: MEDICO,
      medicoId: UID,
      confirmadoPaciente: c.confirmado,
      recordatorio24hEnviado: true,
      recordatorioMismoDiaEnviado: false,
      consentimientoMensajes: true,
      createdAt: ahora, updatedAt: ahora, creadoPor: UID, updatedPor: UID,
    })
  }
  console.log(`✓ ${CITAS.length} citas de hoy (${dia})`)
}

/**
 * Nota BORRADOR para puntuar el editor/visor de nota (V10 §34): sin una nota,
 * /nota/... sólo enseña «Nota no encontrada». La forma imita lo que escribe
 * `construirNota('borrador')` en consulta/page.tsx (mirado del lado que LEE:
 * getNota → normNota exige arreglos, getNotas ordena por fechaConsulta).
 * Contenido 100 % sintético; dosis de libro de texto, no calculadas aquí.
 */
async function sembrarNotaBorrador() {
  const p = PACIENTES[0]
  const dia = hoyLocal()
  await db.doc(`clinics/${CLINIC_ID}/patients/${p.id}/notas/nota-sint-01`).set({
    id: 'nota-sint-01',
    clinicId: CLINIC_ID,
    pacienteId: p.id,
    pacienteNombre: p.nombre,
    tipo: 'seguimiento',
    estado: 'borrador',
    fechaConsulta: `${dia}T09:20:00.000Z`,
    metadata: {
      id: 'nota-sint-01',
      tipoNota: 'seguimiento',
      clinicId: CLINIC_ID,
      pacienteId: p.id,
      medicoId: UID,
      cedulaProfesional: '0000000 (DEMO)',
      especialidad: 'Medicina Interna · Infectología',
      establecimiento: 'Consultorio de Medicina Interna e Infectología',
      fechaCreacion: `${dia}T09:20:00.000Z`,
      fechaModificacion: `${dia}T09:38:00.000Z`,
      hashIntegridad: '',
      version: 1,
      estado: 'borrador',
      fuenteGeneracion: 'ia_voz',
    },
    resumenEjecutivo: 'Seguimiento de HTA y DM2 en metas; se mantiene tratamiento y se solicita panel de control.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', obligatorio: true, value: 'Acude a control programado de hipertensión arterial y diabetes tipo 2. Refiere apego al tratamiento, sin cefalea, sin visión borrosa, sin dolor torácico ni disnea. Automonitoreo domiciliario con cifras tensionales estables. Niega hipoglucemias.' },
      { key: 'objetivo', label: 'Objetivo', obligatorio: true, value: 'Consciente, orientada, hidratada. Cardiopulmonar sin agregados. Abdomen blando, sin visceromegalias. Extremidades sin edema; pulsos distales presentes y simétricos.' },
      { key: 'analisis', label: 'Análisis', obligatorio: true, value: 'HTA esencial en control ambulatorio adecuado. DM2 en metas por automonitoreo; pendiente corroborar con HbA1c del trimestre.' },
      { key: 'plan', label: 'Plan', obligatorio: true, value: 'Se mantiene tratamiento actual. Se solicita química sanguínea, HbA1c y perfil lipídico. Cita de control en 4 semanas con resultados. Datos de alarma explicados.' },
    ],
    signosVitales: { ta: '124/78', fc: 72, fr: 16, temp: 36.6, peso: 68.4, talla: 158 },
    diagnosticos: [
      { descripcion: 'Hipertensión esencial (primaria)', codigoCIE10: 'I10', tipo: 'definitivo', estado: 'cronico' },
      { descripcion: 'Diabetes mellitus tipo 2 sin complicaciones', codigoCIE10: 'E11.9', tipo: 'definitivo', estado: 'cronico' },
    ],
    medicamentos: [
      { nombre: 'Losartán', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas', duracion: 'indefinido', indicacion: 'HTA' },
      { nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: 'indefinido', indicacion: 'DM2' },
    ],
    alergias: [{ alergeno: 'Penicilina', tipo: 'medicamento', severidad: 'moderada', reaccion: 'rash generalizado' }],
    createdAt: `${dia}T09:20:00.000Z`,
    updatedAt: `${dia}T09:38:00.000Z`,
    creadoPor: UID,
  })
  console.log('✓ nota borrador nota-sint-01 (pac-sint-01)')
}

await sembrarAuth()
await sembrarClinica()
await sembrarPacientes()
await sembrarCitas()
await sembrarNotaBorrador()
console.log('✓ siembra sintética completa')
process.exit(0)
