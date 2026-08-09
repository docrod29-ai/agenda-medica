/**
 * LO QUE SE REVISÓ NO ERA LO QUE SE FIRMA — I-8 del loop.
 *
 * ── LO QUE EL MÉDICO PIDIÓ ──────────────────────────────────────────────────
 *
 * Preguntado qué le haría confiar en la nota **sin releerla entera**, eligió:
 * **«que un segundo modelo la revise»**.
 *
 * ── Y YA EXISTÍA. ÉSE ES EL PROBLEMA ────────────────────────────────────────
 *
 * `/api/expediente/verificar-nota` lleva tiempo funcionando: un segundo modelo
 * compara la nota contra el dictado y devuelve hallazgos de seguridad. Corre
 * sola al terminar el pase de IA.
 *
 * Pero después de eso **el médico edita la nota**. Corrige un apartado, cambia
 * una dosis, acepta las líneas propuestas, quita un diagnóstico. Y firma.
 *
 * El resultado que se le enseña sigue diciendo «sin observaciones de seguridad»
 * — de una versión del texto que **ya no existe**. La revisión es de la nota que
 * la IA escribió, no de la que él firma con su cédula.
 *
 * Un sello de revisión sobre un texto que cambió no es una garantía: es una
 * garantía caducada que se lee igual que una vigente.
 *
 * ── LO QUE ESTE MÓDULO HACE, Y LO QUE NO ────────────────────────────────────
 *
 * **Hace**: calcula una huella estable del contenido que se revisó, y sabe decir
 * si la nota de ahora es la misma. Nada más.
 *
 * **No hace**: no bloquea la firma, no vuelve a llamar al modelo, no juzga la
 * nota. Sólo permite decir la verdad — «esto que estás firmando no es lo que se
 * revisó» — que es justo lo que hoy no se puede decir.
 *
 * ── POR QUÉ LA HUELLA ES DEL TEXTO Y NO DEL OBJETO ──────────────────────────
 *
 * Firestore reordena las llaves de un objeto, así que un hash sobre
 * `JSON.stringify` cambia sin que cambie el contenido — eso ya costó un banner
 * de «INTEGRIDAD NO VERIFICADA» que era falso. Aquí se ordena y se aplana a
 * texto antes de medir, y **el orden lo fija este módulo**, no el que llame.
 *
 * Módulo PURO, sin dependencias.
 */

/** Lo que el revisor mira. Si algo de esto cambia, la revisión caducó. */
export interface ContenidoRevisable {
  resumen?: string
  secciones?: readonly { titulo?: string; contenido?: string }[]
  diagnosticos?: readonly { descripcion?: string; codigoCIE10?: string }[]
  medicamentos?: readonly { nombre?: string; dosis?: string; via?: string; frecuencia?: string; duracion?: string }[]
}

const t = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/**
 * Separador entre campos. Sin él, «ab» + «c» y «a» + «bc» dan la misma huella:
 * dos notas distintas pasarían por la misma. Se usa un carácter de control que
 * no puede aparecer en texto dictado.
 */
const SEP = '\u001f'

/**
 * El contenido revisable, aplanado a texto en un orden fijo.
 *
 * Secciones, diagnósticos y medicamentos se ORDENAN: el orden en que vengan no
 * puede cambiar la huella, o mover un renglón en la pantalla caducaría una
 * revisión que sigue siendo válida.
 */
export function textoRevisable(c: ContenidoRevisable | null | undefined): string {
  if (!c) return ''
  /** Un campo sin nada no aporta y no debe alterar la huella. */
  const conContenido = (partes: readonly string[]) => partes.some(x => x.length > 0)

  const secciones = [...(c.secciones ?? [])]
    .map(x => [t(x.titulo), t(x.contenido)])
    // Una sección SIN CONTENIDO no se revisó: que esté o no en la lista no puede
    // caducar una revisión.
    .filter(x => x[1].length > 0)
    .map(x => x.join(SEP))
    .sort()

  const dx = [...(c.diagnosticos ?? [])]
    .map(x => [t(x.descripcion), t(x.codigoCIE10)])
    .filter(conContenido)
    .map(x => x.join(SEP))
    .sort()

  const meds = [...(c.medicamentos ?? [])]
    .map(x => [x.nombre, x.dosis, x.via, x.frecuencia, x.duracion].map(t))
    .filter(conContenido)
    .map(x => x.join(SEP))
    .sort()

  return [t(c.resumen), ...secciones, ...dx, ...meds].join(SEP)
}

/**
 * Huella estable del contenido revisable.
 *
 * FNV-1a de 32 bits sobre el texto canónico. No es criptográfica y no pretende
 * serlo: aquí no hay adversario, sólo la pregunta «¿es el mismo texto?». Para el
 * sello de integridad de la nota firmada —que sí tiene requisito legal— está
 * SHA-256 en su sitio, y esto no lo sustituye.
 */
export function huellaRevisable(c: ContenidoRevisable | null | undefined): string {
  const s = textoRevisable(c)
  if (!s) return ''
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** En qué estado está la revisión respecto de lo que hay ahora en pantalla. */
export type EstadoDeRevision =
  /** Nunca se revisó. */
  | 'sin_revisar'
  /** Se revisó ESTA versión. */
  | 'al_dia'
  /** Se revisó, pero la nota cambió desde entonces. */
  | 'caducada'

export function estadoDeRevision(p: {
  /** Huella que devolvió la revisión, si la hubo. */
  huellaRevisada?: string | null
  /** Lo que hay ahora en pantalla. */
  ahora: ContenidoRevisable | null | undefined
}): EstadoDeRevision {
  const revisada = (p.huellaRevisada ?? '').trim()
  if (!revisada) return 'sin_revisar'
  return revisada === huellaRevisable(p.ahora) ? 'al_dia' : 'caducada'
}

/** Lo que se le dice al médico en cada estado. Se escribe una vez. */
export const COMO_SE_DICE: Readonly<Record<EstadoDeRevision, string>> = {
  sin_revisar: 'Esta nota no ha pasado por la segunda opinión.',
  al_dia: 'La segunda opinión revisó exactamente esta versión de la nota.',
  caducada: 'La nota cambió después de la segunda opinión: lo revisado ya no es lo que vas a firmar.',
}

export const POR_QUE_NO_BLOQUEA =
  'Bloquear la firma por una revisión caducada convertiría cada corrección de ' +
  'una coma en un trámite, y el médico aprendería a esquivarlo. Lo que hacía ' +
  'falta no era una compuerta más: era poder decir la verdad sobre qué se revisó.'

export const POR_QUE_SE_ORDENA_ANTES_DE_MEDIR =
  'Firestore reordena las llaves, así que un hash sobre JSON.stringify cambia ' +
  'sin que cambie el contenido — eso ya costó un banner de «INTEGRIDAD NO ' +
  'VERIFICADA» que era falso. El orden lo fija este módulo, no quien lo llame.'
