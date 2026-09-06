/**
 * LEARN — que lo que el médico corrige a mano no se pierda.
 *
 * ── LO QUE FALTABA ───────────────────────────────────────────────────────────
 *
 * Hoy el sistema no aprende del médico. Tiene un diccionario fijo de confusiones
 * —escrito a mano, el mismo para todos— y carga el vocabulario del paciente que
 * está enfrente. Pero cuando el médico corrige «sefriaxona» → «ceftriaxona» en
 * el editor, esa corrección **se pierde**: mañana el motor comete el mismo error
 * en la misma palabra, con el mismo médico.
 *
 * Eso es lo que el Dr. pidió con «palabra por palabra, nota por nota, letra por
 * letra», y no estaba construido.
 *
 * ── DE DÓNDE SALE LA EVIDENCIA, SIN PEDIRLE NADA ────────────────────────────
 *
 * La nota ya guarda **las dos versiones** desde la v996: `transcripcionMotor`
 * —lo que el reconocedor oyó, antes de todo— y el texto de trabajo, que el
 * médico pudo editar. La diferencia entre ambas **es** la corrección. No hay que
 * pedirle que enseñe nada: ya lo hizo al escribir.
 *
 * ── LAS TRES REGLAS QUE HACEN QUE ESTO NO SEA PELIGROSO ──────────────────────
 *
 * 1. **Nada que toque una cifra, una unidad o una negación.** Se reutiliza la
 *    política crítica que ya existe —no se escribe un criterio nuevo—: si el par
 *    cae en una clase crítica o en un par prohibido (mg↔mcg, mL↔L, derecha↔
 *    izquierda…), **no se aprende**. Ni una vez, ni mil.
 * 2. **Una sola vez no enseña nada.** Un cambio puede ser un error de dedo o
 *    una frase reescrita por estilo. Hace falta verlo repetido, igual que la
 *    biblioteca de infusiones exige un acto explícito y «nunca aprender una
 *    dilución de una sola infusión».
 * 3. **Sólo sustituciones de UNA palabra por UNA palabra.** Un párrafo
 *    reescrito no es una corrección de vocabulario, y tratarlo como tal metería
 *    basura en el sesgo del reconocedor — que es lo único que decide lo que se
 *    OYE.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * No reescribe nada. Lo aprendido se usa **sólo para sesgar al reconocedor hacia
 * la palabra correcta** en la siguiente grabación: el corrector y su guardián
 * siguen decidiendo, con las mismas reglas de siempre. Aprender qué palabra dice
 * el médico no es lo mismo que darse permiso para cambiarla.
 *
 * Módulo PURO.
 */
import { distancia, sustituciones } from '@/lib/asr/alineacion'
import {
  CLASES_ERROR_CRITICO, PARES_PROHIBIDOS, UNIDADES_CANONICAS,
  esPalabraDeLateralidad, esPalabraDePolaridad, sonContrariasPorPrefijo,
} from '@/lib/asr/politica-critica'
import { redactarIdentificadores } from '@/lib/ia/minimizar-phi'

const limpia = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Una corrección observada: lo que el motor oyó y lo que el médico dejó. */
export interface ParCorregido {
  oido: string
  corregido: string
}

/**
 * Cuántas veces hay que ver la misma corrección para creérsela.
 *
 * Dos es el mínimo que distingue una costumbre de un error de dedo. Más alto
 * haría que el sistema tardara semanas en aprender una palabra que el médico usa
 * todos los días; más bajo convertiría cualquier resbalón en vocabulario.
 *
 * NO es un umbral clínico: no decide nada sobre un paciente, sólo cuándo se le
 * sugiere una palabra al reconocedor.
 */
export const MINIMO_REPETICIONES = 2

/** Longitud mínima de una palabra para considerarla. */
const MIN_LONGITUD = 4

/** ¿Es una cifra, o trae una cifra dentro? */
const tieneCifra = (s: string) => /\d/.test(s)

/** ¿Es una unidad canónica? */
const esUnidad = (s: string) => (UNIDADES_CANONICAS as readonly string[]).includes(limpia(s))

/**
 * QUIÉN ES EL PACIENTE — o el hecho de que NO SE SABE (H-19, 27-ago-2026).
 *
 * Antes esto era `readonly string[]` con valor por omisión `[]`, y una lista
 * vacía significaba «no hay nada que proteger». Pero una lista vacía significa
 * dos cosas que el código no podía distinguir:
 *
 *     a) este paciente no tiene partes de nombre utilizables
 *     b) NO SÉ quién es el paciente — no cargó, o falló la lectura
 *
 * En el caso (b) el filtro trabajaba **sin contexto de identidad** y dejaba
 * pasar apellidos enteros hacia un vocabulario COMPARTIDO POR CONSULTORIO. Y
 * ése era el caso normal, no el raro: la pantalla de consulta derivaba el
 * aprendizaje desde un closure donde el paciente todavía era `null`.
 *
 * Haciendo la ausencia **representable** el compilador obliga a decidir, y el
 * módulo puede aplicar la regla 4 de seguridad clínica —ausencia de dato no es
 * dato de ausencia— también a la identidad.
 */
export type IdentidadDelPaciente =
  | { readonly conocida: false }
  | { readonly conocida: true; readonly partes: readonly string[] }

/** No se sabe quién es el paciente. Con esto NO se aprende nada. */
export const IDENTIDAD_DESCONOCIDA: IdentidadDelPaciente = { conocida: false }

/**
 * Construye la identidad a partir del nombre del expediente.
 *
 * Un nombre vacío, ausente o hecho sólo de partículas cortas no protege a
 * nadie: eso es identidad DESCONOCIDA, no identidad vacía.
 */
export function identidadDe(nombre: string | undefined | null): IdentidadDelPaciente {
  const partes = partesDelNombre(nombre)
  return partes.length === 0 ? IDENTIDAD_DESCONOCIDA : { conocida: true, partes }
}

/**
 * Longitud mínima de una parte del nombre para bloquear por CONTENCIÓN.
 *
 * Por debajo de cinco letras, un trozo de nombre aparece dentro de palabras
 * clínicas corrientes («ana» dentro de «mañana») y bloquearlas dejaría fuera
 * vocabulario legítimo sin proteger a nadie.
 */
const IDENTIFICA_POR_CONTENCION = 5

/** Longitud mínima de una parte para bloquear por PARECIDO. */
const IDENTIFICA_POR_PARECIDO = 4

/**
 * ¿Esta palabra identifica al paciente?
 *
 * Tres formas, y las tres hacen falta:
 *
 * 1. **Igual.** Es la que ya existía, y es la única que cubría el caso fácil.
 * 2. **Contenida.** «betanc» no es igual a «Betancourt» y sigue identificando.
 *    Un fragmento de apellido en el vocabulario del consultorio es el apellido.
 * 3. **Parecida.** Es la que más importa y la que faltaba: el motor oye MAL el
 *    apellido y el médico lo corrige — justo el par que el aprendizaje quiere
 *    capturar. Ninguno de los dos lados tiene por qué coincidir letra a letra
 *    con el expediente. Se reutiliza el Levenshtein acotado de `alineacion`,
 *    el mismo que ya decide si dos palabras «se parecen».
 *
 * Se prefiere bloquear de más: no aprender una palabra cuesta una corrección
 * más; un apellido en un vocabulario compartido no se puede deshacer.
 */
function identifica(palabra: string, parte: string): boolean {
  const w = limpia(palabra).trim()
  const e = limpia(parte).trim()
  if (!w || !e) return false
  if (w === e) return true
  if (e.length >= IDENTIFICA_POR_CONTENCION && (w.includes(e) || e.includes(w))) return true
  if (e.length >= IDENTIFICA_POR_PARECIDO) {
    const tope = e.length >= 7 ? 2 : 1
    if (Math.abs(w.length - e.length) <= tope && distancia(w, e, tope) <= tope) return true
  }
  return false
}

/**
 * ¿Este par se puede aprender?
 *
 * Fail-closed: ante la duda, NO. Un vocabulario aprendido de más sesga al
 * reconocedor hacia una palabra que el médico no dijo, y eso no se ve: sale una
 * transcripción normal con un término cambiado.
 */
export function esAprendible(par: ParCorregido, identidad: IdentidadDelPaciente): boolean {
  const a = limpia(par.oido).trim()
  const b = limpia(par.corregido).trim()
  /**
   * SIN SABER QUIÉN ES EL PACIENTE NO SE APRENDE NADA.
   *
   * Ésta es la puerta, y va PRIMERO. El filtro de identidad sólo puede proteger
   * lo que conoce: si no hay identidad, no está protegiendo — está pasando
   * todo. Callar y aprender igual es exactamente el defecto H-19.
   */
  if (!identidad?.conocida) return false   // `?.` — desde JS podría llegar nada: eso también es no saber
  /**
   * NUNCA EL NOMBRE DEL PACIENTE.
   *
   * Lo aprendido se guarda **por consultorio** y sirve con todos los pacientes:
   * si un apellido dictado entrara ahí, el nombre de una persona acabaría en un
   * vocabulario compartido que ella nunca autorizó, y encima sesgando el
   * reconocedor en la consulta de otra.
   *
   * El filtro de una palabra sin cifras no lo impide —un apellido lo pasa—, así
   * que se excluye explícitamente, y no sólo por igualdad: también el fragmento
   * y el apellido mal oído (ver `identifica`).
   */
  for (const parte of identidad.partes) {
    if (identifica(a, parte) || identifica(b, parte)) return false
  }
  /**
   * NI LOS IDENTIFICADORES CON FORMA PROPIA.
   *
   * CURP, RFC, correo, teléfono, folio de expediente. Se reutiliza
   * `redactarIdentificadores`, que ya los conoce y ya está probado: no se
   * escribe un criterio nuevo. Las cifras las tapa además el filtro de abajo,
   * pero un correo sin dígitos («ana.perez@ejemplo.mx») lo pasaba entero.
   *
   * Se rechaza en vez de redactar, igual que `seguroParaMemoria`: un par al que
   * hay que tacharle un teléfono no era vocabulario clínico.
   */
  if (redactarIdentificadores(par.oido).redactados.length > 0) return false
  if (redactarIdentificadores(par.corregido).redactados.length > 0) return false
  if (!a || !b || a === b) return false
  if (a.length < MIN_LONGITUD || b.length < MIN_LONGITUD) return false
  // Una sola palabra por lado: un párrafo reescrito no es vocabulario.
  if (/\s/.test(a) || /\s/.test(b)) return false
  // Nada con cifras ni unidades: eso es dosis, y la dosis no se aprende sola.
  if (tieneCifra(a) || tieneCifra(b) || esUnidad(a) || esUnidad(b)) return false
  // Los pares prohibidos por la política crítica, en cualquier dirección.
  for (const p of PARES_PROHIBIDOS) {
    const x = limpia(p.a), y = limpia(p.b)
    if ((a === x && b === y) || (a === y && b === x)) return false
  }
  /**
   * LATERALIDAD POR LEMA, NO POR FORMA (Panel de Lujo, MO-007).
   *
   * Los pares prohibidos son «derecha↔izquierda» y «derecho↔izquierdo» tal
   * cual, así que «derecha → izquierdo», «derechas → izquierdas» o «bilateral →
   * izquierdo» pasaban. El lado del paciente no se aprende en ninguna de sus
   * formas: «derecho» ya está en la lista protegida del corrector y sesgar
   * hacia él no aporta nada; aprender el par contrario enseña a equivocarse.
   */
  if (esPalabraDeLateralidad(a) || esPalabraDeLateralidad(b)) return false
  /**
   * NEGACIÓN (Panel de Lujo, B-012). La cabecera prometía este guardián y no
   * existía: «afebril → febril» y «niega → refiere» se aprendían. Clase
   * `volteo_negacion`: ninguna palabra de polaridad, y ningún par que sea la
   * misma palabra con y sin prefijo de negación.
   */
  if (esPalabraDePolaridad(a) || esPalabraDePolaridad(b)) return false
  if (sonContrariasPorPrefijo(a, b)) return false
  return true
}

/**
 * Las sustituciones palabra-por-palabra entre lo que se oyó y lo que quedó.
 *
 * Se comparan las dos versiones alineadas por posición **sólo cuando tienen el
 * mismo número de palabras**. Si el médico añadió o quitó texto, las posiciones
 * se desplazan y cualquier «par» sería una coincidencia: se prefiere no aprender
 * nada a aprender ruido.
 */
export function paresDeUnaNota(
  oido: string,
  final: string,
  identidad: IdentidadDelPaciente,
): ParCorregido[] {
  /**
   * ── SE ALINEA DE VERDAD, NO POR POSICIÓN (5-ago-2026) ─────────────────────
   *
   * Aquí se exigía que las dos versiones tuvieran **el mismo número de
   * palabras**, y si no, se devolvía vacío. El motivo era bueno —comparando por
   * posición, una palabra añadida desplaza todas las siguientes y cada «par»
   * sería una coincidencia— pero el precio no se había medido:
   *
   *     mismo largo ....... 19,4 % de las correcciones
   *     largo distinto .... 80,6 %  ← se descartaban ENTERAS
   *
   * Cuatro de cada cinco correcciones del médico no enseñaban nada. Y de ahí se
   * alimenta el sesgo de vocabulario, que es lo único que cambia lo que el motor
   * OYE.
   *
   * `sustituciones()` usa la subsecuencia común más larga: sabe qué palabras se
   * conservaron y, entre ellas, cuál ocupó el lugar de cuál. Sólo emite el caso
   * inequívoco —una por una—, así que el criterio no se afloja: se aplica donde
   * antes ni se miraba.
   *
   * ── LO QUE NO SE PUEDE PROMETER ───────────────────────────────────────────
   *
   * Sobre el corpus del Dr. esto recupera apenas un 6 % más de pares, y los que
   * aparecen son ruido de sus filas corruptas («gramosuiada → guiada»). Ese
   * corpus **no sirve para medir esto**: compara forma hablada contra escrita
   * («cero punto cero tres» → «0.03»), que son reescrituras de varias palabras,
   * no correcciones de un médico.
   *
   * La ganancia real sólo se puede medir con notas dictadas frente a notas
   * firmadas, y eso todavía no está medido. Lo que sí se sabe es que antes se
   * tiraba el 80,6 % de las oportunidades sin mirarlas.
   */
  const out: ParCorregido[] = []
  for (const s of sustituciones(oido, final)) {
    const par = {
      oido: s.oido.replace(/[.,;:¿?¡!()]/g, ''),
      corregido: s.corregido.replace(/[.,;:¿?¡!()]/g, ''),
    }
    if (esAprendible(par, identidad)) out.push(par)
  }
  return out
}

export interface Aprendido {
  /** La palabra correcta, la que se le sugiere al reconocedor. */
  palabra: string
  /** Cuántas veces se vio la misma corrección. */
  veces: number
  /** Las formas que el motor oyó mal. Para poder explicarlo en pantalla. */
  oidoComo: string[]
}

/**
 * Junta las observaciones y devuelve lo que ya se puede creer.
 *
 * Ordenado por frecuencia: si el presupuesto del sesgo se queda corto, entra
 * primero lo que el médico corrige más.
 */
export function loAprendido(
  pares: readonly ParCorregido[],
  minimo = MINIMO_REPETICIONES,
  identidad: IdentidadDelPaciente = IDENTIDAD_DESCONOCIDA,
): Aprendido[] {
  const cuenta = new Map<string, { veces: number; oido: Set<string> }>()
  for (const p of pares) {
    if (!esAprendible(p, identidad)) continue
    const clave = p.corregido.toLowerCase()
    const e = cuenta.get(clave) ?? { veces: 0, oido: new Set<string>() }
    e.veces++; e.oido.add(p.oido.toLowerCase())
    cuenta.set(clave, e)
  }
  return [...cuenta.entries()]
    .filter(([, e]) => e.veces >= minimo)
    .map(([palabra, e]) => ({ palabra, veces: e.veces, oidoComo: [...e.oido] }))
    .sort((x, y) => y.veces - x.veces || x.palabra.localeCompare(y.palabra))
}

export const POR_QUE_NO_SE_APRENDEN_CIFRAS =
  'Se reutiliza la política crítica que ya existe, no se escribe un criterio ' +
  'nuevo: si el par toca una cifra, una unidad, una negación o un par prohibido ' +
  '(mg↔mcg, mL↔L, derecha↔izquierda…), no se aprende. Ni una vez, ni mil.'

export const POR_QUE_HACEN_FALTA_DOS =
  'Un cambio puede ser un error de dedo o una frase reescrita por estilo. Hace ' +
  'falta verlo repetido — la misma regla que la biblioteca de infusiones, que ' +
  'nunca aprende una dilución de una sola infusión.'

export const POR_QUE_SOLO_SESGA =
  'Lo aprendido sólo empuja al reconocedor hacia la palabra correcta en la ' +
  'siguiente grabación. El corrector y su guardián siguen decidiendo con las ' +
  'reglas de siempre: saber qué palabra dice el médico no es permiso para ' +
  'cambiarla.'

export const POR_QUE_NO_SE_ALINEA_SI_CAMBIA_EL_LARGO =
  'Si el médico añadió o quitó texto, las posiciones se desplazan y cualquier ' +
  '«par» sería una coincidencia. Se prefiere no aprender nada a aprender ruido: ' +
  'el sesgo es lo único que cambia lo que el motor OYE.'

/** Las clases críticas que este módulo respeta, para que el test las ate. */
export const CLASES_QUE_NUNCA_SE_APRENDEN = CLASES_ERROR_CRITICO

/**
 * Las partes de un nombre, para excluirlas del aprendizaje.
 *
 * Se parte por espacios y se quedan las de tres letras o más: «de», «la» o «y»
 * no identifican a nadie y excluirlas dejaría fuera palabras clínicas normales.
 */
export function partesDelNombre(nombre: string | undefined | null): string[] {
  return String(nombre ?? '')
    .split(/\s+/)
    .map(x => x.replace(/[.,;:]/g, '').trim())
    .filter(x => x.length >= 3)
}

export const POR_QUE_SIN_IDENTIDAD_NO_SE_APRENDE =
  'Una lista de nombres vacía no significa que el paciente no tenga identidad: ' +
  'significa que NO SE SABE cuál es. El filtro sólo protege lo que conoce, así ' +
  'que sin identidad conocida no se aprende nada — ausencia de dato no es dato ' +
  'de ausencia, también aquí. No aprender una palabra cuesta una corrección ' +
  'más; un apellido en el vocabulario del consultorio no se puede deshacer.'

export const POR_QUE_NUNCA_EL_NOMBRE =
  'Lo aprendido se guarda POR CONSULTORIO y sirve con todos los pacientes: si un ' +
  'apellido dictado entrara ahí, el nombre de una persona acabaría en un ' +
  'vocabulario compartido que ella nunca autorizó, y encima sesgando el ' +
  'reconocedor en la consulta de otra.'

/**
 * Junta dos listas de aprendido en una, sumando las repeticiones.
 *
 * El vocabulario del reconocedor no distingue de dónde salió cada término, sólo
 * cuántos caben: lo que importa es que la palabra que más se corrige quede
 * arriba, venga del expediente de este paciente o del consultorio entero.
 */
export function fusionar(...listas: readonly (readonly Aprendido[])[]): Aprendido[] {
  const m = new Map<string, Aprendido>()
  for (const lista of listas) {
    for (const a of lista ?? []) {
      const clave = a.palabra.toLowerCase()
      const y = m.get(clave)
      if (!y) { m.set(clave, { ...a, palabra: clave, oidoComo: [...a.oidoComo] }); continue }
      y.veces += a.veces
      for (const o of a.oidoComo) if (!y.oidoComo.includes(o)) y.oidoComo.push(o)
    }
  }
  return [...m.values()].sort((x, y) => y.veces - x.veces || x.palabra.localeCompare(y.palabra))
}
