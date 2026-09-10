/**
 * EL PACIENTE SUBE SUS ESTUDIOS — D-058.
 *
 * ── LA DECISIÓN ─────────────────────────────────────────────────────────────
 *
 * Dueño, 9-sep-2026: el portal permite subir estudios. 10-sep: «haz lo más
 * recomendado». Los valores de aquí son ésos, con su razón, y son lo único que
 * hay que tocar para cambiarlos:
 *
 * - TIPOS: PDF (el laboratorio manda PDF), JPEG/PNG/WebP/HEIC (la foto del
 *   teléfono; HEIC es lo que saca un iPhone si nadie lo cambia). DICOM NO: pesa
 *   cientos de MB, el médico de consulta no lo abre y el informe de imagen
 *   viene en PDF.
 * - 20 MB por archivo: un PDF de laboratorio pesa < 2 MB y una foto de iPhone
 *   3–8 MB; 20 cubre el PDF escaneado a 300 dpi sin abrir la puerta a vídeo.
 * - 5 archivos por envío, 12 por mes: cubre «los tres estudios de esta semana»
 *   y frena un enlace filtrado o una subida en bucle.
 * - RETENCIÓN: forma parte del expediente (NOM-004: cinco años); no se borra
 *   solo. Borrarlo es un acto del consultorio, con bitácora, no del sistema.
 *
 * ── LO QUE NO ES ────────────────────────────────────────────────────────────
 *
 * Un estudio subido NO es un resultado revisado: entra como «aportado por el
 * paciente, sin revisar», abre una tarea `resultado_por_revisar` para el médico
 * titular y sólo el médico lo convierte en un panel de laboratorio (con la IA
 * de visión, que él confirma) o lo marca revisado. Ausencia de revisión no es
 * dato de normalidad.
 *
 * Módulo PURO: sin Storage, sin Firestore, sin fecha propia.
 */

export const TIPOS_ACEPTADOS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const MAX_BYTES_POR_ARCHIVO = 20 * 1024 * 1024
export const MAX_ARCHIVOS_POR_ENVIO = 5
export const MAX_ARCHIVOS_POR_MES = 12
export const MAX_NOMBRE = 120

/** El prefijo del objeto en Storage. Declarado también en `durability/adjuntos.ts`. */
export const PREFIJO_ESTUDIOS = 'estudios-paciente/'

export type MotivoRechazo = 'tipo' | 'tamano' | 'vacio' | 'cantidad' | 'cuota_mensual'

export const TEXTO_RECHAZO: Record<MotivoRechazo, string> = {
  tipo: 'Sólo PDF o fotos (JPG, PNG, HEIC). Si es otro formato, pídele al laboratorio el PDF.',
  tamano: 'El archivo pesa más de 20 MB. Sácale una foto o pide el PDF al laboratorio.',
  vacio: 'El archivo está vacío.',
  cantidad: `Hasta ${MAX_ARCHIVOS_POR_ENVIO} archivos por envío.`,
  cuota_mensual: `Ya subiste ${MAX_ARCHIVOS_POR_MES} estudios este mes. Si necesitas más, avisa al consultorio.`,
}

export interface ArchivoCandidato { nombre: string; contentType: string; bytes: number }

export function rechazoDeArchivo(a: ArchivoCandidato): MotivoRechazo | null {
  if (!TIPOS_ACEPTADOS[a.contentType]) return 'tipo'
  if (!Number.isFinite(a.bytes) || a.bytes <= 0) return 'vacio'
  if (a.bytes > MAX_BYTES_POR_ARCHIVO) return 'tamano'
  return null
}

export function rechazoDelEnvio(archivos: readonly ArchivoCandidato[], subidosEsteMes: number): MotivoRechazo | null {
  if (archivos.length > MAX_ARCHIVOS_POR_ENVIO) return 'cantidad'
  if (subidosEsteMes + archivos.length > MAX_ARCHIVOS_POR_MES) return 'cuota_mensual'
  for (const a of archivos) { const r = rechazoDeArchivo(a); if (r) return r }
  return null
}

const SEGMENTO = /^[A-Za-z0-9_-]{1,120}$/

/** `estudios-paciente/{clinicId}/{patientId}/{id}.{ext}` — y nada que no tenga esa forma. */
export function rutaDeEstudio(clinicId: string, patientId: string, id: string, contentType: string): string {
  const ext = TIPOS_ACEPTADOS[contentType]
  if (!ext) throw new Error('tipo no aceptado')
  for (const s of [clinicId, patientId, id]) if (!SEGMENTO.test(s)) throw new Error('segmento inválido')
  return `${PREFIJO_ESTUDIOS}${clinicId}/${patientId}/${id}.${ext}`
}

/** ¿Esta ruta es de ESTE paciente de ESTE consultorio? Lo que decide si se registra. */
export function esRutaDeEstudioDe(ruta: string, clinicId: string, patientId: string): boolean {
  if (!SEGMENTO.test(clinicId) || !SEGMENTO.test(patientId)) return false
  const m = ruta.match(/^estudios-paciente\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\.([a-z0-9]+)$/)
  if (!m) return false
  return m[1] === clinicId && m[2] === patientId && Object.values(TIPOS_ACEPTADOS).includes(m[4])
}

export function idDeRuta(ruta: string): string | null {
  const m = ruta.match(/\/([A-Za-z0-9_-]+)\.[a-z0-9]+$/)
  return m ? m[1] : null
}

/** El uid sintético con el que el paciente sube: nunca es un miembro del consultorio. */
export function uidDelPortal(clinicId: string, patientId: string): string {
  return `portal__${clinicId}__${patientId}`.slice(0, 128)
}

export function nombreLimpio(nombre: string): string {
  return String(nombre ?? '').replace(/\s+/g, ' ').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, MAX_NOMBRE) || 'estudio'
}

export function esDelMes(subidoEnIso: string, ahoraIso: string): boolean {
  return subidoEnIso.slice(0, 7) === ahoraIso.slice(0, 7)
}

export interface EstudioAportado {
  id?: string
  clinicId: string
  patientId: string
  ruta: string
  nombre: string
  contentType: string
  bytes: number
  subidoEn: string
  origen: 'paciente'
  /** Si lo subió un cuidador autorizado, su id; nunca se adivina. */
  cuidadorId?: string | null
  /** Sólo el consultorio lo pone, con bitácora. */
  retiradoEn?: string | null
}

export type EstadoDeRevision = 'sin_revisar' | 'revisado'

export const TEXTO_ESTADO: Record<EstadoDeRevision, string> = {
  sin_revisar: 'Tu médico lo tiene pendiente de revisar.',
  revisado: 'Tu médico ya lo revisó.',
}
