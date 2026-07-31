'use client'
/**
 * Membrete de PÁGINA COMPLETA en documentos Word (.doc HTML).
 *
 * POR QUÉ: el médico exige que su hoja membretada aparezca TAMBIÉN en el Word
 * (no solo en Imprimir/PDF). Un intento previo la ponía como imagen inline y
 * salía "mocho" (la maqueta encima del texto, mal alineada).
 *
 * CÓMO (la forma NATIVA y correcta de Word): la imagen va como FONDO DE PÁGINA
 * vía el elemento VML `<v:background>` + `<v:fill type="frame">`, activado con
 * `<w:DisplayBackgroundShape/>` en las settings del documento. Word (escritorio,
 * Mac y Windows) lo repite en TODAS las páginas y deja el texto ENCIMA — es el
 * mismo mecanismo de "Diseño → Color de página → Efectos de relleno → Imagen".
 * La imagen se incrusta como data URI para que funcione SIN conexión.
 *
 * Ley del médico: NUNCA deformar el membrete → se usa la imagen tal cual; en una
 * hoja carta con un membrete carta llena la página sin distorsión perceptible.
 */

/** Descarga una imagen (URL absoluta/relativa o data URI) y la vuelve data URI base64. */
export async function imagenADataUri(src: string): Promise<string> {
  if (!src) return ''
  if (src.startsWith('data:')) return src
  try {
    const url = /^https?:/i.test(src) ? src : new URL(src, window.location.origin).href
    const resp = await fetch(url, { credentials: 'include' })
    if (!resp.ok) return ''
    const blob = await resp.blob()
    return await new Promise<string>((resolve) => {
      const fr = new FileReader()
      fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : '')
      fr.onerror = () => resolve('')
      fr.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

/**
 * Bloques HTML que activan el fondo de página en Word.
 * @returns { head, background } — `head` va en <head> (settings + VML namespaces
 * ya deben estar en <html>), `background` va al inicio del <body>.
 * Si no hay imagen, ambos son '' (documento limpio de texto).
 */
export function fondoWord(dataUri: string): { head: string; background: string } {
  if (!dataUri) return { head: '', background: '' }
  return {
    // DisplayBackgroundShape: sin esto Word NO pinta el <v:background>.
    head: `<!--[if gte mso 9]><xml><w:WordDocument><w:DisplayBackgroundShape/></w:WordDocument></xml><![endif]-->`,
    // type="frame" = ajustar a la página (una sola vez, cubre la hoja).
    background: `<v:background id="_x0000_s1025" o:bwmode="white"><v:fill src="${dataUri}" o:title="" recolor="t" type="frame"/></v:background>`,
  }
}

/** Atributos xmlns para <html> que Word necesita para VML (v:) y office (o:, w:). */
export const WORD_HTML_NS =
  `xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`
