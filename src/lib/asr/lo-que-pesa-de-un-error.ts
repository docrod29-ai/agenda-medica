/**
 * TR-VOZ — QUÉ PESA DE UN ERROR DE TRANSCRIPCIÓN, Y POR QUÉ NO ES UN PORCENTAJE.
 *
 * ── EL PROBLEMA CON EL WER ──────────────────────────────────────────────────
 *
 * El WER cuenta palabras y las cuenta todas igual. En una consulta de mil
 * palabras, cambiar «mg» por «mcg» es **una** palabra: sube el WER un 0,1 % y
 * multiplica la dosis por mil. Un motor con 3 % de WER y ese error dentro se lee
 * mejor que uno con 6 % y ninguno.
 *
 * ── POR QUÉ TAMPOCO SE PONDERA ──────────────────────────────────────────────
 *
 * La respuesta obvia —dar más peso a los errores graves— falla por dos sitios, y
 * el segundo es el que importa.
 *
 * El primero: **qué peso** vale un error de dosis frente a uno de lateralidad es
 * una decisión clínica. Un número inventado aquí sale luego en una diapositiva
 * como si alguien lo hubiera decidido.
 *
 * El segundo, que ya estaba escrito en `politica-critica.ts` y hay que leerlo
 * entero: *«No existe umbral de similitud que haga esa sustitución aceptable:
 * está prohibida, **no penalizada**.»* Un peso —por alto que sea— es una
 * penalización, y una penalización se compensa con volumen: bastan suficientes
 * frases buenas para que el promedio vuelva a ser bonito. Meter un error de
 * dosis dentro de una media es dejar que se compense.
 *
 * Así que aquí **no hay un número**. Hay tres cuentas separadas que no se suman,
 * y la lectura se aprueba con **cero** en dos de ellas.
 *
 * ── LA TERCERA CUENTA ES LA QUE HACE HONESTA A LA LECTURA ───────────────────
 *
 * `sin_clasificar` no es un cajón de sastre: es la cuenta de los cambios que
 * tocan un término clínico y que **este módulo no sabe clasificar**. Cuenta para
 * reprobar, exactamente igual que un crítico.
 *
 * Si no contara, el módulo tendría un incentivo perverso: cuanto menos supiera
 * reconocer, más limpio saldría todo. «No sé qué es esto» no es «esto está
 * bien» — es la regla 4 de seguridad clínica aplicada a una métrica.
 *
 * ── LO QUE SE DESCUBRIÓ AL ESCRIBIRLO: EL «NO» QUE SE CAE ───────────────────
 *
 * `sustituciones()` alinea una palabra contra una palabra y **descarta los
 * tramos desiguales** a propósito, porque aprender de un tramo ambiguo es peor
 * que no aprender. Perfecto para el bucle de aprendizaje, y ciego para esto:
 *
 * cuando el reconocedor **se come** el «no» de «no tiene alergias», eso es un
 * borrado, no una sustitución. El error más caro que puede cometer un
 * reconocedor clínico es justo el que la alineación por sustituciones no ve.
 *
 * Por eso hay dos lecturas más, sobre el TEXTO y no sobre el par de palabras:
 * las condiciones negadas (con el motor canónico, no con una lista nueva) y las
 * cifras. Las dos ven borrados; el alineador, por diseño, no.
 */
import type { LoMedido } from '@/lib/ia/contratos-de-evaluacion'
import {
  PARES_PROHIBIDOS, UNIDADES_CANONICAS, type ClaseErrorCritico,
} from './politica-critica'
import { sustituciones } from './alineacion'
import { normalizar } from './normalizacion'
import { criticosGlobales } from './lexicon'
import * as VOCABULARIO from '@/lib/expediente/medical-vocabulary'
import { FARMACOS_CRITICOS } from '@/lib/expediente/medical-dictionary'
import { contarNegacionesEnLinea, respuestaNiega } from '@/lib/expediente/negaciones'

export type PesoClinico = 'critico' | 'ordinario' | 'sin_clasificar'

export interface ErrorPesado {
  /** Lo que decía el gold. */
  readonly esperado: string
  /** Lo que se oyó. Vacío si se cayó del texto. */
  readonly oido: string
  readonly peso: PesoClinico
  readonly clase: ClaseErrorCritico | null
  /** Qué pasa si se confunden. Sale de la política, no se redacta aquí. */
  readonly consecuencia: string | null
  /** Cómo se clasificó. Sin esto, una cuenta de críticos no se puede discutir. */
  readonly porQue: string
}

export interface LecturaDeConsulta {
  readonly palabrasDelGold: number
  /** El WER de siempre, sin tocar: sigue sirviendo para lo que sirve. */
  readonly wer: number
  readonly criticos: readonly ErrorPesado[]
  readonly sinClasificar: readonly ErrorPesado[]
  readonly ordinarios: number
  /**
   * Cero críticos Y cero sin clasificar. No hay umbral de WER aquí: un WER alto
   * sin críticos es un motor que se entiende mal, no uno que es peligroso, y
   * decidir cuánto se tolera de eso es del dueño.
   */
  readonly aprobada: boolean
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const limpiar = (s: string) => sinAcentos(s).replace(/[.,;:()¿?¡!"]/g, '')
const palabras = (s: string) => String(s ?? '').trim().split(/\s+/).filter(Boolean)

/** ¿Es una cifra? Acepta el decimal con coma y con punto. */
const comoNumero = (s: string): number | null => {
  const t = limpiar(s).replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

const UNIDADES = new Set(UNIDADES_CANONICAS.map(u => sinAcentos(u)))

/**
 * QUÉ CUENTA COMO «TÉRMINO QUE PESA», Y DE DÓNDE SALE.
 *
 * ── EL DEFECTO 4, QUE TAMBIÉN SALIÓ CORRIENDO EL MÓDULO ─────────────────────
 *
 * El primer intento usaba sólo `criticosGlobales()`. Son **35 siglas de UCI**
 * —PEEP, ECMO VV, CVVHDF, MRSA— y ni un solo nombre de fármaco. Así que
 * «metformina» → «meropenem», que es una sustitución de fármaco de manual,
 * salía clasificada como **ordinaria**: dos palabras que no son cifra, ni
 * unidad, ni sigla de UCI.
 *
 * Un módulo cuyo trabajo es pesar errores clínicos y que no reconoce los
 * fármacos del consultorio no pesa nada. Y no fallaba: aprobaba.
 *
 * ── DE DÓNDE SALE AHORA, Y QUÉ QUEDA FUERA ──────────────────────────────────
 *
 * De `medical-vocabulary`, que ya existía y ya alimenta al corrector: las listas
 * de fármacos por sistema, las marcas comerciales de México, el laboratorio, la
 * imagen, los procedimientos y los patógenos. Más `FARMACOS_CRITICOS` y las
 * siglas de UCI.
 *
 * **Se dejan fuera a propósito** `WHISPER_PROMPT_MEDICO` y `WHISPER_PROMPT_UCI`:
 * no son listas de términos sino frases de prompt, y meterlas ensuciaría el
 * vocabulario con palabras corrientes.
 *
 * Un vocabulario es **vocabulario, no criterio** (seguridad clínica §5): que
 * falte un término significa que ese caso **no se vigila**, no que se dé por
 * bueno. Por eso la cuenta de términos se puede comprobar desde fuera, y por eso
 * lo que cae fuera acaba en `ordinario` y no en un aprobado explícito.
 */
const FUERA_DEL_VOCABULARIO = ['WHISPER_PROMPT_MEDICO', 'WHISPER_PROMPT_UCI'] as const

function terminosQuePesan(): string[] {
  const out: string[] = [...criticosGlobales(), ...FARMACOS_CRITICOS]
  for (const [nombre, valor] of Object.entries(VOCABULARIO)) {
    if ((FUERA_DEL_VOCABULARIO as readonly string[]).includes(nombre)) continue
    if (Array.isArray(valor) && valor.every(v => typeof v === 'string')) out.push(...valor as string[])
  }
  return out
}

let criticos: Set<string> | null = null
const esTerminoCritico = (s: string): boolean => {
  criticos ??= new Set(terminosQuePesan().map(t => limpiar(t)))
  return criticos.has(limpiar(s))
}

/** Cuántos términos vigila esta lectura. Se comprueba desde fuera, no se promete. */
export const cuantosTerminosVigila = (): number => {
  criticos ??= new Set(terminosQuePesan().map(t => limpiar(t)))
  return criticos.size
}

/** El par prohibido que casa con estas dos palabras, en cualquier dirección. */
function parProhibido(a: string, b: string) {
  const x = limpiar(a), y = limpiar(b)
  return PARES_PROHIBIDOS.find(p =>
    (sinAcentos(p.a) === x && sinAcentos(p.b) === y)
    || (sinAcentos(p.a) === y && sinAcentos(p.b) === x)) ?? null
}

/**
 * Clasifica UNA sustitución de palabra por palabra.
 *
 * El orden importa: primero lo declarado por el Dr. (los pares), luego lo
 * objetivo (las cifras y las unidades no son opinión), y sólo al final lo que no
 * se sabe. Lo que no cae en ninguna es ordinario — y para llegar ahí tiene que
 * no tocar ningún término crítico.
 */
export function pesarSustitucion(esperado: string, oido: string): ErrorPesado {
  const base = { esperado, oido }

  const par = parProhibido(esperado, oido)
  if (par) {
    return {
      ...base, peso: 'critico', clase: par.clase, consecuencia: par.consecuencia,
      porQue: `Par prohibido declarado: «${par.a}» / «${par.b}».`,
    }
  }

  const ne = comoNumero(esperado), no = comoNumero(oido)
  if (ne !== null && no !== null && ne !== no) {
    /* Un factor de diez exacto es un decimal corrido, y tiene clase propia. */
    const razon = ne === 0 || no === 0 ? 0 : Math.max(ne, no) / Math.min(ne, no)
    const decimal = razon >= 10 && Number.isInteger(Math.log10(razon))
    return {
      ...base, peso: 'critico',
      clase: decimal ? 'corrimiento_decimal' : 'cambio_dosis',
      consecuencia: decimal
        ? `La cifra se movió un factor de ${razon}.`
        : 'La cifra dictada no es la transcrita.',
      porQue: `Las dos son cifras y no coinciden: ${ne} → ${no}.`,
    }
  }

  const ue = UNIDADES.has(limpiar(esperado)), uo = UNIDADES.has(limpiar(oido))
  if (ue && uo) {
    return {
      ...base, peso: 'critico', clase: 'cambio_unidad',
      consecuencia: 'Una unidad canónica se transcribió como otra.',
      porQue: `«${esperado}» y «${oido}» son dos unidades del catálogo.`,
    }
  }

  /**
   * UNA CIFRA CONTRA UNA PALABRA no se juzga: el pipeline normaliza números
   * escritos («doce» → «12»), así que esto casi siempre es forma y no fondo. Y
   * «casi siempre» no basta para llamarlo ordinario.
   */
  if ((ne === null) !== (no === null)) {
    return {
      ...base, peso: 'sin_clasificar', clase: null, consecuencia: null,
      porQue: 'Una cifra frente a una palabra: puede ser normalización o puede ser una dosis perdida.',
    }
  }

  if (ue || uo || esTerminoCritico(esperado) || esTerminoCritico(oido)) {
    /**
     * Aquí NO se dice `sustitucion_farmaco`: decidir que dos términos críticos
     * son dos fármacos exige un catálogo, y afirmarlo sin él sería señalar de
     * más. Lo que sí se puede afirmar es que **no se puede dar por bueno**.
     */
    return {
      ...base, peso: 'sin_clasificar', clase: null, consecuencia: null,
      porQue: 'Cambió un término crítico o una unidad y no hay regla declarada que diga en qué clase cae.',
    }
  }

  return {
    ...base, peso: 'ordinario', clase: null, consecuencia: null,
    porQue: 'Ninguna de las dos es cifra, unidad ni término crítico.',
  }
}

/**
 * Distancia de edición por palabras — el WER de toda la vida.
 *
 * Se calcula aquí y no se importa de `uci/benchmark-voz` para no atar el
 * análisis de consulta al de UCI: son dos carriles y uno está en ALPHA. Es la
 * misma fórmula, y las dos tienen sus pruebas.
 */
function distanciaPorPalabras(a: readonly string[], b: readonly string[]): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const fila = [i]
    for (let j = 1; j <= b.length; j++) {
      fila[j] = a[i - 1] === b[j - 1]
        ? previa[j - 1]
        : 1 + Math.min(previa[j - 1], previa[j], fila[j - 1])
    }
    previa = fila
  }
  return previa[b.length]
}

/**
 * LAS CIFRAS QUE SE CAYERON DEL TEXTO.
 *
 * Un borrado no es una sustitución, así que el alineador no lo ve. Se comparan
 * los multiconjuntos de cifras: una cifra del gold que no está en la hipótesis
 * es una dosis, una frecuencia o un valor que no llegó.
 */
function cifrasPerdidas(gold: readonly string[], oido: readonly string[]): ErrorPesado[] {
  const quedan = oido.map(comoNumero).filter((n): n is number => n !== null)
  const out: ErrorPesado[] = []
  for (const p of gold) {
    const n = comoNumero(p)
    if (n === null) continue
    const i = quedan.indexOf(n)
    if (i >= 0) { quedan.splice(i, 1); continue }
    out.push({
      esperado: p, oido: '', peso: 'critico', clase: 'cambio_dosis',
      consecuencia: 'La cifra se dictó y no aparece en la transcripción.',
      porQue: 'Cifra presente en el gold y ausente en lo transcrito (borrado, no sustitución).',
    })
  }
  return out
}

/**
 * LAS NEGACIONES QUE SE PERDIERON O SE INVENTARON.
 *
 * ── POR QUÉ NO SE USA `condicionesNegadas` ──────────────────────────────────
 *
 * Fue el primer intento, y **falló en el caso que más importa**. Ese motor
 * responde «¿esta FRASE contiene una negación y una condición?», que no es la
 * pregunta de aquí. Con «paciente niega diabetes» → «paciente tiene diabetes»,
 * la frase transcrita sigue conteniendo un «niega» —el de la hipertensión que
 * venía después— así que las dos versiones daban la misma lista de condiciones
 * negadas y el volteo salía **aprobado**.
 *
 * Se descubrió corriéndolo antes de escribir la prueba. Reutilizar un motor
 * canónico no basta: hay que comprobar que responde a la pregunta que se le
 * hace, y no a la que él contesta.
 *
 * ── LO QUE SÍ SE COMPARA ────────────────────────────────────────────────────
 *
 * El número de marcas de negación, con la expresión canónica de
 * `expediente/negaciones` —la misma, exportada, no una copia—. Cuenta
 * apariciones, así que ve el borrado: cuando el reconocedor **se come** el «no»
 * de «no tiene alergias», el alineador por sustituciones no ve nada y esto sí.
 *
 * ── POR QUÉ EL «no» SUELTO NO ES CRÍTICO SINO SIN CLASIFICAR ────────────────
 *
 * Un negador clínico —«niega», «sin antecedente de», «descarta»— sólo aparece
 * negando algo. Un «no» suelto aparece en cualquier frase («no sé», «no, mejor
 * la otra»), y contarlo como volteo de negación fabricaría críticos falsos.
 *
 * Fabricar una negación es peor que perderla, así que el «no» suelto cae en «sin
 * clasificar» — que reprueba igual, pero no afirma lo que no consta.
 */
function negacionesPerdidas(gold: string, oido: string): ErrorPesado[] {
  const out: ErrorPesado[] = []

  const ng = contarNegacionesEnLinea(gold), no = contarNegacionesEnLinea(oido)
  if (ng !== no) {
    const seCayo = ng > no
    out.push({
      esperado: seCayo ? `${ng} negaciones clínicas` : `${ng} negaciones clínicas`,
      oido: `${no}`,
      peso: 'critico', clase: 'volteo_negacion',
      consecuencia: seCayo
        ? 'Una negación se cayó: lo que el paciente negó queda como si lo tuviera.'
        : 'Apareció una negación que no se dijo: borra un antecedente real.',
      porQue: `Marcas de negación clínica: ${ng} en el gold, ${no} en lo transcrito.`,
    })
  }

  const sueltos = (t: string) => palabras(t).filter(p => respuestaNiega(limpiar(p))).length
  const sg = sueltos(gold), so = sueltos(oido)
  if (sg !== so) {
    out.push({
      esperado: `${sg} negativos sueltos`, oido: `${so}`,
      peso: 'sin_clasificar', clase: null, consecuencia: null,
      porQue: `Cambió el número de «no»/«nunca»/«ninguna» (${sg} → ${so}), y un «no» suelto también aparece fuera de una negación clínica.`,
    })
  }

  return out
}

/**
 * Lee una consulta entera contra su gold.
 *
 * ── POR QUÉ SE CLASIFICA SOBRE EL TEXTO NORMALIZADO ─────────────────────────
 *
 * Tercer defecto que salió al correrlo antes de escribir la prueba, y el más
 * embarazoso: sobre la consulta larga del corpus sintético, cambiar
 * «microgramos» por «miligramos» **salía aprobado**.
 *
 * `PARES_PROHIBIDOS` conoce «mcg» y «mg», que son los SÍMBOLOS. Y un médico no
 * dicta símbolos: dicta «setenta y cinco microgramos». Un clasificador que sólo
 * entiende la forma escrita está ciego justo donde ocurre el dictado — que es
 * todo el dominio de este módulo.
 *
 * Se arregla pasando los dos lados por `normalizar()`, el mismo paso que el
 * pipeline ya aplica antes de que nadie lea el texto. No es una lista nueva de
 * unidades habladas: es la del pipeline, que ya existía.
 *
 * ── Y POR QUÉ EL WER SE QUEDA EN CRUDO ──────────────────────────────────────
 *
 * Porque es la cifra que se publica y con la que se compara contra otros
 * motores. Calcularlo sobre texto normalizado daría un número más bonito y ya no
 * comparable con `docs/voice/WER-MEDIDO.json`. Se separan a propósito: el WER
 * mide al reconocedor, la clasificación mide la consecuencia.
 */
export function leerConsulta(gold: string, oido: string): LecturaDeConsulta {
  const g = palabras(gold), o = palabras(oido)
  const goldN = normalizar(gold).texto
  const oidoN = normalizar(oido).texto

  const porPalabra = sustituciones(oidoN, goldN)
    .map(s => pesarSustitucion(s.corregido, s.oido))

  /**
   * Una cifra que ya se explicó como sustitución NO se cuenta otra vez como
   * perdida. «40 mg» → «400 mg» es UN error, y contarlo dos veces infla la
   * cuenta de críticos justo donde la cuenta es el resultado.
   */
  const yaExplicadas = new Set(
    porPalabra.filter(e => comoNumero(e.esperado) !== null).map(e => limpiar(e.esperado)),
  )

  const todos = [
    ...porPalabra,
    ...cifrasPerdidas(palabras(goldN), palabras(oidoN))
      .filter(e => !yaExplicadas.has(limpiar(e.esperado))),
    ...negacionesPerdidas(goldN, oidoN),
  ]

  const criticosDeLaConsulta = todos.filter(e => e.peso === 'critico')
  const sinClasificar = todos.filter(e => e.peso === 'sin_clasificar')

  return {
    palabrasDelGold: g.length,
    wer: g.length === 0 ? (o.length === 0 ? 0 : 1) : distanciaPorPalabras(g, o) / g.length,
    criticos: criticosDeLaConsulta,
    sinClasificar,
    ordinarios: todos.filter(e => e.peso === 'ordinario').length,
    aprobada: criticosDeLaConsulta.length === 0 && sinClasificar.length === 0,
  }
}

export const POR_QUE_NO_SE_PONDERA =
  'Un peso es una penalización, y una penalización se compensa con volumen: bastan '
  + 'suficientes frases buenas para que el promedio vuelva a ser bonito. La política '
  + 'del Dr. dice que estos errores están PROHIBIDOS, no penalizados, así que no '
  + 'entran en ninguna media. Se cuentan aparte y con cero se aprueba.'

export const POR_QUE_SIN_CLASIFICAR_REPRUEBA =
  'Si «no sé qué es esto» no reprobara, el módulo saldría tanto más limpio cuanto '
  + 'menos supiera reconocer. Ausencia de dato no es dato de ausencia, también en una métrica.'

/**
 * LO QUE ESTA LECTURA NO VIGILA. Declararlo es la regla 5 de seguridad clínica:
 * que falte un término significa que ese caso no se vigila, no que se dé por bueno.
 */
export const LO_QUE_NO_SE_VIGILA: readonly string[] = Object.freeze([
  'Sustitución de un fármaco por otro: exige un catálogo de fármacos para afirmarlo. Cae en «sin clasificar», que reprueba igual.',
  'Quién habló: una frase correcta atribuida al paciente en vez de al médico se lee perfecta aquí.',
  'ORDER_INTENT: «si no mejora le agregamos amoxicilina» transcrito bien es un acierto para esta lectura, y un problema para el extractor. Lo vigila `politica-critica`.',
  'Borrados y añadidos de palabras que no son cifra ni negación: el alineador sólo clasifica sustituciones limpias.',
  'El momento en que se dijo cada cosa: aquí no hay tiempo, sólo texto.',
])

/* ═══════════════════════════════════════════════════════════════════════════
   DEL MOTOR, NO DE UNA CONSULTA — REG-551.

   La lectura de arriba juzga UNA consulta. El umbral que fijó el médico (D-030) es del
   MOTOR: se decide mirando muchas consultas juntas, y las tres cuentas se
   agregan de forma distinta a propósito.

   ── POR QUÉ EL ORDINARIO SE AGREGA Y LOS CRÍTICOS SE CUENTAN ────────────────

    · **ordinario** es una TASA sobre palabras: 5 errores en 532 palabras es
      0,94 %, y eso significa lo mismo con 12 consultas que con 200. El médico
      puso el techo en 5 % —tres veces lo medido— porque esto no vigila la
      calidad de la redacción: vigila un DERRUMBE. Si el proveedor degrada el
      modelo en silencio (ya pasó: REG-167), esto sube y los críticos no.

    · **criticos** y **sinClasificar** se cuentan por CONSULTA, no por palabra.
      Meterlos en una tasa sería la penalización que `POR_QUE_NO_SE_PONDERA`
      rechaza: una tasa se diluye con volumen, y bastarían suficientes consultas
      limpias para que una dosis cambiada dejara de verse.

   ── EL TRINQUETE, Y POR QUÉ NO ES CERO ──────────────────────────────────────

   Medido el 1-sep-2026 sobre `synthetic-data/dialogos-consulta`: **1 de 12**
   consultas con un crítico. No es ruido — es un defecto real y tiene nombre:

     DLG-004. El guion dice «Van dos veces este mes» (las caídas que cuenta la
     hija). El motor se comió la frase ENTERA: se perdió la cifra y se perdió
     quién la dijo.

   El médico dueño eligió TRINQUETE en vez de rojo (D-030): la cuenta queda
   sellada en 1 y **sólo puede bajar**. Si mañana son 2, el CI se pone rojo.

   Esto NO es tolerar un error crítico: `politica-critica` sigue diciendo que esa
   sustitución está prohibida, y la consulta afectada sigue saliendo `aprobada:
   false`. Lo que el trinquete decide es qué hace el CI **mientras** ese defecto
   concreto se arregla: dejarlo rojo indefinidamente enseñaría a ignorar el rojo,
   que es el argumento con el que el propio médico descartó el 0 % en D-029.
   El defecto no se tapa: queda con nombre aquí, en el ledger y en el censo.
   ═════════════════════════════════════════════════════════════════════════ */

export interface ConsultaMedida {
  /** Lo que se dijo, según el guion. */
  readonly gold: string
  /** Lo que el motor oyó. */
  readonly oido: string
}

export interface LecturaDelMotor {
  readonly consultas: number
  readonly palabrasDelGold: number
  readonly ordinarios: number
  /** Errores ordinarios por palabra del gold. La única de las tres que es tasa. */
  readonly tasaOrdinaria: number
  /** Consultas con AL MENOS un crítico. Se cuentan, no se promedian. */
  readonly conCriticos: number
  readonly conSinClasificar: number
  /** Cada consulta, por si hay que ir a ver CUÁL falló. Un número sin el caso no se arregla. */
  readonly porConsulta: readonly LecturaDeConsulta[]
  /**
   * Lo que la compuerta del umbral necesita, con los nombres de eje del
   * contrato de `transcribir`. La compuerta vive en
   * `ia/contratos-de-evaluacion.ts` y es la MISMA que juzga la nota: un solo
   * sitio decide qué es verde.
   */
  readonly medido: LoMedido
}

/** Lee un conjunto de consultas y agrega. No mezcla lo que no se mezcla. */
export function leerElMotor(consultas: readonly ConsultaMedida[]): LecturaDelMotor {
  const porConsulta = consultas.map(c => leerConsulta(c.gold, c.oido))
  let palabras = 0, ordinarios = 0, conCriticos = 0, conSinClasificar = 0
  for (const l of porConsulta) {
    palabras += l.palabrasDelGold
    ordinarios += l.ordinarios
    if (l.criticos.length > 0) conCriticos += 1
    if (l.sinClasificar.length > 0) conSinClasificar += 1
  }
  const tasaOrdinaria = palabras > 0 ? ordinarios / palabras : 0
  return {
    consultas: porConsulta.length,
    palabrasDelGold: palabras,
    ordinarios,
    tasaOrdinaria,
    conCriticos,
    conSinClasificar,
    porConsulta,
    medido: {
      hayConjunto: porConsulta.length > 0,
      ejes: {
        ordinario: tasaOrdinaria,
        /* Cuentas, no tasas: el umbral de las dos es cero y una tasa se diluiría. */
        criticos: conCriticos,
        sinClasificar: conSinClasificar,
      },
      resolucion: {
        ordinario: palabras > 0 ? 1 / palabras : 1,
        criticos: 1,
        sinClasificar: 1,
      },
    },
  }
}

/**
 * EL DEFECTO QUE EL TRINQUETE NO TAPA.
 *
 * Un trinquete verde con un defecto dentro es exactamente cómo un problema deja
 * de mirarse. Éste queda escrito, con nombre, y su prueba lo cita.
 */
export const EL_CRITICO_QUE_SIGUE_ABIERTO =
  'DLG-004 (1-sep-2026): el guion dice «Van dos veces este mes» —las caídas que '
  + 'cuenta la hija— y el motor se comió la frase entera. Se perdió la cifra y se '
  + 'perdió quién la dijo. El trinquete de D-030 lo sella en 1 para que no suba; '
  + 'NO lo da por bueno. Sigue abierto y sigue siendo un fallo del motor.'

/** Lo que el conjunto de 12 diálogos NO mide. Declararlo es la regla 5. */
export const LO_QUE_ESTE_CONJUNTO_NO_MIDE: readonly string[] = Object.freeze([
  '532 palabras de oro: el escalón mínimo medible en el eje ordinario es 0,19 %. El 5 % sí se ejerce, pero con 12 consultas una sola mala mueve mucho la tasa.',
  'Son voces actuadas por síntesis, no pacientes. No hay ruido de consultorio, ni acento regional, ni dos personas hablando encima. Un motor puede pasar esto y fallar en la sala.',
  'El conjunto se armó para probar diarización y negación. No es una muestra representativa de las consultas del Dr.: es una colección de casos difíciles elegidos a mano.',
  'No mide latencia, ni coste, ni qué pasa cuando el proveedor se cae. Eso lo vigilan otras compuertas.',
])

