/**
 * LA TAREA QUE ABRE UN ESTUDIO SUBIDO POR EL PACIENTE — D-058.
 *
 * Misma doctrina que `derivar.ts` para un panel de laboratorio: «revisado» vive
 * en la TAREA, no en el documento del estudio. Un estudio sin tarea es un
 * estudio que nadie va a mirar, así que el portal escribe la tarea ANTES de
 * avisar por WhatsApp, y con id derivado del estudio: reintentar no abre dos.
 *
 * Va a nombre del médico TITULAR si el paciente tiene (D-057); si no, queda
 * sin dueño y el worklist la enseña como «necesita revisión» a todo el equipo.
 */
import { pesoDeUrgencia, type TareaClinica, type Prioridad } from './modelo'

export const ORIGEN_ESTUDIO_APORTADO = 'portal:estudio'

export function idDeTareaDeEstudio(estudioId: string): string {
  return `estudio__${estudioId}`
}

export interface EstudioParaTarea {
  clinicId: string
  patientId: string
  patientNombre?: string
  estudioId: string
  nombreArchivo: string
  contentType: string
  ahoraIso: string
  ownerUid?: string
  ownerNombre?: string
}

export function tareaDeUnEstudioAportado(e: EstudioParaTarea): Omit<TareaClinica, 'id'> & { pesoUrgencia: number } {
  const prioridad: Prioridad = 'alta'
  const esFoto = e.contentType.startsWith('image/')
  const t = Date.parse(e.ahoraIso)
  const tarea: Omit<TareaClinica, 'id'> & { pesoUrgencia: number } = {
    clinicId: e.clinicId,
    patientId: e.patientId,
    tipo: 'resultado_por_revisar',
    titulo: `Estudio subido por el paciente: ${e.nombreArchivo}`,
    detalle: `${esFoto ? 'Foto' : 'PDF'} aportado desde el portal. Sin revisar: ábrelo, léelo con la IA si es laboratorio y confirma, o márcalo revisado.`,
    prioridad,
    pesoUrgencia: pesoDeUrgencia(prioridad),
    estado: 'solicitada',
    creadaEn: e.ahoraIso,
    origen: ORIGEN_ESTUDIO_APORTADO,
    origenId: e.estudioId,
    ...(Number.isFinite(t) ? { venceEn: new Date(t + 2 * 86_400_000).toISOString() } : {}),
  }
  if (e.patientNombre) tarea.patientNombre = e.patientNombre
  if (e.ownerUid) { tarea.ownerUid = e.ownerUid; if (e.ownerNombre) tarea.ownerNombre = e.ownerNombre }
  return tarea
}
