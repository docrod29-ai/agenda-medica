// ══════════════════════════════════════════════════════════════
// Firestore — Episodios de internamiento (módulo de hospitalización).
// clinics/{clinicId}/internamientos/{id}  (nivel tenant → el CENSO es una
// sola consulta, no por-paciente). Las notas siguen en el expediente del
// paciente y se vinculan por `internamientoId`.
// ══════════════════════════════════════════════════════════════
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot, runTransaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Unidad } from '@/lib/hospital/unidades'
import { setDoc, orderBy, limit } from 'firebase/firestore'
import { fetchAutenticado } from '@/lib/auth-client'
import type {
  Internamiento, TipoEgreso, Interconsulta, Indicacion, TipoIndicacion, Administracion, RegistroSignos, RolHospital,
  SolicitudLab, ResultadoLab, Cama, EstadoCama, BedAssignment,
} from '@/types/hospital'
import { tareaDeResultado } from '@/lib/tareas-clinicas/derivar'
import { crearTareas } from '@/lib/tareas-clinicas/firestore'

function internamientosCol(clinicId: string) {
  return collection(db, 'clinics', clinicId, 'internamientos')
}
function internamientoDoc(clinicId: string, id: string) {
  return doc(db, 'clinics', clinicId, 'internamientos', id)
}

/**
 * Quita los `undefined` en PROFUNDIDAD (Firestore los rechaza, incluso anidados
 * dentro de arreglos/objetos — p. ej. una administración del MAR sin nota).
 */
function limpiar<T>(o: T): T {
  if (Array.isArray(o)) return o.map(limpiar) as unknown as T
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v !== undefined) out[k] = limpiar(v)
    }
    return out as T
  }
  return o
}

export type NuevoInternamiento = Omit<Internamiento, 'id' | 'estado' | 'createdAt' | 'updatedAt'>

/** Registra un ingreso hospitalario (episodio activo). Devuelve el id.
 *  Rechaza si el paciente YA tiene un internamiento activo (evita MAR partido). */
export async function crearInternamiento(clinicId: string, data: NuevoInternamiento): Promise<string> {
  // Ingreso vía GATEWAY: el servidor valida el rol (medico/admin), aplica el
  // guard de duplicado activo y escribe con Admin SDK. El cliente ya no escribe
  // directo (las Rules lo bloquean).
  const res = await mutar(clinicId, null, 'crear', limpiar(data as unknown as Record<string, unknown>))
  if (!res.id) throw new Error('No se pudo registrar el ingreso (sin id).')
  return res.id
}

/**
 * HISTORIA DE CAMAS DE UN EPISODIO.
 *
 * `bed_assignments` se escribía (traslado, egreso y —desde v868— ingreso) y no
 * la leía NADIE: `historialCamas` y `ocupantesDe` estaban probados y sin
 * llamador. Una historia que sólo se escribe es un costo de escritura, no un
 * dato: nadie puede responder «¿en qué camas ha estado este paciente?».
 */
export async function getAsignacionesCama(clinicId: string, iid: string): Promise<BedAssignment[]> {
  const snap = await getDocs(collection(db, 'clinics', clinicId, 'internamientos', iid, 'bed_assignments'))
  return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as BedAssignment))
}

/** CENSO: todos los internamientos ACTIVOS (ordenados por ingreso, en JS para no exigir índice). */
export async function getCenso(clinicId: string): Promise<Internamiento[]> {
  const snap = await getDocs(query(internamientosCol(clinicId), where('estado', '==', 'activo')))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

/** CENSO en VIVO: se actualiza solo cuando alguien ingresa/egresa/traslada (onSnapshot).
 *  Devuelve la función para des-suscribir. */
export function suscribirCenso(
  clinicId: string,
  cb: (censo: Internamiento[]) => void,
  /**
   * QUÉ HACER SI LA LECTURA FALLA. Sin esto, la pantalla del censo se quedaba en
   * un spinner PARA SIEMPRE: `setLoading(false)` vivía sólo dentro del callback
   * de éxito y el de error estaba vacío. Un token vencido, una regla o App Check
   * dejaban al médico mirando girar un círculo, sin mensaje y sin reintentar.
   *
   * Y en este consultorio eso importa el doble: una pantalla que no dice qué
   * pasó es indistinguible de haber perdido a todos los internados.
   */
  alFallar?: (e: unknown) => void,
): () => void {
  return onSnapshot(query(internamientosCol(clinicId), where('estado', '==', 'activo')), snap => {
    cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Internamiento)).sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1)))
  }, e => {
    console.error('[hospital] no se pudo leer el censo en vivo', e)
    alFallar?.(e)
  })
}

/** UN internamiento en VIVO: refleja indicaciones/MAR/interconsultas/traslados de otros usuarios. */
export function suscribirInternamiento(
  clinicId: string, id: string,
  cb: (inter: Internamiento | null) => void,
  alFallar?: (e: unknown) => void,
): () => void {
  return onSnapshot(internamientoDoc(clinicId, id), snap => {
    cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as Internamiento) : null)
  }, e => {
    console.error('[hospital] se perdió el vivo del internamiento', id, e)
    alFallar?.(e)
  })
}

/** Signos vitales seriados en VIVO (subcolección). */
/**
 * Suscripción a los últimos signos. También iba SIN cota: mantenía en vivo la
 * subcolección entera y, al abrirse a la vez que `getSignos`, la ficha bajaba dos
 * veces todos los registros de la estancia.
 */
export function suscribirSignos(
  clinicId: string, iid: string,
  cb: (signos: RegistroSignos[]) => void,
  tope = TOPE_SIGNOS,
  /**
   * Aquí el silencio era especialmente malo: al caerse la suscripción, los
   * signos vitales se quedan CONGELADOS en lo último que se leyó, con aspecto
   * de estar en vivo. Alguien puede tomar una decisión sobre una tensión de
   * hace media hora creyendo que es de ahora.
   */
  alFallar?: (e: unknown) => void,
): () => void {
  return onSnapshot(query(signosCol(clinicId, iid), orderBy('fecha', 'desc'), limit(tope)), snap => {
    cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as RegistroSignos)).reverse())
  }, e => {
    console.error('[hospital] se perdió el vivo de signos', iid, e)
    alFallar?.(e)
  })
}

/** Todos los internamientos (activos + egresados) — para el histórico. */
export async function getInternamientos(clinicId: string): Promise<Internamiento[]> {
  const snap = await getDocs(internamientosCol(clinicId))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

export async function getInternamiento(clinicId: string, id: string): Promise<Internamiento | null> {
  const snap = await getDoc(internamientoDoc(clinicId, id))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Internamiento) : null
}

/** Internamientos de UN paciente (para mostrarlos en su expediente). */
export async function getInternamientosDePaciente(clinicId: string, pacienteId: string): Promise<Internamiento[]> {
  const snap = await getDocs(query(internamientosCol(clinicId), where('pacienteId', '==', pacienteId)))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as Internamiento))
    .sort((a, b) => (a.fechaIngreso < b.fechaIngreso ? 1 : -1))
}

/**
 * TODAS las mutaciones del doc de internamiento pasan por el GATEWAY del servidor
 * (/api/hospital/mutar), que valida el ROL por acción (RBAC real, no de vista) y
 * escribe con Admin SDK en una transacción. Las Firestore Rules bloquean la
 * escritura directa del cliente al doc de internamiento.
 */
async function mutar(clinicId: string, internamientoId: string | null, accion: string, payload: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetchAutenticado('/api/hospital/mutar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, internamientoId, accion, payload }),
  })
  const data = await res.json().catch(() => ({ ok: false }))
  if (!data.ok) throw new Error(data.error || 'No se pudo completar la acción')
  return data
}

/** Egresa un episodio (lo saca del censo activo). */
export async function egresarInternamiento(clinicId: string, id: string, egreso: { tipoEgreso: TipoEgreso; resumenEgreso?: string; fechaEgreso?: string }): Promise<void> {
  await mutar(clinicId, id, 'egresar', { tipoEgreso: egreso.tipoEgreso, resumenEgreso: egreso.resumenEgreso })
}

// ── F2 · Interconsultas ──
export async function agregarInterconsulta(clinicId: string, iid: string, ic: Omit<Interconsulta, 'id' | 'estado' | 'fecha'>): Promise<string> {
  await mutar(clinicId, iid, 'interconsulta_agregar', {
    especialidad: ic.especialidad, motivo: ic.motivo, solicitanteNombre: ic.solicitanteNombre,
    solicitanteId: ic.solicitanteId, medicoSolicitadoId: ic.medicoSolicitadoId, medicoSolicitadoNombre: ic.medicoSolicitadoNombre,
  })
  return ''
}
export async function responderInterconsulta(clinicId: string, iid: string, icId: string, resp: { respuesta?: string; respondidaPor?: string; notaId?: string }): Promise<void> {
  await mutar(clinicId, iid, 'interconsulta_responder', { icId, respuesta: resp.respuesta, respondidaPor: resp.respondidaPor })
}
/** Editar interconsulta — solo mientras esté 'solicitada' (el servidor bloquea si ya respondió). */
export async function editarInterconsulta(clinicId: string, iid: string, icId: string, ic: { especialidad: string; motivo: string; medicoSolicitadoId?: string; medicoSolicitadoNombre?: string }): Promise<void> {
  await mutar(clinicId, iid, 'interconsulta_editar', { icId, especialidad: ic.especialidad, motivo: ic.motivo, medicoSolicitadoId: ic.medicoSolicitadoId, medicoSolicitadoNombre: ic.medicoSolicitadoNombre })
}
/** Borrar interconsulta — solo mientras esté 'solicitada'. */
export async function borrarInterconsulta(clinicId: string, iid: string, icId: string): Promise<void> {
  await mutar(clinicId, iid, 'interconsulta_borrar', { icId })
}

// ── F3 · Indicaciones médicas + MAR ──
export async function agregarIndicacion(clinicId: string, iid: string, ind: Omit<Indicacion, 'id' | 'activa' | 'fecha' | 'administraciones'>): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_agregar', { tipo: ind.tipo, descripcion: ind.descripcion, frecuencia: ind.frecuencia, creadaPor: ind.creadaPor })
}
export async function suspenderIndicacion(clinicId: string, iid: string, indId: string, activa: boolean): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_suspender', { indId, activa })
}
/** Editar indicación — solo mientras NO se haya administrado (el servidor lo verifica). */
export async function editarIndicacion(clinicId: string, iid: string, indId: string, ind: { tipo: TipoIndicacion; descripcion: string; frecuencia: string }): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_editar', { indId, tipo: ind.tipo, descripcion: ind.descripcion, frecuencia: ind.frecuencia })
}
/** Borrar indicación — solo mientras NO se haya administrado. */
export async function borrarIndicacion(clinicId: string, iid: string, indId: string): Promise<void> {
  await mutar(clinicId, iid, 'indicacion_borrar', { indId })
}
export async function registrarAdministracion(clinicId: string, iid: string, indId: string, adm: Administracion): Promise<void> {
  await mutar(clinicId, iid, 'administrar', { indId, adm })
}
export async function verificarIndicacionFarmacia(clinicId: string, iid: string, indId: string, por: string): Promise<void> {
  await mutar(clinicId, iid, 'verificar_farmacia', { indId, por })
}

/** Guarda los medicamentos que el paciente tomaba en casa (para conciliar). */
export async function guardarMedicamentosCasa(clinicId: string, iid: string, meds: string[], baseConciliadoAl?: string | null): Promise<void> {
  // `baseConciliadoAl` = el sello que se vio al abrir la conciliación; el servidor
  // lo usa para rechazar si alguien más guardó en medio (ver 'conciliar' en mutar).
  await mutar(clinicId, iid, 'conciliar', { meds, baseConciliadoAl: baseConciliadoAl ?? null })
}

/** Traslado de servicio/cama con registro en el historial de movimientos. */
export async function trasladarInternamiento(clinicId: string, iid: string, dst: { servicio: string; cama: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'trasladar', { servicio: dst.servicio, cama: dst.cama, por: dst.por })
}

/** Cambio de médico tratante (responsable) con registro en el historial. */
export async function cambiarTratante(clinicId: string, iid: string, t: { medicoTratanteId: string; medicoTratanteNombre: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'cambiar_tratante', { medicoTratanteId: t.medicoTratanteId, medicoTratanteNombre: t.medicoTratanteNombre, por: t.por })
}

// ── F3 · Signos vitales seriados (subcolección, pueden ser muchos) ──
function signosCol(clinicId: string, iid: string) {
  return collection(db, 'clinics', clinicId, 'internamientos', iid, 'signos')
}
export async function agregarSignos(clinicId: string, iid: string, s: Omit<RegistroSignos, 'id'>): Promise<void> {
  await addDoc(signosCol(clinicId, iid), limpiar(s as object))
}
/**
 * Últimos N registros de signos. ANTES SE BAJABA LA SUBCOLECCIÓN COMPLETA.
 *
 * Es la misma raíz que resultó ser la causa real de la lentitud en la agenda: una
 * consulta sin `limit` sobre una colección que crece toda la estancia. Un paciente
 * de UCI con signos horarios durante 20 días son ~480 documentos, y esta función se
 * llamaba después de CADA acción de la ficha — cada administración, cada nota, cada
 * interconsulta.
 *
 * Ni la gráfica ni el NEWS2 necesitan más que los últimos: se ordena descendente en
 * Firestore, se corta, y se invierte en memoria para que la gráfica los reciba
 * ascendentes como antes.
 */
const TOPE_SIGNOS = 200

export async function getSignos(clinicId: string, iid: string, tope = TOPE_SIGNOS): Promise<RegistroSignos[]> {
  const snap = await getDocs(query(signosCol(clinicId, iid), orderBy('fecha', 'desc'), limit(tope)))
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as RegistroSignos))
    .reverse()   // ascendente para la gráfica
}
/**
 * Corrige un registro de signos ANEXANDO otro que apunta al erróneo.
 *
 * DECISIÓN DEL MÉDICO DUEÑO (29-jul-2026, enmienda a §A3 del documento de
 * arquitectura): un signo vital se puede corregir SIEMPRE, sin ventana de
 * tiempo, pero conservando el historial. Se implementa sin `update`: el
 * registro original nunca se toca y la corrección es un documento nuevo con
 * `corrigeA`. Así "editable siempre" (lo que ve la enfermera) y "nada se
 * sobrescribe" (lo que exige el expediente) son la misma cosa.
 *
 * Sustituye al borrado: `borrarSignos` ofrecía un bote de basura que
 * `firestore.rules` rechaza con `allow delete: if false`, así que el único
 * camino que la UI le daba a la enfermera para arreglar un dedazo fallaba
 * SIEMPRE con "No se pudo borrar".
 *
 * `proyectarSignos` (src/lib/hospital/eventos.ts) es quien resuelve la cadena
 * para pintar la tabla y para decidir qué serie entra a un cálculo clínico.
 */
export async function corregirSignos(
  clinicId: string,
  iid: string,
  idOriginal: string,
  s: Omit<RegistroSignos, 'id' | 'corrigeA'>,
): Promise<void> {
  if (!idOriginal) throw new Error('corregirSignos requiere el id del registro que se corrige')
  await addDoc(signosCol(clinicId, iid), limpiar({ ...s, corrigeA: idOriginal } as object))
}

// ── F3/V3 · Rol hospitalario por usuario (persistido, sigue al usuario entre dispositivos) ──
export async function getRolUsuario(clinicId: string, uid: string): Promise<RolHospital | null> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid))
  return snap.exists() ? ((snap.data().rol as RolHospital) ?? null) : null
}
export async function setRolUsuario(clinicId: string, uid: string, rol: RolHospital): Promise<void> {
  await setDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid), { rol, updatedAt: new Date().toISOString() }, { merge: true })
}

/** WhatsApp personal para alertas hospitalarias (al médico tratante en persona). */
export async function getTelefonoAlertas(clinicId: string, uid: string): Promise<string> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid))
  return snap.exists() ? String((snap.data().telefono as string) ?? '') : ''
}
export async function setTelefonoAlertas(clinicId: string, uid: string, telefono: string): Promise<void> {
  await setDoc(doc(db, 'clinics', clinicId, 'hospital_roles', uid), { telefono: telefono.trim(), updatedAt: new Date().toISOString() }, { merge: true })
}

// ── F4 · Laboratorio (solicitud → resultado) ──
function labCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'laboratorio') }

export async function crearSolicitudLab(clinicId: string, data: Omit<SolicitudLab, 'id' | 'estado' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(labCol(clinicId), limpiar({ ...data, estado: 'solicitada', createdAt: now, updatedAt: now }))
  return ref.id
}
export async function getSolicitudesLabDeEpisodio(clinicId: string, iid: string): Promise<SolicitudLab[]> {
  const snap = await getDocs(query(labCol(clinicId), where('internamientoId', '==', iid)))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudLab)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}
/** Solicitudes pendientes de TODA la clínica (bandeja del laboratorio). */
export async function getBandejaLab(clinicId: string): Promise<SolicitudLab[]> {
  const snap = await getDocs(query(labCol(clinicId), where('estado', 'in', ['solicitada', 'en_proceso'])))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudLab)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}
/** Cancela (borra) una solicitud de laboratorio — SOLO mientras esté 'solicitada'
 *  (una vez en proceso o con resultado es registro clínico y no se elimina). */
export async function borrarSolicitudLab(clinicId: string, ordenId: string): Promise<void> {
  const ref = doc(db, 'clinics', clinicId, 'laboratorio', ordenId)
  const snap = await getDoc(ref)
  if (snap.exists() && snap.data().estado !== 'solicitada') {
    throw new Error('La orden ya está en proceso o tiene resultado; no se cancela')
  }
  await deleteDoc(ref)
}
/**
 * Carga resultados en una orden CONSERVANDO los anteriores.
 *
 * Antes hacía un `updateDoc` que reemplazaba el arreglo `resultados`: una segunda
 * carga borraba la primera sin dejar rastro — pérdida de dato clínico y de
 * trazabilidad (NOM-004). Ahora, en una transacción (por si dos dispositivos
 * cargan a la vez), lo que ya había se empuja a `historialResultados` antes de
 * escribir la nueva versión. Nada se pierde; `resultados` sigue siendo la última.
 */
/**
 * ── EL BUCLE DE RESULTADOS TENÍA FUGA DEL 100 % (REG-252) ───────────────────
 *
 * `tareaDeResultado()` existía, estaba probada y **no la llamaba nadie en
 * producción**: cero referencias fuera de su propio archivo de pruebas. Ningún
 * resultado de laboratorio generaba jamás una tarea de revisión.
 *
 * Había una alerta para los valores críticos, sí — pero **una alerta no cierra
 * un bucle**. Se lee, se cierra, y nadie vuelve a saber si alguien actuó. El
 * charter lo dice con estas palabras: «NexusMED debe CERRAR el trabajo, no sólo
 * mostrar alertas».
 *
 * ── POR QUÉ SE CONECTA AQUÍ Y NO EN LAS PANTALLAS ───────────────────────────
 *
 * Porque éste es el cuello de botella: los dos caminos por los que hoy entra un
 * resultado —la carga manual y la importación FHIR— pasan por esta función. Si
 * la tarea se creara en las pantallas, el tercer camino que alguien añada
 * nacería con la misma fuga. Es la lección de las veintiuna veces que en este
 * repositorio algo estaba «escrito, probado y sin conectar».
 *
 * ── SI LA TAREA NO SE PUEDE CREAR, NO SE CALLA ──────────────────────────────
 *
 * El resultado ya está guardado y eso no se toca: perderlo sería peor. Pero
 * devolver `void` haría que un fallo al crear la tarea fuera **invisible**, que
 * es exactamente el defecto que se está reparando. Se devuelve qué pasó y quien
 * llama decide qué decir.
 */
export interface ResultadoGuardado {
  /** Cuántas tareas de revisión quedaron creadas. */
  tareasCreadas: number
  /** Cuántas se esperaban. Si no coinciden, algo se perdió y hay que decirlo. */
  tareasEsperadas: number
}

export async function cargarResultadosLab(
  clinicId: string, ordenId: string, resultados: ResultadoLab[], por: string,
): Promise<ResultadoGuardado> {
  const ref = doc(db, 'clinics', clinicId, 'laboratorio', ordenId)
  const ahora = new Date().toISOString()
  let solicitud: Partial<SolicitudLab> = {}
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data() ?? {}
    solicitud = data as Partial<SolicitudLab>
    const previos = (data.resultados as ResultadoLab[] | undefined) ?? []
    const historial = (data.historialResultados as unknown[] | undefined) ?? []
    // Solo se archiva si ya había una carga real (no re-guardar un arreglo vacío).
    const nuevoHistorial = previos.length > 0
      ? [...historial, { resultados: previos, procesadaPor: data.procesadaPor ?? '—', fechaResultado: data.fechaResultado ?? data.updatedAt ?? ahora }]
      : historial
    tx.update(ref, limpiar({
      resultados, estado: 'resultado', procesadaPor: por,
      fechaResultado: ahora, updatedAt: ahora,
      historialResultados: nuevoHistorial,
    }))
  })

  /**
   * UNA tarea por estudio, no una por carga: el médico revisa resultados, no
   * sobres. Y el `critico` viaja tal cual lo trae el resultado — aquí no se
   * decide qué es crítico, eso es criterio clínico y vive en `lab-criticos.ts`.
   */
  const pacienteId = String(solicitud.pacienteId ?? '')
  const aCrear = pacienteId
    ? resultados.filter(r => r?.estudio).map(r => tareaDeResultado({
      clinicId,
      patientId: pacienteId,
      patientNombre: solicitud.pacienteNombre,
      estudio: String(r.estudio),
      critico: !!r.critico,
      ahoraMs: Date.parse(ahora),
    }))
    : []

  const tareasCreadas = aCrear.length ? await crearTareas(clinicId, aCrear) : 0
  return { tareasCreadas, tareasEsperadas: aCrear.length }
}

// ── F5 · Alertas hospitalarias (lab crítico, NEWS2, interconsulta/resultado) ──
export interface AlertaHospital {
  id?: string
  internamientoId: string
  pacienteNombre: string
  tipo: 'lab_critico' | 'news2' | 'interconsulta' | 'resultado'
  titulo: string
  detalle: string
  destinatarioUid?: string
  destinatarioNombre?: string
  leida: boolean
  fecha: string
  whatsappEnviado?: boolean
}
function alertasCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'hospital_alertas') }
export async function crearAlerta(clinicId: string, a: Omit<AlertaHospital, 'id' | 'leida' | 'fecha'>): Promise<string> {
  const ref = await addDoc(alertasCol(clinicId), limpiar({ ...a, leida: false, fecha: new Date().toISOString() }))
  return ref.id
}
export async function getAlertas(clinicId: string, soloNoLeidas = false): Promise<AlertaHospital[]> {
  const snap = await getDocs(query(alertasCol(clinicId), orderBy('fecha', 'desc')))
  const arr = snap.docs.map(d => ({ ...d.data(), id: d.id } as AlertaHospital))
  return soloNoLeidas ? arr.filter(x => !x.leida) : arr
}
export async function marcarAlertaLeida(clinicId: string, id: string): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'hospital_alertas', id), { leida: true })
}

// ── Catálogo de camas (inventario + ocupación) ──
function camasCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'camas') }
export async function crearCama(clinicId: string, c: { servicio: string; etiqueta: string; tipo?: string }): Promise<void> {
  await addDoc(camasCol(clinicId), limpiar({ ...c, clinicId, estado: 'libre' as EstadoCama, createdAt: new Date().toISOString() }))
}
export async function getCamas(clinicId: string): Promise<Cama[]> {
  const snap = await getDocs(camasCol(clinicId))
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Cama)).sort((a, b) => (a.servicio + a.etiqueta).localeCompare(b.servicio + b.etiqueta))
}
export async function actualizarCamaEstado(clinicId: string, id: string, estado: EstadoCama): Promise<void> {
  await updateDoc(doc(db, 'clinics', clinicId, 'camas', id), { estado })
}
export async function borrarCama(clinicId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'clinics', clinicId, 'camas', id))
}

// ── F6 · Enfermería (balance hídrico, escalas, entrega de turno SBAR) — vía gateway ──
export async function agregarBalance(clinicId: string, iid: string, b: { ingresos: number; egresos: number; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'balance', { ingresos: b.ingresos, egresos: b.egresos, por: b.por })
}
export async function agregarEscala(clinicId: string, iid: string, e: { tipo: 'braden' | 'morse'; score: number; riesgo: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'escala', { tipo: e.tipo, score: e.score, riesgo: e.riesgo, por: e.por })
}
export async function agregarSbar(clinicId: string, iid: string, s: { texto: string; por?: string }): Promise<void> {
  await mutar(clinicId, iid, 'sbar', { texto: s.texto, por: s.por })
}

// ══════════════════════════════════════════════════════════════
// UNIDADES — el nombre lo pone el hospital, el tipo lo entiende el software.
// Ver src/lib/hospital/unidades.ts para la regla y su golden.
// ══════════════════════════════════════════════════════════════
function unidadesCol(clinicId: string) { return collection(db, 'clinics', clinicId, 'unidades') }

export async function getUnidades(clinicId: string): Promise<Unidad[]> {
  const snap = await getDocs(unidadesCol(clinicId))
  return snap.docs.map(d => ({ ...(d.data() as Omit<Unidad, 'id'>), id: d.id }))
}

/** Suscripción en vivo: la configuración de unidades cambia el censo de UCI. */
export function suscribirUnidades(clinicId: string, cb: (u: Unidad[]) => void): () => void {
  return onSnapshot(unidadesCol(clinicId),
    snap => cb(snap.docs.map(d => ({ ...(d.data() as Omit<Unidad, 'id'>), id: d.id }))),
    () => { /* permisos/red: se conserva lo último leído */ })
}

export async function guardarUnidad(clinicId: string, u: Omit<Unidad, 'id'> & { id?: string }): Promise<string> {
  const { id, ...datos } = u
  if (id) { await setDoc(doc(unidadesCol(clinicId), id), datos, { merge: true }); return id }
  const ref = await addDoc(unidadesCol(clinicId), datos)
  return ref.id
}

export async function borrarUnidad(clinicId: string, id: string): Promise<void> {
  await deleteDoc(doc(unidadesCol(clinicId), id))
}
