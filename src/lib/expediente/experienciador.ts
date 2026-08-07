/**
 * ¿A QUIÉN LE PASÓ? — el experienciador (§B8 del charter).
 *
 * ── EL PELIGRO ──────────────────────────────────────────────────────────────
 *
 * En una consulta, la mitad de lo que se dice sobre enfermedades **no es del
 * paciente**:
 *
 *     «mi mamá tuvo cáncer de mama a los cuarenta»
 *     «mi papá murió de un infarto»
 *     «en mi familia todos son diabéticos»
 *
 * Un extractor que no distingue al dueño de la frase convierte un **antecedente
 * heredo-familiar** en un **antecedente personal patológico**. La nota queda
 * diciendo que el paciente tuvo cáncer de mama.
 *
 * Y a diferencia de un dato que falta, éste **no se ve raro**: es una historia
 * clínica perfectamente redactada, con una enfermedad que el paciente nunca
 * tuvo, firmada con cédula profesional. De ahí salen tamizajes que no tocan,
 * seguros que se niegan y decisiones que nadie puede rastrear.
 *
 * Es el mismo modo de fallo que ya costó dos REG: la negación invertida
 * (REG-192) y el pasado convertido en presente (REG-200). **Las tres son la
 * misma pregunta con distinto eje**: ¿quién?, ¿sí o no?, ¿cuándo?
 *
 * ── POR QUÉ ES DETERMINISTA Y NO SE LE DEJA AL MODELO ────────────────────────
 *
 * Al modelo se le pide en el prompt, y aparte se comprueba aquí. Un motor de
 * reglas sobre pronombres y parentescos es aburrido, auditable y no cambia de
 * opinión entre dos ejecuciones. Lo que este módulo no puede decidir, lo dice:
 * devuelve `indeterminado` en vez de adivinar.
 *
 * Módulo PURO, sin dependencias.
 */

export type Experienciador = 'paciente' | 'familiar' | 'indeterminado'

export interface QuienLoVivio {
  quien: Experienciador
  /** El parentesco tal como se dijo, cuando se pudo saber: «mamá», «hermano». */
  parentesco?: string
  /** Qué disparó la decisión. Va a la pantalla cuando hay que explicarla. */
  porQue: string
}

/**
 * Parentescos como se dicen en un consultorio mexicano.
 *
 * Incluye las formas coloquiales —«jefa», «apá»— porque la gente las usa
 * hablando y un motor que sólo conoce «madre» y «padre» falla justo con quien
 * habla con más confianza.
 */
const PARENTESCOS = [
  'mama', 'mamá', 'madre', 'jefa', 'amá',
  'papa', 'papá', 'padre', 'jefe', 'apá',
  'hermano', 'hermana', 'hermanos', 'hermanas', 'carnal',
  'abuelo', 'abuela', 'abuelos', 'abuelas', 'abue',
  'tio', 'tío', 'tia', 'tía', 'tios', 'tíos', 'tias', 'tías',
  'primo', 'prima', 'primos', 'primas',
  'hijo', 'hija', 'hijos', 'hijas',
  'esposo', 'esposa', 'marido', 'mujer', 'pareja',
  'suegro', 'suegra', 'cuñado', 'cuñada',
  'sobrino', 'sobrina', 'nieto', 'nieta',
  'bisabuelo', 'bisabuela',
] as const

const PARENTESCO_RE = PARENTESCOS.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

/**
 * «mi mamá», «su papá», «mis hermanos», «la mamá del paciente».
 *
 * El posesivo es lo que ata el parentesco a alguien. Sin él, «la hermana» puede
 * ser cualquiera —incluso la enfermera— y no se concluye nada.
 *
 * ── POR QUÉ NO HAY `\\b` AL FINAL, Y ES IMPORTANTE ────────────────────────────
 *
 * En JavaScript `\\w` es **ASCII**: la `á` no cuenta como letra, así que `\\b`
 * detrás de «mamá» **no encuentra ningún límite de palabra** y el patrón no
 * dispara. Escrito con `\\b`, este motor no reconocía «mi mamá» ni «mi papá»
 * —las dos formas más frecuentes— y sí «mi abuela», que acaba en vocal sin
 * acento. Media función muerta y la otra media funcionando: lo peor para darse
 * cuenta.
 *
 * Ya había costado antes, en el motor de negación con «no sé». Por eso aquí se
 * usa `(?![\\p{L}])`, que sí entiende Unicode.
 */
const FAMILIAR_CON_POSESIVO = new RegExp(
  `(?:^|[^\\p{L}])(?:mi|mis|su|sus|del|de\\s+la|la|el)\\s+(${PARENTESCO_RE})(?![\\p{L}])`,
  'iu',
)

/** «en mi familia», «por parte de mi madre», «antecedentes familiares». */
const MARCO_FAMILIAR = [
  /\ben\s+(?:mi|su|la)\s+familia\b/iu,
  /\bpor\s+parte\s+de\s+(?:mi|su)\b/iu,
  /\bantecedentes?\s+(?:heredo[\s-]*)?familiar(?:es)?\b/iu,
  /\bcarga\s+gen[eé]tica\b/iu,
  /\ble\s+viene\s+de\s+familia\b/iu,
  /\bes\s+hereditari[oa]\b/iu,
] as const

/**
 * Marcas de que la frase vuelve al PACIENTE aunque nombre a un familiar.
 *
 *     «mi mamá me dijo que yo tuve convulsiones de niño»
 *     «mi esposa dice que ronco»
 *
 * El sujeto de la enfermedad es el paciente; el familiar sólo es quien lo
 * cuenta. Sin esta salvedad, el motor mandaría al apartado familiar cosas que
 * son del paciente — y equivocarse hacia ese lado también borra un antecedente
 * real.
 */
const VUELVE_AL_PACIENTE = [
  /\bme\s+(?:dijo|dice|dijeron|cuenta|contaron|comento|comentó)\b/iu,
  /\b(?:dice|dicen|cuenta|cuentan|dijo|dijeron)\s+que\s+(?:yo|me)\b/iu,
  /**
   * «mi esposa dice que ronco», «mi mamá cuenta que me desmayé».
   *
   * El familiar es quien lo REPORTA; el verbo va en primera persona y el
   * síntoma es del paciente. Sin esto, el ronquido acababa en los antecedentes
   * familiares — y equivocarse hacia ese lado **borra un dato real del
   * paciente**, que es tan malo como inventarle uno.
   */
  /\b(?:dice|dicen|dijo|dijeron|cuenta|cuentan)\s+que\s+\S*\s*\w+o(?![\p{L}])/iu,
  /\bque\s+yo\b/iu,
  /\ba\s+m[ií]\s+me\b/iu,
  /\bcuando\s+(?:yo\s+)?era\s+(?:ni[ñn][oa]|chic[oa]|beb[eé])\b/iu,
] as const

/** Primera persona clara: la frase es del paciente. */
const PRIMERA_PERSONA = [
  /**
   * Los tres cierran con `(?![\p{L}])` y no con `\b` por lo mismo de arriba:
   * escritos con `\b`, «a mí», «me salió», «padecí» y «sentí» NO disparaban.
   *
   * Los cazó el guardián `el-limite-de-palabra-no-entiende-acentos` en el mismo
   * archivo donde la lección ya estaba escrita — que es exactamente por qué la
   * lección tenía que dejar de ser un comentario y volverse una prueba.
   */
  /\b(?:yo|a\s+m[ií])(?![\p{L}])/iu,
  /\bme\s+(?:duele|dieron|dio|salio|salió|detectaron|diagnosticaron|operaron|internaron)(?![\p{L}])/iu,
  /\b(?:tengo|tuve|padezco|padec[ií]|siento|sent[ií]|traigo|ando)(?![\p{L}])/iu,
] as const

/**
 * ¿De quién habla esta frase?
 *
 * Devuelve `indeterminado` cuando no hay señal suficiente. **Eso no es un
 * fallo**: es la respuesta correcta cuando la frase no dice de quién habla, y es
 * lo que impide que el motor invente un dueño.
 */
export function deQuienEs(frase: string): QuienLoVivio {
  const t = String(frase ?? '')
  if (!t.trim()) return { quien: 'indeterminado', porQue: 'frase vacía' }

  const familiar = FAMILIAR_CON_POSESIVO.exec(t)
  const marco = MARCO_FAMILIAR.find(re => re.test(t))

  if (familiar || marco) {
    // Primero la salvedad: el familiar puede ser sólo quien lo cuenta.
    const devuelve = VUELVE_AL_PACIENTE.find(re => re.test(t))
    if (devuelve) {
      return {
        quien: 'paciente',
        parentesco: familiar?.[1],
        porQue: 'nombra a un familiar, pero el sujeto de la frase es el paciente',
      }
    }
    return {
      quien: 'familiar',
      parentesco: familiar?.[1],
      porQue: familiar
        ? `habla de «${familiar[1]}», no del paciente`
        : 'la frase enmarca el dato como antecedente familiar',
    }
  }

  if (PRIMERA_PERSONA.some(re => re.test(t))) {
    return { quien: 'paciente', porQue: 'la frase está en primera persona' }
  }

  return { quien: 'indeterminado', porQue: 'la frase no dice de quién habla' }
}

/** ¿Este dato debe ir al apartado de antecedentes familiares y no al personal? */
export function esAntecedenteFamiliar(frase: string): boolean {
  return deQuienEs(frase).quien === 'familiar'
}

/**
 * Las frases de un dictado que hablan de un familiar.
 *
 * Sirve para el aviso: «esto lo dijo de su mamá, no de él». No decide sola qué
 * se guarda — sólo señala dónde mirar.
 */
/**
 * Dónde termina una idea y empieza otra.
 *
 * ── UNA FRASE PUEDE TENER DOS DUEÑOS ────────────────────────────────────────
 *
 *     «yo no tengo diabetes pero mi mamá sí»
 *
 * Analizada entera, esta frase se atribuye al familiar y se pierde lo que de
 * verdad dice: que **el paciente la niega** y que **la mamá sí la tiene**. Son
 * dos datos distintos, de dos personas distintas, en catorce palabras.
 *
 * Por eso se corta también en los conectores que cambian de sujeto —«pero»,
 * «aunque», «en cambio», «mientras que»— y no sólo en los puntos. Lo encontró
 * medir frases compuestas: cada motor por su lado acertaba, y juntos mentían.
 */
const SEPARADOR_DE_CLAUSULAS =
  /(?<=[.;:!?])\s+|\n+|\s+(?:pero|aunque|en\s+cambio|mientras\s+que|sin\s+embargo)\s+/iu

export function frasesDeFamiliar(texto: string): { frase: string; parentesco?: string }[] {
  return String(texto ?? '')
    .split(SEPARADOR_DE_CLAUSULAS)
    .map(f => f.trim())
    .filter(Boolean)
    .map(f => ({ f, r: deQuienEs(f) }))
    .filter(x => x.r.quien === 'familiar')
    .map(x => ({ frase: x.f, parentesco: x.r.parentesco }))
}

export const POR_QUE_IMPORTA =
  'Un extractor que no distingue al dueño de la frase convierte un antecedente ' +
  'heredo-familiar en uno personal. La nota queda diciendo que el paciente tuvo ' +
  'una enfermedad que nunca tuvo, y no se ve raro: es una historia clínica bien ' +
  'redactada y firmada con cédula.'

export const POR_QUE_INDETERMINADO_NO_ES_FALLO =
  'Cuando la frase no dice de quién habla, la respuesta correcta es que no se ' +
  'sabe. Un motor que elige dueño sin señal inventa exactamente lo que este ' +
  'módulo existe para impedir.'

/** Sólo para pruebas y para la pantalla: los parentescos que reconoce. */
export const PARENTESCOS_RECONOCIDOS: readonly string[] = PARENTESCOS
