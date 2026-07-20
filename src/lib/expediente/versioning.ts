/**
 * Historial de versiones de un borrador (trazabilidad pre-firma, NOM-024).
 *
 * Cada vez que `updateNota` sobrescribe un borrador, guarda ANTES una copia del
 * documento que va a pisar en:
 *   clinics/{clinicId}/patients/{patientId}/notas/{notaId}/versions/{vId}
 *
 * Es la ÚNICA vía de rescate cuando dos pestañas —o el teléfono y la
 * computadora— se pisan la misma nota. Al firmar deja de versionarse: la nota
 * firmada es inmutable.
 *
 * NOTA HISTÓRICA (para que no se repita): aquí vivía además `guardarVersion`,
 * que escribía una SEGUNDA copia completa en cada autoguardado —doblando el costo
 * a ~80 documentos por consulta de 20 min— con el estado NUEVO, pese a que su
 * comentario afirmaba guardar el anterior, y bajo el campo `timestamp` en vez de
 * `versionadoEn`. Como cada lector ordenaba por el campo que el otro no escribía,
 * Firestore excluía en silencio la mitad del historial. Se eliminó: versiona
 * `updateNota`, y solo él.
 */
import { collection, getDocs, query, orderBy, limit as fbLimit, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NotaMedica } from '@/types/expediente'

/**
 * Una versión es el documento de la nota tal como estaba, más quién y cuándo
 * provocó que quedara atrás. No lleva `snapshot` anidado: los campos de la nota
 * están al mismo nivel, que es como los escribe `updateNota`.
 */
export type NotaVersion = Omit<NotaMedica, 'id'> & {
  id?: string
  versionadoEn: string
  versionadoPor?: string | null
  versionadoEmail?: string | null
}

/** Historial de una nota, de la más reciente a la más antigua. */
export async function listarVersiones(
  clinicId: string,
  patientId: string,
  notaId: string,
  limite = 20,
): Promise<NotaVersion[]> {
  const ref = collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions')
  const q = query(ref, orderBy('versionadoEn', 'desc'), fbLimit(limite))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NotaVersion))
}

/** Una versión concreta, para restaurarla. */
export async function obtenerVersion(
  clinicId: string,
  patientId: string,
  notaId: string,
  versionId: string,
): Promise<NotaVersion | null> {
  const snap = await getDoc(
    doc(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions', versionId),
  )
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as NotaVersion
}

/**
 * Resumen legible de una versión para listarla sin abrirla: cuánto contenido
 * tenía, para que el médico distinga de un vistazo la versión "completa" de la
 * que quedó a medias. Puro y determinista → testeable.
 */
export function resumirVersion(v: Pick<NotaVersion, 'secciones' | 'diagnosticos' | 'medicamentos' | 'resumenEjecutivo'>): string {
  const partes: string[] = []
  const seccionesConTexto = (v.secciones ?? []).filter(s => s.value?.trim()).length
  if (seccionesConTexto) partes.push(`${seccionesConTexto} ${seccionesConTexto === 1 ? 'sección' : 'secciones'}`)
  const dx = v.diagnosticos?.length ?? 0
  if (dx) partes.push(`${dx} ${dx === 1 ? 'diagnóstico' : 'diagnósticos'}`)
  const meds = v.medicamentos?.length ?? 0
  if (meds) partes.push(`${meds} ${meds === 1 ? 'medicamento' : 'medicamentos'}`)
  if (!partes.length) return v.resumenEjecutivo?.trim() ? 'solo resumen' : 'vacía'
  return partes.join(' · ')
}
