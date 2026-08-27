import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp,
  runTransaction, Timestamp, QueryConstraint,
} from 'firebase/firestore'
import { idIdempotente } from '@/lib/idempotencia'
import { claveDeEspera } from '@/lib/whatsapp/lista-espera'
import { db } from './firebase'
import { logAudit } from '@/lib/expediente/audit-log'
import {
  Appointment, Patient, WaitlistEntry, ClinicConfig, Doctor,
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

// El alta del consultorio se movió a POST /api/clinic/crear, donde ocurre dentro
// de UNA transacción del Admin SDK. Aquí eran cuatro escrituras sueltas con un
// "candado anti-duplicado" de leer-y-luego-escribir que no es atómico: dos
// pestañas en /setup creaban dos consultorios y la segunda pisaba la membresía de
// la primera, dejando uno huérfano —y facturable— al que ya no se podía entrar.

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

/**
 * Caché en memoria de la lista de pacientes (por clínica), con TTL corto.
 * Motivo: ~12 pantallas de lista (pacientes, CRM, citas, reactivación, corte de
 * caja, migración, consultor…) descargaban la colección COMPLETA en cada visita.
 * Con caché, navegar entre ellas no vuelve a leer Firestore hasta que expira el
 * TTL o hay una escritura (createPatient/updatePatient invalidan). Se puede
 * forzar refresco con { force: true }. Staleness máx = TTL (aceptable para una
 * lista); las escrituras locales invalidan de inmediato.
 */
const TTL_PACIENTES_MS = 30_000
const _cachePacientes = new Map<string, { data: Patient[]; ts: number }>()

/** Invalida la caché de pacientes (de una clínica o de todas). */
export function invalidarCachePacientes(clinicId?: string): void {
  if (clinicId) _cachePacientes.delete(clinicId)
  else _cachePacientes.clear()
}

export async function getPatients(clinicId: string, opts?: { force?: boolean }): Promise<Patient[]> {
  const hit = _cachePacientes.get(clinicId)
  if (!opts?.force && hit && Date.now() - hit.ts < TTL_PACIENTES_MS) return hit.data
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.patients), orderBy('nombre', 'asc')))
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient))
  _cachePacientes.set(clinicId, { data, ts: Date.now() })
  return data
}

/**
 * Lee UN paciente por id (una sola lectura de documento). Para pantallas que solo
 * necesitan un paciente (nota, receta, orden, expediente, referencia): evita
 * descargar toda la colección solo para hacer .find() — más rápido y menos lecturas.
 */
export async function getPatient(clinicId: string, patientId: string): Promise<Patient | null> {
  const snap = await getDoc(d(clinicId, COLLECTIONS.patients, patientId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Patient) : null
}

export async function createPatient(clinicId: string, data: Omit<Patient, 'id'>): Promise<string> {
  // sinUndefined: Firestore RECHAZA campos undefined (p. ej. sin CURP) y tronaba el alta.
  const ref = await addDoc(col(clinicId, COLLECTIONS.patients),
    sinUndefined({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  )
  invalidarCachePacientes(clinicId)   // el nuevo paciente debe verse de inmediato
  // Bitácora: el alta de un paciente es de los eventos que la trazabilidad exige
  // y no se registraba en absoluto. No se bloquea el alta si el registro falla.
  logAudit({ evento: 'paciente_creado', clinicId, patientId: ref.id }).catch(() => {})
  return ref.id
}

export async function updatePatient(clinicId: string, id: string, data: Partial<Patient>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.patients, id), sinUndefined({ ...data, updatedAt: new Date().toISOString() }))
  invalidarCachePacientes(clinicId)   // el cambio debe reflejarse de inmediato
  // Qué campos se tocaron, NO sus valores: la bitácora no es sitio para PHI.
  logAudit({ evento: 'paciente_modificado', clinicId, patientId: id, meta: { campos: Object.keys(data) } }).catch(() => {})
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

/**
 * Alta en la lista de espera, IDEMPOTENTE.
 *
 * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
 *
 * Era un `addDoc`: identificador aleatorio, uno nuevo en cada llamada. Dos
 * envíos del mismo formulario —el doble clic, el reintento tras una red lenta,
 * la pestaña duplicada— eran por construcción DOS entradas del mismo paciente.
 *
 * Y duele donde no se ve: al ofrecer un hueco sólo se avisa a tres personas, así
 * que el paciente repetido ocupa dos de esos tres sitios. El tercero de la fila
 * no se entera del hueco y el repetido recibe dos veces el mismo mensaje.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────
 *
 * El id sale de la INTENCIÓN, no de la escritura: teléfono + tipo + fecha
 * deseada + franja horaria, derivados con `idIdempotente` (que mete el
 * consultorio en la preimagen, así que la misma petición en dos consultorios da
 * dos ids distintos). Misma petición → mismo documento.
 *
 * ── POR QUÉ EN TRANSACCIÓN Y POR QUÉ SE CONSERVA `createdAt` ────────────────
 *
 * `createdAt` decide la ANTIGÜEDAD en la cola: a igual prioridad, atiende antes
 * quien lleva más esperando. Reescribirlo en un segundo envío mandaría al
 * paciente al final de su propia fila sin que nadie lo viera. Se conserva el de
 * la primera vez, y la transacción es lo que hace que leerlo y decidir no sea
 * una carrera — el mismo error de leer-y-luego-escribir que ya costó dos
 * consultorios duplicados en `/setup`.
 *
 * Volver a dar de alta a quien estaba de baja SÍ lo reactiva: es lo que el
 * consultorio está pidiendo al escribirlo otra vez.
 */
export async function createWaitlistEntry(clinicId: string, data: Omit<WaitlistEntry, 'id'>): Promise<string> {
  const id = idIdempotente(clinicId, 'lista-espera', claveDeEspera(data))
  const ref = d(clinicId, COLLECTIONS.waitlist, id)
  const ahora = new Date().toISOString()
  await runTransaction(db, async (tx) => {
    const previo = await tx.get(ref)
    const createdAt = previo.exists()
      ? ((previo.data() as { createdAt?: string } | undefined)?.createdAt ?? ahora)
      : ahora
    tx.set(ref, { ...data, createdAt }, { merge: true })
  })
  return id
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

/**
 * Guarda SOLO algunos campos de la config (merge), sin tocar el resto.
 * Útil para persistir un cambio puntual al momento (p. ej. la firma+sello al
 * subirla) sin depender del botón global "Guardar".
 */
export async function saveConfigPartial(clinicId: string, parcial: Partial<ClinicConfig>): Promise<void> {
  await setDoc(
    doc(db, 'clinics', clinicId, 'config', 'main'),
    sinUndefined({ ...parcial, updatedAt: new Date().toISOString() }),
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

/**
 * ID de documento DERIVADO del teléfono, en vez de uno aleatorio.
 *
 * El patrón anterior era leer-y-luego-escribir: `getBotSession` (consulta por
 * teléfono) y, si no había nada, `addDoc`. Cuando el paciente manda dos mensajes
 * seguidos —"Hola" y "quiero cita" con un segundo de diferencia— los dos webhooks
 * corren en paralelo, ambos ven que no existe sesión y ambos crean una. A partir
 * de ahí `getBotSession` devolvía `snap.docs[0]` sin `orderBy`, es decir un
 * documento u otro sin orden garantizado, y la conversación saltaba entre los dos
 * perdiendo lo ya capturado (nombre, fecha). `deleteBotSession` borraba solo uno
 * y el otro seguía contaminando.
 *
 * Con un id determinista el duplicado es imposible: las dos escrituras van al
 * mismo documento. Se elimina la consulta, la carrera y el duplicado de una vez.
 */
function idSesionBot(telefono: string): string {
  const limpio = (telefono || '').replace(/\D/g, '').slice(-15)
  return limpio || 'sin-telefono'
}

export async function getBotSession(clinicId: string, telefono: string): Promise<BotSession | null> {
  const ref = d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono))
  const snap = await getDoc(ref)
  if (snap.exists()) return { id: snap.id, ...snap.data() } as BotSession
  // Compatibilidad: sesiones creadas antes con id aleatorio. Son conversaciones
  // en curso; no se abandonan a mitad del flujo por cambiar el esquema de ids.
  const viejas = await getDocs(query(col(clinicId, COLLECTIONS.botSessions), where('telefono', '==', telefono)))
  if (viejas.empty) return null
  const docSnap = viejas.docs[0]
  return { id: docSnap.id, ...docSnap.data() } as BotSession
}

export async function upsertBotSession(clinicId: string, telefono: string, data: Partial<BotSession>): Promise<void> {
  const now = new Date().toISOString()
  // setDoc con merge sobre id determinista: sin lectura previa, sin carrera.
  await setDoc(
    d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono)),
    sinUndefined({ telefono, estado: 'inicio', datos: {}, createdAt: now, ...data, lastMessageAt: now }),
    { merge: true },
  )
}

export async function deleteBotSession(clinicId: string, telefono: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono))).catch(() => {})
  // Barre también el duplicado heredado, si quedó alguno del esquema viejo.
  const viejas = await getDocs(query(col(clinicId, COLLECTIONS.botSessions), where('telefono', '==', telefono)))
  await Promise.all(viejas.docs.map(v => deleteDoc(d(clinicId, COLLECTIONS.botSessions, v.id)).catch(() => {})))
}

// ── Audit ─────────────────────────────────────────────────────
//
// Aquí vivía `createAuditLog`, que escribía a la bitácora desde el cliente con un
// `catch {}` vacío. Se eliminó por dos razones: no tenía UN SOLO llamador en todo
// el repo —era código muerto que sugería una cobertura inexistente— y la escritura
// de bitácora ahora va por `logAudit` → /api/auditoria/registrar, donde la
// identidad sale del ID-token y la hora del servidor.
