/**
 * REINTENTAR NO ES REPETIR — identidad, lotes y punto de reanudación.
 *
 * ── LOS TRES SUCESOS QUE HAY QUE SOBREVIVIR ──────────────────────────────────
 *
 * Una restauración de diez mil documentos tarda. En ese rato pasa esto:
 *
 *  1. **Se agota el tiempo DESPUÉS de escribir.** El servidor confirmó el lote,
 *     la respuesta no llegó, y el que restaura vuelve a pulsar. Los documentos
 *     ya están.
 *  2. **Se muere el proceso a mitad.** La ruta tiene `maxDuration = 300`; un
 *     archivo grande lo agota. Al reintentar, ¿desde dónde?
 *  3. **Se pulsa dos veces.** Dos peticiones concurrentes con el mismo archivo.
 *
 * Hoy el importador no tiene identidad de trabajo, ni lotes numerados, ni punto
 * de reanudación: cada intento recorre el archivo entero desde el principio.
 * Que eso NO duplique depende de un detalle frágil —`batch.set(ref, …)` con el
 * id del documento en la ruta— y de que ninguna colección use identificadores
 * generados. En el momento en que un documento se escribiera con `add()`, cada
 * reintento crearía una copia.
 *
 * ── LA IDENTIDAD ─────────────────────────────────────────────────────────────
 *
 *     trabajoId = huella(origen + destino + huella del archivo)
 *
 * Dos peticiones con la misma terna son **el mismo trabajo reintentado**. Una
 * terna distinta es otro trabajo: restaurar otro archivo, o el mismo archivo en
 * otro consultorio, son cosas distintas y tienen que poder convivir.
 *
 * Y dentro del trabajo:
 *
 *     loteId = número de orden del lote (determinista: mismo archivo, mismos lotes)
 *
 * Con eso, «reanudar» deja de ser una promesa: es «saltarse los lotes que ya
 * constan».
 *
 * ── LO QUE ESTE MÓDULO ES Y NO ES ────────────────────────────────────────────
 *
 * Es el CONTRATO y la aritmética: cómo se nombra un trabajo, cómo se parte en
 * lotes reproducibles, y qué se hace ante un documento que ya existe. No abre
 * Firestore: quien persista el punto de control es la ruta.
 *
 * Módulo PURO.
 */

/** Estado de un trabajo de restauración, tal como se persiste. */
export interface TrabajoDeRestauracion {
  /** Identidad estable: misma terna ⇒ mismo identificador. */
  trabajoId: string
  origen: string
  destino: string
  /** Huella del archivo entero: si cambia, es otro trabajo. */
  huellaDelArchivo: string
  /** Cuántos documentos se admitirán en total, si ya se sabe. */
  esperados: number | null
  /** Último lote confirmado. `-1` = ninguno. */
  ultimoLoteConfirmado: number
  /** Documentos escritos hasta el último lote confirmado. */
  escritosConfirmados: number
  iniciadoEn: string
  actualizadoEn: string
  estado: 'en-curso' | 'terminado' | 'abandonado'
}

/** Tamaño de lote. Firestore admite 500 por escritura; se deja margen. */
export const DOCUMENTOS_POR_LOTE = 400

/**
 * A qué lote pertenece el documento número `indice`.
 *
 * Determinista a propósito: el mismo archivo produce los mismos lotes en cada
 * intento. Sin eso, «ya hice hasta el lote 7» no significa nada.
 */
export function loteDe(indice: number, porLote = DOCUMENTOS_POR_LOTE): number {
  return Math.floor(indice / porLote)
}

/** ¿Este lote ya se confirmó en un intento anterior? */
export function loteYaConfirmado(trabajo: Pick<TrabajoDeRestauracion, 'ultimoLoteConfirmado'>, lote: number): boolean {
  return lote <= trabajo.ultimoLoteConfirmado
}

/**
 * ¿El trabajo que llega es el mismo que el guardado?
 *
 * Compara la terna entera, no sólo el identificador: un identificador que
 * coincide con una terna distinta es una colisión o una manipulación, y en
 * cualquiera de los dos casos NO se reanuda encima.
 */
export function esElMismoTrabajo(
  guardado: TrabajoDeRestauracion,
  candidato: Pick<TrabajoDeRestauracion, 'trabajoId' | 'origen' | 'destino' | 'huellaDelArchivo'>,
): boolean {
  return guardado.trabajoId === candidato.trabajoId
    && guardado.origen === candidato.origen
    && guardado.destino === candidato.destino
    && guardado.huellaDelArchivo === candidato.huellaDelArchivo
}

export type DecisionDeEscritura =
  /** No existe en el destino: se escribe. */
  | 'escribir'
  /** Existe y es idéntico: no se escribe, cuenta como restaurado. */
  | 'omitir-identico'
  /** Existe, difiere, y el documento es mutable: se escribe y se DECLARA. */
  | 'sobrescribir-declarando'
  /** Existe, difiere, y el destino es más reciente: no se pisa. */
  | 'no-pisar-lo-mas-nuevo'
  /** Existe, difiere, y es inmutable: para una persona. */
  | 'revision-humana'

export interface Decision {
  decision: DecisionDeEscritura
  porQue: string
}

/** Lo que se sabe del documento a la hora de decidir. */
export interface ContextoDeEscritura {
  /** Huella de contenido del documento del archivo. */
  huellaDelArchivo: string
  /** Huella de contenido del documento del destino, o `null` si no existe. */
  huellaDelDestino: string | null
  /** El documento es firmado o de sólo-añadir. */
  esInmutable: boolean
  /** Marca de tiempo del documento del archivo (ISO), si la tiene. */
  fechaDelArchivo: string | null
  /** Marca de tiempo del documento del destino (ISO), si la tiene. */
  fechaDelDestino: string | null
}

/**
 * Decide qué hacer con UN documento.
 *
 * ── EL DOCUMENTO RANCIO ──────────────────────────────────────────────────────
 *
 * El caso que nadie ve venir: se restaura un respaldo de ayer sobre un
 * consultorio que ya lleva trabajando media mañana. El respaldo trae la nota de
 * ayer; el destino tiene la de hoy. Escribir el respaldo **borra el trabajo de
 * la mañana**, y el informe dirá «10 000 documentos restaurados».
 *
 * Por eso, cuando el destino es más reciente, no se pisa. Restaurar es devolver
 * lo perdido, no rebobinar lo vivo.
 */
export function decidirEscritura(ctx: ContextoDeEscritura): Decision {
  if (ctx.huellaDelDestino === null) {
    return { decision: 'escribir', porQue: 'no existe en el destino: restaurarlo devuelve lo que faltaba.' }
  }
  if (ctx.huellaDelDestino === ctx.huellaDelArchivo) {
    return {
      decision: 'omitir-identico',
      porQue: 'el destino ya tiene exactamente este documento. No escribir es lo que hace que reintentar el mismo trabajo deje el mismo estado final.',
    }
  }
  if (ctx.esInmutable) {
    return {
      decision: 'revision-humana',
      porQue: 'el documento es firmado o de sólo-añadir y difiere del que hay. El SDK admin no evalúa las reglas de Firestore: si no se detiene aquí, no se detiene en ninguna parte.',
    }
  }
  const tA = ctx.fechaDelArchivo ? Date.parse(ctx.fechaDelArchivo) : NaN
  const tD = ctx.fechaDelDestino ? Date.parse(ctx.fechaDelDestino) : NaN
  if (Number.isFinite(tA) && Number.isFinite(tD) && tD > tA) {
    return {
      decision: 'no-pisar-lo-mas-nuevo',
      porQue: 'el documento del destino es MÁS RECIENTE que el del respaldo. Escribirlo borraría trabajo hecho después del respaldo, y el informe lo contaría como restaurado.',
    }
  }
  /**
   * Fechas ilegibles → NO se pisa tampoco. La misma regla que el barrido de
   * `ops/retencion.ts`: lo que no se puede fechar no se toca. Aquí el coste de
   * equivocarse es borrar la consulta de esta mañana.
   */
  if (Number.isFinite(tD) !== Number.isFinite(tA)) {
    return {
      decision: 'no-pisar-lo-mas-nuevo',
      porQue: 'no se puede comparar la frescura (a uno de los dos le falta la fecha). Ante la duda no se pisa: el coste de equivocarse es borrar trabajo del médico.',
    }
  }
  return {
    decision: 'sobrescribir-declarando',
    porQue: 'documento mutable, el respaldo es igual de reciente o más: se escribe y se declara en el informe, porque toda corrección sobre lo que hay tiene que poder verse.',
  }
}

/** Avanza el punto de control tras confirmar un lote. No muta la entrada. */
export function confirmarLote(
  t: TrabajoDeRestauracion, lote: number, escritosEnElLote: number, ahoraISO: string,
): TrabajoDeRestauracion {
  return {
    ...t,
    ultimoLoteConfirmado: Math.max(t.ultimoLoteConfirmado, lote),
    escritosConfirmados: t.escritosConfirmados + escritosEnElLote,
    actualizadoEn: ahoraISO,
  }
}

export const POR_QUE_EL_PUNTO_DE_CONTROL_VA_DESPUES =
  'El punto de control se avanza DESPUÉS de que el lote quede confirmado, ' +
  'nunca antes. Avanzarlo antes convierte un fallo a mitad de lote en un hueco ' +
  'permanente: el reintento se salta un lote que nunca se escribió y el informe ' +
  'lo cuenta como hecho. Es preferible reescribir un lote —que es inocuo, ' +
  'porque escribir el mismo documento dos veces deja el mismo documento— a ' +
  'saltarse uno.'
