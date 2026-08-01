/**
 * QUÉ SE LE DICE AL MÉDICO CUANDO LA IA FALLA — y a quién le toca arreglarlo.
 *
 * ── EL INCIDENTE QUE LO ORIGINA (31-jul-2026) ────────────────────────────────
 *
 * Se rotó la llave de Anthropic. La app siguió usando la llave vieja guardada en
 * el consultorio, y todas las rutas de IA empezaron a fallar. El médico —con un
 * paciente enfrente y una nota dictada a medias— vio esto:
 *
 *     «No pude responder ahora; intenta de nuevo.»
 *
 * Es la peor frase posible, por tres razones:
 *
 *  1. **Miente sobre la causa.** No es transitorio: la llave está muerta y va a
 *     seguir muerta. «Intenta de nuevo» invita a repetir algo que no puede salir
 *     bien, con un paciente esperando.
 *  2. **No dice quién lo arregla.** Si la llave es del consultorio, el médico
 *     puede resolverlo en un minuto en Configuración. Si es la de la plataforma,
 *     no hay NADA que pueda hacer y decirle «intenta de nuevo» lo pone a perder
 *     el tiempo en su propia consulta.
 *  3. **Nadie se entera.** El dueño no supo que su producto llevaba horas caído
 *     hasta que lo probó a mano.
 *
 * ── LA REGLA QUE PIDIÓ EL DUEÑO, LITERAL ─────────────────────────────────────
 *
 * «No quiero que a mis clientes les pase eso, está prohibido; tú debes avisarme
 * si tengo que pagar o esas cosas.»
 *
 * De ahí salen las dos invariantes de este módulo:
 *
 *  · **Con llave de la PLATAFORMA, al médico jamás se le echa la culpa ni se le
 *    manda a pagar.** No es su llave, no es su saldo y no es su problema. Se le
 *    dice la verdad —el servicio no está disponible—, se le dice que su trabajo
 *    está guardado, y el aviso urgente le llega AL DUEÑO.
 *  · **Con llave DEL CONSULTORIO sí se le dice exactamente qué pasó**, porque
 *    ahí sí puede arreglarlo él y ocultárselo sería dejarlo a ciegas sobre algo
 *    que sí controla.
 *
 * Módulo PURO: clasifica y redacta. No llama a nadie, no escribe en ningún lado.
 */

/** Qué salió mal, en términos de qué hay que hacer al respecto. */
export type ClaseFallo =
  /** La llave no existe o fue revocada. NO se arregla reintentando. */
  | 'llave_invalida'
  /** La llave sirve, pero la cuenta no tiene saldo. NO se arregla reintentando. */
  | 'sin_saldo'
  /** Demasiadas llamadas por minuto. Se arregla esperando. */
  | 'limite_tasa'
  /** El proveedor está saturado. Se arregla esperando. */
  | 'sobrecarga'
  /** Se acabó el tiempo de espera. Puede ser la red o una respuesta muy larga. */
  | 'timeout'
  /** Cualquier otra cosa. */
  | 'otro'

/** Quién paga esta llamada, que es lo mismo que decir a quién le toca arreglarla. */
export type QuienPaga = 'clinica' | 'plataforma'

/**
 * De la fuente de la llave a quién paga.
 *
 * `'clinica'` es el consultorio con su propia llave. `'prueba'` y `'fundador'`
 * corren sobre la llave del dueño: la plataforma. `'ninguna'` también cuenta como
 * plataforma — no hay llave que configurar del lado del médico.
 */
export function quienPaga(fuente: string): QuienPaga {
  return fuente === 'clinica' ? 'clinica' : 'plataforma'
}

/**
 * Clasifica la respuesta de Anthropic u OpenAI.
 *
 * El código HTTP no basta y por eso también se mira el cuerpo:
 *  · Anthropic devuelve **400** con `credit balance is too low` cuando se acabó
 *    el saldo — un 400 que NO es «petición mal formada».
 *  · OpenAI devuelve **429** tanto para «vas muy rápido» como para
 *    `insufficient_quota` (se acabó el saldo). Confundirlos manda a esperar a
 *    alguien que en realidad tiene que ir a pagar.
 */
export function claseDeFallo(status: number, cuerpo?: string | null): ClaseFallo {
  const c = (cuerpo ?? '').toLowerCase()

  // El saldo se comprueba PRIMERO: viaja disfrazado de 400 y de 429.
  if (/credit balance is too low|insufficient_quota|insufficient quota|billing_hard_limit|exceeded your current quota/.test(c)) {
    return 'sin_saldo'
  }
  if (status === 401 || status === 403) return 'llave_invalida'
  if (/invalid[_ ]api[_ ]key|authentication_error|invalid x-api-key/.test(c)) return 'llave_invalida'
  if (status === 429) return 'limite_tasa'
  if (status === 529 || status === 503) return 'sobrecarga'
  if (status === 408 || status === 504) return 'timeout'
  return 'otro'
}

/** ¿Reintentar puede servir de algo? Falso para llave y saldo: son de gestión. */
export function seArreglaReintentando(clase: ClaseFallo): boolean {
  return clase !== 'llave_invalida' && clase !== 'sin_saldo'
}

const NOMBRE: Record<'anthropic' | 'openai' | 'assemblyai', string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  assemblyai: 'AssemblyAI',
}

export interface AvisoMedico {
  /** Lo que ve el médico. Nunca lo culpa si la llave no es suya. */
  texto: string
  /** ¿Tiene sentido ofrecerle un botón de "reintentar"? */
  reintentar: boolean
  /** ¿Puede arreglarlo él desde Configuración? Sólo con llave propia. */
  accionable: boolean
}

/**
 * El mensaje que ve el MÉDICO.
 *
 * Con llave de la plataforma nunca aparecen las palabras «tu llave», «saldo» ni
 * «paga»: no es suyo. Y siempre se le dice que su dictado está guardado, porque
 * ése es su miedo real cuando algo truena a media consulta.
 */
export function avisoAlMedico(
  clase: ClaseFallo,
  quien: QuienPaga,
  proveedor: 'anthropic' | 'openai' | 'assemblyai' = 'anthropic',
): AvisoMedico {
  const p = NOMBRE[proveedor]
  const reintentar = seArreglaReintentando(clase)

  if (quien === 'clinica') {
    const texto =
      clase === 'llave_invalida' ? `Tu llave de ${p} fue rechazada (ya no existe o fue revocada). Actualízala en Configuración → Llaves de IA. Tu dictado está guardado.`
      : clase === 'sin_saldo'    ? `Tu cuenta de ${p} se quedó sin saldo. Recarga en ${p} y vuelve a intentar. Tu dictado está guardado.`
      : clase === 'limite_tasa'  ? `${p} está limitando la velocidad de tu cuenta. Espera un minuto y vuelve a intentar. Tu dictado está guardado.`
      : clase === 'sobrecarga'   ? `${p} está saturado en este momento. Vuelve a intentar en un minuto. Tu dictado está guardado.`
      : clase === 'timeout'      ? `${p} tardó demasiado en responder. Vuelve a intentar. Tu dictado está guardado.`
      :                            `${p} devolvió un error inesperado. Vuelve a intentar. Tu dictado está guardado.`
    return { texto, reintentar, accionable: clase === 'llave_invalida' || clase === 'sin_saldo' }
  }

  /**
   * LLAVE DE LA PLATAFORMA — al médico no se le echa la culpa ni se le cobra.
   *
   * Ni «revisa tu llave» ni «recarga créditos»: no tiene llave que revisar y no
   * se quedó sin créditos. Se le dice qué pasa, que ya está avisado quien puede
   * arreglarlo, y que no perdió nada.
   */
  const texto = reintentar
    ? 'El servicio de IA no está disponible en este momento. Vuelve a intentar en un minuto — tu dictado está guardado y no se pierde nada.'
    : 'El servicio de IA está temporalmente fuera de servicio por un problema nuestro, no tuyo. Ya avisamos a soporte. Tu dictado está guardado: cuando vuelva, procesa la nota con el mismo material.'
  return { texto, reintentar, accionable: false }
}

export interface AvisoDueno {
  /** `true` = el producto está caído para clientes de pago. */
  urgente: boolean
  /** Titular corto para el tablero y la notificación. */
  titulo: string
  /** Qué tiene que hacer el dueño, en una frase, sin rodeos. */
  queHacer: string
}

/**
 * El aviso que le llega AL DUEÑO. `null` cuando no le toca a él.
 *
 * Un fallo sobre la llave del CONSULTORIO no es incidencia de plataforma: es del
 * cliente, y ya se le dijo en su pantalla. Meterlo en el tablero del dueño lo
 * llenaría de ruido ajeno y taparía lo que sí es suyo.
 */
export function avisoAlDueno(
  clase: ClaseFallo,
  quien: QuienPaga,
  proveedor: 'anthropic' | 'openai' | 'assemblyai' = 'anthropic',
): AvisoDueno | null {
  if (quien !== 'plataforma') return null
  const p = NOMBRE[proveedor]
  switch (clase) {
    case 'llave_invalida':
      return {
        urgente: true,
        titulo: `La llave de ${p} de la plataforma fue rechazada`,
        queHacer: `Toda la IA está caída para TODOS los consultorios que usan la llave de la plataforma. Genera una llave nueva en ${p} y actualiza la variable de entorno en Vercel.`,
      }
    case 'sin_saldo':
      return {
        urgente: true,
        titulo: `La cuenta de ${p} de la plataforma se quedó sin saldo`,
        queHacer: `Toda la IA está caída. Recarga saldo en ${p} y activa la recarga automática para que no vuelva a pasar.`,
      }
    case 'limite_tasa':
      return {
        urgente: false,
        titulo: `${p} está limitando la velocidad de la plataforma`,
        queHacer: `Si se repite, pide subir el límite de tasa en ${p} o sube de tier.`,
      }
    case 'sobrecarga':
      return { urgente: false, titulo: `${p} está saturado`, queHacer: 'Es del proveedor. Si dura, revisa su página de estado.' }
    case 'timeout':
      return { urgente: false, titulo: `${p} tardó demasiado`, queHacer: 'Revisa si coincide con notas muy largas o con una caída del proveedor.' }
    default:
      return { urgente: false, titulo: `${p} devolvió un error inesperado`, queHacer: 'Revisa los registros del despliegue.' }
  }
}

export const POR_QUE_EL_MENSAJE_DEPENDE_DE_QUIEN_PAGA =
  'Porque «intenta de nuevo» le miente al médico dos veces: le dice que es ' +
  'transitorio cuando la llave está muerta, y le deja creer que le toca a él ' +
  'cuando la llave es nuestra. Con un paciente enfrente eso es tiempo robado. ' +
  'La llave del consultorio la puede arreglar él en un minuto y hay que ' +
  'decírselo; la de la plataforma no la puede tocar y el aviso urgente le toca ' +
  'al dueño, no al cliente.'
