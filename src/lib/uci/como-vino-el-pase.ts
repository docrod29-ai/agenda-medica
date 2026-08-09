/**
 * ¿EL PASE VINO POR APARATOS, O COMO UN BLOQUE? — REG-264.
 *
 * ── EL HUECO 2 DE LA INVESTIGACIÓN DE MERCADO ───────────────────────────────
 *
 * De la comparación con Suki, Nabla, Abridge y DAX salió un hueco que ninguno
 * cubre: **la UCI**. Todo el sector asume una conversación ambulatoria de dos
 * partes como fuente de verdad. El npj Digital Medicine lo dice sin adornos —
 * un solo dispositivo de grabación, incapaz de distinguir hablantes *aun en
 * ambiente silencioso*, y con «alarms, code announcements» listados como causa
 * de falla, que es la descripción literal de una UCI.
 *
 * Y hay un problema anterior: **en UCI no hay conversación con el paciente**.
 * El pase de visita es un MONÓLOGO del intensivista, recorriendo aparatos y
 * sistemas. Por eso el *Linked Evidence* de Abridge —su mejor defensa contra la
 * alucinación— no aplica: necesita un enunciado de alguien al cual enlazar.
 *
 * El dato que lo remata: en los 2,5 millones de usos de Kaiser, **infectología,
 * gineco y urología fueron las que MENOS lo usaron**. La especialidad del
 * médico dueño está, medida y publicada, entre las peor servidas.
 *
 * ── LO QUE YA EXISTÍA, Y LO QUE FALTABA ─────────────────────────────────────
 *
 * `repartirPorSistemas()` ya corre: reparte el pase por los encabezados que el
 * propio médico dictó —«neurológico», «respiratorio», «hemodinámico»…— y lo que
 * no cae bajo ninguno se queda en el plan, **sin adivinar**.
 *
 * Lo que faltaba es la otra mitad: **decirle si su dictado traía esa
 * estructura**. `tuvoEstructura()` existía para eso y no la llamaba nadie.
 *
 * Sin ese aviso, un pase dictado de corrido cae **entero** en el plan, la nota
 * sale con los aparatos vacíos, y el médico se entera al releerla — o no se
 * entera.
 *
 * ── POR QUÉ ESTO NO ES UN REGAÑO ────────────────────────────────────────────
 *
 * No se le dice «lo hiciste mal». Se le dice **qué aparatos quedaron sin texto
 * propio y dónde fue a parar lo que dictó**. Dictar de corrido es legítimo: lo
 * que no es legítimo es que el sistema lo sepa y se lo calle.
 *
 * Y no se reparte por su cuenta: adivinar a qué aparato pertenece una frase es
 * criterio clínico. Se señala; reparte él.
 *
 * Módulo PURO.
 */
import { repartirPorSistemas, tuvoEstructura, type ClaveSistema, type RepartoSistemas } from '@/lib/uci/reparto-sistemas'

/** Cómo se dictó el pase. */
export type FormaDelPase =
  /** Trae encabezados por aparato: cada sistema con su texto. */
  | 'por_aparatos'
  /** Vino de corrido: todo cayó en el plan. */
  | 'de_corrido'
  /** No hay texto que juzgar. */
  | 'sin_dictado'

export interface ComoVinoElPase {
  forma: FormaDelPase
  /** Aparatos que SÍ recibieron texto propio. */
  conTexto: ClaveSistema[]
  /** Cuántos caracteres acabaron en el plan por no tener encabezado. */
  enElPlan: number
  /** Lo que se le enseña al médico. `null` si no hay nada que decir. */
  mensaje: string | null
}

/**
 * Los aparatos, con el nombre que usa el intensivista al dictar.
 *
 * Las claves son las de `ClaveSistema` y **no se inventan aquí**: si el reparto
 * añade un sistema y este mapa no se entera, el aviso diría que falta un
 * aparato que ya no existe. Hay un caso que lo comprueba.
 */
const NOMBRE: Record<Exclude<ClaveSistema, 'plan'>, string> = {
  neurologico: 'neurológico',
  respiratorio: 'respiratorio',
  hemodinamico: 'hemodinámico',
  abdominodigestivo: 'abdominodigestivo',
  hidrometabolico: 'hidrometabólico',
  hematoinfeccioso: 'hematoinfeccioso',
  musculoesqueletico: 'musculoesquelético',
}

/**
 * Mira un pase ya repartido y dice cómo vino.
 *
 * Se le pasa el reparto —no el texto— para que no haya dos formas de partir el
 * mismo pase: `repartirPorSistemas` es la única, y ésta sólo lo interpreta.
 */
export function comoVinoElPase(reparto: RepartoSistemas | null | undefined): ComoVinoElPase {
  if (!reparto) return { forma: 'sin_dictado', conTexto: [], enElPlan: 0, mensaje: null }

  const claves = Object.keys(reparto) as ClaveSistema[]
  const conTexto = claves.filter(k => k !== 'plan' && (reparto[k] ?? '').trim().length > 0)
  const enElPlan = (reparto.plan ?? '').trim().length

  if (!conTexto.length && enElPlan === 0) {
    return { forma: 'sin_dictado', conTexto: [], enElPlan: 0, mensaje: null }
  }

  if (tuvoEstructura(reparto)) {
    /**
     * Con estructura no se dice nada: el sistema funcionó. Un aviso que sale
     * también cuando todo está bien es ruido — la lección de REG-245.
     */
    return { forma: 'por_aparatos', conTexto, enElPlan, mensaje: null }
  }

  return {
    forma: 'de_corrido',
    conTexto,
    enElPlan,
    mensaje:
      'El pase vino de corrido: no se reconoció ningún encabezado por aparato, ' +
      'así que todo lo dictado quedó en el plan y las secciones por sistema ' +
      'salen con lo del panel únicamente. ' +
      'Si dices «neurológico…», «respiratorio…», «hemodinámico…» al pasar de uno ' +
      'a otro, cada aparato se lleva su texto. Repartirlo por ti sería adivinar ' +
      'a qué sistema pertenece cada frase.',
  }
}

/** Atajo para quien tiene el texto y no el reparto. */
export function comoVinoElPaseDeTexto(texto: string): ComoVinoElPase {
  const t = String(texto ?? '').trim()
  if (!t) return { forma: 'sin_dictado', conTexto: [], enElPlan: 0, mensaje: null }
  return comoVinoElPase(repartirPorSistemas(t))
}

/** Los aparatos que quedaron SIN texto propio, con su nombre en español. */
export function aparatosSinTexto(r: ComoVinoElPase): string[] {
  if (r.forma !== 'por_aparatos') return []
  const con = new Set(r.conTexto)
  return (Object.keys(NOMBRE) as Exclude<ClaveSistema, 'plan'>[])
    .filter(k => !con.has(k))
    .map(k => NOMBRE[k])
}

export const POR_QUE_NO_SE_REPARTE_SOLO =
  'Adivinar a qué aparato pertenece una frase es criterio clínico. El motor ya ' +
  'reparte por los encabezados que el médico dictó; lo que no cae bajo ninguno ' +
  'se queda en el plan, sin inventar.'

export const POR_QUE_NO_ES_UN_REGAÑO =
  'Dictar de corrido es legítimo. Lo que no es legítimo es que el sistema sepa ' +
  'que los aparatos quedaron vacíos y se lo calle.'

export const POR_QUE_CALLA_CUANDO_TODO_VA_BIEN =
  'Un aviso que sale también cuando el pase vino bien estructurado es ruido, y ' +
  'el ruido se aprende a ignorar — incluido el que sí importa.'

export const EL_HUECO_DE_MERCADO =
  'Ningún producto de referencia cubre la UCI: todos asumen conversación ' +
  'ambulatoria de dos partes. En UCI no hay conversación con el paciente, así ' +
  'que el Linked Evidence de Abridge —enlazar a un enunciado— no aplica. En ' +
  'Kaiser (2,5 M de usos) infectología fue de las que MENOS lo usó.'
