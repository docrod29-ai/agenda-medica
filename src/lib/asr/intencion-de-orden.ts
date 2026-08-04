/**
 * LO QUE SE CONSIDERÓ NO ES LO QUE SE INDICÓ.
 *
 * ── EL HUECO (criterio del charter, tolerancia CERO) ─────────────────────────
 *
 * «Órdenes activas sin confirmar = 0 · `ORDER_INTENT ≠ ORDER`.»
 *
 * En una consulta el médico piensa en voz alta: «**si no mejora en 48 horas** le
 * agregamos amoxicilina», «**podríamos** usar un IECA», «lo dejamos **pendiente
 * de** la biometría». Nada de eso es una indicación: es un plan condicionado que
 * puede no ocurrir nunca.
 *
 * El extractor ve el nombre del fármaco y lo pone en `medicamentos`. Y
 * `medicamentos` **alimenta la receta**. Así que una hipótesis dicha en voz alta
 * puede salir impresa, firmada y con cédula — y el paciente la compra.
 *
 * Antes de esto no había nada que lo mirara: ni una regla determinista, ni una
 * línea en el prompt. Se buscó en todo el repositorio.
 *
 * ── POR QUÉ NO SE BORRA ──────────────────────────────────────────────────────
 *
 * Porque a veces **sí** es una orden: «si tiene dolor, paracetamol» es una
 * indicación PRN perfectamente válida y muy común. Borrar por condicional
 * perdería medicación real, que es peor que dejarla y preguntar.
 *
 * Se **pregunta**. Va por el mismo canal que las otras cinco ambigüedades —el
 * aviso de «conviene confirmar antes de firmar»— que ya existe y ya está en
 * pantalla en consulta y en UCI.
 *
 * ── Y POR QUÉ ESTO NO ES UNA DECISIÓN CLÍNICA ────────────────────────────────
 *
 * No juzga si el fármaco es correcto, ni su dosis, ni si procede. Sólo mira
 * **cómo se dijo**: es gramática, no medicina. La decisión de si esa
 * indicación va o no va sigue siendo entera del médico.
 *
 * Módulo PURO.
 */

const limpia = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Marcas de que lo dicho **todavía no es una orden**.
 *
 * Son formas del español de México tal como se dictan. Se buscan en la frase que
 * contiene al fármaco, no en toda la consulta: «si no mejora» a los tres minutos
 * no condiciona lo que se indicó a los quince.
 */
export const MARCAS_CONDICIONALES: readonly RegExp[] = [
  // Condicional puro
  /\bsi no (mejora|cede|baja|responde|funciona|hay respuesta)\b/,
  /\bsi (persiste|continua|sigue|empeora|vuelve|reaparece|aumenta)\b/,
  /\ben caso de que\b/,
  /\bde no (mejorar|ceder|responder)\b/,
  // Posibilidad / deliberación
  /\b(podriamos|podemos valorar|se podria|habria que valorar|valoraria)\b/,
  /\b(tal vez|quiza|quizas|a lo mejor)\b/,
  /\b(estaria pensando en|estoy pensando en|se me ocurre)\b/,
  // Diferido
  /\b(pendiente de|queda pendiente|lo dejamos pendiente)\b/,
  /\b(en la proxima|para la siguiente consulta|si acaso mas adelante)\b/,
  // Deliberación explícita
  /\b(hay que valorar|habria que considerar|se puede considerar)\b/,
]

/**
 * «En caso de» y «si» **también** introducen una indicación PRN legítima.
 *
 * «Si tiene dolor, paracetamol» es una orden de verdad. Estas marcas dicen que
 * la condición es un **síntoma del paciente**, no una revaloración del médico —
 * y entonces la mención NO es una intención diferida.
 */
export const MARCAS_PRN: readonly RegExp[] = [
  /\bsi (tiene|presenta|siente|le duele|hay) (dolor|fiebre|nausea|vomito|comezon|ansiedad|insomnio)\b/,
  /\ben caso de (dolor|fiebre|nausea|vomito|crisis)\b/,
  /\b(por razon necesaria|prn|si lo requiere|si lo necesita)\b/,
]

/** Parte el dictado en frases, que es la unidad donde la condición aplica. */
export function frases(texto: string): string[] {
  return (texto ?? '')
    .split(/(?<=[.!?;:\n])\s+|\n+/)
    .map(f => f.trim())
    .filter(Boolean)
}

export interface MencionFarmaco {
  /** La frase completa en la que apareció. */
  frase: string
  /** ¿Va enmarcada como algo que todavía no se indica? */
  condicional: boolean
  /** ¿La condición es un síntoma del paciente (PRN)? Entonces sí es una orden. */
  prn: boolean
}

/** Todas las menciones de un fármaco en el dictado, con su encuadre. */
export function mencionesDe(texto: string, farmaco: string): MencionFarmaco[] {
  const f = limpia(farmaco).trim()
  if (!f) return []
  return frases(texto)
    .filter(fr => limpia(fr).includes(f))
    .map(fr => {
      const l = limpia(fr)
      return {
        frase: fr,
        condicional: MARCAS_CONDICIONALES.some(re => re.test(l)),
        prn: MARCAS_PRN.some(re => re.test(l)),
      }
    })
}

/**
 * ¿Este fármaco se **consideró** y nunca se **indicó**?
 *
 * Cierto sólo cuando **todas** sus menciones son condicionales y ninguna es PRN.
 * Basta una mención firme —«le doy amoxicilina 500 cada 8 horas»— para que sea
 * una orden, aunque antes se hubiera dudado en voz alta: el médico se decidió.
 */
export function soloPropuesto(texto: string, farmaco: string): boolean {
  const m = mencionesDe(texto, farmaco)
  if (!m.length) return false          // no se mencionó: no lo juzga este módulo
  if (m.some(x => x.prn)) return false // una PRN es una orden de verdad
  return m.every(x => x.condicional)
}

/**
 * De una lista de términos, los que sólo se propusieron.
 *
 * Devuelve los términos, no sus índices: la lista de la nota y la de la
 * extracción se desfasan en cuanto el médico borra uno, y un índice desfasado
 * señalaría el elemento equivocado.
 */
export function soloPropuestos(texto: string, terminos: readonly string[] | undefined): string[] {
  if (!texto?.trim() || !terminos?.length) return []
  const out: string[] = []
  for (const t of terminos) {
    const n = String(t ?? '').trim()
    if (!n) continue
    if (soloPropuesto(texto, n) && !out.includes(n)) out.push(n)
  }
  return out
}

/** Los medicamentos de la nota que sólo se propusieron. Alimentan la RECETA. */
export function medicamentosSoloPropuestos(
  texto: string,
  medicamentos: readonly { nombre?: string }[] | undefined,
): string[] {
  return soloPropuestos(texto, (medicamentos ?? []).map(m => String(m?.nombre ?? '')))
}

/**
 * Los estudios de la nota que sólo se propusieron.
 *
 * ── POR QUÉ IMPORTA IGUAL QUE UN FÁRMACO ────────────────────────────────────
 *
 * `estudiosOrden` alimenta la **orden médica impresa**: el papel que el paciente
 * se lleva al laboratorio o al centro de imagen. Un «si no mejora, le pido una
 * tomografía» convertido en orden activa manda al paciente a hacerse —y a
 * pagar— un estudio que sólo se estaba considerando.
 *
 * Se separa del de fármacos porque el documento y la acción son distintos: uno
 * se corrige en la receta y el otro en la orden.
 */
export function estudiosSoloPropuestos(
  texto: string,
  estudios: readonly string[] | undefined,
): string[] {
  return soloPropuestos(texto, estudios)
}

export const POR_QUE_TAMBIEN_LOS_ESTUDIOS =
  '`estudiosOrden` alimenta la ORDEN MÉDICA IMPRESA, el papel que el paciente se ' +
  'lleva al laboratorio. Un «si no mejora, le pido una tomografía» convertido en ' +
  'orden activa manda al paciente a hacerse —y a pagar— un estudio que sólo se ' +
  'estaba considerando.'

export const POR_QUE_NO_SE_BORRA =
  'A veces sí es una orden: «si tiene dolor, paracetamol» es una indicación PRN ' +
  'válida y muy común. Borrar por condicional perdería medicación real, que es ' +
  'peor que dejarla y preguntar.'

export const POR_QUE_NO_ES_UNA_DECISION_CLINICA =
  'No juzga si el fármaco es correcto, ni su dosis, ni si procede. Sólo mira ' +
  'CÓMO se dijo: es gramática, no medicina. Si esa indicación va o no va sigue ' +
  'siendo entero del médico.'

export const POR_QUE_UNA_MENCION_FIRME_MANDA =
  'Basta una mención firme para que sea una orden, aunque antes se hubiera ' +
  'dudado en voz alta: el médico se decidió, y seguir preguntando por algo que ' +
  'ya resolvió es la definición de fatiga de alertas.'
