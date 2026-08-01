'use client'
/**
 * Persistencia de las tareas clínicas — los cabos sueltos de la consulta.
 *
 * Viven en `clinics/{clinicId}/tareas_clinicas/{tareaId}`, a nivel de
 * consultorio y NO colgando del paciente. Es deliberado: la pregunta que hay que
 * poder responder es «¿qué queda pendiente HOY, de todos mis pacientes?», y
 * colgarlas de cada expediente obligaría a recorrerlos todos para contestarla —
 * o sea, a no contestarla nunca.
 *
 * El `patientId` va dentro, así que el camino inverso —los pendientes de ESTE
 * paciente— sigue siendo una consulta directa.
 */
import { collection, doc, addDoc, updateDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { puedeTransicionar, type TareaClinica, type EstadoTarea } from './modelo'

const COL = (clinicId: string) => collection(db, 'clinics', clinicId, 'tareas_clinicas')

/** Crea las tareas de golpe. Devuelve cuántas entraron. */
export async function crearTareas(clinicId: string, tareas: readonly Omit<TareaClinica, 'id'>[]): Promise<number> {
  if (!clinicId || !tareas.length) return 0
  let n = 0
  for (const t of tareas) {
    try {
      // `undefined` revienta en Firestore («Unsupported field value»): se limpian
      // antes, porque una tarea que no se guarda es un pendiente que se pierde —
      // exactamente lo que este módulo existe para evitar.
      const limpio = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined))
      await addDoc(COL(clinicId), limpio)
      n++
    } catch {
      /* una tarea que falle no puede tumbar las demás */
    }
  }
  return n
}

/** Las tareas VIVAS del consultorio. El worklist. */
export async function tareasVivas(clinicId: string, tope = 200): Promise<TareaClinica[]> {
  if (!clinicId) return []
  /**
   * SIN `orderBy`: EL ORDEN LO PONE EL WORKLIST, NO FIRESTORE.
   *
   * La consulta llevaba `orderBy('creadaEn')` junto al `where … in …`, y esa
   * combinación exige un índice compuesto que hay que crear a mano en la consola.
   * Mientras no existe, la lectura falla entera — que es como se abrió esta
   * pantalla por primera vez en producción: error, no lista vacía.
   *
   * Y el `orderBy` era además redundante: `ordenWorklist` reordena todo en el
   * cliente (primero lo que hay que escalar, luego por prioridad, luego por
   * antigüedad), así que el orden que devolviera Firestore se perdía igual.
   * Quitarlo elimina la dependencia del índice sin cambiar lo que se ve.
   */
  const q = query(
    COL(clinicId),
    where('estado', 'in', ['solicitada', 'aceptada', 'en_curso', 'completada']),
    limit(tope),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...(d.data() as TareaClinica), id: d.id }))
}

/** Los pendientes de UN paciente, para su expediente. */
export async function tareasDePaciente(clinicId: string, patientId: string): Promise<TareaClinica[]> {
  if (!clinicId || !patientId) return []
  const snap = await getDocs(query(COL(clinicId), where('patientId', '==', patientId), limit(100)))
  return snap.docs.map(d => ({ ...(d.data() as TareaClinica), id: d.id }))
}

export interface ResultadoCambio { ok: boolean; motivo: string }

/**
 * Cambia el estado, respetando el ciclo.
 *
 * La transición se valida AQUÍ y no sólo en la pantalla: dos pestañas abiertas
 * sobre la misma tarea son el caso normal en un consultorio, y la segunda
 * llegaría con un estado viejo en la mano.
 */
export async function cambiarEstado(
  clinicId: string,
  tarea: TareaClinica,
  nuevo: EstadoTarea,
  extra: { motivoCancelacion?: string } = {},
): Promise<ResultadoCambio> {
  const v = puedeTransicionar(tarea.estado, nuevo)
  if (!v.permitido) return { ok: false, motivo: v.motivo }
  if (nuevo === 'cancelada' && !String(extra.motivoCancelacion ?? '').trim()) {
    // Cancelar sin motivo convierte «ya no aplica» en «lo quité de la lista».
    return { ok: false, motivo: 'Cancelar un pendiente exige decir por qué.' }
  }
  const uid = auth.currentUser?.uid ?? ''
  const ahora = new Date().toISOString()
  const patch: Record<string, unknown> = { estado: nuevo }
  if (nuevo === 'aceptada' || nuevo === 'en_curso') {
    // Quien la toma se hace dueño: una tarea en curso sin dueño no existe.
    if (!tarea.ownerUid) {
      patch.ownerUid = uid
      patch.ownerNombre = auth.currentUser?.displayName || auth.currentUser?.email || ''
    }
  }
  if (nuevo === 'completada') patch.completadaEn = ahora
  if (nuevo === 'cerrada') {
    // Cerrar ES la constancia de que alguien lo revisó: sin autor no significa nada.
    patch.cerradaEn = ahora
    patch.cerradaPor = uid
  }
  if (nuevo === 'cancelada') patch.motivoCancelacion = String(extra.motivoCancelacion).trim()

  try {
    await updateDoc(doc(COL(clinicId), String(tarea.id)), patch)
    return { ok: true, motivo: '' }
  } catch {
    return { ok: false, motivo: 'No se pudo guardar el cambio.' }
  }
}

/** Asignar dueño a mano, desde el worklist. */
export async function asignar(clinicId: string, tareaId: string, uid: string, nombre: string): Promise<boolean> {
  try {
    await updateDoc(doc(COL(clinicId), tareaId), { ownerUid: uid, ownerNombre: nombre })
    return true
  } catch { return false }
}
