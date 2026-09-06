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
import { collection, doc, addDoc, setDoc, getDoc, updateDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import {
  puedeTransicionar, puedeCerrarse, conTransicion, pesoDeUrgencia,
  type TareaClinica, type EstadoTarea, type CierreDeTarea,
} from './modelo'
import { conRespaldoSinIndice } from '@/lib/firestore/indice-que-todavia-no-esta'

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

/** Los estados que cuentan como VIVOS. Una sola lista para las dos lecturas. */
const VIVOS: EstadoTarea[] = ['solicitada', 'aceptada', 'en_curso', 'agendada', 'completada']

/**
 * Las tareas VIVAS del consultorio. El worklist.
 *
 * ══ P1-14 · EL RECORTE SE HACE POR URGENCIA, NO POR ANTIGÜEDAD ═══════════════
 *
 * ── LO QUE PASABA, Y POR QUÉ NINGUNA DE LAS DOS VERSIONES ANTERIORES BASTABA ──
 *
 * Esta consulta trae como mucho `tope` tareas. La pregunta que decide si el
 * worklist sirve es **cuáles**, y ha tenido tres respuestas:
 *
 * 1. **Sin `orderBy`** (hasta REG-421): Firestore devolvía `tope` documentos
 *    cualesquiera, en orden de identificador. Entre los que no llegaban podía
 *    estar un resultado crítico sin revisar. REG-344 hizo que al menos se
 *    DIJERA (`truncada`), que es lo único que se podía hacer sin índice.
 * 2. **`orderBy('creadaEn')`** (REG-421): el recorte deja de ser arbitrario y se
 *    lleva a las MÁS NUEVAS. Mejor —una tarea vieja ya no puede caerse— pero
 *    **sustituye urgencia por antigüedad**, que es justo lo que P1-14 decía que
 *    no. En un consultorio con más de `tope` pendientes vivos, el resultado
 *    crítico de ESTA MAÑANA es el primero en caerse, y se cae en silencio.
 * 3. **Por urgencia** (esto): primero por `pesoUrgencia`, y a igual urgencia lo
 *    más viejo arriba.
 *
 * El desempate temporal no es decorativo: sin él, entre dos tareas críticas el
 * recorte volvería a ser arbitrario, y la que lleva tres semanas esperando es la
 * que más falta hace que se vea.
 *
 * ── POR QUÉ UN NÚMERO Y NO LA PALABRA ────────────────────────────────────────
 *
 * Firestore ordena texto alfabéticamente, así que `orderBy('prioridad')` pondría
 * `alta` ANTES que `critica`. Al revés de lo que dice la palabra, y en silencio.
 * Por eso existe `pesoUrgencia` — la proyección numérica de `prioridad`, escrita
 * en la única puerta de escritura. Ver `ESCALERA_DE_URGENCIA` en `modelo.ts`,
 * incluido por qué no es una segunda fuente de verdad.
 *
 * ── LA RED DE SEGURIDAD, Y POR QUÉ NO ES OPCIONAL ────────────────────────────
 *
 * **Un `orderBy` de Firestore no ordena los documentos a los que les falta el
 * campo: los EXCLUYE.** Las tareas escritas antes de P1-14 no tienen
 * `pesoUrgencia`, así que la consulta por urgencia, ella sola,
 * **haría desaparecer del worklist todos los pendientes históricos** — un
 * expediente entero de trabajo clínico, sin un error, sin una lista vacía, sin
 * nada que lo dijera.
 *
 * Por eso se leen DOS consultas y se unen por id:
 *
 * · la de urgencia, que trae lo mejor ordenado y **sólo lo migrado**;
 * · la de antigüedad —exactamente la de REG-421, con su índice ya desplegado—,
 *   que **trae todo**, porque `creadaEn` es obligatorio desde el primer día.
 *
 * La unión no puede perder nada que hoy se vea, que es la condición de este
 * cambio: lo que la versión anterior enseñaba, ésta lo enseña también.
 *
 * La segunda lectura deja de hacer falta cuando no quede ninguna tarea viva sin
 * peso. Eso NO se adivina: se mide, y sale en `migracionPendiente`. El backfill
 * es `scripts/migraciones/peso-de-urgencia.mjs`.
 *
 * ── Y SI EL ÍNDICE TODAVÍA NO ESTÁ ───────────────────────────────────────────
 *
 * Firestore no degrada una consulta sin índice: la RECHAZA. Entre que este código
 * llega a producción (Vercel publica solo con cada merge) y que el índice termina
 * de construirse hay una ventana, y en esa ventana el worklist se abriría con un
 * error — que es literalmente como se abrió por primera vez. `conRespaldoSinIndice`
 * cierra esa ventana: se cae al camino de antigüedad y lo DICE en
 * `ordenadaPorUrgencia`. No es un `catch` que se traga todo — un permiso denegado
 * o una red caída siguen subiendo.
 *
 * ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────
 *
 * · **No decide la urgencia.** La pone quien crea la tarea, en `prioridad`, y
 *   `derivar.ts` sólo la deduce de lo que el médico escribió. Aquí sólo se ordena.
 * · **No cambia lo que se VE cuando todo cabe.** Con menos de `tope` pendientes
 *   vivos, la lista es la misma de siempre: `ordenWorklist` la reordena entera en
 *   el cliente —primero lo que hay que escalar, que es criterio que Firestore no
 *   sabe evaluar—. Lo que cambia es CUÁLES llegan cuando no caben todas.
 * · **No hace el backfill.** Ese es un script, y correrlo contra datos vivos es
 *   del dueño.
 */
export async function tareasVivas(clinicId: string, tope = 200): Promise<WorklistVivo> {
  if (!clinicId) {
    return { tareas: [], truncada: false, tope, ordenadaPorUrgencia: true, migracionPendiente: false }
  }

  /**
   * Se piden `tope + 1` para SABER si se quedó corto. El extra no se devuelve:
   * sólo sirve para poder decirlo. Es el mismo truco que `listarPacientesPagina`,
   * y aquí importa más — allí falta un nombre en una lista, aquí falta trabajo
   * clínico que nadie va a recordar.
   */
  const porUrgencia = () => getDocs(query(
    COL(clinicId),
    /* `agendada` es VIVA (REG-404): la cita existe y el paciente no ha venido.
       Dejarla fuera de esta consulta la haría desaparecer del worklist, que es
       justo lo que pasaba cuando agendar equivalía a cerrar. */
    where('estado', 'in', VIVOS),
    /* EL ORDEN DE ESTOS DOS ES EL DEL ÍNDICE
       `tareas_clinicas(estado, pesoUrgencia, creadaEn)`. Cambiarlo aquí sin
       cambiarlo allí devuelve `FAILED_PRECONDITION`, no una lista peor. */
    orderBy('pesoUrgencia', 'asc'),
    orderBy('creadaEn', 'asc'),
    limit(tope + 1),
  ))

  /* La de REG-421, intacta: su índice lleva desplegado desde el 31-ago y su
     campo es obligatorio desde el primer día, así que ésta no puede excluir a
     nadie. Es la red. */
  const porAntiguedad = () => getDocs(query(
    COL(clinicId),
    where('estado', 'in', VIVOS),
    orderBy('creadaEn', 'asc'),
    limit(tope + 1),
  ))

  const { valor: snapUrgencia, degradada } = await conRespaldoSinIndice(
    'tareas_clinicas(estado, pesoUrgencia, creadaEn)', porUrgencia, porAntiguedad,
  )
  const snapRed = degradada ? snapUrgencia : await porAntiguedad()

  const porId = new Map<string, TareaClinica>()
  for (const snap of degradada ? [snapUrgencia] : [snapUrgencia, snapRed]) {
    for (const d of snap.docs) porId.set(d.id, { ...(d.data() as TareaClinica), id: d.id })
  }

  /**
   * `truncada` si CUALQUIERA de las dos lecturas tocó su tope: las dos miran el
   * mismo conjunto vivo desde dos órdenes, así que si una se quedó corta hay
   * pendientes fuera. Decirlo de menos sería enseñar «no hay nada más» de un
   * consultorio que sí lo tiene.
   */
  const truncada = snapUrgencia.docs.length > tope || snapRed.docs.length > tope

  /* Lo que quedó SIN peso es lo que la consulta de urgencia no podría haber
     traído: la medida exacta de cuánto falta del backfill. */
  const todas = [...porId.values()]
  const migracionPendiente = todas.some(t => typeof t.pesoUrgencia !== 'number')

  /**
   * El recorte final se hace AQUÍ y por el mismo criterio del servidor, para que
   * unir dos lecturas no reintroduzca por la puerta de atrás el recorte
   * arbitrario que este cambio existe para quitar.
   *
   * **Y se ordena por la PALABRA, no por el número guardado.** El número existe
   * para una cosa sola: que Firestore pueda elegir CUÁLES manda. Una vez aquí,
   * manda `prioridad`, que es el dato — así, si algún día un `pesoUrgencia`
   * guardado se desincronizara, podría cambiar qué tareas llegan pero **nunca**
   * el orden en que se ven. `pesoDeUrgencia` deja al final —no fuera— lo que no
   * se pudo clasificar.
   */
  const tareas = todas
    .sort((a, b) =>
      pesoDeUrgencia(a.prioridad) - pesoDeUrgencia(b.prioridad) ||
      String(a.creadaEn).localeCompare(String(b.creadaEn)))
    .slice(0, tope)

  return { tareas, truncada, tope, ordenadaPorUrgencia: !degradada, migracionPendiente }
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
