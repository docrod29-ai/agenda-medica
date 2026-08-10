/**
 * V10 — siembra SINTÉTICA para el arnés de capturas del golden flow.
 *
 * Corre SOLO contra emuladores (Auth 9099 + Firestore 8080, proyecto
 * demo-nexusmed-test). Se niega a arrancar si las variables de emulador no
 * están puestas: este script jamás debe poder tocar un proyecto real.
 *
 * Datos: cero pacientes reales (.claude/rules/data-privacy.md). Nombres y
 * teléfonos inventados, dominio .test, fechas relativas al día en que corre.
 *
 * Uso (lo orquesta capturar-golden-flow.mjs, pero se puede a mano):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node scripts/design/sembrar-emulador-v10.mjs
 */
import admin from 'firebase-admin'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('ABORT: FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST son obligatorias — este script solo siembra emuladores.')
  process.exit(1)
}

const PROJECT = 'demo-nexusmed-test'
admin.initializeApp({ projectId: PROJECT })

const auth = admin.auth()
const db = admin.firestore()

const CLINIC_ID = 'demo-consultorio-v10'
const EMAIL = 'dra.demo@nexusmed.test'
const PASSWORD = 'arnes-v10-demo'

// Fechas relativas EN LA ZONA DEL CONSULTORIO. El primer intento usó UTC y la
// agenda salió vacía en la captura: a las 03:00 UTC del día 10, en CDMX todavía
// es día 9 — «hoy» del arnés y «hoy» de la app no coincidían. La regla del
// producto es la misma (REG-293: el día de un cobro es el del consultorio).
const TZ = 'America/Mexico_City'
const hoy = new Date()
const iso = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const HOY = iso(hoy)
const dias = (n) => iso(new Date(hoy.getTime() + n * 86400000))

async function main() {
  // 1) Usuario médico
  let user
  try {
    user = await auth.getUserByEmail(EMAIL)
  } catch {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: 'Dra. Aurora Demo' })
  }
  const uid = user.uid

  // 2) Consultorio en prueba (Modelo A: 14 días sin tarjeta) + membresía
  const trialEnds = new Date(hoy.getTime() + 10 * 86400000)
  await db.doc(`clinics/${CLINIC_ID}`).set({
    nombreClinica: 'Consultorio Demo NexusMED',
    nombreMedico: 'Dra. Aurora Demo',
    plan: 'trial',
    status: 'trial',
    trialEndsAt: trialEnds.toISOString(),
    trialEndsAtMs: trialEnds.getTime(),
    createdAt: new Date(hoy.getTime() - 4 * 86400000).toISOString(),
  })
  await db.doc(`clinic_members/${uid}`).set({
    clinicId: CLINIC_ID,
    role: 'medico',
    email: EMAIL,
    nombre: 'Dra. Aurora Demo',
    addedAt: new Date(hoy.getTime() - 4 * 86400000).toISOString(),
  })

  // 3) Pacientes sintéticos — con alergias y edades que ejerciten la cabecera
  const pacientes = [
    {
      id: 'pac-sintetico-01', nombre: 'María Fernanda Solís Ortega', telefono: '5550000001',
      fechaNacimiento: '1954-03-12', edad: 72, sexo: 'Femenino',
      alergias: 'Penicilina (anafilaxia), AINEs',
      email: 'maria.solis@example.test', seguroMedico: 'GNP',
    },
    {
      id: 'pac-sintetico-02', nombre: 'Jorge Luis Cabrera Núñez', telefono: '5550000002',
      fechaNacimiento: '1988-11-02', edad: 37, sexo: 'Masculino',
      alergias: '', email: 'jorge.cabrera@example.test',
    },
    {
      id: 'pac-sintetico-03', nombre: 'Guadalupe de los Ángeles Hernández Villaseñor', telefono: '5550000003',
      fechaNacimiento: '1946-07-30', edad: 80, sexo: 'Femenino',
      alergias: 'Sulfonamidas', seguroMedico: 'IMSS + particular',
    },
    {
      id: 'pac-sintetico-04', nombre: 'Ana Paula Rivas', telefono: '5550000004',
      fechaNacimiento: '2001-01-15', edad: 25, sexo: 'Femenino', alergias: '',
    },
  ]
  for (const p of pacientes) {
    const { id, ...data } = p
    await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({
      ...data,
      createdAt: new Date(hoy.getTime() - 30 * 86400000).toISOString(),
    })
  }

  // 4) Citas de HOY en estados variados + una de mañana + una pasada sin cobrar
  //    (la pasada sin cobrar alimenta la cola de pendientes del inicio)
  const base = {
    duracion: 30, origen: 'Manual', medicoNombre: 'Dra. Aurora Demo', medicoId: uid,
    confirmadoPaciente: false, recordatorio24hEnviado: false,
    recordatorioMismoDiaEnviado: false, consentimientoMensajes: true,
  }
  const citas = [
    { id: 'cita-v10-01', pacienteId: 'pac-sintetico-01', pacienteNombre: pacientes[0].nombre, pacienteTelefono: pacientes[0].telefono, fechaHora: `${HOY} 09:00`, tipo: 'seguimiento', motivo: 'Control de diabetes tipo 2 · ajuste de metformina', estado: 'atendida', confirmadoPaciente: true },
    { id: 'cita-v10-02', pacienteId: 'pac-sintetico-02', pacienteNombre: pacientes[1].nombre, pacienteTelefono: pacientes[1].telefono, fechaHora: `${HOY} 10:30`, tipo: 'primera-vez', motivo: 'Fiebre persistente de 8 días, sin foco claro', estado: 'en-sala', confirmadoPaciente: true },
    { id: 'cita-v10-03', pacienteId: 'pac-sintetico-03', pacienteNombre: pacientes[2].nombre, pacienteTelefono: pacientes[2].telefono, fechaHora: `${HOY} 11:30`, tipo: 'seguimiento', motivo: 'Revisión de urocultivo de control', estado: 'confirmada', confirmadoPaciente: true },
    { id: 'cita-v10-04', pacienteId: 'pac-sintetico-04', pacienteNombre: pacientes[3].nombre, pacienteTelefono: pacientes[3].telefono, fechaHora: `${HOY} 13:00`, tipo: 'primera-vez', motivo: 'Valoración por cuadro respiratorio', estado: 'pendiente-confirmar' },
    { id: 'cita-v10-05', pacienteId: 'pac-sintetico-02', pacienteNombre: pacientes[1].nombre, pacienteTelefono: pacientes[1].telefono, fechaHora: `${dias(1)} 09:30`, tipo: 'seguimiento', motivo: 'Resultados de hemocultivo', estado: 'confirmada', confirmadoPaciente: true },
    { id: 'cita-v10-06', pacienteId: 'pac-sintetico-01', pacienteNombre: pacientes[0].nombre, pacienteTelefono: pacientes[0].telefono, fechaHora: `${dias(-3)} 17:00`, tipo: 'seguimiento', motivo: 'Consulta previa', estado: 'atendida' },
  ]
  for (const c of citas) {
    const { id, ...data } = c
    await db.doc(`clinics/${CLINIC_ID}/appointments/${id}`).set({ ...base, ...data })
  }

  console.log(JSON.stringify({
    ok: true, uid, email: EMAIL, clinicId: CLINIC_ID,
    pacientes: pacientes.length, citas: citas.length, hoy: HOY,
  }))
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
