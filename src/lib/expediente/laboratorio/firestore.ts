import { collection, doc, getDoc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { ResultadoValidado } from './extraccion'
import { autorizaGuardar, type VinculoSujeto } from './sujeto'
import { idIdempotente } from '@/lib/idempotencia'
import { logAudit } from '@/lib/expediente/audit-log'

/**
 * Persistencia del historial de laboratorios de un paciente.
 *
 *   clinics/{clinicId}/patients/{patientId}/laboratorios/{docId}
 *
 * Cada doc = un panel (una hoja de resultados) con su fecha.
 *
 * ── LA FRONTERA (REG-324) ────────────────────────────────────────────────────
 *
 * Esta función NO escribe por el hecho de que le pasen un `patientId`. Antes sí:
 * el `patientId` salía de la pantalla abierta y aquí se obedecía sin preguntar,
 * así que la hoja del paciente anterior se archivaba bajo el siguiente. Ahora
 * exige un VÍNCULO —`autorizaGuardar`— que diga que la evidencia se verificó
 * contra ESTE paciente y ESTE consultorio. Sin vínculo, `guardarPanelLab` lanza:
 * no hay camino silencioso.
 *
 * Esconder un botón no cierra una escritura. Por eso la comprobación vive aquí,
 * en el escritor, y no en el modal — y por eso el vínculo queda ESCRITO en el
 * documento: un panel dice a qué paciente pertenece, no sólo dónde está guardado.
 *
 * ── PRIVACIDAD ───────────────────────────────────────────────────────────────
 *
 * No se guarda ningún identificador tomado del documento. El nombre que se leyó
 * para verificar el sujeto muere en `dictaminarSujeto`; lo que se persiste es el
 * veredicto, no la persona.
 *
 * Secreto médico: mismas reglas que las notas — solo médico/admin leen y escriben.
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
  /**
   * A quién pertenece esta evidencia, dicho DENTRO del documento. Redundante con
   * la ruta a propósito: la ruta dice dónde está guardado, esto dice de quién es
   * y con qué autoridad se decidió.
   */
  pacienteId?: string
  clinicId?: string
  sujeto?: Omit<VinculoSujeto, 'clinicId' | 'patientId'>
}

function col(clinicId: string, patientId: string) {
  return collection(db, 'clinics', clinicId, 'patients', patientId, 'laboratorios')
}

/** Se lanza cuando la evidencia no está vinculada al paciente de destino. */
export class ErrorSujetoNoVinculado extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'ErrorSujetoNoVinculado'
  }
}

/**
 * Guarda un panel de laboratorio.
 *
 * @param vinculo  prueba de que la evidencia es de este paciente (obligatorio).
 * @param clave    nombre de la INTENCIÓN (`claveDeIntento()`), conservado entre
 *                 reintentos. Dos envíos de la misma revisión —doble clic, una
 *                 respuesta perdida en la red— aterrizan en el MISMO documento
 *                 en vez de duplicar el estudio y torcer la gráfica de tendencia.
 * @throws ErrorSujetoNoVinculado si el vínculo no autoriza esta escritura.
 */
export async function guardarPanelLab(
  clinicId: string, patientId: string,
  panel: Omit<PanelLaboratorio, 'id' | 'createdAt' | 'creadoPor' | 'pacienteId' | 'clinicId' | 'sujeto'>,
  vinculo: VinculoSujeto | null | undefined,
  clave: string,
): Promise<string> {
  const permiso = autorizaGuardar(vinculo, { clinicId, patientId })
  if (!permiso.ok) throw new ErrorSujetoNoVinculado(permiso.motivo)
  const v = vinculo as VinculoSujeto

  const payload = {
    ...panel,
    createdAt: new Date().toISOString(),
    creadoPor: auth.currentUser?.uid ?? '',
    pacienteId: patientId,
    clinicId,
    sujeto: { veredicto: v.veredicto, confirmadoPorMedico: v.confirmadoPorMedico, verificadoEn: v.verificadoEn },
  }
  // El paciente entra en la preimagen: una clave prestada no puede aterrizar en
  // el expediente de otro ni por accidente.
  const id = idIdempotente(clinicId, 'laboratorio', `${patientId} ${clave}`)
  const ref = doc(col(clinicId, patientId), id)
  // Si ya existe, la intención ya se cumplió: se devuelve lo que hay. Las reglas
  // prohíben `update` sobre esta colección, así que reescribir sería además un
  // rechazo del servidor.
  const previo = await getDoc(ref)
  if (previo.exists()) return ref.id
  await setDoc(ref, payload)
  return ref.id
}

export async function listarPanelesLab(clinicId: string, patientId: string): Promise<PanelLaboratorio[]> {
  const snap = await getDocs(query(col(clinicId, patientId), orderBy('fecha', 'desc')))
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<PanelLaboratorio, 'id'>) }))
    /**
     * Un panel que dice pertenecer a OTRO paciente no se pinta aquí aunque esté
     * en esta ruta. Los documentos anteriores a REG-324 no llevan `pacienteId`
     * y siguen leyéndose: la ausencia del campo no es prueba de nada — sólo
     * significa que se escribieron antes de que existiera la frontera.
     */
    .filter(p => !p.pacienteId || p.pacienteId === patientId)
}

export async function borrarPanelLab(clinicId: string, patientId: string, panelId: string): Promise<void> {
  await deleteDoc(doc(col(clinicId, patientId), panelId))
  // Un resultado asociado a una nota ya firmada podía desaparecer sin dejar
  // rastro de que existió. No se prohíbe borrarlo; se deja constancia.
  void logAudit({ evento: 'laboratorio_borrado', clinicId, patientId, meta: { panelId } })
}
