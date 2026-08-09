/**
 * SIEMBRA SINTÉTICA PARA EL ARNÉS DE CAPTURAS V10 (B-V10-2).
 *
 * Puebla los EMULADORES (Auth + Firestore, proyecto `demo-nexusmed-test`) con
 * un consultorio sintético completo para capturar el golden flow autenticado:
 * médico, clínica, pacientes, citas de hoy, y resumen clínico.
 *
 * CANDADOS: exige FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST, y un
 * projectId que empiece por `demo-`. Sin eso, se niega a correr. Cero datos
 * reales: todos los pacientes son sintéticos (regla data-privacy.md).
 *
 * Uso:  node scripts/design/sembrar-emulador-v10.mjs
 */
import admin from 'firebase-admin'

const PROJECT_ID = 'demo-nexusmed-test'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('✋ Falta FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST. Este script SOLO habla con emuladores.')
  process.exit(1)
}
if (!PROJECT_ID.startsWith('demo-')) {
  console.error('✋ El projectId debe empezar por demo-.')
  process.exit(1)
}

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()
db.settings({ ignoreUndefinedProperties: true })

const CLINIC_ID = 'demo-clinica-v10'
const EMAIL = 'medico@demo-nexusmed.test'
const PASSWORD = 'demo-visual-v10'

const hoy = new Date()
const yyyy = hoy.getFullYear()
const mm = String(hoy.getMonth() + 1).padStart(2, '0')
const dd = String(hoy.getDate()).padStart(2, '0')
const HOY = `${yyyy}-${mm}-${dd}`
const ISO = hoy.toISOString()

async function ensureUser() {
  try {
    const u = await admin.auth().getUserByEmail(EMAIL)
    return u.uid
  } catch {
    const u = await admin.auth().createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Dra. Elena Vázquez Ortiz',
      emailVerified: true,
    })
    return u.uid
  }
}

const uid = await ensureUser()
console.log('uid médico:', uid)

// ── Clínica ──────────────────────────────────────────────────────────────
await db.doc(`clinics/${CLINIC_ID}`).set({
  nombreClinica: 'Consultorio de Medicina Interna e Infectología',
  nombreMedico: 'Dra. Elena Vázquez Ortiz',
  plan: 'premium',
  status: 'active',
  paseLibre: true,
  paseLibreMotivo: 'entorno sintético de capturas V10',
  ownerId: uid,
  createdAt: ISO,
  updatedAt: ISO,
})

await db.doc(`clinic_members/${uid}`).set({
  clinicId: CLINIC_ID,
  role: 'medico',
  displayName: 'Dra. Elena Vázquez',
  createdAt: ISO,
})

await db.doc(`clinics/${CLINIC_ID}/doctors/doc-1`).set({
  nombre: 'Dra. Elena Vázquez Ortiz',
  especialidad: 'Medicina Interna · Infectología',
  cedulaProfesional: '00000000',
  activo: true,
})

await db.doc(`clinics/${CLINIC_ID}/config/main`).set({
  nombreClinica: 'Consultorio de Medicina Interna e Infectología',
  nombreMedico: 'Dra. Elena Vázquez Ortiz',
  especialidad: 'Medicina Interna · Infectología',
  telefono: '+52 614 000 0000',
  direccion: 'Av. Ficticia 123, Col. Sintética, Chihuahua, Chih.',
  duracionCitaMin: 30,
  horaInicio: '09:00',
  horaFin: '19:00',
})

// ── Pacientes sintéticos ─────────────────────────────────────────────────
const pacientes = [
  {
    id: 'pac-01', nombre: 'María Guadalupe Herrera Sandoval', telefono: '614-111-0001',
    fechaNacimiento: '1954-03-12', edad: 72, sexo: 'Femenino',
    alergias: 'Penicilina (anafilaxia, 2009)', seguroMedico: 'GNP',
    tags: ['cronico'], noShowCount: 0, cancelacionCount: 1,
    resumen: {
      alergias: 'Penicilina (anafilaxia, 2009)',
      notasClinicas: 'DM2 desde 2011 en metformina. HAS en losartán. EPOC GOLD II. Neumonía adquirida en comunidad en enero 2026, resuelta.',
    },
  },
  {
    id: 'pac-02', nombre: 'José Antonio Quintana Ruiz', telefono: '614-111-0002',
    fechaNacimiento: '1988-11-02', edad: 37, sexo: 'Masculino',
    alergias: '', seguroMedico: '',
    tags: [], noShowCount: 2, cancelacionCount: 0,
    resumen: { notasClinicas: 'VIH en TAR (bictegravir/FTC/TAF) desde 2021, carga indetectable. Última CD4 610.' },
  },
  {
    id: 'pac-03', nombre: 'Carmen Aurora Mendívil López', telefono: '614-111-0003',
    fechaNacimiento: '1996-06-24', edad: 30, sexo: 'Femenino',
    alergias: 'Sulfas (exantema)', seguroMedico: 'AXA',
    tags: [], noShowCount: 0, cancelacionCount: 0,
    resumen: { alergias: 'Sulfas (exantema)', notasClinicas: 'ITU de repetición; urocultivo pendiente de revisión.' },
  },
  {
    id: 'pac-04', nombre: 'Rogelio Balderrama Cepeda', telefono: '614-111-0004',
    fechaNacimiento: '1947-01-30', edad: 79, sexo: 'Masculino',
    alergias: '', seguroMedico: 'IMSS + particular',
    tags: ['cronico'], noShowCount: 1, cancelacionCount: 2,
    resumen: { notasClinicas: 'ERC KDIGO G3b. FA anticoagulada con apixabán. Pie diabético en vigilancia.' },
  },
  {
    id: 'pac-05', nombre: 'Ana Sofía Terrazas Molina', telefono: '614-111-0005',
    fechaNacimiento: '2001-09-15', edad: 24, sexo: 'Femenino',
    alergias: '', seguroMedico: '',
    tags: [], noShowCount: 0, cancelacionCount: 0,
    resumen: {},
  },
  {
    id: 'pac-06', nombre: 'Federico Chávez Iribarren', telefono: '614-111-0006',
    fechaNacimiento: '1969-07-08', edad: 57, sexo: 'Masculino',
    alergias: 'AINE (broncoespasmo)', seguroMedico: 'Metlife',
    tags: [], noShowCount: 0, cancelacionCount: 0,
    resumen: { alergias: 'AINE (broncoespasmo)', notasClinicas: 'Asma. Sospecha de tuberculosis latente — QuantiFERON solicitado.' },
  },
]

for (const p of pacientes) {
  const { resumen, ...ficha } = p
  await db.doc(`clinics/${CLINIC_ID}/patients/${p.id}`).set({
    ...ficha,
    createdAt: ISO, updatedAt: ISO, creadoPor: uid,
  })
  if (resumen && Object.keys(resumen).length) {
    await db.doc(`clinics/${CLINIC_ID}/patients/${p.id}/clinico/resumen`).set({
      ...resumen, actualizadoEn: ISO, actualizadoPor: uid,
    })
  }
}

// ── Citas de HOY (agenda viva, estados variados) ─────────────────────────
const citas = [
  { id: 'cita-01', p: pacientes[0], hora: '09:00', tipo: 'seguimiento', estado: 'atendida', motivo: 'Control DM2 + revisión de espirometría' },
  { id: 'cita-02', p: pacientes[1], hora: '09:30', tipo: 'seguimiento', estado: 'atendida', motivo: 'Control VIH — resultados de laboratorio' },
  { id: 'cita-03', p: pacientes[2], hora: '10:30', tipo: 'primera-vez', estado: 'en-consulta', motivo: 'ITU de repetición, urocultivo' },
  { id: 'cita-04', p: pacientes[3], hora: '11:30', tipo: 'seguimiento', estado: 'en-sala', motivo: 'ERC — ajuste de anticoagulación' },
  { id: 'cita-05', p: pacientes[4], hora: '12:30', tipo: 'primera-vez', estado: 'confirmada', motivo: 'Fiebre prolongada en estudio' },
  { id: 'cita-06', p: pacientes[5], hora: '17:00', tipo: 'estudios', estado: 'pendiente-confirmar', motivo: 'Revisión QuantiFERON' },
]

for (const c of citas) {
  await db.doc(`clinics/${CLINIC_ID}/appointments/${c.id}`).set({
    pacienteId: c.p.id,
    pacienteNombre: c.p.nombre,
    pacienteTelefono: c.p.telefono,
    fechaHora: `${HOY} ${c.hora}`,
    duracion: 30,
    tipo: c.tipo,
    motivo: c.motivo,
    estado: c.estado,
    origen: 'Manual',
    medicoNombre: 'Dra. Elena Vázquez Ortiz',
    medicoId: uid,
    confirmadoPaciente: ['confirmada', 'en-sala', 'en-consulta', 'atendida'].includes(c.estado),
    recordatorio24hEnviado: true,
    recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true,
    createdAt: ISO, updatedAt: ISO, creadoPor: uid, updatedPor: uid,
  })
}

// ── Nota firmada (para receta y expediente con historia) ────────────────
// Datos 100 % sintéticos; dosis de vademécum estándar sólo como fixture visual.
await db.doc(`clinics/${CLINIC_ID}/patients/pac-01/notas/nota-01`).set({
  clinicId: CLINIC_ID,
  pacienteId: 'pac-01',
  pacienteNombre: 'María Guadalupe Herrera Sandoval',
  tipo: 'seguimiento',
  fechaConsulta: `${HOY} 09:00`,
  metadata: {
    id: 'nota-01',
    tipoNota: 'seguimiento',
    clinicId: CLINIC_ID,
    pacienteId: 'pac-01',
    medicoId: uid,
    cedulaProfesional: '00000000',
    especialidad: 'Medicina Interna · Infectología',
    establecimiento: 'Consultorio de Medicina Interna e Infectología',
    fechaCreacion: ISO,
    fechaModificacion: ISO,
    hashIntegridad: 'sintetico-v10',
    version: 1,
    estado: 'firmada',
    fuenteGeneracion: 'manual',
  },
  resumenEjecutivo: 'DM2 e HAS en control aceptable; se ajusta metformina y se solicita HbA1c de control.',
  secciones: [
    { key: 'subjetivo', label: 'Subjetivo', value: 'Acude a control de DM2 e HAS. Refiere apego al tratamiento, sin hipoglucemias. Disnea de esfuerzo estable (EPOC GOLD II).' },
    { key: 'objetivo', label: 'Objetivo', value: 'TA 128/78 mmHg, FC 74 lpm, glucemia capilar 132 mg/dL. Campos pulmonares con hipoventilación basal conocida, sin agregados.' },
    { key: 'analisis', label: 'Análisis', value: 'DM2 con control aceptable; HAS controlada. Sin datos de descompensación respiratoria.' },
    { key: 'plan', label: 'Plan', value: 'Continúa metformina y losartán. HbA1c y perfil lipídico en 4 semanas. Cita de control en 1 mes.' },
  ],
  signosVitales: { ta: '128/78', fc: 74, fr: 18, temp: 36.6, spo2: 93, peso: 68, talla: 156 },
  diagnosticos: [
    { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11.9', tipo: 'definitivo', estado: 'cronico' },
    { descripcion: 'Hipertensión arterial sistémica', codigoCIE10: 'I10', tipo: 'definitivo', estado: 'cronico' },
  ],
  medicamentos: [
    { nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: '30 días', indicacion: 'con alimentos' },
    { nombre: 'Losartán', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas', duracion: '30 días' },
  ],
  alergias: [{ sustancia: 'Penicilina', reaccion: 'anafilaxia', severidad: 'grave' }],
})

console.log(`✅ Sembrado: clínica ${CLINIC_ID}, ${pacientes.length} pacientes, ${citas.length} citas de ${HOY}, 1 nota firmada`)
console.log(`   Login: ${EMAIL} / ${PASSWORD}`)
