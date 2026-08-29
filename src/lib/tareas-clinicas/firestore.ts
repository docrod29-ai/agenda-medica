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
import { collection, doc, addDoc, setDoc, getDoc, updateDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import {
  puedeTransicionar, puedeCerrarse, conTransicion,
  type TareaClinica, type EstadoTarea, type CierreDeTarea,
} from './modelo'

const COL = (clinicId: string) => collection(db, 'clinics', clinicId, 'tareas_clinicas')

/**
 * IDENTIDAD DE UNA TAREA DERIVADA, para no duplicarla.
 *
 * Una tarea que nace de un HECHO —«se pidió esta biometría en esta nota»— es la
 * misma tarea aunque el hecho se repita: imprimir la orden dos veces no son dos
 * biometrías. Con `addDoc` cada llamada creaba una copia, y un worklist con la
 * misma tarea tres veces se vuelve ruido y se abandona.
 *
 * El id se deriva de la nota y del título, así que la segunda escritura
 * SOBREESCRIBE la primera en vez de sumarse.
 */
function idDerivado(t: Omit<TareaClinica, 'id'>): string | null {
  if (!t.notaId) return null
  const clave = `${t.tipo}:${t.titulo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return clave ? `${t.notaId}__${clave}` : null
}

/**
 * Crea las tareas de golpe. Devuelve cuántas entraron.
 *
 * Las que traen `notaId` van con id DERIVADO y `merge`: repetir la acción que
 * las origina —volver a imprimir la orden, reprocesar la nota— no las duplica.
 * `merge` y no `set` a secas para no pisar el estado de una tarea que el médico
 * ya movió: si la aceptó o la cerró, volver a imprimir la orden no puede
 * devolverla a «solicitada».
 */
export async function crearTareas(clinicId: string, tareas: readonly Omit<TareaClinica, 'id'>[]): Promise<number> {
  if (!clinicId || !tareas.length) return 0
  let n = 0
  for (const t of tareas) {
    try {
      // `undefined` revienta en Firestore («Unsupported field value»): se limpian
      // antes, porque una tarea que no se guarda es un pendiente que se pierde —
      // exactamente lo que este módulo existe para evitar.
      const limpio = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined))
      const id = idDerivado(t)
      if (id) {
        const { estado, ...sinEstado } = limpio as Record<string, unknown> & { estado?: unknown }
        const ref = doc(COL(clinicId), id)
        const previa = await getDoc(ref)
        // El estado sólo se escribe al NACER. Después manda el médico.
        await setDoc(ref, previa.exists() ? sinEstado : { ...sinEstado, estado }, { merge: true })
      } else {
        await addDoc(COL(clinicId), limpio)
      }
      n++
    } catch {
      /* una tarea que falle no puede tumbar las demás */
    }
  }
  return n
}

export interface WorklistVivo {
  tareas: TareaClinica[]
  /**
   * true = se alcanzó el tope. HAY pendientes vivos que NO vienen en `tareas`.
   *
   * REG-344 — no es cosmético. Sin `orderBy` (ver abajo) los que vienen son un
   * subconjunto ARBITRARIO: entre los que faltan puede estar un resultado
   * crítico sin revisar. Un worklist que se queda corto en silencio enseña «no
   * hay nada pendiente» de un consultorio que sí lo tiene, y eso es peor que no
   * enseñar nada.
   */
  truncada: boolean
  tope: number
}

/** Las tareas VIVAS del consultorio. El worklist. */
export async function tareasVivas(clinicId: string, tope = 200): Promise<WorklistVivo> {
  if (!clinicId) return { tareas: [], truncada: false, tope }
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
  /**
   * Se piden `tope + 1` para SABER si se quedó corto. El extra no se devuelve:
   * sólo sirve para poder decirlo. Es el mismo truco que `listarPacientesPagina`,
   * y aquí importa más — allí falta un nombre en una lista, aquí falta trabajo
   * clínico que nadie va a recordar.
   */
  const q = query(
    COL(clinicId),
    where('estado', 'in', ['solicitada', 'aceptada', 'en_curso', 'completada']),
    limit(tope + 1),
  )
  const snap = await getDocs(q)
  const truncada = snap.docs.length > tope
  const tareas = (truncada ? snap.docs.slice(0, tope) : snap.docs)
    .map(d => ({ ...(d.data() as TareaClinica), id: d.id }))
  return { tareas, truncada, tope }
}

/**
 * Las tareas CERRADAS más recientes — «closed recently» de §10 (V15
 * Master Loop, Fase 7). NO es parte de `tareasVivas()` a propósito (esa
 * consulta excluye `cerrada`, es el worklist de lo VIVO): quien quiere ver
 * lo ya resuelto paga su propia lectura, aparte, y sólo cuando la pide —
 * `/pendientes` la llama bajo demanda, no en cada carga de la pantalla más
 * visitada del médico.
 *
 * Sin `orderBy` por el mismo motivo que `tareasVivas()`: evitar el índice
 * compuesto que `where + orderBy` exigiría. El orden por fecha lo pone quien
 * llama, en cliente.
 *
 * Sólo `cerrada` — no `cancelada`. «Closed recently» en §9/§10 es la
 * constancia de que alguien revisó y decidió; cancelar es «ya no aplica»,
 * un cierre distinto que ya tiene su propio motivo visible en la bitácora.
 */
export async function tareasCerradasRecientes(clinicId: string, tope = 30): Promise<TareaClinica[]> {
  if (!clinicId) return []
  const q = query(COL(clinicId), where('estado', '==', 'cerrada'), limit(tope))
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
  extra: { motivoCancelacion?: string; cierre?: Partial<CierreDeTarea> } = {},
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
    /**
     * ── CERRAR YA NO ES UN SOLO ACTO (REG-360) ──────────────────────────────
     *
     * «Cerrar» abarcaba de golpe las tres etapas del §9 —DECISION, ACTION y
     * PATIENT COMMUNICATION— sin distinguirlas, así que un resultado crítico
     * cerrado **sin que nadie llamara al paciente** se veía igual que uno donde
     * sí se llamó.
     *
     * Ahora se exige decir QUÉ SE DECIDIÓ. El aviso al paciente **no** se
     * exige —hacerlo convertiría cada cierre en un formulario y un worklist que
     * cuesta se abandona— pero tampoco se inventa: sin registrar, se lee como
     * `sin_dato`, nunca como «se avisó».
     */
    const cierre: Partial<CierreDeTarea> = { ...extra.cierre, quien: uid, cuando: ahora }
    const puede = puedeCerrarse(cierre)
    if (!puede.permitido) return { ok: false, motivo: puede.motivo }
    patch.cierre = cierre
    // Cerrar ES la constancia de que alguien lo revisó: sin autor no significa nada.
    patch.cerradaEn = ahora
    patch.cerradaPor = uid
  }
  if (nuevo === 'cancelada') patch.motivoCancelacion = String(extra.motivoCancelacion).trim()

  /**
   * El registro de transiciones: sin él, «cerrada» no dice cuándo se aceptó,
   * quién la tuvo, ni si se reabrió por el camino. Acotado, para que una tarea
   * reabierta muchas veces no haga crecer su documento sin techo.
   */
  patch.transiciones = conTransicion(tarea.transiciones, {
    de: tarea.estado, a: nuevo, quien: uid, cuando: ahora,
    ...(extra.motivoCancelacion ? { motivo: String(extra.motivoCancelacion).trim() } : {}),
  })

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
