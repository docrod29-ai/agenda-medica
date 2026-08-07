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
 * El núcleo de una respuesta negativa.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 *
 * Se compara sobre texto sin acentos y en minúsculas, porque el reconocedor
 * acentúa de forma inconstante y «jamás»/«jamas» son la misma respuesta.
 */
const NUCLEO_NEGATIVO =
  '(?:no|nop|ninguna|ningunos?|ninguno|nada(?:\\s+de\\s+eso|\\s+que\\s+ver)?|negativo|nunca|jamas|tampoco|para\\s+nada|que\\s+va|en\\s+absoluto)'

/**
 * Muletillas y atenuantes que en la consulta real van DELANTE del «no».
 *
 * ── MEDIDO CON EL MOTOR REAL (7-ago-2026) ────────────────────────────────────
 *
 * El paciente casi nunca contesta «No.» a secas. Contesta «Pues no, doctor»,
 * «Fíjese que no», «Gracias a Dios no», «Hasta ahorita no», «Yo no». La
 * expresión anterior anclaba la negación al principio de la frase, así que las
 * ocho formas que se probaron se perdieron **todas**. Y una negación perdida no
 * es un aviso de menos: es que la nota puede afirmar la diabetes que el paciente
 * acaba de negar y nadie contrasta las dos — el defecto original de REG-140.
 *
 * ── POR QUÉ UNA LISTA CERRADA Y NO UN COMODÍN ────────────────────────────────
 *
 * `/.*no/` arreglaría las ocho de un golpe y abriría el fallo caro: «Sí,
 * diabetes desde hace diez años; presión alta no» acabaría contando como una
 * negación **de la diabetes**, porque la frase lleva las dos enfermedades. Las
 * muletillas son cortas y son pocas; el comodín no tiene fondo.
 *
 * Se quitan de una en una porque se acumulan: «Ay pues fíjese que no» lleva tres.
 * Las más largas van primero — si «el» se quitara antes que «el paciente»,
 * quedaría «paciente no» y ya no habría muletilla que quitar.
 */
const ANTES_DE_LA_NEGACION = [
  'el paciente', 'la paciente', 'hasta el momento', 'gracias a dios',
  'que yo sepa', 'hasta ahorita', 'afortunadamente', 'por fortuna',
  'fijese que', 'fijate que', 'hasta ahora', 'hasta hoy',
  'bueno', 'ella', 'pues', 'este', 'pos', 'ay', 'ah', 'yo', 'el', 'eh', 'a',
].sort((x, y) => y.length - x.length)

const PREFIJO_NEGATIVA = new RegExp(
  `^(?:${ANTES_DE_LA_NEGACION.map(p => p.replace(/ /g, '\\s+')).join('|')})[\\s,]+`,
)

const NEGATIVA_NUCLEO = new RegExp(`^${NUCLEO_NEGATIVO}\\b`)

/**
 * «No sé» **no** es «no».
 *
 * ── REGLA 4 DEL CHARTER, ROTA POR EL PROPIO MOTOR (7-ago-2026) ───────────────
 *
 * «¿Tiene diabetes? No sé, nunca me han revisado» se leía como una negación. Y
 * eso no se queda en un aviso: `corregirCertezaPorNegacion` bajaba a
 * **`descartado`** una diabetes que el extractor había marcado como confirmada.
 * Reproducido con el motor: la condición salía descartada y el médico veía la
 * corrección como si el paciente hubiera dicho que no.
 *
 * Ausencia de dato no es dato de ausencia. Quien no se acuerda no ha negado
 * nada, y con la negación inventada se pierde justo el antecedente que el
 * interrogatorio no pudo cerrar.
 *
 * El punto o la coma después de «no sé» es lo que lo distingue de «no se
 * preocupe», que no es una respuesta al interrogatorio.
 */
const NO_SABE = new RegExp(
  '^no\\s+(?:lo\\s+)?se\\s*(?:[.,;:!?…]|$)' +
    '|^no\\s+(?:me\\s+acuerdo|recuerdo|estoy\\s+segur[oa]|sabria|tengo\\s+idea|que\\s+recuerde)\\b',
)

/**
 * Si esta respuesta cuenta como negación.
 *
 * Expuesta porque el corpus del Dr. se mide contra ella: una respuesta que el
 * motor no reconoce es una negación que se pierde, y eso hay que poder contarlo
 * sin pasar por una transcripción entera.
 */
export function esRespuestaNegativa(respuesta: string): boolean {
  let t = sinAcentos(respuesta).trim()
  // Cuatro pasadas: más muletillas seguidas que ésas no se han visto, y el tope
  // impide que una expresión mal escrita deje el bucle girando.
  for (let i = 0; i < 4 && PREFIJO_NEGATIVA.test(t); i++) t = t.replace(PREFIJO_NEGATIVA, '')
  if (NO_SABE.test(t)) return false
  return NEGATIVA_NUCLEO.test(t)
}

/** Marcas de que un término ya viene negado en la propia frase. */
const NIEGA_EN_LINEA = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido)|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

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
