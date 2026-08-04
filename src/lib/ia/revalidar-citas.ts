/**
 * EL ENSAMBLE PODÍA REESCRIBIR LAS CITAS, Y NADIE LAS VOLVÍA A MIRAR.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * En el motor máximo, GPT redacta su versión del mismo caso y un tercer paso
 * **fusiona** los dos borradores. La fusión pasa por el esquema (`safeParse`),
 * así que se comprueba la FORMA — pero no que las `source_quote` fusionadas
 * **sigan existiendo en la transcripción**.
 *
 * Y una cita es lo único que sostiene el sello «dictado». `procedencia.ts` lo
 * comprueba al firmar y, si la cita no aparece en el dictado, degrada el campo a
 * «ia». O sea que una cita reescrita por el sintetizador no rompía nada
 * ruidosamente: **hacía que un dato dictado dejara de parecerlo**, y el médico
 * veía más avisos de «no se pudo comprobar» sin ninguna explicación.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * Recorre la nota fusionada buscando cada `source_quote` y la contrasta con la
 * transcripción. Por CADA cita que no verifica:
 *
 * 1. Si el borrador base (Claude) tenía en ese mismo sitio una cita que **sí**
 *    verifica, se restaura ese elemento entero desde la base.
 * 2. Si no, se vacía la cita y el campo queda marcado para revisión.
 *
 * Elemento por elemento, no todo o nada: tirar la fusión completa por una cita
 * mala es el error que este repositorio ya cometió una vez con el guardián del
 * corrector, y que costó descartar veinte minutos de correcciones buenas por una
 * cifra del minuto 18.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No corrige la cita ni busca «la frase más parecida» en el dictado. Una cita es
 * una prueba: si no está, no está. Inventar la más parecida sería fabricar la
 * evidencia que justifica el dato.
 *
 * Módulo PURO.
 */
import { ABRE, CIERRA } from '@/lib/expediente/confianza-audio'

/**
 * Normaliza igual que `procedencia.ts`, que es quien juzga al firmar.
 *
 * Incluye quitar **nuestras** marcas de duda (`⟦…?⟧`): el modelo redacta leyendo
 * el diálogo marcado, así que una cita de una frase con una palabra dudosa se
 * lleva la marca dentro. Sin esto, aquí se descartaría por falsa una cita
 * buena — y encima justo en las frases donde el audio ya había dudado.
 */
export function normaliza(s: string): string {
  return (s ?? '').split(ABRE).join('').split(CIERRA).join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Citas por debajo de esto no se juzgan.
 *
 * Un fragmento de dos o tres letras aparece en cualquier transcripción por
 * casualidad: «verificarlo» daría por buena una prueba que no prueba nada.
 */
export const MIN_CITA = 8

export interface ResultadoRevalidacion<T> {
  nota: T
  /** Elementos que volvieron al borrador base porque la fusión rompió su cita. */
  restaurados: number
  /** Citas que se vaciaron: ni la fusión ni la base tenían una verificable. */
  descartadas: number
  /** Citas comprobadas en total (las que superan `MIN_CITA`). */
  revisadas: number
}

type Obj = Record<string, unknown>
const esObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)

/**
 * ¿Esta cita aparece en el dictado?
 *
 * Las cortas se dan por buenas: no se puede juzgar lo que no distingue.
 */
export function citaVerifica(cita: unknown, transcripcionNorm: string): boolean {
  const c = typeof cita === 'string' ? cita.trim() : ''
  if (!c) return true                      // sin cita no hay nada que romper
  if (c.length < MIN_CITA) return true
  if (!transcripcionNorm) return true      // sin transcripción no se juzga aquí
  return transcripcionNorm.includes(normaliza(c))
}

/**
 * Revalida las citas de `fusion` contra el dictado, apoyándose en `base`.
 *
 * `base` es el borrador que ya existía (Claude): se usa sólo para restaurar, y
 * nunca para añadir nada que la fusión no tuviera.
 */
export function revalidarCitas<T>(fusion: T, base: unknown, transcripcion: string): ResultadoRevalidacion<T> {
  const tNorm = normaliza(transcripcion ?? '')
  let restaurados = 0, descartadas = 0, revisadas = 0

  const anda = (nodo: unknown, gemelo: unknown): unknown => {
    if (Array.isArray(nodo)) {
      const g = Array.isArray(gemelo) ? gemelo : []
      return nodo.map((x, i) => anda(x, g[i]))
    }
    if (!esObj(nodo)) return nodo

    const cita = nodo.source_quote
    if (typeof cita === 'string' && cita.trim().length >= MIN_CITA && tNorm) {
      revisadas++
      if (!citaVerifica(cita, tNorm)) {
        /**
         * La fusión rompió esta cita. Si el borrador base tenía una buena en el
         * mismo sitio, ese elemento vuelve entero: es el que ya estaba
         * verificado, no una reconstrucción.
         */
        if (esObj(gemelo) && citaVerifica(gemelo.source_quote, tNorm)
          && typeof gemelo.source_quote === 'string' && gemelo.source_quote.trim()) {
          restaurados++
          return gemelo
        }
        /**
         * Nadie tiene una cita verificable. Se vacía —una cita que no está en el
         * dictado es una prueba fabricada— y se marca para revisión, en vez de
         * dejarla puesta pareciendo evidencia.
         */
        descartadas++
        return {
          ...nodo,
          source_quote: '',
          needs_review: true,
          reason: 'La cita de respaldo no aparece en la transcripción; verifica este dato.',
        }
      }
    }

    const salida: Obj = {}
    for (const [k, v] of Object.entries(nodo)) {
      salida[k] = anda(v, esObj(gemelo) ? (gemelo as Obj)[k] : undefined)
    }
    return salida
  }

  return { nota: anda(fusion, base) as T, restaurados, descartadas, revisadas }
}

export const POR_QUE_NO_SE_BUSCA_LA_FRASE_PARECIDA =
  'Una cita es una prueba: si no está en el dictado, no está. Buscar «la frase ' +
  'más parecida» sería fabricar la evidencia que justifica el dato.'

export const POR_QUE_ELEMENTO_A_ELEMENTO =
  'Tirar la fusión entera por una cita mala es el error que ya se cometió con ' +
  'el guardián del corrector: descartaba veinte minutos de correcciones buenas ' +
  'por una cifra del minuto 18.'

export const POR_QUE_IMPORTA_AUNQUE_EL_SELLO_YA_LO_VEA =
  'El sello degrada a «ia» el campo cuya cita no aparece, así que una cita ' +
  'reescrita no rompía nada ruidosamente: hacía que un dato DICTADO dejara de ' +
  'parecerlo, y el médico veía más avisos de «no se pudo comprobar» sin ninguna ' +
  'explicación.'
