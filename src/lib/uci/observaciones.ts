/**
 * Persistencia de las observaciones de UCI — ICU-003.
 *
 * ═══ EL HALLAZGO QUE ESTO CIERRA ═══
 *
 * ICU-001 midió que las lecturas seriadas del Panel UCI viven **sólo en
 * `localStorage`**, con tope de 24, en la clave `nx.uci.lecturas.<internamientoId>`.
 * Consecuencias reales:
 *
 *   · No hay expediente longitudinal — el objetivo central del charter.
 *   · Otro médico, otra guardia u otro dispositivo NO ven nada.
 *   · El cierre de sesión las PURGA (correcto para PHI, pero no hay copia
 *     servidor: el dato se pierde para siempre).
 *   · Las tendencias y el Morning Brief se calculan sobre ≤24 puntos locales.
 *   · Nada de eso es auditable ni cumple NOM-024.
 *
 * ═══ LA UNIDAD DE VERDAD ES LA TOMA ═══
 *
 * El panel captura TODAS las medidas juntas y las guarda de un golpe. Eso es
 * exactamente un `observationSetId` de la decisión ICU-Q4.1: un conjunto
 * contemporáneo. Por eso cada guardado es UN documento, no N documentos sueltos
 * que después habría que volver a agrupar por hora — agruparlos después sería
 * reconstruir a mano una información que ya teníamos.
 *
 * ═══ APPEND-ONLY, COMO LOS SIGNOS ═══
 *
 * Una toma no se edita ni se borra: se ANEXA una corrección con `corrigeA` y la
 * errónea queda visible marcada. Es el mismo modelo de `signos` (E0-09/REG-060)
 * y de `observacion-version.ts`, para que un solo motor sirva a los dos mundos.
 *
 * ═══ TRANSICIÓN SIN PÉRDIDA ═══
 *
 * `guardarToma` NO reemplaza al `localStorage`: se escribe en los dos. Si las
 * reglas fallan, si no hay internet o si el paciente no está internado, el
 * comportamiento de hoy sigue intacto. Quitar el respaldo local es una decisión
 * posterior, cuando haya semanas de datos en el servidor.
 */

import {
  collection, addDoc, getDoc, getDocs, setDoc, updateDoc, doc, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { idIdempotente } from '@/lib/idempotencia'
import {
  vigenteEn, serieVigente,
  type EstadoObservacion, type ObservacionVersionada,
} from '@/lib/clinical/observacion-version'

/**
 * Una TOMA de UCI: las medidas que se capturaron juntas.
 *
 * `medidas` se guarda como el objeto que el panel ya maneja, sin aplanar: el
 * panel, los motores y la nota lo consumen con esa forma, y aplanarlo aquí
 * obligaría a re-armarlo en tres sitios.
 */
export interface TomaUci {
  id: string
  /** Cuándo se MIDIÓ. Una corrección hereda la del original (decisión ICU-Q3). */
  medidoEn: string
  /** Cuándo se GUARDÓ. Siempre la propia. */
  registradoEn: string
  estado: EstadoObservacion
  /** id de la toma que ESTA corrige. Ausente ⇒ toma nueva, no corrección. */
  corrigeA?: string
  motivoCorreccion?: string
  /**
   * Quién la capturó — lo pone la SESIÓN, no el llamador.
   *
   * El panel mandaba `inter.medicoTratanteNombre`: la lectura del pase quedaba
   * firmada con el nombre del médico TITULAR aunque la capturara el residente o
   * la enfermera, y si la lectura del internamiento fallaba quedaba en blanco.
   * Es el mismo defecto que ya se reparó en el MAR («la enfermera que administró
   * quedaba registrada con el nombre del médico titular»).
   */
  por: string
  /** El uid de quien la capturó. Es lo único que no se puede declarar por error. */
  porUid?: string
  /** De dónde vino: dictado, teclado, importación… (charter §50, procedencia). */
  fuente: string
  medidas: Record<string, unknown>
}

/**
 * Tope de lectura. MISMA razón que `getSignos` (TOPE_SIGNOS = 200): un paciente
 * de UCI con tomas horarias durante 20 días son ~480 documentos, y bajar la
 * subcolección completa cada vez que se abre la ficha fue la causa REAL de la
 * lentitud de la agenda (ver `src/lib/hospital/firestore.ts`).
 */
export const TOPE_TOMAS = 200

function col(clinicId: string, internamientoId: string) {
  return collection(db, 'clinics', clinicId, 'internamientos', internamientoId, 'icu_observations')
}

/** Anexa una toma. Nunca sobrescribe: cada guardado es un documento nuevo. */
export async function guardarToma(
  clinicId: string,
  internamientoId: string,
  toma: Omit<TomaUci, 'id'>,
  /**
   * REG-419 — una toma de UCI duplicada alimenta escalas y tendencias dos veces.
   * La clave la acuña quien abre el formulario. Sin ella, como antes.
   */
  claveDeIntento?: string,
): Promise<string> {
  /**
   * AUTOR Y HORA DE REGISTRO, SELLADOS AQUÍ.
   *
   * Lo que mande el llamador en `por` se IGNORA: venía el nombre del médico
   * tratante, así que la toma del pase quedaba firmada por quien no la hizo.
   * Y `registradoEn` lo ponía el reloj de la tablet, que es manipulable — se
   * conserva (el panel lo usa para ordenar sin esperar al servidor) pero al
   * lado va la hora del SERVIDOR, que es la que vale para una revisión.
   */
  const u = auth.currentUser
  const completa = {
    ...toma,
    por: u?.displayName || u?.email || toma.por || '',
    porUid: u?.uid ?? '',
  }
  const datos = { ...limpiar(completa), registradoEnServidor: serverTimestamp() }
  if (!claveDeIntento) return (await addDoc(col(clinicId, internamientoId), datos)).id
  const ref = doc(col(clinicId, internamientoId), idIdempotente(clinicId, 'observacion', claveDeIntento))
  /* No se pisa: `registradoEnServidor` es el sello de cuándo llegó de verdad. */
  if (!(await getDoc(ref)).exists()) await setDoc(ref, datos)
  return ref.id
}

/** Las últimas `tope` tomas, en orden cronológico ascendente (para graficar). */
export async function getTomas(
  clinicId: string,
  internamientoId: string,
  tope = TOPE_TOMAS,
): Promise<TomaUci[]> {
  const snap = await getDocs(
    query(col(clinicId, internamientoId), orderBy('medidoEn', 'desc'), limit(tope)),
  )
  return snap.docs.map(d => ({ ...(d.data() as Omit<TomaUci, 'id'>), id: d.id })).reverse()
}

/**
 * Corrige una toma ANEXANDO otra y marcando la original.
 *
 * Dos escrituras a propósito, en este orden: primero se ANEXA la corrección y
 * después se marca la original. Si la segunda falla, queda una corrección
 * huérfana — que `proyectarTomas` muestra igual (nunca la descarta). Al revés
 * sería peor: una original marcada como errónea sin nada que la sustituya.
 *
 * `esErrorDeCaptura` distingue «el hecho nunca ocurrió así» (ENTERED_IN_ERROR)
 * de «se rectifica un dato que sí se tomó» (CORRECTED). Es una distinción
 * clínica y la elige quien corrige: este módulo NO la adivina.
 */
export async function corregirToma(
  clinicId: string,
  internamientoId: string,
  original: TomaUci,
  correccion: { medidas: Record<string, unknown>; por: string; motivo: string; fuente: string },
  ahoraIso: string,
  esErrorDeCaptura: boolean,
): Promise<string> {
  if (!correccion.motivo.trim()) {
    throw new Error('corregirToma: la decisión ICU-Q3 exige motivo para el audit trail')
  }
  const id = await guardarToma(clinicId, internamientoId, {
    // HEREDA la hora del hecho: sin esto, un score retrospectivo no encuentra
    // el valor corregido (requisito C2 de la decisión).
    medidoEn: original.medidoEn,
    registradoEn: ahoraIso,
    estado: 'CONFIRMED',
    corrigeA: original.id,
    motivoCorreccion: correccion.motivo,
    por: correccion.por,
    fuente: correccion.fuente,
    medidas: correccion.medidas,
  })
  await updateDoc(
    doc(col(clinicId, internamientoId), original.id),
    { estado: esErrorDeCaptura ? 'ENTERED_IN_ERROR' : 'CORRECTED' },
  )
  return id
}

// ── Adaptador al núcleo compartido ────────────────────────────────────────

/** Traduce las tomas al modelo versionado, para reusar el motor de vigencia. */
export function tomasComoObservaciones(
  tomas: readonly TomaUci[],
): ObservacionVersionada<TomaUci>[] {
  return tomas.map(t => ({
    id: t.id,
    fechaEfectiva: t.medidoEn,
    fechaRegistro: t.registradoEn,
    estado: t.estado,
    corrigeA: t.corrigeA,
    motivoCorreccion: t.motivoCorreccion,
    por: t.por,
    valor: t,
  }))
}

/** La toma clínicamente vigente en un instante. Ver `vigenteEn` para la regla. */
export function tomaVigenteEn(
  tomas: readonly TomaUci[],
  instanteIso: string,
  ventanaMs: number | null,
): TomaUci | null {
  return vigenteEn(tomasComoObservaciones(tomas), instanteIso, ventanaMs).vigente?.valor ?? null
}

/**
 * Serie para graficar: la versión vigente de cada toma, por hora efectiva.
 * Una corrección NO añade un punto extra — reemplaza al original en su lugar.
 */
export function serieTomas(tomas: readonly TomaUci[]): TomaUci[] {
  return serieVigente(tomasComoObservaciones(tomas)).map(o => o.valor)
}

/** Firestore RECHAZA `undefined`. Quitar la llave es correcto; enviarla, un error. */
function limpiar<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}
