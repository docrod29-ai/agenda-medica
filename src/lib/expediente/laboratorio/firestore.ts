import { collection, doc, addDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { ResultadoValidado } from './extraccion'

/**
 * Persistencia del historial de laboratorios de un paciente.
 *
 *   clinics/{clinicId}/patients/{patientId}/laboratorios/{docId}
 *
 * Cada doc = un panel (una hoja de resultados) con su fecha. Se guarda bajo el
 * patientId; NO se guarda ningún identificador tomado del documento (el prompt lo
 * prohíbe y `validarPanel` lo descarta). Secreto médico: mismas reglas que las
 * notas — solo médico/admin leen y escriben.
 */

export interface PanelLaboratorio {
  id?: string
  /** Fecha del estudio YYYY-MM-DD. */
  fecha: string
  resultados: ResultadoValidado[]
  /** Filas que se leyeron pero no se reconocieron (se muestran como texto). */
  noReconocidas?: { estudio: string; valor: string; unidad?: string }[]
  /** Cómo entró: 'pdf' | 'foto' | 'manual'. */
  fuente: 'pdf' | 'foto' | 'manual'
  createdAt: string
  creadoPor?: string
}

function col(clinicId: string, patientId: string) {
  return collection(db, 'clinics', clinicId, 'patients', patientId, 'laboratorios')
}

export async function guardarPanelLab(
  clinicId: string, patientId: string,
  panel: Omit<PanelLaboratorio, 'id' | 'createdAt' | 'creadoPor'>,
): Promise<string> {
  const payload = {
    ...panel,
    createdAt: new Date().toISOString(),
    creadoPor: auth.currentUser?.uid ?? '',
  }
  const ref = await addDoc(col(clinicId, patientId), payload)
  return ref.id
}

export async function listarPanelesLab(clinicId: string, patientId: string): Promise<PanelLaboratorio[]> {
  const snap = await getDocs(query(col(clinicId, patientId), orderBy('fecha', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PanelLaboratorio, 'id'>) }))
}

export async function borrarPanelLab(clinicId: string, patientId: string, panelId: string): Promise<void> {
  await deleteDoc(doc(col(clinicId, patientId), panelId))
}
