import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp,
  Timestamp, QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Appointment, Patient, WaitlistEntry, ClinicConfig, AuditLog, Doctor,
  DEFAULT_CONFIG, Clinic, ClinicMember,
} from '@/types'

// ── Collection paths (all tenant-scoped) ─────────────────────

function col(clinicId: string, name: string) {
  return collection(db, 'clinics', clinicId, name)
}
function d(clinicId: string, name: string, id: string) {
  return doc(db, 'clinics', clinicId, name, id)
}

const COLLECTIONS = {
  appointments: 'appointments',
  patients: 'patients',
  waitlist: 'waitlist',
  config: 'config',
  audit: 'audit_log',
  notifications: 'notification_logs',
  doctors: 'doctors',
  botSessions: 'bot_sessions',
}

// ── Clinic CRUD (root level) ──────────────────────────────────

export async function createClinic(
  ownerId: string,
  data: { nombreClinica: string; nombreMedico: string }
): Promise<string> {
  const now = new Date().toISOString()
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // Create clinic doc with auto-ID
  const ref = await addDoc(collection(db, 'clinics'), {
    ...data,
    plan: 'trial',
    status: 'trial',
    ownerId,
    trialEndsAt,
    createdAt: now,
    updatedAt: now,
  })

  // Create membership for owner
  await setDoc(doc(db, 'clinic_members', ownerId), {
    clinicId: ref.id,
    role: 'admin',
    createdAt: now,
  })

  // Create default config
  await setDoc(doc(db, 'clinics', ref.id, 'config', 'main'), {
    ...DEFAULT_CONFIG,
    nombreClinica: data.nombreClinica,
    nombreMedico: data.nombreMedico,
    createdAt: now,
    updatedAt: now,
  })

  return ref.id
}

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const snap = await getDoc(doc(db, 'clinics', clinicId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Clinic
}

export async function getClinicMember(uid: string): Promise<ClinicMember | null> {
  const snap = await getDoc(doc(db, 'clinic_members', uid))
  if (!snap.exists()) return null
  return snap.data() as ClinicMember
}

export async function addClinicMember(
  clinicId: string,
  uid: string,
  role: ClinicMember['role']
): Promise<void> {
  await setDoc(doc(db, 'clinic_members', uid), {
    clinicId,
    role,
    createdAt: new Date().toISOString(),
  })
}

// ── Appointments ──────────────────────────────────────────────

export async function getAppointments(
  clinicId: string,
  constraints: QueryConstraint[] = []
): Promise<Appointment[]> {
  const q = query(col(clinicId, COLLECTIONS.appointments), orderBy('fechaHora', 'asc'), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAppointmentsByDate(clinicId: string, fecha: string): Promise<Appointment[]> {
  return getAppointments(clinicId, [
    where('fechaHora', '>=', fecha + ' 00:00'),
    where('fechaHora', '<=', fecha + ' 23:59'),
  ])
}

// createAppointment se eliminó: el alta de citas ahora es ATÓMICA vía POST /api/appointments
// (transacción server-side con re-chequeo de conflicto). Ver src/app/api/appointments/route.ts.

export async function updateAppointment(clinicId: string, id: string, data: Partial<Appointment>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.appointments, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteAppointment(clinicId: string, id: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.appointments, id))
}

// ── Patients ──────────────────────────────────────────────────

export async function getPatients(clinicId: string): Promise<Patient[]> {
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.patients), orderBy('nombre', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient))
}

export async function createPatient(clinicId: string, data: Omit<Patient, 'id'>): Promise<string> {
  const ref = await addDoc(col(clinicId, COLLECTIONS.patients), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updatePatient(clinicId: string, id: string, data: Partial<Patient>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.patients, id), { ...data, updatedAt: new Date().toISOString() })
}

// ── Waitlist ──────────────────────────────────────────────────

export async function getWaitlist(clinicId: string): Promise<WaitlistEntry[]> {
  const snap = await getDocs(query(
    col(clinicId, COLLECTIONS.waitlist),
    where('estado', '==', 'activo'),
    orderBy('createdAt', 'asc')
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistEntry))
}

export async function createWaitlistEntry(clinicId: string, data: Omit<WaitlistEntry, 'id'>): Promise<string> {
  const ref = await addDoc(col(clinicId, COLLECTIONS.waitlist), {
    ...data, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateWaitlistEntry(clinicId: string, id: string, data: Partial<WaitlistEntry>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.waitlist, id), data)
}

// ── Config ────────────────────────────────────────────────────

export async function getConfig(clinicId: string): Promise<ClinicConfig> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'config', 'main'))
  if (!snap.exists()) return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig
}

/**
 * Quita recursivamente las llaves con valor undefined.
 * Firestore RECHAZA undefined ("Unsupported field value") — un solo campo
 * undefined (ej. quitar el diseño de receta) hacía fallar TODO el guardado.
 */
function sinUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(v => sinUndefined(v)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = sinUndefined(v)
  }
  return out as T
}

export async function saveConfig(clinicId: string, data: ClinicConfig): Promise<void> {
  await setDoc(
    doc(db, 'clinics', clinicId, 'config', 'main'),
    sinUndefined({ ...data, updatedAt: new Date().toISOString() }),
    { merge: true }
  )
}

// ── Doctors ───────────────────────────────────────────────────

export async function getDoctors(clinicId: string): Promise<Doctor[]> {
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.doctors), orderBy('nombre', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))
}

export async function getActiveDoctor(clinicId: string): Promise<Doctor | null> {
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.doctors), where('activo', '==', true)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Doctor
}

export async function getDoctor(clinicId: string, id: string): Promise<Doctor | null> {
  const snap = await getDoc(d(clinicId, COLLECTIONS.doctors, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Doctor
}

export async function createDoctor(clinicId: string, data: Omit<Doctor, 'id'>): Promise<string> {
  const ref = await addDoc(col(clinicId, COLLECTIONS.doctors), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateDoctor(clinicId: string, id: string, data: Partial<Doctor>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.doctors, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDoctor(clinicId: string, id: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.doctors, id))
}

// ── Bot Sessions ──────────────────────────────────────────────

export interface BotSession {
  id: string
  telefono: string
  estado: string
  datos: Record<string, string>
  doctorId?: string
  lastMessageAt: string
  createdAt: string
}

export async function getBotSession(clinicId: string, telefono: string): Promise<BotSession | null> {
  const snap = await getDocs(query(
    col(clinicId, COLLECTIONS.botSessions),
    where('telefono', '==', telefono)
  ))
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() } as BotSession
}

export async function upsertBotSession(clinicId: string, telefono: string, data: Partial<BotSession>): Promise<void> {
  const existing = await getBotSession(clinicId, telefono)
  const now = new Date().toISOString()
  if (existing) {
    await updateDoc(d(clinicId, COLLECTIONS.botSessions, existing.id), { ...data, lastMessageAt: now })
  } else {
    await addDoc(col(clinicId, COLLECTIONS.botSessions), {
      telefono, estado: 'inicio', datos: {}, lastMessageAt: now, createdAt: now, ...data,
    })
  }
}

export async function deleteBotSession(clinicId: string, telefono: string): Promise<void> {
  const existing = await getBotSession(clinicId, telefono)
  if (existing) await deleteDoc(d(clinicId, COLLECTIONS.botSessions, existing.id))
}

// ── Audit ─────────────────────────────────────────────────────

export async function createAuditLog(clinicId: string, data: Omit<AuditLog, 'id'>): Promise<void> {
  try {
    await addDoc(col(clinicId, COLLECTIONS.audit), data)
  } catch { /* audit failures are silent */ }
}
