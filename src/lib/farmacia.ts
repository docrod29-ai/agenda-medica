/**
 * Inventario de farmacia interna del consultorio.
 *
 * Cada item vive en clinics/{clinicId}/farmacia/{itemId}.
 * Apto para muestras médicas, medicamentos básicos del consultorio,
 * material de curación y consumibles.
 *
 * NOM-072-SSA1-2012 (etiquetado): los campos lote y caducidad son
 * obligatorios para medicamentos. NOM-220-SSA1 (farmacovigilancia):
 * mantener trazabilidad lote → paciente cuando aplique.
 */
import {
  collection, addDoc, updateDoc, doc, getDocs, deleteDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type FarmaciaCategoria =
  | 'medicamento'
  | 'muestra_medica'
  | 'material_curacion'
  | 'instrumental'
  | 'consumible'
  | 'biologico'  // vacunas, sueros, hemoderivados — cadena de frío
  | 'otro'

export const CATEGORIA_LABEL: Record<FarmaciaCategoria, string> = {
  medicamento: '💊 Medicamento',
  muestra_medica: '🎁 Muestra médica',
  material_curacion: '🩹 Material de curación',
  instrumental: '🔧 Instrumental',
  consumible: '📦 Consumible',
  biologico: '❄️ Biológico (cadena fría)',
  otro: '📦 Otro',
}

export interface FarmaciaItem {
  id?: string
  nombre: string                       // "Amoxicilina 500mg cápsulas"
  categoria: FarmaciaCategoria
  presentacion?: string                // "Caja con 12 cápsulas"
  unidadMedida?: string                // "caja", "frasco", "pieza"
  /** Stock actual */
  cantidad: number
  /** Cantidad mínima — alerta cuando baja */
  cantidadMinima?: number
  /** Lote del fabricante */
  lote?: string
  /** Fecha de caducidad (ISO YYYY-MM-DD) */
  caducidad?: string
  /** Costo unitario en MXN */
  costoUnitario?: number
  /** Proveedor */
  proveedor?: string
  /** Ubicación física en el consultorio */
  ubicacion?: string                   // "Gabinete 2, repisa A"
  /** Notas */
  notas?: string
  /** Si es controlado por receta especial (psicotrópicos, estupefacientes) */
  controlado?: boolean
  activo: boolean
  createdAt: string
  updatedAt: string
  creadoPor: string
}

export interface MovimientoFarmacia {
  id?: string
  itemId: string
  tipo: 'entrada' | 'salida' | 'ajuste' | 'caducidad' | 'merma'
  cantidad: number
  fecha: string
  motivo?: string
  patientId?: string                   // si fue dispensado a un paciente
  notaId?: string                      // si fue parte de un tratamiento
  realizadoPor: string
}

const COL = (cid: string) => collection(db, 'clinics', cid, 'farmacia')
const COL_MOV = (cid: string) => collection(db, 'clinics', cid, 'farmacia_movimientos')

export async function crearItem(clinicId: string, data: Omit<FarmaciaItem, 'id'>): Promise<string> {
  const ref = await addDoc(COL(clinicId), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function actualizarItem(clinicId: string, itemId: string, data: Partial<FarmaciaItem>): Promise<void> {
  await updateDoc(doc(COL(clinicId), itemId), { ...data, updatedAt: new Date().toISOString() })
}

export async function borrarItem(clinicId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(COL(clinicId), itemId))
}

export async function listarItems(clinicId: string, soloActivos = true): Promise<FarmaciaItem[]> {
  let q = query(COL(clinicId), orderBy('nombre', 'asc'))
  if (soloActivos) q = query(COL(clinicId), where('activo', '==', true), orderBy('nombre', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as FarmaciaItem))
}

/** Registra un movimiento y actualiza el stock en una sola operación */
export async function registrarMovimiento(
  clinicId: string,
  itemActual: FarmaciaItem,
  mov: Omit<MovimientoFarmacia, 'id' | 'fecha'>,
): Promise<void> {
  if (!itemActual.id) throw new Error('Item sin id')
  const fecha = new Date().toISOString()
  // 1. Registrar el movimiento
  await addDoc(COL_MOV(clinicId), { ...mov, fecha })
  // 2. Recalcular el stock
  let nuevaCantidad = itemActual.cantidad
  if (mov.tipo === 'entrada') nuevaCantidad += mov.cantidad
  else if (mov.tipo === 'salida' || mov.tipo === 'caducidad' || mov.tipo === 'merma') {
    nuevaCantidad -= mov.cantidad
  } else if (mov.tipo === 'ajuste') {
    nuevaCantidad = mov.cantidad  // ajuste = set absoluto
  }
  if (nuevaCantidad < 0) nuevaCantidad = 0
  await actualizarItem(clinicId, itemActual.id, { cantidad: nuevaCantidad })
}

export async function listarMovimientos(clinicId: string, itemId: string): Promise<MovimientoFarmacia[]> {
  const q = query(COL_MOV(clinicId), where('itemId', '==', itemId), orderBy('fecha', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as MovimientoFarmacia))
}

/** Helpers de alerta */
export function bajoMinimo(item: FarmaciaItem): boolean {
  return item.cantidadMinima !== undefined && item.cantidad <= item.cantidadMinima
}

export function caducaEnDias(item: FarmaciaItem): number | null {
  if (!item.caducidad) return null
  const ms = new Date(item.caducidad).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function estaCaducado(item: FarmaciaItem): boolean {
  const d = caducaEnDias(item)
  return d !== null && d < 0
}

export function caducaPronto(item: FarmaciaItem, diasUmbral = 60): boolean {
  const d = caducaEnDias(item)
  return d !== null && d >= 0 && d <= diasUmbral
}
