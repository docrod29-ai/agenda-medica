/**
 * IDENTIDAD DE LA INTENCION - el nombre que sobrevive al reintento.
 *
 * LA CAUSA RAIZ QUE CIERRA
 *
 * Las cuatro fronteras del Golden Path del consultorio -agendar, llegada, cobro
 * e inicio de consulta- nombraban el recurso en el MOMENTO DE ESCRIBIRLO:
 * `addDoc()` y `doc()` sin id generan un identificador aleatorio nuevo en cada
 * llamada. Asi, la identidad del documento nace de la ESCRITURA, no de la
 * INTENCION.
 *
 * Eso significa que dos escrituras de la misma intencion son, por construccion,
 * dos recursos distintos. Y una escritura se repite sola, sin que nadie haga
 * nada raro:
 *
 *   - el primer intento COMMITEA y su respuesta se pierde en la red, el
 *     cliente reintenta y fabrica un segundo recurso;
 *   - el medico toca el boton dos veces porque la pantalla parece lenta;
 *   - la asistente cobra desde Citas mientras el medico cobra desde Consulta;
 *   - el navegador reenvia tras un refresh.
 *
 * Ninguno de esos casos es un error del usuario. Son la red y la impaciencia,
 * que existen siempre. La defensa no puede ser "que no pase": tiene que ser que
 * la misma intencion tenga siempre el MISMO nombre.
 *
 * LA REGLA
 *
 * Quien inicia una operacion acuna UNA clave (`claveDeIntento`) y la conserva
 * mientras esa operacion no haya terminado con exito. De esa clave sale un id
 * DETERMINISTA, y el que escribe comprueba primero si ese id ya existe: si
 * existe, devuelve lo que hay. Una accion logica, un recurso.
 *
 * POR QUE EL id LLEVA EL CONSULTORIO DENTRO
 *
 * La clave la propone el CLIENTE, y un cliente puede mandar la de otro. Aunque
 * los documentos ya viven bajo `clinics/{clinicId}/...` -el aislamiento real es
 * la ruta-, el id se deriva de un hash que incluye el `clinicId` en la
 * preimagen: la misma clave en dos consultorios da dos ids distintos, asi que
 * una clave prestada no puede aterrizar sobre la entidad de otro ni siquiera si
 * alguien se equivocara de coleccion.
 *
 * Y el hash resuelve de paso el otro peligro de aceptar un id del cliente: la
 * salida es SIEMPRE `[a-z-]+__[0-9a-f]{32}`, asi que una clave con `/`, `.` o
 * `..` no puede convertirse en una ruta -ni saltar a otra coleccion, ni a otro
 * consultorio- porque esos caracteres no sobreviven a la derivacion.
 *
 * Modulo PURO: sin Firestore, sin red, sin reloj. Determinista en navegador y
 * en Node, que es lo que permite probarlo de verdad.
 */

/** Separador que no puede aparecer dentro de una clave ya recortada. */
const SEP = ' '

/** Cuatro rondas FNV-1a con constantes iniciales distintas: 128 bits. */
const SEMILLAS = [0x811c9dc5, 0x01000193, 0x7fffffff, 0x9e3779b9] as const

function fnv1a(texto: string, semilla: number): number {
  let h = semilla >>> 0
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 128 bits en hexadecimal, deterministas y sin dependencias. */
function huella128(preimagen: string): string {
  return SEMILLAS.map(s => fnv1a(preimagen, s).toString(16).padStart(8, '0')).join('')
}

/**
 * Ambitos permitidos. La lista es CERRADA a proposito: un ambito libre convierte
 * el prefijo del id en otro campo que el cliente elige, y eso es justo lo que
 * este modulo existe para impedir.
 */
export type AmbitoIdempotente = 'cobro' | 'nota' | 'laboratorio'

const AMBITOS: readonly AmbitoIdempotente[] = ['cobro', 'nota', 'laboratorio']

/**
 * Acuna la clave de UN intento. Quien la acuna la conserva hasta que la
 * operacion termine BIEN: si termina bien y el usuario vuelve a operar, eso es
 * una intencion nueva y le toca una clave nueva.
 *
 * No es un id de documento ni se guarda como tal: es el nombre de la intencion.
 */
export function claveDeIntento(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  // Respaldo para entornos sin WebCrypto. No se usa para nada criptografico:
  // solo tiene que ser distinto entre intentos distintos.
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * El id determinista de una intencion dentro de UN consultorio.
 *
 * @throws si falta el consultorio, la clave o el ambito no esta declarado -
 *         derivar un id sin tenant seria exactamente el agujero que se cierra.
 */
export function idIdempotente(clinicId: string, ambito: AmbitoIdempotente, clave: string): string {
  const tenant = String(clinicId ?? '').trim()
  const k = String(clave ?? '').trim()
  if (!tenant) throw new Error('idIdempotente: falta el consultorio; una clave sin tenant no puede derivar un id.')
  if (!k) throw new Error('idIdempotente: falta la clave del intento.')
  if (!AMBITOS.includes(ambito)) throw new Error(`idIdempotente: ambito no declarado (${String(ambito)}).`)
  const id = `${ambito}__${huella128(`${tenant}${SEP}${ambito}${SEP}${k}`)}`
  /**
   * AUTOCOMPROBACION, no adorno. Este id se concatena a una ruta de Firestore, y
   * la clave que lo origina la propone el cliente. Si un cambio futuro dejara
   * pasar un `/`, un `.` o un `..`, el id dejaria de ser un segmento y pasaria a
   * ser un CAMINO: otra coleccion, otro consultorio. Cuesta una expresion
   * regular y cierra la unica forma en que esta funcion podria hacer dano.
   */
  if (!esIdDeUnSoloSegmento(id)) {
    throw new Error('idIdempotente: la derivacion emitio algo que no es un segmento de ruta.')
  }
  return id
}

/**
 * Puede este id vivir como UN segmento de ruta de Firestore?
 *
 * Se usa como guardian sobre la SALIDA de `idIdempotente`, no sobre la entrada:
 * lo que se comprueba es que la derivacion no pueda emitir jamas algo que
 * Firestore interprete como camino (`/`), como el propio documento (`.`) o como
 * el padre (`..`).
 */
export function esIdDeUnSoloSegmento(id: string): boolean {
  return /^[a-z-]+__[0-9a-f]{32}$/.test(id)
}
