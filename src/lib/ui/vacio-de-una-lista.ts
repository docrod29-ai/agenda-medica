/**
 * RTC-30, DICHO UNA SOLA VEZ — QUÉ DICE UNA LISTA CUANDO NO ENSEÑA NINGUNA FILA.
 *
 * ── POR QUÉ ESTE MÓDULO EXISTE ──────────────────────────────────────────────
 *
 * La regla se descubrió tres veces seguidas, en tres pantallas distintas, y
 * las tres veces se escribió entera de nuevo:
 *
 *   · Hoy       (14-ago) — el vacío ilustrado pesaba 250px por encima de dos
 *                          pendientes críticos.
 *   · `/citas`  (REG-314) — decía «no hay citas» sobre un día con seis, y
 *                          ofrecía agendar encima de las que escondía.
 *   · `/pacientes` (REG-315) — tres párrafos grises, ninguno decía cuántos
 *                          expedientes había fuera, ninguno traía un control.
 *
 * De las tres salió UNA frase:
 *
 *   > Todo vacío dice cuántos hay FUERA de lo que se está mirando, y el gesto
 *   > sale de la CAUSA. Sólo el registro entero vacío conserva el héroe y
 *   > ofrece crear: ofrecer crear sobre lo que un filtro esconde es invitar al
 *   > duplicado.
 *
 * Escribirla una cuarta vez a mano —quedan `/farmacia`, `/reactivacion` y la
 * bitácora de `/cumplimiento`— sería la cuarta copia de la misma decisión, y
 * este repositorio tiene un invariante contra eso: la misma entidad se PINTA
 * distinto según dónde se mire, pero no se decide dos veces. Aquí se decide.
 *
 * ── LO QUE ESTE MÓDULO DECIDE, Y LO QUE NO ──────────────────────────────────
 *
 * DECIDE: la clase del vacío · su PESO (héroe sólo cuando el vacío ES la
 * pantalla) · que el recuento de lo que queda fuera aparezca SIEMPRE · que el
 * gesto de alta NUNCA se ofrezca por encima de filas escondidas · qué gestos
 * de liberación salen y en qué orden.
 *
 * NO DECIDE: cómo se llama cada restricción ni cómo se dice. Esa frase es del
 * dominio de cada pantalla —«3 pidieron no recibir mensajes» no lo puede
 * inventar un módulo genérico— y por eso entra, no se calcula.
 *
 * NO SE TOCAN los dos módulos que nacieron antes (`vacio-de-la-agenda`,
 * `vacio-de-la-lista`): los dos llevan conocimiento que aquí no cabe —los
 * parecidos por nombre, el día siguiente— y los dos están medidos en
 * navegador. Convertirlos sin volver a medir sería exactamente el error que
 * esta familia de defectos existe para evitar. Quedan como los dos casos
 * especiales, y este módulo como el caso general.
 *
 * ── UNA RESTRICCIÓN QUE NO SE PUEDE SOLTAR SIGUE SIENDO UNA CAUSA ───────────
 *
 * `/reactivacion` obligó a que `gesto` pueda ser `null`. Ahí lo que deja la
 * lista vacía no siempre es un filtro: es que el paciente pidió la baja, que
 * ejerció su derecho ARCO, que ya tiene cita, o que no tiene teléfono. Nada de
 * eso se «quita» con un botón — pero seguir sin decirlo es lo que hacía que la
 * pantalla felicitara al médico («¡Buen seguimiento!») por una lista que en
 * realidad estaba llena de gente a la que no se puede escribir.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore.
 */

export interface RestriccionDeLista {
  /** Para que la pantalla reconozca su propio gesto al recibirlo de vuelta. */
  id: string
  /**
   * Cómo se dice la causa, ya conjugada y con su recuento si lo tiene:
   * «la búsqueda “amox”», «3 pidieron no recibir mensajes».
   */
  frase: string
  /**
   * La etiqueta del control que la suelta, o `null` cuando no hay ninguno que
   * pueda soltarla. `null` NO es «no se dice»: se dice igual, sin botón.
   */
  gesto: string | null
}

export interface EstadoDeUnaLista {
  /**
   * Cuántos elementos hay en el conjunto del que habla la pantalla, SIN
   * aplicar ninguna de las restricciones. Es el número que la regla exige
   * decir y el que nadie decía.
   */
  total: number
  /** Cómo se nombran los elementos: `['ítem', 'ítems']`. */
  sustantivo: [singular: string, plural: string]
  /** Las restricciones ACTIVAS. Vacío = no hay ninguna y aun así no hay filas. */
  restricciones: RestriccionDeLista[]
  /**
   * Qué dice la pantalla cuando de verdad no hay nada que mirar. Es lo único
   * que un módulo general no puede saber: «No hay pacientes registrados» y
   * «Aún no tienes ítems en farmacia» son la misma clase y distinta frase.
   */
  registroVacio: { titulo: string; descripcion: string; gesto?: string }
}

export type ClaseDeVacioDeLista =
  /** No hay nada. El vacío ES la pantalla. */
  | 'registro-vacio'
  /** Hay elementos y las restricciones activas los dejan todos fuera. */
  | 'ocultos-por-restriccion'
  /**
   * Hay elementos, no se ve ninguno, y quien llama no declaró ninguna causa.
   * Es un defecto de quien llama y NO se disimula con una frase amable.
   */
  | 'sin-causa-declarada'

export interface VacioDeUnaLista {
  clase: ClaseDeVacioDeLista
  /** RTC-30: un bloque sin contenido no pesa más que uno con trabajo dentro. */
  variante: 'hero' | 'linea'
  titulo: string
  descripcion: string
  /** Los gestos que corresponden a la CAUSA, en el orden en que entraron. */
  gestos: { id: string; etiqueta: string }[]
}

/** «1 ítem» · «24 ítems». */
export function contar(n: number, [uno, varios]: [string, string]): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/** «a», «a y b», «a, b y c» — para enumerar causas sin sonar a máquina. */
export function enumerarEsMx(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

export function describirVacioDeUnaLista(e: EstadoDeUnaLista): VacioDeUnaLista {
  /*
    EL ORDEN NO ES ARBITRARIO: primero se pregunta por el conjunto entero.

    Con cero elementos, filtrar y buscar son gestos sobre nada, y la frase
    correcta es la de una pantalla que todavía no tiene trabajo dentro — no
    «tus filtros no dejan ver nada». Es el único caso en que el héroe y el
    gesto de alta son correctos, y por eso es el único que los lleva.
  */
  if (e.total <= 0) {
    return {
      clase: 'registro-vacio',
      variante: 'hero',
      titulo: e.registroVacio.titulo,
      descripcion: e.registroVacio.descripcion,
      gestos: e.registroVacio.gesto
        ? [{ id: 'alta', etiqueta: e.registroVacio.gesto }]
        : [],
    }
  }

  const hay = `Hay ${contar(e.total, e.sustantivo)} fuera de lo que estás mirando.`

  if (e.restricciones.length === 0) {
    /*
      SE DICE LO QUE SE SABE. Llegar aquí significa que la pantalla esconde
      filas sin declarar por qué; inventarle una causa plausible sería
      exactamente el defecto que esta familia repara. Se dice el número —que
      es cierto— y se calla el motivo, que no se conoce.
    */
    return {
      clase: 'sin-causa-declarada',
      variante: 'linea',
      titulo: hay,
      descripcion: 'No se está enseñando ninguno y esta pantalla no sabe decir por qué.',
      gestos: [],
    }
  }

  return {
    clase: 'ocultos-por-restriccion',
    variante: 'linea',
    titulo: hay,
    /*
      LAS CAUSAS, TODAS. También las que no se pueden soltar: saber que tres
      pacientes pidieron no recibir mensajes es la mitad de la respuesta, y es
      justo la mitad que se perdía cuando la pantalla sólo pintaba los botones
      que tenía a mano.
    */
    descripcion: `${enumerarEsMx(e.restricciones.map(r => r.frase))}.`,
    /*
      NUNCA EL GESTO DE ALTA. Ofrecer crear encima de lo que una restricción
      esconde es invitar al duplicado: un expediente partido en `/pacientes`,
      una cita encima de otras seis en `/citas`, un lote repetido en farmacia.
    */
    gestos: e.restricciones
      .filter((r): r is RestriccionDeLista & { gesto: string } => !!r.gesto)
      .map(r => ({ id: r.id, etiqueta: r.gesto })),
  }
}
