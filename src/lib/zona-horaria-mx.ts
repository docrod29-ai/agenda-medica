/**
 * ZONA HORARIA DEL CONSULTORIO, ADIVINADA BIEN — sin preguntarle nada al médico.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * `DEFAULT_CONFIG.zonaHoraria` nace en `America/Chihuahua` para TODOS. Es la del
 * dueño, no la del que se acaba de dar de alta. Un médico en Ciudad de México
 * abre la app y su agenda va **una hora corrida**, en silencio: las citas se
 * pintan mal, los recordatorios salen a deshora y el corte de caja parte el día
 * donde no es. Nada falla de forma visible; simplemente todo está mal.
 *
 * ── POR QUÉ NO SE PREGUNTA ───────────────────────────────────────────────────
 *
 * Porque el navegador ya lo sabe. Poner una pantalla más en el alta para que el
 * médico elija de una lista de cinco es fricción pura, y la fricción en el alta
 * es la que hace que no vuelva. Se adivina, se acierta casi siempre, y queda
 * editable en Configuración para el caso raro.
 *
 * ── POR QUÉ NO SE ACEPTA LO QUE DIGA EL NAVEGADOR, SIN MÁS ───────────────────
 *
 * Porque el resto del sistema —agenda, recordatorios, corte de caja, PDF— asume
 * una de las zonas de México. Un `Europe/Madrid` de alguien con el portátil mal
 * configurado, o un `UTC` de un navegador endurecido, se propagaría a todos esos
 * cálculos. Se acepta sólo lo conocido; lo demás cae al valor más probable.
 */

/**
 * Las zonas que el consultorio sabe manejar — las mismas cinco que ofrece
 * Configuración. Una lista sola, para que la pantalla y esta función no puedan
 * discrepar.
 */
export const ZONAS_MX = [
  'America/Mexico_City',
  'America/Chihuahua',
  'America/Monterrey',
  'America/Hermosillo',
  'America/Tijuana',
] as const

export type ZonaMX = typeof ZONAS_MX[number]

/**
 * A dónde caer cuando no se reconoce la zona.
 *
 * Ciudad de México y no Chihuahua: es la zona de la mayor parte del país, así
 * que en el peor caso el error afecta a menos gente. El valor anterior era la
 * zona del dueño, que es una razón para él y ninguna para nadie más.
 */
export const ZONA_POR_DEFECTO: ZonaMX = 'America/Mexico_City'

/** Zonas que significan lo mismo que una de las cinco, con otro nombre. */
const EQUIVALENTES: Record<string, ZonaMX> = {
  // La IANA fusionó varias zonas mexicanas en 2022; los navegadores viejos
  // todavía devuelven los nombres retirados y siguen siendo correctos.
  'America/Ciudad_Juarez': 'America/Chihuahua',
  'America/Ojinaga': 'America/Chihuahua',
  'America/Matamoros': 'America/Monterrey',
  'America/Mazatlan': 'America/Hermosillo',
  'America/Bahia_Banderas': 'America/Mexico_City',
  'America/Merida': 'America/Mexico_City',
  'America/Cancun': 'America/Mexico_City',   // UTC-5 fijo; se avisa aparte
  'Mexico/General': 'America/Mexico_City',
  'Mexico/BajaNorte': 'America/Tijuana',
  'Mexico/BajaSur': 'America/Hermosillo',
}

/**
 * Normaliza lo que reporte el navegador a una zona que el sistema sabe manejar.
 * Nunca lanza y siempre devuelve algo utilizable.
 */
export function zonaMXDe(zonaDelNavegador?: string | null): ZonaMX {
  const z = (zonaDelNavegador ?? '').trim()
  if (!z) return ZONA_POR_DEFECTO
  if ((ZONAS_MX as readonly string[]).includes(z)) return z as ZonaMX
  return EQUIVALENTES[z] ?? ZONA_POR_DEFECTO
}

/** ¿Se reconoció de verdad, o se cayó al valor por defecto? */
export function seReconocio(zonaDelNavegador?: string | null): boolean {
  const z = (zonaDelNavegador ?? '').trim()
  if (!z) return false
  return (ZONAS_MX as readonly string[]).includes(z) || z in EQUIVALENTES
}

/** Lo que el navegador cree que es su zona. Devuelve '' si no se puede saber. */
export function zonaDelNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    return ''
  }
}

export const POR_QUE_SE_ADIVINA_Y_NO_SE_PREGUNTA =
  'Porque el navegador ya lo sabe y una pantalla más en el alta es fricción que ' +
  'cuesta médicos. El valor anterior era la zona del dueño para todo el mundo, ' +
  'así que un médico en CDMX tenía la agenda corrida una hora sin que nada ' +
  'fallara de forma visible.'
