/**
 * LO RECUPERABLE SE OFRECE, Y NO SE DESTRUYE — auditoría de Consultorio, H-03…H-06.
 *
 * ── LO QUE TENÍAN EN COMÚN LOS CUATRO DEFECTOS ──────────────────────────────
 *
 * Los cuatro nacen de la misma costumbre: **decidir sobre el material grabado
 * mirando cómo se ve la pantalla**, en vez de mirar si el material existe.
 *
 *   · **H-03** El cartel «¿Recuperar y transcribir?» colgaba de `esElPrincipio`
 *     —«no hay nada dictado todavía»—. Tras recargar con el editor vacío eso es
 *     cierto **aunque haya una consulta entera esperando en IndexedDB**, así que
 *     el único camino de vuelta al audio no se pintaba nunca.
 *   · **H-04** Al cerrar sesión sólo se declaraba el audio cuando el grabador
 *     estaba `grabando | pausado | subiendo`. Un audio huérfano de la sesión
 *     anterior —el mismo que H-03 no enseñaba— y un audio cuya subida acabó en
 *     `error` no se declaraban, y la purga se los llevaba.
 *   · **H-05** La transcripción con las voces separadas llega tarde y se
 *     escribía encima del editor **sin mirar si el médico ya había corregido**.
 *     La salvaguarda existía… pero sólo decidía si se re-estructuraba la nota;
 *     el texto se pisaba igual.
 *   · **H-06** `getNota(...).catch(() => null)` daba el MISMO `null` para «no
 *     pude leer» y para «no existe». En la ruta que adopta el `notaId` de un
 *     respaldo, un fallo de red hacía adoptar el id de una nota que podía estar
 *     firmada — que es exactamente el fallo del 4-ago-2026 que esa comprobación
 *     se puso a cerrar: cada autoguardado rechazado, para siempre, en silencio.
 *
 * ── LAS DOS REGLAS QUE APLICAN AQUÍ ─────────────────────────────────────────
 *
 * 1. **Ausencia de dato no es dato de ausencia** (seguridad clínica §4). No
 *    haber podido leer no es «no hay». No verse en pantalla no es «no existe».
 * 2. **Autoridad del médico > salida automática.** Un resultado tardío de ASR
 *    no reemplaza en silencio lo que el médico escribió con la mano.
 *
 * ── POR QUÉ EL SESGO DE CADA FUNCIÓN VA HACIA CONSERVAR ─────────────────────
 *
 * Los dos errores no cuestan lo mismo. Conservar de más deja en el disco un
 * archivo que ya estaba ahí y que el médico puede descartar desde el propio
 * cartel. Conservar de menos borra la única copia de lo que dijo el paciente.
 * Es el mismo criterio que ya gobierna `salir-seguro.ts` para el borrador.
 *
 * ── QUÉ **NO** DECIDE ESTE MÓDULO ───────────────────────────────────────────
 *
 * - No lee IndexedDB ni Firestore. Recibe hechos ya averiguados y devuelve la
 *   decisión. Quien los averigua es la pantalla; quien los prueba, su golden.
 * - No decide cuándo se BORRAN los trozos tras transcribir: eso vive en
 *   `useGrabacionAudio` (`sePuedeBorrarElAudio`), junto al conteo de lotes.
 * - No cubre el texto que entra en vivo mientras se graba: ahí el reemplazo es
 *   el comportamiento pedido, no un atropello.
 *
 * Módulo PURO, sin dependencias.
 */

/**
 * Los estados del grabador. Copia deliberada del union de `useGrabacionAudio`
 * para que este módulo no dependa de un hook de React (y se pueda probar sin
 * navegador). `recuperacion-consulta.test.ts` comprueba que las dos listas
 * siguen diciendo lo mismo — si alguien añade un estado allí, aquí falla.
 */
export type EstadoGrabador = 'inactivo' | 'grabando' | 'pausado' | 'subiendo' | 'listo' | 'error'

/**
 * Estados en los que hay audio que TODAVÍA no está transcrito ni a salvo.
 *
 * `error` entra, y es la mitad de H-04: cuando la subida falla, el propio hook
 * escribe «El audio quedó GUARDADO en este dispositivo — reintenta con
 * "Recuperar audio"». Prometer eso y no declararlo al cerrar sesión es prometer
 * un archivo que la purga se acaba de llevar.
 */
const EN_VUELO: readonly EstadoGrabador[] = ['grabando', 'pausado', 'subiendo', 'error']

export function estaEnVuelo(estado: EstadoGrabador): boolean {
  return EN_VUELO.includes(estado)
}

// ─── H-03 · el cartel de recuperación ────────────────────────────────────────

export interface HechosDeRecuperacion {
  /** ¿Hay trozos guardados para esta consulta? Lo averigua `hayRecovery`. */
  hayAudioGuardado: boolean
  /** En qué anda el grabador AHORA. */
  estadoGrabador: EstadoGrabador
}

/**
 * ¿Se le ofrece al médico recuperar el audio?
 *
 * Depende de DOS cosas y de ninguna más: que haya material, y que el grabador
 * no esté ocupado con otra grabación (ofrecerlo a mitad de una nueva sería
 * invitarle a pisar lo que está capturando).
 *
 * **Lo que NO entra en la cuenta es cómo se ve el editor.** Ése era H-03: el
 * cartel colgaba de `esElPrincipio`, que es verdadero justo en el caso que más
 * necesita el cartel —recargar la página con la nota todavía vacía—.
 */
export function debeOfrecerRecuperacion(h: HechosDeRecuperacion): boolean {
  return h.hayAudioGuardado && h.estadoGrabador === 'inactivo'
}

// ─── H-04 · qué se puede purgar al cerrar sesión ─────────────────────────────

export interface HechosDePurga extends HechosDeRecuperacion {
  /**
   * El médico pulsó «Descartar» en el cartel. Es la ÚNICA forma de que material
   * recuperable deje de estar protegido sin haberse transcrito.
   */
  descartadoPorElMedico: boolean
}

/**
 * ¿Hay que declarar audio sin transcribir para que la purga NO se lo lleve?
 *
 * La invariante de H-04, dicha en positivo: nada recuperable se destruye hasta
 * demostrar que está procesado **o** que el médico lo descartó a propósito.
 *
 * Nótese que un `hayAudioGuardado` que viene de una lectura FALLIDA de IndexedDB
 * debe llegar aquí como `true`, no como `false`: quien lee decide qué significa
 * su propio error, y «no pude mirar» nunca es «no hay». Ver H-06.
 */
export function hayAudioQueNoSePuedePurgar(h: HechosDePurga): boolean {
  if (h.descartadoPorElMedico) return false
  if (estaEnVuelo(h.estadoGrabador)) return true
  return h.hayAudioGuardado
}

// ─── H-05 · la autoridad del médico sobre su propio texto ────────────────────

export interface HechosDeReemplazo {
  /** El médico escribió a mano desde que se armó la nota preliminar. */
  edicionManual: boolean
  /** Lo que hay ahora en el editor de dictado. */
  textoActual: string
  /** Lo que acaba de llegar del reconocedor (ya compuesto con la base). */
  textoEntrante: string
}

/**
 * ¿Puede el texto tardío del reconocedor escribirse encima del editor?
 *
 * Sólo cuando no le quita nada al médico:
 *
 * - **no ha editado a mano** → no hay autoría que respetar;
 * - **el editor está vacío** → no hay nada que pisar;
 * - **el texto entrante es idéntico** → no es un reemplazo, es lo mismo.
 *
 * En cualquier otro caso se devuelve `false` y quien llama **conserva** el texto
 * entrante para ofrecérselo: la respuesta no es tirar el material bueno, es no
 * aplicarlo a espaldas de quien firma la nota.
 */
export function puedeReemplazarTranscripcion(h: HechosDeReemplazo): boolean {
  if (!h.edicionManual) return true
  const actual = h.textoActual.trim()
  if (!actual) return true
  return h.textoEntrante.trim() === actual
}

// ─── H-06 · error de red ≠ ausencia de dato ──────────────────────────────────

/**
 * Lo que se sabe de la nota a la que apuntaba un respaldo.
 *
 * Los cinco estados del enunciado se reparten así: `cargando` es el intervalo en
 * el que esta lectura todavía no ha vuelto —y durante el cual **no se adopta
 * nada**, porque la adopción vive dentro del `await`—; `error`, `inexistente`,
 * `borrador` y `firmada` son los cuatro valores de abajo. Ninguno se confunde
 * con otro, que es justo lo que hacía `catch(() => null)`.
 */
export type LecturaNotaPrevia =
  | { estado: 'borrador' }
  | { estado: 'firmada' }
  | { estado: 'inexistente' }
  | { estado: 'error' }

/**
 * Traduce el resultado de leer la nota. `null` del lector significa «no existe»
 * y SÓLO eso; el fallo se declara aparte, no se colapsa en el mismo valor.
 */
export function clasificarNotaPrevia(nota: { estado?: string } | null): LecturaNotaPrevia {
  if (!nota) return { estado: 'inexistente' }
  return nota.estado === 'firmada' ? { estado: 'firmada' } : { estado: 'borrador' }
}

/** Envuelve la lectura para que un fallo sea un estado, no un `null` más. */
export async function leerNotaPrevia(
  leer: () => Promise<{ estado?: string } | null>,
): Promise<LecturaNotaPrevia> {
  try {
    return clasificarNotaPrevia(await leer())
  } catch {
    return { estado: 'error' }
  }
}

export interface DecisionDeAdopcion {
  /** ¿Se reutiliza el `notaId` del respaldo? */
  adoptar: boolean
  /** Qué decirle al médico. `null` = no hay nada que avisar. */
  aviso: string | null
}

/**
 * ¿Se adopta el `notaId` que traía el respaldo?
 *
 * - **borrador** → sí. Es el caso normal y el motivo de que exista esta ruta:
 *   sin adoptarlo se creaba una gemela en el expediente y, al firmar una, la
 *   otra quedaba huérfana.
 * - **inexistente** → sí. El id se creó en este navegador y nunca llegó al
 *   servidor; conservarlo es lo que evita la gemela cuando por fin llegue.
 * - **firmada** → no. Una nota firmada es inmutable (NOM-024): adoptar su id
 *   deja la pantalla escribiendo en un documento que el servidor rechaza en
 *   CADA autoguardado, para siempre.
 * - **error** → no, y con un aviso DISTINTO. No se pudo comprobar si estaba
 *   firmada, y adoptar a ciegas es apostar la consulta entera a que no lo
 *   estuviera. Se guarda como nota nueva: en el peor caso hay una nota de más
 *   —visible, editable, recuperable—; en el otro, no se guarda nada.
 */
export function decidirAdopcionDeNotaPrevia(l: LecturaNotaPrevia): DecisionDeAdopcion {
  switch (l.estado) {
    case 'borrador':
    case 'inexistente':
      return { adoptar: true, aviso: null }
    case 'firmada':
      return {
        adoptar: false,
        aviso: 'La nota anterior ya está firmada y no se puede modificar. Lo recuperado se guardará como una nota NUEVA.',
      }
    case 'error':
      return {
        adoptar: false,
        aviso: 'No se pudo verificar la nota anterior (sin conexión). Lo recuperado se guardará como una nota NUEVA para no escribir sobre una nota que quizá ya esté firmada.',
      }
  }
}

export const POR_QUE_EL_CARTEL_NO_MIRA_EL_EDITOR =
  'Porque «el editor parece estar al principio» es verdadero justo en el caso ' +
  'que más necesita el cartel: recargar la página con la nota vacía y una ' +
  'consulta entera esperando en IndexedDB. El cartel mira si hay material, no ' +
  'cómo se ve la pantalla.'

export const POR_QUE_UN_ERROR_NO_ADOPTA =
  'Porque no se pudo comprobar si la nota estaba firmada. Adoptar su id a ' +
  'ciegas deja la pantalla escribiendo en un documento que el servidor puede ' +
  'rechazar en cada autoguardado, para siempre y en silencio. Una nota de más ' +
  'es visible y recuperable; una consulta que no se guarda nunca, no.'
