/**
 * QUÉ CEREBRO USA ESTA NOTA — lo decide el sistema, no el médico.
 *
 * ── LA DECISIÓN DEL DUEÑO (7-sep-2026) ──────────────────────────────────────
 *
 *   «el usuario no debe ver ni elegir el tipo de inteligencia con la que vas a
 *    realizar la nota. Tú vas a elegirla de acuerdo a las necesidades y el
 *    criterio que necesites […] Si es algo muy fácil y nomás hacer la nota,
 *    utiliza el modelo más rápido, y si necesitas pensar, pues lo usas.»
 *
 * Hasta hoy la pantalla de consulta enseñaba tres botones —⚡ Rápida, ⭐ Estándar,
 * 💎 Máxima— con sus créditos y su descripción, y el médico elegía antes de cada
 * nota. Es una decisión de ingeniería disfrazada de decisión clínica: para
 * contestarla bien hay que saber qué modelo hay detrás de cada emoji, y eso no
 * es trabajo del que tiene al paciente enfrente. Además se le cobra el error en
 * los dos sentidos — de menos, una nota difícil sin razonamiento; de más, diez
 * créditos y treinta segundos para un catarro.
 *
 * ── POR QUÉ ESTO ES DETERMINISTA Y NO SE LO PREGUNTAMOS AL MODELO ────────────
 *
 * Porque para preguntárselo al modelo habría que llamarlo, y entonces ya se
 * pagó la latencia que se intentaba ahorrar. Aquí se mira el dictado —que ya
 * está— con reglas escritas, y sale la respuesta en microsegundos.
 *
 * No es un motor clínico: no decide nada del paciente, decide cuánto se piensa.
 * Equivocarse aquí NO cambia el contenido de la nota, cambia con qué se redacta;
 * por eso puede vivir en reglas de texto sin violar la regla 2 de seguridad
 * clínica, que prohíbe que un modelo calcule, no que el servidor enrute.
 *
 * ── LA ASIMETRÍA, QUE ES TODA LA POLÍTICA ───────────────────────────────────
 *
 * El punto de partida es ⭐ Estándar, no ⚡ Rápida.
 *
 *   · Se BAJA a Rápida sólo cuando el caso es demostrablemente trivial: una
 *     nota corta, de seguimiento, sin una sola señal de riesgo y con dos
 *     fármacos como mucho. Ahí la velocidad es el producto.
 *   · Se SUBE a Máxima cuando aparece una señal de complejidad.
 *   · Cuando no se sabe, se queda en Estándar.
 *
 * Es a propósito. Un vocabulario de señales es **vocabulario, no criterio**
 * (regla 5 de `clinical-safety.md`): que falte un término significa que ese
 * caso no se detecta como complejo, **no** que sea simple. Si el punto de
 * partida fuera Rápida, cada hueco del vocabulario sería una nota difícil
 * redactada con el modelo más barato y nadie se enteraría. Con el punto de
 * partida en Estándar, un hueco cuesta razonamiento de más, que es el error
 * barato.
 *
 * ── EL TECHO ES DEL PLAN, NO DEL CASO ───────────────────────────────────────
 *
 * Este módulo dice qué NECESITA el caso. Cuánto se puede gastar lo dice el
 * plan, y lo aplica `dentroDelTecho`. Un caso difícil en un plan Clínica se
 * redacta con Estándar y no con Máxima — pero eso es una decisión comercial ya
 * tomada, no una que se invente aquí.
 *
 * Módulo PURO: sin red, sin reloj, sin framework.
 */
import type { ClaveMotor } from '@/lib/planes-ia'

/** Lo que hace falta saber del caso para enrutar. Todo opcional salvo el texto. */
export interface SenalesDelCaso {
  /** El dictado tal cual. Es la única fuente obligatoria. */
  transcripcion: string
  /** Tipo de nota. Una historia clínica pesa más que un seguimiento. */
  tipo?: string
  /** Cuántos fármacos distintos lleva el caso hasta ahora, si ya se sabe. */
  farmacos?: number
  /** Cuántos diagnósticos, si ya se saben. */
  diagnosticos?: number
  /** Años cumplidos. Un lactante nunca es una nota trivial. */
  edadEnAnios?: number | null
}

/** Qué motor se eligió y por qué. El «porQué» es para la bitácora, no para la pantalla. */
export interface MotorElegido {
  clave: ClaveMotor
  /** Las señales que dispararon la decisión, en orden de aparición. */
  porQue: readonly string[]
}

/**
 * Tipos de nota que NUNCA son triviales.
 *
 * No es una opinión sobre la dificultad del paciente: es que estos documentos
 * llevan apartados que exigen razonamiento aunque el dictado sea corto —una
 * historia clínica pide diferenciales priorizados; una valoración preoperatoria,
 * riesgo; un egreso, el cierre del episodio—.
 */
const TIPOS_QUE_PIDEN_RAZONAR: readonly string[] = [
  'historia_clinica', 'primera_vez', 'ingreso', 'egreso',
  'valoracion_preoperatoria', 'valoracion_inmunocomprometido', 'evolucion_uci',
]

/**
 * SEÑALES DE COMPLEJIDAD.
 *
 * Cada entrada es un trozo de vocabulario clínico cuya presencia en el dictado
 * hace que la nota merezca razonamiento. **Declarado como manda la regla 5**:
 * esta lista NO es exhaustiva y no pretende serlo; lo que no está aquí
 * simplemente no sube el nivel, y se queda en Estándar — nunca baja a Rápida
 * por no estar.
 *
 * Se agrupan por motivo para que al leer el «porQué» de una nota se entienda la
 * decisión sin abrir el código.
 */
const SENALES: readonly { motivo: string; patron: RegExp }[] = [
  { motivo: 'antimicrobianos',
    patron: /\b(antibi[oó]tic|antifung|antivir|amoxicilin|ceftriaxon|cefepim|meropenem|ertapenem|piperacilin|tazobactam|vancomicin|linezolid|daptomicin|clindamicin|metronidazol|levofloxacin|ciprofloxacin|azitromicin|fluconazol|anfotericin|caspofungin|aciclovir|valganciclovir|oseltamivir|rifampicin|isoniazid|blee|carbapenem|mrsa|proa|cultiv|antibiogram|hemocultiv|urocultiv)/i },
  { motivo: 'anticoagulación y sangrado',
    patron: /\b(warfarin|acenocumarol|heparin|enoxaparin|rivaroxab|apixab|dabigatr|edoxab|clopidogrel|antiagregant|anticoagul|inr\b|sangrad|hemorrag)/i },
  { motivo: 'insulina y descontrol glucémico',
    patron: /\b(insulin|glargin|lispro|nph\b|cetoacidosis|hiperosmolar|hipoglucemi|hba1c|hemoglobina glucosilada)/i },
  { motivo: 'función renal o hepática comprometida',
    patron: /\b(di[aá]lisis|hemodi[aá]lisis|nefrop|insuficiencia renal|lesi[oó]n renal|creatinin|depuraci[oó]n|tfg\b|kdigo|cirrosis|child[- ]pugh|insuficiencia hep[aá]tica|encefalopat[ií]a hep)/i },
  { motivo: 'embarazo o lactancia',
    patron: /\b(embaraz|gestaci[oó]n|gestant|semanas de gestaci|lactanci|amamant|puerperi|preeclamps)/i },
  { motivo: 'oncología e inmunosupresión',
    patron: /\b(quimioterap|oncol[oó]g|c[aá]ncer|neoplas|met[aá]stasi|linfom|leucemi|mieloma|trasplant|inmunosuprim|inmunocomprom|neutropeni|rituximab|corticoide cr[oó]nic)/i },
  { motivo: 'dosis por kilo o cálculo pediátrico',
    patron: /\b(mg\s*\/\s*kg|mcg\s*\/\s*kg|por kilo|miligramos por kilo|superficie corporal)/i },
  { motivo: 'gravedad o descompensación',
    patron: /\b(sepsis|s[eé]ptic|choque|shock|uci\b|terapia intensiva|intubad|ventilaci[oó]n mec|vasopresor|noradrenalin|norepinefrin|lactato|urgenci|reanimaci[oó]n|paro card)/i },
  { motivo: 'alergia o reacción adversa a fármacos',
    patron: /\b(al[eé]rgic|alergia|anafilax|steven[s]?[- ]johnson|reacci[oó]n adversa|exantema por)/i },
  { motivo: 'diagnóstico incierto o diferencial abierto',
    patron: /\b(diferencial|no est[aá] claro|no sabemos|habr[aá] que descartar|descartar|estudiar|s[ií]ndrome de origen|fiebre de origen|no me cuadra)/i },
]

/**
 * ¿Cuántos fármacos distintos se nombran en el dictado?
 *
 * No hay que nombrarlos: basta contar las **posologías**, que es lo que de
 * verdad marca una prescripción compleja. «cada 8 horas», «cada 12 h», «cada
 * 24». Un caso con cuatro pautas distintas no es una nota trivial aunque no
 * dispare ninguna otra señal.
 */
function pautasEnElDictado(t: string): number {
  const m = t.match(/\bcada\s+\d+\s*(h|hs|hr|hrs|horas?|d[ií]as?)\b/gi)
  return m ? m.length : 0
}

/** Palabras del dictado. Es la medida más honesta de «cuánto hay que leer». */
export function palabrasDe(t: string): number {
  return String(t ?? '').trim().split(/\s+/).filter(Boolean).length
}

/**
 * Un caso es TRIVIAL sólo si lo demuestra: corto, de seguimiento, sin señales y
 * con muy poca prescripción. Cualquier duda lo saca de aquí.
 */
const TOPE_PALABRAS_TRIVIAL = 220
const TOPE_FARMACOS_TRIVIAL = 2

/**
 * Un caso es LARGO cuando ya no cabe en la cabeza de un lector de una pasada.
 * A partir de ahí conviene razonar aunque no aparezca ninguna palabra de las
 * listas: lo caro de una consulta larga es lo que se queda fuera de la nota.
 */
const PALABRAS_QUE_YA_PIDEN_RAZONAR = 900

/**
 * Elige el motor que el CASO necesita. No mira el plan: eso es `dentroDelTecho`.
 *
 * `enVivo` es el pase que corre cada quince segundos mientras se dicta y el
 * preliminar que sale al detener: ésos son siempre Rápida y no se discute —su
 * valor es aparecer pronto, y de todos modos se reescriben en el pase final.
 */
export function elegirMotorAutomatico(
  s: SenalesDelCaso,
  opciones?: { enVivo?: boolean },
): MotorElegido {
  if (opciones?.enVivo) return { clave: 'rapida', porQue: ['pase en vivo'] }

  const texto = String(s.transcripcion ?? '')
  const palabras = palabrasDe(texto)
  const porQue: string[] = []

  for (const sen of SENALES) if (sen.patron.test(texto)) porQue.push(sen.motivo)

  if (s.tipo && TIPOS_QUE_PIDEN_RAZONAR.includes(s.tipo)) porQue.push(`tipo de nota: ${s.tipo}`)
  if (palabras >= PALABRAS_QUE_YA_PIDEN_RAZONAR) porQue.push(`dictado largo (${palabras} palabras)`)
  if (typeof s.edadEnAnios === 'number' && s.edadEnAnios < 12) porQue.push('paciente pediátrico')
  const pautas = pautasEnElDictado(texto)
  const farmacos = Math.max(s.farmacos ?? 0, pautas)
  if (farmacos >= 4) porQue.push(`polifarmacia (${farmacos} pautas)`)
  if ((s.diagnosticos ?? 0) >= 3) porQue.push(`varios problemas (${s.diagnosticos})`)

  if (porQue.length > 0) return { clave: 'maxima', porQue }

  /**
   * Nada disparó. ¿Se puede DEMOSTRAR que es trivial? Sólo entonces se acelera.
   *
   * Obsérvese que la ausencia de señales no basta: hace falta además que sea
   * corto y de una modalidad de seguimiento. Un dictado de 400 palabras sin
   * ninguna palabra de las listas puede ser perfectamente un caso difícil
   * contado con otras palabras — el vocabulario no es criterio.
   */
  const esSeguimiento = s.tipo === 'seguimiento' || s.tipo === 'evolucion'
  const trivial = esSeguimiento
    && palabras > 0 && palabras <= TOPE_PALABRAS_TRIVIAL
    && farmacos <= TOPE_FARMACOS_TRIVIAL
    && (s.diagnosticos ?? 0) <= 1
  if (trivial) return { clave: 'rapida', porQue: ['seguimiento corto sin señales de complejidad'] }

  return { clave: 'estandar', porQue: ['sin señales; nota de complejidad media'] }
}

/** Orden de menor a mayor. Sirve para comparar sin repetir la escala. */
const ESCALA: readonly ClaveMotor[] = ['rapida', 'estandar', 'maxima']

/**
 * Baja la elección hasta lo que el plan permite. Nunca la sube.
 *
 * Subirla sería gastarle al consultorio créditos que no eligió; bajarla es lo
 * que su plan ya dice. Y el suelo siempre existe: con cualquier techo, la nota
 * se genera.
 */
export function dentroDelTecho(elegido: ClaveMotor, techo: ClaveMotor): ClaveMotor {
  const i = ESCALA.indexOf(elegido)
  const t = ESCALA.indexOf(techo)
  if (i === -1 || t === -1) return elegido
  return i <= t ? elegido : techo
}

export const POR_QUE_EL_MEDICO_YA_NO_ELIGE =
  'Decisión del dueño, 7-sep-2026: elegir entre ⚡/⭐/💎 exige saber qué modelo '
  + 'hay detrás de cada emoji, y eso no es trabajo del que tiene al paciente '
  + 'enfrente. El servidor lo enruta con el dictado delante.'

export const POR_QUE_EL_PUNTO_DE_PARTIDA_ES_ESTANDAR =
  'Porque el vocabulario de señales es vocabulario, no criterio (regla 5). Con '
  + 'el punto de partida en Rápida, cada hueco del vocabulario sería una nota '
  + 'difícil redactada con el modelo más barato y en silencio. Con el punto de '
  + 'partida en Estándar, un hueco cuesta razonamiento de más — el error barato.'

export const LO_QUE_ESTE_MODULO_NO_VIGILA: readonly string[] = [
  'La dificultad real del paciente. Mide el DICTADO, que es lo único que hay antes de llamar al modelo: una consulta difícil contada en pocas palabras se enruta como media.',
  'Si el modelo elegido rinde como se espera. Eso es `que-modelo-se-eligio.ts` y los contratos de evaluación.',
  'El copiloto de UCI, el consultor de evidencia y la transcripción: cada uno elige su modelo por su cuenta, igual que antes.',
]
