/**
 * FOTOGRAFÍA CLÍNICA SERIADA — seguimiento visual del paciente en el tiempo.
 *
 * Uso clínico: dermatología (lesiones, nevos, psoriasis/atopia), heridas
 * quirúrgicas, úlceras por presión/pie diabético, quemaduras. El valor está en
 * la COMPARACIÓN entre fechas: el cambio en el tiempo es el criterio diagnóstico
 * (p. ej. evolución de un nevo) y la prueba objetiva de la respuesta al tratamiento.
 *
 * Viven en: clinics/{clinicId}/patients/{patientId}/fotos/{fotoId}
 * (mismo aislamiento multi-tenant que las notas). La imagen se sube a Storage por
 * el SERVIDOR (subirImagen) y solo se guarda la URL — nunca base64 en Firestore.
 *
 * ⚠️ Son datos personales sensibles (PHI/imagen clínica): requieren consentimiento
 *    del paciente y se tratan con el mismo cuidado que el resto del expediente.
 */
import { collection, doc, addDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface FotoClinica {
  id: string
  /** URL en Storage (proxeada same-origin). */
  url: string
  /** Fecha de la toma (ISO). */
  fecha: string
  /** Región anatómica (para agrupar y comparar la misma zona). */
  region: string
  /** Descripción/hallazgo libre. */
  descripcion?: string
  /** Nota clínica a la que quedó ligada (si se tomó durante una consulta). */
  notaId?: string
  /** Quién la tomó. */
  creadoPor?: string
}

/** Regiones anatómicas para etiquetar (comparar SIEMPRE la misma zona). */
export const REGIONES: string[] = [
  'Cara', 'Cuero cabelludo', 'Cuello', 'Tórax anterior', 'Tórax posterior', 'Abdomen',
  'Espalda', 'Glúteos', 'Hombro derecho', 'Hombro izquierdo',
  'Brazo derecho', 'Brazo izquierdo', 'Antebrazo derecho', 'Antebrazo izquierdo',
  'Mano derecha', 'Mano izquierda', 'Muslo derecho', 'Muslo izquierdo',
  'Pierna derecha', 'Pierna izquierda', 'Pie derecho', 'Pie izquierdo',
  'Región inguinal', 'Región perianal', 'Herida quirúrgica', 'Úlcera', 'Otra',
]

function fotosCol(clinicId: string, patientId: string) {
  return collection(db, 'clinics', clinicId, 'patients', patientId, 'fotos')
}

/** Guarda una foto ya subida (recibe la URL de Storage, no el base64). */
export async function crearFoto(
  clinicId: string,
  patientId: string,
  datos: Omit<FotoClinica, 'id'>,
): Promise<string> {
  const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined))
  const ref = await addDoc(fotosCol(clinicId, patientId), limpio)
  return ref.id
}

/** Todas las fotos del paciente, de la más RECIENTE a la más antigua. */
export async function getFotos(clinicId: string, patientId: string): Promise<FotoClinica[]> {
  const snap = await getDocs(query(fotosCol(clinicId, patientId), orderBy('fecha', 'desc')))
  return snap.docs.map(d => ({ ...(d.data() as Omit<FotoClinica, 'id'>), id: d.id }))
}

export async function deleteFoto(clinicId: string, patientId: string, fotoId: string): Promise<void> {
  await deleteDoc(doc(db, 'clinics', clinicId, 'patients', patientId, 'fotos', fotoId))
}

// ── Helpers PUROS (testeables, sin red) ──────────────────────────────────────

/** Agrupa por región anatómica para comparar la MISMA zona a lo largo del tiempo. */
export function agruparPorRegion(fotos: FotoClinica[]): { region: string; fotos: FotoClinica[] }[] {
  const mapa = new Map<string, FotoClinica[]>()
  for (const f of fotos) {
    const k = f.region || 'Otra'
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k)!.push(f)
  }
  return [...mapa.entries()]
    .map(([region, fs]) => ({ region, fotos: [...fs].sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
    .sort((a, b) => b.fotos[0].fecha.localeCompare(a.fotos[0].fecha))
}

/** Par para comparar: la MÁS ANTIGUA vs la MÁS RECIENTE de una región (antes/después). */
export function parAntesDespues(fotos: FotoClinica[]): { antes: FotoClinica; despues: FotoClinica } | null {
  if (fotos.length < 2) return null
  const orden = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { antes: orden[0], despues: orden[orden.length - 1] }
}

/** Días transcurridos entre dos fotos (para rotular la comparación). */
export function diasEntre(a: FotoClinica, b: FotoClinica): number {
  const ms = Math.abs(new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  return Math.round(ms / 86400000)
}
