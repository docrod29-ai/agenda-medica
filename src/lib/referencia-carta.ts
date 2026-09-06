/**
 * LA CARTA DE REFERENCIA QUEDA EN EL EXPEDIENTE — MC-004.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La carta de referencia se imprimía y desaparecía. Todo su contenido —tipo,
 * destino, institución, motivo, urgencia, resumen, diagnósticos, tratamiento,
 * estudios— vivía en `useState`, y las únicas salidas eran el PDF y la
 * impresión. Cero escrituras, cero bitácora, ninguna colección. Al recargar, la
 * pantalla salía vacía; al volver al expediente, no había rastro de que se
 * hubiera referido al paciente, a quién ni por qué.
 *
 * La nota de referencia es parte del expediente que la norma exige conservar.
 * Ante un perito no había constancia de la interconsulta; y si el paciente
 * perdía el papel, nadie podía reimprimir lo mismo.
 *
 * ── DÓNDE SE GUARDA, Y POR QUÉ AHÍ ───────────────────────────────────────────
 *
 * Como ADENDA de la nota de la que se compuso la carta. El mismo razonamiento
 * que en `orden-emitida.ts`:
 *
 *  · escribir sobre una nota firmada rompería su sello SHA-256 (REG-059);
 *  · una colección nueva se declara en TRES sitios —reglas, matriz de acceso y
 *    manifiesto de respaldo— que son de otra rebanada; sin la regla, Firestore
 *    rechaza la escritura y el dato NO llega, que es peor que no intentarlo;
 *  · `adendas` es inmutable, se lee en la pantalla de la nota, entra en el
 *    respaldo y deja asiento de bitácora.
 *
 * Si el consultorio prefiere una entidad propia (`referencias`), la forma exacta
 * de la regla está en el handoff. Este módulo no cambia por eso: lo que compone
 * es el TEXTO de la carta, que es el mismo en el papel y en el asiento.
 *
 * ── LO QUE NO CUBRE ──────────────────────────────────────────────────────────
 *
 * · Sin nota firmada no hay dónde asentar. La pantalla lo DICE en vez de
 *   callarlo: imprimir sigue siendo posible, y el médico sabe que esa copia no
 *   quedará en el expediente.
 * · No cubre la contrarreferencia que RECIBE el consultorio (documento externo)
 *   ni el envío electrónico al otro médico.
 *
 * Módulo PURO.
 */

export interface CartaDeReferencia {
  tipo: 'referencia' | 'contrarreferencia'
  urgencia: string
  destino: string
  institucion: string
  motivo: string
  resumen: string
  diagnosticos: string
  tratamiento: string
  estudios: string
}

/** El texto de la carta tal como queda asentado en el expediente. */
export function textoDeLaCarta(c: CartaDeReferencia): string {
  const etiqueta = c.tipo === 'referencia' ? 'Carta de referencia' : 'Carta de contrarreferencia'
  const bloque = (titulo: string, valor: string) =>
    valor.trim() ? `${titulo}: ${valor.trim()}` : ''
  return [
    `${etiqueta} emitida — urgencia: ${c.urgencia}.`,
    bloque('Dirigida a', c.destino),
    bloque('Institución', c.institucion),
    bloque('Motivo', c.motivo),
    bloque('Resumen clínico', c.resumen),
    bloque('Diagnósticos', c.diagnosticos),
    bloque('Tratamiento actual', c.tratamiento),
    bloque('Estudios', c.estudios),
  ].filter(Boolean).join('\n')
}

/** El motivo de la adenda: breve, obligatorio y legible en la línea de tiempo. */
export function motivoDeLaCarta(c: Pick<CartaDeReferencia, 'tipo' | 'destino'>): string {
  const etiqueta = c.tipo === 'referencia' ? 'Referencia' : 'Contrarreferencia'
  const a = c.destino.trim()
  return a ? `${etiqueta} emitida — ${a}`.slice(0, 500) : `${etiqueta} emitida`
}

/** ¿Hay algo que asentar? Una carta en blanco no es un acto clínico. */
export function cartaTieneContenido(c: CartaDeReferencia): boolean {
  return [c.destino, c.institucion, c.motivo, c.resumen, c.diagnosticos, c.tratamiento, c.estudios]
    .some(v => v.trim().length > 0)
}

export const POR_QUE_SE_ASIENTA_LA_CARTA =
  'Porque referir a un paciente es un acto clínico y la carta es parte del ' +
  'expediente que se conserva. Si sólo vive en el papel que se lleva el ' +
  'paciente, el expediente no puede decir a quién se le mandó ni por qué, y ' +
  'nadie puede reimprimir lo mismo si se pierde.'
