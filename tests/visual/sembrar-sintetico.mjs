/**
 * Siembra SINTÉTICA para el arnés de capturas V10 — SOLO emuladores.
 *
 * Crea en los emuladores de Auth (9099) y Firestore (8080), proyecto
 * `demo-nexusmed-test`, lo mínimo para que el golden flow autenticado rinda con
 * datos realistas: un médico con contraseña, su membresía, la clínica activa,
 * su configuración, cuatro pacientes y las citas de HOY en varios estados.
 *
 * CERO datos reales (regla `data-privacy.md`): nombres, teléfonos y correos son
 * inventados; el guion clínico viene del corpus sintético del repo.
 *
 * SEGURO POR CONSTRUCCIÓN: exige FIRESTORE_EMULATOR_HOST y
 * FIREBASE_AUTH_EMULATOR_HOST antes de importar firebase-admin. Sin esas
 * variables el script ABORTA — no existe camino por el que escriba producción.
 *
 * Uso (lo orquesta capturar-golden-flow.sh):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   node tests/visual/sembrar-sintetico.mjs
 */
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('ABORTADO: este script solo corre contra emuladores. ' +
    'Faltan FIRESTORE_EMULATOR_HOST y/o FIREBASE_AUTH_EMULATOR_HOST.')
  process.exit(1)
}

const admin = (await import('firebase-admin')).default

const PROYECTO = 'demo-nexusmed-test'
admin.initializeApp({ projectId: PROYECTO })
const db = admin.firestore()

export const MEDICO = {
  email: 'medico@sintetico.test',
  password: 'Captura-V10-Sintetica',
  nombre: 'Dra. Elena Vázquez Riquelme',
}
const CLINIC_ID = 'clinica-sintetica-v10'

// ── Auth: el médico ──────────────────────────────────────────────────────────
let uid
try {
  const u = await admin.auth().createUser({
    email: MEDICO.email,
    password: MEDICO.password,
    displayName: MEDICO.nombre,
    emailVerified: true,
  })
  uid = u.uid
} catch (e) {
  if (e.code === 'auth/email-already-exists') {
    uid = (await admin.auth().getUserByEmail(MEDICO.email)).uid
  } else { throw e }
}

// ── Membresía y clínica ──────────────────────────────────────────────────────
await db.doc(`clinic_members/${uid}`).set({ clinicId: CLINIC_ID, role: 'medico' })

await db.doc(`clinics/${CLINIC_ID}`).set({
  nombreClinica: 'Consultorio de Medicina Interna e Infectología',
  nombreMedico: MEDICO.nombre,
  plan: 'pro',
  status: 'active',
})

await db.doc(`clinics/${CLINIC_ID}/config/main`).set({
  nombreMedico: MEDICO.nombre,
  nombreClinica: 'Consultorio de Medicina Interna e Infectología',
  cedulaProfesional: '00000000',
  especialidad: 'Medicina Interna · Infectología',
  direccion: 'Av. Ficticia 123, Col. Sintética, Hermosillo, Son.',
  googleMapsUrl: '',
  telefonoAdmin: '6620000000',
  whatsappConsultorio: '6620000000',
})

// ── Pacientes sintéticos ─────────────────────────────────────────────────────
const PACIENTES = [
  {
    id: 'pac-sint-01',
    nombre: 'María Guadalupe Contreras Ibáñez',
    telefono: '6621111111',
    fechaNacimiento: '1957-03-14',
    sexo: 'Femenino',
    alergias: 'Penicilina (rash), sulfas',
    alergiasEstructuradas: [
      { alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'exantema', severidad: 'moderada', confirmada: true },
      { alergeno: 'Sulfametoxazol', tipo: 'medicamento' },
    ],
  },
  {
    id: 'pac-sint-02',
    nombre: 'José Antonio Lugo Esquer',
    telefono: '6622222222',
    fechaNacimiento: '1949-11-02',
    sexo: 'Masculino',
    alergias: '',
  },
  {
    id: 'pac-sint-03',
    nombre: 'Renata Villaescusa Duarte',
    telefono: '6623333333',
    fechaNacimiento: '1991-07-28',
    sexo: 'Femenino',
    alergias: 'Ninguna conocida',
  },
  {
    id: 'pac-sint-04',
    nombre: 'Ernesto Salido Barreras',
    telefono: '6624444444',
    fechaNacimiento: '1978-01-19',
    sexo: 'Masculino',
    alergias: 'AINE (broncoespasmo)',
  },
]
for (const p of PACIENTES) {
  const { id, ...datos } = p
  await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({
    ...datos,
    createdAt: new Date().toISOString(),
  })
}

// ── Citas de HOY, en los estados que la agenda pinta distinto ────────────────
const hoy = new Date()
const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
const cita = (pac, hora, extra) => ({
  pacienteId: pac.id,
  pacienteNombre: pac.nombre,
  pacienteTelefono: pac.telefono,
  fechaHora: `${fecha} ${hora}`,
  duracion: 30,
  tipo: 'seguimiento',
  origen: 'Manual',
  medicoNombre: MEDICO.nombre,
  confirmadoPaciente: false,
  recordatorio24hEnviado: false,
  recordatorioMismoDiaEnviado: false,
  consentimientoMensajes: true,
  ...extra,
})
const CITAS = [
  cita(PACIENTES[0], '09:00', { estado: 'atendida', tipo: 'seguimiento', motivo: 'Control de diabetes tipo 2', confirmadoPaciente: true }),
  cita(PACIENTES[1], '10:00', { estado: 'no-asistio', tipo: 'seguimiento', motivo: 'EPOC — revisión de espirometría' }),
  cita(PACIENTES[2], '11:30', { estado: 'en-sala', tipo: 'primera-vez', motivo: 'Fiebre prolongada en estudio', confirmadoPaciente: true }),
  cita(PACIENTES[3], '12:30', { estado: 'confirmada', tipo: 'seguimiento', motivo: 'Celulitis en tratamiento — control', confirmadoPaciente: true }),
  cita(PACIENTES[0], '17:00', { estado: 'pendiente-confirmar', tipo: 'estudios', motivo: 'Revisión de laboratorios' }),
]
for (let i = 0; i < CITAS.length; i++) {
  await db.doc(`clinics/${CLINIC_ID}/appointments/cita-sint-${String(i + 1).padStart(2, '0')}`).set(CITAS[i])
}

console.log(`Sembrado: 1 médico (${MEDICO.email}), 1 clínica (${CLINIC_ID}), ${PACIENTES.length} pacientes, ${CITAS.length} citas para ${fecha}.`)
process.exit(0)
