import { collection, doc, getDoc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { ResultadoValidado } from './extraccion'
import { autorizaGuardar, type VinculoSujeto } from './sujeto'
import { idIdempotente } from '@/lib/idempotencia'
import { logAudit } from '@/lib/expediente/audit-log'
import { tareaDeResultado } from '@/lib/tareas-clinicas/derivar'
import { crearTareas } from '@/lib/tareas-clinicas/firestore'

/**
 * Persistencia del historial de laboratorios de un paciente.
 *
 *   clinics/{clinicId}/patients/{patientId}/laboratorios/{docId}
 *
 * Cada doc = un panel (una hoja de resultados) con su fecha.
 *
 * ── LA FRONTERA (REG-323) ────────────────────────────────────────────────────
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
 * ── EL BUCLE DE RESULTADOS TENÍA FUGA TAMBIÉN EN CONSULTORIO (REG-337) ───────
 *
 * REG-252 descubrió que `tareaDeResultado()` estaba escrita, probada y sin
 * llamar, y la conectó **en el camino hospitalario**. Su propio comentario dice
 * que se conecta en el cuello de botella «por los dos caminos por los que hoy
 * entra un resultado» — y eso era cierto del módulo de hospital, no del
 * producto. El camino AMBULATORIO —el que es prioridad comercial— quedó fuera:
 * una hoja de laboratorio se archivaba en el expediente y no generaba pendiente,
 * ni dueño, ni fecha de vencimiento, ni requisito de revisión.
 *
 * Es decir: **que el resultado existiera contaba como que alguien lo había
 * leído.** Es el mismo defecto que REG-252 existe para impedir, en el otro
 * camino de entrada.
 *
 * ── POR QUÉ AQUÍ Y NO EN LA PANTALLA ────────────────────────────────────────
 *
 * Misma razón que REG-252: éste es el escritor. Si la tarea naciera en
 * `PanelLaboratorios.tsx`, el siguiente camino de entrada —una importación, un
 * webhook del laboratorio— nacería con la fuga otra vez.
 *
 * ── UNA TAREA POR HOJA, NO POR ANALITO ──────────────────────────────────────
 *
 * El camino hospitalario crea una tarea por estudio porque allí una orden lleva
 * pocos estudios. Aquí un panel trae veinte analitos, y veinte tareas por una
 * hoja convertirían el worklist en ruido — que es justo el fallo contra el que
 * avisa `POR_QUE_NO_SE_INFIERE` en `derivar.ts`. El médico revisa una HOJA.
 * La prioridad sube a crítica si CUALQUIER analito lo es, y el detalle **nombra
 * cuáles**, que es lo que decide la urgencia.
 *
 * Lo crítico NO se decide aquí: viaja tal cual lo marcó `evaluarCriticoLab`,
 * el mismo motor determinista y auditado que usa el hospital.
 *
 * ── DÓNDE VIVE «REVISADO» ───────────────────────────────────────────────────
 *
 * En la tarea, y en ningún otro sitio. Añadir un `revisado` al panel crearía una
 * segunda fuente de verdad del mismo hecho, que es exactamente lo que prohíbe el
 * invariante de arquitectura. `completada` ≠ `cerrada` ya distingue «el estudio
 * está» de «alguien lo miró».
 *
 * ── SI LA TAREA NO SE PUEDE CREAR, NO SE CALLA ──────────────────────────────
 *
 * El panel ya está guardado y eso no se toca. Pero devolver sólo el id haría
 * invisible un fallo al crear la tarea, que es el defecto que se repara. Se
 * devuelve qué pasó y quien llama decide qué decir — igual que REG-252.
 */
export interface PanelGuardado {
  /** El id del panel. */
  id: string
  /** Cuántas tareas de revisión quedaron creadas. */
  tareasCreadas: number
  /** Cuántas se esperaban. Si no coinciden, se perdió un pendiente y hay que decirlo. */
  tareasEsperadas: number
}

/**
 * Guarda un panel de laboratorio y abre su pendiente de revisión.
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
): Promise<PanelGuardado> {
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
  // El reintento no vuelve a abrir el pendiente: la intención ya se cumplió y
  // la tarea, si nació, sigue viva con el estado que le haya puesto el médico.
  if (previo.exists()) return { id: ref.id, tareasCreadas: 0, tareasEsperadas: 0 }
  await setDoc(ref, payload)

  /**
   * El nombre del paciente NO viaja a la tarea: este módulo no conserva
   * identificadores leídos de la hoja (ver PRIVACIDAD, arriba), y el worklist ya
   * resuelve el nombre por `patientId`. Se prefiere una tarea sin nombre a
   * reintroducir aquí un dato que se descartó a propósito.
   */
  const criticos = panel.resultados.filter(r => r?.critico)
  const aCrear = panel.resultados.length
    ? [tareaDeResultado({
      clinicId,
      patientId,
      estudio: `Laboratorio del ${panel.fecha}`,
      critico: criticos.length > 0,
      detalle: criticos.length
        ? `Valor crítico reportado: ${criticos.map(r => r.etiqueta).join(', ')}.`
        : undefined,
      ahoraMs: Date.now(),
      ownerUid: auth.currentUser?.uid || undefined,
    })]
    : []

  const tareasCreadas = aCrear.length ? await crearTareas(clinicId, aCrear) : 0
  return { id: ref.id, tareasCreadas, tareasEsperadas: aCrear.length }
}

export async function listarPanelesLab(clinicId: string, patientId: string): Promise<PanelLaboratorio[]> {
  const snap = await getDocs(query(col(clinicId, patientId), orderBy('fecha', 'desc')))
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<PanelLaboratorio, 'id'>) }))
    /**
     * Un panel que dice pertenecer a OTRO paciente no se pinta aquí aunque esté
     * en esta ruta. Los documentos anteriores a REG-323 no llevan `pacienteId`
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
