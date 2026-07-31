'use client'
import { type CambioTranscripcion } from '@/lib/expediente/medical-vocabulary'
import { type AlertaDictado } from '@/lib/asr/corrector-vigilado'
/**
 * EL PIPELINE COMPLETO, no sólo el guardián.
 *
 * Hasta hoy la consulta corría `corregirVigilado`, que es la etapa 1 de nueve:
 * corrige el léxico y vigila que la corrección no se coma una cifra. Las otras
 * ocho —cifras y unidades en su forma escrita, ortografía de siglas, verificación
 * de entidades críticas, gate de ambigüedad— estaban escritas, probadas contra
 * 6 000 frases y **sin conectar a nada**: `procesarTranscript` no aparecía en un
 * solo archivo de producción.
 *
 * O sea que «paracetamol quinientos miligramos cada ocho horas» llegaba a la nota
 * tal cual, en letra, y todo lo que midió el banco de voz no le servía al médico.
 *
 * `procesarTranscript` LLAMA a `corregirVigilado` como su primera etapa, así que
 * esto no quita nada: añade.
 */
import { procesarTranscript } from '@/lib/asr/pipeline'
import { fetchAutenticado } from '@/lib/auth-client'
import { auth, storage } from '@/lib/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
/**
 * Hook de grabación HIFI con streaming + pause/resume + crash recovery.
 *
 * v3 — arquitectura "ultra perfect" (2026-06-10):
 *
 *   CAPTURA (sin cambios v2):
 *     48kHz · mono · 128kbps Opus · autoGainControl · medidor RMS en vivo
 *
 *   STREAMING (nuevo):
 *     Cada ~20s se manda un chunk a /api/expediente/transcribir-chunk.
 *     El texto aparece en `transcripcionParcial` mientras la grabación
 *     sigue. Al detener, se reusa lo ya transcrito + el último chunk
 *     pendiente — el médico ya no espera 2 min al final.
 *     `setTranscripcion` final = concatenación + corrección léxica.
 *
 *   PAUSE / RESUME (nuevo):
 *     pausar() — MediaRecorder.pause() + congela timer/analyser
 *     reanudar() — MediaRecorder.resume() + reanuda timer/analyser
 *     útil cuando el paciente sale al baño o entra acompañante a media
 *     consulta sin que termine la nota.
 *
 *   CRASH RECOVERY (nuevo):
 *     Los chunks se persisten en IndexedDB conforme van llegando.
 *     Si el navegador crashea o el doctor cierra la pestaña por error,
 *     al reabrir la consulta detectamos chunks huérfanos y ofrecemos
 *     recuperar. NUNCA se pierde audio capturado.
 *     Los chunks se borran al confirmar la transcripción final.
 *
 *   LIBERACIÓN DE RECURSOS (sin cambios v2):
 *     5 paths cubiertos: detener feliz, fallo de getUserMedia, error en
 *     vivo, unmount, reset. AudioContext.close() + RAF cancel + IDB clear.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

type Estado = 'inactivo' | 'grabando' | 'pausado' | 'subiendo' | 'listo' | 'error'

export interface OpcionesGrabacion {
  noiseSuppression?: boolean
  echoCancellation?: boolean
  autoGainControl?: boolean
  /** Activa streaming chunks (default true). Off solo para debugging. */
  streaming?: boolean
  /** Intervalo de chunks a transcribir en vivo (ms). Default 20s. */
  intervaloChunkMs?: number
  /** ID estable para recovery vía IndexedDB (ej. patientId). */
  recoveryKey?: string
  /**
   * Contexto del dictado: `'uci'` hace que el servidor sesgue el reconocedor con
   * vocabulario de cuidados críticos. Medido sobre el corpus de 498 audios: sin
   * esto, CVVHDF, VExUS y RASS fallan porque el sesgo apunta al consultorio.
   */
  contexto?: 'uci'
}

/** Un turno de habla diarizado (AssemblyAI): quién habló y qué dijo. */
export interface Utterance {
  speaker: string   // 'A' | 'B' | 'C' … (etiqueta cruda de AssemblyAI)
  text: string
}

export interface UseGrabacionAudio {
  soportado: boolean
  estado: Estado
  duracion: number
  transcripcion: string
  /** Turnos de habla separados por voz (vacío si no hubo diarización). */
  utterances: Utterance[]
  /** Texto que va apareciendo conforme llegan los chunks (streaming). */
  transcripcionParcial: string
  error: string
  nivelAudio: number
  silencioProlongado: boolean
  bytesGrabados: number
  /** Cuántos chunks han sido transcritos en vivo. */
  chunksTranscritos: number
  /**
   * Correcciones léxicas aplicadas a la transcripción final.
   * Cada una es { original, corregido, motivo } — el médico puede
   * revisarlas y revertirlas (documento legal: nada cambia en silencio).
   */
  correcciones: CambioTranscripcion[]
  /**
   * Lo que el GUARDIÁN descartó, y las dosis que se quedaron sin cantidad.
   *
   * No son correcciones aplicadas: son correcciones que NO se aplicaron porque
   * tocaban una cifra, una unidad, una sigla crítica, una negación o el lado del
   * paciente. La pantalla debe pedirle al médico que revise esa parte.
   */
  alertasDictado: AlertaDictado[]
  iniciar: (opts?: OpcionesGrabacion) => Promise<void>
  detener: () => Promise<void>
  pausar: () => void
  reanudar: () => void
  reset: () => void
  setTranscripcion: (t: string) => void
  /** Verifica si hay audio sin transcribir guardado de una sesión previa. */
  hayRecovery: (recoveryKey: string) => Promise<boolean>
  /** Recupera el audio huérfano y lo manda a transcribir. */
  recuperarAudio: (recoveryKey: string) => Promise<void>
  descargarAudioGuardado: (recoveryKey: string) => Promise<boolean>
  /** BORRA de IndexedDB el audio guardado de una clave (descartar recuperación). */
  descartarRecovery: (recoveryKey: string) => Promise<void>
}

const SILENCIO_MS = 15_000
const NIVEL_SILENCIO = 0.02
// 16 kHz mono · 64 kbps Opus. Es EXACTAMENTE lo que usa el ASR (remuestrea a 16 kHz)
// y AssemblyAI diariza perfecto a 16 kHz (es el estándar de voz/telefonía). Se
// volvió de 48k/128k a esto porque el archivo pesado (~2.5×) cruzaba el umbral de
// "audio grande" y en Safari (mp4) el troceado por partes fallaba → "no se pudo
// transcribir". Ligero = sube rápido, no hace timeout y no rompe la transcripción.
const BITRATE_OPUS = 64_000
const SAMPLE_RATE_OBJETIVO = 16_000
const INTERVALO_CHUNK_DEFAULT_MS = 20_000

// ─────────────────────────────────────────────────────────────────
// IndexedDB — almacén minimalista para crash recovery
// ─────────────────────────────────────────────────────────────────

const DB_NAME = 'nexusmed-recovery'
const STORE = 'audio_chunks'

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ['recoveryKey', 'idx'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function guardarChunk(recoveryKey: string, idx: number, blob: Blob) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ recoveryKey, idx, blob, ts: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB puede fallar en modo privado — no es bloqueante
  }
}

async function leerChunks(recoveryKey: string): Promise<Blob[]> {
  try {
    const db = await abrirDB()
    const chunks: { idx: number; blob: Blob }[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      const req = tx.objectStore(STORE).getAll(range)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return chunks.sort((a, b) => a.idx - b.idx).map(c => c.blob)
  } catch {
    return []
  }
}

async function borrarChunks(recoveryKey: string) {
  try {
    const db = await abrirDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const range = IDBKeyRange.bound([recoveryKey, 0], [recoveryKey, Number.MAX_SAFE_INTEGER])
      tx.objectStore(STORE).delete(range)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* */ }
}

const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Intenta transcribir CON diarización (AssemblyAI). Sube el audio, encola y
 * hace polling hasta completar. Devuelve texto + turnos de habla, o null si la
 * llave no está configurada o algo falla → el caller cae a OpenAI sin diarizar.
 */
async function intentarDiarizar(
  blob: Blob, ext: string,
): Promise<{ text: string; utterances: Utterance[] } | null> {
  try {
    const fd = new FormData()
    fd.append('audio', blob, `consulta.${ext}`)
    const res = await fetchAutenticado('/api/expediente/transcribir-diarizado', { method: 'POST', body: fd })
    if (!res.ok) return null                       // 503 sinClave o error → fallback
    const sub = await res.json()
    if (!sub.ok || !sub.id) return null
    // Polling hasta completar (máx ~3 min: 90 × 2s)
    for (let i = 0; i < 90; i++) {
      await sleepMs(2000)
      const p = await fetchAutenticado(`/api/expediente/transcribir-diarizado?id=${encodeURIComponent(sub.id)}`)
      if (!p.ok) continue
      const d = await p.json()
      if (d.status === 'completed') return { text: d.text ?? '', utterances: (d.utterances ?? []) as Utterance[] }
      if (d.status === 'error' || d.ok === false) return null
    }
    return null                                    // timeout
  } catch {
    return null
  }
}

/**
 * Diarización de audio LARGO: sube el audio a Firebase Storage (sin pasar por el
 * límite de 4.5MB de Vercel), manda la URL a AssemblyAI, hace polling y BORRA el
 * audio al terminar (no deja PHI). Devuelve texto + turnos, o null (→ fallback).
 */
async function intentarDiarizarLargo(
  blob: Blob, ext: string, recoveryKey: string,
): Promise<{ text: string; utterances: Utterance[] } | null> {
  if (!storage || !auth.currentUser) return null
  const uid = auth.currentUser.uid
  const path = `consultas-audio/${uid}/${(recoveryKey || 'tmp').replace(/[^\w-]/g, '_')}-${Date.now()}.${ext}`
  const objRef = storageRef(storage, path)
  let subido = false
  try {
    await uploadBytes(objRef, blob, { contentType: blob.type || 'audio/webm' })
    subido = true
    const url = await getDownloadURL(objRef)
    const res = await fetchAutenticado('/api/expediente/transcribir-diarizado', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: url }),
    })
    if (!res.ok) return null
    const sub = await res.json()
    if (!sub.ok || !sub.id) return null
    // Polling más holgado (audio largo tarda más): hasta ~6 min
    for (let i = 0; i < 144; i++) {
      await sleepMs(2500)
      const p = await fetchAutenticado(`/api/expediente/transcribir-diarizado?id=${encodeURIComponent(sub.id)}`)
      if (!p.ok) continue
      const d = await p.json()
      if (d.status === 'completed') return { text: d.text ?? '', utterances: (d.utterances ?? []) as Utterance[] }
      if (d.status === 'error' || d.ok === false) return null
    }
    return null
  } catch {
    return null
  } finally {
    // Borra el audio de Storage pase lo que pase (AssemblyAI ya lo descargó al encolar).
    if (subido) { try { await deleteObject(objRef) } catch { /* lifecycle rule lo limpia */ } }
  }
}

// Guarda la causa REAL del último fallo de transcripción (para mostrarla en vez
// de un error genérico: sin saldo, llave faltante, audio muy grande, timeout…).
let motivoFalloTranscripcion = ''

/**
 * Transcribe un blob vía OpenAI. NUNCA lanza: ante 413/500/HTML devuelve ''.
 * (Antes, res.json() sobre una página de error HTML tiraba SyntaxError.)
 */
async function transcribirBlobSimple(blob: Blob, ext: string, contexto = ''): Promise<string> {
  try {
    const fd = new FormData()
    fd.append('audio', blob, `audio.${ext}`)
    if (contexto) fd.append('contexto', contexto)
    const res = await fetchAutenticado('/api/expediente/transcribir', { method: 'POST', body: fd })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // El servidor manda un `error` descriptivo (ej. "La API key de OpenAI es
      // inválida o expiró", "OpenAI no disponible temporalmente (HTTP 400)…").
      // Antes se ignoraba y solo salía "OpenAI HTTP 502" → causa invisible.
      let msgServidor = ''
      try { msgServidor = String(JSON.parse(body)?.error || '') } catch { /* body no-JSON */ }
      motivoFalloTranscripcion =
        res.status === 413 ? 'audio demasiado grande para el servidor'
        : /credit|balance|quota|insufficient|billing|saldo/i.test(body) ? 'SIN SALDO en OpenAI (carga créditos en platform.openai.com)'
        : res.status === 401 ? 'llave de OpenAI inválida'
        : msgServidor ? msgServidor.slice(0, 140)   // ← causa REAL del servidor
        : res.status === 503 ? 'OPENAI_API_KEY no configurada en Vercel'
        : `OpenAI HTTP ${res.status}`
      return ''                                     // 413 (límite Vercel) / 5xx / HTML → sin texto
    }
    const data = await res.json().catch(() => null)
    if (data?.ok && data.text) return data.text
    motivoFalloTranscripcion = data?.error ? String(data.error).slice(0, 100) : 'OpenAI devolvió respuesta vacía'
    return ''
  } catch (e) {
    motivoFalloTranscripcion = 'sin conexión / timeout: ' + String(e).slice(0, 50)
    return ''
  }
}

/**
 * Transcribe UN blob con el motor que esté configurado: primero OpenAI; si no
 * hay OPENAI_API_KEY (503) o falla, intenta AssemblyAI. Así basta con tener
 * UNA de las dos llaves. Nunca lanza.
 */
async function transcribirParte(blob: Blob, ext: string, contexto = ''): Promise<string> {
  const openai = await transcribirBlobSimple(blob, ext, contexto)
  if (openai) return openai
  // Fallback: AssemblyAI (la misma llave que usa la diarización)
  const aai = await intentarDiarizar(blob, ext)
  return aai?.text ?? ''
}

/**
 * Transcribe audio largo EN PARTES para no chocar con el límite de ~4.5MB de
 * Vercel en el body de la función. Agrupa los chunks en lotes < 3.6MB y, como
 * los fragmentos WebM posteriores no traen cabecera, antepone el primer chunk
 * (que SÍ la tiene) a cada lote para que el decodificador lo entienda.
 */
export interface ResultadoPorPartes { texto: string; lotesFallidos: number }

async function transcribirEnPartes(chunks: Blob[], mime: string, ext: string, contexto = ''): Promise<ResultadoPorPartes> {
  if (chunks.length === 0) return { texto: '', lotesFallidos: 0 }
  const header = chunks[0]
  const LIMITE = 3_600_000
  const lotes: Blob[][] = []
  let actual: Blob[] = []
  let size = 0
  for (const c of chunks) {
    if (size + c.size > LIMITE && actual.length > 0) { lotes.push(actual); actual = []; size = 0 }
    actual.push(c); size += c.size
  }
  if (actual.length) lotes.push(actual)

  /**
   * UN LOTE QUE FALLA YA NO DESAPARECE SIN DEJAR RASTRO.
   *
   * Antes era `if (t) textos.push(t)`: si el lote 2 de 4 fallaba (un 429 o un 500
   * de OpenAI, o la red), su texto se descartaba, los otros tres se pegaban, y
   * como el resultado global no venía vacío el llamador borraba el audio de
   * IndexedDB — la única copia. El médico veía una transcripción fluida a la que
   * le faltaba el centro de la consulta, sin ninguna señal de que faltara algo.
   *
   * Toda grabación de más de ~7,5 min entra por aquí, así que no es un caso raro:
   * es cualquier consulta larga con la red inestable.
   *
   * Ahora se deja un marcador VISIBLE en la posición exacta del hueco y se cuenta
   * cuántos lotes fallaron, para que el llamador NO borre el audio.
   */
  const textos: string[] = []
  let lotesFallidos = 0
  for (let b = 0; b < lotes.length; b++) {
    const parts = b === 0 ? lotes[b] : [header, ...lotes[b]]
    const t = await transcribirParte(new Blob(parts, { type: mime }), ext, contexto)
    if (t) {
      textos.push(t)
    } else {
      lotesFallidos++
      textos.push(`\n[⚠ FALTA UN TRAMO DE LA GRABACIÓN — no se pudo transcribir. El audio se conservó para reintentar.]\n`)
    }
  }
  return { texto: textos.join(' '), lotesFallidos }
}


/**
 * Aplica el diccionario de correcciones de fármacos a CADA TURNO diarizado.
 *
 * Bug encontrado en la auditoría: el corrector solo se aplicaba al texto corrido.
 * Pero cuando hay separación de voces, lo que se le manda a la IA para redactar la
 * nota son los TURNOS, no el texto corrido — y los turnos iban sin corregir.
 *
 * Resultado: el médico veía "ceftriaxona" en pantalla (texto corrido, corregido) y
 * el modelo recibía "sefriaxona" (turno, crudo). El desajuste era invisible, y
 * ocurría justo en el camino que el médico considera el bueno. En el modo simple sí
 * se corregía.
 */
function corregirUtterances(us: Utterance[]): Utterance[] {
  return us.map(u => ({ ...u, text: procesarTranscript(u.text).texto }))
}

// ─────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────

export function useGrabacionAudio(): UseGrabacionAudio {
  const [soportado] = useState(() => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined')
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [duracion, setDuracion] = useState(0)
  const [transcripcion, setTranscripcion] = useState('')
  const [utterances, setUtterances] = useState<Utterance[]>([])
  const [transcripcionParcial, setTranscripcionParcial] = useState('')
  const [error, setError] = useState('')
  const [nivelAudio, setNivelAudio] = useState(0)
  const [silencioProlongado, setSilencioProlongado] = useState(false)
  const [bytesGrabados, setBytesGrabados] = useState(0)
  const [chunksTranscritos, setChunksTranscritos] = useState(0)
  const [correcciones, setCorrecciones] = useState<CambioTranscripcion[]>([])
  const [alertasDictado, setAlertasDictado] = useState<AlertaDictado[]>([])

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])           // chunks recientes para flush
  const todosChunksRef = useRef<Blob[]>([])      // TODOS los chunks (blob final)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkFlushRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)
  const pausaTotalMsRef = useRef<number>(0)
  const pausaInicioRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const ultimaSenalRef = useRef<number>(0)
  // Streaming
  const chunkIdxRef = useRef<number>(0)
  const textosChunksRef = useRef<string[]>([])
  const recoveryKeyRef = useRef<string>('')
  const contextoRef = useRef<string>('')
  // Anti-pérdida: desde qué índice persistir en IndexedDB. Si ya hay audio de una
  // transcripción que FALLÓ bajo la misma llave, los chunks nuevos se guardan
  // DESPUÉS (no encima), para no borrar el audio que se prometió a salvo.
  const recoveryBaseRef = useRef<number>(0)
  const streamingActivoRef = useRef<boolean>(true)
  const mimeRef = useRef<string>('')

  const liberarRecursos = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state !== 'inactive') {
      /**
       * DESENGANCHAR el handler ANTES de parar — auditoría 2026-07 (P0). `stop()`
       * dispara un `ondataavailable` FINAL de forma asíncrona, y justo abajo se
       * resetea `todosChunksRef = []`. Ese último evento calculaba
       * `localIdx = recoveryBaseRef - 1` y PISABA un chunk válido del respaldo en
       * IndexedDB (o escribía en idx -1), corrompiendo el audio de recuperación al
       * salir de la consulta grabando. Los chunks ya persistidos quedan intactos;
       * solo se descarta el buffer final (~2 s), que es el intercambio correcto.
       */
      try { rec.ondataavailable = null } catch { /* */ }
      try { rec.stop() } catch { /* */ }
    }
    mediaRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { try { t.stop() } catch { /* */ } })
      streamRef.current = null
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null

    chunksRef.current = []
    todosChunksRef.current = []
    pausaTotalMsRef.current = 0
    pausaInicioRef.current = 0
    chunkIdxRef.current = 0
    textosChunksRef.current = []
    setNivelAudio(0)
    setSilencioProlongado(false)
    setBytesGrabados(0)
    setChunksTranscritos(0)
    setTranscripcionParcial('')
    setUtterances([])
  }, [])

  const reset = useCallback(() => {
    const rk = recoveryKeyRef.current
    liberarRecursos()
    setEstado('inactivo'); setDuracion(0); setTranscripcion(''); setError('')
    setCorrecciones([]); setUtterances([]); setAlertasDictado([])
    if (rk) borrarChunks(rk)
    recoveryKeyRef.current = ''
  }, [liberarRecursos])

  useEffect(() => () => { liberarRecursos() }, [liberarRecursos])

  // Función: flushea chunks acumulados al endpoint de streaming
  const flushChunks = useCallback(async () => {
    if (!streamingActivoRef.current) return
    if (chunksRef.current.length === 0) return
    const idx = chunkIdxRef.current++
    const blob = new Blob(chunksRef.current, { type: mimeRef.current })
    chunksRef.current = []
    if (blob.size < 1024) return  // skip muy pequeños

    // Contexto previo (últimas ~30 palabras del último chunk transcrito)
    const prevContext = textosChunksRef.current.length
      ? textosChunksRef.current[textosChunksRef.current.length - 1].split(/\s+/).slice(-30).join(' ')
      : ''

    try {
      const fd = new FormData()
      fd.append('audio', blob, `chunk-${idx}.webm`)
      fd.append('chunkIdx', String(idx))
      if (prevContext) fd.append('prevContext', prevContext)
      const res = await fetchAutenticado('/api/expediente/transcribir-chunk', { method: 'POST', body: fd })
      if (!res.ok) return                              // 413/5xx/HTML → no parsear (evita SyntaxError)
      const data = await res.json().catch(() => null)
      if (data?.ok && data.text) {
        // Corrección léxica médica TAMBIÉN en chunks — el médico ve los
        // fármacos bien escritos EN VIVO, no solo al final
        // En el parcial en vivo se aplica el pipeline entero: si el médico ve
        // «500 mg» mientras habla, ve lo mismo que va a quedar en la nota. Con
        // sólo la corrección léxica veía «quinientos miligramos» y luego el
        // texto le cambiaba al cerrar, que parece un error de la aplicación.
        textosChunksRef.current[idx] = procesarTranscript(data.text).texto
        // Reconstruir transcripción parcial en orden
        const completa = textosChunksRef.current.filter(Boolean).join(' ')
        setTranscripcionParcial(completa)
        setChunksTranscritos(c => c + 1)
      }
    } catch {
      // Falla de red — el chunk queda solo en el blob final. No reintentar
      // (al detener se reusa el blob completo)
    }
  }, [])

  const iniciar = useCallback(async (opts?: OpcionesGrabacion) => {
    if (!soportado) { setError('Tu navegador no soporta grabación de audio'); setEstado('error'); return }
    streamingActivoRef.current = opts?.streaming !== false
    recoveryKeyRef.current = opts?.recoveryKey ?? ''
    contextoRef.current = opts?.contexto ?? ''
    // Si ya hay chunks bajo esta llave (p. ej. audio de una transcripción que
    // falló y NO se ha recuperado), NO los pises: continúa el índice DESPUÉS de
    // ellos. En éxito, borrarChunks limpia todo y la próxima grabación arranca en 0.
    recoveryBaseRef.current = 0
    if (recoveryKeyRef.current) {
      try { recoveryBaseRef.current = (await leerChunks(recoveryKeyRef.current)).length } catch { recoveryBaseRef.current = 0 }
    }
    const intervaloMs = opts?.intervaloChunkMs ?? INTERVALO_CHUNK_DEFAULT_MS

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: opts?.echoCancellation ?? true,
          noiseSuppression: opts?.noiseSuppression ?? true,
          autoGainControl: opts?.autoGainControl ?? true,
          sampleRate: SAMPLE_RATE_OBJETIVO,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      chunksRef.current = []
      todosChunksRef.current = []
      chunkIdxRef.current = 0
      textosChunksRef.current = []
      // Limpia la diarización del tramo anterior: la separación de voces es POR
      // blob y el blob nuevo solo trae este tramo. Si no se limpia, quedaban los
      // turnos del tramo 1 y, al no diarizar el tramo 2, la nota se armaba con el
      // tramo viejo ignorando el nuevo. (El texto completo multi-tramo se conserva
      // aparte en la transcripción; ver conBase/baseTranscripcionRef.)
      setUtterances([])

      // AnalyserNode → medidor de nivel + detección de silencio
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        // Sin forzar sampleRate: usar la nativa del dispositivo evita un remuestreo
        // que en algunos equipos causaba cortes/trabas en la grabación.
        const ctx = new Ctx()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        ultimaSenalRef.current = Date.now()

        const buffer = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getFloatTimeDomainData(buffer)
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
          const rms = Math.sqrt(sumSq / buffer.length)
          const nivel = Math.min(1, rms / 0.3)
          setNivelAudio(nivel)
          if (rms > NIVEL_SILENCIO) {
            ultimaSenalRef.current = Date.now()
            if (silencioProlongado) setSilencioProlongado(false)
          } else if (Date.now() - ultimaSenalRef.current > SILENCIO_MS) {
            setSilencioProlongado(true)
          }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch { /* sin medidor */ }

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        '',
      ]
      let mime = ''
      for (const m of candidates) {
        if (m === '' || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m))) {
          mime = m; break
        }
      }
      mimeRef.current = mime

      const recOpts: MediaRecorderOptions = mime
        ? { mimeType: mime, audioBitsPerSecond: BITRATE_OPUS }
        : { audioBitsPerSecond: BITRATE_OPUS }
      const rec = new MediaRecorder(stream, recOpts)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          todosChunksRef.current.push(e.data)
          setBytesGrabados(prev => prev + e.data.size)
          // Persistir en IndexedDB para crash recovery
          if (recoveryKeyRef.current) {
            const localIdx = recoveryBaseRef.current + todosChunksRef.current.length - 1
            guardarChunk(recoveryKeyRef.current, localIdx, e.data)
          }
        }
      }
      rec.onerror = () => {
        liberarRecursos()
        setError('Error en la grabación de audio')
        setEstado('error')
      }
      rec.start(2000)
      mediaRef.current = rec
      startRef.current = Date.now()
      pausaTotalMsRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        setDuracion(Math.floor(transcurrido / 1000))
      }, 500)

      // Streaming: flush periódico al endpoint
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, intervaloMs)
      }

      setEstado('grabando')
      setError('')
    } catch (e) {
      liberarRecursos()
      const err = e as Error
      if (err.name === 'NotAllowedError' || err.message.includes('denied')) {
        setError('Permiso de micrófono denegado. Permítelo en los ajustes del navegador.')
      } else if (err.name === 'NotFoundError') {
        setError('No se detectó micrófono en este dispositivo.')
      } else {
        setError('No se pudo iniciar la grabación: ' + err.message)
      }
      setEstado('error')
    }
  }, [soportado, liberarRecursos, silencioProlongado, flushChunks])

  const pausar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'recording') return
    try {
      rec.pause()
      pausaInicioRef.current = Date.now()
      // Pausar timer + analyser + flush
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (chunkFlushRef.current) { clearInterval(chunkFlushRef.current); chunkFlushRef.current = null }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      setEstado('pausado')
    } catch { /* */ }
  }, [])

  const reanudar = useCallback(() => {
    const rec = mediaRef.current
    if (!rec || rec.state !== 'paused') return
    try {
      rec.resume()
      pausaTotalMsRef.current += Date.now() - pausaInicioRef.current
      pausaInicioRef.current = 0
      timerRef.current = setInterval(() => {
        const transcurrido = Date.now() - startRef.current - pausaTotalMsRef.current
        setDuracion(Math.floor(transcurrido / 1000))
      }, 500)
      if (streamingActivoRef.current) {
        chunkFlushRef.current = setInterval(flushChunks, INTERVALO_CHUNK_DEFAULT_MS)
      }
      // Reanudar analyser
      if (audioCtxRef.current && analyserRef.current) {
        const analyser = analyserRef.current
        const buffer = new Float32Array(analyser.fftSize)
        const tick = () => {
          if (!analyserRef.current) return
          analyserRef.current.getFloatTimeDomainData(buffer)
          let sumSq = 0
          for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i]
          const rms = Math.sqrt(sumSq / buffer.length)
          setNivelAudio(Math.min(1, rms / 0.3))
          if (rms > NIVEL_SILENCIO) ultimaSenalRef.current = Date.now()
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      setEstado('grabando')
    } catch { /* */ }
  }, [flushChunks])

  const detener = useCallback(async () => {
    const rec = mediaRef.current
    if (!rec) return
    setEstado('subiendo')

    await new Promise<void>(resolve => {
      rec.onstop = () => resolve()
      try { rec.stop() } catch { resolve() }
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (chunkFlushRef.current) clearInterval(chunkFlushRef.current)
    chunkFlushRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch { /* */ }
      audioCtxRef.current = null
    }
    analyserRef.current = null
    mediaRef.current = null

    // Flush final del último chunk pendiente (mejora la cobertura del streaming)
    if (streamingActivoRef.current && chunksRef.current.length > 0) {
      await flushChunks()
    }

    const allChunks = todosChunksRef.current.slice()  // copia ANTES de limpiar (para transcribir en partes)
    const blob = new Blob(allChunks, { type: rec.mimeType })
    chunksRef.current = []
    todosChunksRef.current = []
    if (blob.size === 0) { setEstado('error'); setError('Audio vacío'); return }

    const mt = rec.mimeType || ''
    const ext = mt.includes('mp4') ? 'm4a' : mt.includes('ogg') ? 'ogg' : mt.includes('wav') ? 'wav' : 'webm'

    const aplicar = (texto: string) => {
      const r = procesarTranscript(texto)
      setTranscripcion(r.texto)
      setCorrecciones(r.cambiosLexicos)
      // El pipeline ya trae las alertas de las nueve etapas, no sólo las del
      // guardián: incluye lo que pide confirmación por ambigüedad.
      setAlertasDictado(r.alertas)
      setEstado('listo')
    }

    motivoFalloTranscripcion = ''  // limpia causa previa
    // El body de las funciones de Vercel está limitado a ~4.5MB.
    const GRANDE = blob.size > 3_600_000

    // 1) Diarización (separa voces): audio corto pasa directo; audio LARGO sube a
    //    Storage y se diariza por URL (sin chocar con el límite de Vercel).
    const diar = GRANDE
      ? await intentarDiarizarLargo(blob, ext, recoveryKeyRef.current)
      : await intentarDiarizar(blob, ext)
    if (diar && diar.text.trim()) {
      setUtterances(corregirUtterances(diar.utterances))
      aplicar(diar.text)
      if (recoveryKeyRef.current) await borrarChunks(recoveryKeyRef.current)
      return
    }

    // 2) Transcripción robusta (en partes si es grande). Nunca lanza.
    const porPartes = GRANDE
      ? await transcribirEnPartes(allChunks, rec.mimeType, ext, contextoRef.current)
      : { texto: await transcribirBlobSimple(blob, ext, contextoRef.current), lotesFallidos: 0 }
    const texto = porPartes.texto

    if (texto.trim()) {
      aplicar(texto)
      // Solo se borra el audio si NO faltó ningún tramo. Si algo se perdió, el
      // audio es lo único que permite recuperarlo: se conserva.
      if (recoveryKeyRef.current && porPartes.lotesFallidos === 0) await borrarChunks(recoveryKeyRef.current)
      return
    }

    // 3) Si la transcripción final no dio texto, usa lo que capturó el streaming
    //    en vivo. NO borramos el audio guardado: queda para reintentar (recovery).
    if (textosChunksRef.current.length > 0) {
      aplicar(textosChunksRef.current.filter(Boolean).join(' '))
      return
    }

    setError(`No se pudo transcribir${motivoFalloTranscripcion ? ` (${motivoFalloTranscripcion})` : ''}. El audio quedó GUARDADO en este dispositivo — reintenta con "Recuperar audio".`)
    setEstado('error')
  }, [flushChunks])

  // ─── Recovery API ──────────────────────────────────────────
  const hayRecovery = useCallback(async (recoveryKey: string): Promise<boolean> => {
    const chunks = await leerChunks(recoveryKey)
    return chunks.length > 0
  }, [])

  /**
   * Descarta el audio de recuperación BORRÁNDOLO de IndexedDB.
   *
   * EL BUG QUE CIERRA: el botón "Descartar audio guardado" llamaba a `reset()`,
   * que solo borra de IndexedDB la clave de la sesión ACTUAL
   * (`recoveryKeyRef.current`). Pero al recargar la página y encontrar audio
   * huérfano, esa ref está vacía —no se ha grabado nada en esta sesión— así que
   * no se borraba nada y el audio reaparecía en cada recarga. Aquí se borra por
   * clave explícita, que es la que sí apunta al audio guardado.
   */
  const descartarRecovery = useCallback(async (recoveryKey: string) => {
    await borrarChunks(recoveryKey)
  }, [])

  const recuperarAudio = useCallback(async (recoveryKey: string) => {
    setEstado('subiendo')
    const chunks = await leerChunks(recoveryKey)
    if (chunks.length === 0) {
      setError('No hay audio guardado para recuperar')
      setEstado('error')
      return
    }
    const mime = chunks[0].type || 'audio/webm'
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
    motivoFalloTranscripcion = ''

    // 1) Mejor opción: audio COMPLETO vía Storage → AssemblyAI (diariza y evita el
    //    troceado frágil). Si Storage no está habilitado, devuelve null.
    const blob = new Blob(chunks, { type: mime })
    const diar = await intentarDiarizarLargo(blob, ext, recoveryKey)
    let texto = ''
    if (diar && diar.text.trim()) {
      setUtterances(corregirUtterances(diar.utterances))
      texto = diar.text
    } else {
      // 2) Fallback: transcribir EN PARTES (OpenAI o AssemblyAI por trozo). Nunca lanza.
      texto = (await transcribirEnPartes(chunks, mime, ext)).texto
    }

    if (texto.trim()) {
      const r = procesarTranscript(texto)
      setTranscripcion(r.texto)
      setCorrecciones(r.cambiosLexicos)
      setAlertasDictado(r.alertas)
      setEstado('listo')
      await borrarChunks(recoveryKey)  // solo se borra si SÍ se transcribió
    } else {
      // No borramos el audio: sigue disponible para reintentar más tarde.
      setError(`No se pudo transcribir el audio recuperado${motivoFalloTranscripcion ? ` (${motivoFalloTranscripcion})` : ''}. Sigue guardado en este dispositivo; reintenta más tarde.`)
      setEstado('error')
    }
  }, [])

  // Escape hatch: descarga el audio guardado como ARCHIVO al dispositivo, para que
  // la consulta NUNCA se pierda aunque la transcripción falle. No borra nada.
  const descargarAudioGuardado = useCallback(async (recoveryKey: string): Promise<boolean> => {
    const chunks = await leerChunks(recoveryKey)
    if (chunks.length === 0) return false
    const mime = chunks[0].type || 'audio/webm'
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
    const blob = new Blob(chunks, { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consulta-audio-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  }, [])

  return {
    soportado, estado, duracion, transcripcion, utterances, transcripcionParcial, error,
    nivelAudio, silencioProlongado, bytesGrabados, chunksTranscritos, correcciones,
    alertasDictado,
    iniciar, detener, pausar, reanudar, reset, setTranscripcion,
    hayRecovery, recuperarAudio, descargarAudioGuardado, descartarRecovery,
  }
}
