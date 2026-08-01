/**
 * INCIDENTES DE LA LLAVE DE LA PLATAFORMA — el aviso que le toca al dueño.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * El 31-jul-2026 la IA de la plataforma estuvo caída y nadie se enteró hasta que
 * el dueño la probó a mano. No había ninguna señal: cada ruta atrapaba su
 * excepción, le decía al médico «intenta de nuevo» y seguía como si nada.
 *
 * Su instrucción fue literal: «no quiero que a mis clientes les pase eso, está
 * prohibido; tú debes avisarme si tengo que pagar o esas cosas.» Un aviso al
 * médico no basta —él no puede arreglarlo— y un `console.error` tampoco, porque
 * nadie mira los registros de un despliegue a las tres de la tarde.
 *
 * ── QUÉ SE GUARDA Y QUÉ NO ───────────────────────────────────────────────────
 *
 * Sólo lo que le toca al dueño: fallos sobre la llave de la PLATAFORMA. Si a un
 * consultorio se le venció SU llave, eso ya se le dijo en su pantalla y no es
 * una incidencia de plataforma; meterlo aquí llenaría el tablero de ruido ajeno
 * y taparía lo que sí es suyo.
 *
 * **Cero PHI.** No entra la pregunta, ni la nota, ni el paciente, ni el cuerpo
 * de la respuesta del proveedor: sólo el código HTTP, la clase de fallo y qué
 * función lo sufrió.
 *
 * ── POR QUÉ SE AGRUPA POR HORA ───────────────────────────────────────────────
 *
 * Una llave muerta falla en CADA llamada. Sin agrupar, una tarde de caída deja
 * decenas de miles de documentos idénticos, cuesta dinero en escrituras y hace
 * el tablero ilegible justo cuando más falta hace. El id del documento es
 * `proveedor_clase_YYYY-MM-DDTHH`, así que la hora entera colapsa en un
 * documento con su contador.
 */
import admin, { adminDb } from '@/lib/firebase-admin'
import type { ClaseFallo, QuienPaga } from './fallo-proveedor'
import { avisoAlDueno } from './fallo-proveedor'

export interface ReporteFallo {
  clase: ClaseFallo
  quien: QuienPaga
  proveedor: 'anthropic' | 'openai' | 'assemblyai'
  /** Qué función lo sufrió: 'consultor-evidencia', 'nota', 'transcribir'… */
  feature: string
  status: number
}

/** Clave de agrupación: un documento por proveedor, clase y HORA. */
export function claveIncidente(r: Pick<ReporteFallo, 'proveedor' | 'clase'>, ahora: Date): string {
  return `${r.proveedor}_${r.clase}_${ahora.toISOString().slice(0, 13)}`
}

/**
 * Anota el fallo si —y sólo si— es del dueño. **Nunca lanza y nunca espera.**
 *
 * Se llama desde el camino de error de una ruta que ya está fallando: si esta
 * escritura reventara o tardara, convertiría un fallo de IA en un fallo de la
 * petición completa, y el médico perdería también el mensaje que vino a darle.
 * Por eso es «dispara y olvida»: el llamador no la espera.
 */
export function reportarFalloIA(r: ReporteFallo): void {
  const aviso = avisoAlDueno(r.clase, r.quien, r.proveedor)
  if (!aviso) return   // no es incidencia de plataforma

  const ahora = new Date()
  const id = claveIncidente(r, ahora)
  adminDb.collection('platform_incidentes').doc(id).set({
    proveedor: r.proveedor,
    clase: r.clase,
    urgente: aviso.urgente,
    titulo: aviso.titulo,
    queHacer: aviso.queHacer,
    ultimoStatus: r.status,
    // `arrayUnion` y no `push`: la misma función que falla mil veces en una hora
    // no debe aparecer mil veces en la lista.
    features: admin.firestore.FieldValue.arrayUnion(r.feature),
    veces: admin.firestore.FieldValue.increment(1),
    primeraVez: admin.firestore.FieldValue.serverTimestamp(),
    ultimaVez: admin.firestore.FieldValue.serverTimestamp(),
    hora: ahora.toISOString().slice(0, 13),
  }, { merge: true }).catch(e => {
    // Si ni siquiera se puede anotar la incidencia, que quede en el registro del
    // despliegue. Es el último recurso, no el primero.
    console.error('[incidentes] no se pudo anotar el fallo de IA:', (e as Error)?.message)
  })
}

/**
 * Incidencias recientes para el tablero del dueño, la más nueva primero.
 *
 * Sin índice compuesto a propósito: se ordena por el id del documento, que
 * empieza por proveedor y no por fecha, así que el orden se hace en memoria
 * sobre un puñado de documentos. Añadir un índice por un tablero que se mira
 * cinco veces al día no se paga.
 */
export async function incidentesRecientes(limite = 20): Promise<Record<string, unknown>[]> {
  try {
    const snap = await adminDb.collection('platform_incidentes')
      .orderBy('hora', 'desc').limit(limite).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

export const POR_QUE_EL_DUENO_SE_ENTERA_Y_EL_MEDICO_NO =
  'Porque el médico no puede arreglar la llave de la plataforma: decírselo sólo ' +
  'le roba tiempo con un paciente enfrente. Y porque un console.error no es un ' +
  'aviso — el 31-jul la IA estuvo caída horas y la única señal apareció cuando ' +
  'el dueño la probó a mano.'
