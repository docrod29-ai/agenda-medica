/**
 * MEMBRESÍAS DE PACIENTES — suscripción recurrente del paciente al consultorio.
 *
 * Modelo pragmático v1 (SIN Stripe Connect, que muchos consultorios no tienen):
 * la membresía es una OBLIGACIÓN RECURRENTE que el sistema controla (quién es
 * miembro, qué incluye, cuándo le toca pagar). El cobro real lo registra la
 * asistente con el módulo de cobros existente (concepto 'membresia'), y eso avanza
 * el ciclo. Así el consultorio tiene el control operativo hoy; un cobro automático
 * con tarjeta se puede añadir después sobre esta misma base.
 *
 *   clinics/{id}/membership_plans/{planId}   → catálogo de planes
 *   clinics/{id}/memberships/{membershipId}  → paciente ↔ plan (con ciclo)
 */
import {
  collection, addDoc, updateDoc, doc, getDocs, query, orderBy, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { registrarCobro } from '@/lib/cobros'
import { sumarDiasISO, hoyISO } from '@/lib/timezone'

export type Periodicidad = 'mensual' | 'trimestral' | 'anual'
export const PERIODICIDAD_DIAS: Record<Periodicidad, number> = { mensual: 30, trimestral: 91, anual: 365 }
export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }

export interface PlanMembresia {
  id?: string
  nombre: string
  precio: number
  periodicidad: Periodicidad
  /** Qué incluye (consultas ilimitadas, X estudios, descuento en farmacia…). */
  beneficios: string[]
  activo: boolean
  createdAt?: string
}

export type EstadoMembresia = 'activa' | 'pausada' | 'cancelada'

export interface Membresia {
  id?: string
  pacienteId: string
  pacienteNombre: string
  planId: string
  planNombre: string
  precio: number
  periodicidad: Periodicidad
  inicio: string          // ISO YYYY-MM-DD
  proximoCobro: string    // ISO YYYY-MM-DD — cuándo le toca pagar
  estado: EstadoMembresia
  ultimoCobroEn?: string
  creadoPor: string
  createdAt?: string
}

const PLANES_COL = (c: string) => collection(db, 'clinics', c, 'membership_plans')
const MEMB_COL = (c: string) => collection(db, 'clinics', c, 'memberships')

// ── Planes ──────────────────────────────────────────────────────────────────
export async function crearPlan(clinicId: string, p: Omit<PlanMembresia, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(PLANES_COL(clinicId), { ...p, createdAt: new Date().toISOString() })
  return ref.id
}
export async function listarPlanes(clinicId: string): Promise<PlanMembresia[]> {
  const snap = await getDocs(query(PLANES_COL(clinicId), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PlanMembresia, 'id'>) }))
}
export async function actualizarPlan(clinicId: string, planId: string, patch: Partial<PlanMembresia>): Promise<void> {
  await updateDoc(doc(PLANES_COL(clinicId), planId), patch)
}

// ── Membresías (asignación paciente↔plan) ───────────────────────────────────
export async function asignarMembresia(
  clinicId: string,
  data: { pacienteId: string; pacienteNombre: string; plan: PlanMembresia; creadoPor: string; inicio?: string },
): Promise<string> {
  const inicio = data.inicio || hoyISO()
  const memb: Omit<Membresia, 'id'> = {
    pacienteId: data.pacienteId,
    pacienteNombre: data.pacienteNombre,
    planId: data.plan.id ?? '',
    planNombre: data.plan.nombre,
    precio: data.plan.precio,
    periodicidad: data.plan.periodicidad,
    inicio,
    // Primer cobro: el día de inicio (se le cobra al alta o queda "vence hoy").
    proximoCobro: inicio,
    estado: 'activa',
    creadoPor: data.creadoPor,
    createdAt: new Date().toISOString(),
  }
  const ref = await addDoc(MEMB_COL(clinicId), memb)
  return ref.id
}

export async function listarMembresias(clinicId: string): Promise<Membresia[]> {
  const snap = await getDocs(query(MEMB_COL(clinicId), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Membresia, 'id'>) }))
}

export async function cambiarEstadoMembresia(clinicId: string, id: string, estado: EstadoMembresia): Promise<void> {
  await updateDoc(doc(MEMB_COL(clinicId), id), { estado })
}

/**
 * Cobrar la cuota de una membresía: registra el cobro (concepto 'membresia') y
 * AVANZA el próximo cobro un periodo. Idempotencia práctica: se calcula el nuevo
 * ciclo desde el `proximoCobro` vencido, no desde hoy, para no perder días.
 */
export async function cobrarMembresia(
  clinicId: string,
  m: Membresia,
  opts: { metodo: import('@/lib/cobros').MetodoPago; creadoPor: string; medicoId?: string; medicoNombre?: string },
): Promise<string> {
  const cobroId = await registrarCobro(clinicId, {
    monto: m.precio,
    metodo: opts.metodo,
    concepto: 'membresia',
    descripcion: `Membresía: ${m.planNombre}`,
    patientId: m.pacienteId,
    patientNombre: m.pacienteNombre,
    medicoId: opts.medicoId,
    medicoNombre: opts.medicoNombre,
    creadoPor: opts.creadoPor,
  })
  const base = m.proximoCobro && m.proximoCobro >= '2000-01-01' ? m.proximoCobro : hoyISO()
  const siguiente = sumarDiasISO(base, PERIODICIDAD_DIAS[m.periodicidad])
  await updateDoc(doc(MEMB_COL(clinicId), m.id!), {
    proximoCobro: siguiente,
    ultimoCobroEn: new Date().toISOString(),
  })
  return cobroId
}

// ── Puro: ¿a quién le toca cobrar? (para el worklist) ───────────────────────
export interface MembresiaVencimiento { membresia: Membresia; diasRestantes: number; vencida: boolean }

/** Membresías activas ordenadas por urgencia de cobro (vencidas primero). */
export function porCobrar(membresias: Membresia[], hoy: string): MembresiaVencimiento[] {
  return membresias
    .filter(m => m.estado === 'activa')
    .map(m => {
      const dias = diasEntreISO(hoy, m.proximoCobro)
      return { membresia: m, diasRestantes: dias, vencida: dias <= 0 }
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
}

/** Días de a→b (b - a) en fechas YYYY-MM-DD. */
export function diasEntreISO(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  if (!ay || !by) return 0
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}
