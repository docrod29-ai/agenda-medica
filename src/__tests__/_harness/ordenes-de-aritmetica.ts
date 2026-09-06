/**
 * ¿ESTE PROMPT LE PIDE AL MODELO QUE CALCULE? — REG-526.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * REG-194 quitó del prompt dos frases que ordenaban aritmética clínica al
 * modelo («dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos»,
 * «percentiles si hay datos…»). Su guardián comprobaba que ESAS frases, letra
 * por letra, no estuvieran. Una orden nueva con otras palabras —«estima la
 * TFG con CKD-EPI», «calcula la superficie corporal»— pasaba limpia.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Recorre el texto por FRASES y devuelve las que ordenan producir una
 * cantidad derivada. Una frase es una orden cuando:
 *
 *   1. nombra una cantidad que sólo existe calculándola (percentil, mg/kg,
 *      superficie corporal, volumen de líquidos) o una fórmula con nombre
 *      (Holliday-Segar, Cockcroft-Gault, CKD-EPI, MDRD, Schwartz, Mosteller,
 *      Du Bois), o dice literalmente «cálculo de». La TFG/eGFR NO está: es
 *      también un valor que el laboratorio reporta y las guías piden
 *      documentarlo; sólo su FÓRMULA delata la orden de calcularlo;
 *   2. y NO la niega («no calcules», «nunca», «ni»), NO la atribuye a un motor
 *      («lo calcula el motor», «calculadoras», «se llena automáticamente»), y
 *      NO la convierte en transcripción («tal como se dictaron», «si se
 *      dictó», «transcríbelo»).
 *
 * Es vocabulario, no criterio: lo que no está en la lista no se vigila
 * (regla 5 de seguridad clínica), y se declara abajo.
 *
 * Módulo PURO. Vive en el arnés de pruebas y no en `src/lib`: es un instrumento
 * del guardián, no un motor del producto, y los barridos de motores sin conectar
 * lo contarían como huérfano con razón.
 */

const CANTIDADES_DERIVADAS: readonly RegExp[] = [
  /\bpercentil(es)?\b/i,
  /\bmg\s*\/\s*kg\b/i,
  /\bdosis por kilo\b/i,
  /\bsuperficie corporal\b/i,
  /\b(volumen|c[aá]lculo|requerimiento)s? de l[ií]quidos\b/i,
  /\bc[aá]lculo de\b/i,
  /\b(holliday[- ]segar|cockcroft|ckd[- ]epi|mdrd|schwartz|mosteller|du bois)\b/i,
]

const NEGACION = /\b(no|nunca|jam[aá]s|ni)\b\s+(calcul|estim|comput|hagas|escribas|propongas|inventes|los? hagas)/i
const ATRIBUCION = /\b(motor(es)?|calculador(as|es)?|autom[aá]ticamente|determinista|modelo generativo|decisi[oó]n del m[eé]dico|panel)\b/i
const TRANSCRIPCION = /\b(tal como se dictar|tal cual|si se dict|dict[oó]\b|transcr[ií]b|lo que se dijo|si se mencion)/i

/** Corta en frases: punto, punto y coma, salto de línea con viñeta o fin de línea de lista. */
function frasesDe(texto: string): string[] {
  return texto
    .split(/(?<=[.;])\s+|\n(?=\s*[-▸•*\d]+[.)]?\s)|\n{2,}/)
    .map(f => f.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export interface OrdenDeAritmetica {
  frase: string
  /** Qué cantidad o fórmula la delata. */
  porQue: string
}

export function ordenesDeAritmetica(texto: string): OrdenDeAritmetica[] {
  const out: OrdenDeAritmetica[] = []
  for (const frase of frasesDe(texto)) {
    const delatora = CANTIDADES_DERIVADAS.find(re => re.test(frase))
    if (!delatora) continue
    if (NEGACION.test(frase) || ATRIBUCION.test(frase) || TRANSCRIPCION.test(frase)) continue
    out.push({ frase, porQue: String(delatora.exec(frase)?.[0] ?? delatora.source) })
  }
  return out
}

export const QUE_NO_VIGILA =
  'Escalas nombradas como cosa que DOCUMENTAR si el médico las dictó (qSOFA, ' +
  'Glasgow, PHQ-9, NIHSS) no se consideran orden de calcular: transcribir un ' +
  'puntaje dictado es legítimo. Si una guía pidiera CALCULAR una de ellas con otras ' +
  'palabras, no se vigila aquí; se declara.'
