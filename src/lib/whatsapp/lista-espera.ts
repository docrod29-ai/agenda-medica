/**
 * A QUIÉN SE LE OFRECE UN HUECO QUE SE LIBERÓ.
 *
 * ── EL DESTIERRO SILENCIOSO ──────────────────────────────────────────────────
 *
 * Al ofrecer un hueco, la entrada de la lista pasaba a `contactado`, y la
 * consulta de ofertas futuras exigía `activo`. Un paciente que recibía UNA
 * oferta y no contestaba —estaba trabajando, no vio el mensaje, contestó tarde—
 * **no volvía a recibir ninguna nunca**: se quedaba en la lista de espera para
 * siempre, y la lista dejaba de servir para lo único que hace.
 *
 * `contactado` significa «ya se le ofreció algo hace poco», no «ya no cuenta».
 * Pasadas unas horas vuelve a la rueda.
 *
 * ── POR QUÉ SE ORDENA AQUÍ Y NO EN FIRESTORE ─────────────────────────────────
 *
 * Un `where … in …` con dos `orderBy` exige un índice compuesto que hay que
 * crear a mano en la consola. Mientras no exista, la lectura falla ENTERA y no
 * se ofrece el hueco a nadie — que es exactamente cómo se rompió la pantalla de
 * pendientes la primera vez. Se lee plano y se ordena en memoria.
 *
 * Módulo PURO.
 */

/** Lo que hace falta de una entrada de la lista para decidir. */
export interface EntradaEspera {
  id?: string
  estado?: string
  /** 1 = mayor prioridad. */
  prioridad?: number
  createdAt?: string
  /** Cuándo se le ofreció algo por última vez. */
  contactadoEn?: string
}

/**
 * Cuánto espera un paciente ya contactado antes de volver a la rueda.
 *
 * Seis horas: lo bastante para no acribillar a quien acaba de recibir una
 * oferta y está decidiendo, y lo bastante corto para que un hueco de la tarde
 * pueda ofrecerse a alguien que no contestó por la mañana.
 *
 * Es un plazo OPERATIVO, no clínico.
 */
export const HORAS_DE_GRACIA = 6

/**
 * Los candidatos a los que SÍ se les puede ofrecer, en orden.
 *
 * Primero por prioridad (1 antes que 2), y a igual prioridad, quien lleva más
 * tiempo esperando. Sin `prioridad` se va al final: no se le adivina una.
 */
export function candidatos(
  entradas: readonly EntradaEspera[],
  ahoraMs: number,
  horasDeGracia: number = HORAS_DE_GRACIA,
): EntradaEspera[] {
  const graciaMs = horasDeGracia * 3_600_000
  return entradas
    .filter(e => {
      const estado = String(e.estado ?? '')
      if (estado === 'activo') return true
      if (estado !== 'contactado') return false
      // Contactado SIN fecha: es de antes de que se registrara, y dejarlo fuera
      // sería mantener el destierro que esto viene a quitar.
      const t = Date.parse(String(e.contactadoEn ?? ''))
      if (!Number.isFinite(t)) return true
      return ahoraMs - t >= graciaMs
    })
    .sort((a, b) =>
      (a.prioridad ?? 99) - (b.prioridad ?? 99) ||
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
}

export const POR_QUE_VUELVEN_A_LA_RUEDA =
  'Porque «contactado» significa que ya se le ofreció algo hace poco, no que ya ' +
  'no cuenta. Quien no contestó una vez se quedaba en la lista para siempre sin ' +
  'volver a recibir nada, y una lista de espera que no ofrece no es una lista de ' +
  'espera.'
