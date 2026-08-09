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
  /**
   * Las formas adjetivas van con las nominales: en la consulta se pregunta «¿es
   * usted epiléptico?», no «¿padece epilepsia?». Diabetes, hipertensión y asma
   * ya las tenían; a estas dos les faltaban, y sin la forma que se dice de
   * verdad el caso sencillamente no se vigilaba.
   */
  { canonica: 'cardiopatía', formas: ['cardiopatía', 'cardiopatia', 'cardiópata', 'cardiopata', 'infarto', 'insuficiencia cardiaca', 'insuficiencia cardíaca'] },
  { canonica: 'hipotiroidismo', formas: ['hipotiroidismo', 'tiroides'] },
  { canonica: 'dislipidemia', formas: ['dislipidemia', 'colesterol alto', 'triglicéridos altos', 'trigliceridos altos'] },
  { canonica: 'epilepsia', formas: ['epilepsia', 'epiléptico', 'epileptico', 'epiléptica', 'epileptica', 'convulsiones'] },
  { canonica: 'VIH', formas: ['vih', 'sida'] },
  { canonica: 'tuberculosis', formas: ['tuberculosis', 'tb pulmonar'] },
  { canonica: 'EPOC', formas: ['epoc', 'enfisema', 'bronquitis crónica'] },
]

/**
 * ── LA RESPUESTA SE LEE ENTERA, NO POR SU PRIMERA PALABRA ────────────────────
 *
 * La primera versión miraba si la respuesta EMPEZABA por una palabra negativa.
 * Sobre las formas del habla real eso falla en los dos sentidos, y los dos
 * duelen:
 *
 * **Se le escapaban las negaciones de verdad.** Casi nadie contesta «No.» a
 * secas. Contesta «Pues no», «Fíjese que no», «Para nada», «Qué va», «Gracias a
 * Dios no», «Tampoco» — o el transcriptor le pone un guion de turno delante
 * («— No») y la palabra deja de ser la primera. Con eso, la defensa entera no
 * corría y el antecedente inventado volvía a pasar.
 *
 * **Y señalaba negaciones que nadie dijo, que es peor.** «¿Desde cuándo tiene
 * diabetes? **No hace mucho**, como dos años» empieza por «no» y es una
 * afirmación. Igual «Nunca la he dejado de tomar» y «Nada más esa, sí». Ahí no
 * se pierde un aviso: `corregirCertezaPorNegacion` degradaba a **descartado** una
 * diabetes confirmada — el mismo antecedente perdido que este módulo existe para
 * impedir, sólo que por el otro lado.
 *
 * Por eso ahora se exige que la negación **cierre la respuesta**: o no queda
 * nada detrás salvo puntuación y más negaciones, o es una de las frases
 * negativas conocidas. Y si en la respuesta aparece una afirmación, no se decide
 * nada: se señala de menos, nunca de más.
 */

/**
 * Marcas de que la respuesta afirma algo.
 *
 * Se mira sobre el texto CON acentos: sin ellos «sí» y la conjunción «si» son la
 * misma palabra, y «no, si no fuera por eso» dejaría de leerse como negación.
 * Consecuencia declarada: un dictado sin acentos no queda protegido por aquí.
 */
const AFIRMA = /\b(?:sí|sip|simón|claro|correcto|exacto|afirmativo|así\s+es|efectivamente)\b/i

/**
 * Las palabras con las que se niega. De más larga a más corta: la alternancia
 * toma la primera que encaja, y si «nada» fuera antes, «nada de eso» se partiría.
 *
 * Es vocabulario, no criterio: que falte una forma significa que ese caso no se
 * vigila —no que se dé por afirmado—, y por eso el motor sólo señala de menos.
 */
const NEG = '(?:nada\\s+de\\s+eso|en\\s+absoluto|para\\s+nada|que\\s+va|negativo|ninguna|ninguno|tampoco|nunca|jamas|nada|nop|nel|no)'

/**
 * Lo único que se admite DETRÁS de la negación sin que deje de ser un «no».
 *
 * Las muletillas entran también aquí, no sólo en `PREAMBULOS`: «no pues no» es
 * de las formas más comunes, y ahí la muletilla va EN MEDIO. Ponerla sólo
 * delante no la alcanzaba nunca, porque el recorte se detiene en cuanto la
 * cadena empieza por una negación.
 */
const COLA = `(?:${NEG}|de\\s+eso|que\\s+yo\\s+sepa|gracias\\s+a\\s+dios|pues|bueno|doctor|doctora|senor|senora)`

/** «No», «No, ninguna», «Nada de eso», «No que yo sepa»: la negación lo es todo. */
const NEG_CERRADA = new RegExp(`^${NEG}\\b(?:[\\s,]+${COLA}\\b)*[\\s.,;!¡…"»'-]*$`)

/**
 * Frases negativas completas — las que llevan algo detrás y siguen negando.
 *
 * Lista explícita, no un patrón: «nunca me la han detectado» niega y «nunca la
 * he dejado de tomar» afirma, y sólo se distinguen por el verbo.
 */
const NEG_FRASE = new RegExp(
  '^(?:' +
  'no\\s+(?:tengo|tiene|padezco|padece|he\\s+tenido|ha\\s+tenido|me\\s+(?:lo|la|los|las)\\s+han\\s+(?:dicho|detectado|diagnosticado|encontrado))' +
  '|nunca\\s+me\\s+(?:lo|la|los|las)\\s+han\\s+(?:dicho|detectado|diagnosticado|encontrado)' +
  '|(?:nunca|jamas)\\s+(?:he|ha)\\s+(?:tenido|padecido|sido)' +
  ')\\b',
)

/**
 * ── LO QUE ESTORBA DELANTE DE LA RESPUESTA (6-ago-2026, REG-192) ─────────────
 *
 * La negación tiene que aparecer al principio de la respuesta, y en una
 * transcripción real casi nunca aparece ahí: delante viene la marca de turno
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
 * Se quita lo que estorba antes de mirar; a las reglas de negación se les da la
 * frase ya limpia.
 */
const RUIDO_ANTES_DE_LA_RESPUESTA =
  /^\s*(?:[-—–:>»"'`]+\s*)*(?:(?:paciente|acompa[ñn]ante|familiar|sr|sra|se[ñn]or[a]?)\s*:\s*)?(?:(?:pues|bueno|este|mmm+|ah+|eh+|ay|f[ií]jese\s+que|f[ií]jate\s+que|la\s+verdad(?:\s+es\s+que|\s+que)?|gracias\s+a\s+dios|afortunadamente|que\s+yo\s+sepa|me\s+parece\s+que|hasta\s+donde\s+(?:yo\s+)?s[eé]|de\s+plano|mire|oiga|d[ée]jeme\s+ver|creo\s+que)\s*,?\s*)*/i

/**
 * «No sé» NO ES UNA NEGACIÓN — y al limpiar el ruido pasaría a serlo.
 *
 * Ésta es la trampa de la reparación: quitando el guion de turno, «— No sé» se
 * convierte en «no sé», que empieza por «no» y se daría por bueno. El sistema
 * registraría que el paciente **negó** una enfermedad cuando lo que dijo es que
 * **no lo sabe**.
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
 * La condición dicha y negada después: «Diabetes no.», «Asma no, gracias a Dios».
 *
 * En el habla se responde repitiendo lo preguntado. Sin esto, la respuesta más
 * natural a «¿diabetes?» se perdía.
 */
const NIEGA_POSPUESTO = /\b(?:no|nunca|jam[aá]s)\s*[.,;!]?\s*$/i

/**
 * ¿Esta respuesta niega? Con el ruido de turno y de muletilla ya quitado.
 *
 * ── POR QUÉ YA NO BASTA CON MIRAR POR DÓNDE EMPIEZA (9-ago-2026, REG-197) ────
 *
 * La versión anterior preguntaba si la respuesta limpia EMPEZABA por una
 * palabra negativa (dos patrones de prefijo). Eso arreglaba las
 * negaciones que se perdían, pero dejaba vivo el defecto del otro lado, que es
 * el caro: **una afirmación que empieza por palabra negativa**.
 *
 *     «¿Desde cuándo tiene diabetes?  No hace mucho, como dos años.»
 *     «¿Tiene diabetes?  Nunca la he dejado de tomar.»
 *     «¿Tiene diabetes?  Nada más esa, sí.»
 *     «¿Tiene diabetes?  No, bueno sí, la borderline.»
 *
 * Las cuatro afirman. Las cuatro se leían como negación, y `corregirCertezaPor-
 * Negacion` degradaba a **descartado** una diabetes que el paciente acababa de
 * confirmar: el mismo antecedente perdido que este módulo existe para impedir,
 * sólo que por el otro lado. Medido con el motor real: 4 de 6.
 *
 * Por eso los dos prefijos se retiran y en su lugar se exige que la negación
 * **cierre** (`NEG_CERRADA`) o sea una de las frases negativas conocidas
 * (`NEG_FRASE`). Y si en la respuesta aparece una afirmación, no se decide nada.
 *
 * El orden de las comprobaciones ES la política: primero lo que descarta.
 */
export function respuestaNiega(respuesta: string): boolean {
  const limpia = String(respuesta ?? '').replace(RUIDO_ANTES_DE_LA_RESPUESTA, '')
  if (!limpia.trim()) return false
  /** «No sé» empieza por «no» y no niega nada: ausencia de dato no es dato de ausencia. */
  if (NO_ES_NEGACION.test(limpia)) return false
  /** Una afirmación en la respuesta la vuelve ambigua, y ante la duda no se señala. */
  if (AFIRMA.test(limpia)) return false
  /**
   * De aquí abajo se compara sin acentos, así que no hay `\b` detrás de vocal
   * acentuada — la trampa que se documenta en `NO_ES_NEGACION` no aplica.
   */
  const t = sinAcentos(limpia)
  if (NEG_CERRADA.test(t)) return true
  if (NEG_FRASE.test(t)) return true
  /**
   * La pospuesta sólo cuenta en respuestas cortas. En una frase larga un «no»
   * final puede pertenecer a otra cosa («…me dijeron que fuera pero no»), y
   * fabricar una negación es peor que perderla.
   */
  if (limpia.length <= 40 && NIEGA_POSPUESTO.test(limpia)) return true
  return false
}

/** Marcas de que un término ya viene negado en la propia frase. */
const NIEGA_EN_LINEA = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido)|no\s+cuenta\s+con\s+antecedente[s]?\s+de|sin\s+antecedente[s]?\s+de|sin\s+datos\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

/**
 * Negación que sólo vale PEGADA al término: «no es diabético», «niega ser
 * hipertenso».
 *
 * No entra en `NIEGA_EN_LINEA` porque ahí se busca en una ventana de 60
 * caracteres, y un «no es» suelto —«no es candidato a cirugía. Diabetes mellitus
 * tipo 2»— taparía una afirmación real, que es el fallo caro. Anclada al final,
 * tiene que estar justo delante del término.
 */
const NIEGA_PEGADO = /\b(?:no\s+(?:es|era|fue|soy|son)|niega\s+ser)\s+(?:un[ao]?\s+)?$/i

/**
 * El escudo que `primeraMencionSinEscudo` busca delante de cada mención.
 *
 * Las dos formas juntas, porque el módulo compartido admite un solo patrón: la
 * negación de ventana y la pegada. Cada una trae su propio anclaje, así que la
 * alternancia no las mezcla — la pegada sigue exigiendo estar justo delante.
 */
const ESCUDO_DE_LA_NOTA = new RegExp(`${NIEGA_EN_LINEA.source}|${NIEGA_PEGADO.source}`, 'i')

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Trocea por frases conservando el signo, que es lo que distingue pregunta de respuesta. */
export function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.?!¡¿\n])\s+/)
    .map(f => f.trim())
    .filter(Boolean)
}

const esPregunta = (f: string) => f.includes('?') || f.trimStart().startsWith('¿')

/**
 * Las crónicas que esta frase niega con la negación PEGADA al término.
 *
 * Se comprueba forma por forma —no con un patrón suelto— para que «no es
 * diabético» cuente y «no es candidato… diabetes» no.
 */
function negadasPegadasEn(frase: string): string[] {
  const t = sinAcentos(frase)
  const out: string[] = []
  for (const c of CRONICAS) {
    for (const forma of c.formas) {
      const f = sinAcentos(forma)
      let desde = 0
      for (;;) {
        const idx = t.indexOf(f, desde)
        if (idx < 0) break
        if (NIEGA_PEGADO.test(t.slice(0, idx))) { out.push(c.canonica); break }
        desde = idx + f.length
      }
      if (out[out.length - 1] === c.canonica) break
    }
  }
  return out
}

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

    if (NIEGA_EN_LINEA.test(f)) {
      for (const c of cs) anotar(c, f)
      continue
    }
    // «No es diabético»: la negación va pegada al término y sólo cuenta ahí.
    const pegadas = negadasPegadasEn(f)
    if (pegadas.length) {
      for (const c of pegadas) anotar(c, f)
      continue
    }
    if (!esPregunta(f)) continue

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const resto = f.slice(f.indexOf('?') + 1).trim()
    const respuesta = resto || (fs[i + 1] ?? '')
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
    const m = primeraMencionSinEscudo(textoNota, formas, ESCUDO_DE_LA_NOTA)
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
