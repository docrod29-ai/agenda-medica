import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, getDoc, query, orderBy, where, serverTimestamp,
  limit as limitarA, startAfter, documentId,
  runTransaction, Timestamp, QueryConstraint,
} from 'firebase/firestore'
import { idIdempotente } from '@/lib/idempotencia'
import { claveDeEspera } from '@/lib/whatsapp/lista-espera'
import { db } from './firebase'
import { logAudit } from '@/lib/expediente/audit-log'
import {
  Appointment, Patient, WaitlistEntry, ClinicConfig, Doctor,
  DEFAULT_CONFIG, Clinic, ClinicMember,
} from '@/types'

// ── Collection paths (all tenant-scoped) ─────────────────────

function col(clinicId: string, name: string) {
  return collection(db, 'clinics', clinicId, name)
}
function d(clinicId: string, name: string, id: string) {
  return doc(db, 'clinics', clinicId, name, id)
}

const COLLECTIONS = {
  appointments: 'appointments',
  patients: 'patients',
  waitlist: 'waitlist',
  config: 'config',
  audit: 'audit_log',
  notifications: 'notification_logs',
  doctors: 'doctors',
  botSessions: 'bot_sessions',
}

// ── Clinic CRUD (root level) ──────────────────────────────────

// El alta del consultorio se movió a POST /api/clinic/crear, donde ocurre dentro
// de UNA transacción del Admin SDK. Aquí eran cuatro escrituras sueltas con un
// "candado anti-duplicado" de leer-y-luego-escribir que no es atómico: dos
// pestañas en /setup creaban dos consultorios y la segunda pisaba la membresía de
// la primera, dejando uno huérfano —y facturable— al que ya no se podía entrar.

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const snap = await getDoc(doc(db, 'clinics', clinicId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Clinic
}

export async function getClinicMember(uid: string): Promise<ClinicMember | null> {
  const snap = await getDoc(doc(db, 'clinic_members', uid))
  if (!snap.exists()) return null
  return snap.data() as ClinicMember
}

export async function addClinicMember(
  clinicId: string,
  uid: string,
  role: ClinicMember['role']
): Promise<void> {
  await setDoc(doc(db, 'clinic_members', uid), {
    clinicId,
    role,
    createdAt: new Date().toISOString(),
  })
}

// ── Appointments ──────────────────────────────────────────────

export async function getAppointments(
  clinicId: string,
  constraints: QueryConstraint[] = []
): Promise<Appointment[]> {
  const q = query(col(clinicId, COLLECTIONS.appointments), orderBy('fechaHora', 'asc'), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAppointmentsByDate(clinicId: string, fecha: string): Promise<Appointment[]> {
  return getAppointments(clinicId, [
    where('fechaHora', '>=', fecha + ' 00:00'),
    where('fechaHora', '<=', fecha + ' 23:59'),
  ])
}

// createAppointment se eliminó: el alta de citas ahora es ATÓMICA vía POST /api/appointments
// (transacción server-side con re-chequeo de conflicto). Ver src/app/api/appointments/route.ts.

export async function updateAppointment(clinicId: string, id: string, data: Partial<Appointment>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.appointments, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteAppointment(clinicId: string, id: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.appointments, id))
}

/**
 * ── DE DÓNDE VIENE ESTE BLOQUE (A3 del Master Loop) ─────────────────────────
 *
 * La lectura acotada del directorio se escribió en el PR #356
 * (`product/scale-hotpaths-342`) y nunca llegó a esta rama. Se PORTA, no se
 * reescribe: existir ya una implementación canónica y hacer otra en paralelo es
 * justo lo que prohíbe la política del repositorio.
 *
 * Y no se pudo fusionar a ciegas: #356 es ANTERIOR a REG-323, y su
 * `updatePatient` no tiene `vistoEn`. Un merge directo habría devuelto la
 * guardia de concurrencia al estado en que el último en pulsar Guardar pisaba al
 * otro sin enterarse. Se trae la lectura acotada y se conservan intactas la
 * escritura idempotente, la bitácora del alta y `vistoEn`.
 */
// ── Patients ──────────────────────────────────────────────────

/**
 * LECTURA ACOTADA DEL DIRECTORIO DE PACIENTES (#342, hallazgo 1).
 *
 * Lo que había: `getPatients` hacía `getDocs` sobre la colección ENTERA del
 * consultorio y guardaba el resultado completo en memoria. La caché reducía la
 * FRECUENCIA de esa lectura, no su TAMAÑO: con 10 000 pacientes el arranque de
 * cada pantalla de lista seguía siendo 10 000 documentos de lectura, de tráfico
 * y de RAM en el navegador del médico — y la búsqueda, un filtro en memoria
 * sobre todo el tenant.
 *
 * Lo que hay ahora:
 *   · `listarPacientesPagina` — página con tope duro y cursor explícito. Es el
 *     contrato canónico; Consultorio #306 consume ÉSTE, no vuelve a escribirlo.
 *   · `buscarPacientes` — ventana de candidatos acotada por consultas indexadas
 *     de prefijo. Nunca baja el tenant completo para filtrarlo en memoria.
 *   · `listarPacientesCompat` / `getPatients` — superficie de compatibilidad
 *     para las ~14 pantallas que hoy piden «la lista». Recorre páginas hasta un
 *     TECHO DURO y **declara** si se quedó corta (`truncada`). Se queda corta de
 *     forma visible: la regla 4 de seguridad clínica (ausencia de dato no es
 *     dato de ausencia) también aplica a una lista recortada.
 *
 * El invariante que se prueba: las lecturas dependen del límite de página o de
 * la ventana de búsqueda, NUNCA del tamaño del consultorio.
 */

/** Tamaño de página por omisión. */
export const LIMITE_PAGINA_PACIENTES = 50
/** Techo duro de una sola página, aunque el llamador pida más. */
export const LIMITE_MAX_PAGINA_PACIENTES = 200
/** Techo duro del recorrido de compatibilidad (`getPatients`). */
export const TECHO_COMPAT_PACIENTES = 500
/** Ventana de candidatos por estrategia de búsqueda. */
export const VENTANA_BUSQUEDA_PACIENTES = 100

/**
 * Cursor de continuación. Va por VALORES (nombre + id), no por snapshot, para
 * que pueda cruzar el límite de un componente, sobrevivir a un remount y
 * viajar en la URL si hiciera falta.
 */
export interface CursorPacientes {
  nombre: string
  id: string
}

export interface PaginaPacientes {
  pacientes: Patient[]
  /** null = no hay más páginas. */
  cursor: CursorPacientes | null
  hayMas: boolean
  /** Límite efectivo aplicado (ya acotado al techo). */
  limite: number
}

export interface ListaPacientesCompat {
  pacientes: Patient[]
  /** true = se alcanzó el techo: HAY pacientes que no vienen en esta lista. */
  truncada: boolean
  techo: number
}

export type EstrategiaBusquedaPacientes = 'prefijo-nombre' | 'prefijo-telefono' | 'prefijo-email' | 'prefijo-curp'

export interface ResultadoBusquedaPacientes {
  pacientes: Patient[]
  /** true = alguna ventana se llenó: puede haber coincidencias no mostradas. */
  truncada: boolean
  /** Tamaño máximo de cada ventana de candidatos leída. */
  ventana: number
  /** Qué consultas indexadas se lanzaron (diagnóstico y pruebas). */
  estrategias: EstrategiaBusquedaPacientes[]
}

function acotar(n: number | undefined, porOmision: number, techo: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return porOmision
  return Math.min(Math.floor(n), techo)
}

/**
 * El orden es (nombre, __name__) y no sólo `nombre`: dos pacientes homónimos
 * —el caso más común en un consultorio familiar— dejarían el cursor sin
 * desempate y la página siguiente repetiría o se saltaría a uno de los dos.
 * `documentId()` es el desempate total, y Firestore lo indexa solo (no exige
 * índice compuesto).
 *
 * LO QUE ESTE ORDEN NO ALCANZA (regla 5 de seguridad clínica: se declara en el
 * módulo). Firestore **omite** de una consulta ordenada los documentos que no
 * tienen el campo del `orderBy`. Un documento de paciente SIN campo `nombre`
 * queda por tanto fuera de `listarPacientesPagina` y, con ella, de
 * `listarPacientesCompat` y `getPatients`.
 *
 * Eso no es hipotético: hay caminos de escritura que crean documentos bajo
 * `patients` sin pasar por `createPatient` y sin nombre —el respaldo se
 * restaura literal (`/api/clinic/importar`), y un `set(…, {merge:true})` de
 * contadores puede materializar un documento que sólo tiene contadores— y las
 * reglas de Firestore no exigen `nombre`. El listado no los inventa ni los
 * adivina: no los ve.
 *
 * No se arregla desde aquí. Firestore no sabe consultar «documentos a los que
 * les falta este campo», así que recuperarlos exigiría o un recorrido sin
 * orden —justo el defecto ilimitado que #342 reparó— o un relleno de datos,
 * que está fuera de esta rebanada. Se sostiene como límite CONOCIDO y probado
 * (ver el golden de #342), no como supuesto: quien busque a uno de esos
 * pacientes lo encuentra por un campo que sí tenga, vía `buscarPacientes`.
 */
function ordenCanonicoPacientes(): QueryConstraint[] {
  return [orderBy('nombre', 'asc'), orderBy(documentId(), 'asc')]
}

/**
 * UNA página de pacientes, en orden determinista, con cursor de continuación.
 * Lee como mucho `limite + 1` documentos: el extra sólo sirve para saber si hay
 * más, y no se devuelve.
 */
export async function listarPacientesPagina(
  clinicId: string,
  opts: { limite?: number; cursor?: CursorPacientes | null } = {},
): Promise<PaginaPacientes> {
  const limite = acotar(opts.limite, LIMITE_PAGINA_PACIENTES, LIMITE_MAX_PAGINA_PACIENTES)
  const restricciones: QueryConstraint[] = [...ordenCanonicoPacientes()]
  if (opts.cursor) restricciones.push(startAfter(opts.cursor.nombre, opts.cursor.id))
  restricciones.push(limitarA(limite + 1))

  const snap = await getDocs(query(col(clinicId, COLLECTIONS.patients), ...restricciones))
  const hayMas = snap.docs.length > limite
  const pagina = (hayMas ? snap.docs.slice(0, limite) : snap.docs)
    .map(doc0 => ({ id: doc0.id, ...doc0.data() } as Patient))
  const ultimo = pagina[pagina.length - 1]

  return {
    pacientes: pagina,
    cursor: hayMas && ultimo ? { nombre: String(ultimo.nombre ?? ''), id: ultimo.id } : null,
    hayMas,
    limite,
  }
}

/**
 * Último punto de código del Área de Uso Privado. Cierra el rango de prefijo por
 * arriba sin descartar ningún carácter real: los acentuados ordenan justo detrás
 * de su letra base, así que el prefijo «Jose» alcanza también a «José».
 * Se construye con `fromCharCode` y no con el carácter literal: un carácter
 * invisible en el código fuente sobrevive mal a cualquier normalización, y si
 * desapareciera el rango quedaría vacío — la búsqueda diría «no hay» en
 * silencio, que es justo el fallo que este módulo existe para no cometer.
 */
const FIN_DE_PREFIJO = String.fromCharCode(0xf8ff)

/** Prefijo indexado: [valor, valor +) — el rango que Firestore sí sabe resolver. */
function restriccionesPrefijo(campo: string, valor: string, ventana: number): QueryConstraint[] {
  return [
    orderBy(campo, 'asc'),
    where(campo, '>=', valor),
    where(campo, '<', valor + FIN_DE_PREFIJO),
    limitarA(ventana),
  ]
}

/** «juan perez» → «Juan Perez». Los nombres se capturan capitalizados. */
function tituloCase(s: string): string {
  return s.replace(/(^|\s)\S/g, m => m.toUpperCase())
}

/**
 * Búsqueda ACOTADA de pacientes.
 *
 * No existe «contiene» indexado en Firestore, así que se lanza una consulta de
 * PREFIJO por cada campo aplicable —y sólo por los aplicables, deducidos de la
 * forma de lo tecleado— con su propia ventana. El resultado es la unión
 * deduplicada de ventanas acotadas: el número de lecturas depende de la ventana
 * y de cuántas estrategias apliquen, nunca del tamaño del consultorio.
 *
 * `truncada` no es cosmético: dice que la ventana se llenó y que puede haber
 * coincidencias fuera. Un buscador que calla eso enseña «no hay» cuando lo que
 * pasa es «no miré».
 */
export async function buscarPacientes(
  clinicId: string,
  texto: string,
  opts: { ventana?: number } = {},
): Promise<ResultadoBusquedaPacientes> {
  const ventana = acotar(opts.ventana, VENTANA_BUSQUEDA_PACIENTES, LIMITE_MAX_PAGINA_PACIENTES)
  const q = texto.trim()
  if (!q) return { pacientes: [], truncada: false, ventana, estrategias: [] }

  const digitos = q.replace(/\D/g, '')
  const planes: { estrategia: EstrategiaBusquedaPacientes; campo: string; valores: string[] }[] = []

  if (/[a-záéíóúüñ]/i.test(q)) {
    planes.push({ estrategia: 'prefijo-nombre', campo: 'nombre', valores: [...new Set([q, tituloCase(q)])] })
  }
  if (digitos.length >= 3) {
    planes.push({ estrategia: 'prefijo-telefono', campo: 'telefono', valores: [...new Set([q, digitos])] })
  }
  if (q.includes('@')) {
    planes.push({ estrategia: 'prefijo-email', campo: 'email', valores: [q.toLowerCase()] })
  }
  if (/^[a-z]{4}\d{6}/i.test(q)) {
    planes.push({ estrategia: 'prefijo-curp', campo: 'curp', valores: [q.toUpperCase()] })
  }

  const encontrados = new Map<string, Patient>()
  let truncada = false

  for (const plan of planes) {
    for (const valor of plan.valores) {
      const snap = await getDocs(query(
        col(clinicId, COLLECTIONS.patients),
        ...restriccionesPrefijo(plan.campo, valor, ventana),
      ))
      if (snap.docs.length >= ventana) truncada = true
      for (const doc0 of snap.docs) {
        if (!encontrados.has(doc0.id)) encontrados.set(doc0.id, { id: doc0.id, ...doc0.data() } as Patient)
      }
    }
  }

  const pacientes = [...encontrados.values()].sort((a, b) =>
    String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es') || a.id.localeCompare(b.id))

  return { pacientes, truncada, ventana, estrategias: planes.map(p => p.estrategia) }
}

/**
 * Caché en memoria de la lista de pacientes (por clínica), con TTL corto.
 * Motivo: ~12 pantallas de lista (pacientes, CRM, citas, reactivación, corte de
 * caja, migración, consultor…) pedían la lista en cada visita. Con caché,
 * navegar entre ellas no vuelve a leer Firestore hasta que expira el TTL o hay
 * una escritura (createPatient/updatePatient invalidan). Se puede forzar
 * refresco con { force: true }. Staleness máx = TTL (aceptable para una lista);
 * las escrituras locales invalidan de inmediato.
 *
 * La caché NO acota nada por sí sola: quien acota es el techo de páginas.
 */
const TTL_PACIENTES_MS = 30_000
const _cachePacientes = new Map<string, { data: ListaPacientesCompat; ts: number }>()

/** Invalida la caché de pacientes (de una clínica o de todas). */
export function invalidarCachePacientes(clinicId?: string): void {
  if (clinicId) _cachePacientes.delete(clinicId)
  else _cachePacientes.clear()
}

/**
 * Superficie de COMPATIBILIDAD: recorre páginas hasta `techo` y declara si se
 * quedó corta. Para llamadores nuevos, `listarPacientesPagina`.
 */
export async function listarPacientesCompat(
  clinicId: string,
  opts?: { force?: boolean; techo?: number },
): Promise<ListaPacientesCompat> {
  const techo = acotar(opts?.techo, TECHO_COMPAT_PACIENTES, TECHO_COMPAT_PACIENTES)
  const hit = _cachePacientes.get(clinicId)
  if (!opts?.force && hit && hit.data.techo === techo && Date.now() - hit.ts < TTL_PACIENTES_MS) return hit.data

  const pacientes: Patient[] = []
  let cursor: CursorPacientes | null = null
  let truncada = false

  // Sin `while (true)`: el número de vueltas está acotado por el techo.
  const vueltasMax = Math.ceil(techo / LIMITE_MAX_PAGINA_PACIENTES)
  for (let vuelta = 0; vuelta < vueltasMax; vuelta++) {
    const restante = techo - pacientes.length
    if (restante <= 0) break
    const pagina: PaginaPacientes = await listarPacientesPagina(clinicId, {
      limite: Math.min(restante, LIMITE_MAX_PAGINA_PACIENTES),
      cursor,
    })
    pacientes.push(...pagina.pacientes)
    cursor = pagina.cursor
    if (!pagina.hayMas) break
    if (pacientes.length >= techo) { truncada = true; break }
  }
  if (cursor && pacientes.length >= techo) truncada = true

  const data: ListaPacientesCompat = { pacientes, truncada, techo }
  _cachePacientes.set(clinicId, { data, ts: Date.now() })
  return data
}

/**
 * Techo del RECORRIDO COMPLETO. No es el de compatibilidad: éste existe para las
 * dos operaciones donde la lista incompleta no es un inconveniente sino una
 * mentira —exportar «mis pacientes» y decidir si un CSV trae gente nueva— y por
 * eso es mucho más alto y **se paga a propósito**, con el usuario esperando.
 *
 * Sigue siendo un techo: por encima, el recorrido lo DICE y quien lo pidió
 * decide. Lo que no se admite es pasar de largo en silencio.
 */
export const TECHO_RECORRIDO_PACIENTES = 50_000

export interface RecorridoPacientes {
  pacientes: Patient[]
  /** true = se alcanzó el techo y quedaron pacientes SIN recorrer. */
  incompleto: boolean
  techo: number
}

/**
 * TODOS LOS PACIENTES DEL CONSULTORIO, PÁGINA A PÁGINA.
 *
 * ── CUÁNDO SE USA ESTO, Y CUÁNDO NO ─────────────────────────────────────────
 *
 * Casi nunca. Las pantallas de lista usan `listarPacientesPagina`, y quien busca
 * usa `buscarPacientes`; bajar el consultorio entero para pintar veinte filas es
 * el defecto que REG-341 reparó y esto **no es la puerta de atrás para
 * deshacerlo**.
 *
 * Existe para las dos operaciones donde la COMPLETITUD es el producto:
 *
 *  · **exportar** el directorio — un CSV al que le faltan pacientes y que se
 *    llama «mis pacientes» es una mentira sobre la portabilidad de los datos, y
 *    el argumento entero de esa pantalla es «tu información es tuya»;
 *  · **decidir si un CSV importado trae gente nueva** — clasificar contra un
 *    recorte marca como «nuevo» a quien ya está, y un solo clic duplica el
 *    consultorio entero. Ahí el coste de leerlo todo es incomparablemente menor
 *    que el de equivocarse.
 *
 * Las dos las lanza una persona a propósito y esperan a que termine.
 *
 * ── SIGUE ESTANDO ACOTADO ────────────────────────────────────────────────────
 *
 * No es `getDocs` sobre la colección: son páginas con cursor, así que la memoria
 * y el tiempo crecen de forma controlada y el recorrido se puede parar. Si se
 * llega al techo, `incompleto` lo dice — y quien lo llama **no puede tratar eso
 * como una lista completa**.
 */
export async function recorrerPacientes(
  clinicId: string,
  opts?: { techo?: number },
): Promise<RecorridoPacientes> {
  const techo = acotar(opts?.techo, TECHO_RECORRIDO_PACIENTES, TECHO_RECORRIDO_PACIENTES)
  const pacientes: Patient[] = []
  let cursor: CursorPacientes | null = null
  for (;;) {
    const restante = techo - pacientes.length
    if (restante <= 0) return { pacientes, incompleto: true, techo }
    // La página se recorta al presupuesto restante: un techo que se rebasa
    // «porque la última página venía llena» no es un techo.
    const pagina: PaginaPacientes = await listarPacientesPagina(clinicId, {
      limite: Math.min(restante, LIMITE_MAX_PAGINA_PACIENTES), cursor,
    })
    pacientes.push(...pagina.pacientes)
    if (!pagina.hayMas || !pagina.cursor) return { pacientes, incompleto: false, techo }
    cursor = pagina.cursor
  }
}

/**
 * Compatibilidad histórica: devuelve la lista tal cual la esperaban las
 * pantallas existentes. Ya NO es una lectura del tenant completo — está acotada
 * por `TECHO_COMPAT_PACIENTES`.
 *
 * ── NINGUNA PANTALLA DEBE LLAMAR A ESTO (REG-351) ───────────────────────────
 *
 * Un `Patient[]` pelado **no puede decir que viene recortado**, y quien lo
 * recibe no tiene forma de saberlo. Ése fue el defecto de REG-347 y el de las
 * nueve pantallas que lo heredaron: un typeahead que decía «no está» de quien sí
 * está, un importador que clasificaba como «nuevo» al consultorio entero, un
 * panel NOM-004 que afirmaba «al día» habiendo mirado 500 de N.
 *
 * Se conserva porque los goldens de REG-341 miden AQUÍ el invariante de escala
 * de la superficie de compatibilidad. Para el producto hay cuatro puertas, y
 * cada una dice lo que ésta calla:
 *
 *   · `listarPacientesPagina` — una página, con cursor;
 *   · `listarPacientesCompat` — hasta el techo, **declarando `truncada`**;
 *   · `buscarPacientes` / `candidatosDePaciente` — preguntar por alguien;
 *   · `recorrerPacientes` — el directorio entero, para exportar o importar.
 *
 * Que ninguna pantalla vuelva a llamarla lo vigila un guardián
 * (`ninguna-pantalla-recibe-una-lista-muda.test.ts`): un comentario no impide
 * nada, y esto ya se reintrodujo una vez.
 */
export async function getPatients(clinicId: string, opts?: { force?: boolean }): Promise<Patient[]> {
  return (await listarPacientesCompat(clinicId, opts)).pacientes
}

/**
 * Lee UN paciente por id (una sola lectura de documento). Para pantallas que solo
 * necesitan un paciente (nota, receta, orden, expediente, referencia): evita
 * descargar toda la colección solo para hacer .find() — más rápido y menos lecturas.
 */
export async function getPatient(clinicId: string, patientId: string): Promise<Patient | null> {
  const snap = await getDoc(d(clinicId, COLLECTIONS.patients, patientId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Patient) : null
}

export async function createPatient(clinicId: string, data: Omit<Patient, 'id'>): Promise<string> {
  // sinUndefined: Firestore RECHAZA campos undefined (p. ej. sin CURP) y tronaba el alta.
  const ref = await addDoc(col(clinicId, COLLECTIONS.patients),
    sinUndefined({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  )
  invalidarCachePacientes(clinicId)   // el nuevo paciente debe verse de inmediato
  // Bitácora: el alta de un paciente es de los eventos que la trazabilidad exige
  // y no se registraba en absoluto. No se bloquea el alta si el registro falla.
  logAudit({ evento: 'paciente_creado', clinicId, patientId: ref.id }).catch(() => {})
  return ref.id
}

/**
 * Error de una escritura sobre un paciente que habría pisado el trabajo de otro.
 * Mismo `code` que `ConflictoDeVersion` de la nota a propósito: las pantallas ya
 * saben distinguir ese código de un fallo de red, y aprender dos nombres para el
 * mismo suceso sólo produce un aviso que dice «revisa tu conexión» cuando la
 * conexión está bien.
 */
export class ConflictoDeVersionDePaciente extends Error {
  readonly code = 'conflicto-de-version'
  constructor(public readonly modificadoEn: string) {
    super('Otra sesión modificó este paciente después de que abriste el editor. No se guardó para no pisar su trabajo.')
  }
}

export async function updatePatient(
  clinicId: string,
  id: string,
  data: Partial<Patient>,
  /**
   * LA RED SECUNDARIA DE REG-323 — el `updatedAt` que el llamador vio.
   *
   * La primera red vive en `@/lib/pacientes/campos-que-se-guardan`: un campo que
   * la pantalla no enseñó no viaja, así que no puede pisar nada. Ésta cubre lo
   * que aquélla no puede: dos personas editando A LA VEZ los MISMOS campos
   * visibles. Sin comparar nada, gana el último en pulsar Guardar, y el que
   * perdió no se entera.
   *
   * Opcional a propósito, igual que `vistoEn` en `updateNota`: quien no la pase
   * se comporta como antes. La pasa el editor de `/pacientes`, que es el que
   * escribe el formulario entero; las escrituras de un solo campo desde
   * `/consulta` no la necesitan y no pagan la lectura.
   */
  vistoEn?: string,
): Promise<void> {
  const ref = d(clinicId, COLLECTIONS.patients, id)

  /**
   * UNA SOLA LECTURA, PARA DOS COSAS: la guardia de concurrencia y el `antes` de
   * la bitácora. Sólo se paga cuando hace falta — hay un `vistoEn` que comparar,
   * o esta escritura puede cambiar las alergias.
   */
  const necesitaLeer = !!vistoEn || data.alergias !== undefined
  let previo: Patient | null = null
  if (necesitaLeer) {
    // Si la lectura falla, NO se bloquea la escritura: quedarse sin guardar por
    // un hipo de red sería peor que el riesgo que esto cubre. Mismo criterio que
    // `updateNota`.
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) previo = snap.data() as Patient
    } catch { /* nunca romper la operación clínica */ }
  }

  if (vistoEn && previo) {
    const actual = String(previo.updatedAt ?? '')
    if (actual && actual !== vistoEn) throw new ConflictoDeVersionDePaciente(actual)
  }

  await updateDoc(ref, sinUndefined({ ...data, updatedAt: new Date().toISOString() }))
  invalidarCachePacientes(clinicId)   // el cambio debe reflejarse de inmediato

  /**
   * QUÉ CAMPOS SE TOCARON, NO SUS VALORES: la bitácora no es sitio para PHI.
   *
   * CON UNA EXCEPCIÓN, Y UNA SOLA: `alergias`. Es la excepción que este
   * repositorio ya hace en el input de `/consulta`, con ese mismo campo y ese
   * mismo propósito — sin el `antes`, un vaciado de alergias queda registrado
   * como «se tocó el campo alergias», que es indistinguible de haberlas escrito.
   * Eso es exactamente lo que hizo irreconstruible el dato en REG-323, y lo que
   * deja una salida silenciosa a la compuerta que impide firmar.
   *
   * No se amplía a ningún otro campo: cada valor en la bitácora es PHI que sale
   * del expediente, y sólo se paga donde compra trazabilidad de un borrado que
   * de otro modo no se ve.
   */
  const meta: Record<string, unknown> = { campos: Object.keys(data) }
  if (data.alergias !== undefined && previo) {
    const antes = previo.alergias ?? ''
    const despues = data.alergias ?? ''
    if (antes !== despues) {
      meta.campo = 'alergias'
      meta.antes = antes
      meta.despues = despues
      meta.vaciado = !despues.trim() && !!antes.trim()
    }
  }
  logAudit({ evento: 'paciente_modificado', clinicId, patientId: id, meta }).catch(() => {})
}

// ── Waitlist ──────────────────────────────────────────────────

export async function getWaitlist(clinicId: string): Promise<WaitlistEntry[]> {
  const snap = await getDocs(query(
    col(clinicId, COLLECTIONS.waitlist),
    where('estado', '==', 'activo'),
    orderBy('createdAt', 'asc')
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistEntry))
}

export async function createWaitlistEntry(clinicId: string, data: Omit<WaitlistEntry, 'id'>): Promise<string> {
  const id = idIdempotente(clinicId, 'lista-espera', claveDeEspera(data))
  const ref = d(clinicId, COLLECTIONS.waitlist, id)
  const ahora = new Date().toISOString()
  await runTransaction(db, async (tx) => {
    const previo = await tx.get(ref)
    const createdAt = previo.exists()
      ? ((previo.data() as { createdAt?: string } | undefined)?.createdAt ?? ahora)
      : ahora
    tx.set(ref, { ...data, createdAt }, { merge: true })
  })
  return id
}

export async function updateWaitlistEntry(clinicId: string, id: string, data: Partial<WaitlistEntry>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.waitlist, id), data)
}

// ── Config ────────────────────────────────────────────────────

export async function getConfig(clinicId: string): Promise<ClinicConfig> {
  const snap = await getDoc(doc(db, 'clinics', clinicId, 'config', 'main'))
  if (!snap.exists()) return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...snap.data() } as ClinicConfig
}

/**
 * Quita recursivamente las llaves con valor undefined.
 * Firestore RECHAZA undefined ("Unsupported field value") — un solo campo
 * undefined (ej. quitar el diseño de receta) hacía fallar TODO el guardado.
 */
function sinUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(v => sinUndefined(v)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = sinUndefined(v)
  }
  return out as T
}

export async function saveConfig(clinicId: string, data: ClinicConfig): Promise<void> {
  await setDoc(
    doc(db, 'clinics', clinicId, 'config', 'main'),
    sinUndefined({ ...data, updatedAt: new Date().toISOString() }),
    { merge: true }
  )
}

/**
 * Guarda SOLO algunos campos de la config (merge), sin tocar el resto.
 * Útil para persistir un cambio puntual al momento (p. ej. la firma+sello al
 * subirla) sin depender del botón global "Guardar".
 */
export async function saveConfigPartial(clinicId: string, parcial: Partial<ClinicConfig>): Promise<void> {
  await setDoc(
    doc(db, 'clinics', clinicId, 'config', 'main'),
    sinUndefined({ ...parcial, updatedAt: new Date().toISOString() }),
    { merge: true }
  )
}

// ── Doctors ───────────────────────────────────────────────────

export async function getDoctors(clinicId: string): Promise<Doctor[]> {
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.doctors), orderBy('nombre', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))
}

export async function getActiveDoctor(clinicId: string): Promise<Doctor | null> {
  const snap = await getDocs(query(col(clinicId, COLLECTIONS.doctors), where('activo', '==', true)))
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Doctor
}

export async function getDoctor(clinicId: string, id: string): Promise<Doctor | null> {
  const snap = await getDoc(d(clinicId, COLLECTIONS.doctors, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Doctor
}

export async function createDoctor(clinicId: string, data: Omit<Doctor, 'id'>): Promise<string> {
  const ref = await addDoc(col(clinicId, COLLECTIONS.doctors), {
    ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateDoctor(clinicId: string, id: string, data: Partial<Doctor>): Promise<void> {
  await updateDoc(d(clinicId, COLLECTIONS.doctors, id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDoctor(clinicId: string, id: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.doctors, id))
}

// ── Bot Sessions ──────────────────────────────────────────────

export interface BotSession {
  id: string
  telefono: string
  estado: string
  datos: Record<string, string>
  doctorId?: string
  lastMessageAt: string
  createdAt: string
}

/**
 * ID de documento DERIVADO del teléfono, en vez de uno aleatorio.
 *
 * El patrón anterior era leer-y-luego-escribir: `getBotSession` (consulta por
 * teléfono) y, si no había nada, `addDoc`. Cuando el paciente manda dos mensajes
 * seguidos —"Hola" y "quiero cita" con un segundo de diferencia— los dos webhooks
 * corren en paralelo, ambos ven que no existe sesión y ambos crean una. A partir
 * de ahí `getBotSession` devolvía `snap.docs[0]` sin `orderBy`, es decir un
 * documento u otro sin orden garantizado, y la conversación saltaba entre los dos
 * perdiendo lo ya capturado (nombre, fecha). `deleteBotSession` borraba solo uno
 * y el otro seguía contaminando.
 *
 * Con un id determinista el duplicado es imposible: las dos escrituras van al
 * mismo documento. Se elimina la consulta, la carrera y el duplicado de una vez.
 */
function idSesionBot(telefono: string): string {
  const limpio = (telefono || '').replace(/\D/g, '').slice(-15)
  return limpio || 'sin-telefono'
}

export async function getBotSession(clinicId: string, telefono: string): Promise<BotSession | null> {
  const ref = d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono))
  const snap = await getDoc(ref)
  if (snap.exists()) return { id: snap.id, ...snap.data() } as BotSession
  // Compatibilidad: sesiones creadas antes con id aleatorio. Son conversaciones
  // en curso; no se abandonan a mitad del flujo por cambiar el esquema de ids.
  const viejas = await getDocs(query(col(clinicId, COLLECTIONS.botSessions), where('telefono', '==', telefono)))
  if (viejas.empty) return null
  const docSnap = viejas.docs[0]
  return { id: docSnap.id, ...docSnap.data() } as BotSession
}

export async function upsertBotSession(clinicId: string, telefono: string, data: Partial<BotSession>): Promise<void> {
  const now = new Date().toISOString()
  // setDoc con merge sobre id determinista: sin lectura previa, sin carrera.
  await setDoc(
    d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono)),
    sinUndefined({ telefono, estado: 'inicio', datos: {}, createdAt: now, ...data, lastMessageAt: now }),
    { merge: true },
  )
}

export async function deleteBotSession(clinicId: string, telefono: string): Promise<void> {
  await deleteDoc(d(clinicId, COLLECTIONS.botSessions, idSesionBot(telefono))).catch(() => {})
  // Barre también el duplicado heredado, si quedó alguno del esquema viejo.
  const viejas = await getDocs(query(col(clinicId, COLLECTIONS.botSessions), where('telefono', '==', telefono)))
  await Promise.all(viejas.docs.map(v => deleteDoc(d(clinicId, COLLECTIONS.botSessions, v.id)).catch(() => {})))
}

// ── Audit ─────────────────────────────────────────────────────
//
// Aquí vivía `createAuditLog`, que escribía a la bitácora desde el cliente con un
// `catch {}` vacío. Se eliminó por dos razones: no tenía UN SOLO llamador en todo
// el repo —era código muerto que sugería una cobertura inexistente— y la escritura
// de bitácora ahora va por `logAudit` → /api/auditoria/registrar, donde la
// identidad sale del ID-token y la hora del servidor.
