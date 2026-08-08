/**
 * ¿EN QUÉ SEGUNDO SE DIJO ESTO? — REG-250.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * El panel «¿de dónde salió esto?» ya enseña, para cada frase de la nota, el
 * fragmento del dictado que la sostiene. Lo que el médico pidió es el paso
 * siguiente, y es el que tiene Abridge: **pulsar y escuchar**.
 *
 * Para eso hace falta un puente que no existía. Los segmentos del trazado llevan
 * su posición en CARACTERES (`desde`, `hasta`); el audio se busca por TIEMPO. Y
 * los tiempos viven en otro sitio: cada palabra de cada turno diarizado trae su
 * `inicioMs`.
 *
 * Este módulo traduce lo uno en lo otro: **texto → palabra → milisegundo**.
 *
 * ── POR QUÉ NO SE PUEDE HACER CON UNA REGLA DE TRES ─────────────────────────
 *
 * La tentación es repartir la duración total entre los caracteres del dictado y
 * multiplicar. No sirve, y falla justo donde importa: la gente se calla, tose,
 * repite, y el paciente habla a otra velocidad que el médico. Un desfase de tres
 * segundos deja al médico oyendo la frase equivocada — y una frase equivocada
 * con aspecto de prueba es peor que no tener prueba.
 *
 * Se busca la frase **en las palabras que el motor oyó**, y se devuelve el
 * `inicioMs` de la que de verdad la empieza.
 *
 * ── CUÁNDO DEVUELVE `null`, Y ES LO IMPORTANTE ──────────────────────────────
 *
 * Cuando no la encuentra con suficiente seguridad. No se aproxima, no se elige
 * «lo más parecido», no se cae al principio del audio. `null` significa «no sé
 * dónde se dijo esto», y eso es información honesta: la interfaz simplemente no
 * ofrece el botón de escuchar.
 *
 * El texto de la nota lo escribió un modelo y el dictado lo corrigió un
 * corrector léxico; que no siempre casen es lo esperado, no un fallo.
 *
 * Módulo PURO.
 */
import type { Utterance } from '@/hooks/useGrabacionAudio'

/** Cuántas palabras seguidas tienen que coincidir para fiarse de la posición. */
const MINIMO_PALABRAS = 3

const norm = (v: unknown) =>
  String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

export interface PalabraEnElTiempo {
  texto: string
  inicioMs: number
  /** Quién la dijo, con la etiqueta cruda del motor ('A', 'B', …). */
  speaker: string
}

/**
 * Todas las palabras del dictado, en orden, con su momento y su hablante.
 *
 * Los turnos SIN `palabras` se saltan: un turno viejo, recuperado de un borrador
 * anterior a que se guardaran los tiempos, no tiene momento — y rellenarlo con
 * cero pondría toda esa consulta al principio del audio.
 */
export function lineaDeTiempo(utterances: readonly Utterance[] | undefined): PalabraEnElTiempo[] {
  const out: PalabraEnElTiempo[] = []
  for (const u of utterances ?? []) {
    for (const p of u?.palabras ?? []) {
      const texto = norm(p?.texto)
      if (!texto) continue
      out.push({ texto, inicioMs: Number(p?.inicioMs ?? 0), speaker: String(u?.speaker ?? '') })
    }
  }
  return out
}

export interface CuandoSeDijo {
  /** Milisegundo en que empieza la frase dentro del audio. */
  inicioMs: number
  /** Quién la dijo, etiqueta cruda del motor. */
  speaker: string
  /** Cuántas palabras casaron. Sirve para decidir si merece la pena enseñarlo. */
  palabrasQueCasaron: number
}

/**
 * ¿En qué momento del audio se dijo este texto?
 *
 * Devuelve `null` si no se localiza con seguridad. **Nunca aproxima.**
 */
export function cuandoSeDijo(
  texto: unknown,
  utterances: readonly Utterance[] | undefined,
): CuandoSeDijo | null {
  const buscadas = norm(texto).split(' ').filter(Boolean)
  if (!buscadas.length) return null

  const linea = lineaDeTiempo(utterances)
  if (!linea.length) return null

  /**
   * Con una frase muy corta —«Sí.», «Correcto»— no hay material para
   * localizarla: esa misma palabra aparece diez veces en la consulta y
   * cualquiera de las diez parecería igual de buena.
   */
  const necesarias = Math.min(MINIMO_PALABRAS, buscadas.length)
  if (buscadas.length < MINIMO_PALABRAS) return null

  let mejor: { desde: number; largo: number } | null = null

  for (let i = 0; i < linea.length; i++) {
    if (linea[i].texto !== buscadas[0]) continue
    let largo = 0
    while (
      largo < buscadas.length &&
      i + largo < linea.length &&
      linea[i + largo].texto === buscadas[largo]
    ) largo++
    if (largo >= necesarias && (!mejor || largo > mejor.largo)) mejor = { desde: i, largo }
    /* Coincidencia completa: no hay nada mejor que encontrar. */
    if (largo === buscadas.length) break
  }

  if (!mejor) return null
  const p = linea[mejor.desde]
  return { inicioMs: p.inicioMs, speaker: p.speaker, palabrasQueCasaron: mejor.largo }
}

/**
 * `123456` → `2:03`. Para enseñarle al médico dónde va a caer.
 *
 * Pasada la hora se escribe `1:01:01` y no `61:01`: un pase de visita de UCI
 * dura más de una hora, y «61:01» hace parar a leerlo dos veces.
 */
export function comoReloj(ms: number): string {
  const s = Math.max(0, Math.floor(Number(ms) / 1000))
  const dd = (n: number) => String(n).padStart(2, '0')
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${dd(Math.floor((s % 3600) / 60))}:${dd(s % 60)}`
    : `${Math.floor(s / 60)}:${dd(s % 60)}`
}

export const POR_QUE_NO_UNA_REGLA_DE_TRES =
  'Repartir la duración entre los caracteres falla justo donde importa: la ' +
  'gente se calla, tose y repite, y cada uno habla a su velocidad. Tres ' +
  'segundos de desfase dejan al médico oyendo la frase equivocada.'

export const POR_QUE_NULL_ES_UNA_RESPUESTA =
  'El texto de la nota lo escribió un modelo y el dictado lo pasó un corrector: ' +
  'que no siempre casen es lo esperado. «No sé dónde se dijo esto» es honesto; ' +
  'aproximar sería una prueba falsa, y una prueba falsa es peor que ninguna.'

export const POR_QUE_TRES_PALABRAS =
  'Con «Sí» o «Correcto» no hay material: esa palabra aparece diez veces en la ' +
  'consulta y cualquiera de las diez parecería igual de buena.'
