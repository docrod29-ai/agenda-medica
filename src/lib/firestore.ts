import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp,
  Timestamp, QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'
import { Appointment, Patient, WaitlistEntry, ClinicConfig, AuditLog, Doctor, DEFAULT_CONFIG } from '@/types'

// ── Colecciones ───────────────────────────────────────────────
const C = {
  appointments: 'appointments',
  patients: 'patients',
  waitlist: 'waitlist',
  config: 'config',
  audit: 'audit_log',
  notifications: 'notification_logs',
  doctors: 'doctors',
  botSessions: 'bot_sessions',
}

// ── Appointments ──────────────────────────────────────────────

export async function getAppointments(constraints: QueryConstraint[] = []): Promise<Appointment[]> {
  const q = query(collection(db, C.appointments), orderBy('fechaHora', 'asc'), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAppointmentsByDate(fecha: string): Promise<Appointment[]> {
  return getAppointments([where('fechaHora', '>=', fecha + ' 00:00'), where('fechaHora', '<=', fecha + ' 23:59')])
}

export async function createAppointment(data: Omit<Appointment, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, C.appointments), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
  await updateDoc(doc(db, C.appointments, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteAppointment(id: string): Promise<void> {
  await deleteDoc(doc(db, C.appointments, id))
}

// ── Patients ──────────────────────────────────────────────────

export async function getPatients(): Promise<Patient[]> {
  const snap = await getDocs(query(collection(db, C.patients), orderBy('nombre', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient))
}

export async function createPatient(data: Omit<Patient, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, C.patients), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<void> {
  await updateDoc(doc(db, C.patients, id), { ...data, updatedAt: new Date().toISOString() })
}

// ── Waitlist ──────────────────────────────────────────────────

export async function getWaitlist(): Promise<WaitlistEntry[]> {
  const snap = await getDocs(query(collection(db, C.waitlist), where('estado', '==', 'activo'), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistEntry))
}

export async function createWaitlistEntry(data: Omit<WaitlistEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, C.waitlist), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateWaitlistEntry(id: string, data: Partial<WaitlistEntry>): Promise<void> {
  await updateDoc(doc(db, C.waitlist, id), data)
}

// ── Config ────────────────────────────────────────────────────

export async function getConfig(): Promise<ClinicConfig> {
  const snap = await getDoc(doc(db, C.config, 'main'))
  if (!snap.exists()) return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig
}

export async function saveConfig(data: ClinicConfig): Promise<void> {
  await setDoc(doc(db, C.config, 'main'), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}

// ── Doctors ───────────────────────────────────────────────────

export async function getDoctors(): Promise<Doctor[]> {
  const snap = await getDocs(query(collection(db, C.doctors), orderBy('nombre', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))
}

export async function getActiveDoctor(): Promise<Doctor | null> {
  const snap = await getDocs(query(collection(db, C.doctors), where('activo', '==', true)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Doctor
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const snap = await getDoc(doc(db, C.doctors, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Doctor
}

export async function createDoctor(data: Omit<Doctor, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, C.doctors), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateDoctor(id: string, data: Partial<Doctor>): Promise<void> {
  await updateDoc(doc(db, C.doctors, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDoctor(id: string): Promise<void> {
  await deleteDoc(doc(db, C.doctors, id))
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

export async function getBotSession(telefono: string): Promise<BotSession | null> {
  const snap = await getDocs(query(collection(db, C.botSessions), where('telefono', '==', telefono)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as BotSession
}

export async function upsertBotSession(telefono: string, data: Partial<BotSession>): Promise<void> {
  const existing = await getBotSession(telefono)
  const now = new Date().toISOString()
  if (existing) {
    await updateDoc(doc(db, C.botSessions, existing.id), { ...data, lastMessageAt: now })
  } else {
    await addDoc(collection(db, C.botSessions), {
      telefono, estado: 'inicio', datos: {}, lastMessageAt: now, createdAt: now, ...data,
    })
  }
}

export async function deleteBotSession(telefono: string): Promise<void> {
  const existing = await getBotSession(telefono)
  if (existing) await deleteDoc(doc(db, C.botSessions, existing.id))
}

// ── Audit ─────────────────────────────────────────────────────

export async function createAuditLog(data: Omit<AuditLog, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, C.audit), data)
  } catch { /* audit failures are silent */ }
}
