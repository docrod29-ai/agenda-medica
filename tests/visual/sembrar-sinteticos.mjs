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

const PACIENTES = [
  {
    id: 'pac-sint-01', nombre: 'María Fernanda Saldívar Roble', telefono: '55 0000 0001',
    edad: 54, sexo: 'Femenino', alergias: 'Penicilina (rash generalizado)',
    alergiasEstructuradas: [{ alergeno: 'Penicilina', tipo: 'medicamento', severidad: 'moderada', reaccion: 'rash generalizado' }],
    tags: ['seguimiento', 'cronico'], notas: 'HTA esencial en control. DM2 en metas.',
  },
  {
    id: 'pac-sint-02', nombre: 'José Emilio Carranza Peón', telefono: '55 0000 0002',
    edad: 67, sexo: 'Masculino', alergias: '',
    tags: ['alto-riesgo', 'pendiente-estudios'], notas: 'EPOC GOLD B. Exfumador.',
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

await sembrarAuth()
await sembrarClinica()
await sembrarPacientes()
await sembrarCitas()
console.log('✓ siembra sintética completa')
process.exit(0)
