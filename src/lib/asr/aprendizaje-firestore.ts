/**
 * LEARN, SEGUNDA ITERACIÓN — lo aprendido con un paciente sirve con el siguiente.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * La primera iteración derivaba las correcciones de **las notas de ese
 * paciente**. Funciona, pero el médico corrige «sefriaxona» en la consulta de
 * don Luis y a la siguiente paciente el motor vuelve a equivocarse: lo aprendido
 * no cruzaba de expediente.
 *
 * Aquí se acumula **por consultorio**, que es donde de verdad sirve.
 *
 * ── LO QUE NO SE GUARDA ──────────────────────────────────────────────────────
 *
 * Nada del paciente. Se guarda una palabra, cuántas veces se corrigió y las
 * formas en que el motor la oyó mal. El motor excluye explícitamente las partes
 * del nombre del paciente antes de llegar aquí: un vocabulario compartido no es
 * sitio para el apellido de nadie.
 *
 * ── POR QUÉ SE ACUMULA Y NO SE REESCRIBE ─────────────────────────────────────
 *
 * El contador es lo que distingue una costumbre de un dedazo. Si cada consulta
 * sobrescribiera el documento, la cuenta volvería a empezar y nunca se llegaría
 * al mínimo — el sistema parecería que aprende y no aprendería nunca.
 */
import { doc, getDocs, collection, setDoc, deleteDoc, increment, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Aprendido } from '@/lib/asr/aprendizaje'

/** La ruta. Una sola definición: dos rutas distintas serían dos vocabularios. */
const ruta = (clinicId: string) => collection(db, 'clinics', clinicId, 'asr_aprendizaje')

/**
 * El identificador del documento: la palabra normalizada.
 *
 * Sin acentos y en minúsculas para que «ceftriaxona» y «Ceftriaxona» sean la
 * misma entrada y su contador no se parta en dos.
 */
export function idDePalabra(palabra: string): string {
  return (palabra ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '')
}

export interface PalabraAprendida extends Aprendido {
  actualizadoEn?: string
}

/** Lee el vocabulario aprendido del consultorio. Falla en silencio: es un extra. */
export async function leerAprendido(clinicId: string): Promise<PalabraAprendida[]> {
  try {
    const snap = await getDocs(ruta(clinicId))
    return snap.docs
      .map(d => d.data() as PalabraAprendida)
      .filter(p => p?.palabra && Number(p.veces) > 0)
      .sort((a, b) => b.veces - a.veces || a.palabra.localeCompare(b.palabra))
  } catch {
    return []
  }
}

/**
 * Suma una observación al vocabulario del consultorio.
 *
 * `increment` y `arrayUnion` para que dos consultas simultáneas no se pisen: con
 * una lectura-y-escritura la del último en guardar borraría la del otro.
 */
export async function acumular(
  clinicId: string,
  observaciones: readonly Aprendido[],
  ahoraISO: string,
): Promise<number> {
  let escritas = 0
  for (const o of observaciones) {
    const id = idDePalabra(o.palabra)
    if (!id) continue
    try {
      await setDoc(doc(ruta(clinicId), id), {
        palabra: o.palabra.toLowerCase(),
        veces: increment(o.veces),
        oidoComo: arrayUnion(...o.oidoComo.map(x => x.toLowerCase())),
        actualizadoEn: ahoraISO,
      }, { merge: true })
      escritas++
    } catch { /* el aprendizaje nunca puede romper una consulta */ }
  }
  return escritas
}

/** El médico se lo quita. Un aprendizaje que no se puede deshacer es peor. */
export async function olvidar(clinicId: string, palabra: string): Promise<boolean> {
  const id = idDePalabra(palabra)
  if (!id) return false
  try {
    await deleteDoc(doc(ruta(clinicId), id))
    return true
  } catch {
    return false
  }
}

export const POR_QUE_SE_ACUMULA_CON_INCREMENT =
  'Dos consultas simultáneas no se pisan. Con una lectura-y-escritura, la del ' +
  'último en guardar borraría la del otro, y el contador —que es lo que ' +
  'distingue una costumbre de un dedazo— nunca llegaría al mínimo.'

export const POR_QUE_FALLA_EN_SILENCIO =
  'El aprendizaje es un extra: si la red falla o las reglas rechazan, la ' +
  'consulta sigue exactamente igual. Nunca puede romper la nota de un paciente.'
