/**
 * DESHACER UNA IMPORTACIÓN — hasta donde se puede demostrar, y ni un paso más.
 *
 * ── LA PROMESA QUE NO SE HACE ────────────────────────────────────────────────
 *
 * No hay «deshacer» mágico. Una importación no es una transacción: son miles de
 * escrituras a lo largo de minutos, y en cuanto la primera entró, el consultorio
 * es un sitio distinto. Prometer que se puede volver atrás sin condiciones es
 * prometer algo que sólo se puede cumplir borrando de más.
 *
 * Lo que sí se puede hacer, y es lo que se hace: **borrar lo que este trabajo
 * creó, siempre que se pueda demostrar que lo creó él y que nadie lo ha tocado
 * desde entonces.**
 *
 * ── EL FALLO QUE ESTE MÓDULO EXISTE PARA IMPEDIR ─────────────────────────────
 *
 * El médico importa 2 000 pacientes el lunes. El martes atiende a doce de ellos:
 * abre el expediente, corrige el teléfono, añade una alergia, escribe una nota.
 * El miércoles se da cuenta de que el archivo tenía las columnas cambiadas y
 * pide deshacer.
 *
 * Un «deshacer» que borre los 2 000 se lleva por delante el trabajo clínico de
 * un día entero — y esas doce notas no estaban en ningún archivo: no se pueden
 * volver a importar. **La importación es recuperable; el trabajo del médico, no.**
 *
 * Por eso el criterio no es «¿lo creó este trabajo?» sino «¿lo creó este trabajo
 * Y sigue exactamente como lo dejó?».
 *
 * ── CÓMO SE DEMUESTRA «NADIE LO HA TOCADO» ───────────────────────────────────
 *
 * Con `updatedAt`. Si es posterior a `importedAt`, alguien escribió después —da
 * igual quién ni qué—: ese expediente sale de la reversión y va a revisión
 * humana. Es una comprobación tosca a propósito: prefiere sacar de la reversión
 * un expediente que nadie tocó de verdad (un reloj desfasado, una escritura de
 * sistema) que borrar uno que sí.
 *
 * Módulo PURO.
 */
import type { Razon } from './contrato'

/** Lo mínimo que hay que saber de un expediente para decidir si se puede revertir. */
export interface CandidatoReversion {
  readonly patientId: string
  /** El trabajo que lo creó. Sin esto no es candidato a nada. */
  readonly importJobId?: string
  /** ISO. Cuándo lo escribió la importación. */
  readonly importedAt?: string
  /** ISO. Última modificación conocida del documento. */
  readonly updatedAt?: string
  /**
   * ¿Cuelga de este expediente algo que la importación no creó?
   *
   * Una nota, una receta, una cita, un cobro. Con una sola basta: borrar el
   * paciente dejaría esos documentos apuntando a un expediente que ya no existe,
   * y un huérfano clínico es peor que un duplicado — no se ve, y no se puede
   * abrir.
   */
  readonly tieneDescendencia?: boolean
}

export type DecisionReversion =
  /** Se puede borrar. Lo creó este trabajo y sigue intacto. */
  | { readonly clase: 'revertible'; readonly patientId: string }
  /** No se puede borrar. Va a revisión humana, con el porqué. */
  | { readonly clase: 'requiere-revision'; readonly patientId: string; readonly porQue: MotivoNoRevertible }
  /** Ni siquiera es de este trabajo. No se toca. */
  | { readonly clase: 'ajeno'; readonly patientId: string }

/** Por qué un expediente importado no se puede deshacer sin que alguien mire. */
export type MotivoNoRevertible =
  | 'MODIFICADO_DESPUES_DE_IMPORTAR'
  | 'TIENE_TRABAJO_CLINICO_ENCIMA'
  | 'SIN_SELLO_DE_IMPORTACION'
  | 'FECHAS_INCOHERENTES'

export const MOTIVO_TEXTO: Readonly<Record<MotivoNoRevertible, string>> = {
  MODIFICADO_DESPUES_DE_IMPORTAR:
    'Alguien editó este expediente después de importarlo. Deshacer borraría ese trabajo.',
  TIENE_TRABAJO_CLINICO_ENCIMA:
    'Este expediente ya tiene notas, recetas o citas colgando. Borrarlo las dejaría huérfanas.',
  SIN_SELLO_DE_IMPORTACION:
    'Este expediente no lleva sello de importación: no se puede demostrar que lo creara este trabajo.',
  FECHAS_INCOHERENTES:
    'Las fechas del expediente no permiten decidir si se tocó después de importarlo.',
}

/**
 * ¿Se puede deshacer este expediente?
 *
 * El orden de las comprobaciones es de más barato a más caro y de más seguro a
 * menos: primero se descarta lo ajeno, luego lo que tiene trabajo encima, y sólo
 * al final se compara el reloj.
 */
export function decidirReversion(c: CandidatoReversion, importJobId: string): DecisionReversion {
  if (c.importJobId !== importJobId) return { clase: 'ajeno', patientId: c.patientId }

  if (!c.importedAt) {
    return { clase: 'requiere-revision', patientId: c.patientId, porQue: 'SIN_SELLO_DE_IMPORTACION' }
  }
  if (c.tieneDescendencia) {
    return { clase: 'requiere-revision', patientId: c.patientId, porQue: 'TIENE_TRABAJO_CLINICO_ENCIMA' }
  }
  if (!c.updatedAt) {
    /**
     * Sin `updatedAt` no se puede demostrar que esté intacto.
     *
     * Y «no se puede demostrar» se resuelve NO borrando. La alternativa —dar por
     * bueno el silencio— es exactamente la forma de que un expediente editado
     * sin sello de fecha se borre con el trabajo dentro.
     */
    return { clase: 'requiere-revision', patientId: c.patientId, porQue: 'FECHAS_INCOHERENTES' }
  }

  const importado = Date.parse(c.importedAt)
  const modificado = Date.parse(c.updatedAt)
  if (!Number.isFinite(importado) || !Number.isFinite(modificado)) {
    return { clase: 'requiere-revision', patientId: c.patientId, porQue: 'FECHAS_INCOHERENTES' }
  }

  /**
   * MARGEN DE UN SEGUNDO.
   *
   * `createPatient` escribe `createdAt` y `updatedAt` con dos llamadas distintas
   * a `new Date()`, así que un expediente recién creado puede tener `updatedAt`
   * unos milisegundos por delante de `importedAt` sin que nadie lo haya tocado.
   * Sin margen, la reversión mandaría a revisión el 100 % de los expedientes y
   * la función no serviría para nada.
   *
   * Un segundo es holgado para eso y sigue siendo mucho más corto que cualquier
   * edición humana: nadie abre un expediente y guarda un cambio en menos de un
   * segundo desde que se creó.
   */
  const MARGEN_MS = 1000
  if (modificado > importado + MARGEN_MS) {
    return { clase: 'requiere-revision', patientId: c.patientId, porQue: 'MODIFICADO_DESPUES_DE_IMPORTAR' }
  }
  return { clase: 'revertible', patientId: c.patientId }
}

export interface PlanDeReversion {
  readonly importJobId: string
  readonly aBorrar: readonly string[]
  readonly aRevisar: readonly { readonly patientId: string; readonly porQue: MotivoNoRevertible }[]
  readonly ajenos: number
  /**
   * `true` si TODO lo del trabajo se puede deshacer.
   *
   * Cuando es `false` la reversión sigue siendo válida —se borra lo que se
   * puede— pero el trabajo NO vuelve a estado limpio: queda `PARTIAL` con una
   * lista de expedientes que alguien tiene que mirar uno por uno.
   */
  readonly completa: boolean
}

/**
 * El plan de deshacer un trabajo entero.
 *
 * Se calcula ENTERO antes de borrar nada, y se enseña. Borrar mientras se decide
 * significa que un fallo a mitad deja el consultorio en un estado que no está ni
 * en el plan ni en el informe: ni importado ni revertido.
 */
export function planificarReversion(
  candidatos: readonly CandidatoReversion[],
  importJobId: string,
): PlanDeReversion {
  const aBorrar: string[] = []
  const aRevisar: { patientId: string; porQue: MotivoNoRevertible }[] = []
  let ajenos = 0

  for (const c of candidatos) {
    const d = decidirReversion(c, importJobId)
    if (d.clase === 'revertible') aBorrar.push(d.patientId)
    else if (d.clase === 'requiere-revision') aRevisar.push({ patientId: d.patientId, porQue: d.porQue })
    else ajenos++
  }

  return {
    importJobId,
    aBorrar,
    aRevisar,
    ajenos,
    completa: aRevisar.length === 0,
  }
}

/**
 * LA COMPUERTA. Ninguna reversión escribe sin pasar por aquí.
 *
 * Existe separada de `planificarReversion` porque el plan se calcula una vez y
 * el borrado ocurre lote a lote, minutos después. Entre las dos cosas el mundo
 * cambia: el médico puede haber abierto uno de esos expedientes justo entonces.
 * Se vuelve a comprobar con el dato FRESCO, en el momento de borrar.
 */
export function autorizadoABorrar(
  fresco: CandidatoReversion,
  importJobId: string,
): boolean {
  return decidirReversion(fresco, importJobId).clase === 'revertible'
}

/**
 * Las razones del contrato que corresponden a una reversión parcial.
 *
 * Se traducen a los códigos de `contrato.ts` para que el informe de reversión
 * use el mismo vocabulario que el de importación: dos listas de códigos para lo
 * mismo es cómo se llega a que nadie sepa cuál mirar.
 */
export function razonesDeRevision(p: PlanDeReversion): Razon[] {
  return p.aRevisar.length > 0 ? ['ALREADY_IMPORTED'] : []
}
