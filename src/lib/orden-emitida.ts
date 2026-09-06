/**
 * LA ORDEN EMITIDA QUEDA EN EL EXPEDIENTE — MO-005.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Lo que el médico elegía en la pantalla de orden no se guardaba en ninguna
 * parte. El propio código lo confesaba en un comentario: «el médico elige los
 * estudios AQUÍ, imprime, y la nota se queda vacía». Al reabrir /orden la lista
 * salía vacía y el folio era el mismo, así que dos órdenes distintas podían
 * circular con el mismo identificador; el expediente no decía qué se pidió; la
 * hoja del paciente listaba cero estudios.
 *
 * Lo único que quedaba era la tarea `estudio_pendiente` y un asiento de bitácora
 * con la lista truncada a 40. Eso rompe el invariante UN MODELO DE ORDEN · UNA
 * LÍNEA DE TIEMPO: la orden vivía en el papel y en una tarea, no en el
 * expediente.
 *
 * ── DÓNDE SE GUARDA, Y POR QUÉ AHÍ ───────────────────────────────────────────
 *
 * En una ADENDA de la nota firmada. No es una elección de comodidad:
 *
 *  · escribir `estudiosOrden` sobre una nota YA FIRMADA rompería su sello
 *    SHA-256 y la pantalla marcaría el expediente como alterado (REG-059);
 *  · una colección nueva exige declararse en los tres sitios —reglas, matriz de
 *    acceso y manifiesto de respaldo—, que son de otra rebanada; mientras no
 *    estén, Firestore rechazaría la escritura y el dato NO llegaría, que es
 *    peor que no intentarlo;
 *  · `adendas` ya existe, es inmutable, se lee en la pantalla de la nota, entra
 *    en el respaldo y deja su propio asiento de bitácora. Es el mecanismo que
 *    este expediente tiene para añadir un hecho a un documento cerrado.
 *
 * ── LO QUE NO CUBRE ──────────────────────────────────────────────────────────
 *
 * El paquete del paciente y la exportación FHIR leen `nota.estudiosOrden`: una
 * orden emitida DESPUÉS de firmar vive en la adenda y todavía no llega ahí.
 * Queda dicho en el handoff. Con la nota sin firmar no hay adenda posible y la
 * pantalla lo dice en vez de callarlo.
 *
 * Módulo PURO.
 */

/** El texto de la orden tal como queda asentado en el expediente. */
export function textoDeLaOrdenEmitida(o: {
  folio: string
  estudios: readonly string[]
  diagnostico?: string
  indicaciones?: string
  formato: 'impresa' | 'pdf' | 'word'
}): string {
  const comoSeEntrego = {
    impresa: 'impresa',
    pdf: 'descargada en PDF',
    word: 'descargada en Word',
  }[o.formato]
  const lineas = [
    `Orden de estudios ${o.folio} — ${comoSeEntrego}.`,
    o.diagnostico?.trim() ? `Diagnóstico de sospecha: ${o.diagnostico.trim()}` : '',
    'Estudios solicitados:',
    ...o.estudios.filter(e => e.trim()).map(e => `· ${e.trim()}`),
    o.indicaciones?.trim() ? `Indicaciones: ${o.indicaciones.trim()}` : '',
  ]
  return lineas.filter(Boolean).join('\n')
}

/** El motivo de la adenda: obligatorio, breve y suficiente para la línea de tiempo. */
export function motivoDeLaOrdenEmitida(folio: string, cuantos: number): string {
  return `Orden de estudios emitida (${folio}) — ${cuantos} ${cuantos === 1 ? 'estudio' : 'estudios'}`
}

export const POR_QUE_LA_ORDEN_SE_ASIENTA =
  'Porque una orden emitida es un acto clínico, no un papel. Si sólo vive en la ' +
  'impresora, el expediente no puede decir qué se pidió, ni el paciente ' +
  'reimprimir lo suyo, ni nadie saber si el estudio quedó pendiente.'
