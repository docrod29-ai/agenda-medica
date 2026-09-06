/**
 * ¿DE QUIÉN ES ESTE DICTADO? — la compuerta de sujeto para la consulta.
 *
 * ── EL HUECO (Panel de Lujo, B-013, P2 confirmado; decisión PL-C17) ──────────
 *
 * Un laboratorio no se archiva por tener un expediente abierto: hay una
 * compuerta (`laboratorio/sujeto.ts`) que compara el nombre de la hoja con el
 * del expediente y pregunta. Un DICTADO sí se archivaba: si el médico tenía
 * abierto el expediente de A y dictaba la consulta de B, la transcripción, la
 * nota, la receta y los estudios quedaban bajo A sin una sola comprobación.
 *
 * El material para hacerla ya existía —`identidadDe` e `identifica` saben
 * reconocer un apellido aunque el motor lo haya oído mal— pero se usaba SÓLO
 * para filtrar el aprendizaje.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Se PREGUNTA, no se bloquea ni se adivina (clinical-safety §6; PL-C17:
 * «preguntar, igual que el laboratorio»). El motivo se declara en
 * `politica-critica.ts` (`paciente_nombrado_no_coincide`) y viaja por el mismo
 * canal que las demás ambigüedades del dictado.
 *
 * ── ES UNA RED, NO UNA GARANTÍA ──────────────────────────────────────────────
 *
 * La mayoría de las consultas no dicen el apellido en voz alta. Que el dictado
 * no nombre a nadie NO prueba que sea el paciente correcto: `sin_nombre` es
 * exactamente eso, y así se llama. Ausencia de nombre no es prueba de identidad.
 *
 * Dos señales, y las dos preguntan:
 *  (a) El dictado identifica a OTRO paciente conocido (la agenda del día, los
 *      atendidos recientes) con al menos dos partes de su nombre —o una parte
 *      larga y exacta— que NO comparte con el paciente abierto.
 *  (b) Tras una muletilla de presentación («paciente», «señora», «don»…) vienen
 *      dos palabras con forma de nombre que no identifican al abierto, y el
 *      abierto no aparece en ninguna parte del dictado.
 *
 * ── PRIVACIDAD ───────────────────────────────────────────────────────────────
 *
 * Lo que se oyó se devuelve para ENSEÑÁRSELO al médico en la pregunta; no se
 * persiste. Los nombres de los otros candidatos entran y salen de esta función
 * y no se guardan en ningún sitio nuevo.
 *
 * Módulo PURO.
 */
import { identidadDe, identifica, type IdentidadDelPaciente } from '@/lib/asr/aprendizaje'

const limpia = (s: string) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Un paciente que NO es el abierto y que el sistema conoce (agenda, recientes). */
export interface OtroPaciente {
  nombre: string
  /** Para que la pantalla pueda ofrecer «abrir su expediente». Opcional. */
  patientId?: string
}

export type VeredictoSujetoDelDictado = 'coincide' | 'nombra_a_otro' | 'sin_nombre'

export interface DictamenSujetoDelDictado {
  veredicto: VeredictoSujetoDelDictado
  /** Sólo cuando hay que preguntar. Es el motivo de `politica-critica.ts`. */
  motivo?: 'paciente_nombrado_no_coincide'
  requiereConfirmacion: boolean
  /** Lo que se oyó que identifica a otra persona. Para la pregunta; NO se persiste. */
  nombrado?: string
  /** El otro paciente conocido al que apunta, si lo hay. */
  otro?: OtroPaciente
  /** En español llano, para pintarlo tal cual. */
  texto: string
}

/** Muletillas tras las que suele venir el nombre del paciente en un dictado. */
const MULETILLAS = /\b(paciente|senor|senora|senorita|don|dona|nino|nina|joven|el caso de)\s+/g

/**
 * Palabras que siguen a «paciente …» y NO son un nombre. Es vocabulario de
 * exclusión: lo que no esté aquí y tenga forma de nombre puede preguntar de más,
 * que es el lado seguro.
 */
const NO_ES_NOMBRE = new Set([
  'masculino', 'femenino', 'masculina', 'femenina', 'hombre', 'mujer', 'adulto', 'adulta',
  'mayor', 'joven', 'anciano', 'anciana', 'embarazada', 'lactante', 'escolar', 'adolescente',
  'que', 'quien', 'con', 'sin', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en', 'por',
  'acude', 'viene', 'llega', 'refiere', 'presenta', 'niega', 'tiene', 'trae', 'consulta',
  'diabetico', 'diabetica', 'hipertenso', 'hipertensa', 'conocido', 'conocida', 'portador', 'portadora',
  'previamente', 'actualmente', 'hoy', 'ayer', 'anos', 'edad', 'sexo', 'peso', 'talla',
])

const palabrasDe = (texto: string): string[] =>
  limpia(texto).replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)

/** Partes del nombre con las que vale la pena comparar (las cortas no identifican). */
const partesUtiles = (id: IdentidadDelPaciente): string[] =>
  id.conocida ? id.partes.filter(p => limpia(p).length >= 4) : []

/** ¿Alguna palabra del dictado identifica esta parte? */
const apareceParte = (palabras: readonly string[], parte: string): boolean =>
  palabras.some(w => identifica(w, parte))

/** Cuántas partes distintas de esta identidad aparecen en el dictado. */
function partesQueAparecen(palabras: readonly string[], id: IdentidadDelPaciente, excluir: readonly string[]): string[] {
  const ex = new Set(excluir.map(limpia))
  return partesUtiles(id).filter(p => !ex.has(limpia(p)) && apareceParte(palabras, p))
}

/**
 * ¿Este dictado es del paciente que está abierto?
 *
 * @param transcripcion  lo que oyó el reconocedor (crudo o de trabajo).
 * @param abierto        identidad del paciente cuyo expediente está abierto.
 * @param otros          otros pacientes que el sistema conoce hoy (agenda, recientes).
 */
export function dictaminarSujetoDelDictado(
  transcripcion: string,
  abierto: IdentidadDelPaciente,
  otros: readonly OtroPaciente[] = [],
): DictamenSujetoDelDictado {
  const palabras = palabrasDe(transcripcion)
  const partesAbierto = partesUtiles(abierto)
  const abiertoAparece = partesAbierto.some(p => apareceParte(palabras, p))

  // (a) Otro paciente conocido, nombrado con dos partes que no son del abierto.
  for (const otro of otros) {
    const id = identidadDe(otro.nombre)
    const propias = partesQueAparecen(palabras, id, partesAbierto)
    const fuerte = propias.length >= 2 || propias.some(p => limpia(p).length >= 7 && palabras.includes(limpia(p)))
    if (fuerte) {
      const nombrado = propias.join(' ')
      return {
        veredicto: 'nombra_a_otro', motivo: 'paciente_nombrado_no_coincide', requiereConfirmacion: true,
        nombrado, otro,
        texto: abiertoAparece
          ? `El dictado nombra a «${nombrado}» además del paciente abierto. Confirma de quién es esta consulta antes de guardarla.`
          : `El dictado nombra a «${nombrado}», que no es el paciente del expediente abierto. Confirma de quién es esta consulta antes de guardarla.`,
      }
    }
  }

  // (b) «paciente Fulano Mengano» sin que el abierto aparezca en todo el dictado.
  if (!abiertoAparece && abierto.conocida) {
    const texto = limpia(transcripcion).replace(/[^a-z\s]/g, ' ')
    let m: RegExpExecArray | null
    const re = new RegExp(MULETILLAS.source, 'g')
    while ((m = re.exec(texto)) !== null) {
      const siguientes = texto.slice(m.index + m[0].length).split(/\s+/).filter(Boolean).slice(0, 3)
      const conFormaDeNombre = siguientes.filter(w => w.length >= 3 && !NO_ES_NOMBRE.has(w))
      // Dos palabras seguidas con forma de nombre, y ninguna identifica al abierto.
      if (conFormaDeNombre.length >= 2 && siguientes.slice(0, 2).every(w => w.length >= 3 && !NO_ES_NOMBRE.has(w))
        && !conFormaDeNombre.some(w => partesAbierto.some(p => identifica(w, p)))) {
        const nombrado = siguientes.slice(0, 2).join(' ')
        return {
          veredicto: 'nombra_a_otro', motivo: 'paciente_nombrado_no_coincide', requiereConfirmacion: true, nombrado,
          texto: `El dictado dice «${m[0].trim()} ${nombrado}» y ese nombre no es el del expediente abierto. Confirma de quién es esta consulta antes de guardarla.`,
        }
      }
    }
  }

  if (abiertoAparece) {
    return { veredicto: 'coincide', requiereConfirmacion: false, texto: 'El dictado nombra al paciente del expediente abierto.' }
  }
  return {
    veredicto: 'sin_nombre', requiereConfirmacion: false,
    texto: 'El dictado no nombra a nadie: que no nombre a otro no prueba que sea de este paciente.',
  }
}

export const POR_QUE_ES_UNA_RED =
  'La mayoría de las consultas no dicen el apellido en voz alta. Esta compuerta ' +
  'sólo puede señalar cuando el dictado NOMBRA a otro; que no nombre a nadie no ' +
  'prueba que sea el paciente correcto. Ausencia de nombre no es dato de identidad.'
