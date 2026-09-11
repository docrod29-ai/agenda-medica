/**
 * LO QUE EL MÉDICO HACE CON EL ESTUDIO QUE SUBIÓ EL PACIENTE — D-058.
 *
 * Tres cosas y nada más: listarlos (las reglas sólo se lo dejan al médico DEL
 * paciente), saber si ya se revisaron (vive en la tarea, no en el estudio) y
 * marcarlos revisados cerrando esa tarea con quién y qué decidió. Abrirlos y
 * leerlos con la IA pasan por el servidor: el bucket no abre lectura al
 * navegador.
 */
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { fetchAutenticado } from '@/lib/auth-client'
import { tareaPorId, cambiarEstado } from '@/lib/tareas-clinicas/firestore'
import { idDeTareaDeEstudio } from '@/lib/tareas-clinicas/de-un-estudio'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'
import type { EstudioAportado, EstadoDeRevision } from '@/lib/portal/estudios-aportados'

export interface EstudioConRevision extends EstudioAportado {
  id: string
  revision: EstadoDeRevision
  tarea: TareaClinica | null
}

export async function listarEstudiosAportados(clinicId: string, patientId: string): Promise<EstudioConRevision[]> {
  // Cota: 12 al mes por paciente (D-058); 200 cubre más de un año sin bajar la colección entera.
  const snap = await getDocs(query(collection(db, 'clinics', clinicId, 'patients', patientId, 'estudios_aportados'), limit(200)))
  const base = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<EstudioAportado, 'id'>) }))
    .filter(e => !e.retiradoEn)
    .sort((a, b) => String(b.subidoEn).localeCompare(String(a.subidoEn)))
  return Promise.all(base.map(async e => {
    const tarea = await tareaPorId(clinicId, idDeTareaDeEstudio(e.id)).catch(() => null)
    const revision: EstadoDeRevision = tarea && (tarea.estado === 'completada' || tarea.estado === 'cerrada') ? 'revisado' : 'sin_revisar'
    return { ...e, revision, tarea }
  }))
}

/** URL firmada de quince minutos, emitida por el servidor al médico del paciente. */
export async function urlDelEstudio(clinicId: string, patientId: string, id: string): Promise<{ url: string; contentType: string; nombre: string }> {
  const res = await fetchAutenticado('/api/expediente/estudio-aportado', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinicId, patientId, id }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'No se pudo abrir el estudio')
  return { url: data.url, contentType: data.contentType, nombre: data.nombre }
}

/** Marcar revisado = cerrar la tarea con quién y qué decidió. Sin tarea no hay qué cerrar: se dice. */
export async function marcarEstudioRevisado(clinicId: string, e: EstudioConRevision, quien: string, decision = 'Estudio revisado'): Promise<{ ok: boolean; motivo: string }> {
  if (!e.tarea) return { ok: false, motivo: 'Este estudio no tiene tarea de revisión: revísalo desde Pendientes.' }
  /**
   * El modelo no deja saltar de `solicitada` a `completada` (nadie la había
   * tomado): revisar es tomarla Y terminarla, dos transiciones, en ese orden.
   * Quien la toma se hace dueño — que es la verdad: la revisó él.
   */
  let tarea: TareaClinica = e.tarea
  if (tarea.estado === 'solicitada') {
    const tomada = await cambiarEstado(clinicId, tarea, 'aceptada')
    if (!tomada.ok) return tomada
    tarea = { ...tarea, estado: 'aceptada' }
  }
  return cambiarEstado(clinicId, tarea, 'completada', { cierre: { decision, quien } })
}
