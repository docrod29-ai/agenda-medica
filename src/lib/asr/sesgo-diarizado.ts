/**
 * EL SESGO DEL MOTOR PRINCIPAL, CON EL PACIENTE QUE ESTÁ ENFRENTE.
 *
 * ── EL HALLAZGO ──────────────────────────────────────────────────────────────
 *
 * `lexicon.ts` presupuesta con cuidado los 224 tokens del prompt de Whisper y
 * gasta primero en **los fármacos y problemas de ESTE paciente**. Está bien
 * pensado y bien probado.
 *
 * Y sólo alimenta al motor de **repuesto**.
 *
 * El camino real intenta SIEMPRE la diarización primero (AssemblyAI) y sólo cae
 * a Whisper si aquélla falla. O sea que el motor que de verdad transcribe las
 * consultas recibía una lista genérica de mil términos, igual para todos los
 * pacientes del mundo, mientras el trabajo fino se quedaba en la ruta que casi
 * nunca corre.
 *
 * ── POR QUÉ ESTO IMPORTA MÁS QUE CUALQUIER CORRECCIÓN POSTERIOR ──────────────
 *
 * El sesgo de vocabulario es lo ÚNICO que cambia **lo que el motor oye**. Todo
 * lo demás —el corrector, el guardián, las marcas de confianza— trabaja sobre lo
 * que ya se oyó, y ninguna de esas etapas puede recuperar una palabra que nunca
 * llegó. Lo dice el propio código de la otra ruta y sigue siendo cierto aquí.
 *
 * ── EL FOSO ──────────────────────────────────────────────────────────────────
 *
 * Ninguno de los diez productos del mundo que se investigaron sesga el motor de
 * voz con el expediente del paciente que está enfrente. El líder del mercado ni
 * siquiera aplica su diccionario personalizado a la ruta ambiental — está
 * escrito en su documentación. Nosotros ya tenemos el dato; sólo faltaba
 * llevarlo al motor correcto.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No inventa términos, no adivina fármacos parecidos y no recorta en silencio:
 * devuelve cuántos quedaron fuera. Un tope que nadie ve se lee como «cupo todo».
 *
 * Módulo PURO.
 */

/**
 * Tope de términos que acepta el proveedor.
 *
 * Su documentación advierte además que «la capacidad real puede ser menor por la
 * tokenización interna», así que este número es el techo declarado, no una
 * garantía. Por eso el orden importa: lo que va primero es lo que seguro entra.
 */
export const TOPE_TERMINOS = 1000

/**
 * EL TECHO QUE DE VERDAD MANDA, EN CARACTERES.
 *
 * `universal-3-5-pro` admite 2 672 tokens de texto en `keyterms_prompt` — lo
 * dijo él al rechazar una petición, no la documentación. Los tokens no se pueden
 * contar de este lado sin su tokenizador, así que se presupuesta en caracteres:
 * su propia respuesta declaró 10 735 caracteres como 4 563 tokens, o sea 2,35
 * caracteres por token para vocabulario médico en español.
 *
 * 2 672 × 2,35 ≈ 6 280. Se usa 5 800 —un 8 % de margen— porque el ratio depende
 * del vocabulario de cada paciente y pasarse no recorta: tumba la petición
 * entera y deja al médico sin dictado.
 */
export const TOPE_CARACTERES = 5800

/**
 * EL TOPE NO ES UNO: DEPENDE DEL MODELO QUE SE PIDA.
 *
 * Comprobado en la documentación del proveedor (agosto 2026, página «Models»):
 *
 * · `universal-3.5-pro` — «Keyterms prompting up to **1,000** words», 18 idiomas
 *   con el español entre ellos.
 * · `universal-2` — «Keyterms prompting up to **200** words», 99 idiomas.
 *
 * Mandarle mil términos a un modelo que admite doscientos no es «un poco de
 * más»: es un recorte que decide el proveedor, por el criterio que él quiera y
 * sin decirlo. Y como el orden de nuestra lista ES la política —primero los
 * fármacos de ESTE paciente—, un recorte que no controlamos puede tirar
 * justamente la parte que más importa.
 */
export const TOPE_POR_MODELO: Readonly<Record<string, number>> = {
  /**
   * El nombre lleva GUIONES, no punto. El 4-ago-2026 el proveedor lo dijo en su
   * propio mensaje de error al retirar `speech_model`: «Use speech_models:
   * ["universal-3-5-pro", "universal-2"]». Se conserva la forma anterior
   * apuntando al mismo tope, para que un llamador que no se haya enterado no se
   * quede con el presupuesto más pequeño por una cadena de texto.
   */
  'universal-3-5-pro': 1000,
  'universal-3.5-pro': 1000,
  'universal-2': 200,
}

/** Cuántos términos caben en el modelo pedido. Desconocido → el más prudente. */
export function topeDe(modelo: string): number {
  return TOPE_POR_MODELO[modelo] ?? Math.min(...Object.values(TOPE_POR_MODELO))
}

/** Lo que se sabe del paciente y de la pantalla desde la que se dicta. */
export interface ContextoSesgo {
  /** Fármacos activos del paciente. */
  medicamentos?: readonly string[]
  /** Diagnósticos y problemas activos. */
  problemas?: readonly string[]
  /**
   * Alérgenos del expediente.
   *
   * Van casi al principio a propósito: oír mal el alérgeno de un paciente es la
   * clase de error que el cruce alergia↔fármaco no puede atrapar después,
   * porque compara contra lo que se oyó.
   */
  alergias?: readonly string[]
  /**
   * Palabras que ESTE médico ya corrigió a mano más de una vez (LEARN).
   *
   * Es la única parte del sesgo **ganada con evidencia** en vez de supuesta: el
   * motor ya demostró que las oye mal con este médico. Iban al léxico de las
   * rutas de Whisper desde la v1023 y aquí no llegaban — y ésta es la ruta que
   * de verdad transcribe la consulta.
   */
  aprendidas?: readonly string[]
  /** Términos de la especialidad o del módulo activo (UCI, consulta…). */
  especialidad?: readonly string[]
}

const limpio = (s: unknown) => String(s ?? '').trim()
const clave = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * ¿Este término sirve para sesgar?
 *
 * Las palabras de una o dos letras no sesgan nada y gastan sitio; y una frase
 * larga tampoco: el proveedor limita las frases a pocas palabras, así que una
 * frase de ocho se descarta entera del lado de allá sin decirlo.
 */
export function utilizable(t: string): boolean {
  const s = limpio(t)
  if (s.length < 4) return false
  return s.split(/\s+/).length <= 3
}

export interface SesgoCompuesto {
  /** La lista final, en orden de prioridad y sin repetidos. */
  terminos: string[]
  /** Cuántos candidatos válidos NO cupieron. Nunca se recorta en silencio. */
  descartados: number
  /** Cuántos de los términos finales son de ESTE paciente. Para poder medirlo. */
  delPaciente: number
}

/**
 * Compone la lista de sesgo. **El orden ES la política.**
 *
 * 1. Fármacos del paciente — ninguna palabra genérica vale lo que el
 *    antibiótico que se está dictando ahora mismo.
 * 2. Sus alergias — oírlas mal es un daño que no se repara después.
 * 3. Sus diagnósticos y problemas.
 * 4. Lo que este médico ya corrigió a mano (LEARN).
 * 5. Los términos de la especialidad o del módulo desde el que se dicta.
 * 6. El catálogo global, que es lo que había antes y sigue siendo el relleno.
 *
 * ── POR QUÉ LO APRENDIDO VA DESPUÉS DEL PACIENTE, Y EN EL LÉXICO VA ANTES ────
 *
 * No es una contradicción: son dos presupuestos distintos. En `lexicon.ts` caben
 * 224 tokens y lo aprendido entra primero porque es lo único ganado con
 * evidencia. Aquí caben 1 000 términos, así que el puñado de fármacos de un
 * paciente y las palabras aprendidas **entran los dos** y el orden sólo decide
 * el margen. Y en ese margen sigue mandando lo que el paciente está tomando
 * ahora mismo, por la misma razón de siempre: el sesgo es lo único que cambia lo
 * que el motor OYE, y una dosis de hoy no se recupera después.
 *
 * Dejar sitio sin usar sería tirar sesgo: cada hueco es una palabra que el
 * reconocedor no va a esperar. Por eso el global rellena hasta el tope.
 */
export function componerSesgo(ctx: ContextoSesgo, global: readonly string[], tope = TOPE_TERMINOS): SesgoCompuesto {
  const delPacienteCrudo = [
    ...(ctx.medicamentos ?? []),
    ...(ctx.alergias ?? []),
    ...(ctx.problemas ?? []),
  ]
  const candidatos = [
    ...delPacienteCrudo,
    ...(ctx.aprendidas ?? []),
    ...(ctx.especialidad ?? []),
    ...global,
  ]

  const vistos = new Set<string>()
  const unicos: string[] = []
  for (const c of candidatos) {
    const s = limpio(c)
    if (!utilizable(s)) continue
    const k = clave(s)
    if (vistos.has(k)) continue
    vistos.add(k)
    unicos.push(s)
  }

  /**
   * ── EL TOPE REAL SON TOKENS, Y HAY QUE MEDIRLO (5-ago-2026) ───────────────
   *
   * Aquí se contaban ENTRADAS, y el proveedor cuenta otra cosa. Se descubrió a
   * base de que rechazara la petición, en tres escalones:
   *
   *   1. «`word_boost` is not compatible with universal-3-5-pro» — canal
   *      equivocado (lo tapaba la lista de modelos: degradaba en vez de fallar).
   *   2. «must contain no more than 1000 WORDS» — no son entradas, son palabras.
   *   3. «Your prompt has 4563 text tokens, but the maximum allowed is 2672» —
   *      y no son palabras: son **tokens**.
   *
   * Y esto no recorta de más: **falla la petición completa**. El médico se
   * queda sin transcripción, que es lo peor que puede pasar en una consulta.
   *
   * Los tokens no se pueden contar sin el tokenizador del proveedor, así que se
   * presupuesta por CARACTERES, que sí se cuentan. La relación medida contra su
   * propia respuesta —10 735 caracteres declarados como 4 563 tokens— da 2,35
   * caracteres por token para vocabulario médico en español.
   *
   * 2 672 tokens × 2,35 ≈ 6 280 caracteres. Se deja margen: el ratio depende del
   * vocabulario de cada paciente, y pasarse no cuesta un recorte — cuesta el
   * dictado entero.
   */
  const terminos: string[] = []
  let caracteres = 0
  for (const t of unicos) {
    const n = t.length + 1   // +1 por el separador
    if (caracteres + n > TOPE_CARACTERES) continue
    if (terminos.length >= Math.max(0, tope)) break
    terminos.push(t)
    caracteres += n
  }
  const propios = new Set(delPacienteCrudo.map(x => clave(limpio(x))))
  return {
    terminos,
    descartados: Math.max(0, unicos.length - terminos.length),
    delPaciente: terminos.filter(t => propios.has(clave(t))).length,
  }
}

export const POR_QUE_EL_PACIENTE_VA_PRIMERO =
  'El sesgo de vocabulario es lo único que cambia LO QUE EL MOTOR OYE. El ' +
  'corrector, el guardián y las marcas de confianza trabajan sobre lo que ya se ' +
  'oyó, y ninguno puede recuperar una palabra que nunca llegó. Así que el sitio ' +
  'escaso se gasta primero en los fármacos y diagnósticos de este paciente.'

export const POR_QUE_ES_UN_FOSO =
  'Ninguno de los productos del mercado sesga el motor de voz con el expediente ' +
  'del paciente que está enfrente; el líder ni siquiera aplica su diccionario ' +
  'personalizado a la ruta ambiental, y lo dice en su propia documentación. ' +
  'Requiere tener el expediente y el motor en la misma mano.'
