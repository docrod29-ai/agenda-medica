/**
 * ¿SE PUEDE REPRODUCIR EL TEXTO COMPLETO DE ESTE ARTÍCULO DE PMC?
 *
 * ── EL PROBLEMA (P1-10) ──────────────────────────────────────────────────────
 *
 * `textoCompletoPMC` bajaba el XML de PMC y reproducía hasta 1 600 caracteres
 * del artículo **sin leer su licencia**. El comentario de la función decía
 * «solo artículos de ACCESO ABIERTO — legal», y eso es una media verdad
 * peligrosa: el subconjunto Open Access de PMC **mezcla licencias**. Ahí
 * conviven CC0 y CC-BY —que permiten reproducir— con CC-BY-NC-ND y con «OA no
 * comercial» a secas, que no.
 *
 * El propio catálogo del repositorio lo tenía escrito: *«RIESGO REAL: el
 * subconjunto OA mezcla licencias. Hay que leer la licencia POR ARTÍCULO antes
 * de reproducir texto completo»*, con la decisión marcada como pendiente. Estaba
 * diagnosticado y sin arreglar.
 *
 * «Acceso abierto» dice que se puede **leer**. No dice que se pueda **copiar
 * dentro de un producto de pago**, que es lo que hace este código.
 *
 * ── LA DECISIÓN QUE ESTE MÓDULO **NO** TOMA ─────────────────────────────────
 *
 * Qué subconjunto exacto se considera reproducible es una **decisión del dueño**
 * (tablero: «Licencias de evidencia»). Este módulo no la toma: implementa la
 * única postura defendible mientras no exista, que es **fallar cerrado**.
 *
 * Reproduce sólo cuando la licencia lo dice **explícitamente y por escrito** en
 * el XML. Ante una licencia desconocida, ausente o ambigua: **no se reproduce**.
 * Y no se pierde nada clínico — se cae al resumen, que es exactamente lo que ya
 * pasaba con los artículos de pago.
 *
 * Al revés no funciona: una lista de licencias PROHIBIDAS deja pasar todo lo que
 * nadie previó, y el error se descubre cuando llega la carta.
 *
 * ── POR QUÉ SE MIRA EL TEXTO Y NO SÓLO EL ATRIBUTO ──────────────────────────
 *
 * PMC declara la licencia de varias formas según la editorial y la antigüedad
 * del depósito: `<license license-type="open-access">`, un `<ali:license_ref>`
 * con la URL de Creative Commons, o sólo un párrafo de texto dentro de
 * `<license>`. Mirar un solo sitio deja fuera artículos legítimos —y, peor,
 * confunde «no lo encontré» con «no hay licencia».
 *
 * Módulo PURO: recibe XML y devuelve un veredicto. No hace red.
 */

/** Qué se puede hacer con este artículo. */
export type VeredictoLicencia =
  /** Licencia permisiva reconocida: se puede reproducir el texto. */
  | { puede: true; licencia: string }
  /**
   * No se reproduce. `porQue` distingue la licencia restrictiva de la ausencia
   * de licencia: no es lo mismo «dice que no» que «no dice nada», aunque las dos
   * lleven a lo mismo.
   */
  | { puede: false; licencia: string; porQue: 'restrictiva' | 'desconocida' | 'ausente' }

/**
 * Licencias que permiten reproducir texto dentro de un producto comercial.
 *
 * CC0 (dominio público) y CC-BY (atribución) lo permiten. **CC-BY-NC no**: este
 * producto se cobra. **CC-BY-ND no**: extraer párrafos sueltos es una obra
 * derivada. Por eso la lista es de identificadores exactos y no de prefijos —
 * `cc-by-nc-nd` empieza por `cc-by`.
 */
const PERMISIVAS = new Set(['cc0', 'cc-by', 'publicdomain', 'public-domain'])

/** Normaliza una URL o un identificador de Creative Commons a su clave. */
export function claveDeLicencia(texto: string): string | null {
  const t = texto.toLowerCase()
  const cc = t.match(/creativecommons\.org\/(?:licenses|publicdomain)\/([a-z0-9-]+)/)
  if (cc) {
    const cual = cc[1]
    if (cual === 'zero' || cual === 'mark') return 'cc0'
    return `cc-${cual}`
  }
  const suelto = t.match(/\bcc[\s-]?(by(?:[\s-]?(?:nc|nd|sa))*|0|zero)\b/)
  if (suelto) {
    const cual = suelto[1].replace(/[\s]/g, '-')
    if (cual === '0' || cual === 'zero') return 'cc0'
    return `cc-${cual}`
  }
  if (/\bpublic\s+domain\b/.test(t)) return 'publicdomain'
  return null
}

/**
 * El veredicto para un XML de PMC.
 *
 * `no comercial` en prosa cuenta como restrictiva aunque no haya identificador:
 * un artículo que dice «for non-commercial use» está diciendo que no, y no
 * reconocer su forma de decirlo no lo convierte en permiso.
 */
export function licenciaDePmc(xml: string): VeredictoLicencia {
  const bloque = xml.match(/<permissions[\s\S]*?<\/permissions>/i)?.[0]
    ?? xml.match(/<license[\s\S]*?<\/license>/i)?.[0]
  if (!bloque) return { puede: false, licencia: '', porQue: 'ausente' }

  const clave = claveDeLicencia(bloque)
  if (clave && PERMISIVAS.has(clave)) return { puede: true, licencia: clave }
  if (clave) return { puede: false, licencia: clave, porQue: 'restrictiva' }

  // Sin identificador: la prosa puede seguir diciendo que no.
  if (/non[\s-]?commercial|no[\s-]?comercial|not for commercial/i.test(bloque)) {
    return { puede: false, licencia: 'no-comercial (en prosa)', porQue: 'restrictiva' }
  }
  /**
   * `license-type="open-access"` **no basta**. Es justo la confusión que abrió
   * este defecto: dice que se puede leer, no que se pueda copiar.
   */
  return { puede: false, licencia: '', porQue: 'desconocida' }
}

export const POR_QUE_FALLA_CERRADO =
  'Qué subconjunto de PMC es reproducible es una decisión del dueño y todavía no ' +
  'existe. Mientras tanto, la única postura defendible es reproducir SÓLO lo que ' +
  'la licencia autoriza por escrito. Una lista de licencias prohibidas dejaría ' +
  'pasar todo lo que nadie previó, y ese error se descubre cuando llega la carta. ' +
  'No se pierde nada clínico: sin texto completo se usa el resumen, que es lo que ' +
  'ya pasaba con los artículos de pago.'
