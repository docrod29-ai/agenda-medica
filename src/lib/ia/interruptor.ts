/**
 * INTERRUPTOR DE CIRCUITO — dejar de llamar a un proveedor que ya no contesta.
 *
 * ── QUÉ FALTABA (P1-15) ──────────────────────────────────────────────────────
 *
 * `fetchConTimeout` impide que UNA llamada cuelgue la función. No impide que las
 * MIL SIGUIENTES vuelvan a pagar el timeout entero contra un proveedor que
 * lleva minutos caído.
 *
 * Con Anthropic devolviendo 529, cada consulta que empieza espera 60 segundos
 * para acabar diciendo «no se pudo». Diez médicos a la vez son diez lambdas
 * ocupadas un minuto cada una, facturadas por GB-segundo, y diez médicos con el
 * paciente enfrente mirando una barra de progreso que ya se sabe cómo termina.
 *
 * Peor todavía: la avalancha de reintentos es exactamente lo que impide que un
 * proveedor sobrecargado se recupere.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Tras varios fallos seguidos **del proveedor**, se deja de llamar durante un
 * rato y se falla RÁPIDO. Pasado el enfriamiento se deja pasar **una sola
 * llamada de prueba**: si contesta, se cierra el circuito; si no, se vuelve a
 * abrir con un enfriamiento mayor.
 *
 * ── LO QUE ABRE EL CIRCUITO, Y LO QUE NO — AQUÍ VIVE EL AISLAMIENTO ─────────
 *
 * Sólo abren el circuito los fallos que dicen **«el proveedor no está»**:
 * su 5xx y el tiempo agotado.
 *
 * **NO lo abren** —y esto no es un detalle de afinación, es aislamiento entre
 * consultorios—:
 *
 *  · `llave` (401/403). Una llave revocada es de QUIEN la puso. Si abriera el
 *    circuito, **un consultorio con su llave mal escrita dejaría sin IA a todos
 *    los demás**. Es la fuga más silenciosa que puede tener un interruptor: no
 *    mueve datos de un consultorio a otro, mueve la CAÍDA.
 *  · `saldo` (402). Igual: es el saldo de una cuenta, no la salud del proveedor.
 *  · `limite` (429). Es el límite de una llave, y además contesta rápido: abrir
 *    el circuito no ahorraría nada y cortaría un servicio que sí funciona.
 *  · `modelo` (400/404). El proveedor está perfectamente; lo que no existe es
 *    ese modelo para esa llave. Para eso está la cascada.
 *
 * Y por el mismo motivo la llave forma parte de la CLAVE del circuito: el de la
 * plataforma y el de cada consultorio son circuitos distintos. Compartirlos
 * dejaría que el problema de uno apagara a los otros.
 *
 * ── LO QUE ESTE MÓDULO NO ES ────────────────────────────────────────────────
 *
 * **No es un interruptor global.** El estado vive en memoria del proceso, así
 * que en un despliegue sin servidor cada instancia caliente tiene el suyo.
 * Sirve —cada instancia deja de castigar al proveedor y de hacer esperar a su
 * médico— pero **no** garantiza que ninguna instancia lo intente: la primera de
 * cada instancia paga su timeout. Hacerlo global exigiría una lectura
 * compartida por llamada, que es un coste fijo en el camino de una nota
 * clínica para arreglar un caso raro.
 *
 * Se dice aquí porque un interruptor del que se cree que es global, y no lo es,
 * hace tomar decisiones equivocadas sobre las alertas.
 *
 * Núcleo PURO: `decidir` y `siguienteEstado` no tocan reloj, red ni memoria.
 * El registro con estado vive abajo y se puede vaciar en pruebas.
 */

/** Clases de fallo del protocolo de IA que este módulo distingue. */
export type ClaseFalloIA = 'llave' | 'limite' | 'saldo' | 'proveedor' | 'modelo' | 'red' | 'respuesta'

/** Fallos consecutivos que abren el circuito. */
export const FALLOS_PARA_ABRIR = 3
/** Enfriamiento inicial, en ms. Corto: un 529 suele pasar en segundos. */
export const ENFRIAMIENTO_BASE_MS = 20_000
/** Tope del enfriamiento. Más allá, el médico merece que se vuelva a intentar. */
export const ENFRIAMIENTO_MAX_MS = 5 * 60_000

/**
 * ¿Este fallo dice que el PROVEEDOR no está?
 *
 * Es la pregunta que decide todo lo demás, y por eso está sola y con nombre.
 */
export function esFalloDelProveedor(clase: ClaseFalloIA): boolean {
  return clase === 'proveedor' || clase === 'red'
}

export type EstadoCircuito =
  /** Se llama con normalidad. */
  | { fase: 'cerrado'; fallosSeguidos: number }
  /** No se llama: se falla rápido hasta `hasta`. */
  | { fase: 'abierto'; hasta: number; enfriamientoMs: number }
  /** Se deja pasar UNA llamada de prueba. */
  | { fase: 'probando'; enfriamientoMs: number }

export const CERRADO: EstadoCircuito = { fase: 'cerrado', fallosSeguidos: 0 }

/**
 * ¿Se puede llamar ahora?
 *
 * PURO: recibe el estado y el instante, y devuelve el estado con el que hay que
 * seguir. Que el paso de `abierto` a `probando` ocurra AQUÍ —y no en un
 * temporizador— es lo que permite probarlo sin esperar de verdad.
 */
export function decidir(
  estado: EstadoCircuito, ahoraMs: number,
): { pasa: boolean; estado: EstadoCircuito; esPrueba: boolean } {
  if (estado.fase === 'cerrado') return { pasa: true, estado, esPrueba: false }
  if (estado.fase === 'probando') {
    /**
     * Ya hay una prueba en vuelo. Las demás se rechazan: dejar pasar varias
     * convierte la prueba en la avalancha que el interruptor existe para evitar.
     */
    return { pasa: false, estado, esPrueba: false }
  }
  if (ahoraMs < estado.hasta) return { pasa: false, estado, esPrueba: false }
  return { pasa: true, estado: { fase: 'probando', enfriamientoMs: estado.enfriamientoMs }, esPrueba: true }
}

/**
 * El estado después de un intento.
 *
 * `clase` es `null` cuando la llamada salió bien.
 */
export function siguienteEstado(
  estado: EstadoCircuito, clase: ClaseFalloIA | null, ahoraMs: number,
): EstadoCircuito {
  if (clase === null) return CERRADO   // contestó: se cierra y se olvida lo anterior

  if (!esFalloDelProveedor(clase)) {
    /**
     * Un fallo que NO es del proveedor no cuenta para abrir **ni cierra un
     * circuito abierto**. Si la prueba se topa con un 401, no se ha aprendido
     * nada sobre si el proveedor volvió: se deja el circuito como estaba, con
     * su enfriamiento, en vez de cerrarlo por un error que no lo desmiente.
     */
    if (estado.fase === 'probando') {
      return { fase: 'abierto', hasta: ahoraMs + estado.enfriamientoMs, enfriamientoMs: estado.enfriamientoMs }
    }
    return estado
  }

  if (estado.fase === 'probando') {
    // La prueba falló: se vuelve a abrir, y el doble de tiempo (con tope).
    const siguiente = Math.min(estado.enfriamientoMs * 2, ENFRIAMIENTO_MAX_MS)
    return { fase: 'abierto', hasta: ahoraMs + siguiente, enfriamientoMs: siguiente }
  }

  if (estado.fase === 'abierto') {
    // No debería llegar aquí (no se llamó), pero si llega no se alarga solo.
    return estado
  }

  const fallos = estado.fallosSeguidos + 1
  if (fallos < FALLOS_PARA_ABRIR) return { fase: 'cerrado', fallosSeguidos: fallos }
  return { fase: 'abierto', hasta: ahoraMs + ENFRIAMIENTO_BASE_MS, enfriamientoMs: ENFRIAMIENTO_BASE_MS }
}

/**
 * LA CLAVE DEL CIRCUITO — proveedor + de quién es la llave.
 *
 * Con llave de la plataforma el circuito es uno solo, porque la llave es una
 * sola. Con llave del consultorio hay uno por consultorio: su proveedor puede
 * estar caído para él y no para los demás, y sobre todo **su problema no puede
 * apagar a nadie más**.
 */
export function claveCircuito(proveedor: string, fuente: string, clinicId: string | null): string {
  return fuente === 'clinica' ? `${proveedor}:clinica:${clinicId ?? 'sin-clinica'}` : `${proveedor}:plataforma`
}

/* ── Registro con estado. Lo único que no es puro. ───────────────────────── */

const circuitos = new Map<string, EstadoCircuito>()

/** El estado de un circuito, sin modificarlo. Para diagnóstico y pruebas. */
export function estadoDe(clave: string): EstadoCircuito {
  return circuitos.get(clave) ?? CERRADO
}

/**
 * ¿Se puede llamar? Avanza el estado si toca (abierto → probando).
 */
export function permiteLlamar(clave: string, ahoraMs = Date.now()): { pasa: boolean; esPrueba: boolean } {
  const d = decidir(estadoDe(clave), ahoraMs)
  circuitos.set(clave, d.estado)
  return { pasa: d.pasa, esPrueba: d.esPrueba }
}

/** Registra el resultado de un intento. `clase` null = salió bien. */
export function anotarResultado(clave: string, clase: ClaseFalloIA | null, ahoraMs = Date.now()): void {
  circuitos.set(clave, siguienteEstado(estadoDe(clave), clase, ahoraMs))
}

/** Vacía todos los circuitos. Sólo para pruebas y para el arranque. */
export function olvidarCircuitos(): void {
  circuitos.clear()
}

/** Cuántos circuitos hay abiertos ahora. Para observabilidad. */
export function circuitosAbiertos(ahoraMs = Date.now()): string[] {
  return [...circuitos.entries()]
    .filter(([, e]) => e.fase === 'abierto' && ahoraMs < e.hasta)
    .map(([k]) => k)
}

export const POR_QUE_NO_ABRE_CON_UNA_LLAVE_MALA =
  'Una llave revocada es de quien la puso. Si abriera el circuito, un ' +
  'consultorio con su llave mal escrita dejaría sin IA a todos los demás: no ' +
  'mueve datos de un consultorio a otro, mueve la CAÍDA. Por eso sólo abren el ' +
  'circuito los fallos que dicen que el PROVEEDOR no está, y por eso la llave ' +
  'forma parte de la clave del circuito.'
