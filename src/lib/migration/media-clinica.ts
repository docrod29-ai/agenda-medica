/**
 * LA FOTO CLÍNICA NO ES PAPELERÍA. Y hoy vive donde vive la papelería.
 *
 * ── EL FALLO (R-05, P0) ──────────────────────────────────────────────────────
 *
 * `FotosClinicas.tsx` sube la fotografía clínica seriada —lesiones, heridas
 * quirúrgicas, úlceras: PHI en imagen— llamando a `subirImagen(dataUrl,
 * `fotos/${patientId}/${Date.now()}`)`. Esa clave viaja a `/api/config/imagen`,
 * que la limpia con `.replace(/[^a-z0-9_-]/gi, '')` —las barras desaparecen— y
 * escribe el objeto en:
 *
 *     receta-diseno/{uid-del-medico}/fotos{patientId}{ts}-{Date.now()}.jpg
 *
 * Ese prefijo es el del **membrete, la firma y el sello**: papelería del médico,
 * material de diseño, del que el propio barrido de audio dice —en un comentario—
 * que «no caduca». Tres consecuencias, las tres reales:
 *
 *  1. **Semántica de ciclo de vida equivocada.** El expediente de un paciente
 *     comparte prefijo, dueño y política con un logotipo. Cualquier limpieza o
 *     regla de ciclo de vida escrita para «material de diseño» se lleva por
 *     delante fotografías clínicas, y una foto de la evolución de una úlcera no
 *     se puede volver a tomar: el paciente de hace seis meses ya no existe.
 *  2. **El paciente no está en la ruta.** Está *concatenado* dentro del nombre
 *     del archivo, pegado a una marca de tiempo y sin separador. No se puede
 *     recuperar de la ruta: `fotosAbC123XyZ1756…` no se puede partir. Un objeto
 *     suelto en ese bucket **no dice de quién es**.
 *  3. **El consultorio tampoco está.** El primer segmento es el `uid` del
 *     médico, no el `clinicId`, así que la ruta no sostiene el aislamiento que
 *     el resto del expediente sí tiene.
 *
 * ── QUÉ REPARA ESTE MÓDULO Y QUÉ NO ──────────────────────────────────────────
 *
 * Repara el **contrato**: cuál es el destino canónico, qué cuenta como material
 * clínico, quién puede borrarlo y cómo se lleva lo que ya está sin perder nada.
 *
 * **No mueve ni borra un solo byte.** Este carril entrega el plan; ejecutarlo
 * exige `storage.rules` (prefijo nuevo) y el camino de lectura, que son del
 * dueño y de #306/#350 — el mismo reparto que ya declara `HANDOFF.md`. Un plan
 * que se pudiera ejecutar desde aquí sería el segundo escritor que #320 prohíbe.
 *
 * Tampoco toca la autorización de `/api/receta/diseno` (R-06): esa es otra
 * pieza, con otro dueño, y mezclarlas haría imposible revisar ninguna de las dos.
 *
 * ── LA REGLA QUE ORDENA TODO LO DE ABAJO ─────────────────────────────────────
 *
 * **Ante la duda sobre de quién es una imagen clínica, no se adivina: se
 * escala.** Colgar un estudio del paciente «más probable» por el nombre del
 * archivo mete la lesión de alguien en el expediente de otro, y eso no se ve
 * como un error — se ve como un paciente con más hallazgos. Es la misma
 * asimetría que ya gobierna `emparejamiento.ts` y `adjuntos.ts`.
 *
 * Módulo PURO: sin red, sin reloj, sin almacenamiento. Decide y devuelve.
 */
import { PREFIJO_AUDIO } from '@/lib/expediente/audio-caduco'
import {
  aceptada, rechazada, type Razon, type Veredicto,
} from './contrato'
import { MAXIMO_BYTES, TIPOS_ADMITIDOS } from './adjuntos'
import { clinicIdValido } from './aislamiento'
import { ContadorDeVeredictos, reconciliar, type Reconciliacion } from './reconciliacion'
import { FILAS_POR_LOTE, planificar, type Lote } from './lotes'
import { MOTIVO_TEXTO, type MotivoNoRevertible } from './rollback'

/* ═══════════════════════ LOS ESPACIOS DE NOMBRES ═══════════════════════ */

/**
 * Dónde tiene que vivir el material clínico. Con la barra final puesta.
 *
 * La barra no es estilo: sin ella, `media-clinica-viejo/…` entraría en cualquier
 * comparación por prefijo. Es el mismo cuidado que ya tiene `PREFIJO_AUDIO`, y
 * la misma clase de fallo que `rutaDentroDelConsultorio` documenta.
 */
export const PREFIJO_MEDIA_CLINICA = 'media-clinica/'

/** Donde vive la papelería del médico: membrete, firma, sello. Efímera. */
export const PREFIJO_PAPELERIA = 'receta-diseno/'

/** Donde vive el audio de trabajo de la consulta. Efímero, caduca a las 24 h. */
export const PREFIJO_AUDIO_EFIMERO = PREFIJO_AUDIO

/**
 * El segmento que ocupa el encuentro cuando NO se declaró ninguno.
 *
 * No es «esta foto no pertenece a ninguna consulta»: es «nadie dijo a cuál».
 * `FotoClinica.notaId` es opcional y una foto tomada fuera de consulta es
 * legítima. Escribir aquí un `notaId` inventado ataría una imagen a una nota
 * firmada que no la menciona, y eso es peor que no saberlo.
 *
 * Ausencia de dato no es dato de ausencia — también en una ruta.
 */
export const ENCUENTRO_NO_DECLARADO = 'sin-encuentro'

/**
 * Cómo se llama lo que hay en el bucket. **Exhaustivo y fail-closed.**
 *
 * `desconocida` no es un cajón de sastre benigno: es la clase que **nadie puede
 * limpiar**. Un objeto cuya naturaleza no se sabe se conserva; el coste de
 * conservar de más es almacenamiento, y el de borrar de menos es un expediente.
 */
export type ClaseDeObjeto =
  | 'media-clinica'
  | 'media-clinica-legada'
  | 'papeleria-efimera'
  | 'audio-efimero'
  | 'desconocida'

/** Las clases que son material del expediente. Nunca se limpian. */
export const CLASES_CLINICAS: readonly ClaseDeObjeto[] = ['media-clinica', 'media-clinica-legada']

/**
 * El nombre que dejó la subida vieja de fotografía clínica.
 *
 * `fotos/{patientId}/{ts}` pierde las barras en `/api/config/imagen` y queda
 * `fotos{patientId}{ts}`; la ruta le añade `-{Date.now()}.{ext}`. Por eso el
 * reconocedor pide `fotos` pegado a algo y una marca de trece dígitos al final.
 *
 * **Reconoce de más a propósito.** Si algún día alguien sube papelería con una
 * clave que empiece por `fotos`, esto la tratará como clínica: se conservará y
 * acabará en revisión humana. Al revés —no reconocer una foto clínica— la
 * dejaría bajo semántica de papelería, que es el defecto que se está reparando.
 *
 * Lo que NO reconoce: `foto-medico-…`, que es el retrato del médico y sí es
 * papelería. `fotos` con `s` frente a `foto-` con guion; hay prueba que lo fija.
 */
const NOMBRE_FOTO_LEGADA = /^fotos[A-Za-z0-9_-]+-\d{13}\.(png|jpe?g|webp|heic)$/i

/** El último segmento de una ruta de objeto. */
function nombreDeArchivo(ruta: string): string {
  const i = ruta.lastIndexOf('/')
  return i < 0 ? ruta : ruta.slice(i + 1)
}

/**
 * ¿Qué es este objeto del bucket?
 *
 * Sólo mira el nombre, que es todo lo que un barrido tiene delante cuando lista
 * el bucket. Cuando además se conoce el expediente, `puedeLimpiar` acepta el
 * conjunto de rutas referenciadas y eso manda sobre esto.
 */
export function clasificarObjeto(ruta: string): ClaseDeObjeto {
  const r = String(ruta ?? '')
  if (r.startsWith(PREFIJO_MEDIA_CLINICA) && r.length > PREFIJO_MEDIA_CLINICA.length) {
    return 'media-clinica'
  }
  if (r.startsWith(PREFIJO_AUDIO_EFIMERO) && r.length > PREFIJO_AUDIO_EFIMERO.length) {
    return 'audio-efimero'
  }
  if (r.startsWith(PREFIJO_PAPELERIA) && r.length > PREFIJO_PAPELERIA.length) {
    return NOMBRE_FOTO_LEGADA.test(nombreDeArchivo(r)) ? 'media-clinica-legada' : 'papeleria-efimera'
  }
  return 'desconocida'
}

/** ¿Es material del expediente? Lo que sea esto, no se limpia. */
export function esMediaClinica(ruta: string): boolean {
  return CLASES_CLINICAS.includes(clasificarObjeto(ruta))
}

/* ═══════════════════════ QUIÉN PUEDE BORRAR QUÉ ═══════════════════════ */

/**
 * Los barridos que existen, por el nombre de lo que les toca.
 *
 * Un selector es una **lista blanca de una sola clase**, no un patrón de rutas.
 * La diferencia importa: un barrido escrito como «todo lo que cuelgue de
 * `receta-diseno/`» se lleva las fotos clínicas que hoy están ahí sin que nadie
 * lo haya decidido nunca. Escrito como «los objetos de clase
 * `papeleria-efimera`», no puede.
 */
export type SelectorDeLimpieza = 'audio-efimero' | 'papeleria-efimera'

/**
 * LA COMPUERTA DE BORRADO. Fail-closed en las tres direcciones.
 *
 *  · Sólo borra quien reclama **exactamente** la clase del objeto. Un barrido de
 *    audio no puede tocar papelería ni al revés.
 *  · `desconocida` no la reclama nadie, así que no se borra nunca.
 *  · Y si quien llama sabe además qué rutas están referenciadas desde el
 *    expediente, esas ganan a la clasificación por nombre. Una foto clínica con
 *    un nombre que parezca papelería sigue sin poder borrarse.
 *
 * Devuelve `true` sólo cuando las tres se cumplen. Nunca lanza: un barrido que
 * revienta a mitad deja el bucket a medias y sin informe.
 */
export function puedeLimpiar(
  ruta: string,
  selector: SelectorDeLimpieza,
  referenciadasPorElExpediente?: ReadonlySet<string>,
): boolean {
  if (referenciadasPorElExpediente?.has(ruta)) return false
  const clase = clasificarObjeto(ruta)
  if (CLASES_CLINICAS.includes(clase)) return false
  return clase === selector
}

/* ═══════════════════════ EL DESTINO CANÓNICO ═══════════════════════ */

/** Extensión por tipo. Lista blanca: lo que no está aquí no se escribe. */
const EXTENSION_POR_MIME: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'text/plain': 'txt',
}

/**
 * Un tipo escrito de varias maneras es el mismo tipo.
 *
 * `/api/config/imagen` guarda el `contentType` tal y como venía en la data URL,
 * y algunos navegadores mandan `image/jpg`. Sin esta normalización, media
 * biblioteca de fotos de un consultorio acabaría en «rechazado por tipo no
 * admitido» — un rechazo ruidoso pero equivocado, que es trabajo manual para el
 * médico sobre archivos que estaban perfectamente bien.
 *
 * Se recorta también el `; charset=…` que algunos clientes pegan detrás.
 */
const ALIAS_MIME: Readonly<Record<string, string>> = { 'image/jpg': 'image/jpeg' }

export function mimeCanonico(mime: string): string {
  const m = String(mime ?? '').toLowerCase().split(';')[0].trim()
  return ALIAS_MIME[m] ?? m
}

/** Un segmento de ruta que no puede escaparse de su carpeta. */
function segmentoValido(s: string): boolean {
  // Misma forma que un id de documento de Firestore: se reutiliza la de
  // aislamiento para que «identificador válido» quiera decir lo mismo en los dos
  // sitios. Dos definiciones distintas es cómo una pasa lo que la otra corta.
  return clinicIdValido(s)
}

/**
 * La identidad estable de un objeto: su propio contenido.
 *
 * Direccionable por contenido y no por marca de tiempo, y eso es lo que hace la
 * copia **idempotente**: reintentar una migración a medias vuelve a calcular la
 * misma ruta y sobrescribe el mismo objeto con los mismos bytes. Con un nombre
 * derivado del reloj, cada reintento dejaría una copia más y la reconciliación
 * de adjuntos no cuadraría nunca.
 */
export function identidadDeObjeto(checksum: string): string {
  return String(checksum ?? '').trim().toLowerCase().slice(0, 32)
}

/** ¿Este checksum tiene forma de SHA-256 y da para una identidad? */
export function identidadValida(checksum: string | undefined): boolean {
  return /^[a-f0-9]{32,64}$/.test(String(checksum ?? '').trim().toLowerCase())
}

export interface DestinoDeMedia {
  readonly clinicId: string
  readonly patientId: string
  /** `ENCUENTRO_NO_DECLARADO` cuando nadie dijo a qué consulta pertenece. */
  readonly encounterId: string
  readonly mime: string
  readonly checksum: string
}

/**
 * Dónde tiene que quedar una imagen clínica.
 *
 *     media-clinica/{clinicId}/{patientId}/{encounterId}/{identidad}.{ext}
 *
 * Los tres primeros segmentos son la razón de existir de este módulo: el
 * consultorio para el aislamiento, el paciente para saber de quién es sin abrir
 * el archivo, y el encuentro para poder contar la historia. La identidad sale
 * del contenido, así que la ruta es la misma cada vez que se calcula.
 *
 * LANZA si algo no encaja, y a propósito: construir una ruta a medias y
 * escribirla es cómo un objeto acaba en la carpeta del paciente equivocado.
 * Quien planifica valida antes y manda a revisión lo que no pase.
 */
export function rutaCanonicaDeMedia(d: DestinoDeMedia): string {
  if (!clinicIdValido(d.clinicId)) throw new Error('media clínica: clinicId inválido')
  if (!segmentoValido(d.patientId)) throw new Error('media clínica: patientId inválido')
  if (!segmentoValido(d.encounterId)) throw new Error('media clínica: encounterId inválido')
  const ext = EXTENSION_POR_MIME[mimeCanonico(d.mime)]
  if (!ext) throw new Error(`media clínica: tipo no admitido "${d.mime}"`)
  if (!identidadValida(d.checksum)) throw new Error('media clínica: checksum sin forma de SHA-256')
  return `${PREFIJO_MEDIA_CLINICA}${d.clinicId}/${d.patientId}/${d.encounterId}/${identidadDeObjeto(d.checksum)}.${ext}`
}

/**
 * ¿Esta ruta cae dentro del material clínico de ESTE consultorio?
 *
 * Con la barra final, por la misma razón que `rutaDentroDelConsultorio`: sin
 * ella, `media-clinica/abc` daría por buena una ruta de `media-clinica/abcdef`,
 * que es otro consultorio cuyo id empieza igual.
 */
export function rutaDentroDeMediaDelConsultorio(ruta: string, clinicId: string): boolean {
  if (!clinicIdValido(clinicId)) return false
  return String(ruta ?? '').startsWith(`${PREFIJO_MEDIA_CLINICA}${clinicId}/`)
}

/* ═══════════════════════ LO QUE YA ESTÁ ESCRITO ═══════════════════════ */

/**
 * La ruta del bucket detrás de una URL del proxy de papelería.
 *
 * `FotoClinica.url` guarda `/api/receta/diseno?path=…`, y las configuraciones
 * viejas guardan la forma `?u=https://firebasestorage…/o/…` con la ruta
 * codificada dentro. Las dos se entienden; cualquier otra cosa devuelve `null` y
 * el objeto acaba en revisión, que es el desenlace seguro.
 *
 * Hay un gemelo de esto en `receta-diseno-client.ts` (`pathDe`), que vive en el
 * navegador, depende de `window.location` y corre en mitad de una impresión. No
 * se comparte código con él a propósito: éste tiene que ser puro para poder
 * planificar una migración sin navegador. Los dos leen las MISMAS dos formas, y
 * si alguna vez apareciera una tercera hay que tocar los dos.
 */
export function rutaDeUrlProxy(url: string): string | null {
  const u = String(url ?? '')
  try {
    // Base ficticia: la URL que se guarda es relativa y aquí no hay `window`.
    const sp = new URL(u, 'https://interno.invalid').searchParams
    const p = sp.get('path')
    if (p) return p
    const legada = sp.get('u')
    if (legada) {
      const m = new URL(legada).pathname.match(/\/o\/(.+)$/)
      const obj = m ? decodeURIComponent(m[1]) : ''
      if (obj.startsWith(PREFIJO_PAPELERIA) || obj.startsWith(PREFIJO_MEDIA_CLINICA)) return obj
    }
    return null
  } catch {
    return null
  }
}

/** Un objeto que ya está en el bucket, tal y como lo devuelve un listado. */
export interface ObjetoLegado {
  readonly ruta: string
  readonly bytes: number
  readonly mime: string
  /** SHA-256 del contenido. Sin él no hay identidad estable ni prueba de llegada. */
  readonly checksum?: string
}

/**
 * Lo que el EXPEDIENTE dice sobre una imagen. Es la única fuente de la
 * pertenencia.
 *
 * Sale de `clinics/{clinicId}/patients/{patientId}/fotos/{fotoId}`, que sí sabe
 * de quién es cada foto. La ruta del bucket no lo sabe y no lo va a saber nunca:
 * el patientId se perdió al concatenarse. Por eso la migración se ancla en el
 * expediente y no en el nombre del archivo.
 */
export interface ReferenciaClinica {
  readonly clinicId: string
  readonly patientId: string
  readonly fotoId: string
  /** La nota a la que quedó ligada, si se tomó durante una consulta. */
  readonly notaId?: string
  /** La ruta del objeto, ya extraída de `FotoClinica.url` con `rutaDeUrlProxy`. */
  readonly ruta: string
}

/**
 * Índice ruta → referencias. Una consulta por objeto, sin recorrer la lista.
 *
 * Guarda TODAS las referencias de una ruta y no la primera: que dos pacientes
 * apunten al mismo objeto es exactamente el caso que tiene que acabar en
 * revisión, y quedarse con una lo convertiría en una migración silenciosa al
 * expediente equivocado.
 */
export class IndiceDeReferencias {
  private readonly porRuta = new Map<string, ReferenciaClinica[]>()

  constructor(referencias: readonly ReferenciaClinica[] = []) {
    for (const r of referencias) {
      const l = this.porRuta.get(r.ruta)
      if (l) l.push(r)
      else this.porRuta.set(r.ruta, [r])
    }
  }

  paraRuta(ruta: string): readonly ReferenciaClinica[] {
    return this.porRuta.get(ruta) ?? []
  }

  /** Las rutas que el expediente reclama. Se le pasan a `puedeLimpiar`. */
  rutasReferenciadas(): ReadonlySet<string> {
    return new Set(this.porRuta.keys())
  }
}

/* ═══════════════════════ EL VEREDICTO DE UN OBJETO ═══════════════════════ */

export interface MediaResuelta {
  readonly objeto: ObjetoLegado
  readonly veredicto: Veredicto
  /** Dónde tiene que quedar. Sólo cuando el destino es `accepted`. */
  readonly destino?: string
  /** De quién es. Sólo cuando se pudo demostrar. */
  readonly referencia?: ReferenciaClinica
}

export interface OpcionesDeMedia {
  /** El consultorio del trabajo, ya verificado en el servidor. */
  readonly clinicId: string
  /**
   * Rutas canónicas que YA existen en destino.
   *
   * Es lo que hace idempotente un reintento: un objeto cuya ruta de destino ya
   * está no se vuelve a copiar, y no porque se compruebe con una lectura previa
   * —que tiene una carrera dentro— sino porque la ruta es la misma.
   */
  readonly yaEnDestino?: ReadonlySet<string>
}

/**
 * ¿Qué se hace con este objeto?
 *
 * El orden de las comprobaciones ES la política, y va de lo más protector a lo
 * menos: primero de quién es, luego si se admite, y al final si se puede
 * demostrar que llegó entero. Un objeto de otro consultorio se corta antes de
 * mirarle el tamaño, porque si el consultorio está mal no importa nada más.
 */
export function resolverMedia(
  objeto: ObjetoLegado,
  indice: IndiceDeReferencias,
  o: OpcionesDeMedia,
): MediaResuelta {
  const ruta = String(objeto.ruta ?? '')

  // 0. Ya está donde tiene que estar. Reintentar no vuelve a copiar.
  if (clasificarObjeto(ruta) === 'media-clinica') {
    return { objeto, veredicto: rechazada('duplicate', ['ALREADY_IMPORTED']) }
  }

  const refs = indice.paraRuta(ruta)

  // 1. Nadie lo reclama. NO se adivina por el nombre: se escala.
  if (refs.length === 0) {
    return { objeto, veredicto: rechazada('quarantined', ['MEDIA_OWNER_UNKNOWN']) }
  }

  // 2. Lo reclama más de un paciente o más de un consultorio.
  const duenos = new Set(refs.map(r => `${r.clinicId}/${r.patientId}`))
  if (duenos.size > 1) {
    return {
      objeto,
      veredicto: rechazada('ambiguous', ['MEDIA_OWNER_AMBIGUOUS'], { duenos: duenos.size }),
    }
  }

  const ref = refs[0]

  // 3. Es de otro consultorio. Ni se copia ni se toca: se declara.
  if (!clinicIdValido(o.clinicId) || ref.clinicId !== o.clinicId) {
    return { objeto, veredicto: rechazada('quarantined', ['TENANT_MISMATCH']), referencia: ref }
  }

  // 4. El paciente o el encuentro no tienen forma de identificador utilizable.
  const encounterId = ref.notaId ?? ENCUENTRO_NO_DECLARADO
  if (!segmentoValido(ref.patientId) || !segmentoValido(encounterId)) {
    return { objeto, veredicto: rechazada('quarantined', ['MEDIA_OWNER_UNKNOWN']), referencia: ref }
  }

  // 5. Lo que no debe entrar por lo que ES, antes que por lo que pesa.
  const mime = mimeCanonico(objeto.mime)
  if (!TIPOS_ADMITIDOS.includes(mime) || !EXTENSION_POR_MIME[mime]) {
    return { objeto, veredicto: rechazada('rejected', ['UNSUPPORTED_FIELD']), referencia: ref }
  }
  if (!(objeto.bytes > 0) || objeto.bytes > MAXIMO_BYTES) {
    return { objeto, veredicto: rechazada('rejected', ['FIELD_TOO_LONG']), referencia: ref }
  }

  // 6. Sin checksum no hay identidad estable NI prueba de que llegara entero.
  if (!identidadValida(objeto.checksum)) {
    return { objeto, veredicto: rechazada('quarantined', ['MEDIA_IDENTITY_MISSING']), referencia: ref }
  }

  const destino = rutaCanonicaDeMedia({
    clinicId: ref.clinicId,
    patientId: ref.patientId,
    encounterId,
    mime: objeto.mime,
    checksum: objeto.checksum as string,
  })

  // 7. Ya se copió en un intento anterior. Idempotencia, no error.
  if (o.yaEnDestino?.has(destino)) {
    return { objeto, veredicto: rechazada('duplicate', ['ALREADY_IMPORTED']), destino, referencia: ref }
  }

  return { objeto, veredicto: aceptada(), destino, referencia: ref }
}

/* ═══════════════════════ EL PLAN ═══════════════════════ */

export interface CopiaPlanificada {
  readonly origen: string
  readonly destino: string
  readonly patientId: string
  readonly encounterId: string
  readonly checksum: string
}

export interface PlanDeMediaClinica {
  readonly clinicId: string
  readonly importJobId: string
  readonly resueltas: readonly MediaResuelta[]
  /** Las copias a hacer, en orden estable. Nunca un movimiento ni un borrado. */
  readonly aCopiar: readonly CopiaPlanificada[]
  /** Lo que espera a que una persona lo mire, con su porqué. */
  readonly aRevisar: readonly { readonly ruta: string; readonly razones: readonly Razon[] }[]
  /** Troceado reanudable de `aCopiar`. Mismo punto de control que la importación. */
  readonly lotes: readonly Lote[]
  readonly reconciliacion: Reconciliacion
}

/**
 * El plan entero, calculado ANTES de tocar nada.
 *
 * ── POR QUÉ SE ORDENA POR RUTA ───────────────────────────────────────────────
 *
 * Un listado de bucket no promete orden. Si los lotes se numeraran sobre el
 * orden de llegada, el «lote 37» de un reintento contendría otros objetos que el
 * «lote 37» del intento anterior, y el punto de control —que es sólo un número—
 * dejaría de significar nada. Ordenar por ruta hace que el troceado sea una
 * dirección estable, igual que en `lotes.ts`.
 *
 * ── LAS CUENTAS SON LAS MISMAS QUE LAS DE LAS FILAS ──────────────────────────
 *
 * Se reutilizan los cinco destinos y `reconciliar()` en vez de inventar una
 * contabilidad para imágenes: `declarados = accepted + rejected + duplicate +
 * ambiguous + quarantined`. Dos contabilidades para lo mismo es cómo se llega a
 * que nadie sepa cuál mirar cuando discrepan.
 */
export function planificarMigracionDeMedia(
  objetos: readonly ObjetoLegado[],
  referencias: readonly ReferenciaClinica[],
  o: OpcionesDeMedia & { readonly importJobId: string; readonly porLote?: number },
): PlanDeMediaClinica {
  const indice = new IndiceDeReferencias(referencias)
  const ordenados = [...objetos].sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0))

  const resueltas: MediaResuelta[] = []
  const aCopiar: CopiaPlanificada[] = []
  const aRevisar: { ruta: string; razones: readonly Razon[] }[] = []
  const contador = new ContadorDeVeredictos()

  for (const objeto of ordenados) {
    const r = resolverMedia(objeto, indice, o)
    resueltas.push(r)
    contador.sumar(r.veredicto)

    if (r.veredicto.destino === 'accepted' && r.destino && r.referencia) {
      aCopiar.push({
        origen: objeto.ruta,
        destino: r.destino,
        patientId: r.referencia.patientId,
        encounterId: r.referencia.notaId ?? ENCUENTRO_NO_DECLARADO,
        checksum: objeto.checksum as string,
      })
    } else if (r.veredicto.destino === 'quarantined' || r.veredicto.destino === 'ambiguous') {
      aRevisar.push({ ruta: objeto.ruta, razones: r.veredicto.razones })
    }
  }

  return {
    clinicId: o.clinicId,
    importJobId: o.importJobId,
    resueltas,
    aCopiar,
    aRevisar,
    lotes: planificar(aCopiar.length, o.importJobId, o.porLote ?? FILAS_POR_LOTE),
    reconciliacion: reconciliar(contador.cerrar(ordenados.length)),
  }
}

/* ═══════════════════════ DESHACER UNA COPIA ═══════════════════════ */

/**
 * Una copia que este trabajo hizo, con lo que hace falta para poder deshacerla.
 *
 * Se piden los DOS lados del estado fresco —¿sigue el original?, ¿ya apunta
 * alguien al destino?— porque entre planificar y deshacer pasan minutos, y en
 * medio el médico puede haber abierto ese expediente. Es la misma razón por la
 * que `autorizadoABorrar` vuelve a preguntar en `rollback.ts`.
 */
export interface CopiaDeMedia {
  readonly origen: string
  readonly destino: string
  readonly importJobId: string
  /** ¿Sigue existiendo el objeto original? Si no, el destino es la única copia. */
  readonly origenPresente: boolean
  /** ¿Ya apunta el expediente al destino? Entonces borrarlo rompe una referencia. */
  readonly destinoReferenciado: boolean
}

export type DecisionDeMedia =
  | { readonly clase: 'revertible'; readonly destino: string }
  | { readonly clase: 'requiere-revision'; readonly destino: string; readonly porQue: MotivoNoRevertible }
  | { readonly clase: 'ajena'; readonly destino: string }

/**
 * ¿Se puede quitar esta copia?
 *
 * Sólo cuando quitarla **no pierde nada**: el original sigue ahí y nadie apunta
 * todavía al destino. Cualquier otra cosa va a revisión. Deshacer una copia que
 * es la única copia de la fotografía de una úlcera de hace seis meses no es
 * deshacer: es perder la imagen, y esa no se puede volver a tomar.
 */
export function decidirReversionDeMedia(c: CopiaDeMedia, importJobId: string): DecisionDeMedia {
  if (c.importJobId !== importJobId) return { clase: 'ajena', destino: c.destino }
  if (!c.origenPresente) {
    return { clase: 'requiere-revision', destino: c.destino, porQue: 'ORIGEN_LEGADO_AUSENTE' }
  }
  if (c.destinoReferenciado) {
    return { clase: 'requiere-revision', destino: c.destino, porQue: 'DESTINO_YA_REFERENCIADO' }
  }
  return { clase: 'revertible', destino: c.destino }
}

export interface PlanDeReversionDeMedia {
  readonly importJobId: string
  readonly aBorrar: readonly string[]
  readonly aRevisar: readonly { readonly destino: string; readonly porQue: MotivoNoRevertible }[]
  readonly ajenas: number
  readonly completa: boolean
}

/** El plan de deshacer, calculado entero antes de borrar nada. */
export function planificarReversionDeMedia(
  copias: readonly CopiaDeMedia[],
  importJobId: string,
): PlanDeReversionDeMedia {
  const aBorrar: string[] = []
  const aRevisar: { destino: string; porQue: MotivoNoRevertible }[] = []
  let ajenas = 0

  for (const c of copias) {
    const d = decidirReversionDeMedia(c, importJobId)
    if (d.clase === 'revertible') aBorrar.push(d.destino)
    else if (d.clase === 'requiere-revision') aRevisar.push({ destino: d.destino, porQue: d.porQue })
    else ajenas++
  }

  return { importJobId, aBorrar, aRevisar, ajenas, completa: aRevisar.length === 0 }
}

/** El español de por qué una copia no se puede deshacer sola. */
export function textoDeMotivoDeMedia(m: MotivoNoRevertible): string {
  return MOTIVO_TEXTO[m]
}
