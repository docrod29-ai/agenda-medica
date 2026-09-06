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
import { logAudit } from '@/lib/expediente/audit-log'

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
/**
 * Regiones agrupadas por zona anatómica: en una lista plana de 27 opciones hay
 * que leerlas todas para encontrar una; agrupadas se escoge de un vistazo.
 */
export const REGIONES_AGRUPADAS: { grupo: string; regiones: string[] }[] = [
  { grupo: 'Cabeza y cuello', regiones: ['Cara', 'Cuero cabelludo', 'Cuello'] },
  { grupo: 'Tronco', regiones: ['Tórax anterior', 'Tórax posterior', 'Abdomen', 'Espalda', 'Glúteos'] },
  /**
   * LAS ARTICULACIONES FALTABAN — Panel de Lujo MO-008.
   *
   * La lista estaba pensada para dermatología y heridas: había brazo, antebrazo,
   * muslo y pierna, y **ninguna articulación**. Un ortopedista que fotografía una
   * rodilla, un tobillo o un codo tenía que elegir «Otra» — y con eso se pierde
   * el agrupado por región, que es lo único que hace comparable una serie.
   *
   * Todas llevan LADO explícito, como las que ya estaban: en una estructura par
   * la región sin lado no identifica nada, y ésa es exactamente la clase de dato
   * que este producto no deja a medias.
   */
  { grupo: 'Extremidad superior', regiones: ['Hombro derecho', 'Hombro izquierdo', 'Brazo derecho', 'Brazo izquierdo', 'Codo derecho', 'Codo izquierdo', 'Antebrazo derecho', 'Antebrazo izquierdo', 'Muñeca derecha', 'Muñeca izquierda', 'Mano derecha', 'Mano izquierda'] },
  { grupo: 'Extremidad inferior', regiones: ['Cadera derecha', 'Cadera izquierda', 'Muslo derecho', 'Muslo izquierdo', 'Rodilla derecha', 'Rodilla izquierda', 'Pierna derecha', 'Pierna izquierda', 'Tobillo derecho', 'Tobillo izquierdo', 'Pie derecho', 'Pie izquierdo'] },
  { grupo: 'Columna', regiones: ['Columna cervical', 'Columna dorsal', 'Columna lumbar'] },
  { grupo: 'Genital y perianal', regiones: ['Región inguinal', 'Región perianal'] },
  { grupo: 'Por tipo de lesión', regiones: ['Herida quirúrgica', 'Úlcera', 'Otra'] },
]

/** Lista plana (el orden y el contenido no cambian: se derivan de los grupos). */
export const REGIONES: string[] = REGIONES_AGRUPADAS.flatMap(g => g.regiones)

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
  // Contenido del expediente que desaparece: tiene que quedar quién y cuándo.
  // Va DESPUÉS del borrado y sin `await` para no convertir la bitácora en la
  // razón de que el médico no pueda quitar una foto mal subida.
  void logAudit({ evento: 'foto_clinica_borrada', clinicId, patientId, meta: { fotoId } })
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
