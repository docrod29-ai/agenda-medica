import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp,
  Timestamp, QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'
import { Appointment, Patient, WaitlistEntry, ClinicConfig, AuditLog, DEFAULT_CONFIG } from '@/types'

// ── Colecciones ───────────────────────────────────────────────
const C = {
  appointments: 'appointments',
  patients: 'patients',
  waitlist: 'waitlist',
  config: 'config',
  audit: 'audit_log',
  notifications: 'notification_logs',
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

// ── Audit ─────────────────────────────────────────────────────

export async function createAuditLog(data: Omit<AuditLog, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, C.audit), data)
  } catch { /* audit failures are silent */ }
}
