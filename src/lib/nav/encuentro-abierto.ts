/**
 * ¿HAY UN ENCUENTRO ABIERTO? — RTC-08.
 *
 * ── DE DÓNDE SALE ESTE MÓDULO ────────────────────────────────────────────────
 *
 * RTC-08 del registro canónico: el destino **Encuentro** del `FlowRail` no era
 * un lugar. Sin una consulta abierta apuntaba a `/pacientes`, y al llegar se
 * iluminaba **Paciente** — o sea: el riel prometía un sitio, te llevaba a otro,
 * y encima marcaba el otro como si fuera el que pediste. Falla la pregunta de
 * §15 («¿dónde estoy y a dónde puedo ir?») en su PRIMER uso, que es justo
 * cuando el médico está aprendiendo a confiar en la barra.
 *
 * El `FlowRail` lo llevaba escrito en su cabecera desde V15-IA-001: «no existe
 * todavía un concepto de encuentro activo fuera de una ruta /consulta/[id]
 * concreta — no hay que inventarlo aquí». Tenía razón entonces. Hoy ya no hace
 * falta inventar nada: el producto lleva desde antes de V15 guardando un
 * respaldo local por consulta en curso, y ESO es un encuentro abierto.
 *
 * ── POR QUÉ EL RESPALDO LOCAL Y NO UNA CONSULTA A FIRESTORE ──────────────────
 *
 * Porque un encuentro abierto es, por definición, **algo que este médico está
 * haciendo en ESTE dispositivo ahora**. El borrador local es exactamente esa
 * cosa: se escribe mientras se dicta, se purga al cerrar sesión, y su razón de
 * existir es que una consulta interrumpida se pueda retomar. Preguntarle al
 * servidor «¿qué notas en borrador hay en la clínica?» contestaría otra
 * pregunta —cuáles quedaron a medias, quizá de otro día o de otro equipo— que
 * es trabajo pendiente, no el encuentro en curso. Y costaría una consulta
 * nueva, con su colección, su regla y su respaldo, para un dato que ya está
 * a mano.
 *
 * ── LO QUE ESTE MÓDULO SACA, Y LO QUE NO ────────────────────────────────────
 *
 * Sale: `patientId`, `internamientoId` y el sello de tiempo. **No sale ni un
 * dato clínico.** El respaldo está ofuscado y aquí se desofusca únicamente
 * para leer `ts`; el resto del objeto se descarta en la misma línea en que se
 * obtiene. La barra de navegación no es sitio para PHI, y un módulo que
 * devuelve «el paciente y la hora» no puede filtrar lo que nunca sostiene.
 *
 * Si el respaldo no se puede desofuscar (uid distinto, dato corrupto, versión
 * vieja), el encuentro **sigue contando**: la clave existe, así que hay algo
 * abierto. Sólo se pierde el orden entre varios, y para eso hay un desempate
 * declarado abajo. Preferir «no hay nada» ante la duda escondería una consulta
 * a medio escribir, que es el caso que más duele.
 */
import { PREFIJO_BORRADOR } from '@/lib/mobile/local-drafts'
import { desofuscar, secretoLocal } from '@/lib/seguridad/ofuscar-local'

export interface EncuentroAbierto {
  patientId: string
  /** Episodio hospitalario, cuando la consulta cuelga de un internamiento. */
  internamientoId?: string
  /**
   * Último autoguardado, en ms. `0` cuando el respaldo no se pudo leer — el
   * encuentro cuenta igual, sólo pierde prioridad en el desempate.
   */
  ts: number
}

/** La ruta que RETOMA ese encuentro, con su episodio si lo tiene. */
export function rutaDelEncuentro(e: EncuentroAbierto): string {
  return e.internamientoId
    ? `/consulta/${e.patientId}?internamiento=${encodeURIComponent(e.internamientoId)}`
    : `/consulta/${e.patientId}`
}

/**
 * De `nx.consulta.bkp.<paciente>` o `nx.consulta.bkp.<paciente>.h.<episodio>`
 * a sus partes. Devuelve `null` si la clave no tiene esa forma — una clave
 * ajena no puede convertirse en un destino de navegación.
 */
export function partesDeLaClave(clave: string): { patientId: string; internamientoId?: string } | null {
  if (!clave.startsWith(PREFIJO_BORRADOR)) return null
  const resto = clave.slice(PREFIJO_BORRADOR.length)
  if (!resto) return null
  const corte = resto.indexOf('.h.')
  if (corte === -1) return { patientId: resto }
  const patientId = resto.slice(0, corte)
  const internamientoId = resto.slice(corte + 3)
  if (!patientId || !internamientoId) return null
  return { patientId, internamientoId }
}

/**
 * El encuentro abierto más reciente, o `null` si no hay ninguno.
 *
 * DESEMPATE, declarado a propósito: gana el sello de tiempo más alto; entre
 * los que no se pudieron leer (ts 0), gana el ÚLTIMO que enumere el almacén,
 * que en todos los navegadores es el más recientemente escrito. Es una
 * heurística y por eso está escrita: lo que no se puede saber con certeza se
 * dice, no se disfraza.
 */
export function encuentroAbierto(uid?: string | null): EncuentroAbierto | null {
  if (typeof window === 'undefined') return null
  let almacen: Storage
  try {
    almacen = window.localStorage
  } catch {
    return null   // navegación privada con almacenamiento bloqueado
  }

  const secreto = secretoLocal(uid)
  let mejor: EncuentroAbierto | null = null

  for (let i = 0; i < almacen.length; i++) {
    const clave = almacen.key(i)
    if (!clave) continue
    const partes = partesDeLaClave(clave)
    if (!partes) continue

    let ts = 0
    try {
      const crudo = almacen.getItem(clave)
      if (crudo) {
        const claro = desofuscar(crudo, secreto)
        // Sólo el sello. El contenido clínico no sale de esta línea.
        if (claro) ts = Number((JSON.parse(claro) as { ts?: unknown }).ts) || 0
      }
    } catch {
      /* respaldo ilegible: el encuentro cuenta igual, con ts 0 */
    }

    if (!mejor || ts >= mejor.ts) mejor = { ...partes, ts }
  }

  return mejor
}

export const POR_QUE_NO_MIENTE =
  'Un destino de navegación que te lleva a otro sitio y además ilumina ese ' +
  'otro sitio rompe la pregunta de §15 en su primer uso. O el riel retoma el ' +
  'encuentro abierto, o dice que no hay ninguno: las dos son respuestas; ' +
  'teletransportar en silencio no lo es.'
