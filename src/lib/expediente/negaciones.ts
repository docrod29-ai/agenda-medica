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
 * ── LO QUE ARRANCA UNA RESPUESTA HABLADA SIN CAMBIARLA (6-ago-2026) ──────────
 *
 * La expresión original sólo admitía «ah» delante del «no». Contra el habla real
 * de la consulta mexicana eso deja fuera la mitad de las respuestas: «Pues no,
 * doctor», «Fíjese que no», «Este, no», «Mmm no», «Ay no». Medido con el motor:
 * de siete formas de decir que no, **cinco no se reconocían**, y cada una es un
 * antecedente crónico que la nota puede fabricar a partir de la pregunta.
 *
 * Se quitan por delante y se juzga lo que queda. Todas son palabras de relleno
 * —ninguna afirma ni niega—, así que quitarlas no puede convertir un «sí» en un
 * «no»: después de quitarlas todavía hace falta un núcleo negativo.
 */
const MULETILLAS = /^(?:[\s,.;:¡!¿?"'«»—–-]|(?:a[hy]|eh+|este|mm+|hmm+|pues|bueno|o\s*sea|fijese|fijate|mire|mira|que|yo|sepa)\b)+/

/**
 * El núcleo que sí niega.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 *
 * **«nada más» queda fuera a propósito.** No es una negación, es un recorte: a
 * «¿diabetes, hipertensión o asma?» la respuesta «nada más el asma» AFIRMA el
 * asma. Sin el candado, las tres salían negadas — incluida la que el paciente
 * acababa de reconocer.
 */
const NEGATIVAS = /^(?:no|nop|ninguna|ninguno|nada(?!\s+mas\b)|negativo|nunca|jamas|tampoco|para\s+nada|en\s+absoluto)\b/

/**
 * ── «NO SÉ» NO ES «NO» (6-ago-2026) ──────────────────────────────────────────
 *
 * `^no\b` leía «No sé, doctor» como una negación. Es exactamente el caso oro
 * `oro-rol-acompanante`: el médico pregunta por la diabetes, la paciente no sabe
 * y **el acompañante la confirma**. El motor afirmaba que la paciente lo había
 * negado y el extractor reclasificaba a `descartado` una diabetes referida y
 * cierta.
 *
 * Es la regla 4 de seguridad clínica del derecho y del revés: ausencia de dato
 * no es dato de ausencia, y **duda tampoco**. Se comprueba ANTES que la
 * negación, porque todas estas formas empiezan por «no».
 *
 * «No que yo sepa» se queda fuera de esta lista: es una negación con reserva, y
 * el módulo ya la trataba como negación desde el principio.
 */
const DUDA = /^(?:no\s+(?:se\b|sabe\b|sabemos\b|sabria\b|sabria\s+decirle\b|estoy\s+segur|esta\s+segur|me\s+acuerdo\b|recuerdo\b|tengo\s+idea\b|me\s+han\s+dicho\b)|creo\s+que\s+no\b|quien\s+sabe\b|tal\s+vez\b|a\s+lo\s+mejor\b)/

/** Lo que queda de una respuesta después de quitarle el relleno, sin acentos. */
const nucleoDe = (respuesta: string) => sinAcentos(respuesta).replace(MULETILLAS, '')

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
  return leerElInterrogatorio(transcripcion).negadas
}

/**
 * Lo que el paciente dijo NO SABER, leído del mismo sitio y en la misma pasada.
 *
 * Se separa de lo negado porque son dos hechos distintos y se resuelven
 * distinto: lo negado el paciente lo afirmó en contra y se puede reclasificar;
 * la duda no dice nada del paciente, sólo que él no lo sabe.
 */
export function condicionesInciertas(transcripcion: string): Negada[] {
  return leerElInterrogatorio(transcripcion).inciertas
}

/**
 * Una sola pasada por el dictado: negó, o dijo que no sabe.
 *
 * Van juntas porque comparten el trabajo caro —trocear en frases, decidir qué
 * es pregunta y emparejarla con su respuesta— y porque son excluyentes: una
 * respuesta no puede ser las dos, y de eso depende que «No sé» deje de leerse
 * como «No».
 */
function leerElInterrogatorio(transcripcion: string): { negadas: Negada[]; inciertas: Negada[] } {
  const fs = frases(transcripcion)
  const negadas = new Map<string, Negada>()
  const inciertas = new Map<string, Negada>()
  const anotar = (donde: Map<string, Negada>, condicion: string, cita: string) => {
    if (!donde.has(condicion)) donde.set(condicion, { condicion, cita: cita.slice(0, 200) })
  }

  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const cs = cronicasEn(f)
    if (!cs.length) continue

    if (NIEGA_EN_LINEA.test(f)) {
      for (const c of cs) anotar(negadas, c, f)
      continue
    }
    if (!esPregunta(f)) continue

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const resto = f.slice(f.indexOf('?') + 1).trim()
    const respuesta = resto || (fs[i + 1] ?? '')
    const nucleo = nucleoDe(respuesta)
    // La duda se mira primero: todas sus formas empiezan por «no».
    const donde = DUDA.test(nucleo) ? inciertas : NEGATIVAS.test(nucleo) ? negadas : null
    if (!donde) continue
    for (const c of cs) anotar(donde, c, `${f} ${respuesta}`.trim())
  }
  // Lo negado gana: si en otra parte del interrogatorio el paciente lo negó de
  // frente, esa respuesta es más informativa que el «no sé» de antes.
  for (const c of negadas.keys()) inciertas.delete(c)
  return { negadas: [...negadas.values()], inciertas: [...inciertas.values()] }
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

/**
 * Dónde la nota AFIRMA algo que el paciente dijo NO SABER.
 *
 * La búsqueda es la misma —el término, y la negación en línea que lo excusa—: lo
 * único que cambia es cómo se lee el hallazgo. Por eso reutiliza
 * `contradicciones` en vez de copiarla. Este repositorio ya pagó una defensa
 * cableada por un solo lado (REG-170); dos búsquedas gemelas se desincronizan.
 */
export function afirmacionesSobreLoQueNoSabe(
  inciertas: readonly Negada[],
  textoNota: string,
): Contradiccion[] {
  return contradicciones(inciertas, textoNota)
}

/**
 * El aviso de la duda, que dice mucho menos que el de la contradicción.
 *
 * No afirma que la nota se equivoque: el dato puede venir del acompañante, del
 * expediente o de un laboratorio, y entonces la nota tiene razón y el paciente
 * simplemente no lo sabía. Lo único que se pide es que ese respaldo **conste**.
 */
export function avisoDeDuda(c: Contradiccion): string {
  return `«${c.condicion}»: el paciente dijo no saberlo (${c.cita}), y la nota lo da por hecho (…${c.enLaNota}…). Si viene de otra fuente —acompañante, expediente, laboratorio— déjalo escrito.`
}

/**
 * Lo mismo sobre las entidades extraídas: se SEÑALA, no se toca.
 *
 * Aquí no hay nada que reclasificar. Con una negación el paciente afirmó algo en
 * contra y `descartado` es literalmente lo que él dijo; con un «no sé» no dijo
 * nada, y mover la certeza en cualquier dirección sería inventarle una postura.
 *
 * Sólo se mira lo que viaja como `confirmado`: `sospecha`, `descartado` e
 * `historia` ya declaran su propia reserva, y repetírsela al médico es la fatiga
 * de alerta que costó REG-181.
 */
export function avisosDeDudaDelExtractor<T extends CondicionExtraida>(
  conditions: readonly T[],
  inciertas: readonly Negada[],
): CorreccionCerteza[] {
  if (!inciertas.length) return []
  const out: CorreccionCerteza[] = []
  for (const c of conditions) {
    if (c.certeza !== 'confirmado') continue
    const enc = cronicasEn(String(c.texto ?? ''))
    const n = inciertas.find(x => enc.includes(x.condicion))
    if (!n) continue
    out.push({ texto: String(c.texto ?? ''), condicion: n.condicion, cita: n.cita })
  }
  return out
}

export const POR_QUE_LA_DUDA_NO_SE_RECLASIFICA =
  'Con una negación se puede reclasificar: el paciente dijo que no, y ' +
  '«descartado» es lo que él afirmó. Con un «no sé» no dijo nada. Marcarlo como ' +
  'descartado borraría una diabetes que el acompañante acaba de confirmar —el ' +
  'caso oro `oro-rol-acompanante`—, y marcarlo como confirmado sería inventarle ' +
  'al paciente una afirmación que no hizo. Se señala y decide el médico.'

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
