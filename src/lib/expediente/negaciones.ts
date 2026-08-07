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
 * Muletillas y cortesías que en el habla real van DELANTE del «no».
 *
 * Lista cerrada a propósito. Admitir cualquier prefijo dejaría pasar «Sí, pero
 * no…», que es una afirmación. Va de más larga a más corta porque se recortan en
 * orden y «la verdad que» tiene que salir antes que «la verdad».
 */
const PREAMBULOS = [
  'hasta donde yo se', 'hasta donde se', 'gracias a dios', 'fijese que', 'fijate que',
  'que yo sepa', 'me parece que', 'la verdad que', 'afortunadamente', 'de plano',
  'la verdad', 'creo que', 'no pues', 'bueno', 'mire', 'oiga', 'pues', 'este',
  'mmm', 'ah', 'eh', 'ay',
] as const

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

/** Lo único que se admite DETRÁS de la negación sin que deje de ser un «no». */
const COLA = `(?:${NEG}|de\\s+eso|que\\s+yo\\s+sepa|gracias\\s+a\\s+dios|doctor|doctora|senor|senora)`

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

/** Quita el guion de turno, las comillas y las muletillas que preceden al «no». */
function sinPreambulo(t: string): string {
  let s = t.replace(/^[\s—–\-*«"'“”:]+/, '')
  for (let vuelta = 0; vuelta < PREAMBULOS.length; vuelta++) {
    // Si ya empieza por una negación no se recorta más: «qué va» perdería el
    // «que» si se tratara como muletilla.
    if (new RegExp(`^${NEG}\\b`).test(s)) return s
    const p = PREAMBULOS.find(x => new RegExp(`^${x}\\b`).test(s))
    if (!p) return s
    s = s.slice(p.length).replace(/^[\s,]+/, '')
  }
  return s
}

/**
 * ¿Esta respuesta niega?
 *
 * El silencio NO cuenta: no contestar no es negar, y tratarlo como negación
 * fabricaría un negativo que nadie dijo.
 */
export function esRespuestaNegativa(respuesta: string): boolean {
  if (!respuesta.trim()) return false
  if (AFIRMA.test(respuesta)) return false
  const s = sinPreambulo(sinAcentos(respuesta))
  return NEG_CERRADA.test(s) || NEG_FRASE.test(s)
}

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
    if (esRespuestaNegativa(respuesta)) {
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
      // «No es diabético» en la nota también es una negación bien escrita, pero
      // sólo si está pegada: ver `NIEGA_PEGADO`.
      if (NIEGA_PEGADO.test(antes)) continue
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

export const POR_QUE_SE_RECLASIFICA_Y_NO_SE_BORRA =
  'Borrar la condición negada perdería información clínica real: «niega ' +
  'diabetes» es un negativo pertinente y va en la nota. Lo que no puede pasar ' +
  'es que viaje como CONFIRMADO, porque a partir de ahí se comporta como un ' +
  'antecedente y se arrastra a todas las notas siguientes.'
