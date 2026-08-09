/**
 * V10 · B-V10-2 — siembra del emulador para el arnés de capturas.
 *
 * Crea, contra los emuladores de Auth y Firestore (NUNCA contra un proyecto
 * real), el consultorio sintético que las capturas del golden flow necesitan:
 * una médica, su consultorio, su configuración, ocho pacientes y la agenda de
 * hoy con citas en todos los estados que la pantalla de inicio distingue.
 *
 * TODOS los datos son sintéticos (regla data-privacy: cero pacientes reales).
 * Los nombres son inventados; los teléfonos usan el prefijo 55 5000-… que no
 * se asigna; la cédula es la de pruebas.
 *
 * Cerrojo: se niega a correr si las variables *_EMULATOR_HOST no están
 * puestas — sin ellas el Admin SDK apuntaría a un proyecto real.
 */
import admin from 'firebase-admin'

const PROYECTO = 'demo-nexusmed-test'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('✗ Sin FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST. ' +
    'Este script SOLO corre contra emuladores. Abortando.')
  process.exit(1)
}

admin.initializeApp({ projectId: PROYECTO })
const db = admin.firestore()

// ── Identidad del arnés (la usa también capturar-golden-flow.mjs) ─────────
export const MEDICO = {
  uid: 'medico-demo-v10',
  email: 'demo.medica@nexusmed.test',
  password: 'NexusDemo-2026!',
  nombre: 'Dra. Valeria Cordero Ibáñez',
}
export const CLINIC_ID = 'consultorio-demo-v10'

const TZ = 'America/Mexico_City'
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const manana = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000))
const ahora = new Date().toISOString()

const PACIENTES = [
  { id: 'pac-01', nombre: 'Federico Zambrano Olivares', edad: 67, sexo: 'Masculino', telefono: '55 5000 0101', alergias: 'Penicilina (rash generalizado, 2019)' },
  { id: 'pac-02', nombre: 'Guillermina Cázares Duarte', edad: 74, sexo: 'Femenino', telefono: '55 5000 0102', alergias: '' },
  { id: 'pac-03', nombre: 'Aurelio Peñafiel Montaño', edad: 58, sexo: 'Masculino', telefono: '55 5000 0103', alergias: 'AINE (broncoespasmo)' },
  { id: 'pac-04', nombre: 'Casilda Urquieta Bermúdez', edad: 45, sexo: 'Femenino', telefono: '55 5000 0104', alergias: '' },
  { id: 'pac-05', nombre: 'Nemesio Alcántara Vidaurri', edad: 81, sexo: 'Masculino', telefono: '55 5000 0105', alergias: 'Sulfas' },
  { id: 'pac-06', nombre: 'Perpetua Landeros Gavito', edad: 39, sexo: 'Femenino', telefono: '55 5000 0106', alergias: '' },
  { id: 'pac-07', nombre: 'Torcuato Mendiola Arrieta', edad: 52, sexo: 'Masculino', telefono: '55 5000 0107', alergias: '' },
  { id: 'pac-08', nombre: 'Eufrosina Bracamontes Leal', edad: 63, sexo: 'Femenino', telefono: '55 5000 0108', alergias: 'Contraste yodado' },
]

// Agenda de hoy: los estados que la pantalla de inicio separa en su resumen.
const CITAS = [
  { pac: 0, hora: '09:00', estado: 'atendida', tipo: 'seguimiento', motivo: 'Control de diabetes tipo 2' },
  { pac: 1, hora: '09:40', estado: 'atendida', tipo: 'seguimiento', motivo: 'Hipertensión — ajuste de tratamiento' },
  { pac: 2, hora: '10:20', estado: 'en-consulta', tipo: 'primera-vez', motivo: 'Tos crónica en estudio' },
  { pac: 3, hora: '11:00', estado: 'en-sala', tipo: 'seguimiento', motivo: 'Resultados de laboratorio' },
  { pac: 4, hora: '12:00', estado: 'confirmada', tipo: 'seguimiento', motivo: 'Valoración prequirúrgica' },
  { pac: 5, hora: '13:00', estado: 'confirmada', tipo: 'teleconsulta', motivo: 'Seguimiento de tiroides' },
  { pac: 6, hora: '16:30', estado: 'pendiente-confirmar', tipo: 'primera-vez', motivo: 'Dolor abdominal recurrente' },
  { pac: 7, hora: '17:30', estado: 'confirmada', tipo: 'estudios', motivo: 'Revisión de TAC de tórax' },
  { pac: 5, hora: '10:00', dia: 'manana', estado: 'confirmada', tipo: 'seguimiento', motivo: 'Entrega de resultados' },
  { pac: 0, hora: '11:00', dia: 'manana', estado: 'pendiente-confirmar', tipo: 'seguimiento', motivo: 'Control mensual' },
]

async function sembrar() {
  // 1) La médica en el emulador de Auth (idempotente: borra si ya existe).
  try { await admin.auth().deleteUser(MEDICO.uid) } catch { /* primera corrida */ }
  await admin.auth().createUser({
    uid: MEDICO.uid, email: MEDICO.email, password: MEDICO.password,
    displayName: MEDICO.nombre, emailVerified: true,
  })

  // 2) Membresía + consultorio + configuración.
  await db.collection('clinic_members').doc(MEDICO.uid).set({
    clinicId: CLINIC_ID, role: 'medico', displayName: MEDICO.nombre, createdAt: ahora,
  })
  await db.collection('clinics').doc(CLINIC_ID).set({
    nombreClinica: 'Consultorio de Medicina Interna Cordero',
    nombreMedico: MEDICO.nombre,
    plan: 'pro', status: 'active',
    ownerId: MEDICO.uid, createdAt: ahora, updatedAt: ahora,
  })
  await db.collection('clinics').doc(CLINIC_ID).collection('config').doc('main').set({
    nombreMedico: MEDICO.nombre,
    nombreClinica: 'Consultorio de Medicina Interna Cordero',
    cedulaProfesional: '00000000',
    especialidad: 'Medicina Interna e Infectología',
    direccion: 'Av. Ficticia 123, Col. Sintética, CDMX',
    googleMapsUrl: '',
    telefonoAdmin: '55 5000 0000',
    whatsappConsultorio: '55 5000 0001',
    zonaHoraria: TZ,
  })

  // 3) Pacientes sintéticos.
  for (const p of PACIENTES) {
    await db.collection('clinics').doc(CLINIC_ID).collection('patients').doc(p.id).set({
      nombre: p.nombre, telefono: p.telefono, edad: p.edad, sexo: p.sexo,
      alergias: p.alergias, noShowCount: 0, cancelacionCount: 0,
      createdAt: ahora, updatedAt: ahora,
    })
  }

  // 4) La agenda de hoy (y dos citas de mañana para el renglón «mañana»).
  let i = 0
  for (const c of CITAS) {
    const p = PACIENTES[c.pac]
    const fecha = c.dia === 'manana' ? manana : hoy
    await db.collection('clinics').doc(CLINIC_ID).collection('appointments').doc(`cita-${String(++i).padStart(2, '0')}`).set({
      pacienteId: p.id, pacienteNombre: p.nombre, pacienteTelefono: p.telefono,
      fechaHora: `${fecha} ${c.hora}`, duracion: 30,
      tipo: c.tipo, motivo: c.motivo, estado: c.estado, origen: 'Manual',
      medicoNombre: MEDICO.nombre, medicoId: MEDICO.uid,
      confirmadoPaciente: ['confirmada', 'en-sala', 'en-consulta', 'atendida'].includes(c.estado),
      recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
      consentimientoMensajes: true,
      createdAt: ahora, updatedAt: ahora, creadoPor: MEDICO.uid, updatedPor: MEDICO.uid,
    })
  }

  console.log(`✓ Sembrado: 1 médica, 1 consultorio, ${PACIENTES.length} pacientes, ${CITAS.length} citas (${hoy} · ${TZ})`)
}

// Ejecutable directo o importable desde el orquestador de capturas.
if (process.argv[1] && process.argv[1].endsWith('sembrar-emulador.mjs')) {
  sembrar().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
export { sembrar }
