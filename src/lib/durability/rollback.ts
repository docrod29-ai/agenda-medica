/**
 * DESHACER UNA RESTAURACIÓN — sólo lo que se puede atribuir a ella.
 *
 * Frontera con #311/#326: aquí NO vive la reversión de una migración de
 * esquema. Aquí vive la reversión de un trabajo de restauración/importación
 * concreto, que es el único que este carril crea. Los invariantes son los
 * mismos y por eso se escriben igual: no cruzar consultorios, no tocar verdad
 * firmada, no promover un antecedente a prescripción, no borrar trabajo del
 * médico.
 *
 * ── EL PELIGRO REAL DE UN «DESHACER» ─────────────────────────────────────────
 *
 * Se restaura un respaldo por error. Se pide deshacer. Entre las dos cosas han
 * pasado veinte minutos en los que el médico:
 *
 *  · abrió una consulta y firmó una nota,
 *  · escribió una adenda sobre una nota vieja,
 *  · corrigió el teléfono de un paciente,
 *  · agendó tres citas.
 *
 * Un «deshacer» que borre todo lo que la restauración escribió se lleva por
 * delante las cuatro cosas, porque cuatro de esos documentos ESTÁN entre los
 * que la restauración tocó. Y esta vez la pérdida es irrecuperable: no hay
 * respaldo de los últimos veinte minutos.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Sólo se deshace un documento cuando se puede atribuir **inequívocamente** al
 * trabajo: la restauración lo creó, y desde entonces **nadie lo ha tocado**. Se
 * demuestra con dos cosas que hay que haber guardado ANTES:
 *
 *   · qué había en esa ruta antes del trabajo (nada, o una huella);
 *   · qué escribió el trabajo (una huella).
 *
 * Si lo que hay ahora no es lo que el trabajo escribió, alguien lo cambió
 * después: `revision-humana`. Nunca «se borra porque estaba en la lista».
 *
 * Módulo PURO.
 */

/** Lo que se anotó de un documento en el momento de restaurarlo. */
export interface AsientoDeRestauracion {
  ruta: string
  /** Huella de lo que había ANTES. `null` = no existía. */
  huellaPrevia: string | null
  /** Huella de lo que el trabajo dejó escrito. */
  huellaEscrita: string
  /** El documento es firmado o de sólo-añadir. */
  esInmutable: boolean
}

/** Lo que hay AHORA en esa ruta, al ir a deshacer. */
export interface EstadoActual {
  ruta: string
  /** `null` = ya no existe. */
  huellaActual: string | null
}

export type AccionDeReversion =
  /** El trabajo lo creó y nadie lo tocó: se borra. */
  | 'borrar'
  /** El trabajo lo sobrescribió y nadie lo tocó: se devuelve lo previo. */
  | 'restaurar-previo'
  /** Ya no está: no hay nada que deshacer. */
  | 'nada-que-hacer'
  /** Cambió después del trabajo, o es inmutable: lo decide una persona. */
  | 'revision-humana'

export interface Reversion {
  ruta: string
  accion: AccionDeReversion
  porQue: string
}

/**
 * Qué hacer con un documento al deshacer un trabajo de restauración.
 */
export function planearReversion(a: AsientoDeRestauracion, actual: EstadoActual): Reversion {
  if (actual.huellaActual === null) {
    return {
      ruta: a.ruta, accion: 'nada-que-hacer',
      porQue: 'el documento ya no está: alguien lo borró después. Volver a crearlo sería resucitar algo que se quitó a propósito.',
    }
  }

  /**
   * ── LO QUE HAY AHORA NO ES LO QUE ESCRIBIÓ EL TRABAJO ────────────────────
   *
   * Ésta es la comprobación que salva la mañana de trabajo. Si difiere, el
   * documento se editó DESPUÉS: puede ser la nota que el médico acaba de
   * firmar, la adenda que acaba de escribir o el teléfono que acaba de
   * corregir. No se toca.
   */
  if (actual.huellaActual !== a.huellaEscrita) {
    return {
      ruta: a.ruta, accion: 'revision-humana',
      porQue: 'el documento cambió DESPUÉS de la restauración: deshacer se llevaría por delante trabajo hecho por el médico, y de eso no hay respaldo.',
    }
  }

  if (a.esInmutable) {
    return {
      ruta: a.ruta, accion: 'revision-humana',
      porQue: 'es un documento firmado o de sólo-añadir. Borrarlo o reescribirlo desde una reversión automática es exactamente lo que la NOM-024 impide, y el SDK admin no lo impediría solo.',
    }
  }

  if (a.huellaPrevia === null) {
    return {
      ruta: a.ruta, accion: 'borrar',
      porQue: 'lo creó esta restauración, no existía antes, y nadie lo ha tocado desde entonces: se puede atribuir al trabajo sin ambigüedad.',
    }
  }

  return {
    ruta: a.ruta, accion: 'restaurar-previo',
    porQue: 'el trabajo lo sobrescribió y nadie lo ha tocado desde entonces: se devuelve exactamente lo que había antes.',
  }
}

export interface PlanDeReversion {
  reversiones: Reversion[]
  /** Cuántos de cada acción. */
  resumen: Record<AccionDeReversion, number>
  /** `true` si la reversión se puede aplicar entera sin decidir nada. */
  aplicableSinPersona: boolean
}

export function planearTodo(
  asientos: readonly AsientoDeRestauracion[], actuales: readonly EstadoActual[],
): PlanDeReversion {
  const porRuta = new Map(actuales.map(e => [e.ruta, e]))
  const reversiones = asientos.map(a =>
    planearReversion(a, porRuta.get(a.ruta) ?? { ruta: a.ruta, huellaActual: null }),
  )
  const resumen: Record<AccionDeReversion, number> = {
    'borrar': 0, 'restaurar-previo': 0, 'nada-que-hacer': 0, 'revision-humana': 0,
  }
  for (const r of reversiones) resumen[r.accion]++
  return {
    reversiones, resumen,
    aplicableSinPersona: resumen['revision-humana'] === 0,
  }
}

/**
 * Lo que una reversión NUNCA borra, aunque figure en sus asientos.
 *
 * Está escrito como lista porque las cuatro se parecen entre sí y ninguna se
 * parece a «un documento que sobra»: las cuatro son trabajo del médico.
 */
export const NUNCA_SE_BORRA: Readonly<Record<string, string>> = {
  'nota-firmada-posterior': 'Una nota firmada después del trabajo es un documento medicolegal nuevo. No estaba en el respaldo y no le corresponde desaparecer con él.',
  'adenda-posterior': 'Una adenda escrita después es la corrección legal de una nota. Borrarla deja la nota sin su corrección y a nadie enterado.',
  'correccion-posterior': 'Una corrección del médico sobre un dato restaurado es su decisión sobre cuál es el dato bueno. La reversión no la revoca.',
  'cita-posterior': 'Una cita agendada después es un compromiso con un paciente que ya lo sabe. Borrarla lo deja plantado.',
}

export const POR_QUE_ATRIBUIBLE_Y_NO_SIMPLEMENTE_TOCADO =
  '«Lo tocó la restauración» es una lista de rutas. «Se puede atribuir a la ' +
  'restauración» es una afirmación comprobable: el trabajo lo escribió y sigue ' +
  'siendo lo que el trabajo escribió. La diferencia entre las dos es la mañana ' +
  'de trabajo que hay entre restaurar y arrepentirse.'
