/**
 * LA DUDA DEL MOTOR DE AUDIO NO SE BORRA: SE PROPAGA.
 *
 * ── EL CASO QUE ORIGINA ESTE MÓDULO ──────────────────────────────────────────
 *
 * En una consulta real del Dr., el audio oyó «la de la **docencia**» —que no
 * significa nada en ese contexto— y aguas abajo apareció **«vesícula»**, un
 * órgano que el paciente nunca mencionó.
 *
 * Lo importante no es que el motor se equivocara: los motores de voz se
 * equivocan. Lo importante es que **el motor SABÍA que dudaba** —AssemblyAI
 * devuelve una confianza por cada palabra— y nosotros tirábamos ese dato en el
 * mapeo de la respuesta:
 *
 *     (u) => ({ speaker: u.speaker, text: u.text })   // ← `u.words` a la basura
 *
 * Después de esa línea, una palabra que el motor dio con 0.31 de confianza y una
 * que dio con 0.99 son **indistinguibles**: las dos son texto plano. El modelo
 * que arma la nota recibe una frase perfectamente segura de sí misma y hace lo
 * que hace cualquier lector con una frase segura — razonar sobre ella. Ahí es
 * donde una palabra mal oída asciende a hecho clínico.
 *
 * A eso se le llama *blanqueo de incertidumbre*: el dato existía, era gratis y
 * lo perdimos nosotros.
 *
 * ── LO QUE ESTE MÓDULO HACE ──────────────────────────────────────────────────
 *
 * 1. Marca en el texto que va al modelo las palabras de baja confianza.
 * 2. Le da al médico una lista corta de «palabras a verificar», con el minuto
 *    exacto para que pueda volver al audio.
 *
 * ── LO QUE **NO** HACE, Y ES DELIBERADO ──────────────────────────────────────
 *
 * **No corrige nada.** No adivina qué quiso decir «docencia», no busca la
 * palabra clínica más parecida, no propone «vesícula». Adivinar sobre una
 * palabra que no se oyó bien es exactamente el fallo que se está reparando, sólo
 * que cometido por nosotros y con más confianza.
 *
 * Módulo PURO. Sin red, sin estado.
 */

/** Una palabra tal como la devuelve el motor, con su duda incluida. */
export interface PalabraOida {
  texto: string
  /** Milisegundos desde el inicio de la grabación. */
  inicioMs: number
  /** 0 a 1. Lo que el motor cree que acertó. */
  confianza: number
}

/** Un turno de habla, ahora con las palabras y su confianza. */
export interface TurnoConPalabras {
  speaker: string
  text: string
  palabras?: PalabraOida[]
}

/**
 * DEBAJO DE ESTO, UNA PALABRA SE MARCA.
 *
 * ── ESTA CIFRA NO ESTÁ CALIBRADA, Y SE DICE ──────────────────────────────────
 *
 * No sale de ningún estudio ni de ninguna guía: es un punto de partida. La
 * calibración honesta se hace contra el banco de voz con audio real que ya
 * existe en el repositorio (`docs/` + las transcripciones guardadas), midiendo
 * cuántas palabras mal oídas quedan por encima del corte y cuánto ruido genera
 * bajarlo. Está declarado como pendiente, no dado por hecho.
 *
 * ── POR QUÉ SE ELIGE ERRANDO HACIA MARCAR DE MÁS ─────────────────────────────
 *
 * El error no cuesta lo mismo en las dos direcciones. Marcar de más le cuesta al
 * médico una mirada; marcar de menos le cuesta que una palabra inventada entre
 * en una nota que él firma. Mientras la cifra no esté medida, el corte se pone
 * donde el fallo barato sea el frecuente.
 */
export const UMBRAL_DUDA = Number(process.env.NEXT_PUBLIC_UMBRAL_CONFIANZA_AUDIO) || 0.6

export const UMBRAL_SIN_CALIBRAR =
  'NEEDS_CALIBRATION: 0.6 es un punto de partida, no una medición. Se calibra ' +
  'contra el banco de voz con audio real, contando cuántas palabras mal oídas ' +
  'quedan por encima del corte. Se eligió errando hacia marcar de más: marcar ' +
  'de más cuesta una mirada, marcar de menos cuesta una palabra inventada ' +
  'dentro de una nota firmada.'

/**
 * Palabras que NO se marcan aunque el motor dude de ellas.
 *
 * Un artículo o una preposición mal oídos no se convierten en un hecho clínico
 * —nadie diagnostica a partir de un «de»—, y en cambio son las palabras que más
 * bajo puntúan, porque se dicen rápido y pegadas. Marcarlas llenaría el texto de
 * marcas irrelevantes, y un texto lleno de marcas se lee igual que uno sin
 * ninguna: la señal se diluye justo donde tenía que resaltar.
 */
const VACIAS = new Set([
  'a', 'al', 'ante', 'con', 'de', 'del', 'e', 'el', 'en', 'entre', 'es', 'esa', 'ese',
  'eso', 'esta', 'este', 'esto', 'la', 'las', 'le', 'les', 'lo', 'los', 'me', 'mi',
  'muy', 'ni', 'no', 'o', 'para', 'pero', 'por', 'que', 'se', 'si', 'sí', 'sin', 'sobre',
  'su', 'sus', 'también', 'te', 'tu', 'un', 'una', 'uno', 'y', 'ya', 'eh', 'mmm', 'ah',
])

const limpia = (s: string) => s.toLowerCase().replace(/[.,;:¿?¡!()"']/g, '').trim()

/** ¿Esta palabra merece que se dude de ella en voz alta? */
export function esMarcable(p: PalabraOida, umbral = UMBRAL_DUDA): boolean {
  if (!Number.isFinite(p.confianza)) return false
  if (p.confianza >= umbral) return false
  const l = limpia(p.texto)
  // Menos de tres letras casi siempre es palabra vacía aunque no esté en la
  // lista; y una cadena vacía no es nada que verificar.
  return l.length >= 3 && !VACIAS.has(l)
}

/** Las palabras dudosas de todo el dictado, de la más dudosa a la menos. */
export function palabrasDudosas(turnos: readonly TurnoConPalabras[], umbral = UMBRAL_DUDA): PalabraOida[] {
  const out: PalabraOida[] = []
  for (const t of turnos) for (const p of t.palabras ?? []) if (esMarcable(p, umbral)) out.push(p)
  return out.sort((a, b) => a.confianza - b.confianza)
}

/**
 * La marca que ve el MODELO.
 *
 * Se eligieron corchetes matemáticos (`⟦…⟧`) y no corchetes normales porque un
 * médico dicta corchetes y paréntesis de verdad —«tensión (sistólica) de
 * ciento…»— y una marca que se confunde con el contenido no marca nada.
 */
export const ABRE = '⟦'
export const CIERRA = '?⟧'

/**
 * Reescribe un turno marcando sus palabras dudosas — SOBRE EL TEXTO CORREGIDO.
 *
 * ── LA REGRESIÓN QUE ESTO REPARA (mía, v975 → v979) ──────────────────────────
 *
 * La primera versión reconstruía el turno desde `palabras`, que vienen **CRUDAS
 * del motor**. Y `corregirUtterances` corrige `u.text`, no `u.palabras`. O sea
 * que al conectar las marcas dejé al modelo recibiendo el texto SIN corregir:
 * el médico veía «ceftriaxona» en pantalla y el modelo leía «sefriaxona».
 *
 * Es, letra por letra, el mismo defecto que `corregirUtterances` se escribió
 * para reparar — reintroducido por la puerta de al lado al añadir una mejora.
 *
 * ── CÓMO SE RESUELVE SIN PERDER NINGUNA DE LAS DOS COSAS ─────────────────────
 *
 * Se marca sobre `t.text` (el corregido, el que el médico ve). Una palabra
 * dudosa que el corrector reescribió ya no aparece con su forma cruda, así que
 * no se puede marcar en su sitio: esas se anotan **al final del turno**, para
 * que la duda no se pierda por el mismo camino por el que se perdía antes.
 *
 * Y sin `palabras` se devuelve el texto tal cual: un turno del que no se sabe
 * nada no es un turno seguro, pero inventarle marcas tampoco lo arregla.
 */
export function marcarTurno(t: TurnoConPalabras, umbral = UMBRAL_DUDA): string {
  const dudosas = (t.palabras ?? []).filter(p => esMarcable(p, umbral))
  if (!dudosas.length) return t.text

  const clave = (s: string) => limpia(s)
  const pendientes = new Map(dudosas.map(p => [clave(p.texto), p]))

  const marcado = t.text.split(/(\s+)/).map(tok => {
    if (!tok.trim()) return tok
    const k = clave(tok)
    if (!pendientes.has(k)) return tok
    pendientes.delete(k)
    return `${ABRE}${tok}${CIERRA}`
  }).join('')

  /**
   * Las que el corrector reescribió no se encuentran, y NO se tiran.
   *
   * Que el corrector cambiara una palabra de baja confianza no la vuelve
   * segura: cambió una forma que el motor no oyó bien por otra que le pareció
   * más probable. Esa duda es exactamente la que no puede desaparecer.
   */
  if (!pendientes.size) return marcado
  const sueltas = [...pendientes.values()].map(p => p.texto).join(', ')
  return `${marcado} ${ABRE}el audio tampoco entendió bien: ${sueltas}${CIERRA}`
}

/**
 * La instrucción que acompaña al texto marcado.
 *
 * Sin esto, las marcas son ruido: el modelo las vería como un formato raro y
 * seguiría razonando igual. Lo que convierte la marca en una defensa es la
 * regla, y la regla tiene que ser absoluta — «úsala con cuidado» se cumple a
 * veces, «nunca» se cumple siempre.
 */
export const INSTRUCCION_MARCAS =
  `El audio marcó así ${ABRE}palabra${CIERRA} las palabras que NO oyó con seguridad.\n` +
  'REGLAS SOBRE ESAS PALABRAS, sin excepción:\n' +
  '· Una palabra marcada NUNCA se convierte en un hecho clínico: ni en diagnóstico, ' +
  'ni en órgano, ni en fármaco, ni en dosis, ni en antecedente.\n' +
  '· No la corrijas, no la sustituyas por la palabra que te parezca más probable y ' +
  'no la interpretes: si el motor no la oyó, tú tampoco la oíste.\n' +
  '· Si una frase depende de una palabra marcada, escríbela como «no inteligible, ' +
  'confirmar» en vez de completarla.\n' +
  '· Si por culpa de una marca no puedes afirmar algo, NO afirmes lo contrario: ' +
  'ausencia de dato no es dato de ausencia.'

/** mm:ss, para que el médico pueda volver al audio sin buscar a ciegas. */
export function marcaDeTiempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export interface AvisoPalabra {
  texto: string
  momento: string
  /** 0-100, redondeado: «lo oyó al 31 %». */
  seguridad: number
}

/**
 * Cuántas palabras se le enseñan al médico.
 *
 * Una lista larga no se lee. Doce caben de un vistazo entre paciente y paciente,
 * y son las DOCE MÁS DUDOSAS —no las primeras—, que es donde está el riesgo.
 * Cuando se recortan, la pantalla dice cuántas quedaron fuera: un recorte que no
 * se ve se lee como el total, que es un fallo que este repositorio ya conoce.
 */
export const TOPE_AVISO = 12

export function paraElMedico(
  turnos: readonly TurnoConPalabras[],
  umbral = UMBRAL_DUDA,
): { palabras: AvisoPalabra[]; ocultas: number } {
  const todas = palabrasDudosas(turnos, umbral)
  return {
    palabras: todas.slice(0, TOPE_AVISO).map(p => ({
      texto: p.texto,
      momento: marcaDeTiempo(p.inicioMs),
      seguridad: Math.round(p.confianza * 100),
    })),
    ocultas: Math.max(0, todas.length - TOPE_AVISO),
  }
}

export const POR_QUE_NO_SE_CORRIGE =
  'Este módulo no adivina qué quiso decir una palabra mal oída. Buscar la ' +
  'palabra clínica más parecida a «docencia» es cómo se llega a «vesícula»: es ' +
  'el mismo fallo, cometido por nosotros y con más confianza.'

export const POR_QUE_SE_PROPAGA_LA_DUDA =
  'El motor sabía que dudaba —devuelve una confianza por palabra— y nosotros ' +
  'tirábamos ese dato al mapear la respuesta. Después de esa línea, una palabra ' +
  'de 0.31 y una de 0.99 son indistinguibles, y el modelo razona sobre las dos ' +
  'igual de seguro. La duda no se borra: se propaga.'

/**
 * ── EL MOTIVO QUE ESTABA DECLARADO Y NADIE EMITÍA ────────────────────────────
 *
 * `politica-critica.ts` declara seis motivos de confirmación. Cinco los emite el
 * pipeline. El sexto —`confianza_baja_con_termino_critico`— **no lo emitía
 * nadie**, y no por descuido: el pipeline trabaja sobre texto y **no ve las
 * confianzas por palabra**, que viven en otro objeto (`Utterance.palabras`).
 *
 * O sea que el motivo más directo de todos —«el audio dudó justo donde había una
 * dosis»— estaba escrito y era inalcanzable.
 *
 * ── QUÉ CUENTA COMO «TÉRMINO CRÍTICO» AQUÍ ───────────────────────────────────
 *
 * No se inventa un criterio clínico. Se usa el que el propio repositorio ya
 * declaró: una palabra dudosa importa si **toca una cifra o una unidad
 * canónica**. Es decir, si la duda cae dentro de una posología.
 *
 * Deliberadamente NO se intenta decidir si la palabra dudosa «es un fármaco»:
 * eso exigiría adivinar qué quiso decir una palabra que el motor no entendió, y
 * ése es exactamente el fallo que este módulo existe para impedir.
 */

/** Distancia en palabras a la que se busca la cifra o la unidad. */
export const VENTANA_CRITICA = 3

const esCifra = (t: string) => /\d/.test(t)

/**
 * ¿Alguna palabra dudosa cae dentro de una posología?
 *
 * `unidades` se recibe como parámetro para no acoplar este módulo puro a la
 * política crítica: quien llama pasa `UNIDADES_CANONICAS`.
 */
export function dudaEnZonaCritica(
  turnos: readonly TurnoConPalabras[],
  unidades: readonly string[],
  umbral = UMBRAL_DUDA,
): boolean {
  const U = new Set(unidades.map(u => u.toLowerCase()))
  for (const t of turnos) {
    const ps = t.palabras ?? []
    for (let i = 0; i < ps.length; i++) {
      if (!esMarcable(ps[i], umbral)) continue
      const desde = Math.max(0, i - VENTANA_CRITICA)
      const hasta = Math.min(ps.length - 1, i + VENTANA_CRITICA)
      for (let j = desde; j <= hasta; j++) {
        if (j === i) continue
        const tok = limpia(ps[j].texto)
        if (esCifra(tok) || U.has(tok)) return true
      }
    }
  }
  return false
}

export const POR_QUE_NO_SE_ADIVINA_SI_ES_FARMACO =
  'Decidir que una palabra dudosa «es un fármaco» exigiría adivinar qué quiso ' +
  'decir una palabra que el motor no entendió — el fallo exacto que este módulo ' +
  'existe para impedir. Se usa un criterio que no adivina: la duda importa si ' +
  'toca una cifra o una unidad, o sea si cae dentro de una posología.'
