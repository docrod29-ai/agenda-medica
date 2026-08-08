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

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * ── LAS MARCAS SE MIRAN SIN ACENTOS ──────────────────────────────────────────
 *
 * Todas las expresiones de abajo se prueban sobre el texto ya plegado con
 * `sinAcentos`. El plegado conserva la longitud —cada letra acentuada es una
 * base más una combinante que se cae— así que los índices siguen sirviendo para
 * recortar la cita del texto original, con sus acentos.
 *
 * Se hace porque el reconocedor acentúa como quiere y ya costó un caso: «negó
 * diabetes» no encajaba en `nieg[ao]` —la «ó» no es «o»— y la frase se leía como
 * una afirmación. Escribir cada marca dos veces, con acento y sin él, es la
 * clase de duplicado que se olvida a la mitad.
 */

/**
 * Muletillas que preceden a la respuesta sin cambiarla.
 *
 * En la consulta casi nadie contesta empezando por la palabra que importa: es
 * «ay no», «mmm no», «eh, ninguna», «pues fíjese que no». Se consumen antes de
 * mirar el negador.
 */
const MULETILLA = String.raw`(?:(?:ah?|ay|eh|este|mmm+|pues)[,\s]+)*`

/**
 * Respuestas que cuentan como negación.
 *
 * «Ninguna» y «nada» se incluyen porque es como se contesta de verdad a «¿tiene
 * enfermedades crónicas?». Lo que NO se incluye es el silencio: no contestar no
 * es negar, y tratarlo como negación fabricaría un negativo que nadie dijo.
 *
 * ── POR QUÉ CRECIÓ (auditoría de las nueve dimensiones, hallazgo C3) ─────────
 *
 * La lista original entendía el español de un formulario, no el de la consulta.
 * Medida contra el habla real se le escapaban las formas más comunes de decir
 * que no: «pues no», «fíjese que no», «para nada», «qué va», «tampoco», «nel».
 * Cada una que se escapa devuelve el fallo entero del 3-ago: la enfermedad se
 * cosecha de la pregunta y sale impresa como antecedente.
 *
 * `nada` no cuenta cuando es «nada más», que en México quiere decir «sólo» y no
 * niega; y «qué va» no cuenta cuando es «que va a…», que es futuro y no
 * respuesta.
 */
const NEGATIVAS = new RegExp(
  `^\\s*${MULETILLA}(?:` +
    [
      String.raw`no`,
      String.raw`nop`,
      String.raw`nel`,
      String.raw`ningun[ao]?`,
      String.raw`nada(?!\s+mas)`,
      String.raw`negativo`,
      String.raw`nunca`,
      String.raw`jamas`,
      String.raw`tampoco`,
      String.raw`para\s+nada`,
      String.raw`que\s+va(?!\s+a\b)`,
      String.raw`pues\s+(?:que\s+)?no`,
      String.raw`(?:fijese|figurese)\s+que\s+no`,
      String.raw`que\s+yo\s+sepa\s+no`,
    ].join('|') +
    String.raw`)\b`,
)

/**
 * Respuestas que NO saben — y que por eso no niegan nada.
 *
 * ── EL DEFECTO (auditoría de las nueve dimensiones, hallazgo C2) ─────────────
 *
 *     «¿Tiene diabetes?  No sé.»
 *
 * Empieza por «no», así que la lista de arriba la leía como negación. Y no se
 * quedaba en un aviso: `corregirCertezaPorNegacion` bajaba a `descartado` la
 * diabetes que el extractor había marcado — el sistema convertía un «no lo sé»
 * del paciente en un «no la tiene» del expediente.
 *
 * Es la regla 4 de seguridad clínica al revés: **ausencia de dato no es dato de
 * ausencia**. De las dos direcciones en que este motor puede equivocarse, ésta
 * es la cara: señalar de menos deja un aviso sin salir; fabricar un negativo
 * escribe en el expediente algo que nadie dijo.
 *
 * Se mira ANTES que `NEGATIVAS` y gana.
 */
const DUDA = new RegExp(
  `^\\s*${MULETILLA}(?:(?:pues|no)[,\\s]+)*(?:` +
    [
      String.raw`no\s+(?:se|sabe|sabria|sabriamos|recuerdo|recuerda)\b`,
      String.raw`no\s+me\s+(?:acuerdo|han\s+dicho|han\s+checado|han\s+revisado)\b`,
      String.raw`no\s+(?:estoy|esta)\s+segur[oa]\b`,
      String.raw`quien\s+sabe\b`,
      String.raw`a\s+lo\s+mejor\b`,
      String.raw`tal\s+vez\b`,
      String.raw`puede\s+ser\b`,
    ].join('|') +
    ')',
)

/**
 * Marcas de que la frase entera viene negada: gobiernan todo lo que enumeran.
 *
 * «Niega diabetes, hipertensión y dislipidemia» niega las tres, estén donde
 * estén en la frase. Por eso éstas se buscan en cualquier posición.
 */
const NIEGA_EN_LINEA =
  /\b(?:niega|nieg[ao]|nego|negaba|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido)|no\s+cuenta\s+con\s+antecedente[s]?\s+de|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/

/**
 * Marcas que niegan UN término, no la frase.
 *
 * «No es diabético», «nunca ha tenido asma». Éstas **no** pueden buscarse en
 * cualquier posición: en «no es fumador, tiene diabetes de diez años» el «no es»
 * habla del tabaco y la diabetes es real. Leerlo como negación borraría un
 * antecedente que el paciente sí tiene.
 *
 * Por eso tienen que venir **pegadas** al término: entre la marca y la palabra
 * sólo se admite la enumeración que la propia marca niega («no es diabético ni
 * hipertenso»). De eso se encarga `niegaAlTermino`.
 */
const NIEGA_EL_TERMINO =
  /(?:no\s+(?:es|era|fue|ha\s+sido|presenta|tuvo|padecio|ha\s+padecido)|nunca\s+ha\s+(?:tenido|padecido)|jamas\s+ha\s+(?:tenido|padecido))\s*$/

/**
 * Lo que se admite entre la marca que niega un t\u00e9rmino y el t\u00e9rmino negado:
 * separadores, conectores de enumeraci\u00f3n y las propias formas de las cr\u00f3nicas.
 *
 * Se recorta desde el final, una pieza por vuelta. Se hace con un bucle y no con
 * un `(?:\u2026)*` anidado porque una alternaci\u00f3n repetida sobre texto que no encaja
 * es justo la forma de escribir un regex que se cuelga.
 */
const PIEZA_DE_ENUMERACION = new RegExp(
  String.raw`(?:[\s,;]+|\b(?:ni|y|o|e|de|del|la|el|los|las|ning[u]n[ao]?|antecedentes?)\b|\b(?:` +
    CRONICAS.flatMap(c => c.formas)
      .map(f => sinAcentos(f).replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
      .join('|') +
    String.raw`))$`,
)

/**
 * \u00bfEl texto que precede al t\u00e9rmino es una marca que lo niega a \u00e9l?
 *
 * Recibe lo que va delante del t\u00e9rmino **ya plegado**. Consume hacia atr\u00e1s la
 * enumeraci\u00f3n y luego exige que lo que queda termine en la marca. As\u00ed \u00abno es
 * diab\u00e9tico ni hipertenso\u00bb niega las dos, y \u00abno es fumador, tiene diabetes\u00bb no
 * niega ninguna \u2014 que es el caso caro.
 */
function niegaAlTermino(antesPlegado: string): boolean {
  let s = antesPlegado
  for (let i = 0; i < 40; i++) {
    const recortado = s.replace(PIEZA_DE_ENUMERACION, '')
    if (recortado === s) break
    s = recortado
  }
  return NIEGA_EL_TERMINO.test(s)
}

/** D\u00f3nde nombra esta frase cada cr\u00f3nica. El \u00edndice vale sobre el texto plegado. */
function cronicasConIndice(frasePlegada: string): { canonica: string; idx: number }[] {
  const out: { canonica: string; idx: number }[] = []
  for (const c of CRONICAS) {
    let mejor = -1
    for (const f of c.formas) {
      const i = frasePlegada.indexOf(sinAcentos(f))
      if (i >= 0 && (mejor < 0 || i < mejor)) mejor = i
    }
    if (mejor >= 0) out.push({ canonica: c.canonica, idx: mejor })
  }
  return out
}

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
 * 3. **Negación pegada al término**: «no es diabético», «nunca ha tenido asma».
 *    Ésta exige adyacencia; el porqué está en `NIEGA_EL_TERMINO`.
 *
 * Lo que NO cuenta como negación, aunque empiece por «no», es no saberlo: ver
 * `DUDA`.
 */
export function condicionesNegadas(transcripcion: string): Negada[] {
  const fs = frases(transcripcion)
  const vistas = new Map<string, Negada>()
  const anotar = (condicion: string, cita: string) => {
    if (!vistas.has(condicion)) vistas.set(condicion, { condicion, cita: cita.slice(0, 200) })
  }

  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const plegada = sinAcentos(f)
    const ocurrencias = cronicasConIndice(plegada)
    if (!ocurrencias.length) continue

    if (NIEGA_EN_LINEA.test(plegada)) {
      for (const o of ocurrencias) anotar(o.canonica, f)
      continue
    }

    // Las marcas que niegan un término suelto se comprueban contra lo que hay
    // justo delante de ÉL, no contra la frase entera.
    const pegadas = ocurrencias.filter(o => niegaAlTermino(plegada.slice(0, o.idx)))
    for (const o of pegadas) anotar(o.canonica, f)
    if (pegadas.length === ocurrencias.length) continue

    if (!esPregunta(f)) continue

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const resto = f.slice(f.indexOf('?') + 1).trim()
    const respuesta = resto || (fs[i + 1] ?? '')
    const respuestaPlegada = sinAcentos(respuesta)
    // No saberlo no es negarlo: la duda gana sobre la negativa.
    if (DUDA.test(respuestaPlegada)) continue
    if (NEGATIVAS.test(respuestaPlegada)) {
      for (const o of ocurrencias) anotar(o.canonica, `${f} ${respuesta}`.trim())
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
      const antes = t.slice(Math.max(0, idx - 60), idx)
      if (NIEGA_EN_LINEA.test(antes) || niegaAlTermino(antes)) continue
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
