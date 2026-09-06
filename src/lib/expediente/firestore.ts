import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, where, writeBatch, runTransaction,
  limit as limitarA, documentId, startAfter, getCountFromServer,
  type DocumentReference,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { NotaMedica, Adenda } from '@/types/expediente'
import { fechaCorta } from '@/lib/formato/fecha'
// `stripUndefined` se mudó a un módulo puro (sin SDK) para poder simular el viaje
// a Firestore en los tests del sello de integridad. Ver serializacion.ts.
import { stripUndefined } from './serializacion'
import { logAudit } from './audit-log'
import { idIdempotente } from '@/lib/idempotencia'
import { conRespaldoSinIndice } from '@/lib/firestore/indice-que-todavia-no-esta'

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
/**
 * Exportada para poder probarla DIRECTAMENTE: es el único sitio por el que pasa
 * todo lector de notas del producto, así que lo que aquí no se defienda lo paga
 * la pantalla que lo lea. Ver el golden `un-documento-sin-metadata-no-tumba-el-visor`.
 */
export function normNota(raw: Record<string, unknown>, id: string): NotaMedica {
  const n = raw as unknown as Partial<NotaMedica>
  return {
    ...(raw as unknown as NotaMedica),
    id,
    diagnosticos: Array.isArray(n.diagnosticos) ? n.diagnosticos : [],
    medicamentos: Array.isArray(n.medicamentos) ? n.medicamentos : [],
    alergias: Array.isArray(n.alergias) ? n.alergias : [],
    secciones: Array.isArray(n.secciones) ? n.secciones : [],
    /*
     * ── `metadata` FALTABA EN LA LISTA, Y ES LA QUE TIRA LA PANTALLA ─────────
     *
     * Las cuatro de arriba se defienden porque un documento viejo puede no
     * traerlas. `metadata` puede faltar por lo mismo —una nota anterior al
     * campo, un respaldo restaurado a medias— y NO se defendía, aunque el tipo
     * la declara obligatoria.
     *
     * Lo que pasa entonces no es que falte un dato: el visor medicolegal hace
     * `nota.metadata.establecimiento` sin guarda **en cada render**, así que la
     * pantalla entera cae en la frontera de error y el médico ve «Algo salió
     * mal» con un botón «Reintentar» que no puede funcionar nunca —un fallo de
     * render determinista da el mismo resultado todas las veces—. El documento
     * está íntegro en Firestore y es ILEGIBLE desde el producto. Lo mismo le
     * pasa a la exportación a Word, que hace el mismo acceso.
     *
     * Se descubrió sembrando una nota a mano para poder MEDIR esa pantalla: el
     * sembrador escribió el documento, Firestore lo aceptó, la ruta del portal
     * lo leyó sin queja —sólo mira `estado` y `medicamentos`— y el visor
     * reventó. «El dato tiene que LLEGAR», en la frontera entre dos lectores
     * del mismo documento.
     *
     * NO se rellena con valores plausibles: se deja el objeto vacío a propósito.
     * La pantalla ya sabe declarar lo que falta —«Falta el nombre del
     * establecimiento. Es dato obligatorio del expediente (NOM-004)»,
     * «[FALTA CÉDULA PROFESIONAL]», sello «—»—, y eso es lo que tiene que
     * verse. Inventar un establecimiento sería peor que la caída: sale impreso.
     * Ausencia de dato no es dato de ausencia.
     */
    metadata: (n.metadata ?? {}) as NotaMedica['metadata'],
  }
}

/**
 * ── EL HISTORIAL COMPLETO DE UN PACIENTE, SIN COTA (P1-12 · REG-350) ─────────
 *
 * `getNotas` se bajaba TODAS las notas de un paciente, ordenadas y sin límite.
 * No es una lista de nombres: cada nota lleva dentro `transcripcionCruda`,
 * `transcripcionMotor` y `dialogoDiarizado` —el dictado entero de la consulta,
 * con separación de voces— y el bloque `extraction` con una cita textual por
 * campo. El propio `updateNota` de este archivo declara que una sola nota se
 * acerca al tope de 1 MB de Firestore.
 *
 * Un paciente crónico de años son cientos de esas. La pantalla del expediente
 * las pide TODAS para pintar una línea de tiempo donde caben veinte.
 *
 * ── EL MISMO CONTRATO QUE EL DIRECTORIO DE PACIENTES (REG-341) ──────────────
 *
 *   · `listarNotasPagina` — página con tope duro y cursor por VALORES.
 *   · `listarNotasCompat` — recorre páginas hasta un TECHO y **declara** si se
 *     quedó corta.
 *   · `getNotas` — superficie de compatibilidad; devuelve sólo las notas.
 *
 * No se inventa un contrato nuevo: es el de `lib/firestore.ts` aplicado aquí,
 * porque el defecto es el mismo y la lección de REG-347 también — **acotar una
 * lectura cambia el contrato de todos sus lectores**, así que el recorte tiene
 * que poder decirse.
 *
 * ── LO QUE ESTE ORDEN NO ALCANZA (regla 5: se declara en el módulo) ──────────
 *
 * Firestore **omite** de una consulta ordenada los documentos que no tienen el
 * campo del `orderBy`. Una nota sin `fechaConsulta` queda fuera. Esa limitación
 * **ya existía** —`getNotas` ordenaba por ese campo desde siempre— y no la
 * introduce esta unidad; se escribe aquí porque hasta hoy no estaba escrita en
 * ninguna parte.
 */

/** Tamaño de página por omisión del historial. */
export const LIMITE_PAGINA_NOTAS = 25
/** Techo duro de una sola página, aunque el llamador pida más. */
export const LIMITE_MAX_PAGINA_NOTAS = 100
/**
 * Techo duro del recorrido de compatibilidad (`getNotas`).
 *
 * 200 notas de un mismo paciente son ~40 años de consulta trimestral. Por
 * encima de eso el recorte se DECLARA; no se calla.
 */
export const TECHO_COMPAT_NOTAS = 200

/** Página del barrido de citas huérfanas en la baja de un paciente. */
export const PAGINA_BARRIDO_CITAS = 300
/**
 * Techo del barrido de citas huérfanas. Por encima, el borrado **se niega** en
 * vez de darse por completo: ver `deletePatientExpediente`.
 */
export const TECHO_BARRIDO_CITAS = 20_000

/**
 * Cursor por VALORES (fecha + id), no por snapshot: sobrevive a un remount y
 * puede cruzar el límite de un componente. Mismo motivo que en `CursorPacientes`.
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

export interface ListaNotasCompat {
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
 * Una página del historial, de la más reciente a la más antigua.
 *
 * El orden es `(fechaConsulta, __name__)` y no sólo la fecha: dos notas del
 * MISMO día —una consulta y su nota de laboratorio, o dos visitas— dejarían el
 * cursor sin desempate y la página siguiente repetiría o se saltaría una de las
 * dos. `documentId()` es el desempate total y Firestore lo indexa solo, sin
 * exigir índice compuesto.
 */
export async function listarNotasPagina(
  clinicId: string,
  patientId: string,
  opts?: { limite?: number; cursor?: CursorNotas | null },
): Promise<PaginaNotas> {
  const limite = acotarNotas(opts?.limite, LIMITE_PAGINA_NOTAS, LIMITE_MAX_PAGINA_NOTAS)
  const partes = [
    orderBy('fechaConsulta', 'desc'),
    orderBy(documentId(), 'desc'),
    ...(opts?.cursor ? [startAfter(opts.cursor.fechaConsulta, opts.cursor.id)] : []),
    // Se pide UNA de más para saber si hay página siguiente sin una segunda
    // consulta. La de más no se devuelve.
    limitarA(limite + 1),
  ]
  const snap = await getDocs(query(notasCol(clinicId, patientId), ...partes))
  const hayMas = snap.docs.length > limite
  const docs = hayMas ? snap.docs.slice(0, limite) : snap.docs
  const notas = docs.map(d => normNota(d.data(), d.id))
  const ultimo = docs[docs.length - 1]
  return {
    notas,
    cursor: hayMas && ultimo
      ? { fechaConsulta: String((ultimo.data() as { fechaConsulta?: unknown }).fechaConsulta ?? ''), id: ultimo.id }
      : null,
    hayMas,
    limite,
  }
}

/**
 * El historial hasta un techo, **diciendo si se quedó corto**.
 *
 * `truncada` no es cosmético y aquí pesa más que en una lista de pacientes: de
 * estas notas se derivan los problemas activos, la medicación vigente y el
 * resumen del paciente. Un historial recortado en silencio no produce una lista
 * incompleta — produce una CONCLUSIÓN clínica equivocada, y del lado seguro
 * («no tiene ese antecedente»), que es la dirección en la que un médico no la
 * cuestiona. Regla 4: ausencia de dato no es dato de ausencia.
 */
export async function listarNotasCompat(
  clinicId: string,
  patientId: string,
  opts?: { techo?: number },
): Promise<ListaNotasCompat> {
  const techo = acotarNotas(opts?.techo, TECHO_COMPAT_NOTAS, TECHO_COMPAT_NOTAS)
  const notas: NotaMedica[] = []
  let cursor: CursorNotas | null = null
  let truncada = false
  for (;;) {
    const restante = techo - notas.length
    if (restante <= 0) { truncada = true; break }
    const pagina: PaginaNotas = await listarNotasPagina(clinicId, patientId, {
      limite: Math.min(restante, LIMITE_MAX_PAGINA_NOTAS), cursor,
    })
    notas.push(...pagina.notas)
    if (!pagina.hayMas || !pagina.cursor) break
    cursor = pagina.cursor
    if (notas.length >= techo) { truncada = true; break }
  }
  return { notas, truncada, techo }
}

/**
 * ── POR QUÉ AQUÍ NO HAY UN `getNotas` ───────────────────────────────────────
 *
 * El directorio de pacientes conservó su superficie de compatibilidad
 * (`getPatients`) porque catorce pantallas la llamaban y cambiarlas todas de
 * golpe habría sido un cambio más grande que el arreglo. **Y ese atajo tuvo
 * factura**: REG-347 y las nueve pantallas que hoy siguen recibiendo el recorte
 * sin declararlo son exactamente ese atajo cobrando.
 *
 * Aquí los llamadores eran seis, así que se hizo lo otro: **borrar la puerta que
 * devuelve un array pelado**. Un array no puede decir que viene recortado; quien
 * lo recibe no tiene forma de saberlo ni de contarlo, y con un historial clínico
 * el silencio se lee como «no tiene». Quien quiera el historial llama a
 * `listarNotasCompat` y **tiene `truncada` en la mano**: puede ignorarlo, pero
 * ya no puede no verlo.
 *
 * Quien sólo necesita una parte tiene una lectura hecha para eso —
 * `listarNotasPagina`, `getNotasDeInternamiento`, `resumenRetencionDeNotas`,
 * `tieneNotaFirmada`— y ninguna de ellas depende del tamaño del historial.
 */

/**
 * ¿ESTE PACIENTE TIENE ALGUNA NOTA FIRMADA?
 *
 * Existe por una razón concreta y no por elegancia: el bloqueo NOM-004 de
 * `deletePatientExpediente` lo resolvía leyendo `getNotas` y filtrando en
 * memoria. En el momento en que `getNotas` pasó a tener techo, esa comprobación
 * habría empezado a mirar sólo una VENTANA — y un paciente con el historial
 * largo y las notas firmadas por debajo del techo se habría vuelto **borrable**.
 *
 * Es exactamente la lección de REG-347 (acotar una lectura cambia el contrato de
 * todos sus lectores), aplicada antes de que cobre la pieza: una salvaguarda
 * legal no puede depender de un techo. Una consulta indexada con `limit(1)` no
 * depende de nada y además es más barata que lo que había.
 */
/**
 * LAS NOTAS DE UN INTERNAMIENTO — por consulta indexada, no filtrando el
 * historial entero en memoria (REG-350).
 *
 * La pantalla del episodio pedía TODAS las notas del paciente y se quedaba con
 * las que llevaban este `internamientoId`. Dos defectos en uno:
 *
 *  · **Coste**: un crónico con años de consultorio ambulatorio se bajaba entero
 *    —con transcripciones dentro— para enseñar las cuatro notas de un ingreso.
 *  · **Corrección, en cuanto la lectura tuvo techo**: las notas de un ingreso
 *    ANTIGUO quedan por debajo del techo, así que el episodio se habría pintado
 *    **vacío**. Un episodio de hospital sin notas no se lee como «no cargaron»:
 *    se lee como «no se escribió nada», que es una afirmación medicolegal.
 *
 * `where('internamientoId','==',id)` sin `orderBy` no necesita índice compuesto.
 * El orden se hace en memoria sobre las notas de UN ingreso, que son pocas por
 * definición: un ingreso no dura mil notas.
 */
export async function getNotasDeInternamiento(
  clinicId: string,
  patientId: string,
  internamientoId: string,
): Promise<NotaMedica[]> {
  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('internamientoId', '==', internamientoId),
  ))
  return snap.docs
    .map(d => normNota(d.data(), d.id))
    .sort((a, b) => (b.fechaConsulta || '').localeCompare(a.fechaConsulta || ''))
}

/**
 * LA NOTA MÁS RECIENTE Y CUÁNTAS FIRMADAS HAY — sin bajarse el historial.
 *
 * Existe para la pantalla de retención NOM-004, que evaluaba a **500 pacientes
 * llamando a `getNotas` en cada uno**: hasta 500 historiales completos, con
 * transcripción y diálogo diarizado dentro, para calcular una fecha y un
 * conteo. Es la lectura más cara del producto y la hacía una pantalla de
 * cumplimiento que nadie mira a diario.
 *
 * `getCountFromServer` cuenta **en el servidor**: cobra una lectura por cada mil
 * documentos y no transporta ninguno. Y el conteo así no depende de ningún
 * techo, que importa porque este número se enseña junto a un veredicto legal.
 */
export async function resumenRetencionDeNotas(
  clinicId: string,
  patientId: string,
): Promise<{ ultimaFecha: string | null; notasFirmadas: number }> {
  const [ultima, conteo] = await Promise.all([
    getDocs(query(notasCol(clinicId, patientId), orderBy('fechaConsulta', 'desc'), limitarA(1))),
    getCountFromServer(query(notasCol(clinicId, patientId), where('estado', '==', 'firmada'))),
  ])
  const doc0 = ultima.docs[0]
  const fecha = doc0 ? (doc0.data() as { fechaConsulta?: unknown }).fechaConsulta : undefined
  return {
    ultimaFecha: typeof fecha === 'string' && fecha ? fecha : null,
    notasFirmadas: conteo.data().count,
  }
}

export async function tieneNotaFirmada(clinicId: string, patientId: string): Promise<boolean> {
  const snap = await getDocs(query(
    notasCol(clinicId, patientId),
    where('estado', '==', 'firmada'),
    limitarA(1),
  ))
  return !snap.empty
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
   * Consulta indexada con `limit(1)`, **no** un filtro en memoria sobre
   * `getNotas`. Desde REG-350 `getNotas` viene acotada, y una salvaguarda legal
   * que dependa de un techo deja de ser una salvaguarda: un paciente con el
   * historial largo y las firmadas por debajo del techo se volvería borrable.
   *
   * Se pierde el CONTEO exacto en el mensaje. Es un cambio a mejor: el número
   * no aporta nada a la decisión —una firmada ya bloquea— y obtenerlo costaba
   * el historial entero.
   */
  try {
    if (await tieneNotaFirmada(clinicId, patientId)) {
      return {
        ok: false,
        motivo: 'Tiene al menos una nota firmada. Los registros clínicos firmados no pueden eliminarse (NOM-004).',
      }
    }
  } catch {
    /**
     * No se pudo comprobar. **Falla cerrado**: no saber si hay una nota firmada
     * no es lo mismo que saber que no la hay, y del lado equivocado se borra un
     * registro legal que no puede eliminarse.
     */
    return {
      ok: false,
      motivo: 'No se pudo comprobar si este expediente tiene notas firmadas. No se borró nada: sin esa comprobación no se puede eliminar un registro clínico (NOM-004).',
    }
  }

  /**
   * A partir de aquí sólo hay BORRADORES, y borrarlos sí exige tenerlos todos.
   * Se piden con techo alto y explícito: un expediente con más de mil borradores
   * y ninguna firmada no existe, y si existiera, borrarlo a medias sería peor
   * que no borrarlo. Por eso se comprueba y se dice.
   */
  const listaBorradores = await listarNotasCompat(clinicId, patientId, { techo: TECHO_COMPAT_NOTAS })
  if (listaBorradores.truncada) {
    return {
      ok: false,
      motivo: `Este expediente tiene más de ${listaBorradores.techo} notas en borrador. Borrarlo dejaría notas huérfanas, así que no se hace desde aquí.`,
    }
  }
  const notas = listaBorradores.notas

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

  /**
   * ── LAS CITAS HUÉRFANAS: ACOTADO Y DECLARADO (REG-352) ─────────────────────
   *
   * Aquí se hacía `getDocs(citasRef)` — la colección **entera** de citas del
   * consultorio— porque el emparejamiento es normalizado (mayúsculas, formato de
   * teléfono) y Firestore no filtra por eso. Con años de agenda son decenas de
   * miles de documentos leídos en el navegador para borrar un expediente.
   *
   * Y el `catch` lo tragaba. En un borrado eso no es un detalle: las citas
   * huérfanas llevan `pacienteNombre` y `pacienteTelefono` **dentro**, así que
   * un fallo silencioso deja PHI del paciente en la base **después de que se le
   * dijo que su expediente se eliminó**. Esta función la usa la cancelación
   * ARCO.
   *
   * Ahora: barrido PAGINADO con techo. Se sigue leyendo por páginas porque el
   * criterio es normalizado y no hay índice que lo exprese, pero el coste está
   * acotado y —lo que importa— **cuando no se pudo revisar todo, se dice**. Un
   * borrado que se cree completo y no lo es es peor que uno que se niega.
   */
  let barridoCompleto = true
  if (matchInfo?.nombre || matchInfo?.telefono) {
    const norm = (s: string) => s.toLowerCase().trim()
    const normTel = (s: string) => s.replace(/\D/g, '')
    let leidas = 0
    let cursor: unknown = null
    try {
      for (;;) {
        if (leidas >= TECHO_BARRIDO_CITAS) { barridoCompleto = false; break }
        const snap = await getDocs(query(
          citasRef,
          orderBy(documentId()),
          ...(cursor ? [startAfter(cursor as string)] : []),
          limitarA(PAGINA_BARRIDO_CITAS),
        ))
        if (snap.docs.length === 0) break
        leidas += snap.docs.length
        for (const d of snap.docs) {
          if (vistas.has(d.id)) continue
          const data = d.data() as { pacienteNombre?: string; pacienteTelefono?: string }
          const nombreMatch   = matchInfo.nombre   && data.pacienteNombre   && norm(data.pacienteNombre) === norm(matchInfo.nombre)
          const telefonoMatch = matchInfo.telefono && data.pacienteTelefono && normTel(data.pacienteTelefono) === normTel(matchInfo.telefono)
          if (nombreMatch || telefonoMatch) { vistas.add(d.id); refsCitas.push(d.ref) }
        }
        if (snap.docs.length < PAGINA_BARRIDO_CITAS) break
        cursor = snap.docs[snap.docs.length - 1].id
      }
    } catch {
      // Un fallo aquí NO se traga: se declara, porque decide si el borrado se
      // puede dar por completo.
      barridoCompleto = false
    }
  }

  /**
   * Si no se pudo revisar la agenda entera, **no se borra**. Borrar el
   * expediente dejando citas con el nombre y el teléfono del paciente es
   * exactamente lo que un borrado no puede hacer, y quien lo pidió creería que
   * ya está.
   */
  if (!barridoCompleto) {
    return {
      ok: false,
      motivo: 'No se pudo revisar la agenda completa en busca de citas de este paciente. No se borró nada: hacerlo dejaría citas con su nombre y su teléfono en el sistema. Inténtalo de nuevo.',
    }
  }

  // Commit atómico en lotes de 450 (tope de Firestore = 500 ops por batch).
  const todo = [
    ...notas.map(n => notaDoc(clinicId, patientId, n.id)),
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

  return { ok: true, borradas: { notas: notas.length, citas: refsCitas.length } }
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
  /**
   * LA CLAVE DEL INTENTO (REG-395) — opcional para no romper a nadie, y la
   * pantalla la pasa siempre.
   *
   * Sin ella, una adenda nacía con `addDoc`: identidad de la ESCRITURA, no de la
   * intención. El botón se bloquea mientras la petición está en vuelo, así que
   * el doble clic estaba cubierto — pero el caso que no lo estaba es el que la
   * red provoca sola: **el primer intento COMMITEA y su respuesta se pierde**.
   * El `catch` reactiva el botón, el médico vuelve a pulsar, y el expediente
   * queda con DOS enmiendas idénticas a una nota firmada.
   *
   * Y una adenda no se puede borrar: es la corrección medicolegal de un
   * documento inmutable (NOM-004). El expediente diría que el médico enmendó dos
   * veces lo mismo, y eso ya no se quita.
   */
  claveDeAdenda?: string,
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
  const adendas = collection(notaRef, 'adendas')

  if (claveDeAdenda) {
    const id = idIdempotente(clinicId, 'adenda', claveDeAdenda)
    const ref = doc(adendas, id)
    /**
     * El candado es la TRANSACCIÓN y no un `getDoc` previo, por el mismo motivo
     * que en la nota: entre leer y escribir cabe la otra pestaña.
     *
     * Y si ya existe **se devuelve lo que hay, sin pisarlo**: la adenda anterior
     * puede llevar minutos en el expediente y reescribirla cambiaría su
     * `createdAt`, que es justo el dato que una enmienda medicolegal no puede
     * perder.
     */
    const previa = await runTransaction(db, async (tx) => {
      const dentro = await tx.get(ref)
      if (dentro.exists()) return dentro.data() as Adenda
      tx.set(ref, stripUndefined(completo))
      return null
    })
    if (previa) return { ...previa, id }
    void logAudit({ evento: 'nota_adenda', clinicId, patientId, notaId, meta: { adendaId: id } })
    return { ...completo, id }
  }

  const ref = await addDoc(adendas, stripUndefined(completo))

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

/**
 * Última nota firmada para construir contexto de IA.
 *
 * ── LO QUE COSTABA (REG-350) ────────────────────────────────────────────────
 *
 * Se bajaban **todas** las notas firmadas del paciente —con transcripción,
 * diálogo diarizado y extracción dentro— para quedarse con **tres cadenas de
 * resumen**. En un paciente crónico eso son megabytes por cada apertura de la
 * consulta, y corre en el navegador del médico con el paciente enfrente.
 *
 * ── AHORA SE PIDEN LAS TRES FIRMADAS, Y NADA MÁS (REG-352 → REG-421) ────────
 *
 * Combinar `where('estado','==','firmada')` con `orderBy('fechaConsulta')` exige
 * un **índice compuesto**. Mientras no existió, esto leía una ventana de las
 * `VENTANA_RESUMEN_NOTAS` notas más recientes y filtraba el estado EN MEMORIA:
 * cuarenta documentos bajados para quedarse con tres cadenas de texto.
 *
 * Con `notas(estado, fechaConsulta)` desplegado se pide lo que de verdad se
 * quiere: las `limit` firmadas más recientes. El coste deja de depender de la
 * ventana y pasa a depender de lo que se usa.
 *
 * ── Y SE CIERRA EL HUECO QUE LA VENTANA ABRÍA ───────────────────────────────
 *
 * Con el filtro en memoria, un paciente cuyas últimas cuarenta notas fueran
 * TODAS borradores devolvía resumen vacío aunque tuviera firmadas más atrás. Era
 * aceptable sólo porque este texto es contexto de IA y una tarjeta de cortesía.
 * Ya no hace falta que sea aceptable: la consulta va a buscar firmadas, estén
 * donde estén.
 *
 * **Sigue sin valer** para nada que sostenga una conclusión clínica —problemas
 * activos, medicación vigente, el bloqueo NOM-004—: eso lee `listarNotasCompat`
 * y mira `truncada`.
 *
 * ── LO QUE DA POR SUPUESTO ──────────────────────────────────────────────────
 *
 * Que una nota firmada tiene `fechaConsulta`. Un `orderBy` **excluye** los
 * documentos sin el campo. Ya era así antes de este cambio —la consulta anterior
 * también ordenaba por `fechaConsulta`—, así que no se pierde nada que hoy se
 * viera.
 */
/**
 * LA VENTANA del índice, y qué se hace mientras dura.
 *
 * Entre que este código llega a producción (Vercel publica con cada merge) y
 * que `notas(estado, fechaConsulta)` termina de construirse, la consulta de
 * arriba se RECHAZA. Si eso tumbara la apertura de la consulta, el médico se
 * quedaría sin pantalla con el paciente enfrente por un índice que todavía no
 * cuajó.
 *
 * El respaldo es exactamente lo que hacía antes de REG-421: leer una ventana de
 * notas recientes y filtrar el estado en memoria. Peor —cuarenta documentos para
 * quedarse con tres cadenas, y un paciente cuyas últimas cuarenta notas sean
 * todas borradores devuelve vacío— pero **funciona sin índice**.
 *
 * Aquí el recorte no se propaga hacia arriba, y se dice por qué: esto es
 * contexto de IA y una tarjeta de cortesía, su ausencia no afirma nada sobre el
 * paciente, y la cadena vacía ya era una salida posible. **No vale el mismo
 * razonamiento** para nada que sostenga una conclusión clínica —problemas
 * activos, medicación vigente, el bloqueo NOM-004—: eso lee `listarNotasCompat`
 * y mira `truncada`.
 */
export const VENTANA_RESUMEN_SIN_INDICE = 40

export async function getUltimasNotasResumen(
  clinicId: string,
  patientId: string,
  limit = 3,
): Promise<string> {
  const { valor: notas } = await conRespaldoSinIndice<NotaMedica[]>(
    'notas(estado, fechaConsulta)',
    async () => (await getDocs(query(
      notasCol(clinicId, patientId),
      /* El orden ES el del índice `notas(estado, fechaConsulta)`. */
      where('estado', '==', 'firmada'),
      orderBy('fechaConsulta', 'desc'),
      limitarA(limit),
    ))).docs.map(d => d.data() as NotaMedica),
    async () => (await getDocs(query(
      notasCol(clinicId, patientId),
      orderBy('fechaConsulta', 'desc'),
      limitarA(VENTANA_RESUMEN_SIN_INDICE),
    ))).docs
      .map(d => d.data() as NotaMedica)
      .filter(n => n.estado === 'firmada')
      .slice(0, limit),
  )
  if (notas.length === 0) return ''
  return notas.map(resumenDeUnaVisita).join('  ·  ')
}

/**
 * ── LO QUE ESTA LÍNEA LE ENSEÑA AL MÉDICO EN LA CONSULTA ─────────────────────
 *
 * Salía `[2026-09-01] ` — con corchetes, con la fecha en ISO, y **vacío**
 * cuando la nota no tenía resumen ni diagnósticos. Medido en navegador el
 * 1-sep: la consulta pintaba una caja entera con borde que decía, entera,
 * «Visitas anteriores: [2026-09-01]». Corchetes que parecen un array de
 * depuración y una fecha que este producto no usa en ningún otro sitio.
 *
 * Tres decisiones, y la tercera es la que importa:
 *
 * 1. Fecha en es-MX, como la receta y como todo lo demás.
 * 2. Sin corchetes: la fecha y el resumen se separan tipográficamente, no con
 *    puntuación de programador.
 * 3. Una visita SIN resumen **sigue apareciendo**, y dice que no lo tiene.
 *    Quitarla habría sido más limpio de leer y clínicamente falso: el paciente
 *    vino ese día. Ausencia de resumen no es ausencia de visita.
 */
function resumenDeUnaVisita(n: NotaMedica): string {
  const fecha = fechaCorta(n.fechaConsulta) || 'fecha no registrada'
  const dxs = (n.diagnosticos ?? []).map(d2 => d2.descripcion).filter(Boolean).join(', ')
  const que = (n.resumenEjecutivo || '').trim() || dxs || 'sin resumen'
  return `${fecha} — ${que}`
}