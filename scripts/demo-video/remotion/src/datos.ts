/**
 * La línea de tiempo del video se CALCULA, no se escribe a mano.
 *
 * Entradas (todas en `public/`):
 *   · guion.json        → escenas, narración, capítulos, chats (de ../guion.mjs)
 *   · duraciones.json   → segundos de cada pista de voz (de ../tts.py)
 *   · marcas/<toma>.json→ instante de cada escena dentro de su clip (de ../grabar.mjs)
 *
 * Salida: una lista ordenada de piezas con su duración en fotogramas. La
 * composición sólo las pinta.
 */
import { staticFile } from 'remotion'
import { FPS } from './tema'

export interface EscenaGuion {
  id: string
  capitulo: string | null
  clip: string | null
  formato: 'escritorio' | 'telefono' | 'chat'
  narracion: string
  narracionDespues?: string
  dialogo?: boolean
}
export interface Capitulo { id: string; numero: number; titulo: string; sub: string }
export interface Mensaje { de: 'bot' | 'paciente'; texto: string }
export interface Guion {
  ESCENAS: EscenaGuion[]
  CAPITULOS: Capitulo[]
  DIALOGO: { rol: string; texto: string }[]
  CHAT_BOT: Mensaje[]
  CHAT_RECORDATORIO: Mensaje[]
  CHAT_HUECO: Mensaje[]
  CHAT_ESCALACION: Mensaje[]
}
export interface Marca { n: string; t: number }
export interface Turno { i: number; rol: string; texto: string; inicioMs: number; finMs: number }

/** Qué toma (archivo de video) contiene cada escena. */
const TOMA_DE: Record<string, string> = {
  '00-intro': 'landing',
  '01-paciente-reserva': 'agenda', '03-asistente-agenda': 'agenda', '04-confirmar': 'agenda', '05-lista-espera': 'agenda',
  '06-consulta-escucha': 'consulta', '07-nota': 'consulta', '08-procedencia-firma': 'consulta',
  '09-receta': 'consulta', '10-ordenes': 'consulta', '11-entregar-portal': 'consulta',
  '12-portal': 'portal', '13-preguntar': 'portal',
  '14-seguimiento': 'seguimiento', '15-configuracion-cierre': 'seguimiento',
}

export type Pieza =
  | { tipo: 'intro'; id: string; frames: number; toma: string; desde: number; voz: string; texto: string }
  | { tipo: 'capitulo'; id: string; frames: number; capitulo: Capitulo }
  | {
      tipo: 'clip'; id: string; frames: number; toma: string; desde: number; voz: string; texto: string
      formato: 'escritorio' | 'telefono'; capitulo: Capitulo | null
      /** Momentos (segundos desde el inicio de la escena) útiles para rótulos y acercamientos. */
      momentos: Record<string, number>
      /** Sólo la escena de la consulta: diálogo que se oye entero. */
      dialogo?: { voz: string; desde: number; turnos: Turno[]; vozDespues: string; desdeDespues: number; textoDespues: string }
      /** Chat de WhatsApp que aparece en una esquina, a partir de `desde` (segundos). */
      chat?: { desde: number; mensajes: Mensaje[]; titulo: string }
    }
  | { tipo: 'chat'; id: string; frames: number; voz: string; texto: string; mensajes: Mensaje[]; capitulo: Capitulo | null; titulo: string }
  | { tipo: 'cierre'; id: string; frames: number }

export interface LineaDeTiempo { piezas: Pieza[]; totalFrames: number }

const seg = (s: number) => Math.round(s * FPS)

async function json<T>(ruta: string): Promise<T> {
  const r = await fetch(staticFile(ruta))
  if (!r.ok) throw new Error(`No se pudo leer ${ruta}`)
  return r.json()
}

export async function construirLinea(): Promise<LineaDeTiempo> {
  const guion = await json<Guion>('guion.json')
  const duraciones = await json<Record<string, number>>('duraciones.json')
  const dialogo = await json<{ duracionMs: number; turnos: Turno[] }>('dialogo/dialogo.json')
  const tomas = [...new Set(Object.values(TOMA_DE))]
  const marcas: Record<string, Marca[]> = {}
  for (const t of tomas) {
    try { marcas[t] = (await json<{ marcas: Marca[] }>(`marcas/${t}.json`)).marcas } catch { marcas[t] = [] }
  }
  const marca = (toma: string, n: string) => marcas[toma]?.find(m => m.n === n)?.t
  const dur = (id: string) => duraciones[id] ?? 0
  const capDe = (id: string | null) => guion.CAPITULOS.find(c => c.id === id) ?? null

  const piezas: Pieza[] = []
  let capituloAbierto: string | null = null
  const PAD = 0.9

  for (const e of guion.ESCENAS) {
    if (e.capitulo && e.capitulo !== capituloAbierto) {
      capituloAbierto = e.capitulo
      piezas.push({ tipo: 'capitulo', id: `cap-${e.capitulo}`, frames: seg(2.6), capitulo: capDe(e.capitulo)! })
    }
    if (e.id === '00-intro') {
      piezas.push({ tipo: 'intro', id: e.id, frames: seg(dur(e.id) + PAD), toma: 'landing', desde: marca('landing', e.id) ?? 0, voz: `voz/${e.id}.wav`, texto: e.narracion })
      continue
    }
    if (e.formato === 'chat') {
      piezas.push({ tipo: 'chat', id: e.id, frames: seg(dur(e.id) + PAD), voz: `voz/${e.id}.wav`, texto: e.narracion, mensajes: guion.CHAT_BOT, capitulo: capDe(e.capitulo), titulo: 'Consultorio de Medicina Interna' })
      continue
    }
    const toma = TOMA_DE[e.id]
    const desde = marca(toma, e.id) ?? 0
    const momentos: Record<string, number> = {}
    for (const m of marcas[toma] ?? []) momentos[m.n] = m.t - desde
    let frames = seg(dur(e.id) + PAD)
    let dialogoPieza: Extract<Pieza, { tipo: 'clip' }>['dialogo']
    if (e.dialogo) {
      const grabando = momentos.grabando ?? dur(e.id)
      const transcripcion = momentos.transcripcion ?? grabando + dialogo.duracionMs / 1000 + 8
      frames = seg(transcripcion + dur(`${e.id}-despues`) + PAD)
      dialogoPieza = {
        voz: 'dialogo/dialogo.wav', desde: grabando, turnos: dialogo.turnos,
        vozDespues: `voz/${e.id}-despues.wav`, desdeDespues: transcripcion, textoDespues: e.narracionDespues ?? '',
      }
    }
    let chat: Extract<Pieza, { tipo: 'clip' }>['chat']
    if (e.id === '04-confirmar') chat = { desde: dur(e.id) * 0.62, mensajes: guion.CHAT_RECORDATORIO, titulo: 'Recordatorio automático' }
    if (e.id === '05-lista-espera') chat = { desde: dur(e.id) * 0.45, mensajes: guion.CHAT_HUECO, titulo: 'Oferta del hueco liberado' }
    if (e.id === '13-preguntar') chat = { desde: dur(e.id) * 0.72, mensajes: guion.CHAT_ESCALACION, titulo: 'Lo que recibe el consultorio' }
    piezas.push({
      tipo: 'clip', id: e.id, frames, toma, desde, voz: `voz/${e.id}.wav`, texto: e.narracion,
      formato: e.formato === 'telefono' ? 'telefono' : 'escritorio', capitulo: capDe(e.capitulo), momentos, dialogo: dialogoPieza, chat,
    })
  }
  piezas.push({ tipo: 'cierre', id: 'cierre', frames: seg(7) })
  const totalFrames = piezas.reduce((s, p) => s + p.frames, 0)
  return { piezas, totalFrames }
}

/** Reparte las oraciones de una narración a lo largo de su duración, por longitud. */
export function subtitulosDe(texto: string, segundos: number): { desde: number; hasta: number; texto: string }[] {
  const oraciones = texto.replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean)
  const total = oraciones.reduce((s, o) => s + o.length + 12, 0)
  let t = 0.25
  const util = Math.max(1, segundos - 0.9)
  return oraciones.map(o => {
    const d = ((o.length + 12) / total) * util
    const r = { desde: t, hasta: t + d, texto: o }
    t += d
    return r
  })
}
