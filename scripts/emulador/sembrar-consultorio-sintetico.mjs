#!/usr/bin/env node
/**
 * SIEMBRA UN CONSULTORIO SINTÉTICO EN LOS EMULADORES — para poder ABRIR el
 * producto en un navegador sin credenciales reales (V10, inspección visual).
 *
 * Qué hace:
 *   1. Crea el usuario `medico@demo.nexusmed.test` en el emulador de Auth.
 *   2. Escribe en el emulador de Firestore un consultorio activo, su membresía,
 *      pacientes y citas de HOY — todo sintético, regla «cero pacientes reales».
 *
 * Candados (los mismos de `emulator/entorno.ts`):
 *   - El projectId empieza por `demo-`: el SDK se NIEGA a hablar con un proyecto
 *     real, así que esta semilla no puede tocar datos de un médico.
 *   - Exige FIRESTORE_EMULATOR_HOST: sin emulador declarado, aborta.
 *
 * Uso:
 *   npx firebase emulators:start --only firestore,auth --project demo-nexusmed-dev &
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/emulador/sembrar-consultorio-sintetico.mjs
 *
 * La app se apunta a los emuladores con NEXT_PUBLIC_FIREBASE_EMULATORS=1
 * (ver `src/lib/firebase.ts` y `docs/testing/entorno-visual-emulador.md`).
 */

const PROJECT_ID = 'demo-nexusmed-dev'
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'
const CLINIC_ID = 'clinica-demo'
const EMAIL = 'medico@demo.nexusmed.test'
const PASSWORD = 'demo-visual-2026'

if (!PROJECT_ID.startsWith('demo-')) {
  console.error('El projectId debe empezar por demo- (candado anti-producción).')
  process.exit(1)
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Falta FIRESTORE_EMULATOR_HOST (p. ej. 127.0.0.1:8080). Sin emulador declarado no se siembra.')
  process.exit(1)
}

// ── 1 · Usuario en el emulador de Auth (REST; cualquier apiKey vale) ──────
async function crearMedico() {
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    },
  )
  const cuerpo = await res.json()
  if (cuerpo.localId) return cuerpo.localId
  if (cuerpo?.error?.message === 'EMAIL_EXISTS') {
    const login = await fetch(
      `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
      },
    )
    const sesion = await login.json()
    if (sesion.localId) return sesion.localId
  }
  throw new Error(`No se pudo crear el médico sintético: ${JSON.stringify(cuerpo)}`)
}

// ── 2 · Datos sintéticos en Firestore (admin SDK → salta reglas: es semilla) ──
const { default: admin } = await import('firebase-admin')
admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

const hoy = new Date()
const dia = (desplazamiento = 0) => {
  const f = new Date(hoy)
  f.setDate(f.getDate() + desplazamiento)
  return f.toISOString().slice(0, 10)
}
const ahoraIso = hoy.toISOString()

/** Pacientes sintéticos — nombres inventados, sin CURP, sin teléfono real. */
const PACIENTES = [
  {
    id: 'pac-sint-01', nombre: 'Ernesto Salazar Quintana', edad: 67, sexo: 'Masculino',
    telefono: '+5261400000001', alergias: 'Penicilina (rash generalizado)',
    notas: 'DM2 de 12 años de evolución. HTA. ERC KDIGO G3a.',
    tags: ['cronico'], noShowCount: 0, cancelacionCount: 1,
    ultimaCita: dia(-30), proximoSeguimiento: dia(0),
  },
  {
    id: 'pac-sint-02', nombre: 'María Fernanda Olivares Rey', edad: 34, sexo: 'Femenino',
    telefono: '+5261400000002', alergias: '',
    notas: 'Pielonefritis derecha tratada hace 3 meses. Urocultivo de control pendiente.',
    tags: [], noShowCount: 0, cancelacionCount: 0,
    ultimaCita: dia(-90), proximoSeguimiento: dia(0),
  },
  {
    id: 'pac-sint-03', nombre: 'Joaquín Beltrán Mora', edad: 58, sexo: 'Masculino',
    telefono: '+5261400000003', alergias: 'Sulfas',
    notas: 'VIH en TAR, indetectable desde 2023. Última CV: dic-2025.',
    tags: ['cronico'], noShowCount: 1, cancelacionCount: 0,
    ultimaCita: dia(-45), proximoSeguimiento: dia(0),
  },
  {
    id: 'pac-sint-04', nombre: 'Alicia Cordero Vidal', edad: 79, sexo: 'Femenino',
    telefono: '+5261400000004', alergias: 'AINE (broncoespasmo) · Contraste yodado',
    notas: 'FA anticoagulada. Deterioro cognitivo leve. Acude con hija.',
    tags: ['fragil'], noShowCount: 0, cancelacionCount: 0,
    ultimaCita: dia(-14), proximoSeguimiento: dia(1),
  },
  {
    id: 'pac-sint-05', nombre: 'Rodrigo Peña Castellanos', edad: 41, sexo: 'Masculino',
    telefono: '+5261400000005', alergias: '',
    notas: 'Primera vez. Referido por fiebre prolongada en estudio.',
    tags: [], noShowCount: 0, cancelacionCount: 0,
  },
  {
    id: 'pac-sint-06', nombre: 'Guadalupe Ferrer Anaya', edad: 52, sexo: 'Femenino',
    telefono: '+5261400000006', alergias: 'Ninguna conocida',
    notas: 'Hipotiroidismo en sustitución. Control anual.',
    tags: [], noShowCount: 2, cancelacionCount: 1,
    ultimaCita: dia(-365),
  },
]

/** Citas de hoy en varios estados — para ver la agenda con vida real. */
const CITAS = [
  { id: 'cita-sint-01', pacienteId: 'pac-sint-01', hora: '09:00', duracion: 30, tipo: 'seguimiento', estado: 'atendida', motivo: 'Control DM2/HTA + resultados de laboratorio' },
  { id: 'cita-sint-02', pacienteId: 'pac-sint-02', hora: '09:45', duracion: 30, tipo: 'seguimiento', estado: 'atendida', motivo: 'Control post-pielonefritis' },
  { id: 'cita-sint-03', pacienteId: 'pac-sint-03', hora: '10:30', duracion: 30, tipo: 'seguimiento', estado: 'en-consulta', motivo: 'Seguimiento VIH · revisión de TAR' },
  { id: 'cita-sint-04', pacienteId: 'pac-sint-04', hora: '11:15', duracion: 45, tipo: 'seguimiento', estado: 'en-sala', motivo: 'FA anticoagulada · ajuste de dosis' },
  { id: 'cita-sint-05', pacienteId: 'pac-sint-05', hora: '12:30', duracion: 45, tipo: 'primera-vez', estado: 'confirmada', motivo: 'Fiebre prolongada en estudio' },
  { id: 'cita-sint-06', pacienteId: 'pac-sint-06', hora: '17:00', duracion: 30, tipo: 'seguimiento', estado: 'pendiente-confirmar', motivo: 'Control anual de hipotiroidismo' },
]

async function sembrar(uidMedico) {
  const lote = db.batch()

  lote.set(db.doc(`clinics/${CLINIC_ID}`), {
    nombreClinica: 'Consultorio de Medicina Interna e Infectología (SINTÉTICO)',
    nombreMedico: 'Dr. Demo Sintético',
    plan: 'pro',
    status: 'active',
    ownerId: uidMedico,
    createdAt: ahoraIso,
    updatedAt: ahoraIso,
  }, { merge: true })

  lote.set(db.doc(`clinic_members/${uidMedico}`), {
    clinicId: CLINIC_ID,
    role: 'medico',
    displayName: 'Dr. Demo Sintético',
    createdAt: ahoraIso,
  })

  for (const p of PACIENTES) {
    const { id, ...datos } = p
    lote.set(db.doc(`clinics/${CLINIC_ID}/patients/${id}`), {
      ...datos,
      createdAt: ahoraIso,
      updatedAt: ahoraIso,
    })
  }

  for (const c of CITAS) {
    const paciente = PACIENTES.find(p => p.id === c.pacienteId)
    lote.set(db.doc(`clinics/${CLINIC_ID}/appointments/${c.id}`), {
      pacienteId: c.pacienteId,
      pacienteNombre: paciente.nombre,
      pacienteTelefono: paciente.telefono,
      fechaHora: `${dia(0)} ${c.hora}`,
      duracion: c.duracion,
      tipo: c.tipo,
      motivo: c.motivo,
      estado: c.estado,
      origen: 'Manual',
      medicoNombre: 'Dr. Demo Sintético',
      medicoId: uidMedico,
      confirmadoPaciente: ['atendida', 'en-consulta', 'en-sala', 'confirmada'].includes(c.estado),
      recordatorio24hEnviado: true,
      recordatorioMismoDiaEnviado: false,
      consentimientoMensajes: true,
      createdAt: ahoraIso,
      updatedAt: ahoraIso,
      creadoPor: uidMedico,
      updatedPor: uidMedico,
    })
  }

  await lote.commit()
}

const uid = await crearMedico()
await sembrar(uid)
console.log(`Consultorio sintético sembrado.
  Clínica : ${CLINIC_ID}
  Médico  : ${EMAIL} / ${PASSWORD} (uid ${uid})
  Pacientes: ${PACIENTES.length} · Citas de hoy: ${CITAS.length}`)
process.exit(0)
