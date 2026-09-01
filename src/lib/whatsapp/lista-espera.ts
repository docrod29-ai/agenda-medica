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
 * ── QUÉ ORDENA FIRESTORE Y QUÉ ORDENA ESTE MÓDULO (REG-421) ──────────────────
 *
 * Desde que el índice `waitlist(estado, prioridad, createdAt)` está desplegado,
 * **la prioridad y la antigüedad las ordena Firestore** en la propia consulta
 * (`ofrecer-hueco.ts`): así el tope de lectura recorta a los MENOS prioritarios
 * y no a cualquiera.
 *
 * Lo que sigue viviendo aquí, y seguirá, es la elegibilidad por TIEMPO: quién
 * vuelve a la rueda pasadas las horas de gracia. Eso compara `contactadoEn` con
 * la hora de ahora, y no hay índice que exprese «hace más de seis horas».
 *
 * Este módulo mantiene su propio orden por prioridad porque es PURO y se prueba
 * solo: reordenar una lista ya ordenada no cuesta nada, y así el criterio queda
 * escrito en un sitio que no depende de que un índice exista.
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

/**
 * LA IDENTIDAD DE UNA PETICIÓN DE LISTA DE ESPERA.
 *
 * ── POR QUÉ ────────────────────────────────────────────────────────────────
 *
 * El alta escribía con `addDoc`: identificador aleatorio, uno nuevo en cada
 * llamada. Así, dos envíos del mismo formulario —el doble clic, el reintento
 * tras una red lenta, la pestaña duplicada— son por construcción DOS entradas
 * del mismo paciente.
 *
 * Y una entrada duplicada no es sólo ruido en una lista: al ofrecer un hueco
 * sólo se avisa a tres personas, así que el paciente repetido ocupa dos de esos
 * tres sitios. El tercero de la fila no se entera del hueco, y el repetido
 * recibe dos veces el mismo mensaje.
 *
 * ── QUÉ CUENTA COMO «LA MISMA PETICIÓN» ────────────────────────────────────
 *
 * El teléfono, el tipo de consulta, la fecha a partir de la cual le sirve y la
 * franja horaria que pidió. Cambiar cualquiera de ellos es pedir OTRA cosa y
 * merece su propia entrada: quien pedía «seguimiento por la mañana» y ahora
 * también acepta «primera vez por la tarde» está haciendo una petición nueva.
 *
 * La prioridad y las notas NO entran: son cómo el consultorio gestiona la
 * petición, no qué pidió el paciente. Subirle la prioridad a alguien no debe
 * fabricarle una segunda entrada.
 *
 * El teléfono se normaliza porque el mismo número se teclea de varias formas y
 * dos grafías del mismo paciente volverían a ser dos entradas.
 *
 * Módulo PURO.
 */
export function claveDeEspera(peticion: {
  pacienteTelefono?: string
  tipo?: string
  fechaDeseada?: string
  rangoHorario?: string
}): string {
  const tel = String(peticion.pacienteTelefono ?? '').replace(/\D/g, '')
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
  return [tel, norm(peticion.tipo), norm(peticion.fechaDeseada), norm(peticion.rangoHorario)].join('|')
}

export const POR_QUE_LA_ENTRADA_DUPLICADA_DUELE =
  'Porque al ofrecer un hueco sólo se avisa a tres personas: el paciente ' +
  'repetido ocupa dos de esos tres sitios, el tercero de la fila no se entera ' +
  'del hueco y el repetido recibe dos veces el mismo mensaje.'

export const POR_QUE_VUELVEN_A_LA_RUEDA =
  'Porque «contactado» significa que ya se le ofreció algo hace poco, no que ya ' +
  'no cuenta. Quien no contestó una vez se quedaba en la lista para siempre sin ' +
  'volver a recibir nada, y una lista de espera que no ofrece no es una lista de ' +
  'espera.'
