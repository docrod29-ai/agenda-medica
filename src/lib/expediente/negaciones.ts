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
 * Muletillas que en la consulta mexicana van DELANTE del «no».
 *
 * ── POR QUÉ ESTA LISTA EXISTE (6-ago-2026) ───────────────────────────────────
 *
 * El «No.» pelado del caso original es como se contesta en una transcripción
 * limpia, no como se contesta en el consultorio. Medido con el motor real sobre
 * las formas del habla de la consulta —«Pues no», «Fíjese que no», «Nombre, no»,
 * «Para nada», «Mmm, no», «Este… no»— **once de diecisiete respuestas negativas
 * no se veían**. Cada una es un antecedente crónico que el paciente negó y que
 * la nota puede afirmar sin que nadie avise.
 *
 * Van delante del «no», no en su lugar: lo que se reconoce sigue siendo la
 * negación, y estas sólo dejan de taparla.
 */
const MULETILLA = String.raw`(?:ah?|eh|em|mm+|este|pues|pos|bueno|mire|oiga|nombre|f[ií]jese\s+que|la\s+verdad|que\s+yo\s+sepa|hasta\s+donde\s+(?:yo\s+)?s[eé]|gracias\s+a\s+dios|doctora?|dra?)`

/**
 * Respuestas que cuentan como negación.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 */
const NEGATIVAS = new RegExp(
  String.raw`^\s*(?:${MULETILLA}[\s,.…]+)*(?:no|nop|nel|ning[uú]n[ao]?|nada(?:\s+de\s+eso)?|negativo|nunca|jam[aá]s|para\s+nada|qu[eé]\s+va)\b`,
  'i',
)

/**
 * «No sé» NO es una negación — y hoy contaba como una.
 *
 * Reproducido con el motor: «¿Tiene diabetes? No sé» devolvía `diabetes` como
 * negada, y de ahí `corregirCertezaPorNegacion` la reclasificaba a *descartado*.
 * Es la regla 4 de seguridad clínica al revés: **ausencia de dato no es dato de
 * ausencia**. Un paciente que no sabe si es diabético es al que hay que medirle
 * la glucosa, no al que se le cierra el antecedente.
 *
 * Se mira ANTES que `NEGATIVAS` porque las dos empiezan por «no».
 */
const NO_SABE = new RegExp(
  String.raw`^\s*(?:${MULETILLA}[\s,.…]+)*no\s+(?:lo\s+)?(?:s[eé]|sabe|sabr[ií]a\s+decir(?:le)?|recuerdo|me\s+acuerdo|estoy\s+segur[ao]|tengo\s+idea)(?![a-záéíóúñ])`,
  'i',
)

/** Una respuesta que niega — y que no es un «no sé» disfrazado de «no». */
const esNegativa = (respuesta: string) =>
  !NO_SABE.test(respuesta) && NEGATIVAS.test(respuesta)

/**
 * Marcas de que un término ya viene negado.
 *
 * Se buscan **delante** del término, nunca detrás: ver `vieneNegado`.
 */
const NIEGA_EN_LINEA = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido|ha\s+padecido|cuenta\s+con\s+antecedente)|nunca\s+(?:ha|he|han)\s+(?:tenido|padecido|presentado)|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

/**
 * Negadores DÉBILES: sólo valen pegados al término.
 *
 * «no es» niega cuando va justo antes («el paciente **no es** diabético») y no
 * niega nada cuando va lejos («**no es** candidato a metformina por su
 * diabetes»). Exigirle que toque la palabra separa los dos casos sin tener que
 * entender la oración.
 */
const NIEGA_PEGADO = /\bno\s+(?:es|era|fue|son|eran)\s*$/i

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
 * La ventana hacia atrás en la que se busca el negador.
 *
 * 60 caracteres: es la distancia en la que cabe «niega …» o «sin antecedente de
 * …» en la misma oración, incluida una enumeración corta («no tiene diabetes,
 * hipertensión ni asma»). Más larga empezaría a leer la oración anterior y una
 * negación ajena taparía una afirmación real — que es el fallo caro.
 */
const VENTANA = 60

/**
 * ¿Viene este término negado por algo que está DELANTE de él y en su cláusula?
 *
 * ── LOS DOS DEFECTOS QUE ESTO REPARA (6-ago-2026) ────────────────────────────
 *
 * 1. El negador se buscaba **en toda la frase**, así que uno solo negaba todo lo
 *    que hubiera en ella. Reproducido con el motor: «Refiere diabetes de 10
 *    años; niega asma» devolvía **las dos** como negadas, y la diabetes que el
 *    paciente sí dictó se reclasificaba sola a *descartado* en el panel de
 *    entidades. Borrar en silencio un diagnóstico real es peor que no ver una
 *    negación: el médico no puede revisar lo que no aparece.
 * 2. La ventana no se cortaba en el punto y coma, así que «Niega asma; refiere
 *    diabetes» negaba también la diabetes — el mismo error por el otro lado.
 *
 * La coma NO corta: es el separador de las enumeraciones negadas.
 */
function vieneNegado(texto: string, idx: number): boolean {
  let antes = texto.slice(Math.max(0, idx - VENTANA), idx)
  const corte = Math.max(
    antes.lastIndexOf(';'), antes.lastIndexOf(':'), antes.lastIndexOf('.'),
    antes.lastIndexOf('?'), antes.lastIndexOf('!'), antes.lastIndexOf('\n'),
  )
  if (corte >= 0) antes = antes.slice(corte + 1)
  return NIEGA_EN_LINEA.test(antes) || NIEGA_PEGADO.test(antes)
}

/**
 * Dónde aparece `forma` como PALABRA dentro de `t` (ya sin acentos y en minúsculas).
 *
 * ── POR QUÉ NO BASTA `indexOf` (6-ago-2026) ──────────────────────────────────
 *
 * `indexOf('asma')` encuentra «pl**asma**». Reproducido con el motor: una nota
 * que dice «se envía plasma fresco congelado» levantaba una contradicción de
 * **asma** contra un paciente que la había negado. Un aviso falso en la barra de
 * la consulta gasta la atención que hace falta para el aviso verdadero.
 *
 * El plural sí cuenta («diabéticos»): quitarlo perdería recall sin ganar nada.
 */
function* aparicionesDe(t: string, forma: string): Generator<number> {
  const libre = (c: string | undefined) => c === undefined || !/[a-z0-9]/.test(c)
  for (let i = t.indexOf(forma); i >= 0; i = t.indexOf(forma, i + 1)) {
    const fin = i + forma.length
    if (!libre(t[i - 1])) continue
    if (libre(t[fin]) || (t[fin] === 's' && libre(t[fin + 1]))) yield i
  }
}

/** Qué enfermedades crónicas nombra esta frase, y **dónde**. */
function cronicasConPosicion(frase: string): { canonica: string; idx: number }[] {
  const t = sinAcentos(frase)
  const out: { canonica: string; idx: number }[] = []
  for (const c of CRONICAS) {
    let primera = -1
    for (const forma of c.formas) {
      for (const idx of aparicionesDe(t, sinAcentos(forma))) {
        if (primera < 0 || idx < primera) primera = idx
        break
      }
    }
    if (primera >= 0) out.push({ canonica: c.canonica, idx: primera })
  }
  return out
}

/** Qué enfermedades crónicas nombra esta frase. */
export function cronicasEn(frase: string): string[] {
  return cronicasConPosicion(frase).map(c => c.canonica)
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
    const cs = cronicasConPosicion(f)
    if (!cs.length) continue

    // 1. Negación en línea — sólo para los términos que la tienen DELANTE. Los
    //    demás siguen vivos: en la misma frase puede haber una negada y una no.
    const restantes = cs.filter(c => {
      if (!vieneNegado(f, c.idx)) return true
      anotar(c.canonica, f)
      return false
    })
    if (!restantes.length || !esPregunta(f)) continue

    // 2. La respuesta: lo que sigue al signo de interrogación en la MISMA frase,
    //    o la frase siguiente si la pregunta terminó ahí.
    const cierre = f.indexOf('?')
    const resto = cierre >= 0 ? f.slice(cierre + 1).trim() : ''
    const respuesta = resto || (fs[i + 1] ?? '')
    if (esNegativa(respuesta)) {
      for (const c of restantes) anotar(c.canonica, `${f} ${respuesta}`.trim())
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
 * ── SE MIRAN TODAS LAS APARICIONES, NO LA PRIMERA (6-ago-2026) ───────────────
 *
 * Antes se probaba una sola vez por forma y, si esa venía negada, la forma se
 * daba por limpia. Reproducido con el motor: una nota que dice «Niega asma en la
 * infancia» arriba y «Diagnósticos: 1. Asma persistente moderada» abajo **no
 * levantaba ningún aviso** — y ése es justo el caso que importa, porque la nota
 * se contradice a sí misma y el diagnóstico de abajo es el que se arrastra a las
 * consultas siguientes.
 */
export function contradicciones(negadas: readonly Negada[], textoNota: string): Contradiccion[] {
  const t = sinAcentos(textoNota)
  const out: Contradiccion[] = []
  for (const n of negadas) {
    const formas = CRONICAS.find(c => c.canonica === n.condicion)?.formas ?? [n.condicion]
    let afirmada = -1
    for (const forma of formas) {
      for (const idx of aparicionesDe(t, sinAcentos(forma))) {
        if (vieneNegado(textoNota, idx)) continue
        afirmada = idx
        break
      }
      if (afirmada >= 0) break
    }
    if (afirmada >= 0) {
      out.push({ ...n, enLaNota: textoNota.slice(Math.max(0, afirmada - 40), afirmada + 60).trim() })
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
