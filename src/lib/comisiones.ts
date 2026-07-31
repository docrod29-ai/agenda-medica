/**
 * COMISIONES POR MÉDICO — reporte de reparto sobre lo COBRADO.
 *
 * Hueco real frente a Nimbo/AgendaPro: saber cuánto le toca a cada médico de lo
 * que se cobró en el periodo. Es un REPORTE (solo lectura): calcula, no mueve
 * dinero ni genera pagos.
 *
 * Honestidad: el porcentaje NO se inventa. Arranca en 0 % para todos y el dueño
 * lo configura por médico (o un default). Sin configuración, el reporte muestra
 * la base cobastable de cada médico y comisión 0 — nunca una tasa supuesta.
 *
 * Base comisionable = suma de lo cobrado atribuido a ese médico, restando los
 * reembolsos (que ya vienen en negativo) y excluyendo los conceptos que el dueño
 * marque (p. ej. 'medicamento' o 'material', que suelen ser costo, no honorario).
 *
 * La parte de cálculo es pura y testeable; la persistencia es una capa delgada.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Cobro, ConceptoCobro } from '@/lib/cobros'

export interface ConfigComisiones {
  /** % por médico (0–100), por medicoId. Ausente = usa `porDefecto`. */
  porMedico: Record<string, number>
  /** % por defecto si el médico no tiene tasa propia. Default 0 (no inventa). */
  porDefecto: number
  /** Conceptos que NO generan comisión (p. ej. medicamento/material = costo). */
  conceptosExcluidos: ConceptoCobro[]
  actualizadoEn?: string
}

export const CONFIG_COMISIONES_DEFAULT: ConfigComisiones = {
  porMedico: {},
  porDefecto: 0,
  conceptosExcluidos: [],
}

export interface FilaComision {
  medicoId: string
  medicoNombre: string
  baseComisionable: number
  nCobros: number
  porcentaje: number
  comision: number
  /** Lo que queda para el consultorio de la base de ese médico. */
  netoConsultorio: number
}

export interface ReporteComisiones {
  filas: FilaComision[]
  totalBase: number
  totalComision: number
  totalNeto: number
  /** Cobros sin médico atribuido: no entran a ninguna comisión. */
  sinAtribuir: { monto: number; n: number }
}

/** Redondeo a centavos, evitando ruido de coma flotante. */
function centavos(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Calcula el reporte de comisiones del periodo. Puro: no lee red ni muta nada.
 */
export function calcularComisiones(cobros: Cobro[], config: ConfigComisiones): ReporteComisiones {
  const excluidos = new Set(config.conceptosExcluidos ?? [])
  const acc = new Map<string, { nombre: string; base: number; n: number }>()
  const sinAtribuir = { monto: 0, n: 0 }

  for (const c of cobros) {
    if (excluidos.has(c.concepto)) continue
    if (!c.medicoId) {
      sinAtribuir.monto += c.monto
      sinAtribuir.n += 1
      continue
    }
    const row = acc.get(c.medicoId) ?? { nombre: c.medicoNombre || 'Médico', base: 0, n: 0 }
    row.base += c.monto
    row.n += 1
    // El nombre más reciente no vacío gana (por si cambió de alias).
    if (c.medicoNombre) row.nombre = c.medicoNombre
    acc.set(c.medicoId, row)
  }

  const filas: FilaComision[] = Array.from(acc.entries()).map(([medicoId, r]) => {
    const pct = clampPct(config.porMedico?.[medicoId] ?? config.porDefecto ?? 0)
    const base = centavos(r.base)
    const comision = centavos(base * pct / 100)
    return {
      medicoId,
      medicoNombre: r.nombre,
      baseComisionable: base,
      nCobros: r.n,
      porcentaje: pct,
      comision,
      netoConsultorio: centavos(base - comision),
    }
  }).sort((a, b) => b.comision - a.comision || b.baseComisionable - a.baseComisionable)

  return {
    filas,
    totalBase: centavos(filas.reduce((s, f) => s + f.baseComisionable, 0)),
    totalComision: centavos(filas.reduce((s, f) => s + f.comision, 0)),
    totalNeto: centavos(filas.reduce((s, f) => s + f.netoConsultorio, 0)),
    sinAtribuir: { monto: centavos(sinAtribuir.monto), n: sinAtribuir.n },
  }
}

/** Acota un porcentaje a [0, 100]; NaN/negativos → 0. */
export function clampPct(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n > 100 ? 100 : n
}

// ───────────── Persistencia (config/comisiones) ─────────────

const refConfig = (clinicId: string) => doc(db, 'clinics', clinicId, 'config', 'comisiones')

export async function cargarConfigComisiones(clinicId: string): Promise<ConfigComisiones> {
  if (!clinicId) return { ...CONFIG_COMISIONES_DEFAULT }
  try {
    const snap = await getDoc(refConfig(clinicId))
    if (!snap.exists()) return { ...CONFIG_COMISIONES_DEFAULT }
    const d = snap.data() as Partial<ConfigComisiones>
    return {
      porMedico: d.porMedico ?? {},
      porDefecto: clampPct(d.porDefecto ?? 0),
      conceptosExcluidos: d.conceptosExcluidos ?? [],
      actualizadoEn: d.actualizadoEn,
    }
  } catch {
    return { ...CONFIG_COMISIONES_DEFAULT }
  }
}

export async function guardarConfigComisiones(clinicId: string, config: ConfigComisiones): Promise<void> {
  if (!clinicId) return
  const limpio: ConfigComisiones = {
    porMedico: Object.fromEntries(
      Object.entries(config.porMedico ?? {}).map(([k, v]) => [k, clampPct(v)]),
    ),
    porDefecto: clampPct(config.porDefecto ?? 0),
    conceptosExcluidos: config.conceptosExcluidos ?? [],
    actualizadoEn: new Date().toISOString(),
  }
  await setDoc(refConfig(clinicId), limpio, { merge: true })
}
