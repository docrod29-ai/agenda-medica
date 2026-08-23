/**
 * EL CORTACIRCUITOS — dejar de llamar a un proveedor que ya no responde.
 *
 * ── POR QUÉ HACE FALTA ───────────────────────────────────────────────────────
 *
 * `fetchConTimeout` impide que UNA llamada se quede colgada. No impide que
 * DOSCIENTAS llamadas se cuelguen a la vez. Cuando el proveedor de IA se cae,
 * cada consulta abierta espera sus 60 segundos completos antes de enterarse: el
 * médico ve una rueda girando un minuto entero, el lambda se factura, y el
 * proveedor —que se estaba recuperando— recibe el mismo tráfico que lo tumbó.
 *
 * El cortacircuitos convierte «60 segundos de espera» en «esto está caído, aquí
 * tienes el modo limitado» en cuanto hay evidencia suficiente. Fallar rápido y
 * en voz alta es mejor producto que fallar despacio y en silencio.
 *
 * ── LOS TRES ESTADOS ─────────────────────────────────────────────────────────
 *
 *   CERRADO   — se llama con normalidad; se cuentan los fallos.
 *   ABIERTO   — no se llama: se responde «no disponible» al instante.
 *   MEDIO     — pasado el descanso, se deja pasar UNA llamada de prueba.
 *               Si sale bien se cierra; si falla, se vuelve a abrir.
 *
 * El estado MEDIO es el que evita el peor error de esta figura: reabrir de
 * golpe contra un proveedor que sigue caído y tumbarlo otra vez con la manada
 * entera de reintentos acumulados.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE ─────────────────────────────────────────────
 *
 * No decide qué se le enseña al médico. Eso ya lo hace
 * `src/lib/ia/fallo-proveedor.ts`, que sabe quién paga la llave y por tanto a
 * quién le toca arreglarlo. Aquí sólo se decide si se llama o no se llama.
 *
 * Módulo PURO y sin estado global: el reloj se inyecta y el estado se devuelve.
 * Un cortacircuitos con reloj propio no se puede probar; uno con estado global
 * se contamina entre pruebas y entre inquilinos.
 */

export type EstadoCircuito = 'cerrado' | 'abierto' | 'medio'

export interface ConfiguracionCircuito {
  /** Fallos consecutivos que abren el circuito. */
  fallosParaAbrir: number
  /** Cuánto se queda abierto antes de dejar pasar la llamada de prueba. */
  descansoMs: number
  /** Éxitos consecutivos en MEDIO que lo cierran del todo. */
  exitosParaCerrar: number
}

export const CIRCUITO_POR_DEFECTO: ConfiguracionCircuito = {
  fallosParaAbrir: 5,
  descansoMs: 30_000,
  exitosParaCerrar: 2,
}

/**
 * El estado, como VALOR. Se guarda donde convenga (memoria del proceso,
 * Firestore, lo que sea) sin que este módulo tenga que saberlo.
 */
export interface Circuito {
  /** Quién es: proveedor + clase de trabajo. Nunca un identificador de paciente. */
  clave: string
  estado: EstadoCircuito
  fallosSeguidos: number
  exitosSeguidos: number
  /** Instante en que se abrió, en ms epoch. `null` si nunca se abrió. */
  abiertoDesdeMs: number | null
}

export function circuitoNuevo(clave: string): Circuito {
  return { clave, estado: 'cerrado', fallosSeguidos: 0, exitosSeguidos: 0, abiertoDesdeMs: null }
}

/**
 * ¿Se puede llamar ahora?
 *
 * Devuelve también el circuito, porque pasar de ABIERTO a MEDIO es una
 * transición que ocurre AL PREGUNTAR (por el paso del tiempo), no al fallar.
 * Devolver sólo un booleano obligaría a quien llama a recalcular el estado, y
 * ahí es donde dos sitios acaban discrepando.
 */
export function permitirLlamada(
  circuito: Circuito,
  ahoraMs: number,
  cfg: ConfiguracionCircuito = CIRCUITO_POR_DEFECTO,
): { permitido: boolean; circuito: Circuito; motivo: 'cerrado' | 'prueba' | 'abierto' } {
  if (circuito.estado === 'cerrado') {
    return { permitido: true, circuito, motivo: 'cerrado' }
  }
  if (circuito.estado === 'medio') {
    // En MEDIO pasa UNA prueba a la vez. La siguiente espera al veredicto de
    // ésta: dejar pasar dos pruebas simultáneas contra un proveedor caído es
    // exactamente el tráfico que se quería evitar.
    return { permitido: true, circuito, motivo: 'prueba' }
  }
  const descansado = circuito.abiertoDesdeMs !== null && ahoraMs - circuito.abiertoDesdeMs >= cfg.descansoMs
  if (descansado) {
    return {
      permitido: true,
      circuito: { ...circuito, estado: 'medio', exitosSeguidos: 0 },
      motivo: 'prueba',
    }
  }
  return { permitido: false, circuito, motivo: 'abierto' }
}

/** Se registra un éxito. En MEDIO acerca el cierre; en CERRADO limpia la cuenta. */
export function registrarExito(
  circuito: Circuito,
  cfg: ConfiguracionCircuito = CIRCUITO_POR_DEFECTO,
): Circuito {
  if (circuito.estado === 'medio') {
    const exitos = circuito.exitosSeguidos + 1
    if (exitos >= cfg.exitosParaCerrar) return circuitoNuevo(circuito.clave)
    return { ...circuito, exitosSeguidos: exitos, fallosSeguidos: 0 }
  }
  return { ...circuito, fallosSeguidos: 0, exitosSeguidos: 0 }
}

/**
 * Se registra un fallo.
 *
 * Un fallo en MEDIO reabre INMEDIATAMENTE, sin volver a contar hasta
 * `fallosParaAbrir`: la llamada de prueba ya es la evidencia y volver a contar
 * cinco fallos sería mandar cinco llamadas más contra algo que acaba de decir
 * que sigue caído.
 */
export function registrarFallo(
  circuito: Circuito,
  ahoraMs: number,
  cfg: ConfiguracionCircuito = CIRCUITO_POR_DEFECTO,
): Circuito {
  if (circuito.estado === 'medio') {
    return { ...circuito, estado: 'abierto', abiertoDesdeMs: ahoraMs, fallosSeguidos: circuito.fallosSeguidos + 1, exitosSeguidos: 0 }
  }
  const fallos = circuito.fallosSeguidos + 1
  if (fallos >= cfg.fallosParaAbrir) {
    return { ...circuito, estado: 'abierto', abiertoDesdeMs: ahoraMs, fallosSeguidos: fallos, exitosSeguidos: 0 }
  }
  return { ...circuito, fallosSeguidos: fallos, exitosSeguidos: 0 }
}

/**
 * La clave de un circuito.
 *
 * PROVEEDOR + CLASE DE TRABAJO, nunca inquilino ni paciente. Dos razones:
 *
 *  · un circuito por inquilino no aprende nada — cada consultorio tendría que
 *    descubrir por su cuenta que el proveedor está caído, uno a uno;
 *  · una clave con identificador de paciente sería PHI en telemetría y en
 *    cualquier volcado de estado.
 *
 * Que sea global por proveedor también significa que un consultorio no puede
 * abrirle el circuito a otro por su propia mala red: por eso la apertura exige
 * fallos SEGUIDOS y no una tasa, y por eso el estado MEDIO existe.
 */
export function claveDeCircuito(proveedor: string, clase: string): string {
  return `${proveedor}::${clase}`
}
