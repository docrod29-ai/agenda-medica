/**
 * LIBERAR — la aritmética de «lo que se entregó se entregó».
 *
 * V9 · `POSTVISIT-001`. Módulo PURO: aquí no hay Firestore, ni sesión, ni
 * reloj. Sólo las tres decisiones que la ruta necesita tomar y que no se pueden
 * probar cómodamente dentro de un handler HTTP.
 *
 * ── POR QUÉ CADA LIBERACIÓN ES UN DOCUMENTO NUEVO ───────────────────────────
 *
 * El módulo del paquete lo dice con todas las letras: **un paquete liberado es
 * inmutable**, y corregirlo es liberar una versión nueva, igual que una adenda
 * no reescribe la nota.
 *
 * La forma barata de implementarlo era un documento por nota y sobrescribirlo al
 * corregir. Eso destruye exactamente lo que el campo `version` promete: si
 * dentro de un año hay que responder «¿qué leyó este paciente el 9 de agosto?»,
 * la respuesta no puede ser la corrección del día 12.
 *
 * Así que cada liberación **crea** su documento, con `create()` y un id que
 * incluye la versión: dos liberaciones simultáneas no pueden escribir la misma
 * versión ni siquiera por carrera — la segunda choca contra el id y reintenta.
 *
 * ── Y ENTONCES, ¿QUÉ VE EL PACIENTE? ────────────────────────────────────────
 *
 * La versión **vigente** de cada nota, no las cuatro. Las anteriores siguen en
 * la base porque son el registro de lo que se entregó; enseñárselas al paciente
 * sería darle tres hojas de instrucciones contradictorias de la misma consulta,
 * que es peor que no darle ninguna. Eso lo hace `vigentesPorNota`, y lo llama
 * `/api/portal`.
 */
import type { PaqueteDeVisita } from './paquete-de-visita'

/** Lo mínimo para ordenar versiones: lo que se guarda en cada documento. */
export interface PaqueteVersionado {
  notaId: string
  version: number
}

const entero = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0)

/**
 * Qué versión toca escribir.
 *
 * Se calcula sobre el MÁXIMO de las existentes, no sobre `length`: si algún día
 * se borra una versión intermedia —o una escritura falla a medias— contar
 * documentos reutilizaría un número ya entregado, y dos paquetes distintos
 * pasarían a llamarse igual en la discusión de «qué le dijimos».
 *
 * Sin ninguna previa, la primera versión es 1. No hay versión 0.
 */
export function siguienteVersion(existentes: readonly { version?: unknown }[]): number {
  let max = 0
  for (const p of existentes) max = Math.max(max, entero(p?.version))
  return max + 1
}

/**
 * El id del documento: `{notaId}__v{version}`.
 *
 * Determinista a propósito. Con `add()` y un id aleatorio, dos pestañas del
 * médico pulsando «Liberar» a la vez crearían dos versiones 1 distintas y las
 * dos «vigentes». Con este id, la segunda choca contra un documento que ya
 * existe, y la ruta reintenta con la versión siguiente.
 */
export function idDelPaquete(notaId: string, version: number): string {
  const n = String(notaId ?? '').trim()
  if (!n) throw new Error('Un paquete sin nota no tiene id')
  if (!entero(version)) throw new Error('La versión de un paquete es un entero positivo')
  return `${n}__v${version}`
}

/**
 * De todas las liberaciones, la vigente de cada nota.
 *
 * Empate de versión —que no debería ocurrir con `create()`, pero los datos
 * viejos no leen los comentarios— se resuelve por `approvedAt` más reciente, y
 * si tampoco lo hay, por el primero: una decisión estable vale más que una
 * decisión bonita, porque la inestable produce una pantalla que cambia sola.
 */
export function vigentesPorNota<T extends PaqueteVersionado & Partial<Pick<PaqueteDeVisita, 'approvedAt'>>>(
  paquetes: readonly T[],
): T[] {
  const porNota = new Map<string, T>()
  for (const p of paquetes) {
    const previo = porNota.get(p.notaId)
    if (!previo) { porNota.set(p.notaId, p); continue }
    const gana =
      entero(p.version) > entero(previo.version) ||
      (entero(p.version) === entero(previo.version) && (p.approvedAt ?? 0) > (previo.approvedAt ?? 0))
    if (gana) porNota.set(p.notaId, p)
  }
  return [...porNota.values()]
}

/**
 * `clinicianContactRules` — CÓMO se contacta al consultorio, no CUÁNDO.
 *
 * Lo que el campo pide en la especificación es «reglas de contacto», y la
 * tentación evidente es escribir «si empeora, llame» o «para urgencias acuda a
 * su hospital». Eso es **indicación médica**, y aquí no la firma nadie: el campo
 * se queda en el dato administrativo —el nombre del consultorio y sus vías de
 * contacto, tal como el médico las capturó en su configuración— y se calla lo
 * demás.
 *
 * Sin ningún teléfono capturado devuelve cadena vacía. Un contacto inventado es
 * peor que ningún contacto: el paciente marca y no contesta nadie.
 */
export function comoContactarAlConsultorio(c: {
  nombreClinica?: unknown
  whatsappConsultorio?: unknown
  telefonoAdmin?: unknown
} | null | undefined): string {
  const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const partes: string[] = []
  const nombre = t(c?.nombreClinica)
  if (nombre) partes.push(nombre)
  const wa = t(c?.whatsappConsultorio)
  if (wa) partes.push(`WhatsApp ${wa}`)
  const tel = t(c?.telefonoAdmin)
  if (tel && tel !== wa) partes.push(`Tel. ${tel}`)
  /* Sólo el nombre no es una vía de contacto: es un membrete. */
  return partes.length >= 2 ? partes.join(' · ') : ''
}

export const POR_QUE_CADA_LIBERACION_ES_UN_DOCUMENTO =
  'Un paquete liberado es inmutable. Si corregirlo sobrescribiera el documento, ' +
  '«qué leyó este paciente el día 9» se respondería con la corrección del día 12.'
