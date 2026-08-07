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
 * Muletillas que van DELANTE de la respuesta sin cambiarla.
 *
 * ── POR QUÉ (medido con el motor real, 7-ago-2026) ───────────────────────────
 *
 * La expresión anterior anclaba la negativa al principio de la respuesta
 * (`^\s*(?:ah?,?\s*)?(?:no|…)`), y en la consulta hablada casi nadie contesta
 * con el «no» pelado. De diecisiete respuestas negativas reales, **seis se
 * perdían**: «Pues no», «Fíjese que no», «Mmm, no», «Gracias a Dios no»,
 * «Para nada», «Qué va». La enfermedad se había nombrado en la PREGUNTA, así
 * que perder el «no» deja el antecedente crónico cosechado y confirmado — que
 * es exactamente el caso que el Dr. encontró el 3-ago.
 *
 * Es una lista CERRADA a propósito. Aceptar «cualquier cosa antes del no»
 * dejaría entrar «Sí, desde hace diez años, pero no tomo nada» como negación, y
 * eso descarta una diabetes real: el error caro va en la otra dirección.
 */
const MULETILLAS = '(?:(?:ah?|eh|este|mm+|hmm?|bueno|pues|mire|oiga|la\\s+verdad|gracias\\s+a\\s+dios|fijese\\s+que|figese\\s+que)[,\\s]+)*'

/**
 * Respuestas que cuentan como negación.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 *
 * ── «NADA MÁS» NO ES «NADA» (encontrado el 7-ago-2026) ───────────────────────
 *
 * «¿Tiene diabetes o hipertensión? **Nada más** la diabetes» quiere decir *sólo*
 * la diabetes, y el `nada` suelto lo leía como una negación de las dos: el
 * extractor pasaba a `descartado` la enfermedad que el paciente **acababa de
 * afirmar**. Un antecedente real borrado por una palabra que significaba lo
 * contrario. Por eso `nada` no cuenta cuando le sigue «más».
 *
 * Se comprueba sobre el texto SIN acentos: «Fíjese» y «Qué va» llegan del
 * reconocedor acentuados o no según el día, y una negación no puede depender de
 * eso.
 */
const NEGATIVAS = new RegExp(
  '^\\s*' + MULETILLAS
  + '(?:no|nop|ninguna|ninguno|nada(?!\\s+mas\\b)|negativo|nunca|para\\s+nada|que\\s+va|que\\s+yo\\s+sepa\\s+no)\\b',
  'i',
)

/**
 * NO SABER NO ES NEGAR — la respuesta que empieza con «no» y no niega nada.
 *
 * ── EL CASO, REPRODUCIDO CON EL MOTOR REAL (7-ago-2026) ──────────────────────
 *
 *     «¿Tiene diabetes?  No sé.»        → la condición salía `descartado`
 *     «¿Tiene diabetes?  No me acuerdo.» → la condición salía `descartado`
 *
 * El paciente dijo que **no sabe**, y el sistema escribía en el expediente que
 * lo había negado. Eso es fabricar un negativo que nadie dijo: la regla del
 * charter —«ausencia de dato no es dato de ausencia»— al revés y por escrito, en
 * un campo estructurado que luego se arrastra a todas las notas siguientes.
 *
 * Y era el mismo `^no\b` de arriba el que lo hacía: «no sé» empieza por «no».
 *
 * ── QUÉ SE HACE EN SU LUGAR ──────────────────────────────────────────────────
 *
 * La duda **no reclasifica nada** y **no calla**: sale como aviso. Ni se afirma
 * el antecedente ni se afirma su ausencia; se le enseña al médico que la nota
 * dice una cosa y el paciente dijo que no sabía, y lo resuelve preguntando —que
 * es lo que un médico hace con un «no me acuerdo».
 *
 * ── «NO, NO ME ACUERDO» CUENTA COMO DUDA; «NO, Y NO SÉ DE MI FAMILIA» NO ─────
 *
 * El «no» inicial de «No, no me acuerdo» es un marcador de discurso, no una
 * negación del antecedente: lo que el paciente afirma es que no se acuerda. Por
 * eso la duda admite ese «no,» delante. Pero sólo pegado: en «No, y no sé de mi
 * familia» hay una negación de verdad y una duda **sobre otra cosa**, y la «y»
 * corta el preámbulo.
 *
 * La duda gana a la negación cuando las dos encajan. Perder una negación cuesta
 * un aviso; fabricarla cuesta un antecedente borrado.
 */
const DUDA = new RegExp(
  '^\\s*(?:no[,\\s]+)?' + MULETILLAS
  + '(?:no\\s+(?:lo\\s+)?(?:se|sabria)\\b|no\\s+me\\s+acuerdo\\b|no\\s+recuerdo\\b'
  + '|no\\s+estoy\\s+segur[oa]\\b|no\\s+tengo\\s+idea\\b|quien\\s+sabe\\b)',
  'i',
)

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

/**
 * Por qué la nota no puede afirmar esta condición sin más.
 *
 * `negada` — el paciente dijo que no.
 * `duda`   — el paciente dijo que no sabe. Ni sí ni no: **falta el dato**.
 *
 * Se distinguen porque lo que se puede hacer con cada una es distinto: con una
 * negación se puede reclasificar a `descartado` —es lo que el paciente afirmó—;
 * con una duda no se puede afirmar nada, sólo avisar.
 */
export type MotivoDeNoAfirmar = 'negada' | 'duda'

export interface Negada {
  condicion: string
  /** La pregunta y la respuesta, para que el médico juzgue sin abrir el audio. */
  cita: string
  /** Ausente = `negada`, que es lo que este tipo significaba antes de existir la duda. */
  motivo?: MotivoDeNoAfirmar
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
  return escanear(transcripcion).negadas
}

/**
 * Lo que el paciente dijo NO SABER, leído del mismo dictado.
 *
 * Sale aparte de `condicionesNegadas` a propósito: quien reclasifica a
 * `descartado` pide negaciones, y una duda no lo es. Separarlas por tipo —y no
 * por un campo que el llamador tenga que acordarse de mirar— es lo que impide
 * que la próxima ruta que se escriba vuelva a tratarlas igual.
 */
export function condicionesDudosas(transcripcion: string): Negada[] {
  return escanear(transcripcion).dudosas
}

/** Una sola pasada: las dos listas salen del mismo recorrido de frases. */
function escanear(transcripcion: string): { negadas: Negada[]; dudosas: Negada[] } {
  const fs = frases(transcripcion)
  const vistas = new Map<string, Negada>()
  const anotar = (condicion: string, cita: string, motivo: MotivoDeNoAfirmar) => {
    if (!vistas.has(condicion)) vistas.set(condicion, { condicion, cita: cita.slice(0, 200), motivo })
  }

  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const cs = cronicasEn(f)
    if (!cs.length) continue

    if (NIEGA_EN_LINEA.test(sinAcentos(f))) {
      for (const c of cs) anotar(c, f, 'negada')
      continue
    }
    if (!esPregunta(f)) continue

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const resto = f.slice(f.indexOf('?') + 1).trim()
    const respuesta = resto || (fs[i + 1] ?? '')
    const r = sinAcentos(respuesta)
    // La duda se mira ANTES: «no sé» encaja también en la negativa, y ahí el
    // orden decide si se escribe un negativo que el paciente nunca dijo.
    const motivo: MotivoDeNoAfirmar | null =
      DUDA.test(r) ? 'duda' : NEGATIVAS.test(r) ? 'negada' : null
    if (!motivo) continue
    for (const c of cs) anotar(c, `${f} ${respuesta}`.trim(), motivo)
  }

  const todas = [...vistas.values()]
  return {
    negadas: todas.filter(n => n.motivo !== 'duda'),
    dudosas: todas.filter(n => n.motivo === 'duda'),
  }
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
      if (NIEGA_EN_LINEA.test(sinAcentos(antes))) continue
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
  /**
   * La duda se redacta distinto porque **dice otra cosa**. «El paciente lo
   * negó» sobre un «no me acuerdo» es poner en su boca algo que no dijo, y el
   * médico decidiría con una cita falseada delante.
   */
  if (c.motivo === 'duda') {
    return `«${c.condicion}»: en el dictado el paciente dijo que no lo sabía (${c.cita}), y la nota lo afirma (…${c.enLaNota}…). No está negado ni confirmado: falta el dato.`
  }
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

export interface AvisoDeDuda {
  texto: string
  condicion: string
  cita: string
}

/**
 * Condiciones que el extractor da por buenas y que el paciente dijo NO SABER.
 *
 * Aquí **no se toca nada** — al contrario que con una negación. Y el motivo es
 * el mismo que en `temporalidad.ts`: `descartado` es una afirmación sobre el
 * paciente, y el paciente no la hizo. Poner «no lo sabe» en el campo de certeza
 * tampoco vale: el esquema no tiene ese valor, y traducir una duda a cualquiera
 * de los dos que sí tiene es elegir por el médico.
 *
 * Lo que sí se hace es **decirlo**. El aviso silencioso no existe: si esto no
 * saliera en pantalla, la duda del paciente se vería igual que un extractor que
 * acertó, y el antecedente cosechado de la pregunta seguiría ahí, confirmado y
 * sin que nadie lo mirara.
 */
export function avisosDeDudaDelExtractor<T extends CondicionExtraida>(
  conditions: readonly T[],
  dudosas: readonly Negada[],
): AvisoDeDuda[] {
  if (!dudosas.length) return []
  const out: AvisoDeDuda[] = []
  for (const c of conditions) {
    // Si el extractor ya la marcó descartada no hay nada que avisar: no la está
    // afirmando, y el aviso sólo sirve cuando la nota dice más de lo que se oyó.
    if (c.certeza === 'descartado') continue
    const enc = cronicasEn(String(c.texto ?? ''))
    const d = dudosas.find(x => enc.includes(x.condicion))
    if (!d) continue
    out.push({ texto: String(c.texto ?? ''), condicion: d.condicion, cita: d.cita })
  }
  return out
}

export const POR_QUE_LA_DUDA_NO_SE_RECLASIFICA =
  'Con una negación se puede reclasificar a «descartado»: es lo que el paciente ' +
  'afirmó. Con un «no sé» no hay nada que afirmar — ni el antecedente ni su ' +
  'ausencia. Escribir «descartado» sobre un «no me acuerdo» fabrica un negativo ' +
  'que nadie dijo, y ese negativo se arrastra a todas las notas siguientes con ' +
  'la misma pinta de dato verificado que tendría uno real.'

export const POR_QUE_SE_RECLASIFICA_Y_NO_SE_BORRA =
  'Borrar la condición negada perdería información clínica real: «niega ' +
  'diabetes» es un negativo pertinente y va en la nota. Lo que no puede pasar ' +
  'es que viaje como CONFIRMADO, porque a partir de ahí se comporta como un ' +
  'antecedente y se arrastra a todas las notas siguientes.'
