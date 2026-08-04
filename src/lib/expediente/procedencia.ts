/**
 * SELLO DE PROCEDENCIA — trazabilidad medicolegal por campo de la nota.
 *
 * Para cada dato ESTRUCTURADO que quedó en la nota (diagnósticos, medicamentos,
 * alergias, signos vitales) deriva DE DÓNDE salió, cruzando la lista final contra
 * el bloque de extracción auditada de la IA:
 *
 *   - 'dictado' : la IA lo sacó del dictado Y conserva la cita textual (source_quote).
 *                 Es lo máximo en trazabilidad: se puede leer la frase exacta.
 *   - 'ia'      : la IA lo propuso, pero SIN una frase literal que lo respalde
 *                 (inferencia del modelo). Se marca aparte, con honestidad.
 *   - 'manual'  : está en la nota pero NO vino de la extracción → lo escribió el médico.
 *   - 'calculado': lo derivó un motor determinista de otros datos (NEWS2, IMC,
 *                 día de UCI…). No lo dijo nadie ni lo tecleó nadie: si el dato
 *                 de origen cambia, éste cambia solo.
 *   - 'importado': llegó de un sistema externo — un monitor de cabecera por HL7,
 *                 un laboratorio. Lo midió una máquina que nadie estaba mirando.
 *
 * ── POR QUÉ HACÍAN FALTA LOS DOS ÚLTIMOS ─────────────────────────────────────
 *
 * Hasta ahora todo lo que no venía de la extracción caía en `manual`, y `manual`
 * significa **«lo escribió el médico»**. Con el adaptador de dispositivos
 * (`lib/dispositivos/vitales-hl7.ts`) ya entran signos vitales de un monitor: si
 * se sellaran como `manual`, el registro afirmaría que el médico tecleó una
 * frecuencia cardiaca que en realidad midió un aparato conectado a un cable que
 * quizá estaba suelto. Y un NEWS2 calculado no lo «dijo» nadie.
 *
 * En un registro que existe para responder «¿quién dijo esto?», meter a la
 * máquina y al médico en la misma casilla es perder justo la respuesta.
 *
 * Honestidad: el origen se DERIVA de evidencia real (¿coincide con la extracción?,
 * ¿trae cita?). Nunca se inventa. Es puro y testeable; no altera ningún valor clínico
 * (solo lo clasifica para mostrarlo y sellarlo en el registro).
 */
import type { Confianza } from './extraction-schema'
import { ABRE, CIERRA } from './confianza-audio'

export type OrigenCampo = 'dictado' | 'ia' | 'manual' | 'calculado' | 'importado'

/**
 * Los orígenes que NO son una persona de este consultorio.
 *
 * Sirve para lo que importa: un dato que nadie de aquí afirmó no puede
 * presentarse como si lo hubiera afirmado alguien de aquí.
 */
export const ORIGENES_SIN_AUTOR_HUMANO: readonly OrigenCampo[] = ['calculado', 'importado']

export function esDeMaquina(o: OrigenCampo): boolean {
  return ORIGENES_SIN_AUTOR_HUMANO.includes(o)
}

/**
 * De la `fuente` con la que se guarda una toma al vocabulario de procedencia.
 *
 * Los dos vocabularios existían por separado: las tomas de UCI y los signos ya
 * declaran de dónde vienen (`panel-uci`, `teclado`, `dispositivo`…) y el sello
 * de la nota sólo sabía de dictado/IA/mano. Sin este puente, un signo vital que
 * llegó del monitor se sellaba como `manual` — es decir, **como si lo hubiera
 * escrito el médico**.
 *
 * Lo que no se reconoce NO se degrada a `manual`: se devuelve `null` para que
 * quien llama decida, porque inventar un autor es peor que no tener uno.
 */
export function origenDesdeFuente(fuente: string | undefined | null): OrigenCampo | null {
  const f = String(fuente ?? '').trim().toLowerCase()
  if (!f) return null
  if (f === 'dispositivo' || f.startsWith('hl7') || f.startsWith('monitor')) return 'importado'
  if (f === 'calculado' || f.startsWith('derivad')) return 'calculado'
  if (f === 'voz' || f === 'dictado') return 'dictado'
  if (f === 'teclado' || f === 'panel-uci' || f === 'manual') return 'manual'
  return null
}

export interface CampoProcedencia {
  id: string
  etiqueta: string
  valor: string
  origen: OrigenCampo
  cita?: string
  confianza?: Confianza
  /**
   * QUIÉN LO DIJO, cuando no fue el paciente.
   *
   * ── EL HUECO QUE ESTO CIERRA ───────────────────────────────────────────────
   *
   * La regla V3 preguntaba «¿lo afirmó alguien que no es el médico?». Cualquiera
   * que no fuera el médico servía. Así que un antecedente que sostiene **la hija
   * del paciente** —«sí, es diabética»— se sella exactamente igual que si lo
   * hubiera dicho la paciente, que puede no haberlo dicho nunca.
   *
   * Y no se arregla rechazándolo: el relato de un acompañante **es** historia
   * clínica válida, y a veces la única —un paciente con demencia o afasia—. Lo
   * que no puede es **atribuirse en silencio al paciente**. El charter lo pone
   * como criterio de cero: «un síntoma del acompañante como del paciente es un
   * hecho falso».
   *
   * Así que no se degrada nada: se **dice quién**. Vacío cuando lo sostiene el
   * propio paciente, que es el caso normal y no necesita apostilla.
   */
  dichoPor?: string
  /**
   * EL MÉDICO LO ACEPTÓ, UNO POR UNO.
   *
   * De dónde salió un dato y si un humano lo hizo suyo son dos preguntas
   * distintas, y el registro sólo respondía la primera. Guardaba `camposAprobados: 3`
   * —un número suelto— así que sabía CUÁNTOS había aceptado y no CUÁLES: ante una
   * revisión, «el médico aprobó tres cosas» no dice nada de la que se discute.
   *
   * Se anota aparte, sin tocar `origen`, porque un dato puede ser las dos cosas:
   * venir del dictado con su cita textual Y haber sido aceptado. Fundirlos en un
   * solo campo perdería una de las dos.
   *
   * `undefined` significa «no aplica» —lo escribió el médico, no hay nada que
   * aceptar—; `false`, que la IA lo propuso y NADIE lo aceptó explícitamente.
   * Esa diferencia es justo la que importa.
   */
  confirmado?: boolean
}

export interface ResumenProcedencia {
  dictado: number
  ia: number
  manual: number
  /**
   * De los que propuso la IA, cuántos aceptó el médico explícitamente.
   *
   * OPCIONAL a propósito: las notas firmadas antes de que esto existiera no lo
   * llevan, y ponerles un `0` obligatorio al leerlas afirmaría que el médico no
   * aceptó nada — cuando la verdad es que no se estaba registrando. En un
   * expediente, «no consta» y «cero» no son lo mismo.
   */
  confirmados?: number
  total: number
}

export interface ManifiestoProcedencia {
  campos: CampoProcedencia[]
  resumen: ResumenProcedencia
}

/**
 * Quita NUESTRAS marcas de duda de una cita.
 *
 * ── EL DEFECTO, Y ES DE LOS QUE NO SE VEN ────────────────────────────────────
 *
 * El modelo redacta la nota leyendo el diálogo **marcado**: las palabras que el
 * audio no oyó con seguridad van entre `⟦…?⟧`. Si cita una frase que contiene
 * una de ellas, la cita se lleva la marca dentro:
 *
 *     "le doy ⟦sefriaxona?⟧ dos gramos"
 *
 * Y el sello compara esa cita contra la transcripción **plana**, donde la marca
 * no existe. No la encuentra, así que degrada el campo a «ia» y la compuerta de
 * firma lo saca como «no se pudo comprobar».
 *
 * O sea: un campo **correctamente citado** se presentaba como dudoso, y encima
 * justo en las frases donde el audio ya había dudado — las que más importa
 * revisar bien. El médico ve una lista de avisos que no le dice nada, y una
 * lista que no dice nada se cierra sin leer.
 *
 * Es la `FidelidadEntrega` del charter: **el juez tiene que leer el mismo string
 * que leyó el redactor**. La marca es una anotación nuestra, no algo que dijera
 * el paciente: una cita que la arrastra sigue siendo las mismas palabras.
 */
function quitarMarcas(s: string): string {
  return s.split(ABRE).join('').split(CIERRA).join('')
}

/** Normaliza para comparar: minúsculas, sin acentos, sin espacios de sobra. */
export function normaliza(s: string): string {
  return quitarMarcas(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const POR_QUE_SE_QUITAN_LAS_MARCAS =
  'El modelo redacta leyendo el diálogo MARCADO, así que una cita de una frase ' +
  'con una palabra dudosa se lleva la marca dentro. El sello compara contra la ' +
  'transcripción plana, no la encuentra, y presenta como «no comprobado» un ' +
  'campo correctamente citado — justo en las frases donde el audio ya dudó.'

/** Un ítem de la extracción auditada (permisivo: los campos crecen con el tiempo). */
type ItemExtraido = {
  source_quote?: string
  confidence?: Confianza
  [k: string]: unknown
}

interface ExtractionBlock {
  diagnosticos?: ItemExtraido[]
  medicamentos?: ItemExtraido[]
  alergias?: ItemExtraido[]
  signosVitales?: Record<string, { value?: unknown; source_quote?: string; confidence?: Confianza }>
  /**
   * La PROSA auditada. Existe en el esquema desde siempre —cada sección trae su
   * `value`, su `confidence` y su `source_quote`— y el manifiesto no la miraba.
   */
  secciones?: Record<string, ItemExtraido>
  resumenEjecutivo?: ItemExtraido
}

interface FinalNota {
  diagnosticos?: { descripcion?: string }[]
  medicamentos?: { nombre?: string; dosis?: string }[]
  alergias?: (string | { alergeno?: string })[]
  signosVitales?: Record<string, unknown>
  /** Las secciones redactadas de la nota, tal como quedaron al firmar. */
  secciones?: { key?: string; label?: string; value?: string }[]
  resumen?: string
}

/**
 * Cuánto texto de una sección se guarda como «valor» del campo.
 *
 * El manifiesto es una tabla de procedencia, no una copia de la nota: el
 * documento entero ya está al lado. Se guarda el arranque, que es lo que
 * identifica de qué párrafo se habla.
 */
export const MUESTRA_PROSA = 160

/**
 * Qué secciones se juzgan con la regla V3 —«¿lo afirmó el paciente o lo nombró
 * la pregunta?»—.
 *
 * Sólo las de antecedentes. Es donde ocurrió el fallo real: «¿diabetes o presión
 * alta?» «No» acabó redactado como «paciente con DM2 e HTA». En el padecimiento
 * actual o en la exploración, el médico describe lo que ve, y exigir que la cita
 * la sostenga el paciente degradaría prosa correcta.
 */
const SECCION_ES_ANTECEDENTE = /antecedent|heredofamiliar|patologic|quirurgic|alergi/i

/**
 * Clasifica un campo contra su coincidencia en la extracción.
 *
 * ── DOS FORMAS DE MENTIR QUE ESTE MÓDULO TENÍA ───────────────────────────────
 *
 * 1. **La cita no se verificaba.** Bastaba una cadena no vacía para sellar el
 *    campo como «dictado» y mostrarla entrecomillada, como si fuera literal. Si
 *    el modelo se inventaba la frase, el sello la respaldaba. Ahora, cuando se
 *    conoce la transcripción, la cita tiene que APARECER en ella; si no, el
 *    campo baja a «ia» y la cita no se muestra.
 *
 * 2. **El valor editado quedaba sellado como dictado.** Los medicamentos se
 *    emparejan por NOMBRE pero el valor sellado incluye la dosis: el médico
 *    corregía la dosis y el campo seguía diciendo «dictado», con la cita del
 *    dictado ORIGINAL contradiciendo el valor mostrado. Un valor que cambió el
 *    médico es del médico.
 */
/**
 * Un turno del dictado, con quién lo dijo.
 *
 * Es lo que permite la tercera comprobación: **de quién es la cita**.
 */
export interface TurnoAtribuido {
  /** 'Médico' | 'Paciente' | 'Acompañante' | 'Hablante A'… tal como lo ve la pantalla. */
  rol: string
  texto: string
}

/** ¿El rol de este turno es el del médico? */
const esDelMedico = (rol: string) => /m[eé]dic|doctor/i.test(rol)

/**
 * ── V3 · UNA CITA DEL MÉDICO NO PRUEBA UN ANTECEDENTE DEL PACIENTE ───────────
 *
 * Es la defensa contra el caso que el Dr. encontró en producción. El
 * interrogatorio se dicta **nombrando la enfermedad en la pregunta**:
 *
 *     Médico:   «¿Enfermedades crónicas como diabetes o presión alta?»
 *     Paciente: «No.»
 *
 * Un extractor que busca su cita textual la encuentra —«diabetes» está en el
 * dictado, literalmente— y sella el diagnóstico como **dictado**. La cita es
 * verdadera y la conclusión es falsa: quien nombró la enfermedad fue el médico
 * preguntando, no el paciente afirmando.
 *
 * La v976 lo atrapa después, contrastando. Esto lo impide **antes**: el sello de
 * «lo dijo el paciente» deja de poder construirse sobre las palabras del médico.
 *
 * Se aplica **sólo a antecedentes y diagnósticos**. Una dosis citada del turno
 * del médico es correcta —el médico es quien prescribe— y degradarla sería el
 * falso positivo caro.
 */
export function citaSostieneAntecedente(
  cita: string,
  turnos: readonly TurnoAtribuido[] | undefined,
): boolean {
  if (!turnos?.length) return true          // sin turnos no se puede juzgar: no se degrada
  const c = normaliza(cita)
  if (!c) return true
  const dondeAparece = turnos.filter(t => normaliza(t.texto).includes(c))
  if (!dondeAparece.length) return true     // la cita no cae en ningún turno: lo juzga V2
  // Basta que UN turno de alguien que no es el médico la contenga.
  return dondeAparece.some(t => !esDelMedico(t.rol))
}

/** ¿Es el turno del propio paciente? */
const esDelPaciente = (rol: string) => /paciente/i.test(rol) && !/no identificad/i.test(rol)

/**
 * Quién sostiene la cita, cuando **no** es el paciente.
 *
 * Devuelve `undefined` si la sostiene el paciente —el caso normal— o si no hay
 * con qué juzgarlo. Nunca inventa un rol: si los turnos no traen rol, no dice
 * nada, porque una apostilla equivocada sobre quién habló es peor que ninguna.
 */
export function quienSostiene(
  cita: string,
  turnos: readonly TurnoAtribuido[] | undefined,
): string | undefined {
  if (!turnos?.length) return undefined
  const c = normaliza(cita)
  if (!c) return undefined
  const dondeAparece = turnos.filter(t => normaliza(t.texto).includes(c))
  if (!dondeAparece.length) return undefined
  // Si el paciente lo dijo en algún turno, es del paciente: no hace falta apostilla.
  if (dondeAparece.some(t => esDelPaciente(t.rol))) return undefined
  const otros = dondeAparece.filter(t => !esDelMedico(t.rol)).map(t => t.rol)
  return otros.length ? [...new Set(otros)].join(', ') : undefined
}

export const POR_QUE_SE_DICE_QUIEN =
  'El relato de un acompañante ES historia clínica válida, y a veces la única ' +
  '—un paciente con demencia o afasia—. Lo que no puede es atribuirse EN ' +
  'SILENCIO al paciente: un síntoma del acompañante presentado como del ' +
  'paciente es un hecho falso. No se degrada nada; se dice quién.'

export const POR_QUE_V3 =
  'El interrogatorio nombra la enfermedad en la PREGUNTA del médico, así que un ' +
  'extractor encuentra su cita textual y sella el diagnóstico como dictado: la ' +
  'cita es verdadera y la conclusión es falsa. Se aplica sólo a antecedentes y ' +
  'diagnósticos — una dosis citada del turno del médico es correcta, porque el ' +
  'médico es quien prescribe.'

function origenDe(
  match: ItemExtraido | undefined,
  ctx?: {
    transcripcionNorm?: string; valorFinal?: string; valorExtraido?: string; sinExtraccion?: OrigenCampo
    /** Turnos con su rol, para la tercera comprobación (de quién es la cita). */
    turnos?: readonly TurnoAtribuido[]
    /** `true` sólo en antecedentes y diagnósticos: es donde V3 aplica. */
    esAntecedente?: boolean
  },
): { origen: OrigenCampo; cita?: string; confianza?: Confianza; dichoPor?: string } {
  if (!match) return { origen: ctx?.sinExtraccion ?? 'manual' }

  /**
   * ¿El médico CAMBIÓ el valor después de la extracción?
   *
   * Sólo se compara cuando la extracción trae ese dato. Que la extracción no
   * capturara la dosis y el médico la escriba no convierte el fármaco en «lo
   * escribió a mano»: el fármaco sí salió del dictado. Lo que no se puede es
   * seguir diciendo «dictado» sobre una dosis que el médico CORRIGIÓ, con la
   * cita del dictado original contradiciendo lo que se ve.
   */
  if (ctx?.valorFinal && ctx?.valorExtraido) {
    const a = normaliza(ctx.valorFinal), b = normaliza(ctx.valorExtraido)
    if (a !== b) return { origen: 'manual', confianza: match.confidence }
  }

  const cita = typeof match.source_quote === 'string' ? match.source_quote.trim() : ''
  if (!cita) return { origen: 'ia', confianza: match.confidence }

  /**
   * SIN TRANSCRIPCIÓN NO HAY SELLO DE «DICTADO». FALLA CERRADO.
   *
   * Antes, si no llegaba la transcripción se conservaba `dictado` «para no
   * degradar algo que quizá era correcto». El efecto real era el contrario del
   * buscado: el sello decía «esto lo dijo el paciente» **sin haber comprobado
   * nada**. Un sello que a veces miente vale menos que ningún sello — quien lo
   * lee no tiene forma de saber cuál de las dos veces le tocó.
   *
   * Ahora: si no se puede verificar, el origen es `ia`. Se pierde un poco de
   * crédito en los casos correctos y se gana que el crédito signifique algo.
   */
  if (!ctx?.transcripcionNorm) return { origen: 'ia', confianza: match.confidence }
  if (!ctx.transcripcionNorm.includes(normaliza(cita))) {
    return { origen: 'ia', confianza: match.confidence }
  }
  /**
   * V3: la cita existe, pero ¿la dijo el paciente o la nombró el médico al
   * preguntar? Sólo para antecedentes y diagnósticos.
   */
  if (ctx.esAntecedente && !citaSostieneAntecedente(cita, ctx.turnos)) {
    return { origen: 'ia', confianza: match.confidence }
  }
  // La cita se sostiene. Si NO la sostuvo el paciente, se dice quién — sin
  // degradar el campo: quien lo dijo es un hecho, no una duda.
  return { origen: 'dictado', cita, confianza: match.confidence, dichoPor: quienSostiene(cita, ctx.turnos) }
}

/**
 * Deriva el manifiesto de procedencia de la nota. Puro: solo lee, no muta nada.
 *
 * `aprobados` son los identificadores que el médico marcó en el panel de
 * revisión. Es opcional: sin él, el manifiesto es exactamente el de antes.
 *
 * ── POR QUÉ NO SE COMPARAN LOS ÍNDICES DIRECTAMENTE ──────────────────────────
 *
 * El panel numera sobre la lista de la EXTRACCIÓN y esta función sobre la lista
 * FINAL de la nota. En cuanto el médico rechaza un diagnóstico, las dos
 * numeraciones se desfasan y el `dx:1` de uno deja de ser el `dx:1` del otro.
 * Dar por confirmado un diagnóstico usando el visto bueno de OTRO es peor que no
 * registrar nada: sería un dato falso en el registro medicolegal, y con la firma
 * del médico encima.
 *
 * Por eso se usa el índice del ítem de la extracción con el que de verdad
 * coincidió cada campo, que es la única numeración que el panel comparte.
 */
export function construirManifiesto(
  final: FinalNota,
  extraction?: ExtractionBlock,
  aprobados?: ReadonlySet<string>,
  /**
   * `transcripcion`: para poder comprobar que la cita textual EXISTE.
   * `sinExtraccion`: qué origen darle a lo que no coincide con ninguna
   * extracción. Por defecto `manual` («lo escribió el médico»), que es falso
   * cuando la nota la produjo el parser local: ahí no hay bloque de extracción y
   * TODO salía como escrito a mano sobre datos de máquina.
   */
  opciones?: {
    transcripcion?: string; sinExtraccion?: OrigenCampo
    /**
     * Los turnos con su rol. Sin ellos, V3 no puede juzgar y NO degrada nada:
     * el manifiesto queda exactamente como antes.
     */
    turnos?: readonly TurnoAtribuido[]
  },
): ManifiestoProcedencia {
  const campos: CampoProcedencia[] = []
  const transcripcionNorm = opciones?.transcripcion ? normaliza(opciones.transcripcion) : undefined
  const sinExtraccion = opciones?.sinExtraccion
  const turnos = opciones?.turnos

  /** Devuelve el ítem coincidente Y su posición en la extracción (para el id del panel). */
  const buscar = (lista: ItemExtraido[] | undefined, clave: (x: ItemExtraido) => string, valor: string) => {
    if (!lista) return { item: undefined, indice: -1 }
    const n = normaliza(valor)
    let i = lista.findIndex(x => normaliza(clave(x)) === n)
    // coincidencia laxa: la extracción contiene el valor final o viceversa (p. ej. "cefalea" vs "cefalea tensional")
    if (i < 0) i = lista.findIndex(x => { const k = normaliza(clave(x)); return !!k && !!n && (k.includes(n) || n.includes(k)) })
    return { item: i >= 0 ? lista[i] : undefined, indice: i }
  }

  /**
   * `undefined` cuando no hay nada que confirmar: lo escribió el médico, así que
   * preguntar si «aceptó» su propio texto no significa nada.
   */
  const confirmadoDe = (idPanel: string | null): boolean | undefined => {
    if (!aprobados || idPanel === null) return undefined
    return aprobados.has(idPanel)
  }

  final.diagnosticos?.forEach((d, i) => {
    const desc = String(d.descripcion ?? '').trim()
    if (!desc) return
    const { item, indice } = buscar(extraction?.diagnosticos, x => String(x.descripcion ?? ''), desc)
    campos.push({
      id: `dx:${i}`, etiqueta: 'Diagnóstico', valor: desc,
      ...origenDe(item, { transcripcionNorm, sinExtraccion, turnos, esAntecedente: true }),
      confirmado: confirmadoDe(indice >= 0 ? `dx:${indice}` : null),
    })
  })

  final.medicamentos?.forEach((med, i) => {
    const nom = String(med.nombre ?? '').trim()
    if (!nom) return
    const { item, indice } = buscar(extraction?.medicamentos, x => String(x.nombre ?? ''), nom)
    const valorFinal = [nom, med.dosis].filter(Boolean).join(' ').trim()
    // Sólo se puede comparar la dosis si la extracción trajo una.
    const dosisExtraida = String((item as { dosis?: string } | undefined)?.dosis ?? '').trim()
    const valorExtraido = item && dosisExtraida
      ? [item.nombre, dosisExtraida].filter(Boolean).join(' ').trim()
      : undefined
    campos.push({
      id: `med:${i}`, etiqueta: 'Medicamento', valor: valorFinal,
      ...origenDe(item, { transcripcionNorm, valorFinal, valorExtraido, sinExtraccion }),
      confirmado: confirmadoDe(indice >= 0 ? `med:${indice}` : null),
    })
  })

  final.alergias?.forEach((a, i) => {
    const alg = typeof a === 'string' ? a : String(a?.alergeno ?? '')
    if (!alg.trim()) return
    const { item, indice } = buscar(extraction?.alergias, x => String(x.alergeno ?? ''), alg)
    campos.push({
      id: `alg:${i}`, etiqueta: 'Alergia', valor: alg.trim(),
      // Una alergia también es un antecedente del paciente: si la nombró el
      // médico preguntando («¿alergias? ¿al yodo?»), la cita no la sostiene.
      ...origenDe(item, { transcripcionNorm, sinExtraccion, turnos, esAntecedente: true }),
      confirmado: confirmadoDe(indice >= 0 ? `alg:${indice}` : null),
    })
  })

  if (final.signosVitales) {
    for (const [k, v] of Object.entries(final.signosVitales)) {
      if (v === null || v === undefined || v === '') continue
      const ex = extraction?.signosVitales?.[k]
      const cita = typeof ex?.source_quote === 'string' ? ex.source_quote.trim() : ''
      const citaVerificada = !!cita && (!transcripcionNorm || transcripcionNorm.includes(normaliza(cita)))
      const origen: OrigenCampo = ex ? (citaVerificada ? 'dictado' : 'ia') : (sinExtraccion ?? 'manual')
      campos.push({
        id: `sv:${k}`, etiqueta: `Signo vital ${k.toUpperCase()}`, valor: String(v),
        origen, cita: citaVerificada ? cita : undefined, confianza: ex?.confidence,
        // Los signos vitales se identifican por su NOMBRE en los dos sitios, así
        // que aquí no hay desfase posible.
        confirmado: confirmadoDe(ex ? `sv:${k}` : null),
      })
    }
  }

  /**
   * ── LA PROSA, QUE ERA LO QUE FALTABA ───────────────────────────────────────
   *
   * El manifiesto cubría diagnósticos, medicamentos, alergias y signos: **datos
   * estructurados**. Y los tres fallos que el Dr. encontró en producción
   * vivieron en la prosa — «la de la docencia» convertido en «vesícula», y un
   * «no» a la pregunta por diabetes redactado como «paciente con DM2 e HTA».
   *
   * O sea que el sello contaba con precisión la parte que no había fallado.
   *
   * La extracción ya traía cada sección con su cita: sólo faltaba mirarla.
   */
  const prosa: { id: string; etiqueta: string; texto: string; ex: ItemExtraido | undefined; antecedente: boolean }[] = []
  if (final.resumen?.trim()) {
    prosa.push({ id: 'prosa:resumen', etiqueta: 'Resumen', texto: final.resumen.trim(), ex: extraction?.resumenEjecutivo, antecedente: false })
  }
  final.secciones?.forEach((sec, i) => {
    const texto = String(sec?.value ?? '').trim()
    if (!texto) return
    const clave = String(sec?.key ?? '')
    const etiqueta = String(sec?.label ?? clave ?? `Sección ${i + 1}`)
    prosa.push({
      id: `prosa:${clave || i}`,
      etiqueta,
      texto,
      ex: clave ? extraction?.secciones?.[clave] : undefined,
      antecedente: SECCION_ES_ANTECEDENTE.test(`${clave} ${etiqueta}`),
    })
  })

  for (const p of prosa) {
    /**
     * Se compara el texto FINAL con el que propuso la extracción: si el médico
     * reescribió el párrafo, el origen es «manual» — es suyo, no del dictado.
     * Es la misma regla que ya se aplicaba a la dosis de un medicamento.
     */
    const valorExtraido = typeof p.ex?.value === 'string' ? p.ex.value : undefined
    campos.push({
      id: p.id,
      etiqueta: p.etiqueta,
      valor: p.texto.length > MUESTRA_PROSA ? `${p.texto.slice(0, MUESTRA_PROSA)}…` : p.texto,
      ...origenDe(p.ex, {
        transcripcionNorm, sinExtraccion, turnos,
        esAntecedente: p.antecedente,
        valorFinal: valorExtraido ? p.texto : undefined,
        valorExtraido,
      }),
      // La prosa no pasa por el panel de revisión: no hay visto bueno que leer.
      confirmado: undefined,
    })
  }

  const resumen: ResumenProcedencia = {
    dictado: campos.filter(c => c.origen === 'dictado').length,
    ia: campos.filter(c => c.origen === 'ia').length,
    manual: campos.filter(c => c.origen === 'manual').length,
    confirmados: campos.filter(c => c.confirmado === true).length,
    total: campos.length,
  }
  return { campos, resumen }
}

const ETIQUETA_ORIGEN: Record<OrigenCampo, string> = {
  dictado: 'del dictado (con cita)',
  ia: 'inferencia de IA',
  manual: 'capturado a mano',
  // Los dos que no tienen autor humano: ni los dijo nadie ni los tecleó nadie.
  calculado: 'calculado por el sistema',
  importado: 'importado de un dispositivo',
}

/** Frase corta para el sello ("6 del dictado · 2 de IA · 1 a mano · 3 aceptados"). */
export function resumenProcedencia(r: ResumenProcedencia): string {
  const partes: string[] = []
  if (r.dictado) partes.push(`${r.dictado} del dictado`)
  if (r.ia) partes.push(`${r.ia} de IA`)
  if (r.manual) partes.push(`${r.manual} a mano`)
  // Va al final y sólo cuando lo hubo: es la parte del sello que HABLA DEL
  // MÉDICO, no de la máquina, y por eso es la que más pesa en una revisión.
  if (r.confirmados) partes.push(`${r.confirmados} aceptados por el médico`)
  return partes.join(' · ') || 'sin datos estructurados'
}

export function etiquetaOrigen(o: OrigenCampo): string {
  return ETIQUETA_ORIGEN[o]
}

/**
 * ── LO QUE LA IA AFIRMÓ Y NADIE PUDO COMPROBAR ───────────────────────────────
 *
 * La compuerta de firma ya impedía que entrara **prosa** que la IA añadió por su
 * cuenta: el modelo la marca, y antes de firmar el médico la acepta o la quita.
 *
 * Los campos ESTRUCTURADOS no tenían esa compuerta. Un diagnóstico, una alergia
 * o un fármaco que la extracción propuso **sin una cita comprobable** entraba a
 * la nota firmada como cualquier otro. Y son justo los que más pesan: un
 * diagnóstico se arrastra a todas las notas siguientes, y una alergia gobierna
 * el cruce que bloquea recetas.
 *
 * ── POR QUÉ SÓLO ESTOS TRES ──────────────────────────────────────────────────
 *
 * Los signos vitales quedan fuera a propósito: los teclea el médico o los toma
 * enfermería, así que su origen normal es `manual` y meterlos aquí llenaría el
 * aviso de ruido. Un aviso ruidoso se cierra sin leer, y ahí se pierde entero.
 *
 * ── LO QUE **NO** ES ─────────────────────────────────────────────────────────
 *
 * `ia` no significa «inventado». Significa **«no se pudo comprobar»**: puede ser
 * una cita que el corrector reescribió, o un dictado sin separación de voces. Por
 * eso la salida es un aviso con un botón para aceptarlos todos, no una acusación
 * campo por campo.
 */
export interface CampoSinEvidencia {
  id: string
  etiqueta: string
  valor: string
}

/** Los campos que la IA propuso y cuya cita no se pudo comprobar. */
export function camposSinEvidencia(m: ManifiestoProcedencia): CampoSinEvidencia[] {
  const CUENTAN = new Set(['Diagnóstico', 'Alergia', 'Medicamento'])
  return m.campos
    .filter(c => c.origen === 'ia' && CUENTAN.has(c.etiqueta))
    // Lo que el médico ya marcó como visto bueno en el panel de revisión ya pasó
    // por sus ojos: volver a preguntarlo es la definición de fatiga de alertas.
    .filter(c => c.confirmado !== true)
    .map(c => ({ id: c.id, etiqueta: c.etiqueta, valor: c.valor }))
}

export const POR_QUE_LOS_SIGNOS_QUEDAN_FUERA =
  'Los signos vitales los teclea el médico o los toma enfermería, así que su ' +
  'origen normal es «manual»: meterlos en el aviso lo llenaría de ruido. Un ' +
  'aviso ruidoso se cierra sin leer, y ahí se pierde entero.'

export const POR_QUE_IA_NO_ES_INVENTADO =
  '«ia» no significa inventado: significa que no se pudo comprobar. Puede ser ' +
  'una cita que el corrector reescribió o un dictado sin separación de voces. ' +
  'Por eso el aviso deja aceptarlos todos de una vez, en vez de acusar campo ' +
  'por campo.'
