/**
 * Bloqueo de horarios — NÚCLEO PURO, sin Firestore.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. `time-blocks.ts` mezclaba dos cosas: la lógica
 * de «¿este horario está bloqueado?» (pura, aritmética de instantes) y el
 * acceso a `clinics/{id}/time_blocks` (necesita `db` del SDK del navegador).
 * Como `src/lib/firebase.ts` inicializa Firebase **al importarse**, cualquier
 * módulo de SERVIDOR que tocara `estaBloqueado` arrastraba el SDK del cliente
 * y lo inicializaba en tiempo de build:
 *
 *     /api/portal (servidor) → availability → time-blocks → firebase (cliente)
 *
 * Eso reventaba `next build` con `auth/invalid-api-key` en cualquier entorno
 * sin las variables `NEXT_PUBLIC_FIREBASE_*` — el CI, por ejemplo. En Vercel
 * pasaba desapercibido porque ahí las variables sí existen, así que el build
 * de producción funcionaba **por accidente**, no por diseño.
 *
 * Con el núcleo aparte, el servidor importa aritmética y nada más.
 * `time-blocks.ts` sigue exportando todo lo de antes (re-export), así que
 * ningún llamador existente cambia.
 */
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'

export type TipoBloque = 'vacaciones' | 'ausencia' | 'evento' | 'mantenimiento' | 'otro'

export interface TimeBlock {
  id: string
  desde: string            // ISO datetime
  hasta: string            // ISO datetime
  tipo: TipoBloque
  motivo?: string
  medicoId?: string        // opcional: bloque solo para un médico
  createdAt: string
  creadoPor: string
}

/**
 * Instante (ms UTC) de una entrada que puede venir como instante absoluto (ISO con
 * Z u offset) o como HORA DE PARED ("YYYY-MM-DD HH:MM") de la clínica. L5 auditoría
 * maestra: la hora de pared antes se interpretaba en la zona del RUNTIME (UTC en
 * Vercel) → los bloqueos quedaban corridos ~6h (más para el norte). Ahora la hora
 * de pared se ancla a la zona de la clínica.
 */
function instanteDeEntrada(s: string, tz: string): number {
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return new Date(s).getTime()  // ya es absoluto
  const iso = s.replace(' ', 'T')
  return instanteMX(iso.slice(0, 10), iso.slice(11, 16), tz).getTime()
}

/**
 * ¿ESTA CITA PISA UN BLOQUEO? — con su DURACIÓN, no sólo su minuto de inicio.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `estaBloqueado` recibe un instante y pregunta si ese instante cae dentro del
 * bloque. Ningún llamador le pasaba la duración, así que una consulta de 60
 * minutos a las 10:00 contra un bloqueo de 10:30 a 13:00 **no estaba bloqueada**:
 * las 10:00 no caen dentro del bloque, y la cita entraba ENTERA encima de la
 * ausencia, el quirófano o las vacaciones.
 *
 * Los cuatro caminos que agendan lo hacían igual: el panel, el alta del
 * consultorio, la reserva pública y el cálculo de huecos.
 *
 * ── LO IRÓNICO ───────────────────────────────────────────────────────────────
 *
 * La aritmética correcta ya estaba escrita en este mismo repositorio, a unas
 * líneas: `pisaDescanso(inicio, fin, …)` comprueba el SOLAPE —«basta con que se
 * solapen, no hace falta contenerlo»—, y se usa para los descansos de comida.
 * Los descansos estaban bien resueltos y las vacaciones no.
 *
 * @param duracionMin duración de la cita. Con 0 se comporta como el chequeo
 *   puntual de antes, que es lo correcto para preguntar por un instante suelto.
 */
export function pisaBloqueo(
  fechaHora: string,
  duracionMin: number,
  bloques: TimeBlock[],
  medicoId?: string,
  tz: string = TZ_DEFAULT,
): TimeBlock | null {
  const inicio = instanteDeEntrada(fechaHora, tz)
  if (isNaN(inicio)) return null
  // Una duración inválida no se convierte en «no bloquea»: se trata como 0, que
  // es el chequeo más estricto que se puede hacer sin inventar una duración.
  const dur = Number.isFinite(duracionMin) && duracionMin > 0 ? duracionMin : 0
  const fin = inicio + dur * 60_000

  for (const b of bloques) {
    const desde = new Date(b.desde).getTime()
    const hasta = new Date(b.hasta).getTime()
    if (isNaN(desde) || isNaN(hasta)) continue
    // Solape, no contención. Con dur=0 esto es exactamente `t >= desde && t < hasta`.
    const solapa = dur > 0 ? (inicio < hasta && fin > desde) : (inicio >= desde && inicio < hasta)
    if (!solapa) continue
    // Si el bloque es para un médico específico, solo bloquea a ese médico
    if (b.medicoId && medicoId && b.medicoId !== medicoId) continue
    return b
  }
  return null
}

/**
 * Verifica si un INSTANTE cae dentro de algún bloque activo.
 *
 * Se conserva para preguntar por un momento suelto. Para una CITA usa
 * `pisaBloqueo`, que mira toda su duración: preguntar sólo por el minuto de
 * inicio deja entrar una consulta de una hora encima de un bloqueo que empieza
 * media hora después.
 */
export function estaBloqueado(
  fechaHora: string,                  // ISO absoluto o "YYYY-MM-DD HH:MM" (pared)
  bloques: TimeBlock[],
  medicoId?: string,
  tz: string = TZ_DEFAULT,            // zona de la clínica (config.zonaHoraria)
): TimeBlock | null {
  const t = instanteDeEntrada(fechaHora, tz)
  if (isNaN(t)) return null
  for (const b of bloques) {
    const desde = new Date(b.desde).getTime()
    const hasta = new Date(b.hasta).getTime()
    if (t >= desde && t < hasta) {
      // Si el bloque es para un médico específico, solo bloquea a ese médico
      if (b.medicoId && medicoId && b.medicoId !== medicoId) continue
      return b
    }
  }
  return null
}

export const TIPO_BLOQUE_LABEL: Record<TipoBloque, string> = {
  vacaciones: '🌴 Vacaciones',
  ausencia: '✋ Ausencia',
  evento: '📅 Evento',
  mantenimiento: '🔧 Mantenimiento',
  otro: '⏸️ Otro',
}
