import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotaMedica } from '@/types/expediente'

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
 * Busca una nota por ID sin conocer el patientId.
 * Recorre todos los pacientes de la clínica buscando la nota.
 * Útil como ruta de rescate cuando el URL llega malformado (un solo segmento).
 * No expone PII fuera del tenant — usa la misma estructura clinics/{clinicId}/patients.
 */
export async function findNotaByIdInClinic(clinicId: string, notaId: string): Promise<{ patientId: string; nota: NotaMedica } | null> {
  // Listar todos los pacientes del tenant
  const patientsSnap = await getDocs(collection(db, 'clinics', clinicId, 'patients'))
  for (const p of patientsSnap.docs) {
    const ns = await getDoc(notaDoc(clinicId, p.id, notaId))
    if (ns.exists()) {
      return { patientId: p.id, nota: { ...ns.data(), id: ns.id } as NotaMedica }
    }
  }
  return null
}

/** Firestore rechaza valores `undefined`. Los eliminamos recursivamente. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

export async function createNota(
  clinicId: string,
  patientId: string,
  data: Omit<NotaMedica, 'id'>,
): Promise<string> {
  // Strip 'id' por si llega como '' desde el caller — si se guarda en data,
  // sobreescribe el doc.id al leer con spread y rompe la navegación.
  const { id: _ignorado, ...sinId } = data as NotaMedica
  void _ignorado
  const ref = await addDoc(notasCol(clinicId, patientId), stripUndefined(sinId))
  return ref.id
}

/** Borra una nota. Solo borradores (las firmadas son inmutables por las reglas). */
export async function deleteNota(
  clinicId: string,
  patientId: string,
  notaId: string,
): Promise<void> {
  await deleteDoc(notaDoc(clinicId, patientId, notaId))
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

  // 2. Borrar todos los borradores
  for (const n of notas) {
    await deleteDoc(notaDoc(clinicId, patientId, n.id))
  }

  // 3. Borrar TODAS las citas asociadas (por pacienteId y, si se dio, por nombre+tel)
  //    Esto previene que la lógica de "huérfanos" reviva al paciente.
  const citasRef = collection(db, 'clinics', clinicId, 'appointments')
  let citasBorradas = 0

  // 3a. Por pacienteId
  try {
    const snap = await getDocs(query(citasRef, where('pacienteId', '==', patientId)))
    for (const d of snap.docs) {
      await deleteDoc(d.ref)
      citasBorradas++
    }
  } catch { /* ignore */ }

  // 3b. Coincidencia por nombre+teléfono (cubre citas con pacienteId vacío)
  if (matchInfo?.nombre || matchInfo?.telefono) {
    const norm = (s: string) => s.toLowerCase().trim()
    const normTel = (s: string) => s.replace(/\D/g, '')
    try {
      const all = await getDocs(citasRef)
      for (const d of all.docs) {
        const data = d.data() as { pacienteId?: string; pacienteNombre?: string; pacienteTelefono?: string }
        // ya borradas en 3a
        if (data.pacienteId === patientId) continue
        const nombreMatch  = matchInfo.nombre   && data.pacienteNombre   && norm(data.pacienteNombre) === norm(matchInfo.nombre)
        const telefonoMatch = matchInfo.telefono && data.pacienteTelefono && normTel(data.pacienteTelefono) === normTel(matchInfo.telefono)
        if (nombreMatch || telefonoMatch) {
          await deleteDoc(d.ref)
          citasBorradas++
        }
      }
    } catch { /* ignore */ }
  }

  // 4. Borrar el documento del paciente
  await deleteDoc(doc(db, 'clinics', clinicId, 'patients', patientId))

  return { ok: true, borradas: { notas: notas.length, citas: citasBorradas } }
}

/** Solo se permite actualizar borradores (NOM-024: las firmadas son inmutables) */
export async function updateNota(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Partial<NotaMedica>,
): Promise<void> {
  // Strip 'id' del payload — solo el doc.id es la fuente de verdad.
  const { id: _ignorado, ...sinId } = data as Partial<NotaMedica>
  void _ignorado

  // NOM-024 Art. 6.4 — versionado: antes de sobrescribir un borrador,
  // guardamos el snapshot actual como versión histórica.
  // Solo para borradores; las notas firmadas son inmutables (no llegan aquí).
  try {
    const prev = await getDoc(notaDoc(clinicId, patientId, notaId))
    if (prev.exists() && prev.data().estado !== 'firmada') {
      await addDoc(
        collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions'),
        { ...prev.data(), versionadoEn: new Date().toISOString() },
      )
    }
  } catch { /* nunca romper la operación clínica */ }

  await updateDoc(notaDoc(clinicId, patientId, notaId), stripUndefined({
    ...sinId,
    updatedAt: new Date().toISOString(),
  }))
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
