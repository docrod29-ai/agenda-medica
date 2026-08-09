#!/usr/bin/env node
/**
 * SIEMBRA SINTÉTICA PARA CAPTURAS V10 — sólo emulador, jamás producción.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * V10 §33 prohíbe aprobar una pantalla leyendo JSX: exige navegador real con
 * datos clínicos sintéticos realistas. Este script siembra ese mundo en los
 * emuladores de Auth y Firestore (proyecto `demo-nexusmed-test`).
 *
 * CANDADOS:
 *  - Aborta si FIRESTORE_EMULATOR_HOST o FIREBASE_AUTH_EMULATOR_HOST no están
 *    definidos (nunca puede escribir a la nube).
 *  - Aborta si el projectId no empieza con `demo-` (prefijo que Firebase
 *    reserva para proyectos que sólo existen en el emulador).
 *  - Datos 100 % sintéticos (data-privacy.md: cero pacientes reales).
 *
 * FORMATOS QUE NO SON OPINIÓN (medidos en el código, 9-ago-2026):
 *  - `fechaHora` de una cita es 'YYYY-MM-DD HH:mm' (useAppointments.ts ordena
 *    como texto). ISO rompería el orden y la ventana de 120 días.
 *  - Citas usan `pacienteId`; la lista de pacientes ordena por `nombre` y
 *    Firestore OMITE en silencio los docs sin ese campo.
 *  - `trialEndsAtMs` (epoch ms) es lo que leen las reglas; `status: 'active'`
 *    evita la compuerta de pago por completo.
 */
import admin from 'firebase-admin'

const PROJECT_ID = 'demo-nexusmed-test'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('ABORTO: faltan FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST. Este script sólo habla con emuladores.')
  process.exit(1)
}
if (!PROJECT_ID.startsWith('demo-')) {
  console.error('ABORTO: el projectId no es demo-*.')
  process.exit(1)
}

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()
const auth = admin.auth()

const ahora = new Date()
const iso = ahora.toISOString()
const dia = (offsetDias) => {
  const d = new Date(ahora.getTime() + offsetDias * 86400000)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

const CLINIC_ID = 'clinica-demo-v10'
const MEDICO = {
  email: 'medico@demo.nexusmed.test',
  password: 'NexusDemo-2026',
  nombre: 'Dra. Ana Robles Vega',
  clinica: 'Consultorio de Medicina Interna Robles',
}

async function main() {
  // ── 1. Usuario médico en el emulador de Auth ──────────────────────────
  let uid
  try {
    const u = await auth.createUser({
      email: MEDICO.email,
      password: MEDICO.password,
      displayName: MEDICO.nombre,
      emailVerified: true,
    })
    uid = u.uid
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      uid = (await auth.getUserByEmail(MEDICO.email)).uid
    } else { throw e }
  }
  console.log(`auth OK · uid=${uid}`)

  const enUnAno = new Date(ahora.getTime() + 365 * 86400000)

  // ── 2. Membresía + clínica + config (espejo de /api/clinic/crear) ─────
  await db.doc(`clinic_members/${uid}`).set({
    clinicId: CLINIC_ID, role: 'admin', createdAt: iso,
  })
  await db.doc(`clinics/${CLINIC_ID}`).set({
    nombreClinica: MEDICO.clinica,
    nombreMedico: MEDICO.nombre,
    plan: 'trial',
    status: 'active',            // sin compuerta de pago en el arnés
    ownerId: uid,
    trialEndsAt: enUnAno.toISOString(),
    trialEndsAtMs: enUnAno.getTime(), // lo que leen las REGLAS (número, no ISO)
    createdAt: iso, updatedAt: iso,
  })
  // Copia literal de DEFAULT_CONFIG (src/types/index.ts). Si aquélla cambia,
  // esto sólo afecta capturas de demo — nunca datos reales.
  await db.doc(`clinics/${CLINIC_ID}/config/main`).set({
    nombreMedico: MEDICO.nombre,
    nombreClinica: MEDICO.clinica,
    cedulaProfesional: '12345678',
    especialidad: 'Medicina Interna · Infectología',
    direccion: 'Av. Reforma 123, Col. Centro, Chihuahua, Chih.',
    googleMapsUrl: '',
    telefonoAdmin: '6140000000',
    whatsappConsultorio: '6140000000',
    zonaHoraria: 'America/Chihuahua',
    horario: {
      lunes:     { activo: true,  inicio: '09:00', fin: '18:00' },
      martes:    { activo: true,  inicio: '09:00', fin: '18:00' },
      miercoles: { activo: true,  inicio: '09:00', fin: '18:00' },
      jueves:    { activo: true,  inicio: '09:00', fin: '18:00' },
      viernes:   { activo: true,  inicio: '09:00', fin: '14:00' },
      sabado:    { activo: true,  inicio: '09:00', fin: '12:00' },
      domingo:   { activo: false, inicio: '09:00', fin: '12:00' },
    },
    duraciones: {
      'primera-vez': 60, 'seguimiento': 30, 'urgente': 30, 'estudios': 30,
      'teleconsulta': 30, 'prequirurgica': 60, 'procedimiento': 45, 'otro': 30,
    },
    intervaloMinutos: 10,
    recordatorio24h: true,
    recordatorioMismoDia: true,
    horaResumenDiario: '07:00',
    diasFestivos: [],
    googleCalendarId: '',
    publicBookingEnabled: true,
    publicBookingNote: '',
    createdAt: iso, updatedAt: iso,
  })
  console.log('clínica OK')

  // ── 3. Pacientes sintéticos ───────────────────────────────────────────
  const pacientes = [
    { id: 'pac-demo-001', nombre: 'María Guadalupe Sandoval Ortiz', telefono: '6141112233', fechaNacimiento: '1958-04-17', sexo: 'Femenino', email: 'maria.sandoval@ejemplo.mx' },
    { id: 'pac-demo-002', nombre: 'José Luis Carrillo Mendoza',      telefono: '6142223344', fechaNacimiento: '1971-11-02', sexo: 'Masculino' },
    { id: 'pac-demo-003', nombre: 'Fernanda Ríos Aguilar',           telefono: '6143334455', fechaNacimiento: '1989-06-25', sexo: 'Femenino' },
    { id: 'pac-demo-004', nombre: 'Ramón Villalobos Chacón',         telefono: '6144445566', fechaNacimiento: '1946-01-30', sexo: 'Masculino' },
    { id: 'pac-demo-005', nombre: 'Alejandra Domínguez Prieto',      telefono: '6145556677', fechaNacimiento: '1995-09-08', sexo: 'Femenino' },
    { id: 'pac-demo-006', nombre: 'Héctor Manuel Barraza Luna',      telefono: '6146667788', fechaNacimiento: '1963-07-19', sexo: 'Masculino' },
  ]
  for (const p of pacientes) {
    const { id, ...campos } = p
    await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({
      ...campos,
      noShowCount: 0, cancelacionCount: 0, tags: [],
      createdAt: iso, updatedAt: iso, creadoPor: uid,
    })
  }
  // Resumen clínico del paciente principal (alergias → cabecera del expediente)
  await db.doc(`clinics/${CLINIC_ID}/patients/pac-demo-001/clinico/resumen`).set({
    alergias: 'Penicilina (rash generalizado, 2019) · AINE (broncoespasmo)',
    notasClinicas: 'DM2 desde 2011 en tratamiento con metformina. HAS en control. EPOC GOLD B.',
    actualizadoEn: iso, actualizadoPor: uid,
  })
  console.log(`pacientes OK · ${pacientes.length}`)

  // ── 4. Citas: hoy con estados variados + mañana ───────────────────────
  const base = { duracion: 30, origen: 'Manual', medicoNombre: MEDICO.nombre,
    confirmadoPaciente: true, recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true, cobroExento: false,
    createdAt: iso, updatedAt: iso, creadoPor: uid, updatedPor: uid }
  const citas = [
    { id: 'cita-001', pacienteId: 'pac-demo-001', pacienteNombre: 'María Guadalupe Sandoval Ortiz', pacienteTelefono: '6141112233', fechaHora: `${dia(0)} 09:00`, tipo: 'seguimiento',  estado: 'atendida', duracion: 30 },
    { id: 'cita-002', pacienteId: 'pac-demo-002', pacienteNombre: 'José Luis Carrillo Mendoza',      pacienteTelefono: '6142223344', fechaHora: `${dia(0)} 10:00`, tipo: 'primera-vez',  estado: 'en-consulta', duracion: 60 },
    { id: 'cita-003', pacienteId: 'pac-demo-003', pacienteNombre: 'Fernanda Ríos Aguilar',           pacienteTelefono: '6143334455', fechaHora: `${dia(0)} 11:30`, tipo: 'seguimiento',  estado: 'en-sala', duracion: 30 },
    { id: 'cita-004', pacienteId: 'pac-demo-004', pacienteNombre: 'Ramón Villalobos Chacón',         pacienteTelefono: '6144445566', fechaHora: `${dia(0)} 12:30`, tipo: 'estudios',     estado: 'confirmada', duracion: 30 },
    { id: 'cita-005', pacienteId: 'pac-demo-005', pacienteNombre: 'Alejandra Domínguez Prieto',      pacienteTelefono: '6145556677', fechaHora: `${dia(0)} 17:00`, tipo: 'teleconsulta', estado: 'pendiente-confirmar', duracion: 30 },
    { id: 'cita-006', pacienteId: 'pac-demo-006', pacienteNombre: 'Héctor Manuel Barraza Luna',      pacienteTelefono: '6146667788', fechaHora: `${dia(1)} 09:30`, tipo: 'seguimiento',  estado: 'confirmada', duracion: 30 },
    { id: 'cita-007', pacienteId: 'pac-demo-001', pacienteNombre: 'María Guadalupe Sandoval Ortiz',  pacienteTelefono: '6141112233', fechaHora: `${dia(7)} 10:00`, tipo: 'estudios',     estado: 'pendiente-confirmar', duracion: 30 },
  ]
  for (const c of citas) {
    const { id, ...campos } = c
    await db.doc(`clinics/${CLINIC_ID}/appointments/${id}`).set({ ...base, ...campos })
  }
  console.log(`citas OK · ${citas.length}`)

  console.log('SIEMBRA COMPLETA')
  console.log(`login → ${MEDICO.email} / ${MEDICO.password}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
