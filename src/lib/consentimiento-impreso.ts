/**
 * EL ACTO DE OTORGAMIENTO DEL CONSENTIMIENTO — MC-003.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Una nota de tipo `consentimiento` se imprimía con UN solo bloque de firma: el
 * del médico, con su firma escaneada y su cédula. Para el paciente, para su
 * representante y para los testigos no había renglón; tampoco lugar, fecha ni
 * hora del otorgamiento, ni huella del texto que se aceptó.
 *
 * El documento que debería demostrar que se le explicaron riesgos y
 * alternativas no llevaba la firma de quien consintió: ante una queja, el
 * médico exhibe un consentimiento que sólo firmó él, y un perito lo lee como
 * inexistente. La sección `declaracion` de la plantilla es prosa libre («el
 * paciente comprende y acepta; nombre de testigos» está en el *placeholder*),
 * que no es lo mismo que un acto asentado.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * Guarda LAS PALABRAS del bloque de otorgamiento en un solo sitio, para que la
 * hoja que se imprime y el .doc que se exporta digan exactamente lo mismo. Cada
 * medio pinta su propio marcado; ninguno inventa su propia redacción — que es
 * como la receta acabó con tres frases distintas para las alergias (MI-002).
 *
 * ── LO QUE NO HACE, Y POR QUÉ ────────────────────────────────────────────────
 *
 * · No fija cuántos testigos exige la norma ni si el representante necesita
 *   acreditar parentesco: eso es `NEEDS_CLINICAL_REVIEW` / revisión legal contra
 *   NOM-004-SSA3-2012 (cartas de consentimiento informado), como declara el
 *   propio hallazgo. Se imprimen DOS renglones de testigo porque es la forma en
 *   que hoy se usa el papel en México; que sean obligatorios lo decide el dueño.
 * · No captura las firmas en pantalla ni en tableta: el renglón se firma a mano
 *   sobre el impreso.
 * · No crea el objeto `otorgamiento` en el modelo de la nota (fecha, quién,
 *   representante, testigos, huella) — eso toca `NotaMedica` y su sello v3/v4
 *   (REG-059), que vive en otra rebanada. Queda en el handoff.
 *
 * Módulo PURO (sólo texto).
 */

/** Encabezado del bloque: nombra el acto, no lo da por hecho. */
export const TITULO_OTORGAMIENTO = 'Otorgamiento del consentimiento'

/**
 * La frase que precede a las firmas. Habla en primera persona del paciente
 * porque es él quien consiente; el médico ya firma abajo por lo que informó.
 */
export const DECLARACION_OTORGAMIENTO =
  'Declaro que se me explicó lo anterior en lenguaje que entiendo, que pude preguntar ' +
  'y que se resolvieron mis dudas, y que acepto libremente lo aquí descrito.'

/** Renglones que se imprimen en blanco para firmarse a mano. */
export const RENGLONES_DE_FIRMA = [
  'Nombre y firma del paciente',
  'Nombre y firma del representante legal (si el paciente no puede firmar) — parentesco',
  'Nombre y firma del testigo 1',
  'Nombre y firma del testigo 2',
] as const

/** Dónde y cuándo se otorgó. Se deja en blanco: lo escribe quien firma. */
export const RENGLON_LUGAR_FECHA = 'Lugar, fecha y hora del otorgamiento'

/**
 * Cómo se rotula la huella del texto aceptado.
 *
 * NO se inventa una huella nueva: la nota firmada ya lleva su sello SHA-256 de
 * integridad (`metadata.hashIntegridad`), que cubre el texto del procedimiento,
 * los riesgos y las alternativas. Ese sello ES la huella de lo que se aceptó, y
 * reusarlo evita una segunda huella del mismo texto que podría discrepar.
 */
export const ETIQUETA_HUELLA_TEXTO = 'Huella del texto aceptado (SHA-256)'

/** Lo que se dice cuando todavía no hay sello porque la nota no está firmada. */
export const HUELLA_PENDIENTE = 'se genera al firmar la nota'

/** El texto de la huella, listo para imprimirse. Puro. */
export function huellaDelTextoAceptado(hashIntegridad: string | null | undefined): string {
  const h = String(hashIntegridad ?? '').trim()
  return `${ETIQUETA_HUELLA_TEXTO}: ${h || HUELLA_PENDIENTE}`
}

export const POR_QUE_NO_BASTA_LA_FIRMA_DEL_MEDICO =
  'Porque el consentimiento no acredita lo que el médico dice haber explicado: ' +
  'acredita que el paciente lo entendió y lo aceptó. Sin su firma, sin testigos ' +
  'y sin fecha, el papel demuestra la mitad que no hacía falta demostrar.'
