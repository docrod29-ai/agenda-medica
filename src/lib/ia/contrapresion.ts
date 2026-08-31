/**
 * CONTRAPRESIÓN — lo que falta cuando el proveedor no está caído, sino saturado.
 *
 * ── LA DISTINCIÓN QUE HACE FALTA (WS-04) ─────────────────────────────────────
 *
 * El interruptor de circuito (REG-353) resuelve un proveedor **caído**: falla
 * rápido en vez de que la llamada 60 vuelva a esperar sesenta segundos para
 * llegar a la misma conclusión que las 59 anteriores.
 *
 * No resuelve un proveedor **lento**. Ahí cada llamada acaba contestando, así
 * que el circuito nunca se abre — y mientras tanto se acumulan peticiones en
 * vuelo, cada una ocupando su función durante lo que dure. El precedente está
 * documentado en este repositorio: un socket colgado inmovilizó una lambda de
 * 300 segundos, y `procesar` corre en **800**.
 *
 * ── LA DECISIÓN: SE RECHAZA, NO SE ENCOLA ───────────────────────────────────
 *
 * Aquí no hay cola, **y es a propósito**.
 *
 * La regla que gobierna este archivo es que **una operación clínica nunca puede
 * parecer completada si sólo quedó encolada**. Una nota que el médico está
 * esperando, metida en una cola detrás de otras cincuenta, es exactamente eso:
 * la pantalla diría «procesando» y lo que hay es una espera sin fondo, con el
 * paciente enfrente.
 *
 * Así que cuando no hay sitio se contesta **ahora y con la verdad**: «no puedo
 * atenderte en este momento, vuelve a intentarlo». El médico decide si reintenta
 * o si escribe a mano — que es una decisión suya, no del sistema.
 *
 * Encolar sería lo correcto para un trabajo que a nadie le urge y que nadie está
 * mirando; para eso están el outbox de WhatsApp y la cola de la bitácora, que
 * son durables **porque nadie los espera delante de una pantalla**.
 *
 * ── POR QUÉ EL TOPE ES POR INSTANCIA, Y QUÉ SIGNIFICA ───────────────────────
 *
 * Igual que el interruptor: el estado vive en memoria del proceso. Con N
 * instancias calientes el tope efectivo es N×TOPE. Hacerlo global costaría una
 * lectura compartida **en el camino de una nota**, que es justo el sitio donde no
 * se puede pagar. Se declara en vez de disimularse.
 *
 * Lo que sí garantiza: que **una** instancia no acumule cien peticiones en vuelo
 * contra un proveedor que tarda un minuto en contestar.
 *
 * ── LA CIFRA, Y DE DÓNDE SALE ───────────────────────────────────────────────
 *
 * No es clínica: es de operación. Sale del propio producto — `maxDuration` de la
 * ruta de la nota es 800 s y el presupuesto de la operación de IA es del orden de
 * decenas de segundos, así que un puñado de peticiones simultáneas por instancia
 * cubre el uso real de un consultorio sin dejar que una instancia se llene de
 * esperas. Se declara aquí para que se pueda discutir con un número delante.
 */

/**
 * Peticiones en vuelo que una instancia acepta por proveedor.
 *
 * No es una cifra clínica. Ver la cabecera: sale del uso real de un consultorio
 * y del presupuesto de tiempo de la operación, no de una tabla médica.
 */
export const EN_VUELO_MAXIMO = 8

/** Cuántas hay ahora mismo, por clave. Estado de proceso, no compartido. */
const enVuelo = new Map<string, number>()

/** La clave separa proveedores: que Anthropic vaya lento no puede cerrar OpenAI. */
export function claveDeContrapresion(proveedor: string): string {
  return `iav:${proveedor}`
}

export interface Admision {
  /** ¿Hay sitio? */
  readonly pasa: boolean
  /** Cuántas había en vuelo al preguntar. Para poder decirlo, no para adivinarlo. */
  readonly enVuelo: number
}

/**
 * Pide sitio. Si lo hay, lo **ocupa** — quien llame tiene que soltarlo.
 *
 * Devuelve el conteo para que el llamador pueda registrarlo: una saturación que
 * no queda en ningún sitio se convierte en «a veces va lento» y nadie la
 * encuentra.
 */
export function pedirSitio(clave: string, tope = EN_VUELO_MAXIMO): Admision {
  const actual = enVuelo.get(clave) ?? 0
  if (actual >= tope) return { pasa: false, enVuelo: actual }
  enVuelo.set(clave, actual + 1)
  return { pasa: true, enVuelo: actual + 1 }
}

/**
 * Suelta el sitio. **Se llama siempre**, también cuando la llamada falla.
 *
 * Es la trampa de todo contador de este tipo: soltar sólo en el camino de éxito
 * deja el contador subiendo para siempre y, al cabo de un rato, la instancia
 * rechaza todo sin que haya nada en vuelo. Por eso quien lo usa va con `finally`
 * y hay una prueba que lo comprueba.
 */
export function soltarSitio(clave: string): void {
  const actual = enVuelo.get(clave) ?? 0
  if (actual <= 1) enVuelo.delete(clave)
  else enVuelo.set(clave, actual - 1)
}

/** Para las pruebas y para un reinicio limpio. */
export function reiniciarContrapresion(): void {
  enVuelo.clear()
}

/** Cuántas hay en vuelo. Se expone para poder DECIRLO, no para decidir con ello. */
export function enVueloAhora(clave: string): number {
  return enVuelo.get(clave) ?? 0
}

export const POR_QUE_NO_SE_ENCOLA =
  'Porque una operación clínica no puede parecer completada si sólo quedó ' +
  'encolada. Una nota que el médico está esperando, metida detrás de otras ' +
  'cincuenta, es una espera sin fondo con el paciente enfrente: la pantalla diría ' +
  '«procesando» y no habría nada procesándose. Se contesta ahora y con la verdad, ' +
  'y el médico decide. Encolar es lo correcto para lo que nadie mira —el outbox de ' +
  'WhatsApp, la bitácora—, y por eso ésos sí son durables.'

export const POR_QUE_POR_INSTANCIA =
  'El estado vive en memoria del proceso, igual que el interruptor. Con N ' +
  'instancias calientes el tope efectivo es N×TOPE. Hacerlo global costaría una ' +
  'lectura compartida en el camino de una nota, que es donde no se puede pagar. Lo ' +
  'que sí garantiza es que UNA instancia no acumule cien esperas contra un ' +
  'proveedor lento.'
