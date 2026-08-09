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
import { apariciones, mencionSinDisculpa, VENTANA_ATRAS } from '@/lib/expediente/mencion-en-la-nota'

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
const NEGATIVAS = /^(?:no|nop|ninguna|ninguno|nada|negativo|nunca|nel|para\s+nada|en\s+lo\s+absoluto)\b/

/**
 * ── LA RESPUESTA LLEGA CON MULETILLA DELANTE (REG-199, 7-ago-2026) ───────────
 *
 * `NEGATIVAS` anclaba en `^` y sólo toleraba «ah» como arranque, así que el
 * paciente que contesta como se contesta de verdad no negaba nada — verificado
 * con el motor real:
 *
 *     condicionesNegadas('¿Padece diabetes? Pues no.')            → []
 *     condicionesNegadas('¿Padece diabetes? Fíjese que no.')      → []
 *     condicionesNegadas('¿Tiene diabetes? Que yo sepa, no.')     → []
 *
 * El último duele especialmente: la variante estaba declarada —«que yo sepa
 * no»— y **la coma** la rompía. Una coma es un artefacto de transcripción, no
 * un hecho clínico.
 *
 * Es el caso del 3-ago (REG-158) otra vez, con una palabra delante: el paciente
 * contesta que no y la nota le pone la crónica.
 *
 * Se quita la muletilla primero y se exige después un núcleo negativo. Es más
 * seguro que alargar la lista de negaciones —que es justo lo que salió mal al
 * ensanchar el vocabulario de negación compartido—: si tras la muletilla no
 * viene un «no», no hay negación. «Pues mi mamá sí» pierde el «pues» y se
 * queda en «mi».
 */
const MULETILLA = String.raw`(?:ah?|eh+|ay|uy|hijole|mm+|mh+|este|pues|pos|bueno|mire|oiga|fijese|o\s+sea|doctor|doctora|doc|que|yo|sepa|recuerde)`
const ARRANQUE = new RegExp(String.raw`^(?:${MULETILLA}\b[\s,.;]*)*`)

/**
 * Lo que empieza por «no» y aun así **no niega el antecedente**.
 *
 * Dos familias, y las dos acaban en el mismo daño: `corregirCertezaPorNegacion`
 * marca la condición como `descartado`, que es una **afirmación de ausencia**, y
 * a partir de ahí el expediente afirma por el paciente algo que nunca dijo.
 *
 * - **No saber.** «No sé», «no me acuerdo», «no me han checado». Un paciente con
 *   diabetes sin diagnosticar contesta exactamente así. Es la regla 4 de
 *   `clinical-safety.md` —ausencia de dato no es dato de ausencia— dentro del
 *   módulo que la cita en su cabecera.
 * - **Negar en parte.** «No siempre», «no del todo»: un sí con matiz.
 * - **Afirmar tras un «no» de arranque** (REG-200). En el habla mexicana el
 *   «no» inicial es una muletilla y lo que sigue es un SÍ rotundo:
 *
 *       ¿Padece diabetes? — No pues sí, desde hace años.
 *       ¿Es hipertenso?   — No, sí tengo.
 *
 *   Verificado con el motor real el 7-ago-2026: `esRespuestaNegativa` devolvía
 *   `true` en las dos, y `condicionesNegadas` daba la diabetes por negada. El
 *   paciente acababa de afirmarla en la misma frase. Es la misma familia de daño
 *   que «no sé» —una ausencia fabricada— pero peor, porque aquí hay una
 *   afirmación explícita del paciente a la que se le da la vuelta.
 *
 * Los hedges («creo que no», «casi no») quedan fuera a propósito: no cuentan
 * como negación, que es el lado seguro. Está en la cola del dueño (C-8).
 *
 * ── EL «si» SIN TILDE SE RESUELVE HACIA EL LADO SEGURO ───────────────────────
 *
 * El núcleo llega sin acentos, así que «sí» (afirmación) y «si» (condicional)
 * se confunden. «No, si yo nunca he tenido nada» es una negación enfática y aquí
 * dejará de contar como tal: se pierde un aviso, que es el sesgo declarado del
 * módulo —señalar de menos, nunca de más—. Al revés sería fabricar el negativo,
 * que es justo el daño que esta entrada viene a impedir.
 */
const NO_ES_NEGACION = new RegExp(
  String.raw`^no[\s,;]+(?:pues\s+|pos\s+)?si\b|^no\s+(?:` + [
    String.raw`se\b`, String.raw`lo\s+se\b`, String.raw`sabria`, String.raw`recuerdo`,
    String.raw`me\s+acuerdo`, String.raw`estoy\s+segur[oa]`, String.raw`tengo\s+idea`,
    String.raw`me\s+(?:lo\s+|la\s+)?(?:han|he)\s+(?:dicho|checado|revisado|medido|hecho)`,
    String.raw`siempre`, String.raw`mucho`, String.raw`tanto`, String.raw`del\s+todo`,
  ].join('|') + String.raw`)`,
)

/**
 * ── C-6 RESUELTO: DOS PREGUNTAS, DOS REGEX (7-ago-2026) ──────────────────────
 *
 * Este vocabulario tenía UN sólo regex para dos consumidores que no preguntan
 * lo mismo: «¿esta mención de la nota ya viene explicada?» (la disculpa que
 * `contradicciones` aplica sobre la NOTA) y «¿el médico negó esto en el
 * dictado?» (lo que `condicionesNegadas` lee del DICTADO, y de ahí sale
 * `corregirCertezaPorNegacion`, que marca condiciones extraídas como
 * `descartado`).
 *
 * Compartirlo ya fabricó una negación que el paciente no dijo: la primera
 * versión de REG-192 añadió el infinitivo `descartar` pensando sólo en la nota
 * —«se solicita HbA1c para descartar diabetes» parecía una disculpa
 * razonable—, y sobre el dictado el efecto fue el contrario y mucho peor,
 * verificado con el motor real:
 *
 *     condicionesNegadas('Vamos a solicitar HbA1c para descartar diabetes.')
 *       → [{ condicion: 'diabetes' }]      ← el paciente NUNCA negó nada
 *
 * Un diferencial abierto quedaba escrito como `descartado`. Es la regla 4 de
 * `clinical-safety.md` del revés: no es que la ausencia de dato se tome por
 * dato de ausencia, es que se **fabrica** una ausencia que nadie dijo.
 *
 * La decisión (C-6, dueño, 7-ago-2026): separar los dos vocabularios en dos
 * constantes propias, para que ensanchar uno no pueda volver a tocar el otro
 * por accidente. Hoy dicen lo mismo —nadie ha pedido todavía que difieran— pero
 * son dos fuentes de verdad distintas desde ahora, no una compartida por
 * casualidad.
 */

/**
 * Cuenta como que una mención de la NOTA ya viene explicada. La usa
 * `contradicciones()`, como la `disculpa` que le pasa a `mencionSinDisculpa`.
 */
const DISCULPA_EN_LA_NOTA = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido)|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

/**
 * Cuenta como que el DICTADO negó el término. La usa `condicionesNegadas()`,
 * a través de `NIEGA_PEGADO` (que le añade el ancla de adyacencia de REG-199),
 * y de ahí sale `corregirCertezaPorNegacion`.
 */
const NIEGA_EN_EL_DICTADO = /\b(?:niega|nieg[ao]|no\s+(?:tiene|tengo|padece|padezco|refiere|refiero|ha\s+tenido)|sin\s+antecedente[s]?\s+de|descarta|ausencia\s+de|se\s+descarta)\b/i

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * ── EL NEGADOR ALCANZA AL TÉRMINO DE AL LADO, NO A LA FRASE (REG-199) ────────
 *
 * Sobre el dictado, la pregunta era `NIEGA_EN_EL_DICTADO.test(frase)`: basta
 * con que la oración contenga un negador para dar por negada **cualquier**
 * crónica nombrada en ella. Verificado con el motor real:
 *
 *     condicionesNegadas('Niega tabaquismo, tiene diabetes en tratamiento.')
 *       → [{ condicion: 'diabetes' }]      ← el negador era del tabaquismo
 *
 * Una diabetes activa, en tratamiento, salía reclasificada a `descartado` en el
 * panel de entidades porque la frase negaba **otra cosa**. Y «Niega tabaquismo y
 * alcoholismo, tiene diabetes de 10 años de evolución» es literalmente cómo
 * empieza un antecedente personal patológico.
 *
 * **No se ensancha el vocabulario para arreglar esto**, que es lo que ya salió
 * mal una vez: se reutiliza `NIEGA_EN_EL_DICTADO` tal cual y se le cambia el
 * ALCANCE, anclando en `$` para que el negador tenga que estar pegado al
 * término.
 *
 * De regalo, la premisa de la que avisa `NIEGA_EN_EL_DICTADO` se apaga sola: en
 * «para descartar diabetes» el infinitivo rompe la frontera de palabra de
 * `descarta`, así que la adyacencia no encuentra negador.
 */
const PUENTE = String.raw`(?:\s+(?:de|del|la|el|los|las|un|una|antecedentes?|historia|personal(?:es)?|patologic[oa]s?|familiar(?:es)?|con|que|a|al|su))*[\s:,;.-]*`
const NIEGA_PEGADO = new RegExp(NIEGA_EN_EL_DICTADO.source + PUENTE + '$', 'i')

/** Lo único que puede separar dos crónicas de una misma enumeración negada. */
const ENUMERACION = /^[\s,;]*(?:(?:y|e|o|u|ni|tampoco)\b[\s,;]*)?$/

/**
 * Si esta respuesta cuenta como una negación.
 *
 * Se exporta porque la pregunta «¿esto es un no?» se repite fuera de aquí, y
 * tenerla en un solo sitio impide que dos módulos disientan sobre si «pues no»
 * niega.
 */
export function esRespuestaNegativa(respuesta: string): boolean {
  const nucleo = sinAcentos(respuesta).trim().replace(ARRANQUE, '')
  if (!nucleo || NO_ES_NEGACION.test(nucleo)) return false
  return NEGATIVAS.test(nucleo)
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
 */
export function condicionesNegadas(transcripcion: string): Negada[] {
  const fs = frases(transcripcion)
  const vistas = new Map<string, Negada>()
  const anotar = (condicion: string, cita: string) => {
    if (!vistas.has(condicion)) vistas.set(condicion, { condicion, cita: cita.slice(0, 200) })
  }

  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const menciones = CRONICAS.flatMap(c =>
      apariciones(f, c.formas).map(a => ({ ...a, canonica: c.canonica })),
    ).sort((a, b) => a.inicio - b.inicio)
    if (!menciones.length) continue
    const plano = sinAcentos(f)

    // La respuesta: lo que sigue al signo de interrogación en la MISMA frase, o
    // la frase siguiente si la pregunta terminó ahí.
    const pregunta = esPregunta(f)
    const corte = f.indexOf('?')
    const resto = corte >= 0 ? f.slice(corte + 1).trim() : ''
    const respuesta = pregunta ? resto || (fs[i + 1] ?? '') : ''
    const contestaQueNo = !!respuesta && esRespuestaNegativa(respuesta)

    /**
     * Una enumeración hereda el negador de su cabeza: en «niega diabetes,
     * hipertensión y dislipidemia» sólo la primera lo tiene al lado y las tres
     * están negadas. Sin herencia, la nota **mejor escrita** —la que las niega
     * todas de una vez— era la que disparaba el aviso, y en las dos últimas.
     * Lo cazó el golden de REG-158, no yo.
     *
     * La herencia se corta en cuanto entre dos crónicas hay algo que no sea una
     * conjunción: «niega diabetes, tiene hipertensión» son dos hechos.
     */
    const negadaAqui: boolean[] = []
    for (let k = 0; k < menciones.length; k++) {
      const m = menciones[k]
      if (NIEGA_PEGADO.test(plano.slice(Math.max(0, m.inicio - VENTANA_ATRAS), m.inicio))) {
        negadaAqui[k] = true
        continue
      }
      negadaAqui[k] = false
      for (let j = k - 1; j >= 0; j--) {
        if (menciones[j].fin > m.inicio) continue // la misma mención, escrita de dos formas
        negadaAqui[k] = negadaAqui[j] && ENUMERACION.test(plano.slice(menciones[j].fin, m.inicio))
        break
      }
    }

    for (const [k, m] of menciones.entries()) {
      /**
       * Lo nombrado DENTRO de la pregunta lo contesta la respuesta, no el
       * negador que pudiera haber en la pregunta misma: a «¿no tiene diabetes?»
       * se puede contestar que sí, y quedarse con el «no» de la pregunta
       * afirmaría lo contrario de lo que dijo el paciente.
       */
      if (pregunta && (corte < 0 || m.inicio < corte)) {
        if (contestaQueNo) anotar(m.canonica, `${f} ${respuesta}`.trim())
        continue
      }
      if (negadaAqui[k]) anotar(m.canonica, f)
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
  const out: Contradiccion[] = []
  for (const n of negadas) {
    const formas = CRONICAS.find(c => c.canonica === n.condicion)?.formas ?? [n.condicion]
    /**
     * TODAS las apariciones, no sólo la primera (REG-192).
     *
     * `indexOf` a secas devolvía la primera, y en una nota real la primera es la
     * del apartado de antecedentes —«niega diabetes», que está bien escrito—.
     * Con eso el guardián se daba por satisfecho y no volvía a mirar: la
     * afirmación de más abajo, la que se copia a la receta, pasaba en silencio.
     *
     * La ventana de 60 y el criterio son los mismos de siempre; viven en
     * `mencion-en-la-nota.ts` porque el motor de temporalidad tenía esta misma
     * línea copiada y los dos se quedaban ciegos igual.
     */
    const enLaNota = mencionSinDisculpa(textoNota, formas, DISCULPA_EN_LA_NOTA)
    if (enLaNota !== null) out.push({ ...n, enLaNota })
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

export const POR_QUE_NO_SABER_NO_ES_NEGAR =
  '«No sé», «no me acuerdo» y «no me han checado» empiezan por «no» y no niegan ' +
  'nada: dicen que el paciente no lo sabe. Contarlas como negación reclasifica ' +
  'la condición a descartado y deja el expediente afirmando una ausencia que ' +
  'nadie afirmó — un paciente con diabetes sin diagnosticar contesta ' +
  'exactamente así. Ausencia de dato no es dato de ausencia.'

export const POR_QUE_EL_NEGADOR_NO_ALCANZA_A_TODA_LA_FRASE =
  'Un negador niega el término que tiene al lado, no la oración donde aparece. ' +
  '«Niega tabaquismo, tiene diabetes en tratamiento» niega el tabaquismo; dar ' +
  'por negada la diabetes borraría una crónica activa del panel de entidades ' +
  'porque la frase negaba otra cosa. Se cambia el ALCANCE del negador, nunca su ' +
  'vocabulario: ensanchar el vocabulario compartido ya fabricó una vez una ' +
  'negación que el paciente no dijo.'

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
