import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, where, writeBatch, runTransaction,
  limit as limitarA, documentId,
  type DocumentReference,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { NotaMedica, Adenda } from '@/types/expediente'
// `stripUndefined` se mudó a un módulo puro (sin SDK) para poder simular el viaje
// a Firestore en los tests del sello de integridad. Ver serializacion.ts.
import { stripUndefined } from './serializacion'
import { logAudit } from './audit-log'
import { idIdempotente } from '@/lib/idempotencia'

/**
 * Notas clínicas viven en:
 *   clinics/{clinicId}/patients/{patientId}/notas/{notaId}
 * Aislamiento multi-tenant heredado de la estructura existente.
 */
function notasCol(clinicId: string, patientId: string) {
  return collection(db, 'clinics', clinicId, 'patients', patientId, 'notas')
}
function notaDoc(clinicId: string, patientId: string, notaId: string) {
  return doc(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId)
}

/** Defaults defensivos: notas viejas pueden no traer arreglos → el timeline del
 *  expediente reventaba al hacer .map/.length sobre undefined. */
function normNota(raw: Record<string, unknown>, id: string): NotaMedica {
  const n = raw as unknown as Partial<NotaMedica>
  return {
    ...(raw as unknown as NotaMedica),
    id,
    diagnosticos: Array.isArray(n.diagnosticos) ? n.diagnosticos : [],
    medicamentos: Array.isArray(n.medicamentos) ? n.medicamentos : [],
    alergias: Array.isArray(n.alergias) ? n.alergias : [],
    secciones: Array.isArray(n.secciones) ? n.secciones : [],
  }
}

export async function getNotas(clinicId: string, patientId: string): Promise<NotaMedica[]> {
  const snap = await getDocs(query(notasCol(clinicId, patientId), orderBy('fechaConsulta', 'desc')))
  return snap.docs.map(d => normNota(d.data(), d.id))
}

export async function getNota(clinicId: string, patientId: string, notaId: string): Promise<NotaMedica | null> {
  const snap = await getDoc(notaDoc(clinicId, patientId, notaId))
  // IMPORTANTE: id va DESPUÉS del spread para que sobreescriba cualquier 'id'
  // erróneo que se haya guardado en data (bug legacy, líneas 183 y 189 de consulta/page.tsx).
  return snap.exists() ? normNota(snap.data(), snap.id) : null
}

/**
 * ── EL RESCATE COSTABA N+1 LECTURAS EN SERIE (A3 · portado del PR #356) ──────
 *
 * Lo que había: `findNotaByIdInClinic` bajaba TODOS los pacientes del
 * consultorio y luego pedía el documento de la nota uno por uno, en serie, hasta
 * dar con ella. Una URL malformada —el caso que esta ruta existe para rescatar—
 * costaba N+1 lecturas y N viajes de ida y vuelta encadenados. Con 50 000
 * pacientes son 50 001 lecturas y la pantalla de rescate es peor que el enlace
 * roto que venía a arreglar.
 *
 * Lo que hay ahora, en dos escalones y ninguno proporcional al tamaño del
 * consultorio: una consulta indexada acotada a 2 —el 2 no sobra: permite
 * DETECTAR ambigüedad en vez de quedarse con la primera que aparezca— y, para
 * las notas anteriores a este contrato, un sondeo de compatibilidad con techo.
 * Por encima del techo NO se adivina: se devuelve `no-resoluble`, que no es lo
 * mismo que `no-encontrada`.
 *
 * AISLAMIENTO: la pertenencia al consultorio se prueba contra la RUTA del
 * documento, no contra un campo que alguien pudo escribir mal.
 */
/** Cuántos pacientes se sondean como mucho en el camino de compatibilidad. */
export const TECHO_SONDEO_NOTA = 50

export type ResultadoNotaEnClinica =
  | { estado: 'encontrada'; patientId: string; notaId: string; nota: NotaMedica }
  | { estado: 'no-encontrada' }
  | { estado: 'ambigua' }
  | { estado: 'no-resoluble'; pacientesSondeados: number }

/**
 * Deriva el paciente de la RUTA de la nota y, de paso, prueba que la nota vive
 * dentro de este consultorio. Devuelve null si la ruta no es exactamente
 * `clinics/{clinicId}/patients/{patientId}/notas/{notaId}`.
 */
function pacienteDeLaRutaDeNota(ruta: string, clinicId: string): string | null {
  const s = ruta.split('/')
  if (s.length !== 6) return null
  if (s[0] !== 'clinics' || s[1] !== clinicId || s[2] !== 'patients' || s[4] !== 'notas') return null
  return s[3] || null
}

export async function buscarNotaEnClinica(clinicId: string, notaId: string): Promise<ResultadoNotaEnClinica> {
  if (!clinicId || !notaId) return { estado: 'no-encontrada' }

  // ── 1. Consulta indexada, acotada a 2 ────────────────────────────────────
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'notas'),
      where('clinicId', '==', clinicId),
      where('metadata.id', '==', notaId),
      limitarA(2),
    ))
    let propias = 0
    let primera: { patientId: string; id: string; data: Record<string, unknown> } | null = null
    for (const d0 of snap.docs) {
      const patientId = pacienteDeLaRutaDeNota(d0.ref.path, clinicId)
      if (!patientId) continue
      propias++
      if (!primera) primera = { patientId, id: d0.id, data: d0.data() as Record<string, unknown> }
    }

    if (propias > 1) return { estado: 'ambigua' }
    if (primera) {
      return {
        estado: 'encontrada',
        patientId: primera.patientId,
        notaId: primera.id,
        nota: normNota(primera.data, primera.id),
      }
    }
    // Hubo candidatas pero NINGUNA de este consultorio: se cierra aquí. No se
    // sondea, porque lo único que se sabe es que ese id vive en otro tenant.
    if (snap.docs.length > 0) return { estado: 'no-encontrada' }
  } catch {
    /**
     * Índice compuesto o regla de `collectionGroup` ausentes → el SDK lanza.
     * No es motivo para tumbar el rescate ni para volver al recorrido total:
     * se cae al sondeo acotado de abajo, que sigue siendo O(techo).
     */
  }

  // ── 2. Sondeo de compatibilidad, acotado ─────────────────────────────────
  const pacientesSnap = await getDocs(query(
    collection(db, 'clinics', clinicId, 'patients'),
    orderBy(documentId(), 'asc'),
    limitarA(TECHO_SONDEO_NOTA + 1),
  ))
  const hayMasPacientes = pacientesSnap.docs.length > TECHO_SONDEO_NOTA
  const candidatos = pacientesSnap.docs.slice(0, TECHO_SONDEO_NOTA)

  // En paralelo: el bucle en serie encadenaba N viajes de ida y vuelta.
  const sondeos = await Promise.all(candidatos.map(async p => ({
    patientId: p.id,
    snap: await getDoc(notaDoc(clinicId, p.id, notaId)),
  })))
  const aciertos = sondeos.filter(s => s.snap.exists())

  if (aciertos.length > 1) return { estado: 'ambigua' }
  if (aciertos.length === 1) {
    const { patientId, snap } = aciertos[0]
    return { estado: 'encontrada', patientId, notaId: snap.id, nota: normNota(snap.data() as Record<string, unknown>, snap.id) }
  }
  return hayMasPacientes
    ? { estado: 'no-resoluble', pacientesSondeados: candidatos.length }
    : { estado: 'no-encontrada' }
}

/**
 * Compatibilidad: la forma anterior (`{ patientId, nota } | null`) para los
 * llamadores que no distinguen los cuatro estados. `no-resoluble` devuelve null
 * igual que `no-encontrada` — por eso quien le habla a un humano debería usar
 * `buscarNotaEnClinica` y decir la verdad: no es lo mismo «no existe» que «no
 * la busqué entera».
 */
export async function findNotaByIdInClinic(clinicId: string, notaId: string): Promise<{ patientId: string; nota: NotaMedica } | null> {
  const r = await buscarNotaEnClinica(clinicId, notaId)
  return r.estado === 'encontrada' ? { patientId: r.patientId, nota: r.nota } : null
}

export interface OpcionesCrearNota {
  /**
   * El nombre del ENCUENTRO que se está abriendo (`claveDeIntento()` o el id de
   * la cita de hoy). Ver `lib/idempotencia.ts`.
   *
   * Con clave, la primera nota del encuentro tiene un id DETERMINISTA: dos
   * intentos de «Iniciar consulta» —dos toques, dos pestañas, o un reintento
   * tras un timeout aparente— convergen al mismo borrador en vez de abrir dos
   * expedientes de la misma visita.
   */
  claveEncuentro?: string
}

export async function createNota(
  clinicId: string,
  patientId: string,
  data: Omit<NotaMedica, 'id'>,
  opciones: OpcionesCrearNota = {},
): Promise<string> {
  // Strip 'id' por si llega como '' desde el caller — si se guarda en data,
  // sobreescribe el doc.id al leer con spread y rompe la navegación.
  const { id: _ignorado, ...sinId } = data as NotaMedica
  void _ignorado
  const payload = stripUndefined(sinId)
  // Guardián de 1 MB TAMBIÉN al crear (antes solo estaba en updateNota): una nota
  // ya grande en su PRIMERA escritura —dictado largo con transcripción cruda +
  // diálogo diarizado + entidades— fallaba con el error crudo de Firestore. Aquí
  // se avisa con un mensaje claro; el respaldo local conserva el contenido.
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
  if (bytes > 950_000) {
    throw Object.assign(
      new Error(`La nota pesa ${(bytes / 1024).toFixed(0)} KB y Firestore admite hasta 1 MB por documento. Suele deberse a una transcripción muy larga. No se perdió nada: hay respaldo local.`),
      { code: 'nota-demasiado-grande' },
    )
  }
  /**
   * ═══ GOLDEN PATH 9 — UN ENCUENTRO, UNA NOTA ═══
   *
   * `addDoc` inventa un id nuevo en CADA llamada, así que la identidad de la
   * nota nacía de la escritura y no del encuentro. El caso que rompía no es
   * exótico: el autoguardado crea el borrador, la respuesta se pierde por red,
   * el reintento encuentra `notaIdRef` todavía en null y crea OTRA nota. Dos
   * documentos de la misma consulta, los dos a medias, y el médico sin saber
   * cuál es el bueno.
   *
   * Con `claveEncuentro` el id se deriva del encuentro y del consultorio, así
   * que el reintento apunta al mismo documento.
   *
   * PERO SÓLO CONVERGE SOBRE UN BORRADOR VIVO. Si en ese id ya hay una nota
   * FIRMADA, se cae a un id nuevo: cuando la clave es la cita de hoy y el
   * paciente vuelve el mismo día por otra cosa, converger devolvería la nota
   * firmada de la mañana — y la pantalla intentaría escribir sobre un documento
   * inmutable (REG-017), dejando al médico sin poder abrir la segunda consulta.
   * La idempotencia no puede forzar un estado inválido para salirse con la suya.
   */
  if (opciones.claveEncuentro) {
    const id = idIdempotente(clinicId, 'nota', opciones.claveEncuentro)
    const ref = notaDoc(clinicId, patientId, id)
    /**
     * El candado es la TRANSACCIÓN, no un `getDoc` previo: entre leer y escribir
     * cabe la otra pestaña. Aquí, dos aperturas simultáneas del mismo encuentro
     * compiten y sólo una escribe; la otra reintenta, ve el documento y devuelve
     * su id sin pisar una línea.
     */
    const yaFirmada = await runTransaction(db, async (tx) => {
      const dentro = await tx.get(ref)
      if (!dentro.exists()) {
        tx.set(ref, payload)
        return false
      }
      return dentro.data()?.estado === 'firmada'
    })
    if (!yaFirmada) return id
    // Firmada: ese encuentro ya se cerró y es inmutable. La consulta nueva es un
    // documento nuevo — se cae al `addDoc` de abajo.
  }

  const ref = await addDoc(notasCol(clinicId, patientId), payload)
  return ref.id
}

/** Borra una nota. Solo borradores (las firmadas son inmutables por las reglas). */
export async function deleteNota(
  clinicId: string,
  patientId: string,
  notaId: string,
): Promise<void> {
  await deleteDoc(notaDoc(clinicId, patientId, notaId))
  /**
   * BITÁCORA DEL BORRADO (trazabilidad NOM-024).
   *
   * El evento `nota_borrada` existía en el catálogo y en la lista blanca del
   * servidor, y ningún sitio lo emitía. Borrar destruye el documento: sin este
   * asiento no queda NADA — ni que la nota existió, ni quién la quitó.
   *
   * Va aquí y no en las pantallas porque hay dos caminos que borran (descartar
   * la consulta y eliminar el borrador desde el expediente) y ninguno de los dos
   * lo hacía. Poniéndolo en la función, los dos quedan cubiertos y los futuros
   * también.
   */
  void logAudit({ evento: 'nota_borrada', clinicId, patientId, notaId })
}

/**
 * Borra un paciente del expediente — CASCADA.
 * SALVAGUARDA NOM-004: si tiene notas FIRMADAS, no se permite (registro legal).
 * Si solo tiene borradores, se eliminan junto con el paciente Y sus citas.
 * Borrar citas evita que el paciente reaparezca como "de cita" en Expedientes.
 * Devuelve { ok, motivo, borradas? }.
 */
export async function deletePatientExpediente(
  clinicId: string,
  patientId: string,
  /** Datos del paciente para borrar también citas que coinciden por nombre/teléfono */
  matchInfo?: { nombre?: string; telefono?: string },
): Promise<{ ok: boolean; motivo?: string; borradas?: { notas: number; citas: number } }> {
  // 1. Verificar notas firmadas (NOM-004 — bloqueo legal)
  const notas = await getNotas(clinicId, patientId)
  const firmadas = notas.filter(n => n.estado === 'firmada')
  if (firmadas.length > 0) {
    return {
      ok: false,
      motivo: `Tiene ${firmadas.length} nota(s) firmada(s). Los registros clínicos firmados no pueden eliminarse (NOM-004).`,
    }
  }

  // Se ARMA todo primero (solo lecturas) y se borra en UN batch atómico al final:
  // si algo falla, Firestore no aplica NADA → nunca queda un expediente a medias
  // (paciente borrado con citas huérfanas, o notas borradas con paciente presente).
  const citasRef = collection(db, 'clinics', clinicId, 'appointments')
  const refsCitas: DocumentReference[] = []
  const vistas = new Set<string>()

  // Citas por pacienteId
  try {
    const snap = await getDocs(query(citasRef, where('pacienteId', '==', patientId)))
    for (const d of snap.docs) { if (!vistas.has(d.id)) { vistas.add(d.id); refsCitas.push(d.ref) } }
  } catch { /* ignore */ }

  // Citas por nombre/teléfono (cubre citas con pacienteId vacío). Requiere leer la
  // colección porque el match es normalizado (mayúsculas/formato de tel) y Firestore
  // no puede filtrar por eso en la query.
  if (matchInfo?.nombre || matchInfo?.telefono) {
    const norm = (s: string) => s.toLowerCase().trim()
    const normTel = (s: string) => s.replace(/\D/g, '')
    try {
      const all = await getDocs(citasRef)
      for (const d of all.docs) {
        if (vistas.has(d.id)) continue
        const data = d.data() as { pacienteNombre?: string; pacienteTelefono?: string }
        const nombreMatch   = matchInfo.nombre   && data.pacienteNombre   && norm(data.pacienteNombre) === norm(matchInfo.nombre)
        const telefonoMatch = matchInfo.telefono && data.pacienteTelefono && normTel(data.pacienteTelefono) === normTel(matchInfo.telefono)
        if (nombreMatch || telefonoMatch) { vistas.add(d.id); refsCitas.push(d.ref) }
      }
    } catch { /* ignore */ }
  }

  // Commit atómico en lotes de 450 (tope de Firestore = 500 ops por batch).
  const todo = [
    ...notas.map(n => notaDoc(clinicId, patientId, n.id)),
    ...refsCitas,
    doc(db, 'clinics', clinicId, 'patients', patientId),  // el paciente al final
  ]
  try {
    for (let i = 0; i < todo.length; i += 450) {
      const batch = writeBatch(db)
      for (const ref of todo.slice(i, i + 450)) batch.delete(ref)
      await batch.commit()
    }
  } catch (e) {
    return { ok: false, motivo: `No se pudo completar el borrado: ${e instanceof Error ? e.message : 'error'}. No se eliminó nada parcial.` }
  }

  return { ok: true, borradas: { notas: notas.length, citas: refsCitas.length } }
}

/** Solo se permite actualizar borradores (NOM-024: las firmadas son inmutables) */
/** Error de una escritura que habría pisado el trabajo de otro. */
export class ConflictoDeVersion extends Error {
  readonly code = 'conflicto-de-version'
  constructor(public readonly modificadaEn: string) {
    super('Otra sesión modificó esta nota después de que la abriste. No se guardó para no pisar su trabajo.')
  }
}

export async function updateNota(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Partial<NotaMedica>,
  /**
   * GUARDIA DE CONCURRENCIA — la marca de modificación que el llamador vio la
   * última vez.
   *
   * `updateNota` no comparaba NADA antes de escribir. Con la caché
   * multi-pestaña activa, dos pestañas abiertas sobre la misma nota autoguardan
   * cada 30 s el estado COMPLETO de cada una: la que se quedó atrás pisa a la
   * que está trabajando, y van alternando. Gana el último tick.
   *
   * El caso real no es rebuscado: una pestaña olvidada abierta desde la mañana
   * y otra donde se dicta ahora. El médico ve su nota mutilada y —como el
   * historial de versiones se escribe pero no se puede leer desde ninguna
   * pantalla— no tiene ningún botón para recuperar lo que había.
   *
   * Opcional a propósito: quien no la pase se comporta como antes. Los
   * autoguardados de la consulta SÍ la pasan.
   */
  vistoEn?: string,
): Promise<void> {
  // Strip 'id' del payload — solo el doc.id es la fuente de verdad.
  const { id: _ignorado, ...sinId } = data as Partial<NotaMedica>
  void _ignorado

  // NOM-024 Art. 6.4 — versionado: antes de sobrescribir un borrador,
  // guardamos el snapshot actual como versión histórica.
  // Solo para borradores; las notas firmadas son inmutables (no llegan aquí).
  //
  // La lectura sirve además para la guardia de concurrencia: se hace una sola
  // vez y se aprovecha para las dos cosas.
  let prevLeida: import('firebase/firestore').DocumentSnapshot | null = null
  try {
    prevLeida = await getDoc(notaDoc(clinicId, patientId, notaId))
    const prev = prevLeida
    if (prev.exists() && prev.data().estado !== 'firmada') {
      await addDoc(
        collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions'),
        {
          ...prev.data(),
          versionadoEn: new Date().toISOString(),
          // Quién provocó que esta versión quedara atrás. Sin esto, el historial
          // dice QUÉ había pero no ante quién responder.
          versionadoPor: auth.currentUser?.uid ?? null,
          versionadoEmail: auth.currentUser?.email ?? null,
        },
      )
    }
  } catch { /* nunca romper la operación clínica */ }

  /**
   * ── EL DOCUMENTO PUEDE NO EXISTIR, Y ESO NO ES UN PROBLEMA DE PERMISOS ─────
   *
   * Encontrado el 4-ago-2026 con el Dr. en pantalla: «La nota NO se está
   * guardando en el servidor (el servidor rechazó el permiso)» y «Error al
   * firmar», las dos a la vez, con la consulta enfrente.
   *
   * La pantalla tenía un `notaId` —de un respaldo local restaurado, o de una
   * nota que se descartó— y actualizaba a ciegas. Cuando el documento ya no
   * está, Firestore **no** contesta «no existe»: la regla de update intenta leer
   * `resource.data.estado` de un `resource` nulo, revienta, y el fallo se
   * devuelve como **PERMISSION_DENIED**.
   *
   * De ahí el diagnóstico falso. El médico —y yo— nos fuimos a mirar reglas,
   * roles y sesión, y estaban bien: rol admin, clínica activa, pase libre, token
   * vivo. El documento simplemente no estaba.
   *
   * Lo que lo vuelve evitable es que **esta función ya lo sabía**: acaba de leer
   * el documento arriba para versionarlo, y `prev.exists()` decía que no. Tenía
   * el dato en la mano y escribía igual.
   *
   * Se distingue con cuidado «la lectura dijo que NO existe» de «la lectura
   * falló»: sólo lo primero es concluyente. Si hubo un hipo de red, `prevLeida`
   * es nulo y se sigue como siempre — quedarse sin guardar por eso sería peor.
   */
  if (prevLeida && !prevLeida.exists()) {
    throw Object.assign(
      new Error('La nota que esta pantalla tenía abierta ya no existe en el servidor. No se perdió nada: se vuelve a crear con lo que hay en pantalla.'),
      { code: 'nota-inexistente' },
    )
  }

  /**
   * LA GUARDIA. Va DESPUÉS del versionado a propósito: si hay conflicto, el
   * estado que se estaba a punto de pisar ya quedó guardado como versión, así
   * que no se pierde por haber detectado el choque.
   *
   * Si la lectura falló (`prevLeida` nulo), NO se bloquea la escritura: quedarse
   * sin guardar por un hipo de red sería peor que el riesgo que esto cubre.
   */
  if (vistoEn && prevLeida?.exists()) {
    const actual = String(
      (prevLeida.data() as { metadata?: { fechaModificacion?: string }; updatedAt?: string })?.metadata?.fechaModificacion
      ?? (prevLeida.data() as { updatedAt?: string })?.updatedAt
      ?? '',
    )
    if (actual && actual !== vistoEn) throw new ConflictoDeVersion(actual)
  }

  const payload = stripUndefined({ ...sinId, updatedAt: new Date().toISOString() })

  /**
   * TOPE DE 1 MB POR DOCUMENTO DE FIRESTORE.
   *
   * La nota lleva dentro `transcripcionCruda` y `dialogoDiarizado` —el dictado
   * completo de la consulta, con separación de voces— más el bloque `extraction`
   * con una cita textual por campo. En una consulta larga eso crece rápido, y al
   * pasar el tope `updateDoc` falla: el autoguardado empieza a reventar y el
   * médico solo ve "no se está guardando", sin saber por qué.
   *
   * Se comprueba ANTES de escribir para poder decirlo con nombre y apellido. No
   * se trunca nada: truncar sería perder material clínico de origen en silencio,
   * que es peor que fallar. El médico tiene su respaldo local y puede firmar; la
   * solución de fondo es mover la transcripción a su propia subcolección.
   */
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
  if (bytes > 950_000) {
    throw Object.assign(
      new Error(`La nota pesa ${(bytes / 1024).toFixed(0)} KB y Firestore admite hasta 1 MB por documento. Suele deberse a una transcripción muy larga. No se perdió nada: hay respaldo local y puedes firmar la nota.`),
      { code: 'nota-demasiado-grande' },
    )
  }

  await updateDoc(notaDoc(clinicId, patientId, notaId), payload)
}

/**
 * Agrega una ADENDA a una nota firmada (NOM-004): corrección/aclaración que NO
 * altera el documento original. Se guarda en la subcolección inmutable `adendas`.
 * Devuelve la adenda creada (con su id).
 */
export async function agregarAdenda(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Omit<Adenda, 'id' | 'createdAt'>,
): Promise<Adenda> {
  /**
   * GP10 — una adenda sólo existe SOBRE una verdad ya firmada. La pantalla puede
   * equivocarse de estado o un caller nuevo puede saltársela; esta frontera
   * vuelve a leer el padre y falla cerrada antes de crear nada.
   */
  const notaRef = notaDoc(clinicId, patientId, notaId)
  const notaSnap = await getDoc(notaRef)
  if (!notaSnap.exists()) throw new Error('No existe la nota que se quiere enmendar.')
  if (notaSnap.data().estado !== 'firmada') {
    throw new Error('Una adenda sólo puede agregarse a una nota firmada.')
  }

  /** El autor lo pone la sesión, nunca el formulario. */
  const autorUid = auth.currentUser?.uid ?? ''
  if (!autorUid) throw new Error('Debes iniciar sesión para agregar una adenda.')

  /**
   * El motivo ya es obligatorio en las reglas. Se valida también aquí para que
   * el médico reciba el error antes de una escritura rechazada por Firestore.
   */
  const texto = data.texto?.trim() ?? ''
  const motivo = data.motivo?.trim() ?? ''
  if (!texto) throw new Error('La adenda necesita texto.')
  if (motivo.length < 5 || motivo.length > 500) {
    throw new Error('El motivo de la adenda debe tener entre 5 y 500 caracteres.')
  }

  const createdAt = new Date().toISOString()
  const completo = { ...data, texto, motivo, autorUid, createdAt }
  const ref = await addDoc(
    collection(notaRef, 'adendas'),
    stripUndefined(completo),
  )

  // La bitácora registra QUE hubo una enmienda y cuál fue, no repite texto clínico.
  void logAudit({
    evento: 'nota_adenda',
    clinicId,
    patientId,
    notaId,
    meta: { adendaId: ref.id },
  })

  return { ...completo, id: ref.id }
}

/** Lee las adendas de una nota, más antiguas primero (orden cronológico legal). */
export async function getAdendas(clinicId: string, patientId: string, notaId: string): Promise<Adenda[]> {
  const snap = await getDocs(
    query(
      collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'adendas'),
      orderBy('createdAt', 'asc'),
    ),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Adenda))
}

/** Lee el historial de versiones de un borrador. NOM-024 trazabilidad. */
export async function getVersionesNota(clinicId: string, patientId: string, notaId: string) {
  const snap = await getDocs(
    query(
      collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions'),
      orderBy('versionadoEn', 'desc'),
    ),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotaMedica & { versionadoEn: string }))
}

/** Última nota firmada para construir contexto de IA */
export async function getUltimasNotasResumen(
  clinicId: string,
  patientId: string,
  limit = 3,
): Promise<string> {
  // SIN orderBy en la query: combinarlo con where() exigiría un índice compuesto
  // que no existe → la consulta fallaba en silencio (card vacío y la IA sin
  // contexto de visitas previas). Se ordena en memoria (pocas notas por paciente).
  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('estado', '==', 'firmada'),
  ))
  const notas = snap.docs
    .map(d => d.data() as NotaMedica)
    .sort((a, b) => (b.fechaConsulta || '').localeCompare(a.fechaConsulta || ''))
    .slice(0, limit)
  if (notas.length === 0) return ''
  return notas
    .map(n => `[${(n.fechaConsulta || '').slice(0, 10)}] ${n.resumenEjecutivo || (n.diagnosticos ?? []).map(d => d.descripcion).join(', ')}`)
    .join(' · ')
}