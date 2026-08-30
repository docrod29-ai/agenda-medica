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
import {
  doc, getDocs, collection, setDoc, deleteDoc, increment, arrayUnion,
  query, where, orderBy, limit,
} from 'firebase/firestore'
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

/**
 * CUÁNTAS PALABRAS SE BAJAN PARA DICTAR — y por qué ese número (REG-393).
 *
 * No es una cifra clínica: es el presupuesto del sesgo de vocabulario. El tope
 * declarado del reconocedor es `TOPE_TERMINOS = 1000` (`asr/sesgo-diarizado.ts`)
 * y ahí dentro compiten además el léxico de especialidad y —con prioridad— el
 * vocabulario del paciente que está enfrente. Bajar más de mil palabras
 * aprendidas es tráfico que no cabe en ninguna petición.
 *
 * Hasta REG-393 esta lectura NO tenía cota: `getDocs` de la colección entera, un
 * documento por palabra distinta, en CADA apertura de consulta y de UCI. La
 * colección crece con los años y se comparte por consultorio, así que el precio
 * lo pagaba el médico justo al abrir la pantalla, para usar como mucho mil.
 */
export const TOPE_PARA_EL_DICTADO = 1000

/**
 * Cuántas se enseñan en la pantalla de configuración.
 *
 * Más alto porque ahí el médico QUITA palabras, y una lista recortada le
 * escondería justo la que quiere borrar — «un aprendizaje que no se puede
 * deshacer es peor». Pero tampoco es infinita: por eso `leerVocabularioCompleto`
 * dice cuándo se quedó corta, en vez de enseñar mil y parecer que son todas.
 */
export const TOPE_PARA_ADMINISTRAR = 5000

/** La consulta, con su cota. `veces > 0` y ordenado por frecuencia en el servidor. */
function consultaOrdenada(clinicId: string, tope: number) {
  return query(ruta(clinicId), where('veces', '>', 0), orderBy('veces', 'desc'), limit(tope))
}

function aLista(docs: readonly { data: () => unknown }[]): PalabraAprendida[] {
  return docs
    .map(d => d.data() as PalabraAprendida)
    .filter(p => p?.palabra && Number(p.veces) > 0)
    /**
     * El orden ya viene del servidor; esto sólo desempata por palabra para que
     * dos lecturas seguidas den la misma lista. El CORTE, en cambio, lo hace el
     * servidor por `veces`: entre dos palabras con la misma cuenta justo en el
     * límite, cuál entra es arbitrario. Se declara en vez de fingir un criterio.
     */
    .sort((a, b) => b.veces - a.veces || a.palabra.localeCompare(b.palabra))
}

/**
 * Lee el vocabulario aprendido del consultorio para DICTAR.
 *
 * Falla en silencio: es un extra y nunca puede romper una consulta.
 */
export async function leerAprendido(
  clinicId: string, tope = TOPE_PARA_EL_DICTADO,
): Promise<PalabraAprendida[]> {
  try {
    return aLista((await getDocs(consultaOrdenada(clinicId, tope))).docs)
  } catch {
    return []
  }
}

/**
 * Lee el vocabulario para ADMINISTRARLO, y **dice si se quedó corto**.
 *
 * Se pide una más de las que caben: si llega, es que hay más. Enseñar una lista
 * recortada como si fuera completa haría creer al médico que ya no queda nada
 * que revisar — ausencia de dato tomada por dato de ausencia.
 */
export async function leerVocabularioCompleto(
  clinicId: string, tope = TOPE_PARA_ADMINISTRAR,
): Promise<{ lista: PalabraAprendida[]; truncada: boolean; leida: boolean }> {
  try {
    const docs = (await getDocs(consultaOrdenada(clinicId, tope + 1))).docs
    return { lista: aLista(docs).slice(0, tope), truncada: docs.length > tope, leida: true }
  } catch {
    /**
     * `leida: false` — porque una lista vacía por un fallo de red se pintaba con
     * el mismo texto que una lista vacía de verdad: «todavía no ha aprendido
     * ninguna palabra». Ausencia de dato tomada por dato de ausencia, y en la
     * pantalla donde el médico decide si su vocabulario está bien.
     */
    return { lista: [], truncada: false, leida: false }
  }
}

/**
 * CUÁNTAS FORMAS MAL OÍDAS SE GUARDAN DE UNA PALABRA (REG-393).
 *
 * `oidoComo` es una lista de variantes que sólo sirve para dos cosas: enseñarle
 * al médico por qué se aprendió una palabra, y darle contexto a quien revise el
 * vocabulario. Ninguna de las dos mejora con cincuenta variantes.
 *
 * Se acumulaba con `arrayUnion` **sin techo**, en un documento compartido por
 * consultorio y para siempre. Firestore corta el documento en 1 MiB, y ahí el
 * `setDoc` empieza a fallar — en silencio, porque el aprendizaje nunca puede
 * romper una consulta. O sea: dejaría de aprender esa palabra sin decirlo.
 *
 * Que llegar a 1 MiB de variantes de UNA palabra sea improbable no lo vuelve
 * aceptable: es un crecimiento sin cota en un documento que nadie revisa.
 */
export const TOPE_OIDO_COMO = 12

/**
 * Suma una observación al vocabulario del consultorio.
 *
 * `increment` y `arrayUnion` para que dos consultas simultáneas no se pisen: con
 * una lectura-y-escritura la del último en guardar borraría la del otro. Ése es
 * también el motivo de que el techo se aplique a lo que se APORTA y no al total:
 * recortar el total exigiría leer-modificar-escribir, que es justo lo que
 * `arrayUnion` está aquí para evitar. Acota el ritmo, no el acumulado — y se
 * dice, en vez de dejar creer que el documento está cerrado por arriba.
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
        oidoComo: arrayUnion(...o.oidoComo.slice(0, TOPE_OIDO_COMO).map(x => x.toLowerCase())),
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

export const POR_QUE_LA_LECTURA_TIENE_COTA =
  'Se leía la colección entera en cada apertura de consulta y de UCI, un ' +
  'documento por palabra distinta, compartido por consultorio y creciendo con ' +
  'los años — para usar como mucho las mil que caben en el sesgo del ' +
  'reconocedor. La cota no quita nada: quita tráfico que no cabía en ninguna ' +
  'petición, y lo quita del camino donde el médico está esperando.'

export const POR_QUE_LA_LISTA_DICE_QUE_SE_QUEDO_CORTA =
  'La pantalla de configuración es donde el médico QUITA palabras. Una lista ' +
  'recortada que parece completa le hace creer que ya no queda nada que ' +
  'revisar: ausencia de dato tomada por dato de ausencia. Si no caben todas, ' +
  'se dice.'
