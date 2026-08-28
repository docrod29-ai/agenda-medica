import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, where, writeBatch, runTransaction, startAfter,
  limit as limitarA, documentId,
  type DocumentReference, type QueryConstraint,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { NotaMedica, Adenda } from '@/types/expediente'
// `stripUndefined` se mudó a un módulo puro (sin SDK) para poder simular el viaje
// a Firestore en los tests del sello de integridad. Ver serializacion.ts.
import { stripUndefined } from './serializacion'
import { logAudit } from './audit-log'
import { idIdempotente } from '@/lib/idempotencia'

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

/**
 * ── LA HISTORIA DE UN PACIENTE NO CABE EN UNA LECTURA (P1-12) ────────────────
 *
 * Lo que había: `getNotas` hacía `getDocs` sobre la subcolección ENTERA de notas
 * del paciente. Y una nota de este producto no es una fila: lleva dentro
 * `transcripcionMotor` y `transcripcionCruda` —el dictado completo de la
 * consulta— más `dialogoDiarizado` y el bloque `extraction`. El propio
 * `updateNota` documenta que una sola nota se acerca al tope de 1 MB por
 * documento de Firestore.
 *
 * Cinco pantallas pedían esa historia completa, y ninguna la necesitaba entera:
 * la de hospitalización se la bajaba para quedarse con las notas de UN episodio
 * (`.filter(...)` en memoria), la de referencia para prellenar UNA carta con UNA
 * nota, la de retención para leer UNA fecha —y multiplicado por hasta 500
 * pacientes—, y la salvaguarda NOM-004 de borrado para saber si existe alguna
 * firmada. Sólo el expediente y la consulta tienen un motivo real para mirar
 * atrás, y tampoco necesitan hacerlo de una sentada.
 *
 * Lo que hay ahora, mismo contrato que el directorio de pacientes (#342):
 *   · `listarNotasPagina` — página con tope duro, orden determinista y cursor
 *     por VALORES. Es el contrato canónico.
 *   · `listarNotasCompat` — superficie de compatibilidad: recorre páginas hasta
 *     un TECHO DURO y **declara** si se quedó corta (`truncada`).
 *   · `getNotas` — lo mismo, sin la declaración, para los llamadores que aún no
 *     la miran y para las pruebas. Quien pinte algo derivado de la historia usa
 *     `listarNotasCompat` y enseña `truncada`: la regla 4 de seguridad clínica
 *     —ausencia de dato no es dato de ausencia— vale también para una historia
 *     recortada.
 *   · `listarNotasDeInternamiento` — las notas de UN episodio, filtradas en el
 *     servidor.
 *   · `contarNotasFirmadas` — cuántas notas firmadas hay, con techo, sin
 *     bajarse los dictados para contarlas.
 *
 * El invariante que se prueba: las lecturas dependen del límite de página o del
 * techo, NUNCA del número de notas del paciente.
 */

/** Tamaño de página por omisión. Bajo a propósito: una nota pesa. */
export const LIMITE_PAGINA_NOTAS = 25
/** Techo duro de una sola página, aunque el llamador pida más. */
export const LIMITE_MAX_PAGINA_NOTAS = 100
/** Techo duro del recorrido de compatibilidad (`getNotas`). */
export const TECHO_COMPAT_NOTAS = 300
/** Techo duro de las notas de un mismo episodio de hospitalización. */
export const TECHO_NOTAS_INTERNAMIENTO = 200
/** Techo duro del conteo de notas firmadas. Por encima se dice «al menos». */
export const TECHO_CONTEO_FIRMADAS = 50

/**
 * Cursor de continuación. Va por VALORES (fecha + id), no por snapshot, para que
 * cruce el límite de un componente, sobreviva a un remount y pueda viajar en la
 * URL si hiciera falta.
 */
export interface CursorNotas {
  fechaConsulta: string
  id: string
}

export interface PaginaNotas {
  notas: NotaMedica[]
  /** null = no hay más páginas. */
  cursor: CursorNotas | null
  hayMas: boolean
  /** Límite efectivo aplicado (ya acotado al techo). */
  limite: number
}

export interface HistorialNotas {
  notas: NotaMedica[]
  /** true = se alcanzó el techo: HAY notas de este paciente que no vienen aquí. */
  truncada: boolean
  techo: number
}

function acotarNotas(n: number | undefined, porOmision: number, techo: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return porOmision
  return Math.min(Math.floor(n), techo)
}

/**
 * El orden es (fechaConsulta desc, __name__ desc) y no sólo `fechaConsulta`.
 *
 * Dos notas del MISMO día son lo normal, no el caso raro: un ingreso y su
 * evolución, una consulta y la nota de procedimiento. Sin desempate el cursor
 * queda indefinido entre ellas y la página siguiente **repite o se salta** una
 * nota — que en un expediente es perder o duplicar un acto médico. `documentId()`
 * es el desempate total y Firestore lo indexa solo: la dirección del `__name__`
 * acompaña a la del campo, así que esto NO exige índice compuesto (este
 * repositorio no despliega ninguno).
 *
 * LO QUE ESTE ORDEN NO ALCANZA (regla 5 de seguridad clínica: se declara en el
 * módulo). Firestore **omite** de una consulta ordenada los documentos que no
 * tienen el campo del `orderBy`. Una nota SIN `fechaConsulta` queda fuera del
 * listado. Esto **no lo introduce esta rebanada**: el `getNotas` anterior ya
 * ordenaba por `fechaConsulta` y ya las omitía. Queda escrito para que nadie lo
 * descubra otra vez, y por eso la salvaguarda NOM-004 de borrado (abajo)
 * dejó de apoyarse en este listado: para decir «no hay ninguna firmada» hace
 * falta una consulta que no ordene por un campo que puede faltar.
 */
function ordenCanonicoNotas(): QueryConstraint[] {
  return [orderBy('fechaConsulta', 'desc'), orderBy(documentId(), 'desc')]
}

/**
 * UNA página de notas, de la más reciente a la más antigua, con cursor de
 * continuación. Lee como mucho `limite + 1` documentos: el extra sólo sirve para
 * saber si hay más, y no se devuelve.
 */
export async function listarNotasPagina(
  clinicId: string,
  patientId: string,
  opts: { limite?: number; cursor?: CursorNotas | null } = {},
): Promise<PaginaNotas> {
  const limite = acotarNotas(opts.limite, LIMITE_PAGINA_NOTAS, LIMITE_MAX_PAGINA_NOTAS)
  const restricciones: QueryConstraint[] = [...ordenCanonicoNotas()]
  if (opts.cursor) restricciones.push(startAfter(opts.cursor.fechaConsulta, opts.cursor.id))
  restricciones.push(limitarA(limite + 1))

  const snap = await getDocs(query(notasCol(clinicId, patientId), ...restricciones))
  const hayMas = snap.docs.length > limite
  const pagina = (hayMas ? snap.docs.slice(0, limite) : snap.docs)
    .map(d => normNota(d.data(), d.id))
  const ultima = pagina[pagina.length - 1]

  return {
    notas: pagina,
    cursor: hayMas && ultima ? { fechaConsulta: String(ultima.fechaConsulta ?? ''), id: ultima.id } : null,
    hayMas,
    limite,
  }
}

/**
 * La historia hasta un TECHO DURO, con la verdad de si se quedó corta.
 *
 * Es la superficie que deben usar las pantallas que derivan algo de la historia
 * (medicación vigente, problemas activos, exportación): reciben el recorte y
 * pueden decirlo. `getNotas` es esta misma llamada tirando `truncada` a la
 * basura, y por eso no debería crecer en llamadores nuevos.
 */
export async function listarNotasCompat(
  clinicId: string,
  patientId: string,
  opts?: { techo?: number },
): Promise<HistorialNotas> {
  const techo = acotarNotas(opts?.techo, TECHO_COMPAT_NOTAS, TECHO_COMPAT_NOTAS)
  const notas: NotaMedica[] = []
  let cursor: CursorNotas | null = null
  let truncada = false

  const vueltasMax = Math.ceil(techo / LIMITE_MAX_PAGINA_NOTAS)
  for (let vuelta = 0; vuelta < vueltasMax; vuelta++) {
    const restante = techo - notas.length
    if (restante <= 0) { truncada = true; break }
    const pagina = await listarNotasPagina(clinicId, patientId, {
      limite: Math.min(restante, LIMITE_MAX_PAGINA_NOTAS),
      cursor,
    })
    notas.push(...pagina.notas)
    cursor = pagina.cursor
    if (!pagina.hayMas) break
    if (notas.length >= techo) { truncada = true; break }
  }

  return { notas, truncada, techo }
}

/**
 * SUPERFICIE DE COMPATIBILIDAD. Devuelve como mucho `TECHO_COMPAT_NOTAS` notas
 * y **no dice** si se quedó corta. Quien necesite saberlo —cualquiera que pinte
 * algo derivado de la historia— llama a `listarNotasCompat` y mira `truncada`.
 *
 * NO se usa para decidir si un paciente tiene notas firmadas: eso es
 * `contarNotasFirmadas`, que no depende de un `orderBy` que puede omitir
 * documentos.
 */
export async function getNotas(clinicId: string, patientId: string): Promise<NotaMedica[]> {
  return (await listarNotasCompat(clinicId, patientId)).notas
}

/**
 * Las notas de UN episodio de hospitalización, filtradas en el SERVIDOR.
 *
 * La pantalla del internamiento se bajaba la historia completa del paciente para
 * quedarse, en memoria, con las de este episodio. Un paciente con veinte años de
 * consultorio pagaba veinte años de dictados para pintar una estancia de cinco
 * días.
 *
 * Sin `orderBy` en la consulta: combinarlo con el `where` exigiría un índice
 * compuesto, y este repositorio no despliega ninguno (misma razón que
 * `getUltimasNotasResumen`). Se ordena en memoria sobre una lista ya acotada.
 * Consecuencia declarada: si un episodio superara el techo, las que se quedan
 * fuera las elige Firestore por id de documento, no por fecha — por eso
 * `truncada` viaja hasta la pantalla en vez de quedarse aquí.
 */
export async function listarNotasDeInternamiento(
  clinicId: string,
  patientId: string,
  internamientoId: string,
  opts?: { techo?: number },
): Promise<HistorialNotas> {
  const techo = acotarNotas(opts?.techo, TECHO_NOTAS_INTERNAMIENTO, TECHO_NOTAS_INTERNAMIENTO)
  if (!clinicId || !patientId || !internamientoId) return { notas: [], truncada: false, techo }

  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('internamientoId', '==', internamientoId),
    limitarA(techo + 1),
  ))
  const truncada = snap.docs.length > techo
  const notas = (truncada ? snap.docs.slice(0, techo) : snap.docs)
    .map(d => normNota(d.data(), d.id))
    .sort((a, b) => {
      const fa = a.fechaConsulta ?? ''
      const fb = b.fechaConsulta ?? ''
      if (fa !== fb) return fb.localeCompare(fa)
      return b.id.localeCompare(a.id)
    })

  return { notas, truncada, techo }
}

/**
 * CUÁNTAS NOTAS FIRMADAS TIENE ESTE PACIENTE — con techo y sin bajarse la
 * historia entera para contarlas.
 *
 * Se consulta por `estado` y **sin `orderBy`** a propósito. La salvaguarda
 * NOM-004 del borrado se apoyaba en `getNotas`, que ordena por `fechaConsulta`:
 * una nota firmada a la que le faltara ese campo quedaba fuera del listado y la
 * salvaguarda no la veía — el registro legal se podía borrar. Aquí no hay
 * `orderBy`, así que ninguna nota firmada se escapa por falta de un campo.
 *
 * `alMenos` = se llegó al techo: hay ese número **o más**. Nunca se devuelve un
 * conteo redondeado hacia abajo haciéndolo pasar por exacto.
 */
export async function contarNotasFirmadas(
  clinicId: string,
  patientId: string,
  opts?: { techo?: number },
): Promise<{ conteo: number; alMenos: boolean; techo: number }> {
  const techo = acotarNotas(opts?.techo, TECHO_CONTEO_FIRMADAS, TECHO_CONTEO_FIRMADAS)
  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('estado', '==', 'firmada'),
    limitarA(techo + 1),
  ))
  const alMenos = snap.docs.length > techo
  return { conteo: alMenos ? techo : snap.docs.length, alMenos, techo }
}

/** Techo duro del barrido de ids para la cascada de borrado. */
export const TECHO_CASCADA_NOTAS = 2000

/**
 * TODOS los ids de notas del paciente, para la cascada de borrado.
 *
 * Ordena por `documentId()` y no por `fechaConsulta` a propósito: el borrado en
 * cascada tiene que alcanzar **todas** las notas, y una consulta ordenada por un
 * campo omite los documentos que no lo tienen. Con `fechaConsulta` una nota sin
 * fecha sobrevivía al borrado del paciente y quedaba huérfana bajo una ruta cuyo
 * documento padre ya no existe. Todo documento tiene id.
 *
 * `truncada` = se llegó al techo. El llamador NO debe borrar a medias: media
 * cascada deja un expediente inconsistente y sin nadie que lo sepa.
 */
export async function listarIdsDeNotas(
  clinicId: string,
  patientId: string,
  opts?: { techo?: number },
): Promise<{ ids: string[]; truncada: boolean; techo: number }> {
  const techo = acotarNotas(opts?.techo, TECHO_CASCADA_NOTAS, TECHO_CASCADA_NOTAS)
  const ids: string[] = []
  let ultimo: string | null = null

  const vueltasMax = Math.ceil(techo / LIMITE_MAX_PAGINA_NOTAS) + 1
  for (let vuelta = 0; vuelta < vueltasMax; vuelta++) {
    const restante = techo - ids.length
    if (restante <= 0) return { ids, truncada: true, techo }
    const tam = Math.min(restante, LIMITE_MAX_PAGINA_NOTAS)
    const restricciones: QueryConstraint[] = [orderBy(documentId(), 'asc')]
    if (ultimo !== null) restricciones.push(startAfter(ultimo))
    restricciones.push(limitarA(tam + 1))

    const snap = await getDocs(query(notasCol(clinicId, patientId), ...restricciones))
    const hayMas = snap.docs.length > tam
    const lote = hayMas ? snap.docs.slice(0, tam) : snap.docs
    for (const d of lote) ids.push(d.id)
    if (!hayMas) return { ids, truncada: false, techo }
    ultimo = lote[lote.length - 1]?.id ?? null
    if (ultimo === null) return { ids, truncada: false, techo }
  }
  return { ids, truncada: true, techo }
}

export async function getNota(clinicId: string, patientId: string, notaId: string): Promise<NotaMedica | null> {
  const snap = await getDoc(notaDoc(clinicId, patientId, notaId))
  // IMPORTANTE: id va DESPUÉS del spread para que sobreescriba cualquier 'id'
  // erróneo que se haya guardado en data (bug legacy, líneas 183 y 189 de consulta/page.tsx).
  return snap.exists() ? normNota(snap.data(), snap.id) : null
}

/**
 * ── EL RESCATE COSTABA N+1 LECTURAS EN SERIE (A3 · portado del PR #356) ──────
 *
 * Lo que había: `findNotaByIdInClinic` bajaba TODOS los pacientes del
 * consultorio y luego pedía el documento de la nota uno por uno, en serie, hasta
 * dar con ella. Una URL malformada —el caso que esta ruta existe para rescatar—
 * costaba N+1 lecturas y N viajes de ida y vuelta encadenados. Con 50 000
 * pacientes son 50 001 lecturas y la pantalla de rescate es peor que el enlace
 * roto que venía a arreglar.
 *
 * Lo que hay ahora, en dos escalones y ninguno proporcional al tamaño del
 * consultorio: una consulta indexada acotada a 2 —el 2 no sobra: permite
 * DETECTAR ambigüedad en vez de quedarse con la primera que aparezca— y, para
 * las notas anteriores a este contrato, un sondeo de compatibilidad con techo.
 * Por encima del techo NO se adivina: se devuelve `no-resoluble`, que no es lo
 * mismo que `no-encontrada`.
 *
 * AISLAMIENTO: la pertenencia al consultorio se prueba contra la RUTA del
 * documento, no contra un campo que alguien pudo escribir mal.
 */
/** Cuántos pacientes se sondean como mucho en el camino de compatibilidad. */
export const TECHO_SONDEO_NOTA = 50

export type ResultadoNotaEnClinica =
  | { estado: 'encontrada'; patientId: string; notaId: string; nota: NotaMedica }
  | { estado: 'no-encontrada' }
  | { estado: 'ambigua' }
  | { estado: 'no-resoluble'; pacientesSondeados: number }

/**
 * Deriva el paciente de la RUTA de la nota y, de paso, prueba que la nota vive
 * dentro de este consultorio. Devuelve null si la ruta no es exactamente
 * `clinics/{clinicId}/patients/{patientId}/notas/{notaId}`.
 */
function pacienteDeLaRutaDeNota(ruta: string, clinicId: string): string | null {
  const s = ruta.split('/')
  if (s.length !== 6) return null
  if (s[0] !== 'clinics' || s[1] !== clinicId || s[2] !== 'patients' || s[4] !== 'notas') return null
  return s[3] || null
}

export async function buscarNotaEnClinica(clinicId: string, notaId: string): Promise<ResultadoNotaEnClinica> {
  if (!clinicId || !notaId) return { estado: 'no-encontrada' }

  // ── 1. Consulta indexada, acotada a 2 ────────────────────────────────────
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'notas'),
      where('clinicId', '==', clinicId),
      where('metadata.id', '==', notaId),
      limitarA(2),
    ))
    let propias = 0
    let primera: { patientId: string; id: string; data: Record<string, unknown> } | null = null
    for (const d0 of snap.docs) {
      const patientId = pacienteDeLaRutaDeNota(d0.ref.path, clinicId)
      if (!patientId) continue
      propias++
      if (!primera) primera = { patientId, id: d0.id, data: d0.data() as Record<string, unknown> }
    }

    if (propias > 1) return { estado: 'ambigua' }
    if (primera) {
      return {
        estado: 'encontrada',
        patientId: primera.patientId,
        notaId: primera.id,
        nota: normNota(primera.data, primera.id),
      }
    }
    // Hubo candidatas pero NINGUNA de este consultorio: se cierra aquí. No se
    // sondea, porque lo único que se sabe es que ese id vive en otro tenant.
    if (snap.docs.length > 0) return { estado: 'no-encontrada' }
  } catch {
    /**
     * Índice compuesto o regla de `collectionGroup` ausentes → el SDK lanza.
     * No es motivo para tumbar el rescate ni para volver al recorrido total:
     * se cae al sondeo acotado de abajo, que sigue siendo O(techo).
     */
  }

  // ── 2. Sondeo de compatibilidad, acotado ─────────────────────────────────
  const pacientesSnap = await getDocs(query(
    collection(db, 'clinics', clinicId, 'patients'),
    orderBy(documentId(), 'asc'),
    limitarA(TECHO_SONDEO_NOTA + 1),
  ))
  const hayMasPacientes = pacientesSnap.docs.length > TECHO_SONDEO_NOTA
  const candidatos = pacientesSnap.docs.slice(0, TECHO_SONDEO_NOTA)

  // En paralelo: el bucle en serie encadenaba N viajes de ida y vuelta.
  const sondeos = await Promise.all(candidatos.map(async p => ({
    patientId: p.id,
    snap: await getDoc(notaDoc(clinicId, p.id, notaId)),
  })))
  const aciertos = sondeos.filter(s => s.snap.exists())

  if (aciertos.length > 1) return { estado: 'ambigua' }
  if (aciertos.length === 1) {
    const { patientId, snap } = aciertos[0]
    return { estado: 'encontrada', patientId, notaId: snap.id, nota: normNota(snap.data() as Record<string, unknown>, snap.id) }
  }
  return hayMasPacientes
    ? { estado: 'no-resoluble', pacientesSondeados: candidatos.length }
    : { estado: 'no-encontrada' }
}

/**
 * Compatibilidad: la forma anterior (`{ patientId, nota } | null`) para los
 * llamadores que no distinguen los cuatro estados. `no-resoluble` devuelve null
 * igual que `no-encontrada` — por eso quien le habla a un humano debería usar
 * `buscarNotaEnClinica` y decir la verdad: no es lo mismo «no existe» que «no
 * la busqué entera».
 */
export async function findNotaByIdInClinic(clinicId: string, notaId: string): Promise<{ patientId: string; nota: NotaMedica } | null> {
  const r = await buscarNotaEnClinica(clinicId, notaId)
  return r.estado === 'encontrada' ? { patientId: r.patientId, nota: r.nota } : null
}

export interface OpcionesCrearNota {
  /**
   * El nombre del ENCUENTRO que se está abriendo (`claveDeIntento()` o el id de
   * la cita de hoy). Ver `lib/idempotencia.ts`.
   *
   * Con clave, la primera nota del encuentro tiene un id DETERMINISTA: dos
   * intentos de «Iniciar consulta» —dos toques, dos pestañas, o un reintento
   * tras un timeout aparente— convergen al mismo borrador en vez de abrir dos
   * expedientes de la misma visita.
   */
  claveEncuentro?: string
}

export async function createNota(
  clinicId: string,
  patientId: string,
  data: Omit<NotaMedica, 'id'>,
  opciones: OpcionesCrearNota = {},
): Promise<string> {
  // Strip 'id' por si llega como '' desde el caller — si se guarda en data,
  // sobreescribe el doc.id al leer con spread y rompe la navegación.
  const { id: _ignorado, ...sinId } = data as NotaMedica
  void _ignorado
  const payload = stripUndefined(sinId)
  // Guardián de 1 MB TAMBIÉN al crear (antes solo estaba en updateNota): una nota
  // ya grande en su PRIMERA escritura —dictado largo con transcripción cruda +
  // diálogo diarizado + entidades— fallaba con el error crudo de Firestore. Aquí
  // se avisa con un mensaje claro; el respaldo local conserva el contenido.
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
  if (bytes > 950_000) {
    throw Object.assign(
      new Error(`La nota pesa ${(bytes / 1024).toFixed(0)} KB y Firestore admite hasta 1 MB por documento. Suele deberse a una transcripción muy larga. No se perdió nada: hay respaldo local.`),
      { code: 'nota-demasiado-grande' },
    )
  }
  /**
   * ═══ GOLDEN PATH 9 — UN ENCUENTRO, UNA NOTA ═══
   *
   * `addDoc` inventa un id nuevo en CADA llamada, así que la identidad de la
   * nota nacía de la escritura y no del encuentro. El caso que rompía no es
   * exótico: el autoguardado crea el borrador, la respuesta se pierde por red,
   * el reintento encuentra `notaIdRef` todavía en null y crea OTRA nota. Dos
   * documentos de la misma consulta, los dos a medias, y el médico sin saber
   * cuál es el bueno.
   *
   * Con `claveEncuentro` el id se deriva del encuentro y del consultorio, así
   * que el reintento apunta al mismo documento.
   *
   * PERO SÓLO CONVERGE SOBRE UN BORRADOR VIVO. Si en ese id ya hay una nota
   * FIRMADA, se cae a un id nuevo: cuando la clave es la cita de hoy y el
   * paciente vuelve el mismo día por otra cosa, converger devolvería la nota
   * firmada de la mañana — y la pantalla intentaría escribir sobre un documento
   * inmutable (REG-017), dejando al médico sin poder abrir la segunda consulta.
   * La idempotencia no puede forzar un estado inválido para salirse con la suya.
   */
  if (opciones.claveEncuentro) {
    const id = idIdempotente(clinicId, 'nota', opciones.claveEncuentro)
    const ref = notaDoc(clinicId, patientId, id)
    /**
     * El candado es la TRANSACCIÓN, no un `getDoc` previo: entre leer y escribir
     * cabe la otra pestaña. Aquí, dos aperturas simultáneas del mismo encuentro
     * compiten y sólo una escribe; la otra reintenta, ve el documento y devuelve
     * su id sin pisar una línea.
     */
    const yaFirmada = await runTransaction(db, async (tx) => {
      const dentro = await tx.get(ref)
      if (!dentro.exists()) {
        tx.set(ref, payload)
        return false
      }
      return dentro.data()?.estado === 'firmada'
    })
    if (!yaFirmada) return id
    // Firmada: ese encuentro ya se cerró y es inmutable. La consulta nueva es un
    // documento nuevo — se cae al `addDoc` de abajo.
  }

  const ref = await addDoc(notasCol(clinicId, patientId), payload)
  return ref.id
}

/** Borra una nota. Solo borradores (las firmadas son inmutables por las reglas). */
export async function deleteNota(
  clinicId: string,
  patientId: string,
  notaId: string,
): Promise<void> {
  await deleteDoc(notaDoc(clinicId, patientId, notaId))
  /**
   * BITÁCORA DEL BORRADO (trazabilidad NOM-024).
   *
   * El evento `nota_borrada` existía en el catálogo y en la lista blanca del
   * servidor, y ningún sitio lo emitía. Borrar destruye el documento: sin este
   * asiento no queda NADA — ni que la nota existió, ni quién la quitó.
   *
   * Va aquí y no en las pantallas porque hay dos caminos que borran (descartar
   * la consulta y eliminar el borrador desde el expediente) y ninguno de los dos
   * lo hacía. Poniéndolo en la función, los dos quedan cubiertos y los futuros
   * también.
   */
  void logAudit({ evento: 'nota_borrada', clinicId, patientId, notaId })
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
  /**
   * 1. Verificar notas firmadas (NOM-004 — bloqueo legal).
   *
   * P1-12: esto se apoyaba en `getNotas`, que bajaba la historia COMPLETA —con
   * los dictados dentro— sólo para contar cuántas estaban firmadas. Y peor: al
   * ordenar por `fechaConsulta`, Firestore omite las notas que no tienen ese
   * campo, así que una nota FIRMADA sin fecha no llegaba hasta aquí y el
   * expediente legal quedaba borrable. `contarNotasFirmadas` consulta por
   * `estado`, sin `orderBy`, y con techo.
   *
   * Si la lectura falla, la excepción sube y NO se borra nada: no poder
   * comprobarlo no es haber comprobado que no hay ninguna.
   */
  const firmadas = await contarNotasFirmadas(clinicId, patientId)
  if (firmadas.conteo > 0) {
    const cuantas = firmadas.alMenos ? `al menos ${firmadas.conteo}` : `${firmadas.conteo}`
    return {
      ok: false,
      motivo: `Tiene ${cuantas} nota(s) firmada(s). Los registros clínicos firmados no pueden eliminarse (NOM-004).`,
    }
  }

  /**
   * Los ids de las notas que se van a borrar. A estas alturas ya se sabe que
   * NINGUNA está firmada; lo que queda son borradores. Se piden por id y no por
   * fecha para que ninguna se quede huérfana bajo un paciente ya borrado.
   */
  const idsNotas = await listarIdsDeNotas(clinicId, patientId)
  if (idsNotas.truncada) {
    return {
      ok: false,
      motivo: `Este paciente tiene más de ${idsNotas.techo} notas en borrador y el borrado se haría a medias. No se eliminó nada.`,
    }
  }

  // Se ARMA todo primero (solo lecturas) y se borra en UN batch atómico al final:
  // si algo falla, Firestore no aplica NADA → nunca queda un expediente a medias
  // (paciente borrado con citas huérfanas, o notas borradas con paciente presente).
  const citasRef = collection(db, 'clinics', clinicId, 'appointments')
  const refsCitas: DocumentReference[] = []
  const vistas = new Set<string>()

  // Citas por pacienteId
  try {
    const snap = await getDocs(query(citasRef, where('pacienteId', '==', patientId)))
    for (const d of snap.docs) { if (!vistas.has(d.id)) { vistas.add(d.id); refsCitas.push(d.ref) } }
  } catch { /* ignore */ }

  // Citas por nombre/teléfono (cubre citas con pacienteId vacío). Requiere leer la
  // colección porque el match es normalizado (mayúsculas/formato de tel) y Firestore
  // no puede filtrar por eso en la query.
  if (matchInfo?.nombre || matchInfo?.telefono) {
    const norm = (s: string) => s.toLowerCase().trim()
    const normTel = (s: string) => s.replace(/\D/g, '')
    try {
      const all = await getDocs(citasRef)
      for (const d of all.docs) {
        if (vistas.has(d.id)) continue
        const data = d.data() as { pacienteNombre?: string; pacienteTelefono?: string }
        const nombreMatch   = matchInfo.nombre   && data.pacienteNombre   && norm(data.pacienteNombre) === norm(matchInfo.nombre)
        const telefonoMatch = matchInfo.telefono && data.pacienteTelefono && normTel(data.pacienteTelefono) === normTel(matchInfo.telefono)
        if (nombreMatch || telefonoMatch) { vistas.add(d.id); refsCitas.push(d.ref) }
      }
    } catch { /* ignore */ }
  }

  // Commit atómico en lotes de 450 (tope de Firestore = 500 ops por batch).
  const todo = [
    ...idsNotas.ids.map(id => notaDoc(clinicId, patientId, id)),
    ...refsCitas,
    doc(db, 'clinics', clinicId, 'patients', patientId),  // el paciente al final
  ]
  try {
    for (let i = 0; i < todo.length; i += 450) {
      const batch = writeBatch(db)
      for (const ref of todo.slice(i, i + 450)) batch.delete(ref)
      await batch.commit()
    }
  } catch (e) {
    return { ok: false, motivo: `No se pudo completar el borrado: ${e instanceof Error ? e.message : 'error'}. No se eliminó nada parcial.` }
  }

  return { ok: true, borradas: { notas: idsNotas.ids.length, citas: refsCitas.length } }
}

/** Solo se permite actualizar borradores (NOM-024: las firmadas son inmutables) */
/** Error de una escritura que habría pisado el trabajo de otro. */
export class ConflictoDeVersion extends Error {
  readonly code = 'conflicto-de-version'
  constructor(public readonly modificadaEn: string) {
    super('Otra sesión modificó esta nota después de que la abriste. No se guardó para no pisar su trabajo.')
  }
}

export async function updateNota(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Partial<NotaMedica>,
  /**
   * GUARDIA DE CONCURRENCIA — la marca de modificación que el llamador vio la
   * última vez.
   *
   * `updateNota` no comparaba NADA antes de escribir. Con la caché
   * multi-pestaña activa, dos pestañas abiertas sobre la misma nota autoguardan
   * cada 30 s el estado COMPLETO de cada una: la que se quedó atrás pisa a la
   * que está trabajando, y van alternando. Gana el último tick.
   *
   * El caso real no es rebuscado: una pestaña olvidada abierta desde la mañana
   * y otra donde se dicta ahora. El médico ve su nota mutilada y —como el
   * historial de versiones se escribe pero no se puede leer desde ninguna
   * pantalla— no tiene ningún botón para recuperar lo que había.
   *
   * Opcional a propósito: quien no la pase se comporta como antes. Los
   * autoguardados de la consulta SÍ la pasan.
   */
  vistoEn?: string,
): Promise<void> {
  // Strip 'id' del payload — solo el doc.id es la fuente de verdad.
  const { id: _ignorado, ...sinId } = data as Partial<NotaMedica>
  void _ignorado

  // NOM-024 Art. 6.4 — versionado: antes de sobrescribir un borrador,
  // guardamos el snapshot actual como versión histórica.
  // Solo para borradores; las notas firmadas son inmutables (no llegan aquí).
  //
  // La lectura sirve además para la guardia de concurrencia: se hace una sola
  // vez y se aprovecha para las dos cosas.
  let prevLeida: import('firebase/firestore').DocumentSnapshot | null = null
  try {
    prevLeida = await getDoc(notaDoc(clinicId, patientId, notaId))
    const prev = prevLeida
    if (prev.exists() && prev.data().estado !== 'firmada') {
      await addDoc(
        collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'versions'),
        {
          ...prev.data(),
          versionadoEn: new Date().toISOString(),
          // Quién provocó que esta versión quedara atrás. Sin esto, el historial
          // dice QUÉ había pero no ante quién responder.
          versionadoPor: auth.currentUser?.uid ?? null,
          versionadoEmail: auth.currentUser?.email ?? null,
        },
      )
    }
  } catch { /* nunca romper la operación clínica */ }

  /**
   * ── EL DOCUMENTO PUEDE NO EXISTIR, Y ESO NO ES UN PROBLEMA DE PERMISOS ─────
   *
   * Encontrado el 4-ago-2026 con el Dr. en pantalla: «La nota NO se está
   * guardando en el servidor (el servidor rechazó el permiso)» y «Error al
   * firmar», las dos a la vez, con la consulta enfrente.
   *
   * La pantalla tenía un `notaId` —de un respaldo local restaurado, o de una
   * nota que se descartó— y actualizaba a ciegas. Cuando el documento ya no
   * está, Firestore **no** contesta «no existe»: la regla de update intenta leer
   * `resource.data.estado` de un `resource` nulo, revienta, y el fallo se
   * devuelve como **PERMISSION_DENIED**.
   *
   * De ahí el diagnóstico falso. El médico —y yo— nos fuimos a mirar reglas,
   * roles y sesión, y estaban bien: rol admin, clínica activa, pase libre, token
   * vivo. El documento simplemente no estaba.
   *
   * Lo que lo vuelve evitable es que **esta función ya lo sabía**: acaba de leer
   * el documento arriba para versionarlo, y `prev.exists()` decía que no. Tenía
   * el dato en la mano y escribía igual.
   *
   * Se distingue con cuidado «la lectura dijo que NO existe» de «la lectura
   * falló»: sólo lo primero es concluyente. Si hubo un hipo de red, `prevLeida`
   * es nulo y se sigue como siempre — quedarse sin guardar por eso sería peor.
   */
  if (prevLeida && !prevLeida.exists()) {
    throw Object.assign(
      new Error('La nota que esta pantalla tenía abierta ya no existe en el servidor. No se perdió nada: se vuelve a crear con lo que hay en pantalla.'),
      { code: 'nota-inexistente' },
    )
  }

  /**
   * LA GUARDIA. Va DESPUÉS del versionado a propósito: si hay conflicto, el
   * estado que se estaba a punto de pisar ya quedó guardado como versión, así
   * que no se pierde por haber detectado el choque.
   *
   * Si la lectura falló (`prevLeida` nulo), NO se bloquea la escritura: quedarse
   * sin guardar por un hipo de red sería peor que el riesgo que esto cubre.
   */
  if (vistoEn && prevLeida?.exists()) {
    const actual = String(
      (prevLeida.data() as { metadata?: { fechaModificacion?: string }; updatedAt?: string })?.metadata?.fechaModificacion
      ?? (prevLeida.data() as { updatedAt?: string })?.updatedAt
      ?? '',
    )
    if (actual && actual !== vistoEn) throw new ConflictoDeVersion(actual)
  }

  const payload = stripUndefined({ ...sinId, updatedAt: new Date().toISOString() })

  /**
   * TOPE DE 1 MB POR DOCUMENTO DE FIRESTORE.
   *
   * La nota lleva dentro `transcripcionCruda` y `dialogoDiarizado` —el dictado
   * completo de la consulta, con separación de voces— más el bloque `extraction`
   * con una cita textual por campo. En una consulta larga eso crece rápido, y al
   * pasar el tope `updateDoc` falla: el autoguardado empieza a reventar y el
   * médico solo ve "no se está guardando", sin saber por qué.
   *
   * Se comprueba ANTES de escribir para poder decirlo con nombre y apellido. No
   * se trunca nada: truncar sería perder material clínico de origen en silencio,
   * que es peor que fallar. El médico tiene su respaldo local y puede firmar; la
   * solución de fondo es mover la transcripción a su propia subcolección.
   */
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
  if (bytes > 950_000) {
    throw Object.assign(
      new Error(`La nota pesa ${(bytes / 1024).toFixed(0)} KB y Firestore admite hasta 1 MB por documento. Suele deberse a una transcripción muy larga. No se perdió nada: hay respaldo local y puedes firmar la nota.`),
      { code: 'nota-demasiado-grande' },
    )
  }

  await updateDoc(notaDoc(clinicId, patientId, notaId), payload)
}

/**
 * Agrega una ADENDA a una nota firmada (NOM-004): corrección/aclaración que NO
 * altera el documento original. Se guarda en la subcolección inmutable `adendas`.
 * Devuelve la adenda creada (con su id).
 */
export async function agregarAdenda(
  clinicId: string,
  patientId: string,
  notaId: string,
  data: Omit<Adenda, 'id' | 'createdAt'>,
): Promise<Adenda> {
  /**
   * GP10 — una adenda sólo existe SOBRE una verdad ya firmada. La pantalla puede
   * equivocarse de estado o un caller nuevo puede saltársela; esta frontera
   * vuelve a leer el padre y falla cerrada antes de crear nada.
   */
  const notaRef = notaDoc(clinicId, patientId, notaId)
  const notaSnap = await getDoc(notaRef)
  if (!notaSnap.exists()) throw new Error('No existe la nota que se quiere enmendar.')
  if (notaSnap.data().estado !== 'firmada') {
    throw new Error('Una adenda sólo puede agregarse a una nota firmada.')
  }

  /** El autor lo pone la sesión, nunca el formulario. */
  const autorUid = auth.currentUser?.uid ?? ''
  if (!autorUid) throw new Error('Debes iniciar sesión para agregar una adenda.')

  /**
   * El motivo ya es obligatorio en las reglas. Se valida también aquí para que
   * el médico reciba el error antes de una escritura rechazada por Firestore.
   */
  const texto = data.texto?.trim() ?? ''
  const motivo = data.motivo?.trim() ?? ''
  if (!texto) throw new Error('La adenda necesita texto.')
  if (motivo.length < 5 || motivo.length > 500) {
    throw new Error('El motivo de la adenda debe tener entre 5 y 500 caracteres.')
  }

  const createdAt = new Date().toISOString()
  const completo = { ...data, texto, motivo, autorUid, createdAt }
  const ref = await addDoc(
    collection(notaRef, 'adendas'),
    stripUndefined(completo),
  )

  // La bitácora registra QUE hubo una enmienda y cuál fue, no repite texto clínico.
  void logAudit({
    evento: 'nota_adenda',
    clinicId,
    patientId,
    notaId,
    meta: { adendaId: ref.id },
  })

  return { ...completo, id: ref.id }
}

/** Lee las adendas de una nota, más antiguas primero (orden cronológico legal). */
export async function getAdendas(clinicId: string, patientId: string, notaId: string): Promise<Adenda[]> {
  const snap = await getDocs(
    query(
      collection(db, 'clinics', clinicId, 'patients', patientId, 'notas', notaId, 'adendas'),
      orderBy('createdAt', 'asc'),
    ),
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Adenda))
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
  /**
   * P1-12 — «POCAS NOTAS POR PACIENTE» ERA UN SUPUESTO, NO UN LÍMITE.
   *
   * Esto pedía TODAS las notas firmadas del paciente —con los dictados dentro—
   * para ordenarlas en memoria y quedarse con tres. Y corre en el arranque de la
   * consulta, junto al resto de la carga: era la segunda lectura ilimitada de la
   * pantalla donde el médico está mirando al paciente.
   *
   * Sigue sin combinar `where` con `orderBy` —eso exigiría un índice compuesto
   * que este repositorio no despliega—: ahora recorre las páginas del orden
   * canónico (ya descendente por fecha) y se para en cuanto junta las que le
   * piden. Con la primera página basta salvo que las más recientes sean todas
   * borradores, y aun entonces hay un techo de vueltas.
   */
  const notas: NotaMedica[] = []
  let cursor: CursorNotas | null = null
  for (let vuelta = 0; vuelta < 4 && notas.length < limit; vuelta++) {
    const pagina: PaginaNotas = await listarNotasPagina(clinicId, patientId, {
      limite: LIMITE_PAGINA_NOTAS,
      cursor,
    })
    for (const n of pagina.notas) {
      if (n.estado === 'firmada' && notas.length < limit) notas.push(n)
    }
    cursor = pagina.cursor
    if (!pagina.hayMas) break
  }
  if (notas.length === 0) return ''
  return notas
    .map(n => `[${(n.fechaConsulta || '').slice(0, 10)}] ${n.resumenEjecutivo || (n.diagnosticos ?? []).map(d => d.descripcion).join(', ')}`)
    .join(' · ')
}