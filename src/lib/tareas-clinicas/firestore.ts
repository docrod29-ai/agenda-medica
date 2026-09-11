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
  puedeTransicionar, puedeCerrarse, conTransicion, pesoDeUrgencia,
  type TareaClinica, type EstadoTarea, type CierreDeTarea,
} from './modelo'
import { fetchAutenticado } from '@/lib/auth-client'

const COL = (clinicId: string) => collection(db, 'clinics', clinicId, 'tareas_clinicas')

/**
 * El id que tendrá la tarea nacida de un hecho que no es una nota.
 *
 * Exportada porque la necesitan los DOS extremos: quien crea la tarea y quien
 * después tiene que encontrarla con el id del hecho en la mano. Dos definiciones
 * de esto serían dos tareas para la misma interconsulta.
 */
export function idDeTareaDeOrigen(origen: string, origenId: string): string | null {
  return origenId ? `${origen}-${origenId}`.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 200) : null
}

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
/**
 * ── Y LO QUE NO NACE DE UNA NOTA (REG-570) ──────────────────────────────────
 *
 * `origenId` es el hecho de origen cuando no es una consulta — hoy, el id de una
 * interconsulta dentro de un episodio. Sin él, la única forma de darle identidad
 * estable a una interconsulta era meter su id en `notaId`, y eso rompe a todo el
 * que lo lee esperando una nota.
 *
 * ── POR QUÉ ÉSE NO LLEVA EL TÍTULO Y EL DE LA NOTA SÍ ──────────────────────
 *
 * Porque no son la misma relación. Una NOTA produce MUCHAS tareas —tres
 * estudios, un seguimiento, una receta— y sin el título todas colapsarían en un
 * documento. Un `origenId` es el hecho mismo: **una interconsulta, una tarea**.
 *
 * Y esa diferencia no es cosmética. Con el título dentro, el id sólo se puede
 * reconstruir si se conoce el título —o sea, la especialidad—, y entonces quien
 * contesta la interconsulta no puede encontrar su tarea con el id que tiene en
 * la mano. Un identificador que hay que adivinar no identifica.
 */
export function idDerivado(t: Omit<TareaClinica, 'id'>): string | null {
  /* Se sanea: `origen` y `origenId` son cadenas del llamador y un `/` partiría
     la ruta del documento. `notaId` ya es un id de Firestore y no lo necesita. */
  if (!t.notaId) return t.origenId ? idDeTareaDeOrigen(t.origen, t.origenId) : null
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
 * Las que traen `notaId` —o, desde REG-570, `origenId`— van con id DERIVADO y
 * `merge`: repetir la acción que las origina —volver a imprimir la orden,
 * reprocesar la nota, reintentar la interconsulta— no las duplica.
 * `merge` y no `set` a secas para no pisar el estado de una tarea que el médico
 * ya movió: si la aceptó o la cerró, volver a imprimir la orden no puede
 * devolverla a «solicitada».
 */
/**
 * ── QUÉ DEVUELVE, Y POR QUÉ NO BASTABA UN NÚMERO (REG-411) ──────────────────
 *
 * Devolvía `Promise<number>`: cuántas entraron. Con eso el llamador puede
 * AVISAR de que faltan —REG-344 lo hizo— pero no puede hacer nada más, porque no
 * sabe **cuáles**. Y un pendiente clínico que nadie puede nombrar es un
 * pendiente que nadie puede reintentar: la única defensa posible era un aviso
 * en pantalla, que se lo lleva la primera navegación.
 *
 * Ahora devuelve también las que no entraron, que es lo que permite guardarlas y
 * volver a ofrecerlas. El número sigue ahí para quien sólo quiera contar.
 */
export interface ResultadoDeCrear {
  readonly creadas: number
  /** Las que NO quedaron escritas. Vacío no significa «no lo intenté». */
  readonly noEntraron: readonly Omit<TareaClinica, 'id'>[]
}

export async function crearTareas(
  clinicId: string, tareas: readonly Omit<TareaClinica, 'id'>[],
): Promise<ResultadoDeCrear> {
  if (!clinicId || !tareas.length) return { creadas: 0, noEntraron: [] }
  let n = 0
  const noEntraron: Omit<TareaClinica, 'id'>[] = []
  for (const t of tareas) {
    try {
      // `undefined` revienta en Firestore («Unsupported field value»): se limpian
      // antes, porque una tarea que no se guarda es un pendiente que se pierde —
      // exactamente lo que este módulo existe para evitar.
      const limpio = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined))
      /**
       * EL PESO SE DERIVA AQUÍ, Y SÓLO AQUÍ (P1-14).
       *
       * `pesoUrgencia` es la proyección numérica de `prioridad` para que el
       * ORDEN lo pueda poner Firestore — la palabra no se puede ordenar (en
       * alfabético `alta` iría antes que `critica`).
       *
       * Se calcula en la puerta y **se pisa** lo que venga de fuera: si un
       * llamador pudiera mandarlo, sería una segunda fuente de verdad y podría
       * decir que una tarea crítica es normal. Escribirlo aquí es lo que hace
       * que la proyección no pueda mentir por descuido — y `urgenciaDeLaTarea`
       * cubre el caso de que alguna vez mienta de todas formas.
       */
      limpio.pesoUrgencia = pesoDeUrgencia((t as { prioridad?: string }).prioridad)
      const id = idDerivado(t)
      if (id) {
        const { estado, ...sinEstado } = limpio as Record<string, unknown> & { estado?: unknown }
        const ref = doc(COL(clinicId), id)
        const previa = await getDoc(ref)
        if (previa.exists() && t.origen === 'expediente:peticion-de-acceso') { n++; continue }
        // El estado sólo se escribe al NACER. Después manda el médico.
        await setDoc(ref, previa.exists() ? sinEstado : { ...sinEstado, estado }, { merge: true })
      } else {
        await addDoc(COL(clinicId), limpio)
      }
      n++
    } catch {
      /* una tarea que falle no puede tumbar las demás — pero sí se apunta */
      noEntraron.push(t)
    }
  }
  return { creadas: n, noEntraron }
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
  /**
   * `false` = el recorte NO se hizo por urgencia (P1-14).
   *
   * Sólo puede pasar si el índice `tareas_clinicas(estado, pesoUrgencia,
   * creadaEn)` todavía no está construido en el proyecto vivo. Entonces se lee
   * por el camino de antes —antigüedad— y **se dice**: una lista recortada por
   * el criterio equivocado presentada como la buena es peor que un error, porque
   * nadie va a ir a buscar lo que falta.
   */
  ordenadaPorUrgencia: boolean
  /**
   * `true` = entre lo vivo hay tareas SIN `pesoUrgencia`, escritas antes de
   * P1-14 (§ «La red de seguridad», abajo).
   *
   * No es un fallo: es el estado normal hasta que corra el backfill
   * (`scripts/migraciones/peso-de-urgencia.mjs`). Se expone para que se pueda
   * saber cuándo la segunda lectura ya no hace falta, en vez de adivinarlo.
   */
  migracionPendiente: boolean
}

/** La misma colección y política de prioridad se resuelven en el servidor.
 * Las reglas no filtran consultas globales; el lector autoriza antes del tope. */
async function pedirListado(clinicId: string, modo: 'vivas' | 'cerradas', tope: number, soloRecepcion = false): Promise<WorklistVivo> {
  const res = await fetchAutenticado('/api/tareas/listar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, modo, tope, soloRecepcion }),
  })
  if (!res.ok) throw new Error('No se pudieron cargar los pendientes.')
  const listado = await res.json() as WorklistVivo & { presupuestoAgotado?: boolean }
  if (listado.presupuestoAgotado) throw new Error('La búsqueda alcanzó su límite de lectura; no se pudo completar la lista de pendientes.')
  return listado
}

export async function tareasVivas(clinicId: string, tope = 200, alcance: { soloRecepcion?: boolean } = {}): Promise<WorklistVivo> {
  if (!clinicId) return { tareas: [], truncada: false, tope, ordenadaPorUrgencia: true, migracionPendiente: false }
  return pedirListado(clinicId, 'vivas', tope, alcance.soloRecepcion === true)
}

/** Cerradas bajo demanda: revisar y cerrar sigue siendo distinto de cancelar. */
export async function tareasCerradasRecientes(clinicId: string, tope = 30): Promise<TareaClinica[]> {
  if (!clinicId) return []
  return (await pedirListado(clinicId, 'cerradas', tope)).tareas
}

/** Los pendientes de UN paciente, para su expediente. */
export async function tareasDePaciente(clinicId: string, patientId: string): Promise<TareaClinica[]> {
  if (!clinicId || !patientId) return []
  const snap = await getDocs(query(COL(clinicId), where('patientId', '==', patientId), limit(100)))
  return snap.docs.map(d => ({ ...(d.data() as TareaClinica), id: d.id }))
}

/**
 * UNA tarea por su id.
 *
 * Hace falta porque `cambiarEstado` necesita la tarea ENTERA —su estado actual y
 * su registro de transiciones—, y quien conoce el id derivado de un hecho (una
 * interconsulta, REG-570) no tiene la tarea en la mano. Leerla antes de moverla
 * es además lo que evita pisar el trabajo de otra pestaña.
 */
export async function tareaPorId(clinicId: string, tareaId: string): Promise<TareaClinica | null> {
  if (!clinicId || !tareaId) return null
  try {
    const snap = await getDoc(doc(COL(clinicId), tareaId))
    return snap.exists() ? ({ ...(snap.data() as TareaClinica), id: snap.id }) : null
  } catch {
    return null
  }
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
  extra: { motivoCancelacion?: string; cierre?: Partial<CierreDeTarea>; citaId?: string } = {},
): Promise<ResultadoCambio> {
  const v = puedeTransicionar(tarea.estado, nuevo)
  if (!v.permitido) return { ok: false, motivo: v.motivo }
  /**
   * REG-585 · no se declara «agendada» sin decir CUÁL cita.
   *
   * Sin el identificador, `agendada` era una declaración que nadie podía
   * contrastar: si la cita se cancelaba o el paciente no venía, el pendiente
   * seguía esperando a nadie. Casarla después por paciente y fecha sería
   * adivinar cuál de sus citas era.
   *
   * Se exige sólo en la transición NUEVA. Las tareas que ya están en `agendada`
   * sin él se leen como «no se puede saber» — reescribirlas sería inventarles
   * una cita.
   */
  if (nuevo === 'agendada' && !String(extra.citaId ?? '').trim()) {
    return { ok: false, motivo: 'Marcar un pendiente como agendado exige decir a qué cita.' }
  }
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
  if (nuevo === 'agendada') patch.citaId = String(extra.citaId).trim()
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
