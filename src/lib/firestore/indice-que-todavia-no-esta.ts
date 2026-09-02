/**
 * CUANDO EL ÍNDICE TODAVÍA NO ESTÁ CONSTRUIDO.
 *
 * ── EL PROBLEMA QUE ESTE MÓDULO EXISTE PARA QUITAR ───────────────────────────
 *
 * Firestore **no degrada** una consulta que necesita un índice compuesto: la
 * RECHAZA entera con `FAILED_PRECONDITION`. Y declarar un índice, desplegarlo y
 * verlo `Enabled` son **tres actos distintos**: `firebase deploy` contesta al
 * ENVIAR, y la construcción sobre una colección con datos tarda de minutos a
 * horas — o falla después, con el `success` ya impreso.
 *
 * Entre medias hay una ventana en la que el código nuevo ya está servido (Vercel
 * publica solo con cada `merge` a `main`) y el índice todavía no existe. En esa
 * ventana, una consulta indexada **rompe la pantalla**. Le pasó al worklist: se
 * abrió por primera vez en producción con un error, no con una lista vacía.
 *
 * `docs/ops/INDICES-DE-FIRESTORE.md` dice, con razón, que los índices se
 * despliegan ANTES que el código que los usa. Eso es una **instrucción**, y una
 * instrucción depende de que alguien la recuerde el día correcto. Esto es la otra
 * mitad: que si el orden se rompe, **la pantalla no**.
 *
 * ── LO QUE NO HACE, Y ES LO IMPORTANTE ───────────────────────────────────────
 *
 * **No calla el problema.** La regla 3 de seguridad clínica —nada cambia en
 * silencio— aplica igual a una lectura degradada: una lista peor que se presenta
 * como la lista buena es exactamente el defecto que REG-344 y REG-351 cerraron a
 * mano en nueve pantallas. Por eso esto devuelve `degradada`, y quien lo llama
 * está OBLIGADO por el tipo a recibirla.
 *
 * **No se traga cualquier error.** Sólo el que dice que falta el índice. Un
 * permiso denegado, una red caída o una regla mal escrita **siguen subiendo**: si
 * este módulo los absorbiera, convertiría una fuga de seguridad en una lista
 * corta.
 *
 * Módulo PURO salvo por el registro.
 */
import { safeLog } from '@/lib/security/sanitize'

/**
 * ¿Este error es «falta el índice» y no otra cosa?
 *
 * Los dos SDK lo dicen distinto y hay que reconocer a los dos:
 *
 * · **cliente** (`firebase/firestore`) → `code: 'failed-precondition'`
 * · **admin** (`firebase-admin/firestore`) → `code: 9`, el código gRPC
 *   `FAILED_PRECONDITION`
 *
 * Y el 9 del admin **no basta por sí solo**: `FAILED_PRECONDITION` también sale
 * de una transacción que perdió su precondición. Por eso, cuando el código es
 * numérico, se exige además que el mensaje hable del índice — que es el que trae
 * el enlace de la consola para crearlo.
 *
 * El texto se mira en minúsculas y contra dos frases porque el proveedor las ha
 * escrito de las dos formas («requires an index», «needs an index»). Si mañana
 * cambia otra vez, esto deja de reconocerlo y el error **sube** — que es el lado
 * seguro del que equivocarse.
 */
export function esIndiceQueFalta(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  const texto = String((e as { message?: unknown }).message ?? '').toLowerCase()
  const hablaDelIndice =
    texto.includes('requires an index') ||
    texto.includes('needs an index') ||
    texto.includes('failed_precondition: the query requires an index')

  if (code === 'failed-precondition') return true
  if (code === 9 || code === 'FAILED_PRECONDITION') return hablaDelIndice
  /* Sin código utilizable, sólo el texto. Es el caso de las tiendas en memoria
     de las pruebas y de los envoltorios que rehacen el error. */
  return code === undefined && hablaDelIndice
}

/** Lo que devuelve una lectura que pudo tener que conformarse con menos. */
export interface LecturaConRespaldo<T> {
  valor: T
  /**
   * `true` = el índice NO estaba y esto salió del camino peor.
   *
   * Quien lo recibe tiene que decidir qué enseña. Lo que no puede hacer es
   * ignorarlo: una lista degradada presentada como completa es peor que un error.
   */
  degradada: boolean
}

/**
 * Corre la consulta buena; si —y sólo si— falta su índice, corre la de respaldo.
 *
 * `indice` es el nombre del índice tal y como aparece en
 * `firestore.indexes.json`, para que el registro diga cuál hay que ir a mirar a
 * la consola en vez de «algo falló».
 */
export async function conRespaldoSinIndice<T>(
  indice: string,
  indexada: () => Promise<T>,
  respaldo: () => Promise<T>,
): Promise<LecturaConRespaldo<T>> {
  try {
    return { valor: await indexada(), degradada: false }
  } catch (e) {
    if (!esIndiceQueFalta(e)) throw e
    safeLog.warn(
      `[indice] ${indice} todavía no está construido: se lee por el camino peor y ` +
      'el resultado va marcado como degradado. Mirar la consola de Firestore ' +
      '(docs/ops/INDICES-DE-FIRESTORE.md).',
    )
    return { valor: await respaldo(), degradada: true }
  }
}
