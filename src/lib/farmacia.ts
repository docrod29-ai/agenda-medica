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
  collection, addDoc, updateDoc, doc, getDocs,
  query, orderBy, where, runTransaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { idIdempotente } from '@/lib/idempotencia'
import { instanteMX } from '@/lib/timezone'

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
  /**
   * EDITAR METADATOS NUNCA TOCA EXISTENCIAS.
   *
   * El modal de edición precargaba `cantidad` con el valor que el ítem tenía AL
   * ABRIRSE y lo reescribía con un updateDoc plano, fuera del ledger transaccional.
   * Corregir el proveedor de un ítem revertía en silencio cualquier dispensación
   * hecha entre que se abrió el modal y se guardó: el stock "reaparecía" y el
   * movimiento quedaba huérfano. Es pérdida de dato de inventario, grave con
   * controlados.
   *
   * Las existencias SOLO se mueven por `registrarMovimiento` (transacción que
   * relee el stock real). Aquí se descarta `cantidad` aunque el caller la mande.
   */
  const { cantidad: _ignora, ...metadatos } = data
  void _ignora
  await updateDoc(doc(COL(clinicId), itemId), { ...metadatos, updatedAt: new Date().toISOString() })
}

export async function borrarItem(clinicId: string, itemId: string): Promise<void> {
  // Baja LÓGICA (no hard-delete): conserva el historial de movimientos ligado al
  // ítem (auditoría de controlados). listarItems ya filtra por activo==true.
  await updateDoc(doc(COL(clinicId), itemId), { activo: false, updatedAt: new Date().toISOString() })
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
  /**
   * ── LA TRANSACCIÓN NO PROTEGE DE REPETIRLA (REG-515) ────────────────────
   *
   * `runTransaction` garantiza que la aritmética de existencias sea atómica: dos
   * salidas concurrentes ya no parten del mismo valor viejo. Y no dice **nada**
   * sobre ejecutar la misma salida dos veces.
   *
   * El movimiento se escribía con `tx.set(doc(COL_MOV(clinicId)), …)`, y `doc()`
   * sin id fabrica un nombre aleatorio — lo que el propio `idempotencia.ts`
   * advierte en su primera línea. Así que si el commit sale y la respuesta se
   * pierde, el reintento **descuenta el medicamento otra vez**, con otro nombre,
   * y los dos movimientos quedan en los libros.
   *
   * No es un doble clic —eso lo cubre el botón— sino el caso que provoca la red
   * sola. Con controlados, es la diferencia entre la existencia real y la que
   * dice el sistema.
   *
   * La clave la acuña quien ABRE el modal y la conserva mientras esa salida no
   * haya terminado: una intención, un movimiento.
   */
  claveDeIntento?: string,
): Promise<number> {   // devuelve la cantidad REALMENTE aplicada (puede ser < la solicitada por clamp)
  if (!itemActual.id) throw new Error('Item sin id')
  const fecha = new Date().toISOString()
  const itemRef = doc(COL(clinicId), itemActual.id)
  const movRef = claveDeIntento
    ? doc(COL_MOV(clinicId), idIdempotente(clinicId, 'farmacia', claveDeIntento))
    : doc(COL_MOV(clinicId))

  // TRANSACCIÓN: lee la existencia ACTUAL del doc (no la que trae el caller, que
  // puede estar vieja) y calcula desde ahí. Antes, dos salidas concurrentes
  // partían del mismo valor viejo → last-write-wins descuadraba el stock.
  return await runTransaction(db, async (tx) => {
    /**
     * Se lee ANTES que el item: si este movimiento ya está escrito, no hay que
     * tocar las existencias — y hacerlo dentro de la transacción es lo que
     * cierra la ventana entre leer y escribir que tiene la otra pestaña.
     *
     * Se devuelve la cantidad que se aplicó ENTONCES, no la que se pidió ahora:
     * si aquella salida se recortó por falta de existencias, el reintento tiene
     * que enterarse del recorte y no del deseo.
     */
    if (claveDeIntento) {
      const yaEsta = await tx.get(movRef)
      if (yaEsta.exists()) return Number((yaEsta.data() as { cantidad?: number }).cantidad ?? 0)
    }
    const snap = await tx.get(itemRef)
    const disponible = snap.exists() ? Number((snap.data() as { cantidad?: number }).cantidad ?? 0) : itemActual.cantidad
    let nuevaCantidad = disponible
    let cantidadAplicada = mov.cantidad
    let notaAjuste = ''

    if (mov.tipo === 'entrada') {
      nuevaCantidad = disponible + mov.cantidad
    } else if (mov.tipo === 'salida' || mov.tipo === 'caducidad' || mov.tipo === 'merma') {
      cantidadAplicada = Math.min(mov.cantidad, disponible)
      if (cantidadAplicada < mov.cantidad) notaAjuste = ` [ajustado: se solicitaron ${mov.cantidad} pero solo había ${disponible}]`
      nuevaCantidad = disponible - cantidadAplicada
    } else if (mov.tipo === 'ajuste') {
      nuevaCantidad = mov.cantidad
    }

    // Movimiento con la cantidad REAL aplicada (libros cuadran) + stock resultante.
    tx.set(movRef, { ...mov, cantidad: cantidadAplicada, motivo: (mov.motivo ?? '') + notaAjuste, fecha })
    tx.update(itemRef, { cantidad: nuevaCantidad, updatedAt: fecha })
    return cantidadAplicada
  })
}

export async function listarMovimientos(clinicId: string, itemId: string): Promise<MovimientoFarmacia[]> {
  const q = query(COL_MOV(clinicId), where('itemId', '==', itemId), orderBy('fecha', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as MovimientoFarmacia))
}

/**
 * ¿HAY QUE REPONER ESTE ÍTEM?
 *
 * Exigía que hubiera un mínimo CAPTURADO, y el formulario deja ese campo vacío
 * por omisión. Un consultorio que nunca captura mínimos —la mayoría— veía
 * siempre **«Bajo stock: 0»** con cero cajas en el anaquel: un contador en cero
 * se lee como «no falta nada», que es lo contrario de la verdad.
 *
 * Sin mínimo declarado el piso es CERO: quedarse sin existencias es quedarse
 * bajo mínimo en cualquier consultorio, se haya configurado o no. Con mínimo, se
 * respeta el que puso el médico.
 */
export function bajoMinimo(item: FarmaciaItem): boolean {
  return item.cantidad <= (item.cantidadMinima ?? 0)
}

/**
 * Días que faltan para la caducidad, contando el día completo.
 *
 * `new Date('2026-08-02')` es medianoche **UTC**: en México ese lote aparecía
 * CADUCADO desde las 18:00 del día 1 —y disparaba la confirmación de riesgo al
 * dispensarlo— cuando todavía le quedaba el día entero. Un lote vence al FINAL
 * de su día, no al principio del anterior.
 */
export function caducaEnDias(item: FarmaciaItem): number | null {
  if (!item.caducidad) return null
  const f = String(item.caducidad).slice(0, 10)
  const fin = /^\d{4}-\d{2}-\d{2}$/.test(f)
    ? instanteMX(f, '23:59').getTime()
    : new Date(item.caducidad).getTime()
  if (!Number.isFinite(fin)) return null
  return Math.floor((fin - Date.now()) / (1000 * 60 * 60 * 24))
}

export function estaCaducado(item: FarmaciaItem): boolean {
  const d = caducaEnDias(item)
  return d !== null && d < 0
}

export function caducaPronto(item: FarmaciaItem, diasUmbral = 60): boolean {
  const d = caducaEnDias(item)
  return d !== null && d >= 0 && d <= diasUmbral
}
