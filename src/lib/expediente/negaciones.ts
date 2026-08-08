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
 * Con lo que ARRANCA una respuesta hablada antes de llegar a la palabra que
 * niega.
 *
 * No niegan nada por sí solas: se saltan. El paciente no contesta «No.» a secas
 * casi nunca; contesta «Pues no», «Mmm, no», «Este… no». Sin esto la respuesta
 * negativa no se reconocía y el «no» del paciente se perdía — que es justo el
 * defecto que este módulo existe para impedir.
 *
 * Sólo se saltan las que ocurren de verdad al principio de una respuesta, y como
 * mucho dos: una lista larga acabaría saltándose media frase para encontrar un
 * «no» que pertenece a otra cosa.
 */
const MULETILLAS = String.raw`(?:(?:ah?|ay|eh|mm+|este|pues|bueno|ps)\b[\s,.;:…]*){0,2}`

/**
 * Fin de palabra que sirve cuando la palabra ACABA en tilde.
 *
 * `\b` de JavaScript no considera letra a la «é», así que `/no sé\b/` no casa con
 * «no sé, doctor» — la frontera exigiría un cambio letra→no-letra y para el motor
 * la «é» ya es no-letra. Se descubrió probando esto mismo: el guardián de
 * incertidumbre no disparaba nunca, y su regla parecía correcta leída.
 */
const FIN_DE_PALABRA = String.raw`(?![a-záéíóúüñ])`

/**
 * Respuestas que cuentan como negación.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 *
 * «Fíjese que no» y «creo que no» entran porque son la forma cortés mexicana de
 * decir que no; «para nada» y «jamás», porque son enfáticas y no ambiguas. NO
 * entra «qué va»: en respuesta a una pregunta puede empezar una frase
 * («qué va a pasar si…»), y aquí un falso positivo descarta un antecedente real.
 */
const NEGATIVAS = new RegExp(
  `^\\s*${MULETILLAS}(?:no|nop|ninguna|ninguno|nada|negativo|nunca|jam[aá]s|para\\s+nada`
  + `|f[ií]jese\\s+que\\s+no|creo\\s+que\\s+no|que\\s+yo\\s+sepa\\s+no)\\b`, 'i')

/**
 * «No sé» empieza por «no» y NO niega nada.
 *
 * Reproducido con el motor real (8-ago-2026): «¿Tiene diabetes? No sé, doctor.»
 * devolvía `diabetes` como negada, y con eso `corregirCertezaPorNegacion`
 * reclasificaba a **descartado** una diabetes que el paciente no había
 * descartado — y la pantalla de contradicciones le decía al médico que el
 * dictado la negaba. El paciente sólo dijo que no lo sabe.
 *
 * Ausencia de dato no es dato de ausencia: no saber no es negar, y un «no sé»
 * convertido en «descartado» es un antecedente borrado sin que nadie lo borrara.
 *
 * La excepción de `no se tiene/refiere/…` deja fuera el impersonal escrito
 * («no se refiere dolor»), que sí es una negación y sigue su camino normal.
 */
const INCERTIDUMBRE = new RegExp(
  `^\\s*${MULETILLAS}no\\s+(?:s[eé]|sabr[ií]a|sabemos|recuerdo|me\\s+acuerdo|estoy\\s+segur[oa])`
  + `${FIN_DE_PALABRA}(?!\\s+(?:tiene|tengo|padece|padezco|refiere|presenta|hay|observa)\\b)`, 'i')

/**
 * Marcas de que un término ya viene negado en la propia frase.
 *
 * `sufre/sufro` y `negó/negaron` se añadieron el 8-ago-2026 por el mismo motivo
 * que las muletillas: son habla real de consulta que el módulo no reconocía.
 */
const NIEGA_EN_LINEA = new RegExp(
  String.raw`\b(?:niega|nieg[ao]|neg[oó]|negaron|no\s+(?:tiene|tengo|padece|padezco|padec[ií]a`
  + String.raw`|sufre|sufro|sufr[ií]a|refiere|refiero|ha\s+tenido)|sin\s+antecedente[s]?\s+de`
  + String.raw`|descarta|ausencia\s+de|se\s+descarta)` + FIN_DE_PALABRA, 'i')

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
    if (!esPregunta(f)) continue

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const resto = f.slice(f.indexOf('?') + 1).trim()
    const respuesta = resto || (fs[i + 1] ?? '')
    // La incertidumbre gana: «no sé» empieza por «no» y contestaría que sí a
    // NEGATIVAS. No saber no es negar.
    if (INCERTIDUMBRE.test(respuesta)) continue
    if (NEGATIVAS.test(respuesta)) {
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
 */
export function contradicciones(negadas: readonly Negada[], textoNota: string): Contradiccion[] {
  const t = sinAcentos(textoNota)
  const out: Contradiccion[] = []
  for (const n of negadas) {
    const formas = CRONICAS.find(c => c.canonica === n.condicion)?.formas ?? [n.condicion]
    for (const forma of formas) {
      const idx = t.indexOf(sinAcentos(forma))
      if (idx < 0) continue
      /**
       * La ventana hacia atrás es de 60 caracteres.
       *
       * Es la distancia en la que cabe «niega …» o «sin antecedente de …» en la
       * misma oración. Más larga empezaría a leer la oración anterior y una
       * negación ajena taparía una afirmación real — que es el fallo caro.
       */
      const antes = textoNota.slice(Math.max(0, idx - 60), idx)
      if (NIEGA_EN_LINEA.test(antes)) continue
      out.push({ ...n, enLaNota: textoNota.slice(Math.max(0, idx - 40), idx + 60).trim() })
      break
    }
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

/**
 * ── LO QUE ESTE MÓDULO SIGUE SIN CUBRIR (8-ago-2026) ─────────────────────────
 *
 * Cuando la respuesta es «no sé», el módulo deja de afirmar que el paciente negó
 * — y ahí se detiene. La condición que el extractor cosechó de la PREGUNTA se
 * queda con la certeza que él le puso, que suele ser `confirmado`. O sea: ya no
 * se descarta lo que nadie descartó, pero tampoco se avisa de que lo afirmado
 * salió de una pregunta sin respuesta.
 *
 * Repararlo bien no es ampliar una expresión regular: es una tercera salida
 * («el paciente dice que no lo sabe») que hay que enseñar en pantalla y que el
 * médico resuelve, como se hace con las contradicciones. Queda declarado aquí y
 * en el backlog, no escondido: la única defensa hoy es la regla del prompt del
 * extractor, y una regla del prompt es una petición.
 */
export const LO_QUE_NO_SE_CUBRE_AUN =
  'Una condición nombrada en la pregunta cuya respuesta fue «no sé» conserva la ' +
  'certeza que le puso el extractor. Este motor sólo garantiza que NO se ' +
  'reclasifique como descartada: no saber no es negar.'

export const POR_QUE_SE_RECLASIFICA_Y_NO_SE_BORRA =
  'Borrar la condición negada perdería información clínica real: «niega ' +
  'diabetes» es un negativo pertinente y va en la nota. Lo que no puede pasar ' +
  'es que viaje como CONFIRMADO, porque a partir de ahí se comporta como un ' +
  'antecedente y se arrastra a todas las notas siguientes.'
