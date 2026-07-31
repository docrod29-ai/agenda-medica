/**
 * SIGLAS — etapa 5 del pipeline clínico de dictado.
 *
 * Portado de `config/aliases.json` del paquete del Dr. Las 35 siglas son suyas;
 * lo que se añade aquí es **la separación entre las que se escriben y las que
 * sólo se leen**.
 *
 * ── LA DISTINCIÓN QUE ORDENA TODO EL MÓDULO ──────────────────────────────────
 *
 * El JSON tiene dos cosas mezcladas bajo el mismo nombre de «alias»:
 *
 *   PEEP  ← «presión positiva al final de la espiración»
 *   VExUS ← «vexus»
 *
 * La segunda es **la misma palabra escrita de otra forma**. La primera es **su
 * significado**. Sustituir la primera reescribiría la prosa del médico: si él
 * dictó la frase completa, la nota debe decir la frase completa. Ésa es su nota,
 * y un pipeline de dictado no tiene voto sobre cómo redacta.
 *
 * Así que las formas se clasifican **a mano**, una por una:
 *
 *   · `ortograficos` — se REESCRIBEN. Son la misma sigla con otra ortografía,
 *     otro espaciado o su lectura hablada («ECMO veno venoso» → «ECMO VV»).
 *   · `lectura` — NO se tocan. Sirven para RECONOCER de qué se está hablando:
 *     alimentan el léxico dinámico y el detector de contexto.
 *
 * Clasificarlas por parecido automático sería exactamente la «similitud
 * fonética» que el Dr. prohibió en la regla 3 de su documento.
 *
 * Y además, siempre: la sigla escrita con otra caja se corrige a su forma
 * canónica («pao2» → «PaO2»). Eso es ortografía pura, no interpretación.
 *
 * Módulo PURO.
 */

export interface Sigla {
  /** Como debe quedar escrita. */
  canonica: string
  /** Formas que SE REESCRIBEN a la canónica. */
  ortograficos: readonly string[]
  /** Formas que sólo sirven para reconocer. NUNCA se sustituyen. */
  lectura: readonly string[]
}

/**
 * Las 35 siglas de `aliases.json`, clasificadas.
 *
 * Ninguna sigla nueva: si una falta, falta en el paquete del Dr.
 */
export const SIGLAS: readonly Sigla[] = [
  { canonica: 'CKRT', ortograficos: ['CRRT'],
    lectura: ['terapia de reemplazo renal continua'] },
  { canonica: 'CVVHDF', ortograficos: [], lectura: ['hemodiafiltración venovenosa continua'] },
  { canonica: 'CVVHD', ortograficos: [], lectura: ['hemodiálisis venovenosa continua'] },
  { canonica: 'CVVH', ortograficos: [], lectura: ['hemofiltración venovenosa continua'] },
  { canonica: 'ECMO VV', ortograficos: ['ECMO veno venoso', 'ECMO venovenoso'], lectura: [] },
  { canonica: 'ECMO VA', ortograficos: ['ECMO veno arterial', 'ECMO venoarterial'], lectura: [] },
  { canonica: 'PEEP', ortograficos: [], lectura: ['presión positiva al final de la espiración'] },
  { canonica: 'PIP', ortograficos: [], lectura: ['presión inspiratoria pico'] },
  { canonica: 'Pplat', ortograficos: [], lectura: ['presión plateau', 'presión meseta'] },
  { canonica: 'FiO2', ortograficos: [], lectura: ['fracción inspirada de oxígeno'] },
  { canonica: 'PaO2', ortograficos: [], lectura: ['presión arterial de oxígeno'] },
  { canonica: 'PaCO2', ortograficos: [], lectura: ['presión arterial de dióxido de carbono'] },
  // «PaFi» NO se reescribe a «P/F»: es como el Dr. la dice y la escribe, y ya
  // está en el diccionario de confusiones con esa forma.
  { canonica: 'P/F', ortograficos: [], lectura: ['PaFi', 'PaO2/FiO2'] },
  { canonica: 'VExUS', ortograficos: ['vexus'], lectura: [] },
  { canonica: 'POCUS', ortograficos: [], lectura: ['ultrasonido a pie de cama'] },
  { canonica: 'TAPSE', ortograficos: ['tapse'], lectura: [] },
  { canonica: 'RASS', ortograficos: [], lectura: ['escala de sedación de Richmond'] },
  { canonica: 'CAM-ICU', ortograficos: [], lectura: ['evaluación de delirium en UCI'] },
  { canonica: 'GCS', ortograficos: [], lectura: ['Glasgow', 'escala de Glasgow'] },
  { canonica: 'MRSA', ortograficos: [], lectura: ['Staphylococcus aureus resistente a meticilina'] },
  { canonica: 'VRE', ortograficos: [], lectura: ['enterococo resistente a vancomicina'] },
  // «ESBL» es la sigla inglesa, no otra grafía de «BLEE»: se reconoce, no se cambia.
  { canonica: 'BLEE', ortograficos: [], lectura: ['ESBL', 'betalactamasa de espectro extendido'] },
  { canonica: 'KPC', ortograficos: [], lectura: ['carbapenemasa KPC'] },
  { canonica: 'NDM', ortograficos: [], lectura: ['metalo betalactamasa NDM'] },
  { canonica: 'OXA-48', ortograficos: ['oxa cuarenta y ocho', 'oxa 48'], lectura: [] },
  { canonica: 'HbA1c', ortograficos: [], lectura: ['hemoglobina glucosilada'] },
  { canonica: 'EPOC', ortograficos: [], lectura: ['enfermedad pulmonar obstructiva crónica'] },
  { canonica: 'CPAP', ortograficos: [], lectura: ['presión positiva continua en vía aérea'] },
  { canonica: 'BiPAP', ortograficos: [], lectura: ['presión positiva binivel'] },
  { canonica: 'SBT', ortograficos: [], lectura: ['prueba de ventilación espontánea'] },
  { canonica: 'RSBI', ortograficos: [], lectura: ['índice de respiración rápida superficial'] },
  { canonica: 'HFNC', ortograficos: [], lectura: ['cánula nasal de alto flujo'] },
  { canonica: 'NIV', ortograficos: [], lectura: ['ventilación no invasiva'] },
  { canonica: 'MALDI-TOF', ortograficos: ['maldi tof'], lectura: [] },
  { canonica: 'MIC', ortograficos: [], lectura: ['concentración mínima inhibitoria'] },
]

const sinAcento = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Reglas de reescritura: forma → canónica.
 *
 * Incluye la propia canónica, para arreglar la caja («cvvhdf» → «CVVHDF»). De la
 * más larga a la más corta, o «CVVH» se comería el principio de «CVVHDF».
 */
const REESCRITURAS: readonly { patron: RegExp; canonica: string }[] = SIGLAS
  .flatMap(s => [s.canonica, ...s.ortograficos].map(f => ({ forma: f, canonica: s.canonica })))
  .sort((a, b) => b.forma.length - a.forma.length)
  .map(({ forma, canonica }) => ({
    // Los espacios de la forma hablada pueden ser varios en el transcript.
    patron: new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapar(forma).replace(/\s+/g, '\\s+')})(?=$|[^\\p{L}\\p{N}])`,
      'giu'),
    canonica,
  }))

export interface CambioSigla {
  antes: string
  despues: string
}

export interface ResultadoSiglas {
  texto: string
  cambios: CambioSigla[]
}

/**
 * Deja cada sigla escrita como toca, sin tocar el resto del texto.
 *
 * NO expande una sigla a su significado ni contrae una frase en su sigla, salvo
 * las formas habladas declaradas como ortográficas.
 */
export function normalizarSiglas(texto: string): ResultadoSiglas {
  const cambios: CambioSigla[] = []
  let out = texto

  for (const { patron, canonica } of REESCRITURAS) {
    out = out.replace(patron, (_todo, previo: string, forma: string) => {
      if (forma === canonica) return previo + forma          // ya estaba bien
      cambios.push({ antes: forma, despues: canonica })
      return previo + canonica
    })
  }
  return { texto: out, cambios }
}

/**
 * Todas las formas por las que se puede reconocer una sigla, incluidas las de
 * sólo lectura. Para el léxico dinámico y el detector de contexto — jamás para
 * sustituir.
 */
export function formasDeLectura(): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of SIGLAS) {
    for (const f of [s.canonica, ...s.ortograficos, ...s.lectura]) {
      m.set(sinAcento(f), s.canonica)
    }
  }
  return m
}

export const POR_QUE_NO_SE_EXPANDE =
  'Un alias puede ser la misma sigla escrita de otro modo («vexus» → «VExUS») o ' +
  'su significado («presión positiva al final de la espiración» → «PEEP»). Lo ' +
  'primero es ortografía y se corrige; lo segundo es la prosa del médico y no se ' +
  'toca. Si él dictó la frase completa, la nota dice la frase completa.'
