/**
 * QUE UN REINTENTO NO CREE UNA SEGUNDA CITA — identidad de una acción.
 *
 * ── EL CASO REAL QUE LO PIDE ─────────────────────────────────────────────────
 *
 * La asistente agenda. El servidor escribe la cita y responde. La respuesta se
 * pierde en la red del consultorio. El navegador reintenta.
 *
 * Hoy `POST /api/appointments` es transaccional y detecta el empalme, así que
 * el reintento no crea una cita duplicada: devuelve **409 «ese horario ya está
 * ocupado»**. Suena a que funcionó, y no funcionó — la asistente acaba de
 * agendar esa cita ella misma hace dos segundos y el sistema le dice que el
 * hueco está tomado. Lo que hace a continuación es buscar otro hueco, o llamar
 * al paciente para moverlo. El defecto no es un duplicado: es una MENTIRA sobre
 * el estado de la agenda, y sale del mismo hueco.
 *
 * Y con sobreagenda autorizada (el médico manda un motivo) el reintento SÍ
 * crea la cita duplicada, porque el motivo desactiva la detección de empalme.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Toda acción consecuencial —clínica o administrativa— lleva una IDENTIDAD.
 * Dos peticiones con la misma identidad son **la misma acción**: la segunda no
 * repite el efecto, devuelve el resultado de la primera.
 *
 * La identidad la fija QUIEN INICIA la acción, no el servidor: si la fijara el
 * servidor no habría forma de saber que el reintento es del mismo clic.
 *
 * ── ESTE MÓDULO NO ES UN ALMACÉN ─────────────────────────────────────────────
 *
 * Define la identidad y el protocolo; el almacén es una interfaz. En pruebas se
 * usa el de memoria; en producción sería Firestore con `create()` —la misma
 * técnica que ya usa `src/lib/whatsapp/dedup.ts` para los webhooks de Meta—.
 * NO se introduce aquí una cola nueva ni un proveedor de pago.
 *
 * ── FAIL-OPEN vs FAIL-CLOSED, y por qué aquí es al revés que en WhatsApp ─────
 *
 * El dedup de WhatsApp es FAIL-OPEN: si el almacén falla, se procesa. Su peor
 * caso es responder dos veces a un mensaje. Aquí es FAIL-CLOSED para acciones
 * consecuentes: si no se puede garantizar la identidad, NO se ejecuta y se lo
 * dice a quien llama. El peor caso de esta figura es una segunda receta o una
 * segunda cita, y eso no se arregla pidiendo perdón.
 *
 * Módulo PURO salvo por la interfaz de almacén, que se inyecta.
 */

/** Cómo acabó la acción que se guardó bajo una identidad. */
export type EstadoIdempotencia = 'en-curso' | 'completada' | 'fallida'

export interface AsientoIdempotencia {
  clave: string
  estado: EstadoIdempotencia
  /**
   * Huella del contenido de la petición. Sirve para cazar el error más
   * peligroso de esta figura: reusar una llave con un cuerpo DISTINTO. Sin
   * huella, un cliente con un bug puede pedir «cita a las 10» y luego «cita a
   * las 11» con la misma llave, y el servidor devolvería la de las 10 diciendo
   * que sí a algo que no pidió.
   */
  huella: string
  /** El resultado de la primera ejecución, para poder repetirlo tal cual. */
  resultado?: unknown
  creadoEnMs: number
}

export interface AlmacenIdempotencia {
  /**
   * Reserva la clave. Devuelve `{ nuevo: true }` sólo si NADIE la tenía.
   * Debe ser atómico (create-if-absent), o esta figura no protege de nada.
   */
  reservar(asiento: AsientoIdempotencia): Promise<{ nuevo: boolean; existente?: AsientoIdempotencia }>
  /** Cierra la clave con su resultado. */
  cerrar(clave: string, estado: 'completada' | 'fallida', resultado?: unknown): Promise<void>
}

/** Almacén en memoria. Para pruebas y para el arnés de carga; nunca producción. */
export class AlmacenEnMemoria implements AlmacenIdempotencia {
  private readonly mapa = new Map<string, AsientoIdempotencia>()

  async reservar(asiento: AsientoIdempotencia) {
    const existente = this.mapa.get(asiento.clave)
    if (existente) return { nuevo: false, existente }
    this.mapa.set(asiento.clave, { ...asiento })
    return { nuevo: true }
  }

  async cerrar(clave: string, estado: 'completada' | 'fallida', resultado?: unknown) {
    const a = this.mapa.get(clave)
    if (!a) return
    this.mapa.set(clave, { ...a, estado, resultado })
  }

  /** Sólo para pruebas y para el arnés: cuántas identidades distintas se vieron. */
  get tamano(): number { return this.mapa.size }
}

/**
 * Huella determinista de un cuerpo. FNV-1a de 32 bits sobre el JSON con las
 * claves ordenadas.
 *
 * No es criptográfica y no pretende serlo: sirve para detectar que dos cuerpos
 * DIFIEREN, no para resistir a un adversario que quiera colisionarlos. Un
 * adversario que puede elegir el cuerpo ya está autenticado y su acción ya está
 * en la bitácora; el riesgo que cubre esta huella es el bug de cliente, no el
 * ataque.
 */
export function huellaDe(cuerpo: unknown): string {
  const texto = JSON.stringify(cuerpo, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
    }
    return v
  })
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * La clave de idempotencia, atada al INQUILINO.
 *
 * Sin `clinicId` en la clave, dos consultorios que usen el mismo identificador
 * de cliente —«alta-cita-1»— compartirían asiento: el segundo recibiría el
 * resultado del primero. Eso es fuga entre consultorios por la puerta de atrás,
 * y es un bloqueador de lanzamiento incondicional en #310.
 */
export function claveIdempotencia(clinicId: string, accion: string, idDeCliente: string): string {
  const limpio = idDeCliente.replace(/[^A-Za-z0-9_:-]/g, '_').slice(0, 128)
  return `${clinicId}::${accion}::${limpio}`
}

export type ResultadoUnaVez<T> =
  | { ejecutado: true; resultado: T }
  | { ejecutado: false; motivo: 'repetida'; resultado: T }
  | { ejecutado: false; motivo: 'en-curso' }
  | { ejecutado: false; motivo: 'llave-reusada-con-otro-cuerpo' }

/**
 * Ejecuta una acción **como mucho una vez** por identidad.
 *
 * `en-curso` no es un error: es la respuesta correcta al doble clic, y quien
 * llama debe responder «se está procesando», nunca «falló». Decirle «falló» al
 * usuario en mitad de una acción que sí va a completarse es lo que provoca el
 * tercer clic.
 */
export async function ejecutarUnaVez<T>(
  almacen: AlmacenIdempotencia,
  clave: string,
  cuerpo: unknown,
  ahoraMs: number,
  accion: () => Promise<T>,
): Promise<ResultadoUnaVez<T>> {
  const huella = huellaDe(cuerpo)
  const { nuevo, existente } = await almacen.reservar({
    clave, estado: 'en-curso', huella, creadoEnMs: ahoraMs,
  })

  if (!nuevo && existente) {
    if (existente.huella !== huella) return { ejecutado: false, motivo: 'llave-reusada-con-otro-cuerpo' }
    if (existente.estado === 'en-curso') return { ejecutado: false, motivo: 'en-curso' }
    if (existente.estado === 'completada') {
      return { ejecutado: false, motivo: 'repetida', resultado: existente.resultado as T }
    }
    // Un asiento FALLIDO se puede reintentar: el efecto no llegó a ocurrir, y
    // negarlo para siempre dejaría al usuario sin poder repetir una acción que
    // nunca sucedió.
  }

  try {
    const resultado = await accion()
    await almacen.cerrar(clave, 'completada', resultado)
    return { ejecutado: true, resultado }
  } catch (e) {
    await almacen.cerrar(clave, 'fallida')
    throw e
  }
}
