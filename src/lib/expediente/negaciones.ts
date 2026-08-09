/**
 * LO QUE EL PACIENTE NEGÓ NO PUEDE APARECER COMO DIAGNÓSTICO.
 *
 * ── EL CASO, ENCONTRADO POR EL DR. EN PRODUCCIÓN (3-ago-2026) ────────────────
 *
 * En la transcripción:
 *
 *     «¿Enfermedades crónicas como diabetes o presión alta?  **No.**»
 *
 * En el resumen que salió:
 *
 *     «Paciente con Hipertensión arterial, Diabetes mellitus tipo 2.»
 *
 * El paciente contestó **que no** y la nota le puso dos enfermedades crónicas.
 * En un expediente eso no es un detalle de redacción: cambia el riesgo
 * quirúrgico, cambia la elección de fármacos y viaja a todas las notas
 * siguientes, porque los antecedentes se arrastran.
 *
 * ── POR QUÉ PASA ─────────────────────────────────────────────────────────────
 *
 * El interrogatorio se dicta **nombrando las enfermedades en la pregunta**. Un
 * modelo que extrae términos ve «diabetes» y «presión alta» en el texto y las
 * cosecha; el «No» que viene después es una palabra corta, en otra frase, dicha
 * por otra persona. Sin separación de voces —que es lo que arregló la v973— ni
 * siquiera se sabe quién preguntó y quién contestó.
 *
 * ── POR QUÉ ESTO ES UN MOTOR Y NO UNA REGLA MÁS DEL PROMPT ───────────────────
 *
 * La regla del prompt se añade igual (es barata y ayuda), pero un prompt es una
 * petición: se cumple casi siempre, y «casi siempre» sobre un antecedente
 * crónico no es suficiente. Esto lee la transcripción con reglas fijas y
 * **contrasta** lo que el paciente negó contra lo que la nota afirma. Si
 * discrepan, lo dice.
 *
 * ── LO QUE ESTE MÓDULO **NO** DECIDE ─────────────────────────────────────────
 *
 * No decide si el paciente tiene o no la enfermedad. Un paciente puede negar la
 * diabetes y tenerla documentada en su expediente de hace tres años, y entonces
 * la nota tiene razón y el interrogatorio no. Lo único que este motor afirma es
 * que **hay una contradicción entre el dictado y la nota**, y que la resuelve el
 * médico. Decidir cuál de las dos vale sería tomar una decisión clínica.
 *
 * Módulo PURO.
 */
import { primeraMencionSinEscudo } from '@/lib/expediente/mencion-en-la-nota'

/**
 * Las enfermedades que se preguntan en el interrogatorio dirigido, con las
 * formas en que se dicen en la consulta mexicana.
 *
 * NO es una lista de diagnósticos válidos ni un criterio clínico: es
 * vocabulario, y sirve para lo mismo que un diccionario. Que falte una
 * enfermedad significa que ese caso no se vigila —no que se dé por bueno—; por
 * eso el motor sólo puede señalar de menos, nunca de más.
 */
export const CRONICAS: { canonica: string; formas: readonly string[] }[] = [
  { canonica: 'diabetes', formas: ['diabetes', 'diabético', 'diabetica', 'diabética', 'diabetico', 'dm2', 'dm 2', 'diabetes mellitus'] },
  { canonica: 'hipertensión arterial', formas: ['hipertensión', 'hipertension', 'hipertenso', 'hipertensa', 'presión alta', 'presion alta', 'tensión alta', 'tension alta', 'hta'] },
  { canonica: 'asma', formas: ['asma', 'asmático', 'asmatico', 'asmática'] },
  { canonica: 'cáncer', formas: ['cáncer', 'cancer', 'neoplasia', 'tumor maligno'] },
  { canonica: 'enfermedad renal crónica', formas: ['insuficiencia renal', 'enfermedad renal', 'renal crónica', 'renal cronica'] },
  { canonica: 'cardiopatía', formas: ['cardiopatía', 'cardiopatia', 'infarto', 'insuficiencia cardiaca', 'insuficiencia cardíaca'] },
  { canonica: 'hipotiroidismo', formas: ['hipotiroidismo', 'tiroides'] },
  { canonica: 'dislipidemia', formas: ['dislipidemia', 'colesterol alto', 'triglicéridos altos', 'trigliceridos altos'] },
  { canonica: 'epilepsia', formas: ['epilepsia', 'convulsiones'] },
  { canonica: 'VIH', formas: ['vih', 'sida'] },
  { canonica: 'tuberculosis', formas: ['tuberculosis', 'tb pulmonar'] },
  { canonica: 'EPOC', formas: ['epoc', 'enfisema', 'bronquitis crónica'] },
]

/**
 * Respuestas que cuentan como negación.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 */
const NEGATIVAS = /^\s*(?:ah?,?\s*)?(?:no|nop|ninguna|ninguno|nada|negativo|nunca|que\s+yo\s+sepa\s+no)\b/i

/**
 * ── LO QUE ESTORBA DELANTE DE LA RESPUESTA (6-ago-2026, REG-192) ─────────────
 *
 * `NEGATIVAS` exige que la respuesta EMPIECE por la negación, y en una
 * transcripción real casi nunca empieza ahí: delante viene la marca de turno
 * («—», «-», «Paciente:») o una muletilla («pues», «fíjese que», «mmm»).
 *
 * Medido con el motor real sobre respuestas de consulta mexicana: de siete
 * formas de decir que no, **cazaba una**.
 *
 *     «¿Padece diabetes? — No padece diabetes.»  →  detectada (por otra vía)
 *     «¿Tiene hipertensión? — Pues no.»          →  NO
 *     «¿Ha tenido asma? — Fíjese que no.»        →  NO
 *     «¿Y tuberculosis? — Tampoco.»              →  NO
 *     «¿Tiene cáncer? — No.»                     →  NO  ← ni la más simple
 *
 * Se quita lo que estorba antes de mirar. NO se toca `NEGATIVAS`: se le da la
 * frase limpia.
 */
const RUIDO_ANTES_DE_LA_RESPUESTA =
  /^\s*(?:[-—–:>»"'`]+\s*)*(?:(?:paciente|acompa[ñn]ante|familiar|sr|sra|se[ñn]or[a]?)\s*:\s*)?(?:(?:pues|bueno|este|mmm+|eh+|ay|f[ií]jese\s+que|la\s+verdad(?:\s+es\s+que)?|mire|d[ée]jeme\s+ver|creo\s+que)\s*,?\s*)*/i

/**
 * «No sé» NO ES UNA NEGACIÓN — y al limpiar el ruido pasaría a serlo.
 *
 * Ésta es la trampa de la reparación: quitando el guion de turno, «— No sé» se
 * convierte en «no sé», que empieza por «no» y `NEGATIVAS` lo daría por bueno.
 * El sistema registraría que el paciente **negó** una enfermedad cuando lo que
 * dijo es que **no lo sabe**.
 *
 * Es exactamente la regla que este archivo ya defiende del otro lado: ausencia
 * de dato no es dato de ausencia. Aquí se defiende de la reparación misma.
 */
const NO_ES_NEGACION =
  /^\s*no\s+(?:s[eé]|me\s+acuerdo|recuerdo|estoy\s+segur[oa]|sabr[ií]a\s+decirle|s[eé]\s+si|tengo\s+idea|le\s+puedo\s+decir)(?![a-záéíóúñ])/i
/**
 * ── OJO CON `\b` DESPUÉS DE UNA VOCAL ACENTUADA ──────────────────────────────
 *
 * Aquí había un `\b` al final y **no cazaba «No sé.»**: en JavaScript `\w` es
 * ASCII, así que «é» no cuenta como carácter de palabra y entre «é» y «.» no hay
 * límite de palabra que valga. `\bs[eé]\b` funcionaba con «se» y fallaba con
 * «sé» — justo la forma que se escribe.
 *
 * El resultado era el peor posible: «¿Tiene epilepsia? — No sé» quedaba
 * registrado como que el paciente **negó** la epilepsia.
 *
 * Se sustituye por una anticipación negativa que sí entiende acentos.
 */

/**
 * Las formas de decir que no que NO empiezan por «no».
 *
 * `tampoco` es la más frecuente cuando se pregunta por varias cosas seguidas:
 * «¿Diabetes? No. ¿Hipertensión? Tampoco.»
 */
const NEGATIVAS_SIN_NO = /^\s*(?:tampoco|jam[aá]s|para\s+nada|en\s+absoluto|qu[eé]\s+va|negativo)\b/i

/**
 * La condición dicha y negada después: «Diabetes no.», «Asma no, gracias a Dios».
 *
 * En el habla se responde repitiendo lo preguntado. Sin esto, la respuesta más
 * natural a «¿diabetes?» se perdía.
 */
const NIEGA_POSPUESTO = /\b(?:no|nunca|jam[aá]s)\s*[.,;!]?\s*$/i

/** ¿Esta respuesta niega? Con el ruido de turno y de muletilla ya quitado. */
export function respuestaNiega(respuesta: string): boolean {
  const limpia = String(respuesta ?? '').replace(RUIDO_ANTES_DE_LA_RESPUESTA, '')
  if (!limpia.trim()) return false
  /** Primero lo que NO es negación: «no sé» empieza por «no» y no niega nada. */
  if (NO_ES_NEGACION.test(limpia)) return false
  if (NEGATIVAS.test(limpia)) return true
  if (NEGATIVAS_SIN_NO.test(limpia)) return true
  /**
   * La pospuesta sólo cuenta en respuestas cortas. En una frase larga un «no»
   * final puede pertenecer a otra cosa («…me dijeron que fuera pero no»), y
   * fabricar una negación es peor que perderla.
   */
  if (limpia.length <= 40 && NIEGA_POSPUESTO.test(limpia)) return true
  return false
}

/**
 * Respuestas que cuentan como AFIRMACIÓN.
 *
 * Hermana de `respuestaNiega` y por el mismo motivo: la enfermedad se nombra en
 * la pregunta y la respuesta es una palabra suelta en otra frase. Sin ella, «¿Ha
 * tenido neumonía alguna vez? Sí, hace tres años» no se puede leer — la pregunta
 * no dice cuándo y la respuesta no dice qué (REG-270).
 *
 * «No sé» no es ninguna de las dos: no niega —esta misma regla lo defiende más
 * arriba— y tampoco afirma. En la duda no se afirma; aquí no afirmar sólo cuesta
 * un aviso que no sale, mientras que afirmar de más fabrica un antecedente.
 *
 * ── EL MISMO `\b` DESPUÉS DE VOCAL ACENTUADA ─────────────────────────────────
 *
 * `s[ií]\b` **no caza «Sí, hace tres años»**, por lo que ya está escrito arriba
 * para «No sé»: `\w` es ASCII y entre «í» y «,» no hay límite de palabra. El
 * cierre del grupo va con una anticipación negativa, que sí entiende acentos, y
 * de paso deja fuera «siempre» y «sido».
 */
const AFIRMATIVAS = /^\s*(?:s[ií]|sip|claro|correcto|efectivamente|as[ií]\s+es|exacto|afirmativo)(?![a-záéíóúñ])/i

/**
 * ¿Esta respuesta afirma? Con el mismo ruido de turno y muletilla ya quitado.
 *
 * NO es la negación de `respuestaNiega`: el silencio y la duda no son ninguna de
 * las dos, y ésa es justamente la respuesta que no se puede inventar.
 */
export function respuestaAfirma(respuesta: string): boolean {
  const limpia = String(respuesta ?? '').replace(RUIDO_ANTES_DE_LA_RESPUESTA, '')
  if (!limpia.trim()) return false
  /**
   * Lo que niega no afirma, aunque empiece por una forma afirmativa. Se
   * comprueba primero por la misma razón que allí se comprueba `NO_ES_NEGACION`
   * antes que nada: el orden es el que decide.
   */
  if (respuestaNiega(limpia)) return false
  return AFIRMATIVAS.test(limpia)
}

/**
 * La respuesta a la pregunta que está en `fs[i]`.
 *
 * Lo que sigue al signo de cierre en la MISMA frase, o la frase siguiente si la
 * pregunta terminó ahí: el dictado corrido no separa turnos. Vive aquí, y no
 * copiado en cada motor, porque los dos que lo necesitan tienen que emparejar
 * igual — si uno leyera una frase más allá que el otro, el mismo dictado daría
 * un aviso de negación y otro de temporalidad que se contradicen.
 *
 * Sin signo de cierre no hay resto: `indexOf('?')` devolvía −1 y el `slice(0)`
 * que salía de ahí entregaba la pregunta entera como si fuera su propia
 * respuesta.
 */
export function respuestaA(fs: readonly string[], i: number): string {
  const f = fs[i] ?? ''
  const cierre = f.indexOf('?')
  const resto = cierre >= 0 ? f.slice(cierre + 1).trim() : ''
  return resto || (fs[i + 1] ?? '')
}

/**
 * Marcas de que un término ya viene negado en la propia frase.
 *
 * ── EL PRETÉRITO FALTABA (REG-270) ───────────────────────────────────────────
 *
 * Sólo miraba el presente («no tiene», «no padece»), así que «**no tuvo**
 * tuberculosis» y «**nunca ha tenido** neumonía» pasaban por afirmaciones. En el
 * motor de negaciones eso es una contradicción que no se avisa; en el de
 * temporalidad, que se apoya en esta misma expresión, era peor: la negación se
 * cosechaba como un antecedente en pasado.
 */
const NIEGA_EN_LINEA = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido|he\s+tenido|tuvo|tuve|padecio|padeci|padecia|tenia|sufrio)|nunca\s+(?:tuvo|tuve|ha\s+tenido|he\s+tenido|padecio|padeci)|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Trocea por frases conservando el signo, que es lo que distingue pregunta de respuesta. */
export function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.?!¡¿\n])\s+/)
    .map(f => f.trim())
    .filter(Boolean)
}

export const esPregunta = (f: string) => f.includes('?') || f.trimStart().startsWith('¿')

/**
 * ¿Esta frase niega en línea lo que nombra?
 *
 * El acento se normaliza **aquí dentro**, y no en cada llamador: las formas en
 * pretérito se dictan con acento («no padeció», «no sufrió») y sin normalizar no
 * servirían de nada.
 */
export const niegaEnLinea = (texto: string): boolean => NIEGA_EN_LINEA.test(sinAcentos(texto))

/** Qué enfermedades crónicas nombra esta frase. */
export function cronicasEn(frase: string): string[] {
  const t = sinAcentos(frase)
  const out: string[] = []
  for (const c of CRONICAS) {
    if (c.formas.some(f => t.includes(sinAcentos(f)))) out.push(c.canonica)
  }
  return out
}

export interface Negada {
  condicion: string
  /** La pregunta y la respuesta, para que el médico juzgue sin abrir el audio. */
  cita: string
}

/**
 * Lo que el paciente negó, leído del dictado.
 *
 * Dos formas, que son las dos que ocurren de verdad:
 *
 * 1. **Pregunta con la enfermedad + respuesta negativa.** El caso que falló.
 *    La respuesta puede venir en la frase siguiente o pegada en la misma —el
 *    dictado corrido no separa turnos— así que se miran las dos.
 * 2. **Negación en línea**: «niega diabetes», «no tiene hipertensión».
 */
export function condicionesNegadas(transcripcion: string): Negada[] {
  const fs = frases(transcripcion)
  const vistas = new Map<string, Negada>()
  const anotar = (condicion: string, cita: string) => {
    if (!vistas.has(condicion)) vistas.set(condicion, { condicion, cita: cita.slice(0, 200) })
  }

  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const cs = cronicasEn(f)
    if (!cs.length) continue

    if (niegaEnLinea(f)) {
      for (const c of cs) anotar(c, f)
      continue
    }
    if (!esPregunta(f)) continue

    const respuesta = respuestaA(fs, i)
    if (respuestaNiega(respuesta)) {
      for (const c of cs) anotar(c, `${f} ${respuesta}`.trim())
    }
  }
  return [...vistas.values()]
}

export interface Contradiccion extends Negada {
  /** El fragmento de la nota que la afirma. */
  enLaNota: string
}

/**
 * Dónde la nota AFIRMA algo que el paciente negó.
 *
 * Una mención no basta: la nota puede decir «niega diabetes», que es justo lo
 * correcto. Se busca el término y se mira hacia atrás por si ya viene negado; si
 * viene, no hay contradicción.
 *
 * Se miran **todas** las apariciones y no sólo la primera: una nota que niega la
 * diabetes en el interrogatorio y la diagnostica en la impresión tenía las dos
 * cosas, y la primera silenciaba a la segunda (REG-192). El criterio vive en
 * `mencion-en-la-nota.ts` porque la temporalidad tenía esta misma línea copiada.
 */
export function contradicciones(negadas: readonly Negada[], textoNota: string): Contradiccion[] {
  const out: Contradiccion[] = []
  for (const n of negadas) {
    const formas = CRONICAS.find(c => c.canonica === n.condicion)?.formas ?? [n.condicion]
    const m = primeraMencionSinEscudo(textoNota, formas, NIEGA_EN_LINEA)
    if (m) out.push({ ...n, enLaNota: m.cita })
  }
  return out
}

/**
 * El aviso, redactado para que se pueda resolver sin volver al audio.
 *
 * Dice lo que se oyó y lo que se escribió, en ese orden, y **no dice cuál es
 * correcta**: puede que el paciente niegue una diabetes que sí tiene
 * documentada. La contradicción la resuelve el médico; el sistema sólo se niega
 * a dejarla pasar en silencio.
 */
export function avisoDeContradiccion(c: Contradiccion): string {
  return `«${c.condicion}»: en el dictado se oyó una negación (${c.cita}), pero la nota lo afirma (…${c.enLaNota}…). Revisa cuál corresponde antes de firmar.`
}

export const POR_QUE_NO_SE_CORRIGE_SOLO =
  'Este motor no borra el diagnóstico ni lo da por falso. Un paciente puede ' +
  'negar una diabetes que sí tiene documentada, y entonces la nota tiene razón ' +
  'y el interrogatorio no. Lo único que se afirma es que dictado y nota se ' +
  'contradicen; cuál vale es una decisión clínica del médico.'

export const POR_QUE_UN_MOTOR_Y_NO_SOLO_PROMPT =
  'La regla del prompt se añade igual porque es barata, pero un prompt es una ' +
  'petición: se cumple casi siempre. «Casi siempre» sobre un antecedente ' +
  'crónico —que cambia el riesgo quirúrgico y se arrastra a todas las notas ' +
  'siguientes— no es suficiente.'

/**
 * ── LA MISMA DEFENSA EN EL EXTRACTOR DE ENTIDADES ────────────────────────────
 *
 * La nota no es el único sitio donde el término se cosecha de la pregunta: el
 * panel «Extraer entidades clínicas» corre sobre EL MISMO texto y devuelve
 * `conditions` con su `certeza`. Ahí «diabetes» salía como **confirmado**.
 *
 * Reparar sólo la nota habría dejado la contradicción viva en la pantalla de al
 * lado — y con peor pinta, porque una entidad estructurada parece un dato
 * verificado.
 */

/** Lo mínimo que hace falta de una condición extraída. El resto se conserva. */
export interface CondicionExtraida {
  texto: string
  certeza?: string
  [k: string]: unknown
}

export interface CorreccionCerteza {
  texto: string
  condicion: string
  cita: string
}

/**
 * Reclasifica como **descartado** lo que el paciente negó — no lo borra.
 *
 * Borrarlo perdería información clínica real: «niega diabetes» es un negativo
 * pertinente y va en la nota. Lo que no puede pasar es que viaje como
 * *confirmado*, porque a partir de ahí se comporta como un antecedente.
 *
 * Y se devuelve la lista de lo corregido: una corrección silenciosa es
 * indistinguible de un extractor que acertó a la primera, y entonces nadie se
 * entera de que el modelo sigue cosechando términos de las preguntas.
 */
export function corregirCertezaPorNegacion<T extends CondicionExtraida>(
  conditions: readonly T[],
  negadas: readonly Negada[],
): { conditions: T[]; corregidas: CorreccionCerteza[] } {
  if (!negadas.length) return { conditions: [...conditions], corregidas: [] }
  const corregidas: CorreccionCerteza[] = []
  const out = conditions.map(c => {
    const enc = cronicasEn(String(c.texto ?? ''))
    const n = negadas.find(x => enc.includes(x.condicion))
    // Si el extractor YA la puso como descartada, acertó: no se toca ni se anota.
    if (!n || c.certeza === 'descartado') return c
    corregidas.push({ texto: String(c.texto ?? ''), condicion: n.condicion, cita: n.cita })
    return { ...c, certeza: 'descartado' }
  })
  return { conditions: out, corregidas }
}

export const POR_QUE_SE_RECLASIFICA_Y_NO_SE_BORRA =
  'Borrar la condición negada perdería información clínica real: «niega ' +
  'diabetes» es un negativo pertinente y va en la nota. Lo que no puede pasar ' +
  'es que viaje como CONFIRMADO, porque a partir de ahí se comporta como un ' +
  'antecedente y se arrastra a todas las notas siguientes.'
