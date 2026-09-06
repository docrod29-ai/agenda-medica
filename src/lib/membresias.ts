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
  collection, addDoc, updateDoc, doc, getDocs, query, orderBy, where, runTransaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { registrarCobro } from '@/lib/cobros'
import { hoyISO } from '@/lib/timezone'

export type Periodicidad = 'mensual' | 'trimestral' | 'anual'
/**
 * Se avanza por MES DE CALENDARIO, no por días fijos. Con 30 días, un plan "mensual"
 * caía en 12.17 ciclos/año (sobrefacturación ~1.4% y la fecha de cobro se recorría
 * mes a mes); "anual: 365" ignoraba bisiestos. En meses = cobros exactos (12/4/1 por
 * año) y el día del mes se conserva.
 */
export const PERIODICIDAD_MESES: Record<Periodicidad, number> = { mensual: 1, trimestral: 3, anual: 12 }
export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }

/**
 * Suma meses de calendario a una fecha ISO (YYYY-MM-DD). Si el día no existe en el
 * mes destino (31 ene + 1 mes), cae al último día de ese mes (28/29 feb). Puro.
 */
export function sumarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const total = (m - 1) + meses
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12 // 0-11
  const ultimoDia = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, ultimoDia)
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

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
  /**
   * ASC-018: el ciclo se avanzó, el cobro falló y la compensación también.
   * La cuota está «adelantada sin cobro» y alguien del consultorio tiene que
   * verlo — antes sólo lo decía la consola del navegador.
   */
  cicloAdelantadoSinCobro?: boolean
  /** La fecha de cobro que tenía antes del avance fallido. */
  cicloAdelantadoDesde?: string
  cicloAdelantadoEn?: string
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
  /**
   * EL CICLO SE AVANZA PRIMERO, Y DE FORMA ATÓMICA. ÉSE ES EL CANDADO.
   *
   * Antes se registraba el cobro y DESPUÉS se avanzaba el ciclo, con dos
   * escrituras sueltas. El único freno contra cobrar dos veces era el
   * `useState` del botón en la pantalla, que no cruza pestañas ni dispositivos:
   * la asistente en su equipo y el médico en el suyo cobraban la misma cuota
   * dos veces, y el segundo cobro entraba por el `addDoc` suelto de
   * `registrarCobro` (sin `citaId` no pasa por la transacción anti-doble-cobro).
   *
   * Avanzar el ciclo PRIMERO, comprobando dentro de la transacción que nadie lo
   * haya movido, convierte la fecha de cobro en el candado: el segundo intento
   * lee una fecha distinta y se rechaza antes de tocar el dinero.
   *
   * Si el cobro falla después, se DESHACE el avance. Esa compensación también
   * puede fallar —es una escritura más— y por eso se registra con el id de la
   * membresía: una cuota que quedó adelantada sin cobrar es un problema
   * visible y arreglable; un cobro duplicado es dinero del paciente.
   */
  const base = m.proximoCobro && m.proximoCobro >= '2000-01-01' ? m.proximoCobro : hoyISO()
  const siguiente = sumarMesesISO(base, PERIODICIDAD_MESES[m.periodicidad])
  const ref = doc(MEMB_COL(clinicId), m.id!)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('La membresía ya no existe.')
    const actual = snap.data() as { proximoCobro?: string }
    if ((actual.proximoCobro ?? '') !== (m.proximoCobro ?? '')) {
      throw new Error('Esta cuota ya se cobró desde otro dispositivo. Recarga la lista antes de volver a intentar.')
    }
    tx.update(ref, { proximoCobro: siguiente, ultimoCobroEn: new Date().toISOString() })
  })

  try {
    return await registrarCobro(clinicId, {
      monto: m.precio,
      metodo: opts.metodo,
      concepto: 'membresia',
      descripcion: `Membresía: ${m.planNombre}`,
      patientId: m.pacienteId,
      patientNombre: m.pacienteNombre,
      medicoId: opts.medicoId,
      medicoNombre: opts.medicoNombre,
      creadoPor: opts.creadoPor,
    }, {
      // La huella anti-duplicado (RT-005) pregunta cuando ve dos cobros iguales
      // el mismo día; aquí el candado es el ciclo (arriba), que ya demostró que
      // esta cuota es distinta de cualquier otra. No hay nada que preguntar.
      esOtroDistinto: true,
    })
  } catch (e) {
    /**
     * ASC-018: SI LA COMPENSACIÓN TAMBIÉN FALLA, QUE SE VEA.
     *
     * El ciclo se avanzó primero (el candado) y el cobro falló; se intenta
     * deshacer el avance. Si ESO también falla —dos fallos de red seguidos—,
     * la cuota queda «adelantada sin cobro» y el único rastro era un
     * `console.error` que nadie del consultorio lee. Ahora se marca la
     * membresía (`cicloAdelantadoSinCobro`) para que el worklist la enseñe
     * y alguien la resuelva; y si ni la marca se puede escribir, queda el
     * error en consola como antes.
     */
    await updateDoc(ref, { proximoCobro: m.proximoCobro ?? base, ultimoCobroEn: m.ultimoCobroEn ?? '' })
      .catch(async () => {
        console.error('[membresias] el ciclo quedó adelantado SIN cobro; membresía', m.id)
        await updateDoc(ref, {
          cicloAdelantadoSinCobro: true,
          cicloAdelantadoDesde: m.proximoCobro ?? base,
          cicloAdelantadoEn: new Date().toISOString(),
        }).catch(() => { /* ya quedó el error en consola */ })
      })
    throw e
  }
}

/**
 * Resolver a mano una cuota que quedó adelantada sin cobro (ASC-018): se
 * regresa el ciclo a la fecha que tenía y se quita la marca. Quien lo hace
 * decide si la cuota se cobra después o no; esto sólo deshace el avance.
 */
export async function regresarCicloAdelantado(clinicId: string, m: Membresia): Promise<void> {
  const ref = doc(MEMB_COL(clinicId), m.id!)
  await updateDoc(ref, {
    proximoCobro: m.cicloAdelantadoDesde || m.proximoCobro,
    cicloAdelantadoSinCobro: false,
    cicloAdelantadoDesde: '',
    cicloAdelantadoEn: '',
  })
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
